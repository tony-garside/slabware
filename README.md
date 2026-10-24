# slabware

A component library from 1997, give or take. Teal desk, loud slabs, hard shadows, no rounding anywhere.

Open `index.html` for the kitchen sink: every component, every state, and the markup for each.

Building a page with it as an agent? Read `AGENTS.md`.

## Use it

```html
<link rel="stylesheet" href="slabware.css">
<script src="slabware.js"></script> <!-- optional: tabs, menus, dialogs, toasts -->
```

No build step, no dependencies. It's tuned for Chromium (scrollbars are `::-webkit-scrollbar`).

## The idea

Three materials, and every component is made of one of them:

- **slab** stands up: flat color, a 2px ink border, a solid shadow down and to the right. `.slab`, `.tile`, `.folder`, `.badge`, `.callout`, `.table`, `.menu-list`, `.toast`
- **key** presses: a loud keycap with a thick ink lip along the bottom. Pressing flips the lip to the top. `.btn`, `.kbd`
- **well** sinks: an ink outline, with the hard shadow falling *inside* the top left. `.field`, `.check`, `.progress`

Put `.messy` on a grid and everything in it lands a little crooked, like cards dropped on a desk. The mess repeats every seven, so it's the same on every load.

Type can stand up too: `.drop` gives loud letters a hard ink shadow, sized to the text. Color the letters anything but ink, and keep it for big headings and numbers.

Then there's ink, which isn't a material: labels, tooltips and hover inversions. And there's `.stamp`, a solid block of color printed on crooked, flat with no shadow.

## The rules

1. Nothing is rounded, not even radios. They get a diamond.
2. Shadows are solid ink, down and to the right.
3. Pressing sinks toward the shadow, and nothing ever lifts. Add `.press` to any slab.
4. Stand, press or sink: pick one per thing.
5. Motion steps (`steps()`), and stops for reduced motion.
6. Flat paint: eleven solid colors and nothing else. Nothing fades, glows or goes see-through, and hover is always the same move: ink, with yellow type.
7. Bungee shouts, mono talks: Bungee for names, headings and big numbers (`--display`), Courier Prime for everything else (`--mono`). Both are bundled in `fonts/` (SIL Open Font License).

## Color

Slabs read `--c` (background) and `--fg` (text). There are eleven colors, and that's all of them: seven loud ones (yellow, orange, red, plum, blue, mint, lime) and four neutrals (ink, paper, white, desk). Every one is solid; nothing is see-through or pastel. Set them with a class (`c-yellow`, `c-orange`, `c-red`, `c-plum`, `c-blue`, `c-mint`, `c-lime`, `c-paper`, `c-white`, `c-desk`, `c-ink`) or inline (`style="--c: #ff6f00"`). Keep `c-ink` for small things (badges, keys, stamps): an ink slab disappears into its own shadow. They're registered as non-inheriting, so a slab inside a red slab goes back to paper unless you color it too. Keys, checks, progress bars, badges, stamps, folders and tabs take the same classes.

## Charts

```html
<script src="slabware-charts.js"></script>
```

```js
slabware.chart.line("#el", { title, note, x: [...labels], series: [{ name, values }], format, height, area, shape: "straight" | "steps" });
slabware.chart.bar("#el", { title, categories: [...], series: [...], stacked, horizontal, format });
slabware.chart.heatmap("#el", { title, rows: [...], cols: [...], values: [[...]] });
slabware.chart.gauge("#el", { title, value, min, max, unit, zones: [{ upTo, status, label }], shape: "dial" | "bar" });
slabware.chart.spark(el, values);  // or <div data-spark="3,5,4,8"></div>
```

Each call returns `{ update(opts) }` for redrawing with new data, and charts redraw themselves when their box changes width. Put them in a `<figure class="slab chart">`: a paper slab with a colored band across the top, which a `c-*` class colors. The stat tile (`.stat`) is plain HTML, because when the story is one number, the number is the chart.

What they look like:

- **Every mark is a little slab:** solid color, an ink outline. Bars cast a hard shadow and press into it when you hover them.
- **Line charts are ribbons:** fat flat lines in the series colors, straight on the card, each casting a hard ink shadow like a slab. No outlines, no gridlines: the axis keeps the top value, the floor, and the first and last labels. Each series ends in a chip of its own color with its latest value, and hovering shows a marker (a shape per series). One series (or `area: true`) is a solid hill instead, its shadow along the ridge. `shape: "steps"` draws staircases.
- **Values ride in ink tags** on bar tips, and the tooltip is a yellow slab.
- **Heatmaps are a board of tiles set in ink**, running hot from pale yellow to plum.
- **Gauges are a cartoon car dashboard in as few shapes as possible:** an octagon face, one solid block per zone, a fat needle and the number. No ticks, no scale. Paint the face with `--dial` and the needle and number with `--needle`, and pick an odd high-contrast pair (blue and yellow, plum and lime, red and mint). `shape: "bar"` is the fuel gauge.
- **Flat, solid, high contrast.** Nothing glows, fades or goes see-through, and nothing goes pastel.

How they behave:

- **Every chart has a tooltip.** Hover it, or tab to it and use the arrow keys.
- **Every chart has a table view** behind its `table` key, so no value is locked inside a tooltip.
- **Two or more series get a legend.** Clicking an entry hides or shows that series, and the others keep their colors.

The series colors (`--viz-1` to `--viz-7`) are the loud hues themselves: blue, yellow, red, mint, plum, orange, lime. Use them in order; an eighth series goes white as "other". Pale ones like yellow stay readable because of the ink outline, and lines never rely on color alone because each series also gets its own marker shape. Heatmaps use `--seq-1` to `--seq-4`: yellow, orange, red, plum. `--good`, `--warning`, `--serious` and `--critical` (mint, yellow, orange, red) mean status, and always come with an icon and a word.

`examples/dashboard.html` puts it all together.

## JS

```js
slabware.toast("deployed", { c: "mint", ms: 3000 });
```

- `<button data-open="#id">` opens a `<dialog class="folder" id="id">`. `data-close` inside it, a `method="dialog"` form, or a backdrop click closes it.
- `[role=tab]` buttons with `aria-controls` switch panels, and the arrow keys move between them.
- `details.menu` dropdowns close when you click outside them, pick an item, or press Escape.

`examples/homepage.html` is a start page built with it, and `examples/dashboard.html` is a dashboard.

## License

MIT, see `LICENSE`. The fonts in `fonts/` are under the SIL Open Font License (`fonts/OFL-*.txt`).
