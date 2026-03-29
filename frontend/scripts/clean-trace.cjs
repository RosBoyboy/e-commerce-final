/**
 * Removes .next/trace before dev so Windows does not hit EPERM opening a stale/locked file.
 * Safe no-op if the file is missing or still locked (unlink may fail silently).
 */
const fs = require('fs');
const path = require('path');

const tracePath = path.join(__dirname, '..', '.next', 'trace');
try {
  fs.unlinkSync(tracePath);
} catch (err) {
  if (err.code !== 'ENOENT' && err.code !== 'EPERM') {
    console.warn('[clean-trace]', err.message);
  }
}
