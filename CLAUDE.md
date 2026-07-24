# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Kelime Kutusu** is a Firefox WebExtension (Manifest V3) for language learners: double-click an English word on any page, get a Turkish translation, save it, then review saved words later in a spaced-repetition multiple-choice quiz.

There is no build step, no bundler, no test suite, and no package.json. Source files are loaded directly by the browser. The only third-party dependency is `lib/dexie.js` (Dexie, vendored as-is for IndexedDB access).

## Firefox-specific — not Chrome-compatible

- Code uses the `browser.*` namespace (promise-based), **not** `chrome.*`. Do not swap it.
- `manifest.json` uses `browser_specific_settings.gecko` (extension id, `strict_min_version: 140.0`, `data_collection_permissions`). These are Firefox-only fields.
- Background is `"background": { "scripts": [...] }` (Firefox MV3 style), not a service worker `"service_worker"` entry.

## Running / debugging (no CLI)

Load as a temporary add-on: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. Reload from that same page after edits. Background-script logs appear via the **Inspect** button there; content-script logs appear in the page's own devtools console.

## Architecture

Four execution contexts communicate through a single message bus. **All data mutations live in `db.js`; the other contexts never touch IndexedDB directly except the quiz page, which reads it.**

- **`content.js`** — injected into `<all_urls>`. Listens for `dblclick`, validates the selection against `/^[a-zA-Z'-]{2,30}$/`, and renders a floating result card. The card is built inside a **Shadow DOM** (`attachShadow`, `:host { all: initial }`) specifically so host-page CSS can't leak in — keep all card styling inside that shadow tree. It never calls the network or DB itself; it sends messages.

- **`background.js`** — the message router (`browser.runtime.onMessage`). Dispatches by `msg.type`:
  - `LOOKUP` → `cevir()`: fetches `api.mymemory.translated.net` (en→tr), with an 8s `AbortController` timeout. Returns `{ tr }` on success or `{ tr: null, hata: <code> }`. Error codes are the string keys `kota | ag | sunucu | yok` — the UI maps them to Turkish text via the `MESAJ` table in `content.js`. Preserve these codes when editing either side.
  - `SAVE` → `db.js` `kelimeEkle()`
  - `COUNT` → `db.js` `sayac()`

- **`db.js`** — Dexie schema + the two write/read helpers. Loaded in **two** contexts: the background script (via manifest) *and* the quiz page (via `<script>` tag in `quiz.html`). The quiz page calls Dexie (`db.cards…`) directly rather than messaging the background. Schema: `cards: 'id, &term, due_at, created_at'` — `&term` is a unique index, so re-saving a word throws `ConstraintError`, which `kelimeEkle` catches and reports as `{ ok: false, reason: 'zaten_var' }`.

- **`popup/`** — toolbar popup. Sends `COUNT`, shows total vs. due counts, and opens `quiz/quiz.html` in a new tab.

- **`quiz/`** — full-page review. Reads due cards directly from Dexie, builds 4-option multiple choice (correct answer + 3 random distractors), and updates scheduling. Also holds the JSON **export/import** tools (`db.cards.toArray()` / `bulkPut`).

## Card record shape (`kelimeEkle` in db.js)

`id` (uuid), `term` (lowercased), `definition_tr`, `context` (surrounding sentence, ≤300 chars), `source_url`, `difficulty` (1–10, starts 5.0), `stability`, `reps`, `due_at`, `created_at`, `updated_at`. Timestamps are epoch millis.

## Spaced repetition is a placeholder

`ilerlet()` in `quiz/quiz.js` is explicitly marked temporary (`// GEÇİCİ — Adım 5'te FSRS ile değişecek`). It currently uses a naive `2^reps` day interval (10 min on failure). The `difficulty` / `stability` fields exist so this can be swapped for a real **FSRS** algorithm later — that is the intended next step. Don't treat the current scheduling math as canonical.

## Conventions

- The codebase is written in **Turkish** — identifiers, comments, and all user-facing strings (e.g. `kart`, `cevir`, `sayac`, `oturum`, `havuz`, `dogru`). Match this when adding code.
- UI is a dark, iOS-inspired palette defined as CSS variables at the top of each HTML file (`--bg`, `--accent: #64d2ff`, etc.). Reuse those variables rather than hardcoding colors.
