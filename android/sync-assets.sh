#!/usr/bin/env bash
# 同步 web 静态资源 → Android assets/（WebViewAssetLoader 根目录）
# 用法：bash android/sync-assets.sh
# CI 构建 APK 前必须执行；本地改完 web 代码后也可手动执行。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets"

echo ">>> 同步 web 资源到 $DEST"
# 保留 Android 原生文件（如已存在的 ic_launcher 等），只清空旧 web 产物
rm -rf "$DEST/app.html" "$DEST/index.html" "$DEST/manifest.json" "$DEST/sw.js" \
       "$DEST/icon-192.png" "$DEST/icon-512.png" "$DEST/version.txt" "$DEST/src"
mkdir -p "$DEST"

cp "$ROOT/app.html"        "$DEST/app.html"
cp "$ROOT/index.html"      "$DEST/index.html"
cp "$ROOT/manifest.json"   "$DEST/manifest.json"
cp "$ROOT/sw.js"           "$DEST/sw.js"
cp "$ROOT/icon-192.png"    "$DEST/icon-192.png"
cp "$ROOT/icon-512.png"    "$DEST/icon-512.png"
cp "$ROOT/version.txt"     "$DEST/version.txt"

cp -R "$ROOT/src"          "$DEST/src"

echo ">>> 完成。共 $(find "$DEST" -type f | wc -l) 个文件。"
