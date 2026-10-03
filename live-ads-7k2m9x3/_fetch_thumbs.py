# -*- coding: utf-8 -*-
# Download any missing ad thumbnails from Meta CDN into thumbs/ (local copies never expire).
import json, os, concurrent.futures, urllib.request

SP = os.environ.get("MON_DIR") or os.path.dirname(os.path.abspath(__file__))
thumbs = json.load(open(os.path.join(SP, "thumbs.json"), encoding="utf-8"))
os.makedirs(os.path.join(SP, "thumbs"), exist_ok=True)

def grab(item):
    aid, t = item
    p = os.path.join(SP, "thumbs", aid + ".jpg")
    if os.path.exists(p):
        return (aid, "cached")
    url = t.get("thumb") or t.get("img")
    if not url:
        return (aid, "no-url")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=20).read()
        if len(data) < 100:
            return (aid, "tiny")
        open(p, "wb").write(data)
        return (aid, "ok")
    except Exception as e:
        return (aid, f"err:{type(e).__name__}")

with concurrent.futures.ThreadPoolExecutor(16) as ex:
    res = list(ex.map(grab, thumbs.items()))

from collections import Counter
print(Counter(r[1] for r in res))
