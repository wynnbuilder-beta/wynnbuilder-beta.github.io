import { attachGlobals } from '@/lib/attachGlobals';
import {
  Base64,
  BitVector,
  BitVectorCursor,
  BootstringEncoder,
  capitalizeFirst,
  clamp,
  EncodingBitVector,
  log,
} from '@/utils';
import {
  accessoryTypes,
  all_types,
  armorTypes,
  attackSpeeds,
  classes,
  consumableTypes,
  rolledIDs,
  skp_elements,
  skp_order,
  tiers,
  tome_types,
  weaponTypes,
} from '@/build_utils';
// NOTE: DO NOT DELETE ENTRIES FROM ARRAYS FOR BACKWARDS COMPAT REASONS!!!
export const ci_save_order = [
  'name',
  'lore',
  'tier',
  'set',
  'slots',
  'type',
  'material',
  'drop',
  'quest',
  'nDam',
  'fDam',
  'wDam',
  'aDam',
  'tDam',
  'eDam',
  'atkSpd',
  'hp',
  'fDef',
  'wDef',
  'aDef',
  'tDef',
  'eDef',
  'lvl',
  'classReq',
  'strReq',
  'dexReq',
  'intReq',
  'defReq',
  'agiReq',
  'str',
  'dex',
  'int',
  'agi',
  'def',
  'id',
  'skillpoints',
  'reqs',
  // NOTE: THESE ARE UNUSED.
  'nDam_',
  'fDam_',
  'wDam_',
  'aDam_',
  'tDam_',
  'eDam_',
  'majorIds',
  'hprPct',
  'mr',
  'sdPct',
  'mdPct',
  'ls',
  'ms',
  'xpb',
  'lb',
  'ref',
  'thorns',
  'expd',
  'spd',
  'atkTier',
  'poison',
  'hpBonus',
  'spRegen',
  'eSteal',
  'hprRaw',
  'sdRaw',
  'mdRaw',
  'fDamPct',
  'wDamPct',
  'aDamPct',
  'tDamPct',
  'eDamPct',
  'fDefPct',
  'wDefPct',
  'aDefPct',
  'tDefPct',
  'eDefPct',
  'spPct1',
  'spRaw1',
  'spPct2',
  'spRaw2',
  'spPct3',
  'spRaw3',
  'spPct4',
  'spRaw4',
  'rSdRaw',
  'sprint',
  'sprintReg',
  'jh',
  'lq',
  'gXp',
  'gSpd',
  'durability',
  'duration',
  'charges',
  'maxMana',
  'critDamPct',
  /*"sdRaw", "rSdRaw",*/ 'nSdRaw',
  'eSdRaw',
  'tSdRaw',
  'wSdRaw',
  'fSdRaw',
  'aSdRaw',
  /*"sdPct",*/ 'rSdPct',
  'nSdPct',
  'eSdPct',
  'tSdPct',
  'wSdPct',
  'fSdPct',
  'aSdPct',
  /*"mdRaw",*/ 'rMdRaw',
  'nMdRaw',
  'eMdRaw',
  'tMdRaw',
  'wMdRaw',
  'fMdRaw',
  'aMdRaw',
  /*"mdPct",*/ 'rMdPct',
  'nMdPct',
  'eMdPct',
  'tMdPct',
  'wMdPct',
  'fMdPct',
  'aMdPct',
  'damRaw',
  'rDamRaw',
  'nDamRaw',
  'eDamRaw',
  'tDamRaw',
  'wDamRaw',
  'fDamRaw',
  'aDamRaw',
  'damPct',
  'rDamPct',
  'nDamPct' /*"eDamPct", "tDamPct", "wDamPct", "fDamPct", "aDamPct",*/,
  'healPct',
  'mainAttackRange',
  'kb',
  'weakenEnemy',
  'slowEnemy',
  'rDefPct',
] as const;

export const non_rolled_strings = [
  'name',
  'lore',
  'tier',
  'set',
  'type',
  'material',
  'drop',
  'quest',
  'majorIds',
  'classReq',
  'atkSpd',
  'displayName',
  'nDam',
  'fDam',
  'wDam',
  'aDam',
  'tDam',
  'eDam',
  'nDam_',
  'fDam_',
  'wDam_',
  'aDam_',
  'tDam_',
  'eDam_',
  'durability',
  'duration',
];

interface CustomEnc {
  CUSTOM_VERSION_BITLEN: number;
  CUSTOM_ENCODING_VERSION: number;
  CUSTOM_FIXED_IDS_FLAG: Record<string, number> & { BITLEN: number };
  ID_IDX_BITLEN: number;
  ID_LENGTH_BITLEN: number;
  ITEM_TYPE_BITLEN: number;
  ITEM_TIER_BITLEN: number;
  ITEM_ATK_SPD_BITLEN: number;
  ITEM_CLASS_REQ_BITLEN: number;
  TEXT_CHAR_LENGTH_BITLEN: number;
}

interface BitVectorInstance {
  sliceB64(start: number, end: number): string;
}

interface BitVectorCursorInstance {
  currIdx: number;
  endIdx: number;
  bitVec: BitVectorInstance;
  advance(): number;
  advanceBy(n: number): number;
  advanceByChars(amount: number): string;
}

const CUSTOM_ENC: CustomEnc = {
  CUSTOM_VERSION_BITLEN: 7,
  CUSTOM_ENCODING_VERSION: 2,
  CUSTOM_FIXED_IDS_FLAG: {
    FIXED: 0,
    RANGED: 1,
    BITLEN: 1,
  },
  ID_IDX_BITLEN: 10,
  ID_LENGTH_BITLEN: 5,
  ITEM_TYPE_BITLEN: 4,
  ITEM_TIER_BITLEN: 4,
  ITEM_ATK_SPD_BITLEN: 4,
  ITEM_CLASS_REQ_BITLEN: 4,
  TEXT_CHAR_LENGTH_BITLEN: 16,
};

const bootstringEncoder = new BootstringEncoder(0, 1, 52, 104, 700, 38, '-');

function rollMap(statMap: Map<string, unknown>, key: 'minRolls' | 'maxRolls'): Map<string, number> {
  return statMap.get(key) as Map<string, number>;
}

export function encodeCustom(custom: Custom | null | undefined, verbose: boolean): EncodingBitVector {
  const customVec = new EncodingBitVector(0, 0, CUSTOM_ENC);
  if (!custom) return customVec;

  customVec.append(0, 1);
  customVec.append(CUSTOM_ENC.CUSTOM_ENCODING_VERSION, CUSTOM_ENC.CUSTOM_VERSION_BITLEN);

  let fixedIDs = false;
  if (custom.statMap.get('fixID') === true) {
    fixedIDs = true;
    customVec.appendFlag('CUSTOM_FIXED_IDS_FLAG', 'FIXED');
  } else {
    customVec.appendFlag('CUSTOM_FIXED_IDS_FLAG', 'RANGED');
  }

  for (const [i, id] of ci_save_order.entries()) {
    if (rolledIDs.includes(id)) {
      const minRolls = rollMap(custom.statMap, 'minRolls');
      const maxRolls = rollMap(custom.statMap, 'maxRolls');
      let valMin = minRolls.has(id) ? minRolls.get(id)! : 0;
      let valMax = maxRolls.has(id) ? maxRolls.get(id)! : 0;
      if (valMin === 0 && valMax === 0) continue;

      customVec.append(i, CUSTOM_ENC.ID_IDX_BITLEN);
      const minLen = Math.max(1, Math.floor(Math.log2(Math.abs(valMin))) + 2);
      const maxLen = Math.max(1, Math.floor(Math.log2(Math.abs(valMax))) + 2);
      const idLen = clamp(minLen, maxLen, 32);
      const mask = (1 << idLen) - 1;
      customVec.append(idLen - 1, CUSTOM_ENC.ID_LENGTH_BITLEN);
      customVec.append(valMin & mask, idLen);
      if (!fixedIDs) customVec.append(valMax & mask, idLen);
    } else {
      const damages = ['nDam', 'eDam', 'tDam', 'wDam', 'fDam', 'aDam'];
      let idVal = custom.statMap.get(id);

      if (id == 'majorIds') {
        if ((idVal as string[]).length > 0) {
          idVal = (idVal as string[])[0];
        } else {
          idVal = '';
        }
      }

      if (typeof idVal === 'string' && idVal !== '') {
        const verboseIDs = ['lore', 'majorIds', 'quest', 'materials', 'drop', 'set'];
        if ((damages.includes(id) && idVal === '0-0') || (!verbose && verboseIDs.includes(id))) {
          continue;
        }

        customVec.append(i, CUSTOM_ENC.ID_IDX_BITLEN);

        switch (id) {
          case 'type':
            customVec.append(all_types.indexOf(capitalizeFirst(idVal)), CUSTOM_ENC.ITEM_TYPE_BITLEN);
            break;
          case 'tier':
            customVec.append(tiers.indexOf(idVal as (typeof tiers)[number]), CUSTOM_ENC.ITEM_TIER_BITLEN);
            break;
          case 'atkSpd':
            customVec.append(
              attackSpeeds.indexOf(idVal as (typeof attackSpeeds)[number]),
              CUSTOM_ENC.ITEM_ATK_SPD_BITLEN,
            );
            break;
          case 'classReq':
            customVec.append(
              classes.indexOf(capitalizeFirst(idVal) as (typeof classes)[number]),
              CUSTOM_ENC.ITEM_CLASS_REQ_BITLEN,
            );
            break;
          default: {
            const lenMask = (1 << CUSTOM_ENC.TEXT_CHAR_LENGTH_BITLEN) - 1;
            const encodedText = bootstringEncoder.encode(idVal);
            customVec.append(encodedText.length & lenMask, CUSTOM_ENC.TEXT_CHAR_LENGTH_BITLEN);
            customVec.appendB64(encodedText);
            break;
          }
        }
      } else if (typeof idVal === 'number' && idVal != 0) {
        customVec.append(i, CUSTOM_ENC.ID_IDX_BITLEN);
        const len = Math.min(32, Math.floor(Math.log2(Math.abs(idVal))) + 2);
        const mask = (1 << len) - 1;
        customVec.append(len - 1, CUSTOM_ENC.ID_LENGTH_BITLEN);
        customVec.append(idVal & mask, len);
      }
    }
  }

  customVec.append(0, 6 - ((customVec as unknown as { length: number }).length % 6));
  return customVec;
}

export function encodeCustomLegacy(custom: Custom | Map<string, unknown> | null | undefined, verbose: boolean): string {
  if (custom) {
    let statMap: Map<string, unknown>;
    if (custom instanceof Custom) {
      statMap = custom.statMap;
    } else if (custom instanceof Map) {
      statMap = custom;
    } else if ((custom as { statMap?: Map<string, unknown> }).statMap) {
      statMap = (custom as { statMap: Map<string, unknown> }).statMap;
    } else {
      statMap = custom as Map<string, unknown>;
    }
    let hash = '1';
    if (statMap.has('fixID') && statMap.get('fixID')) {
      hash += '1';
    } else {
      hash += '0';
    }
    for (const i in ci_save_order) {
      const id = ci_save_order[i as unknown as number];
      if (rolledIDs.includes(id)) {
        const minRolls = rollMap(statMap, 'minRolls');
        const maxRolls = rollMap(statMap, 'maxRolls');
        let val_min = minRolls.has(id) ? minRolls.get(id)! : 0;
        let val_max = maxRolls.has(id) ? maxRolls.get(id)! : 0;
        const sign =
          (Number(val_min / Math.abs(val_min) < 0) | 0) + 2 * (Number(val_max / Math.abs(val_max) < 0) | 0);
        let min_len = Math.max(1, Math.ceil(log(64, Math.abs(val_min) + 1)));
        let max_len = Math.max(1, Math.ceil(log(64, Math.abs(val_max) + 1)));
        let len = Math.max(min_len, max_len);
        val_min = Math.abs(val_min);
        val_max = Math.abs(val_max);

        if (val_min != 0 || val_max != 0) {
          if (statMap.get('fixID')) {
            hash += Base64.fromIntN(Number(i), 2) + Base64.fromIntN(len, 2) + sign + Base64.fromIntN(val_min, len);
          } else {
            hash +=
              Base64.fromIntN(Number(i), 2) +
              Base64.fromIntN(len, 2) +
              sign +
              Base64.fromIntN(val_min, len) +
              Base64.fromIntN(val_max, len);
          }
        }
      } else {
        const damages = ['nDam', 'eDam', 'tDam', 'wDam', 'fDam', 'aDam'];
        let val = statMap.get(id);
        if (id == 'majorIds') {
          if ((val as string[]).length > 0) {
            val = (val as string[])[0];
          } else {
            val = '';
          }
        }

        if (typeof val === 'string' && val !== '') {
          if (
            (damages.includes(id) && val === '0-0') ||
            (!verbose && ['lore', 'majorIds', 'quest', 'materials', 'drop', 'set'].includes(id))
          ) {
            continue;
          }
          if (id === 'type') {
            hash +=
              Base64.fromIntN(Number(i), 2) +
              Base64.fromIntN(all_types.indexOf(val.substring(0, 1).toUpperCase() + val.slice(1)), 1);
          } else if (id === 'tier') {
            hash += Base64.fromIntN(Number(i), 2) + Base64.fromIntN(tiers.indexOf(val as (typeof tiers)[number]), 1);
          } else if (id === 'atkSpd') {
            hash +=
              Base64.fromIntN(Number(i), 2) +
              Base64.fromIntN(attackSpeeds.indexOf(val as (typeof attackSpeeds)[number]), 1);
          } else if (id === 'classReq') {
            hash += Base64.fromIntN(Number(i), 2) + Base64.fromIntN(classes.indexOf(val as (typeof classes)[number]), 1);
          } else {
            hash +=
              Base64.fromIntN(Number(i), 2) +
              Base64.fromIntN(val.replace(/ /g, '%20').length, 2) +
              val.replace(/ /g, '%20');
          }
        } else if (typeof val === 'number' && val != 0) {
          const len = Math.max(1, Math.ceil(log(64, Math.abs(val) + 1)));
          const sign = Number(val / Math.abs(val) < 0) | 0;
          hash += Base64.fromIntN(Number(i), 2) + Base64.fromIntN(len, 2) + sign + Base64.fromIntN(Math.abs(val), len);
        }
      }
    }

    return hash;
  }
  return '';
}

export function decodeCustom({
  cursor,
  hash,
}: {
  cursor?: BitVectorCursorInstance;
  hash?: string;
}): Custom {
  if (cursor === undefined) {
    if (hash === undefined) throw new Error('decodeCustom must be called with either a hash or a BitVectorCursor.');
    cursor = new BitVectorCursor(new BitVector(hash, hash.length * 6));
  }

  const statMap = new Map<string, unknown>();
  statMap.set('hash', 'CI-' + cursor.bitVec.sliceB64(cursor.currIdx, cursor.endIdx));

  const legacy = cursor.advance();
  if (legacy) {
    if (hash === undefined) throw new Error('Tried to decode legacy encoded item but got binary.');
    const customItem = getCustomFromHash('CI-' + hash);
    return customItem!;
  }

  statMap.set('minRolls', new Map());
  statMap.set('maxRolls', new Map());

  cursor.advanceBy(CUSTOM_ENC.CUSTOM_VERSION_BITLEN);

  const fixedIDs =
    cursor.advanceBy(CUSTOM_ENC.CUSTOM_FIXED_IDS_FLAG.BITLEN) === CUSTOM_ENC.CUSTOM_FIXED_IDS_FLAG.FIXED;
  if (fixedIDs) statMap.set('fixID', true);

  while (cursor.currIdx + CUSTOM_ENC.ID_IDX_BITLEN <= cursor.endIdx) {
    const id = ci_save_order[cursor.advanceBy(CUSTOM_ENC.ID_IDX_BITLEN)];
    if (rolledIDs.includes(id)) {
      const idLen = cursor.advanceBy(CUSTOM_ENC.ID_LENGTH_BITLEN) + 1;
      const extension = 32 - idLen;
      const minRoll = (cursor.advanceBy(idLen) << extension) >> extension;
      if (!fixedIDs) {
        const maxRoll = (cursor.advanceBy(idLen) << extension) >> extension;
        rollMap(statMap, 'minRolls').set(id, minRoll);
        rollMap(statMap, 'maxRolls').set(id, maxRoll);
      } else {
        rollMap(statMap, 'minRolls').set(id, minRoll);
        rollMap(statMap, 'maxRolls').set(id, minRoll);
      }
      continue;
    }

    let idVal: unknown = null;

    if (non_rolled_strings.includes(id)) {
      switch (id) {
        case 'type':
          idVal = all_types[cursor.advanceBy(CUSTOM_ENC.ITEM_TIER_BITLEN)];
          break;
        case 'tier':
          idVal = tiers[cursor.advanceBy(CUSTOM_ENC.ITEM_TYPE_BITLEN)];
          break;
        case 'atkSpd':
          idVal = attackSpeeds[cursor.advanceBy(CUSTOM_ENC.ITEM_ATK_SPD_BITLEN)];
          break;
        case 'classReq':
          idVal = classes[cursor.advanceBy(CUSTOM_ENC.ITEM_CLASS_REQ_BITLEN)];
          break;
        default: {
          const textLen = cursor.advanceBy(CUSTOM_ENC.TEXT_CHAR_LENGTH_BITLEN) & 0xffffffff;
          const text = cursor.advanceByChars(textLen);
          idVal = bootstringEncoder.decode(text);
          break;
        }
      }
    } else {
      const idLen = cursor.advanceBy(CUSTOM_ENC.ID_LENGTH_BITLEN) + 1;
      const extension = 32 - idLen;
      idVal = (cursor.advanceBy(idLen) << extension) >> extension;
    }
    if (id === 'majorIds') idVal = [idVal];
    statMap.set(id, idVal);
  }

  statMap.set('custom', true);
  return new Custom(statMap);
}

export function getCustomFromHash(hash: string): Custom | undefined {
  let name = hash.slice();
  let statMap: Map<string, unknown> | undefined;
  try {
    if (name.slice(0, 3) === 'CI-') {
      name = name.substring(3);
    } else {
      throw new Error('Not a custom item!');
    }

    const version = name.charAt(0);
    const fixID = Boolean(parseInt(name.charAt(1), 10));
    let tag = name.substring(2);
    statMap = new Map();
    statMap.set('minRolls', new Map());
    statMap.set('maxRolls', new Map());

    if (version === '1') {
      if (fixID) {
        statMap.set('fixID', true);
      }
      while (tag !== '') {
        const id = ci_save_order[Base64.toInt(tag.slice(0, 2))];
        let len = Base64.toInt(tag.slice(2, 4));
        if (rolledIDs.includes(id)) {
          const sign = parseInt(tag.slice(4, 5), 10);
          let minRoll = Base64.toInt(tag.slice(5, 5 + len));
          if (!fixID) {
            let maxRoll = Base64.toInt(tag.slice(5 + len, 5 + 2 * len));
            if (sign > 1) {
              maxRoll *= -1;
            }
            if (sign % 2 == 1) {
              minRoll *= -1;
            }
            rollMap(statMap, 'minRolls').set(id, minRoll);
            rollMap(statMap, 'maxRolls').set(id, maxRoll);
            tag = tag.slice(5 + 2 * len);
          } else {
            if (sign != 0) {
              minRoll *= -1;
            }
            rollMap(statMap, 'minRolls').set(id, minRoll);
            rollMap(statMap, 'maxRolls').set(id, minRoll);
            tag = tag.slice(5 + len);
          }
        } else {
          let val: unknown;
          if (non_rolled_strings.includes(id)) {
            if (id === 'tier') {
              val = tiers[Base64.toInt(tag.charAt(2))];
              len = -1;
            } else if (id === 'type') {
              val = all_types[Base64.toInt(tag.charAt(2))];
              len = -1;
            } else if (id === 'atkSpd') {
              val = attackSpeeds[Base64.toInt(tag.charAt(2))];
              len = -1;
            } else if (id === 'classReq') {
              val = classes[Base64.toInt(tag.charAt(2))];
              len = -1;
            } else {
              val = tag.slice(4, 4 + len).replace(/%20/g, ' ');
            }
            tag = tag.slice(4 + len);
          } else {
            const sign = parseInt(tag.slice(4, 5), 10);
            val = Base64.toInt(tag.slice(5, 5 + len));
            if (sign == 1) {
              val = (val as number) * -1;
            }
            tag = tag.slice(5 + len);
          }
          if (id === 'majorIds') {
            val = [val];
          }
          statMap.set(id, val);
        }
      }
      statMap.set('hash', 'CI-' + name);
      statMap.set('custom', true);
      return new Custom(statMap);
    }
  } catch (error) {
    console.log(error);
    console.log(statMap);
    return undefined;
  }
}

export class Custom {
  statMap: Map<string, unknown>;
  hash?: string;
  name?: string;
  displayName?: string;

  constructor(statMap: Map<string, unknown>) {
    this.statMap = statMap;
    this.initCustomStats();
  }

  setHash(hash: string): void {
    let ihash = hash.slice();
    if (ihash.slice(0, 3) !== 'CI-') {
      ihash = 'CI-' + hash;
    }

    this.hash = ihash;
    this.statMap.set('hash', ihash);
  }

  updateName(name: string): void {
    this.name = name;
    this.displayName = name;
  }

  initCustomStats(): void {
    for (const id of ci_save_order) {
      if (rolledIDs.includes(id)) {
        if (!(rollMap(this.statMap, 'minRolls').has(id) && rollMap(this.statMap, 'minRolls').get(id))) {
          rollMap(this.statMap, 'minRolls').set(id, 0);
          rollMap(this.statMap, 'maxRolls').set(id, 0);
        }
      } else {
        if (non_rolled_strings.includes(id)) {
          if (!(this.statMap.has(id) && this.statMap.get(id))) {
            this.statMap.set(id, '');
          }
        } else {
          if (!(this.statMap.has(id) && this.statMap.get(id))) {
            this.statMap.set(id, 0);
          }
        }
      }
    }
    const type = String(this.statMap.get('type')).toLowerCase();
    if (weaponTypes.includes(type as (typeof weaponTypes)[number])) {
      for (const n of ['nDam', 'eDam', 'tDam', 'wDam', 'fDam', 'aDam']) {
        if (!(this.statMap.has(n) && this.statMap.get(n))) {
          this.statMap.set(n, '0-0');
        }
      }
    } else {
      for (const n of ['nDam', 'eDam', 'tDam', 'wDam', 'fDam', 'aDam']) {
        if (this.statMap.has(n)) {
          this.statMap.delete(n);
        }
      }
    }

    if (this.statMap.get('type')) {
      this.statMap.set('type', String(this.statMap.get('type')).toLowerCase());
      const itemType = String(this.statMap.get('type'));
      if (armorTypes.includes(itemType)) {
        this.statMap.set('category', 'armor');
      } else if (accessoryTypes.includes(itemType)) {
        this.statMap.set('category', 'accessory');
      } else if (weaponTypes.includes(itemType as (typeof weaponTypes)[number])) {
        this.statMap.set('category', 'weapon');
      } else if (consumableTypes.includes(itemType)) {
        this.statMap.set('category', 'consumable');
      } else if (tome_types.includes(itemType)) {
        this.statMap.set('category', 'tome');
      }
    }

    if (this.statMap.get('tier') === 'Crafted') {
      this.statMap.set('crafted', true);

      for (const e of skp_elements) {
        this.statMap.set(e + 'DamLow', this.statMap.get(e + 'Dam'));
      }
      this.statMap.set('nDamLow', this.statMap.get('nDam'));
      this.statMap.set('hpLow', this.statMap.get('hp'));
      for (const e of skp_order) {
        rollMap(this.statMap, 'minRolls').set(e, statNum(this.statMap, e));
        rollMap(this.statMap, 'maxRolls').set(e, statNum(this.statMap, e));
      }

      this.statMap.set('lvlLow', this.statMap.get('lvl'));
      if (this.statMap.get('category') === 'weapon') {
        this.statMap.set(
          'nDamBaseLow',
          Math.floor((parseFloat(String(this.statMap.get('nDamLow'))) + parseFloat(String(this.statMap.get('nDam')))) / 2),
        );
        this.statMap.set(
          'nDamBaseHigh',
          Math.floor((parseFloat(String(this.statMap.get('nDamLow'))) + parseFloat(String(this.statMap.get('nDam')))) / 2),
        );
        for (const e in skp_elements) {
          this.statMap.set(
            skp_elements[e] + 'DamBaseLow',
            Math.floor(
              (parseFloat(String(this.statMap.get(skp_elements[e] + 'DamLow'))) +
                parseFloat(String(this.statMap.get(skp_elements[e] + 'Dam')))) /
                2,
            ),
          );
          this.statMap.set(
            skp_elements[e] + 'DamBaseHigh',
            Math.floor(
              (parseFloat(String(this.statMap.get(skp_elements[e] + 'DamLow'))) +
                parseFloat(String(this.statMap.get(skp_elements[e] + 'Dam')))) /
                2,
            ),
          );
        }
        this.statMap.set('ingredPowders', []);
      }
    }

    if (this.statMap.get('category') !== 'weapon') {
      this.statMap.set('atkSpd', '');
    }

    if (this.statMap.get('name') && this.statMap.get('name') !== '') {
      this.statMap.set('displayName', this.statMap.get('name'));
    } else {
      this.statMap.set('displayName', 'Custom Item');
    }
    this.statMap.set('powders', []);

    this.statMap.set('reqs', [
      this.statMap.get('strReq'),
      this.statMap.get('dexReq'),
      this.statMap.get('intReq'),
      this.statMap.get('defReq'),
      this.statMap.get('agiReq'),
    ]);
    this.statMap.set('skillpoints', [
      this.statMap.get('str'),
      this.statMap.get('dex'),
      this.statMap.get('int'),
      this.statMap.get('def'),
      this.statMap.get('agi'),
    ]);

    this.statMap.set('restrict', 'Custom Item');
  }

  copy(): Custom {
    return new Custom(new Map(this.statMap));
  }
}

function statNum(statMap: Map<string, unknown>, key: string): number {
  const val = statMap.get(key);
  return typeof val === 'number' ? val : 0;
}

attachGlobals({
  ci_save_order,
  encodeCustom,
  encodeCustomLegacy,
  decodeCustom,
  getCustomFromHash,
  Custom,
});
