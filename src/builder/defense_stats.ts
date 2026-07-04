import {
  skillpoint_final_mult,
  skillPointsToPercentage,
  skp_elements,
} from '@/build_utils';
import { rawToPct, rawToPctUncapped } from '@/utils';

/** Get all defensive stats for a build stat map. */
export function getDefenseStats(stats: Map<string, unknown>): unknown[] {
  const defenseStats: unknown[] = [];
  const def_pct = skillPointsToPercentage(stats.get('def') as number) * skillpoint_final_mult[3];
  const agi_pct = skillPointsToPercentage(stats.get('agi') as number) * skillpoint_final_mult[4];
  let totalHp = (stats.get('hp') as number) + (stats.get('hpBonus') as number);
  if (totalHp < 5) totalHp = 5;
  defenseStats.push(totalHp);
  const ehp = [totalHp, totalHp];
  let defMult = 2 - (stats.get('classDef') as number);
  for (const [, v] of (stats.get('defMult') as Map<string, number>).entries()) {
    defMult *= 1 - v / 100;
  }
  const agi_reduction = (100 - (stats.get('agiDef') as number)) / 100;
  ehp[0] = ehp[0] / (agi_reduction * agi_pct + (1 - agi_pct) * (1 - def_pct));
  ehp[0] /= defMult;
  ehp[1] /= (1 - def_pct) * defMult;
  defenseStats.push(ehp);
  const totalHpr = rawToPct(stats.get('hprRaw') as number, (stats.get('hprPct') as number) / 100);
  defenseStats.push(totalHpr);
  const ehpr = [totalHpr, totalHpr];
  ehpr[0] = ehpr[0] / (agi_reduction * agi_pct + (1 - agi_pct) * (1 - def_pct));
  ehpr[0] /= defMult;
  ehpr[1] /= (1 - def_pct) * defMult;
  defenseStats.push(ehpr);
  defenseStats.push([def_pct * 100, agi_pct * 100]);
  const eledefs = [0, 0, 0, 0, 0];
  for (const i in skp_elements) {
    eledefs[i as unknown as number] = rawToPctUncapped(
      stats.get(skp_elements[i as unknown as number] + 'Def') as number,
      ((stats.get(skp_elements[i as unknown as number] + 'DefPct') as number) +
        (stats.get('rDefPct') as number)) /
        100,
    );
  }
  defenseStats.push(eledefs);
  return defenseStats;
}
