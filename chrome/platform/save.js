/* Incognito Vault — Chrome save layer.
 * Writes each export file into Downloads/IncognitoVault/<chat>/ via
 * chrome.downloads, and uses onDeterminingFilename to re-assert our own paths
 * and to rename Claude's artifact downloads into the chat's folder. */
"use strict";

(() => {
  IV.platform = "chrome";

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
    return IV.api.downloads.download({
      url: textToDataUrl(text, mimeFor(filename)),
      filename,
      conflictAction: "uniquify",
      saveAs: false
    });
  }

  // Ours if the extension started it, or if it's one of our data: URLs.
  function takeOwnPath(item) {
    const mine =
      item.byExtensionId === IV.api.runtime.id || (item.url || "").startsWith("data:");
    return mine && ownPaths.length ? ownPaths.shift() : null;
  }

  async function downloadChatFiles(chat) {
    ownPaths.length = 0; // drop anything left over from a run that failed midway
    const folder = IV.export.chatFolder(chat);
    await download(
      `${folder}/${IV.export.slug(chat.title)}.md`,
      IV.export.buildMarkdown(chat, { artifactCapture: true })
    );
    const artifacts = chat.artifacts || [];
    for (let i = 0; i < artifacts.length; i++) {
      // Refs carry no content — their file comes from Claude's own download.
      if (!artifacts[i].content) continue;
      await download(
        `${folder}/${IV.export.artifactFile(artifacts[i], i)}`,
        IV.export.buildArtifactMarkdown(artifacts[i], i)
      );
    }
  }

  /* ---------------- Artifacts saved through Claude's own button ----------------
   * HTML/React artifacts render in a sandboxed cross-origin iframe and long files
   * are virtualized by CodeMirror, so neither can be read out of the DOM. Claude's
   * own Download button always produces the complete file — the content script
   * presses it and this listener redirects the file into the chat's folder. */

  /* The capture record lives in IV.store, not a module variable: the MV3
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
    const stash = await IV.store.get(CAPTURE_KEY);
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
    if (item.byExtensionId === IV.api.runtime.id) return suggest(); // ours, unqueued
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
      await IV.store.set({ [CAPTURE_KEY]: cap });

      const filename = `${cap.folder}/${name}${ext ? "." + ext : ""}`;
      console.log(`[Incognito Vault] artifact download "${base}" → ${filename}`);
      suggest({ filename, conflictAction: "uniquify" });
    })();
    return true; // suggest() is called asynchronously
  }

  // Guarded: a browser without this event must not take the whole worker down.
  if (IV.api.downloads?.onDeterminingFilename) {
    IV.api.downloads.onDeterminingFilename.addListener(onDeterminingFilename);
  } else {
    console.log("[Incognito Vault] downloads.onDeterminingFilename unavailable — artifact files keep Claude's own names");
  }

  async function captureArtifactFiles(tabId, chat) {
    const refs = (chat.artifacts || [])
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.kind === "ref");
    if (!refs.length) return 0;

    // Armed even when we can't click: a manual Download still lands in the folder.
    await IV.store.set({
      [CAPTURE_KEY]: {
        folder: IV.export.chatFolder(chat),
        stems: refs.map(({ a, i }) => IV.export.artifactStem(a, i)),
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
      const res = await IV.api.tabs.sendMessage(tabId, {
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

  IV.save = {
    capabilities: { artifactCapture: true },
    async exportFiles(chat, tabId) {
      await downloadChatFiles(chat);
      // Redownload passes no tab: reproduce the built files without re-arming
      // the artifact interception or pressing site buttons (same as before).
      const downloadedArtifacts = tabId != null ? await captureArtifactFiles(tabId, chat) : 0;
      return { downloadedArtifacts };
    }
  };
})();
