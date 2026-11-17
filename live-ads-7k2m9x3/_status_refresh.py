# Fast status refresh (Quan 17/11/2026): after any pause / switch-on, update which ads are
# live or paused on the Media Buyer page WITHOUT the slow full insights pull.
# 1-3 Graph calls (ids= batch, status only). Then: python _build_monitor.py + git push.
# Usage: python _status_refresh.py
import json, os, sys, time, urllib.parse, urllib.request
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
import _pull_live as P

path = os.path.join(SP, "buyer.json")
d = json.load(open(path, encoding="utf-8"))
rows = d.get("ads", []) + d.get("paused", [])
ids = [r["id"] for r in rows]
st = {}
for i in range(0, len(ids), 50):
    chunk = ids[i:i + 50]
    url = f"{P.GRAPH}/?ids={','.join(chunk)}&fields=effective_status&access_token={urllib.parse.quote(P.TOK)}"
    with urllib.request.urlopen(url, timeout=60) as r:
        for k, v in json.load(r).items():
            st[k] = v.get("effective_status", "")
ads, paused, moved = [], [], []
for r in rows:
    s = st.get(r["id"])
    if s is None:                       # could not read: leave the row where it was
        (paused if r.get("paused") else ads).append(r)
        continue
    live = s in ("ACTIVE", "IN_PROCESS", "PENDING_REVIEW", "WITH_ISSUES")
    if live == bool(r.get("paused")):
        moved.append((r["name"], "LIVE" if live else "PAUSED"))
    r["paused"] = not live
    (ads if live else paused).append(r)
d["ads"], d["paused"] = ads, paused
d["status_checked"] = time.strftime("%Y-%m-%dT%H:%M:%S")
json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False)
print(f"status refresh: {len(ads)} live, {len(paused)} paused, {len(moved)} changed")
for n, s in moved:
    print("  ", s, n)
