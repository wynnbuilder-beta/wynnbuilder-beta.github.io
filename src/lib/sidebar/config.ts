/** Primary app nav entries shown in the shared sidebar. */
export type NavId = 'builder' | 'crafter' | 'items' | 'custom' | 'map' | 'wynnfo';

export interface NavItem {
  id: NavId;
  /** Desktop sidebar label. */
  label: string;
  /** Mobile dropdown label (may differ, e.g. Wynnfo → WynnFo). */
  mobileLabel: string;
  icon: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'builder',
    label: 'WynnBuilder',
    mobileLabel: 'WynnBuilder',
    icon: 'builder',
    href: '../builder/',
  },
  {
    id: 'crafter',
    label: 'WynnCrafter',
    mobileLabel: 'WynnCrafter',
    icon: 'crafter',
    href: '../crafter/',
  },
  {
    id: 'items',
    label: 'WynnAtlas',
    mobileLabel: 'WynnAtlas',
    icon: 'searcher',
    href: '../items/',
  },
  {
    id: 'custom',
    label: 'WynnCustom',
    mobileLabel: 'WynnCustom',
    icon: 'custom',
    href: '../custom/',
  },
  {
    id: 'map',
    label: 'WynnGPS',
    mobileLabel: 'WynnGPS',
    icon: 'compass',
    href: '../map/',
  },
  {
    id: 'wynnfo',
    label: 'Wynnfo',
    mobileLabel: 'WynnFo',
    icon: 'book',
    href: '../wynnfo/',
  },
] as const;

export type MobileNavStyle = 'none' | 'compact' | 'branded';

export interface SidebarOptions {
  /** Highlights this nav entry with href="" on desktop. */
  active?: NavId;
  /** Mobile navbar variant; `none` is sidebar-only. */
  mobile: MobileNavStyle;
  /** Branded mobile header title (defaults from active nav item). */
  mobileTitle?: string;
  /** Branded mobile header icon without extension (defaults from active nav item). */
  mobileIcon?: string;
  /** Extra classes on #main-sidebar (e.g. atlas uses " col"). */
  sidebarExtraClass?: string;
}

const NAV_IDS = new Set<string>(NAV_ITEMS.map((item) => item.id));
const MOBILE_STYLES = new Set<string>(['none', 'compact', 'branded']);
const DIRECTIVE_KEYS = new Set([
  'active',
  'mobile',
  'mobileTitle',
  'mobileIcon',
  'sidebarClass',
]);

function formatContext(context?: string): string {
  return context ? ` in ${context}` : '';
}

/** Parse `<!-- @sidebar active=builder mobile=branded -->` attribute string. */
export function parseSidebarDirective(attrs: string, context?: string): SidebarOptions {
  const options: SidebarOptions = { mobile: 'none' };
  const re = /(\w+)(?:="([^"]*)"|=(\S+))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrs.trim())) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? '';
    if (!DIRECTIVE_KEYS.has(key)) {
      console.warn(`Unknown @sidebar attribute "${key}"${formatContext(context)}`);
      continue;
    }
    switch (key) {
      case 'active':
        if (!NAV_IDS.has(value)) {
          throw new Error(
            `Invalid @sidebar active="${value}"${formatContext(context)}; expected one of: ${[...NAV_IDS].join(', ')}`,
          );
        }
        options.active = value as NavId;
        break;
      case 'mobile':
        if (!MOBILE_STYLES.has(value)) {
          throw new Error(
            `Invalid @sidebar mobile="${value}"${formatContext(context)}; expected one of: ${[...MOBILE_STYLES].join(', ')}`,
          );
        }
        options.mobile = value as MobileNavStyle;
        break;
      case 'mobileTitle':
        options.mobileTitle = value;
        break;
      case 'mobileIcon':
        options.mobileIcon = value;
        break;
      case 'sidebarClass':
        options.sidebarExtraClass = value ? ` ${value}` : '';
        break;
    }
  }
  return options;
}
