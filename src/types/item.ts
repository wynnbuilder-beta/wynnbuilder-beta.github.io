/**
 * Core item and set data shapes.
 */

import type { ItemTier, SkillpointVector } from './stats';

export interface ItemStatMap extends Record<string, unknown> {
  name?: string;
  displayName?: string;
  category?: string;
  type?: string;
  tier?: ItemTier | string;
  level?: number;
  set?: string | null;
  quest?: string | null;
  id?: number;
  fixID?: boolean;
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

export interface SetBonusTier {
  stats?: Record<string, number>;
  [key: string]: unknown;
}

export type SetBonusData = SetBonusTier[] | Record<string, unknown>;

export interface MajorId {
  displayName: string;
  description: string;
  abilities: unknown[];
}

export interface ItemRemotePayload {
  items: ItemStatMap[];
  sets: Record<string, SetBonusData>;
}

export interface ItemListEntry {
  name: string;
  [key: string]: unknown;
}
