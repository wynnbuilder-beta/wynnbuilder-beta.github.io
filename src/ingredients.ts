import { attachGlobals } from '@/lib/attachGlobals';
import { expandIngredient } from '@/build_utils';
import { displayExpandedIngredient } from '@/display';
import { ExprParser } from '@/expr_parser';
import { ings, ingredient_loader } from '@/load_ing';
import {
  item_loader,
  load_major_id_data,
  WYNN_VERSION_LATEST,
  wynn_version_names,
} from '@/load_item';
import { ingredientQueryProps, queryFuncs } from '@/query';
import { configureItemSearch, init_search, search_db, setItemSearchData } from '@/search';
import { make_elem } from '@/utils';
import type { Ingredient } from '@/types/ingredient';

export const translate_mappings: Record<string, string> = {
  Durability: 'durability',
  Duration: 'duration',
  Charges: 'charges',
  'Effectiveness Left': 'left',
  'Effectiveness Right': 'right',
  'Effectiveness Above': 'above',
  'Effectiveness Under': 'under',
  'Effectiveness Touching': 'touching',
  'Effectiveness Not Touching': 'nottouching',
  'Combat Level': 'lvl',
  'Req Strength': 'strReq',
  'Req Dexterity': 'dexReq',
  'Req Intelligence': 'intReq',
  'Req Agility': 'agiReq',
  'Req Defense': 'defReq',
  '% Health Regen': 'hprPct',
  'Mana Regen': 'mr',
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
  'Spell Damage %': 'sdPct',
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
  'Melee Damage %': 'mdPct',
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
  '% Fire Defense': 'fDefPct',
  '% Water Defense': 'wDefPct',
  '% Air Defense': 'aDefPct',
  '% Thunder Defense': 'tDefPct',
  '% Earth Defense': 'eDefPct',
  '% Elemental Defense': 'rDefPct',
  '1st Spell Cost %': '-spPct1',
  '1st Spell Cost Raw': '-spRaw1',
  '2nd Spell Cost %': '-spPct2',
  '2nd Spell Cost Raw': '-spRaw2',
  '3rd Spell Cost %': '-spPct3',
  '3rd Spell Cost Raw': '-spRaw3',
  '4th Spell Cost %': '-spPct4',
  '4th Spell Cost Raw': '-spRaw4',
  'Rainbow Spell Damage Raw': 'rSdRaw',
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
};

export const special_mappings: Record<string, string> = {
  'Sum (Effectiveness)':
    '7/3 * touching + 8/3 * nottouching + 2/3 * (top + bottom) + 1/2 * (left + right)',
  'Sum (Skill Points)': 'str+dex+int+def+agi',
  'Sum (Mana Sustain)': 'mr/5+ms/3',
  'Sum (Life Sustain)': 'hpr+ls',
  'Sum (Melee Damage Raw)': 'summeleedamraw+sumdamraw',
  'Sum (Spell Damage Raw)': 'sumspelldamraw+sumdamraw',
  'Sum (Spell Damages %)':
    'max(edpct+esdpct,tdpct+tsdpct,wdpct+wsdpct,fdpct+fsdpct,adpct+asdpct,ndpct+nsdpct)+sdpct+dpct+rdpct+rsdpct',
  'Sum (Melee Damages %)':
    'max(edpct+emdpct,tdpct+tmdpct,wdpct+wmdpct,fdpct+fmdpct,adpct+amdpct,ndpct+nmdpct)+mdpct+dpct+rdpct+rmdpct',
};

export const weapon_expression_mappings: Record<string, string> = {
  'Weapon Melee Damage Bonus': '',
  'Weapon Spell Damage Bonus': '',
};

const types: Record<string, boolean> = {
  armouring: false,
  tailoring: false,
  weaponsmithing: false,
  woodworking: false,
  jeweling: false,
  cooking: false,
  alchemism: false,
  scribing: false,
};

const search_tiers: Record<string, boolean> = { zero: true, one: true, two: true, three: true };

const item_filters: string[] = [
  ...Object.keys(weapon_expression_mappings),
  ...Object.keys(special_mappings),
  ...Object.keys(translate_mappings),
];

type SearchResult = {
  item: Record<string, unknown>;
  itemExp: Map<string, unknown>;
  sortKeys: unknown[];
};

export function display(ing_copy: SearchResult[]): void {
  const ing_parent = document.getElementById('search-results')!;
  for (const i in ing_copy) {
    if (Number(i) > 200) {
      break;
    }
    const ing = ing_copy[i].itemExp;
    const box = make_elem('div', ['ing-stats', 'col-lg-3', 'p-2', 'col-sm-6'], { id: 'ing' + i });

    const bckgrdbox = make_elem(
      'div',
      ['rounded', 'g-0', 'dark-7', 'border', 'border-dark', 'dark-shadow', 'p-3', 'col-auto'],
      { id: 'ing' + i + 'b' },
    );
    box.append(bckgrdbox);
    ing_parent.appendChild(box);

    displayExpandedIngredient(ing, bckgrdbox.id);
  }
}

export function filter_types_tiers(queries: string[]): boolean {
  let allTypes = true,
    noTypes = true;
  let typeQuery = 'f:(';
  for (const type of Object.keys(types)) {
    if (types[type]) {
      typeQuery += type + '|';
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

  let allStars = true,
    noStars = true;
  let starQuery = 'f:(';
  for (const star of Object.keys(search_tiers)) {
    if (search_tiers[star]) {
      starQuery += 'starsname="' + star + '"|';
      noStars = false;
    } else {
      allStars = false;
    }
  }
  if (noStars) {
    document.getElementById('summary')!.innerHTML = 'Error: Cannot search without at least 1 star selected';
    return false;
  } else if (!allStars) {
    queries.push(starQuery.substring(0, starQuery.length - 1) + ')');
  }

  return true;
}

export function init_values(): void {
  const ingList = Array.isArray(ings) ? ings : Object.values(ings);
  setItemSearchData(
    ingList
      .filter((i: Ingredient) => !i.remapID)
      .map((i: Ingredient) => [
        i as unknown as Record<string, unknown>,
        expandIngredient(i as unknown as Record<string, unknown>),
      ] as [Record<string, unknown>, Map<string, unknown>]),
    new ExprParser(ingredientQueryProps, queryFuncs),
  );
}

configureItemSearch({
  mappings: {
    translate: translate_mappings,
    special: special_mappings,
    weaponExpression: weapon_expression_mappings,
    string: {},
  },
  types,
  searchTiers: search_tiers,
  itemFilters: item_filters,
  stringItemFilters: [],
  initValues: init_values,
  filterTypesTiers: filter_types_tiers,
  displayResults: display,
  getStringFilterValues: () => [],
});

void (async function () {
  await ingredient_loader.load_init();
  await item_loader.load_init();
  await load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST]);
  init_search();
})();

attachGlobals({
  types,
  search_tiers,
  search_db,
  translate_mappings,
  special_mappings,
  weapon_expression_mappings,
  display,
  filter_types_tiers,
  init_values,
});
