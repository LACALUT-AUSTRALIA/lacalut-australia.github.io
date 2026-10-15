// 📋 Copy Ad — headless runner (same engine code + same Gemini models as the Design Engine's Copy Ad popup).
// Usage: node copyad_run.js <ref.png> <packshot.png> <sku> <out.png> [changes.txt]
// Env:   COPYAD_BATCH=<batch-name>  → auto-ingests the render into design-engine/_cli-renders-images/<batch>/ (engine auto-loads it on next page load after push)
//        COPYAD_LABEL="<card label>" (optional)
//        COPYAD_EXTRAS="path1.png,path2.png" (optional — e.g. a real customer avatar; sent as EXTRA REFERENCE images)
// Output is ALWAYS 4:5 (Quan hard rule 15/10/2026).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DE = 'C:/Users/conta/lacalut-pages/design-engine';
const key = (fs.readFileSync('C:/Users/conta/.env', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
global.window = global; global.localStorage = { getItem: () => null, setItem() {} };
require(DE + '/strategies.js'); require(DE + '/engine.js');
const E = global.LacalutEngine;
const toData = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const [refP, packP, sku, outP, changesP] = process.argv.slice(2);
const AR = '4:5';
(async () => {
  const ref = toData(refP), pack = toData(packP);
  const extras = (process.env.COPYAD_EXTRAS || '').split(',').map(s => s.trim()).filter(Boolean).map(toData);
  const spec = await E.describeAd({ refImg: ref, apiKey: key });
  // Working files (spec/prompt) NEVER go to Downloads (Quan 15/10) — they live in design-engine/_copyad_work/
  const WORK = DE + '/_copyad_work'; fs.mkdirSync(WORK, { recursive: true });
  const stem = path.basename(outP, '.png');
  fs.writeFileSync(WORK + '/' + stem + '_spec.txt', spec);
  const changes = changesP ? fs.readFileSync(changesP, 'utf8') : '';
  const prompt = E.buildCopyPrompt({ sku, spec, changes, advNeg: true, ar: AR });
  const promptFile = WORK + '/' + stem + '_prompt.txt';
  fs.writeFileSync(promptFile, prompt);
  console.log('aspect', AR, '| extras', extras.length, '| spec chars', spec.length, '| prompt chars', prompt.length);
  const url = await E.callGemini({ prompt, productImgs: [pack], copyRef: ref, copyExtras: extras, apiKey: key, model: 'gemini-3-pro-image-preview', aspectRatio: AR });
  fs.writeFileSync(outP, Buffer.from(url.split(',')[1], 'base64'));
  console.log('render OK ->', outP);
  const batch = process.env.COPYAD_BATCH;
  if (batch) {
    const label = process.env.COPYAD_LABEL || ('📋 Copy Ad · ' + path.basename(outP, '.png'));
    const firstLine = (changes.split(/\r?\n/)[0] || '').slice(0, 160);
    const out = execFileSync('python', ['-I', DE + '/cli/ingest_images.py', batch, sku, label, outP,
      '--mode', 'social', '--ar', AR, '--brief', 'COPY AD — ' + firstLine, '--prompt-file', promptFile], { encoding: 'utf8' });
    console.log(out.trim(), '-> commit + push lacalut-pages to make it live');
  }
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
