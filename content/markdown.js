/* Incognito Vault — minimal HTML → Markdown converter.
 * Purpose-built for chat message DOM (headings, lists, code, tables, links).
 * Kept dependency-free so the extension works fully offline.
 */
(function () {
  "use strict";

  const HTML_NS = "http://www.w3.org/1999/xhtml";

  // Tags whose text is never conversation: rendered graphics, embedded apps,
  // scripts/styles and form chrome. Anything here is dropped subtree and all.
  const SKIP_TAGS = new Set([
    "svg", "canvas", "math", "style", "script", "noscript", "template",
    "iframe", "object", "embed", "video", "audio", "source", "track",
    "link", "meta", "input", "select", "option", "textarea"
  ]);

  const SKIP_MATCH = [
    "button",
    "[role='button']",
    "[aria-hidden='true']",
    ".sr-only",          // visually-hidden screen-reader copy of the message
    "[role='status']",   // live-region narration ("Edited 2 files, ran a command")
    "[aria-live]",
    "[role='toolbar']"   // Copy / Retry / Good response / timestamps
  ].join(",");

  const BLOCK_TAGS = new Set([
    "address", "article", "aside", "blockquote", "br", "div", "dl", "dd", "dt",
    "figure", "figcaption", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table",
    "tbody", "td", "tfoot", "th", "thead", "tr", "ul"
  ]);

  function isBlock(node) {
    return (
      node &&
      node.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has(node.tagName.toLowerCase())
    );
  }

  function esc(text) {
    return text.replace(/\u00a0/g, " ");
  }

  /* A whitespace-only text node is source indentation, not content. Next to a
   * block element the browser renders nothing, so emit nothing \u2014 otherwise the
   * indentation around skipped nodes (diagrams, buttons) surfaces as ragged
   * blank lines in the transcript. Between inline nodes it is a real space. */
  function whitespaceOnly(node) {
    const prev = node.previousSibling;
    const next = node.nextSibling;
    return !prev || !next || isBlock(prev) || isBlock(next) ? "" : " ";
  }

  function childrenToMd(node, ctx) {
    let out = "";
    for (const child of node.childNodes) out += toMd(child, ctx);
    return out;
  }

  function codeLang(el) {
    const cls = (el.className || "") + " " + (el.parentElement?.className || "");
    const m = cls.match(/language-([\w+-]+)/);
    return m ? m[1] : "";
  }

  function tableToMd(table) {
    const rows = [...table.querySelectorAll("tr")].map((tr) =>
      [...tr.children].map((td) => childrenToMd(td, {}).trim().replace(/\|/g, "\\|"))
    );
    if (!rows.length) return "";
    const header = rows[0];
    const sep = header.map(() => "---");
    const body = rows.slice(1);
    return (
      "\n| " + header.join(" | ") + " |\n| " + sep.join(" | ") + " |\n" +
      body.map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n\n"
    );
  }

  function toMd(node, ctx = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim() ? esc(node.textContent) : whitespaceOnly(node);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node;
    const tag = el.tagName.toLowerCase();

    // Rendered vector graphics (mermaid diagrams, icons, charts) live in the
    // SVG namespace. Their text nodes are diagram labels — dumping them into
    // the transcript produces a soup of stray words, so drop the whole subtree.
    if (el.namespaceURI && el.namespaceURI !== HTML_NS) return "";
    if (SKIP_TAGS.has(tag)) return "";

    /* UI chrome embedded in message bubbles. `.sr-only` / live regions restate
     * the message for screen readers — keeping them doubles every line; action
     * toolbars contribute "Copy Retry Good response". */
    if (el.matches(SKIP_MATCH)) return "";

    switch (tag) {
      case "br": return "\n";
      case "hr": return "\n---\n";
      case "h1": return "\n# " + childrenToMd(el, ctx).trim() + "\n\n";
      case "h2": return "\n## " + childrenToMd(el, ctx).trim() + "\n\n";
      case "h3": return "\n### " + childrenToMd(el, ctx).trim() + "\n\n";
      case "h4": return "\n#### " + childrenToMd(el, ctx).trim() + "\n\n";
      case "h5": return "\n##### " + childrenToMd(el, ctx).trim() + "\n\n";
      case "h6": return "\n###### " + childrenToMd(el, ctx).trim() + "\n\n";
      case "p": return childrenToMd(el, ctx).trim() + "\n\n";
      case "strong":
      case "b": return "**" + childrenToMd(el, ctx).trim() + "**";
      case "em":
      case "i": return "*" + childrenToMd(el, ctx).trim() + "*";
      case "del":
      case "s": return "~~" + childrenToMd(el, ctx).trim() + "~~";
      case "a": {
        const href = el.getAttribute("href") || "";
        const text = childrenToMd(el, ctx).trim() || href;
        return href && !href.startsWith("javascript:") ? `[${text}](${href})` : text;
      }
      case "code": {
        if (el.closest("pre")) return el.textContent; // handled by <pre>
        return "`" + el.textContent + "`";
      }
      case "pre": {
        const codeEl = el.querySelector("code") || el;
        const lang = codeLang(codeEl);
        const body = codeEl.textContent.replace(/\n$/, "");
        return "\n```" + lang + "\n" + body + "\n```\n\n";
      }
      case "ul": {
        let out = "\n";
        for (const li of el.querySelectorAll(":scope > li")) {
          const inner = childrenToMd(li, ctx).trim().replace(/\n/g, "\n  ");
          out += "- " + inner + "\n";
        }
        return out + "\n";
      }
      case "ol": {
        let out = "\n";
        let i = parseInt(el.getAttribute("start") || "1", 10);
        for (const li of el.querySelectorAll(":scope > li")) {
          const inner = childrenToMd(li, ctx).trim().replace(/\n/g, "\n   ");
          out += `${i}. ` + inner + "\n";
          i++;
        }
        return out + "\n";
      }
      case "blockquote": {
        const inner = childrenToMd(el, ctx).trim();
        return "\n" + inner.split("\n").map((l) => "> " + l).join("\n") + "\n\n";
      }
      case "table": return tableToMd(el);
      case "img": {
        const alt = el.getAttribute("alt") || "image";
        const src = el.getAttribute("src") || "";
        return src.startsWith("data:") ? `*[inline image: ${alt}]*` : `![${alt}](${src})`;
      }
      default:
        return childrenToMd(el, ctx);
    }
  }

  window.__IV_htmlToMd = function (rootEl) {
    return toMd(rootEl)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };
})();
