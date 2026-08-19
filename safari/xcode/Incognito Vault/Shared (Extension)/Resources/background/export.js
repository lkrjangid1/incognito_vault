/* Incognito Vault — export builders: names, folder, Markdown transcript.
 * Shared by both platform save layers so the artifact numbering in the
 * transcript's 📎 list always matches the files that land next to it. */
"use strict";

(() => {
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

  /* opts.artifactCapture: whether this platform intercepts Claude's own
   * downloads into the chat folder (Chrome yes, Safari no) — it decides what
   * the transcript promises about content-less "ref" artifacts. */
  function buildMarkdown(chat, opts = {}) {
    const artifactCapture = opts.artifactCapture !== false;
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
        } else if (artifactCapture) {
          // Saved into this folder by Claude's own download, so the extension
          // depends on the artifact type Claude hands the browser.
          lines.push(
            `- \`${artifactStem(a, i)}.*\` — ${a.name}${a.type ? ` (${a.type})` : ""}, downloaded from Claude`
          );
        } else {
          lines.push(
            `- ${a.name}${a.type ? ` (${a.type})` : ""} — not saved; use Claude's own Download button for this file`
          );
        }
      });
      lines.push("");
    }
    return lines.join("\n");
  }

  function chatFolder(chat) {
    return `IncognitoVault/${stamp(chat.capturedAt)}_${slug(chat.title)}`;
  }

  IV.export = { slug, stamp, artifactStem, artifactFile, buildArtifactMarkdown, buildMarkdown, chatFolder };
})();
