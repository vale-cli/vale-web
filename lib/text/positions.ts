// Vale reports a position as a 1-based line and a 1-based, inclusive span of
// characters on it. JavaScript indexes strings by UTF-16 code unit, so a
// character beyond the basic plane takes two.

/** offsetsOf returns the [start, end) code-unit offsets of an alert in text. */
export function offsetsOf(text: string, line: number, span: [number, number]): [number, number] | null {
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return null;
  let base = 0;
  for (let i = 0; i < line - 1; i++) base += lines[i]!.length + 1;
  const row = lines[line - 1]!;
  const start = unitIndex(row, span[0] - 1);
  const end = unitIndex(row, span[1]);
  if (start === null || end === null || start > end) return null;
  return [base + start, base + end];
}

// unitIndex maps a code-point index in s to a code-unit index.
function unitIndex(s: string, cp: number): number | null {
  let units = 0;
  let points = 0;
  while (points < cp) {
    if (units >= s.length) return cp === points ? units : null;
    const code = s.codePointAt(units)!;
    units += code > 0xffff ? 2 : 1;
    points++;
  }
  return units;
}
