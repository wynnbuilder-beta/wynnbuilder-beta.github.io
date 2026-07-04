import { wireSidebarEvents } from '@/lib/sidebar/events';

let sharedPageInitialized = false;

/** One-time shared setup (sidebar, etc.) — safe to call multiple times. */
export function initSharedPage(): void {
  if (sharedPageInitialized) return;
  sharedPageInitialized = true;
  wireSidebarEvents();
}

function showInitErrorBanner(message: string, stack?: string): void {
  let banner = document.getElementById('page-init-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'page-init-error';
    banner.setAttribute('role', 'alert');
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '99999',
      padding: '12px 16px',
      background: '#5c1a1a',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '13px',
      whiteSpace: 'pre-wrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    });
    document.body.prepend(banner);
  }
  banner.textContent = stack ? `${message}\n\n${stack}` : message;
}

function reportInitError(err: unknown): void {
  console.error('Page failed to start', err);
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  const errBox = document.getElementById('err-box');
  if (errBox) errBox.textContent = message;
  const stackBox = document.getElementById('stack-box');
  if (stackBox && err instanceof Error) stackBox.textContent = err.stack ?? '';
  else if (!errBox) showInitErrorBanner(message, stack);
}

/**
 * Wrap a page init so it runs once, runs shared bootstrap first, and surfaces errors.
 * Returns the guarded async init function (useful for composing inits, e.g. builder_doc).
 */
export function createPageInit(init: () => void | Promise<void>): () => Promise<void> {
  let started = false;
  return async () => {
    if (started) return;
    started = true;
    initSharedPage();
    await init();
  };
}

/** Run a page init and surface failures instead of fire-and-forget void calls. */
export function runPageInit(init: () => void | Promise<void>): void {
  void createPageInit(init)().catch(reportInitError);
}
