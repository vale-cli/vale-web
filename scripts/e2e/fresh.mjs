// A fresh install: the default profile, no packages synced. The options
// page resolves it without an error, and a field on a site that's on gets
// its marks and its badge.
//
//   pnpm build
//   node scripts/e2e/fresh.mjs
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs"; import http from "node:http"; import os from "node:os"; import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const ext = path.join(root, ".output/chrome-mv3");
const html = fs.readFileSync(path.join(root, "scripts/screenshots/comment.html"));
const server = http.createServer((_q, r) => { r.setHeader("content-type", "text/html"); r.end(html); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "vw-")), {
  ...(process.env.VALE_E2E_BROWSER ? { executablePath: process.env.VALE_E2E_BROWSER } : { channel: "chromium" }),
  headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...(process.env.VALE_E2E_BROWSER ? ["--headless=new"] : [])], viewport: { width: 1100, height: 700 } });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;

// No settings are written: this is the profile a new user starts with.
const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/options.html`);
await opt.getByText("BasedOnStyles").first().waitFor();
assert.deepEqual(await opt.locator("p.text-sev-error").allInnerTexts(), [], "the default profile resolves");

const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
await opt.evaluate((url) => chrome.runtime.sendMessage({ type: "toggle", url, enabled: true }), page.url());
await page.reload();
const ta = page.locator("#comment"); await ta.click(); await ta.fill("this is is a coode");
let marks = [];
for (let i = 0; i < 300 && marks.length < 2; i++) {
  await page.waitForTimeout(100);
  marks = await page.evaluate(() => [...document.querySelectorAll("#vale-overlay > div:first-child > div")].map((d) => d.dataset.check));
}
assert.deepEqual(marks.sort(), ["Vale.Repetition", "Vale.Spelling"], "the default profile lints");

// The badge in the field's corner counts them, opens the first one's card
// without taking focus, and is Vale's mark alone once the text is clean.
const badge = () => page.evaluate(() => { const b = document.querySelector("#vale-overlay > button"); return b && b.style.display !== "none" ? { text: b.textContent, state: b.dataset.state } : null; });
assert.deepEqual(await badge(), { text: "2", state: "alerts" }, "the badge counts the alerts");
await page.locator("#vale-overlay > button").click();
assert.equal(await page.evaluate(() => document.querySelector("#vale-overlay > div:last-child").style.display), "block", "the badge opens a card");
assert.equal(await page.evaluate(() => document.activeElement?.id), "comment", "the field keeps focus");
await page.keyboard.press("Escape");
await ta.fill("This sentence is fine.");
let clean = null;
for (let i = 0; i < 300 && clean?.state !== "clean"; i++) { await page.waitForTimeout(100); clean = await badge(); }
assert.deepEqual(clean, { text: "", state: "clean" }, "a clean field's badge is the mark alone");
assert.equal(await page.evaluate(() => document.querySelector("#vale-overlay > button path").getAttribute("d")), "M0 40 32 40 72 120 40 120ZM96 0 128 0 86 84 70 52Z", "the badge carries Vale's mark");
await ta.fill("");
await page.waitForTimeout(500);
assert.equal(await badge(), null, "an empty field has no badge");

console.log("ok");
await ctx.close(); server.close();
