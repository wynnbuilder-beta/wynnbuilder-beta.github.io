import { attachGlobals } from './lib/attachGlobals';
import type { ExpandedItem } from './types/item';
import type { PowderSpecialEffectMap, PowderStats } from './types/stats';
import { DAMAGE_KEYS, SKP_ELEMENTS } from './types/stats';
import { assert } from './utils';

export const powderIDs = new Map<string, number>();
export const powderNames = new Map<number, string>();
let _powderID = 0;
export const POWDER_TIERS = 7;

for (const x of SKP_ELEMENTS) {
  for (let i = 1; i <= POWDER_TIERS; ++i) {
    powderIDs.set(x + i, _powderID);
    powderNames.set(_powderID, x + i);
    _powderID++;
  }
}

// Ordering: [dmgMin, dmgMax, convert, defPlus, defMinus (+POWDER_TIERS mod 5)]
export class Powder implements PowderStats {
  min: number;
  max: number;
  convert: number;
  defPlus: number;
  defMinus: number;

  constructor(min: number, max: number, convert: number, defPlus: number, defMinus: number) {
    this.min = min;
    this.max = max;
    this.convert = convert;
    this.defPlus = defPlus;
    this.defMinus = defMinus;
  }
}

function _p(a: number, b: number, c: number, d: number, e: number): Powder {
  return new Powder(a, b, c, d, e);
}

export const powderStats: PowderStats[] = [
  _p(4, 5, 17, 2, 1), _p(6, 7, 21, 5, 2), _p(7, 9, 25, 9, 3), _p(8, 9, 31, 14, 4), _p(9, 11, 38, 22, 7), _p(11, 12, 46, 29, 7), _p(12, 14, 52, 37, 12),
  _p(1, 8, 9, 2, 1), _p(1, 12, 11, 4, 1), _p(2, 14, 13, 8, 2), _p(2, 15, 17, 13, 3), _p(3, 17, 22, 20, 5), _p(4, 19, 28, 28, 6), _p(5, 21, 32, 36, 11),
  _p(3, 4, 13, 3, 1), _p(5, 6, 15, 6, 1), _p(6, 8, 17, 11, 3), _p(7, 8, 21, 16, 4), _p(8, 10, 26, 23, 6), _p(10, 13, 32, 32, 10), _p(11, 15, 38, 40, 15),
  _p(2, 5, 14, 3, 1), _p(4, 7, 16, 6, 1), _p(5, 9, 19, 10, 2), _p(6, 9, 24, 15, 3), _p(7, 11, 30, 22, 5), _p(9, 14, 37, 31, 9), _p(10, 16, 44, 39, 14),
  _p(2, 6, 11, 3, 1), _p(3, 9, 14, 6, 2), _p(4, 11, 17, 10, 3), _p(5, 11, 22, 16, 5), _p(7, 12, 28, 23, 7), _p(8, 15, 35, 30, 8), _p(9, 17, 42, 38, 13),
];

// Thankfully, powders on armors give the same HP regardless of element
export const powderArmorHealth = [5, 10, 20, 30, 45, 60, 75];

export const powderLevelReq = [1, 5, 15, 25, 40, 55, 70];

// Ordering: [weapon special name, weapon special effects, armor special name, armor special effects]
export class PowderSpecial implements PowderSpecialEffectMap {
  weaponSpecialName: string;
  weaponSpecialEffects: Map<string, number[]>;
  armorSpecialName: string;
  armorSpecialEffects: Map<string, number[] | string[]>;
  cap: number;

  constructor(
    wSpName: string,
    wSpEff: Map<string, number[]>,
    aSpName: string,
    aSpEff: Map<string, number[] | string[]>,
    cap: number,
  ) {
    this.weaponSpecialName = wSpName;
    this.weaponSpecialEffects = wSpEff;
    this.armorSpecialName = aSpName;
    this.armorSpecialEffects = aSpEff;
    this.cap = cap;
  }
}

function _ps(
  a: string,
  b: Map<string, number[]>,
  c: string,
  d: Map<string, number[] | string[]>,
  e: number,
): PowderSpecial {
  return new PowderSpecial(a, b, c, d, e);
}

function _armorMap(entries: [string, number[] | string][]): Map<string, number[] | string[]> {
  return new Map(entries as [string, number[] | string[]][]);
}

export const powderSpecialStats = [
  _ps('Quake', new Map([['Radius', [4.5, 5, 5.5, 6, 6.5, 7, 7.5]], ['Damage', [240, 280, 320, 360, 400, 440, 480]]]), 'Rage', _armorMap([['Damage', [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]], ['Description', '% ' + '\u2764' + ' Missing below 75%']]), 300),
  _ps('Chain Lightning', new Map([['Chains', [5, 6, 7, 8, 9, 10, 11]], ['Damage', [200, 225, 250, 275, 300, 325, 350]]]), 'Kill Streak', _armorMap([['Damage', [6, 7.5, 9, 10.5, 12, 13.5, 15]], ['Duration', [5, 5, 5, 5, 5, 5, 5]], ['Description', 'Mob Killed']]), 200),
  _ps('Curse', new Map([['Duration', [4, 4, 4, 4, 4, 4, 4]], ['Damage Boost', [10, 12.5, 15, 17.5, 20, 22.5, 25]]]), 'Concentration', _armorMap([['Damage', [0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2]], ['Duration', [1, 1, 1, 1, 1, 1, 1]], ['Description', 'Mana Used']]), 120),
  _ps('Courage', new Map([['Duration', [4, 4, 4, 4, 4, 4, 4]], ['Damage', [110, 125, 140, 155, 170, 185, 200]], ['Damage Boost', [10, 12.5, 15, 17.5, 20, 22.5, 25]]]), 'Endurance', _armorMap([['Damage', [2, 3, 4, 5, 6, 7, 8]], ['Duration', [8, 8, 8, 8, 8, 8, 8]], ['Description', 'Hit Taken']]), 120),
  _ps('Wind Prison', new Map([['Duration', [5, 5, 5, 5, 5, 5, 5]], ['Damage Boost', [100, 125, 150, 175, 200, 225, 250]], ['Knockback', [8, 12, 16, 20, 24, 24, 24]]]), 'Dodge', _armorMap([['Damage', [2, 3, 4, 5, 6, 7, 8]], ['Duration', [20, 20, 20, 20, 20, 20, 20]], ['Description', 'Near Mobs']]), 120),
] as PowderSpecial[];

export function decodePowderIdx(powder_idx: number, num_tiers: number): number {
  assert(POWDER_TIERS >= num_tiers, "The versioned data's tiers can never exceed the cutting edge amount: this breaks encoding.");
  const pid = powder_idx + Math.floor(powder_idx / num_tiers) * (POWDER_TIERS - num_tiers);
  return pid;
}

export function encodePowderIdx(powder_idx: number, num_tiers: number): number {
  assert(POWDER_TIERS >= num_tiers, "The versioned data's tiers can never exceed the cutting edge amount: this breaks encoding.");
  const pid = Math.floor(powder_idx / POWDER_TIERS) * num_tiers + (powder_idx % POWDER_TIERS);
  return pid;
}

/**
 * Apply armor powders.
 * Encoding shortcut assumes that all powders give +def to one element
 * and -def to the element "behind" it in cycle ETWFA, which is true
 * as of now and unlikely to change in the near future.
 */
export function applyArmorPowders(expandedItem: ExpandedItem): void {
  const powders = expandedItem.get('powders') as number[];
  for (const id of powders) {
    const powder = powderStats[id];
    const name = powderNames.get(id)!.charAt(0);
    const prevName = SKP_ELEMENTS[(SKP_ELEMENTS.indexOf(name as (typeof SKP_ELEMENTS)[number]) + 4) % 5];
    expandedItem.set(name + 'Def', (expandedItem.get(name + 'Def') as number | undefined || 0) + powder.defPlus);
    expandedItem.set(prevName + 'Def', (expandedItem.get(prevName + 'Def') as number | undefined || 0) - powder.defMinus);
    expandedItem.set('hp', (expandedItem.get('hp') as number | undefined || 0) + powderArmorHealth[id % POWDER_TIERS]);
  }
}

export const damage_keys = [...DAMAGE_KEYS] as string[];

export const damage_present_key = 'damagePresent';

type DamagePair = [number, number];
type WeaponPowderResult = [DamagePair[], boolean[]];

/**
 * Apply weapon powders. MUTATES THE ITEM!
 * Adds entries for `damage_keys` and `damage_present_key`
 * For normal items, `damage_keys` is 6x2 list (elem: [min, max])
 * For crafted items, `damage_keys` is 6x2x2 list (elem: [minroll: [min, max], maxroll: [min, max]])
 */
export function apply_weapon_powders(item: ExpandedItem): void {
  let present: boolean[];
  if (item.get('tier') !== 'Crafted') {
    const weapon_result = calc_weapon_powder(item);
    const damages = weapon_result[0];
    present = weapon_result[1];
    for (const i in damage_keys) {
      item.set(damage_keys[i], damages[Number(i)]);
    }
  } else {
    const base_low = [
      item.get('nDamBaseLow'),
      item.get('eDamBaseLow'),
      item.get('tDamBaseLow'),
      item.get('wDamBaseLow'),
      item.get('fDamBaseLow'),
      item.get('aDamBaseLow'),
    ] as number[];
    const results_low = calc_weapon_powder(item, base_low);
    const damage_low = results_low[0];
    const base_high = [
      item.get('nDamBaseHigh'),
      item.get('eDamBaseHigh'),
      item.get('tDamBaseHigh'),
      item.get('wDamBaseHigh'),
      item.get('fDamBaseHigh'),
      item.get('aDamBaseHigh'),
    ] as number[];
    const results_high = calc_weapon_powder(item, base_high);
    const damage_high = results_high[0];
    present = results_high[1];

    for (const i in damage_keys) {
      item.set(damage_keys[i], [damage_low[Number(i)], damage_high[Number(i)]]);
    }
  }
  item.set(damage_present_key, present);
}

/**
 * Calculate weapon damage from powder.
 *
 * Return: [damages, damage_present]
 */
export function calc_weapon_powder(weapon: ExpandedItem, damageBases?: number[] | null): WeaponPowderResult {
  const powders = (weapon.get('powders') as number[]).slice();

  // Array of neutral + ewtfa damages. Each entry is a pair (min, max).
  let damages: DamagePair[] = [
    (weapon.get('nDam') as string).split('-').map(Number) as DamagePair,
    (weapon.get('eDam') as string).split('-').map(Number) as DamagePair,
    (weapon.get('tDam') as string).split('-').map(Number) as DamagePair,
    (weapon.get('wDam') as string).split('-').map(Number) as DamagePair,
    (weapon.get('fDam') as string).split('-').map(Number) as DamagePair,
    (weapon.get('aDam') as string).split('-').map(Number) as DamagePair,
  ];

  // Give crafted weapons a base damage
  if (damageBases != null) {
    damages[0] = [Math.floor(damageBases[0] * 0.9), Math.floor(damageBases[0] * 1.1)];
  }

  let neutralRemainingRaw = damages[0].slice() as DamagePair;

  // apply powders to weapon (1.21 fked implementation)
  const powder_apply_order: number[] = [];
  const powder_apply_map = new Map<number, { conv: number; min: number; max: number }>();

  // First apply powders from powder master, then ingredients if crafted, then calculate the total change.
  for (const powderID of powders) {
    const powder = powderStats[powderID];
    const element = (powderID / POWDER_TIERS) | 0;
    const conversion_ratio = powder.convert / 100;

    if (powder_apply_map.has(element)) {
      const apply_info = powder_apply_map.get(element)!;
      apply_info.conv += conversion_ratio;
      apply_info.min += powder.min;
      apply_info.max += powder.max;
    } else {
      const apply_info = {
        conv: conversion_ratio,
        min: powder.min,
        max: powder.max,
      };
      powder_apply_order.push(element);
      powder_apply_map.set(element, apply_info);
    }
  }

  // New 2.1 calculations for crafted ingredient powders
  if (weapon.get('tier') === 'Crafted' && !weapon.get('custom')) {
    for (const p of weapon.get('ingredPowders') as number[]) {
      const powder = powderStats[p];
      const element = (p / POWDER_TIERS) | 0;

      const powder_max_bonus = Math.floor(powder.max / 2);
      const powder_min_bonus = Math.floor(powder.min / 2);
      const powder_conv_bonus = powder.convert / 100 / 2;

      if (powder_apply_map.has(element)) {
        const apply_info = powder_apply_map.get(element)!;
        apply_info.conv += powder_conv_bonus;
        apply_info.min += powder_min_bonus;
        apply_info.max += powder_max_bonus;
      } else {
        const apply_info = {
          conv: powder_conv_bonus,
          min: powder_min_bonus,
          max: powder_max_bonus,
        };
        powder_apply_order.push(element);
        powder_apply_map.set(element, apply_info);
      }
    }
  }

  for (const element of powder_apply_order) {
    const apply_info = powder_apply_map.get(element)!;
    const conversion_ratio = apply_info.conv;
    const min_diff = Math.min(neutralRemainingRaw[0], conversion_ratio * neutralRemainingRaw[0]);
    const max_diff = Math.min(neutralRemainingRaw[1], conversion_ratio * neutralRemainingRaw[1]);
    neutralRemainingRaw[0] -= min_diff;
    neutralRemainingRaw[1] -= max_diff;
    damages[element + 1][0] += min_diff;
    damages[element + 1][1] += max_diff;
    damages[element + 1][0] += apply_info.min;
    damages[element + 1][1] += apply_info.max;
  }

  damages[0] = neutralRemainingRaw;

  const present_elements: boolean[] = [];
  for (const damage of damages) {
    present_elements.push(damage[1] > 0);
  }
  return [damages, present_elements];
}

attachGlobals({
  powderIDs,
  powderNames,
  POWDER_TIERS,
  Powder,
  powderStats,
  powderArmorHealth,
  powderLevelReq,
  PowderSpecial,
  powderSpecialStats,
  decodePowderIdx,
  encodePowderIdx,
  applyArmorPowders,
  damage_keys,
  damage_present_key,
  apply_weapon_powders,
  calc_weapon_powder,
});
