import { parsePackages, parseStylesPath, resolvePackage } from "./packages";

describe("packages", () => {
  it("reads the top-level Packages key only", () => {
    const ini = "StylesPath = styles\nPackages = Microsoft, https://x.test/My.zip\n\n[*]\nPackages = nope\n";
    expect(parsePackages(ini)).toEqual(["Microsoft", "https://x.test/My.zip"]);
    expect(parsePackages("[*]\nBasedOnStyles = Vale\n")).toEqual([]);
  });
  it("resolves a name to the library and a URL to itself", () => {
    expect(resolvePackage("Microsoft")).toEqual({ name: "Microsoft", url: "https://github.com/errata-ai/Microsoft/releases/latest/download/Microsoft.zip" });
    expect(resolvePackage("https://x.test/My.zip")).toEqual({ name: "My", url: "https://x.test/My.zip" });
  });
  it("reads StylesPath with a default", () => {
    expect(parseStylesPath("StylesPath = ./.github/styles\n")).toBe(".github/styles");
    expect(parseStylesPath("[*]\n")).toBe("styles");
  });
});
