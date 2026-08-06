#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/incognito-vault-<version>.zip
#
# Only the files the extension actually loads go in. Docs, git history and
# macOS metadata are left out — anything extra is surface area a reviewer has
# to account for, and .DS_Store files have failed uploads before.
#
# manifest.json must sit at the ROOT of the zip, so this stages the payload in
# a temp directory and zips from inside it.
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/incognito-vault-${VERSION}.zip"

# The extension's actual payload — keep in sync with manifest.json.
FILES=(
  manifest.json
  background.js
  content/markdown.js
  content/content.js
  content/content.css
  popup/popup.html
  popup/popup.css
  popup/popup.js
  icons/icon16.png
  icons/icon48.png
  icons/icon128.png
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

# The store rejects a description over 132 characters at upload time, which is
# a slow way to find out. Fail here instead.
node -e '
const m = require("./manifest.json");
const n = m.description.length;
if (n > 132) { console.error(`description is ${n} chars, limit is 132`); process.exit(1); }
if (!/^\d+(\.\d+){0,3}$/.test(m.version)) { console.error(`bad version: ${m.version}`); process.exit(1); }
console.log(`manifest ok — v${m.version}, description ${n}/132 chars`);
'

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$STAGE/$(dirname "$f")"
  cp "$f" "$STAGE/$f"
done

mkdir -p dist
rm -f "$OUT"
( cd "$STAGE" && zip -qr -X "$OLDPWD/$OUT" . )

echo "built $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT"
