/* Headless render of the APPROVED 24s Problem→Solve AKTIV ad (24/09/2026).
   SPENDS ~US$9.60 (+ QC rerolls up to 2×) on Veo 3.1 — run ONLY after Quan's go + 5pm quota reset.
   Usage: node render_approved.js */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
global.window = globalThis;
// FileReader shim so in-engine per-scene QC works headless
global.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = 'data:' + (blob.type || 'video/mp4') + ';base64,' + Buffer.from(buf).toString('base64');
      this.onload && this.onload();
    }).catch(e => { this.error = e; this.onerror && this.onerror(); });
  }
};
require(path.join(__dirname, '..', 'strategies.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const API_KEY = (fs.readFileSync('C:/Users/conta/.env', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
const packRef = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'results', 'v2test', 'packref_0.png')).toString('base64');
const outDir = 'C:/Users/conta/Downloads/desi-day-2409';
fs.mkdirSync(outDir, { recursive: true });

const sb = {
  hook: 'Ever wonder if your daily routine is really giving your gums the care they truly need?',
  cta: 'Find LACALUT Aktiv online today!',
  voice: 'Female, 30s, Australian accent, upbeat and smiling, warm, uplifting, energised delivery with dynamic intonation.',
  character: 'Sarah, 32, Caucasian, shoulder-length wavy brown hair with subtle highlights, wearing a light blue linen shirt. She has a thoughtful, approachable look.',
  world: 'A sunlit, lived-in Australian home kitchen. Surfaces are a light wooden benchtop, speckled white tiles, and a simple cream-painted wall with a window letting in natural daylight. Props include a ceramic coffee mug, a clear drinking glass, and a modern smartphone.',
  styleAnchor: 'Authentic handheld smartphone footage in a sunlit lived-in Australian home kitchen, natural imperfect movement, real daylight, native social-feed lo-fi realism, never studio polish.',
  scenes: [
    { n: 1, seconds: 8,
      visual: "A slightly Dutch-angled shot of Sarah's hands loosely holding a clear drinking glass on a sunlit wooden kitchen counter.",
      motion: "Opens on the hands, steady but subtly swaying with natural handheld camera movement. Immediately (within 0.5s), a sudden, fast, slightly jerky pan upwards to Sarah's chest-up face, revealing a pensive, slightly lost-in-thought expression. She looks away from the camera, perhaps towards the window. A faint sound of distant ambient traffic. The camera holds on her face, with a slight, almost imperceptible zoom in over 3s, then a quick zoom out.",
      vo: 'Ever wonder if your daily routine is really giving your gums the care they truly need?',
      text: 'Is this what your gums are missing?' },
    { n: 2, seconds: 8,
      visual: 'Sarah, in the same kitchen setting, now looking down at her smartphone.',
      motion: "Opens on Sarah looking down at her phone, the screen angled away from camera so it is never visible. She attempts a half-hearted, unconvincing smile while scrolling, which quickly fades into a neutral, slightly self-conscious expression. The camera is held slightly higher, tilting down toward her face. A subtle 'tap' sound effect, then a soft 'thud' as she places the phone face-down on the counter.",
      vo: "When gums don't feel their best, it can subtly hold back your everyday confidence.",
      text: 'Hold back your full, confident smile?' },
    { n: 3, seconds: 8,
      visual: 'The LACALUT Aktiv toothpaste pack, front label facing camera, standing on the same kitchen counter, with a simple, everyday toothbrush nearby.',
      motion: 'Opens with the LACALUT Aktiv pack standing prominently on the wooden counter, front label facing camera (under 1/3 frame). The camera is held steady. A simple, everyday toothbrush is placed next to it. The shot holds on the pack and toothbrush for the remainder of the scene.',
      vo: 'LACALUT Aktiv firms and cares for the gum line. Feel the difference — find Aktiv online today!',
      text: 'Give Your Gums The German Care. Feel the firm difference.' }
  ]
};

async function saveBlob(blob, file) { fs.writeFileSync(file, Buffer.from(await blob.arrayBuffer())); }

(async () => {
  const spend = { scenes: [], usd: 0 };
  const out = await E.renderStoryboard({
    sku: 'aktiv', storyboard: sb, style: 'lofi_native', model: 'VEO3', aspectRatio: '9:16',
    refImgs: [packRef], refImgDataUrl: packRef, apiKey: API_KEY, qc: true,
    onScene: (i, t, m) => console.log(`[S${i + 1}/${t}] ${m}`)
  });
  if (out.failedAt != null) { console.error('FAILED at scene', out.failedAt + 1, out.error); }
  for (let i = 0; i < out.scenes.length; i++) {
    const s = out.scenes[i];
    await saveBlob(s.videoBlob, path.join(outDir, `s${i + 1}.mp4`));
    if (s.still) fs.writeFileSync(path.join(outDir, `s${i + 1}_still.png`), Buffer.from(s.still.split(',')[1], 'base64'));
    spend.scenes.push({ n: i + 1, attempts: s.attempts, qc: s.qc && { score: s.qc.score, legalFail: s.qc.legalFail, issues: s.qc.issues } });
    spend.usd += 3.20 * (s.attempts || 1);
    console.log(`S${i + 1}: attempts ${s.attempts}, QC ${s.qc ? s.qc.score : 'n/a'}`);
  }
  if (out.failedAt != null) { fs.writeFileSync(path.join(outDir, 'spend.json'), JSON.stringify(spend, null, 1)); process.exit(1); }

  // narrator TTS
  for (let i = 0; i < sb.scenes.length; i++) {
    const wav = await E.ttsLine({ text: sb.scenes[i].vo, voiceDesc: sb.voice, apiKey: API_KEY });
    await saveBlob(wav, path.join(outDir, `vo${i + 1}.wav`));
    console.log(`VO ${i + 1} done`);
  }

  // stitch + mix with local ffmpeg (video concat, VO lines at 0/8/16s, Veo ambience ducked)
  const ff = (args) => execFileSync('ffmpeg', ['-y', ...args], { cwd: outDir, stdio: ['ignore', 'ignore', 'pipe'] });
  fs.writeFileSync(path.join(outDir, 'list.txt'), ['s1.mp4', 's2.mp4', 's3.mp4'].map(n => `file '${n}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'out.mp4']);
  ff(['-i', 'vo1.wav', '-i', 'vo2.wav', '-i', 'vo3.wav', '-filter_complex',
    '[0:a]adelay=200|200[v1];[1:a]adelay=8200|8200[v2];[2:a]adelay=16200|16200[v3];[v1][v2][v3]amix=inputs=3:duration=longest:normalize=0[a]',
    '-map', '[a]', 'vo.wav']);
  ff(['-i', 'out.mp4', '-i', 'vo.wav', '-filter_complex',
    '[0:a]volume=0.12[bg];[bg][1:a]amix=inputs=2:duration=first:normalize=0[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', 'final_pas_lofi_24s.mp4']);
  fs.writeFileSync(path.join(outDir, 'spend.json'), JSON.stringify(spend, null, 1));
  console.log(`DONE — ${outDir}/final_pas_lofi_24s.mp4 · est US$${spend.usd.toFixed(2)}`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
