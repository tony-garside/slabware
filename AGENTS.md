# Building with slabware: notes for agents

slabware is a plain CSS + JS component library: teal desk, loud flat slabs, hard ink shadows, no rounding. No build step, no npm package, no dependencies. This file is everything you need to build a page with it. `README.md` has the reasoning; `index.html` shows every component and its markup.

## 1. Get the files

The repo is public, MIT licensed, and needs no login:

```sh
git clone https://github.com/tony-garside/slabware /tmp/slabware
```

Then **vendor** it into your project. Copy files, don't link to the clone, so the project keeps working when slabware changes:

```sh
mkdir -p vendor/slabware
cp -r /tmp/slabware/{slabware.css,slabware.js,slabware-charts.js,fonts} vendor/slabware/
git -C /tmp/slabware rev-parse --short HEAD > vendor/slabware/VERSION
```

`fonts/` must sit next to `slabware.css`: the CSS loads Bungee and Courier Prime from `fonts/` by relative path. To update later, clone again, copy again, and look over the page.

If you can't fetch it, stop and ask. Don't recreate the library from memory.

## 2. Page skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ops desk</title>
  <link rel="stylesheet" href="vendor/slabware/slabware.css">
  <style>
    /* the page's own layout only. components come from slabware */
    body { padding: 32px 16px 80px; }
    main { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
  </style>
</head>
<body>
  <main>
    <header class="slab c-yellow" style="padding: 16px 18px">
      <h1 class="h1 drop" style="color: var(--red)">ops desk</h1>
      <span class="caps">a short subtitle</span>
    </header>

    <section class="grid" style="--min: 230px; --gap: 24px">
      <div class="slab stat c-red" style="--fg: var(--white)">
        <span class="label caps">requests today</span>
        <span class="value drop">9,529</span>
        <span class="delta good">▲ 11% vs a week ago</span>
      </div>
    </section>

    <figure class="slab chart c-mint" id="requests"></figure>
  </main>

  <script src="vendor/slabware/slabware.js"></script>         <!-- tabs, menus, dialogs, toasts -->
  <script src="vendor/slabware/slabware-charts.js"></script>  <!-- only if you draw charts -->
  <script>
    slabware.chart.line("#requests", {
      title: "requests", note: "per day, by app",
      x: ["oct 10", "11", "12"],
      series: [{ name: "storefront", values: [4200, 4500, 4300] }, { name: "admin", values: [600, 650, 700] }],
    });
  </script>
</body>
</html>
```

The body already gets the teal desk, the fonts and the base text styles from `slabware.css`. Don't restyle `body`'s background or fonts.

## 3. The rules (don't break these)

1. **Nothing is rounded.** No `border-radius`, ever, and that includes avatars, pills and radios.
2. **Shadows are solid ink, down and to the right.** Use `var(--drop)` (5px) for things you look at and `var(--drop-sm)` (2px) for little chips. No blur, no glow, no `rgba`.
3. **Flat paint.** Only the eleven colors below. No gradients, opacity, pastels, tints or transparency. To make text quieter, use small caps (`.caps` / `.dim`), not opacity or gray.
4. **Hover is always ink with yellow text.** Pressing sinks toward the shadow and nothing ever lifts. Add `.press` to make any slab clickable.
5. **Bungee shouts, mono talks.** Use `var(--display)` (Bungee) for headings, names and big numbers, and `var(--mono)` (Courier Prime) for everything else. Don't add fonts.
6. **Motion steps** (`steps()`), and is turned off for reduced motion.
7. **Less is more.** Shapes and color carry the design. Don't add icons, borders, dividers or decoration to "help". If something needs a hand-written style to look right, there is probably a class for it.

## 4. Color

Use only these colors: `yellow orange red plum blue mint lime`, plus `ink paper white desk`. Each is a CSS variable (`var(--red)`) and a class (`c-red`).

- Any slab-like thing takes a `c-*` class, which sets `--c` (its fill) and `--fg` (its text). The default is paper.
- `--c` and `--fg` don't inherit: a slab inside a red slab is paper again unless you give it a class too.
- **Don't make a big ink slab** (`c-ink`): it vanishes into its own shadow. Keep `c-ink` for badges, keys and stamps.
- Put neighboring slabs in different loud colors. Odd, high-contrast pairs are the style: plum and lime, blue and yellow, red and mint.
- For a big number or heading in color, add `.drop`, which gives the text a hard ink shadow, and color it anything but ink.

## 5. Components

| Want | Markup |
|---|---|
| A card / panel | `<div class="slab c-mint" style="padding: 14px">…</div>`; clickable: add `press` (works on `<button>` and `<a>`) |
| Grid of cards | `<div class="grid" style="--min: 220px; --gap: 24px">`; add `messy` to scatter them a little crooked |
| Stack / row | `.stack` (column), `.row` (wrapping row); spacing via `--gap` |
| Headings | `.h1` `.h2` `.h3`; small caps text: `.caps`; quiet text: `.dim` |
| Button | `<button class="btn">save</button>`, `btn c-red`, `btn sm`; keys default to yellow |
| Keyboard key | `<kbd class="kbd">ctrl</kbd>` |
| Text field / select | `<label><span class="label">name</span><input class="field"></label>` (same for `<select class="field">`, `<textarea class="field">`) |
| Checkbox / radio | `<label class="opt"><input class="check" type="checkbox"> on deploy</label>` |
| Fieldset | `<fieldset class="group stack"><legend>notify</legend>…</fieldset>` |
| Progress | `<div class="progress c-mint" role="progressbar" aria-valuenow="62" style="--v: .62"></div>`; unknown length: add `busy` |
| Badge | `<span class="badge c-red">broken</span>` |
| Stamp | `<span class="stamp c-blue">approved</span>` |
| Callout | `<div class="slab callout c-orange" data-label="heads up">…</div>` |
| Tooltip | `data-tip="explains it"` on any element |
| Folder (titled box) | `<section class="folder"><header class="tab">deploys</header><div class="body">…</div></section>` |
| Table | `<table class="table">` with `<thead>`/`<tbody>`; numeric cells `class="num"` |
| Status | `<span class="status good">ok</span>` (`good` `warning` `serious` `critical`); always with a word |
| Tabs | `<div role="tablist">` of `<button role="tab" aria-controls="id">`, panels `role="tabpanel"`; needs `slabware.js` |
| Dropdown menu | `<details class="menu"><summary class="btn">deploy ▾</summary><div class="menu-list"><button>to stage</button></div></details>` |
| Dialog | `<button data-open="#confirm">` opens `<dialog class="folder c-yellow" id="confirm">` with a `.tab` header and a `.body`; `data-close` or `<form method="dialog">` closes it |
| Toast | `slabware.toast("deployed", { c: "mint", ms: 3000 })` |
| Stat tile | see the skeleton above: `.slab.stat` with `.label.caps`, `.value.drop`, `.delta.good`/`.bad`, optional `<div class="spark"></div>` |
| Tilted | `.tilt` / `.tilt-r` on one thing, for emphasis, sparingly |

For anything not listed, copy the markup from `index.html` rather than inventing it.

## 6. Charts

Load `slabware-charts.js`. Each chart goes in an empty `<figure class="slab chart c-…">`; the `c-*` class colors its title band. Each call returns `{ update(opts) }`, and charts redraw on resize.

```js
slabware.chart.line(el, { title, note, x: [...labels], series: [{ name, values }], format, height, area, shape: "straight" | "steps" });
slabware.chart.bar(el, { title, note, categories: [...], series: [{ name, values }], stacked, horizontal, format });
slabware.chart.heatmap(el, { title, rows: [...], cols: [...], values: [[...]] });
slabware.chart.gauge(el, { title, value, min, max, unit, zones: [{ upTo, status, label }], shape: "dial" | "bar" });
slabware.chart.spark(el, values);   // or <div data-spark="3,5,4,8"></div>
```

- **Use the right chart.** Line for change over time, bar for comparing amounts, heatmap for a grid of counts, gauge for one value against limits, and a stat tile for one headline number.
- **Series colors are automatic** and fixed per series: blue, yellow, red, mint, plum, orange, lime. Don't pass colors. More than seven series is too many: group the extras or split the chart.
- **Gauges** take `--dial` and `--needle` on the figure, e.g. `style="--dial: var(--blue); --needle: var(--yellow)"`. Zone `status` is `good` `warning` `serious` or `critical`.
- `format` is a function from value to string, e.g. `v => v + "ms"`.
- **Never build a dual-axis chart.** Two measures with different scales get two charts.
- **Leave the rest alone.** Legends, tooltips, the table view and keyboard support are all built in.

## 7. Before you hand it over

Render the page and look at it (a headless screenshot is fine, e.g. `chromium --headless --screenshot=out.png --window-size=1280x1600 file://$PWD/page.html`). Check that:

- there's no rounding, blur, gradient or transparency anywhere, including in your own `<style>`;
- no colors appear except the eleven;
- text on every colored slab is readable (`c-plum`, `c-blue` and `c-desk` take white text; the rest take ink);
- the page works at phone width without scrolling sideways.

`examples/dashboard.html` is a complete, idiomatic page. When unsure, do what it does.
