import { damageClasses, skp_order } from '@/build_utils';
import { attachGlobals, live } from '@/lib/attachGlobals';
import { Loader } from '@/loader';
import { POWDER_TIERS } from '@/powders';
import type { Ingredient, Recipe, RecipeRemotePayload } from '@/types/ingredient';
import type { JsonPayload, RejectFn } from '@/types/loader';

const ING_DB_VERSION = 53;

const ROMAN_NUMERAL_MAP = new Map<number, string>([
  [1, 'I'],
  [2, 'II'],
  [3, 'III'],
  [4, 'IV'],
  [5, 'V'],
  [6, 'VI'],
  [7, 'VII'],
]);

export let ings: Ingredient[] | Record<string, Ingredient>;
export let recipes: Recipe[] | Record<string, Recipe>;

export let ingMap = new Map<string, Ingredient>();
export let ingList: string[] = [];

export let recipeMap: Map<string, Recipe>;
export let recipeList: string[] = [];

export let ingIDMap = new Map<number, string>();
export let recipeIDMap: Map<number, string>;

export class IngredientLoader extends Loader {
  process_local(tsx: IDBTransaction, reject: RejectFn) {
    const ings_store = tsx.objectStore('ing_db');
    const recipes_store = tsx.objectStore('recipe_db');

    const ing_req = ings_store.getAll();
    ing_req.onerror = () => {
      reject('Could not read local ingredient db...');
    };
    ing_req.onsuccess = (event) => {
      ings = (event.target as IDBRequest<Ingredient[]>).result;
      console.log('Successfully read local ingredient db.');
    };

    const recipe_req = recipes_store.getAll();
    recipe_req.onerror = () => {
      reject('Could not read local recipe db...');
    };
    recipe_req.onsuccess = (event) => {
      recipes = (event.target as IDBRequest<Recipe[]>).result;
      console.log('Successfully read local recipe db.');
    };
  }

  get old_data_paths() {
    return ['ingreds', 'recipes'];
  }

  async process_old_version(data: JsonPayload) {
    const payload = data as [Record<string, Ingredient>, RecipeRemotePayload];
    ings = payload[0];
    for (const id in ings) {
      clean_ing(ings[id]);
    }
    recipes = payload[1].recipes;
  }

  get remote_paths() {
    return [
      'data/baseline/compressed/ingreds_compress',
      'data/baseline/compressed/recipes_compress',
    ];
  }

  process_remote(data: JsonPayload, tsx: IDBTransaction, reject: RejectFn) {
    const payload = data as [Record<string, Ingredient>, RecipeRemotePayload];
    ings = payload[0];
    recipes = payload[1].recipes;
    const ings_store = tsx.objectStore('ing_db');
    for (const id in ings) {
      clean_ing(ings[id]);
      const add_ing_req = ings_store.add(ings[id], id);
      add_ing_req.onerror = (err) => {
        reject('ADD INGREDIENT ERROR? ' + err);
      };
    }
    const recipes_store = tsx.objectStore('recipe_db');
    for (const recipe in recipes) {
      recipes_store.add((recipes as Record<string, Recipe>)[recipe], recipe);
      (recipes_store as unknown as { onerror: (err: Event) => void }).onerror = (err) => {
        reject('ADD INGREDIENT ERROR? ' + err);
      };
    }
  }

  init_maps() {
    recipeMap = new Map();
    recipeIDMap = new Map();

    const no_ing = {
      name: 'No Ingredient',
      displayName: 'No Ingredient',
      tier: 0,
      lvl: 0,
      skills: [
        'ARMOURING',
        'TAILORING',
        'WEAPONSMITHING',
        'WOODWORKING',
        'JEWELING',
        'COOKING',
        'ALCHEMISM',
        'SCRIBING',
      ],
      ids: {},
      itemIDs: { dura: 0, strReq: 0, dexReq: 0, intReq: 0, defReq: 0, agiReq: 0 },
      consumableIDs: { dura: 0, charges: 0 },
      posMods: { left: 0, right: 0, above: 0, under: 0, touching: 0, notTouching: 0 },
      id: 4000,
    } as unknown as Ingredient;

    ingMap.set(no_ing.displayName!, no_ing);
    ingList.push(no_ing.displayName!);
    ingIDMap.set(no_ing.id as number, no_ing.displayName!);

    // pairs of (dura, req)
    const powder_ing_info: [number, number][] = [
      [-35, 0],
      [-52.5, 0],
      [-70, 10],
      [-91, 20],
      [-112, 28],
      [-133, 36],
      [-154, 44],
    ];
    for (let i = 0; i < 5; i++) {
      for (let powder_tier = 0; powder_tier < POWDER_TIERS; ++powder_tier) {
        const powder_info = powder_ing_info[powder_tier];
        const ing = {
          name:
            '' +
            damageClasses[i + 1] +
            ' Powder ' +
            ROMAN_NUMERAL_MAP.get(powder_tier + 1),
          tier: 0,
          lvl: 0,
          skills: ['ARMOURING', 'TAILORING', 'WEAPONSMITHING', 'WOODWORKING', 'JEWELING'],
          ids: {},
          isPowder: true,
          pid: POWDER_TIERS * i + powder_tier,
          itemIDs: {
            dura: powder_info[0],
            strReq: 0,
            dexReq: 0,
            intReq: 0,
            defReq: 0,
            agiReq: 0,
          },
          consumableIDs: { dura: 0, charges: 0 },
          posMods: { left: 0, right: 0, above: 0, under: 0, touching: 0, notTouching: 0 },
        } as unknown as Ingredient;
        ing.id = 4001 + (ing.pid as number);
        ing.displayName = ing.name;
        (ing.itemIDs as Record<string, number>)[skp_order[i] + 'Req'] = powder_info[1];
        ingMap.set(ing.displayName!, ing);
        ingList.push(ing.displayName!);
        ingIDMap.set(ing.id as number, ing.displayName!);
      }
    }

    for (const ing of ings as Ingredient[]) {
      ingMap.set(ing.displayName!, ing);
      ingList.push(ing.displayName!);
      ingIDMap.set(ing.id as number, ing.displayName!);
    }
    for (const recipe of recipes as Recipe[]) {
      recipeMap.set(recipe.name!, recipe);
      recipeList.push(recipe.name!);
      recipeIDMap.set(recipe.id as number, recipe.name!);
    }
  }
}

export function clean_ing(ing: Ingredient) {
  if (ing.remapID === undefined) {
    if (ing.displayName === undefined) {
      ing.displayName = ing.name;
    }
  }
}

export const ingredient_loader = new IngredientLoader(
  'ing_db',
  ['ing_db', 'recipe_db'],
  ING_DB_VERSION,
);

attachGlobals({
  IngredientLoader,
  ingredient_loader,
  ing_loader: ingredient_loader,
  ings: live(
    () => ings,
    (v) => {
      ings = v as Ingredient[] | Record<string, Ingredient>;
    },
  ),
  recipes: live(
    () => recipes,
    (v) => {
      recipes = v as Recipe[] | Record<string, Recipe>;
    },
  ),
  ingMap,
  ingList,
  recipeMap: live(
    () => recipeMap,
    (v) => {
      recipeMap = v as Map<string, Recipe>;
    },
  ),
  recipeList,
  ingIDMap,
  recipeIDMap: live(
    () => recipeIDMap,
    (v) => {
      recipeIDMap = v as Map<number, string>;
    },
  ),
  clean_ing,
});
