// pharmacy_aisle_0810.mjs — one-off native/candid render (anti-fancy doctrine, sign-style
// bypass of One-Up + CTA-pill HARD_RULES — same reasoning as gen_batch's isSign path).
// Quan-approved prompt verbatim (08/10/2026) + the standing pack fine-print lock.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const BATCH = 'pharmacy-aisle-081026';
const REVIEW_OUT = path.join(DE, '_rig', 'winner-ads', BATCH);
const IMPORT_OUT = path.join(DE, '_cli-renders-images', BATCH);
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
const PACK = window.LAC_PACKS['aktiv_toothpaste'];
if (!PACK) { console.error('No aktiv_toothpaste packshot'); process.exit(1); }

const prompt =
  "Candid phone photo, POV from a shopper's eyes in an Australian pharmacy oral-care aisle. " +
  "Shelves stacked floor to ceiling with GENERIC unbranded toothpaste boxes in assorted colours — all slightly out of focus, NO readable brand names or claims anywhere on them. " +
  "A woman's hand lifts a single LACALUT aktiv tube and box off the shelf toward camera — the ONLY crisp in-focus element, label square to camera, true real-world size, matching the aisle's cool fluorescent lighting with a natural contact shadow where it left the shelf. " +
  "Render the LACALUT product EXACTLY as the attached reference packshot — identical tube/box shape, white cap, label layout, colours and wording; never restyle or redraw it. " +
  "Realistic pharmacy lighting, slight phone-camera grain and imperfection — an everyday snapshot, NOT a polished ad. No sparkles, glows, floating objects, buttons or badges. " +
  'TEXT as overlay layers (large, two lines, bottom third, white on a soft dark feathered scrim — no hard box): headline "The toothpaste aisle is bloody full of promises." sub-line "This one comes off a German pharmacy shelf. Since 1925." Large enough to read on a small mobile feed. No other text anywhere. ' +
  "PACK FINE-PRINT LOCK (mandatory): keep the pack's small printed body text in its ORIGINAL GERMAN, at true pack scale and softly out of focus so none of it is legible — only LACALUT and the variant name read clearly; never render readable English health or treatment claims anywhere. " +
  "4:5 aspect ratio, crisp legible overlay typography, no spelling errors on any text.";

const filename = 'pharmacy-aisle-pov-c1.png';
console.log('rendering pharmacy-aisle-pov-c1 …');
const url = await E.callGemini({
  prompt, productImgs: [PACK], productLabels: null, styleImgs: [],
  render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
});
const buf = Buffer.from(url.split(',')[1], 'base64');
fs.writeFileSync(path.join(REVIEW_OUT, filename), buf);
fs.writeFileSync(path.join(IMPORT_OUT, filename), buf);

const manifestPath = path.join(IMPORT_OUT, 'manifest.json');
let prior = [];
if (fs.existsSync(manifestPath)) { try { prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { prior = []; } }
const byFile = new Map(prior.map(e => [e.filename, e]));
byFile.set(filename, {
  id: 'g' + Date.now(), filename, sku: 'aktiv', mode: 'social', ptype: 'toothpaste',
  label: 'AKTIV Pharmacy Aisle POV C1', brief: 'POV shelf pick — aisle full of promises, this one off a German pharmacy shelf',
  angle: 'German pharmacy provenance vs aisle overwhelm', prompt
});
fs.writeFileSync(manifestPath, JSON.stringify([...byFile.values()], null, 2));
console.log('OK -> ' + IMPORT_OUT + '\\' + filename);
execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
