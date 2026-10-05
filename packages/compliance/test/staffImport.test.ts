import { describe, expect, it } from "vitest";
import { checkStaffImport, parseCsv, parseUkDate, staffImportTemplate } from "../src";

const mobile = (s: string) => (/^07\d{3} ?\d{6}$/.test(s) ? `+44${s.replace(/\s/g, "").slice(1)}` : null);
const opts = { today: "2026-10-05", existing: [{ fullName: "Ann Ash", dateOfBirth: "1990-01-01" }], roles: ["Chef", "Kitchen porter"], normaliseMobile: mobile };
const csv = (...lines: string[]) => lines.join("\r\n");

describe("reading CSV files", () => {
  it("handles quotes, commas and new lines inside quotes, a byte order mark and blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"Smith, Jo","say ""hi""\nthere"\r\n\r\n')).toEqual([
      ["a", "b"],
      ["Smith, Jo", 'say "hi"\nthere'],
    ]);
  });

  it("reads UK and ISO dates and refuses dates that do not exist", () => {
    expect(parseUkDate("31/12/1990")).toBe("1990-12-31");
    expect(parseUkDate("1/4/2026")).toBe("2026-04-01");
    expect(parseUkDate("2026-04-01")).toBe("2026-04-01");
    expect(parseUkDate("31/02/2026")).toBeNull();
    expect(parseUkDate("12/31/1990")).toBeNull();
    expect(parseUkDate("next week")).toBeNull();
  });
});

describe("checking a staff import", () => {
  it("accepts the template as it is", () => {
    const r = checkStaffImport(staffImportTemplate(), opts);
    expect(r.problems).toEqual([]);
    expect(r.people).toEqual([
      {
        line: 2,
        fullName: "Sam Example",
        dateOfBirth: "1990-12-31",
        hourlyPence: 1271,
        rateFrom: "2026-04-01",
        employmentStart: "2026-04-01",
        daysPerWeek: 5,
        irregularHours: false,
        mobile: "+447700900123",
        payrollId: "E123",
        roles: [],
      },
    ]);
  });

  it("understands common headings, fills in defaults and matches job roles whatever the case", () => {
    const r = checkStaffImport(csv("Name,DOB,Pay rate,Role,Irregular hours", "Ben Birch,02/03/1995,£13.50,chef; Kitchen Porter,yes"), opts);
    expect(r.people[0]).toMatchObject({ fullName: "Ben Birch", hourlyPence: 1350, rateFrom: "2026-10-05", daysPerWeek: 5, irregularHours: true, roles: ["Chef", "Kitchen porter"] });
  });

  it("lists every reason a row cannot be added, and still adds the good rows", () => {
    const r = checkStaffImport(
      csv("Full name,Date of birth,Hourly rate,Mobile,Job roles", ",31/02/1990,abc,01234 567890,Barista", "Cal Cedar,1990-05-05,12.71,,"),
      opts,
    );
    expect(r.problems).toEqual([
      {
        line: 2,
        name: "(no name)",
        reasons: [
          "no name",
          'date of birth "31/02/1990" is not a date, use 31/12/1990',
          'hourly rate "abc" is not an amount in pounds, use 12.71',
          'mobile "01234 567890" is not a UK mobile number',
          'job role "Barista" does not exist yet, add it on the Job roles page first',
        ],
      },
    ]);
    expect(r.people.map((p) => p.fullName)).toEqual(["Cal Cedar"]);
  });

  it("leaves out people already in the business and repeats in the file", () => {
    const r = checkStaffImport(csv("Full name,Date of birth,Hourly rate", "ann  ash,01/01/1990,13", "Dee Dove,01/01/1991,13", "Dee Dove,01/01/1991,13"), opts);
    expect(r.duplicates).toEqual([
      { line: 2, name: "ann ash" },
      { line: 4, name: "Dee Dove" },
    ]);
    expect(r.people.map((p) => p.fullName)).toEqual(["Dee Dove"]);
  });

  it("warns about a rate below the minimum wage for the person's age", () => {
    const r = checkStaffImport(csv("Full name,Date of birth,Hourly rate", "Eve Elm,01/01/1990,10.00", "Fay Fir,01/01/2010,8.00"), opts);
    expect(r.people).toHaveLength(2);
    expect(r.warnings).toEqual([
      { line: 2, name: "Eve Elm", text: "£10.00 an hour is below the National Minimum Wage for 21 and over (£12.71). Check the rate before their first shift." },
    ]);
  });

  it("explains a file it cannot use", () => {
    expect(checkStaffImport("Full name,Date of birth\r\n", opts).fileError).toMatch(/no rows/);
    expect(checkStaffImport(csv("Name,Wage", "Ann,12"), opts).fileError).toBe(
      "The file needs these columns: Date of birth, Hourly rate. Use the template headings in the first row.",
    );
  });
});
