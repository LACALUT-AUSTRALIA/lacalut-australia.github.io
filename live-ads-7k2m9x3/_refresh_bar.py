# Refresh button + "Last refreshed" badge for the Live Ads Monitor (Quan 19/11/2026).
# The page is static (GitHub Pages), so the button talks to a small helper on Quan's PC
# (_refresh_server.py, http://127.0.0.1:8765) that runs the normal _auto_refresh.ps1.
# On any other device the helper is unreachable and the button just reloads the newest saved page.
# Free: Meta API reads only. Used by _build_monitor.py -> html(SP).
import json, os

CSS = """<style>
#rfbar{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-right:6px}
#rfbtn{font:700 14px/1 inherit;padding:9px 16px;border-radius:999px;border:0;cursor:pointer;background:#0b5fff;color:#fff;white-space:nowrap;box-shadow:0 2px 6px rgba(11,95,255,.35)}
#rfbtn:hover{background:#0848c9}
#rfbtn[disabled]{background:#7a8699;cursor:wait;box-shadow:none}
#rfage{font:700 13px/1.2 inherit;padding:8px 12px;border-radius:999px;white-space:nowrap;border:2px solid transparent}
#rfage.ok{background:#dcfce7;color:#14532d;border-color:#22c55e}
#rfage.warn{background:#fef3c7;color:#78350f;border-color:#f59e0b}
#rfage.old{background:#fee2e2;color:#7f1d1d;border-color:#ef4444}
#rfage.busy{background:#dbeafe;color:#1e3a8a;border-color:#3b82f6}
</style>"""

JS = r"""<script>
(function(){
var PULLED='__PULLED__', HELPER='http://127.0.0.1:8765', TOKEN='__TOKEN__';
var btn=document.getElementById('rfbtn'), age=document.getElementById('rfage'), busy=false;
var t0=new Date(PULLED+'+10:00');
function two(n){return (n<10?'0':'')+n}
function stamp(){var d=new Date(t0.getTime()+10*3600e3), h=d.getUTCHours(), ap=h<12?'AM':'PM';h=h%12||12;
  return two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+h+':'+two(d.getUTCMinutes())+' '+ap}
function ago(m){return m<1?'just now':m<60?m+' min ago':Math.floor(m/60)+' h '+(m%60)+' min ago'}
function show(){if(busy)return;var m=Math.max(0,Math.round((Date.now()-t0)/60000));
  age.className=m<=45?'ok':m<=120?'warn':'old';
  age.textContent=(m<=45?'✅ ':m<=120?'⚠️ ':'\u{1F534} OLD NUMBERS · ')+'Last refreshed '+stamp()+' · '+ago(m)}
function say(t){age.className='busy';age.textContent=t}
function fresh(){location.replace(location.pathname+'?t='+Date.now())}
function pagePulled(){return fetch(location.pathname+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.text()})
  .then(function(h){var m=h.match(/var PULLED='([^']+)'/);return m?m[1]:''})}
function helper(path,method){var c=new AbortController();setTimeout(function(){c.abort()},6000);
  return fetch(HELPER+path,{method:method||'GET',signal:c.signal,headers:{'X-Refresh-Token':TOKEN}}).then(function(r){if(!r.ok)throw 0;return r.json()})}
function fail(t){busy=false;btn.disabled=false;age.className='old';age.textContent='\u{1F534} '+t}
function waitPage(until){pagePulled().then(function(p){
    if(p&&p!==PULLED)return fresh();
    if(Date.now()>until)return fail('New numbers are saved but the page did not update. Click Refresh again.');
    setTimeout(function(){waitPage(until)},10000)}).catch(function(){setTimeout(function(){waitPage(until)},10000)})}
function waitHelper(start){helper('/status').then(function(s){
    var mins=Math.floor((Date.now()-start)/60000);
    if(s.running){say('⏳ Pulling live numbers from Meta… '+mins+' min so far (takes about 5)');return setTimeout(function(){waitHelper(start)},8000)}
    if(s.pulled&&s.pulled!==PULLED){say('⏳ Numbers pulled. Putting them on the page…');return waitPage(Date.now()+6*60000)}
    fail('Refresh failed: '+(s.last||'no new numbers')+'. Tell Claude.')
  }).catch(function(){setTimeout(function(){waitHelper(start)},8000)})}
btn.addEventListener('click',function(){if(busy)return;busy=true;btn.disabled=true;say('⏳ Starting refresh…');
  helper('/refresh','POST').then(function(){waitHelper(Date.now())}).catch(function(){
    say('⏳ This device cannot start a refresh. Loading the newest saved page…');setTimeout(fresh,1500)})});
show();setInterval(show,30000);
// a newer page was published (the PC refreshes every 30 minutes): load it without being asked
setInterval(function(){if(busy||document.hidden)return;pagePulled().then(function(p){if(p&&p!==PULLED)fresh()}).catch(function(){})},180000);
})();
</script>"""


def token(SP):
    """Shared secret between the page and the helper, so no other website can start a refresh."""
    p = os.path.join(SP, "_refresh_token.txt")
    if not os.path.exists(p):
        open(p, "w").write(os.urandom(16).hex())
    return open(p).read().strip()


def html(SP):
    pulled = json.load(open(os.path.join(SP, "buyer.json"), encoding="utf-8")).get("pulled", "")
    bar = ('<div id="rfbar"><button id="rfbtn" type="button" title="Pull live numbers from Meta now (about 5 minutes)">'
           '&#128260; Refresh now</button><span id="rfage" class="busy">Last refreshed &hellip;</span></div>')
    return CSS + bar, JS.replace("__PULLED__", pulled).replace("__TOKEN__", token(SP))
