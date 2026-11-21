// Each editor page in ./editors: type a sentence, click its mark, apply the
// fix, and type on. Passes when the fix lands in the editor's own model --
// not just its DOM, which a rich editor would redraw over -- and typing
// afterwards still works. Needs a production build and Playwright, and the
// network for the editors loaded from CDNs:
//
//   pnpm build
//   npx -y playwright@latest install chromium
//   node scripts/e2e/editors.mjs [ckeditor,slate,...]
import { chromium } from "playwright";
import fs from "node:fs"; import http from "node:http"; import os from "node:os"; import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const ext = path.join(root, ".output/chrome-mv3");
const settingsPath = path.join(root, "scripts/screenshots/settings.json");
const dir = path.join(here, "editors");
const only = process.argv[2];
let failed = 0;
const server = http.createServer((q, r) => { const f = path.join(dir, path.basename(q.url.split("?")[0]) || "x"); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader("content-type", "text/html"); r.end(fs.readFileSync(f)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "vw-")), {
  // VALE_E2E_BROWSER runs another Chromium build -- Brave, Edge -- in
  // place of Playwright's own.
  ...(process.env.VALE_E2E_BROWSER ? { executablePath: process.env.VALE_E2E_BROWSER } : { channel: "chromium" }),
  headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...(process.env.VALE_E2E_BROWSER ? ["--headless=new"] : [])], viewport: { width: 1100, height: 700 } });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/options.html`);
await opt.evaluate((s) => chrome.storage.local.set({ settings: s }), JSON.parse(fs.readFileSync(settingsPath, "utf8")));
await opt.close();
const names = only ? only.split(",") : fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5)).sort();
for (const name of names) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 80)));
  const r = { editor: name };
  try {
    await page.goto(base + name + ".html", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.modelText && (window.edEl || document.getElementById("ed")), null, { timeout: 15000 });
    // Which document the marks are drawn in: the frame's, for a framed editor.
    const frame = name === "iframe" ? page.frames()[1] : page.mainFrame();
    const el = await page.evaluateHandle(() => window.edEl || document.getElementById("ed"));
    await el.asElement().click();
    await page.keyboard.type("We will utilize it.", { delay: 25 });
    const markSel = "#vale-overlay > div:first-child > div[data-check='Demo.Wordy']";
    const mark = await frame.waitForSelector(markSel, { timeout: 15000 }).catch(() => null);
    r.marked = !!mark;
    if (mark) {
      // A redraw replaces the marks, so look again until one holds still.
      let box = null;
      for (let i = 0; i < 20 && !box; i++) {
        box = await (await frame.$(markSel))?.boundingBox();
        if (!box) await page.waitForTimeout(50);
      }
      await page.mouse.click(box.x + box.width / 2, box.y - 6);
      const btn = await frame.waitForSelector("#vale-overlay button:text-is('use')", { timeout: 8000 }).catch(() => null);
      r.card = !!btn;
      if (btn) {
        await btn.click();
        await page.waitForTimeout(500);
        r.afterFix = (await page.evaluate(() => window.modelText())).replace(/\s+/g, " ").trim();
        await page.keyboard.press("End"); await page.waitForTimeout(300);
        await page.keyboard.type(" Done.", { delay: 25 });
        await page.waitForTimeout(400);
        const t = (await page.evaluate(() => window.modelText())).replace(/\s+/g, " ").trim();
        r.model = t;
        r.fixed = r.afterFix === "We will use it.";
        r.typingAfter = t.includes("We will use it.") && t.includes("Done.");
      }
    }
  } catch (e) { r.error = String(e.message).split("\n")[0].slice(0, 120); }
  if (errors.length) r.pageErrors = errors.slice(0, 2);
  const ok = r.marked && r.card && r.fixed && r.typingAfter;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(16)}${ok ? "" : JSON.stringify(r)}`);
  await page.close();
}
await ctx.close(); server.close(); process.exit(failed ? 1 : 0);
