// The card: a click opens it and it stays; a fix applies; Alt+Enter opens it
// with focus, the arrows walk it, and Escape puts the caret back; and an
// added word, a dismissal, and a turned-off rule stay gone after a relint;
// and a repository's page is checked with the profile, like any other.
//
//   pnpm build
//   node scripts/e2e/card.mjs
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
  headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...(process.env.VALE_E2E_BROWSER ? ["--headless=new"] : [])], viewport: { width: 1100, height: 700 }, deviceScaleFactor: 2 });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/options.html`);
await opt.evaluate((s) => chrome.storage.local.set({ settings: s }), JSON.parse(fs.readFileSync(settingsPath, "utf8")));
const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
const ta = page.locator("#comment");
const out = {};
const marks = () => page.evaluate(() => [...document.querySelectorAll("#vale-overlay > div:first-child > div")].map((d) => ({ x: parseFloat(d.style.left) - scrollX, y: parseFloat(d.style.top) - scrollY, w: parseFloat(d.style.width), check: d.dataset.check })));
const until = async (f, ms = 30000) => { const t = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t > ms) return null; await page.waitForTimeout(20); } };
const card = () => page.evaluate(() => { const p = document.querySelector("#vale-overlay > div:last-child"); return p && p.style.display !== "none" ? { text: p.innerText, focused: document.activeElement?.textContent ?? document.activeElement?.tagName, role: p.getAttribute("role") } : null; });
const text = "Teh team will utilize it, really.";
await ta.click(); await ta.fill(text);
await until(async () => (await marks()).length >= 3, 60000);
const ms = await marks();
out.marks = ms.length;
// The textarea's coordinates for each word, to click on a mark.
const wordAt = (w) => page.evaluate((w) => { const t = document.querySelector("#comment"); const i = t.value.indexOf(w); const m = document.createElement("div"); const cs = getComputedStyle(t); for (const k of ["font","padding","border","width","lineHeight","letterSpacing","whiteSpace","wordWrap","boxSizing"]) m.style[k] = cs[k]; m.style.position="absolute"; m.style.visibility="hidden"; m.style.whiteSpace="pre-wrap"; const r0=t.getBoundingClientRect(); m.style.left=r0.left+"px"; m.style.top=r0.top+"px"; m.textContent=t.value.slice(0,i); const s=document.createElement("span"); s.textContent=w; m.appendChild(s); document.body.appendChild(m); const r=s.getBoundingClientRect(); m.remove(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; }, w);
// 1. Click a mark: the card opens and stays when the pointer leaves.
let p = await wordAt("utilize"); await page.mouse.click(p.x, p.y);
const opened = await until(card, 5000);
await page.mouse.move(10, 600); await page.waitForTimeout(600);
out.clickOpens = !!opened; out.staysWhenPointerLeaves = !!(await card()); out.cardText = opened?.text.replace(/\n+/g, " | "); out.role = opened?.role;
// 2. Apply the suggestion.
await page.locator("#vale-overlay button", { hasText: /^use$/ }).click();
await page.waitForTimeout(400);
out.afterFix = await ta.inputValue();
// 3. Alt+Enter in "Teh", walk with arrows, Escape puts the caret back.
await ta.focus(); await page.evaluate(() => document.querySelector("#comment").setSelectionRange(1, 1));
await page.keyboard.press("Alt+Enter");
const kb = await until(card, 5000); await page.waitForTimeout(300); kb.focused = (await card())?.focused;
await page.keyboard.press("ArrowDown"); const second = (await card())?.focused;
await page.keyboard.press("Escape");
out.keyboard = { opens: !!kb, firstFocused: kb?.focused, afterArrowDown: second, closedByEsc: !(await card()), caretBack: await page.evaluate(() => [document.activeElement.id, document.querySelector("#comment").selectionStart]) };
// 4. Add "Teh" to the vocabulary: its mark goes, and stays gone after a relint.
await page.keyboard.press("Alt+Enter"); await until(card, 5000);
await page.locator("#vale-overlay button", { hasText: /^Add/ }).click();
await ta.press("End"); await ta.pressSequentially(" Ok.", { delay: 30 }); await page.waitForTimeout(800);
out.afterAddWord = (await marks()).map((m) => m.check);
// 5. Dismiss "really": gone, and still gone after a relint.
p = await wordAt("really"); await page.mouse.click(p.x, p.y); await until(card, 5000);
await page.locator("#vale-overlay button", { hasText: "Dismiss" }).click();
await ta.press("End"); await ta.pressSequentially(" Yes.", { delay: 30 }); await page.waitForTimeout(800);
out.afterDismiss = (await marks()).map((m) => m.check);
// 6. Turn the rule off: a new "really" isn't marked.
await ta.press("End"); await ta.pressSequentially(" It is really fine.", { delay: 20 }); await page.waitForTimeout(800);
const before6 = (await marks()).map((m) => m.check);
p = await wordAt("really fine"); await page.mouse.click(p.x, p.y); await until(card, 5000);
const rule = (await card())?.text.match(/Turn off (\S+)/)?.[1];
await page.locator("#vale-overlay button", { hasText: "Turn off" }).click();
await ta.press("End"); await ta.pressSequentially(" Really.", { delay: 20 }); await page.waitForTimeout(800);
out.turnOff = { rule, marksBefore: before6, after: (await marks()).map((m) => m.check) };
out.text = await ta.inputValue();
// 7. A repository page uses the profile too: the uploaded Demo package marks
// it, though vale-cli/vale has a .vale.ini of its own.
await ctx.route("https://github.com/vale-cli/vale/pull/1", (r) => r.fulfill({ contentType: "text/html", body: fs.readFileSync(htmlPath) }));
const gh = await ctx.newPage(); await gh.goto("https://github.com/vale-cli/vale/pull/1");
await gh.locator("#comment").click(); await gh.locator("#comment").fill("We can utilize it.");
const ghMarks = async () => gh.evaluate(() => [...document.querySelectorAll("#vale-overlay > div:first-child > div")].map((d) => d.dataset.check));
const t7 = Date.now(); while (!(await ghMarks()).includes("Demo.Wordy") && Date.now() - t7 < 30000) await gh.waitForTimeout(50);
out.github = await ghMarks();
const checks = {
  "a click opens the card": out.clickOpens,
  "it stays when the pointer leaves": out.staysWhenPointerLeaves,
  "the fix applies": out.afterFix === "Teh team will use it, really.",
  "Alt+Enter opens it with focus": out.keyboard.opens && out.keyboard.firstFocused !== "",
  "the arrows walk it": out.keyboard.afterArrowDown !== out.keyboard.firstFocused,
  "Escape closes it and puts the caret back": out.keyboard.closedByEsc && out.keyboard.caretBack[1] === 1,
  "an added word stays accepted": !out.afterAddWord.includes("Vale.Spelling"),
  "a dismissal holds": out.afterDismiss.length === 0,
  "a turned-off rule stays off": out.turnOff.marksBefore.length > 0 && out.turnOff.after.length === 0,
  "a repository page uses the profile": out.github.includes("Demo.Wordy"),
};
let failed = 0;
for (const [name, ok] of Object.entries(checks)) {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}
if (failed) console.log(JSON.stringify(out, null, 1));
await ctx.close(); server.close(); process.exit(failed ? 1 : 0);
