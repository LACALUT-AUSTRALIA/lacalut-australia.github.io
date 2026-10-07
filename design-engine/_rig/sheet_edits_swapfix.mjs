// sheet_edits_swapfix.mjs — PASS B product-accuracy fix for the sheet-edits batch:
// takes each rendered scene and editImage-swaps the hallucinated/garbled FLORA products
// for the EXACT reference packshots (relit into scene), keeping everything else identical.
// Usage: node _rig/sheet_edits_swapfix.mjs            (all)  |  ADS=c4v2-text-thread … (subset)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const BATCH = 'sheet-edits-071026';
const IMPORT_OUT = path.join(DE, '_cli-renders-images', BATCH);
const REVIEW_OUT = path.join(DE, '_rig', 'winner-ads', BATCH);

const env = fs.readFileSync('C:/Users/conta/.env', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();

global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {} };
eval(fs.readFileSync(path.join(DE, 'strategies.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'layout-archetypes.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'brand-brain.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'packs-seed.js'), 'utf8'));
const E = window.LacalutEngine;
const P = window.LAC_PACKS;
const toDataUrl = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const JOBS = [
  {
    id: 'c4v2-text-thread',
    instruction: 'In the bottom product panel: replace the translucent blue mouthwash bottle with the EXACT real LACALUT FLORA mouthwash bottle from the reference (white bottle, blue label reading "LACALUT flora Mouthwash"), and replace the toothpaste tube with the EXACT real LACALUT FLORA toothpaste tube from the reference — both standing in the same positions, same scale, same lighting and splash scene. Remove nothing else and add nothing else'
  },
  {
    id: 'c5v2-office-dropin',
    instruction: 'The two products on the desk are WRONG and must be swapped out completely. DELETE the current toothpaste tube (it has green text) and the current mouthwash bottle (green label with gibberish text) and any box. In their place put: (1) the EXACT toothpaste tube from the FIRST reference photo — white tube, red LACALUT logo, blue flora band — and (2) the EXACT mouthwash bottle from the SECOND reference photo — white opaque bottle, blue label block reading LACALUT flora Mouthwash. Copy both labels character-for-character from the references. NOTHING green may remain on either product. Same desk spot, side by side, modest scale, matching the desk lighting. Remove nothing else and add nothing else'
  },
  {
    id: 'c8v2-mirror-note',
    instruction: 'On the bathroom shelf: REMOVE the product box/carton and any extra bottles, leaving exactly TWO products — replace the toothpaste tube with the EXACT real LACALUT FLORA toothpaste tube from the reference, and replace the blue translucent mouthwash bottle with the EXACT real LACALUT FLORA mouthwash bottle from the reference (white bottle, blue label) — lying/standing naturally in the same shelf spot at the same natural scale. Remove nothing else and add nothing else'
  },
  {
    id: 'c10v2-what-doesnt-work',
    instruction: 'Replace the toothpaste tube in the foreground with the EXACT real LACALUT FLORA toothpaste tube from the reference, same lying position, angle and scale. Behind and slightly right of the tube, ADD the real LACALUT FLORA mouthwash bottle from the reference (white bottle, blue label) standing upright on the desk, lit by the same warm desk lighting. Remove nothing else and add nothing else'
  }
];

const only = process.env.ADS ? process.env.ADS.split(',') : null;
for (const j of JOBS) {
  if (only && !only.includes(j.id)) continue;
  process.stdout.write(j.id + ' (swap) … ');
  try {
    const base = path.join(IMPORT_OUT, j.id + '.png');
    const url = await E.editImage({
      imgDataUrl: toDataUrl(base),
      refImgs: [P.flora_toothpaste, P.flora_mw_bottle],
      sku: 'flora', apiKey: KEY, model: 'gemini-3-pro-image-preview',
      aspectRatio: '4:5',
      instruction: j.instruction + '. CRITICAL: ONE single 4:5 portrait image, same composition and framing as the original, every other pixel (people, scene, all overlay text, buttons) unchanged; label text on both products copied CHARACTER-FOR-CHARACTER from the references, fine-print kept small and softly out of focus at pack scale'
    });
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(IMPORT_OUT, j.id + '.png'), buf);
    fs.writeFileSync(path.join(REVIEW_OUT, j.id + '.png'), buf);
    console.log('OK');
  } catch (e) { console.log('FAIL', e.message); }
}
execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
