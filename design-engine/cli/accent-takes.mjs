#!/usr/bin/env node
/* One-off: generate accent VO takes for a slug (bypasses the engine's hardcoded
   "Australian English pronunciation" clamp so we can steer a specific accent).
   Produces {slug}.voNN.wav (padded to 8s) + muxes each onto {slug}.s1.mp4 →
   Downloads preview files for Quan to ear-pick. Does NOT touch engine.js. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(__dirname, '..');
const RENDERS = path.join(ENGINE_DIR, '_cli-renders');

function loadEnv(){ const env={}; for(const p of ['C:/Users/conta/.env', path.join(process.env.HOME||'','.env')]){ try{ for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){ const m=line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in env)) env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim(); } }catch(_){}}return env; }
const ENV = loadEnv();
const GEMINI = ENV.GEMINI_API_KEY || ENV.GOOGLE_AI_API_KEY || '';
if(!GEMINI){ console.error('No GEMINI_API_KEY'); process.exit(1); }

function findFFmpeg(){ const win='C:/Users/conta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe'; return fs.existsSync(win)?win:'ffmpeg'; }
const FF = findFFmpeg();
const ff = (args)=>execFileSync(FF,['-y',...args],{stdio:['ignore','ignore','pipe']});

const slug = process.argv[2] || 'aktiv-woman2';
const doc = JSON.parse(fs.readFileSync(path.join(RENDERS,`${slug}.script.json`),'utf8'));
const line = (doc.storyboard.scenes[0].vo||'').trim();

// The accent instruction — respectful, natural, never a caricature.
const ACCENT = `Speak as a warm, mature woman in her early 40s who moved to Australia from East Africa (Kenya). Her voice carries a soft, natural African-Australian accent — a gentle East-African rhythm and lilt sitting over clear, everyday Australian English; authentic and relaxed, never exaggerated or a caricature. Calm, genuine, unhurried, with a light smile in the voice, like she is quietly telling a friend something that helped her. Read this line naturally, at an easy conversational pace:`;

// three distinct Gemini prebuilt voices with warm/mature timbre
const TAKES = [
  { tag:'A_sulafat',      voice:'Sulafat' },
  { tag:'B_callirrhoe',   voice:'Callirrhoe' },
  { tag:'C_vindemiatrix', voice:'Vindemiatrix' },
];

function pcmToWav(b64, rate){
  const pcm = Buffer.from(b64,'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF',0); h.writeUInt32LE(36+pcm.length,4); h.write('WAVE',8); h.write('fmt ',12);
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(1,22); h.writeUInt32LE(rate,24);
  h.writeUInt32LE(rate*2,28); h.writeUInt16LE(2,32); h.writeUInt16LE(16,34); h.write('data',36); h.writeUInt32LE(pcm.length,40);
  return Buffer.concat([h,pcm]);
}

async function tts(voice){
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key='+GEMINI,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ contents:[{parts:[{text:`${ACCENT}\n${line}`}]}],
        generationConfig:{ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:voice } } } } }) });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error?.message||('HTTP '+res.status));
  const part = data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData);
  if(!part) throw new Error('no audio');
  const rate = parseInt((/rate=(\d+)/.exec(part.inlineData.mimeType||'')||[])[1]||'24000');
  return pcmToWav(part.inlineData.data, rate);
}

const tmp = path.join(RENDERS, `_tmp_accent_${slug}`); fs.mkdirSync(tmp,{recursive:true});
const src = path.join(RENDERS, `${slug}.s1.mp4`);

(async()=>{
  console.log(`Line: "${line}"`);
  for(const t of TAKES){
    process.stdout.write(`  ${t.tag} (${t.voice}) → TTS… `);
    const wav = await tts(t.voice);
    const raw = path.join(tmp, `${t.tag}.wav`); fs.writeFileSync(raw, wav);
    const pad = path.join(tmp, `${t.tag}.pad.wav`);
    ff(['-i',raw,'-af','apad','-t','8',pad]);
    const out = `C:\\Users\\conta\\Downloads\\LACALUT-AKTIV-woman2-40s-ACCENT-${t.tag}.mp4`;
    ff(['-i',src,'-i',pad,'-filter_complex','[0:a]volume=0.12[bg];[bg][1:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac',out]);
    console.log(`✓ → ${path.basename(out)}`);
  }
  try{ fs.rmSync(tmp,{recursive:true,force:true}); }catch(_){}
  console.log('done');
})().catch(e=>{ console.error('ERR', e.message||e); process.exit(1); });
