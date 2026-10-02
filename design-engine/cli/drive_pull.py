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
_orig = socket.getaddrinfo
socket.getaddrinfo = lambda h,*a,**k:[r for r in _orig(h,*a,**k) if r[0]==socket.AF_INET]
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

rows=list_queue()
if not rows:
    print("Drive queue empty — nothing to sync."); sys.exit(0)
print(f"Syncing {len(rows)} image(s) -> Media Buyer Drive folder {FOLDER_ID}")
ok=0
for r in rows:
    name=r["name"]
    try:
        data=download(name)
        drive_name=re.sub(r'__[a-z0-9]+-\d+(?=\.\w+$)','', name)   # strip the __<cardid>-<ts> suffix
        media=MediaIoBaseUpload(io.BytesIO(data), mimetype="image/png", resumable=False)
        f=drv.files().create(body={"name":drive_name,"parents":[FOLDER_ID]}, media_body=media,
              fields="id,name", supportsAllDrives=True).execute()
        move_done(name); ok+=1
        print(f"  OK  {drive_name}  -> {f['id']}")
    except Exception as e:
        print(f"  FAIL {name}: {e}")
print(f"Done — {ok}/{len(rows)} synced to the Media Buyer folder.")
