#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/incognito-vault-chrome-<version>.zip
#
# Only the files the extension actually loads go in (build.sh assembles exactly
# those). Docs, git history and macOS metadata are left out — anything extra is
# surface area a reviewer has to account for, and .DS_Store files have failed
# uploads before. manifest.json must sit at the ROOT of the zip, so we zip from
# inside dist/chrome.
#
# Safari is not zipped here: App Store / notarized distribution is produced via
# Xcode (Product → Archive on safari/xcode), never from a zip. `./build.sh
# safari` keeps that project's Resources in sync with the source.
set -euo pipefail

cd "$(dirname "$0")"

./build.sh chrome

VERSION=$(node -p "require('./chrome/manifest.json').version")
OUT="dist/incognito-vault-chrome-${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"
( cd dist/chrome && zip -qr -X "$OLDPWD/$OUT" . -x "*.DS_Store" )

echo "built $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT"
