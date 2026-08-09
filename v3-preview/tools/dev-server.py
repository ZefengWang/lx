#!/usr/bin/env python3
"""
dev-server.py — 本地开发用静态文件服务器（带 no-cache 头，避免 ES Module 缓存）
用法：
  python3 tools/dev-server.py            # 默认 0.0.0.0:8080
  python3 tools/dev-server.py 8081       # 指定端口
  python3 tools/dev-server.py --host 127.0.0.1 --port 8081

为什么要写这个，而不直接用 `python -m http.server`？
----------------------------------------------------------------------------
用户反馈「模块缓存太顽固」。根因有三个：
  1. http.server 默认不发任何 Cache-Control 头，大多数浏览器会对
     text/javascript / application/javascript 自行缓存 0s~5min，
     加上 ES Module 的"模块映射表"被浏览器进程级缓存，就算刷新页
     面也未必重新请求模块文件。
  2. import 路径完全一样时，V8 会直接复用已编译的 Module Record，
     哪怕磁盘文件已经变了（典型现象：改了代码刷新不生效，得硬清
     缓存 / DevTools 里 Disable cache 才行）。
  3. Service Worker 或 HTTP Cache 叠加时会更顽固。

修复思路（组合拳）：
  A. 服务器层：所有响应都发 `Cache-Control: no-store, no-cache,
      must-revalidate, max-age=0` + `Pragma: no-cache` +
      `Expires: 0`，彻底禁用任何中间缓存（含浏览器 disk cache）。
  B. 入口层：index.html / app.html / test.html 引用 main.js 时
      加 `?v=BUILD_TIME`，每次代码发布改版本号；或本项目里
      我们通过 main.js 在 bootstrap 前 console.log 打印版本，
      开发期用本服务器的 no-store 就够用。
  C. 用户侧：若仍有缓存残留，打开 DevTools → Network → Disable cache
      打勾（这也是为什么我们写 serve.sh 默认 chromium 启一个
      --user-data-dir=/tmp 的独立临时 profile，不带历史缓存）。
"""
import argparse
import http.server
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private",
    "Pragma":        "no-cache",
    "Expires":       "0",
    # CORS 允许本地调试时跨域（偶尔子窗口调试用）
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":"GET, HEAD, OPTIONS",
}

EXTRA_MIME = {
    # 防止某些系统 mimetypes 没注册 .mjs / .wasm / .json
    ".mjs":  "text/javascript; charset=utf-8",
    ".js":   "text/javascript; charset=utf-8",
    ".cjs":  "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".svg":  "image/svg+xml",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":  "application/vnd.ms-excel",
    ".csv":  "text/csv; charset=utf-8",
}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """在 SimpleHTTPRequestHandler 基础上强制所有响应加 no-cache 头。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ---- 扩展 MIME（覆盖系统缺少的映射） ----
    def guess_type(self, path):
        base, ext = os.path.splitext(urllib.parse.urlparse(path).path)
        if ext in EXTRA_MIME:
            return EXTRA_MIME[ext]
        return super().guess_type(path)

    # ---- 统一加 no-cache 头 ----
    def end_headers(self):
        for k, v in NO_CACHE_HEADERS.items():
            self.send_header(k, v)
        # 便于跨设备调试：允许 Range（避免音频/视频类资源问题，目前没用到）
        super().end_headers()

    def log_message(self, fmt, *args):
        # 更紧凑的日志（比默认少一堆字段）
        sys.stderr.write("[dev] %s - %s\n" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="LX 刷题器本地开发服务器（强制 no-cache）")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址，默认 0.0.0.0（手机同网段可访问）")
    parser.add_argument("--port", type=int, default=8080, help="端口，默认 8080")
    parser.add_argument("pos_port", nargs="?", type=int, default=None, help="简写：端口位置参数")
    args = parser.parse_args()

    port = args.pos_port or args.port

    httpd = http.server.ThreadingHTTPServer((args.host, port), NoCacheHandler)
    print(f"""
============================================================
 [LX] 本地开发服务器（no-cache 模式）
  - 根目录: {ROOT}
  - 地址:   http://{args.host}:{port}/
  - 本地:   http://127.0.0.1:{port}/
  - 调试页: http://127.0.0.1:{port}/index.html   (PC API 测试页)
  - 新版UI: http://127.0.0.1:{port}/app.html     (移动端 UI)
  - 测试页: http://127.0.0.1:{port}/test.html    (浏览器单元测试)
  提示: 本服务器对所有响应发送 no-store，ES Module 不会再顽固缓存。
        若仍有残留缓存，开 DevTools → Network → Disable cache。
============================================================
按 Ctrl+C 退出。
""")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[dev] 已停止。")
        httpd.server_close()


if __name__ == "__main__":
    main()
