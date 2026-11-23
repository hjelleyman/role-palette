---
name: app-theming
description: Design and build a theme system for a web app where every colour has one job, one palette makes readable light and dark versions, looks are combinable layers (colour, structure, lettering, spacing), and the page can react to what the app is doing. Use when someone asks for themes, a colour scheme, dark mode, an appearance or settings page, a "make it look like X" restyle, or wants the UI to respond to app state (alerts, offline, success). Also use to audit an existing theme for contrast or colours that mean two things.
---

# App theming: every colour has one job

This is a method first and a library second. Follow the method in any stack; use the
`role-palette` engine (in this repo's `src/role-palette.js`, or `dist/role-palette.global.js` as a
classic script) when the app is plain HTML/JS or when hand-rolling the colour maths would be wasted
effort.

## The four ideas

1. **Colours have jobs, not names.** Before choosing any colour, list the jobs:
   - `paper`, `ink`: the page and the writing on it
   - `accent`: attention only. Focus rings, the chosen option, the thing to act on next
   - `ornament`: decoration only. Rules, headings, flourishes. It must never carry meaning,
     so a colour-blind user or a monochrome theme loses nothing
   - **signals**: one colour per meaning the app actually has (danger, success, warning,
     "live", "light source"...). A signal colour is used for that meaning and nothing else,
     in every theme. Decide each signal's hue family (danger stays red) so no palette can
     break the meaning.
   If a colour is doing two jobs, split it. If a job has no meaning in this app, drop it.

2. **A look is layers that combine freely**, each one attribute on `<html>`:
   - colour: the palette, written as CSS custom properties (`--paper`, `--ink`, `--accent`, ...)
   - structure: frames, borders, shadows, decoration (`data-style`)
   - voice: lettering (`data-font`)
   - rhythm: spacing and text size (`data-density`, `data-size`)
   A **theme** is one chosen point across all four, with a name and a one-line description.
   Users pick a theme in one tap, then may change any single layer; once they do, the UI
   should show the look as "custom" rather than lying about which theme it is.

3. **One palette makes both light and dark.** Don't hand-maintain two palettes. The lighter of
   paper/ink becomes the page in light mode and the writing in dark mode; every derived colour
   is then nudged in lightness (in OKLab, so the hue holds) until it meets a contrast target.
   This is what makes user-supplied and imported palettes safe.

4. **The page can react to the app.** The app reports state as `mood-<name>` classes on
   `<html>` (`mood-alert`, `mood-offline`, `mood-celebrate`). Each structure style decides how
   that looks *in its own way*. App code never touches colours or animation directly. Moods are
   optional: honour `prefers-reduced-motion`, and offer an off switch (the engine adds `.calm`
   to `<html>` when the user turns moods off).

## Workflow

1. **Inventory.** Read the app's existing CSS and components. List every colour in use and
   what each is *for*. Note colours that mean two things and meanings with no stable colour.
2. **Name the jobs and signals** for this app (see idea 1). Write them down in a comment at
   the top of the theme code; it's the contract every theme keeps.
3. **Refactor to tokens.** Replace literal colours with `var(--paper)`, `var(--ink)`,
   `var(--ink-soft)`, `var(--hair)`, `var(--field)`, `var(--panel)`, `var(--accent)`,
   `var(--accent-hover)`, `var(--accent-soft)`, `var(--on-accent)`, `var(--ornament)`,
   `var(--inverse-bg)`, `var(--inverse-fg)`, and per signal `var(--<signal>)`,
   `var(--<signal>-soft)` (tinted background) and `var(--on-<signal>)` (text on the filled
   colour). `hair` is for decorative dividers only; borders that show where a control is use
   `field`. Keep a sensible default in the stylesheet so the page works before any theme is
   applied.
4. **Choose the layers.** Pick 2-7 structure styles and 2-7 letterings that suit the app's
   character. Write structure styles as `:root[data-style="x"] ...` rule sets that change
   borders, radii, shadows, backgrounds and decoration, never colour values.
5. **Compose themes.** 4-8 themes, each a deliberate combination with a short blurb. Include at
   least one plain/modern theme and one that follows the system light/dark setting.
6. **Wire the saved look** so it applies in `<head>` before first paint (no flash of the
   wrong theme): a classic `<script>` that reads storage and applies, then the app loads.
7. **Add moods** if the app has meaningful states. App code calls `setMoods({ alert: x })`;
   CSS per structure style responds. Keep motion small and wrap animation in
   `@media (prefers-reduced-motion: no-preference)` and `:root:not(.calm)`.
8. **Appearance UI.** Theme cards that preview their own colours and lettering, then per-layer
   controls (mode auto/light/dark, style, font, density, size, palette). Show "Custom" when
   the look no longer matches a theme.
9. **Audit** with the checklist below. With the engine, `auditTokens(t, signals)` gives the
   contrast of each token on every background it is used on, and `auditDistinct(t, signals)`
   shows any signal that looks too much like the accent or another signal. Run both for each
   palette in light and dark (`t = deriveTokens(p, { dark, vivid, signals })`).

## Using the engine

```html
<head>
  <script src="role-palette.global.js"></script>
  <script>
    window.looks = RolePalette.createLooks({
      key: 'my-app-look',
      layers: { style: ['plain', 'card'], font: ['sans', 'serif'], density: ['m', 's', 'l'], size: ['m', 's', 'l'] },
      signals: {
        danger: { family: 'red', fallback: { light: '#b3261e', dark: '#ff6b61' } },
        success: { family: 'green', fallback: '#1f7a3a' },
      },
      themes: {
        paper: { name: 'Paper', mode: 'auto', style: 'plain', font: 'serif',
                 palette: { paper: '#f4efe4', ink: '#1d1a16', accent: '#2a5d8f', ornament: '#b08a3e' } },
        night: { name: 'Night', mode: 'dark', vivid: true, style: 'card', font: 'sans',
                 palette: ['#0f1222', '#e6e9f5', '#7aa2ff', '#ff5d73', '#38d39f'] },
      },
      default: 'paper',
    });
    looks.apply(looks.load());
  </script>
</head>
```

- A palette is `{ paper, ink, accent, ornament?, signals? }`, or a bare array of colours, which
  `assignJobs` sorts into jobs (lightest = paper, darkest = ink, signals by hue family, most
  colourful remaining = accent then ornament). That's how to import any published palette.
- `looks.save(look)` stores and applies; `looks.fromTheme(id, { size, mood })` switches theme
  while keeping the user's text size and mood setting; `looks.themeOf(look)` returns the
  matching theme id or `null` (show "Custom").
- `looks.tokens(look)` returns the colours currently shown, for theme-card previews.
- `RolePalette.setMoods({ alert: true })` toggles `mood-alert` on `<html>`.
- ES module users: `import { createLooks, setMoods } from 'role-palette'`. For no-flash, still
  apply the saved look from a small inline classic script in `<head>`.

In a framework app (React, Svelte...), use `themeCss(palette, { vivid, signals })` to get the CSS
string and inject it once; keep layer attributes on `<html>`, not in component state.

## Checklist

- [ ] Every colour in the CSS is a token; no literal colours left in components
- [ ] Each token has exactly one job; ornament never carries meaning
- [ ] Each signal keeps its meaning (and hue family) in every theme, and never looks like the
      accent (no red accent when danger is red)
- [ ] Text meets contrast on both paper and panel: ink ≥ 7 (engine targets 11), secondary text
      ≥ 4.5, accent and signals ≥ 4.5, form-field borders ≥ 3, text on filled accent/signals
      ≥ 4.5, in both light and dark, for every theme
- [ ] Text size uses percentages or rem, never a px root size
- [ ] Saved looks store the theme id, not a copy of its colours
- [ ] State is never shown by colour alone (add an icon, word or shape)
- [ ] Focus is visible in every structure style
- [ ] Saved look applies before first paint; no flash on reload
- [ ] `mode: auto` follows the system and updates when the system changes
- [ ] Animations respect `prefers-reduced-motion` and the `.calm` off switch
- [ ] Fonts load only when chosen, with a system fallback stack
- [ ] Imported palette data, fonts and artwork have licences that allow your use; credit them

See `references/patterns.md` for CSS patterns: structure styles, mood effects and theme cards.
