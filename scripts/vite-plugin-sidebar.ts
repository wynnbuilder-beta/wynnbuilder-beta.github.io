import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { parseSidebarDirective } from '../src/lib/sidebar/config';
import { renderSidebar } from '../src/lib/sidebar/render';

export function sidebarPartialPlugin(root: string): Plugin {
  const templatePath = resolve(root, 'partials/sidebar.html');

  function injectSidebar(html: string, filename?: string): string {
    return html.replace(/<!--\s*@sidebar([^>]*?)-->/g, (_match, attrs: string) => {
      const options = parseSidebarDirective(attrs, filename);
      const template = readFileSync(templatePath, 'utf-8');
      return renderSidebar(template, options);
    });
  }

  return {
    name: 'sidebar-partial',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!html.includes('@sidebar')) return html;
        return injectSidebar(html, ctx.filename);
      },
    },
  };
}
