/* Re-render ONLY scene 1 of the 24/09 Demo/Cinematic AKTIV ad (~US$3.20/attempt, max 2 attempts)
   — the shipped S1 scored 3/10: tube thrust at lens, garbled label, warped fingers.
   Fix: PERSON-FREE restage (pack standing on the counter, never held), caption overlaid in
   post via drawtext, v2 packshot compositing, S3 frame as world anchor.
   Then splice new S1 video over the stitched ad keeping its full 24s audio (VO+music) intact. */
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
const outDir = 'C:/Users/conta/AppData/Local/Temp/claude/C--Users-conta/5b695e81-3261-4212-aa6c-3a67c39fbf61/scratchpad';

const sb = {
  hook: 'Your Gums Deserve Precise Care.',
  cta: 'Shop LACALUT Aktiv Now.',
  voice: 'A discerning Australian female voice, mid-30s. Warm, uplifting, and energised delivery with dynamic intonation.',
  character: '',   // scene 1 restaged PERSON-FREE — hands were the 3/10 failure source
  world: 'An ultra-modern, subterranean German pharmacy display space. Polished dark grey concrete walls and floors reflect subtle cool-toned blue and soft light-blue ambient lighting, with precise accent beams in deep red #CF102D and navy #004A88. Minimalist brushed chrome fixtures and transparent, glowing acrylic display pedestals house the product\'s formula elements. Time of day: perpetually cool, dramatic twilight.',
  styleAnchor: 'Dramatic story-grade cinematic hero footage inside one ultra-modern subterranean German pharmacy display space, deep red and navy accent lighting over dark grey concrete, premium and precise.',
  scenes: []
};
const s1 = { n: 1, seconds: 8,
  visual: 'The real GERMAN LACALUT Aktiv toothpaste tube stands upright on a minimalist brushed chrome counter in the subterranean pharmacy space, front label facing camera, occupying less than a third of the frame. Beside it on a small dark grey stone slab lies a smooth, glossy, creamy ribbon of white toothpaste, already dispensed. To the left, a single delicate angular crystal rests on a transparent glowing acrylic pedestal under a cool stark accent beam. NO PERSON and NO HANDS anywhere in this scene.',
  motion: 'Opens on the single angular crystal on its glowing pedestal, lit stark and vulnerable. A sharp snap-cut lands on the LACALUT Aktiv tube standing upright on the chrome counter, front label facing camera, under a third of the frame, perfectly still, with the glossy paste ribbon on the slab beside it. The camera holds steady while the deep red and navy accent beams slowly intensify across the concrete wall behind. SFX: a crisp impact hit on the snap-cut, then a low elegant ambient hum.',
  vo: 'Your gums deserve focused attention. Experience an elevated routine, crafted with German precision.',
  text: '' };   // caption OVERLAID IN POST — never baked

(async () => {
  const worldStill = 'data:image/png;base64,' + fs.readFileSync(path.join(outDir, 's3_worldstill.png')).toString('base64');
  const r = await E.renderSceneQC({
    sku: 'aktiv', storyboard: sb, scene: s1, index: 0, total: 3,
    style: 'cinematic_ad', model: 'VEO3', aspectRatio: '9:16',
    refImgs: [packRef], refImgDataUrl: packRef, apiKey: API_KEY,
    worldStill, qcMaxRerolls: 1,
    fixNote: 'The pack must NEVER be held, lifted, tilted or presented toward the camera and NO person or hand may appear — the tube simply stands on the counter, front label facing camera, pixel-stable and correctly spelled LACALUT aktiv, under a third of the frame. No on-screen text of any kind.',
    onProgress: m => console.log('[S1] ' + m)
  });
  fs.writeFileSync(path.join(outDir, 's1_new.mp4'), Buffer.from(await r.videoBlob.arrayBuffer()));
  console.log('S1 new: attempts ' + r.attempts + ', QC ' + (r.qc ? r.qc.score + (r.qc.issues.length ? ' [' + r.qc.issues.join(' | ') + ']' : '') : 'n/a'));

  const ff = a => execFileSync('ffmpeg', ['-y', ...a], { cwd: outDir, stdio: ['ignore', 'ignore', 'pipe'] });
  // caption overlay (pixel-perfect, post)
  fs.writeFileSync(path.join(outDir, 'cap1.txt'), 'Focused On Your Gums.');
  ff(['-i', 's1_new.mp4', '-vf',
    "scale=720:1280,fps=24,drawtext=textfile=cap1.txt:fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=54:fontcolor=white:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h*0.07",
    '-an', 's1_cap.mp4']);
  // splice: new S1 video (0-8s) + original video from 8s, keep ORIGINAL full audio untouched
  ff(['-i', 's1_cap.mp4', '-i', 'lacalut-qc-tonight.mp4', '-filter_complex',
    '[0:v]trim=0:8,setpts=PTS-STARTPTS[v0];[1:v]trim=8,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v]',
    '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-c:a', 'copy', '-shortest',
    'lacalut-aktiv-demo-24s-v2.mp4']);
  console.log('DONE → ' + path.join(outDir, 'lacalut-aktiv-demo-24s-v2.mp4'));
})().catch(e => { console.error('FAIL: ' + (e && e.message || e)); process.exit(1); });
