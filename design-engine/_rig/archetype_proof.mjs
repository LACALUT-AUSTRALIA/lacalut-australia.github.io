// archetype_proof.mjs — 2-image proof: winner-layout archetype vs the source skeleton.
// Renders Aktiv through two archetypes with the real German packshot. ~US$0.15.
import fs from 'fs';
import path from 'path';

const DE = path.resolve(import.meta.dirname, '..');
const OUT = path.join(DE, '_rig', 'winner-ads', 'proof');
fs.mkdirSync(OUT, { recursive: true });

const env = fs.readFileSync('C:/Users/conta/.env', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();

global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {} };
eval(fs.readFileSync(path.join(DE, 'strategies.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'layout-archetypes.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'brand-brain.js'), 'utf8'));
eval(fs.readFileSync(path.join(DE, 'packs-seed.js'), 'utf8'));
const E = window.LacalutEngine;
const BRAINS = window.STRATEGY_BRAINS;
const PACK = window.LAC_PACKS['aktiv_toothpaste'];

const HARD_RULES = ' HARD DESIGN RULES — must obey: ICON CONTRAST (icon a different colour from its label text); REALISTIC box-vs-tube proportions; PRODUCT ACCURACY — render the product EXACTLY as the attached reference packshot, never invent; TEXT HIERARCHY — headline, sub-headline and CTA are the largest elements; CTA CONTRAST — the CTA pill must strongly contrast its background; NO REDUNDANT TEXT — every text element says something different.';

const TESTS = (process.env.ARCHS || 'comic-reveal-banner,problem-crush-splash').split(',');
const brain = BRAINS.find(b => b.id === 'benefit-first') || BRAINS.find(b => b.cat === 'Sales');

for (const archId of TESTS) {
  process.stdout.write(archId + ' … ');
  try {
    let prompt = E.buildPrompt({ sku: 'aktiv', mode: 'social', brain, useProd: true, archetype: archId });
    prompt += HARD_RULES + (window.brandBrainInjection ? window.brandBrainInjection('aktiv') : '');
    const url = await E.callGemini({
      prompt, productImgs: [PACK], styleImgs: [],
      render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
    });
    fs.writeFileSync(path.join(OUT, archId + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('OK -> proof/' + archId + '.png');
  } catch (e) { console.log('FAIL', e.message); }
}
