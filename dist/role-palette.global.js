/* role-palette (classic script build). Generated from src/role-palette.js; edit that instead. */
(function () {
'use strict';
/* role-palette: themes where every colour has one job.

   A "look" is four layers that combine freely, each written as one attribute on <html>:
     colour     a palette, turned into CSS custom properties (--paper, --ink, --accent, ...)
     structure  frames, borders and decoration          (data-style)
     voice      lettering                                (data-font)
     rhythm     spacing and text size                    (data-density, data-size)
   A theme is one chosen point across all four layers.

   Colours are given jobs, not names:
     paper, ink   the page and the writing on it
     accent       attention: focus rings, chosen items, things to act on
     ornament     decoration only. It never carries meaning
     signals      one colour per meaning your app has (danger, success, warning, ...)
   The palette sets the mood; the jobs keep their meaning whichever palette is chosen.

   One palette makes both a light and a dark version. Every derived colour is nudged in
   lightness (in OKLab, so the hue holds) until it meets a contrast target. */

/* ---------- colour maths ----------
   OKLab conversion from Björn Ottosson, "A perceptual color space for image processing" (2020).
   Contrast is the WCAG 2 relative-luminance ratio. */

const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function toOklab(hex) {
  const [r, g, b] = hexRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((v) => unlin(v).toString(16).padStart(2, '0')).join('');
}
const lightness = (h) => toOklab(h)[0];
const chroma = (h) => { const [, a, b] = toOklab(h); return Math.hypot(a, b); };
const hue = (h) => { const [, a, b] = toOklab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };

/** Same hue at a new lightness, with chroma capped so large areas don't glow. */
function withLightness(h, L, maxChroma = 1) {
  let [, a, b] = toOklab(h);
  const c = Math.hypot(a, b);
  if (c > maxChroma) { a *= maxChroma / c; b *= maxChroma / c; }
  return fromOklab([clamp(L, 0, 1), a, b]);
}
/** Mix two colours in OKLab. t = 0 gives x, t = 1 gives y. */
const mix = (x, y, t) => { const p = toOklab(x), q = toOklab(y); return fromOklab(p.map((v, i) => v + (q[i] - v) * t)); };
const luminance = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG 2 contrast ratio, 1 to 21. */
const contrast = (x, y) => { const a = luminance(x), b = luminance(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

/** Push a colour's lightness away from the background until it reaches the contrast asked for. */
function fit(h, bg, min) {
  if (contrast(h, bg) >= min) return h;
  const [l0, a, b] = toOklab(h), up = lightness(bg) < 0.6;
  for (let i = 1; i <= 50; i += 1) {
    const c = fromOklab([up ? l0 + (1 - l0) * (i / 50) : l0 * (1 - i / 50), a, b]);
    if (contrast(c, bg) >= min) return c;
  }
  return up ? '#ffffff' : '#000000';
}

/* ---------- hue families, for giving jobs to a bare list of colours ---------- */
const inHue = (lo, hi) => (h) => { const x = hue(h); return chroma(h) > 0.06 && (lo <= hi ? x >= lo && x <= hi : x >= lo || x <= hi); };
const FAMILIES = {
  red: inHue(350, 45),
  warm: inHue(38, 110),
  green: inHue(120, 165),
  blue: inHue(220, 285),
  any: () => true,
};

/* ---------- signals ----------
   A signal is a colour with a meaning in your app. Each one says which hue family it should come
   from when a palette doesn't name it, what to fall back to, and how much contrast it needs. */
const DEFAULT_SIGNALS = {
  danger: { family: 'red', fallback: { light: '#b3261e', dark: '#ff6b61' }, min: 4.6 },
};
function normSignals(signals) {
  const out = {};
  for (const [name, s] of Object.entries(signals || DEFAULT_SIGNALS)) {
    const fb = typeof s.fallback === 'string' ? { light: s.fallback, dark: s.fallback } : (s.fallback || {});
    out[name] = { family: FAMILIES[s.family] ? s.family : 'any', min: s.min || 4.6, fallback: { light: fb.light || '#555555', dark: fb.dark || fb.light || '#bbbbbb' } };
  }
  return out;
}

const byChroma = (list) => [...list].sort((x, y) => chroma(y) - chroma(x));

/**
 * Give jobs to any list of colours (a published palette, a brand kit, colours picked from a photo):
 * the lightest is paper, the darkest is ink, each signal takes the most colourful match from its
 * hue family, and the most colourful of the rest become accent and ornament.
 */
function assignJobs(colours, signals) {
  const list = colours.filter(isHex).map((h) => h.toLowerCase());
  if (list.length < 2) throw new Error('assignJobs needs at least two #rrggbb colours');
  const sig = normSignals(signals);
  const byL = [...list].sort((x, y) => lightness(y) - lightness(x));
  const paper = byL[0], ink = byL[byL.length - 1];
  const middle = byL.length > 2 ? byL.slice(1, -1) : byL;
  const taken = new Set();
  const found = {};
  for (const [name, s] of Object.entries(sig)) {
    if (s.family === 'any') continue;
    const pick = byChroma(middle.filter((h) => !taken.has(h) && FAMILIES[s.family](h)))[0];
    if (pick) { found[name] = pick; taken.add(pick); }
  }
  const pool = byChroma(middle);
  const rest = pool.filter((h) => !taken.has(h));
  const accent = rest[0] || pool[0];
  const ornament = rest[1] || pool.find((h) => h !== accent) || accent;
  // Same key order as normPalette, so looks can be compared as JSON.
  return { paper, ink, accent, ornament, signals: found };
}

/** Accepts { paper, ink, accent, ornament?, signals? } or a bare array of colours. */
function normPalette(p, signals) {
  if (Array.isArray(p)) return assignJobs(p, signals);
  if (!p || !isHex(p.paper) || !isHex(p.ink) || !isHex(p.accent)) throw new Error('A palette needs paper, ink and accent as #rrggbb');
  const sig = {};
  for (const [k, v] of Object.entries(p.signals || {})) if (isHex(v)) sig[k] = v;
  return { paper: p.paper, ink: p.ink, accent: p.accent, ornament: isHex(p.ornament) ? p.ornament : p.accent, signals: sig };
}

/* ---------- tokens ---------- */
/**
 * Turn a palette into the custom properties the page uses, for light or dark.
 * vivid keeps more of the palette's colour in the page background.
 * Tokens: paper, panel, ink, ink-soft, hair, field, accent, on-accent, ornament,
 *         inverse-bg, inverse-fg, and one per signal.
 */
function deriveTokens(palette, { dark = false, vivid = false, signals } = {}) {
  const r = normPalette(palette, signals);
  const sig = normSignals(signals);
  const paleIsPaper = lightness(r.paper) >= lightness(r.ink);
  const pale = paleIsPaper ? r.paper : r.ink, deep = paleIsPaper ? r.ink : r.paper;
  const t = {};
  if (!dark) {
    t.paper = vivid ? withLightness(pale, clamp(lightness(pale), 0.84, 0.95), 0.1) : withLightness(pale, clamp(lightness(pale), 0.92, 0.96), 0.035);
    t.panel = withLightness(pale, Math.min(lightness(t.paper) + 0.04, 0.99), vivid ? 0.045 : 0.012);
    t.ink = fit(withLightness(deep, Math.min(lightness(deep), 0.3), 0.08), t.paper, 11);
  } else {
    t.paper = vivid ? withLightness(deep, clamp(lightness(deep), 0.18, 0.26), 0.07) : withLightness(deep, clamp(lightness(deep), 0.14, 0.19), 0.03);
    t.panel = withLightness(deep, lightness(t.paper) + 0.045, vivid ? 0.06 : 0.025);
    t.ink = fit(withLightness(pale, Math.max(lightness(pale), 0.92), 0.05), t.paper, 11);
  }
  t['ink-soft'] = fit(mix(t.ink, t.panel, 0.42), t.panel, 4.8);
  t.hair = mix(t.ink, t.panel, 0.78);
  t.field = fit(mix(t.ink, t.panel, 0.55), t.panel, 3.1);
  t.accent = fit(r.accent, t.panel, 4.6);
  t['on-accent'] = contrast(t.accent, t.panel) >= contrast(t.accent, t.ink) ? t.panel : t.ink;
  t.ornament = fit(r.ornament, t.panel, 1.6);
  t['inverse-bg'] = t.ink;
  t['inverse-fg'] = t.panel;
  for (const [name, s] of Object.entries(sig)) {
    const own = r.signals[name] || byChroma([r.accent, r.ornament].filter((h) => s.family !== 'any' && FAMILIES[s.family](h)))[0];
    t[name] = fit(own || s.fallback[dark ? 'dark' : 'light'], t.panel, s.min);
  }
  return t;
}

const decl = (t, dark) => Object.entries(t).map(([k, v]) => `--${k}:${v};`).join('') + `color-scheme:${dark ? 'dark' : 'light'};`;

/**
 * CSS for a palette: light by default, dark when the system asks (unless data-theme="light"),
 * and dark whenever data-theme="dark". Every selector is more specific than a plain :root, so a
 * page's own :root defaults never override the theme, whichever stylesheet comes first.
 */
function themeCss(palette, opts = {}) {
  const light = deriveTokens(palette, { ...opts, dark: false });
  const dark = deriveTokens(palette, { ...opts, dark: true });
  return `html:root{${decl(light, false)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(dark, true)}}}`
    + `:root[data-theme="dark"]{${decl(dark, true)}}`;
}

/** Contrast of each token against the panel, with the target it was fitted to. For audits and tests. */
function auditTokens(t, signals) {
  const sig = normSignals(signals);
  const targets = { ink: 11, 'ink-soft': 4.8, field: 3.1, accent: 4.6, ornament: 1.6 };
  for (const [name, s] of Object.entries(sig)) targets[name] = s.min;
  return Object.entries(targets).map(([name, min]) => {
    const ratio = contrast(t[name], name === 'ink' ? t.paper : t.panel);
    return { token: name, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min - 0.01 };
  });
}

/* ---------- moods ----------
   The app reports what is happening; the theme decides how it looks. */
/** Toggle mood-<name> classes on <html>. Pass { alert: true, offline: false }. */
function setMoods(moods, root = globalThis.document && document.documentElement) {
  if (!root) return;
  for (const [name, on] of Object.entries(moods)) root.classList.toggle(`mood-${name}`, !!on);
}

/* ---------- the saved look ---------- */
/**
 * createLooks(config) returns a small store for the user's chosen look.
 * config = {
 *   key:      localStorage key (omit to not persist)
 *   layers:   { style: ['ink', 'soft'], font: ['serif', 'sans'], density: ['s','m','l'], size: ['s','m','l'] }
 *             each becomes data-<layer> on <html>; the first value is the default
 *   themes:   { id: { name, mode: 'auto'|'light'|'dark', vivid, palette, style, font, ... } }
 *   default:  theme id to start from
 *   signals:  your app's signal colours (see DEFAULT_SIGNALS)
 *   fonts:    { fontValue: 'https://stylesheet-url' } loaded the first time that font is applied
 * }
 * A look is { theme?, mode, vivid, mood, palette, ...one value per layer }.
 */
function createLooks(config) {
  const { key, layers = {}, themes = {}, signals, fonts = {} } = config;
  const MODES = ['auto', 'light', 'dark'];
  const base = themes[config.default] || Object.values(themes)[0] || {};
  const loaded = new Set();
  const doc = globalThis.document;

  function normalize(l) {
    l = l && typeof l === 'object' ? l : {};
    const out = {
      mode: MODES.includes(l.mode) ? l.mode : (MODES.includes(base.mode) ? base.mode : 'auto'),
      vivid: 'vivid' in l ? !!l.vivid : !!base.vivid,
      mood: l.mood !== false,
      palette: null,
    };
    for (const [layer, values] of Object.entries(layers)) {
      out[layer] = values.includes(l[layer]) ? l[layer] : (values.includes(base[layer]) ? base[layer] : values[0]);
    }
    try { out.palette = normPalette(l.palette !== undefined ? l.palette : base.palette, signals); } catch (e) { out.palette = null; }
    return out;
  }
  const fields = ['mode', 'vivid', ...Object.keys(layers)];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** The theme id this look matches exactly, or null once something was changed by hand. */
  function themeOf(look) {
    const l = normalize(look);
    return Object.keys(themes).find((id) => { const t = normalize(themes[id]); return fields.every((f) => t[f] === l[f]) && same(t.palette, l.palette); }) || null;
  }
  /** The look for a theme, keeping the user's text size and mood setting. */
  function fromTheme(id, keep = {}) {
    const t = themes[id] || {};
    const l = normalize({ ...t, palette: t.palette });
    if (keep.size && layers.size) l.size = keep.size;
    if ('mood' in keep) l.mood = keep.mood;
    return l;
  }
  const prefersDark = () => !!(globalThis.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  /** The colours a look shows right now, for previews. */
  function tokens(look) {
    const l = normalize(look);
    return l.palette ? deriveTokens(l.palette, { dark: l.mode === 'dark' || (l.mode === 'auto' && prefersDark()), vivid: l.vivid, signals }) : null;
  }
  function apply(look) {
    const l = normalize(look);
    if (!doc) return l;
    const root = doc.documentElement;
    if (l.mode === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = l.mode;
    for (const layer of Object.keys(layers)) root.dataset[layer] = l[layer];
    root.classList.toggle('calm', !l.mood);
    const href = layers.font && fonts[l.font];
    if (href && !loaded.has(href)) {
      loaded.add(href);
      const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = href; doc.head.appendChild(link);
    }
    let el = doc.getElementById('role-palette-css');
    if (!el) { el = doc.createElement('style'); el.id = 'role-palette-css'; doc.head.appendChild(el); }
    el.textContent = l.palette ? themeCss(l.palette, { vivid: l.vivid, signals }) : '';
    return l;
  }
  function load() {
    if (!key) return normalize(null);
    try { return normalize(JSON.parse(localStorage.getItem(key))); } catch (e) { return normalize(null); }
  }
  function save(look) {
    const l = normalize(look);
    if (key) { try { localStorage.setItem(key, JSON.stringify(l)); } catch (e) { /* private mode: keep going */ } }
    return apply(l);
  }
  return { normalize, themeOf, fromTheme, tokens, apply, load, save, themes, layers };
}

globalThis.RolePalette = { isHex, toOklab, fromOklab, lightness, chroma, hue, withLightness, mix, contrast, fit, FAMILIES, DEFAULT_SIGNALS, assignJobs, normPalette, deriveTokens, themeCss, auditTokens, setMoods, createLooks };
})();
