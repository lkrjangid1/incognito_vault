# Chrome Web Store submission pack

Everything the developer dashboard asks for, ready to paste. Fields are grouped
by the dashboard tab they appear on.

---

## Package

Build the upload with:

```bash
./package.sh
```

It writes `dist/incognito-vault-chrome-<version>.zip` containing **only** the
files the extension needs — no `.git`, no docs, no `.DS_Store`. Upload that zip.

The zip must contain `manifest.json` **at its root**, not inside a nested
folder. `package.sh` zips from inside the assembled `dist/chrome` directory so
this is automatic; if you ever zip by hand, select the *files*, not the folder.

> **Safari / Mac App Store:** none of this zip flow applies. The Safari build
> ships as a Mac app: open `safari/xcode/Incognito Vault/Incognito
> Vault.xcodeproj`, **Product → Archive**, then notarize for direct download or
> submit through App Store Connect (paid Apple Developer account). App Store
> metadata (screenshots, description) is separate from this Chrome pack, and
> the Chrome screenshot sizes below don't match App Store requirements.

---

## Store listing tab

**Extension name** (45 char limit)

```
Incognito Vault
```

**Short description / summary** (132 char limit — this is the field that
rejected the upload; it mirrors `description` in `manifest.json`, currently 124)

```
Save Claude and ChatGPT incognito chats to Markdown with artifacts, keep a private local history, and resume any chat later.
```

**Category:** Productivity → Workflow & Planning
**Language:** English

**Detailed description** (6960 characters; store limit is 16,000)

```
Some chats are meant to vanish. Then one of them turns out to matter.

Claude's incognito mode and ChatGPT's temporary chats leave nothing behind: no
history, no sync, nothing attached to your account. That is the entire point of
them, and it works perfectly — right up until you close the tab and realise the
answer you needed went with it. There is no undo and no "recently closed". The
conversation lived in one browser tab, and now it doesn't.

Incognito Vault adds a save button and changes nothing else. The chat stays
ephemeral on the site. A copy lands on your own disk as plain Markdown, in a
folder you will still be able to open in twenty years with any text editor.


── WHAT IT DOES ──────────────────────────────

■ Saves any chat to Markdown, in one click

Click "Save to Vault" at the bottom-right of the page, or open the toolbar
popup and click "Save current chat". You get a real document: YAML front-matter
with the title, platform, timestamp and message count, then the conversation
with speaker headings, every code block fenced and tagged with its language,
lists and tables and links preserved. It is Markdown, not a screenshot and not
a wall of unformatted text — it opens in Obsidian, Notion, VS Code, GitHub, or
Notepad.

■ Brings the artifacts with it

Claude artifacts are saved into the same folder as the transcript that produced
them. Code artifacts and diagrams are read straight out of the page. HTML and
React artifacts — which render inside a sandboxed frame that no extension can
read — are handled by pressing Claude's own download button for you, so the
real file arrives complete rather than as a partial copy.

Claude hands those files to the browser with no name attached, which is why
saving one by hand gives you "download.md" in your Downloads root. Incognito
Vault names each file after its artifact and files it next to the transcript
that references it.

■ Gives ephemeral chats a real name

An incognito chat is never named by the site, so a naive exporter produces a
folder full of "new-chat", "new-chat (1)", "new-chat (2)". Incognito Vault
reads a title out of the conversation itself. Saves land under
"how-do-i-fix-a-cors-error" or "flutter-architecture-layers" — names you can
actually search six months later.

■ Keeps a local history you can search

Every save is listed in the toolbar popup with its platform, date, message
count and artifact count. Search by title. Re-download the whole folder —
transcript and artifacts — any time. Delete an entry when you are done with it,
with a confirmation step so a mis-click costs you nothing. The full transcript
is kept in the extension's own storage, so the history survives long after the
chat itself is gone.

■ Resumes a saved chat

Pick any chat from the history and press Resume. A fresh incognito or temporary
session opens with the transcript already loaded into the composer, framed as
context so the assistant picks up the thread instead of starting over.

It is never sent automatically. You read it, trim it if it is enormous, and
press Enter yourself. Sending someone's conversation on their behalf is not
something an extension should do.


── HOW YOU USE IT ────────────────────────────

1. Open a chat on claude.ai or chatgpt.com — incognito, temporary, or an
   ordinary one; all of them work.
2. Click "Save to Vault" on the page, or "Save current chat" in the popup.
3. The files appear in Downloads/IncognitoVault/<date>_<title>/.

The button tells you what it captured — "Saved (12 msgs, 1 artifact)" — so you
know at a glance whether the artifacts came along.

Save before you close the tab. For an ephemeral conversation, the page in front
of you is the only place it exists.


── WHAT LANDS ON DISK ────────────────────────

Downloads/IncognitoVault/
└── 2026-08-06_1243_flutter-architecture-layers/
    ├── flutter-architecture-layers.md    (the transcript)
    ├── artifact-1-layer-diagram.md
    └── artifact-2-dashboard.html

One folder per chat. Ordinary files that you own, that no application controls,
that back up and sync and grep like anything else on your computer. Delete them
whenever you like — the extension neither knows nor cares.


── PRIVACY ───────────────────────────────────

No servers. No accounts. No analytics. No sync. No network requests of any
kind — the extension contains no code that opens a connection, because there is
nowhere for it to connect to.

It reads the conversation on the tab you are looking at, only at the moment you
press save, and writes it to your disk. That is the whole data flow.

It asks for two permissions:

• storage — holds your saved-chat history locally
• downloads — writes the transcript and artifact files to your Downloads folder

Plus access to claude.ai, chatgpt.com and chat.openai.com, which is where the
conversations are.

It deliberately does NOT request the "tabs" permission. That permission would
let it see every tab you have open, and it does not need to, so it does not ask
for it. An extension built to protect private conversations has no business
watching the rest of your browsing.

Full privacy policy:
https://github.com/lkrjangid1/incognito_vault/blob/main/PRIVACY.md

The source is public and readable end to end — about 1,500 lines, no build step,
no minification, no bundled dependencies. You can check every claim above
yourself:
https://github.com/lkrjangid1/incognito_vault


── HONEST LIMITATIONS ────────────────────────

Things worth knowing before you install, rather than after:

• Resume is not restore. Neither site can genuinely reopen an ephemeral chat.
  Resume pastes the transcript into a new session as context. A very long chat
  may exceed the composer or the context window, so trim it first.

• Files go to Downloads/IncognitoVault/. Extensions cannot write anywhere else.
  Change your browser's download directory, or symlink the folder, if you want
  them somewhere specific.

• Images are referenced by URL, not downloaded — and incognito image URLs
  expire, so those links will eventually go dead.

• Claude and ChatGPT redesign their interfaces often. When a redesign breaks
  scraping, the extension says so plainly instead of silently saving nothing,
  and the fix is a selector update in one file.

• Uninstalling removes the history. Your downloaded files stay where they are.


── WHO IT IS FOR ─────────────────────────────

People who use incognito and temporary chats on purpose — for a salary
question, a medical worry, a draft resignation letter, a half-formed idea,
client work that should not be sitting in a chat history — and who occasionally
need to keep one anyway. You should not have to choose between "this
conversation is private" and "I can read this again tomorrow".


Incognito Vault is an independent open-source project. It is not affiliated
with, endorsed by, or sponsored by Anthropic, OpenAI, or Google. "Claude" and
"ChatGPT" are named only to describe the websites the extension works on.
```

---

## Privacy practices tab

**Single purpose description**

```
Incognito Vault has one purpose: to let a user save the AI chat they are
currently viewing on claude.ai or chatgpt.com — chats those sites do not keep,
because they were started in incognito or temporary mode — to a Markdown file
on their own computer, and to re-open a saved chat later. Every feature serves
that single purpose.
```

**Permission justifications** — one box per permission the manifest requests:

`storage`
```
Stores the user's saved chat transcripts locally so the history survives after
the ephemeral chat is closed, and holds a transcript briefly in session storage
while the "resume" feature hands it to a newly opened chat tab. Nothing is sent
anywhere.
```

`downloads`
```
Writing the chat to a file IS the extension's purpose. It saves the Markdown
transcript and the chat's artifact files to the user's Downloads folder, and
uses downloads.onDeterminingFilename so artifact files that Claude serves with
no filename are named after the artifact and filed alongside their transcript
instead of landing as "download.md" in the Downloads root.
```

**Host permission justification** (`claude.ai`, `chatgpt.com`, `chat.openai.com`)
```
The extension reads the conversation from the page's DOM in order to save it.
That is only possible on the sites where the conversations exist, so access is
limited to exactly those three origins and no others. It reads the page only
when the user clicks a save button, and sends nothing from it.
```

**Remote code:** *No, I am not using remote code.*
All JavaScript is included in the package; the extension loads no external
scripts and makes no network requests.

**Data usage** — declare that the extension collects:
*Nothing.* Leave every category unchecked. The transcript never leaves the
user's device, which is not "collection" under the policy, but if you prefer to
be maximally conservative you may check **Personal communications** and then
answer the three certifications below the same way.

**Certifications** — check all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
```
https://github.com/lkrjangid1/incognito_vault/blob/main/PRIVACY.md
```
A GitHub file URL is accepted. It must be publicly reachable when you submit —
check it in a logged-out browser first.

---

## Graphic assets

All built and verified as 24-bit RGB PNG with no alpha channel, in
`store-assets/`.

| Asset | Size | File |
|---|---|---|
| Store icon | 128×128 | `icons/icon128.png` |
| Screenshot 1 | 1280×800 | `store-assets/shot-1-history.png` |
| Screenshot 2 | 1280×800 | `store-assets/shot-2-save.png` |
| Screenshot 3 | 1280×800 | `store-assets/shot-3-disk.png` |
| Screenshot 4 | 1280×800 | `store-assets/shot-4-artifacts.png` |
| Screenshot 5 | 1280×800 | `store-assets/shot-5-resume.png` |
| Small promo tile | 440×280 | `store-assets/tile-small.png` |
| Marquee promo tile | 1400×560 | `store-assets/tile-marquee.png` |

**Upload the screenshots in numbered order.** The first one is what appears in
search results and above the fold, so it carries the pitch on its own; the rest
answer the questions it raises.

| # | Shows | Says |
|---|---|---|
| 1 | The popup with five saved chats | Incognito chats are gone forever — unless you keep one |
| 2 | The popup mid-save, plus the in-page button | One click, before you close the tab |
| 3 | The folder tree beside a real transcript | Plain Markdown, your disk |
| 4 | The three-step artifact pipeline | Artifacts come too, including HTML/React |
| 5 | The popup with the resume toast | Pick it back up where you left off |

The popup in screenshots 1, 2 and 5 is rendered from the extension's own
`popup.css` and the exact markup `popup.js` produces; the in-page button and
toast come from `content.css`. Nothing is a redrawn mockup — which matters,
because the store rejects screenshots that don't show the real product.

**Regenerating them after a UI change:** the screenshots load the live CSS, so
re-running the generator picks up any styling change automatically. Ask for the
generator script if it isn't in the repo yet — it renders each canvas in
headless Chrome at 2× and downsamples to the exact store dimensions.

**Optionally add a sixth:** a real capture from your own browser — the popup
open over an actual claude.ai chat with the Save to Vault button visible. It is
the one shot that proves the extension runs in situ, and only you can take it.
Cmd+Shift+4 then Space captures a single window; scale it to 1280×800 and
flatten the alpha before uploading.

---

## Pre-submit checklist

- [x] `description` in `manifest.json` is ≤ 132 characters (124)
- [x] `version` is a release version (1.0.0)
- [x] Icons declared at 16/48/128 and present
- [x] `action.default_icon` declared
- [x] No unused permissions (`tabs` removed — it triggered a "read your browsing history" warning it did not need)
- [x] No remote code, no inline scripts, default MV3 CSP
- [x] Privacy policy written and committed
- [x] Trademark disclaimer in the listing description
- [x] Screenshots and promo tiles built (1280×800 / 440×280 / 1400×560, 24-bit RGB, no alpha)
- [ ] Zip built with `./package.sh` and uploaded
- [ ] Privacy policy URL live and publicly reachable
- [ ] Developer account verified with a contact email (a one-off $5 registration fee applies to new accounts)

Review usually takes a few days. Extensions that read page content, as this one
does, are sometimes pulled for manual review — the single-purpose statement
above is what gets it through.
