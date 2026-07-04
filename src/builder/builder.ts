import { damageClasses, skp_order } from '@/build_utils';
import { initItemHoverPopups } from '@/display';
import { elem_colors } from '@/display_constants';
import Macy from 'macy';
import { itemLists, itemMap } from '@/load_item';
import { tomeLists, tomeMap } from '@/load_tome';
import { powderSpecialStats } from '@/powders';
import { collapse_element, gen_slider_labeled, hardReload, setValue } from '@/utils';
import { decodeHash, decodeHashLegacy, encodeBuildLegacy, player_build } from './build_encode_decode';
import { wireBuilderEvents } from '@/builder/events';
import { create_autocomplete } from './autocomplete';
import {
  equipment_inputs,
  equipment_keys,
  initEditableHighlightListeners,
  powder_inputs,
  tome_keys,
  tomeInputs,
  weapon_keys,
} from './builder_constants';
import {
  armor_powder_node,
  boosts_node,
  builder_graph_init,
  damageMultipliers,
  edit_input_nodes,
  equip_inputs,
  item_final_nodes,
  powder_nodes,
  powder_special_input,
  specialNames,
} from './builder_graph';

export function populateBuildList(): void {
  const buildList = document.getElementById('build-choice')!;
  const savedBuilds =
    window.localStorage.getItem('builds') === null
      ? {}
      : JSON.parse(window.localStorage.getItem('builds')!);

  for (const buildName of Object.keys(savedBuilds).sort()) {
    const buildOption = document.createElement('option');
    buildOption.setAttribute('value', buildName);
    buildList.appendChild(buildOption);
  }
}

export function saveBuild(): void {
  if (player_build) {
    const savedBuilds =
      window.localStorage.getItem('builds') === null
        ? {}
        : JSON.parse(window.localStorage.getItem('builds')!);
    const saveName = (document.getElementById('build-name') as HTMLInputElement).value;
    // Legacy local-save API only passed the build object in the old script bundle.
    const encodedBuild =
      (encodeBuildLegacy as (build: typeof player_build) => string | undefined)(player_build) ?? '';
    if (
      (!Object.keys(savedBuilds).includes(saveName) ||
        document.getElementById('saved-error')!.textContent !== '') &&
      encodedBuild !== ''
    ) {
      savedBuilds[saveName] = encodedBuild.replace('#', '');
      window.localStorage.setItem('builds', JSON.stringify(savedBuilds));

      document.getElementById('saved-error')!.textContent = '';
      document.getElementById('saved-build')!.textContent = 'Build saved locally';

      const buildList = document.getElementById('build-choice')!;
      const buildOption = document.createElement('option');
      buildOption.setAttribute('value', saveName);
      buildList.appendChild(buildOption);
    } else {
      document.getElementById('saved-build')!.textContent = '';
      if (encodedBuild === '') {
        document.getElementById('saved-error')!.textContent = 'Empty build';
      } else {
        document.getElementById('saved-error')!.textContent = 'Exists. Overwrite?';
      }
    }
  }
}

export async function loadBuild(): Promise<void> {
  const savedBuilds =
    window.localStorage.getItem('builds') === null
      ? {}
      : JSON.parse(window.localStorage.getItem('builds')!);
  const saveName = (document.getElementById('build-name') as HTMLInputElement).value;

  if (Object.keys(savedBuilds).includes(saveName)) {
    await decodeHashLegacy(savedBuilds[saveName]);
    document.getElementById('loaded-error')!.textContent = '';
    document.getElementById('loaded-build')!.textContent = 'Build loaded';
  } else {
    document.getElementById('loaded-build')!.textContent = '';
    document.getElementById('loaded-error')!.textContent = "Build doesn't exist";
  }
}

export function resetFields(): void {
  for (const i of powder_inputs) {
    setValue(i, '');
  }
  for (const i of equipment_inputs) {
    setValue(i, '');
  }
  for (const i of tomeInputs) {
    setValue(i, '');
  }
  setValue('str-skp', '0');
  setValue('dex-skp', '0');
  setValue('int-skp', '0');
  setValue('def-skp', '0');
  setValue('agi-skp', '0');
  for (const special_name of specialNames) {
    for (let i = 1; i < 6; i++) {
      const elem = document.getElementById(special_name.replace(' ', '_') + '-' + i)!;
      if (elem.classList.contains('toggleOn')) {
        elem.classList.remove('toggleOn');
      }
    }
  }
  for (const [key] of damageMultipliers) {
    const elem = document.getElementById(key + '-boost')!;
    if (elem.classList.contains('toggleOn')) {
      elem.classList.remove('toggleOn');
    }
  }
  for (const elem of skp_order) {
    (document.getElementById(elem + '_boost_armor') as HTMLInputElement).value = '0';
    document.getElementById(elem + '_boost_armor')!.style.background =
      `linear-gradient(to right, #AAAAAA, #AAAAAA 0%, #AAAAAA 100%)`;
    document.getElementById(elem + '_boost_armor_label')!.textContent =
      `% ${damageClasses[skp_order.indexOf(elem) + 1]} Damage Boost: 0`;
  }

  const nodes_to_reset = equip_inputs
    .concat(powder_nodes)
    .concat(edit_input_nodes)
    .concat([powder_special_input, boosts_node, armor_powder_node]);
  for (const node of nodes_to_reset) {
    node.mark_dirty();
  }

  for (const node of nodes_to_reset) {
    node.update();
  }

  setValue('level-choice', '121');
  location.hash = '';
}

export function toggleID(): void {
  const button = document.getElementById('show-id-button')!;
  const targetDiv = document.getElementById('id-edit')!;
  if (button.classList.contains('toggleOn')) {
    targetDiv.style.display = 'none';
    button.classList.remove('toggleOn');
  } else {
    targetDiv.style.display = 'block';
    button.classList.add('toggleOn');
  }
}

function add_tome_autocomplete(tome_type: string): void {
  const tome_arr: string[] = [];
  const tome_aliases = new Map<string, string>();
  for (const tome_name of tomeLists.get(tome_type.replace(/[0-9]/g, ''))!) {
    const tome_obj = tomeMap.get(tome_name)!;
    if (tome_obj['restrict'] && tome_obj['restrict'] === 'DEPRECATED') {
      continue;
    }
    if (tome_obj['name'].includes('No ' + tome_type.charAt(0).toUpperCase())) {
      continue;
    }
    const tome_alias = tome_obj['alias'] as string | undefined;
    tome_arr.push(tome_name);
    if (tome_alias && tome_alias !== 'NO_ALIAS') {
      tome_arr.push(tome_alias);
      tome_aliases.set(tome_alias, tome_name);
    }
  }

  create_autocomplete(tome_arr, tomeMap as Map<string, { tier: string }>, tome_type, (v) => {
    if (tome_aliases.has(v)) {
      v = tome_aliases.get(v)!;
    }
    return v;
  });
}

function add_item_autocomplete(item_type: string): void {
  const item_arr: string[] = [];
  if (item_type == 'weapon') {
    for (const weaponType of weapon_keys) {
      for (const weapon of itemLists.get(weaponType)!) {
        const item_obj = itemMap.get(weapon)!;
        if (item_obj['restrict'] && item_obj['restrict'] === 'DEPRECATED') {
          continue;
        }
        if (item_obj['name'] == 'No ' + item_type.charAt(0).toUpperCase() + item_type.slice(1)) {
          continue;
        }
        item_arr.push(weapon);
      }
    }
  } else {
    for (const item of itemLists.get(item_type.replace(/[0-9]/g, ''))!) {
      const item_obj = itemMap.get(item)!;
      if (item_obj['restrict'] && item_obj['restrict'] === 'DEPRECATED') {
        continue;
      }
      if (item_obj['name'] == 'No ' + item_type.charAt(0).toUpperCase() + item_type.slice(1)) {
        continue;
      }
      item_arr.push(item);
    }
  }

  create_autocomplete(item_arr, itemMap as Map<string, { tier: string }>, item_type, (v) => v);
}

function init_autocomplete(): void {
  for (const eq of equipment_keys) {
    add_item_autocomplete(eq);
  }
  for (const eq of tome_keys) {
    add_tome_autocomplete(eq);
  }
}

async function init(): Promise<void> {
  console.log('builder.js init');

  initEditableHighlightListeners();

  for (const eq of equipment_keys) {
    document.querySelector('#' + eq + '-tooltip')!.addEventListener('click', () => collapse_element('#' + eq + '-tooltip'));
  }
  initItemHoverPopups(equipment_keys);
  for (let i = 0; i < 5; ++i) {
    const powder_special = powderSpecialStats[i];
    const elem_name = damageClasses[i + 1];
    const skp_name = skp_order[i];
    const boost_parent = document.getElementById(skp_name + '-boost')!;
    const slider_id = skp_name + '_boost_armor';
    const label_name = '% ' + elem_name + ' Dmg Boost';
    const slider_container = gen_slider_labeled({
      label_name: label_name,
      max: powder_special.cap,
      id: slider_id,
      color: elem_colors[i],
    });
    boost_parent.appendChild(slider_container);
    document.getElementById(slider_id)!.addEventListener('change', () => armor_powder_node.mark_dirty().update());
  }

  try {
    Macy({
      container: '#masonry-container',
      columns: 1,
      mobileFirst: true,
      breakAt: {
        1200: 4,
      },
      margin: {
        x: 20,
        y: 20,
      },
    });

    Macy({
      container: '#search-results',
      columns: 1,
      mobileFirst: true,
      breakAt: {
        1200: 4,
      },
      margin: {
        x: 20,
        y: 20,
      },
    });
  } catch (e) {
    console.log('Could not initialize macy components. Maybe you are offline?');
    console.log(e);
  }
  const skillpoints = await decodeHash();

  try {
    init_autocomplete();
  } catch (e) {
    console.log('Could not initialize autocomplete. Maybe you are offline?');
    console.log(e);
  }
  builder_graph_init(skillpoints);
  for (const item_node of item_final_nodes) {
    if (item_node.get_value() === null) {
      if (
        confirm(
          'One or more items failed to load correctly. This could be due to a corrupted build link, or (more likely) a database load failure. Would you like to reload?',
        )
      ) {
        hardReload();
      }
      break;
    }
  }
  wireBuilderEvents();
}

window.onerror = function (message, _source, _lineno, _colno, error) {
  document.getElementById('err-box')!.textContent = String(message);
  document.getElementById('stack-box')!.textContent = error?.stack ?? '';
};

void (async function () {
  await init();
})();
