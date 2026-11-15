# -*- coding: utf-8 -*-
"""Morning "act on this" alert for the Media Buyer tab (built 15/11/2026).

Runs once a day (Task Scheduler "Lacalut - Media Buyer Pause Alert", 7:30 AM). It reads the
files the Live Ads Monitor already refreshes (buyer.json, mer.json) and emails Quan ONLY when
there is something to act on. No email on a clean day (Quan: no separate reports).

  PAUSE?        a live ad with 7-day spend at or above the minimum AND (no sale OR CPP over the
                pause line) AND ROAS under break-even    (same rule as the tab's Verdict column)
  BROKEN LINK   a live ad whose landing page did not open
  SOLD OUT      a live ad whose product Shopify says cannot be bought
  (R) LINK      a live ad whose link still has the registered symbol in it

It changes NOTHING in Meta. Pausing still needs Quan's yes, and the EE class must be
checked first (never pause a Hero or Sidekick).
Usage:  python _pause_alert.py          send if needed (at most once per day)
        python _pause_alert.py --dry    print what would be sent, no email
"""
import os, sys, json, smtplib, html, datetime as dt
from pathlib import Path
from email.mime.text import MIMEText

SP = Path(__file__).resolve().parent
import _buyer_tab
D = _buyer_tab.DEFAULTS
PAGE = "https://lacalut-australia.github.io/live-ads-7k2m9x3/#buyer"
STATE = SP / "_pause_alert_state.json"
LOG = SP / "_pause_alert.log"
MAX_AGE_H = 6          # do not alert from data older than this


def log(m):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {m}\n")
    try:
        print(m)
    except Exception:
        pass


def load_env():
    for p in (Path(r"C:/Users/conta/OneDrive/Documents/Claude Code/.env"), Path.home() / ".env"):
        if p.exists():
            for l in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                if "=" in l and not l.startswith("#"):
                    k, v = l.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"'))


def findings(ads):
    pause, links = [], []
    for a in ads:
        d = a.get("d7")
        if d and d["sp"] >= D["minspend"]:
            cpp = (d["sp"] / d["pc"]) if d["pc"] else None
            roas = d["rev"] / d["sp"]
            if (cpp is None or cpp > D["pausecpp"]) and roas < D["roasbe"]:
                pause.append((a, d, cpp, roas))
        k, link = a.get("lk") or {}, a.get("link") or ""
        why = ""
        if k.get("st") == 0 or (k.get("st") or 0) >= 400:
            why = f"landing page did not open (status {k.get('st')})"
        elif k.get("soldout") is True:
            why = "product is sold out in Shopify"
        elif "%C2%AE" in link.upper() or "\u00ae" in link:
            why = "old link with the registered symbol in it"
        if why:
            links.append((a, why))
    pause.sort(key=lambda x: -x[1]["sp"])
    return pause, links


def build_email(pause, links, mer):
    e = html.escape
    td = 'style="padding:6px 10px;border:1px solid #ccc"'
    h = ['<div style="font-family:Arial,sans-serif;font-size:14px;color:#000">']
    if pause:
        h.append(f'<p><b>Ads to consider pausing ({len(pause)})</b><br>'
                 f'Rule: ${D["minspend"]:.0f} or more spent in 7 days, and no sale or CPP over ${D["pausecpp"]:.0f}, '
                 f'and ROAS under {D["roasbe"]}. Check the EE class first: never pause a Hero or Sidekick.</p>')
        h.append(f'<table style="border-collapse:collapse"><tr><th {td}>Ad</th><th {td}>Campaign</th><th {td}>Spend 7d</th>'
                 f'<th {td}>Sales</th><th {td}>CPP</th><th {td}>ROAS</th></tr>')
        for a, d, cpp, roas in pause:
            h.append(f'<tr><td {td}>{e(a["name"])}</td><td {td}>{e(a["campaign"].split(" (")[0])}</td>'
                     f'<td {td}>${d["sp"]:,.0f}</td><td {td}>{d["pc"]}</td>'
                     f'<td {td}>{"no sale" if cpp is None else f"${cpp:,.2f}"}</td><td {td}>{roas:.2f}</td></tr>')
        h.append('</table>')
    if links:
        h.append(f'<p><b>Landing page problems ({len(links)})</b></p><table style="border-collapse:collapse">'
                 f'<tr><th {td}>Ad</th><th {td}>Problem</th><th {td}>Link</th></tr>')
        for a, why in links:
            h.append(f'<tr><td {td}>{e(a["name"])}</td><td {td}>{e(why)}</td><td {td}>{e(a.get("link") or "")}</td></tr>')
        h.append('</table>')
    if mer:
        h.append(f'<p><b>MER</b><br>Last 3 full days: {mer["mer3"]:.1f}% &middot; last 30 days: {mer["mer30"]:.1f}% '
                 f'&middot; ideal: {D["mer"]:.2f}% (Meta spend &divide; Shopify retail sales incl. GST, to {mer["as_of"][8:10]}/{mer["as_of"][5:7]}).</p>')
    h.append(f'<p><b>Next step</b><br>Open the Media Buyer tab:<br>{PAGE}<br>Nothing has been changed in Meta. '
             f'Tell Facy which ads to pause.</p></div>')
    return "".join(h)


def main():
    dry = "--dry" in sys.argv
    data = json.loads((SP / "buyer.json").read_text(encoding="utf-8"))
    age_h = (dt.datetime.now() - dt.datetime.strptime(data["pulled"], "%Y-%m-%dT%H:%M:%S")).total_seconds() / 3600
    if age_h > MAX_AGE_H and not dry:
        log(f"buyer.json is {age_h:.1f}h old (refresh job not running?): no alert sent")
        return 1
    mer = None
    try:
        mer = json.loads((SP / "mer.json").read_text(encoding="utf-8"))
    except Exception:
        pass
    pause, links = findings(data["ads"])
    today = dt.date.today().isoformat()
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    if dry:
        print(f"pause: {len(pause)}, link problems: {len(links)}, data age {age_h:.1f}h")
        for a, d, cpp, roas in pause:
            print("  PAUSE?", a["name"][:70], f'${d["sp"]:.0f}', d["pc"], cpp and round(cpp, 2), round(roas, 2))
        for a, why in links:
            print("  LINK ", a["name"][:70], "|", why)
        return 0
    if state.get("sent") == today:
        log("already sent today")
        return 0
    if not pause and not links:
        log("clean: nothing to pause, no link problems, no email")
        return 0
    load_env()
    u, p = os.environ.get("GMAIL_SMTP_USER"), os.environ.get("GMAIL_APP_PASSWORD")
    if not u or not p:
        log("no SMTP creds: alert not emailed")
        return 1
    m = MIMEText(build_email(pause, links, mer), "html", "utf-8")
    m["Subject"] = f"Meta ads to act on today: {len(pause)} to consider pausing, {len(links)} landing page problem(s)"
    m["From"] = u
    m["To"] = "hello@lacalut.com.au"
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as s:
        s.login(u, p)
        s.send_message(m)
    STATE.write_text(json.dumps({"sent": today, "pause": [x[0]["id"] for x in pause], "links": [x[0]["id"] for x in links]}), encoding="utf-8")
    log(f"emailed: {len(pause)} pause, {len(links)} link problems")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as ex:
        log(f"RUN FAILED: {type(ex).__name__}: {ex}")
        sys.exit(1)
