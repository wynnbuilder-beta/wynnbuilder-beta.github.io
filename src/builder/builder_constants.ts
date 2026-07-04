/**
 * Builder page constants and editable-field highlight listeners.
 */

import { skp_order } from '@/build_utils';
import type { WeaponType } from '@/types/stats';

export const BUILD_VERSION = '7.0.20';

// THIS IS SUPER DANGEROUS, WE SHOULD NOT BE KEEPING THIS IN SO MANY PLACES
export const editable_item_fields = [
  'sdPct',
  'sdRaw',
  'mdPct',
  'mdRaw',
  'poison',
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
  'hprRaw',
  'hprPct',
  'hpBonus',
  'atkTier',
  'ls',
  'spPct1',
  'spRaw1',
  'spPct2',
  'spRaw2',
  'spPct3',
  'spRaw3',
  'spPct4',
  'spRaw4',
] as const;

const editable_elems: HTMLElement[] = [];

/** Attach highlight listeners to editable ID / skillpoint fields (builder page only). */
export function initEditableHighlightListeners(): void {
  if (editable_elems.length > 0) {
    return;
  }
  for (const id of editable_item_fields) {
    const elem = document.getElementById(id);
    if (!elem) {
      continue;
    }
    elem.addEventListener('change', () => {
      elem.classList.add('highlight');
    });
    editable_elems.push(elem);
  }

  for (const id of skp_order) {
    const elem = document.getElementById(id + '-skp');
    if (!elem) {
      continue;
    }
    elem.addEventListener('change', () => {
      elem.classList.add('highlight');
    });
    editable_elems.push(elem);
  }
}

export function clear_highlights(): void {
  for (const elem of editable_elems) {
    elem.classList.remove('highlight');
  }
}

export const equipment_fields = [
  'helmet',
  'chestplate',
  'leggings',
  'boots',
  'ring1',
  'ring2',
  'bracelet',
  'necklace',
  'weapon',
] as const;

export const tome_fields = [
  'weaponTome1',
  'weaponTome2',
  'armorTome1',
  'armorTome2',
  'armorTome3',
  'armorTome4',
  'guildTome1',
  'lootrunTome1',
  'gatherXpTome1',
  'gatherXpTome2',
  'dungeonXpTome1',
  'dungeonXpTome2',
  'mobXpTome1',
  'mobXpTome2',
] as const;

export const aspect_fields = ['aspect1', 'aspect2', 'aspect3', 'aspect4', 'aspect5'] as const;

export const equipment_names = [
  'Helmet',
  'Chestplate',
  'Leggings',
  'Boots',
  'Ring 1',
  'Ring 2',
  'Bracelet',
  'Necklace',
  'Weapon',
] as const;

export const tome_names = [
  'Weapon Tome',
  'Weapon Tome',
  'Armor Tome',
  'Armor Tome',
  'Armor Tome',
  'Armor Tome',
  'Guild Tome',
] as const;

export const equipment_inputs = equipment_fields.map((x) => x + '-choice');
export const build_fields = equipment_fields.map((x) => x + '-tooltip');
export const tomeInputs = tome_fields.map((x) => x + '-choice');
export const aspectInputs = aspect_fields.map((x) => x + '-choice');
export const aspectTierInputs = aspect_fields.map((x) => x + '-tier-choice');

export const powder_inputs = [
  'helmet-powder',
  'chestplate-powder',
  'leggings-powder',
  'boots-powder',
  'weapon-powder',
];

export const weapon_keys: readonly WeaponType[] = ['dagger', 'wand', 'bow', 'relik', 'spear'];
export const armor_keys = ['helmet', 'chestplate', 'leggings', 'boots'] as const;
export const accessory_keys = ['ring1', 'ring2', 'bracelet', 'necklace'] as const;
export const powderable_keys = ['helmet', 'chestplate', 'leggings', 'boots', 'weapon'] as const;
export const equipment_keys = [
  'helmet',
  'chestplate',
  'leggings',
  'boots',
  'ring1',
  'ring2',
  'bracelet',
  'necklace',
  'weapon',
] as const;
export const tome_keys = [...tome_fields];

export const spell_disp = [
  'build-melee-stats',
  'spell0-info',
  'spell1-info',
  'spell2-info',
  'spell3-info',
] as const;
export const other_disp = ['build-order', 'set-info', 'int-info'] as const;

export const raid_buff_map = new Map<string, [string, number][]>([
  // NOTG
  ['Lightbearer-I', [['int', 25], ['healPct', 20]]],
  ['Lightbearer-II', [['mr', 15], ['sdPct', 40]]],
  ['Lightbearer-III', [['int', 40], ['healPct', 35]]],
  ['Bioluminescent-I', [['rDamPct', 30]]],
  ['Bioluminescent-II', [['mdPct', 50], ['sdPct', 50]]],
  [
    'Bioluminescent-III',
    [['str', 10], ['dex', 10], ['int', 10], ['def', 10], ['agi', 10], ['rDamPct', 50]],
  ],
  ['Berserk-I', [['mdPct', 75]]],
  ['Berserk-II', [['expd', 25], ['sprintReg', 100], ['mdRaw', 500]]],
  ['Berserk-III', [['str', 30], ['mdPct', 75], ['mdRaw', 500]]],
  ['Pestilent-I', [['str', 20], ['poison', 6000], ['ls', 250]]],
  ['Pestilent-II', [['str', 25], ['poison', 9000], ['ms', 12]]],
  ['Pestilent-III', [['ls', 400], ['poison', 12500]]],
  ['Bedrock-I', [['hpBonus', 1000], ['ms', 10], ['ls', 150]]],
  ['Bedrock-II', [['hpBonus', 1250], ['ls', 300], ['hprRaw', 700]]],
  ['Bedrock-III', [['ms', 15], ['hprRaw', 900]]],
  ['Palisade', [['ls', 300], ['spPct4', -50]]],
  // NOL
  ['Cherubim-I', [['spd', 45], ['mdPct', 90]]],
  ['Cherubim-II', [['ls', 500], ['rDamPct', 40]]],
  ['Cherubim-III', [['str', 20], ['dex', 20], ['int', 20], ['def', 20], ['agi', 20]]],
  ['Seraphim-I', [['agi', 20], ['sdPct', 25], ['ref', 30]]],
  ['Seraphim-II', [['mr', 20], ['sdPct', 30]]],
  ['Seraphim-III', [['dex', 30]]],
  ['Ophanim-I', [['def', 30], ['healPct', 30]]],
  ['Ophanim-II', [['agi', 30], ['healPct', 25], ['hprPct', 40]]],
  ['Ophanim-III', [['hpBonus', 5000], ['hprRaw', 600]]],
  ['Throne-I', [['int', 35], ['rDamPct', 25]]],
  ['Throne-II', [['mr', 25], ['ms', 15]]],
  ['Throne-III', [['int', 50]]],
  ['Anti-I', [['expd', 50], ['mainAttackRange', 50]]],
  ['Anti-II', [['str', 30], ['poison', 20000]]],
  ['Anti-III', [['def', 50], ['sprint', 300]]],
  ['Neophyte', [['mainAttackRange', 300], ['ms', 50], ['atktier', -50]]],
  // TCC
  ['Intrepid-I', [['spd', 40], ['esteal', 30]]],
  ['Intrepid-II', [['hprRaw', 250], ['hprPct', 20]]],
  ['Intrepid-III', [['def', 25], ['healPct', 25], ['weakenEnemy', 5]]],
  ['Stonewalker-I', [['str', 20], ['mdRaw', 700], ['thorns', 100]]],
  ['Stonewalker-II', [['str', 30], ['mdPct', 100], ['expd', 50]]],
  ['Stonewalker-III', [['mdRaw', 1500], ['mdPct', 100]]],
  ['Giant-I', [['str', 10], ['def', 40]]],
  ['Giant-II', [['hpBonus', 3000], ['hprRaw', 400]]],
  ['Giant-III', [['hpBonus', 4000], ['hprRaw', 500], ['hprPct', 20]]],
  ['Elder-I', [['agi', 30], ['sdPct', 25], ['ref', 100]]],
  ['Elder-II', [['int', 40], ['mr', 12], ['rDamPct', 30]]],
  ['Elder-III', [['mr', 18], ['sdPct', 30], ['rDamPct', 30]]],
  ['Boulderbreaker-I', [['dex', 20], ['ls', 300]]],
  ['Boulderbreaker-II', [['agi', 25], ['sdPct', 30], ['spd', 35]]],
  ['Boulderbreaker-III', [['str', 30], ['dex', 30], ['mdPct', 80]]],
  ['Cirrus', [['agi', 30], ['jh', 15], ['healPct', 30]]],
  // TNA
  ['Hollowed-I', [['def', 20], ['hpBonus', 2000], ['ref', 50]]],
  ['Hollowed-II', [['mr', 30], ['hprRaw', 400], ['thorns', 50]]],
  ['Hollowed-III', [['hpBonus', 5000], ['hprRaw', 500], ['damPct', -30]]],
  ['Sojourner-I', [['agi', 20], ['mr', 20], ['sprintReg', 80]]],
  ['Sojourner-II', [['def', 40], ['sprint', -100]]],
  ['Sojourner-III', [['str', 30], ['dex', 30], ['hprRaw', -250]]],
  ['Fading-I', [['hprPct', 25], ['spd', 30]]],
  ['Fading-II', [['agi', 25], ['ms', 15], ['healPct', 25]]],
  [
    'Fading-III',
    [
      ['damRaw', 400],
      ['damPct', 40],
      ['str', -10],
      ['dex', -10],
      ['int', -10],
      ['def', -10],
      ['agi', -10],
    ],
  ],
  ['Insidious-I', [['int', 30], ['ms', 12], ['sdPct', 25]]],
  ['Insidious-II', [['ls', 325], ['sdPct', 40], ['maxMana', 50]]],
  ['Insidious-III', [['sdPct', 60], ['spd', -40]]],
  ['Hopeless-I', [['str', 20], ['mainAttackRange', 30], ['mdPct', 75]]],
  ['Hopeless-II', [['dex', 25], ['expd', 50]]],
  ['Hopeless-III', [['mdPct', 135], ['spd', 60], ['mr', -15]]],
  ['Manic', [['mr', 20], ['rDefPct', -100]]],
  // WTP
  ['Relentless-I', [['spd', 30], ['mdRaw', 600], ['expd', 35]]],
  ['Relentless-II', [['weakenEnemy', 8], ['spPct2', -75]]],
  ['Ingenious-I', [['hpBonus', 3000], ['spPct4', -40], ['healPct', 25]]],
  ['Ingenious-II', [['def', 30], ['hprRaw', 1000]]],
  ['Unrestrained-I', [['spRaw1', -5], ['spRaw3', -5], ['int', 25]]],
  ['Unrestrained-II', [['damRaw', 250], ['mdPct', 250], ['poison', 30000]]],
  ['Opulent-I', [['mr', 25], ['maxMana', 40], ['rDamPct', 25]]],
  ['Opulent-II', [['rDamRaw', 200], ['rDamPct', 30]]],
  ['Omniscient-I', [['ls', 650], ['maxMana', 40], ['dex', 20]]],
  ['Omniscient-II', [['ms', 20], ['mainAttackRange', 75], ['str', 20]]],
  ['Restless', [['sdPct', -35], ['maxMana', -25]]],
  ['Apathetic', [['spd', -45], ['mdPct', -40]]],
  ['Faceless', [['str', -10], ['dex', -10], ['def', -10], ['agi', -10]]],
  ['Prideful', [['hpBonus', -3000], ['rDefPct', -50]]],
  ['Isolated', [['hprRaw', -375], ['mr', -10]]],
]);

;
