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

function displayAllSetBonuses(parent_id: string, set_name: unknown): void {
  const setValue = sets.get(set_name as string);
  if (setValue) {
    displayExpandedSet(
      set_name as string,
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
  try {
    item = expandItem(itemMap.get(item_url_tag.replace(/%20/g, ' '))!);
    item.set('powders', []);
    if (item.get('category') === 'weapon') {
      apply_weapon_powders(item);
    }
    displayExpandedItem(item, 'item-view');
    displayAdditionalInfo('additional-info', item);
    displayIDCosts('identification-costs', item);
    if (item.get('set') && sets.get(item.get('set') as string)) {
      displayAllSetBonuses('set-bonus-info', item.get('set'));
    }
    displayIDProbabilities('identification-probabilities', item, amp_state);
  } catch (error) {
    console.log(error);
    console.log((error as Error).stack);
  }
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

export async function initItemPage(): Promise<void> {
  const latest_ver_name = wynn_version_names[WYNN_VERSION_LATEST];
  const load_promises = [item_loader.load_init(), load_major_id_data(latest_ver_name)];
  await Promise.all(load_promises);
  init_itempage();
}
