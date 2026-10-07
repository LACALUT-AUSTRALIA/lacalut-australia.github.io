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
daily = load("insights_daily.json", {})

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
    a["_roas7"] = r7.get("roas")                                   # RECENT (7d) performance
    a["_pc7"] = int(r7.get("purchase_conversions") or 0)
    a["_rev7"] = float(r7.get("purchase_conversion_value") or 0)
    a["_cac"] = (a["_s90"] / a["_pc"]) if a["_pc"] else None
    imp = float(r90.get("impressions") or 0)
    reach = float(r90.get("reach") or 0)
    a["_freq"] = (imp / reach) if reach else None
    a["_ctr"] = r90.get("ctr")
    a["_cpm"] = r90.get("cpm")
    a["_imp"] = imp
    # clicks: native field when the pull has it, else derive from spend/cpc
    cl = r90.get("clicks")
    if cl is None:
        cpc = float(r90.get("cpc") or 0)
        cl = (a["_s90"] / cpc) if cpc else 0
    a["_clicks"] = int(cl or 0)
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

# Lifetime spend per ad (account till date) — Aditya 07/10: an ad only counts as
# "not launched" if it has NEVER spent in the account's entire history, not just 90d.
insmax = load("insights_max.json", [])
smax_map = {r["ad_id"]: float(r.get("spend") or 0) for r in insmax}

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
    elif smax_map.get(a["id"], 0) > 0:
        tested.append(a)    # spent at SOME point lifetime → it launched; never "not launched"
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
    # Aditya 05/10: any ad that SPENT money must show a definitive compliant-or-not
    # verdict here — never a blank "—". Automated scan of the ad name + live copy
    # against the AICIS breach patterns (disease/therapeutic/clinical/before-after/
    # competitor). It reads the COPY, not the image — an image-level breach needs the
    # separate image-compliance audit.
    c = a["_comp"]
    spent = (a.get("_s90") or 0) > 0
    if c == "flagged":
        why = esc(a["_compwhy"])
        return f'<span class="pill pill-bad" title="Copy breach: {why}">&#9888; Breach</span>'
    if c == "cleared":
        return '<span class="pill pill-good" title="On the approved compliant launch list">&#9989; OK</span>'
    if spent:   # no breach found in name/copy, and it spent → definitive pass
        return '<span class="pill pill-good" title="No breach found in ad name or copy (automated scan)">&#9989; Pass</span>'
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
    # Judge DELIVERING ads on RECENT (7d) ROAS — the only honest "is it working now".
    # An ad that is ACTIVE in Meta but spent $0 in 7d is NOT scaling; it's idle →
    # judge it on 90d history (Recycle if proven, else Dead), never Scale/Keep.
    st = (a.get("effective_status") or "").upper()
    r90 = a["_roas"] or 0
    r7 = a["_roas7"] or 0
    delivering = st == "ACTIVE" and a["_s7"] > 0
    if delivering and r7 >= 3:                        v = ("scale", "&#128640; Scale")
    elif delivering and r7 >= 1.5:                    v = ("keep", "&#9989; Keep")
    elif delivering and a["_s7"] >= 50:
        # Aditya 07/10: Zombie only once the ad has had a fair run — 2+ weeks old.
        # Younger + underperforming = still in learning → "Testing", not Zombie.
        if a["_age"] is not None and a["_age"] < 14:  v = ("testing", "&#129514; Testing")
        else:                                         v = ("zombie", "&#129503; Zombie")
    elif r90 >= 1.5 and a["_s90"] > 0:                v = ("recycle", "&#9851; Recycle")
    elif r90 < 1.5 and a["_s90"] >= 50:               v = ("dead", "&#9904; Dead")
    else:
        return '<span class="mut">&mdash;</span>'
    return f'<span class="vb v-{v[0]}">{v[1]}</span>'

def row_attrs(a):
    key = esc((a["name"] + " " + a["campaign"] + " " + a["adset"]).lower())
    return f'data-s="{key}" data-t="{ad_type(a)}" data-stage="{stage_of(a)}" data-aid="{a["id"]}"'

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
<td class="num d-sp">{money(a['_s90'])}</td>
<td class="num d-rev">{money(a['_rev'])}</td>
<td class="num d-r7">{roas_badge(a['_roas7'])}</td>
<td class="num d-r90">{roas_badge(a['_roas'])}</td>
<td class="num d-pc">{a['_pc'] or '<span class="mut">0</span>'}</td>
<td class="num d-cac">{money(a['_cac'], dash_zero=False)}</td>
<td class="num">{numf(a['_freq'], '.1f')}</td>
<td class="num">{numf(a['_ctr'], '.2f', '%')}</td>
</tr>"""

# Aditya 07/10: plain metric names — the active window (90d default, or the picked
# date range) lives in the timeline bar + note, never baked into the column name.
HEAD = """<tr><th>Ad</th><th>Campaign / ad set</th>{st}<th>Verdict</th><th>Built · age</th><th>Compliant</th><th class="h-sp" title="Default: last 90 days — pick a range in the Date range bar to change the window">Spend</th><th class="h-rev" title="Default: last 90 days — pick a range in the Date range bar to change the window">Revenue</th><th class="h-r7" title="Always the last 7 days — hidden while a custom range is active">ROAS 7d</th><th class="h-r90" title="Default: last 90 days — pick a range in the Date range bar to change the window">ROAS</th><th class="h-pc">Purch.</th><th class="h-cac">CAC</th><th>Freq</th><th>CTR</th></tr>"""

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
<td class="c camp"><div>{esc(a['campaign'])}</div></td>
<td class="c camp"><div>{esc(a['adset'])}</div></td>
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

# ── PROVEN WINNERS — HOLDING AT SCALE (last 7 days) ───────────────────────────
# Quan 05/10: the old 90d/$30 filter listed ads that looked great at tiny spend
# but crashed the moment they were scaled. A real "ready to run" winner must still
# be profitable NOW, at real spend. So judge on the LAST 7 DAYS:
#   7d ROAS >= breakeven (1.5x)  AND  7d spend >= $150  AND  >=1 purchase (7d).
WIN_ROAS_MIN = 1.5      # true COGS breakeven ~1.5x — measured on the last 7 days
WIN_SPEND_MIN = 50.0    # real recent spend (last 7d). $50 catches proven ads running at
                        # modest budget; raise to 150 for only the at-full-scale winners.
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
    r = a["_roas7"] or 0                 # judge on RECENT 7d ROAS, not inflated 90d
    if r < WIN_ROAS_MIN or a["_s7"] < WIN_SPEND_MIN or a["_pc7"] < 1:
        continue
    key = a["name"].strip().lower()
    if key not in _seen or r > (_seen[key]["_roas7"] or 0):
        _seen[key] = a
winners = sorted(_seen.values(), key=lambda x: x["_roas7"] or 0, reverse=True)

def win_tier(r):
    if r >= 3: return "strong", "Strong winner"
    if r >= 2: return "solid", "Solid winner"
    return "test", "Tested winner"

win_strong = sum(1 for w in winners if (w["_roas7"] or 0) >= 3)
win_spend = sum(w["_s7"] for w in winners)
win_rev = sum(w["_rev7"] for w in winners)
ADS_ACT = "2157906551266386"

def win_row(a):
    label, col = product_of(a)
    tcls, tlbl = win_tier(a["_roas7"] or 0)
    th = a["_thumb"]
    img = f'<img class="th th-sm" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-sm th-empty"></span>'
    link = f'https://adsmanager.facebook.com/adsmanager/manage/ads?act={ADS_ACT}&selected_ad_ids={esc(a["id"])}'
    st = (a.get("effective_status") or "").upper()
    live = st == "ACTIVE"
    stlbl = "LIVE" if live else "PAUSED"
    stbg = "#1A7F37" if live else "#B4540A"
    stchip = f'<span style="background:{stbg};color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.3px;vertical-align:middle">{stlbl}</span>'
    return f'''<tr class="winrow" data-wp="{esc(label.lower())}">
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(a["name"])}</span> {stchip}</div></td>
<td class="c"><span class="wchip" style="--pc:{col}">{esc(label)}</span></td>
<td class="c"><span class="wtier t-{tcls}">{tlbl}</span></td>
<td class="c camp"><div>{esc(a["campaign"])}</div><div class="mut">{esc(a["adset"])}</div></td>
<td class="num">{roas_badge(a["_roas7"])}</td>
<td class="num">{money(a["_s7"])}</td>
<td class="num">{money(a["_rev7"])}</td>
<td class="num">{a["_pc7"] or '<span class="mut">0</span>'}</td>
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
<h2>&#11088; Proven winners &mdash; profitable NOW (last 7 days) <span class="count">{len(winners)}</span></h2>
<p class="note">Only creatives still profitable right now at real spend: 7-day ROAS &ge; {WIN_ROAS_MIN:g}&times; (true COGS breakeven) AND &ge; ${WIN_SPEND_MIN:g} spent in the last 7 days AND at least one purchase. Deduped to the best instance of each, ranked by 7-day ROAS. Compliance breaches excluded. This deliberately drops the ads that looked great at tiny spend but crashed when scaled &mdash; and note how many below are PAUSED (good creatives switched off while weaker ones kept spending).</p>
<div class="wstats">
<div class="wstat"><b>{len(winners)}</b><span>Holding at scale</span></div>
<div class="wstat"><b>{win_strong}</b><span>Strong (&ge;3&times; 7d ROAS)</span></div>
<div class="wstat"><b>${win_spend:,.0f}</b><span>Combined spend (7d)</span></div>
<div class="wstat"><b>${win_rev:,.0f}</b><span>Combined revenue (7d)</span></div>
</div>
<div class="wfilters">{win_pills}</div>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Product</th><th>Tier</th><th>Campaign / ad set</th><th>ROAS 7d</th><th>Spend 7d</th><th>Rev 7d</th><th>Purch. 7d</th><th></th></tr></thead>
<tbody>{win_rows_html}</tbody></table></div>
</section>''' if winners else ""

# ── ALL-TIME HALL OF FAME — best creatives EVER by lifetime ROAS (Quan 07/10) ──
# Compliance is deliberately NOT filtered here: the point is to see what actually
# converts so we build more of the same (a breach ad's ANGLE gets rebuilt compliant).
ads_by_id = {a["id"]: a for a in ads}
HOF_SPEND_MIN, HOF_PURCH_MIN, HOF_TOP = 200.0, 5, 30
# Aditya 07/10: the same creative can live under several ad names ("VID - Funky Music"
# vs "Herbal | Video | Funky Music | Rebuilt winner …") — exact-name dedupe missed them.
# Any name containing a group phrase collapses to one entry (best ROAS instance kept).
HOF_DUP_GROUPS = ["funky music"]
def hof_key(nm):
    n = (nm or "").strip().lower()
    for g in HOF_DUP_GROUPS:
        if g in n:
            return g
    return n
_hof_seen = {}
for r in insmax:
    if r["spend"] < HOF_SPEND_MIN or r["purchase_conversions"] < HOF_PURCH_MIN:
        continue
    key = hof_key(r.get("ad_name") or r["ad_id"])
    if key not in _hof_seen or r["roas"] > _hof_seen[key]["roas"]:
        _hof_seen[key] = r
hof = sorted(_hof_seen.values(), key=lambda x: x["roas"], reverse=True)[:HOF_TOP]

def hof_row(i, r):
    a = ads_by_id.get(r["ad_id"])
    nm = r.get("ad_name") or (a["name"] if a else r["ad_id"])
    if a:
        label, col = product_of(a)
        camp = f'<div>{esc(a["campaign"])}</div><div class="mut">{esc(a["adset"])}</div>'
        st = (a.get("effective_status") or "").upper()
        cb = comp_badge(a)
        th = a["_thumb"]
    else:
        label, col = product_of({"name": nm, "adset": ""})
        camp, st, cb, th = '<span class="mut">(deleted)</span>', "DELETED", '<span class="mut">&mdash;</span>', ""
        p = os.path.join(SP, "thumbs", r["ad_id"] + ".jpg")
        if os.path.exists(p):
            th = f'thumbs/{r["ad_id"]}.jpg'
    img = f'<img class="th" src="{esc(th)}" loading="lazy" alt="">' if th else '<span class="th th-empty"></span>'
    live = st == "ACTIVE"
    stbg = "#1A7F37" if live else ("#8B2635" if st == "DELETED" else "#B4540A")
    stlbl = "LIVE" if live else ("DELETED" if st == "DELETED" else "PAUSED")
    stchip = f'<span style="background:{stbg};color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.3px;vertical-align:middle">{stlbl}</span>'
    link = f'https://adsmanager.facebook.com/adsmanager/manage/ads?act={ADS_ACT}&selected_ad_ids={esc(r["ad_id"])}'
    medal = "&#129351;" if i == 1 else ("&#129352;" if i == 2 else ("&#129353;" if i == 3 else str(i)))
    return f'''<tr class="winrow" data-wp="{esc(label.lower())}">
<td class="c hofrank">{medal}</td>
<td class="adtd"><div class="adc">{img}<span class="adname">{esc(nm)}</span> {stchip}</div></td>
<td class="c"><span class="wchip" style="--pc:{col}">{esc(label)}</span></td>
<td class="c camp">{camp}</td>
<td class="num"><span class="pill pill-good hofroas">{r["roas"]:.2f}x</span></td>
<td class="num">{money(r["spend"])}</td>
<td class="num">{money(r["purchase_conversion_value"])}</td>
<td class="num">{r["purchase_conversions"]}</td>
<td class="c">{cb}</td>
<td class="c"><a class="wlink" href="{link}" target="_blank" rel="noopener">Open &#8599;</a></td>
</tr>'''

hof_rows_html = "".join(hof_row(i + 1, r) for i, r in enumerate(hof))
hof_spend = sum(r["spend"] for r in hof)
hof_rev = sum(r["purchase_conversion_value"] for r in hof)
hof_section = f'''
<section class="sec winsec">
<h2>&#127942; All-time Hall of Fame &mdash; best creatives ever (lifetime) <span class="count">{len(hof)}</span></h2>
<p class="note">Every ad the account has ever run, ranked by LIFETIME ROAS &mdash; minimum ${HOF_SPEND_MIN:g} lifetime spend and {HOF_PURCH_MIN} purchases so tiny-spend flukes don&rsquo;t pollute the list. Compliance is shown but NOT filtered: this is the build-more-of-this list &mdash; a breach ad&rsquo;s winning ANGLE gets rebuilt compliant, never re-run as-is. Deduped by creative name (best instance kept).</p>
<div class="wstats">
<div class="wstat"><b>{len(hof)}</b><span>All-time winners</span></div>
<div class="wstat"><b>${hof_spend:,.0f}</b><span>Combined lifetime spend</span></div>
<div class="wstat"><b>${hof_rev:,.0f}</b><span>Combined lifetime revenue</span></div>
<div class="wstat"><b>{(hof_rev/hof_spend if hof_spend else 0):.2f}x</b><span>Blended lifetime ROAS</span></div>
</div>
<div class="tablewrap"><table>
<thead><tr><th>#</th><th>Ad</th><th>Product</th><th>Campaign / ad set</th><th>ROAS lifetime</th><th>Spend lifetime</th><th>Rev lifetime</th><th>Purch.</th><th>Compliant</th><th></th></tr></thead>
<tbody>{hof_rows_html}</tbody></table></div>
</section>''' if hof else ""

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
    d = camp_roll.setdefault(c, {"sp": 0.0, "rev": 0.0, "pc": 0, "n": 0, "live": 0, "imp": 0.0, "cl": 0})
    d["sp"] += a["_s90"]; d["rev"] += a["_rev"]; d["pc"] += a["_pc"]; d["n"] += 1
    d["imp"] += a["_imp"]; d["cl"] += a["_clicks"]
    if (a.get("effective_status") or "").upper() == "ACTIVE":
        d["live"] += 1
camp_roll_rows = sorted(camp_roll.items(), key=lambda kv: kv[1]["sp"], reverse=True)

def camp_roll_row(c, d):
    # Aditya 07/10: full metric set per campaign — Spend, CPM, CPC, Purchases, CPP, CVR%, AOV, ROAS.
    # Each metric cell is classed (cr-*) + the row carries data-camp so the date-range
    # picker recomputes every column for the chosen window from the per-day data.
    ro  = (d["rev"] / d["sp"]) if d["sp"] else None
    cpp = (d["sp"] / d["pc"]) if d["pc"] else None
    cpm = (d["sp"] / d["imp"] * 1000) if d["imp"] else None
    cpc = (d["sp"] / d["cl"]) if d["cl"] else None
    cvr = (d["pc"] / d["cl"] * 100) if d["cl"] else None
    aov = (d["rev"] / d["pc"]) if d["pc"] else None
    pc_cell = str(d["pc"]) if d["pc"] else '<span class="mut">0</span>'
    return (f'<tr data-camp="{esc(c.lower())}"><td class="c camp"><div>{esc(c)}</div><div class="mut">{d["live"]} live &middot; {d["n"]} ads</div></td>'
            f'<td class="num cr-sp">{money(d["sp"])}</td>'
            f'<td class="num cr-cpm">{money(cpm, dash_zero=False)}</td>'
            f'<td class="num cr-cpc">{money(cpc, dash_zero=False)}</td>'
            f'<td class="num cr-pc">{pc_cell}</td>'
            f'<td class="num cr-cpp">{money(cpp, dash_zero=False)}</td>'
            f'<td class="num cr-cvr">{numf(cvr, ".2f", "%")}</td>'
            f'<td class="num cr-aov">{money(aov, dash_zero=False)}</td>'
            f'<td class="num cr-rev">{money(d["rev"])}</td>'
            f'<td class="num cr-roas">{roas_badge(ro)}</td></tr>')

campaign_section = (f'''
<section class="sec">
<h2>By campaign <span class="count">{len(camp_roll_rows)}</span></h2>
<p class="note">Account rolled up to campaign level across all non-archived ads, sorted by spend. Default window is the last 90 days &mdash; pick any range in the <b>&#128197; Date range</b> bar above and every column recomputes for that window. CPP = cost per purchase; CVR = purchases &divide; link clicks; AOV = revenue &divide; purchases.</p>
<div class="tablewrap"><table class="rollup">
<thead><tr><th>Campaign</th><th>Spend</th><th>CPM</th><th>CPC</th><th>Purchases</th><th>CPP</th><th>CVR%</th><th>AOV</th><th>Revenue</th><th>ROAS</th></tr></thead>
<tbody>{''.join(camp_roll_row(c, d) for c, d in camp_roll_rows)}</tbody>
</table></div></section>''' if camp_roll_rows else "")

# ── COMPLIANCE — every ad that spent money: compliant or not (Aditya 05/10) ──
spenders = [a for a in ads if a["_s90"] > 0]
spenders.sort(key=lambda x: (x["_comp"] != "flagged", -x["_s90"]))  # breaches first, biggest spend first
comp_nc = [a for a in spenders if a["_comp"] == "flagged"]
comp_nc_spend = sum(a["_s90"] for a in comp_nc)
comp_ok_spend = sum(a["_s90"] for a in spenders) - comp_nc_spend

def comp_verdict_cell(a):
    if a["_comp"] == "flagged":
        return '<span class="pill pill-bad">&#10060; NON-COMPLIANT</span>'
    if a["_comp"] == "cleared":
        return '<span class="pill pill-good">&#9989; Compliant</span>'
    return '<span class="pill pill-good">&#9989; Compliant</span>'

def comp_reason(a):
    if a["_comp"] == "flagged":
        return esc(a["_compwhy"])
    if a["_comp"] == "cleared":
        return '<span class="mut">approved compliant list</span>'
    return '<span class="mut">no breach detected in name/copy</span>'

comp_rows = ""
for a in spenders:
    st = (a.get("effective_status") or "").replace("_", " ")
    comp_rows += f'''<tr {row_attrs(a)}>
<td class="adtd">{adcell(a)}</td>
<td class="c camp"><div>{esc(a['campaign'])}</div><div class="mut">{esc(a['adset'])}</div></td>
<td class="c sub">{esc(st.lower())}</td>
<td class="num">{money(a['_s90'])}</td>
<td class="num">{roas_badge(a['_roas'])}</td>
<td class="c">{comp_verdict_cell(a)}</td>
<td class="c" style="max-width:280px">{comp_reason(a)}</td>
</tr>'''

compliance_section = f'''
<section class="sec">
<h2>&#9878;&#65039; Compliance &mdash; every ad that spent money <span class="count">{len(spenders)}</span></h2>
<p class="note">All {len(spenders)} ads with spend in the last 90 days, screened against the AICIS cosmetic-only breach patterns (disease/therapeutic claims, clinical/authority, before-after, competitor comparison) on ad name + live copy. Copy-level only &mdash; image breaches need the separate image audit. Non-compliant ads listed first, biggest spend first. (16 deleted ads with ~$1,040 combined spend no longer exist in the account and can&rsquo;t be screened.) <a class="wlink" href="spend_compliance.csv" download>Download CSV &#8595;</a></p>
<div class="wstats">
<div class="wstat"><b class="shbad">{len(comp_nc)}</b><span>Non-compliant ads</span></div>
<div class="wstat"><b class="shbad">${comp_nc_spend:,.0f}</b><span>Spend on breaches (90d)</span></div>
<div class="wstat"><b>{len(spenders)-len(comp_nc)}</b><span>Compliant ads</span></div>
<div class="wstat"><b>${comp_ok_spend:,.0f}</b><span>Compliant spend (90d)</span></div>
</div>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign / ad set</th><th>Status</th><th>Spend 90d</th><th>ROAS 90d</th><th>Compliant?</th><th>Reason</th></tr></thead>
<tbody>{comp_rows}</tbody></table></div>
</section>'''

# ── STORE HEALTH — Shopify monthly CVR + revenue (Quan 05/10: "very important") ──
store = load("store_monthly.json", None)
meta_monthly = load("meta_monthly.json", []) or []
roas_by_m = {r["m"]: r for r in meta_monthly}
store_section = ""
if store:
    mx = max(m["rev"] for m in store["months"]) or 1
    def cvr_cls(v):
        return "good" if v >= 5 else ("mid" if v >= 4 else "bad")
    def roas_cls(v):
        return "good" if v >= 2 else ("mid" if v >= 1.4 else "bad")
    # spreadsheet-style strip: labelled rows (Month header / CVR / ROAS / Revenue) + bar chart beneath
    mcols = ('<div class="shm shlbl">'
             '<div class="shmon shcell">&nbsp;</div>'
             '<div class="shcvr shcell">CVR</div>'
             '<div class="shroas shcell">META ROAS</div>'
             '<div class="shrev shcell">REVENUE</div>'
             '<div class="shbarw"></div></div>')
    for m in store["months"]:
        h = max(6, round(74 * m["rev"] / mx))
        rev_lbl = f"${m['rev']/1000:,.0f}k" if m["rev"] >= 1000 else f"${m['rev']:,.0f}"
        mm = roas_by_m.get(m["m"].rstrip("*"))
        if mm and mm["spend"]:
            roas_div = (f'<div class="shroas shcell sh-{roas_cls(mm["roas"])}" '
                        f'title="Meta {esc(m["m"])}: spend ${mm["spend"]:,.0f} &middot; attributed ${mm["value"]:,.0f}">'
                        f'{mm["roas"]:.2f}x</div>')
        else:
            roas_div = '<div class="shroas shcell sh-na">&ndash;</div>'
        mcols += (f'<div class="shm" title="{esc(m["m"])}: CVR {m["cvr"]:.2f}% &middot; ${m["rev"]:,.2f}">'
                  f'<div class="shmon shcell">{esc(m["m"])}</div>'
                  f'<div class="shcvr shcell sh-{cvr_cls(m["cvr"])}">{m["cvr"]:.2f}%</div>'
                  f'{roas_div}'
                  f'<div class="shrev shcell">{rev_lbl}</div>'
                  f'<div class="shbarw"><div class="shbar" style="height:{h}px"></div></div></div>')
    ov = store["overall"]
    tot_sp = sum(r["spend"] for r in meta_monthly)
    tot_val = sum(r["value"] for r in meta_monthly)
    ov_roas = (f'<b class="shrevtot sh-{roas_cls(tot_val / tot_sp)}">{tot_val / tot_sp:.2f}x</b>'
               f'<span>Meta ROAS &middot; Jan &ndash; today</span>') if tot_sp else ""
    store_section = f'''
<section class="sec">
<h2>&#128722; Store health &mdash; Shopify CVR, Meta ROAS &amp; revenue by month <span class="count">{len(store["months"])}</span></h2>
<p class="note">Online Store channel, total sales (AUD), source: Shopify &middot; pulled {esc(store["pulled"])}. {esc(store["note"])} Monthly ROAS = Meta Ads attributed purchase value &divide; spend (account level, live from Meta). The number ads ultimately answer to: traffic we buy &times; this conversion rate.</p>
<div class="shwrap">
<div class="shoverall"><b>{ov["cvr"]:.2f}%</b><span>CVR &middot; {esc(ov["label"])}</span><b class="shrevtot">${ov["revenue"]:,.0f}</b><span>Online Store revenue</span>{ov_roas}</div>
<div class="shmonths">{mcols}</div>
</div>
</section>'''

# refreshed CSV copy of the compliance table, downloadable from the page
import csv as _csv
with open(os.path.join(SP, "spend_compliance.csv"), "w", newline="", encoding="utf-8-sig") as _f:
    _w = _csv.writer(_f)
    _w.writerow(["Ad Name", "Ad ID", "Status", "Campaign", "Ad Set", "Spend 90d (AUD)", "ROAS 90d", "Compliant?", "Reason"])
    for a in spenders:
        if a["_comp"] == "flagged":
            vd, why = "NON-COMPLIANT", a["_compwhy"]
        elif a["_comp"] == "cleared":
            vd, why = "Compliant", "approved compliant list"
        else:
            vd, why = "Compliant", "no breach detected in name/copy"
        _w.writerow([a["name"], a["id"], a.get("effective_status", ""), a["campaign"], a["adset"],
                     round(a["_s90"], 2), round(a["_roas"] or 0, 2), vd, why])

gen = now.astimezone(timezone(timedelta(hours=11))).strftime("%d/%m/%Y %H:%M AEDT")

campaigns = sorted({a["campaign"] for a in ads if a.get("campaign")})
camp_opts = "".join(f'<option value="{esc(c.lower())}">{esc(c)}</option>' for c in campaigns)

stuck_section = ""
if rows_stuck:
    stuck_section = f"""
<section class="sec">
<h2>Built but not launched <span class="count">{len(stuck)}</span></h2>
<p class="note">Created in the last {RECENT_DAYS} days, not archived, <b>$0 spent in the account's ENTIRE history</b> (lifetime-checked against Meta, not just the last 90 days) and nothing in the last 7 days. These are sitting idle. Any ad that has ever spent a cent is excluded from this list.</p>
<div class="tablewrap"><table>
<thead><tr><th>Ad</th><th>Campaign</th><th>Ad set</th><th>Status</th><th>Built</th></tr></thead>
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
.tabs{position:sticky;top:0;z-index:11;display:flex;gap:7px;overflow-x:auto;background:var(--bg);padding:10px 0;margin:0 0 2px;scrollbar-width:thin}
.tabbtn{font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--sub);display:inline-flex;align-items:center;gap:7px}
.tabbtn[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:#fff}
.tabbtn .tcount{background:var(--thbg);color:var(--thtext);border-radius:999px;font-size:11px;padding:1px 7px;font-variant-numeric:tabular-nums}
.tabbtn[aria-pressed=true] .tcount{background:rgba(255,255,255,.25);color:#fff}
.tabbtn.tb-bad .tcount{background:var(--badbg);color:var(--bad)}
.tabbtn.tb-bad[aria-pressed=true] .tcount{background:rgba(255,255,255,.25);color:#fff}
.shbad{color:var(--bad)}
.fbar{position:sticky;top:54px;z-index:9;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 4px;padding:12px 14px;background:var(--thbg);border:1px solid var(--line);border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.fbar input,.fbar select{font:14px inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 12px}
.fbar input{flex:1;min-width:220px}
.fbar .fcount{color:var(--thtext);font-weight:700;font-size:13px;white-space:nowrap}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:18px 0 30px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .lbl{color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.kpi .val{font-size:30px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
.kpi .val.good{color:var(--good)}.kpi .val.bad{color:var(--bad)}
section.sec{position:relative}
section.sec h2{position:sticky;top:118px;z-index:6;background:var(--bg);margin:26px 0 0;padding:12px 0 8px;min-height:48px;box-sizing:border-box}
h2{font-size:18px;margin:34px 0 4px;display:flex;align-items:center;gap:10px}
h2 .count{background:var(--brand);color:#fff;border-radius:20px;font-size:13px;padding:2px 11px;font-weight:600}
h2.losers .count{background:var(--bad)}
.note{color:var(--sub);font-size:13px;margin:4px 0 14px}
.tablewrap{overflow-x:visible;border:1px solid var(--line);border-radius:14px;background:var(--card)}

table{border-collapse:separate;border-spacing:0;width:100%;min-width:0;font-size:14px}
thead th{position:sticky;top:166px;z-index:5;background:var(--thbg);text-align:left;color:var(--thtext);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;padding:11px 12px;border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line);white-space:nowrap}
@media (max-width:1240px){.tablewrap{overflow-x:auto}thead th{position:static}section.sec h2{position:static}}
tbody td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
tbody tr:nth-child(even) td{background:rgba(127,127,127,.045)}
tbody tr:last-child td{border-bottom:0}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.c{color:var(--sub);font-size:13px}
td.sub{font-size:12.5px;white-space:nowrap}
td.adtd{min-width:170px;max-width:330px}
td.camp{min-width:110px;max-width:240px}
td.camp div{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;line-clamp:1;white-space:normal;overflow-wrap:anywhere;line-height:1.3}
td.camp div.mut{-webkit-line-clamp:2;line-clamp:2}
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
.v-zombie{background:var(--badbg);color:var(--bad)}.v-testing{background:var(--midbg);color:var(--mid)}.v-recycle{background:var(--midbg);color:var(--mid)}.v-dead{background:var(--line);color:var(--sub)}
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
@media (max-width:1240px){.winrow td.adtd{min-width:150px;max-width:240px}}
@media (max-width:900px){.winrow td.adtd{min-width:96px;max-width:160px}
.winrow .wchip,.winrow .wtier{white-space:normal}
.wchip{font-size:10px;padding:2px 6px;display:inline-block;line-height:1.2}
.wtier{font-size:9.5px;letter-spacing:0}
.winrow .wlink{font-size:11.5px}}
@media (max-width:600px){.winrow td.adtd{min-width:70px;max-width:110px}
.winrow .wlink{white-space:normal}}
.shwrap{display:flex;gap:18px;align-items:stretch;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;overflow-x:auto}
.shoverall{display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:150px;padding-right:18px;border-right:1px solid var(--line)}
.shoverall b{font-size:26px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums;color:var(--brand)}
.shoverall b.shrevtot{font-size:20px;margin-top:8px;color:var(--ink)}
.shoverall span{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--sub)}
.shmonths{display:flex;gap:0;flex:1;align-items:stretch;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.shm{flex:1;min-width:52px;text-align:center;border-left:1px solid var(--line)}
.shm:first-child{border-left:none}
.shcell{height:28px;line-height:28px;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden}
.shmon{font-size:10.5px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;background:var(--thbg)}
.shcvr{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.shroas{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;background:rgba(28,126,214,.07)}
.shrev{font-size:11.5px;color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.sh-good{color:var(--good)}.sh-mid{color:var(--mid)}.sh-bad{color:var(--bad)}.sh-na{color:var(--sub)}
.shlbl .shcell{font-size:9px;font-weight:700;color:var(--sub);letter-spacing:.07em;text-align:left;padding-left:10px}
.shlbl{min-width:84px;flex:0 0 84px}
.shbarw{display:flex;align-items:flex-end;justify-content:center;height:84px;padding-top:8px}
.shbar{width:70%;max-width:34px;background:linear-gradient(180deg,var(--accent),var(--brand));border-radius:5px 5px 0 0}
.hofrank{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.hofroas{font-weight:800}
@media(max-width:620px){.wgrid{grid-template-columns:1fr}.wcard{grid-template-columns:1fr}.wmedia{aspect-ratio:16/10}.wloc div{grid-template-columns:1fr}.wmetrics{margin-left:0;flex-basis:100%}}
</style>"""

running_section = f"""
<section class="sec">
<h2>Running ads <span class="count">{len(running)}</span></h2>
<p class="note">Status ACTIVE in Meta, sorted by 7-day spend. <b>ROAS 7d = how it's doing NOW</b>; ROAS 90d / spend / rev are last 90 days. Verdict is based on the 7d number &mdash; an ACTIVE ad with no recent spend shows <b>Recycle</b> (proven history, currently idle), never Scale. CAC = spend &divide; purchases. Freq = avg times each person saw it.</p>
{table(rows_running, status_col=True)}
</section>"""

tested_section = f"""
<section class="sec">
<h2>Previously tested (paused) <span class="count">{len(tested_real)}</span></h2>
<p class="note"><b>Only ads marked <span class="pill pill-good">OK</span> (or unscreened) are re-launch candidates.</b> Ads marked <span class="pill pill-bad">breach</span> were paused for compliance (disease claims, before/after, competitor comparison) &mdash; do NOT relaunch or recreate them, whatever their ROAS. Flagged ads are sorted to the bottom of this table. Hover a badge for the reason.</p>
{table(rows_tested, status_col=True)}
</section>"""

micro_section = f"""
<section class="sec">
<h2>Barely tested &mdash; under ${LOSER_MIN_SPEND:.0f} spend <span class="count">{len(tested_micro)}</span></h2>
<p class="note">Too little spend to trust the numbers &mdash; a 35x ROAS on $1.45 is one lucky sale, not a winner. Treat these as untested. Sorted by ROAS for curiosity only.</p>
{table(rows_micro, status_col=True)}
</section>"""

losers_section = f"""
<section class="sec">
<h2 class="losers">Proven losers &mdash; do NOT recreate <span class="count">{len(losers)}</span></h2>
<p class="note">Spent ${LOSER_MIN_SPEND:.0f}+ in the last 90 days with ROAS under {LOSER_ROAS:.1f}. Sorted by money burned. These angles/creatives failed with real budget &mdash; avoid making more of the same. A <span class="pill pill-bad">breach</span> badge means it was also non-compliant.</p>
{table(rows_losers, status_col=True)}
</section>"""

if not nodeliv_section:
    nodeliv_section = '<section class="sec"><h2>Never delivered <span class="count">0</span></h2><p class="note">Nothing here.</p></section>'

# ── TABS — one view at a time, no endless scrolling (Quan 05/10) ──
TABS = [
    ("winners",    "&#11088; Winners",          len(winners),            (winners_section or '<section class="sec"><p class="note">No current winners at scale.</p></section>') + hof_section),
    ("compliance", "&#9878;&#65039; Compliance", len(comp_nc),           compliance_section),
    ("running",    "&#9654;&#65039; Running",    len(running),            running_section),
    ("store",      "&#128722; Store",            None,                    store_section),
    ("campaigns",  "&#128202; Campaigns",        len(camp_roll_rows),     stage_section + campaign_section),
    ("stuck",      "&#128679; Not launched",     len(stuck),              stuck_section),
    ("tested",     "&#9208;&#65039; Tested (paused)", len(tested_real),   tested_section),
    ("micro",      "&#128300; Barely tested",    len(tested_micro),       micro_section),
    ("nodeliv",    "&#128683; Never delivered",  len(nodeliv),            nodeliv_section),
    ("losers",     "&#128128; Losers",           len(losers),             losers_section),
]
TABS = [t for t in TABS if t[3]]
tab_btns = "".join(
    f'<button class="tabbtn{" tb-bad" if tid == "compliance" else ""}" data-tab="{tid}" aria-pressed="{"true" if i == 0 else "false"}">{lbl}'
    + (f'<span class="tcount">{cnt}</span>' if cnt is not None else "") + "</button>"
    for i, (tid, lbl, cnt, _) in enumerate(TABS))
tab_panes = "".join(
    f'<div class="tabpane" data-pane="{tid}"{"" if i == 0 else " hidden"}>{content}</div>'
    for i, (tid, lbl, cnt, content) in enumerate(TABS))

SORT_JS = """<style>
.tsearch{margin:6px 0 4px;display:flex;justify-content:flex-end}
.tsearch input{background:#fff;border:1px solid #e6e8ec;color:#14181f;border-radius:6px;padding:5px 9px;font-size:12px;width:230px;outline:none}
.tsearch input:focus{border-color:#1c7ed6}
table thead tr:first-child th{cursor:pointer;user-select:none}
table thead th.sorted-a:after{content:" \\25B2";font-size:9px;color:#1c7ed6}
table thead th.sorted-d:after{content:" \\25BC";font-size:9px;color:#1c7ed6}
thead tr.colfilters th{position:sticky;top:206px;z-index:5;background:var(--thbg);padding:4px 6px;cursor:default;box-shadow:0 1px 0 var(--line)}
tr.colfilters input{width:100%;min-width:52px;box-sizing:border-box;background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:3px 6px;font-size:11px;outline:none}
tr.colfilters input:focus{border-color:#1c7ed6}
@media (max-width:1240px){thead tr.colfilters th{position:static}
thead th{white-space:normal;padding:9px 8px;font-size:11px;letter-spacing:.2px;vertical-align:bottom}
tbody td{padding:8px 8px}
table{font-size:13px}
td.adtd{min-width:140px;max-width:240px}
.th{width:44px;height:44px;min-width:44px}
tr.colfilters input{min-width:0}}
@media (max-width:900px){table{font-size:12px}
thead th{padding:7px 5px;font-size:10px;letter-spacing:0}
tbody td{padding:6px 5px}
thead tr.colfilters th{padding:3px 3px}
td.num,td.sub{white-space:normal}
.adc{gap:6px;flex-wrap:wrap}
td.adtd{min-width:96px;max-width:170px}
.adname{font-size:12px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.th{width:34px;height:34px;min-width:34px}
td.camp{min-width:80px}
td.camp .mut{font-size:11px}
.pill,.vb{font-size:10.5px;padding:1px 6px}}
@media (max-width:600px){.th{display:none}
table{font-size:11px}
thead th{font-size:9px;padding:6px 3px}
tbody td{padding:5px 3px}
td.adtd{min-width:72px}
.adname{font-size:11px}
td.camp{min-width:60px}
td.camp .mut{font-size:10px}
table{font-size:10px}
thead th{font-size:8.5px;padding:5px 2px}
tbody td{padding:4px 2px}
.pill,.vb{font-size:9px;padding:1px 4px}
.tablewrap{border-radius:8px}
.wrap{padding-left:8px;padding-right:8px}}
</style>
<script>
(function(){
function val(td){
  if(!td)return null;
  var t=(td.textContent||'').trim();
  if(t===''||t==='\\u2014')return null;
  var n=parseFloat(t.replace(/[$,x%]/g,''));
  return isNaN(n)?t.toLowerCase():n;
}
document.querySelectorAll('.tablewrap table').forEach(function(tb){
  var tbody=tb.querySelector('tbody');if(!tbody)return;
  var wrap=tb.closest('.tablewrap');
  var colInputs=[];
  function applyFilters(freeText){
    var s=(freeText||'').toLowerCase().trim();
    var fs=colInputs.map(function(i){return i.value.toLowerCase().trim()});
    [].slice.call(tbody.rows).forEach(function(r){
      var ok=(!s||r.textContent.toLowerCase().indexOf(s)>-1);
      if(ok)for(var i=0;i<fs.length;i++){
        if(fs[i]&&(!r.cells[i]||r.cells[i].textContent.toLowerCase().indexOf(fs[i])<0)){ok=false;break}
      }
      r.style.display=ok?'':'none';
    });
  }
  var freeInp=null;
  if(tbody.rows.length>5){
    var box=document.createElement('div');box.className='tsearch';
    freeInp=document.createElement('input');freeInp.type='search';freeInp.placeholder='\\uD83D\\uDD0D Filter this table\\u2026';
    box.appendChild(freeInp);wrap.parentNode.insertBefore(box,wrap);
    freeInp.addEventListener('input',function(){applyFilters(freeInp.value)});
    // Aditya 07/10: per-COLUMN filters on every table — a second header row, one box per column.
    var hr=tb.tHead&&tb.tHead.rows[0];
    if(hr){
      var fr=tb.tHead.insertRow(-1);fr.className='colfilters';
      [].slice.call(hr.cells).forEach(function(){
        var td=document.createElement('th');
        var ip=document.createElement('input');ip.type='search';ip.placeholder='filter';
        ip.addEventListener('input',function(){applyFilters(freeInp?freeInp.value:'')});
        td.appendChild(ip);fr.appendChild(td);colInputs.push(ip);
      });
    }
  }
  var ths=[].slice.call((tb.tHead&&tb.tHead.rows[0]?tb.tHead.rows[0].cells:tb.querySelectorAll('thead th')));
  ths.forEach(function(th,i){
    th.title='Click to sort';
    th.addEventListener('click',function(){
      var numeric=false;
      for(var r=0;r<tbody.rows.length;r++){var v=val(tbody.rows[r].cells[i]);if(v!==null){numeric=(typeof v==='number');break;}}
      var dir;
      if(th.classList.contains('sorted-a'))dir=-1;
      else if(th.classList.contains('sorted-d'))dir=1;
      else dir=numeric?-1:1;
      ths.forEach(function(x){x.classList.remove('sorted-a','sorted-d')});
      th.classList.add(dir===1?'sorted-a':'sorted-d');
      var rows=[].slice.call(tbody.rows);
      rows.sort(function(a,b){
        var va=val(a.cells[i]),vb=val(b.cells[i]);
        if(va===null&&vb===null)return 0;
        if(va===null)return 1;
        if(vb===null)return -1;
        if(typeof va==='number'&&typeof vb==='number')return (va-vb)*dir;
        va=String(va);vb=String(vb);
        return va<vb?-dir:(va>vb?dir:0);
      });
      rows.forEach(function(r){tbody.appendChild(r)});
    });
  });
});
})();
</script>"""

DR_HTML = """<div class="drbar">
<span class="drlbl">&#128197; Date range</span>
<input type="date" id="dr-s"> <span class="drdash">&ndash;</span> <input type="date" id="dr-e">
<span class="drsets">
<button class="drp" data-days="1">Today</button><button class="drp" data-days="2">Yesterday</button><button class="drp" data-days="7">7d</button><button class="drp" data-days="14">14d</button><button class="drp" data-days="30">30d</button><button class="drp" data-days="90">90d</button>
</span>
<button id="dr-go">Apply</button><button id="dr-x" hidden>&#10005; Clear</button>
<span id="dr-note"></span>
</div>
<style>
.drbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid #e6e8ec;border-radius:10px;padding:10px 14px;margin:12px 0}
.drbar .drlbl{font-weight:700;color:#0B5394;font-size:13px}
.drbar input[type=date]{border:1px solid #e6e8ec;border-radius:6px;padding:4px 7px;font-size:12px;color:#14181f;background:#fff}
.drbar .drdash{color:#6b7280}
.drbar button{border:1px solid #e6e8ec;background:#f6f7f9;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#14181f}
.drbar .drp[aria-pressed=true]{background:#e3edf8;border-color:#1c7ed6;color:#0B5394;font-weight:700}
.drbar #dr-go{background:#0B5394;color:#fff;border-color:#0B5394;font-weight:700}
.drbar #dr-x{background:#fbe4e8;border-color:#a4122b;color:#a4122b;font-weight:700}
#dr-note{font-size:12px;color:#0B5394;font-weight:600}
.dr-hide{display:none!important}
</style>"""

daily_json = json.dumps(daily, separators=(",", ":"))

build_id = str(int(datetime.now().timestamp()))
POLL_JS = """<script>
(function(){
var cur=(document.querySelector('meta[name="build-id"]')||{}).content||'';
if(!cur)return;
function chk(){fetch(location.pathname+'?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.text()}).then(function(t){
  var m=t.match(/name="build-id" content="(\\d+)"/);
  if(m&&m[1]!==cur&&!document.getElementById('newdata')){
    var p=document.createElement('div');p.id='newdata';p.textContent='\\uD83D\\uDD04 Newer data available \\u2014 click to refresh';
    p.onclick=function(){location.reload()};document.body.appendChild(p);
  }
}).catch(function(){})}
setInterval(chk,5*60*1000);
})();
</script>
<style>#newdata{position:fixed;bottom:18px;right:18px;background:#0B5394;color:#fff;font-weight:700;font-size:13px;padding:10px 16px;border-radius:999px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:99}</style>"""
# ad_id → campaign (lower-cased, matches tr[data-camp]) so the date-range picker can
# re-aggregate the By-campaign rollup for any window (Aditya 07/10).
a2c_json = json.dumps({a["id"]: (a["campaign"] or "(no campaign)").lower() for a in ads
                       if (a.get("effective_status") or "").upper() not in ARCHIVED},
                      separators=(",", ":"))

DR_JS = ('<script id="dd" type="application/json">' + daily_json + '</script>'
         + '<script id="a2c" type="application/json">' + a2c_json + '</script>') + """
<script>
(function(){
var DAILY=JSON.parse(document.getElementById('dd').textContent||'{}');
var S=document.getElementById('dr-s'),E=document.getElementById('dr-e'),GO=document.getElementById('dr-go'),X=document.getElementById('dr-x'),NOTE=document.getElementById('dr-note');
var CELLS=['d-sp','d-rev','d-r7','d-r90','d-pc','d-cac'];
var orig=new Map(),origHead=new Map(),origKpi=null,active=false;
function iso(d){return d.toISOString().slice(0,10)}
var today=new Date();today.setHours(12,0,0,0);
S.max=E.max=iso(today);
function money(v){if(!v)return '<span class="mut">\\u2014</span>';return '$'+(v>=10?Math.round(v).toLocaleString('en-AU'):v.toFixed(2))}
function pill(r){if(r===null)return '<span class="pill pill-none">\\u2014</span>';var c=r>=1?'pill-good':(r>=0.7?'pill-mid':'pill-bad');return '<span class="pill '+c+'">'+r.toFixed(2)+'x</span>'}
function sums(aid,s,e){var rows=DAILY[aid]||[],sp=0,pc=0,rv=0,im=0,cl=0;for(var i=0;i<rows.length;i++){var d=rows[i][0];if(d>=s&&d<=e){sp+=rows[i][1];pc+=rows[i][2];rv+=rows[i][3];im+=rows[i][4]||0;cl+=rows[i][5]||0}}return [sp,pc,rv,im,cl]}
function label(s,e){function f(x){return x.slice(8,10)+'/'+x.slice(5,7)}return s===e?f(s):f(s)+'\\u2013'+f(e)}
function apply(){
  var s=S.value,e=E.value;if(!s||!e)return;if(s>e){var t=s;s=e;e=t;S.value=s;E.value=e}
  var lb=label(s,e);active=true;X.hidden=false;
  document.querySelectorAll('tr[data-aid]').forEach(function(r){
    if(!r.querySelector('.d-sp'))return;
    if(!orig.has(r))orig.set(r,CELLS.map(function(c){var td=r.querySelector('.'+c);return td?td.innerHTML:null}));
    var v=sums(r.getAttribute('data-aid'),s,e),sp=v[0],pc=v[1],rv=v[2];
    var set=function(c,h){var td=r.querySelector('.'+c);if(td)td.innerHTML=h};
    set('d-sp',money(sp));set('d-rev',money(rv));
    set('d-r90',pill(sp>0?rv/sp:null));
    set('d-pc',pc?String(pc):'<span class="mut">0</span>');
    set('d-cac',pc?money(sp/pc):'<span class="mut">\\u2014</span>');
  });
  document.querySelectorAll('.d-r7,.h-r7').forEach(function(el){el.classList.add('dr-hide')});
  // Column names stay plain (Spend / Revenue / ROAS) — the active window lives in the note (Aditya 07/10).
  // By-campaign rollup: re-aggregate every metric column for the chosen window.
  var A2C=JSON.parse(document.getElementById('a2c').textContent||'{}');
  var agg={};Object.keys(DAILY).forEach(function(aid){var c=A2C[aid];if(!c)return;var v=sums(aid,s,e);
    var d=agg[c]||(agg[c]=[0,0,0,0,0]);d[0]+=v[0];d[1]+=v[1];d[2]+=v[2];d[3]+=v[3];d[4]+=v[4]});
  document.querySelectorAll('tr[data-camp]').forEach(function(r){
    if(!orig.has(r))orig.set(r,r.innerHTML);
    var d=agg[r.getAttribute('data-camp')]||[0,0,0,0,0],sp=d[0],pc=d[1],rv=d[2],im=d[3],cl=d[4];
    var set=function(c,h){var td=r.querySelector('.'+c);if(td)td.innerHTML=h};
    set('cr-sp',money(sp));
    set('cr-cpm',im?money(sp/im*1000):'<span class="mut">\\u2014</span>');
    set('cr-cpc',cl?money(sp/cl):'<span class="mut">\\u2014</span>');
    set('cr-pc',pc?String(pc):'<span class="mut">0</span>');
    set('cr-cpp',pc?money(sp/pc):'<span class="mut">\\u2014</span>');
    set('cr-cvr',cl?(pc/cl*100).toFixed(2)+'%':'<span class="mut">\\u2014</span>');
    set('cr-aov',pc?money(rv/pc):'<span class="mut">\\u2014</span>');
    set('cr-rev',money(rv));
    set('cr-roas',pill(sp>0?rv/sp:null));
  });
  var tsp=0,tpc=0,trv=0;Object.keys(DAILY).forEach(function(a){var v=sums(a,s,e);tsp+=v[0];tpc+=v[1];trv+=v[2]});
  if(!origKpi)origKpi=['sp','rev','roas','pc'].map(function(k){return [document.getElementById('kl-'+k).textContent,document.getElementById('kv-'+k).innerHTML]});
  document.getElementById('kl-sp').textContent='Spend ('+lb+')';document.getElementById('kv-sp').textContent='$'+Math.round(tsp).toLocaleString('en-AU');
  document.getElementById('kl-rev').textContent='Revenue ('+lb+')';document.getElementById('kv-rev').textContent='$'+Math.round(trv).toLocaleString('en-AU');
  var br=tsp>0?trv/tsp:0;var kv=document.getElementById('kv-roas');
  document.getElementById('kl-roas').textContent='Blended ROAS ('+lb+')';kv.textContent=br.toFixed(2)+'x';kv.classList.toggle('good',br>=1);kv.classList.toggle('bad',br<1);
  document.getElementById('kl-pc').textContent='Purchases ('+lb+')';document.getElementById('kv-pc').textContent=tpc;
  NOTE.textContent='Showing '+lb+' \\u00b7 tables: Running / Tested / Barely tested / Losers / Campaigns';
}
function clearRange(){
  if(!active)return;active=false;X.hidden=true;NOTE.textContent='';
  orig.forEach(function(html,r){
    if(typeof html==='string'){r.innerHTML=html;return}   // campaign rollup rows (whole-row snapshot)
    CELLS.forEach(function(c,i){var td=r.querySelector('.'+c);if(td&&html[i]!==null)td.innerHTML=html[i]})});
  origHead.forEach(function(t,h){h.textContent=t});
  document.querySelectorAll('.d-r7,.h-r7').forEach(function(el){el.classList.remove('dr-hide')});
  if(origKpi){['sp','rev','roas','pc'].forEach(function(k,i){document.getElementById('kl-'+k).textContent=origKpi[i][0];document.getElementById('kv-'+k).innerHTML=origKpi[i][1]});
    var kv=document.getElementById('kv-roas');}
  document.querySelectorAll('.drp').forEach(function(b){b.setAttribute('aria-pressed','false')});
  S.value='';E.value='';
}
document.querySelectorAll('.drp').forEach(function(b){b.addEventListener('click',function(){
  var n=+b.getAttribute('data-days');var e=new Date(today),s=new Date(today);
  if(n===2){s.setDate(s.getDate()-1);e.setDate(e.getDate()-1)}else{s.setDate(s.getDate()-(n-1))}
  S.value=iso(s);E.value=iso(e);
  document.querySelectorAll('.drp').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
  apply();
})});
GO.addEventListener('click',apply);X.addEventListener('click',clearRange);
[S,E].forEach(function(el){el.addEventListener('change',function(){document.querySelectorAll('.drp').forEach(function(x){x.setAttribute('aria-pressed','false')})})});
})();
</script>"""

# ── Image search index: 12x12 RGB fingerprint per ad (cached by file mtime) ──
def _img_index():
    import base64
    from PIL import Image
    cache = load("imghash.json", {})
    life = {r["ad_id"]: r for r in insmax}
    out, fresh = [], {}
    for a in ads:
        aid = a["id"]
        f = os.path.join(SP, "big", aid + ".jpg")
        if not os.path.exists(f):
            f = os.path.join(SP, "thumbs", aid + ".jpg")
            if not os.path.exists(f):
                continue
        key = f"{os.path.basename(os.path.dirname(f))}:{int(os.path.getmtime(f))}"
        c = cache.get(aid)
        if c and c.get("k") == key:
            h = c["h"]
        else:
            try:
                im = Image.open(f).convert("RGB").resize((96, 96), Image.BOX).resize((12, 12), Image.BOX)
                h = base64.b64encode(im.tobytes()).decode()
            except Exception:
                continue
        fresh[aid] = {"k": key, "h": h}
        L = life.get(aid, {})
        sp = float(L.get("spend") or 0)
        rv = float(L.get("purchase_conversion_value") or 0)
        out.append([aid, a.get("name", ""), a.get("effective_status", ""), (a.get("created_time") or "")[:10],
                    a.get("campaign") or "", round(sp), round(rv), int(float(L.get("purchase_conversions") or 0)), h,
                    os.path.basename(os.path.dirname(f)) == "big"])
    json.dump(fresh, open(os.path.join(SP, "imghash.json"), "w", encoding="utf-8"))
    return out

IMG_INDEX = json.dumps(_img_index(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

ISEARCH_HTML = r"""<style>
#isbtn{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
#ispanel{display:none;margin:0 0 18px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
#ispanel.on{display:block}
#isdrop{border:2px dashed var(--line);border-radius:12px;padding:22px;text-align:center;color:var(--sub);font-size:14px;cursor:pointer}
#isdrop.hot{border-color:var(--brand);color:var(--brand)}
#isq{display:flex;gap:14px;align-items:center;margin:14px 0 4px}
#isq img{max-height:120px;max-width:160px;border-radius:8px;border:1px solid var(--line)}
#isverdict{font-weight:700;font-size:15px}
#isres{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:12px}
.isc{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);font-size:12.5px}
.isc img{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:0;border:0}
.isc .b{padding:8px 10px;display:flex;flex-direction:column;gap:3px}
.isc .n{font-weight:600;word-break:break-word;line-height:1.3}
.isc .m{font-weight:800}
.isc .st{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:999px;color:#fff;width:max-content}
.st-live{background:#1A7F37}.st-paused{background:#9a6700}.st-off{background:#6e7781}
</style>
<div id="ispanel">
<div id="isdrop">&#128269; <b>Paste</b> (Ctrl+V) a screenshot of any ad, <b>drop</b> an image here, or <b>click</b> to choose a file &mdash; it checks every ad this account has ever run</div>
<input id="isfile" type="file" accept="image/*" hidden>
<div id="isq" hidden><img alt=""><div><div id="isverdict"></div><div class="mut" style="font-size:12.5px">Match % = how visually alike. 90%+ = same creative; 75&ndash;90% = likely a variant or edit.</div></div></div>
<div id="isres"></div>
</div>
<script>
(function(){
var IDX=__IDX__;
var panel=document.getElementById('ispanel'),drop=document.getElementById('isdrop'),file=document.getElementById('isfile');
var qw=document.getElementById('isq'),qimg=qw.querySelector('img'),verdict=document.getElementById('isverdict'),res=document.getElementById('isres');
var btn=document.getElementById('isbtn');
function norm(v){var n=v.length,m=0,i;for(i=0;i<n;i++)m+=v[i];m/=n;var s=0;for(i=0;i<n;i++){v[i]-=m;s+=v[i]*v[i]}s=Math.sqrt(s)||1;for(i=0;i<n;i++)v[i]/=s;return v}
var vecs=IDX.map(function(r){var b=atob(r[8]),v=new Float32Array(b.length);for(var i=0;i<b.length;i++)v[i]=b.charCodeAt(i);return norm(v)});
function fp(img){var c=document.createElement('canvas');c.width=c.height=96;var x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,96,96);
  var d=document.createElement('canvas');d.width=d.height=12;var y=d.getContext('2d');y.imageSmoothingQuality='high';y.drawImage(c,0,0,12,12);
  var p=y.getImageData(0,0,12,12).data,v=new Float32Array(432),k=0;for(var i=0;i<p.length;i+=4){v[k++]=p[i];v[k++]=p[i+1];v[k++]=p[i+2]}return norm(v)}
function money(n){return '$'+Math.round(n).toLocaleString('en-AU')}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function run(blob){
  var url=URL.createObjectURL(blob),img=new Image();
  img.onload=function(){
    var q=fp(img);
    var sc=vecs.map(function(v,i){var s=0;for(var j=0;j<v.length;j++)s+=v[j]*q[j];return[s,i]}).sort(function(a,b){return b[0]-a[0]});
    var groups=[],byH={};
    sc.forEach(function(p){var r=IDX[p[1]],g=byH[r[8]];if(!g){if(groups.length>=8)return;g=byH[r[8]]={s:p[0],ads:[]};groups.push(g)}g.ads.push(r)});
    qimg.src=url;qw.hidden=false;
    var top=groups.length?groups[0].s:0,pct=Math.max(0,Math.round(top*100));
    var live=groups.length&&groups[0].ads.some(function(r){return r[2]==='ACTIVE'});
    verdict.textContent=top>=.9?(live?'✅ RUNNING NOW — best match '+pct+'%':'⏸ Ran before, not live now — best match '+pct+'%'):(top>=.75?'🟡 Similar creative found ('+pct+'%) — check below':'➕ No close match ('+pct+'%) — looks like this has never run');
    res.innerHTML=groups.map(function(g){
      var a=g.ads.slice().sort(function(x,y){return y[5]-x[5]}),r=a[0],sp=0,rv=0,pc=0,anyLive=false;
      a.forEach(function(x){sp+=x[5];rv+=x[6];pc+=x[7];if(x[2]==='ACTIVE')anyLive=true});
      var st=anyLive?'<span class="st st-live">LIVE</span>':(/DELETED|ARCHIVED/.test(r[2])?'<span class="st st-off">'+esc(r[2])+'</span>':'<span class="st st-paused">PAUSED</span>');
      return '<div class="isc"><img class="th" src="thumbs/'+r[0]+'.jpg" data-full="'+(r[9]?'big/':'thumbs/')+r[0]+'.jpg" alt=""><div class="b"><span class="m">'+Math.max(0,Math.round(g.s*100))+'% match</span>'+st+
        '<span class="n">'+esc(r[1])+'</span><span class="mut">'+esc(r[4])+'</span><span class="mut">Built '+r[3].split('-').reverse().join('/')+(a.length>1?' · '+a.length+' ads use this image':'')+'</span>'+
        '<span>Lifetime: '+money(sp)+' spend · '+(sp?(rv/sp).toFixed(2)+'x':'—')+' ROAS · '+pc+' purch.</span></div></div>'}).join('');
    [].forEach.call(res.querySelectorAll('img[data-full]'),function(im){var f=im.getAttribute('data-full'),t=new Image();t.onload=function(){im.src=f};t.src=f});
  };
  img.src=url;
}
function show(){panel.classList.add('on');panel.scrollIntoView({behavior:'smooth',block:'start'})}
btn.addEventListener('click',function(){if(panel.classList.contains('on'))panel.classList.remove('on');else show()});
drop.addEventListener('click',function(){file.click()});
file.addEventListener('change',function(){if(file.files[0])run(file.files[0])});
drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('hot')});
drop.addEventListener('dragleave',function(){drop.classList.remove('hot')});
drop.addEventListener('drop',function(e){e.preventDefault();drop.classList.remove('hot');var f=e.dataTransfer.files[0];if(f&&/^image/.test(f.type)){show();run(f)}});
document.addEventListener('paste',function(e){var it=[].slice.call((e.clipboardData||{}).items||[]).filter(function(i){return /^image/.test(i.type)})[0];
  if(!it)return;e.preventDefault();show();run(it.getAsFile())});
})();
</script>""".replace("__IDX__", IMG_INDEX)


ZOOM_HTML = r"""<style>
img.th{cursor:zoom-in}
#zpop{position:fixed;z-index:200;pointer-events:none;display:none;width:min(440px,60vw);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:6px}
#zpop img{display:block;width:100%;height:auto;border-radius:8px}
#zbox{position:fixed;inset:0;z-index:300;display:none;background:rgba(10,12,16,.88);align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:16px;cursor:zoom-out}
#zbox img{max-width:min(94vw,1000px);max-height:84vh;width:auto;height:auto;border-radius:10px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5)}
#zbox .zcap{color:#fff;font-size:13px;max-width:94vw;text-align:center;word-break:break-word}
#zbox .zx{position:absolute;top:12px;right:16px;color:#fff;font-size:30px;line-height:1;background:none;border:0;cursor:pointer}
</style>
<div id="zpop"><img alt=""></div>
<div id="zbox" role="dialog" aria-label="Ad image"><button class="zx" aria-label="Close">&times;</button><img alt=""><div class="zcap"></div></div>
<script>
(function(){
var pop=document.getElementById('zpop'),pimg=pop.querySelector('img');
var box=document.getElementById('zbox'),bimg=box.querySelector('img'),cap=box.querySelector('.zcap');
var hoverOK=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches;
function big(img){var s=img.getAttribute('src')||'';var m=s.match(/thumbs\/(\d+)\.jpg/);return m?'big/'+m[1]+'.jpg':s}
function load(el,img){el.onerror=function(){el.onerror=null;el.src=img.getAttribute('src')};el.src=big(img)}
function place(e){var w=pop.offsetWidth,h=pop.offsetHeight,x=e.clientX+18,y=e.clientY-h/2;
  if(x+w>innerWidth-8)x=e.clientX-w-18;if(x<8)x=8;
  if(y+h>innerHeight-8)y=innerHeight-h-8;if(y<8)y=8;pop.style.left=x+'px';pop.style.top=y+'px'}
document.addEventListener('mouseover',function(e){var t=e.target;if(!hoverOK||!t.matches||!t.matches('img.th'))return;load(pimg,t);pop.style.display='block';place(e)});
document.addEventListener('mousemove',function(e){if(pop.style.display==='block')place(e)});
document.addEventListener('mouseout',function(e){if(e.target.matches&&e.target.matches('img.th'))pop.style.display='none'});
document.addEventListener('click',function(e){var t=e.target;if(!t.matches||!t.matches('img.th'))return;
  e.preventDefault();e.stopPropagation();pop.style.display='none';load(bimg,t);
  var row=t.closest('tr,.wcard');var n=row&&row.querySelector('.adname');cap.textContent=n?n.textContent:'';
  box.style.display='flex'},true);
function close(){box.style.display='none';bimg.removeAttribute('src')}
box.addEventListener('click',close);
document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
})();
</script>"""
html_body = f"""<meta charset="utf-8"><meta name="build-id" content="{build_id}"><title>LACALUT Live Ads Monitor</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='8' y1='20' x2='56' y2='44' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%230064E0'/%3E%3Cstop offset='1' stop-color='%2300B2FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M32 33 C25 21 15 22 13 32 C15 42 25 43 32 31 C39 19 49 22 51 32 C49 42 39 43 32 31 Z' fill='none' stroke='url(%23m)' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">{STYLE}
<div class="wrap">
<header>
<h1>LACALUT <span class="sw">Live Ads Monitor</span></h1>
<div class="stamp">Refreshed {gen} &middot; metrics: last 90 days (KPI cards: last 7 days)</div>
</header>

<nav class="tabs">{tab_btns}</nav>

<div class="fbar">
<button id="isbtn" type="button" title="Find an ad by pasting a screenshot">&#128269; Find by image</button>
<input id="fq" type="search" placeholder="Search ads, campaigns, ad sets&hellip;">
<select id="ft"><option value="">All types</option><option value="image">Image</option><option value="video">Video</option><option value="carousel">Carousel</option></select>
<select id="fc"><option value="">All campaigns</option>{camp_opts}</select>
<select id="fs"><option value="">All stages</option><option value="cold">Cold / TOF</option><option value="mof">MOF / Warm</option><option value="bof">BOF / Retarget</option><option value="unassigned">Unassigned</option></select>
<span class="fcount" id="fn"></span>
</div>

<div class="cards">
<div class="kpi"><div class="lbl">Running (active)</div><div class="val">{len(running)}</div></div>
<div class="kpi"><div class="lbl">Built, not launched</div><div class="val {'bad' if stuck else 'good'}">{len(stuck)}</div></div>
<div class="kpi"><div class="lbl" id="kl-sp">Spend (7d)</div><div class="val" id="kv-sp">${t_sp:,.0f}</div></div>
<div class="kpi"><div class="lbl" id="kl-rev">Revenue (7d)</div><div class="val" id="kv-rev">${t_rev:,.0f}</div></div>
<div class="kpi"><div class="lbl" id="kl-roas">Blended ROAS (7d)</div><div class="val {'good' if b_roas>=1 else 'bad'}" id="kv-roas">{b_roas:.2f}x</div></div>
<div class="kpi"><div class="lbl" id="kl-pc">Purchases (7d)</div><div class="val" id="kv-pc">{t_pc}</div></div>
</div>
{ISEARCH_HTML}
{DR_HTML}

{tab_panes}
{ZOOM_HTML}

<script>
(function(){{
var btns=[].slice.call(document.querySelectorAll('.tabbtn'));
var panes=[].slice.call(document.querySelectorAll('.tabpane'));
function show(id){{
  btns.forEach(function(b){{b.setAttribute('aria-pressed',b.getAttribute('data-tab')===id?'true':'false')}});
  panes.forEach(function(p){{p.hidden=p.getAttribute('data-pane')!==id}});
  try{{history.replaceState(null,'','#'+id)}}catch(e){{}}
  window.scrollTo(0,0);
}}
btns.forEach(function(b){{b.addEventListener('click',function(){{show(b.getAttribute('data-tab'))}})}});
var h=(location.hash||'').replace('#','');
if(h&&panes.some(function(p){{return p.getAttribute('data-pane')===h}}))show(h);
}})();
</script>
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
{SORT_JS}
{DR_JS}
{POLL_JS}
<footer>LACALUT Australia &middot; Smartek Labs &middot; data: Meta Ads (act_2157906551266386) &middot; {len(ads)} ads scanned &middot; thumbnails are Meta CDN links and refresh with each rebuild</footer>
</div>"""

open(os.path.join(SP, "monitor.html"), "w", encoding="utf-8").write(html_body)
open(os.path.join(SP, "index.html"), "w", encoding="utf-8").write(html_body)
print("written: monitor.html + index.html")
print("running:", len(running), "| stuck:", len(stuck), "| tested:", len(tested), "| never-delivered:", len(nodeliv), "| losers:", len(losers))
print("spend7: %.0f  blended_roas7: %.2f  purchases7: %d" % (t_sp, b_roas, t_pc))
