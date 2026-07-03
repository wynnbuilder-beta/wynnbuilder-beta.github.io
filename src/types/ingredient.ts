/**
 * Ingredient and recipe data shapes.
 */

export interface Ingredient {
  name?: string;
  displayName?: string;
  tier?: number | string;
  skills?: number[];
  ids?: Record<string, number>;
  [key: string]: unknown;
}

export interface Recipe {
  name?: string;
  materials?: Record<string, number>;
  [key: string]: unknown;
}

export type IngredientMap = Map<string, Ingredient>;
export type RecipeMap = Map<string, Recipe>;

export interface IngredientRemotePayload {
  [id: string]: Ingredient;
}

export interface RecipeRemotePayload {
  recipes: Record<string, Recipe>;
}
