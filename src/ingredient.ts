import { expandIngredient } from '@/build_utils';
import { displayExpandedIngredient } from '@/display';
import { displayAdditionalInfo } from '@/item_display';
import { ingMap, ingredient_loader } from '@/load_ing';

const item_url_tag = location.hash.slice(1);

export let item: Map<string, unknown>;

export function init_itempage(): void {
  try {
    item = expandIngredient(ingMap.get(item_url_tag.replace(/%20/g, ' '))!);
    displayExpandedIngredient(item, 'item-view');
    displayAdditionalInfo('additional-info', item);
  } catch (error) {
    console.log(error);
    console.log((error as Error).stack);
  }
}

void (async function () {
  await Promise.resolve(ingredient_loader.load_init());
  init_itempage();
})();

;
