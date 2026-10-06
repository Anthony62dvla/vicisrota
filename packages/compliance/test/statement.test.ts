import { describe, expect, it } from "vitest";
import { missingParticulars, writtenStatement, type StatementPerson } from "../src";

const person: StatementPerson = {
  employerName: "Harbour Kitchen Ltd",
  workerName: "Mia Chen",
  jobTitle: "Chef",
  startDate: "2026-10-12",
  hours: "Around 30 hours a week, varying. Shifts are published at least 7 days ahead.",
  placeOfWork: "Harbour Kitchen, 1 Quay Street, Whitby",
  hourlyPence: 1300,
  irregularHours: false,
  daysPerWeek: 4,
  leaveYearStartMonth: 4,
};

describe("written statement of particulars", () => {
  it("covers everything the law asks for, in plain words", () => {
    const s = writtenStatement(person, { payInterval: "weekly" });
    const by = Object.fromEntries(s.map((x) => [x.heading, x.text]));
    expect(by["Your pay"]).toContain("£13.00 an hour, before tax and National Insurance, paid weekly");
    expect(by["Your holiday"]).toContain("22.4 days a year");
    expect(by["Your holiday"]).toContain("starts on 1 April");
    expect(by["When your work started"]).toBe("12 October 2026.");
    expect(by["Notice"]).toContain("From you: At least 1 week");
    expect(s.map((x) => x.heading)).toEqual(expect.arrayContaining(["If you are ill", "Probation", "Training", "Pension", "Disciplinary and grievance procedures"]));
  });

  it("uses the business's own terms over the defaults, but not blank ones", () => {
    const s = writtenStatement(person, { sickPay: "Full pay for 2 weeks, then Statutory Sick Pay.", probation: " " });
    expect(s.find((x) => x.heading === "If you are ill")!.text).toBe("Full pay for 2 weeks, then Statutory Sick Pay.");
    expect(s.find((x) => x.heading === "Probation")!.text).toBe("None.");
  });

  it("caps holiday at 28 days, and explains accrual for irregular hours", () => {
    expect(writtenStatement({ ...person, daysPerWeek: 6 }, {}).find((x) => x.heading === "Your holiday")!.text).toContain("28 days a year");
    expect(writtenStatement({ ...person, irregularHours: true }, {}).find((x) => x.heading === "Your holiday")!.text).toContain("12.07%");
  });

  it("lists what is missing", () => {
    expect(missingParticulars({ ...person, jobTitle: "", startDate: null, hourlyPence: null })).toEqual(["job title", "start date", "pay rate"]);
    expect(missingParticulars(person)).toEqual([]);
  });
});
