import { describe, expect, it } from "vitest";
import { courseLink, courseSite } from "../src";

describe("training course links", () => {
  it("adds https:// to an address typed without it", () => {
    expect(courseLink(" www.neurolearn.online ")).toBe("https://www.neurolearn.online/");
    expect(courseLink("neurolearn.online/food-hygiene")).toBe("https://neurolearn.online/food-hygiene");
  });
  it("keeps a full address as it is", () => {
    expect(courseLink("https://www.neurolearn.online/courses/food-hygiene-level-2?ref=vicisrota")).toBe(
      "https://www.neurolearn.online/courses/food-hygiene-level-2?ref=vicisrota",
    );
  });
  it("refuses links that are not web pages or could be used to trick staff", () => {
    for (const bad of ["", "food hygiene", "javascript:alert(1)", "file:///etc/passwd", "ftp://example.com", "https://user:pass@example.com", "localhost", `https://a.com/${"x".repeat(300)}`]) {
      expect(courseLink(bad), bad).toBeNull();
    }
  });
  it("shows the site name without www", () => {
    expect(courseSite("https://www.neurolearn.online/")).toBe("neurolearn.online");
  });
});
