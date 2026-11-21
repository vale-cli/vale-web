// What the extension remembers, in browser.storage.local.

export type StoredPackage = {
  name: string;
  // The ZIP archive, base64: storage only round-trips JSON-safe values.
  data: string;
  source: "upload" | "url";
  origin?: string;
};

export type Settings = {
  // The configuration, used on every site that's on.
  ini: string;
  packages: StoredPackage[];
  // Hosts linting is on for, and the format their editors hold.
  sites: Record<string, { enabled: boolean; format: string }>;
  // `live` lints as you type; `manual` waits for the popup's button or the
  // keyboard shortcut, so another checker can own the field meanwhile.
  mode: "live" | "manual";
  // How long to wait after a keystroke before linting, in ms. Marks follow
  // the text in the meantime, so no wait is needed for them to look right.
  delay: number;
  // Open a card by pointing at a mark, as well as by clicking it.
  hover: boolean;
  // Words accepted from a card's "Add to vocabulary"; see vocab.ts.
  vocab: string[];
  // Rules turned off from a card, by name: `Vale.Spelling`.
  disabledRules: string[];
  // Alerts dismissed from a card; see dismissKey.
  dismissed: string[];
};

export const defaultINI = `StylesPath = styles
MinAlertLevel = suggestion

[*]
BasedOnStyles = Vale
`;

export const defaultSettings: Settings = {
  ini: defaultINI,
  packages: [],
  sites: {
    "github.com": { enabled: true, format: "md" },
    "gitlab.com": { enabled: true, format: "md" },
  },
  mode: "live",
  delay: 0,
  hover: false,
  vocab: [],
  disabledRules: [],
  dismissed: [],
};

/**
 * dismissKey names one alert where it stands: the rule, the text it flagged,
 * and the word on either side of it. A dismissal outlives edits elsewhere in
 * the text, and lapses once a neighboring word changes.
 */
export function dismissKey(check: string, text: string, start: number, end: number): string {
  const line = (s: string) => s.split("\n");
  const before = /[\p{L}\p{N}'’-]+(?=[^\p{L}\p{N}]*$)/u.exec(line(text.slice(0, start)).pop()!)?.[0] ?? "";
  const after = /^[^\p{L}\p{N}]*([\p{L}\p{N}'’-]+)/u.exec(line(text.slice(end))[0]!)?.[1] ?? "";
  return `${check}\u0000${before}\u0000${text.slice(start, end)}\u0000${after}`;
}

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  if (!stored) return structuredClone(defaultSettings);
  return {
    ...defaultSettings,
    ...stored,
    sites: { ...defaultSettings.sites, ...(stored.sites ?? {}) },
    packages: stored.packages ?? [],
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settings });
}

/** hostOf returns a URL's host without a leading `www.`. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** siteFor returns the site entry for a host: off and plain text when unknown. */
export function siteFor(settings: Settings, host: string): { enabled: boolean; format: string } {
  return settings.sites[host] ?? { enabled: false, format: "txt" };
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): Promise<string> {
  // A FileReader handles large archives where String.fromCharCode chunking
  // blows the stack.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes as BlobPart]));
  });
}
