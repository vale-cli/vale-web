# Store listing

Everything the Chrome Web Store and Firefox Add-ons forms ask for, in the
order they ask. Screenshots are the one thing not in this folder: see the shot
list at the end.

## Name

Style Guide & Spell Checker - Vale

## Short description

Chrome (132 characters max):

> Check your writing against your style guide as you type, on any site. Private: your text never leaves your browser.

Firefox summary (250 characters max):

> Check your writing against your style guide as you type, on any site. Use the Microsoft or Google style guide, or your team's own. Private: your text never leaves your browser.

## Description

Plain text: Chrome and Edge don't render Markdown. Firefox takes the same.

```text
Vale checks your writing against a style guide as you type: in comment boxes, issues, pull requests, email, and anywhere else you write in a browser. It's the same prose linter documentation teams run in CI, and it runs entirely on your device.

WHAT IT CHECKS

Spelling, word choice, terminology, capitalization, wordiness, and whatever else your style guide says. Start with the built-in style, add a published one such as the Microsoft or Google style guide, or upload your team's own house style.

HOW IT WORKS

• Underlines issues as you type, on the sites you turn it on for. GitHub and GitLab are on from the start.
• Click an underline, or press Alt+Enter, to see the fix and apply it in one click. You can also dismiss the issue, turn the rule off, or add the word to your vocabulary.
• Checks Markdown, AsciiDoc, reStructuredText, HTML, and plain text. When you edit a file on GitHub or GitLab, it reads the file's format from its name.
• Keeps the words you've added, rules you've turned off, and issues you've dismissed in one list, where any of it can be undone.
• Checks on demand if you'd rather: turn off checking as you type, and check a field from the toolbar or with Alt+Shift+V.

PRIVATE BY DESIGN

Your text never leaves your browser. There is no account, no analytics, and no telemetry. The only downloads are the style guides you choose.

Privacy policy: https://vale.sh/privacy/extension
Free and open source under the MIT license: https://vale.sh
```

## Support and homepage

- Support: https://github.com/vale-cli/vale-web/issues
- Homepage: https://vale.sh/#browser
- Source: https://github.com/vale-cli/vale-web

## Category

Chrome: Communication. Firefox: Language Support.

## Single purpose (Chrome)

> Checks the text a user writes in a web page's editable fields against their Vale style configuration and shows the alerts in place.

## Permission justifications (Chrome)

| Permission | Justification |
| --- | --- |
| `storage`, `unlimitedStorage` | Stores the user's Vale configuration and the style packages it names. A package is a ZIP archive of a few megabytes, which exceeds the default storage quota. |
| `activeTab` | The popup reads the current tab's URL to turn linting on or off for that site. |
| Host permission `github.com`, `raw.githubusercontent.com` | Fetches style packages published as GitHub releases, which is where the Vale package library lives. |
| Optional host permission `https://*/*` | A package hosted anywhere else is fetched only after the user adds its URL and grants its origin when asked. |
| Content script on all URLs | Finds the field the user is typing in and draws the underlines over it. On a site the user hasn't turned on, the script makes one request to read that setting and otherwise does nothing. Linting is opt-in per site; GitHub and GitLab are on by default. |
| `commands` | The keyboard shortcut that checks the focused field in on-demand mode. |

Remote code: none. The WebAssembly module is packaged with the extension and
is not fetched or updated at runtime.

## Privacy practices (Chrome data-usage form)

The extension does not collect or transmit user data. Every box in the data
usage form is unchecked. Certify all three statements: no sale of data, no use
beyond the single purpose, no use for creditworthiness or lending.

## Data collection (Firefox)

`data_collection_permissions: { required: ["none"] }` is declared in the
manifest. In the listing, state that no data is collected or transmitted.

## Privacy policy

https://vale.sh/privacy/extension, for both stores. Keep it in step with what
the extension stores and fetches.

## Screenshots

All three stores take 1280×800 PNGs, so one set serves them. Each page is
shot at 2× inside a drawn browser window, under a one-line headline, and
scaled to exactly 1280×800; Chrome rejects any other size.

Taken, in `screenshots/`, by `scripts/screenshots/shoot.mjs` against the
production build (`pnpm build` first):

1. `1-as-you-type.png`: a comment box with marks of three severities and the
   card open on one, with its fix. The lead image.
2. `2-keyboard.png`: a spelling card opened with Alt+Enter: suggestions,
   Dismiss, Add to vocabulary, Turn off.
3. `3-popup.png`: the popup over the page it's for: the site switch, the mode
   switch, and the check-now button.
4. `4-options.png`: the configuration beside the rules it resolves to.
5. `5-yours.png`: the Yours tab: options, vocabulary, a rule turned off, and
   a dismissed alert.

The script fetches the Microsoft package from its latest release for shots 4
and 5, so it needs the network.

Promotional images: `tile-small-440x280.png` and `tile-marquee-1400x560.png`,
rendered from `src/`. Chrome and Edge both take them; Firefox has no tiles.

## Promo video

https://youtu.be/YQrxtA9POno, for Chrome's and Edge's video field; Firefox
has none. Made in the vale.sh repository's `video/` (`ExtensionPromo`, and
`ExtensionThumb` for its thumbnail).

## Icons

`icon-128.png` is the Chrome and Firefox store icon: the 512 drawn at 96×96 with
16px of clear space around it, as Chrome's image guidelines ask; `icon-512.png` is the
Edge logo. The extension's own icons are in
`public/icon/`, 16 through 128, rendered from `src/icon.svg`.

## Edge

Edge Add-ons takes the Chrome package (`pnpm zip`) and the same text,
screenshots, and tiles.

## Firefox

Build with `pnpm zip:firefox`. Add-ons asks for the source of any generated
code, and `vale.wasm` is compiled from Go: upload `pnpm zip:firefox`'s sources
archive, and give the Vale release or commit `task wasm` built it from.
