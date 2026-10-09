# -*- coding: utf-8 -*-
# video_qc.py — pulls a finished Design Engine video from Supabase (ad-images/video-qc/,
# auto-uploaded by the engine on every render/stitch) and turns it into terminal-QC-able
# artefacts: 4x4 contact sheets (1 frame/sec, 360px wide) + an audio transcript, so Desi
# can QC frame-by-frame with ZERO manual downloads.
#
# RUN:
#   python design-engine/cli/video_qc.py                  -> newest file in video-qc/
#   python design-engine/cli/video_qc.py <filename.mp4>   -> that exact file
#   python design-engine/cli/video_qc.py --list           -> show what's in the bucket, no download
#   options: --fps 2 (closer look) · --from 8 --to 16 (one time range) · --out <dir>
#
# OUTPUT: local paths of the sheets + transcript (Desi then Reads the sheets).
# Sheets are named by their time range (sheet_00-15.jpg) so frame position = second.
# NO drawtext timestamps — Fontconfig is broken on this machine (no output at all).
import socket, os, sys, re, json, glob, subprocess, tempfile, urllib.request, urllib.parse

# Same DNS bypass as drive_pull.py: this PC's resolver can't resolve the Supabase host
# (gaierror 11002) — pin it to the known Cloudflare IP; every other host filters to IPv4
# (googleapis resolves fine but Gemini calls need IPv4 forced).
SUPA_HOST = "bfzvxxcsfxvgeblnkqne.supabase.co"
_orig = socket.getaddrinfo
def _getaddrinfo(host, *a, **k):
    if host == SUPA_HOST:
        port = a[0] if a else 443
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (_SUPA_IP, port))]
    return [r for r in _orig(host, *a, **k) if r[0] == socket.AF_INET]
socket.getaddrinfo = _getaddrinfo

SUPA_URL = "https://bfzvxxcsfxvgeblnkqne.supabase.co"
BUCKET   = "ad-images"
PREFIX   = "video-qc"
FFMPEG   = r"C:\Users\conta\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe"
if not os.path.exists(FFMPEG): FFMPEG = "ffmpeg"   # fall back to PATH

def _env(*paths):
    d = {}
    for path in paths:
        try:
            for ln in open(path, encoding="utf-8"):
                m = re.match(r'^([A-Z0-9_]+)=(.*)$', ln.strip())
                if m and m.group(2): d.setdefault(m.group(1), m.group(2))
        except (FileNotFoundError, OSError): pass
    return d
ENV = _env("C:/Users/conta/OneDrive/Documents/Claude Code/.env", os.path.expanduser("~/.env"))
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
GEMINI_KEY = ENV.get("GEMINI_API_KEY", "").strip()
_SUPA_IP = ENV.get("SUPABASE_IP", "172.64.149.246").strip()
if not KEY: sys.exit("Missing SUPABASE_SERVICE_ROLE_KEY in .env")

def _req(method, url, body=None, headers=None, raw=False):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    if headers: h.update(headers)
    req = urllib.request.Request(url, method=method, data=body, headers=h)
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
        return data if raw else (json.loads(data.decode()) if data else [])

def list_qc():
    body = json.dumps({"prefix": PREFIX, "limit": 1000,
                       "sortBy": {"column": "created_at", "order": "desc"}}).encode()
    rows = _req("POST", f"{SUPA_URL}/storage/v1/object/list/{BUCKET}", body,
                {"Content-Type": "application/json"})
    return [r for r in rows if r.get("name") and r.get("id")]   # id null = pseudo-folder

def download(name, dest):
    data = _req("GET", f"{SUPA_URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(PREFIX + '/' + name)}", raw=True)
    with open(dest, "wb") as f: f.write(data)
    return dest

def run_ff(args):
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + args,
                       capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError("ffmpeg failed: " + (r.stderr or "")[:400])

def duration_of(path):
    ffprobe = os.path.join(os.path.dirname(FFMPEG), "ffprobe.exe") if os.sep in FFMPEG else "ffprobe"
    if not os.path.exists(ffprobe): ffprobe = "ffprobe"
    r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0.0

def contact_sheets(mp4, out_dir, fps, t_from, t_to):
    # fps frames/sec, 360px wide, tiled 4x4 = 16 frames/sheet. Sheet filename carries its
    # start..end seconds (frame position inside the grid = the second), no drawtext.
    seek = (["-ss", str(t_from)] if t_from else []) + (["-to", str(t_to)] if t_to else [])
    tmp_pat = os.path.join(out_dir, "_raw_%03d.jpg")
    run_ff(seek + ["-i", mp4, "-vf", f"fps={fps},scale=360:-2,tile=4x4", "-q:v", "3", tmp_pat])
    sheets = []
    span = 16.0 / fps                     # seconds covered per sheet
    base = t_from or 0
    for i, p in enumerate(sorted(glob.glob(os.path.join(out_dir, "_raw_*.jpg")))):
        s0 = base + i * span
        s1 = s0 + span - (1.0 / fps)
        dest = os.path.join(out_dir, f"sheet_{int(s0):02d}-{int(s1):02d}.jpg")
        os.replace(p, dest)
        sheets.append(dest)
    return sheets

def transcribe(mp4, out_dir):
    if not GEMINI_KEY: return None, "(no GEMINI_API_KEY — transcript skipped)"
    mp3 = os.path.join(out_dir, "audio.mp3")
    try:
        run_ff(["-i", mp4, "-vn", "-acodec", "libmp3lame", "-q:a", "6", mp3])
    except RuntimeError as e:
        return None, f"(no audio track or extract failed: {e})"
    import base64
    b64 = base64.b64encode(open(mp3, "rb").read()).decode()
    body = json.dumps({
        "contents": [{"parts": [
            {"text": "Transcribe this ad's audio word-for-word. Output ONLY the spoken words "
                     "(the narrator/voice-over). If there is no speech at all, output exactly: NO SPEECH."},
            {"inline_data": {"mime_type": "audio/mp3", "data": b64}}]}],
        "generationConfig": {"temperature": 0}}).encode()
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_KEY,
        method="POST", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            j = json.loads(r.read().decode())
        txt = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"]).strip()
    except Exception as e:
        return mp3, f"(transcription failed: {e})"
    tf = os.path.join(out_dir, "transcript.txt")
    open(tf, "w", encoding="utf-8").write(txt)
    return tf, txt

def main():
    args = sys.argv[1:]
    def opt(name, default=None, cast=str):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]
            return cast(v)
        return default
    fps    = opt("--fps", 1, float)
    t_from = opt("--from", None, float)
    t_to   = opt("--to", None, float)
    out    = opt("--out", None)

    rows = list_qc()
    if "--list" in args:
        for r in rows[:30]:
            print(f"{r['name']}  ({(r.get('metadata') or {}).get('size', 0)/1e6:.1f} MB  {r.get('created_at','')[:16]})")
        if not rows: print("video-qc/ is empty.")
        return
    name = args[0] if args else None
    if not name:
        mains = [r for r in rows if not re.search(r"-s\d+\.mp4$", r["name"])] or rows   # prefer full stitch over -s1 scene clips
        if not mains: sys.exit("video-qc/ is empty — render a video first (engine auto-uploads).")
        name = mains[0]["name"]

    stem = re.sub(r"\.mp4$", "", name)
    out_dir = out or os.path.join(tempfile.gettempdir(), "video-qc", stem)
    os.makedirs(out_dir, exist_ok=True)
    mp4 = os.path.join(out_dir, name)
    print(f"⬇ {PREFIX}/{name}")
    download(name, mp4)
    dur = duration_of(mp4)
    print(f"   {os.path.getsize(mp4)/1e6:.1f} MB · {dur:.0f}s")

    sheets = contact_sheets(mp4, out_dir, fps, t_from, t_to)
    tf, txt = transcribe(mp4, out_dir)

    print("\nSHEETS (Read these — 4x4, left-to-right top-to-bottom, "
          f"{'1 frame = 1s' if fps == 1 else f'{fps} frames/sec'}; name = start-end second):")
    for s in sheets: print("  " + s)
    print("\nTRANSCRIPT" + (f" ({tf})" if tf else "") + ":")
    print("  " + (txt or "").replace("\n", "\n  "))

if __name__ == "__main__":
    main()
