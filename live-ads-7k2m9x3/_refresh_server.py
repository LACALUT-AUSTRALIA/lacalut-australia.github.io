# Refresh helper for the Live Ads Monitor "Refresh now" button (Quan 19/11/2026).
# Listens on this PC only (127.0.0.1:8765). POST /refresh runs the normal _auto_refresh.ps1
# (same job the Task Scheduler runs every 30 minutes). GET /status says if it is still running.
# Only the live ads page (lacalut-australia.github.io) holding the shared token may call it.
# Free: Meta API reads only. Started at logon by the "LACALUT Live Ads Refresh Helper" task.
import json, os, subprocess, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
import _refresh_bar

ORIGIN = "https://lacalut-australia.github.io"
PS1, LOCK, LOG = (os.path.join(SP, n) for n in ("_auto_refresh.ps1", "_auto_refresh.lock", "_auto_refresh.log"))
proc = None


def running():
    if proc is not None and proc.poll() is None:
        return True
    return os.path.exists(LOCK) and time.time() - os.path.getmtime(LOCK) < 7200


def status():
    try:
        pulled = json.load(open(os.path.join(SP, "buyer.json"), encoding="utf-8")).get("pulled", "")
    except Exception:
        pulled = ""
    try:
        last = open(LOG, encoding="utf-8", errors="replace").read().strip().splitlines()[-1]
    except Exception:
        last = ""
    return {"running": running(), "pulled": pulled, "last": last}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body=None):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Refresh-Token")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        data = json.dumps(body or {}).encode()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _allowed(self):
        return (self.headers.get("Origin") == ORIGIN
                and self.headers.get("X-Refresh-Token") == _refresh_bar.token(SP))

    def do_OPTIONS(self):
        self._send(204)

    def do_GET(self):
        if not self._allowed():
            return self._send(403)
        self._send(200, status()) if self.path == "/status" else self._send(404)

    def do_POST(self):
        global proc
        if not self._allowed():
            return self._send(403)
        if self.path != "/refresh":
            return self._send(404)
        if not running():
            proc = subprocess.Popen(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", PS1],
                cwd=SP, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        self._send(200, status())


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), H).serve_forever()
