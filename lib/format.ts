// What the text in a field is written in, as Vale names it.

/** The formats the engine reads natively, for the options page. */
export const formats = [
  { id: "md", label: "Markdown" },
  { id: "adoc", label: "AsciiDoc" },
  { id: "rst", label: "reStructuredText" },
  { id: "html", label: "HTML" },
  { id: "txt", label: "Plain text" },
] as const;

const byExtension: Record<string, string> = {
  md: "md",
  markdown: "md",
  adoc: "adoc",
  asciidoc: "adoc",
  asc: "adoc",
  rst: "rst",
  html: "html",
  htm: "html",
  txt: "txt",
};

/**
 * fileFormat is the format of the file a page edits, when it is a GitHub or
 * GitLab web editor: `github.com/o/r/edit/main/docs/install.rst` is `rst`.
 */
export function fileFormat(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  let editing = false;
  if (host === "github.com") editing = parts[2] === "edit" || parts[2] === "new";
  else if (host === "gitlab.com") {
    const dash = parts.indexOf("-");
    editing = dash >= 0 && (parts[dash + 1] === "edit" || parts[dash + 1] === "new");
  }
  if (!editing) return null;
  const name = decodeURIComponent(parts[parts.length - 1] ?? "");
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return byExtension[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** formatFor is the file's format in a web editor, and the site's otherwise. */
export function formatFor(url: string, siteFormat: string): string {
  return fileFormat(url) ?? siteFormat;
}
