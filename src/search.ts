import { compareLexico } from '@/query';
import { ExprParser } from '@/expr_parser';
import autoComplete from '@tarekraafat/autocomplete.js';
import { make_elem } from '@/utils';
import type { Term } from '@/query';
import type { ExpandedIngredient, Ingredient } from '@/types/ingredient';
import type { ExpandedItem, ItemStatMap } from '@/types/item';

export type SearchRawEntry = ItemStatMap | Ingredient;
export type SearchExpandedEntry = ExpandedItem | ExpandedIngredient;
export type SearchDbEntry = [SearchRawEntry, SearchExpandedEntry];

function asSearchRecord(entry: SearchRawEntry): Record<string, unknown> {
  return entry as Record<string, unknown>;
}

export type ItemSearchResult = {
  item: SearchRawEntry;
  itemExp: SearchExpandedEntry;
  sortKeys: unknown[];
};

export type ItemSearchConfig = {
  mappings: {
    translate: Record<string, string>;
    special: Record<string, string>;
    weaponExpression: Record<string, string>;
    string: Record<string, string>;
  };
  types: Record<string, boolean>;
  searchTiers: Record<string, boolean>;
  itemFilters: string[];
  stringItemFilters: string[];
  initValues: () => void;
  filterTypesTiers: (queries: string[]) => boolean;
  displayResults: (results: ItemSearchResult[]) => void;
  getStringFilterValues: (filterKey: string) => string[];
  getWeaponNames?: () => string[];
};

let searchConfig: ItemSearchConfig | null = null;

function requireSearchConfig(): ItemSearchConfig {
  if (searchConfig === null) {
    throw new Error('configureItemSearch() must be called before using item search');
  }
  return searchConfig;
}

export function configureItemSearch(config: ItemSearchConfig): void {
  searchConfig = config;
  types = config.types;
  search_tiers = config.searchTiers;
  item_filters = config.itemFilters;
  string_item_filters = config.stringItemFilters;
}

interface FilterRow {
  ascending: boolean;
  div: HTMLDivElement;
  input_elem: HTMLInputElement;
  min_elem: HTMLInputElement;
  max_elem: HTMLInputElement;
  counter?: number;
  weapon_elem?: HTMLInputElement | null;
  powder_elem?: HTMLInputElement | null;
  autoComplete?: autoComplete;
}

interface ExcludeRow {
  div: HTMLDivElement;
  input_elem: HTMLInputElement;
  autoComplete?: autoComplete;
}

interface StringFilterRow {
  div: HTMLDivElement;
  input_elem: HTMLInputElement;
  operator_elem: HTMLInputElement;
  value_elem: HTMLInputElement;
  autoComplete?: autoComplete;
}

export let types: Record<string, boolean>;
export let search_tiers: Record<string, boolean>;
const filters: FilterRow[] = [];
const excludes: ExcludeRow[] = [];
const sfilters: StringFilterRow[] = [];
export let item_filters: string[] = [];
export let string_item_filters: string[] = [];
let filter_id_counter = 0;

export let search_db: SearchDbEntry[] = [];
export let expr_parser: ExprParser;

export function setItemSearchData(db: SearchDbEntry[], parser: ExprParser): void {
  search_db = db;
  expr_parser = parser;
}

const operation_mappings: Record<string, string> = {
  Equals: '=',
  'Not Equals': '!=',
  Contains: '?=',
};

function checkBool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error(`Expected boolean, but got ${typeof v}`);
  return v;
}

export function do_item_search(): void {
  const summary = document.getElementById('summary')!;
  summary.style.color = 'red';
  window.scrollTo(0, 0);
  const queries: string[] = [];

  const nameChoice = document.getElementById('item-name-choice') as HTMLInputElement;
  if (nameChoice.value != '') {
    queries.push('f:name?="' + nameChoice.value.trim() + '"');
  }

  if (!requireSearchConfig().filterTypesTiers(queries)) return;

  const { mappings } = requireSearchConfig();
  const { translate: translate_mappings, special: special_mappings, weaponExpression: weapon_expression_mappings, string: string_mappings } = mappings;

  for (const filter of filters) {
    const min = parseInt(filter.min_elem.value);
    const max = parseInt(filter.max_elem.value);
    if (min > max) {
      summary.innerHTML =
        'Error: The minimum of filter ' +
        filter.input_elem.value +
        ' (' +
        min +
        ') is greater than its maximum (' +
        max +
        ')';
      return;
    }
    const zero_in_min_max = (isNaN(min) || min < 0) && (isNaN(max) || max > 0);

    const raw_name = filter.input_elem.value;
    if (raw_name == '') {
      continue;
    }
    let filter_name = translate_mappings[raw_name];
    if (filter_name === undefined) {
      filter_name = special_mappings[raw_name];
      if (filter_name === undefined) {
        filter_name = weapon_expression_mappings[raw_name];
        if (filter_name === undefined) {
          summary.innerHTML = 'Error: The filter "' + filter.input_elem.value + '" is not recognized';
          return;
        } else {
          filter_name = process_weapon_filter(raw_name, filter_name, filter);
        }
      }
      filter_name = '(' + filter_name + ')';
    }

    if (!isNaN(min)) {
      queries.push('f:' + filter_name + '>=' + min);
    }
    if (!isNaN(max)) {
      queries.push('f:' + filter_name + '<=' + max);
    }
    if (zero_in_min_max) {
      queries.push('f:' + filter_name + '!=0');
    }
    queries.push('s:' + (filter.ascending ? '0-' : '') + filter_name);
  }

  for (const sfilter of sfilters) {
    const operator = sfilter.operator_elem.value;
    const value = sfilter.value_elem.value;

    if (operator == '') {
      continue;
    }
    if (operation_mappings[operator] === undefined) {
      summary.innerHTML = 'Error: String Filter operator "' + operator + '" is not recognized.';
      return;
    }

    const filter_name = string_mappings[sfilter.input_elem.value];
    if (filter_name === undefined) {
      summary.innerHTML = 'Error: The filter "' + value + '" is not recognized';
      return;
    }

    queries.push('f:' + filter_name + operation_mappings[operator] + '"' + value + '"');
  }

  for (const exclude of excludes) {
    const raw_name = exclude.input_elem.value;
    if (raw_name == '') {
      continue;
    }
    let filter_name = translate_mappings[raw_name];
    if (filter_name === undefined) {
      filter_name = special_mappings[raw_name];
      if (filter_name === undefined) {
        summary.innerHTML = 'Error: The excluded filter "' + exclude.input_elem.value + '" is not recognized';
        return;
      }
      filter_name = '(' + filter_name + ')';
    }
    queries.push('f:' + filter_name + '=0');
  }

  let filter_query = 'true';
  const sort_queries: string[] = [];
  console.log(queries);
  for (const query of queries) {
    if (query.startsWith('s:')) {
      sort_queries.push(query.slice(2));
    } else if (query.startsWith('f:')) {
      filter_query = filter_query + '&' + query.slice(2);
    }
  }
  document.getElementById('search-results')!.textContent = '';
  const results: ItemSearchResult[] = [];
  try {
    const filter_expr = expr_parser.parse(filter_query) as Term;
    const sort_exprs = sort_queries.map((q) => expr_parser.parse(q) as Term);
    for (let i = 0; i < search_db.length; ++i) {
      const item = search_db[i][0];
      const itemExp = search_db[i][1];
      if (checkBool(filter_expr.resolve(asSearchRecord(item), itemExp))) {
        results.push({
          item: asSearchRecord(item),
          itemExp,
          sortKeys: sort_exprs.map((e) => e.resolve(asSearchRecord(item), itemExp)),
        });
      }
    }
    results.sort((a, b) => {
      return compareLexico(asSearchRecord(a.item), a.sortKeys, asSearchRecord(b.item), b.sortKeys);
    });
  } catch (e) {
    summary.textContent = (e as Error).message;
    return;
  }
  summary.textContent = results.length + ' results:';
  summary.style.color = 'white';
  requireSearchConfig().displayResults(results);
}

export function init_search(): void {
  requireSearchConfig().initValues();

  for (const type of Object.keys(types)) {
    document.getElementById('type-' + type)!.addEventListener('click', function (this: HTMLElement) {
      types[type] = !types[type];
      this.classList.toggle('type-selected');
    });
  }
  document.getElementById('all-types')!.addEventListener('click', function () {
    for (const type of Object.keys(types)) {
      types[type] = true;
      document.getElementById('type-' + type)!.classList.add('type-selected');
    }
  });
  document.getElementById('none-types')!.addEventListener('click', function () {
    for (const type of Object.keys(types)) {
      types[type] = false;
      document.getElementById('type-' + type)!.classList.remove('type-selected');
    }
  });

  for (const tier of Object.keys(search_tiers)) {
    document.getElementById('tier-' + tier)!.addEventListener('click', function (this: HTMLElement) {
      search_tiers[tier] = !search_tiers[tier];
      this.classList.toggle('tier-selected');
    });
  }
  document.getElementById('all-tiers')!.addEventListener('click', function () {
    for (const tier of Object.keys(search_tiers)) {
      search_tiers[tier] = true;
      document.getElementById('tier-' + tier)!.classList.add('tier-selected');
    }
  });
  document.getElementById('none-tiers')!.addEventListener('click', function () {
    for (const tier of Object.keys(search_tiers)) {
      search_tiers[tier] = false;
      document.getElementById('tier-' + tier)!.classList.remove('tier-selected');
    }
  });

  document.getElementById('add-filter')!.addEventListener('click', create_filter);
  document.getElementById('add-exclude')!.addEventListener('click', create_exclude);
  const string_filter = document.getElementById('add-string');
  if (string_filter) {
    string_filter.addEventListener('click', create_filter_string);
  }
  create_filter();
  filters[0].input_elem.value = 'Combat Level';
  init_filter_drag();

  document.getElementById('search-button')?.addEventListener('click', do_item_search);
  document.getElementById('reset-button')?.addEventListener('click', reset_item_search);
}

export function reset_item_search(): void {
  (document.getElementById('item-name-choice') as HTMLInputElement).value = '';
  document.getElementById('all-types')!.click();
  document.getElementById('all-tiers')!.click();
}

export function create_filter(): void {
  const data: FilterRow = { ascending: false } as FilterRow;

  const row = make_elem('div', ['row', 'filter-row'], {}) as HTMLDivElement;
  const col = make_elem('div', ['col'], {}) as HTMLDivElement;
  row.appendChild(col);
  data.div = row;

  const reorder_img = make_elem('img', ['reorder-filter'], {
    src: '../media/icons/3-lines.svg',
    draggable: 'true',
  });
  col.appendChild(reorder_img);

  const filter_input = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'filter-input',
    ],
    { id: 'filter-input-' + filter_id_counter, type: 'text', placeholder: 'Filter' },
  ) as HTMLInputElement;
  filter_id_counter++;
  col.appendChild(filter_input);
  data.input_elem = filter_input;

  const asc_desc = make_elem('div', [], { style: 'cursor: pointer; display: inline-block;' }) as HTMLDivElement;
  asc_desc.appendChild(make_elem('img', ['desc-icon', 'asc-sel'], { src: '../media/icons/triangle.svg' }));
  asc_desc.appendChild(make_elem('img', ['asc-icon'], { src: '../media/icons/triangle.svg' }));
  asc_desc.addEventListener('click', function () {
    data.ascending = !data.ascending;
    asc_desc.children[0].classList.toggle('asc-sel');
    asc_desc.children[1].classList.toggle('asc-sel');
  });
  col.appendChild(asc_desc);
  data.counter = filter_id_counter;

  const min = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-min-input-' + filter_id_counter, type: 'text', placeholder: '-\u221E' },
  ) as HTMLInputElement;
  col.appendChild(min);
  data.min_elem = min;

  const to = make_elem('span', [], { innerHTML: '&nbsp;to&nbsp;' });
  col.appendChild(to);

  const max = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-max-input-' + filter_id_counter, type: 'text', placeholder: '\u221E' },
  ) as HTMLInputElement;
  col.appendChild(max);
  data.max_elem = max;

  const trash = make_elem('img', ['delete-filter'], { src: '../media/icons/trash.svg' });
  trash.addEventListener('click', function () {
    for (const f of filters) {
      console.log(f.input_elem.value);
    }
    filters.splice(Array.from(row.parentElement!.children).indexOf(row) - 1, 1);
    console.log(filters);
    row.remove();
  });
  col.appendChild(trash);

  document
    .getElementById('filter-container')!
    .insertBefore(row, document.getElementById('add-filter')!.parentElement!);
  filters.push(data);
  init_filter_dropdown(data, item_filters);
}

let currently_dragging: FilterRow | null = null;

export function init_filter_drag(): void {
  const container = document.getElementById('filter-container')!;

  container.addEventListener('dragstart', function (e) {
    const path = e.composedPath();
    if ((path[0] as HTMLElement).classList.contains('reorder-filter')) {
      currently_dragging = filters[Array.from((path[3] as HTMLElement).children).indexOf(path[2] as HTMLElement) - 1];
    } else {
      e.preventDefault();
    }
  });

  container.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });

  container.addEventListener('dragleave', function (e) {
    e.preventDefault();
  });

  container.addEventListener('dragend', function (e) {
    e.preventDefault();
    for (const el of document.getElementsByClassName('filter-dragged-over')) {
      el.classList.remove('filter-dragged-over');
    }
    currently_dragging = null;
  });

  container.addEventListener('dragover', function (e) {
    e.preventDefault();
    for (const el of document.getElementsByClassName('filter-dragged-over')) {
      el.classList.remove('filter-dragged-over');
    }
    if (currently_dragging && !e.composedPath().includes(currently_dragging.div)) {
      for (let i = 0; i < e.composedPath().length; i++) {
        const child_classes = (e.composedPath()[i] as HTMLElement).classList;
        if (child_classes && child_classes.contains('filter-row')) {
          child_classes.add('filter-dragged-over');
          break;
        }
      }
    }
  });

  container.addEventListener('drop', function (e) {
    e.preventDefault();
    for (const el of document.getElementsByClassName('filter-dragged-over')) {
      el.classList.remove('filter-dragged-over');
    }
    if (currently_dragging && !e.composedPath().includes(currently_dragging.div)) {
      for (let i = 0; i < e.composedPath().length; i++) {
        const child_classes = (e.composedPath()[i] as HTMLElement).classList;
        if (child_classes && child_classes.contains('filter-row')) {
          const old_index = filters.indexOf(currently_dragging);
          const new_index =
            Array.from((e.composedPath()[i + 1] as HTMLElement).children).indexOf(
              e.composedPath()[i] as HTMLElement,
            ) - 1;
          filters.splice(old_index, 1);
          filters.splice(new_index, 0, currently_dragging);
          currently_dragging.div.remove();
          container.insertBefore(currently_dragging.div, container.children[new_index + 1]);
          break;
        }
      }
    }
    currently_dragging = null;
  });
}

export function create_exclude(): void {
  const data: ExcludeRow = {} as ExcludeRow;

  const row = make_elem('div', ['row', 'filter-row'], {}) as HTMLDivElement;
  const col = make_elem('div', ['col'], {}) as HTMLDivElement;
  row.appendChild(col);
  data.div = row;

  const filter_input = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'filter-input',
    ],
    { id: 'filter-input-' + filter_id_counter, type: 'text', placeholder: 'Excluded Filter' },
  ) as HTMLInputElement;
  filter_id_counter++;
  col.appendChild(filter_input);
  data.input_elem = filter_input;

  const trash = make_elem('img', ['delete-filter'], { src: '../media/icons/trash.svg' });
  trash.addEventListener('click', function () {
    excludes.splice(Array.from(row.parentElement!.children).indexOf(row) - 1, 1);
    row.remove();
  });
  col.appendChild(trash);

  document
    .getElementById('exclude-container')!
    .insertBefore(row, document.getElementById('add-exclude')!.parentElement!);
  excludes.push(data);
  init_filter_dropdown(data, item_filters);
}

export function create_filter_string(): void {
  const data: StringFilterRow = {} as StringFilterRow;

  const row = make_elem('div', ['row', 'filter-row'], {}) as HTMLDivElement;
  const col = make_elem('div', ['col'], {}) as HTMLDivElement;
  const row_2 = make_elem('div', ['row'], {}) as HTMLDivElement;
  row.appendChild(col);
  row.appendChild(row_2);
  data.div = row;

  const filter_input = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'filter-input',
    ],
    { id: 'filter-input-' + filter_id_counter, type: 'text', placeholder: 'String Filter' },
  ) as HTMLInputElement;
  filter_input.style.marginLeft = '0';
  filter_id_counter++;
  col.appendChild(filter_input);
  data.input_elem = filter_input;

  const trash = make_elem('img', ['delete-filter'], { src: '../media/icons/trash.svg' });
  trash.addEventListener('click', function () {
    for (const f of sfilters) {
      console.log(f.input_elem.value);
    }
    sfilters.splice(Array.from(row.parentElement!.children).indexOf(row) - 1, 1);
    console.log(sfilters);
    row.remove();
  });
  col.appendChild(trash);

  const operator = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-min-input-' + filter_id_counter, type: 'text', placeholder: 'Operator' },
  ) as HTMLInputElement;
  operator.style.marginLeft = '25px';
  row_2.appendChild(operator);
  data.operator_elem = operator;

  const value = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-max-input-' + filter_id_counter, type: 'text', placeholder: 'Value' },
  ) as HTMLInputElement;
  row_2.appendChild(value);
  data.value_elem = value;

  filter_input.addEventListener('input', function (event) {
    update_value_filter((event.target as HTMLInputElement).value, data);
  });

  document
    .getElementById('string-container')!
    .insertBefore(row, document.getElementById('add-string')!.parentElement!);
  sfilters.push(data);
  init_filter_dropdown(data, string_item_filters, true);
  init_string_operator_dropdown(operator);
}

export function init_filter_dropdown(
  filter: FilterRow | ExcludeRow | StringFilterRow,
  input_filters: string[],
  is_string = false,
): void {
  const field_choice = filter.input_elem;
  field_choice.onclick = function () {
    field_choice.dispatchEvent(new Event('input'));
  };
  field_choice.addEventListener('input', function () {
    check_weapon_subfilter(field_choice.value, filter as FilterRow);
  });
  filter.autoComplete = new autoComplete({
    data: {
      src: input_filters,
    },
    threshold: 0,
    selector: '#' + field_choice.id,
    wrapper: false,
    resultsList: {
      maxResults: 100,
      tabSelect: true,
      noResults: true,
      class: 'search-box dark-7 rounded-bottom px-2 fw-bold dark-shadow-sm',
      element: (list: HTMLElement, data: { results: unknown[] }) => {
        const position = field_choice.getBoundingClientRect();
        list.style.top = position.bottom + window.scrollY + 'px';
        list.style.left = position.x + 'px';
        list.style.width = position.width + 'px';
        list.style.maxHeight = position.height * 4 + 'px';
        if (!data.results.length) {
          const message = make_elem('li', ['scaled-font'], { textContent: 'No results found!' });
          list.prepend(message);
        }
      },
    },
    resultItem: {
      class: 'scaled-font search-item',
      selected: 'dark-5',
    },
    events: {
      input: {
        selection: (event: { detail: { selection: { value: string } }; target: HTMLInputElement }) => {
          if (event.detail.selection.value) {
            event.target.value = event.detail.selection.value;
            if (is_string) {
              update_value_filter(event.detail.selection.value, filter as StringFilterRow);
            } else {
              check_weapon_subfilter(field_choice.value, filter as FilterRow);
            }
          }
        },
      },
    },
  });
}

export function init_string_operator_dropdown(filter: HTMLInputElement): void {
  filter.onclick = function () {
    filter.dispatchEvent(new Event('input'));
  };
  (filter as HTMLInputElement & { autoComplete?: autoComplete }).autoComplete = new autoComplete({
    data: {
      src: Object.keys(operation_mappings),
    },
    threshold: 0,
    selector: '#' + filter.id,
    wrapper: false,
    resultsList: {
      maxResults: 100,
      tabSelect: true,
      noResults: true,
      class: 'search-box dark-7 rounded-bottom px-2 fw-bold dark-shadow-sm',
      element: (list: HTMLElement, data: { results: unknown[] }) => {
        const position = filter.getBoundingClientRect();
        list.style.top = position.bottom + window.scrollY + 'px';
        list.style.left = position.x + 'px';
        list.style.width = position.width + 'px';
        list.style.maxHeight = position.height * 4 + 'px';
        if (!data.results.length) {
          const message = make_elem('li', ['scaled-font'], { textContent: 'No results found!' });
          list.prepend(message);
        }
      },
    },
    resultItem: {
      class: 'scaled-font search-item',
      selected: 'dark-5',
    },
    events: {
      input: {
        selection: (event: { detail: { selection: { value: string } }; target: HTMLInputElement }) => {
          if (event.detail.selection.value) {
            event.target.value = event.detail.selection.value;
          }
        },
      },
    },
  });
}

export function init_string_options_dropdown(filter: HTMLInputElement, value_filter: string[]): void {
  filter.onclick = function () {
    filter.dispatchEvent(new Event('input'));
  };
  const filterWithAc = filter as HTMLInputElement & { autoComplete?: autoComplete };
  console.log(filterWithAc.autoComplete);
  if (filterWithAc.autoComplete) {
    filterWithAc.autoComplete.data = { src: value_filter };
  } else {
    filterWithAc.autoComplete = new autoComplete({
      data: {
        src: value_filter,
      },
      threshold: 0,
      selector: '#' + filter.id,
      wrapper: false,
      resultsList: {
        maxResults: 100,
        tabSelect: true,
        noResults: true,
        class: 'search-box dark-7 rounded-bottom px-2 fw-bold dark-shadow-sm',
        element: (list: HTMLElement, data: { results: unknown[] }) => {
          const position = filter.getBoundingClientRect();
          list.style.top = position.bottom + window.scrollY + 'px';
          list.style.left = position.x + 'px';
          list.style.width = position.width + 'px';
          list.style.maxHeight = position.height * 4 + 'px';
          if (!data.results.length) {
            const message = make_elem('li', ['scaled-font'], { textContent: 'No results found!' });
            list.prepend(message);
          }
        },
      },
      resultItem: {
        class: 'scaled-font search-item',
        selected: 'dark-5',
      },
      events: {
        input: {
          selection: (event: { detail: { selection: { value: string } }; target: HTMLInputElement }) => {
            if (event.detail.selection.value) {
              event.target.value = event.detail.selection.value;
            }
          },
        },
      },
    });
  }
}

export function update_value_filter(input: string, filter: StringFilterRow): void {
  const filter_name = requireSearchConfig().mappings.string[input];
  if (filter_name === undefined) {
    return;
  }

  const value_filter = requireSearchConfig().getStringFilterValues(filter_name);
  init_string_options_dropdown(filter.value_elem, value_filter);
}

export function check_weapon_subfilter(input: string, filter: FilterRow): void {
  const filter_name = requireSearchConfig().mappings.weaponExpression[input];

  if (filter_name === undefined) {
    if (filter.weapon_elem && filter.powder_elem) {
      filter.weapon_elem.remove();
      filter.powder_elem.remove();
      filter.weapon_elem = null;
      filter.powder_elem = null;
    }
    return;
  }

  if (filter.weapon_elem && filter.powder_elem) {
    return;
  }

  const row_2 = make_elem('div', ['row'], {}) as HTMLDivElement;
  row_2.style.marginLeft = '25px';
  filter.div.appendChild(row_2);

  const weapon_selection = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-weapon-input-' + filter.counter, type: 'text', placeholder: 'Weapon' },
  ) as HTMLInputElement;
  weapon_selection.style.marginLeft = '25px';
  row_2.appendChild(weapon_selection);
  filter.weapon_elem = weapon_selection;

  const powder_selection = make_elem(
    'input',
    [
      'col',
      'border-dark',
      'text-light',
      'dark-5',
      'rounded',
      'scaled-font',
      'form-control',
      'form-control-sm',
      'min-max-input',
    ],
    { id: 'filter-powder-input-' + filter.counter, type: 'text', placeholder: 'Powders' },
  ) as HTMLInputElement;
  row_2.appendChild(powder_selection);
  filter.powder_elem = powder_selection;

  const weapons = requireSearchConfig().getWeaponNames?.() ?? [];
  (weapon_selection as HTMLInputElement & { autoComplete?: autoComplete }).autoComplete = new autoComplete({
    data: {
      src: weapons,
    },
    threshold: 0,
    selector: '#' + weapon_selection.id,
    wrapper: false,
    resultsList: {
      maxResults: 100,
      tabSelect: true,
      noResults: true,
      class: 'search-box dark-7 rounded-bottom px-2 fw-bold dark-shadow-sm',
      element: (list: HTMLElement, data: { results: unknown[] }) => {
        const position = weapon_selection.getBoundingClientRect();
        list.style.top = position.bottom + window.scrollY + 'px';
        list.style.left = position.x + 'px';
        list.style.width = position.width + 'px';
        list.style.maxHeight = position.height * 2 + 'px';

        if (!data.results.length) {
          const message = make_elem('li', ['scaled-font'], { textContent: 'No results found!' });
          list.prepend(message);
        }
      },
    },
    resultItem: {
      class: 'scaled-font search-item',
      selected: 'dark-5',
    },
    events: {
      input: {
        selection: (event: { detail: { selection: { value: string } }; target: HTMLInputElement }) => {
          if (event.detail.selection.value) {
            event.target.value = event.detail.selection.value;
          }
        },
      },
    },
  });
}

export function process_weapon_filter(raw_name: string, filter_name: string, filter: FilterRow): string {
  switch (raw_name) {
    case 'Weapon Spell Damage Bonus': {
      const weapon_choice = filter.weapon_elem!.value;
      const powder_choice = filter.powder_elem!.value;
      return 'weapondmgbonus("' + weapon_choice + '", "' + powder_choice + '", true)';
    }
    case 'Weapon Melee Damage Bonus': {
      const weapon_choice = filter.weapon_elem!.value;
      const powder_choice = filter.powder_elem!.value;
      return 'weapondmgbonus("' + weapon_choice + '", "' + powder_choice + '", false)';
    }
  }
  return filter_name;
}

;
