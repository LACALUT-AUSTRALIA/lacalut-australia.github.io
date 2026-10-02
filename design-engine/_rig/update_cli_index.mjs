// update_cli_index.mjs — rebuilds _cli-renders-images/_index.json (list of batch folder names
// that have a manifest.json). The live engine fetches this on load to auto-import new renders
// with zero clicks — called automatically at the end of gen_batch.mjs.
import fs from 'fs';
import path from 'path';

const DE = path.resolve(import.meta.dirname, '..');
const ROOT = path.join(DE, '_cli-renders-images');

const batches = fs.existsSync(ROOT)
  ? fs.readdirSync(ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'manifest.json')))
      .map(d => d.name)
      .sort()
  : [];

fs.writeFileSync(path.join(ROOT, '_index.json'), JSON.stringify(batches, null, 2));
console.log('_index.json -> ' + batches.length + ' batch(es): ' + batches.join(', '));
