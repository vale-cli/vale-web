# Store listing

Everything the Chrome Web Store and Firefox Add-ons forms ask for, in the
order they ask. Screenshots are the one thing not in this folder: see the shot
list at the end.

## Name

Vale

## Short description

Chrome (132 characters max):

> Your style guide, applied as you type, on any site. Bring your own Vale config and styles; it all runs inside your browser.

Firefox summary (250 characters max):

> Vale underlines style issues as you type and offers the fix. One configuration works on every site you turn on: the built-in style, packages from the Vale library, or your own house style uploaded as a .zip. Everything runs in your browser.

## Description

Plain text: Chrome and Edge don't render Markdown. Firefox takes the same.

```text
Vale is the prose linter that documentation teams at AWS, NVIDIA, Microsoft, GitLab, and Red Hat use to enforce a style guide in CI. This extension brings the same checks to the places you write in a browser.

WHAT IT DOES

• Underlines each alert as you type, with no wait, in text areas, inputs, frames, and rich editors (ProseMirror, TipTap, Lexical, Slate, Quill, CKEditor) on the sites you turn it on for.
• Opens a card on a click, or with Alt+Enter at the cursor: the alert, its fixes one click away, and Dismiss, Turn off the rule, or Add to vocabulary. Alt+Shift+Enter applies the first fix without opening the card.
• Uses one configuration everywhere: a .vale.ini, packages from the Vale package library, and your own house style uploaded as a .zip. The built-in style works with no setup at all.
• Keeps what you've told it from the cards (words added, rules turned off, alerts dismissed) in one place, the Yours tab, where any of it can be undone.
• Runs on demand instead, if you'd rather: turn off "Check as you type" and check the focused field from the toolbar or with Alt+Shift+V.
• Follows your system's light or dark theme.

WHAT IT DOESN'T DO

• Send your text anywhere. Vale runs inside the extension, so checking happens in your browser. The only network requests download packages from the Vale package library or a package URL you add.
• Collect anything. There is no account, no analytics, and no telemetry.

Privacy policy: https://vale.sh/privacy/extension
Vale is open source under the MIT license: https://vale.sh
```

## Category

Chrome: Developer Tools. Firefox: Language Support, or Other.

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

All three stores take 1280×800 PNGs, so one set serves them. These are shot
at 2× and scaled to exactly 1280×800; Chrome rejects any other size.

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
