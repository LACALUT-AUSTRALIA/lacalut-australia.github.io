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
            "roasbe": 1.5, "villroas": 1.0, "fastspend": 100.0}
ADS_ACT = "2157906551266386"

CLASS_LABEL = {"supervillain": "Supervillain", "villain": "Villain", "sidekick": "Sidekick",
               "civilian": "Civilian", "hero": "Hero", "superhero": "Superhero"}


def classify(a, D=None):
    """Our own classes (Quan 15/11/2026), judged on spend and ROAS. Returns (key, reason).
    The same logic is written in JavaScript inside HTML below: change both together."""
    D = D or DEFAULTS
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
.mb-setup{border:1px solid var(--line);border-left:4px solid var(--bad);border-radius:14px;background:var(--card);margin:10px 0 14px}
.mb-setup summary{cursor:pointer;font-weight:800;font-size:15px;padding:12px 16px;list-style:none}
.mb-setup summary::-webkit-details-marker{display:none}
.mb-setup summary:after{content:'  \\25BE';color:var(--sub)}
.mb-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px 16px;padding:4px 16px 14px}
.mb-f label{display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--sub);margin-bottom:4px}
.mb-f input{width:100%;font:inherit;font-size:15px;font-weight:700;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-variant-numeric:tabular-nums}
.mb-f small{display:block;font-size:11.5px;color:var(--sub);margin-top:3px}
.mb-shead{grid-column:1/-1;font-size:12px;font-weight:800;color:var(--brand);border-top:1px solid var(--line);padding-top:10px;margin-top:2px}
.mb-thr{padding:0 16px 12px;font-size:13.5px;font-variant-numeric:tabular-nums;display:flex;gap:6px 22px;flex-wrap:wrap}
.mb-thr b{margin-right:6px}.mb-g{color:var(--good);font-weight:700}.mb-a{color:var(--mid);font-weight:700}.mb-r{color:var(--bad);font-weight:700}
.mb-reset{font:inherit;font-size:12.5px;font-weight:700;margin:0 16px 14px;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--sub);cursor:pointer}
.mb-banner{border-radius:12px;padding:12px 16px;margin:0 0 14px;font-weight:800;font-size:15px;border:1px solid var(--line);border-left-width:4px}
.mb-banner small{display:block;font-weight:600;font-size:12.5px;color:var(--sub);margin-top:3px}
.mb-banner.down{border-left-color:var(--bad);background:var(--badbg)}.mb-banner.up{border-left-color:var(--good);background:var(--goodbg)}.mb-banner.hold{border-left-color:var(--warn);background:var(--midbg)}
.mb-days{display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center;font-size:13px;margin:-4px 0 14px}.mb-day{white-space:nowrap;cursor:help}
.mb-f input:disabled{opacity:.75}
.mb-wrap{overflow:auto;max-height:calc(100vh - 370px);min-height:420px}
.mb-table{width:100%}
.wrap:has(.tabpane[data-pane="buyer"]:not([hidden])){max-width:1780px}
.mb-table tbody td,.mb-table thead th{padding-left:9px;padding-right:9px}
.mb-table thead th{position:sticky;top:0;z-index:7;white-space:nowrap;cursor:help}
.mb-table thead tr.colfilters th{position:sticky;top:40px;z-index:7}
.mb-table thead th+th,.mb-ad td+td{border-left:1px solid var(--line)}
.mb-table .adtd{min-width:300px;max-width:420px}
.mb-th{width:84px;height:84px;min-width:84px;cursor:zoom-in}
.mb-camp td{background:var(--brand)!important;color:#fff;font-weight:800;font-size:14.5px;padding:10px 14px}
.mb-camp td .mut{color:rgba(255,255,255,.82);font-weight:600}
.mb-table{border-collapse:separate;border-spacing:0}
.mb-wrap{background:var(--bg);border:none;border-radius:16px}
.mb-table thead tr:first-child th:first-child{border-top-left-radius:14px}
.mb-table thead tr:first-child th:last-child{border-top-right-radius:14px}
.mb-table thead tr.colfilters th:first-child{border-bottom-left-radius:14px}
.mb-table thead tr.colfilters th:last-child{border-bottom-right-radius:14px}
.mb-camp td{border-radius:14px}
.mb-set td{background:var(--thbg)!important;color:var(--thtext);font-weight:800;font-size:14px;padding:12px 16px;border:1.5px solid #a9c9ec;border-bottom:1px solid var(--line);border-radius:16px 16px 0 0}
.mb-ad td{background:var(--card)}
.mb-ad td:first-child{border-left:1.5px solid #a9c9ec}
.mb-ad td:last-child{border-right:1.5px solid #a9c9ec}
.mb-ad.mb-last td{border-bottom:1.5px solid #a9c9ec}
.mb-ad.mb-last td:first-child{border-bottom-left-radius:16px}
.mb-ad.mb-last td:last-child{border-bottom-right-radius:16px}
.mb-gap td{height:18px;padding:0;background:var(--bg)!important;border:none!important}
.mb-gap-big td{height:30px}
.mb-stage{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:11.5px}
.mb-kpis{margin:0 0 14px}.mb-sub{font-size:12px;color:var(--sub);margin-top:6px}
.mb-chips{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}
.mbf{font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--sub);display:inline-flex;gap:7px;align-items:center}
.mbf[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:#fff}
.mbf .tcount{background:var(--thbg);color:var(--thtext);border-radius:999px;font-size:11px;padding:1px 7px}
.mbv{display:inline-block;padding:4px 11px;border-radius:20px;font-size:12.5px;font-weight:800;white-space:nowrap;cursor:help}
.mbv-supervillain{background:var(--bad);color:#fff}.mbv-villain{background:var(--badbg);color:var(--bad)}
.mbv-sidekick{background:var(--midbg);color:var(--mid)}.mbv-civilian{background:var(--line);color:var(--sub)}
.mbv-hero{background:var(--goodbg);color:var(--good)}.mbv-superhero{background:var(--good);color:#fff}
.mb-up{color:var(--good);font-size:10px}.mb-dn{color:var(--bad);font-size:10px}
.mb-vid{font-size:10px;font-weight:800;background:var(--line);color:var(--sub);padding:1px 6px;border-radius:5px;margin-left:4px}
.mb-lp{text-decoration:none}
"""

HTML = """<section class="sec" id="mb">
<h2>&#127919; Media Buyer &mdash; every live ad <span class="count">__N__</span></h2>
<p class="note">Meta data pulled __PULLED__ (this PC's time). Numbers are the last 7 days unless the column name says otherwise. View only: nothing on this page changes an ad. Hover a column name to see what it means.</p>
<details class="mb-setup" open>
<summary>&#9881;&#65039; Setup</summary>
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
<div class="mb-banner" id="mb-banner"></div>
<div class="mb-days" id="mb-days"></div>
<div class="kpis mb-kpis" id="mb-kpis"></div>
<div class="mb-chips" id="mb-chips"></div>
<div class="tablewrap mb-wrap"><table class="mb-table">
<thead><tr><th>Ad</th><th title="Our own classes, set in Setup. Villain and Supervillain = pause. Hero and Superhero are never paused. These are not the EE labels.">Class</th>
<th title="Last 7 days">Spend 7d</th><th title="Purchases, last 7 days">Purch.</th>
<th title="Cost per purchase, last 7 days. Colour = CPP thresholds for the funnel stage this ad set is acting like">CPP 7d</th>
<th title="Cost per purchase, last 3 days. Arrow shows better or worse than 7 days">CPP 3d</th>
<th title="Cost per purchase, yesterday">CPP yest.</th>
<th title="Meta purchase value / spend, last 7 days">ROAS 7d</th>
<th title="Average times each person saw this ad, last 7 days">Freq</th>
<th title="Link clicks / impressions">CTR link</th><th title="Cost per 1,000 impressions">CPM</th>
<th title="Videos only: 3-second views / impressions">Hook</th>
<th title="Add to carts / landing page views">Add to cart</th>
<th title="Checkouts started / landing page views">Checkout</th>
<th>Days live</th><th>Landing page</th><th></th></tr></thead>
<tbody id="mb-body"></tbody></table></div>
</section>
<style>__CSS__</style>
<script>
(function(){
var DATA=__DATA__,DEF=__DEF__,AUTO=__AUTO__,ACT="__ACT__",KEY='lacalut_mb_setup_v2',NC=17;
var IDS=['mer','mer3','mer30','aov','profit','fcr','margin','b1','b2','minspend','roasbe','villroas','fastspend','superspend','superroas'];
var S={},filt='';
function load(){var o={};try{o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
  IDS.forEach(function(k){var v=parseFloat(o[k]);S[k]=isFinite(v)?v:DEF[k]});
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
function cls(a){var d=a.d7,d3=a.d3,sp=d?d.sp:0,r7=d&&d.sp?d.rev/d.sp:null;
  var fast=d3&&d3.sp>=S.fastspend&&d3.rev/d3.sp<S.villroas;
  if(sp>=S.superspend&&r7<S.villroas)return['supervillain','&#128128; Supervillain','$'+Math.round(sp)+' spent in 7 days at ROAS '+r7.toFixed(2)+'. Pause now. An ad should never get this far'];
  if(sp>=S.minspend&&r7<S.villroas)return['villain','&#129465; Villain','$'+Math.round(sp)+' spent in 7 days at ROAS '+r7.toFixed(2)+'. Pause'];
  if(fast)return['villain','&#129465; Villain','Fast loser: $'+Math.round(d3.sp)+' spent in 3 days at ROAS '+(d3.rev/d3.sp).toFixed(2)+'. Pause'];
  if(sp<S.minspend)return['civilian','&#128118; Civilian','Under $'+S.minspend+' spent in 7 days: too early to judge'];
  if(sp>=S.superspend&&r7>=S.superroas&&d.pc>=5)return['superhero','&#129464; Superhero','$'+Math.round(sp)+' spent, ROAS '+r7.toFixed(2)+', '+d.pc+' sales. Never paused. First in line for more budget'];
  if(r7>=S.roasbe)return['hero','&#11088; Hero','ROAS '+r7.toFixed(2)+' is at or above break-even '+S.roasbe+'. Never paused'];
  return['sidekick','&#129309; Sidekick','ROAS '+r7.toFixed(2)+' is between '+S.villroas+' and '+S.roasbe+'. Stays on and is watched']}
function landing(l,k){if(k&&(k.st===0||k.st>=400))return '<a class="pill pill-bad mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="The page did not open (status '+k.st+')">&#9888; Broken link</a>';
  if(k&&k.soldout===true)return '<a class="pill pill-bad mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="Shopify says this product is sold out">&#9888; Sold out</a>';
  if(!l)return '<span class="mut" title="Link not readable from Meta">?</span>';var p='/';try{p=new URL(l).pathname||'/'}catch(e){}
  var lab,cls;if(/%C2%AE|\\u00ae/i.test(l)){lab='&#9888; &reg; link';cls='pill-bad'}
  else if(p.replace(/\\//g,'')===''){lab='Home page';cls='pill-none'}
  else if(p.indexOf('/products/')===0&&p.indexOf('system')>-1){lab='Kit PDP';cls='pill-good'}
  else if(p.indexOf('/products/')===0){lab='Single product';cls='pill-mid'}
  else if(p.indexOf('/pages/')===0){lab='Article';cls='pill-mid'}else{lab='Other';cls='pill-none'}
  if(k&&k.redir){lab+=' &#8618;';p+=' redirects to '+k.redir}
  return '<a class="pill '+cls+' mb-lp" href="'+esc(l)+'" target="_blank" rel="noopener" title="'+esc(p)+'">'+lab+'</a>'}
function agg(rows){var t={sp:0,rev:0,pc:0};rows.forEach(function(a){if(a.d7){t.sp+=a.d7.sp;t.rev+=a.d7.rev;t.pc+=a.d7.pc}});return t}
function sp7(a){return a.d7?a.d7.sp:0}
function render(){
  var T=thr(),h='';
  ['TOF','TOM','MOF'].forEach(function(k){h+='<span><b>'+k+'</b><span class="mb-g">&lt; '+money(T[k][0])+'</span> | <span class="mb-a">'+money(T[k][0])+' &ndash; '+money(T[k][1])+'</span> | <span class="mb-r">&gt; '+money(T[k][1])+'</span></span>'});
  document.getElementById('mb-thr').innerHTML='<b>CPP thresholds</b>'+h;
  var bn=document.getElementById('mb-banner'),a3=S.mer3>S.mer,a30=S.mer30>S.mer,sub='Ideal MER: '+S.mer.toFixed(1)+'% &middot; 3-day: '+S.mer3.toFixed(1)+'% &middot; last 30 days: '+S.mer30.toFixed(1)+'%';
  if(a3&&a30){bn.className='mb-banner down';bn.innerHTML='Scale down total spend by 10-20%<small>Both 3-day and 30-day MER are above ideal. '+sub+'</small>'}
  else if(!a3&&!a30){bn.className='mb-banner up';bn.innerHTML='MER is at or below ideal: there is room to raise spend<small>'+sub+'. Spend increases still need Quan\\'s yes.</small>'}
  else{bn.className='mb-banner hold';bn.innerHTML='Hold total spend<small>3-day and 30-day MER disagree. '+sub+'</small>'}
  var camps={},order=[];DATA.ads.forEach(function(a){if(!camps[a.campaign]){camps[a.campaign]={};order.push(a.campaign)}(camps[a.campaign][a.adset]=camps[a.campaign][a.adset]||[]).push(a)});
  order.sort();var body='',cards='',cnt={supervillain:0,villain:0,sidekick:0,civilian:0,hero:0,superhero:0},now=Date.now();
  order.forEach(function(cn){var sets=camps[cn],all=[];Object.keys(sets).forEach(function(k){all=all.concat(sets[k])});
    var ct=agg(all),cr=ct.sp?ct.rev/ct.sp:0;
    cards+='<div class="kpi"><div class="lbl">'+esc(cn.split(' (')[0])+'</div><div class="val '+(cr>=S.roasbe?'good':'bad')+'">'+cr.toFixed(2)+'x</div><div class="mb-sub">'+money(ct.sp)+' spend &middot; '+ct.pc+' sales &middot; CPP '+(ct.pc?money(ct.sp/ct.pc):'&mdash;')+' &middot; 7 days</div></div>';
    body+='<tr class="mb-gap mb-gap-big"><td colspan="'+NC+'"></td></tr><tr class="mb-camp"><td colspan="'+NC+'">'+esc(cn)+' <span class="mut">&middot; '+all.length+' live ads &middot; '+money(ct.sp)+' &middot; '+ct.pc+' sales &middot; ROAS '+cr.toFixed(2)+'x</span></td></tr>';
    Object.keys(sets).sort(function(x,y){return agg(sets[y]).sp-agg(sets[x]).sp}).forEach(function(sn){
      var rows=sets[sn].slice().sort(function(x,y){return sp7(y)-sp7(x)}),st=agg(rows),sf=rows[0].sfreq||0,stg=stage(sf);
      body+='<tr class="mb-gap"><td colspan="'+NC+'"></td></tr><tr class="mb-set"><td colspan="'+NC+'">'+esc(sn)+' <span class="mut">&middot; '+rows.length+' ads &middot; '+money(st.sp)+' &middot; '+st.pc+' sales &middot; CPP '+(st.pc?money(st.sp/st.pc):'&mdash;')+' &middot; ROAS '+(st.sp?(st.rev/st.sp).toFixed(2)+'x':'&mdash;')+' &middot; ad set frequency '+sf.toFixed(2)+'</span><span class="mb-stage" title="From the ad set frequency and the Setup boundaries">Acting like: '+stg+'</span></td></tr>';
      rows.forEach(function(a,ri){var d=a.d7,v=cls(a);cnt[v[0]]++;
        var img=a.src?'<img class="th mb-th" src="'+a.src+'" loading="lazy" alt="">':'<span class="th mb-th th-empty"></span>';
        var days=a.created_time?Math.floor((now-new Date(a.created_time).getTime())/864e5):null,base=cpp(d);
        body+='<tr class="mb-ad'+(ri===rows.length-1?' mb-last':'')+'" data-s="'+esc((a.name+' '+a.campaign+' '+a.adset).toLowerCase())+'" data-v="'+v[0]+'"'+(filt&&filt!==v[0]?' style="display:none"':'')+'>'
        +'<td class="adtd"><div class="adc">'+img+'<span class="adname">'+esc(a.name)+(a.video?' <span class="mb-vid">VIDEO</span>':'')+'</span></div></td>'
        +'<td class="c"><span class="mbv mbv-'+v[0]+'" title="'+esc(v[2])+'">'+v[1]+'</span></td>'
        +'<td class="num">'+(d?money(d.sp):Z)+'</td><td class="num">'+(d?(d.pc||'<span class="mut">0</span>'):Z)+'</td>'
        +cppCell(d,stg)+cppCell(a.d3,stg,base)+cppCell(a.d1,stg,base)+roasCell(d)
        +'<td class="num">'+(d&&d.freq?d.freq.toFixed(2):Z)+'</td><td class="num">'+(d&&d.imp?d.ctr.toFixed(2)+'%':Z)+'</td><td class="num">'+(d&&d.imp?money(d.cpm):Z)+'</td>'
        +'<td class="num">'+(d&&a.video&&d.v3?pct(d.v3,d.imp):Z)+'</td><td class="num">'+(d?pct(d.atc,d.lpv):Z)+'</td><td class="num">'+(d?pct(d.ic,d.lpv):Z)+'</td>'
        +'<td class="num">'+(days===null||isNaN(days)?Z:days)+'</td><td class="c">'+landing(a.link,a.lk)+'</td>'
        +'<td class="c"><a class="wlink" href="https://adsmanager.facebook.com/adsmanager/manage/ads?act='+ACT+'&selected_ad_ids='+a.id+'" target="_blank" rel="noopener">Open &#8599;</a></td></tr>'})})});
  document.getElementById('mb-body').innerHTML=body;document.getElementById('mb-kpis').innerHTML=cards;
  var ch='';[['','All live ads',DATA.ads.length],['supervillain','&#128128; Supervillain',cnt.supervillain],['villain','&#129465; Villain',cnt.villain],['sidekick','&#129309; Sidekick',cnt.sidekick],['hero','&#11088; Hero',cnt.hero],['superhero','&#129464; Superhero',cnt.superhero],['civilian','&#128118; Civilian',cnt.civilian]].forEach(function(c){ch+='<button class="mbf" data-f="'+c[0]+'" aria-pressed="'+(filt===c[0])+'">'+c[1]+'<span class="tcount">'+c[2]+'</span></button>'});
  var box=document.getElementById('mb-chips');box.innerHTML=ch;
  [].forEach.call(box.querySelectorAll('.mbf'),function(b){b.addEventListener('click',function(){filt=b.getAttribute('data-f');render()})});
}
load();fill();render();
if(AUTO){var dm=function(x){return x.slice(8,10)+'/'+x.slice(5,7)};
  ['mer3','mer30'].forEach(function(k){document.getElementById('mb-'+k).disabled=true});
  [].forEach.call(document.querySelectorAll('.mb-auto'),function(e){e.textContent='Automatic: Meta spend ÷ Shopify retail sales incl. GST, full days to '+dm(AUTO.as_of)});
  if(AUTO.aov)document.getElementById('mb-aovnote').textContent='Shopify last 30 days: $'+AUTO.aov.toFixed(2)+' (type to override)';
  var h='<b>MER by day</b>';AUTO.days.forEach(function(x,i){var c=x.mer===null?'pill-none':(x.mer<=S.mer?'pill-good':(x.mer<=2*S.mer?'pill-mid':'pill-bad'));
    h+='<span class="mb-day" title="$'+x.spend.toLocaleString()+' Meta spend ÷ $'+x.sales.toLocaleString()+' sales">'+dm(x.d)+(i===0?' (today so far)':'')+' <span class="pill '+c+'">'+(x.mer===null?'—':x.mer.toFixed(0)+'%')+'</span></span>'});
  document.getElementById('mb-days').innerHTML=h+'<span class="mut">Sales pulled '+AUTO.pulled+'</span>'}
IDS.forEach(function(k){document.getElementById('mb-'+k).addEventListener('change',function(e){var v=parseFloat(e.target.value);if(!isFinite(v))return;S[k]=v;
  if(k==='profit'||k==='fcr'||k==='margin'){S.mer=Math.max(0,S.margin-S.profit-S.fcr);document.getElementById('mb-mer').value=+S.mer.toFixed(2)}
  if(k==='mer'){S.margin=S.mer+S.profit+S.fcr;document.getElementById('mb-margin').value=+S.margin.toFixed(2)}
  save();render()})});
document.getElementById('mb-reset').addEventListener('click',function(){try{localStorage.removeItem(KEY)}catch(e){}load();fill();render()});
})();
</script>"""


def build(SP):
    p = os.path.join(SP, "buyer.json")
    if not os.path.exists(p):
        return 0, ""
    data = json.load(open(p, encoding="utf-8"))
    for a in data.get("ads", []):
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
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    out = (HTML.replace("__CSS__", CSS).replace("__N__", str(len(data.get("ads", []))))
           .replace("__PULLED__", pulled).replace("__DEF__", json.dumps(DEFAULTS))
           .replace("__AUTO__", json.dumps(auto)).replace("__ACT__", ADS_ACT).replace("__DATA__", blob))
    return len(data.get("ads", [])), out
