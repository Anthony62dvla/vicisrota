import { describe, expect, it } from "vitest";
import { retentionDates, retentionStage } from "../src/index";

describe("how long records are kept", () => {
  it("keeps everything for current staff and recent leavers", () => {
    expect(retentionStage(null, "2040-01-01")).toBe("keep");
    expect(retentionStage("2026-10-01", "2028-09-30")).toBe("keep");
  });

  it("trims a leaver's records after 2 years and deletes them after 6", () => {
    expect(retentionStage("2026-10-01", "2028-10-01")).toBe("minimise");
    expect(retentionStage("2026-10-01", "2032-09-30")).toBe("minimise");
    expect(retentionStage("2026-10-01", "2032-10-01")).toBe("delete");
  });

  it("handles a leaving date of 29 February", () => {
    expect(retentionDates("2028-02-29")).toEqual({ minimiseOn: "2030-02-28", deleteOn: "2034-02-28" });
  });
});
