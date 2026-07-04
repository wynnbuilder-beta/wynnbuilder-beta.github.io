import { wep_to_class } from '@/build_utils';
import { decodeCraft, encodeCraft, encodeCraftLegacy, getCraftFromHash } from '@/craft';
import { decodeCustom, encodeCustom, getCustomFromHash } from '@/custom';
import { aspect_id_map, aspect_loader, none_aspect } from '@/load_aspect';
import { ingredient_loader } from '@/load_ing';
import {
  DEC,
  ENC,
  idMap,
  item_loader,
  itemMap,
  load_encoding_constants,
  load_major_id_data,
  redirectMap,
  setWynnVersionId,
  WYNN_VERSION_LATEST,
  wynn_version_id,
  wynn_version_names,
} from '@/load_item';
import { tome_loader, tomeIDMap, tomeRedirectMap } from '@/load_tome';
import { decodePowderIdx, encodePowderIdx, powderNames, POWDER_TIERS } from '@/powders';
import { NUM_ASPECTS } from '@/types/aspect';
import type { AspectTuple } from '@/types/aspect';
import type { ATree, ATreeNode, RenderedATree } from '@/types/atree';
import type { BuildItemRef, EncodingConstants, PlayerBuild } from '@/types/build';
import { TOME_SLOT_COUNT } from '@/types/build';
import type { DecodedSkillpoints, SkillpointVector } from '@/types/stats';
import type { PlayerClass } from '@/types/stats';
import {
  assert,
  Base64,
  BitVector,
  BitVectorCursor,
  copyTextToClipboard,
  EncodingBitVector,
  mod,
  setText,
  setValue,
  zip2,
} from '@/utils';
import { load_atree_data } from './atree';
import { aspect_agg_node } from './aspects';
import {
  aspectInputs,
  aspectTierInputs,
  equipment_inputs,
  powder_inputs,
  tomeInputs,
} from './builder_constants';

export let player_build: PlayerBuild | undefined = undefined;
export let build_powders: number[][] | undefined = undefined;
export let atree_data: BitVector | null = null;
export let LAST_LEGACY_VERSION = 18;

export function setPlayerBuild(build: PlayerBuild | undefined): void {
  player_build = build;
}

export function setBuildPowders(powders: number[][] | undefined): void {
  build_powders = powders;
}

export function setAtreeData(data: BitVector | null): void {
  atree_data = data;
}

interface BitVectorLike {
  length: number;
  append(data: number, length: number): void;
  readBit(idx: number): boolean;
  slice(start: number, end: number): number;
  sliceB64?(start: number, end: number): string;
  toB64(): string;
}

player_build = undefined;
build_powders = undefined;
atree_data = null;
LAST_LEGACY_VERSION = 18;

function enc(): EncodingConstants {
  return ENC as EncodingConstants;
}

function dec(): EncodingConstants {
  return DEC as EncodingConstants;
}

function getItemNameFromID(id: number): string | undefined {
  return idMap.get(id);
}

function getTomeNameFromID(id: number): string {
  const res = tomeIDMap.get(id);
  if (res === undefined) {
    console.log('WARN: Deleting unrecognized tome, id=' + id);
    return '';
  }
  return res;
}

/**
 * Load the latest version of hte data.
 * if the user has already opened the site before,
 * this saves bandwidth by using locally stored data.
 */
export async function loadLatestVersion(): Promise<void> {
  const latestVerName = wynn_version_names[WYNN_VERSION_LATEST];

  const loadPromises = [
    load_atree_data(latestVerName),
    load_major_id_data(latestVerName),
    item_loader.load_init(),
    ingredient_loader.load_init(),
    tome_loader.load_init(),
    aspect_loader.load_init(),
    load_encoding_constants(latestVerName),
  ];

  await Promise.all(loadPromises);
}

/**
 * Load an older version of the data, decoded from the build's hash.
 */
export async function loadOlderVersion(): Promise<void> {
  const updateMsg =
    'This build was created in an older version of wynncraft ' +
    `(${wynn_version_names[wynn_version_id]} < ${wynn_version_names[WYNN_VERSION_LATEST]}). ` +
    'Would you like to update to the latest version? Updating may break the build and ability tree.';

  const decodingVersion = wynn_version_id;
  // Upgrade the build to the latest version
  if (confirm(updateMsg)) {
    setWynnVersionId(WYNN_VERSION_LATEST);
  }

  const versionName = wynn_version_names[wynn_version_id];
  const decodingVersionName = wynn_version_names[decodingVersion];
  assert(decodingVersion <= wynn_version_id, 'decoding version cannot be larger than the encoding version.');
  const loadPromises = [
    load_atree_data(versionName),
    load_major_id_data(versionName),
    item_loader.load_old_version(versionName),
    ingredient_loader.load_old_version(versionName),
    tome_loader.load_old_version(versionName),
    aspect_loader.load_old_version(versionName),
    load_encoding_constants(versionName, decodingVersionName),
  ];
  console.log('Loading old version data...', versionName);
  await Promise.all(loadPromises);
}

/**
 * Encode the build's tomes and return the resulting vector.
 */
function encodeTomes(tomes: BuildItemRef[], _powders?: number[][], _version?: number): EncodingBitVector {
  const E = enc();
  const tomesVec = new EncodingBitVector(0, 0);
  if (tomes.every((t) => t.statMap.has('NONE'))) {
    tomesVec.appendFlag('TOMES_FLAG', 'NO_TOMES');
  } else {
    tomesVec.appendFlag('TOMES_FLAG', 'HAS_TOMES');
    for (const tome of tomes) {
      if (tome.statMap.get('NONE')) {
        tomesVec.appendFlag('TOME_SLOT_FLAG', 'UNUSED');
      } else {
        tomesVec.appendFlag('TOME_SLOT_FLAG', 'USED');
        tomesVec.append(tome.statMap.get('id') as number, E.TOME_ID_BITLEN);
      }
    }
  }
  return tomesVec;
}

/**
 * Collect identical powder elements, keeping their original order in place.
 * @WARN(orgold, in-game vers' 2.1.6): Do not change tier order; This affects powder specials.
 */
function collectPowders(powders: number[]): number[][] {
  const E = enc();
  const powderChunks: number[][] = E.POWDER_ELEMENTS.map(() => []);
  const order = E.POWDER_ELEMENTS.map(() => -1);
  let currOrder = 0;
  for (const powder of powders) {
    const elementIdx = Math.floor(powder / E.POWDER_TIERS);
    if (order[elementIdx] < 0) {
      powderChunks[currOrder].push(powder);
      order[elementIdx] = currOrder;
      currOrder += 1;
    } else {
      powderChunks[order[elementIdx]].push(powder);
    }
  }
  return powderChunks;
}

/**
 * Encode the powders for a given equipment piece and return the resulting vector.
 * Powder encoding is detailed in `ENCODING.md`.
 */
function encodePowders(powderset: number[], _version: number): EncodingBitVector {
  const E = enc();
  const powdersVec = new EncodingBitVector(0, 0);

  if (powderset.length === 0) {
    powdersVec.appendFlag('EQUIPMENT_POWDERS_FLAG', 'NO_POWDERS');
    return powdersVec;
  }

  const collectedPowders = collectPowders(powderset); // Collect repeating powders

  powdersVec.appendFlag('EQUIPMENT_POWDERS_FLAG', 'HAS_POWDERS');

  let previousPowder = -1;
  for (const powderChunk of collectedPowders) {
    let i = 0;
    let powder: number | undefined;
    while (i < powderChunk.length) {
      powder = powderChunk[i];
      if (previousPowder >= 0) {
        powdersVec.appendFlag('POWDER_REPEAT_OP', 'NO_REPEAT');
        if (powder % POWDER_TIERS === previousPowder % POWDER_TIERS) {
          powdersVec.appendFlag('POWDER_REPEAT_TIER_OP', 'REPEAT_TIER');
          const numElements = E.POWDER_ELEMENTS.length;
          const elementWrapper = mod((powder - previousPowder) / POWDER_TIERS, numElements) - 1;
          powdersVec.append(elementWrapper, E.POWDER_WRAPPER_BITLEN);
        } else {
          powdersVec.appendFlag('POWDER_REPEAT_TIER_OP', 'CHANGE_POWDER');
          powdersVec.appendFlag('POWDER_CHANGE_OP', 'NEW_POWDER');
          powdersVec.append(encodePowderIdx(powder, E.POWDER_TIERS), E.POWDER_ID_BITLEN);
        }
      } else {
        powdersVec.append(encodePowderIdx(powder, E.POWDER_TIERS), E.POWDER_ID_BITLEN);
      }
      while (++i < powderChunk.length && powderChunk[i] == powder) {
        powdersVec.appendFlag('POWDER_REPEAT_OP', 'REPEAT');
      }
      previousPowder = powder;
    }
  }
  powdersVec.appendFlag('POWDER_REPEAT_OP', 'NO_REPEAT');
  powdersVec.appendFlag('POWDER_REPEAT_TIER_OP', 'CHANGE_POWDER');
  powdersVec.appendFlag('POWDER_CHANGE_OP', 'NEW_ITEM');

  return powdersVec;
}

function getEquipmentKind(eq: BuildItemRef): number {
  const E = enc();
  if (eq.statMap.get('custom')) {
    return E.EQUIPMENT_KIND.CUSTOM;
  } else if (eq.statMap.get('crafted')) {
    return E.EQUIPMENT_KIND.CRAFTED;
  } else {
    return E.EQUIPMENT_KIND.NORMAL;
  }
}

/** Length, in chars, of the custom binary string */
const CUSTOM_STR_LENGTH_BITLEN = 12;

/** A map of the indexes of the powderable items in the equipment array and their corresponding index in the build powders array. */
const powderables = new Map([0, 1, 2, 3, 8].map((x, i) => [x, i]));

/**
 * Encode all wearable equipment and return the resulting vector.
 */
function encodeEquipment(equipment: BuildItemRef[], powders: number[][], version: number): EncodingBitVector {
  const E = enc();
  const equipmentVec = new EncodingBitVector(0, 0);

  for (const [idx, eq] of equipment.entries()) {
    const equipmentKind = getEquipmentKind(eq);
    equipmentVec.append(equipmentKind, E.EQUIPMENT_KIND.BITLEN);
    switch (equipmentKind) {
      case E.EQUIPMENT_KIND.NORMAL: {
        let eqID = 0;
        if (eq.statMap.get('NONE') !== true) {
          eqID = (eq.statMap.get('id') as number) + 1;
        }
        equipmentVec.append(eqID, E.ITEM_ID_BITLEN);
        break;
      }
      case E.EQUIPMENT_KIND.CRAFTED: {
        const craftedHash = (eq.statMap.get('hash') as string).substring(3);
        // Legacy versions start with their first bit set
        // @ts-expect-error JS precedence: `n & 0x1 === 1` parses as `n & (0x1 === 1)`
        if (Base64.toInt(craftedHash[0]) & 0x1 === 1) {
          equipmentVec.merge([encodeCraft(eq as Parameters<typeof encodeCraft>[0]) as unknown as BitVectorLike]);
        } else {
          equipmentVec.appendB64(craftedHash);
        }
        break;
      }
      case E.EQUIPMENT_KIND.CUSTOM: {
        const customHash = (eq.statMap.get('hash') as string).substring(3);
        // Legacy versions start with their first bit set
        // @ts-expect-error JS precedence: `n & 0x1 === 1` parses as `n & (0x1 === 1)`
        if (Base64.toInt(customHash[0]) & 0x1 === 1) {
          const newCustom = encodeCustom(eq as Parameters<typeof encodeCustom>[0], true);
          equipmentVec.append((newCustom as unknown as { length: number }).length / 6, CUSTOM_STR_LENGTH_BITLEN);
          equipmentVec.merge([newCustom as unknown as BitVectorLike]);
        } else {
          equipmentVec.append(customHash.length, CUSTOM_STR_LENGTH_BITLEN);
          equipmentVec.appendB64(customHash);
        }
        break;
      }
    }

    // Encode powders
    if (powderables.has(idx)) {
      equipmentVec.merge([encodePowders(powders[powderables.get(idx)!], version)]);
    }
  }
  return equipmentVec;
}

/**
 * Encode skillpoints.
 * The term "manual assignment" refers to skillpoints manually assigned in **Wynnbuilder** and not in **Wynncraft**.
 */
function encodeSp(finalSp: SkillpointVector, originalSp: SkillpointVector, _version: number): EncodingBitVector {
  const E = enc();
  const spDeltas = zip2(finalSp, originalSp).map(([x, y]) => x - y);
  const spBitvec = new EncodingBitVector(0, 0);

  if (spDeltas.every((x) => x === 0)) {
    // No manually assigned skillpoints, let the builder handle the rest.
    spBitvec.appendFlag('SP_FLAG', 'AUTOMATIC');
  } else {
    // We have manually assigned skillpoints
    spBitvec.appendFlag('SP_FLAG', 'ASSIGNED');
    for (const [i, sp] of finalSp.entries()) {
      if (spDeltas[i] === 0) {
        // The specific element has no manually assigned skillpoints
        spBitvec.appendFlag('SP_ELEMENT_FLAG', 'ELEMENT_UNASSIGNED');
      } else {
        // The specific element has manually assigned skillpoints
        spBitvec.appendFlag('SP_ELEMENT_FLAG', 'ELEMENT_ASSIGNED');
        // Truncate to fit within the specified range.
        const truncSp = sp & ((1 << E.MAX_SP_BITLEN) - 1);
        spBitvec.append(truncSp, E.MAX_SP_BITLEN);
      }
    }
  }

  return spBitvec;
}

/**
 * Encode the build's level.
 */
function encodeLevel(level: number, _version: number): EncodingBitVector {
  const E = enc();
  const levelVec = new EncodingBitVector(0, 0);
  if (level === E.MAX_LEVEL) {
    levelVec.appendFlag('LEVEL_FLAG', 'MAX');
  } else {
    levelVec.appendFlag('LEVEL_FLAG', 'OTHER');
    levelVec.append(level, E.LEVEL_BITLEN);
  }
  return levelVec;
}

/**
 * Encode aspects.
 */
function encodeAspects(aspects: AspectTuple[], _version: number): EncodingBitVector {
  const E = enc();
  const aspectsVec = new EncodingBitVector(0, 0);

  if (aspects.every(([aspect]) => aspect.NONE === true)) {
    aspectsVec.appendFlag('ASPECTS_FLAG', 'NO_ASPECTS');
  } else {
    aspectsVec.appendFlag('ASPECTS_FLAG', 'HAS_ASPECTS');
    for (const [aspect, tier] of aspects) {
      if (aspect.NONE === true) {
        aspectsVec.appendFlag('ASPECT_SLOT_FLAG', 'UNUSED');
      } else {
        aspectsVec.appendFlag('ASPECT_SLOT_FLAG', 'USED');
        aspectsVec.append(aspect.id, E.ASPECT_ID_BITLEN);
        aspectsVec.append(tier - 1, E.ASPECT_TIER_BITLEN);
      }
    }
  }

  return aspectsVec;
}

/** An indication tha the vector is in binary format. */
const VECTOR_FLAG = 0xc;

/** The length, in bits, of the version field of the header. */
const VERSION_BITLEN = 10;

/**
 * Encode a header with metadata about the build.
 */
function encodeHeader(encoding_version: number): EncodingBitVector {
  const headerVec = new EncodingBitVector(0, 0);

  // Legacy versions used versions 0..11 in decimal to encode.
  // In order to differentiate with minimal sacrifice, encode
  // the first character to be > 11.
  headerVec.append(VECTOR_FLAG, 6);
  headerVec.append(encoding_version, VERSION_BITLEN);
  return headerVec;
}

/**
 * Encodes the build according to the spec in `ENCODING.md` and returns the resulting BitVector.
 */
export function encodeBuild(
  build: PlayerBuild | undefined,
  powders: number[][],
  skillpoints: SkillpointVector,
  atree: ATree,
  atree_state: RenderedATree,
  aspects: AspectTuple[],
): EncodingBitVector | undefined {
  if (!build) return;

  const finalVec = new EncodingBitVector(0, 0);

  const vecs = [
    encodeHeader(wynn_version_id),
    encodeEquipment([...build.equipment, build.weapon], powders, wynn_version_id),
    encodeTomes(build.tomes, powders, wynn_version_id),
    encodeSp(skillpoints, build.total_skillpoints, wynn_version_id),
    encodeLevel(build.level, wynn_version_id),
    encodeAspects(aspects, wynn_version_id),
    encodeAtree(atree, atree_state, wynn_version_id),
  ];

  finalVec.merge(vecs as unknown as BitVectorLike[]);

  return finalVec;
}

/**
 * Decode the header portion of an encoded build.
 */
function decodeHeader(cursor: BitVectorCursor): number {
  cursor.advanceBy(6);
  return cursor.advanceBy(VERSION_BITLEN);
}

/**
 * Decode the powders portion of an encoded build, for a given item.
 *
 * TODO(@orgold): Refactor this code to not use 3 nested switch cases
 */
function decodePowders(cursor: BitVectorCursor): string {
  const D = dec();
  // HAS_POWDERS flag is true, so we know there's at least 1 powder.
  let powders: number[] = [decodePowderIdx(cursor.advanceBy(D.POWDER_ID_BITLEN), D.POWDER_TIERS)];
  let prevPowder = powders[0];
  outer: while (true) {
    repeat: switch (cursor.advanceBy(D.POWDER_REPEAT_OP.BITLEN)) {
      // Repeat the previous powders
      case D.POWDER_REPEAT_OP.REPEAT: {
        powders.push(prevPowder);
        break;
      }
      // Don't repeat previous powder
      case D.POWDER_REPEAT_OP.NO_REPEAT: {
        switch (cursor.advanceBy(D.POWDER_REPEAT_TIER_OP.BITLEN)) {
          // Decode a new powder
          case D.POWDER_REPEAT_TIER_OP.REPEAT_TIER: {
            const powderWrap = cursor.advanceBy(D.POWDER_WRAPPER_BITLEN);
            const prevPowderElem = Math.floor(prevPowder / POWDER_TIERS);
            const prevPowderTier = prevPowder % POWDER_TIERS;
            const newPowderElem = (prevPowderElem + powderWrap + 1) % D.POWDER_ELEMENTS.length;
            const newPowder = newPowderElem * POWDER_TIERS + prevPowderTier;
            powders.push(newPowder);
            break repeat;
          }
          case D.POWDER_REPEAT_TIER_OP.CHANGE_POWDER: {
            switch (cursor.advanceBy(D.POWDER_CHANGE_OP.BITLEN)) {
              case D.POWDER_CHANGE_OP.NEW_POWDER: {
                powders.push(decodePowderIdx(cursor.advanceBy(D.POWDER_ID_BITLEN), D.POWDER_TIERS));
                break repeat;
              }
              // Stop decoding powders
              case D.POWDER_CHANGE_OP.NEW_ITEM:
                break outer;
            }
          }
        }
        break;
      }
    }
    prevPowder = powders.at(-1)!;
  }
  return powders.map((x) => powderNames.get(x)).join('');
}

/**
 * Decode the equipment portion of an encoded build, including powders, and return both.
 *
 * TODO(@orgold): Refactor this code to not use 3 nested switch cases
 */
function decodeEquipment(cursor: BitVectorCursor): [Array<string | null>, string[]] {
  const D = dec();
  const equipments: Array<string | null> = [];
  const powders: string[] = [];
  for (let i = 0; i < D.EQUIPMENT_NUM; ++i) {
    const kind = cursor.advanceBy(D.EQUIPMENT_KIND.BITLEN);
    // Decode equipment kind
    switch (kind) {
      case D.EQUIPMENT_KIND.NORMAL: {
        let id = cursor.advanceBy(D.ITEM_ID_BITLEN);
        if (redirectMap.has(id - 1)) {
          id = Number(redirectMap.get(id - 1)) + 1;
        }
        if (id === 0) {
          equipments.push(null);
        } else {
          equipments.push(idMap.get(id - 1)!);
        }
        break;
      }
      case D.EQUIPMENT_KIND.CRAFTED: {
        const craft = decodeCraft({
          cursor: cursor as unknown as Parameters<typeof decodeCraft>[0]['cursor'],
        });
        equipments.push(craft!.hash);
        break;
      }
      case D.EQUIPMENT_KIND.CUSTOM: {
        const customLengthBits = cursor.advanceBy(CUSTOM_STR_LENGTH_BITLEN) * 6;
        const custom = decodeCustom({
          cursor: cursor.spawn(customLengthBits) as unknown as Parameters<typeof decodeCustom>[0]['cursor'],
        });
        equipments.push(custom.statMap.get('hash') as string);
        // Skip the length of the custom because we spawned a new cursor, so the original didn't mutate.
        cursor.skip(customLengthBits);
        break;
      }
    }

    // If applicable, decode the powders for the current item
    if (!powderables.has(i)) continue;
    if (cursor.advanceBy(D.EQUIPMENT_POWDERS_FLAG.BITLEN) === D.EQUIPMENT_POWDERS_FLAG.HAS_POWDERS) {
      powders.push(decodePowders(cursor));
    } else {
      powders.push('');
    }
  }
  return [equipments, powders];
}

/**
 * Decode the tome portion of an encoded build.
 */
function decodeTomes(cursor: BitVectorCursor): Array<string | null> {
  const D = dec();
  const tomes: Array<string | null> = [];
  switch (cursor.advanceBy(D.TOMES_FLAG.BITLEN)) {
    case D.TOMES_FLAG.NO_TOMES:
      break;
    case D.TOMES_FLAG.HAS_TOMES: {
      for (let i = 0; i < D.TOME_NUM; ++i) {
        switch (cursor.advanceBy(D.TOME_SLOT_FLAG.BITLEN)) {
          case D.TOME_SLOT_FLAG.UNUSED:
            tomes.push(null);
            break;
          case D.TOME_SLOT_FLAG.USED: {
            const id = cursor.advanceBy(D.TOME_ID_BITLEN);
            const lookupId = tomeRedirectMap.has(id) ? tomeRedirectMap.get(id)! : id;
            tomes.push(tomeIDMap.get(lookupId) ?? null);
            break;
          }
        }
      }
    }
  }
  return tomes;
}

/**
 * Decode the skillpoint portion of an encoded build.
 */
function decodeSp(cursor: BitVectorCursor): DecodedSkillpoints {
  const D = dec();
  const skillpoints: DecodedSkillpoints = [];
  switch (cursor.advanceBy(D.SP_FLAG.BITLEN)) {
    case D.SP_FLAG.AUTOMATIC:
      return null;
    case D.SP_FLAG.ASSIGNED: {
      for (let i = 0; i < D.SP_TYPES; ++i) {
        switch (cursor.advanceBy(D.SP_ELEMENT_FLAG.BITLEN)) {
          case D.SP_ELEMENT_FLAG.ELEMENT_ASSIGNED: {
            // Sign extend the n-bit sp to 32 bits, read as 2's complement
            const extension = 32 - D.MAX_SP_BITLEN;
            const skp = (cursor.advanceBy(D.MAX_SP_BITLEN) << extension) >> extension;
            skillpoints.push(skp);
            break;
          }
          case D.SP_ELEMENT_FLAG.ELEMENT_UNASSIGNED: {
            skillpoints.push(null);
            break;
          }
        }
      }
    }
  }
  return skillpoints;
}

/**
 * Decode the build's level.
 */
function decodeLevel(cursor: BitVectorCursor): number {
  const D = dec();
  const flag = cursor.advanceBy(D.LEVEL_FLAG.BITLEN);
  switch (flag) {
    case D.LEVEL_FLAG.MAX:
      return D.MAX_LEVEL;
    case D.LEVEL_FLAG.OTHER:
      return cursor.advanceBy(D.LEVEL_BITLEN);
    default:
      throw new Error('Encountered unknown flag when parsing level!');
  }
}

function decodeAspects(cursor: BitVectorCursor, cls: PlayerClass): Array<[string, number] | null> {
  const D = dec();
  const flag = cursor.advanceBy(D.ASPECTS_FLAG.BITLEN);
  const aspects: Array<[string, number] | null> = [];
  switch (flag) {
    case D.ASPECTS_FLAG.NO_ASPECTS:
      break;
    case D.ASPECTS_FLAG.HAS_ASPECTS: {
      for (let i = 0; i < D.NUM_ASPECTS; ++i) {
        switch (cursor.advanceBy(D.ASPECT_SLOT_FLAG.BITLEN)) {
          case D.ASPECT_SLOT_FLAG.UNUSED: {
            aspects.push(null);
            break;
          }
          case D.ASPECT_SLOT_FLAG.USED: {
            const aspectID = cursor.advanceBy(D.ASPECT_ID_BITLEN);
            const aspectTier = cursor.advanceBy(D.ASPECT_TIER_BITLEN);
            const clsAspects = aspect_id_map.get(cls);
            const aspect = clsAspects?.get(aspectID);
            aspects.push(aspect ? [aspect.displayName, aspectTier + 1] : null);
            break;
          }
        }
      }
    }
  }
  return aspects;
}

async function handleLegacyHash(urlTag: string): Promise<DecodedSkillpoints> {
  // Legacy versioning using search query "?v=XX" in the URL itself.
  // Grab the version of the data from the search parameter "?v=" in the URL
  setWynnVersionId(getDataVersionLegacy());

  // wynn_version 18 is the last version that supports legacy encoding.
  return await decodeHashLegacy(urlTag);
}

/**
 * Decode the URL and populate all item fields.
 */
export async function decodeHash(): Promise<DecodedSkillpoints> {
  const urlTag = window.location.hash.slice(1);

  if (!urlTag) {
    await loadLatestVersion();
    return null;
  }

  // Binary encoding encodes the first character of the hash to be > 11 (or > B in Base64). if it isn't, fallback to legacy parsing.
  if (Base64.toInt(urlTag[0]) <= 11) {
    return await handleLegacyHash(urlTag);
  }

  // Binary encoding, Create the BitVector from the URL.
  // The vector length is actually automatically calculated in the constructor but it's here just in case.
  const vec = new BitVector(urlTag, urlTag.length * 6);
  const cursor = new BitVectorCursor(vec, 0);

  // The version of the data.
  setWynnVersionId(decodeHeader(cursor));

  // Load the correct data for the provided version, includes encoding data.
  // The reason we differentiate is that most of the heavy data can be loaded
  // locally if the version is the latest version.
  if (wynn_version_id !== WYNN_VERSION_LATEST) {
    await loadOlderVersion();
  } else if (wynn_version_id === WYNN_VERSION_LATEST) {
    await loadLatestVersion();
  }

  // Decode all build information from the BitVector.
  const [equipment, powders] = decodeEquipment(cursor);
  const tomes = decodeTomes(cursor);
  const skillpoints = decodeSp(cursor);
  const level = decodeLevel(cursor);

  // Get the class from the weapon to read aspects
  let weaponType: string;
  const weaponName = equipment[8]!;
  switch (weaponName.slice(0, 3)) {
    case 'CI-':
      weaponType = decodeCustom({ hash: weaponName.substring(3) }).statMap.get('type') as string;
      break;
    case 'CR-':
      weaponType = decodeCraft({ hash: weaponName.substring(3) })!.statMap.get('type') as string;
      break;
    default:
      weaponType = itemMap.get(weaponName)!.type;
  }
  const playerClass = wep_to_class.get(weaponType as Parameters<typeof wep_to_class.get>[0])!;

  const aspects = decodeAspects(cursor, playerClass);

  // This provides the data for atree population, no other explicit step
  // needed in the decoder
  atree_data = cursor.consume();

  // Populate all input fields apart from skillpoints, which need to be populated after build calculation
  for (const [i, eq] of equipment.entries()) {
    setValue(equipment_inputs[i], eq);
  } // Equipment
  for (const [i, powderset] of powders.entries()) {
    setValue(powder_inputs[i], powderset);
  } // Powders
  for (const [i, tome] of tomes.entries()) {
    setValue(tomeInputs[i], tome);
  } // Tomes
  setValue('level-choice', level); // Level

  // Aspects
  for (const [i, aspectAndTier] of aspects.entries()) {
    if (aspectAndTier !== null) {
      const [aspect, tier] = aspectAndTier;
      setValue(aspectInputs[i], aspect);
      setValue(aspectTierInputs[i], tier);
    }
  }

  return skillpoints;
}

/**
 * Get the data version from the search parameters of the URL.
 * Should only be called if the encoding version is >= 8.
 */
export function getDataVersionLegacy(): number {
  const urlParams = new URLSearchParams(window.location.search);
  const versionID = urlParams.get('v');
  let wynnVersion = parseInt(versionID!); // Declared in load_item.js
  if (isNaN(wynnVersion) || wynnVersion > LAST_LEGACY_VERSION || wynnVersion < 0) {
    console.log('Explicit version not found or invalid, using latest version');
    wynnVersion = LAST_LEGACY_VERSION;
  } else {
    console.log(`Build link for wynn version ${wynnVersion} (${wynn_version_names[wynnVersion]})`);
  }
  return wynnVersion;
}

/**
 * The legacy version of decodePowders.
 */
function decodePowdersLegacy(powder_info: string): [string[], string] {
  const powdering: string[] = [];
  let remaining = powder_info;
  for (let i = 0; i < 5; ++i) {
    let powders = '';
    const n_blocks = Base64.toInt(remaining.charAt(0));
    remaining = remaining.slice(1);
    for (let j = 0; j < n_blocks; ++j) {
      const block = remaining.slice(0, 5);
      let six_powders = Base64.toInt(block);
      for (let k = 0; k < 6 && six_powders != 0; ++k) {
        powders += powderNames.get(decodePowderIdx((six_powders & 0x1f) - 1, 6));
        six_powders >>>= 5;
      }
      remaining = remaining.slice(5);
    }
    powdering[i] = powders;
  }
  return [powdering, remaining];
}

/*
 * Decode legacy hashes.
 *
 * Populate fields based on url, and calculate build.
 */
export async function decodeHashLegacy(url_tag: string): Promise<DecodedSkillpoints> {
  //default values
  const equipment: Array<string | null> = [null, null, null, null, null, null, null, null, null];
  const tomes: Array<string | null> = Array(TOME_SLOT_COUNT).fill(null);
  let powdering = ['', '', '', '', ''];
  const info = url_tag.split('_');
  const version = info[0];
  // Whether skillpoints are manually updated. True if they should be set to something other than default values
  const skillpoints: DecodedSkillpoints = [null, null, null, null, null];
  let level = 106;

  const version_number = parseInt(version);
  let data_str = info[1];

  if (version_number >= 8) {
    setWynnVersionId(getDataVersionLegacy());
  } else {
    // Change the default to oldest. (A time before v8)
    setWynnVersionId(0);
  }

  // the deal with this is because old versions should default to 0 (oldest wynn item version), and v8+ defaults to latest.
  // its ugly... but i think this is the behavior we want...
  await loadOlderVersion();

  //equipment (items)
  if (version_number < 4) {
    const equipments = info[1];
    for (let i = 0; i < 9; ++i) {
      const equipment_str = equipments.slice(i * 3, i * 3 + 3);
      equipment[i] = getItemNameFromID(Base64.toInt(equipment_str)) ?? null;
    }
    data_str = equipments.slice(27);
  } else if (version_number == 4) {
    const info_str = data_str;
    let start_idx = 0;
    for (let i = 0; i < 9; ++i) {
      if (info_str.charAt(start_idx) === '-') {
        equipment[i] = 'CR-' + info_str.slice(start_idx + 1, start_idx + 18);
        start_idx += 18;
      } else {
        const equipment_str = info_str.slice(start_idx, start_idx + 3);
        equipment[i] = getItemNameFromID(Base64.toInt(equipment_str)) ?? null;
        start_idx += 3;
      }
    }
    data_str = info_str.slice(start_idx);
  } else if (version_number <= 11) {
    const info_str = data_str;
    let start_idx = 0;
    for (let i = 0; i < 9; ++i) {
      if (info_str.slice(start_idx, start_idx + 3) === 'CR-') {
        equipment[i] = info_str.slice(start_idx, start_idx + 20);
        start_idx += 20;
      } else if (info_str.slice(start_idx + 3, start_idx + 6) === 'CI-') {
        const len = Base64.toInt(info_str.slice(start_idx, start_idx + 3));
        equipment[i] = info_str.slice(start_idx + 3, start_idx + 3 + len);
        start_idx += 3 + len;
      } else {
        const equipment_str = info_str.slice(start_idx, start_idx + 3);
        equipment[i] = getItemNameFromID(Base64.toInt(equipment_str)) ?? null;
        start_idx += 3;
      }
    }
    data_str = info_str.slice(start_idx);
  }
  //constant in all versions
  for (const i in equipment) {
    setValue(equipment_inputs[i as unknown as number], equipment[i as unknown as number]);
  }

  //level, skill point assignments, and powdering
  if (version_number == 0) {
    // do nothing! lol
  } else if (version_number == 1) {
    const powder_info = data_str;
    const res = decodePowdersLegacy(powder_info);
    powdering = res[0];
  } else if (version_number == 2) {
    const skillpoint_info = data_str.slice(0, 10);
    for (let i = 0; i < 5; ++i) {
      skillpoints[i] = Base64.toIntSigned(skillpoint_info.slice(i * 2, i * 2 + 2));
    }

    const powder_info = data_str.slice(10);
    const res = decodePowdersLegacy(powder_info);
    powdering = res[0];
  } else if (version_number <= 11) {
    level = Base64.toInt(data_str.slice(10, 12));
    setValue('level-choice', level);
    const skillpoint_info = data_str.slice(0, 10);
    for (let i = 0; i < 5; ++i) {
      skillpoints[i] = Base64.toIntSigned(skillpoint_info.slice(i * 2, i * 2 + 2));
    }

    const powder_info = data_str.slice(12);

    const res = decodePowdersLegacy(powder_info);
    powdering = res[0];
    data_str = res[1];
  }
  // Tomes.
  if (version_number >= 6) {
    if (version_number < 8) {
      for (let i = 0; i < 7; ++i) {
        const tome_str = data_str.charAt(i);
        const tome_name = getTomeNameFromID(Base64.toInt(tome_str));
        setValue(tomeInputs[i], tome_name);
      }
      data_str = data_str.slice(7);
    } else {
      let num_tomes = 7;
      if (version_number <= 8) {
        num_tomes = 7;
      } else if (version_number <= 9) {
        num_tomes = 8;
      } else {
        num_tomes = 14;
      }
      for (let i = 0; i < num_tomes; ++i) {
        const tome_str = data_str.slice(2 * i, 2 * i + 2);
        const tome_name = getTomeNameFromID(Base64.toInt(tome_str));
        setValue(tomeInputs[i], tome_name);
      }
      data_str = data_str.slice(num_tomes * 2);
    }
  }

  // Aspects.
  if (version_number >= 11) {
    let item_type: string;
    if (equipment[8]!.slice(0, 3) == 'CI-') {
      item_type = getCustomFromHash(equipment[8]!).statMap.get('type') as string;
    } else if (equipment[8]!.slice(0, 3) == 'CR-') {
      item_type = getCraftFromHash(equipment[8]!).statMap.get('type') as string;
    } else {
      item_type = itemMap.get(equipment[8]!)!.type;
    }

    const player_class = wep_to_class.get(item_type as Parameters<typeof wep_to_class.get>[0])!;
    const class_aspects_by_id = aspect_id_map.get(player_class)!;
    for (let i = 0; i < NUM_ASPECTS; ++i) {
      const aspect_id = Base64.toInt(data_str.slice(3 * i, 3 * i + 2));
      const aspect_tier = Base64.toInt(data_str.slice(3 * i + 2, 3 * i + 3));
      if (aspect_id !== none_aspect.id) {
        setValue(aspectTierInputs[i], aspect_tier);
        setValue(aspectInputs[i], class_aspects_by_id.get(aspect_id)!.displayName);
      }
    }
    data_str = data_str.slice(NUM_ASPECTS * 3);
  }

  if (version_number >= 7) {
    atree_data = new (BitVector as new (data: string) => BitVector)(data_str);
  } else {
    atree_data = null;
  }

  for (const i in powder_inputs) {
    setValue(powder_inputs[i], powdering[i as unknown as number]);
  }

  return skillpoints;
}

/**
 *  Stores the entire build in a string using B64 encoding.
 *  Here only for documentation purposes.
 */
export function encodeBuildLegacy(
  build: PlayerBuild | undefined,
  powders: number[][],
  skillpoints: SkillpointVector,
  atree: ATree,
  atree_state: RenderedATree,
  aspects: AspectTuple[],
): string | undefined {
  if (build) {
    let build_version: number;
    let build_string: string;
    let tome_string: string;

    build_version = 11;
    build_string = '';
    tome_string = '';

    for (const item of build.items) {
      if (item.statMap.get('custom')) {
        const custom = 'CI-' + encodeCustom(item as Parameters<typeof encodeCustom>[0], true);
        build_string += Base64.fromIntN(custom.length, 3) + custom;
      } else if (item.statMap.get('crafted')) {
        build_string += 'CR-' + encodeCraftLegacy(item as Parameters<typeof encodeCraftLegacy>[0]);
      } else if (item.statMap.get('category') === 'tome') {
        const tome_id = item.statMap.get('id') as number;
        tome_string += Base64.fromIntN(tome_id, 2);
      } else {
        build_string += Base64.fromIntN(item.statMap.get('id') as number, 3);
      }
    }

    for (const skp of skillpoints) {
      build_string += Base64.fromIntN(skp, 2); // Maximum skillpoints: 2048
    }
    build_string += Base64.fromIntN(build.level, 2);
    for (const _powderset of powders) {
      const n_bits = Math.ceil(_powderset.length / 6);
      build_string += Base64.fromIntN(n_bits, 1); // Hard cap of 378 powders.
      const powderset = _powderset.slice();
      while (powderset.length != 0) {
        const firstSix = powderset.slice(0, 6).reverse();
        let powder_hash = 0;
        for (const powder of firstSix) {
          powder_hash = (powder_hash << 5) + 1 + powder; // LSB will be extracted first.
        }
        build_string += Base64.fromIntN(powder_hash, 5);
        powderset.splice(0, 6);
      }
    }
    build_string += tome_string;

    for (const [aspect, tier] of aspects) {
      build_string += Base64.fromIntN(aspect.id, 2);
      build_string += Base64.fromIntN(tier, 1);
    }

    if (atree.length > 0 && atree_state.get(atree[0].ability.id).active) {
      const bitvec = encodeAtree(atree, atree_state);
      build_string += bitvec.toB64();
    }

    return build_version.toString() + '_' + build_string;
  }
}

export function getFullURL(): string {
  return window.location.href;
}

function useCopyButton(id: string, text: string, default_text: string): void {
  copyTextToClipboard(text);
  setText(id, 'Copied!');
  setTimeout(() => setText(id, default_text), 1000);
}

export function copyBuild(): void {
  useCopyButton('copy-button', getFullURL(), 'Copy short');
}

export function shareBuild(build: PlayerBuild | undefined): void {
  if (!build) return;

  const lines = [
    getFullURL(),
    '> Wynnbuilder build:',
    ...build.equipment.map((x) => `> ${x.statMap.get('displayName')}`),
    `> ${build.weapon.statMap.get('displayName')} [${build_powders![4].map((x) => powderNames.get(x)).join('')}]`,
  ];

  const hasTomes = !build.tomes.every((tome) => tome.statMap.has('NONE'));
  const hasAspects =
    aspect_agg_node &&
    aspect_agg_node.value &&
    !((aspect_agg_node.value ?? []) as AspectTuple[]).every(([aspect]) => aspect.NONE);
  if (hasTomes && hasAspects) {
    lines.push('> (Has Tomes and Aspects)');
  } else if (hasTomes) {
    lines.push('> (Has Tomes)');
  } else if (hasAspects) {
    lines.push('> (Has Aspects)');
  }

  const text = lines.join('\n');
  useCopyButton('share-button', text, 'Copy for sharing');
}

/**
 * Ability tree encode and decode functions
 *
 * Based on a traversal, basically only uses bits to represent the nodes that are on (and "dark" outgoing edges).
 * credit: SockMower
 */

export function encodeAtree(atree: ATree, atree_state: RenderedATree, _version?: number): BitVector {
  const retVec = new BitVector(0, 0);

  function traverse(
    head: ATreeNode,
    state: RenderedATree,
    visited: Map<number, boolean>,
    ret: BitVectorLike,
  ): void {
    for (const child of head.children) {
      if (visited.has(child.ability.id)) {
        continue;
      }
      visited.set(child.ability.id, true);
      if (state.get(child.ability.id).active) {
        ret.append(1, 1);
        traverse(child, state, visited, ret);
      } else {
        ret.append(0, 1);
      }
    }
  }

  traverse(atree[0], atree_state, new Map(), retVec as unknown as BitVectorLike);
  return retVec;
}

export function decodeAtree(atree: ATree, bits: BitVectorLike): ATreeNode[] {
  let i = 0;
  const ret: ATreeNode[] = [];
  ret.push(atree[0]);
  function traverse(head: ATreeNode, visited: Map<number, boolean>, nodes: ATreeNode[]): void {
    for (const child of head.children) {
      if (visited.has(child.ability.id)) {
        continue;
      }
      visited.set(child.ability.id, true);
      if (bits.readBit(i)) {
        i += 1;
        nodes.push(child);
        traverse(child, visited, nodes);
      } else {
        i += 1;
      }
    }
  }
  traverse(atree[0], new Map(), ret);
  return ret;
}

;
