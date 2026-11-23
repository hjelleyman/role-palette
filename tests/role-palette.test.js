import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  toOklab, fromOklab, contrast, fit, assignJobs, deriveTokens, themeCss, auditTokens, auditDistinct, createLooks, normPalette, hue,
} from '../src/role-palette.js';

const PALETTES = {
  paper: { paper: '#f4efe4', ink: '#1d1a16', accent: '#2a5d8f', ornament: '#b08a3e' },
  neon: { paper: '#0b0b14', ink: '#e8e8ff', accent: '#ff2bd6', ornament: '#3a3aff', signals: { danger: '#ff3355' } },
  pastel: ['#fde2e4', '#cddafd', '#bee1e6', '#e2ece9', '#fad2e1'],
  harsh: { paper: '#ffff00', ink: '#00ffff', accent: '#ffffff' },
};
const SIGNALS = {
  danger: { family: 'red', fallback: { light: '#b3261e', dark: '#ff6b61' } },
  success: { family: 'green', fallback: '#1f7a3a' },
  warning: { family: 'warm', fallback: '#b26b00', min: 3 },
};

test('OKLab round trip keeps the colour', () => {
  for (const h of ['#000000', '#ffffff', '#2a5d8f', '#ff2bd6', '#7f7f7f']) assert.equal(fromOklab(toOklab(h)), h);
});

test('contrast matches known WCAG values', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
});

test('fit reaches the contrast asked for', () => {
  assert.ok(contrast(fit('#bbbbbb', '#ffffff', 4.5), '#ffffff') >= 4.5);
  assert.ok(contrast(fit('#333333', '#000000', 7), '#000000') >= 7);
});

test('assignJobs puts the lightest on paper and darkest on ink, and finds a red for danger', () => {
  const p = assignJobs(['#222222', '#c0392b', '#f5f5f0', '#2e86c1', '#d4ac0d']);
  assert.equal(p.paper, '#f5f5f0');
  assert.equal(p.ink, '#222222');
  assert.equal(p.signals.danger, '#c0392b');
  assert.notEqual(p.accent, '#c0392b');
});

test('every palette meets its contrast targets in light and dark', () => {
  for (const [name, pal] of Object.entries(PALETTES)) {
    for (const dark of [false, true]) {
      for (const vivid of [false, true]) {
        const t = deriveTokens(pal, { dark, vivid, signals: SIGNALS });
        for (const r of auditTokens(t, SIGNALS)) assert.ok(r.ok, `${name} dark=${dark} vivid=${vivid}: ${r.token} on ${r.against} ${r.ratio} < ${r.min}`);
      }
    }
  }
});

test('a signal never borrows the accent', () => {
  // A green accent used to be taken as the success colour too; now success uses its own fallback,
  // and the audit says the two are too alike rather than hiding it.
  const t = deriveTokens({ paper: '#ffffff', ink: '#111111', accent: '#2e9e4f' }, { signals: SIGNALS });
  assert.equal(t.success, fit('#1f7a3a', [t.paper, t.panel, t['success-soft']], 4.6));
  assert.ok(auditDistinct(t, SIGNALS).some((r) => r.token === 'success' && r.against === 'accent' && !r.ok));
});

test('auditDistinct flags a signal that looks like the accent', () => {
  const t = deriveTokens({ paper: '#ffffff', ink: '#111111', accent: '#d32f2f' }, { signals: SIGNALS });
  assert.ok(auditDistinct(t, SIGNALS).some((r) => r.token === 'danger' && r.against === 'accent' && !r.ok));
});

test('a teal-green in a colour list is taken for success, not left as the accent', () => {
  const p = assignJobs(['#0f1222', '#e6e9f5', '#7aa2ff', '#ff5d73', '#38d39f'], SIGNALS);
  assert.equal(p.signals.success, '#38d39f');
});

test('accent and signals meet contrast on paper as well as panel', () => {
  const t = deriveTokens({ paper: '#ffffff', ink: '#111111', accent: '#d32f2f' });
  assert.ok(contrast(t.accent, t.paper) >= 4.6 && contrast(t.accent, t.panel) >= 4.6);
  assert.ok(contrast(t['on-accent'], t.accent) >= 4.5);
});

test('fitting keeps the hue instead of clipping it', () => {
  const accent = deriveTokens({ paper: '#ffffff', ink: '#111111', accent: '#ffd400' }).accent;
  assert.ok(Math.abs(hue(accent) - hue('#ffd400')) < 2, `hue moved to ${hue(accent)}`);
});

test('dark mode really is dark and light mode really is light', () => {
  for (const pal of Object.values(PALETTES)) {
    assert.ok(toOklab(deriveTokens(pal, { dark: false }).paper)[0] > 0.8);
    assert.ok(toOklab(deriveTokens(pal, { dark: true }).paper)[0] < 0.3);
  }
});

test('themeCss writes light, system dark and forced dark blocks', () => {
  const css = themeCss(PALETTES.paper);
  assert.match(css, /^html:root\{--paper:/);
  assert.match(css, /prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]\{/);
});

test('extend adds app tokens in both modes and reaches the CSS', () => {
  const extend = (t, { dark }) => ({ sel: t.accent, mode: dark ? '#000000' : '#ffffff' });
  const light = deriveTokens(PALETTES.paper, { extend });
  assert.equal(light.sel, light.accent);
  assert.equal(light.mode, '#ffffff');
  assert.equal(deriveTokens(PALETTES.paper, { dark: true, extend }).mode, '#000000');
  assert.match(themeCss(PALETTES.paper, { extend }), /--sel:#/);
});

test('normPalette rejects junk', () => {
  assert.throws(() => normPalette({ paper: 'red', ink: '#000000', accent: '#123456' }));
  assert.throws(() => assignJobs(['#ffffff']));
});

test('createLooks normalises, recognises themes and survives no DOM', () => {
  const looks = createLooks({
    layers: { style: ['ink', 'soft'], font: ['serif', 'sans'], size: ['s', 'm', 'l'] },
    themes: { a: { name: 'A', mode: 'light', style: 'soft', font: 'sans', palette: PALETTES.paper }, b: { name: 'B', mode: 'dark', palette: PALETTES.neon }, c: { name: 'C', palette: PALETTES.pastel } },
    default: 'a',
  });
  const l = looks.normalize({ style: 'nonsense', mode: 'sideways' });
  assert.equal(l.style, 'soft');
  assert.equal(l.mode, 'light');
  assert.equal(looks.themeOf(looks.fromTheme('b')), 'b');
  assert.equal(looks.themeOf({ ...looks.fromTheme('b'), style: 'ink' }), null);
  assert.equal(looks.fromTheme('a', { size: 'l' }).size, 'l');
  // A look saved from a list-of-colours theme, then reloaded, still matches that theme.
  assert.equal(looks.themeOf(JSON.parse(JSON.stringify(looks.fromTheme('c')))), 'c');
  assert.doesNotThrow(() => looks.apply(l));
});

test('a saved look follows later changes to its theme, but keeps what the user changed', () => {
  const mk = (accent, font) => createLooks({
    layers: { font: ['sans', 'serif'], size: ['m', 's', 'l'] },
    themes: { clean: { mode: 'auto', font, palette: { paper: '#ffffff', ink: '#111111', accent } } },
    default: 'clean',
  });
  const v1 = mk('#4f46e5', 'sans');
  const stored = JSON.parse(JSON.stringify(v1.compact(v1.fromTheme('clean', { size: 'l' }))));
  assert.deepEqual(Object.keys(stored).sort(), ['size', 'theme']);
  const v2 = mk('#0a7d4f', 'serif');
  const l = v2.normalize(stored);
  assert.equal(l.palette.accent, '#0a7d4f');
  assert.equal(l.font, 'serif');
  assert.equal(l.size, 'l');
  assert.equal(v2.themeOf(v2.fromTheme('clean')), 'clean');
  // A palette the user picked by hand is kept.
  const own = v1.compact({ ...v1.fromTheme('clean'), palette: { paper: '#fafafa', ink: '#000000', accent: '#aa00aa' } });
  assert.equal(v2.normalize(JSON.parse(JSON.stringify(own))).palette.accent, '#aa00aa');
});

test('the classic-script build exposes the same functions', () => {
  const code = readFileSync(new URL('../dist/role-palette.global.js', import.meta.url), 'utf8');
  const ctx = {}; ctx.globalThis = ctx;
  vm.runInNewContext(code, ctx);
  assert.equal(typeof ctx.RolePalette.createLooks, 'function');
  assert.equal(ctx.RolePalette.contrast('#000000', '#ffffff'), contrast('#000000', '#ffffff'));
});
