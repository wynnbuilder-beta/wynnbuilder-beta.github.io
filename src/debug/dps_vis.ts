// @ts-nocheck
import * as d3 from 'd3';
import { attachGlobals } from '@/lib/attachGlobals';
import { WYNN_VERSION_LATEST, setWynnVersionId, wynn_version_names } from '@/load_item';
import { make_elem, zip2 } from '@/utils';

type DpsPoint = [string, number, unknown, string, number, number, number, number, [string, string][]];

d3.select('body')
  .append('div')
  .attr('style', 'width: 100%; min-height: 0px; flex-grow: 1')
  .append('svg')
  .attr('preserveAspectRatio', 'xMinYMin meet')
  .classed('svg-content-responsive', true);
const graph = d3.select<SVGSVGElement, unknown>('svg');

const margin = { top: 20, right: 20, bottom: 35, left: 40 };

function bbox(): DOMRect {
  return (graph.node()!.parentNode as Element).getBoundingClientRect();
}

function xAxis(g: d3.Selection<SVGGElement, unknown, any, any>, x: d3.ScaleLinear<number, number>) {
  const _bbox = bbox();
  g.attr('transform', `translate(0,${_bbox.height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(_bbox.width / 80, ','))
    .call((g) => g.select('.domain').remove())
    .call((g) =>
      g
        .select('text')
        .attr('x', _bbox.width)
        .attr('y', margin.bottom - 4)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'end')
        .text('Combat Level'),
    );
}

function yAxis(g: d3.Selection<SVGGElement, unknown, any, any>, y: d3.ScaleLinear<number, number>) {
  g.attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .call((g) => g.select('.domain').remove())
    .call((g) =>
      g
        .select('text')
        .attr('x', -margin.left)
        .attr('y', 10)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .text('Base DPS'),
    );
}

function grid(
  g1: d3.Selection<SVGGElement, unknown, any, any>,
  g2: d3.Selection<SVGGElement, unknown, any, any>,
  x: d3.ScaleLinear<number, number>,
  y: d3.ScaleLinear<number, number>,
) {
  const _bbox = bbox();
  g1
    .attr('stroke', 'currentColor')
    .attr('stroke-opacity', 0.1)
    .selectAll('line')
    .data(x.ticks())
    .join('line')
    .attr('x1', (d) => 0.5 + x(d))
    .attr('x2', (d) => 0.5 + x(d))
    .attr('y1', margin.top)
    .attr('y2', _bbox.height - margin.bottom)
    .exit()
    .remove();
  g2
    .attr('stroke', 'currentColor')
    .attr('stroke-opacity', 0.1)
    .selectAll('line')
    .data(y.ticks())
    .join('line')
    .attr('y1', (d) => 0.5 + y(d))
    .attr('y2', (d) => 0.5 + y(d))
    .attr('x1', margin.left)
    .attr('x2', _bbox.width - margin.right)
    .exit()
    .remove();
}

const _xAxis = graph.append('g');
_xAxis.append('text');
const _yAxis = graph.append('g');
_yAxis.append('text');
const _grid1 = graph.append('g');
const _grid2 = graph.append('g');

let dps_getter_func: (d: DpsPoint) => number = (d) => d[4];
let prepowder = true;
const strDex = false;

let dps_data: Record<string, DpsPoint[]> = {};
let current_data: DpsPoint[] | null = null;
let current_type = 'wand';
let baseline_x: number[] = [];
let baseline_y: number[] = [];

const baseUrl = window.location.protocol + '//' + window.location.host + '/';

async function plotData() {
  if (isNaN(wynn_version_id) || wynn_version_id > WYNN_VERSION_LATEST || wynn_version_id < 0) {
    setWynnVersionId(0);
  }

  dps_data = await (
    await fetch(baseUrl + '/data/' + wynn_version_names[wynn_version_id] + '/' + 'dps_data.json')
  ).json();

  dps_getter_func = (d) => d[4];
  current_data = dps_data.wand;
  baseline_x = dps_data.baseline_xs as unknown as number[];
  baseline_y = dps_data.baseline_ys as unknown as number[];

  d3.select(window).on('resize', function () {
    redraw(current_data!);
  });
  redraw(current_data!);
}
void plotData();

const versionDropdown = document.getElementById('versionDropdown')!;
for (let i = 0; i < wynn_version_names.length; i++) {
  versionDropdown.append(make_elem('option', [], { value: i, label: wynn_version_names[i] }));
}

const colorMap = new Map([
  ['Normal', '#fff'],
  ['Unique', '#ff5'],
  ['Rare', '#f5f'],
  ['Legendary', '#5ff'],
  ['Fabled', '#f55'],
  ['Mythic', '#a0a'],
  ['Crafted', '#0aa'],
  ['Custom', '#0aa'],
  ['Set', '#5f5'],
]);
const tiers_mod = new Map([
  ['Normal', 0.8],
  ['Unique', 1.0],
  ['Rare', 1.1],
  ['Legendary', 1.3],
  ['Fabled', 1.5],
  ['Mythic', 1.7],
  ['Set', 1.05],
]);
const weapon_type_mods = new Map([
  ['wand', 0.6],
  ['spear', 0.8],
  ['dagger', 1.0],
  ['bow', 1.2],
  ['relik', 1.2],
]);
const tier_baselines = new Map<string, [d3.Selection<SVGPathElement, unknown, any, any>, d3.Selection<SVGPathElement, unknown, any, any>]>();
for (const tier of tiers_mod.keys()) {
  const line_top = graph.append('path');
  const line_bot = graph.append('path');
  tier_baselines.set(tier, [line_top, line_bot]);
}

const circles = graph.append('g');

const details = graph.append('g').attr('fill', '#444');
details.append('rect').attr('z', '100');

function showDetails(
  _event: MouseEvent,
  i: DpsPoint,
  xfunc: d3.ScaleLinear<number, number>,
  yfunc: d3.ScaleLinear<number, number>,
) {
  const _bbox = bbox();
  const xpos = xfunc(i[1]);
  let ypos = yfunc(dps_getter_func(i));
  const texts: [number, string][] = [
    [1, i[0]],
    [3, 'Prepowder: ' + i[4].toFixed(2)],
    [4, 'Postpowder: ' + i[5].toFixed(2)],
    [6, 'Design Modifier: ' + i[7].toFixed(2)],
    [7, 'Explained D. Mod: ' + i[6].toFixed(2)],
  ];
  let idx = 8;
  for (const explanation of i[8]) {
    texts.push([idx, explanation[0] + ': ' + explanation[1]]);
    idx += 1;
  }
  let box_height = 14 * idx - 4;
  if (ypos + box_height > _bbox.height) ypos = _bbox.height - box_height;
  details
    .select('rect')
    .attr('x', xpos)
    .attr('y', ypos)
    .attr('width', 200)
    .attr('height', box_height)
    .attr('opacity', 0.8);
  details
    .selectAll('text')
    .data(texts, (d: [number, string]) => d[0])
    .join('text')
    .style('font-size', '12px')
    .attr('x', xpos + 5)
    .attr('y', (d) => d[0] * 14 + ypos)
    .attr('text-anchor', 'start')
    .attr('fill', '#fff')
    .attr('opacity', 1)
    .text((d) => d[1]);
}
function hideDetails() {
  details.select('rect').attr('x', 0).attr('y', 0).attr('width', 0).attr('height', 0).attr('opacity', 0);
  details.selectAll('text').data([]).join('text');
}

function redraw(data: DpsPoint[]) {
  hideDetails();
  let max_dps_base = 0;
  const tmp = dps_getter_func;
  const tmp2 = prepowder;
  prepowder = false;
  setGetterFunc();
  for (const x of data) {
    if (dps_getter_func(x) > max_dps_base) {
      max_dps_base = dps_getter_func(x);
    }
  }
  dps_getter_func = tmp;
  prepowder = tmp2;
  const _bbox = bbox();
  const x = d3.scaleLinear([70, 110], [margin.left, bbox().width - margin.right]);
  const y = d3.scaleLinear([0, max_dps_base * 1.1], [bbox().height - margin.bottom, margin.top]);

  const type_mod = weapon_type_mods.get(current_type)!;
  for (const tier of tiers_mod.keys()) {
    const res = tier_baselines.get(tier)!;
    const line_top = res[0];
    const line_bot = res[1];
    const tier_mod = tiers_mod.get(tier)!;
    const y_max = baseline_y.map((x) => 2.1 * x * tier_mod * type_mod);
    const y_min = baseline_y.map((x) => 2.0 * x * tier_mod * type_mod);
    line_top
      .datum(zip2(baseline_x, y_max))
      .attr('fill', 'none')
      .attr('stroke', () => colorMap.get(tier)!)
      .attr(
        'd',
        d3
          .line<[number, number]>()
          .x(function (d) {
            return x(d[0]);
          })
          .y(function (d) {
            return y(d[1]);
          }),
      );
    line_bot
      .datum(zip2(baseline_x, y_min))
      .attr('fill', 'none')
      .attr('stroke', () => colorMap.get(tier)!)
      .attr(
        'd',
        d3
          .line<[number, number]>()
          .x(function (d) {
            return x(d[0]);
          })
          .y(function (d) {
            return y(d[1]);
          }),
      );
  }
  graph.attr('viewBox', [0, 0, _bbox.width, _bbox.height].join(' '));
  xAxis(_xAxis, x);
  yAxis(_yAxis, y);
  grid(_grid1, _grid2, x, y);
  circles
    .selectAll('circle')
    .data(data, (d: DpsPoint) => d[0])
    .join(
      function (enter) {
        return enter
          .append('circle')
          .attr('fill', (d) => colorMap.get(d[3])!)
          .attr('cx', (d) => x(d[1]))
          .attr('cy', (d) => y(dps_getter_func(d)))
          .attr('r', () => 5)
          .on('click', (event, d) => showDetails(event, d, x, y))
          .on('mouseover', function () {
            d3.select(this).raise();
          })
          .call((circle) =>
            circle.append('title').text((d) => [d[0], 'DPS: ' + dps_getter_func(d)].join('\n')),
          );
      },
      (update) =>
        update
          .attr('cx', (d) => x(d[1]))
          .attr('cy', (d) => y(dps_getter_func(d)))
          .on('click', (event, d) => showDetails(event, d, x, y))
          .select('title')
          .text((d) => [d[0], 'DPS: ' + dps_getter_func(d)].join('\n')),
      (exit) => exit.remove(),
    );
}

function setData(type: string) {
  current_type = type;
  d3.select('#info').text('SELECTED ITEM TYPE: ' + type);
  current_data = dps_data[type];
  redraw(current_data);
}

function setGetterFunc() {
  if (prepowder && !strDex) dps_getter_func = (d) => d[4];
  else if (!prepowder && !strDex) dps_getter_func = (d) => d[5];
  else if (prepowder && strDex) dps_getter_func = (d) => d[6];
  else dps_getter_func = (d) => d[7];
}

function togglePowder() {
  prepowder = !prepowder;
  d3.select('#powderToggle').text('prepowder (' + prepowder + ')');
  setGetterFunc();
  redraw(current_data!);
}

function changeVersion() {
  setWynnVersionId(Number((document.getElementById('versionDropdown') as HTMLSelectElement).value));
  void plotData();
}

attachGlobals({ setData, togglePowder, changeVersion });
