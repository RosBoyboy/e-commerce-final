/**
 * Delete `.next` (fixes missing vendor-chunks / corrupt build on Windows).
 * Stop `next dev` first — otherwise deletion may fail (locked `trace`).
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '.next');
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('[rm-next] removed .next');
} catch (e) {
  console.error('[rm-next]', e.message);
  process.exit(1);
}
