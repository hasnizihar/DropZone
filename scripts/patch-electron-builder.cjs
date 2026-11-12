/**
 * Idempotently patches app-builder-lib on Windows to use UninstallerReader.exec
 * instead of spawning the unsigned temporary uninstaller executable.
 * This prevents Windows Application Control / AppLocker / SmartAppControl
 * from blocking NSIS uninstaller generation during packaging.
 */
const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');

if (!fs.existsSync(targetFile)) {
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

const unpatched = `        else {
            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
        }`;

const patched = `        else {
            try {
                await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
            }
            catch (_readerErr) {
                const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
                await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
            }
        }`;

if (content.includes(unpatched)) {
  content = content.replace(unpatched, patched);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-electron-builder] Patched NsisTarget.js successfully.');
} else {
  console.log('[patch-electron-builder] NsisTarget.js already patched or pattern not found.');
}

