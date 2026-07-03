import './bootstrap';
import { loadLegacyScripts } from '@/lib/loadLegacyScripts';
import { legacy } from './legacyPaths';

const BOOTSTRAP =
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';

await loadLegacyScripts([
  BOOTSTRAP,
  legacy.autoComplete,
  legacy.macy,
  legacy.utils,
  legacy.icons,
  legacy.atlas,
]);
