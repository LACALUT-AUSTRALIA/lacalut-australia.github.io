# -*- coding: utf-8 -*-
"""
Pull account-level Meta spend + purchase value BY MONTH (Jan 2026 -> today) so the
Store-health strip can show average ROAS per month next to Shopify CVR/revenue.
Writes meta_monthly.json: [{"m":"Jan","spend":...,"value":...,"roas":...}, ...]
"""
import json, os, urllib.request, urllib.parse
from datetime import date

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
    since, until = "2026-01-01", date.today().isoformat()
    tr = urllib.parse.quote(json.dumps({"since": since, "until": until}))
    url = (f"{GRAPH}/{ACCT}/insights?level=account&time_increment=monthly"
           f"&time_range={tr}&fields=spend,action_values&limit=50"
           f"&access_token={urllib.parse.quote(TOK)}")
    rows = []
    while url:
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        rows += d.get("data", [])
        url = d.get("paging", {}).get("next")
    MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    out = []
    for r in rows:
        spend = float(r.get("spend") or 0)
        value = pick(r.get("action_values"), PURCH)
        mi = int(r["date_start"][5:7]) - 1
        out.append({"m": MON[mi], "spend": round(spend, 2), "value": round(value, 2),
                    "roas": round(value / spend, 2) if spend else 0.0})
    json.dump(out, open(os.path.join(SP, "meta_monthly.json"), "w", encoding="utf-8"))
    print(f"wrote meta_monthly.json: {len(out)} months")
    for m in out:
        print(f"  {m['m']}: spend ${m['spend']:,.0f}  value ${m['value']:,.0f}  ROAS {m['roas']:.2f}x")

if __name__ == "__main__":
    main()
