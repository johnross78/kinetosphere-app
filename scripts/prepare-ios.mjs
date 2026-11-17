// Shared unsigned source preparation only: never signs, builds, or publishes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'dist/ios-build');
const webDir = path.join(stage, 'www');
const env = { ...process.env, KINETOSPHERE_IOS_BUILD: '1' };
function nodeScript(name, cwd = root) {
  execFileSync(process.execPath, [path.join(root, 'scripts', name)], { cwd, env, stdio: 'inherit' });
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(root, 'www'), webDir, { recursive: true });
// Preserve the established patch order and script implementations exactly.
nodeScript('activate-native-circuit-bridge.mjs', stage);
nodeScript('apply-step10-player-refinements.mjs', stage);
if (process.argv.includes('--web-only')) {
  console.log('Prepared dist/ios-build/www; source www/ is unchanged.');
} else {
  if (process.platform !== 'darwin') throw new Error('Full iOS preparation requires macOS/Xcode. Use npm run ios:prepare:web for portable generation checks.');
  const cap = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');
  function capacitor(...args) {
    execFileSync(process.execPath, [cap, ...args], { cwd: root, env, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(root, 'ios'))) capacitor('add', 'ios');
  capacitor('sync', 'ios');
  nodeScript('activate-native-circuit-controller.mjs');
  const icons = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  fs.mkdirSync(icons, { recursive: true });
  fs.copyFileSync(path.join(root, 'resources/icon.png'), path.join(icons, 'AppIcon-512@2x.png'));
  fs.writeFileSync(path.join(icons, 'Contents.json'), JSON.stringify({
    images: [{ filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n');
  const packaged = path.join(root, 'ios/App/App/public/index.html');
  if (!fs.readFileSync(packaged).equals(fs.readFileSync(path.join(webDir, 'index.html')))) {
    throw new Error('Capacitor packaged index.html differs from the prepared native web source');
  }
  console.log('Prepared unsigned iOS project with the existing native controller. No compilation or publishing performed.');
}
