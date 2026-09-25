/* Headless brain sweep — all VIDEO_TYPES × VIDEO_STYLES combos.
   Usage: node sweep.js <roundName> [onlyCombosCSV type:style,...]
   Writes _rig/results/<round>/<type>__<style>.json + summary.jsonl. No renders, no Veo spend. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = globalThis;

// ── D: hard per-request timeout ──────────────────────────────────────────────
// engine.js calls the global fetch; a hung Gemini socket has no timeout and stalls
// the whole sweep forever (caused 2 overnight stalls). Wrap fetch to inject an
// AbortSignal.timeout when the caller supplied none — undici aborts the socket, the
// await rejects with a real error, and the retry loop moves on instead of hanging.
const REQ_TIMEOUT_MS = 90000;
const _fetch = global.fetch.bind(global);
global.fetch = (url, opts = {}) =>
  opts.signal ? _fetch(url, opts) : _fetch(url, { ...opts, signal: AbortSignal.timeout(REQ_TIMEOUT_MS) });
// backstop: race any single-combo run against a wall clock in case something non-fetch hangs.
const COMBO_TIMEOUT_MS = 180000;
const withTimeout = (p, ms, label) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout:' + label + ' >' + (ms / 1000) + 's')), ms).unref()),
]);

require(path.join(__dirname, '..', 'strategies.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

const envTxt = fs.readFileSync('C:/Users/conta/.env', 'utf8');
const API_KEY = (envTxt.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
if (!API_KEY) { console.error('no GEMINI_API_KEY'); process.exit(1); }

const round = process.argv[2] || 'r1';
const only = (process.argv[3] || '').split(',').filter(Boolean);
const outDir = path.join(__dirname, 'results', round);
fs.mkdirSync(outDir, { recursive: true });

const TYPES = Object.keys(E.VIDEO_TYPES);
const STYLES = Object.keys(E.VIDEO_STYLES);
const combos = [];
for (const t of TYPES) for (const s of STYLES) combos.push([t, s]);
const run = only.length ? combos.filter(([t, s]) => only.includes(t + ':' + s)) : combos;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// meta-checks the engine lint might miss — surfaced for MY review, not auto-fail
function metaChecks(sb, type, style) {
  const out = [];
  const scenes = sb.scenes || [];
  const all = [sb.hook, sb.cta, sb.world, sb.character, sb.styleAnchor,
    ...scenes.flatMap(s => [s.visual, s.motion, s.vo, s.text])].join(' \n ');
  for (const sc of scenes) {
    const w = String(sc.vo || '').trim().split(/\s+/).filter(Boolean).length;
    if (w > 20) out.push(`S${sc.n} VO ${w} words (>20)`);
    if (!String(sc.text || '').trim()) out.push(`S${sc.n} missing caption (sound-off law)`);
    if (/previous scene|last scene|scene \d/i.test(String(sc.motion || '') + String(sc.visual || '')))
      out.push(`S${sc.n} cross-scene reference`);
  }
  // word-repetition is now owned entirely by engine.lintStoryboard (4-letter floor + full
  // filler STOP set + count-then-rewrite). The old duplicate here used a 6-letter floor and a
  // tiny STOP set, so it false-flagged filler like "something ×3" that the engine correctly
  // ignores — a drift that stopped the autonomous loop ever reaching "clean". Removed.
  if (sb.flagged) out.push('SANITIZE FLAG (banned term survived)');
  return out;
}

(async () => {
  const summary = [];
  for (const [type, style] of run) {
    const tag = `${type}__${style}`;
    let rec = { round, type, style, ok: false };
    for (let a = 0; a < 3; a++) {
      try {
        const sb = await withTimeout(
          E.generateStoryboard({ sku: 'aktiv', type, style, seconds: 24, apiKey: API_KEY }),
          COMBO_TIMEOUT_MS, tag);
        E.sanitizeStoryboard(sb);
        rec.ok = true;
        rec.lint = sb.lint || [];
        rec.meta = metaChecks(sb, type, style);
        fs.writeFileSync(path.join(outDir, tag + '.json'), JSON.stringify(sb, null, 1));
        break;
      } catch (e) {
        rec.err = String(e.message || e).slice(0, 200);
        if (/429|quota|overload|503/i.test(rec.err)) await sleep(20000); else await sleep(3000);
      }
    }
    summary.push(rec);
    const bad = (rec.lint || []).length + (rec.meta || []).length;
    console.log(`${rec.ok ? (bad ? '⚠' : '✓') : '✗'} ${tag}  lint:${(rec.lint || []).length} meta:${(rec.meta || []).length}${rec.err ? ' ERR ' + rec.err : ''}`);
    for (const l of (rec.lint || [])) console.log('    LINT: ' + l);
    for (const m of (rec.meta || [])) console.log('    META: ' + m);
    fs.appendFileSync(path.join(outDir, 'summary.jsonl'), JSON.stringify(rec) + '\n');
    await sleep(2500);
  }
  const dirty = summary.filter(r => !r.ok || (r.lint || []).length || (r.meta || []).length);
  console.log(`\nROUND ${round}: ${summary.length} combos, ${dirty.length} dirty`);
  console.log('DIRTY: ' + dirty.map(r => r.type + ':' + r.style).join(',') || 'none');
})();
