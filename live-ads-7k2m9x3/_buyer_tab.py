# -*- coding: utf-8 -*-
"""Media Buyer tab for the Live Ads Monitor (Quan 15/11/2026).

Reads buyer.json (written by _pull_live.pull_buyer) and returns (count, html).
The table is drawn in the browser from embedded JSON so the Setup panel (ideal MER,
AOV, profit %, FCR %, frequency boundaries, pause rule) can recolour it instantly.
Setup values are saved in the viewer's browser (localStorage) only.
View only: nothing on this tab changes an ad.

CPP thresholds copy the EE Meta Media Buyer Setup panel (read 15/11/2026):
  base = AOV x ideal MER.  MOF green < 1x base, red > 2x.  TOM 1.25x / 2.5x.  TOF 2x / 4x.
  Funnel stage an ad set is "acting like" = its 7-day frequency vs the two boundaries.
The Hero / Sidekick / Villain / Civilian classes are NOT reproduced (EE does not publish the rule).
"""
import json, os

# Defaults = Quan's EE Setup panel on 15/11/2026. MARGIN is back-calculated so that
# margin - profit - FCR = ideal MER (49.05 - 21 - 12.5 = 15.55).
DEFAULTS = {"mer": 15.55, "mer3": 44.0, "mer30": 44.66, "aov": 54.15, "profit": 21.0, "fcr": 12.5,
            "margin": 49.05, "b1": 2.0, "b2": 3.0, "minspend": 150.0, "superspend": 300.0, "superroas": 2.5,
            "roasbe": 2.04, "villroas": 1.0, "fastspend": 100.0}
ADS_ACT = "2157906551266386"

CLASS_LABEL = {"supervillain": "Supervillain", "villain": "Villain", "sidekick": "Sidekick",
               "civilian": "Civilian", "hero": "Hero", "superhero": "Superhero"}


def classify(a, D=None):
    """Our own classes (Quan 15/11/2026), judged on spend and ROAS. Returns (key, reason).
    The same logic is written in JavaScript inside HTML below: change both together."""
    D = D or DEFAULTS
    if str(a.get("campaign", "")).startswith("#HYPE"):   # Quan 25/11/2026: Reach campaigns are judged on reach, never on sales; never auto-paused
        return "civilian", "Reach campaign: judged on reach and frequency, not sales. Never auto-paused"
    d, d3 = a.get("d7"), a.get("d3")
    sp = d["sp"] if d else 0.0
    r7 = (d["rev"] / d["sp"]) if d and d["sp"] else None
    fast = bool(d3 and d3["sp"] >= D["fastspend"] and d3["rev"] / d3["sp"] < D["villroas"])
    if sp >= D["superspend"] and r7 < D["villroas"]:
        return "supervillain", f"${sp:,.0f} spent in 7 days, ROAS {r7:.2f}"
    if sp >= D["minspend"] and r7 < D["villroas"]:
        return "villain", f"${sp:,.0f} spent in 7 days, ROAS {r7:.2f}"
    if fast:
        return "villain", f"${d3['sp']:,.0f} spent in 3 days, ROAS {d3['rev'] / d3['sp']:.2f}"
    if sp < D["minspend"]:
        return "civilian", f"under ${D['minspend']:.0f} spent in 7 days"
    if sp >= D["superspend"] and r7 >= D["superroas"] and d["pc"] >= 5:
        return "superhero", f"${sp:,.0f} spent in 7 days, ROAS {r7:.2f}, {d['pc']} sales"
    if r7 >= D["roasbe"]:
        return "hero", f"${sp:,.0f} spent in 7 days, ROAS {r7:.2f}"
    return "sidekick", f"${sp:,.0f} spent in 7 days, ROAS {r7:.2f}"

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
#mb{--s0:var(--bg);--s1:#fff;--s2:#f3f4f7;--bd:#e6e8ee;--bd2:#d6dae2;--tx:#0f172a;--tx2:#586174;--tx3:#8a93a3;--ac:#4f46e5;--g:#0e9f6e;--gbg:#e7f7f0;--gtx:#046c4e;--w:#e08a00;--wbg:#fff5e0;--wtx:#8a4b00;--b:#e02424;--bbg:#fdeaea;--btx:#9b1c1c;--n:#a6aebb;--on:#fff;--sh:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.05);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--tx);font-variant-numeric:tabular-nums}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #mb{--s1:#151922;--s2:#1d222d;--bd:#272d39;--bd2:#343c4a;--tx:#e8eaf0;--tx2:#a3acba;--tx3:#737d8c;--ac:#8b93ff;--g:#34d399;--gbg:rgba(52,211,153,.14);--gtx:#6ee7b7;--w:#fbbf24;--wbg:rgba(251,191,36,.14);--wtx:#fcd34d;--b:#f87171;--bbg:rgba(248,113,113,.15);--btx:#fca5a5;--n:#5d6675;--on:#10131a;--sh:none}}
:root[data-theme=dark] #mb{--s1:#151922;--s2:#1d222d;--bd:#272d39;--bd2:#343c4a;--tx:#e8eaf0;--tx2:#a3acba;--tx3:#737d8c;--ac:#8b93ff;--g:#34d399;--gbg:rgba(52,211,153,.14);--gtx:#6ee7b7;--w:#fbbf24;--wbg:rgba(251,191,36,.14);--wtx:#fcd34d;--b:#f87171;--bbg:rgba(248,113,113,.15);--btx:#fca5a5;--n:#5d6675;--on:#10131a;--sh:none}
.wrap:has(.tabpane[data-pane="buyer"]:not([hidden])){max-width:1780px}
#mb h2{font-weight:700;letter-spacing:-.02em}
#mb .note{color:var(--tx3);font-size:12.5px}
#mb .mut{color:var(--tx3)}
#mb .pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:12.5px;font-weight:600;border:none}
#mb .pill-good{background:var(--gbg);color:var(--gtx)}#mb .pill-mid{background:var(--wbg);color:var(--wtx)}#mb .pill-bad{background:var(--bbg);color:var(--btx)}#mb .pill-none{background:var(--s2);color:var(--tx2)}
.mb-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--s2);color:var(--tx2);letter-spacing:0}
.mb-chip i,.mbv i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.mb-chip.good{background:var(--gbg);color:var(--gtx)}.mb-chip.warn{background:var(--wbg);color:var(--wtx)}.mb-chip.bad{background:var(--bbg);color:var(--btx)}
.mb-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:14px 0 12px}
.mb-h{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:7px;align-items:flex-start}
.mb-h small{font-size:12.5px;font-weight:500;color:var(--tx2)}
.mb-h b{font-size:28px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
.mb-h em{font-style:normal;font-size:12px;color:var(--tx3);line-height:1.4}
.mb-merrow{display:grid;grid-template-columns:minmax(300px,1fr) 2fr;gap:12px;margin:0 0 12px}
@media (max-width:900px){.mb-merrow{grid-template-columns:1fr}}
.mb-banner{position:relative;background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px 16px 46px;box-shadow:var(--sh);font-size:16px;font-weight:600;letter-spacing:-.01em;margin:0}
.mb-banner:before{content:'';position:absolute;left:19px;top:22px;width:10px;height:10px;border-radius:50%;background:var(--n);box-shadow:0 0 0 4px var(--s2)}
.mb-banner.down:before{background:var(--b);box-shadow:0 0 0 4px var(--bbg)}.mb-banner.up:before{background:var(--g);box-shadow:0 0 0 4px var(--gbg)}.mb-banner.hold:before{background:var(--w);box-shadow:0 0 0 4px var(--wbg)}
.mb-banner small{display:block;font-weight:400;font-size:12.5px;color:var(--tx2);margin-top:7px;line-height:1.55;letter-spacing:0}
.mb-days{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px 18px 12px;box-shadow:var(--sh);overflow-x:auto}
.mb-days:empty{display:none}
.mb-dh{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px}
.mb-dh b{font-size:13px;font-weight:600}.mb-dh span{font-size:12px;color:var(--tx3)}
.mb-dbars{display:flex;align-items:flex-end;gap:6px;min-height:86px}
.mb-dcol{flex:1;min-width:34px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:help}
.mb-dcol span{font-size:11px;font-weight:600;color:var(--tx2)}
.mb-dcol i{display:block;width:100%;max-width:40px;border-radius:4px 4px 0 0;background:var(--n)}
.mb-dcol i.good{background:var(--g)}.mb-dcol i.warn{background:var(--w)}.mb-dcol i.bad{background:var(--b)}
.mb-dcol em{font-style:normal;font-size:10.5px;color:var(--tx3);white-space:nowrap}
.mb-today{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:0 0 12px}
.mb-tp{background:var(--s1);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--sh);overflow:hidden;display:flex;flex-direction:column}
.mb-tph{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid var(--bd)}
.mb-tph i{width:8px;height:8px;border-radius:50%;background:var(--ac);flex:none}
.mb-tp.bad .mb-tph i{background:var(--b)}.mb-tp.warn .mb-tph i{background:var(--w)}.mb-tp.good .mb-tph i{background:var(--g)}
.mb-tph b{font-size:13px;font-weight:600;flex:1}
.mb-tph span{font-size:12px;font-weight:600;background:var(--s2);border-radius:999px;padding:1px 9px;color:var(--tx2)}
.mb-tpb{padding:6px 8px;max-height:178px;overflow:auto;display:flex;flex-direction:column}
.mb-ti{font-size:12.5px;padding:6px 8px;border-radius:8px;line-height:1.4}
.mb-ti:hover{background:var(--s2)}
.mb-tpb .mut{padding:6px 8px;font-size:12.5px}
.mb-setup{background:var(--s1);border:1px solid var(--bd);border-radius:14px;margin:0 0 22px;box-shadow:var(--sh)}
.mb-setup summary{cursor:pointer;font-weight:600;font-size:13.5px;padding:13px 18px;list-style:none;display:flex;align-items:center;gap:12px;color:var(--tx2)}
.mb-setup summary::-webkit-details-marker{display:none}
.mb-setup summary:before{content:'';width:6px;height:6px;border-right:2px solid var(--tx3);border-bottom:2px solid var(--tx3);transform:rotate(-45deg);transition:transform .15s}
.mb-setup[open] summary:before{transform:rotate(45deg)}
.mb-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px 16px;padding:6px 18px 16px}
.mb-f label{display:block;font-size:12px;font-weight:500;color:var(--tx2);margin-bottom:5px}
.mb-f input{width:100%;box-sizing:border-box;font:inherit;font-size:14.5px;font-weight:600;padding:8px 10px;border:1px solid var(--bd2);border-radius:9px;background:var(--s1);color:var(--tx)}
.mb-f input:focus{outline:2px solid var(--ac);outline-offset:-1px}
.mb-f input:disabled{background:var(--s2);opacity:.8}
.mb-f small{display:block;font-size:11.5px;color:var(--tx3);margin-top:4px;line-height:1.4}
.mb-shead{grid-column:1/-1;font-size:12px;font-weight:600;color:var(--tx);border-top:1px solid var(--bd);padding-top:14px;margin-top:2px}
.mb-thr{padding:0 18px 14px;font-size:13px;display:flex;gap:6px 22px;flex-wrap:wrap;color:var(--tx2)}
.mb-thr b{margin-right:6px;color:var(--tx);font-weight:600}.mb-g{color:var(--gtx);font-weight:600}.mb-a{color:var(--wtx);font-weight:600}.mb-r{color:var(--btx);font-weight:600}
.mb-reset{font:inherit;font-size:12.5px;font-weight:500;margin:0 18px 16px;padding:7px 12px;border-radius:9px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx2);cursor:pointer}
.mb-reset:hover{background:var(--s2);color:var(--tx)}
.mb-ord{display:inline-flex;gap:4px;margin:0 10px;vertical-align:middle}.mb-ob{font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:3px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--s1);color:var(--tx2)}.mb-ob:hover{color:var(--tx);border-color:var(--tx2)}
.mb-lab{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--tx);margin:0 0 10px}
#mb .mb-kpis{margin:0 0 6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
#mb .mb-kpis .kpi{margin:0;min-width:0}
#mb .kpi{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;box-shadow:var(--sh)}
#mb .kpi .lbl{font-size:12.5px;font-weight:500;color:var(--tx2);text-transform:none;letter-spacing:0}
#mb .kpi .val{font-size:26px;font-weight:600;letter-spacing:-.03em;color:var(--tx);display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.mb-sub{font-size:12px;color:var(--tx3);margin-top:8px}
.mb-chips{display:flex;gap:6px;flex-wrap:wrap;margin:20px 0 12px;align-items:center}
.mbf{font:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:6px 12px;border-radius:9px;border:1px solid var(--bd);background:var(--s1);color:var(--tx2);display:inline-flex;gap:8px;align-items:center;box-shadow:0 1px 1px rgba(16,24,40,.04)}
.mbf:hover{border-color:var(--bd2);color:var(--tx)}
.mbf[aria-pressed=true]{background:var(--tx);border-color:var(--tx);color:var(--s1)}
.mbf .tcount{background:var(--s2);color:var(--tx2);border-radius:6px;font-size:11.5px;font-weight:600;padding:0 6px}
.mbf[aria-pressed=true] .tcount{background:rgba(128,128,128,.35);color:inherit}
.mbd{width:8px;height:8px;border-radius:50%;background:var(--n);flex:none}
.mbd-villain{background:var(--b)}.mbd-supervillain{background:#7f1d1d}.mbd-sidekick{background:var(--w)}.mbd-hero{background:var(--g)}.mbd-superhero{background:#046c4e}
.mb-colbtn{margin-left:auto}
.mb-wrap{overflow:auto;max-height:calc(100vh - 370px);min-height:420px;background:var(--s0);border:none;border-radius:14px}
.mb-table{width:100%;border-collapse:separate;border-spacing:0}
#mb .mb-table thead th{position:sticky;top:0;z-index:7;white-space:nowrap;cursor:help;background:var(--s2);color:var(--th);font-size:12px;font-weight:700;letter-spacing:0;text-transform:none;padding:0 6px;height:40px;box-sizing:border-box;border-bottom:1px solid var(--bd);box-shadow:none}
#mb .mb-table thead tr.colfilters th{top:40px;height:auto;padding:5px 6px 8px;cursor:default}
#mb tr.colfilters input{background:var(--s1);border:1px solid var(--bd);border-radius:7px;padding:4px 7px;font-size:11.5px;color:var(--tx)}
#mb tr.colfilters input:focus{border-color:var(--ac)}
.mb-table thead th+th{border-left:1px solid var(--bd)}
.mb-table thead tr:first-child th:first-child{border-top-left-radius:12px}
.mb-table thead tr:first-child th:last-child{border-top-right-radius:12px}
.mb-table thead tr.colfilters th:first-child{border-bottom-left-radius:12px}
.mb-table thead tr.colfilters th:last-child{border-bottom-right-radius:12px}
#mb .mb-table tbody td{padding:10px 6px;border-bottom:1px solid var(--bd);font-size:13px}
.mb-gap td{height:14px;padding:0!important;background:var(--s0)!important;border:none!important}
.mb-gap-big td{height:38px}
#mb .mb-camp td{background:var(--s0)!important;color:var(--tx);padding:4px 4px 0;border:none}
.mb-crow{display:flex;align-items:center;justify-content:flex-start;gap:16px;flex-wrap:wrap}
.mb-cn{display:inline-block;background:var(--ac);color:var(--on);font-size:16.5px;font-weight:700;letter-spacing:-.01em;padding:9px 20px;border-radius:999px;box-shadow:0 2px 6px rgba(79,70,229,.28)}
.mb-cm{font-size:13px;color:var(--tx2);display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
#mb .mb-set td{background:var(--s1)!important;color:var(--tx);padding:16px 18px 15px;border:1px solid var(--bd2);border-left:4px solid var(--sc,var(--bd2));border-bottom:1px solid var(--bd);border-radius:14px 14px 0 0}
.mb-sname{font-size:14.5px;font-weight:600;letter-spacing:-.01em;margin-bottom:13px}
.mb-stats{display:flex;flex-wrap:wrap;gap:12px 0}
.mb-st{display:inline-flex;flex-direction:column;gap:4px;padding:0 20px;border-left:1px solid var(--bd)}
.mb-st:first-child{padding-left:0;border-left:none}
.mb-st small{font-size:11.5px;font-weight:500;color:var(--tx3);white-space:nowrap}
.mb-st b{font-size:14.5px;font-weight:600;color:var(--tx);white-space:nowrap}
.mb-st.mb-big b{color:var(--ac)}
#mb .mb-ad td{background:var(--s1)}
#mb .mb-ad:hover td{background:var(--s2)}
.mb-ad td+td{border-left:1px solid var(--bd)}
#mb .mb-ad td:first-child{border-left:4px solid var(--sc,var(--bd2))}
#mb .mb-ad td:last-child{border-right:1px solid var(--bd2)}
.mb-ad.mb-last td:first-child{border-bottom-left-radius:14px}
.mb-ad.mb-last td:last-child{border-bottom-right-radius:14px}
#mb .mb-more td{background:var(--s1);border:1px solid var(--bd2);border-top:none;border-left:4px solid var(--sc,var(--bd2));border-radius:0 0 14px 14px;padding:10px 14px}
.mb-morebtn{font:inherit;border:1px solid var(--bd);background:var(--s1);border-radius:8px;padding:6px 12px;font-weight:500;font-size:12.5px;cursor:pointer;color:var(--tx2)}
.mb-morebtn:hover{background:var(--s2);color:var(--tx)}
.mb-table:not(.mb-searching) tr.mb-hid{display:none}
.mb-foots{display:flex;gap:8px;flex-wrap:wrap}
#mb .mb-table tr.mb-paused td:not(.mb-acts){opacity:.58}
#mb .mb-table tr.mb-ishid td:not(.mb-acts){opacity:.38}
.mbv-paused{background:transparent;color:var(--tx2);border:1px dashed var(--bd)}
#mb .mb-acts{white-space:nowrap}
#mb .mb-hide{font:inherit;font-size:12px;font-weight:500;margin-left:10px;padding:2px 8px;border:1px solid var(--bd);border-radius:6px;background:transparent;color:var(--tx2);cursor:pointer}
#mb .mb-hide:hover{background:var(--s2);color:var(--tx)}
.mb-table.mb-less tr>*:nth-child(10),.mb-table.mb-less tr>*:nth-child(14),.mb-table.mb-less tr>*:nth-child(13),.mb-table.mb-less tr>*:nth-child(18),.mb-table.mb-less tr>*:nth-child(19){display:none}.mb-cppw{font:inherit;font-size:11px;padding:1px 2px;border:1px solid var(--bd);border-radius:6px;background:var(--s1);color:inherit}
.mb-table .adtd{min-width:230px;max-width:300px}
#mb .mb-th{width:64px;height:64px;min-width:64px;border-radius:10px;border:1px solid var(--bd);cursor:zoom-in}
#mb .adname{font-weight:500;font-size:13px;line-height:1.4;color:var(--tx)}
.mb-reach{display:block;margin-top:6px;font-size:12px;font-weight:600;color:#364fc7;background:#edf2ff;border-radius:6px;padding:4px 8px;line-height:1.5}
.mb-near{display:block;width:fit-content;margin-top:6px;font-size:11.5px;font-weight:600;color:var(--wtx);background:var(--wbg);border-radius:6px;padding:2px 8px}
.mbv{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;cursor:help}
.mbv-supervillain{background:var(--b);color:var(--on)}.mbv-villain{background:var(--bbg);color:var(--btx)}
.mbv-sidekick{background:var(--wbg);color:var(--wtx)}.mbv-civilian{background:var(--s2);color:var(--tx2)}
.mbv-hero{background:var(--gbg);color:var(--gtx)}.mbv-superhero{background:var(--g);color:var(--on)}
.mb-up{color:var(--g);font-size:9px}.mb-dn{color:var(--b);font-size:9px}
.mb-vid{font-size:10px;font-weight:600;letter-spacing:.04em;background:var(--s2);color:var(--tx2);padding:1px 6px;border-radius:5px;margin-left:4px}
.mb-lp{text-decoration:none}
#mb .mb-table thead tr:first-child th:nth-child(n+3):nth-child(-n+19){text-align:right}
#mb .mb-table thead tr.colfilters th:nth-child(n+3):nth-child(-n+19) input{text-align:right}
#mb .mb-ad td.c{text-align:left}
#mb .mb-tot td,#mb .mb-tot:hover td{background:var(--s2);font-weight:600}
#mb .mb-tot td.adtd{font-size:12.5px;font-weight:500;color:var(--tx2)}
#mb{--cb:#e6e9fa;--th:#1d4ed8}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #mb{--cb:#1b1f33}}
:root[data-theme=dark] #mb{--cb:#1b1f33}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #mb{--th:#93b4ff}}
:root[data-theme=dark] #mb{--th:#93b4ff}
#mb tr.mb-set,#mb tr.mb-ad,#mb tr.mb-more{background:var(--cb)!important}
#mb .mb-camp td{background:var(--cb)!important;padding:16px 16px 4px;border-radius:20px 20px 0 0}
#mb .mb-gap:not(.mb-gap-big) td{background:var(--cb)!important}
#mb .mb-cend td{height:14px;padding:0;border:none;background:var(--cb)!important;border-radius:0 0 20px 20px}
#mb .mb-gap-big td{height:26px}
#mb{--cc:var(--ac)}
#mb .fn-tof{--cb:#fcdcea;--cc:#d6246e}#mb .fn-tom{--cb:#fcedc0;--cc:#b45309}#mb .fn-mof{--cb:#d5f2dc;--cc:#15803d}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #mb .fn-tof{--cb:#3a1629;--cc:#f472b6}:root:not([data-theme=light]) #mb .fn-tom{--cb:#33270e;--cc:#fbbf24}:root:not([data-theme=light]) #mb .fn-mof{--cb:#13301d;--cc:#4ade80}}
:root[data-theme=dark] #mb .fn-tof{--cb:#3a1629;--cc:#f472b6}:root[data-theme=dark] #mb .fn-tom{--cb:#33270e;--cc:#fbbf24}:root[data-theme=dark] #mb .fn-mof{--cb:#13301d;--cc:#4ade80}
#mb .mb-cn{background:var(--cc);box-shadow:0 2px 6px rgba(16,24,40,.18)}
#mb .mb-cm{color:var(--tx);font-weight:500}
#mb .mb-camp td{position:sticky;top:var(--hh,80px);z-index:6;box-shadow:0 6px 10px -8px rgba(16,24,40,.35)}
#mb .mb-setupw{margin:8px 2px 2px}#mb .mb-chg{grid-column:1/-1;background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:10px 16px}#mb .mb-chg summary{cursor:pointer;font-weight:700;font-size:14px}#mb .mb-chg[open] summary{margin-bottom:10px}#mb .mb-kfold{margin:0 0 12px}#mb .mb-sdo{margin-top:10px;padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.5}#mb .mb-sdo.bad{background:#fff0f0;color:#7d1d1d;border:1px solid #ffc9c9}#mb .mb-sdo.bad>b{color:#c92a2a}#mb .mb-sdo.good{background:#ebfbee;color:#1e5128;border:1px solid #b2f2bb}#mb .mb-sdo.good>b{color:#2b8a3e}#mb .mb-sdo.civ{background:var(--s2);color:var(--tx2)}
#mb .mb-do{display:block;margin-top:5px;font-size:11.5px;font-weight:700;white-space:nowrap}#mb .mb-do-bad{color:#c92a2a}#mb .mb-do-warn{color:#b35c00}#mb .mb-do-good{color:#2b8a3e}#mb .mb-do-civ{color:var(--tx2)}
#mb .mb-pf{display:block;font-size:11px;font-weight:600;white-space:nowrap}#mb .mb-pf.good{color:#2b8a3e}#mb .mb-pf.bad{color:#c92a2a}
#mb .mb-tg{display:block;font-size:10px;font-weight:500;color:var(--tx2);white-space:nowrap}
#mb td.mb-g{color:#2b8a3e;font-weight:700}#mb td.mb-b{color:#c92a2a;font-weight:700}#mb td.mb-w{color:#b35c00}
#mb .mb-lrn{display:inline-block;margin-left:8px;font-size:11.5px;font-weight:600;background:#e7f5ff;color:#1864ab;padding:2px 9px;border-radius:999px;vertical-align:middle}#mb .mb-lrn.lim{background:#fff3bf;color:#a15c00}
#mb .mb-oldb{background:#ffe3e3;color:#c92a2a;border:2px solid #fa5252;border-radius:14px;padding:14px 18px;font-size:16px;font-weight:700;margin:10px 0}
#mb .mb-donow{background:var(--s1);border:2px solid var(--ac);border-radius:16px;padding:16px 20px;margin:12px 0;box-shadow:var(--sh)}
#mb .mb-dh2{font-size:18px;font-weight:800;margin-bottom:8px}#mb .mb-dol{margin:0;padding-left:22px;font-size:14px;line-height:1.55}#mb .mb-dol>li{margin:6px 0}#mb .mb-dol>li.bad>b{color:#c92a2a}#mb .mb-dol>li.good>b{color:#2b8a3e}#mb .mb-dol ul{margin:4px 0 2px;padding-left:18px;font-size:12.5px}
#mb .mb-gloss{margin:0 0 12px;background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:10px 16px}#mb .mb-gloss summary{cursor:pointer;font-weight:700;font-size:14px}#mb .mb-glist{columns:2 380px;font-size:13px;line-height:1.5;margin-top:8px}#mb .mb-glist p{margin:0 0 7px;break-inside:avoid}#mb .mb-setl{display:inline-block;font-size:12.5px;font-weight:500;color:var(--tx)}#mb .mb-who{font-size:12.5px;color:var(--tx);margin:0 2px 4px;font-weight:600}
#mb .mb-flag{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:12px}
#mb .mb-flag.bad{background:#ffe3e3;color:#c92a2a}#mb .mb-flag.good{background:#d3f9d8;color:#2b8a3e}#mb .mb-flag.warn{background:#fff3bf;color:#a15c00}
#mb .mb-table tbody tr.mb-sh td{padding:7px 6px 5px;font-size:11.5px;font-weight:700;color:var(--th);background:var(--s2)!important;border-bottom:1px solid var(--bd);white-space:nowrap}
.mb-legend{display:inline-flex;gap:14px;align-items:center;font-size:12.5px;color:var(--tx2);margin-left:10px}
.mb-legend i{display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:6px;vertical-align:-1px}
#mb .mb-table tbody tr.mb-set td,#mb .mb-table tbody tr.mb-more td{padding:0 12px;border:none;border-radius:0;box-shadow:none;background:var(--cb)!important}
#mb .mb-set .mb-in{background:var(--s1);border:1px solid var(--bd2);border-left:4px solid var(--sc,var(--bd2));border-bottom-color:var(--bd);border-radius:14px 14px 0 0;padding:16px 18px 15px}
#mb .mb-more .mb-in{background:var(--s1);border:1px solid var(--bd2);border-top:none;border-left:4px solid var(--sc,var(--bd2));border-radius:0 0 14px 14px;padding:10px 14px}
#mb .mb-foot .mb-in{padding:0;height:10px}
#mb .mb-ad td:first-child{border-left:12px solid transparent;background-clip:padding-box!important;box-shadow:inset 4px 0 0 var(--sc,var(--bd2))}
#mb .mb-ad td:last-child{border-right:12px solid transparent;background-clip:padding-box!important;box-shadow:inset -1px 0 0 var(--bd2)}
#mb .wlink{font-size:12.5px;font-weight:500;color:var(--ac);text-decoration:none;white-space:nowrap}
#mb .wlink:hover{text-decoration:underline}
"""

HTML = """<section class="sec" id="mb">
<h2>&#127919; Media Buyer &mdash; every live ad <span class="count">__N__</span></h2>
<p class="note">Meta data pulled __PULLED__ (this PC's time). Numbers are the last 7 days unless the column name says otherwise. View only: nothing on this page changes an ad. Hover a column name to see what it means.</p>
<div id="mb-old"></div>
<details class="mb-gloss"><summary>&#128214; What do these words mean?</summary><div class="mb-glist">
<p><b>ROAS</b> = sales value / ad spend. 2.0 = $2 of sales for every $1 spent. Break-even is 2.04.</p>
<p><b>MER</b> = all ad spend as a share of all Shopify sales. Lower is better. Ideal is about 15.6%.</p>
<p><b>CPP</b> = cost per purchase: ad spend / sales.</p>
<p><b>CPC link</b> = the cost of one click to the website.</p>
<p><b>CTR link</b> = out of 100 people who see the ad, how many click.</p>
<p><b>$ / cart</b> = ad spend for each add to cart.</p>
<p><b>Cart &rarr; buy</b> = out of 100 carts, how many turn into a sale. Low = a website or price problem, not the ad.</p>
<p><b>Freq</b> = how many times the same person saw the ad. Over 2.5 = people are getting tired of it.</p>
<p><b>Hook</b> (videos) = out of 100 people, how many watched 3 seconds.</p>
<p><b>Campaign &rarr; ad set &rarr; ad</b> = the folder, the group inside it, and the actual ad people see.</p>
<p><b>Campaign budget</b> = one daily amount Meta shares across the ad sets. <b>Minimum spend</b> forces Meta to give one ad set at least that much, even when it is losing. We never use it.</p>
<p><b>Learning</b> = Meta is still working out who buys. Adding or editing ads, or a big budget change, restarts it.</p>
<p><b>TOF / TOM / MOF / BOF</b> = cold new people / everyone except buyers / warm visitors / past buyers.</p>
<p><b>Profit (7d)</b> = sales value x 49% gross margin, minus ad spend. A rough guide.</p>
<p><b>Villain</b> pause &middot; <b>Supervillain</b> pause now &middot; <b>Sidekick</b> keep and watch &middot; <b>Hero</b> keep &middot; <b>Superhero</b> keep and give more budget &middot; <b>Civilian</b> too early to tell (under $150 spent).</p>
</div></details>
<div class="mb-hero" id="mb-hero"></div>
<div class="mb-merrow"><div class="mb-banner" id="mb-banner"></div><div class="mb-days" id="mb-days"></div></div>
<div class="mb-today" id="mb-today"></div>
<details class="mb-setup">
<summary>Setup: targets and class rules</summary>
<div class="mb-sgrid">
<div class="mb-f"><label>Ideal MER %</label><input id="mb-mer" type="number" step="0.01"><small>Ad spend &divide; revenue we aim for</small></div>
<div class="mb-f"><label>MER 3-day rolling %</label><input id="mb-mer3" type="number" step="0.01"><small class="mb-auto">Typed in by hand</small></div>
<div class="mb-f"><label>MER last 30 days %</label><input id="mb-mer30" type="number" step="0.01"><small class="mb-auto">Typed in by hand</small></div>
<div class="mb-f"><label>AOV $</label><input id="mb-aov" type="number" step="0.01"><small id="mb-aovnote">Average order value</small></div>
<div class="mb-shead">Advanced &mdash; ideal MER targets</div>
<div class="mb-f"><label>Ideal profit %</label><input id="mb-profit" type="number" step="0.5"><small>Changing this recalculates ideal MER</small></div>
<div class="mb-f"><label>Ideal FCR %</label><input id="mb-fcr" type="number" step="0.5"><small>Changing this recalculates ideal MER</small></div>
<div class="mb-f"><label>Margin before ads %</label><input id="mb-margin" type="number" step="0.01"><small>Ideal MER = margin &minus; profit &minus; FCR</small></div>
<div class="mb-shead">Frequency boundaries (which funnel stage an ad set is acting like)</div>
<div class="mb-f"><label>TOF / TOM boundary</label><input id="mb-b1" type="number" step="0.1"><small>Frequency below this = TOF</small></div>
<div class="mb-f"><label>TOM / MOF boundary</label><input id="mb-b2" type="number" step="0.1"><small>Frequency above this = MOF</small></div>
<div class="mb-shead">Our classes (Class column): Superhero, Hero, Sidekick, Civilian, Villain, Supervillain</div>
<div class="mb-f"><label>Proven spend $ (7 days)</label><input id="mb-minspend" type="number" step="10"><small>Under this = Civilian (too early)</small></div>
<div class="mb-f"><label>Break-even ROAS</label><input id="mb-roasbe" type="number" step="0.05"><small>At or above = Hero. Below, down to the Villain line = Sidekick</small></div>
<div class="mb-f"><label>Villain ROAS</label><input id="mb-villroas" type="number" step="0.05"><small>Proven spend and ROAS under this = Villain: pause</small></div>
<div class="mb-f"><label>Fast loser spend $ (3 days)</label><input id="mb-fastspend" type="number" step="10"><small>This much in 3 days with ROAS under the Villain line = Villain</small></div>
<div class="mb-f"><label>Super spend $ (7 days)</label><input id="mb-superspend" type="number" step="10"><small>Villain at this spend = Supervillain</small></div>
<div class="mb-f"><label>Superhero ROAS</label><input id="mb-superroas" type="number" step="0.1"><small>Super spend, this ROAS and 5+ sales = Superhero</small></div>
</div>
<div class="mb-thr" id="mb-thr"></div>
<button class="mb-reset" id="mb-reset">Reset Setup to the saved defaults</button>
</details>
<details class="mb-chg mb-kfold"><summary>&#128202; All campaigns side by side, last 7 days &middot; click to open</summary><div class="kpis mb-kpis" id="mb-kpis"></div></details>
<div class="mb-lab" style="margin-top:22px">Every live ad, by ad set</div>
<div class="mb-chips" id="mb-chips" style="margin-top:0"></div>
<div class="tablewrap mb-wrap"><table class="mb-table">
<thead><tr><th>Ad</th><th title="Our own classes, set in Setup. Villain and Supervillain = pause. Hero and Superhero are never paused. These are not the EE labels.">Class</th>
<th title="Last 7 days">Spend 7d</th><th title="Spend today (Queensland day so far)">Spend today</th><th title="Purchases, last 7 days">Purch.</th>
<th title="Cost per purchase for the period you pick. Colour = CPP thresholds for the funnel stage this ad set is acting like">CPP <select id="mb-cppw" class="mb-cppw" onclick="event.stopPropagation()"><option value="d0">today</option><option value="d1">yesterday</option><option value="d3">3 days</option><option value="d7">7 days</option></select></th>
<th title="Meta purchase value / spend, last 7 days">ROAS 7d</th><th title="Meta purchase value / spend, today">ROAS today</th>
<th title="Average times each person saw this ad, last 7 days">Freq</th><th title="Unique people who saw this ad, last 7 days">Reach</th>
<th title="Link clicks / impressions">CTR link</th><th title="Cost per link click (spend / link clicks), last 7 days">CPC link</th><th title="Cost per 1,000 impressions">CPM</th>
<th title="Videos only: 3-second views / impressions">Hook</th>
<th title="Cost per add to cart (spend / adds to cart), last 7 days">$ / cart</th><th title="Add to carts / landing page views">Add to cart</th><th title="Purchases / adds to cart: how many carts turn into a sale">Cart &rarr; buy</th>
<th title="Checkouts started / landing page views">Checkout</th>
<th>Days live</th><th>Landing page</th><th></th></tr></thead>
<tbody id="mb-body"></tbody></table></div>
</section>
<style>__CSS__</style>
<script>
(function(){
var NEWC=__NEWC__,DATA=__DATA__,DEF=__DEF__,AUTO=__AUTO__,ACTS=__ACTS__,ACT="__ACT__",KEY='lacalut_mb_setup_v2',NC=21;
var CORD=[],LASTORD=[],CKEY='lacalut_mb_camp_order';try{CORD=JSON.parse(localStorage.getItem(CKEY)||'[]')||[]}catch(e){}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.mb-ob');if(!b)return;var o=LASTORD.slice(),c=b.getAttribute('data-c'),i=o.indexOf(c);if(i<0)return;o.splice(i,1);var k=b.getAttribute('data-o');o.splice(k==='top'?0:k==='up'?Math.max(0,i-1):Math.min(o.length,i+1),0,c);CORD=o;try{localStorage.setItem(CKEY,JSON.stringify(o))}catch(e){}render();var r=[].filter.call(document.querySelectorAll('.mb-ob[data-o=top]'),function(x){return x.getAttribute('data-c')===c})[0];if(r)r.scrollIntoView({block:'center'})});
var CPPW='d7';try{CPPW=localStorage.getItem('lacalut_mb_cppw')||'d7'}catch(e){}
var openSets={},less=true;try{less=localStorage.getItem('lacalut_mb_less3')!=='0'}catch(e){}
var HID={},showHid=false,HKEY='lacalut_mb_hidden';try{HID=JSON.parse(localStorage.getItem(HKEY)||'{}')||{}}catch(e){}
var IDS=['mer','mer3','mer30','aov','profit','fcr','margin','b1','b2','minspend','roasbe','villroas','fastspend','superspend','superroas'];
var S={},filt='';
function load(){var o={};try{o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
  if(parseFloat(o.roasbe)===1.5)delete o.roasbe;IDS.forEach(function(k){var v=parseFloat(o[k]);S[k]=isFinite(v)?v:DEF[k]});
  if(AUTO){S.mer3=AUTO.mer3;S.mer30=AUTO.mer30;if(!isFinite(parseFloat(o.aov))&&AUTO.aov)S.aov=AUTO.aov}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function fill(){IDS.forEach(function(k){document.getElementById('mb-'+k).value=+S[k].toFixed(2)})}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function money(v){return '$'+(v>=100?Math.round(v).toLocaleString():v.toFixed(2))}
var Z='<span class="mut">&mdash;</span>';
function thr(){var b=S.aov*S.mer/100;return{TOF:[2*b,4*b],TOM:[1.25*b,2.5*b],MOF:[b,2*b]}}
function stage(f){return f<S.b1?'TOF':(f<=S.b2?'TOM':'MOF')}
function cpp(d){if(!d||!d.sp)return null;return d.pc?d.sp/d.pc:Infinity}
function cppCell(d,st,base){var c=cpp(d);if(c===null)return '<td class="num">'+Z+'</td>';
  if(c===Infinity)return '<td class="num"><span class="pill pill-bad" title="'+money(d.sp)+' spent, 0 purchases">no sale</span></td>';
  var t=thr()[st],cls=c<t[0]?'pill-good':(c<=t[1]?'pill-mid':'pill-bad'),ar='';
  if(base&&base!==Infinity){if(c<base*0.9)ar=' <span class="mb-up" title="Cheaper than the 7-day CPP">&#9660;</span>';else if(c>base*1.1)ar=' <span class="mb-dn" title="Dearer than the 7-day CPP">&#9650;</span>'}
  return '<td class="num"><span class="pill '+cls+'">'+money(c)+'</span>'+ar+'</td>'}
function roasCell(d){if(!d||!d.sp)return '<td class="num">'+Z+'</td>';var r=d.rev/d.sp;
  return '<td class="num"><span class="pill '+(r>=S.roasbe?'pill-good':(r>=1?'pill-mid':'pill-bad'))+'">'+r.toFixed(2)+'x</span></td>'}
function pct(n,d){return d?(100*n/d).toFixed(1)+'%':Z}
// 28/11/2026 (Quan): Do this now box + old-numbers banner
function doNow(){var P=[],H=[],N=0,lost=0;(DATA.ads||[]).forEach(function(a){if(isR(a))return;var v=cls(a)[0],d=a.d7;if(v==='villain'||v==='supervillain'){P.push(a);lost+=Math.max(0,-pf(d))}else if(v==='superhero'||v==='hero')H.push(a);else if(v==='civilian')N++});
  P.sort(function(x,y){return pf(x.d7)-pf(y.d7)});H.sort(function(x,y){return pf(y.d7)-pf(x.d7)});
  var mins=[];(DATA.ads||[]).forEach(function(a){var b=a.sb||{};if(b.min&&mins.indexOf(a.campaign)<0)mins.push(a.campaign)});
  var li=function(a){var d=a.d7||{};return '<li><b>'+esc(shortnTxt(a.name))+'</b> <span class="mut">'+esc(a.adset)+'</span> &middot; '+money(d.sp||0)+' spent &middot; ROAS '+(d.sp?(d.rev/d.sp).toFixed(2):'0')+' &middot; '+(pf(d)>=0?'+'+money(pf(d))+' profit':'&minus;'+money(-pf(d))+' lost')+'</li>'};
  var h='<div class="mb-dh2">&#9989; Do this now</div><ol class="mb-dol">';
  h+=P.length?'<li class="bad"><b>Pause '+P.length+' losing ad'+(P.length>1?'s':'')+'</b> (about '+money(lost)+' lost in 7 days). Open each one with its Open &#8599; button and switch it off, or ask Claude. Pause the AD only, never the ad set or campaign.<ul>'+P.slice(0,8).map(li).join('')+'</ul></li>':'<li class="good"><b>Nothing to pause.</b> No live ad is losing enough money.</li>';
  if(mins.length)h+='<li class="bad"><b>Minimum spend is set in: '+mins.map(esc).join(', ')+'.</b> It forces Meta to spend on an ad set even when it is losing. Ask Claude to remove it.</li>';
  h+=H.length?'<li class="good"><b>'+H.length+' ad'+(H.length>1?'s are':' is')+' making money: leave '+(H.length>1?'them':'it')+' on.</b> To give winners more budget, raise it by 20% at most, once a day. Ask Claude first.<ul>'+H.slice(0,5).map(li).join('')+'</ul></li>':'';
  h+='<li><b>Leave the other '+N+' ads alone.</b> Each has spent under $'+S.minspend+', which is too early to tell.</li></ol>';
  var dn=document.getElementById('mb-donow');if(dn)dn.innerHTML=h;
  var pu=DATA.pulled?new Date(DATA.pulled):null,m=pu?Math.round((Date.now()-pu.getTime())/6e4):0;
  document.getElementById('mb-old').innerHTML=m>60?'<div class="mb-oldb">&#128308; These numbers are '+(m>=120?Math.floor(m/60)+' hours':m+' minutes')+' old (pulled '+esc(DATA.pulled.replace('T',' ').slice(0,16))+'). The automatic update failed. Press Refresh now at the top before you decide anything.</div>':''}
function shortnTxt(n){return String(n||'').replace(/^BF26_(LIVE|LAST|HYPE|ALL)_NOV_BFCM_/,'').replace(/_/g,' ')}
// 28/11/2026 (Quan): keep the EE names, add what to do in plain words + money made or lost underneath
function pf(d){return d&&d.sp?d.rev*S.margin/100-d.sp:0}
function pfTxt(d){var p=pf(d);if(!d||!d.sp)return '';return '<small class="mb-pf '+(p>=0?'good':'bad')+'" title="Sales value x '+S.margin+'% gross margin, minus ad spend. Last 7 days. Rough guide only">'+(p>=0?'+'+money(p)+' profit':'&minus;'+money(-p)+' lost')+' (7d)</small>'}
function actOf(v,a){if(isR(a))return '<small class="mb-do mb-do-civ">Reach ad: judged on reach</small>';var M={supervillain:['bad','&#128308; Pause now'],villain:['bad','&#128308; Pause'],sidekick:['warn','&#128993; Keep, watch'],hero:['good','&#128994; Keep'],superhero:['good','&#128994; Keep, give more budget'],civilian:['civ','&#9898; Too early to tell']},m=M[v[0]]||['civ',''];return '<small class="mb-do mb-do-'+m[0]+'">'+m[1]+'</small>'+(a.paused?'':pfTxt(a.d7))}
function cls(a){if(/^#HYPE/.test(a.campaign||''))return['civilian','&#128227; Reach','Reach campaign: judged on reach and frequency, not sales. Never auto-paused'];var d=a.d7,d3=a.d3,sp=d?d.sp:0,r7=d&&d.sp?d.rev/d.sp:null;
  var fast=d3&&d3.sp>=S.fastspend&&d3.rev/d3.sp<S.villroas;
  if(sp>=S.superspend&&r7<S.villroas)return['supervillain','&#128128; Supervillain','$'+Math.round(sp)+' spent in 7 days at ROAS '+r7.toFixed(2)+'. Pause now. An ad should never get this far'];
  if(sp>=S.minspend&&r7<S.villroas)return['villain','&#129465; Villain','$'+Math.round(sp)+' spent in 7 days at ROAS '+r7.toFixed(2)+'. Pause'];
  if(fast)return['villain','&#129465; Villain','Fast loser: $'+Math.round(d3.sp)+' spent in 3 days at ROAS '+(d3.rev/d3.sp).toFixed(2)+'. Pause'];
  if(sp<S.minspend)return['civilian','&#128118; Civilian','Under $'+S.minspend+' spent in 7 days: too early to judge'];
  if(sp>=S.superspend&&r7>=S.superroas&&d.pc>=5)return['superhero','&#129464; Superhero','$'+Math.round(sp)+' spent, ROAS '+r7.toFixed(2)+', '+d.pc+' sales. Never paused. First in line for more budget'];
  if(r7>=S.roasbe)return['hero','&#11088; Hero','ROAS '+r7.toFixed(2)+' is at or above break-even '+S.roasbe+'. Never paused'];
  return['sidekick','&#129309; Sidekick','ROAS '+r7.toFixed(2)+' is between '+S.villroas+' and '+S.roasbe+'. Stays on and is watched']}
function landing(l,k,nm){if(k&&(k.st===0||k.st>=400))return '<a class="pill pill-bad mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="The page did not open (status '+k.st+')">&#9888; Broken link</a>';
  if(k&&k.soldout===true)return '<a class="pill pill-bad mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="Shopify says this product is sold out">&#9888; Sold out</a>';
  if(!l)return '<span class="mut" title="Link not readable from Meta">?</span>';var p='/';try{p=new URL(l).pathname||'/'}catch(e){}
  var lab,cls;if(/%C2%AE|\\u00ae/i.test(l)){lab='&#9888; &reg; link';cls='pill-bad'}
  else if(p.replace(/\\//g,'')===''){lab='Home page';cls='pill-none'}
  else if(p.indexOf('/products/')===0&&p.indexOf('system')>-1){lab='Kit PDP';cls='pill-good'}
  else if(p.indexOf('/products/')===0){lab='Single product';cls='pill-mid'}
  else if(p.indexOf('/pages/')===0){if(nm&&!/editorial/i.test(nm)){lab='&#9888; Wrong page: article';cls='pill-bad';p+=' | Only editorial ads go to article pages (Quan 12/11). Pause and rebuild to the product page.'}else{lab='Article';cls='pill-mid'}}else{lab='Other';cls='pill-none'}
  if(k&&k.redir){lab+=' &#8618;';p+=' redirects to '+k.redir}
  return '<a class="pill '+cls+' mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="'+esc(p)+'">'+lab+'</a>'}
function agg(rows){var t={sp:0,rev:0,pc:0};rows.forEach(function(a){if(a.d7){t.sp+=a.d7.sp;t.rev+=a.d7.rev;t.pc+=a.d7.pc}});return t}
function sp7(a){return a.d7?a.d7.sp:0}
function aggk(rows,k){var t={sp:0,rev:0,pc:0};rows.forEach(function(a){var d=a[k];if(d){t.sp+=d.sp;t.rev+=d.rev;t.pc+=d.pc}});return t}
function lossOf(rows){var t=agg(rows);return t.sp-t.rev}
function rp(r){return '<span class="pill '+(r>=S.roasbe?'pill-good':(r>=1?'pill-mid':'pill-bad'))+'">'+r.toFixed(2)+'x</span>'}
function stat(l,v,t,big){return '<span class="mb-st'+(big?' mb-big':'')+'"'+(t?' title="'+esc(t)+'"':'')+'><small>'+l+'</small><b>'+v+'</b></span>'}
function isR(a){return /^#HYPE/.test((a&&a.campaign)||'')}
function ncOf(name,cid){if(!NEWC||!NEWC.camps)return null;var t=0;Object.keys(NEWC.camps).forEach(function(k){if(k===name||(cid&&k===cid))t+=NEWC.camps[k].new});return t}
function nf(n){return (n||0).toLocaleString()}
function per1k(x){return x&&x.reach?money(x.sp/x.reach*1000):'&mdash;'}
function rline(l,x){if(!x||!x.sp)return '<b>'+l+':</b> $0';return '<b>'+l+':</b> '+nf(x.reach)+' people &middot; '+money(x.sp)+' &middot; '+per1k(x)+' per 1,000 people'}
function rstrip(a){return '<span class="mb-reach">&#128101; '+rline('Today',a.d0)+'<br>&#128101; '+rline('Last 7 days',a.d7)+(a.d7&&a.d7.lpv?' &middot; '+a.d7.lpv+' website visits ('+money(a.d7.sp/a.d7.lpv)+' each)':'')+'</span>'}
function near(a,v){var d=a.d7,d3=a.d3;if(isR(a))return '';if(!d||!d.sp)return '';
  if(v==='sidekick'){var r=d.rev/d.sp;return r<S.villroas+0.15?'Close to Villain: ROAS '+r.toFixed(2)+', Villain is under '+S.villroas.toFixed(2):''}
  if(v!=='civilian')return '';var g=[];if(d.rev/d.sp<S.villroas)g.push(S.minspend-d.sp);
  if(d3&&d3.sp&&d3.rev/d3.sp<S.villroas)g.push(S.fastspend-d3.sp);if(!g.length)return '';
  var m=Math.max(0,Math.min.apply(null,g));return m<=60?'$'+Math.round(m)+' more spend at this ROAS = Villain':''}
function shortn(n){return esc(n.replace(/^B[0-9]+_[A-Z]+_(NOV_)?(BAU_|100YRS_)?/,'').replace(/_/g,' ').slice(0,58))}
function render(){
  var T=thr(),h='';
  ['TOF','TOM','MOF'].forEach(function(k){h+='<span><b>'+k+'</b><span class="mb-g">&lt; '+money(T[k][0])+'</span> | <span class="mb-a">'+money(T[k][0])+' &ndash; '+money(T[k][1])+'</span> | <span class="mb-r">&gt; '+money(T[k][1])+'</span></span>'});
  document.getElementById('mb-thr').innerHTML='<b>CPP thresholds</b>'+h;
  var bn=document.getElementById('mb-banner'),a3=S.mer3>S.mer,a30=S.mer30>S.mer,sub='Ideal MER: '+S.mer.toFixed(1)+'% &middot; 3-day: '+S.mer3.toFixed(1)+'% &middot; last 30 days: '+S.mer30.toFixed(1)+'%';
  if(a3&&a30){bn.className='mb-banner down';bn.innerHTML='Scale down total spend by 10-20%<small>Both 3-day and 30-day MER are above ideal. '+sub+'</small>'}
  else if(!a3&&!a30){bn.className='mb-banner up';bn.innerHTML='MER is at or below ideal: there is room to raise spend<small>'+sub+'. Spend increases still need Quan\\'s yes.</small>'}
  else{bn.className='mb-banner hold';bn.innerHTML='Hold total spend<small>3-day and 30-day MER disagree. '+sub+'</small>'}
  var camps={},order=[];DATA.ads.forEach(function(a){if(!camps[a.campaign]){camps[a.campaign]={};order.push(a.campaign)}(camps[a.campaign][a.adset]=camps[a.campaign][a.adset]||[]).push(a)});
  NC=less?18:21;document.querySelector('.mb-table').classList.toggle('mb-less',less);
  var PS={},SETS=DATA.sets||{};(DATA.paused||[]).forEach(function(a){(PS[a.sid]=PS[a.sid]||[]).push(a)});
  function rowHtml(a,v,nr,stg,sc,hide){var d=a.d7,base=cpp(d),isH=!!HID[a.id];
    var img=a.src?'<img class="th mb-th" src="'+a.src+'" decoding="async" alt="">':'<span class="th mb-th th-empty"></span>';
    var days=a.created_time?Math.floor((now-new Date(a.created_time).getTime())/864e5):null;
    return '<tr class="mb-ad'+(hide?' mb-hid':'')+(a.paused?' mb-paused':'')+(isH?' mb-ishid':'')+'" data-s="'+esc((a.name+' '+a.campaign+' '+a.adset).toLowerCase())+'" data-v="'+v[0]+'" style="--sc:'+sc+(filt&&filt!==v[0]?';display:none':'')+'">'
    +'<td class="adtd"><div class="adc">'+img+'<span class="adname">'+esc(a.name)+(a.video?' <span class="mb-vid">VIDEO</span>':'')+(nr?'<span class="mb-near">&#9888; '+esc(nr)+'</span>':'')+(isR(a)?rstrip(a):'')+'</span></div></td>'
    +'<td class="c"><span class="mbv mbv-'+v[0]+'" title="'+esc(v[2])+'"><i></i>'+v[1].replace(/^&#[0-9]+; /,'')+'</span>'+actOf(v,a)+(a.paused?' <span class="mbv mbv-paused" title="This ad is paused in Meta. It is listed because it spent money in the last 7 days"><i></i>Paused</span>':'')+'</td>'
    +'<td class="num">'+(d?money(d.sp):Z)+'</td><td class="num">'+(a.d0&&a.d0.sp?money(a.d0.sp):Z)+'</td><td class="num">'+(d?(d.pc||'<span class="mut">0</span>'):Z)+'</td>'
    +cppCell(a[CPPW],stg,CPPW==='d7'?undefined:base)+roasCell(d)+(a.d0&&a.d0.sp?roasCell(a.d0):'<td class="num">'+Z+'</td>')
    +'<td class="num">'+(d&&d.freq?d.freq.toFixed(2):Z)+'</td><td class="num">'+(d&&d.reach?nf(d.reach):Z)+'</td><td class="num">'+(d&&d.imp?d.ctr.toFixed(2)+'%':Z)+'</td><td class="num">'+(d&&d.lc?money(d.sp/d.lc):Z)+'</td><td class="num">'+(d&&d.imp?money(d.cpm):Z)+'</td>'
    +'<td class="num">'+(d&&a.video&&d.v3?pct(d.v3,d.imp):Z)+'</td><td class="num">'+(d&&d.atc?money(d.sp/d.atc):Z)+'</td><td class="num">'+(d?pct(d.atc,d.lpv):Z)+'</td><td class="num">'+(d&&d.atc?pct(d.pc,d.atc):Z)+'</td><td class="num">'+(d?pct(d.ic,d.lpv):Z)+'</td>'
    +'<td class="num">'+(days===null||isNaN(days)?Z:days)+'</td><td class="c">'+landing(a.link,a.lk,a.name)+'</td>'
    +'<td class="c mb-acts"><a class="wlink" href="https://adsmanager.facebook.com/adsmanager/manage/ads?act='+ACT+'&selected_ad_ids='+a.id+'" target="_blank" rel="noopener">Open &#8599;</a>'
    +'<button class="mb-hide" data-id="'+a.id+'" title="'+(isH?'Show this ad on this page again':'Remove this ad from this page only. Nothing changes in Meta')+'">'+(isH?'Unhide':'Hide')+'</button></td></tr>'}
  // 28/11/2026 (Quan): campaign bar says how the campaign is set up: budget type, bid, minimum spends, caps
  // 28/11/2026 (Quan): what to do in THIS ad set, right on the ad set card
  function setDo(rows){if(isR(rows[0]))return '';var P=[],H=[],N=0;rows.forEach(function(a){var v=cls(a)[0];if(v==='villain'||v==='supervillain')P.push(a);else if(v==='hero'||v==='superhero')H.push(a);else if(v==='civilian')N++});
    var nm=function(a){var p=pf(a.d7);return '<b>'+esc(shortnTxt(a.name))+'</b> ('+(p>=0?'+'+money(p)+' profit':'&minus;'+money(-p)+' lost')+')'},h='';
    if(P.length)h+='<div class="mb-sdo bad">&#128308; <b>Do this now: pause '+P.length+' ad'+(P.length>1?'s':'')+'</b>: '+P.map(nm).join(', ')+'. Use its Open &#8599; button, or ask Claude. Pause the ad only, never this ad set.</div>';
    if(H.length)h+='<div class="mb-sdo good">&#128994; <b>Making money, leave on</b>: '+H.map(nm).join(', ')+'. More budget? Ask Claude (20% at most, once a day).</div>';
    if(!P.length&&!H.length)h+='<div class="mb-sdo civ">&#9898; <b>Nothing to do here.</b> '+(N?N+' ad'+(N>1?'s are':' is')+' under $'+S.minspend+' spent: too early to tell.':'Leave it alone.')+'</div>';
    return h}
  function dayLine(sets){var t={sp:0,rev:0,pc:0},y={sp:0,rev:0,pc:0};Object.keys(sets).forEach(function(k){var Q=SETS[sets[k][0].sid]||{},a=Q.d0||aggk(sets[k],'d0'),b=Q.d1||aggk(sets[k],'d1');t.sp+=a.sp||0;t.rev+=a.rev||0;t.pc+=a.pc||0;y.sp+=b.sp||0;y.rev+=b.rev||0;y.pc+=b.pc||0});
    var f=function(l,q){return '<b>'+l+':</b> '+money(q.sp)+' spent &middot; '+q.pc+' sale'+(q.pc===1?'':'s')+' &middot; ROAS '+rp(q.sp?q.rev/q.sp:0)};return '<div class="mb-who">&#128197; '+f('Today',t)+' &nbsp;|&nbsp; '+f('Yesterday',y)+'</div>'}
  function whoOf(cn){var t;if(/^#HYPE/.test(cn))t='Reach ads: show the sale to as many people as possible. Judged on people reached, not sales';
    else if(/BOF|Past buyers/i.test(cn))t='Past buyers: people who already bought from LACALUT before';
    else if(/MOF|Warm/i.test(cn))t='Warm: people who visited the website or engaged with our ads, but never bought';
    else if(/TOM/i.test(cn))t='Everyone except past buyers: new people plus people who have seen us before';
    else if(/TOF|New people|Broad/i.test(cn))t='Cold: new people who have probably never heard of LACALUT';
    return t?'<div class="mb-who">&#128101; Who sees these ads: '+t+'</div>':''}
  function setupOf(sets){var ks=Object.keys(sets),f=sets[ks[0]][0].sb||{},mins=[],caps=[],abo=0,parts=[];
    ks.forEach(function(k){var b=sets[k][0].sb||{};if(b.min)mins.push(b.min);if(b.cap)caps.push(b.cap);abo+=b.bud||0});
    var BS={LOWEST_COST_WITHOUT_CAP:'Highest volume (no cap)',COST_CAP:'Cost cap',LOWEST_COST_WITH_BID_CAP:'Bid cap',LOWEST_COST_WITH_MIN_ROAS:'Min ROAS'};
    var OB={OUTCOME_SALES:'Sales',OUTCOME_AWARENESS:'Reach',OUTCOME_TRAFFIC:'Traffic',OUTCOME_ENGAGEMENT:'Engagement'};
    parts.push(f.cbud?'<b>Campaign budget '+money(f.cbud)+'/day</b> shared by '+ks.length+' ad set'+(ks.length>1?'s':''):'<b>Ad set budgets '+money(abo)+'/day</b> in total');
    if(f.obj)parts.push('Goal: '+(OB[f.obj]||esc(f.obj)));
    if(f.bs)parts.push('Bid: '+(BS[f.bs]||esc(f.bs))+(f.bamt?' '+money(f.bamt):''));
    var sum=function(x){return x.reduce(function(p,q){return p+q},0)};
    parts.push(mins.length?'<span class="mb-flag bad">&#9888; Minimum spend on '+mins.length+' ad set'+(mins.length>1?'s':'')+': '+money(sum(mins))+'/day forced. Do this now: ask Claude to remove it</span>':(f.cbud?'<span class="mb-flag good">&#10003; No minimum spends</span>':''));
    if(caps.length)parts.push('<span class="mb-flag warn">Spend cap on '+caps.length+' ad set'+(caps.length>1?'s':'')+'</span>');
    return '<span class="mb-setl">&#9881;&#65039; How it is set up: '+parts.filter(Boolean).join(' &middot; ')+'</span>'}
  // 28/11/2026 (Quan): every ad set gets its own column-name row above its numbers
  var HL=[].map.call(document.querySelectorAll('.mb-table thead tr:first-child th'),function(th){var c=th.cloneNode(true);[].forEach.call(c.querySelectorAll('select'),function(x){x.remove()});var t=c.textContent.trim();return t==='CPP'?'CPP '+({d0:'today',d1:'yest.',d3:'3 days',d7:'7 days'})[CPPW]:t});
  var TG={'CTR link':['up',1.2,0.8,'good: 1.2% or more'],'CPC link':['down',4.5,6,'good: $4.50 or less'],'$ / cart':['down',5,10,'good: $5 or less'],'Cart → buy':['up',10,5,'good: 10% or more'],'Freq':['down',2.5,3.5,'good: under 2.5'],'Hook':['up',25,15,'good: 25% or more']};
  function shRow(sc){return '<tr class="mb-ad mb-sh" style="--sc:'+sc+'">'+HL.map(function(t,i){var g=TG[t];return '<td class="'+(i<2?'':'num')+'">'+esc(t)+(g?'<small class="mb-tg">'+g[3]+'</small>':'')+'</td>'}).join('')+'</tr>'}
  function paint(){[].forEach.call(document.querySelectorAll('#mb-body tr.mb-ad:not(.mb-sh):not(.mb-tot)'),function(tr){[].forEach.call(tr.children,function(td,i){var g=TG[HL[i]];if(!g)return;var v=parseFloat((td.textContent||'').replace(/[$,%]/g,''));if(isNaN(v))return;
    var good=g[0]==='up'?v>=g[1]:v<=g[1],bad=g[0]==='up'?v<g[2]:v>g[2];td.classList.add(good?'mb-g':(bad?'mb-b':'mb-w'));td.title=HL[i]+': '+g[3]})})}
  order.sort(function(x,y){var i=CORD.indexOf(x),j=CORD.indexOf(y);if(i<0)i=1e3+(/^BF #/.test(x)?0:1);if(j<0)j=1e3+(/^BF #/.test(y)?0:1);return i-j||(x<y?-1:x>y?1:0)});LASTORD=order.slice();var body='',cards='',cnt={supervillain:0,villain:0,sidekick:0,civilian:0,hero:0,superhero:0},now=Date.now(),nearL=[],heroL=[],villL=[];
  order.forEach(function(cn){var sets=camps[cn],all=[];Object.keys(sets).forEach(function(k){all=all.concat(sets[k])});
    var ct={sp:0,rev:0,pc:0};Object.keys(sets).forEach(function(k){var t=(SETS[sets[k][0].sid]||{}).d7||agg(sets[k]);ct.sp+=t.sp;ct.rev+=t.rev;ct.pc+=t.pc});var cr=ct.sp?ct.rev/ct.sp:0;
    cards+='<div class="kpi"><div class="lbl">'+esc(cn.split(' (')[0])+'</div><div class="val">'+cr.toFixed(2)+'x <span class="mb-chip '+(cr>=S.roasbe?'good':(cr>=1?'warn':'bad'))+'"><i></i>'+(cr>=S.roasbe?'At or above break-even':(cr>=1?'Under break-even '+S.roasbe.toFixed(2):'ROAS under 1.0'))+'</span></div><div class="mb-sub">'+money(ct.sp)+' spend &middot; '+ct.pc+' sales &middot; CPP '+(ct.pc?money(ct.sp/ct.pc):'&mdash;')+' &middot; 7 days</div></div>';
    var b0=body.length,fn=(/_(TOF|TOM|MOF)_/.exec(cn)||['','x'])[1].toLowerCase();
    body+='<tr class="mb-gap mb-gap-big"><td colspan="'+NC+'"></td></tr><tr class="mb-camp"><td colspan="'+NC+'">'+'<div class="mb-crow"><span class="mb-cn">'+esc(cn)+'</span><span class="mb-ord"><button class="mb-ob" data-o="top" data-c="'+esc(cn)+'" title="Move this campaign to the top of the page">&#9195; Top</button><button class="mb-ob" data-o="up" data-c="'+esc(cn)+'" title="Move this campaign up one place">&#9650;</button><button class="mb-ob" data-o="down" data-c="'+esc(cn)+'" title="Move this campaign down one place">&#9660;</button></span><span class="mb-cm">'+(isR(all[0])?(function(){var m={sp:0,reach:0},t={sp:0,reach:0};Object.keys(sets).forEach(function(k){var Q=SETS[sets[k][0].sid]||{};if(Q.dm){m.sp+=Q.dm.sp;m.reach+=Q.dm.reach}if(Q.d0){t.sp+=Q.d0.sp;t.reach+=Q.d0.reach}});return all.length+' live ads &middot; <b>'+nf(m.reach)+' people reached since launch</b> for '+money(m.sp)+' ('+per1k(m)+' per 1,000) &middot; today: '+nf(t.reach)+' people for '+money(t.sp)})():all.length+' live ads &middot; <b>Last 7 days:</b> '+money(ct.sp)+' spent &middot; '+ct.pc+' sales &middot; ROAS '+rp(cr)+(function(){var n=ncOf(cn,all[0].cid),t0=0;Object.keys(sets).forEach(function(k){var Q=(SETS[sets[k][0].sid]||{}).d0||aggk(sets[k],'d0');t0+=Q.sp||0});if(n===null)return '';return ' &middot; <b title="Shopify orders today from first-time customers whose last click was this campaign. Last click only, so the real number is higher">today: '+n+' new customer'+(n===1?'':'s')+(n?' at '+money(t0/n)+' each':' for '+money(t0))+'</b>'})())+'</span></div><div class="mb-setupw">'+dayLine(sets)+whoOf(cn)+setupOf(sets)+'</div></td></tr>';
    Object.keys(sets).sort(function(x,y){return lossOf(sets[y])-lossOf(sets[x])}).forEach(function(sn){
      var rows=sets[sn].slice().sort(function(x,y){return sp7(y)-sp7(x)}),TS=SETS[rows[0].sid]||{},st=TS.d7||agg(rows),sf=rows[0].sfreq||0,stg=stage(sf);
      var s3=TS.d3||aggk(rows,'d3'),s1=TS.d1||aggk(rows,'d1'),s0=TS.d0||aggk(rows,'d0'),sb=rows[0].sb||{},r7s=st.sp?st.rev/st.sp:null;
      var sc=st.sp<50?'#adb5bd':(r7s>=S.roasbe?'#2f9e44':(r7s>=1?'#f08c00':'#e03131'));
      var bud=sb.bud?stat('Daily budget',money(sb.bud)+' / day','The most this ad set can spend each day',1):(sb.cbud?stat('Daily budget','shares '+money(sb.cbud)+' / day','Campaign budget: Meta splits it across the ad sets in this campaign',1)+(sb.min?stat('Minimum spend',money(sb.min)+' / day','Meta must spend at least this much on this ad set each day'):''):'');
      var info=bud+(sb.floor?stat('Min ROAS floor',sb.floor.toFixed(2),'Meta only spends when it expects at least this ROAS'):'')
        +stat('Spent yesterday',s1.sp?money(s1.sp):'$0','Whole ad set, straight from Meta. Includes ads that are paused now')+stat('ROAS 3 days',s3.sp?rp(s3.rev/s3.sp):Z)
        +stat('Acting like',stg,'From the ad set frequency and the Setup boundaries')+(sb.learn?stat('Learning',({LEARNING:'Still learning',SUCCESS:'Finished',FAIL:'Learning limited'})[sb.learn]||esc(sb.learn)):'')+stat('Live ads',rows.length);
      if(isR(rows[0])){var dm=TS.dm||{},d0=TS.d0||{};sc='#5c7cfa';info=bud+stat('People reached since launch',nf(dm.reach),'Unique people who saw an ad in this ad set this month (Hype started 25/11)',1)+stat('Reached today',nf(d0.reach)+' &middot; '+money(d0.sp||0),'Unique people reached today, and spend today')+stat('Reached yesterday',nf(s1.reach)+' &middot; '+money(s1.sp||0))+stat('Cost per 1,000 people',per1k(dm))+stat('Views per person',(dm.freq||0).toFixed(2),'Cap is 2 views per 7 days')+stat('Website visits',nf(dm.lpv)+(dm.lpv?' &middot; '+money(dm.sp/dm.lpv)+' each':''))+stat('Live ads',rows.length)}
      body+='<tr class="mb-gap"><td colspan="'+NC+'"></td></tr><tr class="mb-set" style="--sc:'+sc+'"><td colspan="'+NC+'"><div class="mb-in"><div class="mb-sname">'+esc(sn)+(sb.learn==='LEARNING'?' <span class="mb-lrn" title="Meta is still learning who buys. Adding an ad, editing an ad or a big budget change starts the learning again">&#127891; Learning: do not add or edit ads here</span>':(sb.learn==='FAIL'?' <span class="mb-lrn lim" title="Not enough sales for Meta to finish learning">Learning limited</span>':''))+'</div><div class="mb-stats">'+info+'</div>'+setDo(rows)+'</div></td></tr>';
      body+=shRow(sc);
      body+='<tr class="mb-ad mb-tot" style="--sc:'+sc+'"><td class="adtd">Ad set total, last 7 days (includes paused ads)</td><td></td><td class="num">'+money(st.sp)+'</td><td class="num">'+(s0.sp?money(s0.sp):'$0')+'</td><td class="num">'+st.pc+'</td>'+cppCell(({d7:st,d3:s3,d1:s1,d0:s0})[CPPW],stg,CPPW==='d7'?undefined:cpp(st))+roasCell(st)+(s0.sp?roasCell(s0):'<td></td>')+'<td class="num">'+sf.toFixed(2)+'</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      var key=cn+'|'+sn,pk=key+'|P';
      rows.forEach(function(a){var v=cls(a),nr=near(a,v[0]),d=a.d7,r7a=d&&d.sp?d.rev/d.sp:0;cnt[v[0]]++;
        if(nr)nearL.push('<span class="mb-ti warn" title="'+esc(a.adset)+'">'+shortn(a.name)+' &middot; '+esc(nr)+'</span>');
        if(v[0]==='hero'||v[0]==='superhero')heroL.push('<span class="mb-ti good" title="'+esc(a.adset)+'">'+shortn(a.name)+' &middot; '+money(d.sp)+' &middot; ROAS '+r7a.toFixed(2)+'</span>');
        if(v[0]==='villain'||v[0]==='supervillain')villL.push('<span class="mb-ti bad" title="'+esc(a.adset)+'">'+shortn(a.name)+' &middot; '+money(d.sp)+' &middot; ROAS '+r7a.toFixed(2)+'</span>')});
      var vis=rows.filter(function(a){return showHid||!HID[a.id]}),cl=vis.map(function(a){return cls(a)}),nrs=vis.map(function(a,i){return near(a,cl[i][0])}),hid=0;
      vis.forEach(function(a,i){if(i>=2&&cl[i][0]==='civilian'&&!nrs[i])hid++});var fold=hid>0&&!filt;
      vis.forEach(function(a,ri){var v=cl[ri],nr=nrs[ri];body+=rowHtml(a,v,nr,stg,sc,fold&&!openSets[key]&&ri>=2&&v[0]==='civilian'&&!nr)});
      var ps=filt?[]:(PS[rows[0].sid]||[]).filter(function(a){return showHid||!HID[a.id]}).sort(function(x,y){return sp7(y)-sp7(x)});
      if(openSets[pk])ps.forEach(function(a){body+=rowHtml(a,cls(a),'',stg,sc,false)});
      var foot='';
      if(fold)foot+='<button class="mb-morebtn" data-k="'+esc(key)+'">'+(openSets[key]?'&#9652; Hide '+hid+' Civilian ad'+(hid>1?'s':''):'&#9662; Show '+hid+' more Civilian ad'+(hid>1?'s':'')+' (each under $'+S.minspend+' spend in 7 days: too early to judge)')+'</button>';
      if(ps.length)foot+='<button class="mb-morebtn" data-k="'+esc(pk)+'">'+(openSets[pk]?'&#9652; Hide '+ps.length+' paused ad'+(ps.length>1?'s':''):'&#9662; Show '+ps.length+' paused ad'+(ps.length>1?'s':'')+' (spent money in the last 7 days)')+'</button>';
      if(foot)body+='<tr class="mb-more mb-last" style="--sc:'+sc+'"><td colspan="'+NC+'"><div class="mb-in mb-foots">'+foot+'</div></td></tr>';
      else body+='<tr class="mb-more mb-foot" style="--sc:'+sc+'"><td colspan="'+NC+'"><div class="mb-in"></div></td></tr>'});body+='<tr class="mb-cend"><td colspan="'+NC+'"></td></tr>';body=body.slice(0,b0)+body.slice(b0).replace(/<tr class="/g,'<tr class="fn-'+fn+' ')});
  var none='<span class="mut">None</span>',acts=ACTS.length?ACTS.map(function(x){return '<span class="mb-ti">'+esc(x)+'</span>'}).join(''):'<span class="mut">Nothing paused or cut in the last 24 hours</span>';
  var tp=function(c,t,n,b){return '<div class="mb-tp '+c+'"><div class="mb-tph"><i></i><b>'+t+'</b><span>'+n+'</span></div><div class="mb-tpb">'+b+'</div></div>'};
  document.getElementById('mb-today').innerHTML='<details class="mb-chg"><summary>&#128221; Changes in the last 24 hours ('+ACTS.length+') &middot; click to open</summary>'+tp('info','Changes in the last 24 hours',ACTS.length,acts)+'</details>';/* 28/11 Quan: pause/keep lists now live on each ad set card */
  var tot=agg(DATA.ads),trs=tot.sp?tot.rev/tot.sp:0;
  var mchip=function(v){return v<=S.mer?'<span class="mb-chip good"><i></i>At or under ideal</span>':'<span class="mb-chip '+(v<=2*S.mer?'warn':'bad')+'"><i></i>'+(v/S.mer).toFixed(1)+'x the ideal</span>'};
  var ht=function(l,v,x,sx){return '<div class="mb-h"><small>'+l+'</small><b>'+v+'</b>'+(x||'')+'<em>'+sx+'</em></div>'};
  var nch='';if(NEWC&&NEWC.new){var nn=NEWC.new.orders,nr=NEWC.ret.orders,day=(AUTO&&AUTO.days||[]).filter(function(x){return x.d===NEWC.d})[0],msp=day?day.spend:0;nch=ht('New customers today',nn+' <small style="font-size:13px">of '+(nn+nr)+' orders ('+(nn+nr?Math.round(100*nn/(nn+nr)):0)+'%)</small>',msp&&nn?'<span class="mb-chip '+(msp/nn<=S.aov*0.5?'good':(msp/nn<=S.aov?'warn':'bad'))+'"><i></i>'+money(msp/nn)+' Meta spend per new customer</span>':'','Shopify, first-time buyers, pulled '+NEWC.pulled+'. Meta spend today / new customers (Google not included)')}
  document.getElementById('mb-hero').innerHTML=nch+ht('MER, last 3 days',S.mer3.toFixed(1)+'%',mchip(S.mer3),'Ad spend as a share of sales. Ideal is '+S.mer.toFixed(1)+'%')
    +ht('MER, last 30 days',S.mer30.toFixed(1)+'%',mchip(S.mer30),'Ideal is '+S.mer.toFixed(1)+'%')
    +ht('Spend, last 7 days',money(tot.sp),'','Live ads only')
    +ht('Sales value, last 7 days',money(tot.rev),'',tot.pc+' sales, as counted by Meta')
    +ht('ROAS, last 7 days',trs.toFixed(2)+'x','<span class="mb-chip '+(trs>=S.roasbe?'good':(trs>=1?'warn':'bad'))+'"><i></i>'+(trs>=S.roasbe?'At or above break-even':'Under break-even')+'</span>','Break-even is '+S.roasbe.toFixed(2))
    +ht('Live ads',DATA.ads.length,'',(cnt.villain+cnt.supervillain)+' Villains &middot; '+(cnt.hero+cnt.superhero)+' Heroes &middot; '+nearL.length+' close to Villain');
  document.getElementById('mb-body').innerHTML=body;paint();doNow();(function(){function f(){var th=document.querySelector('.mb-table thead');if(!th)return;var h=0;[].forEach.call(th.rows,function(r){h+=r.offsetHeight});if(h)document.getElementById('mb').style.setProperty('--hh',h+'px')}f();setTimeout(f,300);setTimeout(f,1500);window.addEventListener('resize',f)})();document.getElementById('mb-kpis').innerHTML=cards;
  var ch='';[['','All live ads',DATA.ads.length],['supervillain','&#128128; Supervillain',cnt.supervillain],['villain','&#129465; Villain',cnt.villain],['sidekick','&#129309; Sidekick',cnt.sidekick],['hero','&#11088; Hero',cnt.hero],['superhero','&#129464; Superhero',cnt.superhero],['civilian','&#128118; Civilian',cnt.civilian]].forEach(function(c){ch+='<button class="mbf" data-f="'+c[0]+'" aria-pressed="'+(filt===c[0])+'">'+(c[0]?'<i class="mbd mbd-'+c[0]+'"></i>':'')+c[1].replace(/^&#[0-9]+; /,'')+'<span class="tcount">'+c[2]+'</span></button>'});
  ch+='<span class="mb-legend"><span><i style="background:#d6246e"></i>TOF campaign (cold)</span><span><i style="background:#b45309"></i>TOM campaign (warmer)</span><span><i style="background:#15803d"></i>MOF campaign (warmest)</span></span>';
  var nH=0;DATA.ads.concat(DATA.paused||[]).forEach(function(a){if(HID[a.id])nH++});
  if(nH)ch+='<button class="mbf" id="mb-hidbtn" title="Ads you removed from this page with the Hide button">'+(showHid?'Stop showing hidden ads':'Show hidden ads')+'<span class="tcount">'+nH+'</span></button>';
  ch+='<button class="mbf mb-colbtn" id="mb-cols" title="Beginner view hides Reach, CPM, Hook, Checkout and Days live">'+(less?'&#128083; Expert view (all columns)':'&#128118; Beginner view (fewer columns)')+'</button>';
  var box=document.getElementById('mb-chips');box.innerHTML=ch;
  [].forEach.call(box.querySelectorAll('.mbf[data-f]'),function(b){b.addEventListener('click',function(){filt=b.getAttribute('data-f');render()})});
  var hb=document.getElementById('mb-hidbtn');if(hb)hb.addEventListener('click',function(){showHid=!showHid;render()});
  var cw=document.getElementById('mb-cppw');if(cw&&!cw._b){cw._b=1;cw.value=CPPW;cw.addEventListener('change',function(){CPPW=cw.value;try{localStorage.setItem('lacalut_mb_cppw',CPPW)}catch(e){}render()})}
  document.getElementById('mb-cols').addEventListener('click',function(){less=!less;try{localStorage.setItem('lacalut_mb_less3',less?'1':'0')}catch(e){}render()});
}
load();fill();render();
document.getElementById('mb-body').addEventListener('click',function(e){var hb=e.target.closest?e.target.closest('.mb-hide'):null;
  if(hb){var id=hb.getAttribute('data-id');if(HID[id])delete HID[id];else HID[id]=1;try{localStorage.setItem(HKEY,JSON.stringify(HID))}catch(x){}render();return}
  var b=e.target.closest?e.target.closest('.mb-morebtn'):null;if(!b)return;var k=b.getAttribute('data-k');openSets[k]=!openSets[k];render()});
document.addEventListener('input',function(){var on=false,q=document.getElementById('fq');if(q&&q.value)on=true;
  [].forEach.call(document.querySelectorAll('#mb input[type=search]'),function(i){if(i.value)on=true});
  document.querySelector('.mb-table').classList.toggle('mb-searching',on)});
if(AUTO){var dm=function(x){return x.slice(8,10)+'/'+x.slice(5,7)};
  ['mer3','mer30'].forEach(function(k){document.getElementById('mb-'+k).disabled=true});
  [].forEach.call(document.querySelectorAll('.mb-auto'),function(e){e.textContent='Automatic: Meta spend ÷ Shopify retail sales incl. GST, full days to '+dm(AUTO.as_of)});
  if(AUTO.aov)document.getElementById('mb-aovnote').textContent='Shopify last 30 days: $'+AUTO.aov.toFixed(2)+' (type to override)';
  var mx=1;AUTO.days.forEach(function(x){if(x.mer!==null&&x.mer>mx)mx=x.mer});
  var h='<div class="mb-dh"><b>MER by day</b><span>Ideal '+S.mer.toFixed(1)+'% &middot; sales pulled '+AUTO.pulled+'</span></div><div class="mb-dbars">';
  AUTO.days.slice().reverse().forEach(function(x,i,arr){var c=x.mer===null?'none':(x.mer<=S.mer?'good':(x.mer<=2*S.mer?'warn':'bad'));
    h+='<div class="mb-dcol" title="$'+x.spend.toLocaleString()+' Meta spend, $'+x.sales.toLocaleString()+' sales"><span>'+(x.mer===null?'-':x.mer.toFixed(0)+'%')+'</span><i class="'+c+'" style="height:'+(x.mer===null?3:Math.max(3,Math.round(46*x.mer/mx)))+'px"></i><em>'+(i===arr.length-1?'Today':dm(x.d))+'</em></div>'});
  document.getElementById('mb-days').innerHTML=h+'</div>'}
IDS.forEach(function(k){document.getElementById('mb-'+k).addEventListener('change',function(e){var v=parseFloat(e.target.value);if(!isFinite(v))return;S[k]=v;
  if(k==='profit'||k==='fcr'||k==='margin'){S.mer=Math.max(0,S.margin-S.profit-S.fcr);document.getElementById('mb-mer').value=+S.mer.toFixed(2)}
  if(k==='mer'){S.margin=S.mer+S.profit+S.fcr;document.getElementById('mb-margin').value=+S.margin.toFixed(2)}
  save();render()})});
document.getElementById('mb-reset').addEventListener('click',function(){try{localStorage.removeItem(KEY)}catch(e){}load();fill();render()});
})();
</script>"""


def recent_actions(SP, hours=24):
    """Pauses, switch-ons and budget cuts from _auto_buyer.log in the last `hours`, newest first, plain English."""
    import re
    from datetime import datetime, timedelta
    out = []
    try:
        lines = open(os.path.join(SP, "_auto_buyer.log"), encoding="utf-8").read().splitlines()
    except Exception:
        return out
    since = datetime.now() - timedelta(hours=hours)
    for l in lines:
        m = re.match(r"([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}):[0-9]{2} +(.*)", l)
        if not m:
            continue
        t, txt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M"), m.group(2)
        if t < since or "FAILED" in txt:
            continue
        who = "Facy" if txt.startswith("MANUAL") else "Automatic"
        txt = re.sub(r"^MANUAL [(][^)]*[)] *", "", txt)
        m2 = re.match(r"(PAUSED|ACTIVE|CUT) +(.*)", txt)
        if not m2:
            continue
        verb = {"PAUSED": "Paused", "ACTIVE": "Switched back on", "CUT": "Budget cut"}[m2.group(1)]
        rest = re.sub(r"[0-9]{12,} *", "", m2.group(2)).replace("ok=True", "").replace("_", " ").strip(" |")
        out.append(f"{t:%d/%m %I:%M %p} · {who} · {verb}: {rest[:150]}")
    return out[::-1][:12]


def bf_html(SP):
    # 25/11/2026 (Quan): Black Friday 2026 campaigns block, live or paused. Reach = reach/CPM; Sales = ROAS/sales.
    p = os.path.join(SP, "bf.json")
    if not os.path.exists(p):
        return ""
    import html as _h
    d = json.load(open(p, encoding="utf-8"))
    m = lambda v: "${:,.0f}".format(v) if v >= 100 else "${:,.2f}".format(v)
    cards = ""
    for c in d.get("camps", []):
        reach = c.get("obj") == "OUTCOME_AWARENESS"
        on = c["live"] > 0 and c["st"] == "ACTIVE"
        chip = ('<span class="mb-chip good"><i></i>LIVE &middot; ' + str(c["live"]) + ' ads on</span>') if on else                ('<span class="mb-chip warn"><i></i>OFF &middot; ' + str(c["ads"]) + ' ads ready</span>' if c["ads"] else '<span class="mb-chip bad"><i></i>OFF &middot; no ads</span>')
        def line(lbl, x):
            if not x or not x.get("sp"):
                return '<div class="mb-sub">' + lbl + ': $0 spend</div>'
            if reach:
                return ('<div class="mb-sub">' + lbl + ': ' + m(x["sp"]) + ' &middot; ' + "{:,}".format(x["reach"]) + ' people reached &middot; CPM '
                        + m(x["cpm"]) + ' &middot; freq ' + "{:.2f}".format(x["freq"]) + '</div>')
            r = x["rev"] / x["sp"] if x["sp"] else 0
            return ('<div class="mb-sub">' + lbl + ': ' + m(x["sp"]) + ' &middot; ' + str(int(x["pc"])) + ' sales &middot; ROAS '
                    + "{:.2f}x".format(r) + ' &middot; CPM ' + m(x["cpm"]) + '</div>')
        kind = "REACH (hype)" if reach else "SALES"
        bud = (m(c["budget"]) + "/day") if c["budget"] else "ad set budgets"
        stop = (" &middot; ends " + c["stop"][8:10] + "/" + c["stop"][5:7] + " " + c["stop"][11:16]) if c.get("stop") else ""
        cards += ('<div class="kpi"><div class="lbl">' + _h.escape(c["name"]) + '</div><div class="val" style="font-size:15px">' + kind + ' ' + chip
                  + '</div><div class="mb-sub"><b>Budget ' + bud + '</b>' + stop + '</div>' + line("Today", c.get("today"))
                  + line("Yesterday", c.get("yday")) + line("Last 7 days", c.get("d7"))
                  + '<div class="mb-sub"><a class="wlink" target="_blank" rel="noopener" href="https://adsmanager.facebook.com/adsmanager/manage/adsets?act='
                  + ADS_ACT + '&selected_campaign_ids=' + c["id"] + '">Open &#8599;</a></div></div>')
    if not cards:
        return ""
    return ('<div class="mb-lab">&#127873; Black Friday 2026 campaigns (live and paused, pulled ' + d["pulled"][11:16] + ')</div>'
            '<div class="kpis mb-kpis">' + cards + '</div>')

def bf_ads_html(SP, data):
    # 27/11/2026 (Quan: "I need visuals"): every ad that spent money TODAY as a picture card, grouped by campaign,
    # biggest spender first. Black Friday campaigns first, then the everyday campaigns that are still on.
    import html as _h, re as _re
    BE = 2.04  # break-even ROAS
    m = lambda v: "${:,.0f}".format(v) if v >= 100 else "${:,.2f}".format(v)
    groups = {}
    for a in data.get("ads", []) + data.get("paused", []):
        x = a.get("d0") or {}
        if not x.get("sp"):
            continue
        groups.setdefault(a.get("campaign", "?"), []).append(a)
    if not groups:
        return ""
    def short(n):
        n = _re.sub(r"^BF26_[A-Z]+_NOV_BFCM_", "", n)
        n = _re.sub(r"^B\d+_[A-Z]+_[A-Z]+_BAU_", "", n)
        n = _re.sub(r"_(Video|Motion|Static).*$", "", n)
        n = _re.sub(r"_(Offer|Winner|Scarcity)_", " · ", n)
        return _re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", n.replace("_", " "))
    order = sorted(groups, key=lambda k: (not k.startswith("BF #"), k))
    out = ""
    for k in order:
        ads = sorted(groups[k], key=lambda a: -a["d0"]["sp"])
        sp = sum(a["d0"]["sp"] for a in ads); pc = sum(a["d0"].get("pc", 0) for a in ads); rev = sum(a["d0"].get("rev", 0) for a in ads)
        r = rev / sp if sp else 0
        cls = "good" if r >= BE else ("bad" if sp >= 150 else "warn")
        rows = ""
        for a in ads:
            x = a["d0"]; s_ = x["sp"]; ro = x.get("rev", 0) / s_ if s_ else 0
            if a.get("paused"):
                v, vt = "paused", "SWITCHED OFF"
            elif ro >= BE:
                v, vt = "good", "Making money"
            elif s_ >= 150:
                v, vt = "bad", "Losing money"
            elif s_ >= 20:
                v, vt = "warn", "Still testing"
            else:
                v, vt = "off", "Barely spent"
            src = a.get("src", "")
            img = ('<img class="th" loading="lazy" src="' + src + '" alt="">') if src else '<span class="th th-empty"></span>'
            rc = "good" if ro >= BE else ("bad" if s_ >= 150 else ("warn" if x.get("pc") else ""))
            cpp = m(s_ / x["pc"]) if x.get("pc") else "no sale"
            rows += ('<tr class="bft-' + v + '"><td><div class="bft-ad">' + img + '<div><div class="bft-n">' + _h.escape(a["name"]) + '</div>'
                     '<div class="bft-s">' + _h.escape(a.get("adset", "")) + '</div></div></div></td>'
                     '<td><span class="mb-chip ' + ("" if v in ("off", "paused") else v) + '"><i></i>' + vt + '</span></td>'
                     '<td class="num"><b>' + m(s_) + '</b></td><td class="num">' + str(int(x.get("pc", 0))) + '</td>'
                     '<td class="num">' + m(x.get("rev", 0)) + '</td><td class="num">' + cpp + '</td>'
                     '<td class="num"><span class="mb-chip ' + rc + '">' + "{:.2f}x".format(ro) + '</span></td>'
                     '<td class="num">' + "{:.2f}".format(x.get("freq", 0)) + '</td><td class="num">' + "{:.2f}%".format(x.get("ctr", 0)) + '</td></tr>')
        out += ('<div class="bfa-h"><b>' + _h.escape(k) + '</b><span class="mb-chip ' + cls + '"><i></i>Today: ' + m(sp) + ' spent &middot; ' + str(int(pc))
                + ' sales &middot; ' + m(rev) + ' &middot; ROAS ' + "{:.2f}x".format(r) + '</span></div>'
                '<div class="bft-wrap"><table class="bft"><thead><tr><th>Ad</th><th>Status</th><th class="num">Spent today</th><th class="num">Sales</th>'
                '<th class="num">Revenue</th><th class="num">Cost per sale</th><th class="num">ROAS today</th><th class="num">Freq</th><th class="num">CTR link</th></tr></thead><tbody>'
                + rows + '</tbody></table></div>')
    css = ('<style>.bfa-h{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 8px;font-size:14px}'
           '.bft-wrap{overflow-x:auto;border:1px solid var(--bd);border-radius:12px;background:var(--s1);margin-bottom:6px}'
           '.bft{width:100%;border-collapse:collapse;font-size:13px}.bft th{text-align:left;font-size:12px;font-weight:600;color:var(--tx2);padding:8px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}'
           '.bft td{padding:7px 10px;border-bottom:1px solid var(--bd);vertical-align:middle}.bft tr:last-child td{border-bottom:none}'
           '.bft .num{text-align:right;white-space:nowrap}.bft-ad{display:flex;gap:10px;align-items:center;min-width:260px}'
           '.bft-ad .th{display:block!important;width:56px;height:56px;min-width:56px;border-radius:8px;object-fit:cover}'
           '.bft-n{font-weight:600;color:var(--tx);line-height:1.25;word-break:break-word}.bft-s{font-size:11.5px;color:var(--tx2)}'
           '.bft tr.bft-paused td{background:#3f3f46;color:#a1a1aa;border-bottom-color:#27272a}.bft tr.bft-paused .bft-n{color:#d4d4d8}'
           '.bft tr.bft-paused .bft-s{color:#8e8e98}.bft tr.bft-paused .th{filter:grayscale(1) brightness(.5)}'
           '.bft tr.bft-paused .mb-chip{background:#18181b;color:#e4e4e7}</style>')
    return (css + '<div class="mb-lab" style="margin-top:22px">&#128202; Every ad that spent money today (biggest spender first, break-even ROAS '
            + "{:.2f}".format(BE) + 'x, pulled ' + data["pulled"][11:16] + '). Dark grey rows = ads that are switched off now.</div>' + out)

def build(SP):
    p = os.path.join(SP, "buyer.json")
    if not os.path.exists(p):
        return 0, ""
    data = json.load(open(p, encoding="utf-8"))
    for a in data.get("ads", []) + data.get("paused", []):
        a["src"] = ""
        for folder in ("thumbs", "big"):
            if os.path.exists(os.path.join(SP, folder, a["id"] + ".jpg")):
                a["src"] = f"{folder}/{a['id']}.jpg"
                break
    try:
        from datetime import datetime
        pulled = datetime.strptime(data["pulled"], "%Y-%m-%dT%H:%M:%S").strftime("%d/%m/%Y %I:%M %p")
    except Exception:
        pulled = "?"
    auto = None
    mp = os.path.join(SP, "mer.json")
    if os.path.exists(mp):
        try:
            auto = json.load(open(mp, encoding="utf-8"))
        except Exception:
            auto = None
    newc = None
    try:
        newc = json.load(open(os.path.join(SP, "newcust.json"), encoding="utf-8"))
    except Exception:
        newc = None
    acts = recent_actions(SP)
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    out = (HTML.replace("__CSS__", CSS).replace("__N__", str(len(data.get("ads", []))))
           .replace("__PULLED__", pulled).replace("__DEF__", json.dumps(DEFAULTS))
           .replace("__AUTO__", json.dumps(auto)).replace("__NEWC__", json.dumps(newc, ensure_ascii=False)).replace("__ACTS__", json.dumps(acts).replace("</", "<\\/")).replace("__ACT__", ADS_ACT).replace("__DATA__", blob))
    pass  # 28/11/2026 (Quan): BF cards removed; today / yesterday now sit on each campaign bar
    return len(data.get("ads", [])), out
