import { diff, remap } from "./text/remap";

const marks = (text: string, ...words: string[]) =>
  words.map((w) => ({ word: w, start: text.indexOf(w), end: text.indexOf(w) + w.length }));
const read = (text: string, spans: { start: number; end: number }[]) => spans.map((s) => text.slice(s.start, s.end));

describe("diff", () => {
  it("finds the one edit between two texts", () => {
    expect(diff("abcdef", "abXYef")).toEqual({ at: 2, removed: 2, inserted: "XY" });
    expect(diff("abc", "abc")).toBeNull();
    expect(diff("abc", "abcd")).toEqual({ at: 3, removed: 0, inserted: "d" });
    expect(diff("aaa", "aa")).toEqual({ at: 2, removed: 1, inserted: "" });
  });
});

describe("remap", () => {
  const before = "We utilize it, very simply, in order to win.";
  const spans = marks(before, "utilize", "very", "in order to");

  it("shifts marks after an edit and keeps those before it", () => {
    const after = before.replace("We ", "We all ");
    expect(read(after, remap(spans, before, after))).toEqual(["utilize", "very", "in order to"]);
  });
  it("drops a mark the edit touched", () => {
    const after = before.replace("very", "truly");
    expect(read(after, remap(spans, before, after))).toEqual(["utilize", "in order to"]);
  });
  it("drops a mark whose word is being extended", () => {
    const after = before.replace("utilize", "utilizes");
    expect(read(after, remap(spans, before, after))).toEqual(["very", "in order to"]);
  });
  it("keeps marks when typing between words", () => {
    const after = before.replace(", very", ", , very");
    expect(read(after, remap(spans, before, after))).toEqual(["utilize", "very", "in order to"]);
  });
  it("drops a mark when letters are typed onto its start", () => {
    const after = before.replace("very", "xvery");
    expect(read(after, remap(spans, before, after))).toEqual(["utilize", "in order to"]);
  });
  it("handles a deletion before every mark", () => {
    const after = before.slice(3);
    expect(read(after, remap(spans, before, after))).toEqual(["utilize", "very", "in order to"]);
  });
});
