import type { Build } from '@/builder/build';
import type { PlayerBuild } from '@/types/build';

/** Convert runtime Build class to the structural PlayerBuild used by encode/share. */
export function buildToPlayerBuild(build: Build): PlayerBuild {
  const level =
    typeof build.level === 'number' ? build.level : parseInt(String(build.level), 10) || 1;
  return {
    level,
    items: build.items,
    equipment: build.equipment,
    tomes: build.tomes,
    weapon: build.weapon,
    availableSkillpoints: build.availableSkillpoints,
    equip_order: build.equip_order,
    base_skillpoints: build.base_skillpoints,
    total_skillpoints: build.total_skillpoints,
    assigned_skillpoints: build.assigned_skillpoints,
    activeSetCounts: build.activeSetCounts,
    total_item_skillpoints: build.total_item_skillpoints,
    statMap: build.statMap,
  };
}
