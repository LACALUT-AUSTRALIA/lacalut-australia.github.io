/* Re-render ONLY scene 3 of the approved PAS ad (~US$3.20) with the typo-class killed:
   - caption NOT baked into the still/video — overlaid in post via ffmpeg drawtext (pixel-perfect)
   - explicit NO-PERSON plate, v2 packshot compositing, stronger grounding shadow
   Then reassemble final ad using existing s1/s2 + new s3. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
global.window = globalThis;
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

const sb = {
  hook: 'Ever wonder if your daily routine is really giving your gums the care they truly need?',
  cta: 'Find LACALUT Aktiv online today!',
  voice: 'Female, 30s, Australian accent, upbeat and smiling, warm, uplifting, energised delivery with dynamic intonation.',
  character: '', // scene 3 is PERSON-FREE — no character lock so the plate stays empty
  world: 'A sunlit, lived-in Australian home kitchen. Surfaces are a light wooden benchtop, speckled white tiles, and a simple cream-painted wall with a window letting in natural daylight. Props include a ceramic coffee mug, a clear drinking glass, and a modern smartphone.',
  styleAnchor: 'Authentic handheld smartphone footage in a sunlit lived-in Australian home kitchen, natural imperfect movement, real daylight, native social-feed lo-fi realism, never studio polish.',
  scenes: []
};
const s3 = { n: 3, seconds: 8,
  visual: 'The LACALUT Aktiv toothpaste pack, front label facing camera, standing on the sunlit wooden kitchen counter with a simple everyday toothbrush lying nearby. NO PERSON in this scene — the kitchen is empty.',
  motion: 'Opens with the LACALUT Aktiv pack already standing in place on the wooden counter, front label facing camera, under a third of the frame, grounded with a soft natural contact shadow. The camera is handheld and steady with only a natural subtle sway. The toothbrush lies still beside it. The shot holds calmly on the pack and toothbrush for the full scene; nothing appears, moves or morphs.',
  vo: 'LACALUT Aktiv firms and cares for the gum line. Feel the difference — find Aktiv online today!',
  text: '' };   // caption OVERLAID IN POST — never baked, so Veo can never morph or misspell it

(async () => {
  // world anchor = existing scene 1 still, so the kitchen matches the rest of the ad
  const s1Still = 'data:image/png;base64,' + fs.readFileSync(path.join(outDir, 's1_still.png')).toString('base64');
  const r = await E.renderSceneQC({
    sku: 'aktiv', storyboard: sb, scene: s3, index: 2, total: 3,
    style: 'lofi_native', model: 'VEO3', aspectRatio: '9:16',
    refImgs: [packRef], refImgDataUrl: packRef, apiKey: API_KEY,
    prevStill: s1Still, worldStill: s1Still,
    fixNote: 'The pack must ALREADY be in frame from the very first frame — it must never pop into existence; the pack sits naturally on the counter with realistic lighting and a soft contact shadow, never flat or sticker-like. No person, no hands, no on-screen text of any kind.',
    onProgress: m => console.log('[S3] ' + m)
  });
  fs.writeFileSync(path.join(outDir, 's3_new.mp4'), Buffer.from(await r.videoBlob.arrayBuffer()));
  if (r.still) fs.writeFileSync(path.join(outDir, 's3_new_still.png'), Buffer.from(r.still.split(',')[1], 'base64'));
  console.log('S3 new: attempts ' + r.attempts + ', QC ' + (r.qc ? r.qc.score + (r.qc.issues.length ? ' [' + r.qc.issues[0] + ']' : '') : 'n/a'));

  // caption overlay (post, pixel-perfect) + reassembly
  const ff = a => execFileSync('ffmpeg', ['-y', ...a], { cwd: outDir, stdio: ['ignore', 'ignore', 'pipe'] });
  fs.writeFileSync(path.join(outDir, 'cap3.txt'), 'Give Your Gums\nThe German Care.\nFeel the firm difference.');
  ff(['-i', 's3_new.mp4', '-vf',
    "drawtext=textfile=cap3.txt:fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=64:fontcolor=white:borderw=5:bordercolor=black:line_spacing=14:x=(w-text_w)/2:y=h*0.16",
    '-c:a', 'copy', 's3_cap.mp4']);
  fs.writeFileSync(path.join(outDir, 'list2.txt'), ['s1.mp4', 's2.mp4', 's3_cap.mp4'].map(n => `file '${n}'`).join('\n'));
  let concatOk = true;
  try { ff(['-f', 'concat', '-safe', '0', '-i', 'list2.txt', '-c', 'copy', 'out2.mp4']); }
  catch (e) { concatOk = false; }
  if (!concatOk) ff(['-f', 'concat', '-safe', '0', '-i', 'list2.txt', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', 'out2.mp4']);
  ff(['-i', 'out2.mp4', '-i', 'vo.wav', '-filter_complex',
    '[0:a]volume=0.12[bg];[bg][1:a]amix=inputs=2:duration=first:normalize=0[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', 'final_pas_lofi_24s_v2.mp4']);
  console.log('DONE — ' + outDir + '/final_pas_lofi_24s_v2.mp4');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
