// flora_tattoo_fix_0810.mjs — Quan-approved direct fix (08/10/2026): AI pass = clean base
// (remove cropped tube + blue pill, re-letter tattoo as real ink). Official tube composited after via PIL.
import fs from 'fs';
import path from 'path';
const DE = path.resolve(import.meta.dirname, '..');
const OUT = path.join(DE, '_cli-renders-images', 'flora-tattoo-081026');
const env = fs.readFileSync('C:/Users/conta/.env', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['strategies.js','layout-archetypes.js','engine.js','brand-brain.js','packs-seed.js']) eval(fs.readFileSync(path.join(DE, f), 'utf8'));
const E = window.LacalutEngine;
const src = fs.readFileSync(process.argv[2]);
const instruction =
  "THREE FIXES. (1) REMOVE the toothpaste tube in the bottom-left corner completely — fill with the continuing wooden bench and background exactly as they would look. " +
  "(2) REMOVE the blue 'Shop Now' button completely — fill with the wooden bench as it would naturally continue. " +
  "(3) Re-letter the tattoo as REAL healed black tattoo ink on skin, same two lines, same words exactly: 'I never get' / 'offered gum.' — " +
  "in a bold, clean, everyday-legible tattoo script (not Comic Sans, not marker pen), slightly following the curve of her back, with subtle ink texture and skin showing through. " +
  "TATTOO SIZE — MANDATORY: EXACTLY THE SAME SIZE AND POSITION AS NOW, SPANNING THE SAME WIDTH OF HER BACK. DO NOT SHRINK IT. " +
  "Keep the woman, her hair, top, the café, ocean, umbrellas, lighting and bench exactly as they are. No new text, logos or objects";
const url = await E.editImage({ imgDataUrl: 'data:image/png;base64,' + src.toString('base64'), refImgs: [], sku: 'flora', apiKey: KEY, aspectRatio: '4:5', instruction });
fs.writeFileSync(path.join(OUT, '_clean-base-tattoo.png'), Buffer.from(url.split(',')[1], 'base64'));
console.log('OK clean base');
