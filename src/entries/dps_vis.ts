import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

const D3 = 'https://d3js.org/d3.v7.js';

await loadLegacyScripts([
  D3,
  legacy.utils,
  legacy.icons,
  legacy.loadItem,
  legacy.dpsVis,
]);
