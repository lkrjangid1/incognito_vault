/* Incognito Vault — background core: export orchestration, popup save, and
 * the message router. Platform-specific file I/O lives behind IV.save
 * (chrome/platform/save.js writes real files via chrome.downloads;
 * safari/platform/save.js returns a ZIP bundle the caller saves itself). */
"use strict";

(() => {
  async function exportChat(payload, tabId) {
    const id = crypto.randomUUID();
    const chat = { id, ...payload };

    const saved = await IV.save.exportFiles(chat, tabId);

    await IV.db.put({
      ...chat,
      messageCount: chat.messages.length,
      artifactCount: chat.artifacts?.length || 0
    });
    return {
      ok: true,
      id,
      downloaded: saved.downloadedArtifacts || 0,
      ...(saved.download ? { download: saved.download } : {})
    };
  }

  const SUPPORTED_URL = /^https:\/\/(claude\.ai|chatgpt\.com|chat\.openai\.com)\//i;

  /* Popup → background → content script (the popup has no access to the page
   * DOM). `tab.url` is readable without the broad "tabs" permission because
   * the manifest holds host permissions for exactly these three origins — any
   * other tab comes back with no url, which is the same answer as "unsupported
   * site". Don't add "tabs" back: it makes the store listing warn about
   * reading the user's browsing history across every site. Safari treats even
   * these hosts as opt-in per site, so its copy points at the grant flow. */
  async function saveActiveTab() {
    const [tab] = await IV.api.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return { ok: false, error: "No active tab" };
    if (!SUPPORTED_URL.test(tab.url || "")) {
      return {
        ok: false,
        error:
          IV.platform === "safari"
            ? "Open a claude.ai or chatgpt.com chat, then allow Incognito Vault on that site (toolbar icon → Always Allow)"
            : "Open a claude.ai or chatgpt.com chat first"
      };
    }

    let res;
    try {
      res = await IV.api.tabs.sendMessage(tab.id, { type: "SCRAPE_CHAT" });
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

  /* ---------------- Message router ---------------- */

  IV.api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        switch (msg.type) {
          // sender.tab is the chat page — needed to press its download buttons.
          case "EXPORT_CHAT": sendResponse(await exportChat(msg.payload, sender.tab?.id)); break;
          case "SAVE_ACTIVE_TAB": sendResponse(await saveActiveTab()); break;
          case "LIST_CHATS": sendResponse({ ok: true, chats: await IV.db.list() }); break;
          case "DELETE_CHAT": await IV.db.remove(msg.id); sendResponse({ ok: true }); break;
          case "REDOWNLOAD_CHAT": {
            const chat = await IV.db.get(msg.id);
            if (!chat) return sendResponse({ ok: false, error: "Not found" });
            // Artifacts too — a re-download should reproduce the whole folder.
            const saved = await IV.save.exportFiles(chat, null);
            sendResponse({ ok: true, ...(saved.download ? { download: saved.download } : {}) });
            break;
          }
          case "RESUME_CHAT": sendResponse(await IV.resume.chat(msg.id)); break;
          case "GET_RESUME": sendResponse(await IV.resume.take(msg.platform)); break;
          default: sendResponse({ ok: false, error: "Unknown message" });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // keep the channel open for the async response
  });
})();
