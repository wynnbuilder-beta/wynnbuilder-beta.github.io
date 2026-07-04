import { expandItem } from '@/build_utils';
import { displayExpandedItem } from '@/display';
import { item_loader, items, load_major_id_data, WYNN_VERSION_LATEST, wynn_version_names } from '@/load_item';
import { apply_weapon_powders } from '@/powders';
import { itemQueryProps, queryFuncs } from '@/query';
import { ExprParser } from '@/expr_parser';
import { configureAdvSearch, init_items_adv } from '@/search_adv';
import type { ItemStatMap } from '@/types/item';

const getQueryIdentifiers = (function () {
  let identCache: string[] | null = null;
  return function (): string[] {
    if (identCache === null) {
      const idents = new Set<string>();
      for (const ident of Object.keys(itemQueryProps)) {
        idents.add(ident);
      }
      for (const ident of Object.keys(queryFuncs)) {
        idents.add(ident);
      }
      identCache = [...idents].sort();
    }
    return identCache;
  };
})();

function generateEntries(size: number, itemList: HTMLElement, itemEntries: HTMLElement[]): void {
  for (let i = 0; i < size; i++) {
    const itemElem = document.createElement('div');
    itemElem.classList.add('col-lg-3', 'col-sm-auto', 'p-2');
    itemList.append(itemElem);
    itemEntries.push(itemElem);

    const itemElemContained = document.createElement('div');
    itemElemContained.classList.add('dark-7', 'rounded', 'px-2', 'col-auto');
    itemElemContained.setAttribute('id', `item-entry-${i}`);
    itemElem.appendChild(itemElemContained);

    const sortKeyListContainer = document.createElement('div');
    sortKeyListContainer.classList.add('row');
    sortKeyListContainer.setAttribute('id', `item-sort-entry-${i}`);
    itemEntries[i].append(sortKeyListContainer);
  }
}

function display(itemExp: Map<string, unknown>, id: string): void {
  itemExp.set('powders', []);
  if (itemExp.get('category') === 'weapon') {
    apply_weapon_powders(itemExp as Parameters<typeof apply_weapon_powders>[0]);
  }
  displayExpandedItem(itemExp, id);
}

configureAdvSearch({
  loadData: () => ({
    db: (items as ItemStatMap[]).filter((i) => !i.remapID).map((i) => [i, expandItem(i)]),
    parser: new ExprParser(itemQueryProps, queryFuncs),
  }),
  display,
  generateEntries,
  getQueryIdentifiers,
});

void (async function () {
  await item_loader.load_init();
  await load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST]);
  init_items_adv();
})();

;
