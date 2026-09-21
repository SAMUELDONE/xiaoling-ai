#!/usr/bin/env bash
set -euo pipefail
PRODUCT_NAME="$(node -p "require('./package.json').productName || 'Xiaoling AI'")"
APP_PATH="${1:-dist/mac-arm64/${PRODUCT_NAME}.app}"
if [ "$#" -eq 0 ] && [ ! -d "$APP_PATH" ] && [ -d 'dist/mac-arm64/Kun.app' ]; then
  APP_PATH='dist/mac-arm64/Kun.app'
fi
if [ ! -d "$APP_PATH" ]; then
  echo "App not found: $APP_PATH" >&2
  echo "Usage: npm run mac:unquarantine -- '/path/to/${PRODUCT_NAME}.app'" >&2
  exit 1
fi
xattr -cr "$APP_PATH"
echo "Removed quarantine attributes: $APP_PATH"
