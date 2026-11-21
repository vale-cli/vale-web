import type { ValeAlert } from "@/lib/engine";
import type { LintResponse, StatusResponse, SuggestResponse } from "@/lib/messages";
import { Overlay, type Placed } from "@/lib/overlay/overlay";
import { mapText, offsetAt, rangeOf, type TextMap } from "@/lib/text/editable";
import { offsetsOf } from "@/lib/text/positions";
import { remap } from "@/lib/text/remap";
import { dismissKey } from "@/lib/settings";
import { measure, type Field } from "@/lib/text/textarea";

type Editable = Field | HTMLElement;

// An input that holds a username, an address, or a number is not prose.
const notProse = /user|mail|tel|pass|cc-|address|postal|zip|country|one-time|url|search/i;

/** isField reports whether el keeps its text in a value: a textarea or an input. */
function isField(el: Element | null): el is Field {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}

function isEditable(el: EventTarget | null): el is Editable {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return (
      (el.type === "text" || el.type === "") &&
      !el.readOnly &&
      !el.disabled &&
      // Only an explicit opt-out: Firefox doesn't spell-check inputs by
      // default, so `el.spellcheck` is false there for every one of them.
      el.getAttribute("spellcheck") !== "false" &&
      !notProse.test(el.autocomplete || "") &&
      !notProse.test(el.name || "")
    );
  }
  return el.isContentEditable && el.getAttribute("contenteditable") !== "false";
}

/**
 * hostOf is the field an event inside it belongs to: for a rich editor, its
 * root, not the span the pointer landed on.
 */
function hostOf(target: EventTarget | null): EventTarget | null {
  if (!(target instanceof Element)) return target;
  let el: Element | null = target instanceof HTMLElement ? target : target.parentElement;
  if (!el) return target;
  if (isField(el)) return el;
  if (!(el instanceof HTMLElement) || !el.isContentEditable) return target;
  while (el.parentElement?.isContentEditable) el = el.parentElement;
  return el;
}

/** deepActive is the focused element, looking through shadow roots. */
function deepActive(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/** targetOf is the element an event happened on, inside a shadow root if so. */
function targetOf(e: Event): EventTarget | null {
  return e.composedPath()[0] ?? e.target;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  // Rich editors often sit in a frame, an about:blank one included; a frame
  // is on or off with the tab it's in. See the background's siteURL.
  allFrames: true,
  matchAboutBlank: true,
  main() {
    let overlay: Overlay | null = null;
    let active: Editable | null = null;
    let map: TextMap | null = null;
    // The marks, as offsets into `shown`: the text as it was when they were
    // last placed. Each edit moves them with the text; see remap.
    let spans: { alert: ValeAlert; start: number; end: number }[] = [];
    let shown = "";
    let timer: number | undefined;
    let enabled: boolean | null = null;
    let live = true;
    let delay = 0;
    let hover = false;
    // Where the caret was when a card opened from the keyboard, to go back to.
    let caret: { start: number; end: number } | Range | null = null;
    // One lint in flight at a time; a request made meanwhile runs after it,
    // on the text as it is then.
    let inFlight = false;
    let again = false;
    // What a text was found to hold, so undoing an edit, or typing a word
    // back, shows its marks at once. Cleared when the settings change.
    const cache = new Map<string, ValeAlert[]>();
    let keepAlive: number | undefined;
    // Editors that draw their own text -- CKEditor, and ProseMirror without
    // its stylesheet -- cancel the browser's insertion, so no input event
    // fires; their DOM changing is the only sign. Both feed one handler, once
    // per batch.
    let observer: MutationObserver | null = null;
    let changing = false;
    let frame: number | undefined;
    let lastBox = "";

    const send = <T,>(msg: unknown) => browser.runtime.sendMessage(msg) as Promise<T>;

    const textOf = (el: Editable): string => {
      if (isField(el)) return el.value;
      map = mapText(el);
      return map.text;
    };

    // follow moves the marks onto the text as it is now.
    const follow = () => {
      if (!active) return;
      const text = textOf(active);
      if (text !== shown) {
        spans = remap(spans, shown, text);
        shown = text;
      }
    };

    // show places a result made for `text` on the text as it is now.
    const show = (text: string, alerts: ValeAlert[]) => {
      const found: typeof spans = [];
      for (const a of alerts) {
        const o = offsetsOf(text, a.Line, a.Span);
        if (o) found.push({ alert: a, start: o[0], end: o[1] });
      }
      spans = found;
      shown = text;
      follow();
      redraw();
    };

    // place works out where each mark is on screen for the active editable.
    const place = (): Placed[] => {
      if (!active) return [];
      // An editor that renders from its own model -- React, say -- swaps
      // text nodes out from under the map; read it again.
      if (!isField(active) && map && !map.nodes.every((n) => n.node.isConnected)) textOf(active);
      if (isField(active)) {
        const rects = measure(active, spans.map((s) => [s.start, s.end]));
        return spans.map((s, i) => ({ ...s, rects: rects[i] ?? [] }));
      }
      return spans.map((s) => {
        const r = map ? rangeOf(map, s.start, s.end) : null;
        return { ...s, rects: r ? Array.from(r.getClientRects()) : [] };
      });
    };

    const redraw = () => overlay?.draw(place());

    const apply = async (p: Placed, replacement: string) => {
      if (!active) return;
      const field = active;
      field.focus();
      const want = shown.slice(0, p.start) + replacement + shown.slice(p.end);
      if (isField(field)) {
        // execCommand keeps the browser's own undo; setRangeText doesn't.
        field.setSelectionRange(p.start, p.end);
        if (!document.execCommand("insertText", false, replacement) || field.value !== want) {
          field.setRangeText(replacement, p.start, p.end, "end");
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
        lintSoon();
        return;
      }
      if (!map) return;
      const select = () => {
        map = mapText(field);
        const r = rangeOf(map, p.start, p.end);
        if (!r) return null;
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
        return r;
      };
      // A rich editor keeps its own model and redraws the DOM from it, so
      // the text has to go in by a path it listens to. Each is tried in turn,
      // and a frame later the text says whether it took.
      const took = async () => {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        return active === field && mapText(field).text === want;
      };
      const r = select();
      if (!r) return;
      // 1. The event a spell checker's replacement raises: Slate, Lexical,
      // CKEditor, and Gutenberg handle it and cancel it.
      const ev = new InputEvent("beforeinput", {
        inputType: "insertReplacementText",
        data: replacement,
        targetRanges: [new StaticRange(r)],
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      const handled = !field.dispatchEvent(ev);
      if (!(handled && (await took()))) {
        // 2. Typing, as far as the page can tell: ProseMirror, Quill, Draft,
        // and a plain contenteditable.
        if (select() && document.execCommand("insertText", false, replacement) && (await took())) {
          // done
        } else if (active === field && mapText(field).text !== want) {
          // 3. The DOM itself, for an editor that listens to nothing else.
          const r3 = select();
          if (r3) {
            r3.deleteContents();
            r3.insertNode(document.createTextNode(replacement));
            field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: replacement }));
          }
        }
      }
      lintSoon();
    };

    const suggestFor = async (p: Placed): Promise<string[]> => {
      if (p.alert.Suggestions?.length) return p.alert.Suggestions;
      const res = await send<SuggestResponse>({ type: "suggest", alert: p.alert, url: location.href });
      return res.suggestions ?? [];
    };

    const lintNow = async () => {
      if (!active) return;
      if (inFlight) {
        again = true;
        return;
      }
      const field = active;
      const text = textOf(field);
      if (!text.trim()) {
        spans = [];
        shown = text;
        overlay?.clear();
        return;
      }
      const hit = cache.get(text);
      if (hit) {
        show(text, hit);
        return;
      }
      inFlight = true;
      try {
        const res = await send<LintResponse>({ type: "lint", text, url: location.href });
        if (active !== field) return;
        if (res.source === "off") {
          enabled = false;
          detach();
          return;
        }
        const alerts = res.alerts ?? [];
        if (!res.error) {
          cache.set(text, alerts);
          if (cache.size > 64) cache.delete(cache.keys().next().value!);
        }
        show(text, alerts);
      } finally {
        inFlight = false;
        if (again) {
          again = false;
          void lintNow();
        }
      }
    };

    const lintSoon = () => {
      window.clearTimeout(timer);
      if (delay <= 0) void lintNow();
      else timer = window.setTimeout(() => void lintNow(), delay);
    };

    // watch redraws when the field moves or resizes without an event saying
    // so -- a preview toggled, a sidebar opened -- checking once a frame.
    const watch = () => {
      if (!active) return;
      const r = active.getBoundingClientRect();
      const box = `${r.left},${r.top},${r.width},${r.height},${active.scrollTop},${active.scrollLeft}`;
      if (box !== lastBox) {
        lastBox = box;
        redraw();
      }
      frame = window.requestAnimationFrame(watch);
    };

    const onMove = (e: MouseEvent) => {
      if (!overlay) return;
      const hit = overlay.at(e.clientX, e.clientY);
      if (active) active.style.cursor = hit ? "pointer" : "";
      if (!hover) return;
      if (hit) void overlay.show(hit, { hover: true });
      else overlay.hideSoon();
    };

    // A click on a mark opens its card; a click anywhere else closes it.
    const onClick = (e: MouseEvent) => {
      if (!overlay) return;
      const hit = overlay.at(e.clientX, e.clientY);
      if (hit) void overlay.show(hit);
      else overlay.hide();
    };
    const onOutside = (e: MouseEvent) => {
      if (!overlay?.isOpen()) return;
      const t = e.target as Node;
      if (document.getElementById("vale-overlay")?.contains(t) || active?.contains(t)) return;
      overlay.hide();
    };

    // caretOffset is where the caret is in the field's text.
    const caretOffset = (): number | null => {
      if (!active) return null;
      if (isField(active)) return active.selectionStart;
      const sel = window.getSelection();
      if (!sel?.rangeCount || !map) return null;
      return offsetAt(map, sel.focusNode!, sel.focusOffset);
    };

    // Alt+Enter opens the card of the mark the caret is in, from the
    // keyboard; Alt+Shift+Enter applies its first fix without one; Escape
    // closes an open card.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlay?.isOpen()) {
        e.preventDefault();
        overlay.close();
        return;
      }
      if (e.key !== "Enter" || !e.altKey || !overlay || !active) return;
      const at = caretOffset();
      if (at === null) return;
      const hit = place().find((p) => p.start <= at && at <= p.end && p.rects.length);
      if (!hit) return;
      e.preventDefault();
      if (e.shiftKey) {
        void suggestFor(hit).then((fixes) => {
          if (fixes.length) void apply(hit, fixes[0]!);
          else void overlay?.show(hit, { keyboard: true });
        });
        return;
      }
      if (isField(active)) {
        caret = { start: active.selectionStart ?? at, end: active.selectionEnd ?? at };
      } else {
        const sel = window.getSelection();
        caret = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      }
      void overlay.show(hit, { keyboard: true });
    };

    const restore = () => {
      if (!active) return;
      active.focus();
      if (caret && isField(active) && !(caret instanceof Range)) {
        active.setSelectionRange(caret.start, caret.end);
      } else if (caret instanceof Range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(caret);
      }
      caret = null;
    };

    const drop = (p: Placed) => {
      spans = spans.filter((s) => s.alert !== p.alert);
      redraw();
    };
    const dismiss = (p: Placed) => {
      drop(p);
      void send({ type: "dismiss", key: dismissKey(p.alert.Check, shown, p.start, p.end) });
    };
    const disable = (p: Placed) => {
      spans = spans.filter((s) => s.alert.Check !== p.alert.Check);
      redraw();
      void send({ type: "disable-rule", check: p.alert.Check });
    };
    const addWord = (p: Placed) => {
      spans = spans.filter((s) => !(s.alert.Check === p.alert.Check && s.alert.Match === p.alert.Match));
      redraw();
      void send({ type: "add-word", word: p.alert.Match ?? "" });
    };

    const attach = (el: Editable) => {
      if (active === el) return;
      detach();
      active = el;
      overlay ??= new Overlay({ apply, suggest: suggestFor, dismiss, disable, addWord, restore });
      el.addEventListener("input", onInput);
      if (!isField(el)) {
        observer = new MutationObserver(onInput);
        observer.observe(el, { characterData: true, childList: true, subtree: true });
      }
      el.addEventListener("scroll", redraw);
      el.addEventListener("mousemove", onMove as EventListener);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("click", onClick as EventListener);
      el.addEventListener("keydown", onKey as EventListener);
      document.addEventListener("mousedown", onOutside, true);
      window.addEventListener("scroll", redraw, true);
      window.addEventListener("resize", redraw);
      lastBox = "";
      frame = window.requestAnimationFrame(watch);
      keepAlive = window.setInterval(() => void send({ type: "ping" }).catch(() => {}), 20_000);
      if (live) void lintNow();
    };

    const onInput = () => {
      if (changing) return;
      changing = true;
      queueMicrotask(() => {
        changing = false;
        if (!active) return;
        const before = shown;
        // The marks move with the text; only those the edit touched go.
        follow();
        if (shown === before) return;
        overlay?.hide();
        redraw();
        if (live) lintSoon();
      });
    };
    const onLeave = () => overlay?.hideSoon();

    const detach = () => {
      window.clearTimeout(timer);
      window.clearInterval(keepAlive);
      observer?.disconnect();
      observer = null;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      if (active) {
        active.removeEventListener("input", onInput);
        active.removeEventListener("scroll", redraw);
        active.removeEventListener("mousemove", onMove as EventListener);
        active.removeEventListener("mouseleave", onLeave);
        active.removeEventListener("click", onClick as EventListener);
        active.removeEventListener("keydown", onKey as EventListener);
        active.style.cursor = "";
      }
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", redraw);
      active = null;
      spans = [];
      shown = "";
      overlay?.clear();
    };

    // consider attaches to a field the user is in. Focus is the usual sign,
    // but a field focused before this script ran -- an autofocused one --
    // never sends it, so typing or pointing in a field does too.
    const consider = async (from: EventTarget | null) => {
      const target = hostOf(from);
      if (!isEditable(target) || target === active) return;
      if (enabled === null) {
        const st = await send<StatusResponse>({ type: "status", url: location.href });
        enabled = st.enabled;
        live = st.mode !== "manual";
        delay = st.delay ?? 0;
        hover = !!st.hover;
      }
      if (enabled) attach(target);
    };
    document.addEventListener("focusin", (e) => void consider(targetOf(e)));
    for (const type of ["keydown", "input", "pointerdown"]) {
      document.addEventListener(type, (e) => void consider(targetOf(e)), true);
    }
    void consider(deepActive());

    document.addEventListener("focusout", (e) => {
      // Moving into the popover is not leaving the field.
      const to = (e as FocusEvent).relatedTarget as Node | null;
      if (to && document.getElementById("vale-overlay")?.contains(to)) return;
      window.setTimeout(() => {
        const now = deepActive();
        if (now !== active && !(active && now && active.contains(now))) detach();
      }, 200);
    });

    browser.storage.onChanged.addListener(() => {
      enabled = null;
      cache.clear();
      // A card's action changed what should be shown: check again.
      if (active && live) void lintNow();
    });

    // The popup's button or the keyboard shortcut: lint the focused field
    // now, whatever the mode.
    browser.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type !== "run") return;
      const el = deepActive();
      if (!isEditable(el)) return;
      if (active !== el) {
        enabled = true;
        attach(el);
      }
      void lintNow();
    });
  },
});
