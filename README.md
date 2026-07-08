# note

`<nostr-note>` — a single nostr note card, plus the shared rendering helpers
other components build on. **No build step.** One file: [`note.js`](note.js).

Part of [nostr-client](https://github.com/nostr-client) — a modular, composable
nostr client where each repo does one thing.

**Live demo:** https://nostr-client.github.io/note/

## Use

```html
<script type="module" src="https://nostr-client.github.io/note/note.js"></script>

<nostr-note event-id="<64-char hex>"></nostr-note>  <!-- fetches from the pool -->
```

```js
el.event = someNostrEvent      // or render an event you already have
```

Attributes: `clickable` (dispatches `nostr:note-click` with `{ event }`),
`highlight` (accent border — used by thread for the focused note),
`flat` (hairline row instead of a card — for bluesky/mastodon-style timelines).
Cards show `@handles` (nip05 or short npub) once profiles resolve, and content
is rich: `nostr:` mentions, quoted notes, clickable #hashtags, inline media.

If the page has also imported
[reactions](https://github.com/nostr-client/reactions) every card grows a
reactions bar, and with [wallet](https://github.com/nostr-client/wallet) an
instant ₿ tip button — optional enhancements, zero hard coupling.

## Shared helpers (exported)

```js
import { renderContentInto, formatAgo, profiles }
  from 'https://nostr-client.github.io/note/note.js'
```

- `renderContentInto(el, text)` — linkify + inline images, built from DOM
  nodes only (never `innerHTML`), `rel="noopener noreferrer"` on links
- `formatAgo(unixSeconds)` — `5s` / `12m` / `3h` / `2d`
- `profiles()` — the **page-wide** batched kind-0 resolver: one cache, one
  debounced relay query stream, shared by every component on the page

## License

AGPL-3.0-or-later
