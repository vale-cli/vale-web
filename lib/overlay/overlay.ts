// Underlines drawn over an editable, and the popover that explains one.
import type { ValeAlert } from "../engine";

export type Placed = { alert: ValeAlert; rects: DOMRect[]; start: number; end: number };

/** What a card can do besides applying a suggestion. */
export type CardActions = {
  apply: (p: Placed, replacement: string) => void;
  suggest: (p: Placed) => Promise<string[]>;
  dismiss: (p: Placed) => void;
  disable: (p: Placed) => void;
  // Offered only for a spelling alert; see canAddWord.
  addWord: (p: Placed) => void;
  // Called when the card closes from the keyboard, to put the caret back.
  restore: () => void;
};

/** canAddWord reports whether an alert is about a word the user could accept. */
export function canAddWord(a: ValeAlert): boolean {
  return /Spelling/.test(a.Check) && !!a.Match && !/\s/.test(a.Match);
}

// The CMS's severity colors, which hold on light and dark pages.
const colors: Record<string, string> = {
  error: "#e54d2e",
  warning: "#c47f00",
  suggestion: "#2f81f7",
};

// The card's colors, for a light page and a dark one, following the system.
const light = { bg: "#fbfaf6", fg: "#2b2a25", border: "#ddd9cf", rule: "#e6e2d8", muted: "#8a877c", tool: "#5c5a52", chip: "#efede6", link: "#2f6fd6" };
const dark = { bg: "#262624", fg: "#e8e6dc", border: "#3f3e39", rule: "#3a3934", muted: "#9c998e", tool: "#b8b5aa", chip: "#33322e", link: "#7fb2ff" };
const palette = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light);

export class Overlay {
  private root: HTMLDivElement;
  private marks: HTMLDivElement;
  private pop: HTMLDivElement;
  private placed: Placed[] = [];
  private hideTimer: number | undefined;
  private actions: CardActions;
  // The alert the card is showing, and whether it was opened from the
  // keyboard: then focus is in the card and Esc puts it back.
  private current: Placed | null = null;
  private keyboard = false;
  // A card opened by pointing at a mark closes when the pointer leaves; one
  // opened by a click stays until a click elsewhere or Escape.
  private hovered = false;

  constructor(actions: CardActions) {
    this.actions = actions;
    this.root = document.createElement("div");
    this.root.id = "vale-overlay";
    Object.assign(this.root.style, {
      position: "absolute", top: "0", left: "0", width: "0", height: "0",
      pointerEvents: "none", zIndex: "2147483646",
    });
    this.marks = document.createElement("div");
    this.pop = document.createElement("div");
    Object.assign(this.pop.style, {
      position: "absolute", display: "none", pointerEvents: "auto", minWidth: "220px", maxWidth: "360px",
      borderRadius: "8px",
      boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 8px 24px rgba(0,0,0,.08)", padding: "10px 12px",
      font: "13px/1.45 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    });
    this.pop.setAttribute("role", "dialog");
    this.pop.setAttribute("aria-label", "Vale alert");
    this.pop.addEventListener("mousedown", (e) => e.preventDefault());
    this.pop.addEventListener("keydown", (e) => this.onKey(e));
    this.pop.addEventListener("mouseenter", () => this.cancelHide());
    this.pop.addEventListener("mouseleave", () => {
      if (this.hovered) this.hideSoon();
    });
    this.root.append(this.marks, this.pop);
    // On <html>, not <body>: in a framed editor the body is the editable,
    // and the card would become part of the text being checked.
    document.documentElement.appendChild(this.root);
  }

  /** draw replaces the underlines with those for placed alerts. */
  draw(placed: Placed[]): void {
    this.placed = placed;
    this.marks.replaceChildren();
    const sx = window.scrollX;
    const sy = window.scrollY;
    for (const p of placed) {
      for (const r of p.rects) {
        const u = document.createElement("div");
        u.dataset.check = p.alert.Check;
        Object.assign(u.style, {
          position: "absolute", left: `${r.left + sx}px`, top: `${r.bottom + sy - 2}px`,
          width: `${Math.max(r.width, 2)}px`, height: "2px",
          background: colors[p.alert.Severity] ?? colors.suggestion,
          borderRadius: "1px",
        });
        this.marks.appendChild(u);
      }
    }
  }

  clear(): void {
    this.placed = [];
    this.marks.replaceChildren();
    this.hide();
  }

  /** at returns the placed alert under a viewport point, if any. */
  at(x: number, y: number): Placed | null {
    for (const p of this.placed) {
      for (const r of p.rects) {
        if (x >= r.left && x <= r.right && y >= r.top - 2 && y <= r.bottom + 4) return p;
      }
    }
    return null;
  }

  /** isOpen reports whether the card is showing. */
  isOpen(): boolean {
    return this.pop.style.display !== "none";
  }

  /**
   * show opens the card for p. From the keyboard, focus moves into it so the
   * arrow keys walk its buttons; from the mouse, it stays in the field.
   */
  async show(p: Placed, opts: { keyboard?: boolean; hover?: boolean } = {}): Promise<void> {
    this.cancelHide();
    const a = p.alert;
    const rect = p.rects[0];
    if (!rect) return;
    if (this.current === p && this.isOpen()) {
      // Clicking a mark its pointer already opened keeps the card open.
      if (!opts.hover) this.hovered = false;
      if (!opts.keyboard) return;
    }
    this.current = p;
    this.keyboard = !!opts.keyboard;
    this.hovered = !!opts.hover;
    this.pop.replaceChildren();
    const c = palette();
    Object.assign(this.pop.style, { background: c.bg, color: c.fg, border: `1px solid ${c.border}` });

    const head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:baseline;margin-bottom:4px";
    const sev = document.createElement("span");
    sev.textContent = a.Severity;
    sev.style.cssText = `font-size:11px;font-weight:600;text-transform:uppercase;color:${colors[a.Severity] ?? colors.suggestion}`;
    const rule = document.createElement("span");
    rule.textContent = a.Check;
    rule.style.cssText = `font-size:11px;color:${c.muted};font-family:ui-monospace,Menlo,monospace`;
    head.append(sev, rule);
    const msg = document.createElement("div");
    msg.textContent = a.Message;
    this.pop.append(head, msg);
    if (a.Link) {
      const link = document.createElement("a");
      link.href = a.Link;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "More about this rule";
      link.style.cssText = `display:inline-block;margin-top:4px;font-size:12px;color:${c.link}`;
      this.pop.appendChild(link);
    }

    const fixes = document.createElement("div");
    fixes.setAttribute("role", "group");
    fixes.setAttribute("aria-label", "Suggestions");
    fixes.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px";
    const tools = document.createElement("div");
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Actions");
    tools.style.cssText = `display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:8px;padding-top:7px;border-top:1px solid ${c.rule}`;
    const tool = (label: string, run: () => void) => {
      const b = this.button(label, run);
      b.style.cssText = `font:inherit;font-size:12px;text-align:left;padding:2px 4px;margin-left:-4px;border:0;border-radius:4px;background:none;color:${c.tool};cursor:pointer`;
      tools.appendChild(b);
    };
    tool("Dismiss", () => this.actions.dismiss(p));
    if (canAddWord(a)) tool(`Add “${a.Match}” to vocabulary`, () => this.actions.addWord(p));
    tool(`Turn off ${a.Check}`, () => this.actions.disable(p));
    this.pop.append(fixes, tools);
    this.place(rect);
    // Focus moves in at once, so a key pressed before the suggestions arrive
    // walks the card and not the field.
    const first = this.buttons()[0];
    if (this.keyboard) first?.focus();

    const suggestions = await this.actions.suggest(p).catch(() => []);
    if (this.current !== p || !this.isOpen()) return;
    for (const s of suggestions) {
      const b = this.button(s === "" ? "Remove" : s, () => this.actions.apply(p, s));
      b.style.cssText = `font:inherit;font-weight:500;padding:3px 10px;border:1px solid ${c.border};border-radius:6px;background:${c.chip};color:${c.fg};cursor:pointer`;
      fixes.appendChild(b);
    }
    if (!suggestions.length) fixes.remove();
    this.place(rect);
    // The best fix goes first, unless the user has already moved on.
    if (this.keyboard && document.activeElement === first) this.buttons()[0]?.focus();
  }

  // button makes one of the card's buttons. A click must not take focus from
  // the field: on macOS a button doesn't take it, and the field would read
  // that as leaving.
  private button(label: string, run: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const keyboard = this.keyboard;
      this.hide();
      run();
      if (keyboard) this.actions.restore();
    });
    b.addEventListener("focus", () => (b.style.outline = "2px solid #2f81f7"));
    b.addEventListener("blur", () => (b.style.outline = ""));
    return b;
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.pop.querySelectorAll("button"));
  }

  // onKey walks the card's buttons with the arrow keys; Enter and Space are
  // the buttons' own, and Escape closes the card.
  private onKey(e: KeyboardEvent): void {
    const all = this.buttons();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const move = (by: number) => {
      e.preventDefault();
      all[(at + by + all.length) % all.length]?.focus();
    };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") move(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") move(-1);
    else if (e.key === "Home") move(-at);
    else if (e.key === "End") move(all.length - 1 - at);
    else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  }

  /** close hides the card and, if it was opened from the keyboard, returns there. */
  close(): void {
    const keyboard = this.keyboard;
    this.hide();
    if (keyboard) this.actions.restore();
  }

  // place puts the card under the mark, or above it when there's no room
  // below, and keeps it inside the viewport.
  private place(rect: DOMRect): void {
    this.pop.style.display = "block";
    const w = this.pop.offsetWidth;
    const h = this.pop.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    const below = rect.bottom + 6 + h <= window.innerHeight || rect.top - 6 - h < 0;
    const top = below ? rect.bottom + 6 : rect.top - 6 - h;
    this.pop.style.left = `${left + window.scrollX}px`;
    this.pop.style.top = `${top + window.scrollY}px`;
  }

  /** hideSoon closes a card the pointer opened, after a moment. */
  hideSoon(): void {
    if (!this.hovered) return;
    this.cancelHide();
    this.hideTimer = window.setTimeout(() => this.hide(), 250);
  }

  cancelHide(): void {
    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
  }

  hide(): void {
    this.pop.style.display = "none";
    this.current = null;
    this.keyboard = false;
    this.hovered = false;
  }

  destroy(): void {
    this.root.remove();
  }
}
