import {
  skillpoint_final_mult,
  skillPointsToPercentage,
  skp_elements,
  statNum,
} from '@/build_utils';
import type { BuildStatMap, MultiplierStatMap } from '@/types/stats';
import { rawToPct, rawToPctUncapped } from '@/utils';

/** [totalHp, ehp, totalHpr, ehpr, [def%, agi%], elemental defs]. */
export type DefenseStats = [
  number,
  [number, number],
  number,
  [number, number],
  [number, number],
  number[],
];

/** Get all defensive stats for a build stat map. */
export function getDefenseStats(stats: BuildStatMap): DefenseStats {
  const defenseStats: DefenseStats = [
    0,
    [0, 0],
    0,
    [0, 0],
    [0, 0],
    [0, 0, 0, 0, 0],
  ];
  const def_pct = skillPointsToPercentage(statNum(stats, 'def')) * skillpoint_final_mult[3];
  const agi_pct = skillPointsToPercentage(statNum(stats, 'agi')) * skillpoint_final_mult[4];
  let totalHp = stats.get('hp') + statNum(stats, 'hpBonus');
  if (totalHp < 5) totalHp = 5;
  defenseStats[0] = totalHp;
  const ehp: [number, number] = [totalHp, totalHp];
  let defMult = 2 - statNum(stats, 'classDef');
  for (const [, v] of (stats.get('defMult') as MultiplierStatMap).entries()) {
    defMult *= 1 - v / 100;
  }
  const agi_reduction = (100 - statNum(stats, 'agiDef')) / 100;
  ehp[0] = ehp[0] / (agi_reduction * agi_pct + (1 - agi_pct) * (1 - def_pct));
  ehp[0] /= defMult;
  ehp[1] /= (1 - def_pct) * defMult;
  defenseStats[1] = ehp;
  const totalHpr = rawToPct(statNum(stats, 'hprRaw'), statNum(stats, 'hprPct') / 100);
  defenseStats[2] = totalHpr;
  const ehpr: [number, number] = [totalHpr, totalHpr];
  ehpr[0] = ehpr[0] / (agi_reduction * agi_pct + (1 - agi_pct) * (1 - def_pct));
  ehpr[0] /= defMult;
  ehpr[1] /= (1 - def_pct) * defMult;
  defenseStats[3] = ehpr;
  defenseStats[4] = [def_pct * 100, agi_pct * 100];
  const eledefs = [0, 0, 0, 0, 0];
  for (const i in skp_elements) {
    eledefs[i as unknown as number] = rawToPctUncapped(
      statNum(stats, skp_elements[i as unknown as number] + 'Def'),
      (statNum(stats, skp_elements[i as unknown as number] + 'DefPct') + statNum(stats, 'rDefPct')) / 100,
    );
  }
  defenseStats[5] = eledefs;
  return defenseStats;
}
