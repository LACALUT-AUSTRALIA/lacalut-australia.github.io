// pharmacy_aisle_fix_0810.mjs — editImage swap pass on pharmacy-aisle-pov-c1:
// (1) real German packshot swap (render printed English therapeutic claims out),
// (2) de-brand the competitor shelves. Standard hallucination fix, not a re-roll.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const BATCH = 'pharmacy-aisle-081026';
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
const PACK = window.LAC_PACKS['aktiv_toothpaste'];

const src = fs.readFileSync(path.join(IMPORT_OUT, 'pharmacy-aisle-pov-c1.png'));
const imgDataUrl = 'data:image/png;base64,' + src.toString('base64');

const instruction =
  "TWO fixes. (1) Replace the LACALUT aktiv tube in the hand with the EXACT real product from the reference photo — " +
  "the real GERMAN pack: same tube shape, white cap, label layout and colours, but with the pack's small printed body text " +
  "in its ORIGINAL GERMAN, rendered at true pack scale and softly out of focus so NONE of it is legible — remove every " +
  "readable English claim line currently printed on the tube; only LACALUT and 'aktiv' read clearly. Keep the tube in the " +
  "exact same position, angle, scale and grip. (2) Make every OTHER product on the shelves GENERIC and unbranded: remove or " +
  "blur all readable brand names and logos (including any Colgate or lookalike wordmarks) so no competitor brand or claim is " +
  "readable anywhere — keep the boxes' colours, shapes and out-of-focus look so the aisle still reads as a full toothpaste " +
  "aisle. Keep the bottom overlay text lines exactly as they are";

console.log('edit pass …');
const url = await E.editImage({ imgDataUrl, refImgs: [PACK], sku: 'aktiv', apiKey: KEY, aspectRatio: '4:5', instruction });
const buf = Buffer.from(url.split(',')[1], 'base64');
const filename = 'pharmacy-aisle-pov-c1v2.png';
fs.writeFileSync(path.join(IMPORT_OUT, filename), buf);
fs.writeFileSync(path.join(REVIEW_OUT, filename), buf);

const manifestPath = path.join(IMPORT_OUT, 'manifest.json');
const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byFile = new Map(prior.map(e => [e.filename, e]));
byFile.set(filename, {
  id: 'g' + Date.now(), filename, sku: 'aktiv', mode: 'social', ptype: 'toothpaste',
  label: 'AKTIV Pharmacy Aisle POV C1 v2 (German pack + de-branded shelves)',
  brief: 'POV shelf pick — aisle full of promises, this one off a German pharmacy shelf',
  angle: 'German pharmacy provenance vs aisle overwhelm', prompt: instruction
});
fs.writeFileSync(manifestPath, JSON.stringify([...byFile.values()], null, 2));
console.log('OK -> ' + filename);
execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
