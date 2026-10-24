// slabware-charts.js — line, bar, heatmap, gauge and sparkline charts, drawn as svg.
// needs slabware.css. every chart gets a tooltip that also works from the keyboard,
// and a table view behind its "table" key; more than one series gets a legend.
//
//   slabware.chart.line("#el", { x: [...], series: [{ name, values }] })
//   slabware.chart.bar("#el", { categories: [...], series: [...], stacked, horizontal })
//   slabware.chart.heatmap("#el", { rows: [...], cols: [...], values: [[...]] })
//   slabware.chart.gauge("#el", { value, min, max, zones: [{ upTo, status, label }] })
//   <div data-spark="3,5,4,8"></div>  (or slabware.chart.spark(el, values))
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const CHAR = 0.6; // courier prime is .6em wide per character, so text can be measured without the dom

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    if (parent) parent.append(el);
    return el;
  }

  function html(tag, cls, parent, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.append(el);
    return el;
  }

  function text(parent, x, y, str, attrs) {
    const t = svg("text", { x, y, ...attrs }, parent);
    t.textContent = str;
    return t;
  }

  // seven series colors in a fixed order. an eighth series doesn't get a made-up hue
  const color = i => (i < 7 ? `var(--viz-${i + 1})` : "var(--viz-other)");
  const DROP = 5; // the hard shadow, same as --drop

  // text that sits on a series color: white on the dark ones (blue, red, plum), ink on the rest
  const onColor = i => ([0, 2, 4].includes(i) ? "var(--white)" : "var(--ink)");

  // every line series also gets its own marker shape, so color is never the only tell
  const SHAPES = [
    r => [[-r, -r], [r, -r], [r, r], [-r, r]],
    r => [[0, -r * 1.4], [r * 1.4, 0], [0, r * 1.4], [-r * 1.4, 0]],
    r => [[0, -r * 1.4], [r * 1.3, r], [-r * 1.3, r]],
    r => [[-r * 1.3, -r], [r * 1.3, -r], [0, r * 1.4]],
    r => { const t = r * .45; return [[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]]; },
    r => [[-r, -r], [r, -r], [0, 0], [r, r], [-r, r], [0, 0]],
  ];
  function marker(parent, i, x, y, r = 4.5, fill = color(i)) {
    const pts = SHAPES[i % SHAPES.length](r).map(([dx, dy]) => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`).join(" ");
    return svg("polygon", { class: "dot", points: pts, fill }, parent);
  }

  // 1,284 / 12.9K / 4.2M. axis ticks go compact from 1,000 up, everything else from 10,000
  function compact(v, from = 1e4) {
    if (v == null || Number.isNaN(v)) return "—";
    const a = Math.abs(v);
    const short = (n, unit) => +n.toFixed(Math.abs(n) >= 100 ? 0 : 1) + unit;
    if (a >= 1e9) return short(v / 1e9, "B");
    if (a >= 1e6) return short(v / 1e6, "M");
    if (a >= from) return short(v / 1e3, "K");
    return (+v.toFixed(a >= 100 ? 0 : 2)).toLocaleString("en-US");
  }

  function niceTicks(lo, hi, count = 4) {
    if (lo === hi) hi = lo + 1;
    const raw = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw);
    const ticks = [];
    for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) ticks.push(+v.toPrecision(12));
    return ticks;
  }

  const width = str => String(str).length * 11 * CHAR;
  const crisp = y => Math.round(y) + .5;


  // ---------- mounting: every chart re-renders when its box changes width ----------

  const DRAW = {};
  const resize = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const s = target._sw;
      if (s && Math.abs(innerWidth(target) - s.width) > 1) render(target);
    }
  });

  function innerWidth(el) {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  // the display font is measured from the page, so redraw everything once fonts arrive
  const mounted = new Set();
  document.fonts?.addEventListener("loadingdone", () => mounted.forEach(render));

  function mount(kind, el, opts) {
    if (typeof el === "string") el = document.querySelector(el);
    el._sw = { kind, opts, hidden: new Set(), width: 0 };
    render(el);
    resize.observe(el);
    mounted.add(el);
    return { el, update(next) { Object.assign(el._sw.opts, next); render(el); } };
  }

  function render(el) {
    const s = el._sw;
    s.width = innerWidth(el);
    DRAW[s.kind](el, s);
  }


  // ---------- the frame: caption, table key, legend, plot, table ----------

  function frame(el, s, { table = true } = {}) {
    el.classList.add("chart");
    let cap = el.querySelector(":scope > figcaption");
    if (!cap) {
      cap = html("figcaption");
      const head = html("div", null, cap);
      if (s.opts.title) html("b", "h3", head, s.opts.title);
      if (s.opts.note) html("span", "dim", head, s.opts.note);
      el.prepend(cap);
    }
    if (table && !cap.querySelector(".chart-toggle")) {
      const key = html("button", "btn sm chart-toggle", cap, "table");
      key.type = "button";
      key.setAttribute("aria-pressed", "false");
      key.addEventListener("click", () => key.setAttribute("aria-pressed", el.classList.toggle("tabled")));
    }
    const part = cls => el.querySelector(`:scope > .${cls}`) || html("div", cls, el);
    const legend = part("legend"), plot = part("plot"), box = part("chart-table");
    for (const p of [legend, plot, box]) p.replaceChildren();
    plot.classList.remove("hovering");
    return { legend, plot, box, width: Math.max(160, s.width) };
  }

  // the legend toggles series. colors stay with their series, so hiding one never repaints the rest.
  // line keys show the stroke and the marker shape, bar keys a swatch
  function legendFor(f, s, series, kind, paint = color) {
    if (series.length < 2) return;
    series.forEach((d, i) => {
      const b = html("button", null, f.legend);
      b.type = "button";
      b.setAttribute("aria-pressed", !s.hidden.has(i));
      if (kind === "line") {
        // a scrap of ribbon with its shadow, and the series' hover marker
        const key = svg("svg", { width: 28, height: 16, viewBox: "0 0 28 16", "aria-hidden": "true" }, b);
        svg("line", { class: "ribbon-drop", x1: 4, x2: 26, y1: 9, y2: 9, style: "stroke-width: 5" }, key);
        svg("line", { class: "ribbon", x1: 2, x2: 24, y1: 7, y2: 7, style: `stroke: ${paint(i)}; stroke-width: 5` }, key);
        marker(key, i, 13, 7, 3.5, paint(i));
      } else {
        html("i", null, b).style.background = paint(i);
      }
      html("span", null, b, d.name);
      b.addEventListener("click", () => {
        if (s.hidden.has(i)) s.hidden.delete(i);
        else if (s.hidden.size < series.length - 1) s.hidden.add(i);
        render(f.plot.parentElement);
      });
    });
  }

  function tableFor(f, head, rows) {
    const t = html("table", "table", f.box);
    const tr = html("tr", null, html("thead", null, t));
    head.forEach((h, i) => html("th", i ? "num" : null, tr, h));
    const body = html("tbody", null, t);
    for (const r of rows) {
      const row = html("tr", null, body);
      r.forEach((c, i) => html("td", i ? "num" : null, row, c));
    }
  }

  function tooltip(plot) {
    const tip = html("div", "chart-tip", plot);
    tip.hidden = true;
    return {
      show(x, y, title, rows) {
        tip.replaceChildren();
        if (title != null) html("div", "t", tip, title);
        for (const r of rows) {
          const row = html("div", "r", tip);
          const key = html("i", r.color ? null : "none", row);
          if (r.color) key.style.background = r.color;
          html("b", null, row, r.value);
          if (r.name) html("span", null, row, r.name);
        }
        tip.hidden = false;
        let left = x + 16;
        if (left + tip.offsetWidth > plot.clientWidth) left = x - 16 - tip.offsetWidth;
        tip.style.left = Math.max(0, left) + "px";
        tip.style.top = Math.max(0, y) + "px";
      },
      hide() { tip.hidden = true; },
    };
  }

  // one cursor per chart: the pointer picks the nearest index, arrow keys step it.
  // `across` is the row length for grids, so up and down move a whole row
  function cursor(target, count, pick, show, hide, across = 0) {
    let at = -1;
    const go = i => { at = Math.max(0, Math.min(count - 1, i)); show(at); };
    const off = () => { at = -1; hide(); };
    target.setAttribute("tabindex", "0");
    target.addEventListener("pointermove", e => {
      const r = target.getBoundingClientRect();
      const k = target.viewBox.baseVal.width / r.width || 1;
      const i = pick((e.clientX - r.left) * k, (e.clientY - r.top) * k);
      if (i == null) off(); else if (i !== at) go(i);
    });
    target.addEventListener("pointerleave", off);
    target.addEventListener("blur", off);
    target.addEventListener("focus", () => go(at < 0 ? 0 : at));
    target.addEventListener("keydown", e => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: across || 1, ArrowUp: -(across || 1) }[e.key];
      if (step) { e.preventDefault(); go(at + step); }
      if (e.key === "Escape") off();
    });
  }

  function yAxis(g, ticks, Y, left, right) {
    const grid = svg("g", { class: "grid" }, g);
    for (const t of ticks) {
      if (t !== 0) svg("line", { x1: left, x2: right, y1: crisp(Y(t)), y2: crisp(Y(t)) }, grid);
      text(g, left - 8, Y(t), compact(t, 1e3), { "text-anchor": "end", "dominant-baseline": "middle" });
    }
  }

  // x labels, thinned to every nth so they never overlap
  function xLabels(g, labels, X, room, y) {
    const every = Math.max(1, Math.ceil((Math.max(...labels.map(width)) + 12) / room));
    labels.forEach((l, i) => { if (i % every === 0) text(g, X(i), y, l, { "text-anchor": "middle" }); });
  }

  // a value in an ink tag with yellow type. x, y is where the tag's anchor edge sits
  function tag(parent, x, y, str, anchor = "middle") {
    const w = width(str) + 10, h = 17;
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    svg("rect", { class: "tag-box", x: x0, y: y - h / 2, width: w, height: h }, parent);
    text(parent, x0 + w / 2, y + 1, str, { class: "tag", "text-anchor": "middle", "dominant-baseline": "middle" });
    return w;
  }

  const root = (f, height, label) =>
    svg("svg", { width: f.width, height, viewBox: `0 0 ${f.width} ${height}`, role: "img", "aria-label": label }, f.plot);


  // ---------- line: fat flat ribbons, each casting a hard ink shadow, straight on the card ----------
  // no panel, no outlines, no gridlines; the axis keeps the top value, the floor, and the first and last labels.
  // each series ends in a chip of its own color with its latest value on it. one series is a solid hill instead

  DRAW.line = (el, s) => {
    const { x: labels, series, format = compact, height = 240, shape = "straight" } = s.opts;
    const f = frame(el, s);
    legendFor(f, s, series, "line");
    tableFor(f, ["", ...series.map(d => d.name)], labels.map((l, i) => [l, ...series.map(d => format(d.values[i]))]));

    const shown = series.map((d, i) => ({ ...d, i })).filter(d => !s.hidden.has(d.i));
    const all = shown.flatMap(d => d.values).filter(v => v != null);
    const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
    const lo = ticks[0], hi = ticks.at(-1);
    const n = labels.length, last = d => { for (let i = n - 1; i >= 0; i--) if (d.values[i] != null) return i; return -1; };

    // room on the left for two axis numbers, on the right for the end chips
    const CHIP = 15 * .72; // bungee is about .72em per character
    const chipW = e => format(e.d.values[e.i]).length * CHIP + 16;
    const ends = shown.map(d => ({ d, i: last(d) })).filter(e => e.i >= 0);
    const left = Math.max(width(compact(lo, 1e3)), width(compact(hi, 1e3))) + 12;
    const right = (ends.length ? Math.max(...ends.map(chipW)) : 0) + 16 + DROP;
    const T = 10, B = height - 26;
    const pw = f.width - left - right;
    const X = i => left + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const Y = v => T + (1 - (v - lo) / (hi - lo)) * (B - T);

    const svgEl = root(f, height, s.opts.title || "line chart");
    text(svgEl, left - 10, Y(hi), compact(hi, 1e3), { "text-anchor": "end", "dominant-baseline": "middle" });
    text(svgEl, left - 10, Y(lo), compact(lo, 1e3), { "text-anchor": "end", "dominant-baseline": "middle" });
    text(svgEl, X(0), height - 6, labels[0], { "text-anchor": "start" });
    if (n > 1) text(svgEl, X(n - 1), height - 6, labels[n - 1], { "text-anchor": "end" });

    // a staircase steps halfway between points, so each value owns its own flat tread
    const pathOf = run => {
      const steps = shape === "steps";
      return `M${run[0][0]},${run[0][1]}` + run.slice(1).map(([x, y], k) => (steps ? `H${(run[k][0] + x) / 2}V${y}H${x}` : `L${x},${y}`)).join("");
    };
    const shift = `translate(${DROP} ${DROP})`;
    const area = s.opts.area ?? shown.length === 1;
    // all the shadows first, so no ribbon's shadow ever lands on top of another ribbon
    const shade = svg("g", null, svgEl), paint = svg("g", null, svgEl);
    for (const d of shown) {
      const runs = [];
      d.values.forEach((v, i) => {
        if (v == null) return;
        if (i === 0 || d.values[i - 1] == null) runs.push([]);
        runs.at(-1).push([X(i), Y(v), i]);
      });
      for (const run of runs) {
        const line = pathOf(run);
        if (area) {
          // a hill: the shadow steps up and right, so it shows along the ridge
          const hill = `${line}V${Y(lo)}H${run[0][0]}Z`;
          svg("path", { class: "hill-drop", d: hill, transform: `translate(${DROP} ${-DROP})` }, shade);
          svg("path", { class: "hill", d: hill }, paint).style.fill = color(d.i);
        } else {
          svg("path", { class: "ribbon-drop", d: line, transform: shift }, shade);
          svg("path", { class: "ribbon", d: line }, paint).style.stroke = color(d.i);
        }
      }
    }
    svg("line", { class: "base", x1: left, x2: left + pw, y1: Y(lo), y2: Y(lo) }, svgEl);

    // end chips sit just past the last point, nudged apart so they never stack on each other
    const placed = ends.map(e => ({ ...e, y: Y(e.d.values[e.i]) })).sort((a, b) => a.y - b.y);
    placed.forEach((e, k) => { if (k) e.y = Math.max(e.y, placed[k - 1].y + 30); });
    const over = placed.length ? placed.at(-1).y - B : 0;
    if (over > 0) placed.forEach(e => { e.y -= over; });
    for (const e of placed) {
      const x = left + pw + 16, w = chipW(e);
      svg("rect", { class: "chip-drop", x: x + DROP, y: e.y - 12 + DROP, width: w, height: 24 }, svgEl);
      svg("rect", { class: "chip", x, y: e.y - 12, width: w, height: 24, fill: color(e.d.i) }, svgEl);
      text(svgEl, x + w / 2, e.y + 1, format(e.d.values[e.i]), { class: "chip-text", "text-anchor": "middle", "dominant-baseline": "middle" })
        .style.fill = onColor(e.d.i);
    }

    const hair = svg("line", { class: "hair", y1: T, y2: Y(lo), visibility: "hidden" }, svgEl);
    const marks = svg("g", null, svgEl);
    const tip = tooltip(f.plot);
    cursor(svgEl, n, x => Math.max(0, Math.min(n - 1, Math.round(((x - left) / pw) * (n - 1)))), i => {
      hair.setAttribute("x1", crisp(X(i)));
      hair.setAttribute("x2", crisp(X(i)));
      hair.setAttribute("visibility", "visible");
      marks.replaceChildren();
      for (const d of shown) if (d.values[i] != null) marker(marks, d.i, X(i), Y(d.values[i]), 7, color(d.i));
      tip.show(X(i), T, labels[i], shown.map(d => ({ color: color(d.i), value: format(d.values[i]), name: shown.length > 1 ? d.name : "" })));
    }, () => { hair.setAttribute("visibility", "hidden"); marks.replaceChildren(); tip.hide(); });
  };


  // ---------- bar: columns by default, bars with horizontal, stacked for part-to-whole ----------
  // every bar is a slab with an ink outline and a hard shadow. hovering one presses it in

  DRAW.bar = (el, s) => {
    const { categories: cats, series, stacked = false, horizontal = false, format = compact } = s.opts;
    const f = frame(el, s);
    legendFor(f, s, series, "bar");
    tableFor(f,
      ["", ...series.map(d => d.name), ...(stacked && series.length > 1 ? ["total"] : [])],
      cats.map((c, k) => {
        const row = [c, ...series.map(d => format(d.values[k]))];
        if (stacked && series.length > 1) row.push(format(series.reduce((a, d) => a + (d.values[k] || 0), 0)));
        return row;
      }));

    const shown = series.map((d, i) => ({ ...d, i })).filter(d => !s.hidden.has(d.i));
    const n = cats.length, m = stacked ? 1 : shown.length;
    const totals = cats.map((_, k) => shown.reduce((a, d) => a + (d.values[k] || 0), 0));
    const peak = stacked ? Math.max(...totals) : Math.max(...shown.flatMap(d => d.values.map(v => v || 0)));
    const ticks = niceTicks(0, peak);
    const hi = ticks.at(-1);
    const D = DROP;
    // a value rides the tip when there's one series, or a total on each stack.
    // grouped series lean on the tooltip and the table instead
    const labelled = shown.length === 1 || stacked;
    const tipValue = k => (stacked ? totals[k] : shown[0].values[k]);

    const tip = tooltip(f.plot);
    const tipRows = k => [
      ...shown.map(d => ({ color: color(d.i), value: format(d.values[k]), name: shown.length > 1 ? d.name : "" })),
      ...(stacked && shown.length > 1 ? [{ value: format(totals[k]), name: "total" }] : []),
    ];
    const groups = [];
    const on = k => { groups.forEach((g, j) => g.classList.toggle("on", j === k)); f.plot.classList.add("hovering"); };
    const off = () => { groups.forEach(g => g.classList.remove("on")); f.plot.classList.remove("hovering"); tip.hide(); };
    // the shadow stops at the baseline, so a column never casts below the floor
    const slab = (g, face, x, y, w, h, fill, sh = h) => {
      svg("rect", { class: "shadow", x: x + D, y: y + D, width: w, height: sh }, g);
      svg("rect", { class: "bar", x, y, width: w, height: h, fill }, face);
    };

    if (!horizontal) {
      const height = s.opts.height ?? 220, top = labelled ? 24 : 10, bottom = 24, ph = height - top - bottom;
      const left = Math.max(...ticks.map(t => width(compact(t, 1e3)))) + 12;
      const pw = f.width - left - 10, band = pw / n;
      const thick = Math.max(3, Math.min(36, (band * .66 - (m - 1) * 3) / m));
      const groupW = m * thick + (m - 1) * 3;
      const Y = v => top + (1 - v / hi) * ph;

      const svgEl = root(f, height, s.opts.title || "bar chart");
      yAxis(svgEl, ticks, Y, left, left + pw);
      xLabels(svgEl, cats, k => left + (k + .5) * band, band, height - 6);
      for (let k = 0; k < n; k++) {
        const g = svg("g", { class: "cat" }, svgEl);
        groups.push(g);
        const shade = svg("g", null, g), face = svg("g", { class: "face" }, g);
        const x0 = left + k * band + (band - groupW) / 2;
        if (stacked && totals[k]) svg("rect", { class: "shadow", x: x0 + D, y: Y(totals[k]) + D, width: thick, height: Y(0) - Y(totals[k]) - D }, shade);
        let acc = 0;
        shown.forEach((d, j) => {
          const v = d.values[k] || 0;
          if (!v) return;
          const y1 = Y(stacked ? acc + v : v), y0 = Y(stacked ? acc : 0);
          if (stacked) svg("rect", { class: "bar", x: x0, y: y1, width: thick, height: y0 - y1, fill: color(d.i) }, face);
          else slab(shade, face, x0 + j * (thick + 3), y1, thick, y0 - y1, color(d.i), y0 - y1 - D);
          if (stacked) acc += v;
        });
        const lbl = format(tipValue(k));
        if (labelled && width(lbl) + 10 <= band - 2) tag(face, left + (k + .5) * band, Y(tipValue(k)) - 13, lbl);
      }
      svg("line", { class: "base", x1: left, x2: left + pw, y1: Y(0), y2: Y(0) }, svgEl);
      cursor(svgEl, n, (x, y) => (x < left || x > left + pw ? null : Math.min(n - 1, Math.floor((x - left) / band))),
        k => { on(k); tip.show(left + (k + .5) * band + groupW / 2, top, cats[k], tipRows(k)); }, off);
    } else {
      const rowH = Math.max(36, m * 16 + 14), top = 4, bottom = 24;
      const height = top + n * rowH + bottom;
      const thick = Math.min(26, (rowH * .66 - (m - 1) * 3) / m), groupH = m * thick + (m - 1) * 3;
      const left = Math.min(f.width * .4, Math.max(...cats.map(width)) * 12 / 11 + 14);
      const right = labelled ? Math.max(...cats.map((_, k) => width(format(tipValue(k))))) + 24 : 14;
      const pw = f.width - left - right;
      const X = v => left + (v / hi) * pw;

      const svgEl = root(f, height, s.opts.title || "bar chart");
      svgEl.classList.add("sideways");
      const grid = svg("g", { class: "grid" }, svgEl);
      for (const t of ticks) {
        if (t !== 0) svg("line", { x1: crisp(X(t)), x2: crisp(X(t)), y1: top, y2: top + n * rowH }, grid);
        text(svgEl, X(t), height - 6, compact(t, 1e3), { "text-anchor": "middle" });
      }
      for (let k = 0; k < n; k++) {
        const g = svg("g", { class: "cat" }, svgEl);
        groups.push(g);
        const y0 = top + k * rowH + (rowH - groupH) / 2;
        text(g, left - 10, top + (k + .5) * rowH, cats[k], { class: "lbl", "text-anchor": "end", "dominant-baseline": "middle" });
        const shade = svg("g", null, g), face = svg("g", { class: "face" }, g);
        if (stacked && totals[k]) svg("rect", { class: "shadow", x: X(0), y: y0 + D, width: X(totals[k]) - X(0) + D, height: thick }, shade);
        let acc = 0;
        shown.forEach((d, j) => {
          const v = d.values[k] || 0;
          if (!v) return;
          const x0 = X(stacked ? acc : 0), x1 = X(stacked ? acc + v : v);
          if (stacked) svg("rect", { class: "bar", x: x0, y: y0, width: x1 - x0, height: thick, fill: color(d.i) }, face);
          else slab(shade, face, x0, y0 + j * (thick + 3), x1 - x0, thick, color(d.i));
          if (stacked) acc += v;
        });
        if (labelled) tag(face, X(tipValue(k)) + D + 6, top + (k + .5) * rowH, format(tipValue(k)), "start");
      }
      svg("line", { class: "base", x1: X(0), x2: X(0), y1: top, y2: top + n * rowH }, svgEl);
      cursor(svgEl, n, (x, y) => (y < top || y > top + n * rowH ? null : Math.min(n - 1, Math.floor((y - top) / rowH))),
        k => { on(k); tip.show(X(stacked ? totals[k] : Math.max(...shown.map(d => d.values[k] || 0))) + 40, top + k * rowH, cats[k], tipRows(k)); }, off);
    }
  };


  // ---------- heatmap: a board of tiles set in ink, running hotter as they get busier ----------

  DRAW.heatmap = (el, s) => {
    const { rows, cols, values, format = compact } = s.opts;
    const f = frame(el, s);
    tableFor(f, ["", ...cols], rows.map((r, i) => [r, ...cols.map((_, j) => format(values[i][j]))]));

    const flat = values.flat().filter(v => v != null);
    const lo = Math.min(...flat), hi = Math.max(...flat), STEPS = 4;
    const bin = v => Math.min(STEPS - 1, Math.floor(((v - lo) / (hi - lo || 1)) * STEPS));
    const fillOf = v => (v == null ? "var(--paper)" : `var(--seq-${bin(v) + 1})`);

    const scale = html("span", "scale", f.legend);
    html("span", null, f.legend, `${format(lo)} → ${format(hi)}`);
    for (let k = 1; k <= STEPS; k++) html("i", null, scale).style.background = `var(--seq-${k})`;

    const gap = 2, top = 18, D = DROP, left = Math.max(...rows.map(width)) * 12 / 11 + 14;
    const C = cols.length;
    const cell = Math.max(6, Math.min(40, Math.floor((f.width - left - D - gap * 2) / C) - gap));
    const cellH = Math.max(cell, 16); // narrow cells get taller, so each row still fits its label
    const step = cell + gap, stepH = cellH + gap;
    const height = top + rows.length * stepH + gap + D;
    const bedW = C * step + gap, bedH = rows.length * stepH + gap;

    const svgEl = root(f, height, s.opts.title || "heatmap");
    xLabels(svgEl, cols, j => left + gap + j * step + cell / 2, step, 11);
    svg("rect", { class: "shadow", x: left + D, y: top + D, width: bedW, height: bedH }, svgEl);
    svg("rect", { class: "cell-bed", x: left, y: top, width: bedW, height: bedH }, svgEl);
    rows.forEach((r, i) => {
      text(svgEl, left - 10, top + gap + i * stepH + cellH / 2, r, { class: "lbl", "text-anchor": "end", "dominant-baseline": "middle" });
      cols.forEach((_, j) => {
        svg("rect", { x: left + gap + j * step, y: top + gap + i * stepH, width: cell, height: cellH, fill: fillOf(values[i][j]) }, svgEl);
      });
    });

    const ring = svg("rect", { class: "ring", width: cell - 1, height: cellH - 1, visibility: "hidden" }, svgEl);
    const tip = tooltip(f.plot);
    cursor(svgEl, rows.length * C, (x, y) => {
      const j = Math.floor((x - left - gap) / step), i = Math.floor((y - top - gap) / stepH);
      return j < 0 || j >= C || i < 0 || i >= rows.length ? null : i * C + j;
    }, k => {
      const i = Math.floor(k / C), j = k % C, v = values[i][j];
      ring.setAttribute("x", left + gap + j * step + .5);
      ring.setAttribute("y", top + gap + i * stepH + .5);
      ring.setAttribute("visibility", "visible");
      tip.show(left + (j + 1) * step + gap, top + i * stepH, `${rows[i]} · ${cols[j]}`, [{ color: fillOf(v), value: format(v) }]);
    }, () => { ring.setAttribute("visibility", "hidden"); tip.hide(); }, C);
  };


  // ---------- gauge: a faceted face, a block per zone, a fat needle, the number. that's all ----------

  DRAW.gauge = (el, s) => {
    const { value, min = 0, max = 100, format = compact, unit = "", shape = "dial" } = s.opts;
    const zones = s.opts.zones || [{ upTo: max, status: "good" }];
    el.classList.add("gauge");
    const f = frame(el, s, { table: false });
    const zoneOf = v => zones.find(z => v <= z.upTo) || zones.at(-1);
    const now = zoneOf(value);
    const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const readout = format(value) + unit;
    const label = `${s.opts.title || "gauge"}: ${readout} of ${format(min)} to ${format(max)}${unit}, ${now.label || now.status}`;
    // the zones as [from, to] fractions of the scale
    const spans = zones.map((z, i) => [
      Math.max(0, ((i ? zones[i - 1].upTo : min) - min) / (max - min)),
      Math.min(1, (Math.min(z.upTo, max) - min) / (max - min)), z,
    ]).filter(([a, b]) => b > a);
    const pts = list => list.map(p => p.map(v => v.toFixed(2)).join(",")).join(" ");
    const D = DROP;

    if (shape === "bar") {
      const W = f.width - D, H = 72, mid = H / 2;
      const g = svg("svg", { width: f.width, height: H + D, viewBox: `0 0 ${f.width} ${H + D}`, role: "img", "aria-label": label }, f.plot);
      svg("rect", { class: "dial-drop", x: D, y: D, width: W, height: H }, g);
      svg("rect", { class: "dial-face", x: 1.5, y: 1.5, width: W - 3, height: H - 3 }, g);
      const reading = text(g, 18, mid + 2, readout, { class: "reading", "dominant-baseline": "middle" });
      const bx = 18 + (reading.getComputedTextLength() || readout.length * 32) + 18, bw = W - bx - 20;
      for (const [t0, t1, z] of spans) svg("rect", { class: `zone s-${z.status}`, x: bx + t0 * bw, y: mid - 12, width: (t1 - t0) * bw, height: 24 }, g);
      const px = bx + frac * bw;
      svg("polygon", { class: "needle", points: pts([[px, mid + 18], [px - 12, 8], [px + 12, 8]]) }, g);
    } else {
      // the top half of a 16-sided face, a little deeper than half so the needle's root sits inside it.
      // M facets across the top: enough to read as a dome, still all straight edges
      const cx = 120, cy = 96, F = 100, R = 88, r = 52, lip = 16, M = 8;
      const g = svg("svg", { class: "dial", viewBox: `0 0 ${240 + D} ${cy + lip + D + 2}`, role: "img", "aria-label": label }, f.plot);
      const pt = (rad, a) => [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
      const ang = t => Math.PI * (1 - t);
      const side = F * Math.cos(Math.PI / (2 * M));
      const face = [[cx - side, cy + lip], ...Array.from({ length: M }, (_, k) => pt(F, (M - k - .5) * Math.PI / M)), [cx + side, cy + lip]];
      svg("polygon", { class: "dial-drop", points: pts(face.map(([x, y]) => [x + D, y + D])) }, g);
      svg("polygon", { class: "dial-face", points: pts(face) }, g);
      for (const [t0, t1, z] of spans) {
        // facets sit on one even grid, so every zone's corners line up with the next
        const steps = [t0, ...Array.from({ length: M - 1 }, (_, j) => (j + 1) / M).filter(t => t > t0 && t < t1), t1].map(ang);
        svg("polygon", { class: `zone s-${z.status}`, points: pts([...steps.map(a => pt(R, a)), ...[...steps].reverse().map(a => pt(r, a))]) }, g);
      }
      const a = ang(frac);
      svg("polygon", { class: "needle", points: pts([pt(R + 6, a), pt(12, a + Math.PI / 2), pt(10, a + Math.PI), pt(12, a - Math.PI / 2)]) }, g);
    }
    const foot = html("div", "gauge-foot", f.plot);
    if (shape !== "bar") html("span", "reading", foot, readout);
    html("span", `status ${now.status}`, foot, now.label || now.status);
  };


  // ---------- sparkline: a little white hill with an ink ridge, the latest point in yellow ----------

  DRAW.spark = (el, s) => {
    const values = s.opts.values, n = values.length;
    const W = Math.max(40, s.width), H = el.clientHeight || 34, pad = 6;
    const lo = Math.min(...values), hi = Math.max(...values);
    const X = i => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
    const Y = v => pad + (1 - (v - lo) / (hi - lo || 1)) * (H - pad * 2 - 2);
    el.replaceChildren();
    el.classList.add("plot");
    const g = svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" }, el);
    const line = values.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join("");
    svg("path", { class: "area", d: `${line}L${X(n - 1)},${H - 1}L${X(0)},${H - 1}Z`, fill: "var(--white)" }, g);
    svg("path", { class: "ridge", d: line }, g);
    marker(g, 0, X(n - 1), Y(values[n - 1]), 4.5, "var(--yellow)");
  };

  const spark = (el, values) => mount("spark", el, { values });
  const init = () => {
    for (const el of document.querySelectorAll("[data-spark]")) spark(el, el.dataset.spark.split(",").map(Number));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  const chart = {
    line: (el, opts) => mount("line", el, opts),
    bar: (el, opts) => mount("bar", el, opts),
    heatmap: (el, opts) => mount("heatmap", el, opts),
    gauge: (el, opts) => mount("gauge", el, opts),
    spark,
    compact,
  };
  window.slabware = Object.assign(window.slabware || {}, { chart });
})();
