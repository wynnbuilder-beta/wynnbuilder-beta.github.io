import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import sirv from 'sirv';
import { sidebarPartialPlugin } from './scripts/vite-plugin-sidebar';

const root = resolve(__dirname);

/** Static dirs copied to dist on build and served as-is in dev (not bundled by Vite). */
const staticDirs = ['data', 'media'] as const;

/** Root files copied to dist (not emitted by Vite). */
const rootFiles = ['manifest.json', 'credits.txt'] as const;

function copyPath(src: string, dest: string, recursive = false): void {
  if (!existsSync(src)) {
    console.warn(`skip missing: ${src}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, recursive ? { recursive: true } : undefined);
}

/** Dev static serving + post-build copy of game data and assets. */
function wynnbuilderStatic(): Plugin {
  return {
    name: 'wynnbuilder-static',
    configureServer(server) {
      for (const dir of staticDirs) {
        server.middlewares.use(
          `/${dir}`,
          sirv(resolve(root, dir), { dev: true, etag: true }),
        );
      }
    },
    closeBundle() {
      const dist = resolve(root, 'dist');
      mkdirSync(dist, { recursive: true });

      for (const dir of staticDirs) {
        copyPath(resolve(root, dir), resolve(dist, dir), true);
        console.log(`copied ${dir}/ -> dist/${dir}/`);
      }

      for (const file of rootFiles) {
        copyPath(resolve(root, file), resolve(dist, file));
        console.log(`copied ${file} -> dist/${file}`);
      }

      const builderFull = resolve(dist, 'builder/index_full.html');
      const builderIndex = resolve(dist, 'builder/index.html');
      if (existsSync(builderFull)) {
        cpSync(builderFull, builderIndex);
        console.log('copied dist/builder/index_full.html -> dist/builder/index.html');
      }
    },
  };
}

const pages = {
  builder: resolve(root, 'builder/index_full.html'),
  'builder/doc': resolve(root, 'builder/doc.html'),
  items: resolve(root, 'items/index.html'),
  sets: resolve(root, 'sets/index.html'),
  item: resolve(root, 'item/index.html'),
  crafter: resolve(root, 'crafter/index.html'),
  custom: resolve(root, 'custom/index.html'),
  map: resolve(root, 'map/index.html'),
  atlas: resolve(root, 'atlas/index.html'),
  ingredients: resolve(root, 'ingredients/index.html'),
  ingredient: resolve(root, 'ingredient/index.html'),
  items_adv: resolve(root, 'items_adv/index.html'),
  'items_adv/help': resolve(root, 'items_adv/items_adv_help.html'),
  ingredients_adv: resolve(root, 'ingredients_adv/index.html'),
  wynnfo: resolve(root, 'wynnfo/index.html'),
  dev: resolve(root, 'dev/index.html'),
  dps_vis: resolve(root, 'dps_vis.html'),
  index: resolve(root, 'index.html'),
  crafter_redirect: resolve(root, 'crafter.html'),
  map_redirect: resolve(root, 'map.html'),
  customizer: resolve(root, 'customizer.html'),
} as const;

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@css': resolve(root, 'css'),
    },
  },
  server: {
    port: 5173,
    open: '/builder/index_full.html',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: pages,
    },
  },
  plugins: [sidebarPartialPlugin(root), wynnbuilderStatic()],
});
