# -*- coding: utf-8 -*-
import json, os, html
from datetime import datetime, timezone, timedelta

SP = os.environ.get("MON_DIR") or os.path.dirname(os.path.abspath(__file__))

ads = json.load(open(os.path.join(SP, "ads_all.json"), encoding="utf-8"))
spend = json.load(open(os.path.join(SP, "spend7.json"), encoding="utf-8"))

spend_map = {}
for s in spend:
    spend_map[s["ad_id"]] = {
        "spend": float(s.get("spend") or 0),
        "roas": s.get("roas"),
        "pc": int(s.get("purchase_conversions") or 0),
    }

now = datetime.now(timezone.utc)

def parse_dt(s):
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

RECENT_DAYS = 21
ARCHIVED = {"ARCHIVED", "DELETED"}

running, stuck = [], []
for a in ads:
    st = (a.get("effective_status") or "").upper()
    sm = spend_map.get(a["id"], {"spend": 0.0, "roas": None, "pc": 0})
    a["_spend"] = sm["spend"]
    a["_roas"] = sm["roas"]
    a["_pc"] = sm["pc"]
    dt = parse_dt(a.get("created_time", ""))
    a["_age_days"] = (now - dt.astimezone(timezone.utc)).days if dt else None
    recent = a["_age_days"] is not None and a["_age_days"] <= RECENT_DAYS

    if st == "ACTIVE":
        running.append(a)
    elif st not in ARCHIVED and recent and sm["spend"] == 0:
        # built but never launched / never delivered
        stuck.append(a)

# totals from last-7d spend set
total_spend = sum(s["spend"] for s in spend_map.values())
total_rev = sum(s["spend"] * (s["roas"] or 0) for s in spend_map.values())
total_pc = sum(s["pc"] for s in spend_map.values())
blended_roas = (total_rev / total_spend) if total_spend else 0.0

# running ads sorted by spend desc
running.sort(key=lambda x: x["_spend"], reverse=True)
stuck.sort(key=lambda x: (x["_age_days"] if x["_age_days"] is not None else 999))

def esc(s): return html.escape(str(s or ""))

def roas_badge(r):
    if r is None:
        return '<span class="pill pill-none">no data</span>'
    cls = "pill-good" if r >= 1.0 else ("pill-mid" if r >= 0.7 else "pill-bad")
    return f'<span class="pill {cls}">{r:.2f}x</span>'

gen = now.astimezone(timezone(timedelta(hours=11))).strftime("%d/%m/%Y %H:%M AEDT")

rows_running = []
for a in running:
    r = a["_roas"]
    spend_txt = f"${a['_spend']:,.0f}" if a["_spend"] >= 1 else ("$0" if a["_spend"] == 0 else f"${a['_spend']:.2f}")
    deliver = "delivering" if a["_spend"] > 0 else "no spend 7d"
    dcls = "dot-live" if a["_spend"] > 0 else "dot-warn"
    rows_running.append(f"""<tr>
<td><span class="dot {dcls}"></span>{esc(a['name'])}</td>
<td class="c">{esc(a['campaign'])}</td>
<td class="c">{esc(a['adset'])}</td>
<td class="num">{spend_txt}</td>
<td class="num">{roas_badge(r)}</td>
<td class="num">{a['_pc']}</td>
<td class="c sub">{deliver}</td>
</tr>""")

rows_stuck = []
for a in stuck:
    age = f"{a['_age_days']}d ago" if a["_age_days"] is not None else "?"
    rows_stuck.append(f"""<tr>
<td><span class="dot dot-stuck"></span>{esc(a['name'])}</td>
<td class="c">{esc(a['campaign'])}</td>
<td class="c">{esc(a['adset'])}</td>
<td class="c sub">{esc(a['effective_status'])}</td>
<td class="c sub">built {age}</td>
</tr>""")

stuck_section = ""
if rows_stuck:
    stuck_section = f"""
<h2>Built but not launched <span class="count">{len(stuck)}</span></h2>
<p class="note">Created in the last {RECENT_DAYS} days, not archived, zero spend in the last 7 days. These are sitting idle.</p>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign</th><th>Ad set</th><th>Status</th><th>Built</th></tr></thead>
<tbody>{''.join(rows_stuck)}</tbody>
</table></div>"""
else:
    stuck_section = '<h2>Built but not launched <span class="count">0</span></h2><p class="note">Nothing stuck. Every recently-built ad is live or spending.</p>'

STYLE = """<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--sub:#6b7280;--line:#e6e8ec;--brand:#0B5394;--accent:#1c7ed6;--good:#1a7f45;--goodbg:#e7f6ec;--mid:#8a6d00;--midbg:#fbf3d6;--bad:#a4122b;--badbg:#fbe4e8;--live:#1a7f45;--warn:#b8860b;--stuck:#a4122b;}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171b22;--ink:#e8eaed;--sub:#9aa3af;--line:#262c36;--brand:#6fb3ff;--accent:#4da3ff;--goodbg:#10301d;--midbg:#332b0c;--badbg:#36121b;}}
:root[data-theme=light]{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--sub:#6b7280;--line:#e6e8ec;--goodbg:#e7f6ec;--midbg:#fbf3d6;--badbg:#fbe4e8;}
:root[data-theme=dark]{--bg:#0e1116;--card:#171b22;--ink:#e8eaed;--sub:#9aa3af;--line:#262c36;--brand:#6fb3ff;--goodbg:#10301d;--midbg:#332b0c;--badbg:#36121b;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:20px}
h1{font-size:24px;margin:0;letter-spacing:-.3px}
h1 .sw{color:var(--brand)}
.stamp{color:var(--sub);font-size:13px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:18px 0 30px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .lbl{color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.kpi .val{font-size:30px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
.kpi .val.good{color:var(--good)}.kpi .val.bad{color:var(--bad)}
h2{font-size:18px;margin:34px 0 4px;display:flex;align-items:center;gap:10px}
h2 .count{background:var(--brand);color:#fff;border-radius:20px;font-size:13px;padding:2px 11px;font-weight:600}
.note{color:var(--sub);font-size:13px;margin:4px 0 14px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}
table{border-collapse:collapse;width:100%;min-width:720px;font-size:14px}
thead th{text-align:left;color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.4px;padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
tbody td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.c{color:var(--sub);font-size:13px}
td.sub{font-size:12.5px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle}
.dot-live{background:var(--live)}.dot-warn{background:var(--warn)}.dot-stuck{background:var(--stuck)}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
.pill-good{background:var(--goodbg);color:var(--good)}.pill-mid{background:var(--midbg);color:var(--mid)}.pill-bad{background:var(--badbg);color:var(--bad)}.pill-none{background:var(--line);color:var(--sub)}
footer{margin-top:40px;color:var(--sub);font-size:12px;text-align:center}
</style>"""

html_body = f"""{STYLE}
<div class="wrap">
<header>
<h1>LACALUT <span class="sw">Live Ads Monitor</span></h1>
<div class="stamp">Refreshed {gen} &middot; auto-updates every 15 min</div>
</header>

<div class="cards">
<div class="kpi"><div class="lbl">Running (active)</div><div class="val">{len(running)}</div></div>
<div class="kpi"><div class="lbl">Built, not launched</div><div class="val {'bad' if stuck else 'good'}">{len(stuck)}</div></div>
<div class="kpi"><div class="lbl">Spend (7d)</div><div class="val">${total_spend:,.0f}</div></div>
<div class="kpi"><div class="lbl">Blended ROAS (7d)</div><div class="val {'good' if blended_roas>=1 else 'bad'}">{blended_roas:.2f}x</div></div>
<div class="kpi"><div class="lbl">Purchases (7d)</div><div class="val">{total_pc}</div></div>
</div>

<h2>Running ads <span class="count">{len(running)}</span></h2>
<p class="note">Status ACTIVE in Meta. Sorted by 7-day spend. ROAS and purchases are last 7 days.</p>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign</th><th>Ad set</th><th>Spend 7d</th><th>ROAS 7d</th><th>Purch.</th><th>Delivery</th></tr></thead>
<tbody>{''.join(rows_running)}</tbody>
</table></div>
{stuck_section}

<footer>LACALUT Australia &middot; Smartek Labs &middot; data: Meta Ads (act_2157906551266386) &middot; {len(ads)} ads scanned</footer>
</div>"""

open(os.path.join(SP, "monitor.html"), "w", encoding="utf-8").write(html_body)
print("monitor.html written")
print("running:", len(running))
print("stuck (built-not-launched):", len(stuck))
print("total_spend_7d: %.2f" % total_spend)
print("blended_roas_7d: %.3f" % blended_roas)
print("total_purchases_7d:", total_pc)
print("--- stuck names ---")
for a in stuck:
    print(" -", a["name"], "|", a["effective_status"], "| built", a["_age_days"], "d ago")
