import { attachGlobals } from './lib/attachGlobals';
import {
  accessoryTypes,
  armorTypes,
  consumableTypes,
  expandIngredient,
  expandRecipe,
  rolledIDs,
  skp_elements,
  skp_order,
  weaponTypes,
} from './build_utils';
import { powderNames, powderStats } from './powders';
import { assert, Base64, BitVector, BitVectorCursor, EncodingBitVector } from './utils';
import type { ExpandedItem } from './types/item';

interface BitVectorInstance {
  sliceB64(start: number, end: number): string;
}

interface BitVectorCursorInstance {
  currIdx: number;
  bitVec: BitVectorInstance;
  advance(): number;
  advanceBy(n: number): number;
  skip(n: number): void;
}

export type CraftAttackSpeed = 'SLOW' | 'NORMAL' | 'FAST';

export interface CrafterEnc {
  CRAFTED_ATK_SPD: Record<string, number> & { BITLEN: number };
  CRAFTED_ATK_SPD_ID?: string[];
  MAT_TIERS: number;
  MAT_TIER_BITLEN: number;
  NUM_MATS: number;
  NUM_INGS: number;
  ING_ID_BITLEN: number;
  RECIPE_ID_BITLEN: number;
  CRAFTED_VERSION_BITLEN: number;
  CRAFTED_ENCODING_VERSION: number;
}

export const recipeTypes = [
  'HELMET',
  'CHESTPLATE',
  'LEGGINGS',
  'BOOTS',
  'RELIK',
  'WAND',
  'SPEAR',
  'DAGGER',
  'BOW',
  'RING',
  'NECKLACE',
  'BRACELET',
  'POTION',
  'SCROLL',
  'FOOD',
];

export const levelTypes = [
  '1-3',
  '3-5',
  '5-7',
  '7-9',
  '10-13',
  '13-15',
  '15-17',
  '17-19',
  '20-23',
  '23-25',
  '25-27',
  '27-29',
  '30-33',
  '33-35',
  '35-37',
  '37-39',
  '40-43',
  '43-45',
  '45-47',
  '47-49',
  '50-53',
  '53-55',
  '55-57',
  '57-59',
  '60-63',
  '63-65',
  '65-67',
  '67-69',
  '70-73',
  '73-75',
  '75-77',
  '77-79',
  '80-83',
  '83-85',
  '85-87',
  '87-89',
  '90-93',
  '93-95',
  '95-97',
  '97-99',
  '100-103',
  '103-105',
  '105-107',
  '107-109',
  '110-113',
  '113-115',
  '115-117',
  '117-119',
];

/**
 * A constant encompassing all the necessary info for crafted item encoding.
 * if something in this structure changes, the version number must be increased
 * and handled in the respective decoder.
 * The values are detailed in ENCODING.md.
 */
export const CRAFTER_ENC: CrafterEnc = {
  CRAFTED_ATK_SPD: {
    SLOW: 0,
    NORMAL: 1,
    FAST: 2,
    BITLEN: 4,
  },
  MAT_TIERS: 3,
  MAT_TIER_BITLEN: 3,
  NUM_MATS: 2,
  NUM_INGS: 6,
  ING_ID_BITLEN: 12,
  RECIPE_ID_BITLEN: 12,
  CRAFTED_VERSION_BITLEN: 7,
  CRAFTED_ENCODING_VERSION: 2,
};

// An array which is the inverse of CRAFTER_ENC.CRAFTED_STK_SPD to map ID => name
CRAFTER_ENC.CRAFTED_ATK_SPD_ID = Object.keys(CRAFTER_ENC.CRAFTED_ATK_SPD).slice(0, -1);

type IngredientMap = Map<string, unknown>;

/**
 * @param craft
 * Encodes a given craft and returns the resulting bit vector.
 */
export function encodeCraft(craft: Craft | null | undefined): EncodingBitVector {
  const craftVec = new EncodingBitVector(0, 0, CRAFTER_ENC);
  if (!craft) return craftVec;
  // Legacy versions always start with their first bit set
  craftVec.append(0, 1);

  // Encode version
  craftVec.append(CRAFTER_ENC.CRAFTED_ENCODING_VERSION, CRAFTER_ENC.CRAFTED_VERSION_BITLEN);

  // Encode ingredients
  for (const ing of craft.ingreds) {
    craftVec.append(ing.get('id') as number, CRAFTER_ENC.ING_ID_BITLEN);
  }

  // Encode recipe
  craftVec.append(craft.recipe.get('id') as number, CRAFTER_ENC.RECIPE_ID_BITLEN);

  // Encode material tiers
  for (const mat_tier of craft.mat_tiers) {
    craftVec.append(mat_tier - 1, CRAFTER_ENC.MAT_TIER_BITLEN);
  }

  // Encode attack speed
  if (craft.statMap.get('category') === 'weapon') {
    craftVec.append(CRAFTER_ENC.CRAFTED_ATK_SPD[craft.atkSpd], CRAFTER_ENC.CRAFTED_ATK_SPD.BITLEN);
  }

  // Pad to fit into a B64 string perfectly
  craftVec.append(0, 6 - ((craftVec as unknown as { length: number }).length % 6));
  return craftVec;
}

export interface DecodeCraftArgs {
  cursor?: BitVectorCursorInstance;
  hash?: string;
}

/**
 * Decodes a given craft and returns the resulting crafted item.
 * Falls back to legacy parsing if the hash is in legacy format, see `getCraftFromHash`.
 */
export function decodeCraft({ cursor, hash }: DecodeCraftArgs): Craft | undefined {
  if (cursor === undefined) {
    assert(hash !== undefined, 'decodeCraft must be called with either a URL or a BitVectorCursor.');
    cursor = new BitVectorCursor(new BitVector(hash!, hash!.length * 6));
  }

  // Since the cursor doesn't necessarily point to the beginning of the hash
  // (in the case where it's part of a build's URL encoding) save it so we can
  // slice off just the hash of the item.
  const hashStartIdx = cursor.currIdx;

  // 1 if legacy encoding, 0 otherwise
  const legacy = cursor.advance();
  if (legacy) {
    return getCraftFromHash('CR-' + hash);
  }

  // Here for future usage
  cursor.advanceBy(CRAFTER_ENC.CRAFTED_VERSION_BITLEN);

  // Decode ingredients
  const ings: IngredientMap[] = [];
  for (let i = 0; i < CRAFTER_ENC.NUM_INGS; ++i) {
    const ing = ingMap.get(ingIDMap.get(cursor.advanceBy(CRAFTER_ENC.ING_ID_BITLEN))!);
    ings.push(expandIngredient(ing!));
  }

  // Decode recipe
  const recipe = expandRecipe(recipeMap.get(recipeIDMap.get(cursor.advanceBy(CRAFTER_ENC.RECIPE_ID_BITLEN))!)!);

  // Decode material tiers
  const matTiers: number[] = [];
  for (let i = 0; i < CRAFTER_ENC.NUM_MATS; ++i) {
    matTiers.push(cursor.advanceBy(CRAFTER_ENC.MAT_TIER_BITLEN) + 1);
  }

  // Decode attack speed, set default to slow
  let atkSpd: CraftAttackSpeed = 'SLOW';
  if (weaponTypes.includes(recipe.get('type') as (typeof weaponTypes)[number])) {
    atkSpd = CRAFTER_ENC.CRAFTED_ATK_SPD_ID![cursor.advanceBy(CRAFTER_ENC.CRAFTED_ATK_SPD.BITLEN)] as CraftAttackSpeed;
  }

  // Skip padding
  cursor.skip(6 - ((cursor.currIdx - hashStartIdx) % 6));

  return new Craft(recipe, matTiers, ings, atkSpd, cursor.bitVec.sliceB64(hashStartIdx, cursor.currIdx));
}

/**
 * Legacy version of `encodeCraft`.
 * here for documentation only.
 */
export function encodeCraftLegacy(craft: Craft | null | undefined): string {
  if (craft) {
    const atkSpds: CraftAttackSpeed[] = ['SLOW', 'NORMAL', 'FAST'];
    const craft_string =
      '1' +
      Base64.fromIntN(craft.ingreds[0].get('id') as number, 2) +
      Base64.fromIntN(craft.ingreds[1].get('id') as number, 2) +
      Base64.fromIntN(craft.ingreds[2].get('id') as number, 2) +
      Base64.fromIntN(craft.ingreds[3].get('id') as number, 2) +
      Base64.fromIntN(craft.ingreds[4].get('id') as number, 2) +
      Base64.fromIntN(craft.ingreds[5].get('id') as number, 2) +
      Base64.fromIntN(craft.recipe.get('id') as number, 2) +
      Base64.fromIntN(craft.mat_tiers[0] + (craft.mat_tiers[1] - 1) * 3, 1) +
      Base64.fromIntN(atkSpds.indexOf(craft.atkSpd), 1);
    return craft_string;
  }
  return '';
}

/**
 * Legacy verison of `decodeCraft`.
 */
export function getCraftFromHash(hash: string): Craft | undefined {
  let name = hash.slice();
  try {
    if (name.slice(0, 3) === 'CR-') {
      name = name.substring(3);
    } else {
      throw new Error('Not a crafted item!');
    }
    const version = name.substring(0, 1);
    name = name.substring(1);
    if (version === '1') {
      const ingreds: IngredientMap[] = [];
      for (let i = 0; i < 6; i++) {
        ingreds.push(
          expandIngredient(ingMap.get(ingIDMap.get(Base64.toInt(name.substring(2 * i, 2 * i + 2)))!)!),
        );
      }
      const recipe = expandRecipe(recipeMap.get(recipeIDMap.get(Base64.toInt(name.substring(12, 14)))!)!);

      const tierNum = Base64.toInt(name.substring(14, 15));
      const mat_tiers: number[] = [];
      mat_tiers.push(tierNum % 3 == 0 ? 3 : tierNum % 3);
      mat_tiers.push(Math.floor((tierNum - 0.5) / 3) + 1);
      const atkSpd = Base64.toInt(name.substring(15));
      const atkSpds: CraftAttackSpeed[] = ['SLOW', 'NORMAL', 'FAST'];
      const attackSpeed = atkSpds[atkSpd];
      return new Craft(recipe, mat_tiers, ingreds, attackSpeed, '1' + name);
    }
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

function statNum(map: ExpandedItem, key: string): number {
  return (map.get(key) as number) ?? 0;
}

function statStr(map: ExpandedItem, key: string): string {
  return (map.get(key) as string) ?? '';
}

/**
 * Creates a crafted item object.
 */
export class Craft {
  recipe: ExpandedItem;
  mat_tiers: number[];
  ingreds: IngredientMap[];
  statMap: ExpandedItem;
  atkSpd: CraftAttackSpeed;
  hash: string;

  /* Constructs a craft.
     @param recipe: Helmet-1-3 (id), etc. A recipe object.
     @param mat_tiers: [1->3, 1->3]. An array with 2 numbers.
     @param ingreds: []. An array with 6 entries, each with an ingredient Map.
  */
  constructor(
    recipe: ExpandedItem,
    mat_tiers: number[],
    ingreds: IngredientMap[],
    attackSpeed: CraftAttackSpeed,
    hash: string,
  ) {
    this.recipe = recipe;
    this.mat_tiers = mat_tiers;
    this.ingreds = ingreds;
    this.statMap = new Map();
    this.atkSpd = attackSpeed;
    this.hash = 'CR-' + hash;
    this.initCraftStats();
    this.statMap.set('hash', this.hash);
  }

  applyPowders(): void {
    // Legacy bug preserved: `get("category" === "accessory")` is always `get(false)`.
    if (this.statMap.get('category') === 'armor' || this.statMap.get(false as unknown as string)) {
      //double apply armor powders
      for (const id of this.statMap.get('powders') as number[]) {
        const powder = powderStats[id];
        const name = powderNames.get(id)!;
        this.statMap.set(
          name.charAt(0) + 'Def',
          (statNum(this.statMap, name.charAt(0) + 'Def') || 0) + 2 * powder.defPlus,
        );
        this.statMap.set(
          skp_elements[(skp_elements.indexOf(name.charAt(0) as (typeof skp_elements)[number]) + 4) % 5] + 'Def',
          (statNum(
            this.statMap,
            skp_elements[(skp_elements.indexOf(name.charAt(0) as (typeof skp_elements)[number]) + 4) % 5] + 'Def',
          ) || 0) -
            2 * powder.defMinus,
        );
      }
    } else if (this.statMap.get('category') === 'weapon') {
      //do nothing - weapon powders are handled in displayExpandedItem
    }
  }

  setHash(hash: string): void {
    this.hash = 'CR-' + hash;
    this.statMap.set('name', this.hash);
    this.statMap.set('displayName', this.hash);
    this.statMap.set('hash', this.hash);
  }

  /*  Get all stats for this build. Stores in this.statMap.
      @pre The craft itself should be valid. No checking of validity of pieces is done here.
  */
  initCraftStats(): void {
    const statMap = new Map<string, unknown>();
    statMap.set('minRolls', new Map<string, number>());
    statMap.set('maxRolls', new Map<string, number>());
    statMap.set('name', this.hash);
    statMap.set('displayName', this.hash);
    statMap.set('tier', 'Crafted');
    statMap.set('type', (this.recipe.get('type') as string).toLowerCase());
    statMap.set('duration', [this.recipe.get('duration')[0], this.recipe.get('duration')[1]]);
    statMap.set('durability', [this.recipe.get('durability')[0], this.recipe.get('durability')[1]]);
    statMap.set('lvl', (this.recipe.get('lvl') as number[])[1]);
    statMap.set('lvlLow', (this.recipe.get('lvl') as number[])[0]);
    statMap.set('nDam', 0);
    statMap.set('hp', 0);
    statMap.set('hpLow', 0);
    for (const e of skp_elements) {
      statMap.set(e + 'Dam', '0-0');
      statMap.set(e + 'Def', 0);
    }
    for (const e of skp_order) {
      statMap.set(e + 'Req', 0);
      statMap.set(e, 0);
    }
    let allNone = true;
    const itemType = statMap.get('type') as string;
    if (armorTypes.includes(itemType) || weaponTypes.includes(itemType as (typeof weaponTypes)[number])) {
      statMap.set('category', 'weapon');
      if ((this.recipe.get('lvl') as number[])[0] < 30) {
        statMap.set('slots', 1);
      } else if ((this.recipe.get('lvl') as number[])[0] < 70) {
        statMap.set('slots', 2);
      } else {
        statMap.set('slots', 3);
      }
    } else {
      statMap.set('slots', 0);
    }
    if (consumableTypes.includes(itemType)) {
      statMap.set('category', 'consumable');
      if ((this.recipe.get('lvl') as number[])[0] < 30) {
        statMap.set('charges', 1);
      } else if ((this.recipe.get('lvl') as number[])[0] < 70) {
        statMap.set('charges', 2);
      } else {
        statMap.set('charges', 3);
      }

      for (const ingred of this.ingreds) {
        if (ingred.get('name') !== 'No Ingredient') {
          allNone = false;
          break;
        }
      }
      if (allNone) {
        statMap.set('charges', 3);
        statMap.set('hp', (this.recipe.get('healthOrDamage') as number[]).join('-'));
        statMap.set('duration', this.recipe.get('basicDuration'));
      }
      statMap.set('category', 'consumable');
    } else {
      statMap.set('charges', 0);
    }

    if (armorTypes.includes(itemType)) {
      statMap.set('hp', (this.recipe.get('healthOrDamage') as number[]).join('-'));
      statMap.set('category', 'armor');
    } else if (weaponTypes.includes(itemType as (typeof weaponTypes)[number])) {
      statMap.set('nDam', (this.recipe.get('healthOrDamage') as number[]).join('-'));
      for (const e of skp_elements) {
        statMap.set(e + 'Dam', '0-0');
        statMap.set(e + 'DamLow', '0-0');
      }
      statMap.set('category', 'weapon');
      statMap.set('atkSpd', this.atkSpd);
    }
    if (accessoryTypes.includes(itemType)) {
      statMap.set('category', 'accessory');
    }
    statMap.set('powders', []);

    let matmult = 1;
    const tierToMult = [0, 1, 1.25, 1.4];
    const tiers = this.mat_tiers.slice();
    const amounts = (this.recipe.get('materials') as Map<string, unknown>[]).map((x) => x.get('amount') as number);
    matmult = (tierToMult[tiers[0]] * amounts[0] + tierToMult[tiers[1]] * amounts[1]) / (amounts[0] + amounts[1]);

    let low = (this.recipe.get('healthOrDamage') as number[])[0];
    let high = (this.recipe.get('healthOrDamage') as number[])[1];
    if (statMap.get('category') === 'consumable') {
      if (allNone) {
        statMap.set('hp', Math.floor(low * matmult) + '-' + Math.floor(high * matmult));
      }
      statMap.set('duration', [
        Math.round((statMap.get('duration') as number[])[0] * matmult),
        Math.round((statMap.get('duration') as number[])[1] * matmult),
      ]);
    } else {
      statMap.set('durability', [
        Math.round((statMap.get('durability') as number[])[0] * matmult),
        Math.round((statMap.get('durability') as number[])[1] * matmult),
      ]);
    }
    if (statMap.get('category') === 'weapon') {
      let ratio = 2.05;
      if (this.atkSpd === 'SLOW') {
        ratio /= 1.5;
      } else if (this.atkSpd === 'NORMAL') {
        ratio = 1;
      } else if (this.atkSpd === 'FAST') {
        ratio /= 2.5;
      }
      let nDamBaseLow = Math.floor(low * matmult);
      let nDamBaseHigh = Math.floor(high * matmult);
      nDamBaseLow = Math.floor(nDamBaseLow * ratio);
      nDamBaseHigh = Math.floor(nDamBaseHigh * ratio);
      const elemDamBaseLow = [0, 0, 0, 0, 0];
      const elemDamBaseHigh = [0, 0, 0, 0, 0];
      const powders: number[] = [];
      for (const n in this.ingreds) {
        const ingred = this.ingreds[n];
        if (ingred.get('isPowder')) {
          powders.push(ingred.get('pid') as number);
        }
      }
      statMap.set('ingredPowders', powders);

      let low1 = Math.floor(nDamBaseLow * 0.9);
      let low2 = Math.floor(nDamBaseLow * 1.1);
      let high1 = Math.floor(nDamBaseHigh * 0.9);
      let high2 = Math.floor(nDamBaseHigh * 1.1);
      statMap.set('nDamBaseLow', nDamBaseLow);
      statMap.set('nDamBaseHigh', nDamBaseHigh);
      statMap.set('nDamLow', low1 + '-' + low2);
      statMap.set('nDam', high1 + '-' + high2);
      for (const e in skp_elements) {
        statMap.set(skp_elements[e] + 'DamBaseLow', elemDamBaseLow[e]);
        statMap.set(skp_elements[e] + 'DamBaseHigh', elemDamBaseHigh[e]);
        low1 = Math.floor(elemDamBaseLow[e] * 0.9);
        low2 = Math.floor(elemDamBaseLow[e] * 1.1);
        high1 = Math.floor(elemDamBaseHigh[e] * 0.9);
        high2 = Math.floor(elemDamBaseHigh[e] * 1.1);
        statMap.set(skp_elements[e] + 'DamLow', low1 + '-' + low2);
        statMap.set(skp_elements[e] + 'Dam', high1 + '-' + high2);
      }
    } else if (statMap.get('category') === 'armor') {
      low = Math.floor(low * matmult);
      high = Math.floor(high * matmult);
      statMap.set('hp', high);
      statMap.set('hpLow', low);
    }
    if (statMap.get('category') === 'armor' || statMap.get('category') == 'accessory') {
      for (const n in this.ingreds) {
        const ingred = this.ingreds[n];
        if (ingred.get('isPowder')) {
          const powder = powderStats[ingred.get('pid') as number];
          const name = powderNames.get(ingred.get('pid') as number)!;
          statMap.set(
            name.charAt(0) + 'Def',
            (statNum(statMap as ExpandedItem, name.charAt(0) + 'Def') || 0) + powder.defPlus,
          );
          statMap.set(
            skp_elements[(skp_elements.indexOf(name.charAt(0) as (typeof skp_elements)[number]) + 4) % 5] + 'Def',
            (statNum(
              statMap as ExpandedItem,
              skp_elements[(skp_elements.indexOf(name.charAt(0) as (typeof skp_elements)[number]) + 4) % 5] + 'Def',
            ) || 0) - powder.defMinus,
          );
        }
      }
    }

    const eff: number[][] = [
      [100, 100],
      [100, 100],
      [100, 100],
    ];
    for (const n in this.ingreds) {
      const ingred = this.ingreds[n];
      const i = Math.floor(Number(n) / 2);
      const j = Number(n) % 2;
      for (const [key, value] of ingred.get('posMods') as Map<string, number>) {
        if (value == 0) {
          continue;
        } else {
          if (key === 'above') {
            for (let k = i - 1; k > -1; k--) {
              eff[k][j] += value;
            }
          } else if (key === 'under') {
            for (let k = i + 1; k < 3; k++) {
              eff[k][j] += value;
            }
          } else if (key === 'left') {
            if (j == 1) {
              eff[i][j - 1] += value;
            }
          } else if (key === 'right') {
            if (j == 0) {
              eff[i][j + 1] += value;
            }
          } else if (key === 'touching') {
            for (const k in eff) {
              for (const l in eff[k]) {
                if (
                  (Math.abs(Number(k) - i) == 1 && Math.abs(Number(l) - j) == 0) ||
                  (Math.abs(Number(k) - i) == 0 && Math.abs(Number(l) - j) == 1)
                ) {
                  eff[k][l] += value;
                }
              }
            }
          } else if (key === 'notTouching') {
            for (const k in eff) {
              for (const l in eff[k]) {
                if (Math.abs(Number(k) - i) > 1 || (Math.abs(Number(k) - i) == 1 && Math.abs(Number(l) - j) == 1)) {
                  eff[k][l] += value;
                }
              }
            }
          } else {
            console.log('Something went wrong. Please contact hppeng.');
          }
        }
      }
    }

    const eff_flat = eff.flat();
    statMap.set('ingredEffectiveness', eff_flat);
    for (const n in this.ingreds) {
      const ingred = this.ingreds[n];
      const eff_mult = Number((eff_flat[n] / 100).toFixed(2));
      for (const [key, value] of ingred.get('itemIDs') as Map<string, number>) {
        if (key !== 'dura' && !consumableTypes.includes(statStr(statMap as ExpandedItem, 'type'))) {
          if (!ingred.get('isPowder')) {
            statMap.set(key, statNum(statMap as ExpandedItem, key) + Math.round(value * eff_mult + 1e-9));
          } else {
            statMap.set(key, statNum(statMap as ExpandedItem, key) + Math.round(value));
          }
        } else {
          statMap.set(
            'durability',
            (statMap.get('durability') as number[]).map((x) => x + value),
          );
        }
      }
      for (const [key, value] of ingred.get('consumableIDs') as Map<string, number>) {
        if (key === 'dura') {
          statMap.set(
            'duration',
            (statMap.get('duration') as number[]).map((x) => x + value),
          );
        } else {
          statMap.set(key, (statMap.get('charges') as number) + value);
        }
      }
      for (const [key, value] of (ingred.get('ids') as Map<string, Map<string, number>>).get('maxRolls')!) {
        if (value && value != 0) {
          let rolls = [
            (ingred.get('ids') as Map<string, Map<string, number>>).get('minRolls')!.get(key)!,
            value,
          ];
          rolls = rolls.map((x) => Math.floor(x * eff_mult)).sort(function (a, b) {
            return a - b;
          });
          (statMap.get('minRolls') as Map<string, number>).set(
            key,
            (statMap.get('minRolls') as Map<string, number>).get(key)
              ? (statMap.get('minRolls') as Map<string, number>).get(key)! + rolls[0]
              : rolls[0],
          );
          (statMap.get('maxRolls') as Map<string, number>).set(
            key,
            (statMap.get('maxRolls') as Map<string, number>).get(key)
              ? (statMap.get('maxRolls') as Map<string, number>).get(key)! + rolls[1]
              : rolls[1],
          );
        }
      }
    }
    for (const d in statMap.get('durability') as number[]) {
      if ((statMap.get('durability') as number[])[d] < 1) {
        statMap.set('missingDurability', (statMap.get('durability') as number[])[d]);
        (statMap.get('durability') as number[])[d] = 0;
      } else {
        (statMap.get('durability') as number[])[d] = Math.floor((statMap.get('durability') as number[])[d]);
      }
    }
    for (const d in statMap.get('duration') as number[]) {
      if (!allNone && (statMap.get('duration') as number[])[d] < 1) {
        statMap.set('missingDuration', (statMap.get('duration') as number[])[d]);
        (statMap.get('duration') as number[])[d] = 1;
      }
    }
    if (statMap.has('charges') && (statMap.get('charges') as number) < 1) {
      statMap.set('charges', 1);
    }

    statMap.set('reqs', [0, 0, 0, 0, 0]);
    statMap.set('skillpoints', [0, 0, 0, 0, 0]);
    for (const e in skp_order) {
      statMap.set(
        skp_order[e],
        (statMap.get('maxRolls') as Map<string, number>).has(skp_order[e])
          ? (statMap.get('maxRolls') as Map<string, number>).get(skp_order[e])
          : 0,
      );
      (statMap.get('skillpoints') as number[])[e] = (statMap.get('maxRolls') as Map<string, number>).has(skp_order[e])
        ? (statMap.get('maxRolls') as Map<string, number>).get(skp_order[e])!
        : 0;
      (statMap.get('reqs') as number[])[e] = statMap.has(skp_order[e] + 'Req') &&
        !consumableTypes.includes(statStr(statMap as ExpandedItem, 'type'))
        ? statNum(statMap as ExpandedItem, skp_order[e] + 'Req')
        : 0;
    }
    for (const id of rolledIDs) {
      if ((statMap.get('minRolls') as Map<string, number>).has(id)) {
        continue;
      } else {
        (statMap.get('minRolls') as Map<string, number>).set(id, 0);
        (statMap.get('maxRolls') as Map<string, number>).set(id, 0);
      }
    }

    statMap.set('crafted', true);
    this.statMap = statMap as ExpandedItem;
  }

  copy(): Craft {
    return new Craft(this.recipe, this.mat_tiers, this.ingreds, this.atkSpd, this.hash.slice(3));
  }
}

attachGlobals({
  recipeTypes,
  levelTypes,
  CRAFTER_ENC,
  encodeCraft,
  decodeCraft,
  encodeCraftLegacy,
  getCraftFromHash,
  Craft,
});
