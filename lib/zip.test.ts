import { makeZip } from "./testing/zip";
import { readZipEntry } from "./zip";

describe("zip", () => {
  const files = { "Style/Rule.yml": "extends: existence\n", "Style/meta.json": '{"vale_version":">=3.0.0"}' };
  const text = async (zip: Uint8Array, path: string) => {
    const got = await readZipEntry(zip, (p) => p === path);
    return got && new TextDecoder().decode(got);
  };

  it("reads a stored entry and a deflated one", async () => {
    expect(await text(makeZip(files), "Style/meta.json")).toBe(files["Style/meta.json"]);
    expect(await text(makeZip(files, true), "Style/meta.json")).toBe(files["Style/meta.json"]);
  });
  it("returns nothing for a missing entry or bytes that aren't an archive", async () => {
    expect(await text(makeZip(files), "nope")).toBeUndefined();
    expect(await text(new TextEncoder().encode("not a zip"), "x")).toBeUndefined();
  });
});
