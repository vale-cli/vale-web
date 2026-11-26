// The wasm engine: loading vale.wasm once, and the functions it installs.
//
// Everything runs inside the extension; nothing is sent anywhere. The
// loader is wasm_exec.js from the Go toolchain that built the module, and
// its filesystem stub is what the module expects: never give it a real `fs`.

export type ValeAction = { Name?: string; Params?: string[] };

export type ValeAlert = {
  Check: string;
  Message: string;
  Description?: string;
  Link?: string;
  Line: number;
  Span: [number, number];
  Severity: "error" | "warning" | "suggestion" | string;
  Match?: string;
  Action?: ValeAction;
  Suggestions?: string[];
};

type Result<T> = T & { error?: string };

type ValeGlobals = {
  ValeLint(text: string, format: string, ini: string): Result<{ result?: string }>;
  ValeLintBuilt(text: string, format: string, html: string, ini: string): Result<{ result?: string }>;
  ValeSuggest(alertJSON: string, ini: string): Result<{ suggestions?: string[] }>;
  ValeConverterOptions(format: string, ini: string): Result<Record<string, unknown>>;
  ValeResolveConfig(ini: string): Result<{ result?: string }>;
  ValeTransform(text: string, format: string, ini: string): Result<{ result?: string }>;
  ValeAddFile(path: string, contents: string | Uint8Array): Result<{ ok?: boolean }>;
  ValeAddPackage(prefix: string, zip: Uint8Array): Result<{ ok?: boolean }>;
  ValeResetFS(): Result<{ ok?: boolean }>;
  ValeListFS(): Result<{ paths?: string[] }>;
};

declare global {
  // Installed by wasm_exec.js.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var Go: new () => { importObject: WebAssembly.Imports; run(i: WebAssembly.Instance): Promise<void> };
}

// Bundled rather than fetched: a service worker can't import() at runtime.
import "./vendor/wasm_exec.js";
import { plain } from "./errors";

const vale = globalThis as unknown as Partial<ValeGlobals>;

let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  const go = new globalThis.Go();
  const url = browser.runtime.getURL("/vale.wasm");

  let source: WebAssembly.WebAssemblyInstantiatedSource;
  try {
    source = await WebAssembly.instantiateStreaming(fetch(url), go.importObject);
  } catch {
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    source = await WebAssembly.instantiate(bytes, go.importObject);
  }

  // main() installs the functions and then parks in select{}: its promise
  // settles only if the module dies, which is what we want to hear about.
  let died: unknown;
  go.run(source.instance)
    .then(() => (died = new Error("vale.wasm exited")))
    .catch((e: unknown) => (died = e));

  for (let i = 0; i < 300 && typeof vale.ValeLint !== "function"; i++) {
    if (died) throw died;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (typeof vale.ValeLint !== "function") throw died ?? new Error("vale.wasm did not start");
}

/** ready resolves once the engine is loaded; it loads on the first call. */
export function ready(): Promise<void> {
  loading ??= load().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export function isReady(): boolean {
  return typeof vale.ValeLint === "function";
}

function unwrap<T>(r: Result<T>): T {
  if (r.error) throw new Error(plain(r.error));
  return r;
}

function alertsOf(result: string | undefined): ValeAlert[] {
  const parsed = JSON.parse(result || "{}") as Record<string, ValeAlert[]>;
  const first = Object.values(parsed)[0];
  return first ?? [];
}

export async function lint(text: string, format: string, ini: string): Promise<ValeAlert[]> {
  await ready();
  return alertsOf(unwrap(vale.ValeLint!(text, format, ini)).result);
}

export async function lintBuilt(text: string, format: string, html: string, ini: string): Promise<ValeAlert[]> {
  await ready();
  return alertsOf(unwrap(vale.ValeLintBuilt!(text, format, html, ini)).result);
}

export async function suggest(alert: ValeAlert, ini: string): Promise<string[]> {
  if (!alert.Action?.Name) return [];
  await ready();
  return unwrap(vale.ValeSuggest!(JSON.stringify(alert), ini)).suggestions ?? [];
}

export async function resolveConfig<T>(ini: string): Promise<T> {
  await ready();
  const resolved = JSON.parse(unwrap(vale.ValeResolveConfig!(ini)).result ?? "{}") as T & { error?: string };
  // A configuration that doesn't load comes back as a result with its error.
  if (resolved.error) resolved.error = plain(resolved.error);
  return resolved;
}

export async function resetFS(): Promise<void> {
  await ready();
  unwrap(vale.ValeResetFS!());
}

export async function addFile(path: string, contents: string | Uint8Array): Promise<void> {
  await ready();
  unwrap(vale.ValeAddFile!(path, contents));
}

export async function addPackage(prefix: string, zip: Uint8Array): Promise<void> {
  await ready();
  unwrap(vale.ValeAddPackage!(prefix, zip));
}

export async function listFS(): Promise<string[]> {
  await ready();
  return unwrap(vale.ValeListFS!()).paths ?? [];
}
