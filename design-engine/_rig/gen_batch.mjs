// gen_batch.mjs — headless batch render through the REAL engine pipeline (buildPrompt -> One-Up ->
// HARD_RULES -> brandBrainInjection), the exact same order index.html's runGenerate uses. This
// replaces ad-hoc hand-written prompts (aditya_matrix.mjs / sensitivity_pilot.mjs v1-v3) — those
// skipped buildPrompt entirely and reinvented a worse version of its typography/contrast/realism rules.
//
// Usage: node _rig/gen_batch.mjs <batch-name>
//   reads  _rig/batches/<batch-name>.json   — { sku, mode, ads:[{id,headline,brief,prom,archetype}] }
//   writes _rig/winner-ads/<batch-name>/*.png
//   writes _cli-renders-images/<batch-name>/*.png + manifest.json  <- pick THIS folder in the engine's
//          "🖼️ Load Image Renders" button to import straight into the Gallery, Edit-ready.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const batchName = process.argv[2];
if (!batchName) { console.error('Usage: node _rig/gen_batch.mjs <batch-name>'); process.exit(1); }

const batchFile = path.join(DE, '_rig', 'batches', batchName + '.json');
const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const { sku, mode = 'social', ads } = batch;

const REVIEW_OUT = path.join(DE, '_rig', 'winner-ads', batchName);
const IMPORT_OUT = path.join(DE, '_cli-renders-images', batchName);
fs.mkdirSync(REVIEW_OUT, { recursive: true });
fs.mkdirSync(IMPORT_OUT, { recursive: true });

const env = fs.readFileSync('C:/Users/conta/.env', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();

global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {} };
eval(fs.readFileSync(path.join(DE, 'strategies.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'layout-archetypes.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'brand-brain.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'packs-seed.js'), 'utf8'));
const E = window.LacalutEngine;
const PACK = window.LAC_PACKS[sku + '_toothpaste'];
if (!PACK) { console.error('No packshot for sku="' + sku + '" (expected key "' + sku + '_toothpaste")'); process.exit(1); }
const BANS = [...new Set([...(E.GLOBAL_BAN || []), ...((E.SKUS[sku] || {}).ban || [])])];

// Verbatim copy of index.html's HARD_RULES global (13 non-SKU-specific craft rules — CTA pill,
// icon contrast, no medical-cross, no duplicate text, pack fine-print lock, etc.)
const HARD_RULES = ' HARD DESIGN RULES — must obey: (1) ICON CONTRAST: the small icon inside each benefit chip/pill MUST be a clearly different, contrasting colour from the chip text (e.g. gold or bright-accent icons beside white text) — never the same colour, so each icon pops. (2) REALISTIC PROPORTIONS: when a product BOX appears in the same frame as its bottle or tube, size them to real-life proportions relative to each other — a mouthwash box is slightly taller/larger than its bottle, a toothpaste box is larger than its tube. A single deliberately OVERSIZED hero product for scroll-stopping impact is allowed, but the box-vs-bottle/tube size relationship must stay realistic. (3) PRODUCT ACCURACY — NEVER hallucinate or invent product: render every product EXACTLY as its attached reference packshot — identical bottle/tube/box shape, cap, label layout, colours and wording. Do not restyle, redraw from imagination, or guess a pack. If a product has no reference attached, do NOT add or alter it. (4) TEXT HIERARCHY: the HEADLINE, sub-headline and CTA button must be the LARGEST, most dominant elements in the frame — bigger and more prominent than any decorative graphic; the CTA button must be large and clearly legible. (5) BADGE PROMINENCE: any money-back / guarantee seal or badge must be LARGE and clearly readable — a prominent trust element, never a small afterthought. (6) Keep all real German packaging accurate with no fabricated on-pack text. (7) CTA CONTRAST (non-negotiable): the CTA button fill MUST strongly contrast whatever sits directly behind it — NEVER a pill the same or similar hue to its background (e.g. never a green button on a green scene, never navy on navy); if the scene is green use a red, gold or white pill, if red use white, if white use red or green. (8) LAYOUT PIZZAZZ: do NOT default to a flat, perfectly-horizontal stacked template every time — for energy, OFTEN set the CTA pill on a slight dynamic SLANT (about 6–12°), and occasionally angle a headline banner or the guarantee badge too, with bold drop-shadows or outlines, so the ad feels lively and premium rather than a rigid template. The CTA and headline still stay large, bold and instantly legible. (9) MAXIMISE SIZE + CONTRAST: push every overlay element (headline, sub-headline, CTA, badge, chips) to the largest legible size and the highest contrast against its background — err on the side of BIGGER and BOLDER. (10) NO REDUNDANT / DUPLICATE TEXT (non-negotiable): every text element in the ad — eyebrow, headline, sub-headline, badge, trust chips, CTA — must say something DIFFERENT. NEVER repeat the same phrase, claim or wording across two elements (e.g. NEVER an eyebrow "Why We\'re Different" sitting above a CTA "See Why It\'s Different", never a chip that echoes the headline). If two elements would carry the same message, drop one or reword it so each element earns its place and adds new information. (11) PACK FINE-PRINT DE-EMPHASIS: reproduce the pack\'s printed claims/fine-print lines exactly as on the reference but keep them SMALL, at true pack scale and softly out of focus — never enlarge, sharpen or zoom them into a readable focal element, never repeat any pack claim as overlay/design text, and never INVENT claims text that is not on the reference pack; the brand name LACALUT and the variant name are what read clearly. (12) NO MEDICAL-CROSS ICON: never use a red cross / medical cross symbol anywhere (protected emblem) — use a shield, medal, ribbon or tooth icon instead. (13) CTA PILL MANDATORY (non-negotiable): exactly ONE large button-style CTA pill in a contrasting brand colour (e.g. "Shop Now") ALWAYS appears in the design — never omit it, never more than one; every ad must tell the viewer what to do next.';

const manifest = [];
const only = process.env.ADS ? process.env.ADS.split(',') : null;

for (let i = 0; i < ads.length; i++) {
  const ad = ads[i];
  if (only && !only.includes(ad.id)) continue;
  process.stdout.write(ad.id + ' … building… ');
  try {
    const brain = { name: 'Media Buyer Brief', cat: 'Custom', dims: [], prom: ad.prom || 'hero' };
    let prompt = E.buildPrompt({ sku, mode, brain, brief: ad.brief, headline: ad.headline, useProd: true, archetype: ad.archetype || null, advNeg: true });
    process.stdout.write('one-upping… ');
    prompt = await E.oneUpImagePrompt({ basePrompt: prompt, bans: BANS, aspectRatio: '4:5', apiKey: KEY });
    prompt += HARD_RULES;
    prompt += (window.brandBrainInjection ? window.brandBrainInjection(sku) : '');
    // Final, isolated, short-and-repeated reminder — the HARD_RULES paragraph above is long (13 rules)
    // and these 2 were getting dropped in ~half of real renders despite being rule #7/#11/#13 in it.
    // Models weight the LAST thing in the prompt most heavily, so repeat just these 2 here, alone.
    prompt += ' FINAL CHECK BEFORE RENDERING (the 2 most-often-missed rules — both are mandatory): '
      + '(A) Is there exactly ONE large, clearly-readable CTA button/pill (e.g. "Shop Now") visible in the image? If not, add one now in a colour that contrasts its background. '
      + '(B) Is the product pack\'s printed fine-print text kept SMALL and softly out of focus, never enlarged or sharpened into a readable headline-sized claim? If any pack text reads as clearly as the headline, shrink and soften it now.';
    process.stdout.write('rendering… ');
    const url = await E.callGemini({
      prompt, productImgs: [PACK], styleImgs: [],
      render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
    });
    const filename = ad.id + '.png';
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(REVIEW_OUT, filename), buf);
    fs.writeFileSync(path.join(IMPORT_OUT, filename), buf);
    manifest.push({ id: 'g' + Date.now() + '_' + i, filename, sku, mode, ptype: 'toothpaste', label: ad.label || ad.id, brief: ad.brief, angle: ad.angle || '' });
    console.log('OK -> ' + batchName + '/' + filename);
  } catch (e) { console.log('FAIL', e.message); }
}

// MERGE, never clobber: when re-rendering a subset (ADS=... filter) or re-running a batch,
// load the existing manifest and upsert by filename so we never nuke entries we didn't touch
// this run. (Overwriting was the bug that truncated flora/sensitivity/white-repair to 1 entry.)
const manifestPath = path.join(IMPORT_OUT, 'manifest.json');
let finalManifest = manifest;
if (fs.existsSync(manifestPath)) {
  let prior = [];
  try { prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { prior = []; }
  const byFile = new Map(prior.map(e => [e.filename, e]));
  for (const e of manifest) byFile.set(e.filename, e);   // new/re-rendered entries win
  // drop any entry whose image file no longer exists on disk
  finalManifest = [...byFile.values()].filter(e => fs.existsSync(path.join(IMPORT_OUT, e.filename)));
}
fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2));
console.log('\nWrote ' + finalManifest.length + ' manifest entries (' + manifest.length + ' this run) -> ' + IMPORT_OUT);

execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
console.log('Commit + push this repo and the live engine auto-loads it on next refresh — no button, no picker.');
