import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

const D3 = 'https://d3js.org/d3.v7.js';

await loadLegacyScripts([
  legacy.autoComplete,
  legacy.macy,
  legacy.utils,
  legacy.buildUtils,
  legacy.computationGraph,
  legacy.icons,
  legacy.displayConstants,
  legacy.display,
  legacy.loadItem,
  legacy.loadIng,
  legacy.loadTome,
  legacy.loadAspect,
  legacy.custom,
  legacy.craft,
  legacy.build,
  legacy.builderConstants,
  legacy.buildEncodeDecode,
  legacy.atree,
  legacy.aspects,
  legacy.builderGraph,
  legacy.builder,
  D3,
  legacy.renderComputeGraph,
]);
