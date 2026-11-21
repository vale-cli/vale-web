// Takes the store screenshots that don't need a signed-in session. Each is
// shot at 2x and scaled to exactly 1280x800, the size Chrome, Edge, and
// Firefox all take. Needs a production build and Playwright:
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
  if (req.url?.startsWith("/popup-over")) return res.end(popupOver);
  res.end(fs.readFileSync(path.join(here, "comment.html")));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = `http://127.0.0.1:${server.address().port}/`;
let popupOver = "";

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(root, ".output/profile-")), {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
console.log("extension", id);
for (const p of ctx.pages()) if (p.url().includes("welcome")) await p.close();

// shoot saves a page at 2x, then scales it to the store's 1280x800.
const shoot = async (page, name) => {
  const file = path.join(out, name);
  await page.screenshot({ path: file });
  execFileSync("sips", ["-z", "800", "1280", file], { stdio: "ignore" });
  console.log("wrote", name);
};

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
await page.mouse.move(1200, 760);
await page.waitForTimeout(300);
await shoot(page, "1-as-you-type.png");

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
await shoot(page, "2-keyboard.png");
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
const pagePng = (await page.screenshot()).toString("base64");
popupOver = `<!doctype html><body style="margin:0;width:1280px;height:800px;overflow:hidden;position:relative">
  <img src="data:image/png;base64,${pagePng}" style="width:1280px;height:800px;display:block;filter:brightness(.97)">
  <img src="data:image/png;base64,${popupPng}" style="position:absolute;top:14px;right:24px;width:320px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.18),0 18px 48px rgba(0,0,0,.22)">
</body>`;
const over = await ctx.newPage();
await over.goto(`${site}popup-over`);
await over.waitForTimeout(300);
await shoot(over, "3-popup.png");
await over.close();

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
await shoot(opt, "4-options.png");

// 5. The Yours tab.
await opt.click("text=Yours");
await opt.waitForTimeout(400);
await shoot(opt, "5-yours.png");

await ctx.close();
server.close();
console.log("done:", fs.readdirSync(out).join(", "));
