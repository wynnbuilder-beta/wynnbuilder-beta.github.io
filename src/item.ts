import { expandItem } from '@/build_utils';
import {
  item_loader,
  itemMap,
  load_major_id_data,
  sets,
  WYNN_VERSION_LATEST,
  wynn_version_names,
} from '@/load_item';
import {
  displayAdditionalInfo,
  displayIDCosts,
  displayIDProbabilities,
} from '@/item_display';
import { displayExpandedItem, displayExpandedSet } from '@/display';
import { apply_weapon_powders } from '@/powders';
import type { ExpandedItem } from '@/types/item';

function displayAllSetBonuses(parent_id: string, set_name: string | null | undefined): void {
  if (!set_name) return;
  const setValue = sets.get(set_name);
  if (setValue) {
    displayExpandedSet(
      set_name,
      setValue,
      parent_id,
      setValue.bonuses.length - 1,
    );
  }
}

const item_url_tag = location.hash.slice(1);

export const ITEM_BUILD_VERSION = '7.0.1';

export let item: ExpandedItem;
export let amp_state = 0;

function init_itempage(): void {
  if (!item_url_tag) {
    throw new Error('No item specified in URL hash (e.g. #Item Name).');
  }
  const itemName = item_url_tag.replace(/%20/g, ' ');
  const rawItem = itemMap.get(itemName);
  if (!rawItem) {
    throw new Error(`Item not found: "${itemName}"`);
  }
  item = expandItem(rawItem);
  item.set('powders', []);
  if (item.get('category') === 'weapon') {
    apply_weapon_powders(item);
  }
  displayExpandedItem(item, 'item-view');
  displayAdditionalInfo('additional-info', item);
  displayIDCosts('identification-costs', item);
  if (item.get('set') && sets.get(item.get('set') as string)) {
    displayAllSetBonuses('set-bonus-info', item.get('set') as string | null | undefined);
  }
  displayIDProbabilities('identification-probabilities', item, amp_state);
}

export function toggleAmps(button_id: number): void {
  amp_state = 0;
  if (button_id == 0) {
    return;
  }
  const button = document.getElementById('cork_amp_' + button_id)!;
  if (!button.classList.contains('toggleOn')) {
    for (const child of document.getElementById('amp_row')!.childNodes) {
      if (child instanceof HTMLButtonElement && child.id !== button.id && child.classList.contains('toggleOn')) {
        child.classList.remove('toggleOn');
      }
    }
    amp_state = button_id;
  }
  displayIDProbabilities('identification-probabilities', item, amp_state);
}

let itemPageInitialized = false;

export async function initItemPage(): Promise<void> {
  if (itemPageInitialized) return;
  itemPageInitialized = true;
  const latest_ver_name = wynn_version_names[WYNN_VERSION_LATEST];
  await Promise.all([item_loader.load_init(), load_major_id_data(latest_ver_name)]);
  init_itempage();
}
