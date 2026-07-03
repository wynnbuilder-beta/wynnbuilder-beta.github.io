import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

await loadLegacyScripts([
  legacy.autoComplete,
  legacy.dragDropTouch,
  legacy.utils,
  legacy.buildUtils,
  legacy.buildEncodeDecode,
  legacy.icons,
  legacy.displayConstants,
  legacy.display,
  legacy.query,
  legacy.exprParser,
  legacy.loadItem,
  legacy.search,
  legacy.items,
]);
