/**
 * Stat, damage, skillpoint, mana, and powder types used across builder calculations.
 */

/** Skillpoint / element order: Earth, Thunder, Water, Fire, Air. */
export type SkillpointId = 'str' | 'dex' | 'int' | 'def' | 'agi';

export type ElementPrefix = 'e' | 't' | 'w' | 'f' | 'a';

/** Neutral + ETWFA element keys used in damage arrays (index order: n, e, t, w, f, a). */
export type DamageElementKey = 'n' | ElementPrefix;

export type PlayerClass =
  | 'Warrior'
  | 'Assassin'
  | 'Mage'
  | 'Archer'
  | 'Shaman';

export type WeaponType = 'dagger' | 'spear' | 'wand' | 'bow' | 'relik';

export type AttackSpeed =
  | 'SUPER_SLOW'
  | 'VERY_SLOW'
  | 'SLOW'
  | 'NORMAL'
  | 'FAST'
  | 'VERY_FAST'
  | 'SUPER_FAST';

export type ItemTier =
  | 'Normal'
  | 'Unique'
  | 'Rare'
  | 'Legendary'
  | 'Fabled'
  | 'Mythic'
  | 'Set'
  | 'Crafted';

/** Five-element vector in skp_order (str, dex, int, def, agi). */
export type SkillpointVector = [number, number, number, number, number];

/** Nullable per-element manual skillpoint assignment from build decode. */
export type DecodedSkillpoints = Array<number | null>;

/** Result tuple from calculate_skillpoints(). */
export type SkillpointCalculationResult = [
  /** equip_order — stat maps in wynn equip order */
  Map<string, unknown>[],
  /** base_skillpoints — manually assigned deltas */
  SkillpointVector,
  /** final_skillpoints — totals after items/sets */
  SkillpointVector,
  /** assigned_skillpoints — sum of base_skillpoints */
  number,
  /** activeSetCounts */
  Map<string, number>,
  /** total_item_skillpoints */
  SkillpointVector,
];

/** Min/max damage pair. */
export type DamageRange = [number, number];

/** Per-element weapon damage after powders (NETWFA order). */
export type ElementDamageRanges = [
  DamageRange,
  DamageRange,
  DamageRange,
  DamageRange,
  DamageRange,
  DamageRange,
];

/** Crafted weapon damage: [minRoll, maxRoll] per element. */
export type CraftedElementDamageRanges = [DamageRange, DamageRange];

/** Output of calculateSpellDamage for one part: [normalMin, normalMax, critMin, critMax]. */
export type SpellPartDamageResult = [number, number, number, number];

export type SpellDamageResult = [
  /** total_dam_norm */
  DamageRange,
  /** total_dam_crit */
  DamageRange,
  /** damages_results per element */
  SpellPartDamageResult[],
  /** multiplied_conversions */
  number[],
];

/** Multiplicative stat namespaces stored on build stat maps. */
export type MultiplierStatMap = Map<string, number>;

// --- Spell schema ---

export type SpellScaling = 'melee' | 'spell';

export type SpellPartType = 'damage' | 'heal' | 'total';

/** Six-element spell multiplier (NETWFA order). */
export type SpellMultipliers = [
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface SpellDamagePart {
  name: string;
  type?: 'damage';
  use_str?: boolean;
  multipliers: SpellMultipliers;
  display?: boolean;
  ignored_mults?: string[];
}

export interface SpellHealPart {
  name: string;
  type?: 'heal';
  power: number;
  display?: boolean;
  ignored_mults?: string[];
}

export interface SpellTotalPart {
  name: string;
  type?: 'total';
  hits: Record<string, number | string>;
  display?: boolean;
}

export type SpellPart = SpellDamagePart | SpellHealPart | SpellTotalPart;

export interface SpellDefinition {
  name: string;
  base_spell: number;
  cost?: number;
  /** @deprecated */
  spell_type?: 'healing' | 'damage';
  scaling?: SpellScaling;
  use_atkspd?: boolean;
  display?: string;
  parts: SpellPart[];
  /** Populated at runtime by atree merge / mana calc. */
  mana_gained?: number;
}

/** Computed spell damage part for display. */
export interface ComputedSpellDamagePart {
  type: 'damage';
  name: string;
  normal_min: number[];
  normal_max: number[];
  normal_total: DamageRange;
  crit_min: number[];
  crit_max: number[];
  crit_total: DamageRange;
}

export interface ComputedSpellHealPart {
  type: 'heal';
  name: string;
  heal_amount: number;
}

export type ComputedSpellPart = ComputedSpellDamagePart | ComputedSpellHealPart;

// --- Powder types ---

export interface PowderStats {
  min: number;
  max: number;
  convert: number;
  defPlus: number;
  defMinus: number;
}

export interface PowderSpecialEffectMap {
  weaponSpecialName: string;
  weaponSpecialEffects: Map<string, number[]>;
  armorSpecialName: string;
  armorSpecialEffects: Map<string, number[] | string[]>;
  cap: number;
}

/** Numeric powder ID (internal index). */
export type PowderId = number;

/** Legacy encoded powder string, e.g. "e6t6". */
export type PowderString = string;

export const DAMAGE_KEYS = [
  'nDam_',
  'eDam_',
  'tDam_',
  'wDam_',
  'fDam_',
  'aDam_',
] as const;

export type DamageKey = (typeof DAMAGE_KEYS)[number];

export const SKP_ORDER: readonly SkillpointId[] = [
  'str',
  'dex',
  'int',
  'def',
  'agi',
] as const;

export const SKP_ELEMENTS: readonly ElementPrefix[] = [
  'e',
  't',
  'w',
  'f',
  'a',
] as const;

/** Static stat IDs initialized to zero on every build. */
export type BuildStaticStatId =
  | 'hp'
  | 'eDef'
  | 'tDef'
  | 'wDef'
  | 'fDef'
  | 'aDef'
  | 'str'
  | 'dex'
  | 'int'
  | 'def'
  | 'agi'
  | 'damMobs'
  | 'defMobs';

/** Wynn2 per-element damage/stat ID suffix groups. */
export type ElementStatSuffix =
  | 'MdPct'
  | 'MdRaw'
  | 'SdPct'
  | 'SdRaw'
  | 'DamPct'
  | 'DamRaw'
  | 'DamAddMin'
  | 'DamAddMax';

/** Aggregated build stats produced by Build.initBuildStats(). */
export interface BuildStatMap extends Map<string, unknown> {
  get(key: string): unknown;
  get(key: 'hp'): number;
  get(key: 'atkSpd'): AttackSpeed | undefined;
  get(key: 'str' | 'dex' | 'int' | 'def' | 'agi'): number;
  get(key: 'damMult' | 'defMult' | 'healMult' | 'manaMult'): MultiplierStatMap;
  get(key: 'activeMajorIDs'): Set<string>;
  get(key: 'critDamPct'): number | undefined;
  get(key: 'mr' | 'ms'): number | undefined;
  get(key: 'bloodPactCost'): number | undefined;
  get(key: 'activateGeneralist'): boolean | undefined;
}

/** Mana cycle entry after calculateMana preprocessing: [cost, manaGain, spellIndex]. */
export type ManaCycleEntry = [number, number, number];
