/**
 * Aspect types.
 */

import type { PlayerClass } from './stats';

export type AspectTierName = 'Normal' | 'Legendary' | 'Fabled' | 'Mythic';

/** Selectable aspect tier labels shown in the builder UI. */
export type AspectUiTier = 'Legendary' | 'Fabled' | 'Mythic';

export const NUM_ASPECTS = 5;

/** Property overrides applied by an aspect tier to a base ability. */
export interface AspectAbilityOverride {
  base_abil: string;
  properties?: Record<string, number>;
  effects?: unknown[];
}

/** One tier row inside an aspect definition (from aspects.json). */
export interface AspectTierSpec {
  threshold: number;
  description: string;
  abilities?: AspectAbilityOverride[];
}

/**
 * Runtime aspect specification loaded from aspects.json.
 */
export interface AspectSpec {
  displayName: string;
  id: number;
  tier: AspectTierName;
  tiers: AspectTierSpec[];
  /** Set to true for the sentinel "No Aspect" entry. */
  NONE?: boolean;
  /** Alternate autocomplete strings; may be "NO_ALIAS" in data. */
  aliases?: string[] | 'NO_ALIAS';
}

/** Sentinel aspect used for empty slots. */
export interface NoneAspect extends AspectSpec {
  NONE: true;
  tiers: [];
}

/** [aspect, tierNumber] tuple used in encoding and aggregation. */
export type AspectTuple = [AspectSpec, number];

/** Decoded aspect from hash: display name + 1-based tier. */
export type DecodedAspect = [string, number] | null;

/** Return value of AspectInputNode.compute_func(). */
export interface AspectInputResult {
  spec: AspectSpec;
  class: PlayerClass | null;
}

/** Per-class aspect database keyed by display name. */
export type AspectMap = Map<string, AspectSpec>;

/** Per-class aspect database keyed by numeric id. */
export type AspectIdMap = Map<number, AspectSpec>;

/** Raw aspects.json top-level shape: class name -> aspect array. */
export type AspectDatabase = Record<string, AspectSpec[]>;

/** Class-indexed aspect lookup tables built at load time. */
export interface AspectLookupTables {
  aspect_map: Map<PlayerClass, AspectMap>;
  aspect_id_map: Map<PlayerClass, AspectIdMap>;
}
