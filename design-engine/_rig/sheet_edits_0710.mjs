// sheet_edits_0710.mjs — applies the Creative Strategy "Edits" tab (sheet 10GhLkTC…, gid 1012230271)
// to the 8 affected gallery creatives. EDIT jobs go through E.editImage (scene-preserving,
// photoreal-relight); REGEN jobs are full re-renders where the edit list amounts to a new
// composition (chat rebuilds, scene swaps). Outputs standalone cards (no version stacking) to
// _cli-renders-images/sheet-edits-071026 for side-by-side compare against the originals.
//
// Usage: node _rig/sheet_edits_0710.mjs            (all jobs)
//        ADS=c1v2-mints-washbasin node _rig/sheet_edits_0710.mjs   (subset re-roll)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DE = path.resolve(import.meta.dirname, '..');
const BATCH = 'sheet-edits-071026';
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
const P = window.LAC_PACKS;

const fileToDataUrl = f => {
  const b = fs.readFileSync(f);
  const mime = f.endsWith('.jpg') || f.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  return 'data:' + mime + ';base64,' + b.toString('base64');
};
const bansFor = sku => [...new Set([...(E.GLOBAL_BAN || []), ...((E.SKUS[sku] || {}).ban || [])])];

// Craft suffix for ad-style regens (not the pure chat screenshot / sign jobs)
const AD_RULES = sku => ' LABEL FIDELITY LOCK (critical): the ONLY products in frame are the ones named in the brief, copied from the attached reference packshots with label text spelled CHARACTER-FOR-CHARACTER identical to the references — never respell, never invent words; if any fine-print line is too small to render crisply, render it softly OUT OF FOCUS at pack scale instead of guessing letters. NEVER add a product box or carton, NEVER a green or translucent bottle, NEVER any product not in the references. MANDATORY CRAFT RULES: (1) PRODUCT ACCURACY: render every LACALUT product EXACTLY as its attached reference packshot — identical tube/bottle shape, cap, label layout, colours and wording; never redraw, restyle or invent packaging; keep all real German packaging accurate with no fabricated on-pack text; pack fine-print stays SMALL, at true pack scale and softly out of focus — only "LACALUT" and the variant name read clearly. (2) Exactly ONE large CTA pill ("Shop Now") in a colour that strongly contrasts its background — never the same hue as what sits behind it. (3) Headline is the largest text element; every text element says something different (no duplicated phrases). (4) No medical-cross icon anywhere. Never add any of these words/claims: ' + bansFor(sku).join(', ') + '.';

const JOBS = [
  // ───────────────────────────── EDITS (scene-preserving) ─────────────────────────────
  {
    id: 'c1v2-mints-washbasin', sku: 'flora', kind: 'gen', raw: true,
    refs: [P.flora_toothpaste, P.flora_mw_bottle],
    label: 'FLORA C1 V2 — Mints Washbasin (sheet edit)',
    prompt: 'Photorealistic 4:5 dark cinematic split composition divided by a glowing vertical light beam, matching a premium low-key product ad. LEFT HALF (cool, dim, defeated mood): a clean bathroom washbasin counter-top in moody low light holding exactly: ONE empty open metal mint tin, TWO packets of chewing gum, a few crumpled sweet wrappers, and ONE generic completely UNBRANDED mouthwash bottle (plain pale label with no brand name, no readable text) standing on the basin edge. A tidy, real washbasin — NOT garbage, NOT debris, NOT a pile of crushed tins — just the failed quick-fix arsenal laid out where someone left it. RIGHT HALF (warm hero spotlight): the real LACALUT FLORA toothpaste tube standing upright on a mound of sparkling white powder with a fresh mint sprig and a lemon-zest curl, and the real LACALUT FLORA mouthwash bottle standing beside it — BOTH rendered EXACTLY as the attached reference packshots (identical labels, colours, wording, never redrawn, no invented packaging, no boxes), dramatic rim lighting, soft mirror reflection beneath them. TEXT, exactly twice total: top-left in bold white "If Mints Worked, You Wouldn\'t Need One Every Hour." and bottom-right in bold red "2 Steps. Morning And Night." No other text, no CTA button, no badges. Pack fine-print stays tiny and softly out of focus.'
  },
  {
    id: 'c10v2-what-doesnt-work', sku: 'flora', kind: 'edit',
    base: path.join(DE, '_cli-renders-images', 'flora', 'c10-tried-everything-list.png'),
    refs: [P.flora_toothpaste, P.flora_mw_bottle],
    label: 'FLORA C10 V2 — What Doesn\'t Work Journal (sheet edit)',
    instruction: 'FOUR changes, all on the handwritten journal page and bottom-right text. (1) Change the heading from "Things I\'ve Tried:" to "What doesn\'t work:" and draw a rough hand-drawn ballpoint strike-through line through EVERY list item (Oil Pulling, Salt Water Gargle, Parsley, Tongue Scraper, Gum Every Hour, The Mouthwash That Burns) as if crossed out one by one. (2) Make ALL the handwriting look genuinely human and slightly messy/uneven — real ballpoint pen pressure on lined paper, inconsistent letter sizes and baseline, NOT neat calligraphy or a cursive font. (3) At the bottom of the page add one final handwritten line in the same messy hand, slightly heavier pen pressure, underlined: "need to solve this for once and for all". (4) REMOVE the gold/red text line "1 Thing I Hadn\'t:" near the bottom right, keeping "A German Routine Made Since 1925." where it is. PRODUCT LOCK (critical): keep ONLY the products already in the original image — the FLORA toothpaste tube and the FLORA mouthwash bottle — in their ORIGINAL positions, exactly as in the original; NEVER add any product BOX, carton or any new product that is not in the original image. Keep the pen, lighting and Shop Now button exactly as they are. LABEL FIDELITY: both product labels stay spelled CHARACTER-FOR-CHARACTER as in the original image and reference packshots — never respell any fine-print; if too small to render crisply keep it softly out of focus at pack scale'
  },
  {
    id: 'aktiv-reviews-v2', sku: 'aktiv', kind: 'edit',
    base: path.join(DE, '_cli-renders-images', 'all-existing-aktiv', 'gexist213595207.jpg'),
    refs: [P.aktiv_toothpaste],
    label: 'AKTIV Reviews Wall V2 — real comments (sheet edit)',
    instruction: 'Replace the text of TWO review cards only, keeping the identical card style, quote marks, font, size and layout. The card currently reading "A genuine German pharmacy clean every brush. — Tom L." becomes: "Love this stuff. Teeth feel clean all day long. Great results every day. — Deb W." The card currently reading "Actually makes my mouth feel deeply cared for. — Emily B." becomes: "This is a marvelous product! Works so well for me! — Carol T." Keep the first review (Sarah K.), the headline, chips, tube and everything else exactly as they are'
  },
  // ───────────────────────────── REGENERATIONS ─────────────────────────────
  {
    id: 'c4v2-text-thread', sku: 'flora', kind: 'gen',
    refs: [P.flora_toothpaste, P.flora_mw_bottle],
    label: 'FLORA C4 V2 — Text Thread iMessage (sheet edit)',
    prompt: 'Photorealistic 4:5 Facebook feed ad, split into two clearly separate zones. TOP ZONE (about 55% of height): a pixel-accurate iPhone iMessage chat screenshot — flat UI, soft white/grey background, authentic iOS rounded chat bubbles with authentic iOS typography at a natural believable size (NOT oversized display type). NO name labels or prefixes inside any bubble (never "Friend:" or "Me:" — the bubble colour and side carry who is speaking). Conversation, in order: received GREY bubble aligned LEFT: "you coming up for the presentation?" — sent BLUE bubble aligned RIGHT: "2 min" — sent BLUE bubble RIGHT: "gum, mint, quick sip of water first" — received GREY bubble LEFT: "every single time lol". The chat zone contains ONLY the chat: no headline, no products, no badges inside it, so it reads as an authentic screenshot. BOTTOM ZONE (clearly separate panel on a clean bright studio gradient with fine water splash, mint leaves and a lemon-zest curl): bold navy headline "Your 2-Minute Fresh Breath Power-Up", bold red sub-headline "Ready For Anything. Every Single Time.", the real LACALUT FLORA toothpaste tube AND the real LACALUT FLORA mouthwash bottle standing side by side (rendered exactly as the attached reference packshots), small grey line "Less prep. More talking.", and one large red "Shop Now" CTA pill.'
  },
  {
    id: 'c5v2-office-dropin', sku: 'flora', kind: 'gen',
    refs: [P.flora_toothpaste, P.flora_mw_bottle],
    label: 'FLORA C5 V2 — Office Drop-In Comparison (sheet edit)',
    prompt: 'Photorealistic 4:5 Facebook feed ad built as a LEFT vs RIGHT office comparison, both halves candid REAL office scenes (natural window light, slightly imperfect framing, believable modern Australian office, no studio polish). LEFT HALF (the problem, slightly cooler/desaturated grade): a colleague has dropped in and leans in talking beside a desk; the seated co-worker subtly leans away and turns their head aside with a polite strained smile, clearly retreating from the talker\'s breath — a faint, subtle stylised grey-green wisp drifts from the talker\'s mouth toward the retreating person (gentle, not cartoonish). Awkward body language tells the story. RIGHT HALF (the payoff, warm natural grade): candid, slightly imperfect photo — one person seated at the desk, a colleague leaning over their shoulder looking at the screen, BOTH laughing naturally, relaxed close conversation, natural light. ACROSS THE BOTTOM on a clean dark band: bold white headline "The Unexpected Desk Drop-In.", red sub-headline "Confidence For Every Close Conversation.", the real LACALUT FLORA toothpaste tube and real FLORA mouthwash bottle standing together at modest natural scale (never overpowering the scene), and one large red "Shop Now" CTA pill.'
  },
  {
    id: 'c8v2-mirror-note', sku: 'flora', kind: 'gen',
    refs: [P.flora_toothpaste, P.flora_mw_bottle],
    label: 'FLORA C8 V2 — Mirror Sticky Note Organic (sheet edit)',
    prompt: 'Photorealistic 4:5 Facebook feed ad set in a REAL everyday bathroom, candid and lived-in (slightly imperfect framing, natural morning light, a believable real washroom mirror with faint water marks — no studio polish). A woman mid-morning-routine glances at the mirror naturally — relaxed, organic, caught-in-the-moment, NOT posing or staring at camera, no heavy makeup, natural skin texture. Stuck slightly crooked on the mirror glass is ONE real yellow sticky note, applied the way people actually slap a note on a mirror, with casual okay-ish ballpoint HANDWRITING that reads exactly: "Don\'t forget this" with a small hand-drawn arrow pointing down toward the basin. On the basin shelf at the bottom of frame sit the real LACALUT FLORA toothpaste tube and real LACALUT FLORA mouthwash bottle at natural real-world scale — present and readable but never overpowering the scene, so the photo stays organic. SEPARATE CLEAN COPY BAND across the very bottom (clearly apart from the photo and apart from the sticky note): bold navy text "What You Do In The 10 Seconds After Brushing Matters." with red line "Unlock All-Day Freshness." and one large red "Shop Now" CTA pill.'
  },
  {
    id: 'aktiv-chat-v2', sku: 'aktiv', kind: 'gen', refs: [],
    label: 'AKTIV Chat V2 — Someone Else\'s Thread (sheet edit)',
    prompt: 'A pixel-accurate, completely authentic iPhone iMessage SCREENSHOT filling the entire 4:5 canvas edge to edge — flat on-screen UI only, NO phone body, bezel, hand or background scene. Top: slim iOS status bar (time 10:09 AM left, signal/wifi/battery right), then chat header with back chevron, small round grey avatar and contact name "Alex". Conversation bubbles in authentic iOS typography at NATURAL realistic message size — normal iPhone text size, organic and believable, NOT bold oversized display type; the viewer should feel they are snooping on someone else\'s real chat. In order: received GREY bubble aligned LEFT: "is it any good?" — sent BLUE bubble aligned RIGHT: "just use it for 4 brushings and feel the effects yourself" — then a small centred grey iOS date separator reading "2 days later" — received GREY bubble LEFT: "why did I not try this before?? 😭" — received GREY bubble LEFT: "my gums haven\'t felt like this in years" — sent BLUE bubble RIGHT: "told you so 😉". Slim message-input bar at the very bottom. Nothing else: no headline, no products, no badges, no logo, no CTA — the chat IS the ad. All text in casual Australian English exactly as written above, standard iOS emoji rendering.'
  },
  {
    id: 'aktiv-forehead-v2', sku: 'aktiv', kind: 'gen',
    refs: [P.aktiv_toothpaste, P.aktiv_mw_bottle],
    label: 'AKTIV Forehead V2 — 3 Brushes + Gum Smile (sheet edit)',
    prompt: 'Authentic handheld PHONE SELFIE, 4:5, of a real everyday Australian woman around 40 on a park bench in an Australian park (gum trees, soft natural afternoon light, true selfie perspective with slight lens distortion, natural skin texture, no studio look). Written on her forehead in hand-drawn black marker, slightly uneven like a friend wrote it: "3 BRUSHES IS ALL IT TAKES." She gives a big genuine open smile showing her teeth AND healthy-looking pink gums — proud, warm, a touch cheeky, gums clearly visible. Beside her on the bench sit the real LACALUT AKTIV toothpaste tube and real LACALUT AKTIV mouthwash bottle rendered exactly as the attached reference packshots. Down the RIGHT side of the image, a short clean checklist overlaid in simple white type with bright GREEN tick marks, each on its own line: "✓ Gums feel firmer" / "✓ Cared-for gums every brush" / "✓ A deep-clean feel" / "✓ 100+ years German expertise". Small red LACALUT aktiv wordmark bottom-right corner. No other overlay text, no CTA button — it must read as a real organic photo someone posted, not a produced ad.'
  }
];

const only = process.env.ADS ? process.env.ADS.split(',') : null;
const manifest = [];

for (let i = 0; i < JOBS.length; i++) {
  const j = JOBS[i];
  if (only && !only.includes(j.id)) continue;
  process.stdout.write(j.id + ' (' + j.kind + ') … ');
  try {
    let url;
    if (j.kind === 'edit') {
      url = await E.editImage({
        imgDataUrl: fileToDataUrl(j.base),
        refImgs: j.refs, sku: j.sku, apiKey: KEY,
        model: 'gemini-3-pro-image-preview',
        aspectRatio: '4:5',
        instruction: j.instruction + '. CRITICAL OUTPUT RULE: produce ONE single 4:5 PORTRAIT image with the SAME portrait composition, framing and element positions as the original — NEVER a landscape image, NEVER two versions or panels side by side, NEVER a duplicated headline, duplicated product or any repeated element. Every text element appears exactly once'
      });
    } else {
      let prompt = j.prompt;
      if (j.id !== 'aktiv-chat-v2' && j.id !== 'aktiv-forehead-v2' && !j.raw) prompt += AD_RULES(j.sku);
      else prompt += ' Never add any of these words/claims: ' + bansFor(j.sku).join(', ') + '.';
      url = await E.callGemini({
        prompt, productImgs: j.refs.filter(Boolean), styleImgs: [],
        render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: KEY, aspectRatio: '4:5'
      });
    }
    const filename = j.id + '.png';
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(REVIEW_OUT, filename), buf);
    fs.writeFileSync(path.join(IMPORT_OUT, filename), buf);
    manifest.push({ id: 'g' + Date.now() + '_' + i, filename, sku: j.sku, mode: 'social', ptype: 'toothpaste', label: j.label, brief: (j.instruction || j.prompt).slice(0, 300), angle: BATCH });
    console.log('OK');
  } catch (e) { console.log('FAIL', e.message); }
}

// MERGE manifest (upsert by filename, drop missing files) — same convention as gen_batch.mjs
const manifestPath = path.join(IMPORT_OUT, 'manifest.json');
let finalManifest = manifest;
if (fs.existsSync(manifestPath)) {
  let prior = [];
  try { prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { prior = []; }
  const byFile = new Map(prior.map(x => [x.filename, x]));
  for (const x of manifest) byFile.set(x.filename, x);
  finalManifest = [...byFile.values()].filter(x => fs.existsSync(path.join(IMPORT_OUT, x.filename)));
}
fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2));
console.log('Wrote ' + finalManifest.length + ' manifest entries -> ' + IMPORT_OUT);
execSync('node ' + JSON.stringify(path.join(DE, '_rig', 'update_cli_index.mjs')), { cwd: DE, stdio: 'inherit' });
