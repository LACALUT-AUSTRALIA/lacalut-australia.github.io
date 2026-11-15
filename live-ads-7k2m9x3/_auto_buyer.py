# -*- coding: utf-8 -*-
"""LACALUT automatic media buyer (built 15/11/2026, rules approved by Quan the same day).

Why: `B00_TOF_VID - Funky Music` spent $786 in 7 days at ROAS 0.92 before anyone caught it.
This job applies the playbook rules to EVERY live ad every 30 minutes, right after the
Live Ads Monitor refresh (it reads the same buyer.json and mer.json).

RULES
  1 + 2. Pause every ad our classes call a Villain or Supervillain (_buyer_tab.classify):
       Villain      = 7-day spend >= $150 AND ROAS < 1.0, OR 3-day spend >= $100 AND ROAS < 1.0
       Supervillain = 7-day spend >= $300 AND ROAS < 1.0 (should never happen once this job is live)
     Hero, Superhero, Sidekick and Civilian are never paused by this job.
     Limits: at most 5 ads per day, never the last live ad in an ad set.
  3. MER brake: when 3-day MER AND 30-day MER are both above ideal, cut 10% from the budget of
     every campaign (CBO) or ad set (ABO) whose own 3-day ROAS is under 1.5.
     Limits: once every 3 days, never below the ad set minimum spends, never below $20/day.
  4. It NEVER raises a budget and NEVER switches anything on.
  5. It emails Quan every action. Kill switch: create _auto_buyer_STOP.txt next to this file.

MODES
  PRACTICE (default): changes nothing in Meta. Emails once a day what it WOULD have done.
  LIVE: only when the file _auto_buyer_LIVE_ON.txt exists next to this script (Quan's yes needed).

It cannot read the EE Hero / Sidekick / Villain / Civilian labels: it only uses spend, CPP and ROAS.
Usage:  python _auto_buyer.py           normal run
        python _auto_buyer.py --dry     print decisions, no email, no state change, no Meta write
        python _auto_buyer.py --selftest
"""
import os, sys, json, smtplib, html, urllib.request, urllib.parse, datetime as dt
from pathlib import Path
from email.mime.text import MIMEText

SP = Path(__file__).resolve().parent
sys.path.insert(0, r"C:/Users/conta/OneDrive/Documents/Claude Code")

RULES = {"max_pauses_per_day": 5,     # class thresholds live in _buyer_tab.DEFAULTS
         "mer_ideal": 15.55, "cut_pct": 10, "cut_roas3": 1.5, "cut_every_days": 3, "min_budget": 20.0}
ACCT = "act_2157906551266386"
GRAPH = "https://graph.facebook.com/v25.0"
STATE = SP / "_auto_buyer_state.json"
LOG = SP / "_auto_buyer.log"
STOP = SP / "_auto_buyer_STOP.txt"
LIVE = SP / "_auto_buyer_LIVE_ON.txt"
PAGE = "https://lacalut-australia.github.io/live-ads-7k2m9x3/#buyer"
MAX_AGE_H = 2          # never act on data older than this


def log(m):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {m}\n")
    try:
        print(m)
    except Exception:
        pass


# ───────────────────────── decisions (pure functions, no network) ─────────────────────────
def ad_decisions(ads, pauses_left):
    """Pause every Villain and Supervillain (classes from _buyer_tab.classify, Quan 15/11/2026:
    "as soon as it goes to villain status we should be killing it"). Supervillains go first.
    Returns (to_pause, skipped) lists of dicts."""
    import _buyer_tab
    live = {}
    for a in ads:
        live[(a["campaign"], a["adset"])] = live.get((a["campaign"], a["adset"]), 0) + 1
    cand = []
    for a in ads:
        k, why = _buyer_tab.classify(a)
        if k in ("villain", "supervillain"):
            cand.append({"id": a["id"], "name": a["name"], "campaign": a["campaign"], "adset": a["adset"],
                         "cls": k, "why": f"{_buyer_tab.CLASS_LABEL[k]}: {why}",
                         "spend": ((a.get("d7") or a.get("d3")) or {}).get("sp", 0)})
    cand.sort(key=lambda x: (x["cls"] != "supervillain", -x["spend"]))
    to_pause, skipped = [], []
    for c in cand:
        key = (c["campaign"], c["adset"])
        if live[key] <= 1:
            c["skip"] = "it is the last live ad in its ad set"
            skipped.append(c)
        elif len(to_pause) >= pauses_left:
            c["skip"] = f"daily limit of {RULES['max_pauses_per_day']} pauses reached"
            skipped.append(c)
        else:
            live[key] -= 1
            to_pause.append(c)
    return to_pause, skipped


def brake_on(mer, last_cut, today):
    if not mer or mer.get("mer3") is None or mer.get("mer30") is None:
        return False
    if not (mer["mer3"] > RULES["mer_ideal"] and mer["mer30"] > RULES["mer_ideal"]):
        return False
    if last_cut and (today - dt.date.fromisoformat(last_cut)).days < RULES["cut_every_days"]:
        return False
    return True


def budget_decisions(camps, sets, roas3_camp, roas3_set):
    """Rule 3. camps/sets = active rows from Meta (budgets in cents). Returns list of cuts."""
    out = []
    k = 1 - RULES["cut_pct"] / 100
    for c in camps:
        if not c.get("daily_budget"):
            continue                                      # ABO: handled per ad set below
        r = roas3_camp.get(c["id"])
        if r is None or r >= RULES["cut_roas3"]:
            continue
        old = int(c["daily_budget"]) / 100
        floor = sum(int(s.get("daily_min_spend_target") or 0) for s in sets if s["campaign_id"] == c["id"]) / 100
        new = max(round(old * k), floor, RULES["min_budget"])
        if new < old:
            out.append({"kind": "campaign", "id": c["id"], "name": c["name"], "old": old, "new": float(new),
                        "why": f"3-day ROAS {r:.2f}" + (f", floor ${floor:,.0f} from ad set minimums" if new == floor else "")})
    cbo = {c["id"] for c in camps if c.get("daily_budget")}
    for s in sets:
        if s["campaign_id"] in cbo or not s.get("daily_budget"):
            continue
        r = roas3_set.get(s["id"])
        if r is None or r >= RULES["cut_roas3"]:
            continue
        old = int(s["daily_budget"]) / 100
        new = max(round(old * k), RULES["min_budget"])
        if new < old:
            out.append({"kind": "adset", "id": s["id"], "name": s["name"], "old": old, "new": float(new),
                        "why": f"3-day ROAS {r:.2f}"})
    return out


# ───────────────────────── Meta reads + writes ─────────────────────────
def _get_all(url):
    out = []
    while url:
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        out += d.get("data", [])
        url = d.get("paging", {}).get("next")
    return out


def meta_budget_view(tok):
    q = urllib.parse.quote
    filt = q('[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]')
    camps = _get_all(f"{GRAPH}/{ACCT}/campaigns?fields=id,name,daily_budget&filtering={filt}&limit=100&access_token={q(tok)}")
    sets = _get_all(f"{GRAPH}/{ACCT}/adsets?fields=id,name,campaign_id,daily_budget,daily_min_spend_target&filtering={filt}&limit=200&access_token={q(tok)}")
    def roas(level, key):
        rows = _get_all(f"{GRAPH}/{ACCT}/insights?level={level}&date_preset=last_3d&fields={key},spend,action_values&limit=300&access_token={q(tok)}")
        out = {}
        for r in rows:
            sp = float(r.get("spend") or 0)
            rv = sum(float(x.get("value") or 0) for x in (r.get("action_values") or []) if x.get("action_type") == "omni_purchase")
            if sp >= 30:                                  # under $30 in 3 days = not enough to judge
                out[r[key]] = rv / sp
        return out
    return camps, sets, roas("campaign", "campaign_id"), roas("adset", "adset_id")


def meta_post(obj_id, fields, tok):
    data = urllib.parse.urlencode({**fields, "access_token": tok}).encode()
    with urllib.request.urlopen(urllib.request.Request(f"{GRAPH}/{obj_id}", data=data, method="POST"), timeout=60) as r:
        return json.load(r).get("success") is True


def email_quan(subject, body_html):
    for p in (Path(r"C:/Users/conta/OneDrive/Documents/Claude Code/.env"), Path.home() / ".env"):
        if p.exists():
            for l in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                if "=" in l and not l.startswith("#"):
                    k, v = l.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"'))
    u, p = os.environ.get("GMAIL_SMTP_USER"), os.environ.get("GMAIL_APP_PASSWORD")
    if not u or not p:
        log("no SMTP creds: email not sent")
        return False
    try:
        m = MIMEText(body_html, "html", "utf-8")
        m["Subject"], m["From"], m["To"] = subject, u, "hello@lacalut.com.au"
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as s:
            s.login(u, p)
            s.send_message(m)
        return True
    except Exception as e:
        log(f"email failed: {e}")
        return False


def render(live, pauses, skipped, cuts, mer, done_note):
    e = html.escape
    td = 'style="padding:6px 10px;border:1px solid #ccc"'
    verb = "Paused" if live else "Would pause"
    h = ['<div style="font-family:Arial,sans-serif;font-size:14px;color:#000">']
    h.append(f'<p><b>{"What I did" if live else "Practice mode: what I WOULD have done (nothing was changed in Meta)"}</b></p>')
    if pauses:
        h.append(f'<p><b>{verb} {len(pauses)} ad(s)</b></p><table style="border-collapse:collapse"><tr><th {td}>Ad</th><th {td}>Ad set</th><th {td}>Reason</th></tr>')
        for c in pauses:
            h.append(f'<tr><td {td}>{e(c["name"])}</td><td {td}>{e(c["adset"])}</td><td {td}>{e(c["why"])}{e(c.get("result",""))}</td></tr>')
        h.append('</table>')
    if cuts:
        h.append(f'<p><b>{"Cut" if live else "Would cut"} {len(cuts)} budget(s) by {RULES["cut_pct"]}%</b> '
                 f'(3-day MER {mer["mer3"]:.1f}% and 30-day MER {mer["mer30"]:.1f}% are both above ideal {RULES["mer_ideal"]}%)</p>'
                 f'<table style="border-collapse:collapse"><tr><th {td}>Campaign or ad set</th><th {td}>Before</th><th {td}>After</th><th {td}>Reason</th></tr>')
        for c in cuts:
            h.append(f'<tr><td {td}>{e(c["name"])}</td><td {td}>${c["old"]:,.0f}</td><td {td}>${c["new"]:,.0f}</td><td {td}>{e(c["why"])}{e(c.get("result",""))}</td></tr>')
        h.append('</table>')
    if skipped:
        h.append(f'<p><b>Met a pause rule but left on ({len(skipped)})</b></p><table style="border-collapse:collapse"><tr><th {td}>Ad</th><th {td}>Reason it met the rule</th><th {td}>Why it was left on</th></tr>')
        for c in skipped:
            h.append(f'<tr><td {td}>{e(c["name"])}</td><td {td}>{e(c["why"])}</td><td {td}>{e(c["skip"])}</td></tr>')
        h.append('</table>')
    h.append(f'<p><b>Next step</b><br>{done_note}<br>Media Buyer tab:<br>{PAGE}</p></div>')
    return "".join(h)


def selftest():
    mk = lambda i, s7, p7, r7, s3=0, r3=0, st="A": {"id": str(i), "name": f"ad{i}", "campaign": "c", "adset": st,
        "d7": {"sp": s7, "pc": p7, "rev": r7} if s7 else None, "d3": {"sp": s3, "pc": 0, "rev": r3} if s3 else None}
    ads = [mk(1, 786, 15, 720),            # Funky Music: CPP 52, ROAS 0.92 -> rule 1
           mk(2, 192, 4, 387),             # CPP 48 but ROAS 2.01 -> keep
           mk(3, 120, 0, 0, 110, 50),      # under $150 in 7d but $110 in 3d at ROAS 0.45 -> rule 2
           mk(4, 90, 0, 0),                # too early -> keep
           mk(5, 400, 0, 0, st="B"),       # no sale but the only ad in ad set B -> skipped
           mk(6, 200, 2, 100), mk(7, 300, 3, 150), mk(8, 160, 1, 50)]   # 3 more losers -> daily limit
    p, s = ad_decisions(ads, 3)
    ok = [x["id"] for x in p] == ["1", "7", "6"] and sorted(x["id"] for x in s) == ["3", "5", "8"]
    camps = [{"id": "c2", "name": "#2", "daily_budget": "35000"}, {"id": "c1", "name": "#1"}, {"id": "c7", "name": "#7"}]
    sets = [{"id": "s1", "name": "#2 a", "campaign_id": "c2", "daily_min_spend_target": "17500"},
            {"id": "s2", "name": "#2 b", "campaign_id": "c2", "daily_min_spend_target": "17500"},
            {"id": "s3", "name": "#1 weak", "campaign_id": "c1", "daily_budget": "8400"},
            {"id": "s4", "name": "#7 strong", "campaign_id": "c7", "daily_budget": "70000"},
            {"id": "s5", "name": "#1 tiny", "campaign_id": "c1", "daily_budget": "2100"}]
    cuts = budget_decisions(camps, sets, {"c2": 0.9}, {"s3": 0.5, "s4": 2.0, "s5": 0.2})
    got = {c["id"]: c["new"] for c in cuts}
    ok2 = got == {"s3": 76.0, "s5": 20.0}          # #2 is already at its $350 floor, #7 untouched, tiny floors at $20
    ok3 = (brake_on({"mer3": 58, "mer30": 43}, None, dt.date(2026, 11, 16)) and
           not brake_on({"mer3": 58, "mer30": 43}, "2026-11-15", dt.date(2026, 11, 16)) and
           not brake_on({"mer3": 14, "mer30": 43}, None, dt.date(2026, 11, 16)))
    print("pause", [x["id"] for x in p], "skipped", [(x["id"], x["skip"]) for x in s])
    print("cuts", got)
    print("SELFTEST", "PASS" if ok and ok2 and ok3 else "FAIL")
    return ok and ok2 and ok3


def main():
    if "--selftest" in sys.argv:
        return 0 if selftest() else 1
    if STOP.exists():
        log("STOP file present: exiting")
        return 0
    dry = "--dry" in sys.argv
    live = LIVE.exists() and not dry
    data = json.loads((SP / "buyer.json").read_text(encoding="utf-8"))
    age_h = (dt.datetime.now() - dt.datetime.strptime(data["pulled"], "%Y-%m-%dT%H:%M:%S")).total_seconds() / 3600
    if age_h > MAX_AGE_H:
        log(f"buyer.json is {age_h:.1f}h old: doing nothing")
        return 1
    try:
        mer = json.loads((SP / "mer.json").read_text(encoding="utf-8"))
        if (dt.date.today() - dt.date.fromisoformat(mer["as_of"])).days > 2:
            mer = None                                    # stale MER never triggers a cut
    except Exception:
        mer = None
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    today = dt.date.today()
    done_today = state.get("paused", {}).get(today.isoformat(), [])
    pauses, skipped = ad_decisions(data["ads"], RULES["max_pauses_per_day"] - len(done_today))
    cuts = []
    import meta_auth
    meta_auth.install()
    tok = meta_auth.system_token()
    if brake_on(mer, state.get("last_cut"), today):
        cuts = budget_decisions(*meta_budget_view(tok))
    log(f"{'LIVE' if live else 'PRACTICE'}: {len(pauses)} pause, {len(skipped)} left on, {len(cuts)} budget cut(s)"
        + ("" if mer else " (no fresh MER: budget rule off)"))
    if dry:
        for c in pauses: print("  PAUSE", c["name"][:60], "|", c["why"])
        for c in skipped: print("  LEFT ON", c["name"][:60], "|", c["why"], "|", c["skip"])
        for c in cuts: print("  CUT", c["kind"], c["name"][:50], f"${c['old']:.0f} -> ${c['new']:.0f}", "|", c["why"])
        return 0
    if not live:
        # practice: one email a day, first run after 7 AM, only when there is something to show
        if (pauses or cuts) and state.get("practice_sent") != today.isoformat() and dt.datetime.now().hour >= 7:
            body = render(False, pauses, skipped, cuts, mer,
                          "Practice mode runs until Quan says to switch it on. Tell Facy \"switch the automatic media buyer on\".")
            if email_quan(f"Automatic media buyer (practice): would pause {len(pauses)} ad(s), cut {len(cuts)} budget(s)", body):
                state["practice_sent"] = today.isoformat()
                log("practice email sent")
        STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
        return 0
    # LIVE
    acted = False
    for c in pauses:
        try:
            ok = meta_post(c["id"], {"status": "PAUSED"}, tok)
        except Exception as ex:
            ok = False
            log(f"pause FAILED {c['id']}: {ex}")
        c["result"] = "" if ok else " (PAUSE FAILED: do it by hand)"
        if ok:
            acted = True
            state.setdefault("paused", {}).setdefault(today.isoformat(), []).append(c["id"])
            log(f"PAUSED ad {c['id']} {c['name']} | {c['why']}")
    for c in cuts:
        try:
            ok = meta_post(c["id"], {"daily_budget": int(round(c["new"] * 100))}, tok)
        except Exception as ex:
            ok = False
            log(f"cut FAILED {c['id']}: {ex}")
        c["result"] = "" if ok else " (CUT FAILED)"
        if ok:
            acted = True
            state["last_cut"] = today.isoformat()
            log(f"CUT {c['kind']} {c['id']} {c['name']} ${c['old']:.0f} -> ${c['new']:.0f} | {c['why']}")
    state["paused"] = {k: v for k, v in state.get("paused", {}).items() if k >= (today - dt.timedelta(days=14)).isoformat()}
    STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
    if pauses or cuts:
        body = render(True, pauses, skipped, cuts, mer,
                      "To undo: switch the ad back on in Ads Manager. To stop this job: tell Facy \"stop the automatic media buyer\".")
        email_quan(f"Automatic media buyer: paused {sum(1 for c in pauses if not c['result'])} ad(s), cut {sum(1 for c in cuts if not c['result'])} budget(s)", body)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as ex:
        log(f"RUN FAILED: {type(ex).__name__}: {ex}")
        sys.exit(1)
