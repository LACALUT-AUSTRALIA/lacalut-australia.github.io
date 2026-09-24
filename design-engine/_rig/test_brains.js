/* Test-generate sample ads from 4 rebuilt brains (~$0.80 images, no Veo). */
'use strict';
const fs = require('fs'), path = require('path');
global.window = globalThis;
require(path.join(__dirname, '..', 'strategies.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const API_KEY = (fs.readFileSync('C:/Users/conta/.env', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
const packRef = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'results', 'v2test', 'packref_0.png')).toString('base64');
const outDir = path.join(__dirname, 'results', 'brains2409');
fs.mkdirSync(outDir, { recursive: true });

const IDS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['benefit-first', 'trust-proof', 'christmas-festive', 'ugc-shelfie'];

(async () => {
  for (const id of IDS) {
    const brain = global.STRATEGY_BRAINS.find(b => b.id === id);
    try {
      const r = await E.generateImage({ sku: 'aktiv', mode: 'ad', brain, apiKey: API_KEY,
        refImgDataUrl: packRef, refImgs: [packRef], render: 'photoreal' });
      const dataUrl = r.url;
      fs.writeFileSync(path.join(outDir, id + '.png'), Buffer.from(String(dataUrl).split(',')[1], 'base64'));
      console.log('✓ ' + id);
    } catch (e) { console.log('✗ ' + id + ' — ' + e.message); }
    await new Promise(r => setTimeout(r, 2000));
  }
})();
