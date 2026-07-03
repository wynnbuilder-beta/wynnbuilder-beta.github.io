// @ts-nocheck
import { ComputeNode } from '@/computation_graph';
import { calculateSpellDamage } from '@/damage_calc';
import type { SpellDefinition } from '@/types/stats';
import { getDefenseStats } from './defense_stats';

/**
 * Compute spell damage of spell parts.
 */
export class SpellDamageCalcNode extends ComputeNode {
  spell: SpellDefinition;

  constructor(spell: SpellDefinition) {
    super('builder-spell' + spell.base_spell + '-calc');
    this.spell = spell;
  }

  compute_func(input_map) {
    const weapon = input_map.get('build').weapon.statMap;
    const spell = this.spell;
    const spell_parts = spell.parts;
    const stats = input_map.get('stats');
    let display_spell_results = [];
    const spell_result_map = new Map();
    let use_speed = 'use_atkspd' in spell ? spell.use_atkspd : true;
    let use_spell = 'scaling' in spell ? spell.scaling === 'spell' : true;

    for (const part of spell_parts) {
      const { name } = part;
      spell_result_map.set(name, { type: 'need_eval', store_part: part });
    }

    const eval_part = (part_name) => {
      const dat = spell_result_map.get(part_name);
      if (!dat) {
        return dat;
      }
      if (dat.type !== 'need_eval') {
        return dat;
      }

      const part = dat.store_part;
      let spell_result;
      const part_id = spell.base_spell + '.' + part.name;
      if ('multipliers' in part) {
        const use_str = 'use_str' in part ? part.use_str : true;
        const ignored_mults = 'ignored_mults' in part ? part.ignored_mults : [];
        if ('scaling' in part) {
          use_spell = spell.scaling;
        }
        if ('use_atkspd' in part) {
          use_speed = spell.scaling;
        }

        const results = calculateSpellDamage(
          stats,
          weapon,
          part.multipliers,
          use_spell,
          !use_speed,
          part_id,
          !use_str,
          ignored_mults,
        );
        spell_result = {
          type: 'damage',
          normal_min: results[2].map((x) => x[0]),
          normal_max: results[2].map((x) => x[1]),
          normal_total: results[0],
          crit_min: results[2].map((x) => x[2]),
          crit_max: results[2].map((x) => x[3]),
          crit_total: results[1],
          is_spell: use_spell,
          multipliers: results[3],
        };
      } else if ('power' in part) {
        const mult_map = stats.get('healMult');
        let heal_mult = 1;
        for (const [k, v] of mult_map.entries()) {
          if (k.includes(':')) {
            const spell_match = k.split(':')[1];
            if (spell_match !== part_id) {
              continue;
            }
          }
          heal_mult *= 1 + v / 100;
        }
        const _heal_amount = part.power * getDefenseStats(stats)[0] * heal_mult;
        spell_result = {
          type: 'heal',
          heal_amount: _heal_amount,
        };
      } else {
        spell_result = {
          normal_min: [0, 0, 0, 0, 0, 0],
          normal_max: [0, 0, 0, 0, 0, 0],
          normal_total: [0, 0],
          crit_min: [0, 0, 0, 0, 0, 0],
          crit_max: [0, 0, 0, 0, 0, 0],
          crit_total: [0, 0],
          heal_amount: 0,
          multipliers: [0, 0, 0, 0, 0, 0],
        };
        const dam_res_keys = [
          'normal_min',
          'normal_max',
          'normal_total',
          'crit_min',
          'crit_max',
          'crit_total',
          'multipliers',
        ];
        for (const [subpart_name, hits] of Object.entries(part.hits)) {
          const subpart = eval_part(subpart_name);
          if (!subpart) {
            continue;
          }
          if (spell_result.type) {
            if (subpart.type !== spell_result.type) {
              throw 'SpellCalc total subpart type mismatch';
            }
          } else {
            spell_result.type = subpart.type;
          }

          const effective_hits = part.tick_rounding
            ? 1.0 / (Math.floor(1.0 / hits * 20) * 0.05)
            : hits;
          if (spell_result.type === 'damage') {
            for (const key of dam_res_keys) {
              for (const i in spell_result.normal_min) {
                spell_result[key][i] += subpart[key][i] * effective_hits;
              }
            }
          } else {
            spell_result.heal_amount += subpart.heal_amount * effective_hits;
          }
        }
      }
      const { name, display = true } = part;
      spell_result.name = name;
      spell_result.display = display;
      spell_result_map.set(name, spell_result);
      return spell_result;
    };

    for (const part of spell_parts) {
      const spell_result = eval_part(part.name);
      display_spell_results.push(spell_result);
    }
    return display_spell_results;
  }
}
