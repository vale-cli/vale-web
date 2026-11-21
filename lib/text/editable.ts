// A contenteditable's text, and the way back from an offset in it to the DOM.

export type TextMap = {
  text: string;
  // Each text node and where its content sits in `text`.
  nodes: { node: Text; start: number; end: number }[];
};

const blockTags = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "TR", "TD", "TH", "SECTION", "ARTICLE", "UL", "OL", "TABLE"]);

/** mapText walks root's text nodes, reading a block boundary or `<br>` as a line break. */
export function mapText(root: Node): TextMap {
  const nodes: TextMap["nodes"] = [];
  let text = "";
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      nodes.push({ node: t, start: text.length, end: text.length + t.data.length });
      text += t.data;
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    // The extension's own marks and card are never the text.
    if (el.id === "vale-overlay") return;
    if (el.tagName === "BR") {
      text += "\n";
      return;
    }
    const block = blockTags.has(el.tagName);
    if (block && text.length > 0 && !text.endsWith("\n")) text += "\n";
    for (const child of Array.from(el.childNodes)) walk(child);
    if (block && !text.endsWith("\n")) text += "\n";
  };
  walk(root);
  return { text, nodes };
}

/** rangeOf returns a DOM Range covering [start, end) of the mapped text. */
export function rangeOf(map: TextMap, start: number, end: number): Range | null {
  const at = (offset: number, preferEnd: boolean) => {
    for (const n of map.nodes) {
      if (offset >= n.start && (offset < n.end || (preferEnd && offset === n.end))) {
        return { node: n.node, offset: offset - n.start };
      }
    }
    return null;
  };
  const a = at(start, false);
  const b = at(end, true);
  if (!a || !b) return null;
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}

/** offsetAt returns where a DOM position falls in the mapped text, or null. */
export function offsetAt(map: TextMap, node: Node, offset: number): number | null {
  for (const n of map.nodes) {
    if (n.node === node) return n.start + Math.min(offset, n.end - n.start);
  }
  // A position between elements: the start of the next text node after it.
  const child = node.childNodes[offset] ?? null;
  const after = child ?? node.nextSibling;
  if (!after) return null;
  for (const n of map.nodes) {
    if (after === n.node || after.contains(n.node)) return n.start;
  }
  return null;
}
