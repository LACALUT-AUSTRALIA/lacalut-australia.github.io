"""
Pull FRESH Meta ad data for the Live Ads Monitor, writing the three JSONs that
_build_monitor.py consumes:  ads_all.json, insights90.json, insights7.json.

Run before _build_monitor.py to refresh the page from live data:
    python _pull_live.py && python _build_monitor.py

Token is read from the Facy pipeline .env (META_ACCESS_TOKEN), same account the
build engine uses (act_2157906551266386).
"""
import json, os, urllib.request, urllib.parse, time

ACCT = "act_2157906551266386"
SP = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = r"C:/Users/conta/OneDrive/Documents/Claude Code/.env"

def load_token():
    for line in open(ENV_PATH, encoding="utf-8"):
        if line.startswith("META_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("META_ACCESS_TOKEN not found in .env")

TOK = load_token()
GRAPH = "https://graph.facebook.com/v21.0"

def get_all(url):
    out = []
    while url:
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        out += d.get("data", [])
        url = d.get("paging", {}).get("next")
    return out

PURCH = ("omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase")
def pick(rows, keys):
    if not rows:
        return 0.0
    by = {x.get("action_type"): x.get("value") for x in rows}
    for k in keys:
        if k in by:
            try:
                return float(by[k])
            except (TypeError, ValueError):
                return 0.0
    return 0.0

def pull_ads():
    fields = "id,name,effective_status,created_time,campaign{name},adset{name}"
    url = f"{GRAPH}/{ACCT}/ads?fields={fields}&limit=400&access_token={urllib.parse.quote(TOK)}"
    rows = get_all(url)
    out = []
    for a in rows:
        out.append({
            "id": a["id"],
            "name": a.get("name", ""),
            "effective_status": a.get("effective_status", ""),
            "created_time": a.get("created_time", ""),
            "campaign": (a.get("campaign") or {}).get("name", ""),
            "adset": (a.get("adset") or {}).get("name", ""),
        })
    return out

def pull_insights(preset):
    fields = ("ad_id,spend,purchase_roas,actions,action_values,"
              "impressions,reach,ctr,cpc,cpm")
    url = (f"{GRAPH}/{ACCT}/insights?level=ad&date_preset={preset}&limit=400"
           f"&fields={fields}&access_token={urllib.parse.quote(TOK)}")
    rows = get_all(url)
    out = []
    for r in rows:
        roas = 0.0
        for pr in (r.get("purchase_roas") or []):
            try:
                roas = float(pr.get("value", 0))
            except (TypeError, ValueError):
                pass
        out.append({
            "ad_id": r.get("ad_id"),
            "spend": float(r.get("spend") or 0),
            "roas": roas,
            "purchase_conversions": int(pick(r.get("actions"), PURCH)),
            "purchase_conversion_value": pick(r.get("action_values"), PURCH),
            "impressions": float(r.get("impressions") or 0),
            "reach": float(r.get("reach") or 0),
            "ctr": float(r.get("ctr") or 0),
            "cpc": float(r.get("cpc") or 0),
            "cpm": float(r.get("cpm") or 0),
        })
    return out

def write(name, data):
    p = os.path.join(SP, name)
    json.dump(data, open(p, "w", encoding="utf-8"))
    print(f"  wrote {name}: {len(data)} rows")

if __name__ == "__main__":
    print(f"Pulling live Meta data for {ACCT} …")
    write("ads_all.json", pull_ads())
    write("insights90.json", pull_insights("last_90d"))
    write("insights7.json", pull_insights("last_7d"))
    print("Done. Now run:  python _build_monitor.py")
