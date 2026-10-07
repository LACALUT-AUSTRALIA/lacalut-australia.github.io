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
    a["_roas7"] = r7.get("roas")                                   # RECENT (7d) performance
    a["_pc7"] = int(r7.get("purchase_conversions") or 0)
    a["_rev7"] = float(r7.get("purchase_conversion_value") or 0)
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
    elif delivering and a["_s7"] >= 50:               v = ("zombie", "&#129503; Zombie")
    elif r90 >= 1.5 and a["_s90"] > 0:                v = ("recycle", "&#9851; Recycle")
    elif r90 < 1.5 and a["_s90"] >= 50:               v = ("dead", "&#9904; Dead")
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
<td class="num">{roas_badge(a['_roas7'])}</td>
<td class="num">{roas_badge(a['_roas'])}</td>
<td class="num">{a['_pc'] or '<span class="mut">0</span>'}</td>
<td class="num">{money(a['_cac'], dash_zero=False)}</td>
<td class="num">{numf(a['_freq'], '.1f')}</td>
<td class="num">{numf(a['_ctr'], '.2f', '%')}</td>
</tr>"""

HEAD = """<tr><th>Ad</th><th>Campaign / ad set</th>{st}<th>Verdict</th><th>Built · age</th><th>Compliant</th><th>Spend 90d</th><th>Rev 90d</th><th>ROAS 7d</th><th>ROAS 90d</th><th>Purch.</th><th>CAC</th><th>Freq</th><th>CTR</th></tr>"""

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
insmax = load("insights_max.json", [])
ads_by_id = {a["id"]: a for a in ads}
HOF_SPEND_MIN, HOF_PURCH_MIN, HOF_TOP = 200.0, 5, 30
_hof_seen = {}
for r in insmax:
    if r["spend"] < HOF_SPEND_MIN or r["purchase_conversions"] < HOF_PURCH_MIN:
        continue
    key = (r.get("ad_name") or r["ad_id"]).strip().lower()
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

table{border-collapse:separate;border-spacing:0;width:100%;min-width:1080px;font-size:14px}
thead th{position:sticky;top:166px;z-index:5;background:var(--thbg);text-align:left;color:var(--thtext);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;padding:11px 12px;border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line);white-space:nowrap}
@media (max-width:1240px){.tablewrap{overflow-x:auto}thead th{position:static}section.sec h2{position:static}}
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
.tsearch input{background:#141820;border:1px solid #2a3140;color:#dfe6f0;border-radius:6px;padding:5px 9px;font-size:12px;width:230px;outline:none}
.tsearch input:focus{border-color:#3b82f6}
table thead th{cursor:pointer;user-select:none}
table thead th.sorted-a:after{content:" \\25B2";font-size:9px;color:#3b82f6}
table thead th.sorted-d:after{content:" \\25BC";font-size:9px;color:#3b82f6}
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
  if(tbody.rows.length>5){
    var box=document.createElement('div');box.className='tsearch';
    var inp=document.createElement('input');inp.type='search';inp.placeholder='\\uD83D\\uDD0D Filter this table\\u2026';
    box.appendChild(inp);wrap.parentNode.insertBefore(box,wrap);
    inp.addEventListener('input',function(){
      var s=inp.value.toLowerCase().trim();
      [].slice.call(tbody.rows).forEach(function(r){
        r.style.display=(!s||r.textContent.toLowerCase().indexOf(s)>-1)?'':'none';
      });
    });
  }
  var ths=[].slice.call(tb.querySelectorAll('thead th'));
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

html_body = f"""<meta charset="utf-8"><title>LACALUT Live Ads Monitor</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='8' y1='20' x2='56' y2='44' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%230064E0'/%3E%3Cstop offset='1' stop-color='%2300B2FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M32 33 C25 21 15 22 13 32 C15 42 25 43 32 31 C39 19 49 22 51 32 C49 42 39 43 32 31 Z' fill='none' stroke='url(%23m)' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">{STYLE}
<div class="wrap">
<header>
<h1>LACALUT <span class="sw">Live Ads Monitor</span></h1>
<div class="stamp">Refreshed {gen} &middot; metrics: last 90 days (KPI cards: last 7 days)</div>
</header>

<nav class="tabs">{tab_btns}</nav>

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

{tab_panes}

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
<footer>LACALUT Australia &middot; Smartek Labs &middot; data: Meta Ads (act_2157906551266386) &middot; {len(ads)} ads scanned &middot; thumbnails are Meta CDN links and refresh with each rebuild</footer>
</div>"""

open(os.path.join(SP, "monitor.html"), "w", encoding="utf-8").write(html_body)
open(os.path.join(SP, "index.html"), "w", encoding="utf-8").write(html_body)
print("written: monitor.html + index.html")
print("running:", len(running), "| stuck:", len(stuck), "| tested:", len(tested), "| never-delivered:", len(nodeliv), "| losers:", len(losers))
print("spend7: %.0f  blended_roas7: %.2f  purchases7: %d" % (t_sp, b_roas, t_pc))
