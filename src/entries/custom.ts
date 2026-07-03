import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

await loadLegacyScripts([
  legacy.autoComplete,
  legacy.utils,
  legacy.buildUtils,
  legacy.icons,
  legacy.loadItem,
  legacy.loadIng,
  legacy.crafter,
  legacy.craft,
  legacy.displayConstants,
  legacy.display,
  legacy.custom,
  legacy.customizer,
]);
