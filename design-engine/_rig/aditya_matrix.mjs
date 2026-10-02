// aditya_matrix.mjs — renders the 4 AKTIV briefs from Aditya's Creative Matrix (02/10/2026),
// compliance-patched per the approved word bank. Real German packshot. ~US$0.30 total.
// Run: node _rig/aditya_matrix.mjs   (optional: ADS="c1,c3" to subset)
import fs from 'fs';
import path from 'path';

const DE = path.resolve(import.meta.dirname, '..');
const OUT = path.join(DE, '_rig', 'winner-ads', 'aditya-matrix');
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
const PACK = window.LAC_PACKS['aktiv_toothpaste'];

const HARD_RULES = ' HARD DESIGN RULES — must obey: ICON CONTRAST (icon a different colour from its label text); REALISTIC box-vs-tube proportions; PRODUCT ACCURACY — render the product EXACTLY as the attached reference packshot, never invent or anglicise pack text; TEXT HIERARCHY — headline largest; NO REDUNDANT TEXT; NO invented offers, prices, badges, review scores, star ratings or authority logos; NO English claims baked onto the pack itself; spell every on-image word EXACTLY as given, nothing more. PACK TEXT LOCK: the tube label text must be GERMAN exactly as on the attached reference packshot - if any label line is too small to reproduce faithfully, render it as a soft unreadable blur, NEVER as legible English words; absolutely NO English sentences, claims or words anywhere on the tube itself.';

const ADS = [
  {
    id: 'c1-reviews-hype',
    prompt: `Premium Facebook ad, 4:5 photoreal. The German LACALUT AKTIV tube (exactly as the attached packshot) on a clean, minimal studio background. The headline is set like a large speech bubble / quote card: "I thought the reviews were just hype." with a smaller line underneath: "Then came the tingle." Elegant, restrained, pharmacy-premium aesthetic — no clutter, no extra text.`,
  },
  {
    id: 'c2-billboard',
    prompt: `Premium Facebook ad, 4:5 photoreal. A highway billboard at golden hour with the German LACALUT AKTIV tube (exactly as the attached packshot) rendered large on the right side of the billboard. Billboard text, large and clean: "Say goodbye to gum-care gimmicks" — nothing else on the billboard. Wide cinematic sky, realistic perspective, premium out-of-home aesthetic.`,
  },
  {
    id: 'c3-burns-vs-tightens',
    prompt: `Premium Facebook ad, 4:5 photoreal split image. LEFT: a completely plain, unbranded white toothpaste tube (generic, no logo, no text except a small label below it reading "Burns.") on a dull grey background. RIGHT: the German LACALUT AKTIV tube (exactly as the attached packshot) on a warm premium background with the label "Tightens." below it. Simple, high-contrast editorial comparison layout. Only the two labels as text — no other words.`,
  },
  {
    id: 'c4-night-morning',
    prompt: `Premium Facebook ad, 4:5 photoreal, two-panel. LEFT PANEL (night): a dim, moody bathroom; a hand on the light switch; the German LACALUT AKTIV tube (exactly as the attached packshot) standing on the counter; a small caption "Last thing tonight." RIGHT PANEL (morning): the same counter bathed in soft morning sunlight, tube in the same spot, large elegant headline: "A happier mouth by morning." No review cards, no star ratings, no attribution text — just the two captions given.`,
  },
];

const only = process.env.ADS ? process.env.ADS.split(',') : null;
for (const ad of ADS) {
  if (only && !only.includes(ad.id.split('-')[0])) continue;
  process.stdout.write(ad.id + ' … ');
  try {
    let prompt = ad.prompt + HARD_RULES + (window.brandBrainInjection ? window.brandBrainInjection('aktiv') : '');
    const url = await E.callGemini({
      prompt, productImgs: [PACK], styleImgs: [],
      render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
    });
    fs.writeFileSync(path.join(OUT, ad.id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('OK -> aditya-matrix/' + ad.id + '.png');
  } catch (e) { console.log('FAIL', e.message); }
}
