# App Store submission pack (Safari extension)

Everything App Store Connect asks for, ready to paste. The Chrome pack lives in
`STORE_LISTING.md`; this file covers the Mac App Store (and iOS/iPadOS, if you
add that target — see the last section).

---

## How the Safari build ships

There is no zip upload. The extension ships inside a Mac app:

1. `./build.sh safari` — assembles `dist/safari` and syncs it into the Xcode
   project's Resources.
2. Open `safari/xcode/Incognito Vault/Incognito Vault.xcodeproj`, select the
   **Incognito Vault (macOS)** scheme.
3. Set your team on both targets under **Signing & Capabilities** (requires a
   paid Apple Developer account for distribution).
4. **Product → Archive → Distribute App → App Store Connect**.

Create the app record first at appstoreconnect.apple.com → My Apps → **+** →
New App, using the bundle ID below.

---

## App Information

| Field | Value |
|---|---|
| **Name** (30 chars) | `Incognito Vault` (15) |
| **Subtitle** (30 chars) | `Save Claude & ChatGPT chats` (27) |
| **Bundle ID** (app) | `com.lkrjangid.incognito-vault` |
| **Bundle ID** (extension) | `com.lkrjangid.incognito-vault.Extension` |
| **SKU** | `incognito-vault-001` |
| **Primary language** | English (U.S.) |
| **Primary category** | Productivity |
| **Secondary category** | Utilities |
| **Price** | Free |
| **Content rights** | Does not contain, show, or access third-party content *(it reads pages the user is already viewing, at the user's request — Apple's question is about content you license/redistribute)* |

**Age rating questionnaire:** answer **None / No** to everything, including
"Unrestricted Web Access" (the app contains no browser; the extension runs in
the user's own Safari). Result: **4+**.

**Copyright:** `© 2026 Univest` — replace with the person or company that owns
the code if different.

---

## Version Information

**Promotional text** (170 char limit — editable without a new build; 167)

```
Save Claude and ChatGPT incognito chats before they vanish — one click, one ZIP of clean Markdown on your device. No servers, no accounts, nothing leaves your machine.
```

**Description** (4,000 char limit; this is 2,982 — the Chrome listing's longer
text does not fit here and mentions Chrome-only behavior, so don't paste it)

```
Some chats are meant to vanish. Then one of them turns out to matter.

Claude's incognito mode and ChatGPT's temporary chats leave nothing behind — no history, no sync, nothing attached to your account. That is the point, and it works perfectly, right up until you close the tab and realise the answer you needed went with it.

Incognito Vault adds a save button to Safari and changes nothing else. The chat stays ephemeral on the site. A copy lands on your own disk as plain Markdown, in files you will still be able to open in twenty years with any text editor.

SAVE ANY CHAT IN ONE CLICK
Click "Save to Vault" at the bottom-right of a claude.ai or chatgpt.com chat, or use the toolbar popup. Each save arrives as a single ZIP in your Downloads folder that unzips to one tidy folder: the transcript with YAML front-matter (title, platform, timestamp, message count), speaker headings, fenced and language-tagged code blocks, plus a Markdown file for each Claude artifact captured from the page.

REAL NAMES FOR NAMELESS CHATS
Ephemeral chats are never titled by the site. Incognito Vault reads a title out of the conversation itself, so saves land as "how-do-i-fix-a-cors-error", not "new-chat (7)".

A PRIVATE, SEARCHABLE HISTORY
Every save is listed in the toolbar popup with its platform, date, message count and artifact count. Search by title, re-download the ZIP any time, delete entries when you are done. The history lives in the extension's own local storage, on your device.

RESUME A SAVED CHAT
Pick a chat and press Resume: a fresh incognito or temporary session opens with the transcript ready in the composer, framed as context. It is never sent automatically — you read it, trim it if it is enormous, and press Enter yourself.

PRIVACY
No servers. No accounts. No analytics. No network requests of any kind — the extension contains no code that opens a connection, because there is nowhere for it to connect to. It reads the page you are looking at only when you press save, and writes the result to your disk. Site access is limited to claude.ai, chatgpt.com and chat.openai.com, and Safari keeps per-site permission in your control at all times. The source code is public and readable end to end.

HONEST LIMITATIONS
• Resume is not restore — neither site can truly reopen an ephemeral chat. Resume pastes the transcript into a new session as context.
• HTML and React artifacts render in a sandboxed frame that Safari extensions cannot read. The transcript notes each one, so use Claude's own Download button for those files before closing the tab.
• Images are referenced by URL, and incognito image URLs eventually expire.
• When Claude or ChatGPT redesign their interface, the extension says so plainly instead of silently saving nothing.

Incognito Vault is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI. "Claude" and "ChatGPT" are named only to describe the websites the extension works on.
```

**Keywords** (100 char limit, comma-separated, no spaces; 88)

```
claude,chatgpt,ai,chat,export,markdown,incognito,temporary,transcript,backup,vault,notes
```

**Support URL**

```
https://github.com/lkrjangid1/incognito_vault/issues
```

**Marketing URL** (optional)

```
https://github.com/lkrjangid1/incognito_vault
```

**Version:** `1.0.0` — must match `version` in both manifests (`build.sh`
asserts parity) *and* the Xcode targets' MARKETING_VERSION.

**What's New** (first release)

```
First release: save Claude and ChatGPT incognito/temporary chats as Markdown ZIPs, keep a private searchable history, and resume any saved chat in a fresh session.
```

---

## App Privacy

- **Privacy policy URL:** `https://github.com/lkrjangid1/incognito_vault/blob/main/PRIVACY.md` — must be publicly reachable at submission time; check it logged out.
- **Data collection:** **Data Not Collected** — answer "No, we do not collect data from this app" to the opening question. Transcripts are written to the user's own disk and never transmitted; under Apple's definitions (data sent off-device) nothing is collected. This gives the listing the "Data Not Collected" privacy label.

**Export compliance:** the app contains no encryption of its own (it makes no
network connections at all). Answer **None of the algorithms mentioned above**,
or pre-answer it by adding `ITSAppUsesNonExemptEncryption = NO` to both
targets' Info.plist so Connect never asks.

---

## App Review Information

**Notes for the reviewer**

```
Incognito Vault is a Safari Web Extension. To test:

1. Launch the app once (it only hosts the extension and shows enable instructions).
2. Safari → Settings → Extensions → enable "Incognito Vault".
3. Open https://claude.ai or https://chatgpt.com and sign in (any free account works; the extension itself has no accounts).
4. Grant the extension access when Safari prompts (toolbar icon → Always Allow on This Website).
5. In any chat, click the "Save to Vault" button at the bottom-right of the page, or the toolbar popup's "Save current chat". A ZIP containing the Markdown transcript is saved to Downloads.
6. The toolbar popup lists saved chats — search, re-download, delete, or "Resume" (opens a new temporary chat with the transcript pre-filled in the composer; nothing is sent automatically).

The extension makes no network requests and has no server component. It reads
the page DOM only when the user clicks save. Site access is limited to
claude.ai, chatgpt.com, and chat.openai.com.
```

**Sign-in required:** the extension has no login. Reviewing the save flow needs
a chat page, which needs a (free) Claude or ChatGPT account — provide a throwaway
demo account in the Review section if you don't want reviewers using their own.

**Contact:** your name + phone + email (the Apple Developer account contact).

---

## Screenshots

All generated, exact-size, 24-bit RGB with no alpha, in `store-assets/safari/`.
Upload in numbered order — screenshot 1 carries the pitch on its own.

| # | File name | Shows | Says |
|---|---|---|---|
| 1 | `shot-1-history.png` | Popup with five saved chats | Incognito chats vanish — yours don't have to |
| 2 | `shot-2-save.png` | Chat page, Save to Vault button + saved toast | One click, before you close the tab |
| 3 | `shot-3-zip.png` | ZIP → folder tree → Markdown front-matter | One ZIP per chat, plain Markdown inside |
| 4 | `shot-4-privacy.png` | On-device / click-only / open-source checklist | No servers, no accounts, no analytics |
| 5 | `shot-5-resume.png` | Popup row → new temporary session, composer pre-filled | Pick it back up where you left off |

Sizes per device (each folder holds all five shots):

| Folder | Size | App Store slot |
|---|---|---|
| `store-assets/safari/mac/` | 2880 × 1800 | Mac (accepted: 1280×800, 1440×900, 2560×1600, 2880×1800) |
| `store-assets/safari/iphone-6.7/` | 1284 × 2778 | iPhone 6.7"/6.9" display (accepted: 1242×2688, 2688×1242, 1284×2778, 2778×1284) |
| `store-assets/safari/ipad-13/` | 2064 × 2752 | iPad 13" display (accepted: 2064×2752, 2752×2064, 2048×2732, 2732×2048) |

The popup, in-page button, and toast in the shots are rendered from the
extension's real palette and markup (`shared/popup/popup.css`,
`shared/content/content.css`) — not a redrawn mockup.

**Regenerating after a UI or copy change:** the master template is
`store-assets/safari/src/template.html` (`?shot=1`…`?shot=5`; it adapts to any
canvas size/orientation). Render any size with headless Chromium, e.g.:

```bash
npx playwright screenshot --viewport-size=2880,1800 \
  "file://$PWD/store-assets/safari/src/template.html?shot=1" \
  store-assets/safari/mac/shot-1-history.png
```

---

## iPhone / iPad

The committed Xcode project is **multiplatform** — schemes `Incognito Vault
(macOS)` and `Incognito Vault (iOS)` share one copy of the extension in
`Shared (Extension)/Resources`, so iPhone, iPad, and Mac all run the same code.

Ship iOS/iPadOS by archiving the **Incognito Vault (iOS)** scheme (destination
*Any iOS Device*) and uploading it to the **same app record** — one record
covers both platforms when the bundle ID matches, which it does. App Store
Connect then requires the iPhone 6.7"/6.9" and iPad 13" screenshot slots this
pack already fills.

Re-test on a device before submitting: ZIP saves land via Safari's download
manager into `Files → Downloads`, and the resume "Copy transcript" button
depends on iOS clipboard permission prompts.

---

## Pre-submit checklist

- [x] App record fields above (name, subtitle, categories, age rating)
- [x] Description ≤ 4,000 chars, promotional text ≤ 170, keywords ≤ 100
- [x] Screenshots at exact accepted sizes, no alpha (`store-assets/safari/`)
- [x] Privacy: Data Not Collected + policy URL committed (`PRIVACY.md`)
- [x] Trademark disclaimer in the description
- [ ] Team/signing set on both targets; `MARKETING_VERSION` = 1.0.0
- [ ] `ITSAppUsesNonExemptEncryption = NO` added (or answer the export prompt)
- [ ] Archive uploaded from Xcode (Product → Archive)
- [ ] Privacy policy URL live and publicly reachable
- [ ] App icon: the converter generated the app icon set from the extension
      icons; check the 1024×1024 App Store slot in `Assets.xcassets` is filled —
      Connect rejects builds without it

Review for Safari extensions typically takes 1–3 days. The most common
rejection for this category is Guideline 4.2 (minimum functionality) against
the *host app* — the converter's default app window with enable-instructions is
normally accepted for extensions, but keep the app window's text accurate.
