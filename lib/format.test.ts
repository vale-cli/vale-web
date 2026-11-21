import { fileFormat, formatFor } from "./format";

describe("fileFormat", () => {
  it("reads the format from a GitHub web editor's file", () => {
    expect(fileFormat("https://github.com/vale-cli/vale/edit/main/docs/install.rst")).toBe("rst");
    expect(fileFormat("https://github.com/vale-cli/vale/edit/v3/README.adoc")).toBe("adoc");
    expect(fileFormat("https://github.com/vale-cli/vale/new/main/docs/guide.asciidoc")).toBe("adoc");
    expect(fileFormat("https://github.com/vale-cli/vale/edit/main/CHANGES.MD")).toBe("md");
  });

  it("reads it from a GitLab web editor's file", () => {
    expect(fileFormat("https://gitlab.com/group/sub/project/-/edit/main/doc/index.rst")).toBe("rst");
    expect(fileFormat("https://gitlab.com/g/p/-/new/main/notes.adoc")).toBe("adoc");
  });

  it("leaves everything else to the site", () => {
    // Viewing a file, not editing it: its comments are the site's format.
    expect(fileFormat("https://github.com/vale-cli/vale/blob/main/docs/install.rst")).toBeNull();
    expect(fileFormat("https://github.com/vale-cli/vale/pull/12")).toBeNull();
    expect(fileFormat("https://github.com/vale-cli/vale/edit/main/Makefile")).toBeNull();
    expect(fileFormat("https://github.com/vale-cli/vale/edit/main/main.go")).toBeNull();
    expect(fileFormat("https://example.com/edit/a/b/c.rst")).toBeNull();
    expect(fileFormat("not a url")).toBeNull();
  });
});

describe("formatFor", () => {
  it("prefers the file's format, then the site's", () => {
    expect(formatFor("https://github.com/o/r/edit/main/a.rst", "md")).toBe("rst");
    expect(formatFor("https://github.com/o/r/issues/1", "md")).toBe("md");
  });
});
