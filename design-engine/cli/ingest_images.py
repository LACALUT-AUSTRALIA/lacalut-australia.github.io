"""Drop finished PNG renders into the Design Engine gallery.

Usage:
  python -I cli/ingest_images.py <batch> <sku> "<label>" <png> [<png> ...]  [--brief "..."] [--prompt-file path] [--mode social|listing|ad|pmax] [--ptype toothpaste|mouthwash|toothbrush]

Copies each PNG into design-engine/_cli-renders-images/<batch>/, appends a manifest.json row per image
(the exact record shape autoImportCliRenders() in index.html expects) and registers the batch in _index.json.
Commit + push lacalut-pages afterwards — the live engine auto-loads new rows on next page load (dedup by id).
"""
import json, shutil, sys, time, argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / '_cli-renders-images'

ap = argparse.ArgumentParser()
ap.add_argument('batch'); ap.add_argument('sku'); ap.add_argument('label'); ap.add_argument('pngs', nargs='+')
ap.add_argument('--brief', default=''); ap.add_argument('--prompt-file', default='')
ap.add_argument('--mode', default='social'); ap.add_argument('--ptype', default='toothpaste'); ap.add_argument('--ar', default='')
a = ap.parse_args()

bdir = ROOT / a.batch; bdir.mkdir(parents=True, exist_ok=True)
mf_path = bdir / 'manifest.json'
manifest = json.loads(mf_path.read_text(encoding='utf-8')) if mf_path.exists() else []
prompt = Path(a.prompt_file).read_text(encoding='utf-8') if a.prompt_file else ''
have = {m['filename'] for m in manifest}
for i, src in enumerate(a.pngs):
    src = Path(src); dst = bdir / src.name
    if src.resolve() != dst.resolve(): shutil.copy2(src, dst)
    if src.name in have: continue
    ts = int(time.time() * 1000) + i
    manifest.append({
        'id': f'g{ts}_{i}', 'filename': src.name, 'sku': a.sku, 'mode': a.mode, 'ptype': a.ptype,
        'label': a.label if len(a.pngs) == 1 else f'{a.label} · {src.stem.split("_")[-1]}',
        'ts': ts, 'brief': a.brief, 'angle': '', 'brain': None,
        'genPrompt': prompt, 'genSettings': {'render': 'copy', 'ar': a.ar, 'copyMode': True, 'cli': True},
    })
mf_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
idx_path = ROOT / '_index.json'
idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else []
if a.batch not in idx:
    idx.append(a.batch); idx_path.write_text(json.dumps(idx, indent=2), encoding='utf-8')
print(f'ingested {len(a.pngs)} -> {bdir.relative_to(ROOT.parent)} (manifest rows: {len(manifest)})')
