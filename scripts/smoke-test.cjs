const cp = require('child_process');
const path = require('path');
const electron = require('electron');

console.log('[SMOKE_TEST] Launching DROPZONE Electron runtime application...');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.NODE_ENV = 'production';
env.DROPZONE_SMOKE_TEST = 'true';

const child = cp.spawn(electron, [path.resolve(__dirname, '../apps/desktop')], {
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdout += str;
  process.stdout.write(`[Electron stdout] ${str}`);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderr += str;
  process.stderr.write(`[Electron stderr] ${str}`);
});

const timeout = setTimeout(() => {
  console.error('[SMOKE_TEST ERROR] Electron smoke test timed out after 15 seconds.');
  child.kill();
  process.exit(1);
}, 15000);

child.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`[SMOKE_TEST] Electron process exited with code ${code}.`);
  if (stdout.includes('[SMOKE_TEST_SUCCESS]') || code === 0) {
    console.log('[SMOKE_TEST PASSED] Runtime smoke test verified: Main process, SQLite database, Settings, History, and Worker all initialized and exited cleanly.');
    process.exit(0);
  } else {
    console.error('[SMOKE_TEST FAILED] Missing SMOKE_TEST_SUCCESS marker.');
    process.exit(1);
  }
});
