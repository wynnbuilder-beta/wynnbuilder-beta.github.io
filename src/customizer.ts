import {
  attackSpeeds,
  classes,
  expandItem,
  idRound,
  item_types,
  nonRolledIDs,
  reversedIDs,
  reversetranslations,
  rolledIDs,
  tiers,
} from '@/build_utils';
import { decodeCraft } from '@/craft';
import { Custom, decodeCustom, encodeCustom } from '@/custom';
import { idPrefixes } from '@/display_constants';
import { ingredient_loader } from '@/load_ing';
import {
  item_loader,
  itemMap,
  load_major_id_data,
  WYNN_VERSION_LATEST,
  wynn_version_names,
} from '@/load_item';
import { apply_weapon_powders } from '@/powders';
import { Base64, copyTextToClipboard, getValue, make_elem, setValue, toggleButton } from '@/utils';
import { ci_save_order, non_rolled_strings } from '@/custom';
import { displayExpandedItem } from '@/display';
import type { ExpandedItem } from '@/types/item';
import autoComplete from '@/lib/vendor/autocomplete';

let legacy_decode_version = '';
let legacy_decode_fixID = false;
let legacy_decode_tag = '';
let legacy_decode_statMap = new Map<string, unknown>();

const custom_url_base = location.href.split('#')[0];
const custom_url_tag = location.hash.slice(1);

export let player_custom_item: Custom | undefined;
export let player_custom_ing: unknown;
export let base_item: unknown;

let pos_range = [0.3, 1.3];
let neg_range = [1.3, 0.7];

const roll_range_ids = [
  'neg_roll_range-choice-min',
  'neg_roll_range-choice-max',
  'pos_roll_range-choice-min',
  'pos_roll_range-choice-max',
];

let custom_field_id_counter = 0;

interface VarStatRow {
  div: HTMLDivElement;
  input_elem: HTMLInputElement;
  min_elem: HTMLInputElement;
  base_elem: HTMLInputElement;
  max_elem: HTMLInputElement;
  autoComplete?: autoComplete;
}

let var_stats: VarStatRow[] = [];

function create_stat(): VarStatRow {
  const data = {} as VarStatRow;
  const fixIDs = document.getElementById('fixID-choice')!.classList.contains('toggleOn');

  const row = make_elem('div', ['row'], { style: 'padding-bottom: 5px' }) as HTMLDivElement;
  const col = make_elem('div', ['col'], {}) as HTMLDivElement;
  row.appendChild(col);
  data.div = row;

  const row1 = make_elem('div', ['row'], {}) as HTMLDivElement;
  const search_input = make_elem(
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
    { id: 'filter-input-' + custom_field_id_counter, type: 'text', placeholder: 'ID name' },
  ) as HTMLInputElement;
  custom_field_id_counter++;
  row1.appendChild(search_input);
  data.input_elem = search_input;

  const trash = make_elem('img', ['col-2', 'delete-filter'], { src: '../media/icons/trash.svg' }) as HTMLImageElement;
  trash.addEventListener('click', function () {
    var_stats.splice(Array.from(row.parentElement!.children).indexOf(row), 1);
    row.remove();
  });
  row1.appendChild(trash);
  col.appendChild(row1);

  const row2 = make_elem('div', ['row'], {}) as HTMLDivElement;
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
      'number-input',
    ],
    { placeholder: 'Min' },
  ) as HTMLInputElement;
  row2.appendChild(min);
  data.min_elem = min;

  const base = make_elem(
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
      'number-input',
    ],
    { placeholder: 'Base' },
  ) as HTMLInputElement;
  row2.appendChild(base);
  data.base_elem = base;

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
      'number-input',
    ],
    { placeholder: 'Max' },
  ) as HTMLInputElement;
  row2.appendChild(max);
  data.max_elem = max;
  col.append(row2);

  if (fixIDs) {
    min.setAttribute('hidden', '');
    base.setAttribute('hidden', '');
  }

  base.addEventListener('focusout', () => {
    base_to_range(search_input, base, min, max);
  });
  min.addEventListener('focusout', () => {
    range_to_base(search_input, min, 'min', base, max);
  });
  max.addEventListener('focusout', () => {
    range_to_base(search_input, max, 'max', base, min);
  });

  document.getElementById('var-stat-container')!.insertBefore(row, document.getElementById('add-stat')!.parentElement);
  var_stats.push(data);
  init_stat_dropdown(data);
  return data;
}

const var_stats_map = new Map<string, string>();
const var_stats_rev_map = new Map<string, string>();
const var_stats_names: string[] = [];

function init_var_stat_maps(): void {
  for (const id of rolledIDs) {
    if (idPrefixes[id]) {
      const name = idPrefixes[id].split(':')[0];
      var_stats_names.push(name);
      var_stats_map.set(id, name);
      var_stats_rev_map.set(name, id);
    }
  }
}

function init_stat_dropdown(stat_block: VarStatRow): void {
  const field_choice = stat_block.input_elem;
  field_choice.onclick = function () {
    field_choice.dispatchEvent(new Event('input', { bubbles: true }));
  };
  stat_block.autoComplete = new autoComplete({
    data: {
      src: var_stats_names,
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
        selection: (event: CustomEvent<{ selection: { value: string } }>) => {
          if (event.detail.selection.value) {
            (event.target as HTMLInputElement).value = event.detail.selection.value;
          }
        },
      },
    },
  });
}

function init_customizer(): void {
  try {
    init_var_stat_maps();
    decodeCustomFromURL(custom_url_tag);
    populateFields();

    document.getElementById('add-stat')!.addEventListener('click', create_stat);
    if (!custom_url_tag) {
      create_stat();
    }

    for (const id of roll_range_ids) {
      document.getElementById(id)!.addEventListener('focusout', () => {
        changeBaseValues();
      });
    }

    wireCustomEvents();
  } catch (error) {
    console.log(error);
  }
}

/** Wire static HTML controls on the custom item page (replaces inline onclick). */
function wireCustomEvents(): void {
  document.getElementById('reset-roll-range-button')?.addEventListener('click', resetBaseValues);
  document.getElementById('create-button')?.addEventListener('click', calculateCustom);
  document.getElementById('copy-button')?.addEventListener('click', copyCustom);
  document.getElementById('fixID-choice')?.addEventListener('click', () => {
    toggleButton('fixID-choice');
    toggleFixed();
  });
  document.getElementById('reset-button')?.addEventListener('click', resetFields);
  document.getElementById('copy-button-hash')?.addEventListener('click', copyHash);
  document.getElementById('json-button')?.addEventListener('click', saveAsJSON);
  document.getElementById('set-button')?.addEventListener('click', () => useBaseItem('base-input'));
}

export function calculateCustom(): void {
  try {
    for (const i of document.getElementsByClassName('hide-container-block')) {
      (i as HTMLElement).style.display = 'block';
    }
    for (const i of document.getElementsByClassName('hide-container-grid')) {
      (i as HTMLElement).style.display = 'grid';
    }

    const statMap = new Map<string, unknown>();
    statMap.set('minRolls', new Map());
    statMap.set('maxRolls', new Map());

    for (const static_id of nonRolledIDs) {
      const input = document.getElementById(static_id + '-choice') as HTMLInputElement | null;

      if (input === null) {
        continue;
      }

      let val: string | number = input.value;
      if (val === '' && input.placeholder && input.placeholder !== '') {
        val = input.placeholder;
      }

      if (input.classList.contains('number-input')) {
        const numVal = parseInt(String(val), 10);
        if (numVal) {
          statMap.set(static_id, numVal);
        }
      } else if (static_id == 'majorIds') {
        if (val === '') {
          statMap.set(static_id, []);
        } else {
          statMap.set(static_id, [val]);
        }
      } else if (input.classList.contains('string-input')) {
        if (val) {
          statMap.set(static_id, val);
        }
      }
    }
    const fix_id = document.getElementById('fixID-choice')!.classList.contains('toggleOn');
    if (fix_id) {
      statMap.set('fixID', true);
    }
    const minRolls = statMap.get('minRolls') as Map<string, number>;
    const maxRolls = statMap.get('maxRolls') as Map<string, number>;
    for (const stat_box of var_stats) {
      const id = var_stats_rev_map.get(stat_box.input_elem.value);
      if (id === undefined) {
        continue;
      }
      if (fix_id) {
        const val = parseInt(stat_box.max_elem.value, 10);
        minRolls.set(id, val);
        maxRolls.set(id, val);
      } else {
        const min = parseInt(stat_box.min_elem.value, 10);
        const max = parseInt(stat_box.max_elem.value, 10);
        minRolls.set(id, min);
        maxRolls.set(id, max);
      }
    }

    player_custom_item = new Custom(statMap);

    const custom_str = encodeCustom(player_custom_item, true).toB64();
    location.hash = custom_str;
    player_custom_item.setHash(custom_str);

    if (player_custom_item.statMap.get('category') == 'weapon') {
      apply_weapon_powders(player_custom_item.statMap as ExpandedItem);
    }
    displayExpandedItem(player_custom_item.statMap as ExpandedItem, 'custom-stats');
  } catch (error) {
    const msg = (error as Error).stack ?? String(error);
    const lines = msg.split('\n');
    for (const line of lines) {
      console.log(line);
    }
  }
}

function decodeCustomFromURL(urlTag: string): void {
  if (!urlTag) return;
  if (urlTag.slice(0, 3) === 'CI-') {
    location.hash = urlTag.substring(3);
  }

  const custom = decodeCustom({ hash: location.hash.substring(1) });

  const minRolls = custom.statMap.get('minRolls') as Map<string, number>;
  if (custom.statMap.get('fixID') === true) {
    toggleButton('fixID-choice');
  }

  for (const [id, val] of minRolls.entries()) {
    if (['0-0', 0].includes(val)) continue;

    if (rolledIDs.includes(id)) {
      const stat_box = create_stat();
      stat_box.input_elem.value = var_stats_map.get(id)!;
      stat_box.min_elem.value = String(val);
      if (custom.statMap.get('fixID') === true) {
        stat_box.max_elem.value = String(val);
      } else {
        stat_box.max_elem.value = String((custom.statMap.get('maxRolls') as Map<string, number>).get(id));
      }
      continue;
    }
  }

  for (const [id, val] of custom.statMap) {
    if (['', '0-0', 0, []].includes(val as string | number | unknown[])) continue;
    const element = document.getElementById(id + '-choice');
    if (element) {
      setValue(id + '-choice', custom.statMap.get(id));
    }
  }
  toggleFixed();
  calculateCustom();
}

function decodeCustomLegacy(urlTag: string): void {
  if (urlTag) {
    if (urlTag.slice(0, 3) === 'CI-') {
      urlTag = urlTag.substring(3);
      location.hash = location.hash.substring(3);
    }

    if (legacy_decode_version === '1') {
      if (legacy_decode_fixID) {
        legacy_decode_statMap.set('fixId', true);
        toggleButton('fixID-choice');
      }
      while (legacy_decode_tag !== '') {
        const id = ci_save_order[Base64.toInt(legacy_decode_tag.slice(0, 2))];
        let len = Base64.toInt(legacy_decode_tag.slice(2, 4));

        if (rolledIDs.includes(id)) {
          const stat_box = create_stat();
          stat_box.input_elem.value = var_stats_map.get(id)!;
          const sign = parseInt(legacy_decode_tag.slice(4, 5), 10);
          let minRoll = Base64.toInt(legacy_decode_tag.slice(5, 5 + len));
          if (!legacy_decode_fixID) {
            let maxRoll = Base64.toInt(legacy_decode_tag.slice(5 + len, 5 + 2 * len));
            if (sign > 1) {
              maxRoll *= -1;
            }
            if (sign % 2 == 1) {
              minRoll *= -1;
            }
            stat_box.max_elem.value = String(maxRoll);
            stat_box.min_elem.value = String(minRoll);
            (legacy_decode_statMap.get('minRolls') as Map<string, number>).set(id, minRoll);
            (legacy_decode_statMap.get('maxRolls') as Map<string, number>).set(id, maxRoll);
            legacy_decode_tag = legacy_decode_tag.slice(5 + 2 * len);
          } else {
            if (sign != 0) {
              minRoll *= -1;
            }
            stat_box.base_elem.value = String(minRoll);
            (legacy_decode_statMap.get('minRolls') as Map<string, number>).set(id, minRoll);
            (legacy_decode_statMap.get('maxRolls') as Map<string, number>).set(id, minRoll);
            legacy_decode_tag = legacy_decode_tag.slice(5 + len);
          }
        } else {
          let val: unknown;
          if (non_rolled_strings.includes(id)) {
            if (id === 'tier') {
              val = tiers[Base64.toInt(legacy_decode_tag.charAt(2))];
              len = -1;
            } else if (id === 'type') {
              val = item_types[Base64.toInt(legacy_decode_tag.charAt(2))];
              len = -1;
            } else if (id === 'atkSpd') {
              val = attackSpeeds[Base64.toInt(legacy_decode_tag.charAt(2))];
              len = -1;
            } else if (id === 'classReq') {
              val = classes[Base64.toInt(legacy_decode_tag.charAt(2))];
              len = -1;
            } else {
              val = legacy_decode_tag.slice(4, 4 + len).replace(/%20/g, ' ');
            }
            legacy_decode_tag = legacy_decode_tag.slice(4 + len);
          } else {
            const sign = parseInt(legacy_decode_tag.slice(4, 5), 10);
            val = Base64.toInt(legacy_decode_tag.slice(5, 5 + len));
            if (sign == 1) {
              val = (val as number) * -1;
            }
            legacy_decode_tag = legacy_decode_tag.slice(5 + len);
          }
          legacy_decode_statMap.set(id, val);
          setValue(id + '-choice', val);
        }
      }
      toggleFixed();
      legacy_decode_statMap.set('hash', urlTag);
      calculateCustom();
      player_custom_item!.setHash(urlTag);
    }
  }
}

function populateFields(): void {
  const tier_list = document.getElementById('tier-list')!;
  for (const tier of tiers) {
    const el = document.createElement('option');
    el.value = tier;
    tier_list.appendChild(el);
  }
  const type_list = document.getElementById('type-list')!;
  for (const type of item_types) {
    const el = document.createElement('option');
    el.value = type;
    type_list.appendChild(el);
  }
  const atkSpd_list = document.getElementById('atkSpd-list')!;
  for (const atkSpd of attackSpeeds) {
    const el = document.createElement('option');
    el.value = atkSpd;
    atkSpd_list.appendChild(el);
  }
  const class_list = document.getElementById('class-list')!;
  for (const className of classes) {
    const el = document.createElement('option');
    el.value = className;
    class_list.appendChild(el);
  }
  const item_list = document.getElementById('base-list')!;
  for (const name of itemMap.keys()) {
    const el = document.createElement('option');
    el.value = name;
    item_list.appendChild(el);
  }
}

export function toggleFixed(): void {
  const fixedID_bool = document.getElementById('fixID-choice')!.classList.contains('toggleOn');
  for (const stat_box of var_stats) {
    if (fixedID_bool) {
      stat_box.base_elem.setAttribute('hidden', '');
      stat_box.min_elem.setAttribute('hidden', '');
    } else {
      stat_box.base_elem.removeAttribute('hidden');
      stat_box.min_elem.removeAttribute('hidden');
    }
  }
}

export function useBaseItem(elem: string): void {
  const itemName = getValue(elem);
  let baseItem: Map<string, unknown> | undefined;

  const rawItem = itemMap.get(itemName);
  if (rawItem) {
    baseItem = expandItem(rawItem);
  }

  if (!baseItem) {
    switch (itemName.slice(0, 3)) {
      case 'CR-':
        baseItem = decodeCraft({ hash: itemName.substring(3) }).statMap;
        break;
      case 'CI-':
        baseItem = decodeCustom({ hash: itemName.substring(3) }).statMap;
        break;
    }
  }

  if (baseItem) {
    resetFields();

    const fixID_button_toggled = document.getElementById('fixID-choice')!.classList.contains('toggleOn');
    const baseMinRolls = baseItem.get('minRolls') as Map<string, number>;
    const baseMaxRolls = baseItem.get('maxRolls') as Map<string, number>;
    if (baseItem.get('fixID') === true) {
      if (!fixID_button_toggled) toggleButton('fixID-choice');
      for (const id of rolledIDs) {
        if (baseMaxRolls.get(id)) {
          const stat_box = create_stat();
          stat_box.input_elem.value = var_stats_map.get(id)!;
          stat_box.min_elem.value = String(baseMaxRolls.get(id));
          stat_box.max_elem.value = String(baseMaxRolls.get(id));
        }
      }
    } else {
      if (fixID_button_toggled) toggleButton('fixID-choice');
      for (const id of rolledIDs) {
        if (baseMaxRolls.get(id)) {
          const stat_box = create_stat();
          stat_box.input_elem.value = var_stats_map.get(id)!;
          stat_box.min_elem.value = String(baseMinRolls.get(id));
          stat_box.max_elem.value = String(baseMaxRolls.get(id));
        }
      }
    }
    toggleFixed();

    for (const id of nonRolledIDs) {
      if (baseItem.get(id) && document.getElementById(id + '-choice')) {
        setValue(id + '-choice', baseItem.get(id));
      }
    }
    if (baseItem.get('displayName')) {
      setValue('name-choice', baseItem.get('displayName'));
    }

    if (baseItem.get('tier') === 'Crafted') {
      const specialIDs = ['duration', 'durability'];
      setValue('charges-choice', baseItem.get('charges'));
      for (const id of specialIDs) {
        const range = baseItem.get(id) as [number, number];
        setValue(id + '-choice', range[0] + '-' + range[1]);
      }
    }
  }

  calculateCustom();
}

export function copyCustom(): void {
  if (player_custom_item) {
    copyTextToClipboard(custom_url_base + location.hash);
    document.getElementById('copy-button')!.textContent = 'Copied!';
  }
}

export function copyHash(): void {
  if (player_custom_item) {
    const hash = player_custom_item.statMap.get('hash') as string;
    copyTextToClipboard(hash);
    document.getElementById('copy-button-hash')!.textContent = 'Copied!';
  }
}

export function resetFields(): void {
  for (const stat_block of var_stats) {
    stat_block.div.remove();
  }
  var_stats = [];
  const inputs = document.getElementsByTagName('input');
  for (const input of inputs) {
    input.textContent = '';
    input.value = '';
  }

  const elem = document.getElementById('fixID-choice')!;
  if (elem.textContent === 'yes') {
    elem.textContent = 'no';
    elem.classList.remove('toggleOn');
  }
}

export function base_to_range(
  id_elem: HTMLInputElement,
  base_elem: HTMLInputElement,
  min_elem: HTMLInputElement,
  max_elem: HTMLInputElement,
): void {
  const base = parseFloat(base_elem.value);
  const id = var_stats_rev_map.get(id_elem.value);
  if (id === undefined) {
    return;
  }
  if (base) {
    if (base == 0) {
      min_elem.value = '0';
      max_elem.value = '0';
    } else if ((base > 0) != reversedIDs.includes(id)) {
      max_elem.value = String(idRound(pos_range[1] * base));
      min_elem.value = String(idRound(pos_range[0] * base));
    } else {
      max_elem.value = String(idRound(neg_range[1] * base));
      min_elem.value = String(idRound(neg_range[0] * base));
    }
  }
}

export function range_to_base(
  id_elem: HTMLInputElement,
  source: HTMLInputElement,
  mode: string,
  base: HTMLInputElement,
  other: HTMLInputElement,
): void {
  const id = var_stats_rev_map.get(id_elem.value);
  if (id === undefined) {
    return;
  }

  let value: number;
  try {
    value = parseFloat(source.value);
  } catch (error) {
    console.log('Error in range_to_base.');
    console.log(error);
    return;
  }

  let range: number[];
  let op: (val: number) => number;
  if (value == 0) {
    return;
  } else if (value > 0) {
    range = pos_range;
    op = function (val) {
      return Math.max(Math.round(val), 1);
    };
  } else {
    range = neg_range;
    op = function (val) {
      return Math.min(Math.round(val), -1);
    };
  }

  if (reversedIDs.includes(id)) {
    range = [range[1], range[0]];
  }

  if (mode === 'min') {
    if (!base.value) {
      base.value = String(op((1 / range[0]) * value));
    }
    if (!other.value) {
      other.value = String(op((range[1] / range[0]) * value));
    }
  } else if (mode === 'max') {
    if (!base.value) {
      base.value = String(op((1 / range[1]) * value));
    }
    if (!other.value) {
      other.value = String(op((range[0] / range[1]) * value));
    }
  }
}

export function changeBaseValues(): void {
  for (const id of roll_range_ids) {
    if (getValue(id)) {
      if (id.includes('neg')) {
        if (id.includes('min')) {
          neg_range[0] = parseFloat(getValue(id));
        } else {
          neg_range[1] = parseFloat(getValue(id));
        }
      } else {
        if (id.includes('min')) {
          pos_range[0] = parseFloat(getValue(id));
        } else {
          pos_range[1] = parseFloat(getValue(id));
        }
      }
    }
  }
  for (const identification of rolledIDs) {
    if (document.getElementById(identification)) {
      base_to_range(
        document.getElementById(identification) as HTMLInputElement,
        document.getElementById(identification) as HTMLInputElement,
        document.getElementById(identification) as HTMLInputElement,
        document.getElementById(identification) as HTMLInputElement,
      );
    }
  }
}

export function resetBaseValues(): void {
  pos_range = [0.3, 1.3];
  neg_range = [1.3, 0.7];
  for (const id of roll_range_ids) {
    setValue(id, '');
  }
}

export function saveAsJSON(): void {
  const CI: Record<string, unknown> = {};
  for (const [id, val] of player_custom_item!.statMap) {
    const skipIds = [
      'minRolls',
      'maxRolls',
      'skillpoints',
      'reqs',
      'custom',
      'crafted',
      'restrict',
      'hash',
      'nDam_',
      'tDam_',
      'eDam_',
      'wDam_',
      'fDam_',
      'aDam_',
      'powders',
      'durability',
      'duration',
    ];
    if (skipIds.includes(id)) {
      continue;
    } else {
      val ? (CI[reversetranslations.get(id) ? reversetranslations.get(id)! : id] = val) : '';
    }
  }
  let is_fixid = true;
  if (player_custom_item!.statMap.get('minRolls')) {
    for (const [id, min] of player_custom_item!.statMap.get('minRolls') as Map<string, number>) {
      let max = (player_custom_item!.statMap.get('maxRolls') as Map<string, number>).get(id)!;
      if (min && max) {
        let tmp = Math.min(min, max);
        max = Math.max(min, max);
        const minVal = tmp;
        if (minVal != max) {
          is_fixid = false;
        }
        const base = full_range_to_base(minVal, max);
        if (base === null) {
          CI[reversetranslations.get(id) ? reversetranslations.get(id)! : id] = [minVal, max];
        } else if (base) {
          CI[reversetranslations.get(id) ? reversetranslations.get(id)! : id] = base;
        } else {
          console.log('CONVERSION ERROR: ' + id);
        }
      }
    }
  }
  CI['identified'] = is_fixid;

  console.log(JSON.stringify(CI, null, 0));
  copyTextToClipboard(JSON.stringify(CI, null, 0));
  document.getElementById('json-button')!.textContent = 'Copied!';
}

function full_range_to_base(min: number, max: number): number | null {
  function checkBase(b: number, minVal: number, maxVal: number): boolean {
    if (b > 0) {
      return Math.round(pos_range[0] * b) == minVal && Math.round(pos_range[1] * b) == maxVal;
    } else {
      return Math.round(neg_range[0] * b) == minVal && Math.round(neg_range[1] * b) == maxVal;
    }
  }
  if (min && max && min / max < 0) {
    return null;
  } else if (min == max) {
    return min;
  } else {
    if (min < 0) {
      const minPossible = (max - 0.5) / neg_range[1];
      const maxPossible = (max + 0.5) / neg_range[1];
      for (let i = Math.floor(minPossible); i < Math.ceil(maxPossible); i++) {
        if (checkBase(i, min, max)) {
          return i;
        }
      }
    } else {
      const minPossible = (max - 0.5) / pos_range[1];
      const maxPossible = (max + 0.5) / pos_range[1];
      for (let i = Math.floor(minPossible); i < Math.ceil(maxPossible); i++) {
        if (checkBase(i, min, max)) {
          return i;
        }
      }

      return null;
    }
  }
  return null;
}

let customPageInitialized = false;

export async function initCustomPage(): Promise<void> {
  if (customPageInitialized) return;
  customPageInitialized = true;
  await Promise.all([
    ingredient_loader.load_init(),
    item_loader.load_init(),
    load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST]),
  ]);
  init_customizer();
}
