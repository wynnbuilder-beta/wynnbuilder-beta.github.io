import { expandIngredient } from '@/build_utils';
import { attachGlobals } from '@/lib/attachGlobals';
import { displayExpandedIngredient } from '@/display';
import { ingredient_loader, ings } from '@/load_ing';
import { item_loader, load_major_id_data, WYNN_VERSION_LATEST, wynn_version_names } from '@/load_item';
import { ingredientQueryProps, queryFuncs } from '@/query';
import { ExprParser } from '@/expr_parser';
import { configureAdvSearch, init_items_adv } from '@/search_adv';
import type { Ingredient } from '@/types/ingredient';

const getQueryIdentifiers = (function () {
  let identCache: string[] | null = null;
  return function (): string[] {
    if (identCache === null) {
      const idents = new Set<string>();
      for (const ident of Object.keys(ingredientQueryProps)) {
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
    itemElem.classList.add('col-lg-3', 'col-sm-6', 'p-2', 'ing-stats');
    itemList.append(itemElem);
    itemEntries.push(itemElem);

    const itemElemContained = document.createElement('div');
    itemElemContained.classList.add(
      'dark-7',
      'rounded',
      'p-3',
      'col-auto',
      'g-0',
      'border',
      'border-dark',
      'dark-shadow',
    );
    itemElemContained.setAttribute('id', `item-entry-${i}`);
    itemElem.appendChild(itemElemContained);

    const sortKeyListContainer = document.createElement('div');
    sortKeyListContainer.classList.add('row');
    sortKeyListContainer.setAttribute('id', `item-sort-entry-${i}`);
    itemEntries[i].append(sortKeyListContainer);
  }
}

function display(itemExp: Map<string, unknown>, id: string): void {
  displayExpandedIngredient(itemExp, id);
}

configureAdvSearch({
  loadData: () => {
    const ingList = Array.isArray(ings) ? ings : Object.values(ings as Record<string, Ingredient>);
    return {
      db: ingList
        .filter((i) => !i.remapID)
        .map((i) => [i, expandIngredient(i as Record<string, unknown>)]),
      parser: new ExprParser(ingredientQueryProps, queryFuncs),
    };
  },
  display,
  generateEntries,
  getQueryIdentifiers,
});

void (async function () {
  await ingredient_loader.load_init();
  await item_loader.load_init();
  await load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST]);
  init_items_adv();
})();

attachGlobals({
  getQueryIdentifiers,
  generateEntries,
  display,
});
