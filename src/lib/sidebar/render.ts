import {
  NAV_ITEMS,
  type NavId,
  type NavItem,
  type SidebarOptions,
} from './config';

function desktopLink(item: NavItem, active?: NavId): string {
  const href = active === item.id ? '' : item.href;
  return `<a href="${href}"><img src="../media/icons/new/${item.icon}.png" alt="${item.label}" title="${item.label}"><b>${item.label}</b></a>`;
}

function mobileAppLink(item: NavItem): string {
  return `<a href="${item.href}" class="w-100 mb-3 text-white" style="height: 5vh; text-decoration: none;">
                <img src="../media/icons/new/${item.icon}.png" alt="" style="height: 100%;">
                <span>${item.mobileLabel}</span>
            </a>`;
}

const MOBILE_FOOTER_LINKS = `<a href="#" data-action="toggle-icons" class="w-100 mb-3 text-white" style="height: 5vh; text-decoration: none;">
                <img src="../media/icons/new/reload.png" alt="" style="height: 100%;">
                <span>Swap Icon Style</span>
            </a>
            <a href="https://nori.fish/wynn/build/" class="w-100 mb-3 text-white" style="height: 5vh; text-decoration: none;">
                <img src="../media/icons/new/nori_build.png" alt="" style="height: 100%;">
                <span>Build Search</span>
            </a>
            <a href="https://nori.fish/wynn/recipe/" class="w-100 mb-3 text-white" style="height: 5vh; text-decoration: none;">
                <img src="../media/icons/new/nori_recipe.png" alt="" style="height: 100%;">
                <span>Recipe Search</span>
            </a>
            <a href="https://discord.gg/CGavnAnerv" class="w-100 mb-3 text-white" style="height: 5vh; text-decoration: none;">
                <img src="../media/icons/discord.png" alt="" style="height: 100%;">
                <span>Discord</span>
            </a>`;

function renderMobileNav(options: SidebarOptions): string {
  if (options.mobile === 'none') return '';

  const activeItem = options.active
    ? NAV_ITEMS.find((item) => item.id === options.active)
    : undefined;
  const mobileTitle = options.mobileTitle ?? activeItem?.mobileLabel ?? '';
  const mobileIcon = options.mobileIcon ?? activeItem?.icon ?? 'builder';

  const mobileLinks = NAV_ITEMS.map((item) => mobileAppLink(item)).join('\n            ');

  const headerInner =
    options.mobile === 'branded'
      ? `<div class="navbar-brand mx-auto scaled-font" style="height: 100%;">
                <img src="../media/icons/new/${mobileIcon}.png" alt="" style="height: 100%;">
                <span>${mobileTitle}</span>
            </div>
            `
      : '';

  return `<div id="mobile-navbar" class="navbar dark-5 dark-shadow fixed-top d-lg-none pb-0">
        <div class="container-fluid scaled-font justify-content-center" style="height: 5vh;">
            ${headerInner}<button class="btn dropdown-toggle dark-2 px-4 text-white scaled-font border-dark border-3" data-action="toggle-mobile-nav"></button>
        </div>
        <div class="container-fluid scaled-font dark-3 px-3 py-3" id="mobile-navbar-dropdown" style="display: none;">
            ${mobileLinks}
            ${MOBILE_FOOTER_LINKS}
        </div>
    </div>`;
}

/** Expand partials/sidebar.html with nav links for the given page options. */
export function renderSidebar(template: string, options: SidebarOptions): string {
  const desktopLinks = NAV_ITEMS.map((item) => desktopLink(item, options.active)).join(
    '\n            ',
  );

  return template
    .replace('{{SIDEBAR_EXTRA}}', options.sidebarExtraClass ?? '')
    .replace('{{DESKTOP_LINKS}}', desktopLinks)
    .replace('{{MOBILE_NAV}}', renderMobileNav(options));
}
