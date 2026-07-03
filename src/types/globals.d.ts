import type { ExpandedItem, ItemStatMap, MajorId, SetBonusData } from './types/item';
import type { Ingredient, Recipe } from './types/ingredient';
import type { Loader } from './loader';

declare global {
  interface Window {
    Loader: typeof Loader;
    toggleIcons?: () => void;
    toggle_tab?: (id: string) => void;
    opera?: string;
  }

  interface HTMLInputElement {
    /** Custom slider accent color used by gen_slider/recolor_slider. */
    color?: string;
  }

  // Item loader
  var itemMap: Map<string, ExpandedItem>;
  var idMap: Map<number, string>;
  var redirectMap: Map<number, string>;
  var itemLists: Map<string, string[]>;
  var items: ItemStatMap[];
  var sets: Map<string, SetBonusData>;
  var none_items: ItemStatMap[];
  var MAJOR_IDS: Record<string, MajorId> | null;
  var wynn_version_names: string[];
  var WYNN_VERSION_LATEST: number;
  var wynn_version_id: number;
  var ENC: unknown;
  var DEC: unknown;
  var item_loader: Loader;

  // Ingredient loader
  var ingMap: Map<string, Ingredient>;
  var ingList: string[];
  var recipeMap: Map<string, Recipe>;
  var recipeList: string[];
  var ingIDMap: Map<number, string>;
  var recipeIDMap: Map<number, string>;
  var ings: Record<string, Ingredient> | Ingredient[];
  var recipes: Record<string, Recipe> | Recipe[];
  var ingredient_loader: Loader;
  /** @deprecated Use ingredient_loader */
  var ing_loader: Loader;

  // Builder
  var player_build: unknown;
  var powder_inputs: HTMLInputElement[];
  var equipment_inputs: HTMLInputElement[];
  var tomeInputs: HTMLInputElement[];
  var specialNames: string[];

  // Utils
  function sleep(ms: number): Promise<void>;
  function setValue(id: string, value: string): void;
}

export {};
