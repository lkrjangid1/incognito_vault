"use strict";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const saveEl = document.getElementById("save-current");
const statusEl = document.getElementById("status");
const confirmEl = document.getElementById("confirm-delete");
const confirmTextEl = document.getElementById("confirm-text");

let chats = [];
let statusTimer = null;

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const visible = chats.filter((c) => !q || c.title.toLowerCase().includes(q));
  listEl.innerHTML = "";
  emptyEl.hidden = chats.length > 0;

  for (const c of visible) {
    const li = document.createElement("li");
    li.className = "row";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = c.title;
    title.title = c.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `<span class="platform">${c.platform}</span> · ${fmtDate(c.capturedAt)}` +
      ` · ${c.messageCount} msgs` +
      (c.artifactCount ? ` · ${c.artifactCount} artifact${c.artifactCount > 1 ? "s" : ""}` : "");

    const actions = document.createElement("div");
    actions.className = "actions";

    const resume = btn("Resume ▸", "resume", async () => {
      await send({ type: "RESUME_CHAT", id: c.id });
      window.close();
    });
    resume.title = "Open a fresh incognito/temporary chat pre-filled with this transcript";

    const dl = btn(".md", "", async () => {
      await send({ type: "REDOWNLOAD_CHAT", id: c.id });
    });
    dl.title = "Download the Markdown export again";

    const del = btn("✕", "del", async () => {
      if (!(await confirmDelete(c.title))) return;
      await send({ type: "DELETE_CHAT", id: c.id });
      chats = chats.filter((x) => x.id !== c.id);
      render();
      setStatus(`Deleted “${c.title}”`);
    });
    del.title = "Remove from vault (already-downloaded files are kept)";

    actions.append(resume, dl, del);
    li.append(title, meta, actions);
    listEl.appendChild(li);
  }
}

/* Deleting is the one irreversible action in the popup, so it asks first.
 * A native confirm() can dismiss the popup itself and lose the answer — this
 * modal stays inside the popup document. Escape or Cancel resolves false. */
function confirmDelete(title) {
  return new Promise((resolve) => {
    confirmTextEl.textContent = `“${title}” will be removed from the vault.`;
    confirmEl.returnValue = "cancel";
    confirmEl.addEventListener(
      "close",
      () => resolve(confirmEl.returnValue === "delete"),
      { once: true }
    );
    confirmEl.showModal();
  });
}

function btn(label, cls, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

async function load() {
  const res = await send({ type: "LIST_CHATS" });
  chats = res?.chats || [];
  render();
}

function setStatus(text, isError, autoClear = true) {
  clearTimeout(statusTimer);
  statusEl.textContent = text;
  statusEl.classList.toggle("error", !!isError);
  statusEl.hidden = !text;
  if (text && autoClear) {
    statusTimer = setTimeout(() => {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }, 4500);
  }
}

// Same job as the floating in-page button, driven from the popup: the SW asks
// the active tab's content script to scrape, then exports + persists.
saveEl.addEventListener("click", async () => {
  saveEl.disabled = true;
  setStatus("Saving…", false, false);
  try {
    const res = await send({ type: "SAVE_ACTIVE_TAB" });
    if (res?.ok) {
      const n = res.artifactCount || 0;
      const artifactNote = n
        ? ` · ${n} artifact${n > 1 ? "s" : ""}`
        : res.platform === "claude"
          ? " · no artifact"
          : "";
      setStatus(`Saved “${res.title}” · ${res.messageCount} msgs${artifactNote}`);
      await load();
    } else {
      setStatus(res?.error || "Save failed", true);
    }
  } catch (e) {
    setStatus("Save failed — reload the extension", true);
  } finally {
    saveEl.disabled = false;
  }
});

searchEl.addEventListener("input", render);
load();
