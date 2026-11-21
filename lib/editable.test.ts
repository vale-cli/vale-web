import { mapText, offsetAt, rangeOf } from "./text/editable";

describe("mapText", () => {
  it("reads blocks and breaks as line breaks and maps offsets back", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>This is <b>very</b> good.</p><p>Also<br>very fine.</p>";
    const m = mapText(root);
    expect(m.text).toBe("This is very good.\nAlso\nvery fine.\n");
    const r = rangeOf(m, 8, 12)!;
    expect(r.toString()).toBe("very");
    const r2 = rangeOf(m, 24, 28)!;
    expect(r2.toString()).toBe("very");
  });
});

describe("offsetAt", () => {
  it("maps a caret in a text node back to the mapped text", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>This is <b>very</b> good.</p><p>Also fine.</p>";
    const m = mapText(root);
    const bold = root.querySelector("b")!.firstChild!;
    expect(offsetAt(m, bold, 2)).toBe(10);
    expect(m.text.slice(offsetAt(m, bold, 0)!, 12)).toBe("very");
    const second = root.querySelectorAll("p")[1]!;
    expect(offsetAt(m, second, 0)).toBe(m.text.indexOf("Also"));
  });
});
