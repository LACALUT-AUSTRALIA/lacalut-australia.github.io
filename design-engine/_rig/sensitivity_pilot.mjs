// sensitivity_pilot.mjs — pilot render of 3 SENSITIVE briefs from Aditya's Creative Matrix (02/10/2026),
// verbatim copy cross-checked against the sheet twice. Real German SENSITIVE tube packshot only.
// Adds the One-Up Loop (draft->pinnacle, 4 rounds) before every generate — AKTIV's script skipped this.
// Run: node _rig/sensitivity_pilot.mjs   (optional: ADS="c1,c3" to subset)
import fs from 'fs';
import path from 'path';

const DE = path.resolve(import.meta.dirname, '..');
const OUT = path.join(DE, '_rig', 'winner-ads', 'sensitivity-matrix');
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
const PACK = window.LAC_PACKS['sensitive_toothpaste'];
const BANS = [...new Set([...(E.GLOBAL_BAN||[]), ...((E.SKUS.sensitive||{}).ban||[])])];

const HARD_RULES = ' HARD DESIGN RULES — must obey: ICON CONTRAST (icon a different colour from its label text); REALISTIC box-vs-tube proportions; PRODUCT ACCURACY — render the product EXACTLY as the attached reference packshot, never invent or anglicise pack text; TEXT HIERARCHY — headline largest; NO REDUNDANT TEXT; NO invented offers, prices, badges, review scores, star ratings or authority logos; NO English claims baked onto the pack itself; spell every on-image word EXACTLY as given, nothing more. PACK TEXT LOCK: the tube label text must be GERMAN exactly as on the attached reference packshot - if any label line is too small to reproduce faithfully, render it as a soft unreadable blur, NEVER as legible English words; absolutely NO English sentences, claims or words anywhere on the tube itself.';

// Verbatim from the sheet (cross-checked twice, SENSITIVITY section, Creatives 1-3) — on-image text + small
// line only baked into the image; the long "Primary text" is Meta ad body copy, never rendered into pixels.
const BOLD = ' CRITICAL TEXT TREATMENT — this is a TOP-TIER, SCROLL-STOPPING META ADS headline system, not a caption: the headline MUST be set in an ULTRA-BOLD, HEAVY BLACK-WEIGHT modern sans-serif (Helvetica Neue Black / Inter Black / Archivo Black style — thick, confident, zero thin strokes), occupying AT LEAST 20% of the total frame height, placed on a solid high-contrast colour block or scrim (white or deep LACALUT red #cf102d) so it reads INSTANTLY even against a busy photo — never float plain text directly over a photo with no contrast treatment. This is the single dominant element of the whole ad — bigger and bolder than the product itself. The small line underneath acts as the CTA/payoff line: bold, same font family, clearly legible, on its own contrast block, never thin or faint. ANY other label text (category tags, captions on sub-elements) MUST use the SAME ultra-bold weight and HIGH-CONTRAST block treatment — never same-tone-on-tone, never thin, never small. A render with a weak, thin, low-contrast or caption-style headline is a FAILED render — redo the type treatment, not the scene. Do not shrink any text to fit — expand its contrast block instead.';

const HUMAN_REAL = " HUMAN REALISM (critical — this image was previously REJECTED for looking like an uncanny, overly-posed AI glamour render): the person must look like a REAL, ORDINARY candid photo, NOT a stock-photo model or AI-generated face. Natural, imperfect skin texture with visible pores and subtle asymmetry — NEVER airbrushed, doll-like, plastic or overly smooth. Correct, ordinary human anatomy: natural jaw/neck/lip proportions, a believable straw-to-mouth contact point, a natural unglamorous hand position holding the glass. The framing should feel like an unposed candid snapshot — slightly imperfect angle, natural expression, NOT a beauty/glamour pose, NOT sexualised, NOT styled like a cosmetics ad. If in doubt, make it look MORE like a real customer photo and LESS like a polished model shoot.";

const ADS = [
  {
    id: 'c1-iced-water',
    prompt: `Premium Facebook ad, 4:5 photoreal. Close-up of an ordinary person's hand holding a tall glass of iced water with a straw, on a cafe table in natural light. The real German LACALUT SENSITIVE tube (exactly as the attached packshot) sits on the table beside the glass. MASSIVE, bold, high-contrast headline text dominating the top third of the frame: "Why some people drink iced water through a straw" with a bold (not fine-print) smaller line underneath: "It's not for the ice." No other text anywhere in the image.` + BOLD + HUMAN_REAL,
  },
  {
    id: 'c2-hot-tap',
    prompt: `Premium Facebook ad, 4:5 photoreal. A toothbrush held under a running, steaming hot tap at a bathroom sink. The real German LACALUT SENSITIVE tube (exactly as the attached packshot) stands on the sink edge. MASSIVE, bold, high-contrast headline text dominating the top third of the frame: "Why some people warm their toothbrush under the hot tap" with a bold (not fine-print) smaller line underneath: "Cold water on sensitive teeth. Ouch." No other text anywhere in the image.` + BOLD,
  },
  {
    id: 'c3-bite-vs-lick',
    prompt: `Premium Facebook ad, 4:5 photoreal split image. LEFT: a perfectly round ice cream cone, only licked, with a LARGE, BOLD, HIGH-CONTRAST label directly beneath it in heavy block capitals reading "LICKERS" — this label MUST be big enough to read instantly, same visual weight as a headline, never small or thin. RIGHT: an identical ice cream cone with a clean bite taken out of it, with an equally LARGE, BOLD, HIGH-CONTRAST label beneath it in heavy block capitals reading "BITERS." The real German LACALUT SENSITIVE tube (exactly as the attached packshot), small, bottom right corner — the tube stays small, but LICKERS and BITERS must NOT be small. MASSIVE, bold headline text dominating the top of the frame: "Some people bite their ice cream. Some people lick it." with a bold (not fine-print) smaller line underneath: "The lickers usually have a reason." No other text anywhere in the image.` + BOLD,
  },
];

const only = process.env.ADS ? process.env.ADS.split(',') : null;
for (const ad of ADS) {
  if (only && !only.includes(ad.id.split('-')[0])) continue;
  process.stdout.write(ad.id + ' … one-upping… ');
  try {
    let basePrompt = ad.prompt + HARD_RULES + (window.brandBrainInjection ? window.brandBrainInjection('sensitive') : '');
    const prompt = await E.oneUpImagePrompt({ basePrompt, bans: BANS, aspectRatio: '4:5', apiKey: KEY });
    process.stdout.write('rendering… ');
    const url = await E.callGemini({
      prompt, productImgs: [PACK], styleImgs: [],
      render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
    });
    fs.writeFileSync(path.join(OUT, ad.id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('OK -> sensitivity-matrix/' + ad.id + '.png');
  } catch (e) { console.log('FAIL', e.message); }
}
