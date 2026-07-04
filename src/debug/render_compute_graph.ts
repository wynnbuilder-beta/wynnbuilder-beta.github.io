import * as d3 from 'd3';
import { all_nodes } from '@/computation_graph';
import { edit_id_output } from '@/builder/builder_graph';
import type { ComputeNode } from '@/computation_graph';
import { sleep } from '@/utils';

function set_export_button(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>,
  button_id: string,
  output_id: string,
) {
  d3.select('#' + button_id).on('click', function () {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg.node()!);

    source = source.replace(/^<g/, '<svg');
    source = source.replace(/<\/g>$/, '</svg>');
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

    (document.getElementById(output_id) as HTMLAnchorElement).href = url;
  });
}

d3.select('#graph_body')
  .append('div')
  .attr('style', 'width: 100%; height: 100%; min-height: 0px; flex-grow: 1')
  .append('svg')
  .attr('preserveAspectRatio', 'xMinYMin meet')
  .classed('svg-content-responsive', true);
const graph = d3.select<SVGSVGElement, unknown>('svg');
const svg = graph.append('g');

graph
  .append('defs')
  .append('marker')
  .attr('id', 'arrowhead')
  .attr('viewBox', '-0 -5 10 10')
  .attr('refX', 23)
  .attr('refY', 0)
  .attr('orient', 'auto')
  .attr('markerWidth', 13)
  .attr('markerHeight', 13)
  .attr('xoverflow', 'visible')
  .append('svg:path')
  .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
  .attr('fill', '#aaa')
  .style('stroke', 'none');

const margin = { top: 20, right: 20, bottom: 35, left: 40 };

function bbox(): DOMRect {
  return (graph.node()!.parentNode as Element).getBoundingClientRect();
}
let _bbox = bbox();

const colors = ['aqua', 'yellow', 'fuchsia', 'white', 'teal', 'olive', 'purple', 'gray', 'blue', 'lime', 'red', 'silver', 'navy', 'green', 'maroon'];
const n_colors = colors.length;

const view = svg.append('rect').attr('class', 'view').attr('x', 0).attr('y', 0);

interface GraphNode {
  id: string;
  color: number;
  data: ComputeNode;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  name: string;
}

function convert_data(nodes_raw: ComputeNode[]) {
  const edges: GraphLink[] = [];
  const node_id = new Map<ComputeNode, string>();
  const nodes: GraphNode[] = [];
  for (const i in nodes_raw) {
    node_id.set(nodes_raw[i], i);
    nodes.push({ id: i, color: 0, data: nodes_raw[i] });
  }
  for (const node of nodes_raw) {
    const to = node_id.get(node)!;
    for (const input of node.inputs.values()) {
      const from = node_id.get(input.node)!;
      const link_name = input.translation;
      edges.push({
        source: from,
        target: to,
        name: link_name,
      });
    }
  }
  return {
    nodes,
    links: edges,
  };
}

function create_svg(data: { nodes: GraphNode[]; links: GraphLink[] }, redraw_func: () => void) {
  const link = svg
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(data.links)
    .enter()
    .append('line')
    .style('stroke', '#aaa')
    .attr('marker-end', 'url(#arrowhead)');

  const node = svg.selectAll<SVGGElement, GraphNode>('g').data(data.nodes);

  const node_enter = node.enter().append('g');

  node_enter
    .append('circle')
    .attr('r', 20)
    .style('fill', ({ color }) => colors[color]);

  node_enter
    .append('text')
    .attr('dx', -20)
    .attr('dy', -22)
    .style('fill', 'white')
    .text(({ data }) => data.name);

  const simulation = d3
    .forceSimulation(data.nodes)
    .force(
      'link',
      d3
        .forceLink<GraphNode, GraphLink>()
        .strength(0.1)
        .id(function (d) {
          return d.id;
        })
        .links(data.links),
    )
    .force('charge', d3.forceManyBody().strength(-400))
    .on('tick', ticked);

  let scale_transform = { k: 1, x: 0, y: 0 };
  function ticked() {
    link
      .attr('x1', function (d) {
        return (d.source as GraphNode).x!;
      })
      .attr('y1', function (d) {
        return (d.source as GraphNode).y!;
      })
      .attr('x2', function (d) {
        return (d.target as GraphNode).x!;
      })
      .attr('y2', function (d) {
        return (d.target as GraphNode).y!;
      });

    node_enter.attr('transform', function (d) {
      return (
        'translate(' +
        scale_transform.x +
        ',' +
        scale_transform.y +
        ') scale(' +
        scale_transform.k +
        ') translate(' +
        d.x +
        ',' +
        d.y +
        ')'
      );
    });
  }

  const drag = d3
    .drag<SVGGElement, GraphNode>()
    .on('start', dragstart)
    .on('drag', dragged);

  node_enter.call(drag).on('click', click);
  function click(event: MouseEvent, d: GraphNode) {
    if (event.ctrlKey) {
      d.color = (d.color + 1) % n_colors;
      d3.select(event.currentTarget as SVGGElement)
        .selectAll('circle')
        .style('fill', ({ color }) => colors[color]);
    } else {
      delete d.fx;
      delete d.fy;
      d3.select(event.currentTarget as SVGGElement).classed('fixed', false);
      simulation.alpha(0.5).restart();
    }
  }

  function dragstart() {
    d3.select(this).classed('fixed', true);
  }
  function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
    d.fx = event.x;
    d.fy = event.y;
    simulation.alpha(0.5).restart();
  }

  const zoom = d3
    .zoom<SVGRectElement, unknown>()
    .scaleExtent([0.01, 10])
    .translateExtent([
      [-10000, -10000],
      [10000, 10000],
    ])
    .filter(filter)
    .on('zoom', zoomed);
  view.call(zoom);

  function zoomed({ transform }: d3.D3ZoomEvent<SVGRectElement, unknown>) {
    link.attr('transform', transform.toString());
    scale_transform = { k: transform.k, x: transform.x, y: transform.y };
    node_enter.attr('transform', function (d) {
      return (
        'translate(' +
        scale_transform.x +
        ',' +
        scale_transform.y +
        ') scale(' +
        scale_transform.k +
        ') translate(' +
        d.x +
        ',' +
        d.y +
        ')'
      );
    });
    redraw_func();
  }
  function filter(event: Event) {
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    return (!mouseEvent.ctrlKey || event.type === 'wheel') && mouseEvent.button === 0;
  }
}

set_export_button(svg, 'saveButton', 'saveLink');

void (async function () {
  while (edit_id_output === undefined) {
    await sleep(500);
  }

  function redraw() {
    _bbox = bbox();
    graph.attr('viewBox', [0, 0, _bbox.width, _bbox.height].join(' '));
    view.attr('width', _bbox.width - 1).attr('height', _bbox.height - 1);
  }

  d3.select(window).on('resize', function () {
    redraw();
  });
  redraw();

  const data = convert_data(Array.from(all_nodes));
  create_svg(data, redraw);

  console.log('render');
})();
