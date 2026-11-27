import { actionIcon } from "@/lib/icon";
import * as engine from "@/lib/engine";
import type { ValeAlert } from "@/lib/engine";
import type { Request, LintResponse, ResolvedConfig, StatusResponse, SuggestResponse, SyncResponse } from "@/lib/messages";
import { fetchPackage, parsePackages, parseStylesPath, stylesMarker } from "@/lib/packages";
import { base64ToBytes, bytesToBase64, dismissKey, hostOf, loadSettings, saveSettings, siteFor, type Settings } from "@/lib/settings";
import { acceptFile, vocabPath, withVocab } from "@/lib/vocab";
import { offsetsOf } from "@/lib/text/positions";
import { formatFor } from "@/lib/format";

// A resolved configuration: the INI to lint under and the packages it needs
// in the in-memory filesystem.
type Config = {
  ini: string;
  packages: { name: string; bytes: Uint8Array }[];
};

let loaded = "";

async function profileConfig(): Promise<Config> {
  const s = await loadSettings();
  return {
    ini: s.ini,
    packages: s.packages.map((p) => ({ name: p.name, bytes: base64ToBytes(p.data) })),
  };
}

// resolve is the profile, on a site that's on; one configuration everywhere.
async function resolve(url: string): Promise<Config | null> {
  const s = await loadSettings();
  if (!siteFor(s, hostOf(url)).enabled) return null;
  return profileConfig();
}

// load puts a configuration's packages into the in-memory filesystem, once
// per distinct set.
async function load(cfg: Config, vocab: string[]): Promise<void> {
  const prefix = "/" + parseStylesPath(cfg.ini).replace(/^\/+/, "");
  const fingerprint =
    prefix + "\0" + cfg.packages.map((p) => `${p.name}:${p.bytes.length}`).join(",") + "\0" + vocab.join("\n");
  if (fingerprint === loaded) return;
  await engine.resetFS();
  await engine.addFile(stylesMarker(prefix), "");
  for (const p of cfg.packages) await engine.addPackage(prefix, p.bytes);
  if (vocab.length) await engine.addFile(vocabPath(prefix), acceptFile(vocab));
  loaded = fingerprint;
}

// iniFor is the configuration as linted: the user's accepted words added.
function iniFor(cfg: Config, s: Settings): string {
  return s.vocab.length ? withVocab(cfg.ini) : cfg.ini;
}

// keep drops what the user turned off or dismissed from a card.
function keep(alerts: ValeAlert[], text: string, s: Settings): ValeAlert[] {
  if (!s.disabledRules.length && !s.dismissed.length) return alerts;
  const off = new Set(s.disabledRules);
  const gone = new Set(s.dismissed);
  return alerts.filter((a) => {
    if (off.has(a.Check)) return false;
    if (!gone.size) return true;
    const o = offsetsOf(text, a.Line, a.Span);
    return !o || !gone.has(dismissKey(a.Check, text, o[0], o[1]));
  });
}

// remember updates the settings from a card's action.
async function remember(change: (s: Settings) => void): Promise<void> {
  const s = await loadSettings();
  change(s);
  await saveSettings(s);
}

async function lint(text: string, url: string): Promise<LintResponse> {
  const s = await loadSettings();
  const format = formatFor(url, siteFor(s, hostOf(url)).format);
  const cfg = await resolve(url);
  if (!cfg) return { alerts: [], source: "off", format };
  try {
    await load(cfg, s.vocab);
    const alerts = keep(await engine.lint(text, format, iniFor(cfg, s)), text, s);
    return { alerts, source: "profile", format };
  } catch (err) {
    return { alerts: [], source: "profile", format, error: err instanceof Error ? err.message : String(err) };
  }
}

async function suggest(alert: ValeAlert, url: string): Promise<SuggestResponse> {
  const cfg = await resolve(url);
  if (!cfg) return { suggestions: [] };
  try {
    const s = await loadSettings();
    await load(cfg, s.vocab);
    return { suggestions: await engine.suggest(alert, iniFor(cfg, s)) };
  } catch (err) {
    return { suggestions: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function status(url: string): Promise<StatusResponse> {
  const s = await loadSettings();
  const host = hostOf(url);
  const site = siteFor(s, host);
  return {
    enabled: site.enabled,
    mode: s.mode,
    delay: s.delay ?? 0,
    hover: s.hover,
    host,
    format: formatFor(url, site.format),
    source: site.enabled ? "profile" : "off",
    ready: engine.isReady(),
  };
}

async function toggle(url: string, enabled: boolean): Promise<StatusResponse> {
  const s = await loadSettings();
  const host = hostOf(url);
  const site = siteFor(s, host);
  s.sites[host] = { enabled, format: site.format };
  await saveSettings(s);
  return status(url);
}

async function setMode(mode: "live" | "manual"): Promise<void> {
  const s = await loadSettings();
  s.mode = mode;
  await saveSettings(s);
}

// runNow tells the active tab to lint its focused field.
async function runNow(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.sendMessage(tab.id, { type: "run" }).catch(() => undefined);
}

// resolve shows what a configuration comes to, over the profile's packages.
async function resolveINI(ini: string): Promise<ResolvedConfig> {
  const cfg = await profileConfig();
  cfg.ini = ini;
  try {
    // The options page shows the configuration as the user wrote it.
    await load(cfg, (await loadSettings()).vocab);
    return await engine.resolveConfig<ResolvedConfig>(ini);
  } catch (err) {
    return { stylesPath: "", global: { vocab: [], basedOnStyles: [] }, sections: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// sync fetches every package the profile's INI names and stores it.
async function sync(): Promise<SyncResponse> {
  const s = await loadSettings();
  const byName = new Map(s.packages.map((p) => [p.name, p]));
  const outcomes: SyncResponse["outcomes"] = [];
  for (const entry of parsePackages(s.ini)) {
    const got = await fetchPackage(entry);
    if (got.ok && got.bytes) {
      byName.set(got.name, { name: got.name, data: await bytesToBase64(got.bytes), source: "url", origin: got.url });
    }
    outcomes.push({ name: got.name, ok: got.ok, error: got.error });
  }
  s.packages = Array.from(byName.values());
  await saveSettings(s);
  loaded = "";
  return { outcomes };
}

async function dropRepoCache(): Promise<void> {
  const keys = Object.keys(await browser.storage.local.get(null)).filter((k) => k.startsWith("repo:"));
  if (keys.length) await browser.storage.local.remove(keys);
}

export default defineBackground(() => {
  // Loading the module is the slow part of the first lint; start it now.
  void engine.ready().catch((e) => console.error("vale.wasm failed to load:", e));

  // A first install opens the options page with a word on how it works.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") void browser.tabs.create({ url: browser.runtime.getURL("/options.html?welcome") });
    // Earlier versions cached repository configurations; they're unused now.
    if (reason === "update") void dropRepoCache();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === "lint-field") void runNow();
  });

  browser.storage.onChanged.addListener(() => {
    // Settings changed: the next lint reloads its packages.
    loaded = "";
  });

  browser.runtime.onMessage.addListener((msg: Request, sender, sendResponse) => {
    // A frame is on or off with the page it's in: an editor in an
    // about:blank frame, or one served from elsewhere, follows the tab.
    const site = (url: string) => (sender.frameId && sender.tab?.url ? sender.tab.url : url);
    const reply = (p: Promise<unknown>) => {
      p.then(sendResponse, (e) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
      return true;
    };
    switch (msg.type) {
      case "lint":
        return reply(lint(msg.text, site(msg.url)));
      case "suggest":
        return reply(suggest(msg.alert, site(msg.url)));
      case "status":
        return reply(status(site(msg.url)));
      case "toggle":
        return reply(toggle(msg.url, msg.enabled));
      case "mode":
        return reply(setMode(msg.mode));
      case "run-now":
        return reply(runNow());
      case "sync":
        return reply(sync());
      case "resolve":
        return reply(resolveINI(msg.ini));
      case "ping":
        return reply(Promise.resolve(engine.isReady()));
      case "dismiss":
        return reply(
          remember((s) => {
            if (!s.dismissed.includes(msg.key)) s.dismissed = [...s.dismissed, msg.key].slice(-1000);
          }),
        );
      case "disable-rule":
        return reply(
          remember((s) => {
            if (!s.disabledRules.includes(msg.check)) s.disabledRules = [...s.disabledRules, msg.check];
          }),
        );
      case "add-word":
        return reply(
          remember((s) => {
            const word = msg.word.trim();
            if (word && !s.vocab.includes(word)) s.vocab = [...s.vocab, word];
          }),
        );
      case "theme":
        void browser.action.setIcon({ path: actionIcon(msg.dark) });
        return false;
      default:
        return false;
    }
  });
});
