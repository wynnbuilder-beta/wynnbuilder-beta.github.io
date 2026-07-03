import { attachGlobals } from '@/lib/attachGlobals';
import { expandItem } from '@/build_utils';
import { displayExpandedItem } from '@/display';
import { ExprParser } from '@/expr_parser';
import { item_loader, items, load_major_id_data, WYNN_VERSION_LATEST, wynn_version_names } from '@/load_item';
import { apply_weapon_powders } from '@/powders';
import { itemQueryProps, queryFuncs } from '@/query';
import { configureItemSearch, init_search, setItemSearchData } from '@/search';
import { make_elem } from '@/utils';
import type { ExpandedItem } from '@/types/item';

const types: Record<string, boolean> = {
  bow: false,
  spear: false,
  wand: false,
  dagger: false,
  relik: false,
  helmet: false,
  chestplate: false,
  leggings: false,
  boots: false,
  ring: false,
  bracelet: false,
  necklace: false,
};

const search_tiers: Record<string, boolean> = {
  normal: true,
  unique: true,
  rare: true,
  legendary: true,
  fabled: true,
  mythic: true,
};

export const translate_mappings: Record<string, string> = {
  'Powder Slots': 'slots',
  Health: 'hp',
  'Raw Fire Defense': 'fDef',
  'Raw Water Defense': 'wDef',
  'Raw Air Defense': 'aDef',
  'Raw Thunder Defense': 'tDef',
  'Raw Earth Defense': 'eDef',
  'Combat Level': 'lvl',
  'Req Strength': 'strReq',
  'Req Dexterity': 'dexReq',
  'Req Intelligence': 'intReq',
  'Req Agility': 'agiReq',
  'Req Defense': 'defReq',
  'Health Regen %': 'hprPct',
  'Mana Regen': 'mr',
  'Spell Damage %': 'sdPct',
  'Melee Damage %': 'mdPct',
  'Life Steal': 'ls',
  'Mana Steal': 'ms',
  'XP Bonus': 'xpb',
  'Loot Bonus': 'lb',
  Reflection: 'ref',
  Strength: 'str',
  Dexterity: 'dex',
  Intelligence: 'int',
  Agility: 'agi',
  Defense: 'def',
  Thorns: 'thorns',
  Exploding: 'expd',
  'Walk Speed': 'spd',
  'Attack Speed Bonus': 'atkTier',
  Poison: 'poison',
  'Health Bonus': 'hpBonus',
  'Soul Point Regen': 'spRegen',
  Stealing: 'eSteal',
  'Raw Health Regen': 'hprRaw',
  'Spell Damage Raw': 'sdRaw',
  'Elem. Spell Damage Raw': 'rSdRaw',
  'Neut. Spell Damage Raw': 'nSdRaw',
  'Earth Spell Damage Raw': 'eSdRaw',
  'Thunder Spell Damage Raw': 'tSdRaw',
  'Water Spell Damage Raw': 'wSdRaw',
  'Fire Spell Damage Raw': 'fSdRaw',
  'Air Spell Damage Raw': 'aSdRaw',
  'Elem. Spell Damage %': 'rSdPct',
  'Neut. Spell Damage %': 'nSdPct',
  'Earth Spell Damage %': 'eSdPct',
  'Thunder Spell Damage %': 'tSdPct',
  'Water Spell Damage %': 'wSdPct',
  'Fire Spell Damage %': 'fSdPct',
  'Air Spell Damage %': 'aSdPct',
  'Melee Damage Raw': 'mdRaw',
  'Elem. Melee Damage Raw': 'rMdRaw',
  'Neut. Melee Damage Raw': 'nMdRaw',
  'Earth Melee Damage Raw': 'eMdRaw',
  'Thunder Melee Damage Raw': 'tMdRaw',
  'Water Melee Damage Raw': 'wMdRaw',
  'Fire Melee Damage Raw': 'fMdRaw',
  'Air Melee Damage Raw': 'aMdRaw',
  'Elem. Melee Damage %': 'rMdPct',
  'Neut. Melee Damage %': 'nMdPct',
  'Earth Melee Damage %': 'eMdPct',
  'Thunder Melee Damage %': 'tMdPct',
  'Water Melee Damage %': 'wMdPct',
  'Fire Melee Damage %': 'fMdPct',
  'Air Melee Damage %': 'aMdPct',
  'Damage Raw': 'damRaw',
  'Elemental Damage Raw': 'rDamRaw',
  'Neutral Damage Raw': 'nDamRaw',
  'Earth Damage Raw': 'eDamRaw',
  'Thunder Damage Raw': 'tDamRaw',
  'Water Damage Raw': 'wDamRaw',
  'Fire Damage Raw': 'fDamRaw',
  'Air Damage Raw': 'aDamRaw',
  'Damage %': 'damPct',
  'Elemental Damage %': 'rDamPct',
  'Neutral Damage %': 'nDamPct',
  'Earth Damage %': 'eDamPct',
  'Thunder Damage %': 'tDamPct',
  'Water Damage %': 'wDamPct',
  'Fire Damage %': 'fDamPct',
  'Air Damage %': 'aDamPct',
  'Critical Damage Bonus %': 'critDamPct',
  'Fire Defense %': 'fDefPct',
  'Water Defense %': 'wDefPct',
  'Air Defense %': 'aDefPct',
  'Thunder Defense %': 'tDefPct',
  'Earth Defense %': 'eDefPct',
  'Elemental Defense %': 'rDefPct',
  '1st Spell Cost %': '-spPct1',
  '1st Spell Cost Raw': '-spRaw1',
  '2nd Spell Cost %': '-spPct2',
  '2nd Spell Cost Raw': '-spRaw2',
  '3rd Spell Cost %': '-spPct3',
  '3rd Spell Cost Raw': '-spRaw3',
  '4th Spell Cost %': '-spPct4',
  '4th Spell Cost Raw': '-spRaw4',
  Sprint: 'sprint',
  'Sprint Regen': 'sprintReg',
  'Jump Height': 'jh',
  'Loot Quality': 'lq',
  'Gather XP Bonus': 'gXp',
  'Gather Speed Bonus': 'gSpd',
  'Healing Efficiency': 'healPct',
  Knockback: 'kb',
  'Weaken Enemy': 'weakenEnemy',
  'Slow Enemy': 'slowEnemy',
  'Max Mana': 'maxMana',
  'Main Attack Range': 'mainAttackRange',
  'Release Order': 'id',
  'Attack Speed Tier': 'atkspd',
};

export const special_mappings: Record<string, string> = {
  'Sum (Skill Points)': 'str+dex+int+def+agi',
  'Sum (Mana Sustain)': 'mr/5+ms/3',
  'Sum (Life Sustain)': 'hpr+ls',
  'Sum (Health + Health Bonus)': 'hp+hpBonus',
  'Sum (Base Damage)': 'sumdmg',
  'Base DPS (Pre-Powder)': 'sumdmg*atkspdmod(atkspd)',
  'Base DPS (Post-Powder)': '(sumdmg+slots*leveltopowderavgdmg(lvl))*atkspdmod(atkspd)',
  'Sum (Melee Damage Raw)': 'summeleedamraw+sumdamraw',
  'Sum (Spell Damage Raw)': 'sumspelldamraw+sumdamraw',
  'Sum (Spell Damages %)':
    'max(edpct+esdpct,tdpct+tsdpct,wdpct+wsdpct,fdpct+fsdpct,adpct+asdpct,ndpct+nsdpct)+sdpct+dpct+rdpct+rsdpct',
  'Sum (Melee Damages %)':
    'max(edpct+emdpct,tdpct+tmdpct,wdpct+wmdpct,fdpct+fmdpct,adpct+amdpct,ndpct+nmdpct)+mdpct+dpct+rdpct+rmdpct',
  'Sum (Elemental Defense Raw)': 'eDef+tDef+wDef+fDef+aDef',
};

export const string_mappings: Record<string, string> = {
  'Major ID': 'majid',
  'Drop Type': 'drop',
  Set: 'set',
  Restriction: 'restrict',
};

export const weapon_expression_mappings: Record<string, string> = {
  'Weapon Melee Damage Bonus': '',
  'Weapon Spell Damage Bonus': '',
};

const item_filters: string[] = [
  ...Object.keys(weapon_expression_mappings),
  ...Object.keys(special_mappings),
  ...Object.keys(translate_mappings),
];
const string_item_filters: string[] = Object.keys(string_mappings);

type SearchResult = {
  item: Record<string, unknown>;
  itemExp: ExpandedItem;
  sortKeys: unknown[];
};

export function display(items_copy: SearchResult[]): void {
  const items_parent = document.getElementById('search-results')!;
  for (const i in items_copy) {
    if (Number(i) > 200) {
      break;
    }
    const item = items_copy[i].itemExp;

    const box = make_elem('div', ['col-lg-3', 'col-sm-6', 'p-2'], { id: 'item' + i });

    const bckgrdbox = make_elem('div', ['dark-7', 'rounded', 'px-2', 'col-auto'], { id: 'item' + i + 'b' });
    box.append(bckgrdbox);
    items_parent.appendChild(box);
    item.set('powders', []);
    if (item.get('category') == 'weapon') {
      apply_weapon_powders(item);
    }
    displayExpandedItem(item, bckgrdbox.id);
  }
}

export function filter_types_tiers(queries: string[]): boolean {
  let allTypes = true;
  let noTypes = true;
  let typeQuery = 'f:(';
  for (const type of Object.keys(types)) {
    if (types[type]) {
      typeQuery += 'type="' + type + '"|';
      noTypes = false;
    } else {
      allTypes = false;
    }
  }
  if (noTypes) {
    document.getElementById('summary')!.innerHTML = 'Error: Cannot search without at least 1 type selected';
    return false;
  } else if (!allTypes) {
    queries.push(typeQuery.substring(0, typeQuery.length - 1) + ')');
  }

  let allRarities = true;
  let noRarities = true;
  let rarityQuery = 'f:(';
  for (const rarity of Object.keys(search_tiers)) {
    if (search_tiers[rarity]) {
      rarityQuery += 'tiername="' + rarity + '"|';
      noRarities = false;
    } else {
      allRarities = false;
    }
  }
  if (noRarities) {
    document.getElementById('summary')!.innerHTML = 'Error: Cannot search without at least 1 rarity selected';
    return false;
  } else if (!allRarities) {
    queries.push(rarityQuery.substring(0, rarityQuery.length - 1) + ')');
  }

  return true;
}

export function init_values(): void {
  setItemSearchData(
    items
      .filter((i) => !i.remapID)
      .map((i) => [i, expandItem(i)] as [Record<string, unknown>, Map<string, unknown>]),
    new ExprParser(itemQueryProps, queryFuncs),
  );
}

function getStringFilterValues(filterKey: string): string[] {
  const value_filter: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const value = itemQueryProps[filterKey].resolve(items[i], new Map());
    if (value && !value_filter.includes(value as string)) {
      value_filter.push(value as string);
    }
  }
  return value_filter;
}

function getWeaponNames(): string[] {
  const weapons: string[] = [];
  for (const item of items) {
    if (item.category === 'weapon') weapons.push(item.displayName as string);
  }
  return weapons;
}

configureItemSearch({
  mappings: {
    translate: translate_mappings,
    special: special_mappings,
    weaponExpression: weapon_expression_mappings,
    string: string_mappings,
  },
  types,
  searchTiers: search_tiers,
  itemFilters: item_filters,
  stringItemFilters: string_item_filters,
  initValues: init_values,
  filterTypesTiers: filter_types_tiers,
  displayResults: display,
  getStringFilterValues,
  getWeaponNames,
});

void (async function () {
  void load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST]);
  await item_loader.load_init();
  init_search();
})();

attachGlobals({
  translate_mappings,
  special_mappings,
  string_mappings,
  weapon_expression_mappings,
  types,
  search_tiers,
  display,
  filter_types_tiers,
  init_values,
});
