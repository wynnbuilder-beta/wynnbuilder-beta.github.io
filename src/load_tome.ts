/**
 * @module load_tome
 *
 * Depends on `clean_item` from load_item.
 */

import { tome_types } from '@/build_utils';
import { Loader } from '@/loader';
import { clean_item } from '@/load_item';
import type { ItemStatMap } from '@/types/item';
import type { JsonPayload, RejectFn } from '@/types/loader';

const TOME_DB_VERSION = 17;

interface TomeRemotePayload {
  tomes: ItemStatMap[];
}

export let tomes: ItemStatMap[];
export let tomeMap: Map<string, ItemStatMap>;
export let tomeIDMap: Map<number, string>;
export let tomeRedirectMap: Map<number, number>;
export let tomeLists = new Map<string, string[]>();
export let none_tomes: ItemStatMap[] = [];

export class TomeLoader extends Loader {
  get old_data_paths() {
    return 'tomes';
  }

  get remote_paths() {
    return 'data/baseline/tomes';
  }

  process_local(tsx: IDBTransaction, reject: RejectFn) {
    const tome_store = tsx.objectStore('tome_db');
    const tome_request = tome_store.getAll();
    tome_request.onerror = () => {
      reject('Could not read local tome db...');
    };
    tome_request.onsuccess = (event) => {
      tomes = (event.target as IDBRequest<ItemStatMap[]>).result;
      console.log('Successfully read local tome db.');
    };
  }

  process_old_version(data: JsonPayload) {
    const payload = data as TomeRemotePayload;
    tomes = payload.tomes;
    for (const tome of tomes) {
      clean_item(tome);
    }
  }

  process_remote(data: JsonPayload, tsx: IDBTransaction, reject: RejectFn) {
    const payload = data as TomeRemotePayload;
    tomes = payload.tomes;
    tsx.onabort = () => {
      reject('Not enough space...');
    };
    const tomes_store = tsx.objectStore('tome_db');
    for (const tome of tomes) {
      clean_item(tome);
      const req = tomes_store.add(tome, tome.name);
      req.onerror = () => {
        reject('ADD TOME ERROR? ' + tome.name);
      };
    }
  }

  init_maps() {
    const none_tomes_info: [string, string, string, number][] = [
      ['tome', 'weaponTome', 'No Weapon Tome', 61],
      ['tome', 'armorTome', 'No Armor Tome', 62],
      ['tome', 'guildTome', 'No Guild Tome', 63],
      ['tome', 'lootrunTome', 'No Lootrun Tome', 93],
      ['tome', 'gatherXpTome', 'No Marathon Tome', 162],
      ['tome', 'dungeonXpTome', 'No Mysticism Tome', 163],
      ['tome', 'mobXpTome', 'No Expertise Tome', 164],
    ];

    tomeMap = new Map();
    tomeIDMap = new Map();
    tomeRedirectMap = new Map();
    for (const it of tome_types) {
      tomeLists.set(it, []);
    }

    for (let i = 0; i < none_tomes_info.length; i++) {
      const tome: ItemStatMap = {};
      tome.slots = 0;
      tome.category = none_tomes_info[i][0];
      tome.type = none_tomes_info[i][1];
      tome.name = none_tomes_info[i][2];
      tome.displayName = tome.name;
      tome.set = null;
      tome.quest = null;
      tome.skillpoints = [0, 0, 0, 0, 0];
      tome.has_negstat = false;
      tome.reqs = [0, 0, 0, 0, 0];
      tome.fixID = true;
      tome.tier = 'Normal';
      tome.id = none_tomes_info[i][3];
      tome.nDam = '0-0';
      tome.eDam = '0-0';
      tome.tDam = '0-0';
      tome.wDam = '0-0';
      tome.fDam = '0-0';
      tome.aDam = '0-0';
      clean_item(tome);

      none_tomes.push(tome);
    }
    tomes = tomes.concat(none_tomes);
    for (const tome of tomes) {
      if (tome.remapID === undefined) {
        tomeLists.get(tome.type as string).push(tome.displayName as string);
        tomeMap.set(tome.displayName as string, tome);
        if (none_tomes.includes(tome)) {
          tomeIDMap.set(tome.id as number, '');
        } else {
          tomeIDMap.set(tome.id as number, tome.displayName as string);
        }
      } else {
        tomeRedirectMap.set(tome.id as number, tome.remapID as number);
      }
    }
  }
}

export const tome_loader = new TomeLoader('tome_db', ['tome_db'], TOME_DB_VERSION);

;
