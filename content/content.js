/* Incognito Vault — content script for claude.ai and chatgpt.com
 *
 * Responsibilities:
 *  1. Inject a floating "Save to Vault" button.
 *  2. Scrape the visible conversation → { title, messages[], artifacts[] }.
 *  3. On resume: enable incognito/temporary mode and paste the stored
 *     transcript into the composer (never auto-sends).
 *
 * ⚠ SELECTOR MAINTENANCE:
 * Claude and ChatGPT change their DOM frequently. Every site-specific
 * selector lives in the SELECTORS object below — if scraping breaks,
 * this is the only place you should need to edit.
 */
(function () {
  "use strict";

  const HOST = location.hostname;
  const PLATFORM = HOST.includes("claude") ? "claude" : "chatgpt";
  const htmlToMd = window.__IV_htmlToMd;

  const SELECTORS = {
    claude: {
      // Each strategy is tried in order until one yields messages.
      userMsg: ['[data-testid="user-message"]'],
      // The conversation's own name, when the chat has one (never for incognito).
      chatTitle: [
        '[data-testid="chat-menu-trigger"]',
        '[data-testid="conversation-title"]',
        'button[data-testid*="chat-title"]'
      ],
      assistantMsg: [".font-claude-message", '[data-testid="assistant-message"]', ".font-claude-response"],
      // A container that holds one full conversation turn (used for ordering).
      turnContainer: ['[data-test-render-count]', "div[data-testid^='conversation-turn']"],
      composer: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
      incognitoToggle: [
        'button[aria-label*="ncognito"]',
        'a[aria-label*="ncognito"]',
        '[data-testid="incognito-toggle"]'
      ],
      // Best-effort: the artifact panel, when the user has it open. Ordered
      // specific → broad; every candidate is scored in scrapeClaudeArtifacts()
      // and the one with the most content wins, so loose selectors are safe.
      artifactPanel: [
        '[data-testid="artifact-content"]',
        '[data-testid="artifacts-panel"]',
        '[data-testid*="artifact" i]',
        "#artifacts-panel",
        '[id*="artifact" i]',
        'aside[class*="artifact" i]',
        'div[class*="artifact" i]'
      ],
      artifactTitle: [
        '[data-testid="artifact-title"]',
        'header h1',
        'h1',
        'h2'
      ],
      // Claude renders artifact source in a CodeMirror editor, not a <pre>.
      artifactCode: [".cm-content", ".cm-editor"]
    },
    chatgpt: {
      turnContainer: ['[data-testid^="conversation-turn"]', "article[data-turn]"],
      roleAttr: "[data-message-author-role]",
      chatTitle: [
        '[data-testid="conversation-header-title"]',
        'a[data-active][href^="/c/"]',
        'li[data-active] a[href^="/c/"]'
      ],
      composer: ["#prompt-textarea", 'div[contenteditable="true"]', "textarea"],
      temporaryUrl: "https://chatgpt.com/?temporary-chat=true"
    }
  };

  function q(selList, root = document) {
    for (const sel of selList) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function qa(selList, root = document) {
    for (const sel of selList) {
      const els = root.querySelectorAll(sel);
      if (els.length) return [...els];
    }
    return [];
  }

  /* ---------------- Scraping ---------------- */

  function scrapeClaude() {
    const messages = [];
    // Grab user + assistant nodes in document order.
    const userSel = SELECTORS.claude.userMsg.join(",");
    const asstSel = SELECTORS.claude.assistantMsg.join(",");
    const nodes = [...document.querySelectorAll(userSel + "," + asstSel)];
    for (const node of nodes) {
      const isUser = node.matches(userSel);
      const md = isUser ? htmlToMd(node) : assistantMd(node);
      if (md) messages.push({ role: isUser ? "user" : "assistant", md });
    }

    return { messages, artifacts: scrapeClaudeArtifacts() };
  }

  /* An assistant turn embeds a card per artifact it produced. Converting the
   * card as prose yields "Univest Code · HTML Download"; replace it with a
   * marker so the transcript records *which* artifact was produced where. */
  function assistantMd(node) {
    const cards = outermostCards(node);
    if (!cards.length) return htmlToMd(node);

    const clone = node.cloneNode(true);
    for (const c of clone.querySelectorAll(ARTIFACT_CARD)) c.remove();

    const markers = cards
      .map(readArtifactCard)
      .filter((a) => a.named)
      .map((a) => `*📎 Artifact: **${a.name}**${a.type ? ` — ${a.type}` : ""}*`);
    return [htmlToMd(clone), ...markers].filter(Boolean).join("\n\n");
  }

  /* ---------------- Claude artifacts ----------------
   * The artifact panel is a moving target: source can be a <pre>, a CodeMirror
   * editor (no <pre> at all — this is why capture used to come back empty), a
   * rendered Markdown document, or a rendered SVG/mermaid diagram. Read each
   * shape explicitly instead of falling back to textContent, which flattens a
   * diagram into a meaningless run of its layer labels.
   */

  const LANG_BY_EXT = {
    js: "javascript", mjs: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin",
    swift: "swift", dart: "dart", c: "c", h: "c", cpp: "cpp", cc: "cpp", cs: "csharp",
    php: "php", sh: "bash", bash: "bash", zsh: "bash", sql: "sql", json: "json",
    yml: "yaml", yaml: "yaml", toml: "toml", xml: "xml", svg: "svg", html: "html",
    css: "css", scss: "scss", md: "markdown", mmd: "mermaid", txt: ""
  };

  function langFromName(name) {
    const ext = (String(name).match(/\.([a-z0-9]+)\s*$/i)?.[1] || "").toLowerCase();
    return LANG_BY_EXT[ext] ?? "";
  }

  function langFromClass(el) {
    const cls = `${el.className || ""} ${el.parentElement?.className || ""}`;
    return cls.match(/language-([\w+-]+)/)?.[1] || "";
  }

  /* The card Claude renders inside a message for each artifact it produced.
   * It is the only artifact evidence present when the side panel is closed —
   * it carries the name, the type, and the View/Download controls. */
  const ARTIFACT_CARD = '[class*="artifact-block"]';

  // Both the wrapper and its inner cell match; keep only the outer one.
  function outermostCards(root) {
    return [...root.querySelectorAll(ARTIFACT_CARD)].filter(
      (c) => !c.parentElement?.closest(ARTIFACT_CARD)
    );
  }

  function readArtifactCard(card) {
    const view = card.querySelector('button[aria-label^="View "]');
    const download = card.querySelector('button[aria-label^="Download "]');
    const cell = card.querySelector('[class*="artifact-block-cell"]') || card;
    const leaves = [...cell.querySelectorAll("div")].filter(
      (d) => !d.querySelector("div") && d.textContent.trim()
    );
    const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

    const labelled = view?.getAttribute("aria-label")?.replace(/^View\s+/i, "").trim();
    const name = labelled || text(leaves[0]);
    // Second line is the type badge, e.g. "Code · HTML".
    const type = text(leaves.find((l) => l.textContent.includes("·")) || leaves[1]);
    // No name ⇒ not an artifact card, just a lookalike wrapper; ignore it.
    return { name, type: type === name ? "" : type, view, download, card, named: !!name };
  }

  // Latest card for each artifact name — Claude renders one per revision.
  function collectArtifactCards() {
    const byName = new Map();
    for (const card of outermostCards(document)) {
      const info = readArtifactCard(card);
      if (info.named) byName.set(info.name, info);
    }
    return [...byName.values()];
  }

  // Remembered from the last scrape so DOWNLOAD_ARTIFACTS can click them.
  let artifactCards = [];

  const msgSelector = () =>
    [...SELECTORS.claude.userMsg, ...SELECTORS.claude.assistantMsg].join(",");
  const panelSelector = () => SELECTORS.claude.artifactPanel.join(",");

  const isVisible = (el) => el.getClientRects().length > 0;
  const inConversation = (el) => !!el.closest(msgSelector());
  const inComposer = (el) => !!el.closest('[contenteditable="true"], form');

  // Look for a heading near the content; the panel container has no reliable name.
  function titleWithin(root) {
    for (const sel of SELECTORS.claude.artifactTitle) {
      const el = root.querySelector(sel);
      const t = el?.textContent?.trim();
      if (el && t && t.length < 120 && !inConversation(el)) return t;
    }
    return "";
  }

  function artifactName(node) {
    const panel = node.closest(panelSelector());
    if (panel) {
      const t = titleWithin(panel);
      if (t) return t;
    }
    let el = node.parentElement;
    for (let hops = 0; el && hops < 8; hops++, el = el.parentElement) {
      const t = titleWithin(el);
      if (t) return t;
    }
    return "artifact";
  }

  function readCodeMirror(editor) {
    const lines = [...editor.querySelectorAll(".cm-line")];
    const content = (lines.length ? lines.map((l) => l.textContent).join("\n") : editor.textContent)
      .replace(/​/g, "") // CodeMirror pads empty lines with zero-width spaces
      .replace(/\s+$/, "");
    if (!content.trim()) return null;

    /* CodeMirror only keeps the visible slice of a long document in the DOM.
     * The editor element is sized for the whole file, so a big gap between that
     * height and the rendered lines means we captured a partial file. */
    const lineH = lines[0]?.getBoundingClientRect().height || 0;
    const editorH = editor.getBoundingClientRect().height;
    if (lineH && editorH > lines.length * lineH * 1.5) {
      console.log(
        "[Incognito Vault] artifact source looks truncated — CodeMirror virtualizes long files,",
        `only ${lines.length} lines were in the DOM. Use Claude's own download button for this one.`
      );
    }

    const name = artifactName(editor);
    return { name, kind: "code", lang: langFromName(name), content };
  }

  function readPre(pre) {
    const codeEl = pre.querySelector("code") || pre;
    const content = codeEl.textContent.replace(/\s+$/, "");
    if (!content.trim()) return null;
    const name = artifactName(pre);
    return { name, kind: "code", lang: langFromClass(codeEl) || langFromName(name), content };
  }

  // A rendered diagram/illustration — as opposed to the icons that pepper the UI.
  function isDiagramSvg(svg) {
    if (svg.closest("button, [role='button'], a")) return false; // icon on a control
    const r = svg.getBoundingClientRect();
    const area = r.width * r.height;
    const isRich = !!svg.querySelector("text, foreignObject, image");
    return area >= 40000 || (isRich && area >= 5000);
  }

  function readSvg(svg) {
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return { name: artifactName(svg), kind: "svg", lang: "svg", content: clone.outerHTML };
  }

  /* Detection is CONTENT-first, not container-first: never assume the panel has
   * "artifact" in a class or testid — it often doesn't, and then nothing is
   * captured at all. Look instead for the things an artifact is made of,
   * anywhere outside the conversation and the composer. */
  function collectClaudeArtifacts() {
    const found = [];
    const add = (a) => a && a.content && found.push(a);
    const usable = (el) => isVisible(el) && !inConversation(el) && !inComposer(el);

    // 1. CodeMirror source views (.cm-editor wraps .cm-content — keep the inner one).
    const codeSel = SELECTORS.claude.artifactCode.join(",");
    for (const ed of document.querySelectorAll(codeSel)) {
      if (!usable(ed) || ed.querySelector(codeSel)) continue;
      add(readCodeMirror(ed));
    }

    // 2. Plain <pre> source views.
    for (const pre of document.querySelectorAll("pre")) {
      if (!usable(pre)) continue;
      add(readPre(pre));
    }

    // 3. Rendered diagrams — the SVG markup itself, never its label text.
    for (const svg of document.querySelectorAll("svg")) {
      if (!usable(svg) || !isDiagramSvg(svg)) continue;
      add(readSvg(svg));
    }

    // 4. Rendered Markdown documents, for panels we can actually identify.
    for (const panel of document.querySelectorAll(panelSelector())) {
      if (!usable(panel) || panel.querySelector(msgSelector())) continue;
      const md = htmlToMd(panel);
      if (md && md.trim().length > 40) {
        add({
          name: titleWithin(panel) || artifactName(panel),
          kind: "doc",
          lang: "",
          content: md.trim()
        });
      }
    }

    return found;
  }

  // Source beats a rendered diagram beats a rendered document.
  const KIND_RANK = { code: 3, svg: 2, doc: 1 };

  /* Dumps what was on the page when nothing was captured. Content-script logs
   * land in the page's own console, so this is the first thing to read when
   * artifacts "aren't exporting". */
  function logEmptyArtifactScan() {
    const count = (sel) => document.querySelectorAll(sel).length;
    console.log(
      "[Incognito Vault] no artifact captured — is the artifact panel open? DOM scan:",
      {
        codeMirrorEditors: count(SELECTORS.claude.artifactCode.join(",")),
        preBlocks: count("pre"),
        svgElements: count("svg"),
        iframes: count("iframe"),
        artifactNamedNodes: count(panelSelector())
      },
      "\nHTML/React artifacts render inside a sandboxed cross-origin iframe and cannot be read by any extension.",
      "\nIf iframes is 0 while the panel is open, the SELECTORS object at the top of this file needs updating."
    );
  }

  function scrapeClaudeArtifacts() {
    let candidates = [];
    try {
      candidates = collectClaudeArtifacts();
    } catch (e) {
      // An artifact problem must never block saving the transcript.
      console.log("[Incognito Vault] artifact scan failed:", e);
    }

    // Content we could read straight off the open panel.
    let best = null;
    for (const art of candidates) {
      const better =
        !best ||
        KIND_RANK[art.kind] > KIND_RANK[best.kind] ||
        (art.kind === best.kind && art.content.length > best.content.length);
      if (better) best = art;
    }
    const artifacts = best ? [best] : [];

    /* Everything else the conversation says exists. A ref carries no content —
     * the file itself comes from Claude's own Download button, which is the
     * only way to get HTML/React artifacts and long files in full. */
    try {
      artifactCards = collectArtifactCards();
    } catch (e) {
      console.log("[Incognito Vault] artifact card scan failed:", e);
      artifactCards = [];
    }
    for (const card of artifactCards) {
      if (artifacts.some((a) => a.name === card.name)) continue;
      artifacts.push({
        name: card.name,
        kind: "ref",
        lang: "",
        type: card.type,
        downloadable: !!card.download,
        content: ""
      });
    }

    if (!artifacts.length) logEmptyArtifactScan();
    return artifacts;
  }

  function scrapeChatGPT() {
    const messages = [];
    const turns = qa(SELECTORS.chatgpt.turnContainer);
    const source = turns.length
      ? turns
      : [...document.querySelectorAll(SELECTORS.chatgpt.roleAttr)];
    for (const turn of source) {
      const roleEl = turn.matches(SELECTORS.chatgpt.roleAttr)
        ? turn
        : turn.querySelector(SELECTORS.chatgpt.roleAttr);
      if (!roleEl) continue;
      const role = roleEl.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") continue;
      const md = htmlToMd(roleEl);
      if (md) messages.push({ role, md });
    }
    return { messages, artifacts: [] };
  }

  /* ---------------- Title derivation ----------------
   * Incognito / temporary chats are never named by the site, so
   * `document.title` is almost always "Claude", "ChatGPT" or "New chat".
   * Order of preference: the chat's real name → a usable document.title →
   * the opening user message → the opening assistant message.
   */

  // Titles that carry no information — treated as "no title at all".
  const TITLE_JUNK = new Set([
    "claude", "claude.ai", "chatgpt", "chat gpt", "chatgpt.com", "openai",
    "new chat", "new conversation", "untitled", "untitled chat", "chat",
    "temporary chat", "temporary", "incognito", "incognito chat"
  ]);
  // Model names sometimes sit in the header next to the title. Matches only
  // strings made up *entirely* of model-name tokens, so "Optimising a query
  // plan" survives while "Claude Opus 4.5" / "GPT-4o" / "o3-mini" don't.
  const MODEL_RE =
    /^(?:claude|chatgpt|gpt|opus|sonnet|haiku|turbo|instant|mini|pro|preview|latest|o\d*|[\d.]+|[-–—.\s])+$/i;

  function cleanTitle(raw) {
    let t = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/^\(\d+\)\s*/, "")                                   // "(3) ChatGPT"
      .replace(/\s*[-–—|\\/·]\s*(Claude|ChatGPT|OpenAI)(\.ai)?\s*$/i, "")
      .replace(/^(Claude|ChatGPT)\s*[-–—|\\/·]\s*/i, "")
      .trim();
    if (!t) return "";
    if (TITLE_JUNK.has(t.toLowerCase())) return "";
    if (MODEL_RE.test(t)) return "";
    return t;
  }

  // Turn the first message into a short, human-readable headline.
  function titleFromMd(md) {
    const plain = String(md || "")
      .replace(/```[\s\S]*?```/g, "\n")                    // drop fenced code
      .replace(/`([^`]*)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")               // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")             // links → text
      .replace(/^\s*(?:[>\-*+]\s+|\d+[.)]\s+|#{1,6}\s+)/gm, "")
      .replace(/[*_~]+/g, "");

    // The opening line is the headline (a "# Heading" has already lost its #).
    const lines = plain.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) return "";
    let t = lines[0];
    // A bare greeting says nothing — pull in the next line too.
    if (t.length < 12 && lines[1]) t = `${t} ${lines[1]}`;

    // Prefer the opening sentence(s), as long as they say something.
    const sentences = t.split(/(?<=[.!?])\s+/);
    let head = sentences[0];
    for (let i = 1; head.length < 15 && sentences[i]; i++) head += " " + sentences[i];
    if (head.length <= 70) t = head;

    if (t.length > 60) {
      t = t.slice(0, 60);
      const sp = t.lastIndexOf(" ");
      if (sp > 24) t = t.slice(0, sp);
      t = t.replace(/[\s,;:.\-–—]+$/, "") + "…";
    }
    return t.replace(/[.\s]+$/, "").trim();
  }

  // Named conversations live under /c/<id> (ChatGPT) or /chat/<id> (Claude).
  // Anywhere else the page is an ephemeral chat, and the header/sidebar title
  // still belongs to whatever conversation was open before — don't trust it.
  function isNamedConversation() {
    return PLATFORM === "chatgpt"
      ? /^\/c\//.test(location.pathname)
      : /^\/chat\//.test(location.pathname);
  }

  function deriveTitle(messages) {
    if (isNamedConversation()) {
      const titleEl = q(SELECTORS[PLATFORM].chatTitle || []);
      const fromPage = cleanTitle(titleEl?.textContent);
      if (fromPage) return fromPage;

      const fromDoc = cleanTitle(document.title);
      if (fromDoc) return fromDoc;
    }

    const firstUser = messages.find((m) => m.role === "user");
    const fromUser = titleFromMd(firstUser?.md);
    if (fromUser) return fromUser;

    const fromAny = titleFromMd(messages[0]?.md);
    if (fromAny) return fromAny;

    return "Untitled chat";
  }

  function scrape() {
    const { messages, artifacts } =
      PLATFORM === "claude" ? scrapeClaude() : scrapeChatGPT();
    const title = deriveTitle(messages);
    return {
      platform: PLATFORM,
      title,
      url: location.href,
      capturedAt: Date.now(),
      messages,
      artifacts
    };
  }

  /* ---------------- Floating button ---------------- */

  function injectButton() {
    if (document.getElementById("iv-save-btn")) return;
    const btn = document.createElement("button");
    btn.id = "iv-save-btn";
    btn.type = "button";
    btn.textContent = "Save to Vault";
    btn.title = "Export this chat to Markdown + local history (Incognito Vault)";
    btn.addEventListener("click", async () => {
      const payload = scrape();
      if (!payload.messages.length) {
        flash(btn, "No messages found", true);
        return;
      }
      btn.disabled = true;
      try {
        const res = await chrome.runtime.sendMessage({ type: "EXPORT_CHAT", payload });
        const n = payload.artifacts.length;
        // Claude always reports the artifact state — "no artifact" is the
        // signal that the panel wasn't open (or the selectors need a look).
        const artifactNote = n
          ? `, ${n} artifact${n > 1 ? "s" : ""}`
          : PLATFORM === "claude"
            ? ", no artifact"
            : "";
        const detail = `${payload.messages.length} msgs${artifactNote}`;
        flash(btn, res?.ok ? `Saved ✓ (${detail})` : "Save failed", !res?.ok);
      } catch (e) {
        flash(btn, "Save failed", true);
      } finally {
        btn.disabled = false;
      }
    });
    document.documentElement.appendChild(btn);
  }

  function flash(btn, text, isError) {
    const prev = "Save to Vault";
    btn.textContent = text;
    btn.classList.toggle("iv-error", !!isError);
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove("iv-error");
    }, 2200);
  }

  /* ---------------- Resume flow ---------------- */

  function insertIntoComposer(text) {
    const composer = q(SELECTORS[PLATFORM].composer);
    if (!composer) return false;
    composer.focus();
    if (composer.tagName === "TEXTAREA") {
      composer.value = text;
      composer.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable (ProseMirror on both sites) — execCommand still
      // works in Chromium and correctly triggers the editor's state update.
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
    return true;
  }

  async function tryEnableClaudeIncognito() {
    const toggle = q(SELECTORS.claude.incognitoToggle);
    if (toggle) {
      toggle.click();
      await new Promise((r) => setTimeout(r, 1200)); // wait for UI switch
      return true;
    }
    return false;
  }

  async function handleResumeIfPending() {
    let stash;
    try {
      stash = await chrome.storage.session.get("iv_resume");
    } catch {
      return;
    }
    const job = stash?.iv_resume;
    if (!job || job.platform !== PLATFORM) return;
    if (Date.now() - job.createdAt > 2 * 60 * 1000) {
      chrome.storage.session.remove("iv_resume");
      return;
    }
    chrome.storage.session.remove("iv_resume");

    if (PLATFORM === "claude") {
      const ok = await tryEnableClaudeIncognito();
      if (!ok) notice("Couldn't find the incognito (ghost) button — click it manually, then paste. Transcript copied to clipboard.");
    }
    // Give the composer a moment to mount after any mode switch.
    await new Promise((r) => setTimeout(r, 800));
    const inserted = insertIntoComposer(job.prompt);
    if (!inserted) {
      try {
        await navigator.clipboard.writeText(job.prompt);
        notice("Composer not found — transcript copied to clipboard, paste it manually.");
      } catch {
        notice("Composer not found and clipboard blocked. Re-open the chat from the Vault popup.");
      }
    } else {
      notice("Transcript inserted. Review it, then press Enter to continue the conversation.");
    }
  }

  function notice(text) {
    const n = document.createElement("div");
    n.id = "iv-notice";
    n.textContent = text;
    document.documentElement.appendChild(n);
    setTimeout(() => n.remove(), 6000);
  }

  /* ---------------- Popup-initiated save ----------------
   * The popup can't touch the page DOM, so it asks the service worker,
   * which forwards SCRAPE_CHAT here and does the export/persist itself.
   */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "SCRAPE_CHAT") {
      try {
        sendResponse({ ok: true, payload: scrape() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }

    /* The SW asks for this after the transcript is written: press Claude's own
     * Download button on each artifact card. The SW is armed to redirect the
     * resulting file into the chat's folder. */
    if (msg?.type === "DOWNLOAD_ARTIFACTS") {
      (async () => {
        const wanted = new Set(msg.names || []);
        let clicked = 0;
        for (const card of artifactCards) {
          if (wanted.size && !wanted.has(card.name)) continue;
          if (!card.download) {
            console.log(`[Incognito Vault] "${card.name}" card has no Download button`);
            continue;
          }
          console.log(`[Incognito Vault] pressing Download on "${card.name}"`);
          card.download.click();
          clicked++;
          await new Promise((r) => setTimeout(r, 900)); // let each download start
        }
        if (!clicked) {
          console.log(
            "[Incognito Vault] no artifact Download button was pressed.",
            `Cards found: ${artifactCards.length}`,
            artifactCards.map((c) => `${c.name}${c.download ? "" : " (no download btn)"}`)
          );
        }
        sendResponse({ ok: true, clicked });
      })();
      return true;
    }
  });

  /* ---------------- Boot ---------------- */

  // Sites are SPAs; keep the button alive across route changes.
  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectButton();
  handleResumeIfPending();
})();
