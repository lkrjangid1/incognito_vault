# Incognito Vault

A Chrome (Manifest V3) extension that rescues **Claude incognito** and **ChatGPT temporary** chats before they vanish:

- 📝 Exports the full conversation to **Markdown** (with YAML front-matter) into `Downloads/IncognitoVault/<date>_<title>/`
- 📎 Saves the currently-open **Claude artifact** as a separate `.md` file alongside the transcript
- 🗄️ Keeps a **local history** in IndexedDB (inside the extension — nothing leaves your machine)
- ♻️ **Resume**: click any saved chat → opens a fresh incognito/temporary session with the full transcript pre-filled in the composer (you press Enter to send)

## Install (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select this folder
4. Pin the ghost icon to your toolbar

Works in Chrome, Edge, Brave, and other Chromium browsers.

## Usage

**Saving:** In any Claude or ChatGPT conversation (incognito or not), either

- click the floating **Save to Vault** button (bottom-right of the page), or
- open the toolbar popup and click **＋ Save current chat** — it saves whatever chat is in the active tab.

Do this **before closing** an incognito chat — the DOM is the only place the chat exists.

**Chat names:** incognito and temporary chats are never named by the site, so the extension builds a title itself — it uses the chat's real name when there is one, otherwise a short headline taken from your first message (instead of everything landing under "New chat" / "ChatGPT").

**Artifacts (Claude):** just save — every artifact the chat produced is picked up from its card in the conversation, and the extension presses Claude's own **Download** button for each one so the real file lands in the chat's folder. If you also have the artifact open in the side panel, its contents are captured directly as an `.md` on top of that (source view gives exact code; a rendered diagram is saved as SVG markup). The save button reports what happened — `Saved ✓ (12 msgs, 1 artifact)` or `no artifact`; when it says *no artifact*, the page's DevTools console has a line explaining what it found. Code blocks inside messages are always captured inline in the transcript regardless.

**After changing extension files:** hit **Reload** on `chrome://extensions` — Chrome keeps running the old service worker otherwise, and popup actions fail with "Unknown message".

**History:** click the toolbar icon. Search, re-download the `.md`, delete entries (✕ asks for confirmation first), or hit **Resume ▸**.

**Resume:** 
- ChatGPT → opens `chatgpt.com/?temporary-chat=true` (temporary mode via URL param — reliable)
- Claude → opens `claude.ai/new` and tries to click the ghost (incognito) button; if it can't find it, the transcript is copied to your clipboard and you're told to paste manually.
- The transcript is inserted into the composer but **never auto-sent** — review, trim if it's huge, then press Enter.

## Known limitations (read this)

1. **DOM selectors are brittle.** Claude and ChatGPT ship UI changes constantly. All site-specific selectors live in one `SELECTORS` object at the top of `content/content.js` — if scraping breaks, update them there (inspect the page with DevTools and find the new class/testid names).
2. **Resume ≠ restore.** Neither site can literally reopen an incognito chat. Resume works by pasting the transcript as context in a new session. For very long chats the transcript may exceed the composer/context limits — trim it before sending.
3. **Files go to `Downloads/IncognitoVault/`.** Chrome extensions can't write to arbitrary folders. If you want a different location, change your browser's download directory or symlink the folder. If Chrome's **"Ask where to save each file"** setting is on you'll get one save dialog per file — the folder and name are pre-filled correctly, but turning that setting off makes saving a chat with artifacts much less tedious.
4. **Artifacts come from two places.** Whatever is open in the side panel is read directly and saved as an `.md` (heading + fenced source; diagrams keep their real `<svg>` markup). Everything else the chat produced is picked up from the artifact cards in the conversation — for those the extension presses **Claude's own Download button** and files the result into the same chat folder. That second path is what makes HTML/React artifacts (rendered in a sandboxed iframe) and very long files work at all. It means saving a chat with artifacts may briefly trigger Chrome's "allow multiple downloads?" prompt. If you press Claude's Download button yourself within five minutes of saving, that file is filed away too — Chrome would otherwise call it `download.md`, since Claude hands it over with no filename attached. Multiple artifacts → open + save each one (each save creates a new history entry; keep the latest).
5. **Images aren't downloaded** — they're referenced by URL in the Markdown (incognito image URLs may expire).
6. **Your data stays local.** No network calls, no analytics, no sync. Deleting the extension deletes the IndexedDB history (downloaded files remain).

## File map

```
manifest.json          MV3 config
background.js          Service worker: IndexedDB, .md builder, downloads, resume
content/markdown.js    Dependency-free HTML → Markdown converter
content/content.js     Scraper + floating button + resume injection (SELECTORS here)
content/content.css    Button/notice styles
popup/                 History UI
icons/                 Ghost icons
```

## Roadmap ideas

- Auto-save on an interval while an incognito chat is open (crash insurance)
- Export all history as one ZIP
- Firefox port (swap `chrome.*` → `browser.*`, MV2/MV3 event pages)
- Capture artifacts by iterating the artifact list programmatically
