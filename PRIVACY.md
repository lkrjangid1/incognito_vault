# Privacy Policy — Incognito Vault

**Last updated:** 10 August 2026
**Applies to:** Incognito Vault, Chrome extension and Safari web extension, version 1.0.0

## Summary

Incognito Vault does not collect, transmit, sell, or share any data. It has no
server, no analytics, no accounts, and makes no network requests of any kind.
Everything it reads stays on the device it read it on.

## What the extension reads

When you press **Save to Vault** (in the page) or **Save current chat** (in the
popup), the extension reads the conversation currently rendered on the
`claude.ai` or `chatgpt.com` tab you are looking at:

- the text of your messages and the assistant's replies,
- the artifacts that conversation produced,
- the page URL and the time of the save.

It reads nothing until you press one of those buttons, and it reads nothing from
any other website.

## Where that data goes

Two places, both local to your computer:

1. **A file on your disk** — a Markdown transcript, plus any artifact files,
   written to `Downloads/IncognitoVault/` through Chrome's own download
   mechanism (on Safari, the same files arrive as a single ZIP in your
   Downloads folder). These are ordinary files that you own and can delete at
   any time.
2. **The extension's local database** — an IndexedDB store inside the
   extension's own origin, so the history survives after the ephemeral chat is
   gone. It is removed when you delete an entry in the popup, and it is removed
   entirely when you uninstall the extension.

No third destination exists. The extension contains no code that opens a
network connection, and its manifest grants it access to no host other than
`claude.ai`, `chatgpt.com` and `chat.openai.com` — which it uses only to read
the page you are on, never to send anything.

## Permissions and why they exist

| Permission | Why |
|---|---|
| `storage` | Holds the saved-chat history locally, and briefly holds a transcript in session storage while a "resume" hands it to a new tab. |
| `downloads` | Chrome only — writes the Markdown transcript and artifact files to your Downloads folder, and files artifacts Claude downloads into the right chat folder. The Safari version does not request it (Safari has no such API); its ZIP arrives as an ordinary page-initiated download. |
| `https://claude.ai/*`, `https://chatgpt.com/*`, `https://chat.openai.com/*` | Lets the extension read the conversation on those pages — the only thing it does. |

The extension deliberately does **not** request the `tabs` permission, which
would give it visibility of every tab you have open.

## Data you send elsewhere

The **Resume** feature pastes a saved transcript into the composer of a new
Claude or ChatGPT chat. It never sends it — you review the text and press Enter
yourself. If you do send it, that text goes to Anthropic or OpenAI under
*their* privacy policy, exactly as if you had typed it.

## Children

The extension is not directed at children and collects nothing from anyone.

## Changes

Any change to this policy will be published in this file in the extension's
public repository, with the date above updated.

## Contact

Questions or concerns: open an issue at
<https://github.com/lkrjangid1/incognito_vault/issues>.

---

*Incognito Vault is an independent project. It is not affiliated with,
endorsed by, or sponsored by Anthropic, OpenAI, or Google.*
