<script lang="ts">
  // The CMS's editor, without its appearance and completion wiring.
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
  import { EditorState, type Extension } from "@codemirror/state";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { onDestroy, onMount } from "svelte";

  let {
    value = "",
    language,
    onChange,
    readOnly = false,
  }: { value?: string; language?: Extension; onChange?: (v: string) => void; readOnly?: boolean } = $props();

  let el = $state<HTMLDivElement>();
  let view: EditorView | undefined;

  const theme = EditorView.theme({
    "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
    ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", lineHeight: "1.6" },
    ".cm-content": { padding: "10px 0" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--muted) 40%, transparent)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in oklab, var(--primary) 25%, transparent)" },
    "&.cm-focused": { outline: "none" },
  });

  onMount(() => {
    view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          theme,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          language ?? [],
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange?.(u.state.doc.toString());
          }),
        ],
      }),
    });
  });

  onDestroy(() => view?.destroy());

  // Push an outside change in as the minimal differing span, so the caret
  // stays where it was.
  $effect(() => {
    const v = value;
    if (!view) return;
    const old = view.state.doc.toString();
    if (v === old) return;
    let from = 0;
    while (from < old.length && from < v.length && old[from] === v[from]) from++;
    let to = old.length;
    let vEnd = v.length;
    while (to > from && vEnd > from && old[to - 1] === v[vEnd - 1]) {
      to--;
      vEnd--;
    }
    view.dispatch({ changes: { from, to, insert: v.slice(from, vEnd) } });
  });
</script>

<div bind:this={el} class="h-full min-h-0"></div>
