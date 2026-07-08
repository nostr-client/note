/**
 * note.js — <nostr-note>, a single nostr note card + shared rendering helpers.
 * No build step. Safe rendering: user content never touches innerHTML.
 *
 * Part of https://github.com/nostr-client — one repo, one thing.
 * License: AGPL-3.0-or-later
 *
 * Usage:
 *   <script type="module" src="https://nostr-client.github.io/note/note.js"></script>
 *   <nostr-note event-id="<64-char hex>"></nostr-note>   <!-- hex is the primitive -->
 *   <nostr-note></nostr-note> + el.event = <nostr event>  <!-- render directly -->
 *
 * Also exports (used by thread, search, …):
 *   renderContentInto(el, text)  — linkified, image-inlining, XSS-safe
 *   formatAgo(unixSeconds)       — '5m', '3h', '2d'
 *   profiles()                   — page-wide batched kind-0 resolver singleton
 */

import { defaultPool } from 'https://nostr-client.github.io/pool/pool.js'
import { npubShort } from 'https://nostr-client.github.io/nip19/nip19.js'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

/** Build text + links + inline images with DOM nodes — never innerHTML. */
export function renderContentInto(el, text, { maxLength = 2000 } = {}) {
  if (text.length > maxLength) text = text.slice(0, maxLength) + '…'
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    el.append(text.slice(last, match.index))
    const url = match[0]
    if (IMAGE_RE.test(url)) {
      const img = document.createElement('img')
      img.src = url
      img.alt = ''
      img.loading = 'lazy'
      el.append(img)
    } else {
      const a = document.createElement('a')
      a.href = url
      a.textContent = url.length > 60 ? url.slice(0, 60) + '…' : url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      el.append(a)
    }
    last = match.index + url.length
  }
  el.append(text.slice(last))
}

export function formatAgo(ts) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

/**
 * Page-wide batched profile (kind 0) resolver. Any component can call
 * profiles().get(pubkey, cb): cb fires immediately if cached, and again when
 * the batched relay query lands. One cache and one query stream per page.
 */
class ProfileResolver {
  constructor(pool) {
    this.pool = pool
    this.cache = new Map()      // pubkey -> profile object | null (queried, none found)
    this.waiting = new Map()    // pubkey -> Set<cb>
    this.pending = new Set()
    this.timer = null
  }

  get(pubkey, cb) {
    if (this.cache.has(pubkey)) { cb(this.cache.get(pubkey)); return }
    if (!this.waiting.has(pubkey)) this.waiting.set(pubkey, new Set())
    this.waiting.get(pubkey).add(cb)
    this.pending.add(pubkey)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this._flush(), 300)
  }

  async _flush() {
    const authors = [...this.pending]
    this.pending.clear()
    if (!authors.length) return
    const events = await this.pool.list([{ kinds: [0], authors, limit: authors.length }])
    const newest = new Map()
    for (const ev of events) {
      const prev = newest.get(ev.pubkey)
      if (!prev || prev.created_at < ev.created_at) newest.set(ev.pubkey, ev)
    }
    for (const pk of authors) {
      let profile = null
      const ev = newest.get(pk)
      if (ev) { try { profile = JSON.parse(ev.content) } catch {} }
      this.cache.set(pk, profile)
      for (const cb of this.waiting.get(pk) ?? []) cb(profile)
      this.waiting.delete(pk)
    }
  }
}

export function profiles(pool = defaultPool()) {
  return (globalThis.__nostrClientProfiles ??= new ProfileResolver(pool))
}

// ---------------------------------------------------------------- element

const TEMPLATE = /* html */ `
<style>
  :host { display: block;
    font-family: var(--nc-font, ui-sans-serif, system-ui, sans-serif);
    font-size: .95rem; color: var(--nc-ink, #201d26); }
  article { display: flex; gap: .8rem; padding: .9rem 1rem;
    background: var(--nc-surface, #fff);
    border: 1px solid var(--nc-line, #e9e6e0);
    border-radius: var(--nc-radius, 14px);
    box-shadow: var(--nc-shadow, 0 1px 2px rgb(32 27 51 / 4%), 0 6px 24px -10px rgb(32 27 51 / 10%)); }
  :host([clickable]) article { cursor: pointer; transition: border-color .15s ease; }
  :host([clickable]) article:hover { border-color: var(--nc-faint, #a8a4b0); }
  :host([highlight]) article { border-color: var(--nc-accent, #7c3aed);
    box-shadow: var(--nc-shadow-pop, 0 2px 6px rgb(32 27 51 / 8%), 0 16px 48px -12px rgb(32 27 51 / 18%)); }
  .avatar { width: 42px; height: 42px; border-radius: 50%; flex: none;
    object-fit: cover; background: var(--nc-inset, #f4f2ee);
    border: 1px solid var(--nc-line, #e9e6e0); }
  .body { min-width: 0; flex: 1; }
  .meta { font-size: .8rem; margin-bottom: .25rem; }
  .meta .name { font-weight: 650; }
  .meta .when { color: var(--nc-faint, #a8a4b0); }
  .content { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55;
    font-family: var(--nc-font-content, inherit); }
  .content a { color: var(--nc-accent, #7c3aed); }
  .content img { max-width: 100%; max-height: 22rem; border-radius: 10px;
    display: block; margin-top: .5rem; border: 1px solid var(--nc-line, #e9e6e0); }
  .missing { padding: .9rem 1rem; border: 1px dashed var(--nc-line, #e9e6e0);
    border-radius: var(--nc-radius, 14px); color: var(--nc-faint, #a8a4b0);
    font-size: .85rem; }
  .foot { margin-top: .4rem; }
</style>
<div id="root"></div>
`

class NostrNote extends HTMLElement {
  static observedAttributes = ['event-id']

  constructor() {
    super()
    this.attachShadow({ mode: 'open' }).innerHTML = TEMPLATE
    this.root = this.shadowRoot.getElementById('root')
    this.pool = null
    this._event = null
    this._seq = 0
  }

  get event() { return this._event }
  set event(ev) { this._event = ev; if (this.isConnected) this._render() }

  connectedCallback() {
    if (this._event) this._render()
    else if (this.getAttribute('event-id')) this._fetch()
  }

  attributeChangedCallback(_n, oldVal, newVal) {
    if (oldVal !== newVal && this.isConnected && newVal) this._fetch()
  }

  async _fetch() {
    const id = (this.getAttribute('event-id') || '').toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(id)) { this._renderMissing('invalid event id (need 64-char hex)'); return }
    const seq = ++this._seq
    this._renderMissing('loading…')
    const event = await (this.pool ?? defaultPool()).get({ ids: [id] })
    if (seq !== this._seq) return
    if (!event) { this._renderMissing('note not found on connected relays'); return }
    this._event = event
    this._render()
  }

  _renderMissing(text) {
    this.root.innerHTML = ''
    const div = document.createElement('div')
    div.className = 'missing'
    div.textContent = text
    this.root.append(div)
  }

  _render() {
    const event = this._event
    this.root.innerHTML = ''
    const article = document.createElement('article')

    const avatar = document.createElement('img')
    avatar.className = 'avatar'
    avatar.alt = ''
    avatar.loading = 'lazy'

    const body = document.createElement('div')
    body.className = 'body'
    const meta = document.createElement('div')
    meta.className = 'meta'
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = npubShort(event.pubkey)
    const when = document.createElement('span')
    when.className = 'when'
    when.textContent = ' · ' + formatAgo(event.created_at)
    when.title = new Date(event.created_at * 1000).toLocaleString()
    meta.append(name, when)

    const content = document.createElement('div')
    content.className = 'content'
    renderContentInto(content, event.content)

    body.append(meta, content)

    // optional enhancement point: composed pages that imported reactions.js
    // get a reactions bar on every note, with zero hard coupling here
    if (customElements.get('nostr-reactions')) {
      const foot = document.createElement('div')
      foot.className = 'foot'
      const reactions = document.createElement('nostr-reactions')
      reactions.setAttribute('event-id', event.id)
      reactions.setAttribute('author', event.pubkey)
      foot.append(reactions)
      body.append(foot)
    }

    article.append(avatar, body)

    if (this.hasAttribute('clickable')) {
      article.addEventListener('click', (e) => {
        if (e.target.closest('a, img, nostr-reactions')) return
        this.dispatchEvent(new CustomEvent('nostr:note-click', {
          detail: { event }, bubbles: true, composed: true,
        }))
      })
    }

    profiles(this.pool ?? defaultPool()).get(event.pubkey, (profile) => {
      if (!profile || this._event !== event) return
      const display = profile.display_name || profile.name
      if (display) name.textContent = display
      if (profile.picture) avatar.src = profile.picture
    })

    this.root.append(article)
  }
}

if (!customElements.get('nostr-note')) customElements.define('nostr-note', NostrNote)
