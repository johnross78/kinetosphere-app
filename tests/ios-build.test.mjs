import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ios-build-baseline.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const swift = read('native/ios/KSNativeCircuitController.swift');
const imports = 'import UIKit\nimport WebKit\nimport Capacitor\n';
const fragment = swift.slice(imports.length);

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinetosphere-ios-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function run(script, cwd, args = []) {
  return execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}
function tree(dir) {
  const result = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [child, digest] of Object.entries(tree(name))) result[`${entry.name}/${child}`] = digest;
    } else result[entry.name] = hash(fs.readFileSync(name));
  }
  return result;
}

test('Swift body and legacy bridge/refinement scripts preserve the pre-change baseline bytes', () => {
  assert.ok(swift.startsWith(imports), 'Expected standalone Swift imports');
  assert.equal(hash(fragment), baseline.controllerFragmentSha256, 'Native playback body changed; requires explicit native review');
  for (const name of ['activate-native-circuit-bridge.mjs', 'apply-step10-player-refinements.mjs']) {
    assert.equal(hash(read(`scripts/${name}`)), baseline[name], `${name} changed from the recorded baseline`);
  }
});

test('shared web preparation is repeatable, source-preserving, and baseline-identical', t => {
  const dir = scratch(t);
  for (const name of ['www', 'scripts']) fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  const sourceBefore = tree(path.join(dir, 'www'));
  const prepare = () => execFileSync(process.execPath, [path.join(dir, 'scripts/prepare-ios.mjs'), '--web-only'], { cwd: dir, stdio: 'pipe' });
  prepare();
  const generated = path.join(dir, 'dist/ios-build/www');
  const first = tree(generated);
  assert.equal(first['index.html'], baseline.generatedIndexSha256, 'Generated HTML differs from the original patch sequence');
  for (const [name, digest] of Object.entries(sourceBefore)) {
    if (name !== 'index.html') assert.equal(first[name], digest, `Unexpected generated change: ${name}`);
  }
  // Stale artifacts are removed, rather than accumulating across preparations.
  fs.writeFileSync(path.join(generated, 'stale.txt'), 'stale');
  prepare();
  assert.deepEqual(tree(generated), first);
  assert.deepEqual(tree(path.join(dir, 'www')), sourceBefore);
  const html = fs.readFileSync(path.join(generated, 'index.html'), 'utf8');
  const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1]).filter(body => body.trim());
  assert.equal(inlineScripts.length, 4, 'Expected the three original inline scripts plus the native bridge');
  for (const body of inlineScripts) assert.doesNotThrow(() => new vm.Script(body), 'Generated inline JavaScript must parse');
  const bridge = html.slice(html.indexOf('/* Preserve the exact Circuit Player layout;'));
  const sends = [...bridge.matchAll(/send\("([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual([...new Set(sends)].sort(), ['audio', 'frame', 'load', 'modal', 'ready', 'stop']);
  const cases = [...swift.matchAll(/case "([a-z]+)":/g)].map(match => match[1]);
  assert.deepEqual(cases.sort(), ['audio', 'frame', 'load', 'modal', 'stop']);
  // ready is intentionally sent but unhandled in the existing native protocol.
  for (const selector of ['#playerArea .video-wrap', '#ytFrame', 'descriptionModal', 'trainingPanel']) assert.ok(bridge.includes(selector), selector);
  for (const component of ['messageHandlers?.ksNativeVideo', 'getBoundingClientRect()', 'viewportWidth:window.innerWidth', 'ResizeObserver', 'visualViewport', 'orientationchange']) assert.ok(bridge.includes(component), component);
  for (const component of ['id="playerArea"', 'class="video-wrap"', 'id="ytFrame"', 'id="descriptionModal"', 'id="trainingPanel"']) assert.ok(html.includes(component), component);
  for (const component of ['let scale=web.bounds.width/lastCssViewportWidth', 'region.frame=target.insetBy(dx:1,dy:1)', 'web.addSubview(region)', 'multiplier:16.0/9.0', 'https://circuitbuilder.rosshomegym.com', 'name:"ksNativeVideo"']) assert.ok(swift.includes(component), component);
});

test('native integration generates the original AppDelegate body and storyboard, and reruns safely', t => {
  const dir = scratch(t);
  const appDir = path.join(dir, 'ios/App/App');
  fs.mkdirSync(path.join(appDir, 'Base.lproj'), { recursive: true });
  const app = path.join(appDir, 'AppDelegate.swift');
  const board = path.join(appDir, 'Base.lproj/Main.storyboard');
  const original = read('tests/fixtures/ios/AppDelegate.swift');
  const storyboard = read('tests/fixtures/ios/Main.storyboard');
  fs.writeFileSync(app, original);
  fs.writeFileSync(board, storyboard);
  run('activate-native-circuit-controller.mjs', dir);
  assert.equal(fs.readFileSync(app, 'utf8'), original.replace('import UIKit', 'import UIKit\nimport WebKit') + fragment);
  assert.equal(fs.readFileSync(board, 'utf8'), storyboard.replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="KSNativeCircuitController" customModule="App" customModuleProvider="target"'));
  const before = tree(appDir);
  run('activate-native-circuit-controller.mjs', dir);
  assert.deepEqual(tree(appDir), before);
  fs.writeFileSync(app, fs.readFileSync(app, 'utf8').replace('let scale=web.bounds.width', 'let scale=2*web.bounds.width'));
  assert.throws(() => run('activate-native-circuit-controller.mjs', dir), /Generated native controller differs/);
});

test('native integration rejects a changed storyboard before writing AppDelegate', t => {
  const dir = scratch(t);
  const appDir = path.join(dir, 'ios/App/App');
  fs.mkdirSync(path.join(appDir, 'Base.lproj'), { recursive: true });
  const original = read('tests/fixtures/ios/AppDelegate.swift');
  fs.writeFileSync(path.join(appDir, 'AppDelegate.swift'), original);
  fs.writeFileSync(path.join(appDir, 'Base.lproj/Main.storyboard'), '<changed/>');
  assert.throws(() => run('activate-native-circuit-controller.mjs', dir), /Capacitor storyboard changed/);
  assert.equal(fs.readFileSync(path.join(appDir, 'AppDelegate.swift'), 'utf8'), original);
});

test('local and Codemagic use the same tested preparation and locked dependencies', () => {
  const yaml = read('codemagic.yaml');
  assert.equal(yaml.match(/script: npm ci --no-audit --no-fund/g)?.length, 2);
  assert.equal(yaml.match(/script: npm run ios:prepare/g)?.length, 2);
  assert.ok(read('setup-ios.sh').includes('npm ci --no-audit --no-fund\nnpm run ios:prepare'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['ios:prepare'], 'npm test && node scripts/prepare-ios.mjs');
  const lock = JSON.parse(read('package-lock.json'));
  for (const group of ['dependencies', 'devDependencies']) {
    assert.deepEqual(lock.packages[''][group], pkg[group]);
    for (const [name, version] of Object.entries(pkg[group])) assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  assert.ok(read('capacitor.config.ts').includes("process.env.KINETOSPHERE_IOS_BUILD === '1' ? 'dist/ios-build/www' : 'www'"));
});
