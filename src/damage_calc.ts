/**
 * File implementing core damage calculation logic.
 */

import {
  attackSpeeds,
  baseDamageMultiplier,
  skillpoint_damage_mult,
  skillPointsToPercentage,
} from './build_utils';
import { damage_keys, damage_present_key } from './powders';
import type { ExpandedItem } from './types/item';
import type {
  AttackSpeed,
  DamageRange,
  SpellDamageResult,
  SpellDefinition,
  WeaponType,
} from './types/stats';
import { SKP_ELEMENTS, SKP_ORDER } from './types/stats';

type DamagePair = DamageRange;
type BaseDpsResult = number | DamageRange;

function statNum(stats: Map<string, unknown>, key: string): number {
  return (stats.get(key) as number) ?? 0;
}

export function get_base_dps(item: ExpandedItem): BaseDpsResult {
  const attack_speed_mult = baseDamageMultiplier[attackSpeeds.indexOf(item.get('atkSpd') as AttackSpeed)];
  if (item.get('tier') !== 'Crafted') {
    let total_damage = 0;
    for (const damage_k of damage_keys) {
      const damages = item.get(damage_k) as DamagePair;
      total_damage += damages[0] + damages[1];
    }
    return (total_damage * attack_speed_mult) / 2;
  } else {
    let total_damage_min = 0;
    let total_damage_max = 0;
    for (const damage_k of damage_keys) {
      const damages = item.get(damage_k) as [DamagePair, DamagePair];
      total_damage_min += damages[0][0] + damages[0][1];
      total_damage_max += damages[1][0] + damages[1][1];
    }
    total_damage_min = (attack_speed_mult * total_damage_min) / 2;
    total_damage_max = (attack_speed_mult * total_damage_max) / 2;
    return [total_damage_min, total_damage_max];
  }
}

export function calculateSpellDamage(
  stats: Map<string, unknown>,
  weapon: ExpandedItem,
  _conversions: number[],
  use_spell_damage: boolean,
  ignore_speed = false,
  part_filter?: string,
  ignore_str = false,
  ignored_mults: string[] = [],
): SpellDamageResult {
  let weapon_damages: DamagePair[];
  if (weapon.get('tier') === 'Crafted') {
    weapon_damages = damage_keys.map((x) => (weapon.get(x) as [DamagePair, DamagePair])[1]);
  } else {
    weapon_damages = damage_keys.map((x) => weapon.get(x) as DamagePair);
  }
  let present = structuredClone(weapon.get(damage_present_key)) as boolean[];

  const damage_elements = ['n'].concat(SKP_ELEMENTS);

  let conversions = structuredClone(_conversions);
  if (part_filter !== undefined) {
    const conv_postfix = ':' + part_filter;
    for (let i in damage_elements) {
      const stat_name = damage_elements[Number(i)] + 'ConvBase' + conv_postfix;
      if (stats.has(stat_name)) {
        conversions[Number(i)] += statNum(stats, stat_name);
      }
    }
  }
  for (let i in damage_elements) {
    const stat_name = damage_elements[Number(i)] + 'ConvBase';
    if (stats.has(stat_name)) {
      conversions[Number(i)] += statNum(stats, stat_name);
    }
  }

  const damages: DamagePair[] = [];
  const neutral_convert = conversions[0] / 100;
  if (neutral_convert == 0) {
    present = [false, false, false, false, false, false];
  }
  let weapon_min = 0;
  let weapon_max = 0;
  for (const damage of weapon_damages) {
    const min_dmg = damage[0] * neutral_convert;
    const max_dmg = damage[1] * neutral_convert;
    damages.push([min_dmg, max_dmg]);
    weapon_min += damage[0];
    weapon_max += damage[1];
  }

  let total_convert = 0;
  for (let i = 1; i <= 5; ++i) {
    if (conversions[i] > 0) {
      const conv_frac = conversions[i] / 100;
      damages[i][0] += conv_frac * weapon_min;
      damages[i][1] += conv_frac * weapon_max;
      present[i] = true;
      total_convert += conv_frac;
    }
  }
  total_convert += conversions[0] / 100;

  if (!ignore_speed) {
    const attack_speed_mult = baseDamageMultiplier[attackSpeeds.indexOf(weapon.get('atkSpd') as AttackSpeed)];
    for (let i = 0; i < 6; ++i) {
      damages[i][0] *= attack_speed_mult;
      damages[i][1] *= attack_speed_mult;
    }
  }

  for (let i in damage_elements) {
    if (present[Number(i)]) {
      damages[Number(i)][0] += statNum(stats, damage_elements[Number(i)] + 'DamAddMin');
      damages[Number(i)][1] += statNum(stats, damage_elements[Number(i)] + 'DamAddMax');
    }
  }

  let specific_boost_str = 'Md';
  if (use_spell_damage) {
    specific_boost_str = 'Sd';
  }

  const skill_boost = [0];
  for (let i in SKP_ORDER) {
    const skp = SKP_ORDER[Number(i)];
    skill_boost.push(skillPointsToPercentage(stats.get(skp) as number) * skillpoint_damage_mult[Number(i)]);
  }
  const static_boost = (statNum(stats, specific_boost_str.toLowerCase() + 'Pct') + statNum(stats, 'damPct')) / 100;

  let total_min = 0;
  let total_max = 0;
  const save_prop: DamagePair[] = [];
  for (let i in damage_elements) {
    save_prop.push(damages[Number(i)].slice() as DamagePair);
    total_min += damages[Number(i)][0];
    total_max += damages[Number(i)][1];

    const damage_specific = damage_elements[Number(i)] + specific_boost_str + 'Pct';
    let damageBoost =
      1 +
      skill_boost[Number(i)] +
      static_boost +
      (statNum(stats, damage_specific) + statNum(stats, damage_elements[Number(i)] + 'DamPct')) / 100;
    if (Number(i) > 0) {
      damageBoost += (statNum(stats, 'r' + specific_boost_str + 'Pct') + statNum(stats, 'rDamPct')) / 100;
    }
    damages[Number(i)][0] *= damageBoost;
    damages[Number(i)][1] *= damageBoost;
  }

  const total_elem_min = total_min - save_prop[0][0];
  const total_elem_max = total_max - save_prop[0][1];

  const prop_raw = statNum(stats, specific_boost_str.toLowerCase() + 'Raw') + statNum(stats, 'damRaw');
  const rainbow_raw = statNum(stats, 'r' + specific_boost_str + 'Raw') + statNum(stats, 'rDamRaw');
  for (let i in damages) {
    const save_obj = save_prop[Number(i)];
    const damages_obj = damages[Number(i)];
    const damage_prefix = damage_elements[Number(i)] + specific_boost_str;
    let raw_boost = 0;
    if (present[Number(i)]) {
      raw_boost += statNum(stats, damage_prefix + 'Raw') + statNum(stats, damage_elements[Number(i)] + 'DamRaw');
    }
    let min_boost = raw_boost;
    let max_boost = raw_boost;
    if (total_max > 0) {
      if (total_min === 0) {
        min_boost += (save_obj[1] / total_max) * prop_raw;
      } else {
        min_boost += (save_obj[0] / total_min) * prop_raw;
      }
      max_boost += (save_obj[1] / total_max) * prop_raw;
    }
    if (Number(i) != 0 && total_elem_max > 0) {
      if (total_elem_min === 0) {
        min_boost += (save_obj[1] / total_elem_max) * rainbow_raw;
      } else {
        min_boost += (save_obj[0] / total_elem_min) * rainbow_raw;
      }
      max_boost += (save_obj[1] / total_elem_max) * rainbow_raw;
    }
    damages_obj[0] += min_boost * total_convert;
    damages_obj[1] += max_boost * total_convert;
  }

  const strBoost = ignore_str ? 1 : 1 + skill_boost[1];
  const total_dam_norm: DamageRange = [0, 0];
  const total_dam_crit: DamageRange = [0, 0];
  const damages_results: [number, number, number, number][] = [];
  const mult_map = stats.get('damMult') as Map<string, number>;
  let damage_mult = 1;

  const ele_damage_mult = [1, 1, 1, 1, 1, 1];
  const multiplied_conversions = conversions;

  for (const [k, v] of mult_map.entries()) {
    if (k.includes(':')) {
      const spell_match = k.split(':')[1];
      if (spell_match !== part_filter) {
        continue;
      }
    }
    if (ignored_mults.includes(k)) {
      continue;
    }

    if (k.includes(';')) {
      const ele_bonus = k.split(';')[1];
      const ele_match = damage_elements.indexOf(ele_bonus);

      if (ele_bonus === 'm' && !use_spell_damage) {
        damage_mult *= 1 + v / 100;
      } else if (ele_match !== -1) {
        ele_damage_mult[ele_match] *= 1 + v / 100;
      }
    } else {
      damage_mult *= 1 + v / 100;
    }
  }
  const crit_mult = ignore_str ? 0 : 1 + (stats.get('critDamPct') as number) / 100;

  for (let i in damage_elements) {
    damages[Number(i)][0] *= ele_damage_mult[Number(i)];
    damages[Number(i)][1] *= ele_damage_mult[Number(i)];
    multiplied_conversions[Number(i)] *= ele_damage_mult[Number(i)] * damage_mult;
  }

  for (const damage of damages) {
    if (damage[0] < 0) damage[0] = 0;
    if (damage[1] < 0) damage[1] = 0;

    const res: [number, number, number, number] = [
      damage[0] * strBoost * damage_mult,
      damage[1] * strBoost * damage_mult,
      damage[0] * (strBoost + crit_mult) * damage_mult,
      damage[1] * (strBoost + crit_mult) * damage_mult,
    ];
    damages_results.push(res);
    total_dam_norm[0] += res[0];
    total_dam_norm[1] += res[1];
    total_dam_crit[0] += res[2];
    total_dam_crit[1] += res[3];
  }

  return [total_dam_norm, total_dam_crit, damages_results, multiplied_conversions];
}

type DefaultMeleeSpell = SpellDefinition & { type?: string };

export const default_spells: Record<WeaponType, DefaultMeleeSpell[]> = {
  wand: [
    {
      type: 'replace_spell',
      name: 'Wand Melee',
      base_spell: 0,
      scaling: 'melee',
      use_atkspd: false,
      display: 'Melee',
      parts: [{ name: 'Melee', multipliers: [100, 0, 0, 0, 0, 0] }],
    },
  ],
  spear: [
    {
      type: 'replace_spell',
      name: 'Melee',
      base_spell: 0,
      scaling: 'melee',
      use_atkspd: false,
      display: 'Melee',
      parts: [{ name: 'Melee', multipliers: [100, 0, 0, 0, 0, 0] }],
    },
  ],
  bow: [
    {
      type: 'replace_spell',
      name: 'Bow Shot',
      base_spell: 0,
      scaling: 'melee',
      use_atkspd: false,
      display: 'Single Shot',
      parts: [{ name: 'Single Shot', multipliers: [100, 0, 0, 0, 0, 0] }],
    },
  ],
  dagger: [
    {
      type: 'replace_spell',
      name: 'Melee',
      base_spell: 0,
      scaling: 'melee',
      use_atkspd: false,
      display: 'Melee',
      parts: [{ name: 'Melee', multipliers: [100, 0, 0, 0, 0, 0] }],
    },
  ],
  relik: [
    {
      type: 'replace_spell',
      name: 'Relik Melee',
      base_spell: 0,
      spell_type: 'damage',
      scaling: 'melee',
      use_atkspd: false,
      display: 'Total',
      parts: [
        { name: 'Single Beam', multipliers: [33, 0, 0, 0, 0, 0] },
        { name: 'Total', hits: { 'Single Beam': 3 } },
      ],
    },
  ],
};

;
