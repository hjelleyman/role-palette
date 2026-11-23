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

export const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function toOklab(hex) {
  const [r, g, b] = hexRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const linearHex = (rgb) => '#' + rgb.map((v) => unlin(v).toString(16).padStart(2, '0')).join('');
/**
 * OKLab to hex. Colours outside sRGB lose chroma (at the same lightness and hue) until they fit,
 * instead of having each channel clipped, which would shift the hue.
 */
export function fromOklab([L, a, b]) {
  if (L <= 0) return '#000000';
  if (L >= 1) return '#ffffff';
  const rgb = oklabToLinear([L, a, b]);
  if (inGamut(rgb)) return linearHex(rgb);
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const k = (lo + hi) / 2;
    if (inGamut(oklabToLinear([L, a * k, b * k]))) lo = k; else hi = k;
  }
  return linearHex(oklabToLinear([L, a * lo, b * lo]));
}
export const lightness = (h) => toOklab(h)[0];
export const chroma = (h) => { const [, a, b] = toOklab(h); return Math.hypot(a, b); };
export const hue = (h) => { const [, a, b] = toOklab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };

/** Same hue at a new lightness, with chroma capped so large areas don't glow. */
export function withLightness(h, L, maxChroma = 1) {
  let [, a, b] = toOklab(h);
  const c = Math.hypot(a, b);
  if (c > maxChroma) { a *= maxChroma / c; b *= maxChroma / c; }
  return fromOklab([clamp(L, 0, 1), a, b]);
}
/** Mix two colours in OKLab. t = 0 gives x, t = 1 gives y. */
export const mix = (x, y, t) => { const p = toOklab(x), q = toOklab(y); return fromOklab(p.map((v, i) => v + (q[i] - v) * t)); };
const luminance = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG 2 contrast ratio, 1 to 21. */
export const contrast = (x, y) => { const a = luminance(x), b = luminance(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

/** OKLab distance between two colours: about 0.02 is just noticeable; 0.1 reads as a different colour. */
export const distance = (x, y) => { const p = toOklab(x), q = toOklab(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/**
 * Push a colour's lightness away from the background(s) by the smallest amount that reaches the
 * contrast asked for. bg may be one colour or a list (all similar in lightness, such as paper and
 * panel); the result meets min against every one.
 */
export function fit(h, bg, min) {
  const bgs = [].concat(bg);
  const ok = (c) => bgs.every((x) => contrast(c, x) >= min);
  if (ok(h)) return h;
  const [l0, a, b] = toOklab(h), up = lightness(bgs[0]) < 0.6;
  const at = (t) => fromOklab([up ? l0 + (1 - l0) * t : l0 * (1 - t), a, b]);
  if (!ok(at(1))) return up ? '#ffffff' : '#000000';
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (ok(at(mid))) hi = mid; else lo = mid; }
  return at(hi);
}

/* ---------- hue families, for giving jobs to a bare list of colours ---------- */
const inHue = (lo, hi) => (h) => { const x = hue(h); return chroma(h) > 0.06 && (lo <= hi ? x >= lo && x <= hi : x >= lo || x <= hi); };
export const FAMILIES = {
  red: inHue(350, 45),
  warm: inHue(38, 110),
  green: inHue(120, 175), // includes the teal-greens people read as "ok"
  blue: inHue(220, 285),
  any: () => true,
};

/* ---------- signals ----------
   A signal is a colour with a meaning in your app. Each one says which hue family it should come
   from when a palette doesn't name it, what to fall back to, and how much contrast it needs. */
export const DEFAULT_SIGNALS = {
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
export function assignJobs(colours, signals) {
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
export function normPalette(p, signals) {
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
 * Tokens: paper, panel, ink, ink-soft, hair, field, accent, accent-hover, accent-soft, on-accent,
 *         ornament, inverse-bg, inverse-fg, and per signal: <signal>, <signal>-soft, on-<signal>.
 * Text and border colours meet their targets on both paper and panel, since both are used as
 * backgrounds. hair is decorative (dividers); use field for borders that show where a control is.
 * A signal uses only its own colour (from the palette) or its fallback, never the accent, so it
 * can't be mistaken for "attention". auditDistinct checks the result stays tellable apart.
 * extend(tokens, { dark, palette }) may return more tokens your app needs (aliases, toast colours,
 * colours fitted against something other than the panel); they are added to the result.
 */
export function deriveTokens(palette, { dark = false, vivid = false, signals, extend } = {}) {
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
    // Off-white rather than the brightest possible: very bright text on a dark page glares.
    t.ink = withLightness(pale, clamp(lightness(pale), 0.86, 0.92), 0.05);
  }
  const surfaces = [t.paper, t.panel];
  t.ink = fit(t.ink, surfaces, 11);
  t['ink-soft'] = fit(mix(t.ink, t.panel, 0.42), surfaces, 4.8);
  t.hair = mix(t.ink, t.panel, 0.78);
  t.field = fit(mix(t.ink, t.panel, 0.55), surfaces, 3.1);
  t.accent = fit(r.accent, surfaces, 4.6);
  const best = (c, list) => list.reduce((x, y) => (contrast(c, y) > contrast(c, x) ? y : x));
  // Text on a filled colour: panel or ink if either reaches 4.5, else white or black (one always does).
  const onFor = (c) => { const p = best(c, [t.panel, t.ink]); return contrast(c, p) >= 4.5 ? p : best(c, ['#ffffff', '#000000']); };
  // A tinted background that ink stays readable on (≥ 7).
  const softOf = (c) => { let k = dark ? 0.2 : 0.14; while (k > 0.04 && contrast(t.ink, mix(t.panel, c, k)) < 7) k -= 0.02; return mix(t.panel, c, k); };
  const [lighter, darker] = lightness(t.panel) > lightness(t.ink) ? [t.panel, t.ink] : [t.ink, t.panel];
  t['on-accent'] = onFor(t.accent);
  // Hover/pressed: further from the text on it, so that text only gets easier to read.
  t['accent-hover'] = mix(t.accent, lightness(t['on-accent']) > 0.5 ? darker : lighter, 0.18);
  t['accent-soft'] = softOf(t.accent);
  t.ornament = fit(r.ornament, surfaces, 1.6);
  t['inverse-bg'] = t.ink;
  t['inverse-fg'] = t.panel;
  for (const [name, s] of Object.entries(sig)) {
    const c = fit(r.signals[name] || s.fallback[dark ? 'dark' : 'light'], surfaces, s.min);
    t[`${name}-soft`] = softOf(c);
    t[name] = fit(c, [...surfaces, t[`${name}-soft`]], s.min);
    t[`on-${name}`] = onFor(t[name]);
  }
  return typeof extend === 'function' ? { ...t, ...extend({ ...t }, { dark, palette: r }) } : t;
}

const decl = (t, dark) => Object.entries(t).map(([k, v]) => `--${k}:${v};`).join('') + `color-scheme:${dark ? 'dark' : 'light'};`;

/**
 * CSS for a palette: light by default, dark when the system asks (unless data-theme="light"),
 * and dark whenever data-theme="dark". Every selector is more specific than a plain :root, so a
 * page's own :root defaults never override the theme, whichever stylesheet comes first.
 */
export function themeCss(palette, opts = {}) {
  const light = deriveTokens(palette, { ...opts, dark: false });
  const dark = deriveTokens(palette, { ...opts, dark: true });
  return `html:root{${decl(light, false)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(dark, true)}}}`
    + `:root[data-theme="dark"]{${decl(dark, true)}}`;
}

/**
 * Contrast of each token against every background it is used on, with its target.
 * Returns [{ token, against, ratio, min, ok }]. For audits and tests.
 */
export function auditTokens(t, signals) {
  const sig = normSignals(signals);
  const checks = [
    ['ink', ['paper', 'panel'], 11], ['ink-soft', ['paper', 'panel'], 4.8], ['field', ['paper', 'panel'], 3.1],
    ['accent', ['paper', 'panel'], 4.6], ['on-accent', ['accent', 'accent-hover'], 4.5], ['ink', ['accent-soft'], 7],
    ['ornament', ['paper', 'panel'], 1.6],
  ];
  for (const [name, s] of Object.entries(sig)) {
    checks.push([name, ['paper', 'panel', `${name}-soft`], s.min], [`on-${name}`, [name], 4.5], ['ink', [`${name}-soft`], 7]);
  }
  const rows = [];
  for (const [token, against, min] of checks) {
    for (const bg of against) {
      if (!t[token] || !t[bg]) continue;
      const ratio = contrast(t[token], t[bg]);
      rows.push({ token, against: bg, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min - 0.01 });
    }
  }
  return rows;
}

/**
 * Colours that mean different things must look different. Checks each signal against the accent
 * and the other signals (at min), and against the ornament (at half of min: decoration only has
 * to not pass for a signal at a glance). Returns [{ token, against, distance, min, ok }], with
 * distance in OKLab (about 0.02 is just noticeable). Colour alone still must never carry meaning.
 */
export function auditDistinct(t, signals, min = 0.08) {
  const names = Object.keys(normSignals(signals));
  const rows = [];
  names.forEach((name, i) => {
    for (const other of ['accent', 'ornament', ...names.slice(i + 1)]) {
      if (!t[name] || !t[other]) continue;
      const need = other === 'ornament' ? min / 2 : min;
      const d = distance(t[name], t[other]);
      rows.push({ token: name, against: other, distance: Math.round(d * 1000) / 1000, min: need, ok: d >= need });
    }
  });
  return rows;
}

/* ---------- moods ----------
   The app reports what is happening; the theme decides how it looks. */
/** Toggle mood-<name> classes on <html>. Pass { alert: true, offline: false }. */
export function setMoods(moods, root = globalThis.document && document.documentElement) {
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
 *   extend:   extra tokens, as for deriveTokens
 * }
 * A look is { theme, mode, vivid, mood, palette, ...one value per layer }. theme is the theme it
 * started from; any field left out (or a null palette) comes from that theme.
 * save() stores only the theme id and the fields the user changed, so when you update a theme's
 * colours or layers, people who picked it see the update instead of a frozen copy.
 */
export function createLooks(config) {
  const { key, layers = {}, themes = {}, signals, extend, fonts = {} } = config;
  const MODES = ['auto', 'light', 'dark'];
  const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(themes, id);
  const defaultId = has(config.default) ? config.default : (Object.keys(themes)[0] ?? null);
  const loaded = new Set();
  const doc = globalThis.document;
  const pal = (p) => { try { return normPalette(p, signals); } catch (e) { return null; } };

  function normalize(l) {
    l = l && typeof l === 'object' ? l : {};
    const theme = has(l.theme) ? l.theme : defaultId;
    // Anything a theme leaves out comes from the default theme, then the layer's first value.
    const base = { ...(defaultId ? themes[defaultId] : {}), ...(theme ? themes[theme] : {}) };
    const out = {
      theme,
      mode: MODES.includes(l.mode) ? l.mode : (MODES.includes(base.mode) ? base.mode : 'auto'),
      vivid: 'vivid' in l ? !!l.vivid : !!base.vivid,
      mood: l.mood !== false,
      palette: pal(l.palette != null ? l.palette : base.palette),
    };
    for (const [layer, values] of Object.entries(layers)) {
      out[layer] = values.includes(l[layer]) ? l[layer] : (values.includes(base[layer]) ? base[layer] : values[0]);
    }
    return out;
  }
  const fields = ['mode', 'vivid', ...Object.keys(layers)];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const matches = (l, id) => { const t = normalize({ theme: id }); return fields.every((f) => t[f] === l[f]) && same(t.palette, l.palette); };
  /** The theme id this look matches exactly, or null once something was changed by hand. */
  function themeOf(look) {
    const l = normalize(look);
    return [l.theme, ...Object.keys(themes)].find((id) => id && matches(l, id)) || null;
  }
  /** The look for a theme, keeping the user's text size and mood setting. */
  function fromTheme(id, keep = {}) {
    const l = normalize({ theme: id });
    if (keep.size && layers.size && layers.size.includes(keep.size)) l.size = keep.size;
    if ('mood' in keep) l.mood = !!keep.mood;
    return l;
  }
  /** What save() stores: the theme id plus only the fields that differ from that theme. */
  function compact(look) {
    const l = normalize(look);
    const t = l.theme ? normalize({ theme: l.theme }) : null;
    const out = { theme: l.theme };
    if (!l.mood) out.mood = false;
    for (const f of fields) if (!t || t[f] !== l[f]) out[f] = l[f];
    if (!t || !same(t.palette, l.palette)) out.palette = l.palette;
    return out;
  }
  const prefersDark = () => !!(globalThis.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  /** The colours a look shows right now, for previews. */
  function tokens(look) {
    const l = normalize(look);
    return l.palette ? deriveTokens(l.palette, { dark: l.mode === 'dark' || (l.mode === 'auto' && prefersDark()), vivid: l.vivid, signals, extend }) : null;
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
    el.textContent = l.palette ? themeCss(l.palette, { vivid: l.vivid, signals, extend }) : '';
    return l;
  }
  function load() {
    if (!key) return normalize(null);
    try { return normalize(JSON.parse(localStorage.getItem(key))); } catch (e) { return normalize(null); }
  }
  function save(look) {
    const l = normalize(look);
    if (key) { try { localStorage.setItem(key, JSON.stringify(compact(l))); } catch (e) { /* private mode: keep going */ } }
    return apply(l);
  }
  return { normalize, themeOf, fromTheme, compact, tokens, apply, load, save, themes, layers };
}
