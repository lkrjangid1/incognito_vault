/* Incognito Vault — saves a { zipName, files } bundle from a DOM context.
 * Safari's background has no window or user gesture to hang a download on, so
 * the context that received the click (content script or popup) builds the
 * ZIP and clicks a blob link. Chrome's background saves real files itself and
 * never puts a bundle in its responses, so this is never called there. */
"use strict";

(() => {
  async function downloadZip({ zipName, files, timestamp }) {
    const bytes = IV.zip.build(files, timestamp);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    a.style.display = "none";
    (document.body || document.documentElement).appendChild(a);
    a.click();
    a.remove();
    // Revoking too early cancels the download in Safari — give it a moment.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  IV.downloadZip = downloadZip;
})();
