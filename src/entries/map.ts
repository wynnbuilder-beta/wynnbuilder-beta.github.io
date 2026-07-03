import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

const LEAFLET = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';

await loadLegacyScripts([
  LEAFLET,
  legacy.utils,
  legacy.icons,
  legacy.loadMap,
  legacy.map,
]);
