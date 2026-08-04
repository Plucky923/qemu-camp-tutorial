#!/usr/bin/env bash
# 获取 mermaid 运行时到 docs/plugins/javascripts/mermaid.min.js
#
# 背景：zensical 的 bundle.js 默认从 unpkg.com 懒加载 mermaid，国内网络不可达，
# 导致所有 mermaid 图无法渲染。此脚本将 mermaid 本地化，供 extra_javascript 使用，
# 使其先于 bundle 加载，跳过 unpkg 拉取。
#
# 用法：./scripts/fetch-mermaid.sh
# 升级 mermaid 时：修改 MERMAID_VERSION 后重跑，并更新 MERMAID_SHA256。

set -euo pipefail

MERMAID_VERSION="11.4.1"
# 下载自 npmmirror（国内可达）：mermaid/${MERMAID_VERSION}/files/dist/mermaid.min.js
MERMAID_URL="https://registry.npmmirror.com/mermaid/${MERMAID_VERSION}/files/dist/mermaid.min.js"
MERMAID_SHA256="a43bc1afd446f9c4cc66ac5dd45d02e8d65e26fc5344ec0ef787f88d6ddb6f9e"
TARGET="$(cd "$(dirname "$0")/.." && pwd)/docs/plugins/javascripts/mermaid.min.js"
# 先下载到临时文件，checksum 通过后再原子替换，避免中断留下半截文件
# （半截文件会让 make 误以为 target 已存在而跳过下载）。
TMP="$(dirname "$TARGET")/.mermaid.min.js.$$"

cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

mkdir -p "$(dirname "$TARGET")"
echo "Downloading mermaid@${MERMAID_VERSION} ..."
if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --connect-timeout 15 "$MERMAID_URL" -o "$TMP"
else
    wget -q --tries=3 --timeout=15 "$MERMAID_URL" -O "$TMP"
fi

echo "$MERMAID_SHA256  $TMP" | sha256sum -c - >/dev/null || {
    echo "ERROR: SHA256 mismatch, download may be corrupted" >&2
    exit 1
}
mv "$TMP" "$TARGET"
echo "OK: $TARGET"
