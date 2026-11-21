import { offsetsOf } from "./text/positions";

describe("offsetsOf", () => {
  it("maps a 1-based inclusive span to code-unit offsets", () => {
    const text = "This is very good.\nAlso very fine.\n";
    expect(offsetsOf(text, 1, [9, 12])).toEqual([8, 12]);
    expect(offsetsOf(text, 2, [6, 9])).toEqual([24, 28]);
    expect(text.slice(24, 28)).toBe("very");
  });
  it("counts an astral character as one column", () => {
    const text = "😀 very good";
    const o = offsetsOf(text, 1, [3, 6])!;
    expect(text.slice(o[0], o[1])).toBe("very");
  });
  it("rejects a line or span off the text", () => {
    expect(offsetsOf("a\n", 3, [1, 1])).toBeNull();
    expect(offsetsOf("ab", 1, [2, 9])).toBeNull();
  });
});
