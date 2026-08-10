#!/usr/bin/env bash
# ============================================================
# serve.sh — 一行启动本地开发服务器 + 浏览器（带 no-cache 清缓存）
# 用法：
#   ./serve.sh              # 用默认端口 8080，启动后自动开浏览器
#   ./serve.sh 8081         # 指定端口
#   ./serve.sh --no-open    # 只启动服务器，不开浏览器
#   ./serve.sh --daemon     # 后台启动后立刻退出（给 tools/run-tests.py 用）
#   ./serve.sh 8080 --no-open --daemon
#
# 为什么不用 python -m http.server ？详见 tools/dev-server.py 注释。
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

PORT=8080
OPEN_BROWSER=1
DAEMON=0
for arg in "$@"; do
    if [[ "$arg" == "--no-open" ]]; then
        OPEN_BROWSER=0
    elif [[ "$arg" == "--daemon" ]]; then
        DAEMON=1
        OPEN_BROWSER=0
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        PORT="$arg"
    fi
done

# 尝试关老的服务器（避免端口被占）
if command -v lsof >/dev/null 2>&1; then
    OLD_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
    if [[ -n "$OLD_PID" ]]; then
        echo "[serve] 关闭占用 $PORT 的旧进程 $OLD_PID"
        # shellcheck disable=SC2086
        kill $OLD_PID 2>/dev/null || true
        sleep 0.5
    fi
fi

echo "[serve] 启动开发服务器（端口 $PORT，no-cache）..."
python3 tools/dev-server.py "$PORT" >/tmp/lx-dev-server.log 2>&1 &
SERVER_PID=$!
# 给点时间让 socket 打开
sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[serve] 服务器启动失败，见 /tmp/lx-dev-server.log" >&2
    exit 1
fi

echo "$SERVER_PID" > "/tmp/lx-dev-server-${PORT}.pid"

URL="http://127.0.0.1:$PORT/app.html"
TEST_URL="http://127.0.0.1:$PORT/test.html"
echo "[serve] PID=$SERVER_PID   日志：tail -f /tmp/lx-dev-server.log"
echo "[serve] UI：$URL"
echo "[serve] 测试控制台：$TEST_URL"

if [[ "$DAEMON" == "1" ]]; then
    echo "[serve] daemon 模式：后台运行，PID 文件 /tmp/lx-dev-server-${PORT}.pid"
    exit 0
fi

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
trap "echo; echo '[serve] 停止 $SERVER_PID'; kill $SERVER_PID 2>/dev/null || true; rm -f /tmp/lx-dev-server-${PORT}.pid" EXIT INT TERM
wait $SERVER_PID 2>/dev/null || true
