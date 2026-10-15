#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_VERSION="v24.17.0"
RUNTIME_NAME="node-${RUNTIME_VERSION}-win-x64.zip"
RUNTIME_CACHE_DIR="${RUNTIME_CACHE_DIR:-/tmp/game-hub-solo-runtime}"
ARCHIVE="${RUNTIME_CACHE_DIR}/${RUNTIME_NAME}"
CHECKSUMS="${RUNTIME_CACHE_DIR}/SHASUMS256.txt"
OUTPUT_DIR="${PROJECT_ROOT}/output/singleplayer-win"
PACKAGE_DIR="${OUTPUT_DIR}/GameHub-Solo-Windows-x64"

if [[ ! -f "${PROJECT_ROOT}/dist/index.html" ]]; then
  echo '缺少 dist/index.html，请先执行 pnpm build。' >&2
  exit 1
fi

mkdir -p "${RUNTIME_CACHE_DIR}" "${OUTPUT_DIR}"
if [[ ! -f "${ARCHIVE}" ]]; then
  echo "正在下载 Windows Node.js 绿色运行时 (${RUNTIME_VERSION})..."
  curl --fail --location --retry 3 --silent --show-error \
    "https://nodejs.org/dist/${RUNTIME_VERSION}/${RUNTIME_NAME}" --output "${ARCHIVE}"
fi
if [[ ! -f "${CHECKSUMS}" ]]; then
  curl --fail --location --retry 3 --silent --show-error \
    "https://nodejs.org/dist/${RUNTIME_VERSION}/SHASUMS256.txt" --output "${CHECKSUMS}"
fi

EXPECTED="$(awk -v file="${RUNTIME_NAME}" '$2 == file {print $1}' "${CHECKSUMS}")"
ACTUAL="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"
if [[ -z "${EXPECTED}" || "${EXPECTED}" != "${ACTUAL}" ]]; then
  echo 'Windows Node 运行时校验失败，不生成分享包。' >&2
  exit 1
fi

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/runtime"
cp -R "${PROJECT_ROOT}/dist" "${PACKAGE_DIR}/site"
find "${PACKAGE_DIR}" -name ".DS_Store" -delete 2>/dev/null || true
cp "${PROJECT_ROOT}/scripts/singleplayer-server.cjs" "${PACKAGE_DIR}/server.cjs"

# Extract node.exe and LICENSE directly from zip without extracting full folder
unzip -p "${ARCHIVE}" "node-${RUNTIME_VERSION}-win-x64/node.exe" > "${PACKAGE_DIR}/runtime/node.exe"
unzip -p "${ARCHIVE}" "node-${RUNTIME_VERSION}-win-x64/LICENSE" > "${PACKAGE_DIR}/runtime/LICENSE"

# Generate Windows start batch scripts
START_CMD_CONTENT=$(printf '%s\r\n' \
  '@echo off' \
  'title Game Hub Solo Launcher' \
  'chcp 65001 >nul' \
  'cd /d "%~dp0"' \
  'echo ==========================================================' \
  'echo  Game Hub 本地单机版正在启动，请保持此窗口打开...' \
  'echo ==========================================================' \
  '"%~dp0runtime\node.exe" "%~dp0server.cjs"' \
  'echo.' \
  'echo 游戏服务已停止。' \
  'pause')

printf '%s' "${START_CMD_CONTENT}" > "${PACKAGE_DIR}/start.cmd"
printf '%s' "${START_CMD_CONTENT}" > "${PACKAGE_DIR}/start.bat"

# Generate README.txt (UTF-8, with CRLF line endings for Windows Notepad)
cat <<'EOF' | awk '{sub(/\r$/,""); print $0 "\r"}' > "${PACKAGE_DIR}/README.txt"
================================================================
           Game Hub 单机离线版（Windows x64）使用说明
================================================================

【快速开始】
1. 请先将本压缩包【完整解压】到任意文件夹（不要在压缩软件中双击 index.html 直接打开）。
2. 双击运行【start.cmd】或【start.bat】。
3. 程序会自动在您的默认浏览器中打开游戏主页：
   http://127.0.0.1:18789/
   （若浏览器未自动打开，可手动复制此网址到浏览器打开）
4. 游玩过程中请保持黑色的命令行窗口打开；关闭该窗口即退出游戏。

【特点与离线说明】
- 绿色便携：压缩包已内置精简运行环境，您的电脑无需预先安装 Node.js。
- 纯单机安全：仅监听 127.0.0.1 本地回环地址，不开启局域网共享，不连接任何外网服务器。
- 日麻规则引擎：内置完整的 Rust 编译 WASM 规则引擎，单机立直麻将、人机对战完全离线运行。
- 数据存档：单机游戏记录与成就会保存在您的当前浏览器 LocalStorage 中。

【常见问题】
- 提示端口 18789 被占用：请检查是否已经打开了一个 Game Hub 命令行窗口，关闭之前的窗口即可。
- 白屏或脚本错误：请确保是通过 start.cmd 打开 http://127.0.0.1:18789/，而不是直接双击 site/index.html（因浏览器的安全限制，直接 file:// 协议无法加载 WebAssembly 模块）。

祝游戏愉快！
EOF

rm -f "${OUTPUT_DIR}/GameHub-Solo-Windows-x64.zip"
(
  cd "${OUTPUT_DIR}"
  zip -q -r -X GameHub-Solo-Windows-x64.zip GameHub-Solo-Windows-x64
)

echo "=========================================================="
echo "分享包已成功生成："
echo "  目录: ${PACKAGE_DIR}"
echo "  压缩包: ${OUTPUT_DIR}/GameHub-Solo-Windows-x64.zip"
echo "  大小: $(du -h "${OUTPUT_DIR}/GameHub-Solo-Windows-x64.zip" | awk '{print $1}')"
echo "  SHA256: $(shasum -a 256 "${OUTPUT_DIR}/GameHub-Solo-Windows-x64.zip" | awk '{print $1}')"
echo "=========================================================="

