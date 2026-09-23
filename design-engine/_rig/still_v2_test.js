/* Packshot-compositing v2 still test — image calls only, NO Veo.
   Renders S3 (pack scene) of the approved Problem→Solve board twice:
   v1 single-pass vs v2 plate+insert, saves all frames for eyeball QC. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = globalThis;
require(path.join(__dirname, '..', 'strategies.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

const API_KEY = (fs.readFileSync('C:/Users/conta/.env', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
const PACKSHOT = 'C:/Users/conta/Downloads/04970310_Lac_MuSp_aktiv_FS_300_D_1~-~media--1d2e2921--query@2x.png';
const outDir = path.join(__dirname, 'results', 'v2test');
fs.mkdirSync(outDir, { recursive: true });

const b64 = fs.readFileSync(PACKSHOT).toString('base64');
const packRef = 'data:image/png;base64,' + b64;

const sb = {
  styleAnchor: 'Authentic handheld smartphone footage in a sunlit lived-in Australian home kitchen, natural daylight, warm lo-fi realism, never studio polish.',
  character: 'Sarah, 32, Caucasian, shoulder-length wavy brown hair with subtle highlights, wearing a light blue linen shirt. Thoughtful, approachable look.',
  world: 'A sunlit, lived-in Australian home kitchen. Light wooden benchtop, speckled white tiles, cream-painted wall with a window letting in natural daylight. Props: a ceramic coffee mug, a clear drinking glass, a modern smartphone.',
  scenes: []
};
const s1 = { n: 1, visual: "A slightly Dutch-angled shot of Sarah's hands loosely holding a clear drinking glass on a sunlit wooden kitchen counter.", text: 'Is this what your gums are missing?' };
const s3 = { n: 3, visual: 'The LACALUT Aktiv toothpaste pack, front label facing camera, standing on the same kitchen counter, with a simple, everyday toothbrush nearby.', text: 'Give Your Gums The German Care.' };

function save(name, dataUrl) {
  fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved ' + name);
}

function stillPrompt(sc, anchors, noProduct) {
  const st = E.videoStyle('lofi_native');
  let sp = `Opening FRAME of a video ad scene for LACALUT Aktiv (German pharmacy oral-care brand). `;
  sp += `VISUAL LOOK (hard rule): ${st.motion} The frame must read as a candid smartphone photo a real person took — natural imperfect framing, real-world light — NOT a glossy studio ad. `;
  sp += `SCENE: ${sc.visual}. SHARED STYLE: ${sb.styleAnchor}. `;
  sp += `WORLD LOCK: every scene of this ad is shot inside EXACTLY this one location — ${sb.world} — same set, surfaces, lighting, palette. `;
  sp += anchors.length ? `CONTINUITY REFERENCE: the style-reference image(s) are earlier frames of this SAME ad — match their exact location, surfaces, lighting and world; do not copy their composition. ` : '';
  sp += `ON-SCREEN CAPTION (exact wording, mandatory): "${sc.text}" — LARGE, bold, clean sans-serif, high-contrast, every word correctly spelled. `;
  sp += `TEXT LOCK: no other text anywhere. CHARACTER LOCK: if a person appears it is exactly: ${sb.character}. `;
  sp += noProduct
    ? `BASE PLATE (hard rule): stage the scene exactly as described but WITHOUT the LACALUT pack or any toothpaste product anywhere in the frame — the real product photo is composited in afterwards; leave its resting spot clear, naturally lit and in focus. `
    : `PRODUCT LOCK: reproduce the reference packshot EXACTLY — real German packaging, WHITE cap, tall slim proportions, front label facing camera, under 30% of frame height, never re-letter or garble the text. `;
  sp += `9:16 aspect ratio, photoreal, candid phone-shot realism, composed with headroom for motion.`;
  return sp;
}

(async () => {
  // Scene 1 still = world anchor
  const s1Still = await E.callGemini({ prompt: stillPrompt(s1, [], true), productImgs: [], styleImgs: [],
    render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: API_KEY, aspectRatio: '9:16' });
  save('s1_anchor.png', s1Still);

  // v1 single-pass S3
  const v1 = await E.callGemini({ prompt: stillPrompt(s3, [s1Still], false), productImgs: [packRef], styleImgs: [s1Still],
    render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: API_KEY, aspectRatio: '9:16' });
  save('s3_v1_singlepass.png', v1);

  // v2 pass A plate
  const plate = await E.callGemini({ prompt: stillPrompt(s3, [s1Still], true), productImgs: [], styleImgs: [s1Still],
    render: 'photoreal', model: 'gemini-3-pro-image-preview', apiKey: API_KEY, aspectRatio: '9:16' });
  save('s3_v2_plate.png', plate);

  // v2 pass B insert
  const v2 = await E.editImage({ imgDataUrl: plate, refImgs: [packRef], sku: 'aktiv', apiKey: API_KEY,
    model: 'gemini-3-pro-image-preview', aspectRatio: '9:16',
    instruction: `INSERT the LACALUT Aktiv product from the reference packshot into this scene — ${s3.visual}. It stands upright with its front label facing camera dead-on, real GERMAN label, WHITE cap, true tall-slim proportions, occupying no more than 30% of the frame height, lit by the scene's existing light with a soft natural contact shadow grounding it on the counter. Reproduce the reference label EXACTLY — never re-letter, translate, enlarge or garble it; small German pack text stays soft and unreadable` });
  save('s3_v2_composited.png', v2);
  console.log('DONE — compare s3_v1_singlepass vs s3_v2_composited against s1_anchor world');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
