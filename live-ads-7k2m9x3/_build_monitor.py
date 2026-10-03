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

def ad_type(a):
    import re as _re
    nm = (a["name"] + " " + a["adset"]).lower()
    if _re.search(r"crsl|carousel", nm): return "carousel"
    if _re.search(r"vid|video", nm): return "video"
    return "image"

def stage_of(a):
    nm = (a.get("campaign", "") + " " + a.get("adset", "")).lower()
    if any(k in nm for k in ("bof", "retarget", "back in stock", "back-in-stock", "cart", "dpa", "catalog")):
        return "bof"
    if any(k in nm for k in ("mof", "warm", "engager")):
        return "mof"
    if any(k in nm for k in ("tof", "cold", "broad", "prospect", "testing", "scaling")):
        return "cold"
    return "unassigned"

STAGE_LABEL = {"cold": "Cold / TOF", "mof": "MOF / Warm", "bof": "BOF / Retarget", "unassigned": "Unassigned"}

def verdict(a):
    st = (a.get("effective_status") or "").upper()
    r = a["_roas"] or 0
    live = st == "ACTIVE"
    if live and r >= 3:                       v = ("scale", "&#128640; Scale")
    elif live and r >= 1.5:                    v = ("keep", "&#9989; Keep")
    elif live and a["_s90"] >= 50:             v = ("zombie", "&#129503; Zombie")
    elif (not live) and r >= 1.5 and a["_s90"] > 0: v = ("recycle", "&#9851; Recycle")
    elif (not live) and r < 1.5 and a["_s90"] >= 50: v = ("dead", "&#9904; Dead")
    else:
        return '<span class="mut">&mdash;</span>'
    return f'<span class="vb v-{v[0]}">{v[1]}</span>'

def row_attrs(a):
    key = esc((a["name"] + " " + a["campaign"] + " " + a["adset"]).lower())
    return f'data-s="{key}" data-t="{ad_type(a)}" data-stage="{stage_of(a)}"'

def adcell(a):
    th = a["_thumb"]
    img = f'<img class="th" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-empty"></span>'
    return f'<div class="adc">{img}<span class="adname">{esc(a["name"])}</span></div>'

def metric_row(a, status_txt="", status_cls=""):
    days = f"{a['_age']}d" if a["_age"] is not None else "—"
    stat = f'<td class="c sub"><span class="dot {status_cls}"></span>{esc(status_txt)}</td>' if status_txt else ""
    return f"""<tr {row_attrs(a)}>
<td class="adtd">{adcell(a)}</td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
{stat}
<td class="c">{verdict(a)}</td>
<td class="c sub">{a['_built']}<span class="mut"> · {days}</span></td>
<td class="c">{comp_badge(a)}</td>
<td class="num">{money(a['_s90'])}</td>
<td class="num">{money(a['_rev'])}</td>
<td class="num">{roas_badge(a['_roas'])}</td>
<td class="num">{a['_pc'] or '<span class="mut">0</span>'}</td>
<td class="num">{money(a['_cac'], dash_zero=False)}</td>
<td class="num">{numf(a['_freq'], '.1f')}</td>
<td class="num">{numf(a['_ctr'], '.2f', '%')}</td>
</tr>"""

HEAD = """<tr><th>Ad</th><th>Campaign / ad set</th>{st}<th>Verdict</th><th>Built · age</th><th>Compliant</th><th>Spend 90d</th><th>Rev 90d</th><th>ROAS 90d</th><th>Purch.</th><th>CAC</th><th>Freq</th><th>CTR</th></tr>"""

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
    rows_stuck.append(f"""<tr {row_attrs(a)}>
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a['name'])}</span></div></td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
<td class="c sub">{esc(a['effective_status'])}</td>
<td class="c sub">built {age}</td>
</tr>""")

rows_nodeliv = []
for a in nodeliv:
    th = a["_thumb"]
    img = f'<img class="th th-sm" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-sm th-empty"></span>'
    rows_nodeliv.append(f"""<tr {row_attrs(a)}>
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a['name'])}</span></div></td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
<td class="c sub">{esc(a['effective_status'])}</td>
<td class="c sub">built {a['_built']}</td>
</tr>""")

# ── PROVEN WINNERS — ready to re-run (card section, ported from the winners artifact) ──
WIN_ROAS_MIN = 1.5      # breakeven (true COGS breakeven ~1.5x)
WIN_SPEND_MIN = 30.0    # enough 90d spend to mean something
PRODUCTS = [
    ("White & Repair", "#6E59C7", ("white", "repair", "hydroxyapatite", " hap")),
    ("Herbal",         "#7A8B2A", ("herbal",)),
    ("Multi-SKU",      "#C77F2A", ("multi", "3-sku", "3 sku", "chooser", "find your formula", "range", "gift", "bundle")),
    ("Sensitive",      "#2E6FB0", ("sensitive",)),
    ("Flora",          "#1E8C64", ("flora",)),
    ("AKTIV",          "#C8102E", ("aktiv",)),
]
def product_of(a):
    nm = (a["name"] + " " + a.get("adset", "")).lower()
    for label, col, keys in PRODUCTS:   # order matters: Herbal/Multi before AKTIV
        if any(k in nm for k in keys):
            return label, col
    return "Other", "#5B6472"

_seen = {}
for a in ads:
    if (a.get("effective_status") or "").upper() in ARCHIVED:
        continue
    if a["_comp"] == "flagged":          # never re-run a compliance breach
        continue
    r = a["_roas"] or 0
    if r < WIN_ROAS_MIN or a["_s90"] < WIN_SPEND_MIN or a["_pc"] < 1:
        continue
    key = a["name"].strip().lower()
    if key not in _seen or r > (_seen[key]["_roas"] or 0):
        _seen[key] = a
winners = sorted(_seen.values(), key=lambda x: x["_roas"] or 0, reverse=True)

def win_tier(r):
    if r >= 3: return "strong", "Strong winner"
    if r >= 2: return "solid", "Solid winner"
    return "test", "Tested winner"

win_strong = sum(1 for w in winners if (w["_roas"] or 0) >= 3)
win_spend = sum(w["_s90"] for w in winners)
win_rev = sum(w["_rev"] for w in winners)
ADS_ACT = "2157906551266386"

def win_row(a):
    label, col = product_of(a)
    tcls, tlbl = win_tier(a["_roas"] or 0)
    th = a["_thumb"]
    img = f'<img class="th th-sm" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-sm th-empty"></span>'
    link = f'https://adsmanager.facebook.com/adsmanager/manage/ads?act={ADS_ACT}&selected_ad_ids={esc(a["id"])}'
    return f'''<tr class="winrow" data-wp="{esc(label.lower())}">
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a["name"])}</span></div></td>
<td class="c"><span class="wchip" style="--pc:{col}">{esc(label)}</span></td>
<td class="c"><span class="wtier t-{tcls}">{tlbl}</span></td>
<td class="c camp"><div>{esc(a["campaign"])}</div><div class="mut">{esc(a["adset"])}</div></td>
<td class="num">{roas_badge(a["_roas"])}</td>
<td class="num">{money(a["_s90"])}</td>
<td class="num">{money(a["_rev"])}</td>
<td class="num">{a["_pc"] or '<span class="mut">0</span>'}</td>
<td class="c"><a class="wlink" href="{link}" target="_blank" rel="noopener">Open &#8599;</a></td>
</tr>'''

_wp_seen, win_products = set(), []
for w in winners:
    label, col = product_of(w)
    if label not in _wp_seen:
        _wp_seen.add(label); win_products.append((label, col))
win_pills = '<button class="wfilter wall" data-wf="__all" aria-pressed="true">All products</button>' + "".join(
    f'<button class="wfilter" data-wf="{esc(l.lower())}" style="--pc:{c}">{esc(l)}</button>' for l, c in win_products)
win_rows_html = "".join(win_row(w) for w in winners)
winners_section = f'''
<section class="sec winsec">
<h2>&#11088; Proven winners &mdash; ready to re-run <span class="count">{len(winners)}</span></h2>
<p class="note">Compliant creatives above breakeven (ROAS &ge; {WIN_ROAS_MIN:g}&times;) with real spend (&ge; ${WIN_SPEND_MIN:g}) in the last 90 days, deduped to the best instance of each, ranked by ROAS. Breaches are excluded &mdash; never re-run those. Pick what to switch on under the new testing structure.</p>
<div class="wstats">
<div class="wstat"><b>{len(winners)}</b><span>Winning creatives</span></div>
<div class="wstat"><b>{win_strong}</b><span>Strong (&ge;3&times; ROAS)</span></div>
<div class="wstat"><b>${win_spend:,.0f}</b><span>Combined spend (90d)</span></div>
<div class="wstat"><b>${win_rev:,.0f}</b><span>Combined revenue</span></div>
</div>
<div class="wfilters">{win_pills}</div>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Product</th><th>Tier</th><th>Campaign / ad set</th><th>ROAS 90d</th><th>Spend 90d</th><th>Rev 90d</th><th>Purch.</th><th></th></tr></thead>
<tbody>{win_rows_html}</tbody></table></div>
</section>''' if winners else ""

# ── BY FUNNEL STAGE — compact per-stage summary strip (Cold / MOF / BOF) ──
STAGES = ["cold", "mof", "bof"]
stage_stats = {s: {"sp": 0.0, "rev": 0.0, "win": 0, "n": 0} for s in STAGES}
for a in ads:
    if (a.get("effective_status") or "").upper() in ARCHIVED:
        continue
    s = stage_of(a)
    if s in stage_stats:
        stage_stats[s]["sp"] += a["_s90"]; stage_stats[s]["rev"] += a["_rev"]; stage_stats[s]["n"] += 1
for w in winners:
    s = stage_of(w)
    if s in stage_stats:
        stage_stats[s]["win"] += 1

def stage_card(s):
    d = stage_stats[s]
    ro = (d["rev"] / d["sp"]) if d["sp"] else 0
    cls = "good" if ro >= 1.5 else ("bad" if d["sp"] else "")
    return (f'<div class="stcard st-{s}"><div class="stlbl">{STAGE_LABEL[s]}</div>'
            f'<div class="strow"><span class="stroas {cls}">{ro:.2f}x</span><span class="stx">ROAS 90d</span></div>'
            f'<div class="stsub">${d["sp"]:,.0f} spent &middot; {d["win"]} winner{"" if d["win"]==1 else "s"} &middot; {d["n"]} ads</div></div>')

stage_section = (f'''
<section class="sec">
<h2>By funnel stage <span class="count">{sum(1 for s in STAGES if stage_stats[s]["n"])}</span></h2>
<p class="note">Every delivering ad grouped by the audience temperature it ran to (read from campaign + ad set names). Use the <b>Stage</b> filter in the bar above to drill any section to one stage.</p>
<div class="ststrip">{''.join(stage_card(s) for s in STAGES)}</div>
</section>''')

# ── BY CAMPAIGN — rollup table (the aggregation the ad-level tables lack) ──
camp_roll = {}
for a in ads:
    if (a.get("effective_status") or "").upper() in ARCHIVED:
        continue
    c = a["campaign"] or "(no campaign)"
    d = camp_roll.setdefault(c, {"sp": 0.0, "rev": 0.0, "pc": 0, "n": 0, "live": 0})
    d["sp"] += a["_s90"]; d["rev"] += a["_rev"]; d["pc"] += a["_pc"]; d["n"] += 1
    if (a.get("effective_status") or "").upper() == "ACTIVE":
        d["live"] += 1
camp_roll_rows = sorted(camp_roll.items(), key=lambda kv: kv[1]["sp"], reverse=True)

def camp_roll_row(c, d):
    ro = (d["rev"] / d["sp"]) if d["sp"] else None
    cac = (d["sp"] / d["pc"]) if d["pc"] else None
    pc_cell = str(d["pc"]) if d["pc"] else '<span class="mut">0</span>'
    return (f'<tr><td class="c camp"><div>{esc(c)}</div><div class="mut">{d["live"]} live &middot; {d["n"]} ads</div></td>'
            f'<td class="num">{money(d["sp"])}</td><td class="num">{money(d["rev"])}</td>'
            f'<td class="num">{roas_badge(ro)}</td>'
            f'<td class="num">{pc_cell}</td>'
            f'<td class="num">{money(cac, dash_zero=False)}</td></tr>')

campaign_section = (f'''
<section class="sec">
<h2>By campaign <span class="count">{len(camp_roll_rows)}</span></h2>
<p class="note">Account rolled up to campaign level &mdash; spend, revenue, blended ROAS and CPA across all non-archived ads (last 90 days), sorted by spend.</p>
<div class="tablewrap"><table class="rollup">
<thead><tr><th>Campaign</th><th>Spend 90d</th><th>Rev 90d</th><th>ROAS 90d</th><th>Purch.</th><th>CAC</th></tr></thead>
<tbody>{''.join(camp_roll_row(c, d) for c, d in camp_roll_rows)}</tbody>
</table></div></section>''' if camp_roll_rows else "")

gen = now.astimezone(timezone(timedelta(hours=11))).strftime("%d/%m/%Y %H:%M AEDT")

campaigns = sorted({a["campaign"] for a in ads if a.get("campaign")})
camp_opts = "".join(f'<option value="{esc(c.lower())}">{esc(c)}</option>' for c in campaigns)

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
.fbar{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 4px;padding:12px 14px;background:var(--thbg);border:1px solid var(--line);border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.fbar input,.fbar select{font:14px inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 12px}
.fbar input{flex:1;min-width:220px}
.fbar .fcount{color:var(--thtext);font-weight:700;font-size:13px;white-space:nowrap}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:18px 0 30px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .lbl{color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.kpi .val{font-size:30px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
.kpi .val.good{color:var(--good)}.kpi .val.bad{color:var(--bad)}
section.sec{position:relative}
section.sec h2{position:sticky;top:64px;z-index:6;background:var(--bg);margin:26px 0 0;padding:12px 0 8px;min-height:48px;box-sizing:border-box}
h2{font-size:18px;margin:34px 0 4px;display:flex;align-items:center;gap:10px}
h2 .count{background:var(--brand);color:#fff;border-radius:20px;font-size:13px;padding:2px 11px;font-weight:600}
h2.losers .count{background:var(--bad)}
.note{color:var(--sub);font-size:13px;margin:4px 0 14px}
.tablewrap{overflow-x:visible;border:1px solid var(--line);border-radius:14px;background:var(--card)}
@media (max-width:1240px){.tablewrap{overflow-x:auto}thead th{position:static}section.sec h2{position:static}}
table{border-collapse:separate;border-spacing:0;width:100%;min-width:1080px;font-size:14px}
thead th{position:sticky;top:112px;z-index:5;background:var(--thbg);text-align:left;color:var(--thtext);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;padding:11px 12px;border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line);white-space:nowrap}
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
.vb{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:700;white-space:nowrap}
.v-scale{background:var(--goodbg);color:var(--good)}.v-keep{background:#e9f0f8;color:var(--accent)}
.v-zombie{background:var(--badbg);color:var(--bad)}.v-recycle{background:var(--midbg);color:var(--mid)}.v-dead{background:var(--line);color:var(--sub)}
:root[data-theme=dark] .v-keep,@media (prefers-color-scheme:dark){.v-keep{background:#132535}}
.ststrip{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:4px 0 10px}
.stcard{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--sc,var(--accent));border-radius:14px;padding:14px 16px}
.st-cold{--sc:#2f6db4}.st-mof{--sc:#c98a22}.st-bof{--sc:#e0245e}
.stlbl{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);font-weight:700}
.strow{display:flex;align-items:baseline;gap:8px;margin-top:4px}
.stroas{font-size:28px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.stroas.good{color:var(--good)}.stroas.bad{color:var(--bad)}
.stx{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--sub)}
.stsub{font-size:12.5px;color:var(--sub);margin-top:4px}
table.rollup{min-width:720px}
.winsec h2{color:var(--brand)}
.wstats{display:flex;flex-wrap:wrap;gap:22px;margin:4px 0 14px}
.wstat b{display:block;font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-.3px}
.wstat span{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--sub)}
.wfilters{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 16px}
.wfilter{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:5px 12px;border-radius:999px;border:1px solid var(--line);border-left:3px solid var(--pc,var(--brand));background:var(--card);color:var(--sub)}
.wfilter[aria-pressed=true]{background:var(--pc,var(--brand));color:#fff;border-color:var(--pc,var(--brand))}
.wfilter.wall{border-left-color:var(--brand)}.wfilter.wall[aria-pressed=true]{background:var(--brand);border-color:var(--brand)}
.wgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:14px}
.wcard{display:grid;grid-template-columns:150px 1fr;background:var(--card);border:1px solid var(--line);border-left:5px solid var(--tc,var(--sub));border-radius:14px;overflow:hidden}
.wcard.t-strong{--tc:var(--good)}.wcard.t-solid{--tc:var(--mid)}.wcard.t-test{--tc:var(--sub)}
.wmedia{background:#0c0e12;aspect-ratio:1;overflow:hidden}
.wmedia img{width:100%;height:100%;object-fit:cover;display:block}
.wmedia .noimg{display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:12px}
.wbody{padding:13px 15px;min-width:0}
.wtop{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.wchip{font-size:11px;font-weight:700;color:#fff;background:var(--pc);padding:3px 9px;border-radius:999px}
.wtier{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}
.wtier.t-strong{color:var(--good)}.wtier.t-solid{color:var(--mid)}.wtier.t-test{color:var(--sub)}
.wh{font-size:15px;line-height:1.25;margin:0 0 8px}
.wroasrow{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:9px}
.wroas{font-size:25px;font-weight:800;line-height:1;letter-spacing:-.03em;color:var(--tc);font-variant-numeric:tabular-nums}
.wroas .wx{font-size:14px;font-weight:600}
.wroaslbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--sub)}
.wmetrics{font-size:12px;color:var(--sub);margin-left:auto;font-variant-numeric:tabular-nums}
.wmetrics b{color:var(--ink);font-weight:700}
.wloc{margin:0;display:grid;gap:5px}
.wloc div{display:grid;grid-template-columns:148px 1fr;gap:10px;align-items:baseline}
.wloc dt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--sub);margin:0}
.wloc dd{margin:0;font-size:12px;color:var(--sub);font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-word}
.wloc dd.adname{color:var(--ink);font-weight:600}
.wlink{display:inline-block;margin-top:10px;font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none}
.wlink:hover{text-decoration:underline}
.winrow .wlink{margin-top:0;white-space:nowrap}
.winrow .wchip,.winrow .wtier{white-space:nowrap}
.winrow td.adtd{min-width:260px}
@media(max-width:620px){.wgrid{grid-template-columns:1fr}.wcard{grid-template-columns:1fr}.wmedia{aspect-ratio:16/10}.wloc div{grid-template-columns:1fr}.wmetrics{margin-left:0;flex-basis:100%}}
</style>"""

html_body = f"""<title>LACALUT Live Ads Monitor</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='8' y1='20' x2='56' y2='44' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%230064E0'/%3E%3Cstop offset='1' stop-color='%2300B2FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M32 33 C25 21 15 22 13 32 C15 42 25 43 32 31 C39 19 49 22 51 32 C49 42 39 43 32 31 Z' fill='none' stroke='url(%23m)' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">{STYLE}
<div class="wrap">
<header>
<h1>LACALUT <span class="sw">Live Ads Monitor</span></h1>
<div class="stamp">Refreshed {gen} &middot; metrics: last 90 days (KPI cards: last 7 days)</div>
</header>

<div class="fbar">
<input id="fq" type="search" placeholder="Search ads, campaigns, ad sets&hellip;">
<select id="ft"><option value="">All types</option><option value="image">Image</option><option value="video">Video</option><option value="carousel">Carousel</option></select>
<select id="fc"><option value="">All campaigns</option>{camp_opts}</select>
<select id="fs"><option value="">All stages</option><option value="cold">Cold / TOF</option><option value="mof">MOF / Warm</option><option value="bof">BOF / Retarget</option><option value="unassigned">Unassigned</option></select>
<span class="fcount" id="fn"></span>
</div>

<div class="cards">
<div class="kpi"><div class="lbl">Running (active)</div><div class="val">{len(running)}</div></div>
<div class="kpi"><div class="lbl">Built, not launched</div><div class="val {'bad' if stuck else 'good'}">{len(stuck)}</div></div>
<div class="kpi"><div class="lbl">Spend (7d)</div><div class="val">${t_sp:,.0f}</div></div>
<div class="kpi"><div class="lbl">Revenue (7d)</div><div class="val">${t_rev:,.0f}</div></div>
<div class="kpi"><div class="lbl">Blended ROAS (7d)</div><div class="val {'good' if b_roas>=1 else 'bad'}">{b_roas:.2f}x</div></div>
<div class="kpi"><div class="lbl">Purchases (7d)</div><div class="val">{t_pc}</div></div>
</div>

{winners_section}
{stage_section}
{campaign_section}

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

<script>
(function(){{
var q=document.getElementById('fq'),t=document.getElementById('ft'),c=document.getElementById('fc'),st=document.getElementById('fs'),n=document.getElementById('fn');
var rows=[].slice.call(document.querySelectorAll('tr[data-s]'));
var counts=[].slice.call(document.querySelectorAll('h2 .count'));
var orig=counts.map(function(el){{return el.textContent}});
function apply(){{
  var s=q.value.toLowerCase().trim(),ty=t.value,ca=c.value,stg=st.value,shown=0;
  rows.forEach(function(r){{
    var ok=(!s||r.getAttribute('data-s').indexOf(s)>-1)&&(!ty||r.getAttribute('data-t')===ty)&&(!ca||r.getAttribute('data-s').indexOf(ca)>-1)&&(!stg||r.getAttribute('data-stage')===stg);
    r.style.display=ok?'':'none'; if(ok)shown++;
  }});
  document.querySelectorAll('section.sec').forEach(function(sec){{
    var all=sec.querySelectorAll('tr[data-s]'); if(!all.length)return;
    var vis=sec.querySelectorAll('tr[data-s]:not([style*="none"])').length;
    var pill=sec.querySelector('h2 .count'); if(pill)pill.textContent=vis;
  }});
  var act=(s||ty||ca||stg);
  n.textContent=act?shown+' of '+rows.length+' ads':'';
  if(!act)counts.forEach(function(el,i){{el.textContent=orig[i]}});
}}
[q,t,c,st].forEach(function(el){{el.addEventListener('input',apply)}});
var wf=[].slice.call(document.querySelectorAll('.wfilter')),wc=[].slice.call(document.querySelectorAll('.winrow'));
wf.forEach(function(b){{b.addEventListener('click',function(){{
  var f=b.getAttribute('data-wf');
  wf.forEach(function(x){{x.setAttribute('aria-pressed',x===b?'true':'false')}});
  wc.forEach(function(cd){{cd.style.display=(f==='__all'||cd.getAttribute('data-wp')===f)?'':'none'}});
}})}});
}})();
</script>
<footer>LACALUT Australia &middot; Smartek Labs &middot; data: Meta Ads (act_2157906551266386) &middot; {len(ads)} ads scanned &middot; thumbnails are Meta CDN links and refresh with each rebuild</footer>
</div>"""

open(os.path.join(SP, "monitor.html"), "w", encoding="utf-8").write(html_body)
open(os.path.join(SP, "index.html"), "w", encoding="utf-8").write(html_body)
print("written: monitor.html + index.html")
print("running:", len(running), "| stuck:", len(stuck), "| tested:", len(tested), "| never-delivered:", len(nodeliv), "| losers:", len(losers))
print("spend7: %.0f  blended_roas7: %.2f  purchases7: %d" % (t_sp, b_roas, t_pc))
