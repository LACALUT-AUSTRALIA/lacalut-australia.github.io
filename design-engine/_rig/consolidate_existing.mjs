// consolidate_existing.mjs — pulls EVERY existing AKTIV render from the three places they've
// scattered to (68 Shopify-CDN tournament renders in format-library.js, 4 local Aditya jpgs in
// library/, 8 local v20 Archetype Proof Strip pngs in _rig/winner-ads/proof/) into ONE
// _cli-renders-images/all-existing-aktiv/ folder + manifest.json, so a single click of
// "Load Image Renders" turns all of them into real, Edit-able Gallery cards.
// Run: node _rig/consolidate_existing.mjs
import fs from 'fs';
import path from 'path';

const DE = path.resolve(import.meta.dirname, '..');
const OUT = path.join(DE, '_cli-renders-images', 'all-existing-aktiv');
fs.mkdirSync(OUT, { recursive: true });

function stableId(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) | 0; }
  return 'gexist' + Math.abs(h);
}
function titleCase(s) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const manifest = [];

// ── 1) 68 CDN tournament renders from format-library.js ──
const flSrc = fs.readFileSync(path.join(DE, 'format-library.js'), 'utf8');
const eqIdx = flSrc.indexOf('=');
const FORMAT_LIBRARY = JSON.parse(flSrc.slice(eqIdx + 1).trim().replace(/;$/, ''));
let cdnCount = 0;
for (const [formatId, entries] of Object.entries(FORMAT_LIBRARY)) {
  for (const e of entries) {
    if (!e.url.startsWith('http')) continue;   // local ones handled separately below
    const id = stableId('cdn:' + e.url);
    const filename = id + '.jpg';
    const dest = path.join(OUT, filename);
    if (!fs.existsSync(dest)) {
      process.stdout.write('downloading ' + formatId + '… ');
      try {
        const res = await fetch(e.url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        console.log('OK');
      } catch (err) { console.log('FAIL', err.message); continue; }
    }
    manifest.push({ id, filename, sku: 'aktiv', mode: 'social', ptype: 'toothpaste', label: 'Tournament · ' + titleCase(formatId), brief: '', angle: formatId });
    cdnCount++;
  }
}

// ── 2) 4 local Aditya jpgs (library/*.jpg) ──
const libDir = path.join(DE, 'library');
let localAdityaCount = 0;
if (fs.existsSync(libDir)) {
  for (const f of fs.readdirSync(libDir)) {
    if (!/\.jpe?g$/i.test(f)) continue;
    const id = stableId('aditya-lib:' + f);
    const filename = id + path.extname(f);
    fs.copyFileSync(path.join(libDir, f), path.join(OUT, filename));
    manifest.push({ id, filename, sku: 'aktiv', mode: 'social', ptype: 'toothpaste', label: 'Aditya Matrix · ' + titleCase(f.replace(/__aktiv\.jpe?g$/i, '')), brief: '', angle: 'aditya-matrix' });
    localAdityaCount++;
  }
}

// ── 3) 8 local v20 Archetype Proof Strip pngs ──
const proofDir = path.join(DE, '_rig', 'winner-ads', 'proof');
let proofCount = 0;
if (fs.existsSync(proofDir)) {
  for (const f of fs.readdirSync(proofDir)) {
    if (!/\.png$/i.test(f)) continue;
    const id = stableId('proof:' + f);
    const filename = id + '.png';
    fs.copyFileSync(path.join(proofDir, f), path.join(OUT, filename));
    manifest.push({ id, filename, sku: 'aktiv', mode: 'social', ptype: 'toothpaste', label: 'v20 Proof Strip · ' + titleCase(f.replace(/\.png$/i, '')), brief: '', angle: 'v20-archetype-proof' });
    proofCount++;
  }
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nCDN tournament: ' + cdnCount + ' | Aditya matrix: ' + localAdityaCount + ' | v20 Proof Strip: ' + proofCount);
console.log('Total: ' + manifest.length + ' -> ' + OUT);
console.log('In the live engine: click "🖼️ Load Image Renders" and pick this folder.');
