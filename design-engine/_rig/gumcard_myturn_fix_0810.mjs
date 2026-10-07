// gumcard_myturn_fix_0810.mjs — editImage packshot swap on card-mum-myturn (tube renders
// garbled/warped). Scene, card, ribbon and wrap stay; only the tube is replaced with the
// exact reference pack. (Quan 08/10/2026: other two cards' tubes are fine — this one only.)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const BATCH = 'gumcard-family-081026';
const IMPORT_OUT = path.join(DE, '_cli-renders-images', BATCH);

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

const src = fs.readFileSync(path.join(IMPORT_OUT, 'card-mum-myturn.png'));
const imgDataUrl = 'data:image/png;base64,' + src.toString('base64');

const instruction =
  "Replace the LACALUT aktiv toothpaste tube lying on the brown paper with the EXACT real product from the reference photo — " +
  "same tube shape, white cap, correct label layout, logo and colours, lying in the exact same position, angle and scale, " +
  "with the red ribbon still tied around it exactly as it is now. The tube's small printed body text stays at true pack scale " +
  "and softly out of focus so none of it is legible — only LACALUT and 'aktiv' read clearly. " +
  "Keep the greeting card, its text, the table, background and lighting completely untouched";

console.log('edit pass …');
const url = await E.editImage({ imgDataUrl, refImgs: [PACK], sku: 'aktiv', apiKey: KEY, aspectRatio: '4:5', instruction });
const buf = Buffer.from(url.split(',')[1], 'base64');
const filename = 'card-mum-myturn-v2.png';
fs.writeFileSync(path.join(IMPORT_OUT, filename), buf);

const manifestPath = path.join(IMPORT_OUT, 'manifest.json');
const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byFile = new Map(prior.map(e => [e.filename, e]));
const base = byFile.get('card-mum-myturn.png') || {};
byFile.set(filename, { ...base, id: 'g' + Date.now(), filename, label: (base.label || 'card-mum-myturn') + ' v2 (tube swap)', prompt: instruction });
fs.writeFileSync(manifestPath, JSON.stringify([...byFile.values()], null, 2));
console.log('OK -> ' + filename);
execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
