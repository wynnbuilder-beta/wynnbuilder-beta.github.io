/**
 * Core item and set data shapes.
 */

import type { ATreeAbility } from './atree';
import type { ItemTier, SkillpointVector } from './stats';

export interface ItemStatMap extends Record<string, unknown> {
  name?: string;
  displayName?: string;
  category?: string;
  type?: string;
  tier?: ItemTier | string;
  lvl?: number;
  set?: string | null;
  quest?: string | null;
  id?: number;
  fixID?: boolean | 0;
  slots?: number;
  skillpoints?: SkillpointVector | number[];
  reqs?: SkillpointVector | number[];
  has_negstat?: boolean;
  nDam?: string;
  eDam?: string;
  tDam?: string;
  wDam?: string;
  fDam?: string;
  aDam?: string;
  atkSpd?: string;
  powders?: unknown[];
}

/** Expanded item used in builder/display (Map-based stat access). */
export type ExpandedItem = Map<string, unknown>;

export type SetBonusTier = Record<string, number | boolean>;

export interface SetDefinition {
  items: string[];
  bonuses: SetBonusTier[];
  hidden?: boolean;
}

export type SetBonusData = SetDefinition;

export function isSetBonusStatValue(value: unknown): value is number {
  return typeof value === 'number';
}

export interface MajorIdAbility extends ATreeAbility {
  class?: string;
}

export interface MajorId {
  displayName: string;
  description: string;
  hidden?: boolean;
  abilities: MajorIdAbility[];
}

export interface ItemRemotePayload {
  items: ItemStatMap[];
  sets: Record<string, SetDefinition>;
}

export interface ItemListEntry {
  name: string;
  [key: string]: unknown;
}
