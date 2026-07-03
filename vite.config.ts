import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import sirv from 'sirv';

const root = resolve(__dirname);

const staticDirs = ['js', 'css', 'data', 'media', 'thirdparty'] as const;

/** CSS linked in HTML but not bundled by Vite. */
const legacyStylesheets = [
  '/thirdparty/autoComplete.min.css',
  '/css/sq2bs.css',
  '/css/sidebar.css',
] as const;

/** Re-add CSS link tags removed during Vite HTML transform. */
function preserveLegacyStylesheets(): Plugin {
  return {
    name: 'preserve-legacy-stylesheets',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const tags = legacyStylesheets
          .filter((href) => !html.includes(href))
          .map((href) => `<link rel="stylesheet" href="${href}">`)
          .join('\n    ');
        if (!tags) return html;
        return html.replace('</head>', `    ${tags}\n  </head>`);
      },
    },
  };
}

/** Serve /js, /css, /data, /media, and /thirdparty during dev. */
function serveLegacyAssets(): Plugin {
  return {
    name: 'serve-legacy-assets',
    configureServer(server) {
      for (const dir of staticDirs) {
        server.middlewares.use(
          `/${dir}`,
          sirv(resolve(root, dir), { dev: true, etag: true }),
        );
      }
      server.middlewares.use(
        '/wynnfo',
        sirv(resolve(root, 'wynnfo'), { dev: true, etag: true }),
      );
    },
  };
}

const pages = {
  builder: resolve(root, 'builder/index_full.html'),
  'builder/doc': resolve(root, 'builder/doc.html'),
  items: resolve(root, 'items/index.html'),
  item: resolve(root, 'item/index.html'),
  crafter: resolve(root, 'crafter/index.html'),
  custom: resolve(root, 'custom/index.html'),
  map: resolve(root, 'map/index.html'),
  atlas: resolve(root, 'atlas/index.html'),
  ingredients: resolve(root, 'ingredients/index.html'),
  ingredient: resolve(root, 'ingredient/index.html'),
  items_adv: resolve(root, 'items_adv/index.html'),
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
  plugins: [serveLegacyAssets(), preserveLegacyStylesheets()],
});
