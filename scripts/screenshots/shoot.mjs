// Takes the store screenshots that don't need a signed-in session. Each page
// is shot at 2x inside a drawn browser window, under a headline, and scaled
// to exactly 1280x800, the size Chrome, Edge, and Firefox all take. Needs a
// production build and Playwright:
//
//   pnpm build
//   npx -y playwright@latest install chromium
//   node scripts/screenshots/shoot.mjs
//
//   1-as-you-type.png  a comment with marks of three severities, and the card
//                      open on one, with its fix
//   2-keyboard.png     a spelling card opened from the keyboard: suggestions,
//                      Add to vocabulary, Dismiss, Turn off
//   3-popup.png        the popup over the page it's for
//   4-options.png      the configuration and the rules it resolves to
//   5-yours.png        the Yours tab, after the cards have been used
//
// The comment page is served from this directory. Settings are seeded from
// settings.json: a demo package with a warning and a suggestion rule, so all
// three severities show.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const extPath = path.join(root, ".output/chrome-mv3");
const out = path.join(root, "store/screenshots");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith(".png")) fs.rmSync(path.join(out, f));

const server = http.createServer((req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  if (req.url?.startsWith("/canvas")) return res.end(canvas);
  res.end(fs.readFileSync(path.join(here, "comment.html")));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = `http://127.0.0.1:${server.address().port}/`;

// The canvas, and the window drawn on it: a headline, then the window from
// its top edge to past the bottom, so the page reads as running on.
const CANVAS = { w: 1280, h: 800 };
const WIN = { x: 80, y: 122, w: 1120, chrome: 84 };
const VIEW = { w: WIN.w, h: CANVAS.h - WIN.y - WIN.chrome };
const png = (file) => fs.readFileSync(file).toString("base64");
const icon = png(path.join(root, "public/icon/32.png"));
let canvas = "";

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(root, ".output/profile-")), {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  // The page area of the drawn window; see frame.
  viewport: { width: VIEW.w, height: VIEW.h },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
console.log("extension", id);
for (const p of ctx.pages()) if (p.url().includes("welcome")) await p.close();

// frame draws a browser window around the page as it stands, with `popup`
// open under the toolbar icon when given, and saves it at the store's size.
const framer = await ctx.newPage();
await framer.setViewportSize({ width: CANVAS.w, height: CANVAS.h });
const frame = async (page, name, { headline, title, url, popup, ext }) => {
  const shot = (await page.screenshot()).toString("base64");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  canvas = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:${CANVAS.w}px;height:${CANVAS.h}px;overflow:hidden;position:relative;font-family:Inter,-apple-system,'Helvetica Neue',sans-serif;background:radial-gradient(ellipse 55% 60% at 18% 0%,rgba(144,212,84,.16),transparent 70%),#101310">
  <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(242,244,238,.06) 1.5px,transparent 1.8px);background-size:28px 28px"></div>
  <div style="position:absolute;left:0;right:0;top:40px;text-align:center;color:#f2f4ee;font-size:34px;font-weight:600;letter-spacing:-1px">${esc(headline)}</div>
  <div style="position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${CANVAS.h}px;border-radius:12px 12px 0 0;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)">
    <div style="height:40px;background:#dfe3e8;display:flex;align-items:flex-end;padding-left:14px;gap:8px;position:relative">
      <div style="position:absolute;left:16px;top:14px;display:flex;gap:8px">${["#ff5f57", "#febc2e", "#28c840"].map((c) => `<span style="width:12px;height:12px;border-radius:6px;background:${c}"></span>`).join("")}</div>
      <div style="margin-left:80px;width:240px;height:32px;background:#fff;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:12px;color:#1f1f1f">
        ${ext ? `<img src="data:image/png;base64,${icon}" style="width:14px;height:14px;flex-shrink:0">` : `<span style="width:14px;height:14px;border-radius:3px;background:#24292f;flex-shrink:0"></span>`}
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>
        <span style="margin-left:auto;color:#5f6368">×</span>
      </div>
      <span style="color:#5f6368;font-size:18px;margin-bottom:7px">+</span>
    </div>
    <div style="height:44px;background:#fff;display:flex;align-items:center;gap:14px;padding:0 14px;border-bottom:1px solid #e3e3e3;color:#5f6368">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bdc1c6" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>
      <div style="flex:1;height:32px;border-radius:16px;background:#f1f3f4;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:13px;color:#1f1f1f">
        ${ext ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2.2"><path d="M19 11h-1V7a2 2 0 0 0-2-2h-4V4a2 2 0 1 0-4 0v1H4v5h1a2 2 0 1 1 0 4H4v5h5v-1a2 2 0 1 1 4 0v1h5v-4h1a2 2 0 1 0 0-4z"/></svg>` : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`}
        ${esc(url)}
      </div>
      <span style="width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:${popup ? "#e8eaed" : "transparent"}"><img src="data:image/png;base64,${icon}" style="width:18px;height:18px"></span>
      <span style="width:24px;height:24px;border-radius:12px;background:#90d454"></span>
    </div>
    <img src="data:image/png;base64,${shot}" style="display:block;width:${VIEW.w}px;height:${VIEW.h}px">
    ${popup ? `<img src="data:image/png;base64,${popup}" style="position:absolute;top:${WIN.chrome - 4}px;right:44px;width:320px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.18),0 18px 48px rgba(0,0,0,.24)">` : ""}
  </div>
</body>`;
  await framer.goto(`${site}canvas`);
  await framer.waitForTimeout(150);
  const file = path.join(out, name);
  await framer.screenshot({ path: file });
  execFileSync("sips", ["-z", String(CANVAS.h), String(CANVAS.w), file], { stdio: "ignore" });
  console.log("wrote", name);
};
const github = { title: "Add a comment", url: "github.com/vale-cli/vale/pull/1236" };
const options = { title: "Vale Options", url: "chrome-extension://vale/options.html", ext: true };

// Seed the profile.
const settings = JSON.parse(fs.readFileSync(path.join(here, "settings.json"), "utf8"));
const opt = await ctx.newPage();
await opt.goto(`chrome-extension://${id}/options.html`);
await opt.evaluate((s) => chrome.storage.local.set({ settings: s }), settings);

// 1. The comment, and the card on a fix.
const page = await ctx.newPage();
await page.goto(site);
const ta = page.locator("#comment");
await ta.click();
const text =
  "The new cache makes the build really fast in every enviroment. We can utilize it in order to skip the slow step, and it's very simple to turn on.\n";
await ta.fill(text);
const marks = "#vale-overlay > div:first-child > div";
await page.waitForFunction((sel) => document.querySelectorAll(sel).length >= 5, marks, { timeout: 60000 });
await page.waitForTimeout(500);
const mark = (check, n = 0) => page.locator(`${marks}[data-check='${check}']`).nth(n);
const box = await mark("Demo.Wordy").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y - 6);
await page.waitForSelector("#vale-overlay button:text-is('use')");
await page.mouse.move(VIEW.w - 20, VIEW.h - 20);
await page.waitForTimeout(300);
await frame(page, "1-as-you-type.png", { ...github, headline: "Marks as you type, with the fix one click away." });

// 2. A spelling card, from the keyboard.
await page.keyboard.press("Escape");
await ta.focus();
const at = text.indexOf("enviroment") + 2;
await page.evaluate((i) => document.querySelector("#comment").setSelectionRange(i, i), at);
await page.keyboard.press("Alt+Enter");
await page.waitForSelector("#vale-overlay button:has-text('Add')");
// Spelling suggestions take a moment longer than the rest of the card.
await page.waitForSelector("#vale-overlay button:text-is('environment')", { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(300);
await frame(page, "2-keyboard.png", { ...github, headline: "Alt+Enter opens the card at the cursor." });
await page.keyboard.press("Escape");

// The popup, asked about the comment page, then laid over that page.
const pop = await ctx.newPage();
await pop.addInitScript((url) => {
  const orig = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = (q) => orig(q).then((tabs) => tabs.map((t) => ({ ...t, url })));
}, "https://github.com/notifications");
await pop.setViewportSize({ width: 320, height: 300 });
await pop.goto(`chrome-extension://${id}/popup.html`);
await pop.waitForSelector("[role=switch]");
await pop.waitForTimeout(400);
const popupPng = (await pop.locator("body").screenshot()).toString("base64");
await pop.close();
await page.bringToFront();
await frame(page, "3-popup.png", { ...github, headline: "Turn it on for any site, from the toolbar.", popup: popupPng });

// Use the cards, so the Yours tab has something in it.
const open = async (word) => {
  // The whole word: "very" is also inside "every".
  const i = (await ta.inputValue()).search(new RegExp(`\\b${word}\\b`)) + 1;
  await ta.focus();
  // Coming back to the field checks it again; wait for its marks.
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length > 0, marks);
  await page.evaluate((i) => document.querySelector("#comment").setSelectionRange(i, i), i);
  await page.keyboard.press("Alt+Enter");
  await page.waitForSelector("#vale-overlay button:has-text('Dismiss')");
  await page.waitForTimeout(200);
};
await open("very");
await page.locator("#vale-overlay button", { hasText: "Dismiss" }).click();
await page.waitForTimeout(500);
// A profile as one is usually set up: a published style beside the demo.
const pkg = await fetch("https://github.com/vale-cli/Microsoft/releases/latest/download/Microsoft.zip");
if (!pkg.ok) throw new Error(`Microsoft.zip: ${pkg.status}`);
const microsoft = Buffer.from(await pkg.arrayBuffer()).toString("base64");
await opt.evaluate(async ({ words, microsoft }) => {
  const { settings } = await chrome.storage.local.get("settings");
  settings.vocab = [...new Set([...(settings.vocab ?? []), ...words])];
  settings.disabledRules = ["Microsoft.Contractions"];
  settings.ini = "StylesPath = styles\nMinAlertLevel = suggestion\nPackages = Microsoft\n\n[*]\nBasedOnStyles = Vale, Microsoft, Demo\n\n# Headings are sentence case here.\nMicrosoft.Headings = NO\nMicrosoft.Passive = warning\n";
  settings.packages = [...settings.packages, { name: "Microsoft", data: microsoft, source: "url" }];
  await chrome.storage.local.set({ settings });
}, { words: ["GitHub", "Kubernetes", "Vale"], microsoft });

// 4. The configuration and what it resolves to.
await opt.reload();
await opt.waitForSelector(".cm-editor");
await opt.waitForSelector("text=[*]", { timeout: 15000 }).catch(() => {});
await opt.waitForTimeout(800);
await opt.bringToFront();
await frame(opt, "4-options.png", { ...options, headline: "One configuration for every site, with your own styles." });

// 5. The Yours tab.
await opt.click("text=Yours");
await opt.waitForTimeout(400);
await frame(opt, "5-yours.png", { ...options, headline: "Everything you’ve told it, in one place, undoable." });

await ctx.close();
server.close();
console.log("done:", fs.readdirSync(out).join(", "));
