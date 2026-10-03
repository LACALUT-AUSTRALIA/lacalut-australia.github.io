# -*- coding: utf-8 -*-
# LACALUT Live Ads Monitor v2 — thumbnails + full Meta metrics + losers section
# Inputs (same dir or MON_DIR):
#   ads_all.json    [{id,name,effective_status,created_time,campaign,adset}]
#   insights90.json [{ad_id,spend,roas,purchase_conversions,purchase_conversion_value,impressions,reach,ctr,cpc,cpm,...}]  (last 90d)
#   insights7.json  same shape, last 7d
#   thumbs.json     {ad_id: {thumb,img}}
import json, os, html
from datetime import datetime, timezone, timedelta

SP = os.environ.get("MON_DIR") or os.path.dirname(os.path.abspath(__file__))

def load(name, default):
    p = os.path.join(SP, name)
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    return default

ads = load("ads_all.json", [])
ins90 = load("insights90.json", [])
ins7 = load("insights7.json", [])
thumbs = load("thumbs.json", {})
compliance = load("compliance.json", {})

def imap(rows):
    m = {}
    for r in rows:
        m[r["ad_id"]] = r
    return m

m90, m7 = imap(ins90), imap(ins7)
now = datetime.now(timezone.utc)

def parse_dt(s):
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

RECENT_DAYS = 21
ARCHIVED = {"ARCHIVED", "DELETED"}
LOSER_MIN_SPEND = 50.0   # 90d spend needed before we call it a proven loser
LOSER_ROAS = 0.7

for a in ads:
    aid = a["id"]
    r90 = m90.get(aid, {})
    r7 = m7.get(aid, {})
    a["_s90"] = float(r90.get("spend") or 0)
    a["_s7"] = float(r7.get("spend") or 0)
    a["_roas"] = r90.get("roas")
    a["_pc"] = int(r90.get("purchase_conversions") or 0)
    a["_rev"] = float(r90.get("purchase_conversion_value") or 0)
    a["_cac"] = (a["_s90"] / a["_pc"]) if a["_pc"] else None
    imp = float(r90.get("impressions") or 0)
    reach = float(r90.get("reach") or 0)
    a["_freq"] = (imp / reach) if reach else None
    a["_ctr"] = r90.get("ctr")
    a["_cpm"] = r90.get("cpm")
    dt = parse_dt(a.get("created_time", ""))
    a["_age"] = (now - dt.astimezone(timezone.utc)).days if dt else None
    a["_built"] = dt.astimezone(timezone(timedelta(hours=11))).strftime("%d/%m") if dt else "?"
    cp = compliance.get(aid, {})
    a["_comp"] = cp.get("c", "unscreened")
    a["_compwhy"] = cp.get("why", "")
    # prefer locally-downloaded thumbnail (Meta CDN URLs expire + block referrers)
    if os.path.exists(os.path.join(SP, "thumbs", aid + ".jpg")):
        a["_thumb"] = f"thumbs/{aid}.jpg"
    else:
        t = thumbs.get(aid, {})
        a["_thumb"] = t.get("thumb") or t.get("img") or ""

running, stuck, tested, losers, nodeliv = [], [], [], [], []
for a in ads:
    st = (a.get("effective_status") or "").upper()
    if st in ARCHIVED:
        continue
    recent = a["_age"] is not None and a["_age"] <= RECENT_DAYS
    if st == "ACTIVE":
        running.append(a)
    elif a["_s90"] >= LOSER_MIN_SPEND and (a["_roas"] or 0) < LOSER_ROAS:
        losers.append(a)
    elif a["_s90"] > 0:
        tested.append(a)
    elif recent and a["_s7"] == 0:
        stuck.append(a)
    else:
        nodeliv.append(a)

running.sort(key=lambda x: x["_s7"], reverse=True)
stuck.sort(key=lambda x: (x["_age"] if x["_age"] is not None else 999))
tested_real = [a for a in tested if a["_s90"] >= LOSER_MIN_SPEND]
tested_micro = [a for a in tested if a["_s90"] < LOSER_MIN_SPEND]
# compliant first, then best ROAS
tested_real.sort(key=lambda x: (x["_comp"] != "flagged", x["_roas"] or 0), reverse=True)
tested_micro.sort(key=lambda x: (x["_comp"] != "flagged", x["_roas"] or 0, x["_s90"]), reverse=True)
losers.sort(key=lambda x: x["_s90"], reverse=True)  # biggest money-burners first
nodeliv.sort(key=lambda x: (x["_age"] if x["_age"] is not None else 999))

# KPI cards from 7d set
t_sp = sum(float(r.get("spend") or 0) for r in ins7)
t_rev = sum(float(r.get("purchase_conversion_value") or 0) for r in ins7)
t_pc = sum(int(r.get("purchase_conversions") or 0) for r in ins7)
b_roas = (t_rev / t_sp) if t_sp else 0.0

def esc(s): return html.escape(str(s or ""))

def roas_badge(r):
    if r is None:
        return '<span class="pill pill-none">—</span>'
    cls = "pill-good" if r >= 1.0 else ("pill-mid" if r >= LOSER_ROAS else "pill-bad")
    return f'<span class="pill {cls}">{r:.2f}x</span>'

def money(v, dash_zero=True):
    if v is None or (dash_zero and v == 0):
        return '<span class="mut">—</span>'
    return f"${v:,.0f}" if v >= 10 else f"${v:,.2f}"

def numf(v, fmt, suffix=""):
    if v is None:
        return '<span class="mut">—</span>'
    return format(v, fmt) + suffix

def comp_badge(a):
    c = a["_comp"]
    if c == "cleared":
        return '<span class="pill pill-good" title="On the approved compliant launch list">OK</span>'
    if c == "flagged":
        why = esc(a["_compwhy"])
        return f'<span class="pill pill-bad" title="{why}">breach</span>'
    return '<span class="mut">&mdash;</span>'

def adcell(a):
    th = a["_thumb"]
    img = f'<img class="th" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-empty"></span>'
    return f'<div class="adc">{img}<span class="adname">{esc(a["name"])}</span></div>'

def metric_row(a, status_txt="", status_cls=""):
    days = f"{a['_age']}d" if a["_age"] is not None else "—"
    stat = f'<td class="c sub"><span class="dot {status_cls}"></span>{esc(status_txt)}</td>' if status_txt else ""
    return f"""<tr>
<td class="adtd">{adcell(a)}</td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
{stat}
<td class="c sub">{a['_built']}<span class="mut"> · {days}</span></td>
<td class="c">{comp_badge(a)}</td>
<td class="num">{money(a['_s90'])}</td>
<td class="num">{roas_badge(a['_roas'])}</td>
<td class="num">{a['_pc'] or '<span class="mut">0</span>'}</td>
<td class="num">{money(a['_cac'], dash_zero=False)}</td>
<td class="num">{numf(a['_freq'], '.1f')}</td>
<td class="num">{numf(a['_ctr'], '.2f', '%')}</td>
</tr>"""

HEAD = """<tr><th>Ad</th><th>Campaign / ad set</th>{st}<th>Built · age</th><th>Compliant</th><th>Spend 90d</th><th>ROAS 90d</th><th>Purch.</th><th>CAC</th><th>Freq</th><th>CTR</th></tr>"""

def table(rows, status_col=False):
    return f"""<div class="tablewrap"><table>
<thead>{HEAD.format(st='<th>Status</th>' if status_col else '')}</thead>
<tbody>{''.join(rows)}</tbody></table></div>"""

rows_running = []
for a in running:
    deliver = "delivering" if a["_s7"] > 0 else "no spend 7d"
    dcls = "dot-live" if a["_s7"] > 0 else "dot-warn"
    rows_running.append(metric_row(a, deliver, dcls))

rows_tested = [metric_row(a, a["effective_status"].replace("_", " ").lower(), "dot-warn") for a in tested_real]
rows_micro = [metric_row(a, a["effective_status"].replace("_", " ").lower(), "dot-warn") for a in tested_micro]
rows_losers = [metric_row(a, a["effective_status"].replace("_", " ").lower(), "dot-stuck") for a in losers]

rows_stuck = []
for a in stuck:
    age = f"{a['_age']}d ago" if a["_age"] is not None else "?"
    th = a["_thumb"]
    img = f'<img class="th" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-empty"></span>'
    rows_stuck.append(f"""<tr>
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a['name'])}</span></div></td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
<td class="c sub">{esc(a['effective_status'])}</td>
<td class="c sub">built {age}</td>
</tr>""")

rows_nodeliv = []
for a in nodeliv:
    th = a["_thumb"]
    img = f'<img class="th th-sm" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-sm th-empty"></span>'
    rows_nodeliv.append(f"""<tr>
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a['name'])}</span></div></td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
<td class="c sub">{esc(a['effective_status'])}</td>
<td class="c sub">built {a['_built']}</td>
</tr>""")

gen = now.astimezone(timezone(timedelta(hours=11))).strftime("%d/%m/%Y %H:%M AEDT")

stuck_section = ""
if rows_stuck:
    stuck_section = f"""
<section class="sec">
<h2>Built but not launched <span class="count">{len(stuck)}</span></h2>
<p class="note">Created in the last {RECENT_DAYS} days, not archived, zero spend in the last 7 days. These are sitting idle.</p>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign / ad set</th><th>Status</th><th>Built</th></tr></thead>
<tbody>{''.join(rows_stuck)}</tbody>
</table></div></section>"""
else:
    stuck_section = '<section class="sec"><h2>Built but not launched <span class="count">0</span></h2><p class="note">Nothing stuck. Every recently-built ad is live or spending.</p></section>'

nodeliv_section = ""
if rows_nodeliv:
    nodeliv_section = f"""
<section class="sec">
<h2>Never delivered <span class="count">{len(nodeliv)}</span></h2>
<p class="note">Built more than {RECENT_DAYS} days ago, zero spend in the last 90 days. Untested — not winners, not losers.</p>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign / ad set</th><th>Status</th><th>Built</th></tr></thead>
<tbody>{''.join(rows_nodeliv)}</tbody>
</table></div></section>"""

STYLE = """<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--sub:#6b7280;--line:#e6e8ec;--brand:#0B5394;--accent:#1c7ed6;--good:#1a7f45;--goodbg:#e7f6ec;--mid:#8a6d00;--midbg:#fbf3d6;--bad:#a4122b;--badbg:#fbe4e8;--live:#1a7f45;--warn:#b8860b;--stuck:#a4122b;--thbg:#e3edf8;--thtext:#0B5394;}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171b22;--ink:#e8eaed;--sub:#9aa3af;--line:#262c36;--brand:#6fb3ff;--accent:#4da3ff;--goodbg:#10301d;--midbg:#332b0c;--badbg:#36121b;--thbg:#15233a;--thtext:#8fc1ff;}}
:root[data-theme=light]{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--sub:#6b7280;--line:#e6e8ec;--goodbg:#e7f6ec;--midbg:#fbf3d6;--badbg:#fbe4e8;--thbg:#e3edf8;--thtext:#0B5394;}
:root[data-theme=dark]{--bg:#0e1116;--card:#171b22;--ink:#e8eaed;--sub:#9aa3af;--line:#262c36;--brand:#6fb3ff;--goodbg:#10301d;--midbg:#332b0c;--badbg:#36121b;--thbg:#15233a;--thtext:#8fc1ff;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1380px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:20px}
h1{font-size:24px;margin:0;letter-spacing:-.3px}
h1 .sw{color:var(--brand)}
.stamp{color:var(--sub);font-size:13px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:18px 0 30px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .lbl{color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.kpi .val{font-size:30px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
.kpi .val.good{color:var(--good)}.kpi .val.bad{color:var(--bad)}
section.sec{position:relative}
section.sec h2{position:sticky;top:0;z-index:6;background:var(--bg);margin:26px 0 0;padding:12px 0 8px;min-height:48px;box-sizing:border-box}
h2{font-size:18px;margin:34px 0 4px;display:flex;align-items:center;gap:10px}
h2 .count{background:var(--brand);color:#fff;border-radius:20px;font-size:13px;padding:2px 11px;font-weight:600}
h2.losers .count{background:var(--bad)}
.note{color:var(--sub);font-size:13px;margin:4px 0 14px}
.tablewrap{overflow-x:visible;border:1px solid var(--line);border-radius:14px;background:var(--card)}
@media (max-width:1240px){.tablewrap{overflow-x:auto}thead th{position:static}section.sec h2{position:static}}
table{border-collapse:separate;border-spacing:0;width:100%;min-width:900px;font-size:14px}
thead th{position:sticky;top:48px;z-index:5;background:var(--thbg);text-align:left;color:var(--thtext);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;padding:11px 12px;border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line);white-space:nowrap}
tbody td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
tbody tr:nth-child(even) td{background:rgba(127,127,127,.045)}
tbody tr:last-child td{border-bottom:0}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.c{color:var(--sub);font-size:13px}
td.sub{font-size:12.5px;white-space:nowrap}
td.adtd{min-width:230px;max-width:330px}
td.camp{max-width:260px}
td.camp div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
td.camp .mut{font-size:12px}
.adc{display:flex;align-items:center;gap:10px}
.adname{font-size:13.5px;line-height:1.35;word-break:break-word;overflow-wrap:anywhere}
.th{width:56px;height:56px;min-width:56px;border-radius:8px;object-fit:cover;background:var(--line);border:1px solid var(--line)}
.th-sm{width:40px;height:40px;min-width:40px}
.th-empty{display:inline-block}
.mut{color:var(--sub)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle}
.dot-live{background:var(--live)}.dot-warn{background:var(--warn)}.dot-stuck{background:var(--stuck)}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
.pill-good{background:var(--goodbg);color:var(--good)}.pill-mid{background:var(--midbg);color:var(--mid)}.pill-bad{background:var(--badbg);color:var(--bad)}.pill-none{background:var(--line);color:var(--sub)}
footer{margin-top:40px;color:var(--sub);font-size:12px;text-align:center}
</style>"""

html_body = f"""<title>LACALUT Live Ads Monitor</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%230866FF'/%3E%3Ctext x='32' y='45' font-size='38' font-family='Arial,sans-serif' font-weight='bold' fill='white' text-anchor='middle'%3E%E2%88%9E%3C/text%3E%3C/svg%3E">{STYLE}
<div class="wrap">
<header>
<h1>LACALUT <span class="sw">Live Ads Monitor</span></h1>
<div class="stamp">Refreshed {gen} &middot; metrics: last 90 days (KPI cards: last 7 days)</div>
</header>

<div class="cards">
<div class="kpi"><div class="lbl">Running (active)</div><div class="val">{len(running)}</div></div>
<div class="kpi"><div class="lbl">Built, not launched</div><div class="val {'bad' if stuck else 'good'}">{len(stuck)}</div></div>
<div class="kpi"><div class="lbl">Spend (7d)</div><div class="val">${t_sp:,.0f}</div></div>
<div class="kpi"><div class="lbl">Blended ROAS (7d)</div><div class="val {'good' if b_roas>=1 else 'bad'}">{b_roas:.2f}x</div></div>
<div class="kpi"><div class="lbl">Purchases (7d)</div><div class="val">{t_pc}</div></div>
</div>

<section class="sec">
<h2>Running ads <span class="count">{len(running)}</span></h2>
<p class="note">Status ACTIVE in Meta, sorted by 7-day spend. All metrics are last 90 days. CAC = spend &divide; purchases. Freq = avg times each person saw it.</p>
{table(rows_running, status_col=True)}
</section>
{stuck_section}

<section class="sec">
<h2>Previously tested (paused) <span class="count">{len(tested_real)}</span></h2>
<p class="note"><b>Only ads marked <span class="pill pill-good">OK</span> (or unscreened) are re-launch candidates.</b> Ads marked <span class="pill pill-bad">breach</span> were paused for compliance (disease claims, before/after, competitor comparison) &mdash; do NOT relaunch or recreate them, whatever their ROAS. Flagged ads are sorted to the bottom of this table. Hover a badge for the reason.</p>
{table(rows_tested, status_col=True)}
</section>

<section class="sec">
<h2>Barely tested &mdash; under ${LOSER_MIN_SPEND:.0f} spend <span class="count">{len(tested_micro)}</span></h2>
<p class="note">Too little spend to trust the numbers &mdash; a 35x ROAS on $1.45 is one lucky sale, not a winner. Treat these as untested. Sorted by ROAS for curiosity only.</p>
{table(rows_micro, status_col=True)}
</section>
{nodeliv_section}

<section class="sec">
<h2 class="losers">Proven losers &mdash; do NOT recreate <span class="count">{len(losers)}</span></h2>
<p class="note">Spent ${LOSER_MIN_SPEND:.0f}+ in the last 90 days with ROAS under {LOSER_ROAS:.1f}. Sorted by money burned. These angles/creatives failed with real budget &mdash; avoid making more of the same. A <span class="pill pill-bad">breach</span> badge means it was also non-compliant.</p>
{table(rows_losers, status_col=True)}
</section>

<footer>LACALUT Australia &middot; Smartek Labs &middot; data: Meta Ads (act_2157906551266386) &middot; {len(ads)} ads scanned &middot; thumbnails are Meta CDN links and refresh with each rebuild</footer>
</div>"""

open(os.path.join(SP, "monitor.html"), "w", encoding="utf-8").write(html_body)
open(os.path.join(SP, "index.html"), "w", encoding="utf-8").write(html_body)
print("written: monitor.html + index.html")
print("running:", len(running), "| stuck:", len(stuck), "| tested:", len(tested), "| never-delivered:", len(nodeliv), "| losers:", len(losers))
print("spend7: %.0f  blended_roas7: %.2f  purchases7: %d" % (t_sp, b_roas, t_pc))
