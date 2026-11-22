#!/usr/bin/env python3
"""Run SWGOH Hub on http://localhost:8811 with a working Sync button.

  python3 serve.py            start the site and open it in your browser
  python3 serve.py --no-open  start without opening a browser
"""
import argparse, json, os, threading, time, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import build

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = {"running": False, "pct": 0, "msg": "Idle", "error": None, "finished": None}
LOCK = threading.Lock()


def run_sync():
    def progress(p, m):
        with LOCK:
            STATE.update(pct=p, msg=m)
    try:
        build.build(progress=progress)
        with LOCK:
            STATE.update(finished=int(time.time()), error=None)
    except Exception as err:          # report any failure to the page instead of dying
        with LOCK:
            STATE.update(error=f"{type(err).__name__}: {err}", msg="Sync failed")
    finally:
        with LOCK:
            STATE["running"] = False


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.join(HERE, "site"), **kw)

    def log_message(self, *a):
        pass

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if not self.path.startswith("/api/"):          # always serve the latest page, app and data
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            with LOCK:
                return self.send_json(dict(STATE, server=True))
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/sync":
            return self.send_json({"error": "not found"}, 404)
        with LOCK:
            if STATE["running"]:
                return self.send_json(dict(STATE, started=False))
            STATE.update(running=True, pct=0, msg="Starting", error=None)
        threading.Thread(target=run_sync, daemon=True).start()
        self.send_json(dict(STATE, started=True))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8811)
    ap.add_argument("--no-open", action="store_true")
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    url = f"http://localhost:{a.port}/"
    print(f"SWGOH Hub running at {url}  (Ctrl+C to stop)")
    if not a.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
