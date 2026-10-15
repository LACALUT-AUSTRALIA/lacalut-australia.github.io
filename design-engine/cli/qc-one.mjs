#!/usr/bin/env node
/* Ad-hoc QC of a single rendered scene mp4 — reuses engine.qcSceneClip. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE_DIR = path.resolve(__dirname, '..');

function loadEnv(){
  const env = {};
  for (const p of ['C:/Users/conta/.env', path.join(process.env.HOME||'', '.env')]) {
    try { for (const line of fs.readFileSync(p,'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g,'').trim();
    } } catch(_){}
  }
  return env;
}
const ENV = loadEnv();
const GEMINI = ENV.GEMINI_API_KEY || ENV.GOOGLE_AI_API_KEY || '';

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsDataURL(blob){
      blob.arrayBuffer().then(ab => {
        this.result = `data:${blob.type||'application/octet-stream'};base64,${Buffer.from(ab).toString('base64')}`;
        this.readyState = 2;
        this.onload && this.onload({ target: this });
        this.onloadend && this.onloadend({ target: this });
      }).catch(e => { this.onerror && this.onerror(e); });
    }
  };
}

require(path.join(ENGINE_DIR, 'strategies.js'));
const E = require(path.join(ENGINE_DIR, 'engine.js'));
require(path.join(ENGINE_DIR, 'packs-seed.js'));

const slug = process.argv[2];
const sceneNo = parseInt(process.argv[3] || '1', 10);
const doc = JSON.parse(fs.readFileSync(path.join(ENGINE_DIR,'_cli-renders',`${slug}.script.json`),'utf8'));
const sb = doc.storyboard;
const scene = (sb.scenes||[]).find(s => s.n === sceneNo) || sb.scenes[sceneNo-1];
const mp4 = path.join(ENGINE_DIR,'_cli-renders',`${slug}.s${sceneNo}.mp4`);
const buf = fs.readFileSync(mp4);
const blob = new Blob([buf], { type: 'video/mp4' });

(async () => {
  console.error(`[qc] scene ${sceneNo}, blob ${(buf.length/1e6).toFixed(1)}MB, key ${GEMINI?'present':'MISSING'}`);
  try {
    const q = await E.qcSceneClip({ videoBlob: blob, scene, storyboard: sb, sku: doc.meta.sku, apiKey: GEMINI });
    console.log(JSON.stringify(q, null, 2));
  } catch (e) {
    console.error('[qc] error:', e && e.message ? e.message : e);
  }
  process.exit(0);
})();
