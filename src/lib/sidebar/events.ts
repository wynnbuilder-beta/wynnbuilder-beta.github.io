import { toggleIcons } from '@/icons';
import { toggle_tab } from '@/utils';

/** Delegated click handlers for shared sidebar / mobile-nav controls. */
export function wireSidebarEvents(): void {
  document.body.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-action]');
    if (!el) return;

    const action = el.getAttribute('data-action');
    if (action === 'toggle-icons') {
      e.preventDefault();
      toggleIcons();
    } else if (action === 'toggle-mobile-nav') {
      toggle_tab('mobile-navbar-dropdown');
    }
  });
}
