# Incognito Vault

A **Chrome (Manifest V3)** and **Safari (Web Extension)** extension that rescues **Claude incognito** and **ChatGPT temporary** chats before they vanish. One shared codebase (`shared/`), with a thin platform layer per browser (`chrome/`, `safari/`).

<img width="379" height="435" alt="image" src="https://github.com/user-attachments/assets/d4b416bc-57cc-4160-b558-bdc1cff7a8d8" />

- 📝 Exports the conversation to **Markdown** (with YAML front-matter) into `Downloads/IncognitoVault/<date>_<title>/`
- 📎 Saves **Claude artifacts** into the same folder — including HTML/React ones, by pressing Claude's own Download button for you
- 🏷️ Gives ephemeral chats a **real name** instead of "New chat" / "ChatGPT"
- 🗄️ Keeps a **local history** in IndexedDB, inside the extension — nothing ever leaves your machine
- ♻️ **Resume** any saved chat: opens a fresh incognito/temporary session with the transcript pre-filled in the composer (you press Enter)

---

## Install (developer mode)

The Chrome Web Store listing is still in review, so for now you load the extension from this folder. Takes about a minute.

**Requirements:** Chrome 102+ or any modern Chromium browser (Edge, Brave, Opera, Vivaldi, Arc).

### 1. Get the folder and build it

Download or clone this repository somewhere permanent — **Chrome loads the built folder from this path every time it starts, so don't put it in a temp folder or delete it afterwards.** Then assemble the extension (plain file copies, no bundler — the only tool it needs is `node` on your PATH):

```bash
./build.sh chrome      # assembles shared/ + chrome/ into dist/chrome
```

### 2. Open the extensions page

Type this into the address bar (clicking a link won't work — Chrome blocks navigation to it):

| Browser | Address |
|---|---|
| Chrome / Brave / Opera | `chrome://extensions` |
| Edge | `edge://extensions` |
| Vivaldi | `vivaldi://extensions` |

Menu route, if you prefer: **⋮ → Extensions → Manage Extensions**.

### 3. Enable Developer mode

Flip the **Developer mode** toggle — top-right in Chrome, bottom-left sidebar in Edge. Three buttons appear: *Load unpacked*, *Pack extension*, *Update*.

### 4. Load unpacked

Click **Load unpacked** and select the **`dist/chrome` folder** — the one that directly contains the assembled `manifest.json`. Don't select the repo root, `shared/`, or the `manifest.json` file; picking the wrong level is the most common install error.

A card appears: **Incognito Vault 1.0.0**.

### 5. Pin it to the toolbar

Click the 🧩 puzzle-piece icon in the toolbar → find *Incognito Vault* → click the pin. The ghost icon is how you open your saved-chat history.

### 6. Check it worked

- The extension card shows **no red "Errors" button**.
- Open a chat on `claude.ai` or `chatgpt.com` — a **Save to Vault** button appears at the bottom-right of the page. (If the tab was already open, reload it: content scripts only inject into pages loaded after the extension.)
- Click the ghost icon — the popup opens with a **＋ Save current chat** button.

### Updating after you edit the code

Run `./build.sh chrome` (Chrome loads `dist/chrome`, not the source tree), then press the **↻ reload** icon on the extension's card on `chrome://extensions`.

This matters more than it sounds: Chrome keeps running the **old service worker** until you reload, so edits to the background code appear to do nothing and popup actions fail with **"Unknown message"**. Popup and content-script changes need the rebuild + reload too, plus a page refresh for content scripts.

### Chrome's own Incognito windows (optional)

Extensions are disabled in Chrome Incognito windows by default. If you use them, open **Details** on the extension card → enable **Allow in Incognito**.

You don't need this for normal use: Claude's incognito chat and ChatGPT's temporary chat are *site* features that work in an ordinary window.

### Removing it

**Remove** on the extension card. Your downloaded files stay; the IndexedDB history goes with the extension.

---

## Install on Safari (macOS)

Safari extensions ship inside a small Mac app, so this one builds from an Xcode project (already generated and committed under `safari/xcode/`).

**Requirements:** macOS with Xcode installed, Safari 16.4+.

1. `./build.sh safari` — assembles `dist/safari` and syncs it into the Xcode project's Resources.
2. Open `safari/xcode/Incognito Vault/Incognito Vault.xcodeproj`, select your (personal) team under *Signing & Capabilities* for both targets, then **⌘R**. The wrapper app launches and offers to open Safari's extension settings.
3. In Safari: **Settings → Advanced → Show features for web developers**, then **Settings → Developer → Allow unsigned extensions** (this toggle resets every time Safari quits — re-tick it after a relaunch).
4. **Settings → Extensions → Incognito Vault** — enable it.
5. Visit claude.ai and chatgpt.com, click the extension's toolbar icon, and choose **Always Allow on This Website** — Safari grants host access per site, and nothing runs until you do.

After editing code: `./build.sh safari`, then **⌘R** in Xcode again.

### How Safari behaves differently

Safari has no `downloads` API, so the save layer works differently there:

| | Chrome | Safari |
|---|---|---|
| Save output | Individual files in `Downloads/IncognitoVault/<chat>/` | One `IncognitoVault_<chat>.zip` in Downloads — unzips to the identical folder |
| HTML/React artifacts | Fetched by pressing Claude's own Download button, filed into the folder | Not auto-captured — the transcript lists them and you press Claude's Download button yourself |
| Everything else | identical | identical |

Debug consoles in Safari: the background page lives under **Develop → Web Extension Background Content**; content-script logs are in the page's own console.

---

## Usage

### Saving a chat

In any Claude or ChatGPT conversation — incognito or not — either:

- click the floating **Save to Vault** button at the bottom-right of the page, or
- open the toolbar popup and click **＋ Save current chat**, which saves whatever chat is in the active tab.

Do this **before closing** an ephemeral chat: the page's DOM is the only place it exists.

The button reports what it captured — `Saved ✓ (12 msgs, 1 artifact)` — so you can tell at a glance whether artifacts came along.

### Chat names

Ephemeral chats are never named by the site, so the extension derives a title itself: the chat's real name when it has one, otherwise a short headline from your first message. That's why saves land under `how-do-i-fix-a-cors-error` instead of a folder full of `new-chat`.

### Artifacts (Claude)

Just save — you don't need to open anything first. Every artifact the chat produced is picked up from its card in the conversation, and the extension presses **Claude's own Download button** for each one, filing the real file into the chat's folder. That's what makes HTML/React artifacts work at all: Claude renders those in a sandboxed iframe no extension can read.

If you *also* have an artifact open in the side panel, its contents are captured directly as an extra `.md` (source view gives exact code; a rendered diagram is saved as real `<svg>` markup).

Code blocks inside messages are always in the transcript regardless.

If you press Claude's Download button yourself within five minutes of saving, that file gets filed away too — Chrome would otherwise call it `download.md`, because Claude hands the file over with no name attached.

### History

Click the ghost icon:

- **Search** filters by title
- **Resume ▸** re-opens the chat elsewhere (below)
- **.md** re-downloads the whole folder — transcript and artifacts
- **✕** deletes the entry, after a confirmation dialog. Files already downloaded are kept.

### Resume

| Platform | What happens |
|---|---|
| ChatGPT | Opens `chatgpt.com/?temporary-chat=true` — temporary mode via URL parameter, reliable |
| Claude | Opens `claude.ai/new` and clicks the ghost (incognito) button; if it can't find it, the transcript goes to your clipboard and a toast tells you |

The transcript is inserted into the composer but **never auto-sent** — review it, trim it if it's huge, then press Enter yourself. This is deliberate.

---

## What lands on disk

```
Downloads/IncognitoVault/
└── 2026-08-06_1243_flutter-architecture-layers/
    ├── flutter-architecture-layers.md      ← the transcript
    ├── artifact-1-flutter-diagram.md       ← read from the open panel
    └── artifact-2-Lokesh.zip              ← downloaded from Claude
```

The transcript is portable Markdown:

```markdown
---
title: "Flutter architecture layers"
platform: claude
captured: 2026-08-06T12:43:00.000Z
messages: 6
---

# Flutter architecture layers

## 🧑 User

Explain the Flutter architecture layers.

## 🤖 Assistant

Here is how the layers stack up: …

---
## 📎 Artifacts

- `artifact-1-flutter-diagram.md` — Flutter diagram
- `artifact-2-Lokesh.*` — Lokesh (Code · HTML), downloaded from Claude
```

**Recommended setting:** if Chrome's **"Ask where to save each file"** (Settings → Downloads) is on, you get one save dialog per file. The name and folder are pre-filled correctly, but turning it off makes saving a chat with several artifacts far less tedious.

---

## Troubleshooting

Two consoles matter, and they show different things:

- **Page console** — DevTools on the claude.ai / chatgpt.com tab. Scraping and artifact-card logs.
- **Service worker console** — `chrome://extensions` → Incognito Vault → **Service worker**. Downloads, filenames, storage.

| Symptom | Fix |
|---|---|
| "Unknown message" from a popup button | The old service worker is still running — press ↻ on `chrome://extensions`. |
| No **Save to Vault** button on the page | Reload the tab. If it's still missing, check the extension card for errors. |
| "No messages found" | The site changed its DOM. Selectors all live in `SELECTORS` at the top of `shared/content/content.js`. |
| Button says **no artifact** | The page console prints what it scanned. `iframes > 0` means an HTML/React artifact — use Claude's Download button; everything at `0` means the artifact-card markup changed (§4.6 in the console hint refers to the notes at the bottom of this file). |
| A file lands as `download.md` in Downloads | The SW console logs every filename decision — `writing <path>` when it corrects one, or `not renaming "…" (<reason>)`. No line at all means the download event never fired. |
| Saved but no files | Check `chrome://downloads` for blocked items, and allow multiple downloads from claude.ai if Chrome asked. |
| Resume opens a tab but nothing pastes | Reload the extension (the handoff needs a live service worker) and retry from the popup — jobs older than 2 minutes are discarded. |
| History empty after restart | Saved from a Chrome Incognito window, or "clear cookies and site data on exit" is wiping extension storage. |

---

## Privacy

No network calls, no analytics, no sync, no accounts. Everything is read from the page you're already looking at — only when you press save — and written to your own disk.

Two permissions: `storage` (the local history) and `downloads` (writing the files), plus host access to `claude.ai`, `chatgpt.com` and `chat.openai.com`. It deliberately does **not** ask for `tabs`, so it can't see what else you have open.

Full policy: **[PRIVACY.md](PRIVACY.md)**.

---

## Packaging

```bash
./build.sh             # assembles dist/chrome and dist/safari (dev builds)
./package.sh           # Chrome Web Store upload: dist/incognito-vault-chrome-<version>.zip
```

`package.sh` writes the zip with `manifest.json` at the root and nothing but the files the extension loads — the docs, `.git` and `.DS_Store` files stay out. `build.sh` fails early if either manifest's `description` exceeds the store's 132-character limit or the two platforms' versions drift apart, which is otherwise something you discover at upload time.

**Safari distribution is never a zip**: archive in Xcode (**Product → Archive**) and either notarize for direct download or submit to the App Store (paid Apple Developer account required).

**[STORE_LISTING.md](STORE_LISTING.md)** holds the rest of the submission: the listing copy, the single-purpose statement, a justification for each permission, the data-usage answers, and the screenshot sizes still to be produced.

---

## Known limitations

1. **DOM selectors are brittle.** Claude and ChatGPT ship UI changes constantly. Site-specific selectors live in one `SELECTORS` object at the top of `shared/content/content.js` — if scraping breaks, that's the only place you should need to edit.
2. **Resume ≠ restore.** Neither site can literally reopen an ephemeral chat. Resume pastes the transcript as context into a new session; very long chats may exceed the composer or context limit, so trim before sending.
3. **Files go to `Downloads/IncognitoVault/`.** Extensions can't write elsewhere. Change your browser's download directory or symlink the folder if you want them somewhere else.
4. **One panel artifact per save.** Only the artifact currently open in the side panel is read directly; the rest arrive through Claude's Download button. Long files in the panel's code view may be truncated (CodeMirror only keeps visible lines in the DOM) — the console warns when it detects this, and the downloaded file is always complete.
5. **Images aren't downloaded** — they're referenced by URL in the Markdown, and incognito image URLs expire.
6. **Uninstalling deletes the history.** The downloaded files remain.

---

## File map

```
shared/                          Everything platform-neutral (the bulk of the code)
  background/db.js               IndexedDB history layer
  background/export.js           slug/stamp/Markdown builders
  background/resume.js           Resume flow + job handoff
  background/main.js             Export orchestration, popup save, message router
  content/markdown.js            Dependency-free HTML → Markdown converter
  content/content.js             Scraper, floating button, artifact cards, resume (SELECTORS here)
  content/content.css            Floating button + toast styles
  popup/                         History UI (list, search, save, resume, delete)
  lib/env.js                     IV namespace + browser/chrome API shim (loaded first everywhere)
  lib/zip.js                     Store-only ZIP writer (Safari saves; inert on Chrome)
  lib/download-client.js         Blob+anchor ZIP download from the calling DOM context
  icons/                         Ghost icons
chrome/
  manifest.json                  MV3: service worker background, "downloads" permission
  background.js                  importScripts() loader for the shared modules
  platform/save.js               chrome.downloads save layer + artifact filename interception
safari/
  manifest.json                  MV3: background.scripts page, no "downloads"
  platform/save.js               Returns the export as a ZIP bundle for the caller to save
  xcode/                         Generated Xcode project (wrapper app + extension)
build.sh                         Assembles dist/chrome + dist/safari, syncs Xcode Resources
package.sh                       Builds the Chrome Web Store zip
STORE_LISTING.md                 Chrome Web Store submission pack
PRIVACY.md                       Privacy policy
```

Working on the code? A few browser constraints explain most of what looks strange in it:

1. **Chrome downloads use `data:` URLs.** An MV3 service worker has no `URL.createObjectURL`, so files are base64-encoded into a data URL instead of a blob.
2. **The MIME type decides the extension, not the filename.** `text/plain` made every file land as `.txt` regardless of what `filename` asked for — `mimeFor()` in `chrome/platform/save.js` keeps the two in agreement.
3. **`filename` is a request, not an instruction.** Chrome can drop it and fall back to `download.md` in the Downloads root. `downloads.onDeterminingFilename` has the final say, so `chrome/platform/save.js` re-asserts the intended path from there.
4. **Safari has no downloads API at all.** Its save layer returns the files to whichever DOM context the user clicked in, which zips them (`shared/lib/zip.js`) and clicks a blob link — a download must ride on a real user gesture there.
5. **Resume never auto-sends.** The transcript goes into the composer and stops; sending someone's conversation on their behalf is not a thing an extension should do.

The message protocol between popup, background and content script is the `switch` in `shared/background/main.js`; every site-specific selector is in the `SELECTORS` object at the top of `shared/content/content.js`.

---

## Roadmap ideas

- Auto-save on an interval while an ephemeral chat is open (crash insurance)
- Export the whole history as one ZIP (the ZIP writer from the Safari port — `shared/lib/zip.js` — makes this cheap now)
- Firefox port — the `shared/` + platform-layer split from the Safari port does most of the work; Firefox would reuse the Safari save layer
- Options page: custom subfolder, transcript-length cap for resume

---

## Licence

[MIT](LICENSE).

Incognito Vault is an independent project. It is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google. *Claude* and *ChatGPT* are named only to describe the websites the extension works on.
