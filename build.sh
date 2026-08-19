#!/usr/bin/env bash
# Assembles the loadable extensions in dist/:
#   ./build.sh chrome   → dist/chrome  (chrome://extensions → Load unpacked)
#   ./build.sh safari   → dist/safari  (+ rsync into the Xcode project's Resources)
#   ./build.sh          → both
#
# Shared code lives in shared/; each platform overlays its manifest and
# platform/ layer on top. Plain copies — no bundler, nothing is transformed —
# so an extension can never reference a file outside its own root.
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${1:-all}"
case "$TARGET" in
  chrome) TARGETS=(chrome) ;;
  safari) TARGETS=(safari) ;;
  all)    TARGETS=(chrome safari) ;;
  *) echo "usage: $0 [chrome|safari|all]" >&2; exit 1 ;;
esac

# Store limits fail at upload/review time, which is a slow way to find out —
# check both manifests here instead, and keep their versions in lockstep.
node -e '
const c = require("./chrome/manifest.json");
const s = require("./safari/manifest.json");
for (const [name, m] of [["chrome", c], ["safari", s]]) {
  const n = m.description.length;
  if (n > 132) { console.error(`${name}: description is ${n} chars, limit is 132`); process.exit(1); }
  if (!/^\d+(\.\d+){0,3}$/.test(m.version)) { console.error(`${name}: bad version: ${m.version}`); process.exit(1); }
}
if (c.version !== s.version) {
  console.error(`version mismatch: chrome ${c.version} vs safari ${s.version}`);
  process.exit(1);
}
console.log(`manifests ok — v${c.version}`);
'

# Where the Safari Xcode project keeps its embedded copy of the extension.
# Set after `xcrun safari-web-extension-converter` generates the project.
SAFARI_RESOURCES="safari/xcode/Incognito Vault/Shared (Extension)/Resources"

for p in "${TARGETS[@]}"; do
  out="dist/$p"
  rm -rf "$out"
  mkdir -p "$out"

  # shared/ lands flat at the extension root: background/ content/ popup/ lib/ icons/
  rsync -a --exclude ".DS_Store" shared/ "$out/"
  rsync -a --exclude ".DS_Store" "$p/platform" "$out/"
  cp "$p/manifest.json" "$out/manifest.json"
  if [ -f "$p/background.js" ]; then
    cp "$p/background.js" "$out/background.js" # Chrome's importScripts loader
  fi

  # Every file the manifest references must exist in the assembled output.
  node -e '
    const fs = require("fs"), path = require("path");
    const dir = process.argv[1];
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const files = new Set();
    for (const cs of m.content_scripts || [])
      for (const f of [...(cs.js || []), ...(cs.css || [])]) files.add(f);
    if (m.background?.service_worker) files.add(m.background.service_worker);
    for (const f of m.background?.scripts || []) files.add(f);
    if (m.action?.default_popup) files.add(m.action.default_popup);
    for (const f of Object.values(m.icons || {})) files.add(f);
    for (const f of Object.values(m.action?.default_icon || {})) files.add(f);
    const missing = [...files].filter((f) => !fs.existsSync(path.join(dir, f)));
    if (missing.length) { console.error(`missing from ${dir}: ${missing.join(", ")}`); process.exit(1); }
    console.log(`${dir}: all ${files.size} manifest-referenced files present`);
  ' "$out"

  if [ "$p" = "safari" ] && [ -d "$SAFARI_RESOURCES" ]; then
    rsync -a --delete "dist/safari/" "$SAFARI_RESOURCES/"
    echo "synced dist/safari → $SAFARI_RESOURCES"
  fi

  echo "assembled $out"
done
