# CSS patterns

## Defaults before any theme

```css
:root {
  --paper: #f6f7f9; --panel: #ffffff; --ink: #15171c; --ink-soft: #545866;
  --hair: #d8dbe2; --field: #8a8f9c; --accent: #3b4fd1; --on-accent: #ffffff;
  --ornament: #c7cdf5; --inverse-bg: #15171c; --inverse-fg: #ffffff; --danger: #b3261e;
  color-scheme: light;
}
body { background: var(--paper); color: var(--ink); }
```

## Structure styles change shape, never colour values

```css
:root[data-style="plain"] .card { border: 1px solid var(--hair); border-radius: 12px; }
:root[data-style="ink"]   .card { border: 2px solid var(--ink); border-radius: 0; box-shadow: 4px 4px 0 var(--ink); }
:root[data-style="soft"]  .card { border: 0; border-radius: 18px; box-shadow: 0 6px 24px color-mix(in oklab, var(--ink) 12%, transparent); }
:root[data-style="terminal"] .card { border: 1px dashed var(--accent); border-radius: 0; }
:root[data-style="ink"] h2::after { content: ''; display: block; height: 3px; background: var(--ornament); }
```

## Lettering and rhythm

```css
:root[data-font="serif"] { --face: Georgia, 'Times New Roman', serif; }
:root[data-font="sans"]  { --face: system-ui, -apple-system, 'Segoe UI', sans-serif; }
:root[data-font="mono"]  { --face: ui-monospace, 'Cascadia Mono', Consolas, monospace; }
body { font-family: var(--face, system-ui, sans-serif); }

:root[data-density="s"] { --gap: 8px; }  :root[data-density="m"] { --gap: 14px; }  :root[data-density="l"] { --gap: 22px; }
/* Percentages, never px: a px root size overrides the text size the user set in their browser. */
:root[data-size="s"] { font-size: 93.75%; } :root[data-size="m"] { font-size: 106.25%; } :root[data-size="l"] { font-size: 125%; }
```

## Moods: one state, a different look per structure style

The app only toggles classes. Each style decides what the state looks like.

```css
/* Static cues work everywhere, including with motion off. */
:root.mood-alert .status { outline: 2px solid var(--danger); }

/* Movement only when allowed. */
@media (prefers-reduced-motion: no-preference) {
  :root:not(.calm).mood-alert[data-style="soft"] body { animation: pulse 2.4s ease-in-out infinite; }
  :root:not(.calm).mood-alert[data-style="terminal"] .card { animation: flicker 3s steps(2) infinite; }
}
:root:not(.calm).mood-offline body { filter: grayscale(0.7); }
:root:not(.calm).mood-offline[data-style="ink"] body { background-image: repeating-linear-gradient(45deg, transparent 0 10px, var(--hair) 10px 11px); }

@keyframes pulse { 50% { box-shadow: inset 0 0 60px color-mix(in oklab, var(--danger) 30%, transparent); } }
@keyframes flicker { 50% { opacity: 0.85; } }
```

Good moods are rare and meaningful: a few states the user would want to *feel*, not every event.
Always pair them with a non-visual or textual cue for the same state.

## Theme cards that preview themselves

```js
for (const [id, theme] of Object.entries(looks.themes)) {
  const t = looks.tokens(looks.fromTheme(id));
  card.style.cssText = `background:${t.paper};color:${t.ink};border-color:${t.accent}`;
  card.dataset.font = theme.font;           // let the card show its own lettering
  card.setAttribute('aria-pressed', looks.themeOf(current) === id);
}
```

## Listening to the system

```js
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  // CSS already switches; only previews built from looks.tokens() need re-rendering.
});
```
