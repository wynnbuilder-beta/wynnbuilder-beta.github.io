import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

await loadLegacyScripts([
  legacy.utils,
  legacy.buildUtils,
  legacy.icons,
  legacy.displayConstants,
  legacy.display,
  legacy.query,
  legacy.exprParser,
  legacy.loadIng,
  legacy.searchAdv,
  legacy.ingredientsAdv,
  legacy.loadItem,
]);
