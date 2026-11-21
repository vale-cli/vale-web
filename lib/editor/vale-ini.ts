// A Vale-aware .vale.ini language for CodeMirror 6.
//
// Highlighting and grammar via a line-oriented StreamLanguage, from the CMS. Tokens are
// typed to what Vale actually means — section globs, known vs unknown keys, rule
// toggles (Style.Rule), enum values, and regex-bearing ignore keys — not generic
// "key = value". Autocomplete and diagnostics build on top of this later.
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// Keys the engine's parser recognizes (internal/core/ini.go).
export const KNOWN_KEYS = new Set([
  'StylesPath',
  'MinAlertLevel',
  'Vocab',
  'BasedOnStyles',
  'IgnoredScopes',
  'SkippedScopes',
  'IgnoredClasses',
  'BlockIgnores',
  'TokenIgnores',
  'IgnorePatterns',
  'CommentDelimiters',
  'Transform',
  'View',
  'Lang',
  'WordTemplate',
  'NLPEndpoint',
  'Packages'
]);

// Keys whose value is a regular expression (highlight the value as regex).
const REGEX_KEYS = new Set(['BlockIgnores', 'TokenIgnores', 'IgnorePatterns']);

const ENUM = new Set(['YES', 'NO', 'suggestion', 'warning', 'error', 'UNSET', 'NONE']);

interface State {
  afterEq: boolean;
  key: string;
  // inside a conditional header, `[glob if expr]`: 'if' next, then the
  // expression up to the line's last `]`
  cond: '' | 'if' | 'expr';
}

const valeIni = StreamLanguage.define<State>({
  name: 'vale-ini',
  startState: () => ({ afterEq: false, key: '', cond: '' }),
  token(stream, state) {
    if (stream.sol()) {
      state.afterEq = false;
      state.key = '';
      state.cond = '';
      if (stream.eatSpace()) return null;
    }

    // a conditional header's ` if ` and its expression; the expression may
    // hold a `]` of its own, so it runs to the line's last one
    if (state.cond === 'if' && stream.match(' if ')) {
      state.cond = 'expr';
      return 'controlKeyword';
    }
    if (state.cond === 'expr') {
      if (stream.match(/^.*(?=\]\s*$)/)) return 'meta';
      state.cond = '';
      stream.skipToEnd();
      return 'heading';
    }

    // comments — only at line start (before a value). A ';' or '#' inside a
    // value is literal: regex ignore keys legitimately contain them, e.g.
    // TokenIgnores = ({#[^\n]+})… for MDX expressions.
    if (!state.afterEq && stream.match(/^[;#].*/)) return 'lineComment';

    // section header: [*.md], [{README,CHANGELOG}.md], [formats], and a
    // conditional one, [*.md if .Meta.draft], whose glob ends at ` if `
    if (!state.afterEq && stream.match(/^\[.*?(?= if .*\]\s*$)/)) {
      state.cond = 'if';
      return 'heading';
    }
    if (!state.afterEq && stream.match(/^\[[^\]]*\]/)) return 'heading';

    // the = separator
    if (stream.peek() === '=') {
      stream.next();
      state.afterEq = true;
      return 'operator';
    }

    if (!state.afterEq) {
      // key — up to '=' (may contain dots for Style.Rule, spaces are trimmed)
      if (stream.match(/^[^\s=;#[][^=]*?(?=\s*=)/)) {
        const key = stream.current().trim();
        state.key = key;
        if (key.includes('.')) return 'propertyName'; // Style.Rule toggle
        return KNOWN_KEYS.has(key) ? 'keyword' : 'variableName'; // unknown → dimmed
      }
      stream.next();
      return null;
    }

    // value side — the whole rest of the line is the value (Vale has no inline
    // comments here, and regex values may contain ';' or '#').
    if (stream.eatSpace()) return null;
    const rest = stream.match(/^.+/);
    if (!rest) {
      stream.skipToEnd();
      return null;
    }
    const val = stream.current().trim();
    if (ENUM.has(val)) return 'atom';
    if (REGEX_KEYS.has(state.key)) return 'regexp';
    return 'string';
  }
});

// Map tags to the dedicated syntax palette (--sh-*, per theme in app.css) so
// each part of a .vale.ini reads distinctly: section globs, setting keys, on/off
// values, and inline regex all get their own hue.
const valeHighlight = HighlightStyle.define([
  { tag: t.lineComment, color: 'var(--sh-comment)', fontStyle: 'italic' },
  { tag: t.heading, color: 'var(--sh-keyword)', fontWeight: '600' },
  // keys read as *properties* (steel), distinct from section headers (rust)
  { tag: t.keyword, color: 'var(--sh-property)', fontWeight: '500' },
  { tag: t.propertyName, color: 'var(--sh-property)' },
  { tag: [t.atom, t.bool], color: 'var(--sh-constant)' },
  { tag: t.number, color: 'var(--sh-number)' },
  { tag: t.operator, color: 'var(--sh-operator)' },
  { tag: t.string, color: 'var(--sh-string)' },
  { tag: t.regexp, color: 'var(--sh-regexp)' },
  { tag: t.variableName, color: 'var(--sh-variable)' },
  // a conditional section's ` if ` and its expression
  { tag: t.controlKeyword, color: 'var(--sh-operator)', fontWeight: '600' },
  { tag: t.meta, color: 'var(--sh-variable)' }
]);

/** The Vale-INI language: grammar and highlighting, as the CMS has it. */
export const valeIniLanguage: Extension = [valeIni, syntaxHighlighting(valeHighlight)];
