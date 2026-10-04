# -*- coding: utf-8 -*-
# drive_pull.py — moves images the Design Engine "Send to Drive -> Media Buyer" button uploaded
# into the Media Buyer Google Drive folder. NO Supabase table needed: the bucket prefix IS the queue.
#
# FLOW:
#   button  -> uploads image to Supabase bucket  ad-images/drive-media-buyer/<name>.png
#   this    -> lists that prefix (service_role key), downloads each, uploads to the Media Buyer Drive
#              folder, then MOVES the object to ad-images/drive-done/ so it isn't re-processed.
#
# SETUP: nothing to create. Needs (already present): SUPABASE_SERVICE_ROLE_KEY in ~/.env and Drive
#   OAuth at ~/gmail_api/token_docs.json. Media Buyer folder id is baked in (override via .env
#   DRIVE_MEDIA_BUYER_FOLDER_ID if it ever changes).
#
# RUN:  python design-engine/cli/drive_pull.py      (schedule it every few min for near-instant sync)
import socket, os, sys, io, re, json, urllib.request, urllib.parse
# This PC's default (IPv6) resolver cannot resolve the Supabase host at all (gaierror 11002),
# so forcing IPv4 is not enough — we must bypass DNS entirely for that host. Pin it to the known
# Cloudflare IP (override via .env SUPABASE_IP if it ever rotates). SNI + cert still use the real
# hostname from the URL, so TLS stays valid (same trick as `curl --resolve`). googleapis resolves
# fine, so leave every other host to normal (IPv4-filtered) resolution.
SUPA_HOST = "bfzvxxcsfxvgeblnkqne.supabase.co"
_orig = socket.getaddrinfo
def _getaddrinfo(host, *a, **k):
    if host == SUPA_HOST:
        port = a[0] if a else 443
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (_SUPA_IP, port))]
    return [r for r in _orig(host, *a, **k) if r[0] == socket.AF_INET]
socket.getaddrinfo = _getaddrinfo
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SUPA_URL = "https://bfzvxxcsfxvgeblnkqne.supabase.co"
BUCKET   = "ad-images"
SRC_PREFIX  = "drive-media-buyer"
DONE_PREFIX = "drive-done"
def _env(*paths):
    d={}
    for path in paths:
        try:
            for ln in open(path, encoding="utf-8"):
                m=re.match(r'^([A-Z0-9_]+)=(.*)$', ln.strip())
                if m and m.group(2): d.setdefault(m.group(1), m.group(2))
        except (FileNotFoundError, OSError): pass
    return d
# Secrets live in the OneDrive .env (same one wrapup_project.py reads); ~/.env is a fallback.
ENV=_env("C:/Users/conta/OneDrive/Documents/Claude Code/.env", os.path.expanduser("~/.env"))
KEY=ENV.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
_SUPA_IP=ENV.get("SUPABASE_IP","172.64.149.246").strip()   # used by the DNS-bypass patch above
FOLDER_ID=ENV.get("DRIVE_MEDIA_BUYER_FOLDER_ID","1GzMliHuCfzVcozN0_zAfANo8q01Hf0UA").strip()
if not KEY: sys.exit("Missing SUPABASE_SERVICE_ROLE_KEY in ~/.env")

def _req(method, url, body=None, headers=None, raw=False):
    h={"apikey":KEY,"Authorization":"Bearer "+KEY}
    if headers: h.update(headers)
    req=urllib.request.Request(url, method=method, data=body, headers=h)
    with urllib.request.urlopen(req) as r:
        data=r.read()
        return data if raw else (json.loads(data.decode()) if data else [])

def list_queue():
    body=json.dumps({"prefix":SRC_PREFIX,"limit":1000,"sortBy":{"column":"name","order":"asc"}}).encode()
    rows=_req("POST", f"{SUPA_URL}/storage/v1/object/list/{BUCKET}", body, {"Content-Type":"application/json"})
    return [r for r in rows if r.get("name") and r.get("id")]   # id is null for pseudo-folders

def download(name):
    return _req("GET", f"{SUPA_URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(SRC_PREFIX+'/'+name)}", raw=True)

def move_done(name):
    body=json.dumps({"bucketId":BUCKET,"sourceKey":f"{SRC_PREFIX}/{name}","destinationKey":f"{DONE_PREFIX}/{name}"}).encode()
    try: _req("POST", f"{SUPA_URL}/storage/v1/object/move", body, {"Content-Type":"application/json"})
    except Exception as e: print(f"  (move failed, will retry next run) {name}: {e}")

creds=Credentials.from_authorized_user_file(os.path.expanduser("~/gmail_api/token_docs.json"),
        ["https://www.googleapis.com/auth/drive"])
drv=build("drive","v3",credentials=creds)

# ── SKU → subfolder routing ───────────────────────────────────────────────────
# Each queued filename is "<sku> - <label>__<cardid>-<ts>.png", so the leading token
# before " - " is the SKU key. We drop the image into a per-SKU subfolder of Media
# Buyer (created on first use) instead of the flat root. Unknown/no SKU -> root.
# SKU-key -> subfolder name. Media Buyer ROOT uses mixed-case; the ADITYA MATRIX tree uses ALL-CAPS
# (that's how Quan named the folders Aditya has access to), so each tree gets its own name map.
SKU_FOLDER={
    "aktiv":"AKTIV", "aktiv-herbal":"AKTIV Herbal", "flora":"FLORA",
    "sensitive":"Sensitive", "white-repair":"White & Repair", "multi":"Multi-SKU",
}
ADITYA_SKU_FOLDER={
    "aktiv":"AKTIV", "aktiv-herbal":"HERBAL", "flora":"FLORA",
    "sensitive":"SENSITIVE", "white-repair":"WHITE & REPAIR", "multi":"MULTI-SKU",
}
_folder_cache={}
def _find_or_create(name, parent):
    key=(parent, name)
    if key in _folder_cache: return _folder_cache[key]
    safe=name.replace("'", r"\'")
    q=("mimeType='application/vnd.google-apps.folder' and trashed=false "
       f"and name='{safe}' and '{parent}' in parents")
    res=drv.files().list(q=q, fields="files(id,name)", supportsAllDrives=True,
            includeItemsFromAllDrives=True, pageSize=1).execute().get("files",[])
    fid=res[0]["id"] if res else drv.files().create(
            body={"name":name,"mimeType":"application/vnd.google-apps.folder","parents":[parent]},
            fields="id", supportsAllDrives=True).execute()["id"]
    _folder_cache[key]=fid
    return fid

# Resolve the "ADITYA MATRIX" parent once (match by name, case-insensitive) — reuse the folder Quan
# already shares with Aditya; never create a second one. None if it isn't there yet.
_aditya_parent=None
def aditya_parent():
    global _aditya_parent
    if _aditya_parent is not None: return _aditya_parent or None
    kids=drv.files().list(q=f"'{FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id,name)", supportsAllDrives=True, includeItemsFromAllDrives=True, pageSize=200).execute().get("files",[])
    for k in kids:
        if "aditya matrix" in k["name"].lower(): _aditya_parent=k["id"]; return _aditya_parent
    _aditya_parent=""; return None

def sku_of(name):
    tok=name.split(" - ",1)[0].strip().lower() if " - " in name else ""
    return tok if tok in SKU_FOLDER else ""

def target_folder(coll, sku):
    # EVERYTHING files under ADITYA MATRIX / <CAPS SKU> — that's the folder Quan shares with Aditya,
    # so every Send-to-Drive creative lands in its SKU subfolder there (not the Media Buyer root).
    ap=aditya_parent()
    if ap:
        fn=ADITYA_SKU_FOLDER.get(sku)
        return (_find_or_create(fn, ap), "ADITYA MATRIX/"+fn) if fn else (ap, "ADITYA MATRIX")
    # ADITYA MATRIX folder missing (shouldn't happen) -> fall back to per-SKU under Media Buyer root.
    fn=SKU_FOLDER.get(sku)
    return (_find_or_create(fn, FOLDER_ID), fn) if fn else (FOLDER_ID, "(root)")

def sync_once():
    rows=list_queue()
    if not rows:
        return 0, 0
    print(f"Syncing {len(rows)} image(s) -> ADITYA MATRIX / <SKU>")
    ok=0
    for r in rows:
        name=r["name"]
        try:
            data=download(name)
            mcol=re.search(r'__col-([a-z-]+)__', name); coll=mcol.group(1) if mcol else ""
            drive_name=re.sub(r'__col-[a-z-]+(?=__)','', name)          # drop the collection tag
            drive_name=re.sub(r'__[a-z0-9]+-\d+(?=\.\w+$)','', drive_name)   # strip the __<cardid>-<ts> suffix
            sku=sku_of(drive_name)
            parent,where=target_folder(coll, sku)
            media=MediaIoBaseUpload(io.BytesIO(data), mimetype="image/png", resumable=False)
            f=drv.files().create(body={"name":drive_name,"parents":[parent]}, media_body=media,
                  fields="id,name", supportsAllDrives=True).execute()
            move_done(name); ok+=1
            print(f"  OK  [{where}]  {drive_name}  -> {f['id']}")
        except Exception as e:
            print(f"  FAIL {name}: {e}")
    print(f"Done — {ok}/{len(rows)} synced into ADITYA MATRIX / <SKU>.")
    return ok, len(rows)

if __name__=="__main__":
    # --watch [seconds]: poll the queue continuously for near-real-time sync (default 10s).
    # Default (no flag): one-shot drain then exit (used by the scheduled fallback).
    if "--watch" in sys.argv:
        import time
        iv=10
        try: iv=int(sys.argv[sys.argv.index("--watch")+1])
        except (ValueError, IndexError): pass
        # pythonw.exe has no console, so mirror all output to a logfile next to this script.
        try:
            _lp=os.path.join(os.path.dirname(os.path.abspath(__file__)),"drive_sync.log")
            sys.stdout=sys.stderr=open(_lp,"a",encoding="utf-8",buffering=1)
        except OSError: pass
        # Single-instance guard: bind a fixed localhost port. If it's taken, another watcher is
        # already running (e.g. Startup launched one after a manual start) -> exit quietly.
        # A socket lock self-clears on process death, so there are no stale lockfiles.
        try:
            _lock=socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            _lock.bind(("127.0.0.1", 50573)); _lock.listen(1)
        except OSError:
            print("[watch] another watcher already holds the lock — exiting", flush=True); sys.exit(0)
        print(f"[watch] polling the Drive queue every {iv}s — Ctrl+C to stop", flush=True)
        while True:
            try: sync_once()
            except Exception as e: print(f"[watch] cycle error: {e}", flush=True)
            sys.stdout.flush()
            time.sleep(iv)
    else:
        n,_=sync_once()
        if n==0 and _==0: print("Drive queue empty — nothing to sync.")
