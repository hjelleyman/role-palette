# role-palette

Themes where every colour has one job.

- **One palette, light and dark.** Give it four colours (or any list of colours) and it makes a light
  and a dark version, nudging each colour's lightness until text meets contrast targets.
- **Colours have jobs, not names.** Paper, ink, accent (attention), ornament (decoration only), and
  one *signal* per meaning your app has (danger, success…). A signal means the same thing in every theme.
- **Looks are layers.** Colour, frame style, lettering and spacing are separate attributes on `<html>`
  and combine freely. A theme is one named point across all four.
- **The page can react to your app.** Toggle `mood-alert`, `mood-offline`… and let each style decide
  how that looks, with reduced motion and an off switch respected.

It comes in two parts:

| Part | What it is |
| --- | --- |
| [`skills/app-theming`](skills/app-theming/SKILL.md) | A Claude Code skill that teaches the method: inventory colours, name their jobs, refactor to tokens, compose themes, add moods, audit. Works in any stack. |
| [`src/role-palette.js`](src/role-palette.js) | A small dependency-free engine (~250 lines) for the colour maths, light/dark derivation, auto-assigning jobs to a colour list, and saving and applying a look before first paint. |

Open [`examples/index.html`](examples/index.html) to try five themes, the layer controls, two moods
and a live contrast audit.

## Install the skill

In Claude Code:

```
/plugin marketplace add hjelleyman/role-palette
/plugin install role-palette@role-palette
```

Then ask for themes, dark mode, an appearance page, or a contrast audit, and the skill loads.

## Use the engine

No build step needed. As a classic script (so the saved look applies before the page paints):

```html
<script src="https://cdn.jsdelivr.net/gh/hjelleyman/role-palette@v0.2.0/dist/role-palette.global.js"></script>
<script>
  const looks = RolePalette.createLooks({
    key: 'my-app-look',
    layers: { style: ['plain', 'ink'], font: ['sans', 'serif'], size: ['m', 's', 'l'] },
    signals: { danger: { family: 'red', fallback: { light: '#b3261e', dark: '#ff6b61' } } },
    themes: {
      clean: { name: 'Clean', mode: 'auto', style: 'plain', font: 'sans',
               palette: { paper: '#f6f7f9', ink: '#15171c', accent: '#4f46e5', ornament: '#c7cdf5' } },
      ledger: { name: 'Ledger', mode: 'light', style: 'ink', font: 'serif',
                palette: ['#f4efe4', '#1d1a16', '#2a5d8f', '#b08a3e', '#a8321f'] },
    },
    default: 'clean',
  });
  looks.apply(looks.load());
</script>
```

Or as an ES module: `import { createLooks, themeCss, setMoods } from 'role-palette'`.

Your CSS then uses `var(--paper)`, `var(--panel)`, `var(--ink)`, `var(--ink-soft)`, `var(--hair)`,
`var(--field)`, `var(--accent)`, `var(--on-accent)`, `var(--ornament)`, `var(--inverse-bg)`,
`var(--inverse-fg)` and `var(--<signal>)`, and styles each `[data-style]`, `[data-font]`,
`[data-density]` and `[data-size]`.

### API

| Function | Does |
| --- | --- |
| `createLooks(config)` | A store for the user's look: `load`, `save`, `apply`, `normalize`, `fromTheme(id, keep)`, `themeOf(look)`, `tokens(look)` |
| `themeCss(palette, { vivid, signals })` | CSS for light, system dark and forced dark (`data-theme`) |
| `deriveTokens(palette, { dark, vivid, signals, extend })` | The token colours as an object. `extend(tokens, { dark })` adds tokens your app needs, such as aliases |
| `assignJobs(colours, signals)` | Turns any list of colours into `{ paper, ink, accent, ornament, signals }` |
| `auditTokens(tokens, signals)` | Contrast ratio of each token against its target |
| `setMoods({ alert: true })` | Toggles `mood-alert` on `<html>` |
| `contrast`, `fit`, `mix`, `withLightness`, `toOklab`, `fromOklab` | The colour maths |

## Bring your own palettes

`assignJobs` takes any list of hex colours: a brand kit, a palette site, colours picked from a photo.
This repo ships no third-party palette collections, fonts or artwork. If you load someone else's
palette data or fonts, check their licence and credit them.

## Develop

```
npm test
```

builds `dist/role-palette.global.js` from `src/` and runs the tests (Node 18+, no dependencies).

## Credits

OKLab colour space by Björn Ottosson. Contrast ratios follow WCAG 2.

MIT licence.
