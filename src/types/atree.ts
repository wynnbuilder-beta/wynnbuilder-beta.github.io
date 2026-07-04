/**
 * Ability tree node types.
 */

import type { SpellDefinition, SpellMultipliers } from './stats';

/** Icon/layout metadata for rendering an ability node. */
export interface ATreeDisplayInfo {
  row: number;
  col: number;
  icon: string;
}

export type ATreeEffectType =
  | 'replace_spell'
  | 'add_spell_prop'
  | 'convert_spell_conv'
  | 'raw_stat'
  | 'stat_scaling';

export interface ATreeStatBonus {
  type: 'stat' | 'prop';
  abil?: number;
  name: string;
  value: number;
}

export interface ATreeScalingTarget {
  type: 'stat' | 'prop';
  abil?: number;
  name: string;
}

export interface ATreeAddSpellPropEffect {
  type: 'add_spell_prop';
  base_spell: number;
  target_part?: string;
  behavior?: 'merge' | 'modify' | 'overwrite';
  cost?: number;
  multipliers?: SpellMultipliers;
  power?: number;
  hits?: Record<string, number | string>;
  display?: string;
  hide?: string;
  ignored_mults?: string[];
  mana_gained?: number;
}

export interface ATreeConvertSpellConvEffect {
  type: 'convert_spell_conv';
  base_spell: number;
  target_part?: 'all' | string;
  conversion: string;
}

export interface ATreeRawStatEffect {
  type: 'raw_stat';
  toggle?: boolean | string;
  behavior?: 'merge' | 'modify';
  bonuses: ATreeStatBonus[];
}

export interface ATreeStatScalingEffect {
  type: 'stat_scaling';
  slider?: boolean;
  positive?: boolean;
  slider_name?: string;
  slider_step?: number;
  round?: boolean;
  behavior?: 'merge' | 'modify' | 'overwrite';
  multiplicative?: boolean;
  slider_max?: number;
  slider_max_mult?: number;
  slider_default?: number;
  inputs?: ATreeScalingTarget[];
  output?: ATreeScalingTarget | ATreeScalingTarget[];
  requirement?: number;
  scaling?: number[];
  max: number;
}

export interface ATreeReplaceSpellEffect extends Partial<SpellDefinition> {
  type: 'replace_spell';
}

export type ATreeEffect =
  | ATreeReplaceSpellEffect
  | ATreeAddSpellPropEffect
  | ATreeConvertSpellConvEffect
  | ATreeRawStatEffect
  | ATreeStatScalingEffect;

/** Raw ability node from atree.json. */
export interface ATreeAbility {
  display_name: string;
  id: number;
  desc?: string | string[];
  archetype?: string;
  archetype_req?: number;
  req_archetype?: string;
  base_abil?: number | string;
  parents: number[];
  dependencies: number[];
  blockers: number[];
  cost: number;
  display: ATreeDisplayInfo;
  properties: Record<string, number>;
  effects: ATreeEffect[];
}

/** Graph node wrapping raw ability data with parent/child links. */
export interface ATreeNode {
  children: ATreeNode[];
  parents: ATreeNode[];
  ability: ATreeAbility;
}

/** Topologically sorted ability tree for one class. */
export type ATree = ATreeNode[];

/** UI wrapper created by render_AT(); also used as atree_state value. */
export interface RenderedATNode {
  ability: ATreeAbility;
  active: boolean;
  parents: RenderedATNode[];
  children: RenderedATNode[];
  connectors: Map<RenderedATNode, string[]>;
  /** Canvas/image refs populated at render time. */
  img?: HTMLCanvasElement;
  all_connectors_ref?: Map<string, unknown>;
}

/** Map of ability id -> rendered node state (active/inactive). */
export type RenderedATree = Map<number, RenderedATNode>;

/** Merged ability after applying active atree selections and scaling. */
export interface MergedAbility extends ATreeAbility {
  desc: string[];
}

export type MergedATree = Map<number, MergedAbility>;

/** Return type of abil_can_activate(): [canActivate, hardError, reason]. */
export type ATreeActivationResult = [boolean, boolean, string];

/** Active nodes returned by decodeAtree(). */
export type DecodedActiveAtree = ATreeNode[];
