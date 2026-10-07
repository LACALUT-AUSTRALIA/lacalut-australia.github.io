# -*- coding: utf-8 -*-
"""
Pull LIFETIME (date_preset=maximum) ad-level insights for the all-time Hall of Fame.
Writes insights_max.json: [{ad_id, ad_name, spend, roas, purchase_conversions,
purchase_conversion_value, impressions, ctr}]
"""
import json, os, urllib.request, urllib.parse

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

def main():
    fields = "ad_id,ad_name,spend,purchase_roas,actions,action_values,impressions,ctr"
    url = (f"{GRAPH}/{ACCT}/insights?level=ad&date_preset=maximum&limit=400"
           f"&fields={fields}&access_token={urllib.parse.quote(TOK)}")
    rows = []
    while url:
        with urllib.request.urlopen(url, timeout=120) as r:
            d = json.load(r)
        rows += d.get("data", [])
        url = d.get("paging", {}).get("next")
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
            "ad_name": r.get("ad_name", ""),
            "spend": float(r.get("spend") or 0),
            "roas": roas,
            "purchase_conversions": int(pick(r.get("actions"), PURCH)),
            "purchase_conversion_value": pick(r.get("action_values"), PURCH),
            "impressions": float(r.get("impressions") or 0),
            "ctr": float(r.get("ctr") or 0),
        })
    json.dump(out, open(os.path.join(SP, "insights_max.json"), "w", encoding="utf-8"))
    print(f"wrote insights_max.json: {len(out)} ads (lifetime)")

if __name__ == "__main__":
    main()
