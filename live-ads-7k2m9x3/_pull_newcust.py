"""New vs returning customers TODAY (Queensland day) from Shopify, for the Media Buyer page. Read-only.
Writes newcust.json: totals from today's orders (new = customer's first order; ShopifyQL's new/returning grouping gave unstable numbers 27/11) + per Meta campaign counts by the LAST LINK the
buyer clicked (order UTM campaign = campaign name or id). Last-click undercounts Meta; the page says so.
Never fatal: on any error the old newcust.json stays. (Quan 27/11/2026: "are we acquiring new customers?")
"""
import json, os, re, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

SP = os.path.dirname(os.path.abspath(__file__))
API = "2025-10"

def env():
    e = {}
    for f in [os.path.expanduser("~/.env"), r"C:/Users/conta/OneDrive/Documents/Claude Code/.env"]:
        try:
            for l in open(f, encoding="utf-8", errors="ignore"):
                m = re.match(r"^([A-Z_]+)=(.*)$", l.strip())
                if m and m.group(2):
                    e.setdefault(m.group(1), m.group(2).strip('"'))
        except OSError:
            pass
    return e

def gql(E, query, variables=None):
    req = urllib.request.Request(
        f"https://{E['SHOPIFY_STORE_DOMAIN']}/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"X-Shopify-Access-Token": E.get("SHOPIFY_ADMIN_TOKEN") or E["SHOPIFY_ADMIN_API_TOKEN"],
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def main():
    E = env()
    now = datetime.now(ZoneInfo("Australia/Brisbane"))
    out = {"d": now.date().isoformat(), "pulled": now.strftime("%d/%m/%Y %I:%M %p"),
           "new": {"orders": 0, "sales": 0}, "ret": {"orders": 0, "sales": 0}, "camps": {}}
    # per campaign, by last link clicked
    Q = ('query($c:String,$q:String){orders(first:250,after:$c,query:$q){pageInfo{hasNextPage endCursor} '
         'nodes{currentTotalPriceSet{shopMoney{amount}} customer{numberOfOrders} customerJourneySummary{lastVisit{utmParameters{source campaign}}}}}}')
    cur, nodes = None, []
    while True:
        o = gql(E, Q, {"c": cur, "q": f"created_at:>={now.date().isoformat()}T00:00:00+10:00"})["data"]["orders"]
        nodes += o["nodes"]
        if not o["pageInfo"]["hasNextPage"]:
            break
        cur = o["pageInfo"]["endCursor"]
    out["new"], out["ret"] = {"orders": 0, "sales": 0}, {"orders": 0, "sales": 0}
    for n in nodes:
        k = "new" if int((n.get("customer") or {}).get("numberOfOrders") or 0) <= 1 else "ret"
        out[k]["orders"] += 1
        out[k]["sales"] += round(float(((n.get("currentTotalPriceSet") or {}).get("shopMoney") or {}).get("amount") or 0))
    for n in nodes:
        u = ((n.get("customerJourneySummary") or {}).get("lastVisit") or {}).get("utmParameters") or {}
        if (u.get("source") or "").lower() not in ("meta", "facebook", "fb", "ig", "instagram"):
            continue
        key = (u.get("campaign") or "").replace("+", " ").strip()
        if not key:
            continue
        c = out["camps"].setdefault(key, {"new": 0, "ret": 0})
        c["new" if int((n.get("customer") or {}).get("numberOfOrders") or 0) <= 1 else "ret"] += 1
    json.dump(out, open(os.path.join(SP, "newcust.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("  wrote newcust.json:", out["new"], out["ret"], len(out["camps"]), "campaign keys")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("  newcust pull FAILED, newcust.json left as it was:", e)
        sys.exit(1)
