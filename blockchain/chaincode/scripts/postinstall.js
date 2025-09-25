const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@so-ric', 'colorspace', 'dist', 'index.cjs.js');

try {
  if (!fs.existsSync(target)) {
    console.warn('[postinstall] Target file not found, skipping patch.');
    process.exit(0);
  }

  const original = fs.readFileSync(target, 'utf8');
  const pattern = /(limiters\[m\]\s*)\|\|=\s*\[\]/g;

  if (!pattern.test(original)) {
    console.log('[postinstall] No logical assignment operator found, no patch needed.');
    process.exit(0);
  }

  const patched = original.replace(/\(limiters\[m\]\s*\|\|=\s*\[\]\)\[channel\]\s*=\s*modifier;/g, 'limiters[m] = limiters[m] || [];\n                limiters[m][channel] = modifier;');

  if (patched === original) {
    console.warn('[postinstall] Patch pattern not applied; please review file structure.');
    process.exit(0);
  }

  fs.writeFileSync(target, patched, 'utf8');
  console.log('[postinstall] Patched @so-ric/colorspace for Node 12 compatibility.');
} catch (error) {
  console.error('[postinstall] Failed to apply compatibility patch:', error);
  process.exit(0);
}
