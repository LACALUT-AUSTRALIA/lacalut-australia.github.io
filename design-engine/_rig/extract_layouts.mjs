#!/usr/bin/env node
/* extract_layouts.mjs — Layout-Archetype Library extractor (Phase 4 #3)
   Reads winner ad images from a folder, asks Gemini vision to extract each ad's
   LAYOUT STRUCTURE (not its content) as strict JSON, writes one JSON per image
   plus a merged layouts.json ready for authoring into layout-archetypes.js.

   Usage:  node extract_layouts.mjs <inputDir> [outDir]
   Needs:  GEMINI_API_KEY in C:/Users/conta/.env
*/
import fs from 'fs';
import path from 'path';

const ENV = 'C:/Users/conta/.env';
const key = (fs.readFileSync(ENV, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('No GEMINI_API_KEY in ~/.env'); process.exit(1); }

const inDir = process.argv[2] || 'winner-ads/raw';
const outDir = process.argv[3] || 'winner-ads/layouts';
fs.mkdirSync(outDir, { recursive: true });

const MODEL = 'gemini-2.5-flash'; // vision + JSON, cheap; layout analysis needs no image gen
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const SCHEMA_PROMPT = `You are a senior direct-response art director reverse-engineering a WINNING Facebook/Instagram ad.
Extract ONLY its LAYOUT STRUCTURE — the reusable skeleton — never its brand, product, copy or imagery content.

Return STRICT JSON (no markdown fences, no commentary) with exactly this shape:
{
  "canvasRatio": "e.g. 1:1 / 4:5 / 9:16 (best guess)",
  "styleFamily": "one of: lifestyle-photo | studio-product | flat-graphic | ugc-candid | editorial-press | meme-native | screenshot-native | split-comparison | illustration",
  "gridDNA": "one sentence: the underlying grid/structure (e.g. 'full-bleed photo, left-aligned type column occupying left 45%, product anchored bottom-right')",
  "zones": [
    {
      "role": "headline | subheadline | body | product | human | background | badgeRow | trustRow | cta | logo | price | offer | proof | arrow-device | caption | other",
      "position": "precise placement, e.g. 'top-left, starting 6% from top'",
      "sizePct": 0,
      "align": "left | centre | right",
      "treatment": "visual treatment: colour, weight, container (scrim/pill/none), case",
      "note": "anything structurally important about this zone"
    }
  ],
  "typeScale": "headline vs sub vs body relative sizes, e.g. 'headline ~12% of canvas height, sub ~5%, body ~3%'",
  "colourBlocking": "how colour divides the canvas structurally (e.g. 'top 60% photo, bottom 40% solid brand colour band')",
  "hierarchy": ["ordered list of zone roles by visual weight, strongest first"],
  "negativeSpace": "where the breathing room is and why it works",
  "eyePath": "the path the eye travels, e.g. 'human face -> headline -> product -> cta'",
  "whyItWins": "ONE sentence: the structural reason this layout converts (not the copy)",
  "productPresence": "hero | secondary | cameo | none",
  "humanPresence": "none | face-crop | chest-up | full-body | hands-only",
  "textDensity": "minimal | moderate | heavy"
}
sizePct = % of total canvas area the zone occupies (integer).
Be forensic and specific about positions and proportions — this JSON will be used to regenerate the same skeleton with a different brand.`;

async function extractOne(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  const b64 = fs.readFileSync(path.join(inDir, file)).toString('base64');
  const body = {
    contents: [{ role: 'user', parts: [{ text: SCHEMA_PROMPT }, { inlineData: { mimeType: mime, data: b64 } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 90000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'HTTP ' + res.status);
    const txt = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return JSON.parse(txt.replace(/^```json\s*|```\s*$/g, ''));
  } finally { clearTimeout(t); }
}

const files = fs.readdirSync(inDir).filter(f => MIME[path.extname(f).toLowerCase()]);
console.log(`${files.length} images in ${inDir}`);
const merged = [];
for (const f of files) {
  const slug = path.basename(f, path.extname(f)).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const outFile = path.join(outDir, slug + '.json');
  if (fs.existsSync(outFile)) { merged.push(JSON.parse(fs.readFileSync(outFile, 'utf8'))); console.log('skip (done)', f); continue; }
  try {
    const j = await extractOne(f);
    if (!j) continue;
    j.id = slug; j.sourceFile = f;
    fs.writeFileSync(outFile, JSON.stringify(j, null, 2));
    merged.push(j);
    console.log('OK ', f, '->', j.styleFamily, '|', (j.whyItWins || '').slice(0, 80));
  } catch (e) { console.error('FAIL', f, e.message); }
}
fs.writeFileSync(path.join(outDir, '_all-layouts.json'), JSON.stringify(merged, null, 2));
console.log(`\nDone: ${merged.length}/${files.length} -> ${outDir}/_all-layouts.json`);
