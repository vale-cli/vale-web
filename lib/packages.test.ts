import { fetchPackage, parsePackages, parseStylesPath, resolvePackage, stylesMarker, supportsVale } from "./packages";
import { makeZip } from "./testing/zip";

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
  it("marks a StylesPath so it exists with nothing in it", () => {
    expect(stylesMarker("/styles")).toBe("/styles/.keep");
    expect(stylesMarker("/.github/styles/")).toBe("/.github/styles/.keep");
  });
});

describe("the Vale a package needs", () => {
  it("compares a floor to the engine's version", () => {
    expect(supportsVale(">=3.28.1", "3.29.0")).toBe(true);
    expect(supportsVale(">=3.28.1", "3.28.1")).toBe(true);
    expect(supportsVale(">=3.28.1", "3.14.1")).toBe(false);
    expect(supportsVale(">=3.0.0, <3.20.0", "3.29.0")).toBe(false);
    expect(supportsVale(">= 3.10", "v3.9.5")).toBe(false);
    expect(supportsVale(">= 3.10", "v3.10.0")).toBe(true);
  });
  it("accepts a missing floor, an unreadable one, and any floor on a development build", () => {
    expect(supportsVale(undefined, "3.0.0")).toBe(true);
    expect(supportsVale("whenever", "3.0.0")).toBe(true);
    expect(supportsVale(">=99.0.0", "master")).toBe(true);
  });

  const latest = "https://github.com/errata-ai/proselint/releases/latest/download/proselint.zip";
  const pkg = (floor: string, extra = {}) => makeZip({ "proselint/meta.json": JSON.stringify({ vale_version: floor, ...extra }) }, true);
  const serve = (routes: Record<string, Uint8Array | string>) =>
    vi.stubGlobal("fetch", async (url: string) => {
      const body = routes[url];
      return body === undefined ? new Response(null, { status: 404 }) : new Response(body as BodyInit);
    });
  afterEach(() => vi.unstubAllGlobals());

  it("installs the latest release when the engine supports it", async () => {
    serve({ [latest]: pkg(">=3.28.1") });
    const got = await fetchPackage("proselint", "3.29.0");
    expect(got).toMatchObject({ ok: true, url: latest });
    expect(got.note).toBeUndefined();
  });
  it("walks the release feed back to one the engine supports", async () => {
    const at = (tag: string) => `https://github.com/errata-ai/proselint/releases/download/${tag}/proselint.zip`;
    serve({
      [latest]: pkg(">=3.28.1"),
      "https://github.com/errata-ai/proselint/releases.atom":
        '<feed><entry><link href="https://github.com/errata-ai/proselint/releases/tag/v0.4.0"/></entry>' +
        '<entry><link href="https://github.com/errata-ai/proselint/releases/tag/v0.3.4"/></entry></feed>',
      [at("v0.4.0")]: pkg(">=3.28.1"),
      [at("v0.3.4")]: pkg(">=2.0.0"),
    });
    const got = await fetchPackage("proselint", "3.14.1");
    expect(got).toMatchObject({ ok: true, url: at("v0.3.4"), note: "needs Vale >=3.28.1; this is 3.14.1: installed v0.3.4 instead" });
  });
  it("picks from a releases manifest, newest first", async () => {
    const old = "https://github.com/errata-ai/proselint/releases/download/v0.3.4/proselint.zip";
    const older = "https://github.com/errata-ai/proselint/releases/download/v0.3.0/proselint.zip";
    serve({
      [latest]: pkg(">=3.28.1", {
        releases: [
          { version: "v0.3.0", vale_version: ">=2.0.0", url: older },
          { version: "v0.4.0", vale_version: ">=3.28.1", url: latest },
          { version: "v0.3.4", vale_version: ">=2.0.0", url: old },
        ],
      }),
      [old]: pkg(">=2.0.0"),
      [older]: pkg(">=2.0.0"),
    });
    expect(await fetchPackage("proselint", "3.14.1")).toMatchObject({ ok: true, url: old });
  });
  it("installs what was fetched, with a note, when nothing fits", async () => {
    serve({ [latest]: pkg(">=3.28.1") });
    expect(await fetchPackage("proselint", "3.14.1")).toMatchObject({ ok: true, url: latest, note: "needs Vale >=3.28.1; this is 3.14.1" });
  });
  it("reports a download that fails", async () => {
    serve({});
    expect(await fetchPackage("proselint", "3.29.0")).toMatchObject({ ok: false, error: "HTTP 404" });
  });
});
