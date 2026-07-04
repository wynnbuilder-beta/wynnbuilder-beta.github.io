/**
 * Class representing the player Build.
 *
 * Keeps track of equipment list, equip order, skillpoint assignment (initial),
 * Aggregates item stats into a statMap to be used in damage calculation.
 */

import { Item, levelToHPBase, levelToSkillPoints, skp_order } from '@/build_utils';
import { getActiveSetBonus } from '@/load_item';
import { calculate_skillpoints } from '@/skillpoints';
import type { BuildStatMap, SkillpointVector, WeaponType } from '@/types/stats';
import { isSetBonusStatValue } from '@/types/item';
import type { SkillpointEquipItem } from '@/skillpoints';

export const classDefenseMultipliers = new Map<WeaponType, number>([
  ['relik', 0.6],
  ['bow', 0.7],
  ['wand', 0.8],
  ['dagger', 1.0],
  ['spear', 1.0],
]);

export const build_errors: string[] = [];

export class Build {
  level: number | string;
  availableSkillpoints: number;
  items: Item[];
  equipment: Item[];
  tomes: Item[];
  weapon: Item;
  equip_order: Map<string, unknown>[];
  base_skillpoints: SkillpointVector;
  total_skillpoints: SkillpointVector;
  assigned_skillpoints: number;
  activeSetCounts: Map<string, number>;
  total_item_skillpoints: SkillpointVector;
  statMap!: BuildStatMap;

  constructor(
    level: number | string,
    equipment: Item[],
    tomes: Item[],
    weapon: Item,
    _wynn_order_equipment: Item[],
  ) {
    if (typeof level === 'number' && level < 1) {
      this.level = 1;
    } else if (typeof level === 'number' && level > 121) {
      this.level = 121;
    } else if (typeof level === 'number' && level <= 121 && level >= 1) {
      this.level = level;
    } else if (typeof level === 'string') {
      this.level = level;
    } else {
      build_errors.push('Level is not a string or number.');
      this.level = 1;
    }
    (document.getElementById('level-choice') as HTMLInputElement).value = String(this.level);

    this.availableSkillpoints = levelToSkillPoints(
      typeof this.level === 'number' ? this.level : parseInt(this.level, 10) || 1,
    );
    this.items = equipment.concat([...tomes, weapon]);
    this.equipment = equipment;
    this.tomes = tomes;
    this.weapon = weapon;

    const result = calculate_skillpoints(
      _wynn_order_equipment.map((x) => x.statMap as SkillpointEquipItem),
      this.weapon.statMap as SkillpointEquipItem,
    );
    const _equip_order = result[0].slice();
    this.equip_order = [];
    for (const item of _equip_order) {
      if (item.get('category') === 'tome' || item.has('NONE')) {
        continue;
      }
      this.equip_order.push(item);
    }
    this.base_skillpoints = result[1];
    this.total_skillpoints = result[2];
    this.assigned_skillpoints = result[3];
    this.activeSetCounts = result[4];
    this.total_item_skillpoints = result[5];

    this.initBuildStats();
  }

  initBuildStats(): void {
    const staticIDs = ['hp', 'eDef', 'tDef', 'wDef', 'fDef', 'aDef', 'str', 'dex', 'int', 'def', 'agi', 'damMobs', 'defMobs'];

    const must_ids = [
      'eMdPct',
      'eMdRaw',
      'eSdPct',
      'eSdRaw',
      'eDamPct',
      'eDamRaw',
      'eDamAddMin',
      'eDamAddMax',
      'tMdPct',
      'tMdRaw',
      'tSdPct',
      'tSdRaw',
      'tDamPct',
      'tDamRaw',
      'tDamAddMin',
      'tDamAddMax',
      'wMdPct',
      'wMdRaw',
      'wSdPct',
      'wSdRaw',
      'wDamPct',
      'wDamRaw',
      'wDamAddMin',
      'wDamAddMax',
      'fMdPct',
      'fMdRaw',
      'fSdPct',
      'fSdRaw',
      'fDamPct',
      'fDamRaw',
      'fDamAddMin',
      'fDamAddMax',
      'aMdPct',
      'aMdRaw',
      'aSdPct',
      'aSdRaw',
      'aDamPct',
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
      'mdPct',
      'mdRaw',
      'sdPct',
      'sdRaw',
      'damPct',
      'damRaw',
      'damAddMin',
      'damAddMax',
      'rMdPct',
      'rMdRaw',
      'rSdPct',
      'rSdRaw',
      'rDamPct',
      'rDamRaw',
      'rDamAddMin',
      'rDamAddMax',
      'healPct',
      'critDamPct',
    ];

    const statMap = new Map<string, unknown>() as BuildStatMap;

    for (const staticID of staticIDs) {
      statMap.set(staticID, 0);
    }
    for (const staticID of must_ids) {
      statMap.set(staticID, 0);
    }
    statMap.set(
      'hp',
      levelToHPBase.call(
        { levelToHPBase },
        typeof this.level === 'number' ? this.level : parseInt(this.level, 10) || 1,
      ),
    );
    statMap.set('agiDef', 90);

    const major_ids = new Set<string>();
    for (const item of this.items) {
      const item_stats = item.statMap;
      for (const [id, value] of item_stats.get('maxRolls') as Map<string, number>) {
        if (staticIDs.includes(id)) {
          continue;
        }
        statMap.set(id, ((statMap.get(id) as number) || 0) + value);
      }
      for (const staticID of staticIDs) {
        if (item_stats.get(staticID)) {
          statMap.set(staticID, (statMap.get(staticID) as number) + (item_stats.get(staticID) as number));
        }
      }
      if (item_stats.get('majorIds')) {
        for (const major_id of item_stats.get('majorIds') as string[]) {
          major_ids.add(major_id);
        }
      }
    }
    const damMult = new Map<string, number>();
    const defMult = new Map<string, number>();
    statMap.set('damMult', damMult);
    statMap.set('defMult', defMult);
    damMult.set('tome', statMap.get('damMobs') as number);
    defMult.set('tome', statMap.get('defMobs') as number);
    statMap.set('activeMajorIDs', major_ids);
    for (const [setName, count] of this.activeSetCounts) {
      const bonus = getActiveSetBonus(setName, count);
      if (!bonus) continue;
      for (const id in bonus) {
        const val = bonus[id];
        if (!isSetBonusStatValue(val)) continue;
        if ((skp_order as readonly string[]).includes(id)) {
          // pass. Don't include skillpoints in ids
        } else {
          statMap.set(id, ((statMap.get(id) as number) || 0) + val);
        }
      }
    }
    statMap.set('poisonPct', 0);
    const healMult = new Map<string, number>();
    statMap.set('healMult', healMult);
    healMult.set('item', statMap.get('healPct') as number);
    statMap.set('manaMult', new Map<string, number>());

    statMap.set('atkSpd', this.weapon.statMap.get('atkSpd'));

    this.statMap = statMap;
  }
}

;
