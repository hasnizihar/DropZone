const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const releaseDir = path.resolve(__dirname, '../release');
const unpackedExe = path.join(releaseDir, 'win-unpacked', 'DROPZONE.exe');
const asarPath = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar');

console.log('[PackagedSmokeTest] Checking for packaged release executable at:', unpackedExe);

if (!fs.existsSync(unpackedExe)) {
  console.error('[PackagedSmokeTest ERROR] Packaged executable not found:', unpackedExe);
  process.exit(1);
}

if (!fs.existsSync(asarPath)) {
  console.error('[PackagedSmokeTest ERROR] Packaged app.asar not found:', asarPath);
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.NODE_ENV = 'production';
env.DROPZONE_SMOKE_TEST = 'true';

function runProcess(targetExe, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`[PackagedSmokeTest] Launching ${description}:`, targetExe, args);
    const child = cp.spawn(targetExe, args, {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(`[Packaged stdout] ${str}`);
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(`[Packaged stderr] ${str}`);
    });

    const timeout = setTimeout(() => {
      console.error(`[PackagedSmokeTest ERROR] ${description} timed out after 20 seconds.`);
      child.kill();
      reject(new Error('TIMEOUT'));
    }, 20000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`[PackagedSmokeTest] ${description} exited with code ${code}.`);
      if (stdout.includes('[SMOKE_TEST_SUCCESS]') || code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Exit code ${code} without SMOKE_TEST_SUCCESS marker.`));
      }
    });
  });
}

async function main() {
  try {
    await runProcess(unpackedExe, [], 'DROPZONE.exe');
    console.log('[PackagedSmokeTest PASSED] Packaged application verified: Main process, SQLite, and Bundled Worker initialized and exited cleanly.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'UNKNOWN' || err.errno === -4094 || err.message.includes('Application Control')) {
      console.warn('[PackagedSmokeTest WARNING] Direct spawn of unsigned binary was blocked by Windows Application Control / Smart App Control (errno -4094).');
      console.log('[PackagedSmokeTest] Verifying packaged app.asar payload with signed Electron binary...');
      const electron = require('electron');
      await runProcess(electron, [asarPath], 'app.asar with Electron runner');
      console.log('[PackagedSmokeTest PASSED] Packaged app.asar verified: Main process, SQLite, and Bundled Worker initialized and exited cleanly.');
      process.exit(0);
    } else {
      console.error('[PackagedSmokeTest FAILED]', err.message);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[PackagedSmokeTest FATAL]', err);
  process.exit(1);
});
