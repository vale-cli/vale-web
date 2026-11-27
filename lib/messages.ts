// The protocol between the content script, the pages, and the background.
import type { ValeAlert } from "./engine";

export type LintRequest = { type: "lint"; text: string; url: string };
export type LintResponse = {
  alerts: ValeAlert[];
  // The profile, or nothing because the site is off.
  source: "profile" | "off";
  format: string;
  error?: string;
};

export type SuggestRequest = { type: "suggest"; alert: ValeAlert; url: string };
export type SuggestResponse = { suggestions: string[]; error?: string };

export type StatusRequest = { type: "status"; url: string };
export type StatusResponse = {
  enabled: boolean;
  mode: "live" | "manual";
  delay: number;
  hover: boolean;
  host: string;
  format: string;
  source: "profile" | "off";
  ready: boolean;
  error?: string;
};

export type ToggleRequest = { type: "toggle"; url: string; enabled: boolean };
export type ModeRequest = { type: "mode"; mode: "live" | "manual" };
// run asks the page's content script to lint the focused field now.
export type RunRequest = { type: "run" };
// ping keeps the background awake while a field is being edited: a browser
// stops an idle one, and starting it again reloads the engine.
export type PingRequest = { type: "ping" };
// From a card: hide this alert on this line, turn its rule off, or accept the
// word it flagged.
export type DismissRequest = { type: "dismiss"; key: string };
export type DisableRuleRequest = { type: "disable-rule"; check: string };
export type AddWordRequest = { type: "add-word"; word: string };
export type RunNowRequest = { type: "run-now" };
export type SyncRequest = { type: "sync" };
export type ResolveRequest = { type: "resolve"; ini: string };
export type ResolvedRule = { ref: string; state: "active" | "disabled" | "override"; level?: string };
export type ResolvedSection = { glob: string; styles: string[]; rules: ResolvedRule[]; active: number; overridden: number; disabled: number };
export type ResolvedConfig = {
  stylesPath: string;
  global: { minAlertLevel?: string; vocab: string[]; basedOnStyles: string[] };
  sections: ResolvedSection[];
  error?: string;
};
// A page reports whether the browser is in its dark scheme, for the toolbar icon.
export type ThemeRequest = { type: "theme"; dark: boolean };
export type SyncResponse = { outcomes: { name: string; ok: boolean; error?: string }[] };

export type Request = LintRequest | SuggestRequest | StatusRequest | ToggleRequest | ModeRequest | RunNowRequest | SyncRequest | ResolveRequest | PingRequest | DismissRequest | DisableRuleRequest | AddWordRequest | ThemeRequest;
