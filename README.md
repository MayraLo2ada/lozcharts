# LozCharts

**English** · [Español](https://github.com/MayraLo2ada/lozcharts/blob/main/README.es.md) · [Português](https://github.com/MayraLo2ada/lozcharts/blob/main/README.pt.md)

LozCharts is a chart library for the web. It's written in TypeScript, draws in SVG (the image
format that stays sharp at any size), and doesn't need any other library. Every chart you create
is a `LozChart`: you give it your data and it comes with a tooltip (the little box that shows the
value when you hover), a legend, light and dark mode, animation, keyboard support, and a data
table for screen readers. All the stuff you'd usually end up building on your own.

It has 26 types. You get the usual lines and bars, but also candlesticks, heatmaps, flow diagrams
(sankey), waterfall, timeline, word cloud, maps, and small multiples, which are lots of small
charts on the same scale (the full list is in [Series types](#series-types)). It comes with zoom,
annotations, labels at the end of each line, downloads as a PNG or SVG image and as a CSV sheet,
and components for React and for Angular, Vue, or Svelte.

## Install

In a project with npm:

```bash
npm install lozcharts
```

```js
import { LozChart } from 'lozcharts';
import { Chart } from 'lozcharts/react'; // if you use React
import 'lozcharts/maps/world'; // only if you make maps
```

Without npm, with a `<script>` from npm's free content delivery network, or by downloading the
file into your project:

```html
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
<!-- Only if you make maps: -->
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/maps/world.umd.js"></script>
```

`@1` always gives you the latest 1.x version, which never breaks what already works. If you'd
rather pin an exact version, write something like `@1.1.0`.

## Your first chart

Copy this into a file called `sales.html` and double-click it to open it. You don't need to install
anything:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My first chart</title>
  </head>
  <body>
    <div id="chart"></div>
    <script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
    <script>
      new LozChart('#chart', {
        title: 'Sales by month',
        data: [
          { month: '2026-01', sales: 42000 },
          { month: '2026-02', sales: 45500 },
          { month: '2026-03', sales: 51200 },
        ],
        xAxis: { field: 'month', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'bar', field: 'sales', name: 'Sales' }],
      });
    </script>
  </body>
</html>
```

That's it: the data is a list of rows, `xAxis.field` says which field goes on the X axis, and each
series says its `type` and its `field`. The tooltip, the keyboard support, dark mode, and the table
for screen readers are already there.

## Three ways to use it

**1. With `<script>`.** You don't need a server or a build step: put the file next to your page and
create the chart.

```html
<div id="chart"></div>
<script src="lozcharts.umd.js"></script>
<script>
  new LozChart('#chart', {/* options */});
</script>
```

**2. With `import` (Vite, webpack, Angular CLI) or `require` (Node, Jest).** Remember to call
`destroy()` when you unmount the component. In React you don't have to do it by hand if you use the
components from `lozcharts/react` (see [React](#react)), and in Angular, Vue, or Svelte you have the
`<loz-chart>` element (see [`<loz-chart>`](#loz-chart-angular-vue-svelte-or-plain-html)).

```js
import { LozChart } from 'lozcharts'; // or: const { LozChart } = require('lozcharts');
const chart = new LozChart(element, options);
// when the component unmounts:
chart.destroy();
```

`LozChart` draws on the page, so it needs a browser (or a test DOM, like jsdom in Jest). In Node
without a DOM you can import it, but you can't create charts.

**3. With Django + HTMX.** Put the options as JSON in the `data-lozchart` attribute, or the selector
of a `<script type="application/json">`. Then start the charts again every time HTMX swaps a
fragment:

```html
<div data-lozchart="#sales-options"></div>
{{ options|json_script:"sales-options" }}
<script>
  htmx.onLoad((el) => LozChart.initAll(el));
  document.body.addEventListener('htmx:beforeSwap', (e) => LozChart.destroyAll(e.detail.target));
</script>
```

If the element already had a chart, `initAll` replaces it, and while it's at it, cleans up the ones
left off the page. There's a full example in `examples/django` (view, URL, and templates), and
another one in `examples/htmx/index.html` that you can open without Django.

## Full example

This chart has what you'll use the most: stacked bars, a goal line, currency format, and the legend
at the bottom. The comments tell you what other values each option accepts.

```js
const chart = new LozChart('#chart', {
  title: 'Sales by month',
  subtitle: 'January to December 2026',
  data: [
    { month: '2026-01', online: 42000, store: 31000, goal: 80000 },
    { month: '2026-02', online: 45500, store: 29800, goal: 82000 },
    // …
  ],
  xAxis: { field: 'month', type: 'time' }, // 'category' | 'time' | 'linear'
  yAxis: { format: 'currency' }, // 'auto' | 'compact' | 'number' | 'percent' | 'currency' | function
  series: [
    { type: 'bar', field: 'online', name: 'Online', stack: true },
    { type: 'bar', field: 'store', name: 'In store', stack: true },
    { type: 'line', field: 'goal', name: 'Goal', smooth: true },
  ],
  theme: 'auto', // 'light' | 'dark' | 'auto'
  height: 320,
  legend: { position: 'bottom' },
  tooltip: true,
  animate: true,
  locale: 'en',
  currency: 'USD',
});
```

<!-- vivo: ejemplo -->

## Series types

| Name         | Type          | What it's for                                   | Fields                                                           |
| ------------ | ------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| LozLine      | `line`        | How a value changes over time                   | `field`; `smooth` for a monotone curve                           |
| LozBar       | `bar`         | Comparing amounts; grouped or with `stack`      | `field`                                                          |
| LozArea      | `area`        | Accumulated volume; stackable                   | `field`; `smooth`                                                |
| LozStep      | `step`        | Values that jump (rates, fees)                  | `field`; `step`: `'after'` (default), `'before'`, `'middle'`     |
| LozRange     | `range`       | A band between a minimum and a maximum          | `field` (upper) and `low` (lower)                                |
| LozScatter   | `scatter`     | The relationship between two numbers            | `field` (Y); X with `xAxis.type: 'linear'`                       |
| LozBubble    | `bubble`      | Like scatter, with a third value as the size    | `field`, `size`; `sizeName` for the tooltip                      |
| LozCandle    | `candlestick` | Prices: open, high, low, and close              | `field` (close), `open`, `high`, `low`                           |
| LozOHLC      | `ohlc`        | Same as candlesticks, drawn as strokes          | `field` (close), `open`, `high`, `low`                           |
| LozPie       | `pie`         | Parts of a whole (few categories)               | `xAxis.field` (category), `field` (value)                        |
| LozDonut     | `donut`       | Like the pie, with the total in the middle      | same as `pie`; `innerRadius` (0.6)                               |
| LozGauge     | `gauge`       | One indicator against its range and its goal    | `field`; `target`; range with `yAxis.min` and `yAxis.max`        |
| LozBullet    | `bullet`      | Indicators against their goal and their ranges  | `xAxis.field` (indicator), `field`; `targetField`, `ranges`      |
| LozRadar     | `radar`       | Profiles across several dimensions              | `xAxis.field` (criterion), `field` per series                    |
| LozFunnel    | `funnel`      | Steps in a process and their conversion         | `xAxis.field` (step), `field` (amount)                           |
| LozWaterfall | `waterfall`   | How you get from one number to another (bridge) | `field` (change); `total` marks subtotals and totals             |
| LozHeatmap   | `heatmap`     | Patterns in a grid (day × hour)                 | `xAxis.field` (column), `y` (row), `field` (value)               |
| LozTreemap   | `treemap`     | Parts of a whole with lots of categories        | `xAxis.field` (name), `field` (size); optional `group`           |
| LozSunburst  | `sunburst`    | A hierarchy in rings (region › country › city)  | `field` (value); `levels` with the path fields                   |
| LozSankey    | `sankey`      | Flows between stages (from where to where)      | `xAxis.field` (source), `to` (target), `field` (amount)          |
| LozChord     | `chord`       | Directed flows between nodes                    | `xAxis.field` (source), `to` (target), `field` (amount)          |
| LozNetwork   | `network`     | Undirected relationships (who with whom)        | `xAxis.field`, `to`; optional `field` (weight) and `group`       |
| LozTimeline  | `timeline`    | Spans and milestones over time                  | `xAxis.field` (start), `end` (end), `field` (name); `group`      |
| LozWordcloud | `wordcloud`   | Words sized by their weight                     | `xAxis.field` (word), `field` (weight); optional `group`         |
| LozMap       | `choropleth`  | One value per country, colored                  | `xAxis.field` (country), `field`; see [Maps](#maps)              |
| LozMap       | `mapbubble`   | Amounts on the map                              | `xAxis.field`, `field`; optional `lat` and `lon`                 |
| LozMultiples | —             | A grid of small charts                          | `LozChart.multiples(…)`; see [Small multiples](#small-multiples) |

LozBar, LozLine, and the rest are the names I use in these docs and in the gallery. In code, each
type goes by its short name: `type: 'bar'`.

The pie (`pie`), the donut (`donut`), the gauge (`gauge`), and the funnel show a single series. In
the pie and the donut, each category gets its own color and its own button in the legend, with its
percentage; if you hide one, the other percentages are recalculated. With more than 8 categories,
the first 7 get a color and the rest are added up into "Other", with the details in the tooltip and
in the table.

My advice: if you go over 5 categories, swap the pie for sorted horizontal bars. They're much
easier to read.

Labels spread out so they don't overlap. On narrow screens they're left out, because the legend and
the tooltip already say the same thing, and `labels: false` always turns them off. If you need
several gauges or several funnels, use small multiples.

```js
new LozChart('#categories', {
  data: [{ category: 'Electronics', sales: 184200 } /* … */],
  xAxis: { field: 'category' },
  yAxis: { format: 'currency' },
  series: [{ type: 'donut', field: 'sales', name: 'Sales' }],
});

new LozChart('#goal', {
  data: [{ month: 'October', progress: 0.78 }],
  xAxis: { field: 'month' },
  yAxis: { format: 'percent', min: 0, max: 1 },
  series: [{ type: 'gauge', field: 'progress', name: 'Progress', target: 0.85 }],
});
```

<!-- vivo: categorias -->

<!-- vivo: meta -->

For prices you have candlesticks (`candlestick`) and OHLC bars (`ohlc`: open, high, low, close).
Each row has the open, high, low, and close, and in the series you say what each field is called.

Bars with long names? Set `orientation: 'horizontal'`: the chart turns and the categories move to the
vertical axis, where they fit in full.

```js
new LozChart('#prices', {
  data: sessions, // { date, open, high, low, close }
  xAxis: { field: 'date', type: 'time' },
  yAxis: { format: 'currency' },
  series: [{ type: 'candlestick', field: 'close', open: 'open', high: 'high', low: 'low', name: 'AURF' }],
});
```

## Heatmap, treemap, and sankey

All three expect one data row per thing drawn: a cell, a rectangle, or a flow.

```js
// Heatmap: one data row per cell.
new LozChart('#visits', {
  data: visits, // { hour: '09:00', day: 'Monday', visits: 120 }
  xAxis: { field: 'hour' },
  series: [{ type: 'heatmap', field: 'visits', name: 'Visits', y: 'day' }],
});

// Treemap: each rectangle's area is its value; `group` groups them by color.
new LozChart('#products', {
  data: sales, // { product: 'Laptops', category: 'Electronics', sales: 420000 }
  xAxis: { field: 'product' },
  yAxis: { format: 'currency' },
  series: [{ type: 'treemap', field: 'sales', name: 'Sales', group: 'category' }],
});

// Sankey: one row per flow, from `xAxis.field` to `to`.
new LozChart('#journey', {
  data: flows, // { source: 'Search', target: 'Product', sessions: 4200 }
  xAxis: { field: 'source' },
  series: [{ type: 'sankey', field: 'sessions', name: 'Sessions', to: 'target' }],
});
```

<!-- vivo: calor -->

The **heatmap** uses a single hue, from the surface to the series color, mixed in OKLab so the
steps in lightness are even. If there are negative values, the scale becomes diverging and
symmetric around zero. The color legend goes at the top right, and you move through the grid in
both directions with the arrow keys. If a cell shows up twice, the last one is drawn and the table
points it out.

In the **treemap** I use the _squarified_ algorithm, which keeps the rectangles as square as
possible because that makes them easier to compare. The text in each rectangle takes whichever
color has the most contrast with its fill. With `group`, each group gets a color from the palette
and its own title; if there are more than 8 groups, they're gray.

The **sankey** lays out the columns using the longest path from each source and orders the nodes so
they cross as little as possible. Each flow takes the color of its source. If your data has a cycle,
the flow that closes it isn't drawn and you get a warning in the console. The tooltip tells you
what share of the source and of the target each flow represents.

## Waterfall, bullet, and timeline

```js
// Waterfall: each row is a change; the rows marked in `total` start from zero.
new LozChart('#result', {
  title: 'From sales to profit',
  data: [
    { step: 'Sales', amount: 1200 },
    { step: 'Cost of sales', amount: -500 },
    { step: 'Gross profit', total: true },
    { step: 'Expenses', amount: -300 },
    { step: 'Taxes', amount: -135 },
    { step: 'Net profit', total: true },
  ],
  xAxis: { field: 'step' },
  series: [{ type: 'waterfall', field: 'amount', name: 'Result', total: 'total' }],
});

// Bullet: one row per indicator, with its goal and the quality ranges in the background.
new LozChart('#kpi', {
  title: 'Quarterly sales by region',
  data: [
    { region: 'North', sales: 512, goal: 480 },
    { region: 'South', sales: 297, goal: 420 },
  ],
  xAxis: { field: 'region' },
  series: [{ type: 'bullet', field: 'sales', name: 'Sales', targetField: 'goal', ranges: [300, 450, 600] }],
});

// Timeline: each row goes from the X to `end`; without an end it's a milestone.
new LozChart('#plan', {
  title: '2026 launch',
  data: [
    { task: 'Research', start: '2026-01-12', end: '2026-02-27', team: 'Product' },
    { task: 'Mobile app', start: '2026-04-20', end: '2026-08-28', team: 'Engineering' },
    { task: 'Launch', start: '2026-09-15', team: 'Marketing' },
  ],
  xAxis: { field: 'start', type: 'time' },
  series: [{ type: 'timeline', field: 'task', end: 'end', group: 'team', name: 'Plan', today: true }],
});
```

<!-- vivo: resultado -->

<!-- vivo: kpi -->

<!-- vivo: plan -->

In the **waterfall**, the axis shows the running totals. That's why it can cross zero without
trouble, and a big drop doesn't stretch the scale. Increases are filled, decreases are hollow, and
totals are gray. The tip points the way the running total moved and the label carries the sign, so
you never depend on telling green from red. A total without a value shows the running total. If you
give it a value, that one wins; and if it doesn't add up, you get a warning in the console and the
tooltip shows the difference.

The **bullet** (the goals chart) has a single scale for all the rows, because the ranges apply to
all of them. If your indicators have different units, make one chart per indicator. The ranges are
shades of gray, darker the worse they are, never traffic-light colors. The tooltip gives the goal,
the difference (with its sign and in %), and the range the value falls in. One series per chart.

In the **timeline**, each span's name comes from `label` or, if you don't set it, from `field`.
With `group` you get one lane per group, each with its own color. Without groups, spans that overlap
drop down to another row, using as few rows as possible. The axis goes from hours to centuries
depending on the range, without going below the precision of your data. The tooltip gives the range
and the duration ("4 months and 8 days") in the chart's language (`locale`).

`today: true` marks today with a dashed vertical line and a label at the top. If you pass it a date
(`today: '2026-06-30'`), it marks that one. And if a span ends before it starts, it flips it and
warns you in the console.

## Sunburst, chord, network, and word cloud

```js
// Sunburst: each row is a leaf with its path; inner nodes add up their children.
new LozChart('#sales', {
  data: sales, // { region: 'Americas', country: 'Mexico', city: 'Monterrey', sales: 182000 }
  xAxis: { field: 'city' },
  series: [{ type: 'sunburst', field: 'sales', name: 'Sales', levels: ['region', 'country', 'city'] }],
});

// Chord: one row per directed flow, from `xAxis.field` to `to`.
new LozChart('#migration', {
  title: 'Moves between regions',
  data: moves, // { source: 'Capital', target: 'Central', people: 182 }
  xAxis: { field: 'source' },
  series: [{ type: 'chord', field: 'people', name: 'People', to: 'target' }],
});

// Network: one row per link; without a target, it only declares the node.
new LozChart('#team', {
  title: 'Who works with whom',
  data: messages, // { person: 'Ana', with: 'Luis', messages: 8, area: 'Design' }
  xAxis: { field: 'person' },
  series: [{ type: 'network', field: 'messages', name: 'Messages', to: 'with', group: 'area' }],
});

// Word cloud: each word's area goes with its weight.
new LozChart('#cloud', {
  title: 'What do customers point out?',
  data: mentions, // { word: 'support', mentions: 412, topic: 'Service' }
  xAxis: { field: 'word' },
  series: [{ type: 'wordcloud', field: 'mentions', name: 'Mentions', group: 'topic' }],
});
```

The **sunburst** (rings by level) starts at the top and goes clockwise, with siblings from largest
to smallest. Each first-level branch gets its own color, and the outer rings inherit it in lighter
shades. Without `levels` you get a single ring, like a donut. When you hover, the path up to the
root is highlighted. With the keyboard, ← → move along and ↑ ↓ go up or down a level.

In the **chord** chart, each node is an arc (what goes out plus what comes in) and each flow is a
ribbon in the color of its source. The target end sits apart from the arc, so A → B doesn't get
mixed up with B → A. The arcs follow the order of your data, so sort them yourself. Loops, from a
node to itself, aren't drawn.

The **network** has no direction: A → B and B → A add up to the same link. The layout is
force-based and deterministic, which means the same data always gives you the same drawing. Each
node's area goes with its degree and each link's thickness with its weight; without `field`, it
counts links. The keyboard and the tooltip talk about nodes and mention their main neighbors.

The **word cloud** keeps every word horizontal, so they're easy to read. Repeated words are added
up. Whatever doesn't fit is left out, starting with the lightest ones, with a warning in the
console, and it's still in the table. Each word's color is adjusted to reach 4.5:1 against the
background.

In these four types, zero, negative, or empty values aren't drawn, but the data table still lists
them. `labels: false` removes the labels.

## Maps

The country outlines weigh about 110 KB, so they come in a separate file. You only load it if
you're going to make maps.

```html
<script src="lozcharts.umd.js"></script>
<script src="maps/world.umd.js"></script>
```

```js
import { LozChart } from 'lozcharts';
import 'lozcharts/maps/world'; // registers the world map as 'world'

new LozChart('#users', {
  data: [
    { country: 'COL', users: 980000 },
    { country: 'Mexico', users: 1830000 },
    { country: 'Brasil', users: 2650000 },
  ],
  xAxis: { field: 'country' },
  series: [{ type: 'choropleth', field: 'users', name: 'Users', fit: 'data' }],
});
```

<!-- vivo: usuarios -->

- You can write each country with its 3-letter ISO code, its numeric code, or its name in English
  or Spanish. Uppercase and accents don't matter. If one doesn't show up, you get a warning in the
  console.
- `fit: 'data'` frames only the countries that have data, to show a region. Without that option
  you see the whole world, minus Antarctica.
- The default projection (`projection`) is `'equalEarth'`, an equal-area one: the honest choice for
  coloring countries. `'mercator'` is the one web maps use, and it inflates the northern countries.
- `mapbubble` puts one circle per row, with its area proportional to the value, at its `lat` and
  `lon` or at the center of the country.
- For another map, register it with `LozChart.registerMap('colombia', topojsonOrGeojson)` and set
  `map: 'colombia'` in the series. Any TopoJSON or GeoJSON of polygons in longitude and latitude
  works.
- The outlines come from Natural Earth 1:110m (public domain), packaged by world-atlas (ISC
  license, in `maps/LICENSE`).

## React

```jsx
import { useMemo, useRef } from 'react';
import { Chart } from 'lozcharts/react';

function Sales({ rows }) {
  const chart = useRef(null);
  const data = useMemo(() => rows, [rows]);
  return (
    <>
      <Chart
        ref={chart}
        title="Sales"
        data={data}
        xAxis={{ field: 'month', type: 'time' }}
        series={[{ type: 'bar', field: 'sales', name: 'Sales' }]}
        zoom
        onZoom={(range) => console.log(range)}
      />
      <button onClick={() => chart.current?.download('png')}>Download</button>
    </>
  );
}
```

`Chart` takes the chart options as props, plus `className`, `style`, and `id` for the container.
`Multiples` does the same for small multiples.

The only thing you need to watch is the data. It's compared by reference: if it changes, the chart
animates from what's on screen. Use `useMemo` so you don't create a new array on every render. The
other options are compared by content, so writing them inline doesn't redraw anything if they
didn't change.

- `onHover`, `onZoom`, and the other functions always call their latest version.
- The `ref` gives you the `LozChart` (or `LozMultiples`) instance with all its methods.
- There's a full example in `examples/react`: run `npm run example:react` and open
  `examples/react/index.html`.

## `<loz-chart>`: Angular, Vue, Svelte, or plain HTML

`<loz-chart>` is a standard HTML element (a Custom Element), so it works with any framework, no
adapter needed. If you load `<script src="lozcharts.umd.js">`, it's already registered; with
modules, import `'lozcharts/element'`.

```html
<loz-chart
  options='{"data": [{"month": "2026-01", "sales": 42000}], "xAxis": {"field": "month", "type": "time"},
  "series": [{"type": "bar", "field": "sales", "name": "Sales"}]}'
></loz-chart>
```

```ts
// Angular (standalone): add CUSTOM_ELEMENTS_SCHEMA to the component.
import 'lozcharts/element';
@Component({
  selector: 'app-sales',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<loz-chart [options]="options" (lozzoom)="onZoom($event)"></loz-chart>`,
})
export class SalesComponent {
  options = { data: [], xAxis: { field: 'month', type: 'time' }, series: [{ type: 'line', field: 'sales' }], zoom: true };
  onZoom(e: CustomEvent) {
    console.log(e.detail); // [from, to] or null
  }
}
```

- The options go in the `options` attribute (as JSON) or in the `options` property (as an object).
  If only the data changes, the chart animates with `setData`; if anything else changes, with
  `setOptions`. With `facet` it creates small multiples.
- It emits `lozhover`, `lozzoom`, and `lozclick`. `event.detail` holds the active X, the visible
  span, or `{ x, index, series }` for the clicked data point. With `facet` (small multiples) it
  doesn't emit events.
- `element.chart` is the instance, with all its methods. When you remove the element from the page,
  the chart destroys itself, so inside HTMX fragments you don't need `initAll`.

In Vue, tell the compiler that `loz-chart` is a native element of the page and not a component;
otherwise it still works, but you get a "Failed to resolve component" warning in the console:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'loz-chart' } } })],
};
```

```html
<script setup>
  import 'lozcharts/element';
</script>
<template>
  <loz-chart :options="options" @lozclick="(e) => console.log(e.detail)"></loz-chart>
</template>
```

## TypeScript

The types ship with the package and work with any `moduleResolution` (`bundler`, `node16`,
`nodenext`, or the old `node`). If you write an option that doesn't exist or has a typo (`heigth`,
`smoth`, `theme: 'drak'`), your editor flags it and suggests the right one.

```ts
import { LozChart, type LozChartOptions, type SeriesOptions } from 'lozcharts';

const series: SeriesOptions[] = [{ type: 'line', field: 'sales', name: 'Sales' }];
const options: LozChartOptions = { data: rows, xAxis: { field: 'month', type: 'time' }, series };
const chart: LozChart = new LozChart('#chart', options);
```

Your rows can have their own type, with `interface` or with `type`
(`interface Sale { month: string; sales: number }`), and each series' `type` suggests the 26 types
as you write.

In a CommonJS project (`require`) the types are the same and you import them just like above.

## LozCharts with AI

If you ask ChatGPT, Claude, or Copilot for charts, tell it to use LozCharts and give it the
[llms.txt](llms.txt) file. It's a single page with everything that exists (types, options, and
methods) and the rules for writing code that works. With that it doesn't make up options, and you
don't have to ask for zoom, a legend, dark mode, or accessibility: they're already built in. If you
use TypeScript, the `lozcharts` types also flag any option that doesn't exist.

Something like this is enough:

```text
Use LozCharts; everything you need to know is in llms.txt (attached).
I want stacked bars with sales by month, online and in store, in dollars,
and a line with the monthly goal.
```

## Lots of data

You can give a line 100,000 points. Lines, areas, steps, and ranges only draw what's visible, and
when there are more than two data points per pixel they keep the first, the minimum, the maximum,
and the last of each pixel column. The line looks the same, no peak gets lost, and the chart is
created in about 40 ms. With `zoom` you can explore long series without losing detail.

The table for screen readers shows the first 500 rows and says there are more. To get all the data,
use `download('csv')` or `toCSV()`.

<!-- vivo: muchos -->

## Small multiples

If you have more than 4 or 5 series, don't cram them into one chart: they get tangled. Make small
multiples, which are lots of small charts on the same scale, one per series or one per value of a
field. They're also good for comparing the shape of several categories.

```js
// One panel per series
LozChart.multiples('#cities', {
  title: 'Average high temperature by month',
  facet: 'series',
  data: months, // { month, miami, madrid, bogota, … }
  xAxis: { field: 'month', type: 'time' },
  series: cities.map((c) => ({ type: 'line', field: c.field, name: c.name })),
  height: 150, // height of each panel
});

// One panel per value of a field
LozChart.multiples('#regions', {
  facet: { field: 'region', order: ['North', 'Central', 'South'] },
  data: sales, // { month, region, online, store }
  xAxis: { field: 'month', type: 'time' },
  series: [
    { type: 'area', field: 'online', name: 'Online', stack: true },
    { type: 'area', field: 'store', name: 'In store', stack: true },
  ],
});
```

<!-- vivo: ciudades -->

All the panels share the value axis (`sharedY: false` turns that off) and the same X values. If a
panel is missing a month, that month is left as a gap. The data area is the same size in all of
them, so you can compare them at a glance.

- The axis numbers only show in the first column, and the X labels only on the last panel of each
  column. This is recalculated when the width changes.
- If one panel has bars, they all use a band scale and the axis numbers reserve the same width:
  each date lands on the same vertical line in every panel.
- Hovering over one panel marks the same data point in all of them. There's a single legend (only
  when you facet by field), and hiding a series hides it in every panel.
- `columns` sets the number of columns. If you don't set it, you get as many as `minWidth` allows
  (240 px by default).
- With `facet: 'series'`, `context: true` draws the other series in gray in each panel, behind its
  own.
- `annotations` are drawn in every panel, for example a shared goal.
- Methods: `setData`, `setOptions`, `setTheme`, `toggleSeries`, `toSVG`, `toCSV`, `download`,
  `destroy`, and `charts` (the chart in each panel). In HTMX, `initAll` creates them if the JSON has
  `facet`.

## Two measures with different units

With two Y axes, whoever makes the chart decides where the lines cross. Just move one axis and one
measure "catches up" with the other, and whoever reads it draws conclusions the data doesn't
support. That's why I suggest three options, from the one I recommend most to the one I recommend
least.

**Aligned panels.** This is my favorite. Each measure gets its own panel with its own units. They
share the X axis, the data areas line up to the pixel, and the pointer moves in both at once.

```js
LozChart.multiples('#sales-and-visits', {
  facet: 'series',
  columns: 1,
  sharedY: false, // each panel with its own axis
  data: months,
  xAxis: { field: 'month', type: 'time' },
  series: [
    { type: 'bar', field: 'sales', name: 'Sales', format: 'currency' },
    { type: 'line', field: 'visits', name: 'Website visits', format: 'compact' },
  ],
});
```

**Base-100 index.** Use it when the question is which one grew more. LozCharts divides each series
by its first value and multiplies it by 100; that way both end up in the same unit and share an
axis. The tooltip shows the index and the original value too.

```js
new LozChart('#growth', {
  data: months,
  xAxis: { field: 'month', type: 'time' },
  yAxis: { index: true },
  series: [
    { type: 'line', field: 'sales', name: 'Sales', format: 'currency' },
    { type: 'line', field: 'visits', name: 'Website visits' },
  ],
});
```

**Dual axis, with safeguards.** Save it for when you really need it, for example because your
audience already expects it. `axis: 'right'` moves a series to the right axis and `yAxis2` sets up
that axis. LozCharts makes sure both axes start at zero, that zero sits at the same height, that the
grid lines match (it picks the step of the right axis for that), and that the legend says "(right
axis)". It doesn't work in index mode or in horizontal.

```js
new LozChart('#sales-and-visits', {
  data: months,
  xAxis: { field: 'month', type: 'time' },
  yAxis: { format: 'currency', title: 'Sales' },
  yAxis2: { format: 'compact', title: 'Visits' },
  series: [
    { type: 'bar', field: 'sales', name: 'Sales' },
    { type: 'line', field: 'visits', name: 'Website visits', axis: 'right' },
  ],
});
```

## Zoom, annotations, and direct labels

```js
new LozChart('#visits', {
  title: 'Daily visits',
  data: days, // { date, web, app }, one year
  xAxis: { field: 'date', type: 'time' },
  series: [
    { type: 'line', field: 'web', name: 'Web' },
    { type: 'line', field: 'app', name: 'App' },
  ],
  zoom: { range: ['2026-06-01', '2026-08-31'] }, // initial window (optional)
  endLabels: true,
  annotations: [
    { y: 8000, label: 'Daily goal' },
    { x: ['2026-06-29', '2026-07-21'], label: 'Summer campaign' },
  ],
});
```

<!-- vivo: zoom -->

**Zoom** (`zoom: true`) works on vertical charts with X and Y axes (cartesian). Drag over the chart
to mark a span and zoom in on it. Ctrl + wheel, or pinching on the trackpad, zooms in and out under
the pointer; Shift + wheel, or swiping sideways, moves the window, and double-click goes back to
everything. On a touch screen, you pinch and pan with two fingers, and with one you keep moving
through the data with the tooltip. The wheel on its own still scrolls the page: the chart doesn't
hijack it. When you zoom in, the value axis adjusts to what's visible.

Underneath there's a thin slider: a line with the visible span marked and a round knob at each end.
You can drag the span or its knobs, click the line to center the window there, or move it with the
keyboard. `zoom: { scrollbar: 'mini' }` swaps it for a bar with a mini chart of all the data,
`zoom: { scrollbar: false }` removes it, and `zoom: { reset: false }` removes the "Show all" button,
in case you add your own control. With focus on the chart, + and − zoom in and out, 0 goes back to
everything, and if the arrow keys take you to a data point outside the window, the window follows it.

**Zoom on the Y axis** (`zoom: { y: true }`) adds a second thin slider, standing up to the left of
the Y axis, with its start at the bottom. Its window is a fraction of the axis with all the data:
the axis shows that span with round tick marks, and whatever falls outside is clipped at the edge of
the plot. With it on, the value axis no longer adjusts to the X window on its own; the slider is in
charge. Dragging over the chart marks a rectangle and zooms in on both axes (a nearly flat drag zooms
only one), and Ctrl + wheel over the Y axis numbers zooms only Y. Double-click, 0, "Show all", and
`resetZoom()` go back to everything on both axes. `zoom: { x: false, y: true }` zooms only Y. It
works on charts with a numeric Y axis, linear or log, in vertical orientation; on the rest it's
ignored.

```js
new LozChart('#sensor', { ...options, zoom: { y: true }, onZoom: (range, x, y) => console.log(y) }); // y: { start, end }
```

If you have several charts with the same axis, like price on top and volume below, you can move the
zoom on all of them at once. `onZoom` also gets the exact window in fractions of the axis, and
`setZoomWindow` sets it on another chart without rounding to a data point. Both have to share the X
axis and the kind of scale: both with bars, or both continuous.

```js
const price = new LozChart('#price', { ...options, zoom: true, onZoom: (range, zoomWindow) => volume.setZoomWindow(zoomWindow) });
const volume = new LozChart('#volume', { ...others, zoom: { scrollbar: false, reset: false } });
```

Each **annotation** (`annotations`) has an `x` or a `y`. With one value it draws a reference line,
and with two, a band. `x` takes categories, dates, or numbers; `y` takes numbers (with
`axis: 'right'` for the right axis). The axis grows so a goal is always visible. Bands go behind the
data and lines with their text go on top. If two texts would collide, one moves over.

With **end labels** (`endLabels: true`), the name of each line, area, or step goes on the right, at
the height of its last visible data point; `{ value: true }` adds the last value. The ones that
collide spread out without moving further from their data point than they need to, and with zoom
they follow the last data point in the window.

**Emphasis** (`emphasis: 'Bogotá'` or a list) keeps the named series in their color and on top, and
the rest in gray as context. In small multiples by series, `context: true` does the same in each
panel: its series in color and the others in gray behind it.

## Options

| Option                       | Type                                           | Default                       | What it does                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `subtitle`          | text                                           | —                             | The chart's heading (it's also included in the export).                                                                                                        |
| `data`                       | array of objects                               | —                             | One row per point.                                                                                                                                             |
| `xAxis.field`                | text                                           | —                             | Field for the X position.                                                                                                                                      |
| `xAxis.type`                 | `'category'` `'time'` `'linear'`               | `'category'`                  | Dates accept `Date`, milliseconds, or text (`'2026-03'` is read in local time).                                                                                |
| `xAxis.format`               | format or `Intl.DateTimeFormat` options        | automatic                     | X axis labels.                                                                                                                                                 |
| `xAxis.title`, `yAxis.title` | text                                           | —                             | Axis titles.                                                                                                                                                   |
| `yAxis.format`               | see below                                      | `'auto'`                      | Format for the Y axis and the tooltip.                                                                                                                         |
| `yAxis.min`, `yAxis.max`     | number                                         | calculated                    | Fixed limits.                                                                                                                                                  |
| `yAxis2`                     | `{ format, title, min, max }`                  | —                             | Right axis for the series with `axis: 'right'`.                                                                                                                |
| `series[].axis`              | `'left'` `'right'`                             | `'left'`                      | The series' value axis.                                                                                                                                        |
| `yAxis.index`                | boolean                                        | `false`                       | Base-100 index: each series relative to its first value.                                                                                                       |
| `yAxis.width`                | px                                             | —                             | Minimum width for the axis numbers; lines up several charts.                                                                                                   |
| `xAxis.labels`               | boolean                                        | `true`                        | `false` hides the X axis labels.                                                                                                                               |
| `xAxis.band`                 | boolean                                        | `false`                       | Forces a band scale (points in the middle of their slot), to line up with bars.                                                                                |
| `xAxis.grid`                 | boolean                                        | with dates or numbers, `true` | Vertical grid lines at each X axis tick. With categories they're off unless you ask for them.                                                                  |
| `yAxis.labels`               | boolean                                        | `true`                        | `false` hides the axis numbers (the grid stays).                                                                                                               |
| `yAxis.zero`                 | boolean                                        | `false`                       | Forces zero in (bars and areas already include it).                                                                                                            |
| `yAxis.type`                 | `'linear'` `'log'`                             | `'linear'`                    | Log scale: ticks at 1, 2, and 5 × 10ⁿ; only positive values count and there's no zero.                                                                         |
| `yAxis.grid`                 | boolean                                        | `true`                        | `false` removes the value grid (the zero line stays).                                                                                                          |
| `series[].type`              | see [Series types](#series-types)              | —                             | A registered type.                                                                                                                                             |
| `series[].field`             | text                                           | —                             | Numeric field.                                                                                                                                                 |
| `series[].name`              | text                                           | the field                     | Visible name; must be unique.                                                                                                                                  |
| `series[].stack`             | `true` or text                                 | —                             | Stacks bars or areas in the same group. Positive and negative values stack separately.                                                                         |
| `series[].smooth`            | boolean                                        | `false`                       | Monotone curve (line and area).                                                                                                                                |
| `series[].color`             | 1 to 8                                         | its position                  | Spot in the palette.                                                                                                                                           |
| `series[].visible`           | boolean                                        | `true`                        | Visible at the start.                                                                                                                                          |
| `series[].format`            | format                                         | the Y axis one                | Its own format in the tooltip.                                                                                                                                 |
| `orientation`                | `'vertical'` `'horizontal'`                    | `'vertical'`                  | In horizontal, the categories go on the vertical axis.                                                                                                         |
| `theme`                      | `'light'` `'dark'` `'auto'`                    | `'auto'`                      | `auto` follows the system and changes live.                                                                                                                    |
| `palette`                    | array of colors or `{ light, dark }`           | the LozCharts one             | Your own colors, in order (8 at most). See [Custom palette](#custom-palette).                                                                                  |
| `height`                     | px                                             | `320`                         | Height of the chart area with its axes (a series type can ask for a different one; the one you set here wins).                                                 |
| `legend`                     | `false` or `{ position: 'top' \| 'bottom' }`   | bottom                        | Only shows up with 2 or more series.                                                                                                                           |
| `tooltip`                    | boolean or `{ float }`                         | `true`                        | `false` turns off the tooltip and the pointer; `{ float: false }` removes just the box (everything else stays).                                                |
| `animate`                    | boolean                                        | `true`                        | `false` draws without animation.                                                                                                                               |
| `locale`, `currency`         | text                                           | the page's `lang`, `'USD'`    | Language of the library's own text (`'es'`, `'en'`, `'pt-BR'`) and of numbers and dates with `Intl`.                                                           |
| `background`                 | boolean                                        | `true`                        | Paints the theme's surface behind the chart.                                                                                                                   |
| `onHover`                    | function                                       | —                             | Gets the X of the active data point (or null on leave), its row index (−1), and its series. With `highlight(x)` it syncs charts.                               |
| `selection`                  | array of row indexes                           | —                             | Selected data: shown normally while the rest is dimmed. See `select()`.                                                                                        |
| `zoom`                       | boolean or `{ range, x, y, scrollbar, reset }` | `false`                       | Zoom with a thin slider (`scrollbar: 'mini'` for the bar with a mini chart). `y: true` also zooms the Y axis. See [Zoom](#zoom-annotations-and-direct-labels). |
| `onZoom`                     | function                                       | —                             | Gets the first and last visible data points (or null when showing everything), the window `{ start, end }`, and the Y window.                                  |
| `onClick`                    | function                                       | —                             | Click, Enter, or Space on a data point: gets its X, its index, and the series (or null if it's for all of them).                                               |
| `annotations`                | array of `{ x \| y, label, axis }`             | —                             | Reference lines (one value) and bands (two values).                                                                                                            |
| `endLabels`                  | boolean or `{ value }`                         | `false`                       | Name (and value) at the end of each line, area, or step.                                                                                                       |
| `emphasis`                   | text or array                                  | —                             | Highlighted series; the rest go gray as context.                                                                                                               |
| `ariaLabel`                  | text                                           | automatic                     | Description for screen readers.                                                                                                                                |

The formats are `'auto'` (compact from a thousand up: 0 / 1K / 2K), `'compact'`, `'number'`,
`'percent'` (the data goes in as a fraction: `0.25` = 25%), `'currency'`, or a function
`(v) => text`. The format changes what you see on the axis; the tooltip always shows the exact
value.

## Languages

The chart speaks English, Spanish and Brazilian Portuguese: the tooltip, the legend, the buttons,
what a screen reader hears, the data table and the console warnings. It picks the language like
this:

1. The `locale` option, if you set it (`'en'`, `'es'`, `'pt-BR'`, or any region such as `'es-MX'`).
2. Otherwise, the page's language (`<html lang="pt-BR">`).
3. Otherwise, English.

`locale` also sets how numbers and dates look: `'es-MX'` uses the Spanish text with Mexican
number formats.

Want another language, or to change a single text? Register it:

```js
LozChart.registerLocale('fr', { chart: { showAll: 'Tout voir' } }); // whatever is missing comes from English
LozChart.registerLocale('es', { chart: { showAll: 'Mostrar todo' } }); // change one text
```

The full list of texts is the `Messages` type (in `src/core/i18n.ts`). A series type of your own can
give its name per language: `label: { en: 'Gantt chart', es: 'diagrama de Gantt', pt: 'gráfico de Gantt' }`.
The world map finds countries by their ISO code or by their name in English, Spanish or Portuguese
(`'Germany'`, `'Alemania'`, `'Alemanha'`, and common forms like `'USA'` or `'EE. UU.'`).

## Custom palette

LozCharts comes with its own palette of 8 colors, checked for color blindness and with shades made
for dark mode. If you need your brand colors, pass them in `palette`:

```js
new LozChart('#chart', {
  palette: {
    light: ['#0a7d4f', '#6b3fa0', '#d9480f'],
    dark: ['#2fb37a', '#9b74d1', '#f0703a'], // optional: if it's missing, light is used
  },
  // …
});
```

- A plain array (`palette: ['#0a7d4f', …]`) works for both modes.
- There's room for 8 colors at most, and that's also how many series fit. The extra ones are
  grouped into "Other" if they're stacked together; if not, they're dropped with a warning. A color
  is never repeated.
- Before you use it, check your palette with a color blindness simulator and measure the contrast.
  Brand colors were rarely designed with charts in mind.

## Methods

| Method                                                    | What it does                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `setData(data)`                                           | Changes the data and animates from the current state (even mid-animation).                                                     |
| `options`                                                 | The current options, with the defaults filled in (read-only).                                                                  |
| `setOptions({...}, animate?)`                             | Merges new options with the current ones and redraws.                                                                          |
| `axisWidth`                                               | The width the Y axis numbers need right now (to line up charts with `yAxis.width`).                                            |
| `highlight(x)`                                            | Marks the data point with that X (or several, with a list), without a tooltip; `null` clears.                                  |
| `highlightIndex(i)`                                       | Like `highlight`, by row index or list of indexes (a cell in a heatmap).                                                       |
| `select(indexes)`, `selection`                            | Selects data by index (the rest is dimmed) and announces it; `null` clears the selection.                                      |
| `zoomTo(from, to)`, `resetZoom()`                         | Zooms the X axis in on a span (with bars, it includes the categories at the ends) or shows all on both axes.                   |
| `zoomRange`                                               | The first and last data points visible with zoom, or null.                                                                     |
| `zoomWindow`, `setZoomWindow({ start, end } \| null)`     | The exact zoom window in fractions of the X axis, and setting it (to sync charts).                                             |
| `zoomYWindow`, `setZoomWindow(x, { start, end } \| null)` | The Y zoom window, in fractions of the axis from the bottom, and setting it (pass `chart.zoomWindow` as `x` to leave X alone). |

| `redraw()` | Draws again with the current state, without animating (for types whose drawing changes outside). |
| `setTheme('dark')` | Changes the theme. |
| `toggleSeries('Online', visible?)` | Hides or shows a series; the others keep their color. |
| `toSVG()` | The full SVG as text, with title and legend. |
| `toCSV()` | The data as CSV (unformatted numbers, ISO dates), for a spreadsheet. |
| `download('png' \| 'svg' \| 'csv', name?)` | Downloads the image (PNG at double resolution) or the data as CSV. |
| `destroy()` | Removes the chart and stops listening to its events. |
| `visibleSeries` | Names of the visible series (the ones you didn't hide in the legend). |
| `element` | The page element the chart lives in. |
| `LozChart.multiples(element, options)` | Creates small multiples. See [Small multiples](#small-multiples). |
| `LozChart.getChart(element)` | The chart already mounted on that element (or that selector), if there is one. |
| `LozChart.initAll(root)`, `destroyAll(root)`, `cleanup()` | Automatic mounting for HTMX. |
| `LozChart.registerSeries(name, impl)` | Adds a series type. |
| `LozChart.seriesTypes` | The names of the registered series types. |
| `LozChart.registerMap(name, topojsonOrGeojson)` | Adds a map for `choropleth` and `mapbubble`. |

The methods that change something return the same chart, so you can chain them:
`chart.setTheme('dark').toggleSeries('In store', false)`.

### When there is no data

The chart stays empty, with no message: you decide what it says. While it has no data, its element
has the `data-empty` attribute, so all you need is one CSS rule:

```css
#sales[data-empty]::after {
  content: 'No sales yet this month.';
  display: grid;
  place-items: center;
  position: absolute;
  inset: 0;
  color: #52514e;
}
#sales {
  position: relative;
}
```

If you'd rather do it from code, check `chart.element.hasAttribute('data-empty')` after `setData`.
People using a screen reader still hear that the chart doesn't have data yet.

## Accessibility

You don't have to turn any of this on: it comes with every chart.

<!-- vivo: teclado -->

- The SVG has `role="img"` and a description (`aria-label`).
- With focus on the chart, ← → (↑ ↓ in horizontal) move through the data, Home and End go to the
  ends, and Escape closes the tooltip. Every move is announced to screen readers.
- Every chart has a hidden table with all the data. With zoom too, because zoom changes what you
  see, not the data.
- With zoom, + − and 0 zoom in, zoom out, and go back to everything. The scrollbar is three sliders
  (the window and its two edges) that move with the arrow keys, Page Up and Page Down, and Home and
  End, and that announce the visible span. The "Show all" button shows up when you zoom in.
- Annotations with text are read in the chart's description ("References: Daily goal, 8K").
- The legend is made of buttons with `aria-pressed`.
- It respects the system's reduced motion setting (`prefers-reduced-motion`).

## How it works under the hood

If you're going to touch the core, this saves you from reading the code from scratch.

- **Scales** (`core/scales.ts`). They turn data into pixels. Y is linear, a simple rule of three. X
  is a **band** scale if there are bars: the width is split into n slots and each series uses the
  center `x.at(i)`. If there are no bars it's **continuous** and each point is placed by its real
  date.
- **Round axis ticks** (`core/ticks.ts`). The step is rounded to 1, 2, or 5 × 10ⁿ and the domain
  is extended to multiples of that step. For dates it picks the finest calendar interval (hour,
  day, month, quarter, year…) that leaves room between labels.
- **Monotone curve** (`core/shapes.ts`). It smooths without making up peaks: where the data changes
  direction the curve goes flat, and the tangents are trimmed so they don't overshoot.
- **Animation** (`chart.ts`). Each state is a "frame" with the Y domain and the base and tip of each
  series. Animating means interpolating between the current frame and the new one over 600 ms,
  fast at the start and gentle at the end (ease-out). If another change comes in halfway, it starts
  from the frame on screen at that moment.
- **Zoom** (`core/view.ts`). The visible window is stored as fractions of the X axis, from 0 to 1.
  That way it works the same for bars, dates, and numbers, and doesn't depend on the width. The
  scales get the window and stretch the axis; whatever's outside falls outside the area and the
  clipping hides it. For the value axis only the data in the window counts, and that change is
  animated over 220 ms to keep up with the gesture.
- **Labels without collisions** (`core/labels.ts`). Each label wants to sit at the height of its
  data point. The ones that collide form a group centered on the average of what they asked for,
  and groups that collide merge. None of them moves further from its data point than it needs to.

## Create a series type

```js
LozChart.registerSeries('dots', {
  legendSymbol: 'dot',
  draw({ frame, color, x, y, n }) {
    let s = '';
    for (let i = 0; i < n; i++) {
      if (isFinite(frame.y1[i])) s += `<circle cx="${x.at(i)}" cy="${y.map(frame.y1[i])}" r="4" fill="${color}"/>`;
    }
    return s;
  },
});
```

A type can ask for extra columns with `columns: (o) => ({ low: o.low })`, and they arrive animated
in `frame.cols.low`. If they're in axis units, list them in `valueColumns` so they count toward the
domain and shrink when the series is hidden. `pointer: 'nearest'` swaps the guide that follows the
pointer (crosshair) for "the nearest point", and `tooltip(ps, i, format)` customizes the text of the
tooltip and the table.

Series always draw on a logical plane, with the index on X and the value on Y. In horizontal, the
core mirrors it across its diagonal, so a new type works in both orientations with no changes.

Besides the cartesian plane there are two coordinate systems (`coords`):

- `'polar'`: the core draws the rings, spokes, and labels, and the series places its points with
  `ctx.polar.point(i, value)`. That's how the radar does it.
- `'free'`: no axes. The series uses the whole area (`ctx.width`, `ctx.height`) and answers `hit`
  (which data point is under the pointer) and `anchor` (where to anchor the tooltip with the
  keyboard).

With `legendBy: 'points'` the legend lists categories, like in the pie: each one with
`ctx.pointColor(i)`, and the hidden ones come in as zero. `ctx.label(i)`, `ctx.format(v)`,
`ctx.percent(v)`, and `ctx.measure(text)` help you with labels, and `domainValues(options)` adds
fixed values to the domain (like the gauge's goal).

The rest of the context and the contract:

- `ctx.purpose` says what it's being drawn for: `'screen'` (on the page), `'export'` (`toSVG` and
  downloads), or `'overview'` (the mini chart in the zoom bar, in gray with a transparent surface;
  labels and details aren't needed there).
- `ctx.locale` and `ctx.currency` (also in the tooltip's `format`) are the chart's language and
  currency, for writing dates and text with `Intl`.
- `ctx.siblings()` gives you the contexts of the visible series of the same type, for things that
  several side-by-side series decide together: two waterfalls either both get labels or neither
  does.
- `hit(ctx, px, py)` also works in cartesian, in px of the logical plane: the type says which data
  point is under the pointer (−1: none). If no series with `hit` finds one, the pointer works as
  usual, unless every visible series has `hit`.
- `click(ctx, i, event)` gets the click on data point i, or Enter and Space on the active data
  point. It's called on the series under the pointer (with `hit`, or in `'free'`) or, if it's not
  clear which one, on every visible series that has it. Then the chart's `onClick` option is
  called.
- `preferredHeight(ps, width)` is the height the series asks for (axes included) when you don't
  set `height`. With several series, the tallest wins.
- `derivedName`: with `derive`, what the calculated value is called (the waterfall uses
  `'acumulado'`). `toCSV` uses it if the series name matches a field it also exports.
- For selection (the `selection` option or `select()`), `ctx.isDimmed(i)` says which data is
  dimmed. A type with `dimmable: true` draws it with `DIM_OPACITY` (0.25): `dimOpacity(ctx, i)`
  gives the attribute, `dimmed(ctx, i, markup)` wraps a data point, and
  `paintDimmed(ctx, (include) => …)` draws in two passes a stroke that joins lots of data points
  (all the bars in one path). Without `dimmable`, the core leaves the series as it is and marks the
  selected ones with `hover`.
- `chart.redraw()` draws again without animating. It's for a type whose drawing changed outside
  the options, like an image that just finished loading.

Zoom works on cartesian charts. A `'free'` type with its own time axis, like a Gantt chart, doesn't
get it, because the window, the gestures, the scrollbar, and the keyboard all rely on the core's
index scale. That type can offer its own date cropping through its options and `redraw()`.

**Core pieces for extensions.** The package (and `window.LozChart` in the `<script>` build) exports
the same things the library's types are drawn with: colors (`parseColor`, `toHex`, `toOklab`,
`fromOklab`, `mixOklab`, `luminance`, `contrast`, `textOn`, `inkFor`, `colorDomain`, `makeRamp`,
`paint`, `paintColor`, `legendSpec`, `legendWidth`, `MAX_COLORS`), formats (`valueFormatter`,
`compactFormatter`, `axisFormatter`, `parseTime`, `timeTickLabel`, `timeFullLabel`), axis ticks
(`niceStep`, `niceDomain`, `numberTicks`, `logTicks`, `logDomain`, `chooseTimeInterval`,
`timeTicks`, `detectTimeUnit`), scales (`LinearScale`, `LogScale`, `BandScale`, `ContinuousScale`),
shapes (`linePath`, `areaPath`, `barPath`, `stepPath`, `polarPoint`, `r2`), selection
(`DIM_OPACITY`, `dimOpacity`, `dimmed`, `paintDimmed`), and `esc`, `attrs`, `textWidth`, `fitText`,
`toCSV`, `slug`, and `swatchOf`.

## Build from source

If you want to change the library or run its tests:

```bash
npm install
npm run build   # dist/: lozcharts.js (ESM), lozcharts.umd.js (UMD), react.js, maps/, and types/
npm test        # tests (node:test)
npm run check   # format, types, and tests: the same thing continuous integration runs
```

After building, double-click `demo/index.html` and you have the gallery. You don't need a server.
To try your changes in another project on your machine, install it from the folder:
`npm install ../lozcharts`. It stays linked to the folder, so after each change run
`npm run build` and reload.

## Design rules

The fixed rules every type follows (names, palette, and the measurements of each mark) are in
[DESIGN.md](DESIGN.md).
