/* v2 pass-B retest: correct engine-stored tube ref + fixed insertion instruction. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = globalThis;
require(path.join(__dirname, '..', 'strategies.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const API_KEY = (fs.readFileSync('C:/Users/conta/.env', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
const dir = path.join(__dirname, 'results', 'v2test');
const packRef = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, 'packref_0.png')).toString('base64');
const plate = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, 's3_v2_plate.png')).toString('base64');
const visual = 'The LACALUT Aktiv toothpaste pack, front label facing camera, standing on the same kitchen counter, with a simple, everyday toothbrush nearby.';

(async () => {
  const v2 = await E.editImage({ imgDataUrl: plate, refImgs: [packRef], sku: 'aktiv', apiKey: API_KEY,
    model: 'gemini-3-pro-image-preview', aspectRatio: '9:16',
    instruction: `INSERT the LACALUT Aktiv product from the reference packshot into this scene — ${visual}. It stands upright with its front label facing camera dead-on, keeping the reference pack's EXACT physical format and proportions (tube, box or bottle exactly as photographed — never morph one format into another), real GERMAN label, WHITE cap, occupying no more than 30% of the frame height, lit by the scene's existing light with a soft natural contact shadow grounding it on the surface. Place it fully CLEAR of any on-screen caption text — the pack and the caption must never overlap and the caption stays fully readable. Reproduce the reference label EXACTLY — never re-letter, translate, enlarge or garble it; small pack text stays soft and unreadable` });
  fs.writeFileSync(path.join(dir, 's3_v2b_composited.png'), Buffer.from(v2.split(',')[1], 'base64'));
  console.log('saved s3_v2b_composited.png');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
