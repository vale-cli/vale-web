import { badgeText } from "./overlay";

describe("badge", () => {
  it("counts alerts, and caps a long count", () => {
    expect(badgeText({ state: "alerts", count: 1, severity: "error" })).toEqual({ text: "1", label: "Vale: 1 alert" });
    expect(badgeText({ state: "alerts", count: 3, severity: "warning" })).toEqual({ text: "3", label: "Vale: 3 alerts" });
    expect(badgeText({ state: "alerts", count: 250, severity: "error" }).text).toBe("99+");
  });
  it("says when a field is clean, being checked, or couldn't be", () => {
    expect(badgeText({ state: "clean" })).toEqual({ text: "", label: "Vale found nothing" });
    expect(badgeText({ state: "busy" }).label).toBe("Vale is checking");
    expect(badgeText({ state: "error", message: "E100 [StylesPath] Runtime error" })).toEqual({
      text: "!",
      label: "Vale couldn't check this field: E100 [StylesPath] Runtime error",
    });
  });
});
