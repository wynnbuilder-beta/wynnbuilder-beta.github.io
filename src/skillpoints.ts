
import { sets } from '@/load_item';
import type { ExpandedItem } from './types/item';
import type { SkillpointCalculationResult, SkillpointVector } from './types/stats';
import { SKP_ORDER } from './types/stats';

/** Item with skillpoint fields populated by calculate_skillpoints(). */
export type SkillpointEquipItem = ExpandedItem & {
  skillpoints: SkillpointVector;
  reqs: SkillpointVector;
  set?: string | null;
};

interface SetBonusEntry {
  bonuses: Record<string, unknown>[];
}

/**
 * Apply skillpoint bonuses from an item.
 * Also applies set deltas.
 * Modifies the skillpoints array.
 */
export function apply_skillpoints(
  skillpoints: SkillpointVector,
  item: SkillpointEquipItem,
  set_counts: Map<string, number>,
): void {
  for (let i = 0; i < 5; i++) {
    skillpoints[i] += item.skillpoints[i];
  }

  const setName = item.set;
  if (setName) {
    let setCount = set_counts.get(setName);
    if (setCount) {
      set_counts.set(setName, setCount + 1);
    } else {
      setCount = 0;
      set_counts.set(setName, 1);
    }
  }
}

export function vadd5(a: SkillpointVector, b: SkillpointVector): SkillpointVector {
  const res: SkillpointVector = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; ++i) {
    res[i] = a[i] + b[i];
  }
  return res;
}

export function can_equip(skillpoints: SkillpointVector, item: SkillpointEquipItem): boolean {
  for (let i = 0; i < 5; i++) {
    if (item.reqs[i] <= 0) continue;
    if (item.reqs[i] > skillpoints[i]) {
      return false;
    }
  }
  return true;
}

export function fix_should_pop(skillpoints: SkillpointVector, item: SkillpointEquipItem): SkillpointVector {
  const applied: SkillpointVector = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; ++i) {
    if (item.reqs[i] <= 0) continue;
    let req: number;
    if (item.get('crafted')) {
      req = item.reqs[i];
    } else {
      req = item.reqs[i] + item.skillpoints[i];
    }
    const cur = skillpoints[i];
    if (req > cur) {
      const diff = req - cur;
      applied[i] += diff;
      skillpoints[i] += diff;
    }
  }
  return applied;
}

export function check_under_100(skillpoints: SkillpointVector): boolean {
  for (let i = 0; i < 5; ++i) {
    if (skillpoints[i] > 100) {
      return false;
    }
  }
  return true;
}

/**
 * Apply skillpoints until this item can be worn.
 * Also applies set deltas.
 * Modifies the skillpoints array.
 * Also return an array of deltas, to modify the base applied skillpoints.
 */
export function apply_to_fit(skillpoints: SkillpointVector, item: SkillpointEquipItem): SkillpointVector {
  const applied: SkillpointVector = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    if (item.reqs[i] <= 0) continue;
    const req = item.reqs[i];
    const cur = skillpoints[i];
    if (req > cur) {
      const diff = req - cur;
      applied[i] += diff;
      skillpoints[i] += diff;
    }
  }
  return applied;
}

function assignItemSet(item: SkillpointEquipItem, setName: unknown): void {
  Object.defineProperty(item, 'set', {
    value: setName as string | null | undefined,
    writable: true,
    configurable: true,
  });
}

export function calculate_skillpoints(
  equipment: SkillpointEquipItem[],
  weapon: SkillpointEquipItem,
): SkillpointCalculationResult {
  const start = performance.now();
  const crafted_items: SkillpointEquipItem[] = [];
  const total_item_skillpoints: SkillpointVector = [0, 0, 0, 0, 0];
  weapon.skillpoints = weapon.get('skillpoints') as SkillpointVector;
  weapon.reqs = weapon.get('reqs') as SkillpointVector;
  assignItemSet(weapon, weapon.get('set'));
  for (const i in SKP_ORDER) {
    total_item_skillpoints[Number(i)] += weapon.skillpoints[Number(i)];
  }

  for (const item of equipment) {
    item.skillpoints = item.get('skillpoints') as SkillpointVector;
    item.reqs = item.get('reqs') as SkillpointVector;
    assignItemSet(item, item.get('set'));
    if (item.get('crafted')) {
      crafted_items.push(item);
    }

    for (const i in SKP_ORDER) {
      total_item_skillpoints[Number(i)] += item.skillpoints[Number(i)];
    }
  }

  let best_order: SkillpointEquipItem[] = equipment;
  let best_skillpoints: SkillpointVector = [0, 0, 0, 0, 0];
  let final_skillpoints: SkillpointVector = [0, 0, 0, 0, 0];
  let best_total = Infinity;
  let best_under_100 = false;
  let best_activeSetCounts = new Map<string, number>();
  let items_tried = 0;
  let checks = 0;
  let full_tried = 0;

  function recurse_check(
    _applied: SkillpointVector,
    _skp_totals: SkillpointVector,
    _sets: Map<string, number>,
    _total_applied: number,
    skipped_states: SkillpointVector[],
    prior_skipped: number[],
    equipped_items: number[],
    remains_in_order: number[],
  ): void {
    if (remains_in_order.length == 1) {
      items_tried += 1;
      full_tried += 1;
      const item = equipment[remains_in_order[0]];
      const skillpoints = _skp_totals.slice() as SkillpointVector;

      const deltas1 = apply_to_fit(skillpoints, item);
      const sets = new Map(_sets);
      if (!item.get('crafted')) {
        apply_skillpoints(skillpoints, item, sets);
      }
      const deltas2 = apply_to_fit(skillpoints, weapon);
      let deltas = vadd5(deltas1, deltas2);

      for (let i = 0; i < equipment.length; ++i) {
        const _delta = fix_should_pop(skillpoints, equipment[i]);
        deltas = vadd5(deltas, _delta);
      }
      for (let j = 0; j < prior_skipped.length; ++j) {
        checks += 1;
        const sim_skillpoints = vadd5(skipped_states[j], deltas);
        if (can_equip(sim_skillpoints, equipment[prior_skipped[j]])) {
          return;
        }
      }
      const applied = vadd5(_applied, deltas);
      const total_applied = _total_applied + deltas.reduce((a, b) => a + b, 0);

      const soln_under_100 = check_under_100(applied);
      if (best_under_100 && !soln_under_100) {
        return;
      }
      console.log('Candidate:', equipped_items.concat([remains_in_order[0]]));
      console.log('Assigned:', applied, total_applied);
      if (total_applied < best_total || (soln_under_100 && !best_under_100)) {
        for (const crafted of crafted_items) {
          apply_skillpoints(skillpoints, crafted, sets);
        }
        apply_skillpoints(skillpoints, weapon, sets);

        final_skillpoints = skillpoints;
        best_skillpoints = applied;
        best_total = total_applied;
        best_activeSetCounts = sets;
        best_order = equipped_items.concat([remains_in_order[0]]).map((x) => equipment[x]);
        best_under_100 = soln_under_100;
      }
      return;
    }

    try_item: for (let i = 0; i < remains_in_order.length; ++i) {
      items_tried += 1;
      const head = remains_in_order.slice(0, i);
      const skipped = prior_skipped.concat(head);

      const skillpoints = _skp_totals.slice() as SkillpointVector;
      const item = equipment[remains_in_order[i]];
      const deltas = apply_to_fit(skillpoints, item);
      const sim_states: SkillpointVector[] = [];
      check_skip1: for (let j = 0; j < prior_skipped.length; ++j) {
        checks += 1;
        const sim_skillpoints = vadd5(skipped_states[j], deltas);
        if (can_equip(sim_skillpoints, equipment[prior_skipped[j]])) {
          continue try_item;
        }
        sim_states.push(sim_skillpoints);
      }
      check_skip2: for (let j = 0; j < head.length; ++j) {
        checks += 1;
        if (can_equip(skillpoints, equipment[head[j]])) {
          continue try_item;
        }
        sim_states.push(skillpoints);
      }

      const mod_skillpoints = skillpoints.slice() as SkillpointVector;
      const sets = new Map(_sets);
      if (!item.get('crafted')) {
        apply_skillpoints(mod_skillpoints, item, sets);
      }
      const applied = vadd5(_applied, deltas);
      const total_applied = _total_applied + deltas.reduce((a, b) => a + b, 0);
      const tail = remains_in_order.slice(i + 1, remains_in_order.length);
      const remains = tail.concat(head);

      recurse_check(
        applied,
        mod_skillpoints,
        sets,
        total_applied,
        sim_states,
        skipped,
        equipped_items.concat([remains_in_order[i]]),
        remains,
      );
    }
  }

  recurse_check(
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    new Map(),
    0,
    [],
    [],
    [],
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );

  for (const [set_name, count] of best_activeSetCounts) {
    const setData = sets.get(set_name) as unknown as SetBonusEntry;
    const bonus = setData.bonuses[count - 1];
    for (const i in SKP_ORDER) {
      const delta = (bonus[SKP_ORDER[Number(i)]] as number) || 0;
      final_skillpoints[Number(i)] += delta;
      total_item_skillpoints[Number(i)] += delta;
    }
  }

  const end = performance.now();
  console.log(end - start, 'ms elapsed');
  console.log(items_tried, 'item equips,', full_tried, 'full builds evaluated', checks, 'items checked for satisfaction');
  return [best_order, best_skillpoints, final_skillpoints, best_total, best_activeSetCounts, total_item_skillpoints];
}

;
