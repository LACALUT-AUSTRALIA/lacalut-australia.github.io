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
import sys
sys.path.insert(0, r"C:/Users/conta/OneDrive/Documents/Claude Code")
import meta_auth  # 15/11/2026: token from ~/.env (META_SYSTEM_USER_TOKEN) + appsecret_proof on every call
meta_auth.install()
TOK = meta_auth.system_token()
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
              "impressions,reach,ctr,cpc,cpm,clicks")
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
            "clicks": int(r.get("clicks") or 0),
        })
    return out

def pull_daily():
    # Per-day spend/purchases/revenue (+ impressions/clicks for CPM/CPC/CVR) per ad (last 90d)
    # for the dashboard's custom date-range picker.
    # {ad_id: [[YYYY-MM-DD, spend, purch, rev, impressions, clicks], ...]}
    fields = "ad_id,spend,actions,action_values,impressions,clicks"
    url = (f"{GRAPH}/{ACCT}/insights?level=ad&date_preset=last_90d&time_increment=1"
           f"&limit=500&fields={fields}&access_token={urllib.parse.quote(TOK)}")
    out = {}
    n = 0
    for r in get_all(url):
        sp = float(r.get("spend") or 0)
        pc = int(pick(r.get("actions"), PURCH))
        rv = pick(r.get("action_values"), PURCH)
        if sp == 0 and pc == 0:
            continue
        out.setdefault(r.get("ad_id"), []).append(
            [r.get("date_start"), round(sp, 2), pc, round(rv, 2),
             int(r.get("impressions") or 0), int(r.get("clicks") or 0)])
        n += 1
    json.dump(out, open(os.path.join(SP, "insights_daily.json"), "w", encoding="utf-8"))
    print(f"  wrote insights_daily.json: {n} day-rows across {len(out)} ads")

def pull_thumbs():
    # Merge each ad's creative thumbnail URL into thumbs.json (preserve existing so
    # an ad whose URL has since expired keeps its previously-downloaded local copy).
    path = os.path.join(SP, "thumbs.json")
    try:
        existing = json.load(open(path, encoding="utf-8"))
    except Exception:
        existing = {}
    fields = "id,creative{thumbnail_url,image_url}"
    url = f"{GRAPH}/{ACCT}/ads?fields={fields}&limit=400&access_token={urllib.parse.quote(TOK)}"
    added = 0
    for a in get_all(url):
        cr = a.get("creative") or {}
        turl = cr.get("thumbnail_url") or cr.get("image_url")
        if turl:
            if a["id"] not in existing:
                added += 1
            existing[a["id"]] = {"thumb": turl}
    json.dump(existing, open(path, "w", encoding="utf-8"))
    print(f"  wrote thumbs.json: {len(existing)} entries (+{added} new)")

def pull_big():
    # Readable-size creative images for the hover/click zoom: big/{ad_id}.jpg (max 900px).
    # Only missing files are downloaded; Meta CDN URLs expire, local copies don't.
    import concurrent.futures, io
    from PIL import Image
    bigdir = os.path.join(SP, "big")
    os.makedirs(bigdir, exist_ok=True)
    have = {f[:-4] for f in os.listdir(bigdir) if f.endswith(".jpg")}
    fields = "id,creative.thumbnail_width(1080).thumbnail_height(1080){thumbnail_url,image_url}"
    url = f"{GRAPH}/{ACCT}/ads?fields={urllib.parse.quote(fields)}&limit=400&access_token={urllib.parse.quote(TOK)}"
    todo = []
    for a in get_all(url):
        if a["id"] in have:
            continue
        cr = a.get("creative") or {}
        src = cr.get("image_url") or cr.get("thumbnail_url")
        if src:
            todo.append((a["id"], src))

    def grab(item):
        aid, src = item
        try:
            req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"})
            im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB")
            im.thumbnail((900, 900))
            im.save(os.path.join(bigdir, aid + ".jpg"), "JPEG", quality=80, optimize=True)
            return "ok"
        except Exception as e:
            return f"err:{type(e).__name__}"

    with concurrent.futures.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(grab, todo))
    print(f"  big images: {res.count('ok')} new, {len(res) - res.count('ok')} failed, {len(have)} cached")

def pull_texts():
    # Pull every ad's actual COPY (headline + body + link text) so the compliance
    # classifier scans the real wording, not just the ad name. {ad_id: "combined text"}.
    fields = ("id,creative{body,title,asset_feed_spec{bodies,titles,descriptions},"
              "object_story_spec{link_data{message,name,description,caption},"
              "video_data{message,title,link_description}}}")
    url = f"{GRAPH}/{ACCT}/ads?fields={fields}&limit=300&access_token={urllib.parse.quote(TOK)}"
    out = {}
    for a in get_all(url):
        cr = a.get("creative") or {}
        parts = [cr.get("body", ""), cr.get("title", "")]
        afs = cr.get("asset_feed_spec") or {}
        for coll in ("bodies", "titles", "descriptions"):
            for it in (afs.get(coll) or []):
                parts.append(it.get("text", ""))
        oss = cr.get("object_story_spec") or {}
        for blk in ("link_data", "video_data"):
            d = oss.get(blk) or {}
            for k in ("message", "name", "description", "caption", "title", "link_description"):
                if d.get(k):
                    parts.append(d[k])
        txt = " ".join(p for p in parts if p).strip()
        if txt:
            out[a["id"]] = txt
    json.dump(out, open(os.path.join(SP, "ad_texts.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  wrote ad_texts.json: {len(out)} ads with copy")

def pull_buyer():
    # Media Buyer tab (Quan 15/11/2026): every ACTIVE ad with 7d / 3d / yesterday numbers,
    # funnel steps, hook rate, landing page and the ad set's frequency. Writes buyer.json.
    WANT = {"omni_purchase": "pc", "omni_add_to_cart": "atc", "omni_initiated_checkout": "ic",
            "landing_page_view": "lpv", "video_view": "v3", "link_click": "lc"}
    def window(preset):
        fields = "ad_id,spend,impressions,reach,frequency,cpm,inline_link_click_ctr,actions,action_values"
        url = (f"{GRAPH}/{ACCT}/insights?level=ad&date_preset={preset}&limit=400"
               f"&fields={fields}&access_token={urllib.parse.quote(TOK)}")
        out = {}
        for r in get_all(url):
            d = {"sp": float(r.get("spend") or 0), "imp": int(r.get("impressions") or 0),
                 "freq": float(r.get("frequency") or 0), "cpm": float(r.get("cpm") or 0),
                 "ctr": float(r.get("inline_link_click_ctr") or 0), "rev": 0.0}
            for k in WANT.values():
                d[k] = 0
            for x in (r.get("actions") or []):
                k = WANT.get(x.get("action_type"))
                if k:
                    d[k] = int(float(x.get("value") or 0))
            for x in (r.get("action_values") or []):
                if x.get("action_type") == "omni_purchase":
                    d["rev"] = float(x.get("value") or 0)
            out[r.get("ad_id")] = d
        return out
    w7, w3, w1 = window("last_7d"), window("last_3d"), window("yesterday")
    # ad set frequency (7 days) decides which funnel stage the ad set is "acting like"
    url = (f"{GRAPH}/{ACCT}/insights?level=adset&date_preset=last_7d&limit=400"
           f"&fields=adset_id,frequency,reach&access_token={urllib.parse.quote(TOK)}")
    sfreq = {r.get("adset_id"): float(r.get("frequency") or 0) for r in get_all(url)}
    fields = ("id,name,created_time,campaign{name},adset{id,name},"
              "creative{object_type,video_id,effective_object_story_id,"
              "object_story_spec{link_data{link,child_attachments{link}},"
              "video_data{call_to_action{value{link}}}},asset_feed_spec{link_urls{website_url}}}")
    filt = urllib.parse.quote('[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]')
    url = (f"{GRAPH}/{ACCT}/ads?fields={urllib.parse.quote(fields)}&filtering={filt}"
           f"&limit=200&access_token={urllib.parse.quote(TOK)}")
    rows = []
    for a in get_all(url):
        cr = a.get("creative") or {}
        oss = cr.get("object_story_spec") or {}
        ld = oss.get("link_data") or {}
        vd = oss.get("video_data") or {}
        link = ld.get("link") or (((vd.get("call_to_action") or {}).get("value") or {}).get("link")) or ""
        if not link:
            for ca in (ld.get("child_attachments") or []):
                if ca.get("link"):
                    link = ca["link"]; break
        if not link:
            for lu in ((cr.get("asset_feed_spec") or {}).get("link_urls") or []):
                if lu.get("website_url"):
                    link = lu["website_url"]; break
        if not link and cr.get("effective_object_story_id"):
            # existing-post ads: the link lives on the Page post (needs the Page token)
            try:
                pu = (f"{GRAPH}/{cr['effective_object_story_id']}?fields=call_to_action"
                      f"&access_token={urllib.parse.quote(meta_auth.page_token())}")
                with urllib.request.urlopen(pu, timeout=40) as r:
                    link = (((json.load(r).get("call_to_action") or {}).get("value") or {}).get("link")) or ""
            except Exception:
                link = ""
        st = a.get("adset") or {}
        rows.append({"id": a["id"], "name": a.get("name", ""), "created_time": a.get("created_time", ""),
                     "campaign": (a.get("campaign") or {}).get("name", ""),
                     "adset": st.get("name", ""), "sfreq": sfreq.get(st.get("id"), 0),
                     "video": bool(cr.get("video_id") or vd), "link": link,
                     "d7": w7.get(a["id"]), "d3": w3.get(a["id"]), "d1": w1.get(a["id"])})
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%S"), "ads": rows},
              open(os.path.join(SP, "buyer.json"), "w", encoding="utf-8"))
    print(f"  wrote buyer.json: {len(rows)} active ads")

def write(name, data):
    p = os.path.join(SP, name)
    json.dump(data, open(p, "w", encoding="utf-8"))
    print(f"  wrote {name}: {len(data)} rows")

if __name__ == "__main__":
    print(f"Pulling live Meta data for {ACCT} …")
    write("ads_all.json", pull_ads())
    write("insights90.json", pull_insights("last_90d"))
    write("insights7.json", pull_insights("last_7d"))
    pull_daily()
    pull_thumbs()
    pull_big()
    pull_texts()
    pull_buyer()
    import _pull_meta_monthly
    _pull_meta_monthly.main()
    import _pull_lifetime
    _pull_lifetime.main()
    print("Done. Next:  python _classify_compliance.py && python _fetch_thumbs.py && python _build_monitor.py")
