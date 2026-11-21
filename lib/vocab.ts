// The words a user accepts from a card, as a Vale vocabulary.
//
// They live in the extension's own styles folder, as Vale keeps any
// vocabulary, and the configuration in use gets `Vocab = Personal` added at
// lint time, so the `.vale.ini` honors them without being edited.

export const vocabName = "Personal";

/** vocabPath is where the vocabulary's accepted words go, under a StylesPath. */
export function vocabPath(stylesPath: string): string {
  return `${stylesPath.replace(/\/+$/, "")}/config/vocabularies/${vocabName}/accept.txt`;
}

/**
 * acceptFile turns words into accept.txt. Each line of a vocabulary is a
 * pattern, so a word with a dot or a plus in it is escaped to mean itself.
 */
export function acceptFile(words: string[]): string {
  return words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\n") + "\n";
}

/**
 * withVocab adds the vocabulary to an INI's global section: onto its `Vocab`
 * key if it has one, as a new key otherwise. Sections are left alone, since a
 * global vocabulary already reaches them.
 */
export function withVocab(ini: string, name = vocabName): string {
  const lines = ini.split("\n");
  let end = lines.findIndex((l) => /^\s*\[/.test(l));
  if (end < 0) end = lines.length;
  for (let i = 0; i < end; i++) {
    const m = /^(\s*Vocab\s*=\s*)(.*)$/i.exec(lines[i]!);
    if (!m) continue;
    const names = m[2]!.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.includes(name)) return ini;
    lines[i] = `${m[1]}${[...names, name].join(", ")}`;
    return lines.join("\n");
  }
  lines.splice(end, 0, `Vocab = ${name}`);
  return lines.join("\n");
}
