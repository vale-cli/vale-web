// The options page and what the cards leave behind: the welcome on a first
// install, the fix hotkey, the Yours tab, turning a rule back on, and the
// theme following the system.
//
//   pnpm build
//   node scripts/e2e/options.mjs
import { chromium } from "playwright";
import fs from "node:fs"; import http from "node:http"; import os from "node:os"; import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const ext = path.join(root, ".output/chrome-mv3");
const settingsPath = path.join(root, "scripts/screenshots/settings.json");
const htmlPath = path.join(root, "scripts/screenshots/comment.html");
const server = http.createServer((_q, r) => { r.setHeader("content-type", "text/html"); r.end(fs.readFileSync(htmlPath)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "vw-")), {
  // VALE_E2E_BROWSER runs another Chromium build -- Brave, Edge -- in
  // place of Playwright's own.
  ...(process.env.VALE_E2E_BROWSER ? { executablePath: process.env.VALE_E2E_BROWSER } : { channel: "chromium" }),
  headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...(process.env.VALE_E2E_BROWSER ? ["--headless=new"] : [])], viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
const out = {};
await new Promise((r) => setTimeout(r, 1500));
out.welcomeTabOpened = ctx.pages().some((p) => p.url().includes("options.html?welcome"));
const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/options.html`);
await opt.evaluate((s) => chrome.storage.local.set({ settings: s }), JSON.parse(fs.readFileSync(settingsPath, "utf8")));
const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
const ta = page.locator("#comment");
const checks = () => page.evaluate(() => [...document.querySelectorAll("#vale-overlay > div:first-child > div")].map((d) => d.dataset.check));
const until = async (f, ms = 30000) => { const t = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t > ms) return null; await page.waitForTimeout(20); } };
await ta.click(); await ta.fill("We will utilize it, really, and Teh team agrees.");
await until(async () => (await checks()).length >= 3, 60000);
// Alt+Shift+Enter in "utilize" applies the first fix.
await page.evaluate(() => document.querySelector("#comment").setSelectionRange(10, 10));
await page.keyboard.press("Alt+Shift+Enter"); await page.waitForTimeout(800);
out.hotkeyFix = await ta.inputValue();
// Card actions: add Teh, dismiss really (by hotkey card), turn off nothing yet.
const openAt = async (word) => { const i = (await ta.inputValue()).indexOf(word) + 1; await page.evaluate((i) => document.querySelector("#comment").setSelectionRange(i, i), i); await page.keyboard.press("Alt+Enter"); await page.waitForSelector("#vale-overlay button"); await page.waitForTimeout(300); };
await openAt("Teh"); await page.locator("#vale-overlay button", { hasText: /^Add/ }).click(); await page.waitForTimeout(600);
await openAt("really"); await page.locator("#vale-overlay button", { hasText: "Turn off" }).click(); await page.waitForTimeout(600);
out.afterActions = await checks();
// The Yours tab.
await opt.goto(`chrome-extension://${id}/options.html?welcome`);
await opt.waitForSelector("text=Yours"); await opt.click("text=Yours"); await opt.waitForTimeout(400);
out.yours = await opt.evaluate(() => document.querySelector("aside")?.innerText.replace(/\n+/g, " | "));
await opt.emulateMedia({ colorScheme: "light" }); await opt.waitForTimeout(200);
out.lightClass = await opt.evaluate(() => document.documentElement.classList.contains("dark"));
await opt.emulateMedia({ colorScheme: "dark" }); await opt.waitForTimeout(200);
out.darkClass = await opt.evaluate(() => document.documentElement.classList.contains("dark"));
// Turn the rule back on from the options page; its mark returns.
await opt.locator("button", { hasText: "Turn on" }).first().click(); await opt.waitForTimeout(800);
await page.bringToFront(); await ta.press("End"); await ta.pressSequentially(" Ok.", { delay: 30 });
out.afterTurnOn = await until(async () => { const c = await checks(); return c.includes("Demo.Hedging") ? c : null; }, 5000);
const checks2 = {
  "a first install opens the welcome": out.welcomeTabOpened,
  "Alt+Shift+Enter applies the first fix": out.hotkeyFix.startsWith("We will use it,"),
  "the card's actions took": out.afterActions.length === 0,
  "Yours lists the word and the rule": out.yours.includes("Teh") && out.yours.includes("Demo.Hedging"),
  "the page follows the system's theme": out.lightClass === false && out.darkClass === true,
  "Turn on brings the rule back": !!out.afterTurnOn,
};
let failed = 0;
for (const [name, ok] of Object.entries(checks2)) {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}
if (failed) console.log(JSON.stringify(out, null, 1));
await ctx.close(); server.close(); process.exit(failed ? 1 : 0);
