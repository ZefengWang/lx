#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
驱动 test.html 跑测并落盘结果（不是第二套测试框架）。

流程：
  1. 用仓库根目录 ./serve.sh --daemon 起服务（与人工开发同一入口，默认端口 8080）
  2. 无头 Chrome 打开 test.html?autorun=1（同一控制台）
  3. test.html 跑完后 POST /__lx_test_report → 写入 test-results/latest.json
  4. 本脚本轮询该文件，打印摘要，用退出码表示成败

人工日常：./serve.sh --no-open → 浏览器打开 http://127.0.0.1:8080/test.html
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "test-results" / "latest.json"


def find_chrome() -> str:
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("未找到 google-chrome / chromium")


def wait_http(url: str, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status < 500:
                    return
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.2)
    raise SystemExit(f"服务未就绪: {url} ({last_err})")


def main() -> int:
    ap = argparse.ArgumentParser(description="驱动 test.html 并落盘结果")
    ap.add_argument("--port", type=int, default=8080, help="与 ./serve.sh 默认端口一致")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--timeout", type=float, default=180.0, help="等待测试完成秒数")
    ap.add_argument("--keep-server", action="store_true")
    args = ap.parse_args()

    chrome = find_chrome()
    base = f"http://127.0.0.1:{args.port}"
    test_url = f"{base}/test.html?autorun=1"
    serve_sh = ROOT / "serve.sh"
    pid_file = Path(f"/tmp/lx-dev-server-{args.port}.pid")

    # 清掉旧报告，避免读到脏数据（与 dev-server 落盘路径一致）
    out_path = args.out if args.out.is_absolute() else (ROOT / args.out)
    out_path = out_path.resolve()
    if out_path.exists():
        out_path.unlink()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    args.out = out_path
    env = os.environ.copy()
    env["LX_TEST_RESULTS_FILE"] = str(out_path)

    if not serve_sh.is_file():
        raise SystemExit(f"缺少 {serve_sh}，请在仓库根目录执行")

    # 与人工开发同一入口：./serve.sh --daemon（内部仍是 tools/dev-server.py）
    serve_proc = subprocess.run(
        ["bash", str(serve_sh), str(args.port), "--no-open", "--daemon"],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if serve_proc.returncode != 0:
        raise SystemExit(
            f"./serve.sh --daemon 失败 (code={serve_proc.returncode})\n"
            f"{serve_proc.stdout}\n{serve_proc.stderr}"
        )

    server_pid = None
    if pid_file.exists():
        try:
            server_pid = int(pid_file.read_text(encoding="utf-8").strip())
        except ValueError:
            server_pid = None

    chrome_proc = None
    try:
        wait_http(f"{base}/test.html")
        user_data = tempfile.mkdtemp(prefix="lx-chrome-")
        chrome_proc = subprocess.Popen(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                f"--user-data-dir={user_data}",
                test_url,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        deadline = time.time() + args.timeout
        results = None
        while time.time() < deadline:
            if args.out.exists() and args.out.stat().st_size > 2:
                try:
                    results = json.loads(args.out.read_text(encoding="utf-8"))
                    if results.get("finishedAt") or results.get("total") is not None:
                        break
                except json.JSONDecodeError:
                    pass
            if chrome_proc.poll() is not None and not args.out.exists():
                # chrome 退出但还没报告：再等一会儿
                time.sleep(0.5)
                if args.out.exists():
                    continue
                raise SystemExit("Chrome 已退出但未收到 test.html 的 POST 报告")
            time.sleep(0.25)

        if not results:
            raise SystemExit(f"等待 {args.timeout}s 仍未收到报告：{args.out}")

        results["driver"] = "./serve.sh --daemon → test.html?autorun=1 → POST /__lx_test_report"
        results["note"] = "与 ./serve.sh 起服务后浏览器打开 test.html 点「运行全部」同源"
        args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        print("=== test.html 同源结果（经 ./serve.sh）===")
        print(
            f"ok={results.get('ok')}  {results.get('passed')}/{results.get('total')}  "
            f"fail={results.get('failed')}  duration={results.get('duration')}ms"
        )
        if results.get("byLayer"):
            for layer, stats in results["byLayer"].items():
                print(f"  [{layer}] {stats.get('passed')}/{stats.get('total')}")
        if results.get("failures"):
            print("failures:")
            for f in results["failures"]:
                print(f"  - [{f.get('layer')}|{f.get('suite')}] {f.get('name')}: {f.get('message')}")
        print(f"written: {args.out}")
        print(f"browser: {base}/test.html")
        return 0 if results.get("ok") and int(results.get("failed") or 0) == 0 else 1
    finally:
        if chrome_proc and chrome_proc.poll() is None:
            chrome_proc.terminate()
            try:
                chrome_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                chrome_proc.kill()
        if not args.keep_server and server_pid:
            try:
                os.kill(server_pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                pid_file.unlink(missing_ok=True)
            except TypeError:
                if pid_file.exists():
                    pid_file.unlink()


if __name__ == "__main__":
    sys.exit(main())
