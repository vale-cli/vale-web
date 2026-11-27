import { existsSync } from "node:fs";
import { actionIcon, actionSizes } from "./icon";

describe("toolbar icon", () => {
  it("is the light mark on a dark toolbar and the dark mark on a light one", () => {
    expect(actionIcon(true)[16]).toBe("icon/action-on-dark-16.png");
    expect(actionIcon(false)[32]).toBe("icon/action-on-light-32.png");
  });
  it("names files the extension ships, at every size", () => {
    for (const dark of [true, false]) {
      const paths = Object.values(actionIcon(dark));
      expect(paths).toHaveLength(actionSizes.length);
      for (const path of paths) expect(existsSync(`public/${path}`), path).toBe(true);
    }
  });
});
