// Keeping marks where their text is while the text changes.
//
// A result arrives some time after the text it was made for, and the text
// goes on changing in the meantime. Rather than clear the marks on every
// keystroke and wait for the next result, each mark is moved with the edit:
// one before it stays, one after it shifts, and one the edit touches is
// dropped, since what it pointed at is gone.

/** An edit: `removed` code units at `at` were replaced by `inserted`, the new text. */
export type Edit = { at: number; removed: number; inserted: string };

/** diff returns the single edit that turns before into after. */
export function diff(before: string, after: string): Edit | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let tail = 0;
  while (
    tail < max - start &&
    before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)
  ) {
    tail++;
  }
  return { at: start, removed: before.length - start - tail, inserted: after.slice(start, after.length - tail) };
}

const wordChar = /[\p{L}\p{N}_'’-]/u;

/** shift moves [start, end) across an edit, or returns null if the edit touched it. */
export function shift(start: number, end: number, edit: Edit): [number, number] | null {
  const editEnd = edit.at + edit.removed;
  const pure = edit.removed === 0 && edit.inserted.length > 0;
  if (end <= edit.at) {
    // Letters typed onto the end of a marked word change the word.
    if (pure && end === edit.at && wordChar.test(edit.inserted[0]!)) return null;
    return [start, end];
  }
  if (start >= editEnd) {
    if (pure && start === editEnd && wordChar.test(edit.inserted[edit.inserted.length - 1]!)) return null;
    const by = edit.inserted.length - edit.removed;
    return [start + by, end + by];
  }
  return null;
}

/** remap moves every span from the text `before` to the text `after`. */
export function remap<T extends { start: number; end: number }>(spans: T[], before: string, after: string): T[] {
  const edit = diff(before, after);
  if (!edit) return spans;
  const out: T[] = [];
  for (const s of spans) {
    const moved = shift(s.start, s.end, edit);
    if (moved) out.push({ ...s, start: moved[0], end: moved[1] });
  }
  return out;
}
