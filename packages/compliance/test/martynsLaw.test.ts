import { describe, expect, it } from "vitest";
import { martynsLawTier, proceduresReviewDue } from "../src/index";

describe("Martyn's Law", () => {
  it("puts premises in the right tier by how many people are expected at once", () => {
    expect(martynsLawTier(null)).toBe("none");
    expect(martynsLawTier(199)).toBe("none");
    expect(martynsLawTier(200)).toBe("standard");
    expect(martynsLawTier(799)).toBe("standard");
    expect(martynsLawTier(800)).toBe("enhanced");
  });

  it("asks for procedures to be reviewed every year", () => {
    expect(proceduresReviewDue(null, "2027-05-01")).toBe(true);
    expect(proceduresReviewDue("2026-05-02", "2027-05-01")).toBe(false);
    expect(proceduresReviewDue("2026-05-01", "2027-05-01")).toBe(true);
  });
});
