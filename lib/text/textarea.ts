// Where a span of a textarea's or a text input's value is on screen. Neither
// gives geometry for its text, so a mirror with the same styles is laid over
// it, marked at the spans, and asked where the marks landed.

/** A field whose text is its value. */
export type Field = HTMLTextAreaElement | HTMLInputElement;

const copied = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "fontStretch",
  "letterSpacing", "wordSpacing", "lineHeight", "textTransform", "textIndent", "textAlign",
  "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "boxSizing", "direction",
] as const;

let mirror: HTMLDivElement | null = null;

function mirrorFor(ta: Field): HTMLDivElement {
  mirror ??= document.createElement("div");
  const m = mirror;
  const cs = getComputedStyle(ta);
  for (const p of copied) m.style[p] = cs[p];
  const r = ta.getBoundingClientRect();
  Object.assign(m.style, {
    position: "fixed",
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordWrap: "break-word",
    borderStyle: "solid",
    borderColor: "transparent",
    visibility: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
    margin: "0",
  } as Partial<CSSStyleDeclaration>);
  if (ta instanceof HTMLInputElement) {
    // One line, never wrapped, and centered the way an input centers it.
    const inner = ta.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    Object.assign(m.style, { whiteSpace: "pre", overflowWrap: "normal", wordWrap: "normal", lineHeight: `${inner}px` });
  }
  if (!m.isConnected) document.body.appendChild(m);
  return m;
}

/** measure returns, for each [start, end) span of the textarea's value, its on-screen rects. */
export function measure(ta: Field, spans: [number, number][]): DOMRect[][] {
  const m = mirrorFor(ta);
  m.replaceChildren();
  const value = ta.value;
  const cuts = [...new Set(spans.flat().concat(0, value.length))].sort((a, b) => a - b);
  const marks: HTMLSpanElement[][] = spans.map(() => []);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    const piece = document.createElement("span");
    piece.textContent = value.slice(a, b);
    m.appendChild(piece);
    spans.forEach((s, k) => {
      if (a >= s[0] && b <= s[1]) marks[k]!.push(piece);
    });
  }
  // Keep a trailing line break visible to the layout.
  m.appendChild(document.createTextNode("​"));
  m.scrollTop = ta.scrollTop;
  m.scrollLeft = ta.scrollLeft;

  const box = m.getBoundingClientRect();
  const out = marks.map((pieces) => {
    const rects: DOMRect[] = [];
    for (const p of pieces) {
      for (const r of Array.from(p.getClientRects())) {
        // What is scrolled out of the field is not on screen.
        if (r.bottom <= box.top || r.top >= box.bottom) continue;
        if (r.right <= box.left || r.left >= box.right) continue;
        rects.push(r);
      }
    }
    return rects;
  });
  m.replaceChildren();
  return out;
}
