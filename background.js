/* Incognito Vault — service worker
 * - Persists chat records in IndexedDB (the extension's own origin, so the
 *   history survives even though the site-side chat is ephemeral).
 * - Builds the .md export and saves it (plus artifacts) via chrome.downloads
 *   into  Downloads/IncognitoVault/<chat-slug>/
 * - Orchestrates the "resume in incognito" flow.
 */
"use strict";

// Allow content scripts to read chrome.storage.session (used for resume).
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

/* ---------------- IndexedDB ---------------- */

const DB_NAME = "incognito-vault";
const STORE = "chats";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("capturedAt", "capturedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbList() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).sort((a, b) => b.capturedAt - a.capturedAt);
      // Popup only needs metadata — keep the message bodies out of the wire.
      resolve(
        rows.map(({ id, title, platform, capturedAt, messageCount, artifactCount }) => ({
          id, title, platform, capturedAt, messageCount, artifactCount
        }))
      );
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- Markdown / files ---------------- */

function slug(text) {
  return (
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
    "chat"
  );
}

function stamp(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// Shared by files we build and by files Claude downloads, so the numbering in
// the transcript's 📎 Artifacts list always matches what lands in the folder.
function artifactStem(a, i) {
  return `artifact-${i + 1}-${slug(a.name)}`;
}

function artifactFile(a, i) {
  return `${artifactStem(a, i)}.md`;
}

/* Artifacts ship as Markdown so the whole export folder opens in one viewer:
 * source and rendered diagrams go inside a fenced block (tagged with the
 * language when we know it), document artifacts are already Markdown. */
function buildArtifactMarkdown(a, i) {
  const head = `# ${a.name || `Artifact ${i + 1}`}\n\n`;
  const body = String(a.content ?? "").replace(/\s+$/, "");
  if (a.kind === "doc") return head + body + "\n";
  return head + "```" + (a.lang || "") + "\n" + body + "\n```\n";
}

function buildMarkdown(chat) {
  const lines = [];
  lines.push("---");
  lines.push(`title: "${chat.title.replace(/"/g, "'")}"`);
  lines.push(`platform: ${chat.platform}`);
  lines.push(`captured: ${new Date(chat.capturedAt).toISOString()}`);
  lines.push(`messages: ${chat.messages.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${chat.title}`);
  lines.push("");
  for (const m of chat.messages) {
    lines.push(m.role === "user" ? "## 🧑 User" : "## 🤖 Assistant");
    lines.push("");
    lines.push(m.md);
    lines.push("");
  }
  if (chat.artifacts?.length) {
    lines.push("---");
    lines.push("## 📎 Artifacts");
    lines.push("");
    chat.artifacts.forEach((a, i) => {
      if (a.content) {
        lines.push(`- \`${artifactFile(a, i)}\` — ${a.name}`);
      } else {
        // Saved into this folder by Claude's own download (§4.8 of the TRD);
        // the extension depends on the artifact type Claude hands the browser.
        lines.push(
          `- \`${artifactStem(a, i)}.*\` — ${a.name}${a.type ? ` (${a.type})` : ""}, downloaded from Claude`
        );
      }
    });
    lines.push("");
  }
  return lines.join("\n");
}

/* Chrome derives a download's extension from the data-URL's MIME type and
 * overrides whatever `filename` says: with text/plain every file landed as
 * .txt no matter what we asked for. The MIME must agree with the extension. */
const MIME_BY_EXT = {
  md: "text/markdown",
  markdown: "text/markdown",
  svg: "image/svg+xml",
  json: "application/json",
  html: "text/html",
  csv: "text/csv",
  txt: "text/plain"
};

function mimeFor(filename) {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] || "text/markdown";
}

function textToDataUrl(text, mime) {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return `data:${mime};charset=utf-8;base64,${b64}`;
}

/* The `filename` passed to downloads.download is only a *request*: the "Ask
 * where to save each file" dialog, another download-manager extension, or a
 * data: URL with no name of its own can all end with Chrome falling back to its
 * default — "download.md" in the Downloads root. The filename listener has the
 * final say, so hold the intended path here and re-assert it from there. */
const ownPaths = [];

function download(filename, text) {
  ownPaths.push(filename);
  return chrome.downloads.download({
    url: textToDataUrl(text, mimeFor(filename)),
    filename,
    conflictAction: "uniquify",
    saveAs: false
  });
}

// Ours if the extension started it, or if it's one of our data: URLs.
function takeOwnPath(item) {
  const mine =
    item.byExtensionId === chrome.runtime.id || (item.url || "").startsWith("data:");
  return mine && ownPaths.length ? ownPaths.shift() : null;
}

function chatFolder(chat) {
  return `IncognitoVault/${stamp(chat.capturedAt)}_${slug(chat.title)}`;
}

async function downloadChatFiles(chat) {
  ownPaths.length = 0; // drop anything left over from a run that failed midway
  const folder = chatFolder(chat);
  await download(`${folder}/${slug(chat.title)}.md`, buildMarkdown(chat));
  const artifacts = chat.artifacts || [];
  for (let i = 0; i < artifacts.length; i++) {
    // Refs carry no content — their file comes from Claude's own download.
    if (!artifacts[i].content) continue;
    await download(`${folder}/${artifactFile(artifacts[i], i)}`, buildArtifactMarkdown(artifacts[i], i));
  }
}

/* ---------------- Artifacts saved through Claude's own button ----------------
 * HTML/React artifacts render in a sandboxed cross-origin iframe and long files
 * are virtualized by CodeMirror, so neither can be read out of the DOM. Claude's
 * own Download button always produces the complete file — the content script
 * presses it and this listener redirects the file into the chat's folder. */

/* The capture record lives in storage.session, not a module variable: the MV3
 * service worker can be torn down between arming and the download landing, and
 * an in-memory record would be gone by the time the filename event fires. */
const CAPTURE_KEY = "iv_capture";
const CAPTURE_TTL = 5 * 60 * 1000; // a manual click a few minutes later still lands right
const CLICKED_WINDOW = 60 * 1000;  // within this, assume the download is one we asked for

/* Claude hands the browser a blob: URL with no filename, so Chrome invents a
 * placeholder — that is where "download.md" comes from. Never pass the site's
 * basename through; name the file after the artifact and keep only Chrome's
 * extension, which is the one part it derives correctly (from the MIME type). */
const PLACEHOLDER_NAME = /^(download|untitled|file|document|blob|data)(\s*\(\d+\))?$/i;
const CLAUDE_SOURCE = /^(blob:)?https:\/\/([\w-]+\.)*claude\.(ai|com)\b/i;

const EXT_BY_MIME = {
  "text/html": "html",
  "text/markdown": "md",
  "text/plain": "txt",
  "text/css": "css",
  "text/csv": "csv",
  "text/xml": "xml",
  "text/javascript": "js",
  "application/javascript": "js",
  "application/json": "json",
  "application/xml": "xml",
  "application/pdf": "pdf",
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg"
};

async function readCapture() {
  const stash = await chrome.storage.session.get(CAPTURE_KEY);
  const cap = stash?.[CAPTURE_KEY];
  return cap && Date.now() - cap.armedAt <= CAPTURE_TTL ? cap : null;
}

function fromClaude(item) {
  return [item.url, item.finalUrl, item.referrer].some((u) => CLAUDE_SOURCE.test(u || ""));
}

/* Renames artifact files Claude produces. This fires for downloads the content
 * script triggered *and* for ones the user clicks themselves — both arrive as
 * "download.md", and both belong in the chat's folder. */
function onDeterminingFilename(item, suggest) {
  const proposed = (item.filename || "").replace(/\\/g, "/");
  const base = proposed.split("/").pop() || "";
  const skip = (why) => {
    console.log(`[Incognito Vault] not renaming "${base}" (${why})`);
    suggest();
  };

  // Our own file: re-assert the path we asked for, whatever Chrome proposed.
  const ourPath = takeOwnPath(item);
  if (ourPath) {
    console.log(`[Incognito Vault] writing ${ourPath} (Chrome proposed "${base}")`);
    return suggest({ filename: ourPath, conflictAction: "uniquify" });
  }
  if (item.byExtensionId === chrome.runtime.id) return suggest(); // ours, unqueued
  if (proposed.includes("IncognitoVault/")) return suggest();
  if (!fromClaude(item)) return skip("not from claude.ai");

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = (dot > 0 ? base.slice(dot + 1) : "") || EXT_BY_MIME[(item.mime || "").toLowerCase()] || "";
  const placeholder = !stem || PLACEHOLDER_NAME.test(stem);

  (async () => {
    const cap = await readCapture();
    if (!cap) return skip("no chat saved recently — save the chat first");
    // A file that already has a real name is only claimed if we just asked for it.
    if (!placeholder && Date.now() - cap.armedAt > CLICKED_WINDOW) return skip("has its own name");

    // More files than artifacts we knew about — name them so they can't collide
    // with the numbered stems already listed in the transcript.
    const name = cap.stems[cap.next] || `artifact-extra-${cap.next - cap.stems.length + 1}`;
    cap.next += 1;
    await chrome.storage.session.set({ [CAPTURE_KEY]: cap });

    const filename = `${cap.folder}/${name}${ext ? "." + ext : ""}`;
    console.log(`[Incognito Vault] artifact download "${base}" → ${filename}`);
    suggest({ filename, conflictAction: "uniquify" });
  })();
  return true; // suggest() is called asynchronously
}

// Guarded: a browser without this event must not take the whole worker down.
if (chrome.downloads?.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener(onDeterminingFilename);
} else {
  console.log("[Incognito Vault] downloads.onDeterminingFilename unavailable — artifact files keep Claude's own names");
}

async function captureArtifactFiles(tabId, chat) {
  const refs = (chat.artifacts || [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === "ref");
  if (!refs.length) return 0;

  // Armed even when we can't click: a manual Download still lands in the folder.
  await chrome.storage.session.set({
    [CAPTURE_KEY]: {
      folder: chatFolder(chat),
      stems: refs.map(({ a, i }) => artifactStem(a, i)),
      next: 0,
      armedAt: Date.now()
    }
  });

  const clickable = refs.filter(({ a }) => a.downloadable);
  if (!tabId || !clickable.length) {
    console.log("[Incognito Vault] artifacts noted but not clickable:", refs.map(({ a }) => a.name));
    return 0;
  }

  try {
    const res = await chrome.tabs.sendMessage(tabId, {
      type: "DOWNLOAD_ARTIFACTS",
      names: clickable.map(({ a }) => a.name)
    });
    console.log("[Incognito Vault] pressed Claude's Download for", res?.clicked || 0, "artifact(s)");
    return res?.clicked || 0;
  } catch (e) {
    console.log("[Incognito Vault] couldn't reach the tab to press Download:", String(e));
    return 0;
  }
}

async function exportChat(payload, tabId) {
  const id = crypto.randomUUID();
  const chat = { id, ...payload };

  await downloadChatFiles(chat);
  const downloaded = await captureArtifactFiles(tabId, chat);

  await dbPut({
    ...chat,
    messageCount: chat.messages.length,
    artifactCount: chat.artifacts?.length || 0
  });
  return { ok: true, id, downloaded };
}

/* ---------------- Save from the popup ---------------- */

const SUPPORTED_URL = /^https:\/\/(claude\.ai|chatgpt\.com|chat\.openai\.com)\//i;

// Popup → SW → content script (the popup has no access to the page DOM).
async function saveActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab" };
  if (!SUPPORTED_URL.test(tab.url || "")) {
    return { ok: false, error: "Open a claude.ai or chatgpt.com chat first" };
  }

  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_CHAT" });
  } catch {
    // Content script isn't there (tab predates the install, or a reload is due).
    return { ok: false, error: "Reload the chat tab, then try again" };
  }
  if (!res?.ok) return { ok: false, error: res?.error || "Couldn't read that chat" };

  const payload = res.payload;
  if (!payload?.messages?.length) return { ok: false, error: "No messages found on that page" };

  const out = await exportChat(payload, tab.id);
  return {
    ...out,
    title: payload.title,
    platform: payload.platform,
    messageCount: payload.messages.length,
    artifactCount: payload.artifacts?.length || 0
  };
}

/* ---------------- Resume ---------------- */

function buildResumePrompt(chat) {
  const transcript = chat.messages
    .map((m) => (m.role === "user" ? "**User:**" : "**Assistant:**") + "\n" + m.md)
    .join("\n\n");
  return (
    "I'm resuming a previous conversation. Below is the full transcript of what " +
    "we discussed before. Read it, then continue from where we left off — don't " +
    "re-answer everything, just pick up the thread.\n\n" +
    "----- PREVIOUS CONVERSATION -----\n\n" +
    transcript +
    "\n\n----- END OF TRANSCRIPT -----\n\n" +
    "Ready to continue."
  );
}

async function resumeChat(id) {
  const chat = await dbGet(id);
  if (!chat) return { ok: false, error: "Chat not found" };

  await chrome.storage.session.set({
    iv_resume: {
      platform: chat.platform,
      prompt: buildResumePrompt(chat),
      createdAt: Date.now()
    }
  });

  const url =
    chat.platform === "chatgpt"
      ? "https://chatgpt.com/?temporary-chat=true" // temporary mode via URL param
      : "https://claude.ai/new"; // content script clicks the ghost button

  await chrome.tabs.create({ url });
  return { ok: true };
}

/* ---------------- Message router ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        // sender.tab is the chat page — needed to press its download buttons.
        case "EXPORT_CHAT": sendResponse(await exportChat(msg.payload, sender.tab?.id)); break;
        case "SAVE_ACTIVE_TAB": sendResponse(await saveActiveTab()); break;
        case "LIST_CHATS": sendResponse({ ok: true, chats: await dbList() }); break;
        case "DELETE_CHAT": await dbDelete(msg.id); sendResponse({ ok: true }); break;
        case "REDOWNLOAD_CHAT": {
          const chat = await dbGet(msg.id);
          if (!chat) return sendResponse({ ok: false, error: "Not found" });
          // Artifacts too — a re-download should reproduce the whole folder.
          await downloadChatFiles(chat);
          sendResponse({ ok: true });
          break;
        }
        case "RESUME_CHAT": sendResponse(await resumeChat(msg.id)); break;
        default: sendResponse({ ok: false, error: "Unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep the channel open for the async response
});
