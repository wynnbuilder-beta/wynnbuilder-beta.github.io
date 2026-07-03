import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

await loadLegacyScripts([
  legacy.utils,
  legacy.buildUtils,
  legacy.buildEncodeDecode,
  legacy.icons,
  legacy.loadItem,
  legacy.loadIng,
  legacy.displayConstants,
  legacy.display,
  legacy.itemDisplay,
  legacy.item,
]);
