/**
 * File containing utility functions that are useful for the builder page.
 */

import type { ItemStatMap } from './types/item';
import type { AttackSpeed, ItemTier, PlayerClass, SkillpointId, WeaponType } from './types/stats';

/*Turns the input amount of skill points into a float precision percentage.
 * @param skp - the integer skillpoint count to be converted
 */
export function skillPointsToPercentage(skp: number): number {
  if (skp <= 0) {
    return 0.0;
  } else if (skp >= 150) {
    skp = 150;
  }
  const r = 0.9908;
  return (r / (1 - r) * (1 - Math.pow(r, skp))) / 100.0;
}

// WYNN2: Skillpoint max scaling. Intel is cost reduction
export const skillpoint_final_mult = [1, 1, 0.5 / skillPointsToPercentage(150), 0.867, 0.951];
// intel water%
export const skillpoint_damage_mult = [1, 1, 1, 0.867, 0.951];

/*Turns the input amount of levels into skillpoints available.
 *
 * @param level - the integer level count to be converted
 */
export function levelToSkillPoints(level: number): number {
  if (level < 1) {
    return 0;
  } else if (level >= 101) {
    return 200;
  } else {
    return (level - 1) * 2;
  }
}

/*Turns the input amount of levels in to base HP.
 * @param level - the integer level count to be converted
 */
export function levelToHPBase(this: { levelToHPBase: (level: number) => number }, level: number): number {
  if (level < 1) {
    return this.levelToHPBase(1);
  } else if (level > 121) {
    return this.levelToHPBase(121);
  } else {
    return 5 * level + 5;
  }
}

export const skp_order: readonly SkillpointId[] = ['str', 'dex', 'int', 'def', 'agi'];
export const skill = ['Strength', 'Dexterity', 'Intelligence', 'Defense', 'Agility'];
export const skp_elements = ['e', 't', 'w', 'f', 'a'];
export const damageClasses = ['Neutral', 'Earth', 'Thunder', 'Water', 'Fire', 'Air'];
export const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
export const accessoryTypes = ['ring', 'bracelet', 'necklace'];
export const weaponTypes: readonly WeaponType[] = ['wand', 'spear', 'bow', 'dagger', 'relik'];
export const consumableTypes = ['potion', 'scroll', 'food'];
export const tome_types = [
  'weaponTome',
  'armorTome',
  'guildTome',
  'lootrunTome',
  'gatherXpTome',
  'dungeonXpTome',
  'mobXpTome',
];
export const tome_type_map = new Map([
  ['weaponTome', 'Weapon Tome'],
  ['armorTome', 'Armor Tome'],
  ['guildTome', 'Guild Tome'],
  ['gatherXpTome', 'Gather XP Tome'],
  ['dungeonXpTome', 'Dungeon XP Tome'],
  ['mobXpTome', 'Slaying XP Tome'],
]);

export const attackSpeeds: readonly AttackSpeed[] = [
  'SUPER_SLOW',
  'VERY_SLOW',
  'SLOW',
  'NORMAL',
  'FAST',
  'VERY_FAST',
  'SUPER_FAST',
];
export const baseDamageMultiplier = [0.51, 0.83, 1.5, 2.05, 2.5, 3.1, 4.3];
export const classes: readonly PlayerClass[] = ['Warrior', 'Assassin', 'Mage', 'Archer', 'Shaman'];
export const wep_to_class = new Map<WeaponType, PlayerClass>([
  ['dagger', 'Assassin'],
  ['spear', 'Warrior'],
  ['wand', 'Mage'],
  ['bow', 'Archer'],
  ['relik', 'Shaman'],
]);

export const tiers: readonly ItemTier[] = [
  'Normal',
  'Unique',
  'Rare',
  'Legendary',
  'Fabled',
  'Mythic',
  'Set',
  'Crafted',
];
export const all_types = armorTypes
  .concat(accessoryTypes)
  .concat(weaponTypes as unknown as string[])
  .concat(consumableTypes)
  .concat(tome_types)
  .map((x) => x.substring(0, 1).toUpperCase() + x.substring(1));
export let item_types = armorTypes.concat(accessoryTypes).concat(weaponTypes as unknown as string[]).concat(tome_types);

export let elementIcons = ['\u2724', '\u2726', '\u2749', '\u2739', '\u274b'];
export let skpReqs = skp_order.map((x) => x + 'Req');

export let item_fields = [
  'name',
  'displayName',
  'lore',
  'color',
  'tier',
  'set',
  'slots',
  'type',
  'material',
  'drop',
  'quest',
  'restrict',
  'nDam',
  'fDam',
  'wDam',
  'aDam',
  'tDam',
  'eDam',
  'atkSpd',
  'hp',
  'fDef',
  'wDef',
  'aDef',
  'tDef',
  'eDef',
  'lvl',
  'classReq',
  'strReq',
  'dexReq',
  'intReq',
  'defReq',
  'agiReq',
  'hprPct',
  'mr',
  'sdPct',
  'mdPct',
  'ls',
  'ms',
  'xpb',
  'lb',
  'ref',
  'str',
  'dex',
  'int',
  'agi',
  'def',
  'thorns',
  'expd',
  'spd',
  'atkTier',
  'poison',
  'hpBonus',
  'spRegen',
  'eSteal',
  'hprRaw',
  'sdRaw',
  'mdRaw',
  'fDamPct',
  'wDamPct',
  'aDamPct',
  'tDamPct',
  'eDamPct',
  'fDefPct',
  'wDefPct',
  'aDefPct',
  'tDefPct',
  'eDefPct',
  'fixID',
  'category',
  'spPct1',
  'spRaw1',
  'spPct2',
  'spRaw2',
  'spPct3',
  'spRaw3',
  'spPct4',
  'spRaw4',
  'rSdRaw',
  'sprint',
  'sprintReg',
  'jh',
  'lq',
  'gXp',
  'gSpd',
  'id',
  'majorIds',
  'damMobs',
  'defMobs',
  'eMdPct',
  'eMdRaw',
  'eSdPct',
  'eSdRaw',
  'eDamRaw',
  'eDamAddMin',
  'eDamAddMax',
  'tMdPct',
  'tMdRaw',
  'tSdPct',
  'tSdRaw',
  'tDamRaw',
  'tDamAddMin',
  'tDamAddMax',
  'wMdPct',
  'wMdRaw',
  'wSdPct',
  'wSdRaw',
  'wDamRaw',
  'wDamAddMin',
  'wDamAddMax',
  'fMdPct',
  'fMdRaw',
  'fSdPct',
  'fSdRaw',
  'fDamRaw',
  'fDamAddMin',
  'fDamAddMax',
  'aMdPct',
  'aMdRaw',
  'aSdPct',
  'aSdRaw',
  'aDamRaw',
  'aDamAddMin',
  'aDamAddMax',
  'nMdPct',
  'nMdRaw',
  'nSdPct',
  'nSdRaw',
  'nDamPct',
  'nDamRaw',
  'nDamAddMin',
  'nDamAddMax',
  'damPct',
  'damRaw',
  'damAddMin',
  'damAddMax',
  'rMdPct',
  'rMdRaw',
  'rSdPct',
  'rDamPct',
  'rDamRaw',
  'rDamAddMin',
  'rDamAddMax',
  'critDamPct',
  'spPct1Final',
  'spPct2Final',
  'spPct3Final',
  'spPct4Final',
  'healPct',
  'kb',
  'weakenEnemy',
  'slowEnemy',
  'rDefPct',
  'maxMana',
  'mainAttackRange',
];
export let str_item_fields = [
  'name',
  'displayName',
  'lore',
  'color',
  'tier',
  'set',
  'type',
  'material',
  'drop',
  'quest',
  'restrict',
  'category',
  'atkSpd',
];

export let reversetranslations = new Map<string, string>();
const _translations_list: [string, string][] = [
  ['name', 'name'],
  ['displayName', 'displayName'],
  ['tier', 'tier'],
  ['set', 'set'],
  ['sockets', 'slots'],
  ['type', 'type'],
  ['armorColor', 'color'],
  ['addedLore', 'lore'],
  ['dropType', 'drop'],
  ['quest', 'quest'],
  ['restrictions', 'restrict'],
  ['damage', 'nDam'],
  ['fireDamage', 'fDam'],
  ['waterDamage', 'wDam'],
  ['airDamage', 'aDam'],
  ['thunderDamage', 'tDam'],
  ['earthDamage', 'eDam'],
  ['attackSpeed', 'atkSpd'],
  ['health', 'hp'],
  ['fireDefense', 'fDef'],
  ['waterDefense', 'wDef'],
  ['airDefense', 'aDef'],
  ['thunderDefense', 'tDef'],
  ['earthDefense', 'eDef'],
  ['level', 'lvl'],
  ['classRequirement', 'classReq'],
  ['strength', 'strReq'],
  ['dexterity', 'dexReq'],
  ['intelligence', 'intReq'],
  ['agility', 'agiReq'],
  ['defense', 'defReq'],
  ['healthRegen', 'hprPct'],
  ['manaRegen', 'mr'],
  ['spellDamageBonus', 'sdPct'],
  ['spellElementalDamageBonus', 'rSdPct'],
  ['spellNeutralDamageBonus', 'nSdPct'],
  ['spellFireDamageBonus', 'fSdPct'],
  ['spellWaterDamageBonus', 'wSdPct'],
  ['spellAirDamageBonus', 'aSdPct'],
  ['spellThunderDamageBonus', 'tSdPct'],
  ['spellEarthDamageBonus', 'eSdPct'],
  ['mainAttackDamageBonus', 'mdPct'],
  ['mainAttackElementalDamageBonus', 'rMdPct'],
  ['mainAttackNeutralDamageBonus', 'nMdPct'],
  ['mainAttackFireDamageBonus', 'fMdPct'],
  ['mainAttackWaterDamageBonus', 'wMdPct'],
  ['mainAttackAirDamageBonus', 'aMdPct'],
  ['mainAttackThunderDamageBonus', 'tMdPct'],
  ['mainAttackEarthDamageBonus', 'eMdPct'],
  ['lifeSteal', 'ls'],
  ['manaSteal', 'ms'],
  ['xpBonus', 'xpb'],
  ['lootBonus', 'lb'],
  ['reflection', 'ref'],
  ['strengthPoints', 'str'],
  ['dexterityPoints', 'dex'],
  ['intelligencePoints', 'int'],
  ['agilityPoints', 'agi'],
  ['defensePoints', 'def'],
  ['thorns', 'thorns'],
  ['exploding', 'expd'],
  ['speed', 'spd'],
  ['attackSpeedBonus', 'atkTier'],
  ['poison', 'poison'],
  ['healthBonus', 'hpBonus'],
  ['soulPoints', 'spRegen'],
  ['emeraldStealing', 'eSteal'],
  ['healthRegenRaw', 'hprRaw'],
  ['spellDamageBonusRaw', 'sdRaw'],
  ['spellElementalDamageBonusRaw', 'rSdRaw'],
  ['spellNeutralDamageBonusRaw', 'nSdRaw'],
  ['spellFireDamageBonusRaw', 'fSdRaw'],
  ['spellWaterDamageBonusRaw', 'wSdRaw'],
  ['spellAirDamageBonusRaw', 'aSdRaw'],
  ['spellThunderDamageBonusRaw', 'tSdRaw'],
  ['spellEarthDamageBonusRaw', 'eSdRaw'],
  ['mainAttackDamageBonusRaw', 'mdRaw'],
  ['mainAttackElementalDamageBonusRaw', 'rMdRaw'],
  ['mainAttackNeutralDamageBonusRaw', 'nMdRaw'],
  ['mainAttackFireDamageBonusRaw', 'fMdRaw'],
  ['mainAttackWaterDamageBonusRaw', 'wMdRaw'],
  ['mainAttackAirDamageBonusRaw', 'aMdRaw'],
  ['mainAttackThunderDamageBonusRaw', 'tMdRaw'],
  ['mainAttackEarthDamageBonusRaw', 'eMdRaw'],
  ['fireDamageBonus', 'fDamPct'],
  ['waterDamageBonus', 'wDamPct'],
  ['airDamageBonus', 'aDamPct'],
  ['thunderDamageBonus', 'tDamPct'],
  ['earthDamageBonus', 'eDamPct'],
  ['bonusFireDefense', 'fDefPct'],
  ['bonusWaterDefense', 'wDefPct'],
  ['bonusAirDefense', 'aDefPct'],
  ['bonusThunderDefense', 'tDefPct'],
  ['bonusEarthDefense', 'eDefPct'],
  ['accessoryType', 'type'],
  ['identified', 'fixID'],
  ['skin', 'skin'],
  ['category', 'category'],
  ['spellCostPct1', 'spPct1'],
  ['spellCostRaw1', 'spRaw1'],
  ['spellCostPct2', 'spPct2'],
  ['spellCostRaw2', 'spRaw2'],
  ['spellCostPct3', 'spPct3'],
  ['spellCostRaw3', 'spRaw3'],
  ['spellCostPct4', 'spPct4'],
  ['spellCostRaw4', 'spRaw4'],
  ['sprint', 'sprint'],
  ['sprintRegen', 'sprintReg'],
  ['jumpHeight', 'jh'],
  ['lootQuality', 'lq'],
  ['gatherXpBonus', 'gXp'],
  ['gatherSpeed', 'gSpd'],
  ['healingEfficiency', 'healPct'],
  ['knockback', 'kb'],
  ['weakenEnemy', 'weakenEnemy'],
  ['slowEnemy', 'slowEnemy'],
  ['elementalDefense', 'rDefPct'],
  ['maxMana', 'maxMana'],
  ['critDamPct', 'critDamPct'],
  ['mainAttackRange', 'mainAttackRange'],
];
export let translations = new Map(_translations_list);

for (const [k, v] of _translations_list) {
  if (reversetranslations.has(v)) {
    continue;
  }
  reversetranslations.set(v, k);
}

export let nonRolledIDs = [
  'name',
  'lore',
  'displayName',
  'tier',
  'set',
  'slots',
  'type',
  'material',
  'drop',
  'quest',
  'restrict',
  'nDam',
  'fDam',
  'wDam',
  'aDam',
  'tDam',
  'eDam',
  'atkSpd',
  'hp',
  'fDef',
  'wDef',
  'aDef',
  'tDef',
  'eDef',
  'lvl',
  'classReq',
  'strReq',
  'dexReq',
  'intReq',
  'defReq',
  'agiReq',
  'str',
  'dex',
  'int',
  'agi',
  'def',
  'fixID',
  'category',
  'id',
  'skillpoints',
  'reqs',
  'nDam_',
  'fDam_',
  'wDam_',
  'aDam_',
  'tDam_',
  'eDam_',
  'majorIds',
  'damMobs',
  'defMobs',
];
export let rolledIDs = [
  'hprPct',
  'mr',
  'sdPct',
  'mdPct',
  'ls',
  'ms',
  'xpb',
  'lb',
  'ref',
  'thorns',
  'expd',
  'spd',
  'atkTier',
  'poison',
  'hpBonus',
  'spRegen',
  'eSteal',
  'hprRaw',
  'sdRaw',
  'mdRaw',
  'fDamPct',
  'wDamPct',
  'aDamPct',
  'tDamPct',
  'eDamPct',
  'fDefPct',
  'wDefPct',
  'aDefPct',
  'tDefPct',
  'eDefPct',
  'spPct1',
  'spRaw1',
  'spPct2',
  'spRaw2',
  'spPct3',
  'spRaw3',
  'spPct4',
  'spRaw4',
  'rSdRaw',
  'sprint',
  'sprintReg',
  'jh',
  'lq',
  'gXp',
  'gSpd',
  'eMdPct',
  'eMdRaw',
  'eSdPct',
  'eSdRaw',
  'eDamRaw',
  'eDamAddMin',
  'eDamAddMax',
  'tMdPct',
  'tMdRaw',
  'tSdPct',
  'tSdRaw',
  'tDamRaw',
  'tDamAddMin',
  'tDamAddMax',
  'wMdPct',
  'wMdRaw',
  'wSdPct',
  'wSdRaw',
  'wDamRaw',
  'wDamAddMin',
  'wDamAddMax',
  'fMdPct',
  'fMdRaw',
  'fSdPct',
  'fSdRaw',
  'fDamRaw',
  'fDamAddMin',
  'fDamAddMax',
  'aMdPct',
  'aMdRaw',
  'aSdPct',
  'aSdRaw',
  'aDamRaw',
  'aDamAddMin',
  'aDamAddMax',
  'nMdPct',
  'nMdRaw',
  'nSdPct',
  'nSdRaw',
  'nDamPct',
  'nDamRaw',
  'nDamAddMin',
  'nDamAddMax',
  'damPct',
  'damRaw',
  'damAddMin',
  'damAddMax',
  'rMdPct',
  'rMdRaw',
  'rSdPct',
  'rDamPct',
  'rDamRaw',
  'rDamAddMin',
  'rDamAddMax',
  'critDamPct',
  'spPct1Final',
  'spPct2Final',
  'spPct3Final',
  'spPct4Final',
  'healPct',
  'kb',
  'weakenEnemy',
  'slowEnemy',
  'rDefPct',
  'maxMana',
  'mainAttackRange',
];
export let reversedIDs = ['spPct1', 'spRaw1', 'spPct2', 'spRaw2', 'spPct3', 'spRaw3', 'spPct4', 'spRaw4'];

export let ingFields = rolledIDs.concat(['str', 'dex', 'int', 'def', 'agi']);

/**
 * Take an item with id list and turn it into a set of minrolls and maxrolls.
 */
export function expandItem(item: ItemStatMap): Map<string, unknown> {
  const minRolls = new Map<string, number>();
  const maxRolls = new Map<string, number>();
  const expandedItem = new Map<string, unknown>();
  if (item.fixID) {
    expandedItem.set('fixID', true);
    for (const id of rolledIDs) {
      const val = (item[id] as number) || 0;
      minRolls.set(id, val);
      maxRolls.set(id, val);
    }
  } else {
    for (const id of rolledIDs) {
      const val = item[id] as number | { static?: boolean; raw?: number };

      if (typeof val == 'object' && val !== null && val['static']) {
        maxRolls.set(id, val['raw'] as number);
        minRolls.set(id, val['raw'] as number);
      } else if (val == 0) {
        maxRolls.set(id, 0);
        minRolls.set(id, 0);
      } else if ((val as number > 0) != reversedIDs.includes(id)) {
        maxRolls.set(id, idRound((val as number) * 1.3));
        minRolls.set(id, idRound((val as number) * 0.3));
      } else {
        maxRolls.set(id, idRound((val as number) * 0.7));
        minRolls.set(id, idRound((val as number) * 1.3));
      }
    }
  }
  for (const id of nonRolledIDs) {
    expandedItem.set(id, item[id]);
  }
  expandedItem.set('minRolls', minRolls);
  expandedItem.set('maxRolls', maxRolls);
  return expandedItem;
}

export class Item {
  statMap: Map<string, unknown>;

  constructor(item_obj: ItemStatMap | null = null) {
    if (item_obj) {
      this.statMap = expandItem(item_obj);
    } else {
      this.statMap = new Map();
    }
  }

  copy(): Item {
    const ret = new Item();
    ret.statMap = new Map(this.statMap);
    return ret;
  }
}

/* Takes in an ingredient object and returns an equivalent Map().
 */
export function expandIngredient(ing: Record<string, unknown>): Map<string, unknown> {
  const expandedIng = new Map<string, unknown>();
  const mapIds = ['consumableIDs', 'itemIDs', 'posMods'];
  for (const id of mapIds) {
    const idMap = new Map<string, unknown>();
    for (const key of Object.keys(ing[id] as Record<string, unknown>)) {
      idMap.set(key, (ing[id] as Record<string, unknown>)[key]);
    }
    expandedIng.set(id, idMap);
  }
  const normIds = ['lvl', 'name', 'displayName', 'tier', 'skills', 'id'];
  for (const id of normIds) {
    expandedIng.set(id, ing[id]);
  }
  if (ing['isPowder']) {
    expandedIng.set('isPowder', ing['isPowder']);
    expandedIng.set('pid', ing['pid']);
  }
  const idMap = new Map<string, Map<string, number>>();
  idMap.set('minRolls', new Map());
  idMap.set('maxRolls', new Map());
  for (const field of ingFields) {
    const val = ((ing['ids'] as Record<string, { minimum: number; maximum: number }>) || {})[field] || 0;
    idMap.get('minRolls')!.set(field, (val as { minimum: number }).minimum ?? 0);
    idMap.get('maxRolls')!.set(field, (val as { maximum: number }).maximum ?? 0);
  }
  expandedIng.set('ids', idMap);
  return expandedIng;
}

/* Takes in a recipe object and returns an equivalent Map().
 */
export function expandRecipe(recipe: Record<string, unknown>): Map<string, unknown> {
  const expandedRecipe = new Map<string, unknown>();
  const normIDs = ['name', 'skill', 'type', 'id'];
  for (const id of normIDs) {
    expandedRecipe.set(id, recipe[id]);
  }
  const rangeIDs = ['durability', 'lvl', 'healthOrDamage', 'duration', 'basicDuration'];
  for (const id of rangeIDs) {
    if (recipe[id]) {
      const range = recipe[id] as { minimum: number; maximum: number };
      expandedRecipe.set(id, [range.minimum, range.maximum]);
    } else {
      expandedRecipe.set(id, [0, 0]);
    }
  }
  const materials = recipe['materials'] as Array<{ item: unknown; amount: unknown }>;
  expandedRecipe.set('materials', [
    new Map([
      ['item', materials[0]['item']],
      ['amount', materials[0]['amount']],
    ]),
    new Map([
      ['item', materials[1]['item']],
      ['amount', materials[1]['amount']],
    ]),
  ]);
  return expandedRecipe;
}

/*An independent helper function that rounds a rolled ID to the nearest integer OR brings the roll away from 0.
 * @param id
 */
export function idRound(id: number): number {
  let rounded = Math.round(id);
  if (rounded == 0) {
    return Math.sign(id);
  } else {
    return rounded;
  }
}

/**
 * stupid stupid multiplicative stats
 */
const nonstacking_stats = ['Potion', 'Vulnerability', 'Mask'];
export function merge_stat(stats: Map<string, unknown>, name: string, value: unknown): void {
  const [start, end] = name.split('.', 2);
  if (start === 'damMult' || start === 'defMult' || start === 'healMult' || start === 'manaMult') {
    if (!stats.has(start)) {
      stats.set(start, new Map());
    }
    const map = stats.get(start) as Map<string, unknown>;
    if (value instanceof Map) {
      for (const [k, v] of value.entries()) {
        merge_stat(map, k, v);
      }
      return;
    }
    if (nonstacking_stats.includes(end)) {
      const highest = (stats.get(start) as Map<string, unknown>).get(end);
      if (highest !== undefined) {
        if ((value as number) > (highest as number)) {
          map.set(end, value);
          stats.set(start, map);
        }
        return;
      }
    }
    merge_stat(map, name.slice(name.indexOf('.') + 1), value);
    return;
  }
  if (stats.has(name)) {
    stats.set(name, (stats.get(name) as number) + (value as number));
  } else {
    stats.set(name, value);
  }
}

/**
 * Return a crafting skill from a crafted item's type.
 * returns null if the gear type is not armor or accessory.
 */
export function type_to_skill(t: string): string | null {
  switch (t) {
    case 'helmet':
    case 'chestplate':
      return 'ARMOURING';
    case 'leggings':
    case 'boots':
      return 'TAILORING';
    case 'ring':
    case 'necklace':
    case 'bracelet':
      return 'JEWELING';
    default:
      return null;
  }
}

/**
 * Why do ingredients store non-present rolls as null but items store it as 0?
 * Returns .get(key) of a map, but if the value is undefined it returns 0 instead.
 */
export function getOrNullToZero(map: Map<string, unknown>, key: string): number {
  const val = map.get(key);
  if (val) return val as number;
  return 0;
}

;
