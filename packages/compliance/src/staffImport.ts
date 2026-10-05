import { minimumRatePence } from "./rules/minimumWage";
import type { LocalDate } from "./types";

/** The columns of the staff import file, in the order the template uses. */
export const STAFF_IMPORT_COLUMNS = [
  "Full name",
  "Date of birth",
  "Hourly rate",
  "Rate starts on",
  "Start date",
  "Days per week",
  "Irregular hours",
  "Mobile",
  "Payroll ID",
  "Job roles",
] as const;

export const STAFF_IMPORT_REQUIRED = ["Full name", "Date of birth", "Hourly rate"] as const;

/** Most imports are a team of a few dozen; this keeps one upload quick to check and save. */
export const STAFF_IMPORT_MAX_ROWS = 500;

type Column = (typeof STAFF_IMPORT_COLUMNS)[number];

/** Other headings people's spreadsheets commonly use for the same thing. */
const ALIASES: Record<string, Column> = {
  name: "Full name",
  "full name": "Full name",
  "employee name": "Full name",
  "staff name": "Full name",
  dob: "Date of birth",
  "date of birth": "Date of birth",
  "birth date": "Date of birth",
  "hourly rate": "Hourly rate",
  rate: "Hourly rate",
  "pay rate": "Hourly rate",
  "hourly pay": "Hourly rate",
  "rate starts on": "Rate starts on",
  "rate from": "Rate starts on",
  "start date": "Start date",
  "employment start": "Start date",
  "started on": "Start date",
  "days per week": "Days per week",
  "irregular hours": "Irregular hours",
  mobile: "Mobile",
  "mobile number": "Mobile",
  phone: "Mobile",
  "payroll id": "Payroll ID",
  "employee number": "Payroll ID",
  "job roles": "Job roles",
  "job role": "Job roles",
  role: "Job roles",
  roles: "Job roles",
};

/** Reads CSV text as saved by Excel, Numbers or Google Sheets: quoted fields, commas and new lines inside quotes, Windows line endings. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
};

/** A UK date in the forms spreadsheets use: 2026-04-01, 01/04/2026, 1/4/2026 or 01-04-2026. */
export const parseUkDate = (input: string): LocalDate | null => {
  const s = input.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (uk) [d, m, y] = [Number(uk[1]), Number(uk[2]), Number(uk[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10) as LocalDate;
};

const yes = (s: string) => /^(y|yes|true|1)$/i.test(s.trim());

export type ImportPerson = {
  line: number;
  fullName: string;
  dateOfBirth: LocalDate;
  hourlyPence: number;
  rateFrom: LocalDate;
  employmentStart: LocalDate | null;
  daysPerWeek: number;
  irregularHours: boolean;
  mobile: string | null;
  payrollId: string | null;
  roles: string[];
};

export type ImportCheck = {
  /** People ready to add. */
  people: ImportPerson[];
  /** Rows that cannot be added, with every reason, so they can all be fixed in one go. */
  problems: { line: number; name: string; reasons: string[] }[];
  /** Added, but worth a look. */
  warnings: { line: number; name: string; text: string }[];
  /** Rows left out because the person is already in the business or appears twice in the file. */
  duplicates: { line: number; name: string }[];
  /** Set when the file cannot be read at all. */
  fileError?: string;
};

const key = (name: string, dob: string) => `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${dob}`;

/**
 * Checks a staff import file without saving anything. Each row needs a name, date of birth and hourly
 * rate. A pay rate below the National Minimum Wage for the person's age is a warning, not a stop: the rota
 * check still blocks any shift that would underpay them.
 */
export const checkStaffImport = (
  text: string,
  opts: {
    today: LocalDate;
    /** Name and date of birth of everyone already in the business. */
    existing: { fullName: string; dateOfBirth: string }[];
    /** The business's job roles. */
    roles: string[];
    normaliseMobile: (input: string) => string | null;
  },
): ImportCheck => {
  const result: ImportCheck = { people: [], problems: [], warnings: [], duplicates: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) return { ...result, fileError: "The file has no rows of people. Use the template, with one person on each row under the headings." };
  if (rows.length - 1 > STAFF_IMPORT_MAX_ROWS) return { ...result, fileError: `The file has more than ${STAFF_IMPORT_MAX_ROWS} people. Split it into smaller files.` };

  const columns = rows[0]!.map((h) => ALIASES[h.trim().toLowerCase()] ?? null);
  const missing = STAFF_IMPORT_REQUIRED.filter((c) => !columns.includes(c));
  if (missing.length) return { ...result, fileError: `The file needs these columns: ${missing.join(", ")}. Use the template headings in the first row.` };

  const seen = new Set(opts.existing.map((e) => key(e.fullName, e.dateOfBirth)));
  const roleNames = new Map(opts.roles.map((r) => [r.toLowerCase(), r]));

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (c: Column) => {
      const at = columns.indexOf(c);
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };
    const fullName = get("Full name").replace(/\s+/g, " ");
    const reasons: string[] = [];
    if (!fullName) reasons.push("no name");

    const dobText = get("Date of birth");
    const dateOfBirth = parseUkDate(dobText);
    if (!dobText) reasons.push("no date of birth");
    else if (!dateOfBirth || dateOfBirth >= opts.today) reasons.push(`date of birth "${dobText}" is not a date, use 31/12/1990`);

    const rateText = get("Hourly rate");
    const rate = Number(rateText.replace(/[£,\s]/g, ""));
    if (!rateText) reasons.push("no hourly rate");
    else if (!(rate > 0 && rate < 1000)) reasons.push(`hourly rate "${rateText}" is not an amount in pounds, use 12.71`);

    const startText = get("Start date");
    const employmentStart = startText ? parseUkDate(startText) : null;
    if (startText && !employmentStart) reasons.push(`start date "${startText}" is not a date`);

    const rateFromText = get("Rate starts on");
    const rateFrom = rateFromText ? parseUkDate(rateFromText) : (employmentStart ?? opts.today);
    if (rateFromText && !rateFrom) reasons.push(`rate start "${rateFromText}" is not a date`);

    const daysText = get("Days per week");
    const daysPerWeek = daysText ? Number(daysText) : 5;
    if (!(daysPerWeek > 0 && daysPerWeek <= 7)) reasons.push(`days per week "${daysText}" must be between 0.5 and 7`);

    const mobileText = get("Mobile");
    const mobile = mobileText ? opts.normaliseMobile(mobileText) : null;
    if (mobileText && !mobile) reasons.push(`mobile "${mobileText}" is not a UK mobile number`);

    const roles: string[] = [];
    for (const r of get("Job roles").split(/[;|]/).map((s) => s.trim()).filter(Boolean)) {
      const known = roleNames.get(r.toLowerCase());
      if (known) roles.push(known);
      else reasons.push(`job role "${r}" does not exist yet, add it on the Job roles page first`);
    }

    if (reasons.length) {
      result.problems.push({ line, name: fullName || "(no name)", reasons });
      return;
    }
    const k = key(fullName, dateOfBirth!);
    if (seen.has(k)) {
      result.duplicates.push({ line, name: fullName });
      return;
    }
    seen.add(k);

    const hourlyPence = Math.round(rate * 100);
    const person: ImportPerson = {
      line,
      fullName,
      dateOfBirth: dateOfBirth!,
      hourlyPence,
      rateFrom: rateFrom!,
      employmentStart,
      daysPerWeek,
      irregularHours: yes(get("Irregular hours")),
      mobile,
      payrollId: get("Payroll ID") || null,
      roles,
    };
    result.people.push(person);
    const on = rateFrom! > opts.today ? rateFrom! : opts.today;
    try {
      const min = minimumRatePence({ id: "", name: fullName, dateOfBirth: dateOfBirth! }, on);
      if (hourlyPence < min.pence) {
        result.warnings.push({
          line,
          name: fullName,
          text: `£${rate.toFixed(2)} an hour is below the National Minimum Wage for ${min.band} (£${(min.pence / 100).toFixed(2)}). Check the rate before their first shift.`,
        });
      }
    } catch {
      // No minimum wage rates for that date: nothing to compare with.
    }
  });
  return result;
};

/** The template people fill in: the headings and one example row. */
export const staffImportTemplate = () =>
  [STAFF_IMPORT_COLUMNS.join(","), "Sam Example,31/12/1990,12.71,01/04/2026,01/04/2026,5,no,07700 900123,E123,"].join("\r\n") + "\r\n";
