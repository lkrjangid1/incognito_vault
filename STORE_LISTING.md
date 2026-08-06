# Chrome Web Store submission pack

Everything the developer dashboard asks for, ready to paste. Fields are grouped
by the dashboard tab they appear on.

---

## Package

Build the upload with:

```bash
./package.sh
```

It writes `dist/incognito-vault-<version>.zip` containing **only** the files the
extension needs — no `.git`, no docs, no `.DS_Store`. Upload that zip.

The zip must contain `manifest.json` **at its root**, not inside a nested
folder. `package.sh` zips from inside a staging directory so this is automatic;
if you ever zip by hand, select the *files*, not the folder.

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

**Detailed description**

```
Incognito Vault rescues Claude incognito chats and ChatGPT temporary chats
before they disappear.

Those chats are designed to leave no trace — which is exactly what you want,
right up until the one conversation you needed is gone. Incognito Vault gives
you a save button and nothing else changes: the chat stays ephemeral on the
site, and a copy lands on your own disk.

WHAT IT DOES

• Save any chat to Markdown — one click, from the button on the page or from
  the toolbar popup. The transcript is portable Markdown with YAML
  front-matter, saved to Downloads/IncognitoVault/.

• Bring the artifacts along — Claude artifacts are saved into the same folder
  as the transcript, including HTML and React ones, which the extension gets by
  pressing Claude's own download button for you.

• Real file names — ephemeral chats are never named by the site, so the
  extension writes a title from the conversation itself. You get
  "how-do-i-fix-a-cors-error" instead of a folder full of "new-chat".

• A local history — every save is listed in the popup, searchable, with the
  original transcript kept in the extension's own storage so it survives the
  chat being closed.

• Resume a chat — reopen any saved conversation as a fresh incognito or
  temporary session with the transcript pre-loaded in the composer. It is never
  sent automatically; you read it, trim it, and press Enter yourself.

PRIVACY

No servers, no accounts, no analytics, no network requests at all. The
extension reads the conversation on the tab you are looking at, only when you
press save, and writes it to your own disk. It does not ask for the "tabs"
permission, so it cannot see what else you have open.

Full policy: https://github.com/lkrjangid1/incognito_vault/blob/main/PRIVACY.md

HOW TO USE IT

1. Open a chat on claude.ai or chatgpt.com — incognito/temporary or not.
2. Click "Save to Vault" at the bottom-right of the page, or open the toolbar
   popup and click "Save current chat".
3. The files appear in Downloads/IncognitoVault/<date>_<title>/.

Do it before you close the chat: for an ephemeral conversation, the page is the
only place it exists.

Open source: https://github.com/lkrjangid1/incognito_vault

Incognito Vault is an independent project. It is not affiliated with, endorsed
by, or sponsored by Anthropic, OpenAI, or Google. "Claude" and "ChatGPT" are
referred to only to describe which websites the extension works on.
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

## Graphic assets you still need to make

The code side is done; these are images, and the store will not accept the
listing without the first one.

| Asset | Size | Required | Notes |
|---|---|---|---|
| Store icon | 128×128 PNG | ✅ have it | `icons/icon128.png` |
| Screenshot | 1280×800 or 640×400 PNG | ✅ **at least 1**, up to 5 | No browser chrome, no transparency |
| Small promo tile | 440×280 PNG | Optional | Needed to be featured |
| Marquee promo tile | 1400×560 PNG | Optional | Featured placement only |

Screenshots that make the case, in order: the popup with a few saved chats; the
"Save to Vault" button on a real Claude chat; the `Downloads/IncognitoVault/`
folder showing a transcript next to its artifacts; a saved `.md` open in an
editor. Screenshots must show the actual extension — mockups get rejected.

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
- [ ] Zip built with `./package.sh` and uploaded
- [ ] At least one 1280×800 screenshot uploaded
- [ ] Privacy policy URL live and publicly reachable
- [ ] Developer account verified with a contact email (a one-off $5 registration fee applies to new accounts)

Review usually takes a few days. Extensions that read page content, as this one
does, are sometimes pulled for manual review — the single-purpose statement
above is what gets it through.
