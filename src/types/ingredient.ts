/**
 * Ingredient and recipe data shapes.
 */

export interface IngredientStatRange {
  minimum: number;
  maximum: number;
}

export interface IngredientPosMods {
  left: number;
  right: number;
  above: number;
  under: number;
  touching: number;
  notTouching: number;
}

export interface Ingredient {
  name?: string;
  displayName?: string;
  type?: string;
  icon?: string;
  emblem?: string;
  tier?: number | string;
  lvl?: number;
  skills?: string[];
  ids?: Record<string, IngredientStatRange>;
  consumableIDs?: Record<string, number>;
  itemIDs?: Record<string, number>;
  posMods?: IngredientPosMods;
  id?: number;
  remapID?: unknown;
  isPowder?: boolean;
  pid?: number;
}

export interface RecipeMaterial {
  item: string;
  amount: number;
}

export interface RecipeStatRange {
  minimum: number;
  maximum: number;
}

export interface Recipe {
  name?: string;
  type?: string;
  skill?: string;
  materials?: RecipeMaterial[];
  healthOrDamage?: RecipeStatRange;
  durability?: RecipeStatRange;
  duration?: RecipeStatRange;
  basicDuration?: RecipeStatRange;
  lvl?: RecipeStatRange;
  id?: number;
}

/** Post-`expandIngredient()` map used in display, search, and craft. */
export type ExpandedIngredient = Map<string, unknown>;

/** Post-`expandRecipe()` map used in craft and builder graph. */
export type ExpandedRecipe = Map<string, unknown>;

/** displayName → ingredient from load_ing.init_maps(). */
export type IngredientLookupMap = Map<string, Ingredient>;
export type RecipeLookupMap = Map<string, Recipe>;

/** Remote baseline/compressed payload — array of ingredients. */
export type IngredientRemotePayload = Ingredient[];

export interface RecipeRemotePayload {
  recipes: Recipe[];
  version?: number | string;
}
