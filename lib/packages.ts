// Packages named by a configuration's `Packages` key, fetched for the
// in-memory filesystem.

import engine from "@/vale.json";
import { readZipEntry } from "./zip";

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

export type FetchOutcome = { name: string; ok: boolean; error?: string; note?: string; bytes?: Uint8Array; url: string };

/** The Vale in public/vale.wasm, as scripts/wasm.sh recorded it. */
export const engineVersion: string = engine.version;

type Release = { version?: string; vale_version?: string; url?: string };
type Meta = { vale_version?: string; feed?: string; releases?: Release[] };

const numbers = (v: string) => v.replace(/^v/, "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);

function compare(a: string, b: string): number {
  const x = numbers(a);
  const y = numbers(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * supportsVale reports whether a Vale version meets a package's
 * `vale_version`, such as `>=3.28.1`. A development build meets every
 * floor, as does a floor that is missing or that can't be read: a package's
 * metadata is not a reason to refuse it.
 */
export function supportsVale(constraint: string | undefined, vale: string = engineVersion): boolean {
  // `>= 3.28` is `>=3.28`.
  const terms = (constraint ?? "").replace(/([<>=])\s+/g, "$1").split(/[\s,]+/).filter(Boolean);
  if (!terms.length || vale === "master") return true;
  return terms.every((term) => {
    const m = term.match(/^(>=|<=|>|<|=)?v?(\d+(\.\d+){0,2})$/);
    if (!m) return true;
    const c = compare(vale, m[2]!);
    switch (m[1] ?? "=") {
      case ">=":
        return c >= 0;
      case "<=":
        return c <= 0;
      case ">":
        return c > 0;
      case "<":
        return c < 0;
      default:
        return c === 0;
    }
  });
}

/** packageMeta reads the meta.json at the root of a package archive. */
export async function packageMeta(zip: Uint8Array): Promise<Meta> {
  try {
    const raw = await readZipEntry(zip, (path) => /^([^/]+\/)?meta\.json$/.test(path));
    return raw ? (JSON.parse(new TextDecoder().decode(raw)) as Meta) : {};
  } catch {
    return {};
  }
}

const latestRelease = "/releases/latest/download/";

// How many releases back to look for one the engine supports.
const releaseWalk = 10;

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// releaseTags lists a repository's releases, newest first, from its Atom
// feed. Read by pattern: a service worker has no XML parser.
async function releaseTags(feed: string): Promise<string[]> {
  const xml = new TextDecoder().decode(await download(feed));
  const tags = Array.from(xml.matchAll(/\/releases\/tag\/([^"<\s]+)/g), (m) => decodeURIComponent(m[1]!));
  return Array.from(new Set(tags));
}

/**
 * supportedRelease returns the archive to install: the one fetched, when
 * the engine supports it, or else the newest release that it does, found in
 * the package's `releases` manifest or, for a GitHub latest-release URL, by
 * walking its feed. When nothing fits, the fetched release is installed
 * with a note, as Vale's own sync does.
 */
async function supportedRelease(url: string, bytes: Uint8Array, vale: string): Promise<{ bytes: Uint8Array; url: string; note?: string }> {
  const meta = await packageMeta(bytes);
  if (supportsVale(meta.vale_version, vale)) return { bytes, url };

  const need = `needs Vale ${meta.vale_version}; this is ${vale}`;
  let candidates: Release[] = [];
  if (meta.releases?.length) {
    candidates = meta.releases
      .filter((r) => r.url && r.url !== url && supportsVale(r.vale_version, vale))
      .sort((a, b) => compare(b.version ?? "0", a.version ?? "0"));
  } else if (url.includes(latestRelease)) {
    try {
      const feed = meta.feed || url.split(latestRelease)[0] + "/releases.atom";
      candidates = (await releaseTags(feed))
        .slice(0, releaseWalk)
        .map((tag) => ({ version: tag, url: url.replace(latestRelease, `/releases/download/${tag}/`) }));
    } catch {
      // No feed: what was fetched is installed, with the note.
    }
  }

  for (const rel of candidates) {
    try {
      if (!(await allowed(rel.url!))) continue;
      const older = await download(rel.url!);
      // A manifest entry has stated its floor; a feed entry is checked
      // from the archive it came in.
      if (meta.releases?.length || supportsVale((await packageMeta(older)).vale_version, vale)) {
        return { bytes: older, url: rel.url!, note: `${need}: installed ${rel.version} instead` };
      }
    } catch {
      // Not every tag has the archive; try the next.
    }
  }
  return { bytes, url, note: need };
}

/**
 * fetchPackage downloads one package, asking for its origin when needed,
 * in the newest release the bundled Vale supports.
 */
export async function fetchPackage(entry: string, vale: string = engineVersion): Promise<FetchOutcome> {
  const { name, url } = resolvePackage(entry);
  try {
    if (!(await allowed(url))) return { name, url, ok: false, error: "permission denied" };
    const got = await supportedRelease(url, await download(url), vale);
    return { name, ok: true, ...got };
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
