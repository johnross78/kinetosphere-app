import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mobileShell = path.join(root, 'www', 'mobile-shell.css');
const indexFile = path.join(root, 'www', 'index.html');
const rc29RuntimeFile = path.join(root, 'www', 'rc29-player-runtime.js');
const rc31RuntimeFile = path.join(root, 'www', 'rc31-player-runtime.js');

const patches = [
  {
    name: 'RC27',
    file: path.join(root, 'www', 'rc27-player-layout.css'),
    start: '/* >>> RC27 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC27 PLAYER LAYOUT OVERRIDES <<< */',
  },
  {
    name: 'RC28',
    file: path.join(root, 'www', 'rc28-player-layout.css'),
    start: '/* >>> RC28 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC28 PLAYER LAYOUT OVERRIDES <<< */',
  },
  {
    name: 'RC29',
    file: path.join(root, 'www', 'rc29-player-layout.css'),
    start: '/* >>> RC29 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC29 PLAYER LAYOUT OVERRIDES <<< */',
  },
  {
    name: 'RC30',
    file: path.join(root, 'www', 'rc30-player-layout.css'),
    start: '/* >>> RC30 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC30 PLAYER LAYOUT OVERRIDES <<< */',
  },
  {
    name: 'RC31',
    file: path.join(root, 'www', 'rc31-player-layout.css'),
    start: '/* >>> RC31 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC31 PLAYER LAYOUT OVERRIDES <<< */',
  },
  {
    name: 'RC32',
    file: path.join(root, 'www', 'rc32-player-layout.css'),
    start: '/* >>> RC32 PLAYER LAYOUT OVERRIDES >>> */',
    end: '/* <<< RC32 PLAYER LAYOUT OVERRIDES <<< */',
  },
];

if (!fs.existsSync(mobileShell)) {
  console.log('Player layout patch skipped: www/mobile-shell.css is not present.');
  process.exit(0);
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let shell = fs.readFileSync(mobileShell, 'utf8');

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    console.log(`${patch.name} patch skipped: ${path.relative(root, patch.file)} is not present.`);
    continue;
  }

  const css = fs.readFileSync(patch.file, 'utf8').trim();
  const block = `${patch.start}\n${css}\n${patch.end}`;
  const existing = new RegExp(`${escapeRegExp(patch.start)}[\\s\\S]*?${escapeRegExp(patch.end)}`, 'm');

  if (existing.test(shell)) {
    shell = shell.replace(existing, block);
  } else {
    shell = `${shell.trimEnd()}\n\n${block}\n`;
  }
}

fs.writeFileSync(mobileShell, shell);

if (fs.existsSync(indexFile)) {
  let html = fs.readFileSync(indexFile, 'utf8');
  for (const prior of ['6.10.32','6.10.33','6.10.34','6.10.35','6.10.36','6.10.37']) {
    html = html.replaceAll('v'+prior, 'v6.10.38');
    html = html.replaceAll(prior, '6.10.38');
  }

  const runtimeTag = '<script src="rc29-player-runtime.js"></script>';
  const rc31RuntimeTag = '<script src="rc31-player-runtime.js"></script>';
  html = html.replaceAll(runtimeTag, '');
  html = html.replaceAll(rc31RuntimeTag, '');
  if (fs.existsSync(rc29RuntimeFile)) {
    html = html.replace('</body>', `${runtimeTag}\n</body>`);
  }

  fs.writeFileSync(indexFile, html);
}

console.log('Applied Kinetosphere RC27/RC28/RC29 baseline plus RC32 / v6.10.38 iPhone landscape safe-area YouTube correction.');
