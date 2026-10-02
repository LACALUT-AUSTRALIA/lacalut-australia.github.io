# -*- coding: utf-8 -*-
# drive_pull.py — drains the Supabase `drive_queue` table (filled by the Design Engine's
# "Send to Drive -> Media Buyer" button) into the Media Buyer Google Drive folder.
#
# WHAT THE BUTTON DOES (browser side): uploads the image to the Supabase ad-images bucket (public
# URL) and inserts a `drive_queue` row {sku, creative_name, image_url, folder:'Media Buyer', status:'pending'}.
# THIS SCRIPT (run locally, or on a schedule): reads pending rows, downloads each image_url, uploads
# it to the Media Buyer Drive folder, then marks the row status='done'.
#
# SETUP (2 one-time steps — see WAKE_REPORT):
#   1) In Supabase SQL editor, run design-engine/cli/drive_queue.sql (creates the table + RLS).
#   2) Add to C:\Users\conta\.env:
#        DRIVE_SUPA_SERVICE_KEY=<supabase service_role key>   # needed to read/update the queue
#        DRIVE_MEDIA_BUYER_FOLDER_ID=<the Media Buyer Drive folder id>
#      (Find the folder id with:  python ~/gmail_api/drive_ls.py <parent-folder-id> )
#
# RUN:  python design-engine/cli/drive_pull.py
import socket, os, sys, io, re, json, urllib.request
_orig = socket.getaddrinfo
socket.getaddrinfo = lambda h,*a,**k:[r for r in _orig(h,*a,**k) if r[0]==socket.AF_INET]
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SUPA_URL = "https://bfzvxxcsfxvgeblnkqne.supabase.co"
def _env(path):
    d={}
    try:
        for ln in open(path, encoding="utf-8"):
            m=re.match(r'^([A-Z0-9_]+)=(.*)$', ln.strip())
            if m: d[m.group(1)]=m.group(2)
    except FileNotFoundError: pass
    return d
ENV=_env(os.path.expanduser("~/.env"))
SERVICE_KEY=ENV.get("DRIVE_SUPA_SERVICE_KEY","").strip()
FOLDER_ID=ENV.get("DRIVE_MEDIA_BUYER_FOLDER_ID","").strip()
if not SERVICE_KEY or not FOLDER_ID:
    sys.exit("Missing DRIVE_SUPA_SERVICE_KEY and/or DRIVE_MEDIA_BUYER_FOLDER_ID in ~/.env — see setup notes at top of this file.")

TOKEN=os.path.expanduser("~/gmail_api/token_docs.json")
creds=Credentials.from_authorized_user_file(TOKEN, ["https://www.googleapis.com/auth/drive"])
drv=build("drive","v3",credentials=creds)

def supa(method, path, body=None):
    req=urllib.request.Request(SUPA_URL+"/rest/v1/"+path, method=method,
        data=(json.dumps(body).encode() if body is not None else None),
        headers={"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,
                 "Content-Type":"application/json","Prefer":"return=representation"})
    with urllib.request.urlopen(req) as r:
        txt=r.read().decode()
        return json.loads(txt) if txt else []

rows=supa("GET","drive_queue?status=eq.pending&order=created_at.asc&limit=200")
if not rows:
    print("No pending rows in drive_queue — nothing to do."); sys.exit(0)
print(f"Draining {len(rows)} queued image(s) -> Media Buyer Drive folder {FOLDER_ID}")
ok=0
for row in rows:
    rid=row.get("id"); url=row.get("image_url"); name=(row.get("creative_name") or f"creative-{rid}")
    sku=row.get("sku") or ""
    if not url:
        supa("PATCH", f"drive_queue?id=eq.{rid}", {"status":"error","note":"no image_url"}); continue
    try:
        data=urllib.request.urlopen(url).read()
        fn=re.sub(r'[^A-Za-z0-9._ -]','_', f"{sku+' - ' if sku else ''}{name}").strip()[:120]
        if not fn.lower().endswith((".png",".jpg",".jpeg",".webp")): fn+=".png"
        media=MediaIoBaseUpload(io.BytesIO(data), mimetype="image/png", resumable=False)
        f=drv.files().create(body={"name":fn,"parents":[FOLDER_ID]}, media_body=media,
              fields="id,name", supportsAllDrives=True).execute()
        supa("PATCH", f"drive_queue?id=eq.{rid}", {"status":"done","drive_file_id":f["id"]})
        ok+=1; print(f"  OK  {fn}  -> {f['id']}")
    except Exception as e:
        supa("PATCH", f"drive_queue?id=eq.{rid}", {"status":"error","note":str(e)[:200]})
        print(f"  FAIL {name}: {e}")
print(f"Done — {ok}/{len(rows)} uploaded to the Media Buyer folder.")
