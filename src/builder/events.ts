import { copyBuild, player_build, shareBuild } from '@/builder/build_encode_decode';
import {
  getRadianceNode,
  resetEditableIDs,
  update_boosts,
  updatePowderSpecials,
  updateRaidBuffs,
  update_radiance,
} from '@/builder/builder_graph';
import { optimizeStrDex } from '@/builder/optimize';
import { resetFields } from '@/builder/builder';
import { show_tab, toggleButton, toggle_tab } from '@/utils';

const EQUIPMENT_TABS = ['equipment-inputs', 'adjust-id'] as const;
const BOOST_PANEL_TABS = ['ability-boosts', 'powder-specials', 'raid-buffs'] as const;
const ELEM_BOOST_TABS = ['str-boost', 'dex-boost', 'int-boost', 'def-boost', 'agi-boost'] as const;
const RAID_TABS = ['notg', 'nol', 'tcc', 'tna', 'wtp'] as const;
const STATS_TABS = ['detailed-stats', 'summary-stats'] as const;

const SHOW_TAB_BY_ID: Record<string, { target: string; tabs: readonly string[] }> = {
  'equipment-inputs-btn': { target: 'equipment-inputs', tabs: EQUIPMENT_TABS },
  'adjust-id-btn': { target: 'adjust-id', tabs: EQUIPMENT_TABS },
  'ability-boosts-btn': { target: 'ability-boosts', tabs: BOOST_PANEL_TABS },
  'powder-specials-btn': { target: 'powder-specials', tabs: BOOST_PANEL_TABS },
  'raid-buffs-btn': { target: 'raid-buffs', tabs: BOOST_PANEL_TABS },
  'str-boost-btn': { target: 'str-boost', tabs: ELEM_BOOST_TABS },
  'dex-boost-btn': { target: 'dex-boost', tabs: ELEM_BOOST_TABS },
  'int-boost-btn': { target: 'int-boost', tabs: ELEM_BOOST_TABS },
  'def-boost-btn': { target: 'def-boost', tabs: ELEM_BOOST_TABS },
  'agi-boost-btn': { target: 'agi-boost', tabs: ELEM_BOOST_TABS },
  'notg-btn': { target: 'notg', tabs: RAID_TABS },
  'nol-btn': { target: 'nol', tabs: RAID_TABS },
  'tcc-btn': { target: 'tcc', tabs: RAID_TABS },
  'tna-btn': { target: 'tna', tabs: RAID_TABS },
  'wtp-btn': { target: 'wtp', tabs: RAID_TABS },
  'summary-stats-btn': { target: 'summary-stats', tabs: STATS_TABS },
  'detailed-stats-btn': { target: 'detailed-stats', tabs: STATS_TABS },
};

const TOGGLE_TAB_BUTTONS: Record<string, string> = {
  'toggle-tomes': 'tomes-dropdown',
  'toggle-atree': 'atree-dropdown',
  'toggle-aspects': 'aspects-dropdown',
  'edit-ID-button': 'edit_id_tab',
};

const RADIANCE_BOOSTS: Record<string, string> = {
  'radiance-boost': 'radiance',
  'divinehonor-boost': 'divinehonor',
  'shine-boost': 'shine',
};

const POWDER_SPECIAL_PREFIXES = ['Quake', 'Chain_Lightning', 'Curse', 'Courage', 'Wind_Prison'];
const RAID_IDS = ['notg', 'nol', 'tcc', 'tna', 'wtp'];

function isPowderSpecialId(id: string): boolean {
  return POWDER_SPECIAL_PREFIXES.some((prefix) => id.startsWith(`${prefix}-`));
}

function wireShowTabButtons(): void {
  for (const [id, { target, tabs }] of Object.entries(SHOW_TAB_BY_ID)) {
    document.getElementById(id)?.addEventListener('click', () => {
      show_tab(target, [...tabs]);
    });
  }
}

function wireToggleTabButtons(): void {
  for (const [buttonId, tabId] of Object.entries(TOGGLE_TAB_BUTTONS)) {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      toggle_tab(tabId);
      toggleButton(buttonId);
    });
  }
}

function wireBuildActions(): void {
  document.getElementById('reset-button')?.addEventListener('click', resetFields);
  document.getElementById('copy-button')?.addEventListener('click', copyBuild);
  document.getElementById('share-button')?.addEventListener('click', () => shareBuild(player_build));
  document.getElementById('reset-edit-ID-button')?.addEventListener('click', resetEditableIDs);
  document.getElementById('optimize-str-dex-button')?.addEventListener('click', optimizeStrDex);
}

function wireAbilityBoosts(): void {
  document.getElementById('ability-boosts')?.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('.button-boost') as HTMLElement | null;
    if (!btn?.id) return;

    const radianceKey = RADIANCE_BOOSTS[btn.id];
    if (radianceKey) {
      update_radiance(radianceKey);
      return;
    }
    if (btn.id === 'judgement-boost') {
      update_boosts('judgement-boost');
      getRadianceNode().mark_dirty().update();
      return;
    }
    if (btn.id.endsWith('-boost')) {
      update_boosts(btn.id);
    }
  });
}

function wirePowderSpecials(): void {
  for (const tabId of ELEM_BOOST_TABS) {
    document.getElementById(tabId)?.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('.button-boost') as HTMLElement | null;
      if (!btn?.id || !isPowderSpecialId(btn.id)) return;
      updatePowderSpecials(btn.id);
    });
  }
}

function wireRaidBuffs(): void {
  for (const raidId of RAID_IDS) {
    document.getElementById(raidId)?.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('.button-boost') as HTMLElement | null;
      if (!btn?.id) return;

      const tierEl = btn.closest(`[id^="${raidId}-"]`) as HTMLElement | null;
      const match = tierEl?.id.match(/^([a-z]+)-(\d+)$/);
      if (!match) return;

      updateRaidBuffs(match[1], Number(match[2]), btn.id);
    });
  }
}

function wireSearchClose(): void {
  document.querySelector('#search-container .btn-close')?.addEventListener('click', () => {
    const container = document.querySelector('#search-container') as HTMLElement | null;
    if (container) container.style.display = 'none';
  });
}

/** Wire static builder page controls (replaces inline onclick in builder HTML). */
export function wireBuilderEvents(): void {
  wireShowTabButtons();
  wireToggleTabButtons();
  wireBuildActions();
  wireAbilityBoosts();
  wirePowderSpecials();
  wireRaidBuffs();
  wireSearchClose();
}
