#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   LACALUT DESIGN ENGINE — headless terminal CLI
   Reuses design-engine/engine.js (the DOM-free module) so scripts, lint,
   prompts, render and QC match the browser engine EXACTLY — no duplicate
   logic, no Claude-in-Chrome, near-zero token cost.

   Phase 1a (this file): `script` — generate + print a storyboard, no spend.
   Later: `render` (headless Veo/fal + stitch) → import into the engine gallery.

   Usage:
     node de.mjs script --sku aktiv --type routine --style lofi --len 24
     node de.mjs script --sku aktiv --len 24 --brief "morning routine, makeup"
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE_DIR = path.resolve(__dirname, '..');            // design-engine/

/* ── .env (single source of truth for keys) ── */
function loadEnv(){
  const env = {};
  for (const p of ['C:/Users/conta/.env', path.join(process.env.HOME||'', '.env')]) {
    try {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    } catch (_) {}
  }
  return env;
}
const ENV = loadEnv();
const GEMINI = ENV.GEMINI_API_KEY || ENV.GOOGLE_AI_API_KEY || '';
const FAL = ENV.FAL_KEY || '';

/* ── minimal browser-API shims (only what engine.js / strategies.js touch) ── */
globalThis.window = globalThis;                                      // strategies.js does `window.STRATEGY_BRAINS = …`
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
if (typeof globalThis.FileReader === 'undefined') {                  // used by blobToDataUrl in the render path
  globalThis.FileReader = class {
    readAsDataURL(blob){
      blob.arrayBuffer().then(ab => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(ab).toString('base64')}`;
        this.readyState = 2; this.onloadend && this.onloadend({ target: this });
      }).catch(e => { this.onerror && this.onerror(e); });
    }
  };
}

/* ── load the engine (strategies.js MUST run before engine.js) ── */
require(path.join(ENGINE_DIR, 'strategies.js'));                     // attaches globalThis.STRATEGY_BRAINS
const E = require(path.join(ENGINE_DIR, 'engine.js'));               // module.exports = LacalutEngine
require(path.join(ENGINE_DIR, 'packs-seed.js'));                     // attaches globalThis.LAC_PACKS (German packshots)

/* ── arg parsing ── */
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };

/* friendly aliases → engine keys */
const STYLE_ALIAS = { lofi:'lofi_native', native:'lofi_native', hybrid:'polished_hybrid', product:'product_motion',
  hyper:'hyper_motion', reveal:'slow_reveal', splash:'liquid_splash', float:'float_levitate',
  kinetic:'kinetic_type', retro:'retro_nostalgia', cinematic:'cinematic_ad' };
const TYPE_ALIAS = { routine:'routine', pas:'pas', problem:'pas', demo:'demo', vs:'vs', oldnew:'vs',
  transform:'transform', mashup:'mashup', social:'mashup', founder:'founder', brand:'founder' };

const C = { r:'\x1b[0m', b:'\x1b[1m', red:'\x1b[31m', grn:'\x1b[32m', ylw:'\x1b[33m', pur:'\x1b[35m', cyn:'\x1b[36m', gry:'\x1b[90m' };

async function cmdScript(){
  if (!GEMINI) { console.error(C.red + 'No GEMINI_API_KEY in .env' + C.r); process.exit(1); }
  const sku = flag('sku', 'aktiv');
  const type = TYPE_ALIAS[flag('type', 'routine')] || 'routine';
  const style = STYLE_ALIAS[flag('style', 'lofi')] || flag('style', 'lofi_native');
  const seconds = parseInt(flag('len', '24'), 10) || 24;
  const brief = flag('brief', '');
  const nScenes = Math.max(2, Math.min(5, Math.round(seconds / 8)));

  console.log(`${C.cyn}${C.b}⚙️  Writing script${C.r} — ${C.b}${sku}${C.r} · ${type} · ${style} · ${seconds}s (${nScenes} scenes)${brief ? ' · brief: ' + brief : ''}`);
  const sb = await E.generateStoryboard({ sku, type, style, seconds, brief, apiKey: GEMINI });

  console.log(`\n${C.pur}${C.b}HOOK${C.r}  ${sb.hook || ''}`);
  console.log(`${C.pur}${C.b}CTA${C.r}   ${sb.cta || ''}`);
  if (sb.character) console.log(`${C.gry}character: ${sb.character}${C.r}`);
  if (sb.world) console.log(`${C.gry}world: ${sb.world}${C.r}`);
  (sb.scenes || []).forEach(sc => {
    console.log(`\n${C.grn}${C.b}─── Scene ${sc.n} (${sc.seconds || 8}s) ───${C.r}`);
    console.log(`${C.b}WE SEE${C.r}  ${sc.visual || ''}`);
    console.log(`${C.b}MOTION${C.r}  ${sc.motion || ''}`);
    console.log(`${C.b}VO${C.r}      ${sc.vo || ''}`);
    console.log(`${C.b}TEXT${C.r}    ${sc.text || ''}`);
  });

  if (sb.lint && sb.lint.length) {
    console.log(`\n${C.ylw}${C.b}⚠️  Lint (${sb.lint.length}) — surviving warnings:${C.r}`);
    sb.lint.forEach(x => console.log(`${C.ylw}  • ${x}${C.r}`));
  } else {
    console.log(`\n${C.grn}✅ Lint clean${C.r}`);
  }

  const est = E.storyboardCostEstimate ? E.storyboardCostEstimate({ style, seconds }) : null;
  if (est) console.log(`\n${C.gry}💸 Render est: ~US$${(est.usd || 0).toFixed(2)} (${est.label || ''})${C.r}`);

  const outDir = path.join(ENGINE_DIR, '_cli-renders');
  fs.mkdirSync(outDir, { recursive: true });
  const slug = `${sku}-${type}-${seconds}s-${nScenes}sc`;
  const outPath = path.join(outDir, `${slug}.script.json`);
  fs.writeFileSync(outPath, JSON.stringify({ meta: { sku, type, style, seconds, nScenes, brief }, storyboard: sb }, null, 2));
  console.log(`\n${C.gry}💾 Saved script → ${outPath}${C.r}`);
  console.log(`${C.cyn}Next: edit the WE SEE / MOTION / VO in that JSON, then (coming) \`node de.mjs render --script ${slug}\`${C.r}`);
}

/* pick the German packshot dataURL for an SKU + form (tube by default) */
function packshotFor(sku, form){
  const P = globalThis.LAC_PACKS || {};
  const key = form === 'box' ? `${sku}_tp_box` : form === 'boxtube' ? `${sku}_tp_boxtube`
            : form === 'bottle' ? `${sku}_mw_bottle` : `${sku}_toothpaste`;
  return P[key] || P[`${sku}_toothpaste`] || null;
}

async function cmdRender(){
  if (!GEMINI) { console.error(C.red + 'No GEMINI_API_KEY in .env' + C.r); process.exit(1); }
  const slug = flag('script', '');
  if (!slug) { console.error(C.red + 'Pass --script <slug> (the saved script name, no extension)' + C.r); process.exit(1); }
  const scriptPath = path.join(ENGINE_DIR, '_cli-renders', `${slug}.script.json`);
  const doc = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
  const { meta, storyboard: sb } = doc;
  const sku = meta.sku, style = meta.style;
  const onlyScene = flag('scene', '');                                  // 1-based; omit = all scenes
  const form = flag('form', 'tube');
  const pack = packshotFor(sku, form);
  if (!pack) { console.error(C.red + `No packshot for ${sku}/${form} in LAC_PACKS` + C.r); process.exit(1); }
  const aspectRatio = flag('ar', '9:16');

  const scenes = sb.scenes || [];
  const targets = onlyScene ? [parseInt(onlyScene, 10) - 1] : scenes.map((_, i) => i);
  const engineKey = E.videoEngineForStyle(style);
  const est = E.videoCostEstimate({ model: engineKey, seconds: 8 });
  console.log(`${C.cyn}${C.b}🎬 Rendering${C.r} ${sku} · ${style} → engine ${C.b}${engineKey}${C.r} · ${targets.length} scene(s) · ~US$${(est.usd * targets.length).toFixed(2)}`);

  const outDir = path.join(ENGINE_DIR, '_cli-renders');
  let worldStill = null;
  try { const s1 = path.join(outDir, `${slug}.s1.still.png`);          // anchor to scene-1's world if it was saved on a prior run
    if (fs.existsSync(s1)) worldStill = `data:image/png;base64,${fs.readFileSync(s1).toString('base64')}`;
  } catch (_) {}
  for (const idx of targets) {
    const sc = scenes[idx];
    if (!sc) { console.log(C.ylw + `  scene ${idx + 1} not found, skipping` + C.r); continue; }
    process.stdout.write(`${C.gry}  S${idx + 1}: `);
    const r = await E.renderScene({
      sku, scene: sc, storyboard: sb, style, aspectRatio,
      refImgs: [pack], refImgDataUrl: pack, worldStill, prevStill: worldStill,
      apiKey: GEMINI, falKey: FAL,
      onProgress: m => process.stdout.write(m + ' · ')
    });
    if (r.still && !worldStill) worldStill = r.still;                   // anchor later scenes to the first scene's world
    const buf = Buffer.from(await r.videoBlob.arrayBuffer());
    const mp4 = path.join(outDir, `${slug}.s${idx + 1}.mp4`);
    fs.writeFileSync(mp4, buf);
    if (r.still) {                                                      // persist the still — used as a continuity anchor + gallery poster
      const m = /^data:image\/\w+;base64,(.+)$/s.exec(r.still);
      if (m) fs.writeFileSync(path.join(outDir, `${slug}.s${idx + 1}.still.png`), Buffer.from(m[1], 'base64'));
    }
    console.log(`${C.grn}✓ saved ${(buf.length / 1e6).toFixed(1)}MB → ${path.basename(mp4)}${C.r}`);
  }
  console.log(`${C.grn}${C.b}Done.${C.r} ${C.gry}mp4(s) in ${outDir}${C.r}`);
}

function usage(){
  console.log(`${C.b}LACALUT Design Engine CLI${C.r}
  ${C.grn}node de.mjs script${C.r} --sku <aktiv|flora|sensitive|white|herbal|multi> --type <routine|pas|demo|vs|transform|mashup|founder> --style <lofi|hybrid|product|...> --len <16|24|32|40> [--brief "..."]
  (render/import commands land next)`);
}

(async () => {
  try {
    if (cmd === 'script') await cmdScript();
    else if (cmd === 'render') await cmdRender();
    else usage();
  } catch (e) {
    console.error(C.red + 'ERROR: ' + (e && e.stack || e) + C.r);
    process.exit(1);
  }
})();
