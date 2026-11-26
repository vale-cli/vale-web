// The engine reports an error the way the CLI prints it: colored for a
// terminal, with a line about its exit code.

const ansi = /\u001b\[[0-9;]*m/g;
const trailer = /\s*Execution stopped with code \d+\.\s*$/;

/** plain is an engine error as text a page can show. */
export function plain(message: string): string {
  return message.replace(ansi, "").replace(trailer, "").trim();
}
