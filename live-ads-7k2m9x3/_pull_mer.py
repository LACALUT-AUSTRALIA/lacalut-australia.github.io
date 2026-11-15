# -*- coding: utf-8 -*-
"""MER auto-fill for the Media Buyer tab (15/11/2026).
Refreshes the scoreboard's Shopify + Meta daily numbers, then writes mer.json:
  MER = Meta ad spend / Shopify retail sales including GST (no shipping, no wholesale WS- orders),
  full days only (up to yesterday, Brisbane time). AOV = retail sales incl. GST / retail orders, last 30 full days.
Never fatal: on any error the old mer.json stays and the tab keeps its last values."""
import json, os, subprocess, sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

SP = os.path.dirname(os.path.abspath(__file__))
SB = os.path.join(os.path.dirname(SP), "scoreboard-9k4x2m")

def main():
    r = subprocess.run([sys.executable, "-X", "utf8", "_pull_data.py"], cwd=SB, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        print("  scoreboard pull FAILED, mer.json left as it was"); return 1
    d = json.load(open(os.path.join(SB, "data", "daily.json"), encoding="utf-8"))["days"]
    today = datetime.now(ZoneInfo("Australia/Brisbane")).date()
    full = [(today - timedelta(days=i)).isoformat() for i in range(1, 31)]          # yesterday back 30 days
    if any(k not in d or "meta_spend" not in d[k] or "retail_sales" not in d[k] for k in full[:3]):
        print("  last 3 full days missing from daily.json, mer.json left as it was"); return 1
    def tot(days):
        sp = sum(d.get(k, {}).get("meta_spend", 0) for k in days)
        rv = sum(d.get(k, {}).get("retail_sales", 0) for k in days) * 1.1
        od = sum(d.get(k, {}).get("retail_orders", 0) for k in days)
        return sp, rv, od
    s3, r3, _ = tot(full[:3]); s30, r30, o30 = tot(full)
    days = []
    for k in [today.isoformat()] + full[:7]:
        sp, rv, od = tot([k])
        days.append({"d": k, "spend": round(sp), "sales": round(rv), "mer": round(100 * sp / rv, 1) if rv else None})
    out = {"as_of": full[0], "pulled": datetime.now(ZoneInfo("Australia/Brisbane")).strftime("%d/%m/%Y %I:%M %p"),
           "mer3": round(100 * s3 / r3, 2), "mer30": round(100 * s30 / r30, 2),
           "aov": round(r30 / o30, 2) if o30 else None, "days": days}
    json.dump(out, open(os.path.join(SP, "mer.json"), "w", encoding="utf-8"))
    print("  wrote mer.json:", {k: out[k] for k in ("as_of", "mer3", "mer30", "aov")})
    return 0

if __name__ == "__main__":
    sys.exit(main())
