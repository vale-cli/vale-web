// Packages named by a configuration's `Packages` key, fetched for the
// in-memory filesystem.

/** parsePackages reads the top-level `Packages = ...` of an INI, as Vale does. */
export function parsePackages(ini: string): string[] {
  for (const raw of ini.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) break;
    const m = line.match(/^Packages\s*=\s*(.*?)$/i);
    if (m) {
      return m[1]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export type ResolvedPackage = { name: string; url: string };

const libraryURL = (name: string) =>
  `https://github.com/errata-ai/${name}/releases/latest/download/${name}.zip`;

/** resolvePackage turns a `Packages` entry into a name and a download URL. */
export function resolvePackage(entry: string): ResolvedPackage {
  if (/^https?:\/\//i.test(entry)) {
    const base = entry.split("/").pop() || entry;
    return { name: base.replace(/\.zip$/i, ""), url: entry };
  }
  return { name: entry, url: libraryURL(entry) };
}

const githubOrigin = /^https:\/\/([^/]+\.)?github(usercontent)?\.com\//i;

async function allowed(url: string): Promise<boolean> {
  if (githubOrigin.test(url)) return true;
  const origin = new URL(url).origin + "/*";
  if (await browser.permissions.contains({ origins: [origin] })) return true;
  return browser.permissions.request({ origins: [origin] });
}

export type FetchOutcome = { name: string; ok: boolean; error?: string; bytes?: Uint8Array; url: string };

/** fetchPackage downloads one package, asking for its origin when needed. */
export async function fetchPackage(entry: string): Promise<FetchOutcome> {
  const { name, url } = resolvePackage(entry);
  try {
    if (!(await allowed(url))) return { name, url, ok: false, error: "permission denied" };
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { name, url, ok: false, error: `HTTP ${res.status}` };
    return { name, url, ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
  } catch (err) {
    return { name, url, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** parseStylesPath reads the top-level `StylesPath` of an INI, `styles` when unset. */
export function parseStylesPath(ini: string): string {
  for (const raw of ini.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) break;
    const m = line.match(/^StylesPath\s*=\s*(.*?)$/i);
    if (m) return m[1]!.trim().replace(/^\.\//, "") || "styles";
  }
  return "styles";
}

/**
 * stylesMarker is an empty file that makes a StylesPath exist: the engine
 * refuses a configuration whose StylesPath is missing, and one with no
 * packages yet has nothing else there.
 */
export function stylesMarker(prefix: string): string {
  return prefix.replace(/\/+$/, "") + "/.keep";
}
