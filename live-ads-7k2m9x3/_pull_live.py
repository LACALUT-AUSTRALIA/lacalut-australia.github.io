"""
Pull FRESH Meta ad data for the Live Ads Monitor, writing the three JSONs that
_build_monitor.py consumes:  ads_all.json, insights90.json, insights7.json.

Run before _build_monitor.py to refresh the page from live data:
    python _pull_live.py && python _build_monitor.py

Token is read from the Facy pipeline .env (META_ACCESS_TOKEN), same account the
build engine uses (act_2157906551266386).
"""
import json, os, urllib.request, urllib.parse, urllib.error, time

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
    # 26/11: keep the ad's REAL shape (4:5 stays 4:5). Meta's thumbnail_url is cropped to the
    # requested box (1080x1080 = square), so it is the LAST resort. Order: image_url, image hash
    # (original file via /adimages), video still, asset-feed image/video, then the square thumb.
    # Square files fetched before 26/11 are re-checked once (big/_shape_checked.json).
    import concurrent.futures, io
    from PIL import Image
    bigdir = os.path.join(SP, "big")
    os.makedirs(bigdir, exist_ok=True)
    have = {f[:-4] for f in os.listdir(bigdir) if f.endswith(".jpg")}
    ckp = os.path.join(bigdir, "_shape_checked.json")
    checked = set(json.load(open(ckp))) if os.path.exists(ckp) else set()
    def size_of(aid):
        try:
            return Image.open(os.path.join(bigdir, aid + ".jpg")).size
        except Exception:
            return (0, 0)
    # re-check once: square files (may be a cropped 4:5) and tiny files (blurry video stills, under 400px)
    sizes = {a: size_of(a) for a in have if a not in checked}
    redo = {a for a, (w, h) in sizes.items() if w == h or max(w, h) < 400}
    fields = ("id,creative.thumbnail_width(1080).thumbnail_height(1080){thumbnail_url,image_url,image_hash,"
              "video_id,asset_feed_spec{images,videos},object_story_spec{link_data{image_hash,picture,"
              "child_attachments{image_hash,picture}},video_data{video_id,image_url,image_hash}}}")
    url = f"{GRAPH}/{ACCT}/ads?fields={urllib.parse.quote(fields)}&limit=100&access_token={urllib.parse.quote(TOK)}"
    vids = {}
    jobs = {}  # aid -> list of candidates: ("url", u) or ("hash", h)
    try:
        ads = get_all(url)
    except Exception as e:  # Meta rate limit (code 80004) must never kill the refresh
        print(f"  big images skipped this run ({e})")
        return
    for a in ads:
        aid = a["id"]
        if aid in have and aid not in redo:
            continue
        cr = a.get("creative") or {}
        oss = cr.get("object_story_spec") or {}
        ld = oss.get("link_data") or {}
        vd = oss.get("video_data") or {}
        afs = cr.get("asset_feed_spec") or {}
        c = []
        if cr.get("image_url"): c.append(("url", cr["image_url"]))
        for h in (cr.get("image_hash"), ld.get("image_hash"), vd.get("image_hash")):
            if h: c.append(("hash", h))
        if vd.get("image_url"): c.append(("url", vd["image_url"]))
        for v in afs.get("videos") or []:
            if v.get("thumbnail_url"): c.append(("url", v["thumbnail_url"]))
            if v.get("thumbnail_hash"): c.append(("hash", v["thumbnail_hash"]))
        for im in afs.get("images") or []:
            if im.get("hash"): c.append(("hash", im["hash"]))
        for ch in ld.get("child_attachments") or []:
            if ch.get("image_hash"): c.append(("hash", ch["image_hash"]))
        if cr.get("thumbnail_url"): c.append(("url", cr["thumbnail_url"]))  # square crop, last resort
        vid = cr.get("video_id") or vd.get("video_id") or next((v.get("video_id") for v in afs.get("videos") or [] if v.get("video_id")), None)
        if vid:
            vids[aid] = vid
        if c:
            jobs[aid] = c
    # video ads: ask Meta for the biggest still of each video (50 videos per call), tried first
    # only for ads being fetched now, so a normal run makes 0-2 extra calls
    vl = sorted({v for a_, v in vids.items() if a_ in jobs}); vbest = {}
    def stills(ids):
        u = f"{GRAPH}/?ids={','.join(ids)}&fields={urllib.parse.quote('thumbnails{uri,width,height}')}&access_token={urllib.parse.quote(TOK)}"
        with urllib.request.urlopen(u, timeout=90) as r:
            for k, v in json.load(r).items():
                t = ((v.get("thumbnails") or {}).get("data")) or []
                if t:
                    vbest[k] = max(t, key=lambda x: (x.get("width") or 0) * (x.get("height") or 0))["uri"]
    for i in range(0, len(vl), 20):
        try:
            stills(vl[i:i+20])
        except Exception:
            for one in vl[i:i+20][:20]:  # one bad video id fails a whole batch: try each on its own
                try:
                    stills([one])
                except Exception:
                    pass
    for aid, vid in vids.items():
        if vid in vbest and aid in jobs:
            jobs[aid].insert(0, ("url", vbest[vid]))
    hashes = sorted({v for c in jobs.values() for k, v in c if k == "hash"})
    hurl = {}
    for i in range(0, len(hashes), 50):
        q = urllib.parse.quote(json.dumps(hashes[i:i+50]))
        try:
            for r in get_all(f"{GRAPH}/{ACCT}/adimages?hashes={q}&fields=hash,url&access_token={urllib.parse.quote(TOK)}"):
                if r.get("url"): hurl[r["hash"]] = r["url"]
        except Exception as e:
            print(f"  adimages lookup failed ({e})")

    def fetch(u):
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB")

    def grab(item):
        aid, cands = item
        best = None
        for k, v in cands:
            u = hurl.get(v) if k == "hash" else v
            if not u:
                continue
            try:
                im = fetch(u)
            except Exception:
                continue
            if best is None: best = im
            if im.size[0] != im.size[1] and max(im.size) >= 400:
                best = im
                break
            if max(im.size) > max(best.size) or (best.size[0] == best.size[1] and im.size[0] != im.size[1] and max(im.size) >= max(best.size)):
                best = im
        if best is None:
            return "err"
        if aid in redo:
            ow, oh = sizes.get(aid, (0, 0))
            if (best.size[0] == best.size[1] or ow != oh) and max(best.size) <= max(ow, oh):
                return "same"  # nothing better than the file we have
        best.thumbnail((900, 900))
        best.save(os.path.join(bigdir, aid + ".jpg"), "JPEG", quality=80, optimize=True)
        return "ok"

    with concurrent.futures.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(grab, jobs.items()))
    checked |= redo
    json.dump(sorted(checked), open(ckp, "w"))
    print(f"  big images: {res.count('ok')} new/fixed, {res.count('same')} really square, "
          f"{res.count('err')} failed, {len(have)} cached")

def pull_texts():
    # Pull every ad's actual COPY (headline + body + link text) so the compliance
    # classifier scans the real wording, not just the ad name. {ad_id: "combined text"}.
    fields = ("id,creative{body,title,asset_feed_spec{bodies,titles,descriptions},"
              "object_story_spec{link_data{message,name,description,caption},"
              "video_data{message,title,link_description}}}")
    url = f"{GRAPH}/{ACCT}/ads?fields={fields}&limit=50&access_token={urllib.parse.quote(TOK)}"
    out = {}
    try:
        ads = list(get_all(url))
    except Exception as e:  # 23/11: Meta 500s on this call; keep the last ad_texts.json, never kill the refresh
        print(f"  ad texts pull failed ({e}); keeping last ad_texts.json")
        return
    for a in ads:
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

def _open(url, tries=3):
    hdr = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LACALUT-link-check"}
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=hdr), timeout=30)
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:      # Shopify is rate limiting us: wait and try again
                time.sleep(8 * (i + 1)); continue
            raise

def check_link(link):
    """{'st': http status, 0 = no answer, -1 = could not check (rate limited); 'redir': final path if it
    redirected; 'soldout': True / False / None (unknown or not a product)}"""
    out = {"st": 0, "redir": "", "soldout": None}
    try:
        with _open(link) as r:
            out["st"] = r.status
            fin = urllib.parse.urlparse(r.geturl())
        if fin.path.rstrip("/") != urllib.parse.urlparse(link).path.rstrip("/"):
            out["redir"] = fin.path
    except urllib.error.HTTPError as e:
        out["st"] = -1 if e.code == 429 else e.code
    except Exception:
        out["st"] = 0
    return out

def link_health(links, max_age=3 * 3600):
    """Check each landing page at most once every 3 hours (cache: linkhealth.json)."""
    path = os.path.join(SP, "linkhealth.json")
    try:
        cache = json.load(open(path, encoding="utf-8"))
    except Exception:
        cache = {}
    now = time.time()
    for link in links:
        old = cache.get(link)
        if old and now - old.get("t", 0) < max_age and old["r"]["st"] > 0 and not (
                old["r"]["soldout"] is None and "/products/" in link):
            continue
        res = check_link(link)
        if res["st"] == -1 and old:                   # rate limited: keep the last real answer
            continue
        cache[link] = {"t": now, "r": res}
        time.sleep(2)
    json.dump({k: v for k, v in cache.items() if k in links}, open(path, "w", encoding="utf-8"))
    out = {k: dict(cache[k]["r"]) for k in links if k in cache}
    # stock: asked from the Shopify Admin API by product handle (the storefront rate limits page loads)
    for link in links:
        r = out.setdefault(link, {"st": -1, "redir": "", "soldout": None})
        path = r.get("redir") or urllib.parse.urlparse(link).path
        if path.startswith("/products/"):
            r["soldout"] = shopify_soldout(urllib.parse.unquote(path.rstrip("/").split("/")[-1]))
    return out

_SHOP = {}
def shopify_soldout(handle):
    """True = every variant is out of stock and cannot be bought; None = could not tell."""
    try:
        if not _SHOP:
            for line in open(r"C:/Users/conta/OneDrive/Documents/Claude Code/.env", encoding="utf-8"):
                for k in ("SHOPIFY_ADMIN_API_TOKEN", "SHOPIFY_STORE_DOMAIN"):
                    if line.startswith(k + "="):
                        _SHOP[k] = line.strip().split("=", 1)[1].strip().strip('"')
        u = (f"https://{_SHOP['SHOPIFY_STORE_DOMAIN']}/admin/api/2024-01/products.json"
             f"?handle={urllib.parse.quote(handle)}&fields=handle,status,variants")
        req = urllib.request.Request(u, headers={"X-Shopify-Access-Token": _SHOP["SHOPIFY_ADMIN_API_TOKEN"]})
        with urllib.request.urlopen(req, timeout=30) as r:
            ps = json.load(r).get("products") or []
        if not ps:
            return None
        if ps[0].get("status") != "active":
            return True
        for v in ps[0].get("variants") or []:
            if v.get("inventory_management") is None or v.get("inventory_policy") == "continue" or (v.get("inventory_quantity") or 0) > 0:
                return False
        return True
    except Exception:
        return None

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
                 "ctr": float(r.get("inline_link_click_ctr") or 0), "rev": 0.0,
                 "reach": int(r.get("reach") or 0)}   # 26/11/2026 Quan: Hype Reach campaign is judged on people reached
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
    w7, w3, w1, w0 = window("last_7d"), window("last_3d"), window("yesterday"), window("today")
    # ad set frequency (7 days) decides which funnel stage the ad set is "acting like"
    url = (f"{GRAPH}/{ACCT}/insights?level=adset&date_preset=last_7d&limit=400"
           f"&fields=adset_id,frequency,reach&access_token={urllib.parse.quote(TOK)}")
    sfreq = {r.get("adset_id"): float(r.get("frequency") or 0) for r in get_all(url)}
    # TRUE ad set totals straight from Meta (Quan 17/11/2026): the page used to add up live ads only,
    # so spend from ads paused since then went missing. Never blocks the pull.
    sets = {}
    try:
        for key, preset in (("d7", "last_7d"), ("d3", "last_3d"), ("d1", "yesterday"), ("d0", "today"), ("dm", "this_month")):
            u = (f"{GRAPH}/{ACCT}/insights?level=adset&date_preset={preset}&limit=400"
                 f"&fields=adset_id,spend,actions,action_values,reach,impressions,frequency&access_token={urllib.parse.quote(TOK)}")
            for r in get_all(u):
                d = {"sp": float(r.get("spend") or 0), "rev": 0.0, "pc": 0, "reach": int(r.get("reach") or 0),
                     "imp": int(r.get("impressions") or 0), "freq": float(r.get("frequency") or 0),
                     "lpv": sum(int(float(x.get("value") or 0)) for x in (r.get("actions") or []) if x.get("action_type") == "landing_page_view")}
                for x in (r.get("actions") or []):
                    if x.get("action_type") == "omni_purchase":
                        d["pc"] = int(float(x.get("value") or 0))
                for x in (r.get("action_values") or []):
                    if x.get("action_type") == "omni_purchase":
                        d["rev"] = float(x.get("value") or 0)
                sets.setdefault(r.get("adset_id"), {})[key] = d
    except Exception as e:
        print("  ad set totals skipped:", e)
        sets = {}
    fields = ("id,name,created_time,campaign{name,daily_budget},"
              "adset{id,name,daily_budget,daily_min_spend_target,bid_strategy,bid_constraints,learning_stage_info},"
              "creative{object_type,video_id,effective_object_story_id,"
              "object_story_spec{link_data{link,child_attachments{link}},"
              "video_data{call_to_action{value{link}}}},asset_feed_spec{link_urls{website_url}}}")
    filt = urllib.parse.quote('[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]')
    url = (f"{GRAPH}/{ACCT}/ads?fields={urllib.parse.quote(fields)}&filtering={filt}"
           f"&limit=200&access_token={urllib.parse.quote(TOK)}")
    rows = []
    active = get_all(url)
    # paused ads that spent money in the last 7 days (Quan 17/11/2026): shown in a fold under their ad set
    paused_raw = []
    live_ids = {a["id"] for a in active}
    pids = [i for i, d in w7.items() if d["sp"] > 0 and i not in live_ids]
    for n in range(0, len(pids), 25):
        try:
            u = (f"{GRAPH}/?ids={','.join(pids[n:n + 25])}&fields={urllib.parse.quote(fields + ',effective_status')}"
                 f"&access_token={urllib.parse.quote(TOK)}")
            with urllib.request.urlopen(u, timeout=90) as r:
                paused_raw += [v for v in json.load(r).values() if isinstance(v, dict) and v.get("id")]
        except Exception as e:
            print("  some paused ads skipped:", e)
    for a in paused_raw:
        a["_paused"] = True
    paused = []
    for a in active + paused_raw:
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
        (paused if a.get("_paused") else rows).append({"id": a["id"], "name": a.get("name", ""), "created_time": a.get("created_time", ""),
                     "campaign": (a.get("campaign") or {}).get("name", ""), "sid": st.get("id", ""),
                     "paused": bool(a.get("_paused")),
                     "adset": st.get("name", ""), "sfreq": sfreq.get(st.get("id"), 0),
                     # ad set card heading (Quan 16/11/2026): budget, floor, learning. Dollars, not cents.
                     "sb": {"bud": int(st.get("daily_budget") or 0) / 100,
                            "cbud": int((a.get("campaign") or {}).get("daily_budget") or 0) / 100,
                            "min": int(st.get("daily_min_spend_target") or 0) / 100,
                            "floor": ((st.get("bid_constraints") or {}).get("roas_average_floor") or 0) / 10000,
                            "learn": ((st.get("learning_stage_info") or {}).get("status") or "")},
                     "video": bool(cr.get("video_id") or vd), "link": link,
                     "d7": w7.get(a["id"]), "d3": w3.get(a["id"]), "d1": w1.get(a["id"]), "d0": w0.get(a["id"])})
    # link health (15/11/2026): every unique landing page is opened once; Shopify products also get a stock check
    health = link_health(sorted({r["link"] for r in rows if r["link"]}))
    for r in rows:
        r["lk"] = health.get(r["link"])
    live_sets = {r["sid"] for r in rows}
    paused = [p for p in paused if p["sid"] in live_sets]
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%S"), "ads": rows, "paused": paused,
               "sets": {k: v for k, v in sets.items() if k in live_sets}},
              open(os.path.join(SP, "buyer.json"), "w", encoding="utf-8"))
    print(f"  wrote buyer.json: {len(rows)} active ads, {len(paused)} paused ads with 7-day spend")

def pull_bf():
    # 25/11/2026 (Quan): every Black Friday 2026 campaign (name has BF26) shown on the Media Buyer tab,
    # live or paused, with today / yesterday / last 7 days numbers. Reach campaigns are judged on reach, not ROAS.
    camps = get_all(f"{GRAPH}/{ACCT}/campaigns?fields=id,name,objective,effective_status,daily_budget,stop_time&limit=200"
                    f"&filtering={urllib.parse.quote(json.dumps([{'field':'name','operator':'CONTAIN','value':'BF26'}]))}"
                    f"&access_token={urllib.parse.quote(TOK)}")
    def ins(preset):
        u = (f"{GRAPH}/{ACCT}/insights?level=campaign&date_preset={preset}&limit=200"
             f"&fields=campaign_id,spend,impressions,reach,frequency,cpm,actions,action_values&access_token={urllib.parse.quote(TOK)}")
        out = {}
        for r in get_all(u):
            pc = sum(float(a["value"]) for a in r.get("actions", []) if a["action_type"] == "purchase")
            rev = sum(float(a["value"]) for a in r.get("action_values", []) if a["action_type"] == "purchase")
            out[r["campaign_id"]] = {"sp": float(r.get("spend", 0)), "imp": int(r.get("impressions", 0)), "reach": int(r.get("reach", 0)),
                                     "freq": float(r.get("frequency", 0) or 0), "cpm": float(r.get("cpm", 0) or 0), "pc": pc, "rev": rev}
        return out
    t, y, w = ins("today"), ins("yesterday"), ins("last_7d")
    rows = []
    for c in camps:
        ads = get_all(f"{GRAPH}/{c['id']}/ads?fields=effective_status&limit=200&access_token={urllib.parse.quote(TOK)}")
        live = sum(1 for a in ads if a.get("effective_status") == "ACTIVE")
        rows.append({"id": c["id"], "name": c["name"], "obj": c.get("objective"), "st": c.get("effective_status"),
                     "budget": int(c.get("daily_budget") or 0) / 100, "stop": c.get("stop_time"), "ads": len(ads), "live": live,
                     "today": t.get(c["id"]), "yday": y.get(c["id"]), "d7": w.get(c["id"])})
    rows.sort(key=lambda r: (r["live"] == 0, r["name"]))
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%S"), "camps": rows}, open(os.path.join(SP, "bf.json"), "w", encoding="utf-8"))
    print(f"  wrote bf.json: {len(rows)} Black Friday campaigns")

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
    try:
        pull_bf()
    except Exception as e:
        print('  bf pull failed (non-fatal):', e)
    import _pull_meta_monthly
    _pull_meta_monthly.main()
    import _pull_lifetime
    _pull_lifetime.main()
    print("Done. Next:  python _classify_compliance.py && python _fetch_thumbs.py && python _build_monitor.py")
