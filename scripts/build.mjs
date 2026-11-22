// Builds dist/role-palette.global.js: the same code as a classic script that sets window.RolePalette.
// A classic script can run in <head> before the page paints, so a saved look never flashes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(root + 'src/role-palette.js', 'utf8');
const names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
const body = src.replace(/^export /gm, '');
const out = `/* role-palette (classic script build). Generated from src/role-palette.js; edit that instead. */\n`
  + `(function () {\n'use strict';\n${body}\nglobalThis.RolePalette = { ${names.join(', ')} };\n})();\n`;
mkdirSync(root + 'dist', { recursive: true });
writeFileSync(root + 'dist/role-palette.global.js', out);
console.log(`dist/role-palette.global.js: ${names.length} exports`);
