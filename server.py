#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
糖果宝宝 (CandyBaby) 本地轻量级数据持久化服务
启动后访问: http://127.0.0.1:8080
同时自动将所有记录实时保存在本地文件 data/baby_data.json 中，方便随时同步至 GitHub！
"""

import json
import os
import webbrowser
from http.server import SimpleHTTPRequestHandler, HTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "baby_data.json")
PORT = 8080


class CandyBabyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/data"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode("utf-8"))
            else:
                self.wfile.write(b"{}")
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/data"):
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length).decode("utf-8")
            try:
                parsed = json.loads(raw_body)
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # 保持终端输出清爽
        pass


class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    url = f"http://127.0.0.1:{PORT}"
    server = ReusableHTTPServer(("127.0.0.1", PORT), CandyBabyHandler)
    print("=" * 56, flush=True)
    print("🍬 糖果宝宝 · 新生儿成长与健康看板已启动！", flush=True)
    print(f"👉 浏览器访问地址: {url}", flush=True)
    print(f"💾 本地数据自动保存路径: {DATA_FILE}", flush=True)
    print("=" * 56, flush=True)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务已停止。")
