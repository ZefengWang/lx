#!/usr/bin/env bash
# ============================================================
# serve.sh — 一行启动本地开发服务器 + 浏览器（带 no-cache 清缓存）
# 用法：
#   ./serve.sh              # 用默认端口 8080，启动后自动开浏览器
#   ./serve.sh 8081         # 指定端口
#   ./serve.sh --no-open    # 只启动服务器，不开浏览器
#
# 为什么不用 python -m http.server ？详见 tools/dev-server.py 注释。
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8080}"
OPEN_BROWSER=1
if [[ "${1:-}" == "--no-open" || "${2:-}" == "--no-open" ]]; then
    OPEN_BROWSER=0
fi

# 若 port 参数不是纯数字，说明用户传了别的；保留默认
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    PORT=8080
fi

# 尝试关老的服务器（避免端口被占）
if command -v lsof >/dev/null 2>&1; then
    OLD_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
    if [[ -n "$OLD_PID" ]]; then
        echo "[serve] 关闭占用 $PORT 的旧进程 $OLD_PID"
        kill $OLD_PID 2>/dev/null || true
        sleep 0.5
    fi
fi

echo "[serve] 启动开发服务器（端口 $PORT，no-cache）..."
python3 tools/dev-server.py "$PORT" >/tmp/lx-dev-server.log 2>&1 &
SERVER_PID=$!
# 给点时间让 socket 打开
sleep 1

URL="http://127.0.0.1:$PORT/app.html"
echo "[serve] PID=$SERVER_PID   日志：tail -f /tmp/lx-dev-server.log"
echo "[serve] UI：$URL"

if [[ "$OPEN_BROWSER" == "1" ]]; then
    # 跨平台自动开浏览器；Linux 下如果有 chromium 就用一个干净的临时 profile（彻底避免磁盘缓存）
    if command -v chromium >/dev/null 2>&1; then
        TMP_PROFILE="/tmp/lx-chrome-profile-$$"
        mkdir -p "$TMP_PROFILE"
        echo "[serve] chromium --user-data-dir=$TMP_PROFILE（临时干净 profile，无缓存）"
        (chromium --user-data-dir="$TMP_PROFILE" --disk-cache-dir=/tmp/lx-chrome-cache-$$ \
                  --aggressive-cache-discard --disable-application-cache --disable-backing-store-limit \
                  "$URL" >/tmp/lx-chrome-$$.log 2>&1 &)
    elif command -v google-chrome >/dev/null 2>&1; then
        (google-chrome "$URL" >/tmp/lx-chrome-$$.log 2>&1 &)
    elif command -v xdg-open >/dev/null 2>&1; then
        (xdg-open "$URL" >/dev/null 2>&1 &)
    elif command -v open >/dev/null 2>&1; then
        (open "$URL" >/dev/null 2>&1 &)
    else
        echo "[serve] 请手动打开：$URL"
    fi
fi

echo "[serve] 按任意键（或 Ctrl+C）停止服务器..."
trap "echo; echo '[serve] 停止 $SERVER_PID'; kill $SERVER_PID 2>/dev/null || true" EXIT INT TERM
wait $SERVER_PID 2>/dev/null || true
