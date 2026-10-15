#!/usr/bin/env node
/* Fix ONE scene by FRAME-CONTINUATION: animate scene 1's actual still (the
   correct woman) into the target scene's action — guarantees the SAME person.
   Usage: node cli/fixscene2.mjs <slug> <targetSceneNo> <anchorSceneNo=1> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE_DIR = path.resolve(__dirname, '..');
const RENDERS = path.join(ENGINE_DIR, '_cli-renders');

function loadEnv(){ const env={};
  for(const p of ['C:/Users/conta/.env', path.join(process.env.HOME||'','.env')]){
    try{ for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
      const m=line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in env)) env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim();
    } }catch(_){}
  } return env; }
const ENV = loadEnv();
const GEMINI = ENV.GEMINI_API_KEY || ENV.GOOGLE_AI_API_KEY || '';
if(!GEMINI){ console.error('No GEMINI_API_KEY'); process.exit(1); }

globalThis.window = globalThis;
globalThis.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
require(path.join(ENGINE_DIR,'strategies.js'));
const E = require(path.join(ENGINE_DIR,'engine.js'));
require(path.join(ENGINE_DIR,'packs-seed.js'));

const slug = process.argv[2];
const target = parseInt(process.argv[3]||'2',10);
const anchor = parseInt(process.argv[4]||'1',10);
const doc = JSON.parse(fs.readFileSync(path.join(RENDERS,`${slug}.script.json`),'utf8'));
const sb = doc.storyboard;
const sc = sb.scenes.find(s=>s.n===target) || sb.scenes[target-1];

const anchorStillPath = path.join(RENDERS, `${slug}.s${anchor}.still.png`);
if(!fs.existsSync(anchorStillPath)){ console.error('No anchor still: '+anchorStillPath); process.exit(1); }
const startImg = `data:image/png;base64,${fs.readFileSync(anchorStillPath).toString('base64')}`;

const prompt =
`Animate this photo into an 8-second vertical video. CRITICAL: the SAME woman in the photo stays EXACTLY as she is — identical face, identical hair, identical skin, identical white shirt, and the identical bright tiled bathroom behind her. Do NOT change her appearance, age, hair or the room in any way; this is the same person continuing from this exact frame. ACTION: ${sc.visual} ${sc.motion} She keeps a calm, gentle, natural expression, looking softly toward the camera. Subtle natural handheld sway, candid smartphone realism. Her hands stay up at chest level, away from the bench; the LACALUT tube on the bench is never touched, lifted or moved and stays exactly where it is. No on-screen text, no captions, no lettering anywhere.`;

async function once(){
  return await E.callVeoVideo({
    prompt, imgDataUrl: startImg, aspectRatio:'9:16', seconds:8, apiKey:GEMINI, asBlob:true,
    onProgress:m=>process.stdout.write(m+' · ')
  });
}
async function main(){
  console.log(`🎬 Frame-continuation: S${target} ← S${anchor}'s frame (same woman locked)`);
  let blob=null, lastErr=null;
  for(let attempt=1; attempt<=4 && !blob; attempt++){
    process.stdout.write(`  attempt ${attempt}: `);
    try{ blob = await once(); }
    catch(e){ lastErr=e; console.log(`\n  ⚠️ ${String(e.message||e).slice(0,120)}`); await new Promise(r=>setTimeout(r,15000)); }
  }
  if(!blob){ console.error('All attempts failed: '+(lastErr&&lastErr.message)); process.exit(1); }
  const buf = Buffer.from(await blob.arrayBuffer());
  const out = path.join(RENDERS, `${slug}.s${target}.mp4`);
  fs.writeFileSync(out, buf);
  console.log(`\n✅ saved ${(buf.length/1e6).toFixed(1)}MB → ${path.basename(out)}`);
}
main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
