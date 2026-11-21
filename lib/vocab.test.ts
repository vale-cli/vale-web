import { acceptFile, vocabPath, withVocab } from "./vocab";
import { dismissKey } from "./settings";

describe("withVocab", () => {
  it("adds a Vocab key to the global section", () => {
    const ini = "StylesPath = styles\nMinAlertLevel = suggestion\n\n[*]\nBasedOnStyles = Vale\n";
    expect(withVocab(ini)).toBe("StylesPath = styles\nMinAlertLevel = suggestion\n\nVocab = Personal\n[*]\nBasedOnStyles = Vale\n");
  });
  it("appends to an existing Vocab key", () => {
    expect(withVocab("Vocab = Base, Docs\n[*]\n")).toBe("Vocab = Base, Docs, Personal\n[*]\n");
  });
  it("leaves a key that already names it", () => {
    const ini = "Vocab = Personal\n[*]\n";
    expect(withVocab(ini)).toBe(ini);
  });
  it("ignores a Vocab inside a section", () => {
    expect(withVocab("StylesPath = s\n[*.md]\nVocab = Docs\n")).toBe("StylesPath = s\nVocab = Personal\n[*.md]\nVocab = Docs\n");
  });
  it("handles an INI with no sections", () => {
    expect(withVocab("StylesPath = s")).toBe("StylesPath = s\nVocab = Personal");
  });
});

describe("acceptFile", () => {
  it("escapes what a pattern would read as special", () => {
    expect(acceptFile(["Vale", "C++", "vale.sh"])).toBe("Vale\nC\\+\\+\nvale\\.sh\n");
  });
  it("places the vocabulary under the StylesPath", () => {
    expect(vocabPath("/styles/")).toBe("/styles/config/vocabularies/Personal/accept.txt");
  });
});

describe("dismissKey", () => {
  const text = "We will use it, really. More words follow here, and then more.";
  const at = text.indexOf("really");
  const key = dismissKey("Demo.Hedging", text, at, at + 6);
  it("survives typing away from the alert", () => {
    const longer = text + " And a new sentence.";
    expect(dismissKey("Demo.Hedging", longer, at, at + 6)).toBe(key);
  });
  it("survives typing a sentence after the next word", () => {
    const short = "Use it, really. Ok.";
    const i = short.indexOf("really");
    expect(dismissKey("Demo.Hedging", short + " Yes.", i, i + 6)).toBe(dismissKey("Demo.Hedging", short, i, i + 6));
  });
  it("lapses when the words around it change", () => {
    const edited = text.replace("use it", "use that");
    const moved = edited.indexOf("really");
    expect(dismissKey("Demo.Hedging", edited, moved, moved + 6)).not.toBe(key);
  });
});
