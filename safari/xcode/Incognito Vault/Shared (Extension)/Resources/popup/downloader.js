/* Incognito Vault — download page, opened in a real tab by the popup on
 * Safari. The popup can't hand out a ZIP itself: iOS destroys the popup the
 * moment Safari takes focus, and a blob URL dies with the context that created
 * it (the user sees "WebKitBlobResource error 1"). This page lives in an
 * ordinary tab, so its blob stays valid, and the button click is the real user
 * gesture Safari wants a download to ride on. */
"use strict";

(() => {
  const nameEl = document.getElementById("name");
  const saveEl = document.getElementById("save");
  const statusEl = document.getElementById("status");

  function status(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  (async () => {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) return status("No chat id in the URL.", "error");

    let res;
    try {
      res = await IV.api.runtime.sendMessage({ type: "REDOWNLOAD_CHAT", id });
    } catch {
      return status("Couldn't reach the extension — close this tab and try again.", "error");
    }
    if (!res?.ok) return status(res?.error || "That chat isn't in the vault any more.", "error");

    // Chrome never lands here (its background writes real files and the popup
    // never opens this page), but answer sensibly if it ever does.
    if (!res.download) return status("Files saved to Downloads/IncognitoVault/.", "ok");

    const bundle = res.download;
    nameEl.textContent = bundle.zipName;
    status(`${bundle.files.length} file${bundle.files.length > 1 ? "s" : ""} ready.`);
    saveEl.hidden = false;
    saveEl.addEventListener("click", async () => {
      try {
        /* iOS/iPadOS: the download manager won't fetch a blob link from this
         * extension-scheme page (it works fine from the https chat page), so
         * hand the ZIP to the share sheet instead — its "Save to Files" is the
         * native way to land a file on disk. share() must run inside the click
         * handler to count as a user gesture; IV.zip.build is sync, so it does. */
        const file = new File([IV.zip.build(bundle.files, bundle.timestamp)],
          bundle.zipName, { type: "application/zip" });
        if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          status("Saved — pick “Save to Files” if you haven't.", "ok");
          return;
        }
        await IV.downloadZip(bundle); // desktop: plain blob download
        status("Saved — check your downloads.", "ok");
      } catch (e) {
        if (e?.name === "AbortError") return; // user closed the share sheet
        status(String(e?.message || e), "error");
      }
    });
  })();
})();
