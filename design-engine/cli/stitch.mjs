#!/usr/bin/env node
/* Stitch a CLI-rendered slug into a final mp4 WITH narrator VO (Gemini TTS)
   baked in — replicates engine.stitchScenes' VO path with native ffmpeg.
   Usage: node cli/stitch.mjs <slug> [outPath]
   Reads design-engine/_cli-renders/{slug}.script.json + {slug}.sN.mp4 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE_DIR = path.resolve(__dirname, '..');
const RENDERS = path.join(ENGINE_DIR, '_cli-renders');

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
if(!GEMINI){ console.error('No GEMINI_API_KEY'); process.exit(1); }

// find ffmpeg (WinGet Gyan build, else PATH)
function findFFmpeg(){
  const g = '/c/Users/conta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe';
  const win = g.replace(/^\/c\//,'C:/');
  if(fs.existsSync(win)) return win;
  return 'ffmpeg';
}
const FF = findFFmpeg();
const ff = (args) => execFileSync(FF, ['-y', ...args], { stdio:['ignore','ignore','pipe'] });

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
require(path.join(ENGINE_DIR,'strategies.js'));
const E = require(path.join(ENGINE_DIR,'engine.js'));
require(path.join(ENGINE_DIR,'packs-seed.js'));

const slug = process.argv[2];
if(!slug){ console.error('Pass <slug>'); process.exit(1); }
const outArg = process.argv[3];
const doc = JSON.parse(fs.readFileSync(path.join(RENDERS,`${slug}.script.json`),'utf8'));
const sb = doc.storyboard, meta = doc.meta;
const scenes = (sb.scenes||[]);
const secs = 8;

const tmp = path.join(RENDERS, `_tmp_${slug}`);
fs.mkdirSync(tmp, { recursive: true });

async function main(){
  // 1) TTS each VO line → padded wav
  const voiceDesc = sb.voice || sb.character || 'a warm Australian voice, natural pace';
  const padded = [];
  for(let i=0;i<scenes.length;i++){
    const line = (scenes[i].vo||'').trim();
    process.stdout.write(`  S${i+1} VO → TTS… `);
    const wavBlob = await E.ttsLine({ text: line, voiceDesc, apiKey: GEMINI });
    const raw = path.join(tmp, `v${i}.wav`);
    fs.writeFileSync(raw, Buffer.from(await wavBlob.arrayBuffer()));
    const pad = path.join(tmp, `p${i}.wav`);
    ff(['-i', raw, '-af', 'apad', '-t', String(secs), pad]);   // pad to the 8s scene slot
    padded.push(pad);
    console.log('ok');
  }
  // 2) concat the scene mp4s (re-encode to a uniform codec)
  const listV = path.join(tmp, 'listv.txt');
  fs.writeFileSync(listV, scenes.map((_,i)=>`file '${path.join(RENDERS,`${slug}.s${i+1}.mp4`).replace(/\\/g,'/')}'`).join('\n'));
  const stitched = path.join(tmp, 'stitched.mp4');
  ff(['-f','concat','-safe','0','-i',listV,'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac',stitched]);
  // 3) concat padded VO wavs → one continuous narrator track
  const voWav = path.join(tmp, 'vo.wav');
  const insV = []; padded.forEach(p=>insV.push('-i',p));
  ff([...insV,'-filter_complex', padded.map((_,i)=>`[${i}:a]`).join('')+`concat=n=${padded.length}:v=0:a=1[vo]`,'-map','[vo]',voWav]);
  // 4) mux: duck ambience hard + narrator on top
  const who = slug.includes('woman')?'woman':(slug.includes('man')?'man':'');
  const out = outArg || `C:\\Users\\conta\\Downloads\\LACALUT-${meta.sku.toUpperCase()}-${meta.type}-${who}-24s-VO.mp4`;
  ff(['-i',stitched,'-i',voWav,'-filter_complex','[0:a]volume=0.12[bg];[bg][1:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac',out]);
  console.log(`✅ VO baked → ${out}`);
  // cleanup
  try{ fs.rmSync(tmp,{recursive:true,force:true}); }catch(_){}
  return out;
}
main().then(()=>process.exit(0)).catch(e=>{ console.error('stitch error:', e.message||e); process.exit(1); });
