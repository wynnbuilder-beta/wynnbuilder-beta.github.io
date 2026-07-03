import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

/** Static asset directories copied to dist. */
const copyTargets = ['js', 'css', 'data', 'media', 'thirdparty'];

/** Root-level assets not emitted by Vite. */
const rootFiles = ['manifest.json', 'credits.txt'];

/** Static HTML not processed by Vite (invalid/unescaped markup for the parser). */
const staticHtmlFiles = ['items_adv/items_adv_help.html'];

function copyFile(srcRel, destRel = srcRel) {
  const src = resolve(root, srcRel);
  const dest = resolve(dist, destRel);
  if (!existsSync(src)) {
    console.warn(`skip missing file: ${srcRel}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`copied ${srcRel} -> dist/${destRel}`);
}

function copyDir(srcRel, destRel = srcRel) {
  const src = resolve(root, srcRel);
  const dest = resolve(dist, destRel);
  if (!existsSync(src)) {
    console.warn(`skip missing dir: ${srcRel}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${srcRel}/ -> dist/${destRel}/`);
}

mkdirSync(dist, { recursive: true });

for (const dir of copyTargets) {
  copyDir(dir);
}

// Wynnfo static assets only — index.html is built by Vite.
for (const sub of ['scripts', 'styles']) {
  const srcRel = `wynnfo/${sub}`;
  if (!existsSync(resolve(root, srcRel))) continue;
  copyDir(srcRel, srcRel);
}

for (const file of rootFiles) {
  copyFile(file);
}

for (const file of staticHtmlFiles) {
  copyFile(file);
}

// GitHub Pages expects /builder/ to resolve; mirror the Vite-built index_full.html.
const distBuilderFull = resolve(dist, 'builder/index_full.html');
const distBuilderIndex = resolve(dist, 'builder/index.html');
if (existsSync(distBuilderFull)) {
  cpSync(distBuilderFull, distBuilderIndex);
  console.log('copied dist/builder/index_full.html -> dist/builder/index.html');
}

console.log('static assets copied to dist/');
