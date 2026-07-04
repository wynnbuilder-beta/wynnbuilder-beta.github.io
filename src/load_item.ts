import { item_fields, item_types, str_item_fields } from '@/build_utils';
import { attachGlobals, live } from '@/lib/attachGlobals';
import { Loader } from '@/loader';
import type { ItemRemotePayload, ItemStatMap, MajorId, SetBonusData } from '@/types/item';
import type { JsonPayload, RejectFn } from '@/types/loader';

const ITEM_DB_VERSION = 195;

export let items: ItemStatMap[];
export let sets = new Map<string, SetBonusData>();
export let itemMap = new Map<string, ItemStatMap>();
export let idMap = new Map<number, string>();
export let redirectMap = new Map<number, string>();
export let itemLists = new Map<string, string[]>();
export let none_items: ItemStatMap[] = [];

export class ItemLoader extends Loader {
  get remote_paths() {
    return 'data/baseline/compressed/compress';
  }

  get old_data_paths() {
    return 'items';
  }

  process_remote(data: JsonPayload, tsx: IDBTransaction, reject: RejectFn) {
    const payload = data as ItemRemotePayload;
    items = payload.items;
    const sets_ = payload.sets;

    tsx.onabort = () => {
      reject('Not enough space...');
    };

    const items_store = tsx.objectStore('item_db');
    for (const item of items) {
      clean_item(item);
      const req = items_store.add(item, item.name);
      req.onerror = () => {
        reject('ADD ITEM ERROR? ' + item.name);
      };
    }
    const sets_store = tsx.objectStore('set_db');
    for (const set in sets_) {
      sets_store.add(sets_[set], set);
      sets.set(set, sets_[set]);
    }
  }

  process_old_version(data: JsonPayload) {
    const payload = data as ItemRemotePayload;
    items = payload.items;
    for (const item of items) {
      clean_item(item);
    }
    const sets_ = payload.sets;
    sets = new Map();
    for (const set in sets_) {
      sets.set(set, sets_[set]);
    }
  }

  process_local(tsx: IDBTransaction, reject: RejectFn) {
    const sets_store = tsx.objectStore('set_db');
    const item_store = tsx.objectStore('item_db');
    const items_request = item_store.getAll();
    items_request.onerror = () => {
      reject('Could not read local item db...');
    };
    items_request.onsuccess = (event) => {
      items = (event.target as IDBRequest<ItemStatMap[]>).result;
      console.log('Successfully read local item db.');
    };

    // key-value iteration (hpp don't break this again)
    // https://stackoverflow.com/questions/47931595/indexeddb-getting-all-data-with-keys
    const sets_cursor_request = sets_store.openCursor();
    sets_cursor_request.onerror = () => {
      reject('Could not read local set db...');
    };
    sets_cursor_request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const key = cursor.primaryKey as string;
        const value = cursor.value as SetBonusData;
        sets.set(key, value);
        cursor.continue();
      } else {
        // no more results
        console.log('Successfully read local set db.');
      }
    };
  }

  init_maps() {
    const none_items_info: [string, string, string][] = [
      ['armor', 'helmet', 'No Helmet'],
      ['armor', 'chestplate', 'No Chestplate'],
      ['armor', 'leggings', 'No Leggings'],
      ['armor', 'boots', 'No Boots'],
      ['accessory', 'ring', 'No Ring 1'],
      ['accessory', 'ring', 'No Ring 2'],
      ['accessory', 'bracelet', 'No Bracelet'],
      ['accessory', 'necklace', 'No Necklace'],
      ['weapon', 'dagger', 'No Weapon'],
    ];

    for (let i = 0; i < none_items_info.length; i++) {
      const item: ItemStatMap = {};
      item.slots = 0;
      item.category = none_items_info[i][0];
      item.type = none_items_info[i][1];
      item.name = none_items_info[i][2];
      item.displayName = item.name;
      item.set = null;
      item.quest = null;
      item.skillpoints = [0, 0, 0, 0, 0];
      item.has_negstat = false;
      item.reqs = [0, 0, 0, 0, 0];
      item.fixID = true;
      item.tier = 'Normal';
      item.id = 10000 + i;
      item.nDam = '0-0';
      item.eDam = '0-0';
      item.tDam = '0-0';
      item.wDam = '0-0';
      item.fDam = '0-0';
      item.aDam = '0-0';
      clean_item(item);

      none_items.push(item);
    }

    // List of 'raw' "none" items (No Helmet, etc), in order helmet, chestplate... ring1, ring2, brace, neck, weapon.
    for (const it of item_types) {
      itemLists.set(it, []);
    }

    itemMap = new Map();
    /* Mapping from item names to set names. */
    idMap = new Map();
    redirectMap = new Map();
    items = items.concat(none_items);
    for (const item of items) {
      if (item.remapID === undefined) {
        itemLists.get(item.type).push(item.displayName);
        itemMap.set(item.displayName, item);
        if (none_items.includes(item)) {
          idMap.set(item.id, '');
        } else {
          idMap.set(item.id, item.displayName);
        }
      } else {
        redirectMap.set(item.id, item.remapID as string);
      }
    }
    for (const [set_name, set_data] of sets) {
      const set_items = (set_data as { items: string[] }).items;
      for (const item_name of set_items) {
        itemMap.get(item_name).set = set_name;
      }
    }
  }
}

export const item_loader = new ItemLoader('item_db', ['item_db', 'set_db'], ITEM_DB_VERSION);

/*
 * Clean bad item data.
 * Assigns `displayName` to equal `name` if it is undefined.
 * String values default to empty string.
 * Numeric values default to 0.
 * Major ID defaults to empty list.
 */
export function clean_item(item: ItemStatMap) {
  if (item.remapID === undefined) {
    if (item.displayName === undefined) {
      item.displayName = item.name;
    }
    item.skillpoints = [item.str, item.dex, item.int, item.def, item.agi] as number[];
    item.reqs = [item.strReq, item.dexReq, item.intReq, item.defReq, item.agiReq] as number[];
    item.has_negstat = false;
    for (let i = 0; i < 5; ++i) {
      if (item.reqs[i] === undefined) {
        item.reqs[i] = 0;
      }
      if (item.skillpoints[i] === undefined) {
        item.skillpoints[i] = 0;
      }
      if (item.skillpoints[i] < 0) {
        item.has_negstat = true;
      }
    }
    for (const key of item_fields) {
      if (item[key] === undefined) {
        if (key in str_item_fields) {
          item[key] = '';
        } else if (key == 'majorIds') {
          item[key] = [];
        } else {
          item[key] = 0;
        }
      }
    }
  }
}

// Aspects and tomes
export const wynn_version_names = [
  '2.0.1.1',
  '2.0.1.2',
  '2.0.2.1',
  '2.0.2.3',
  '2.0.3.1',
  '2.0.4.1',
  '2.0.4.3',
  '2.0.4.4',
  '2.1.0.0',
  '2.1.0.1',
  '2.1.1.0',
  '2.1.1.1',
  '2.1.1.2',
  '2.1.1.3',
  '2.1.1.4',
  '2.1.1.5',
  '2.1.1.6',
  '2.1.1.7',
  '2.1.2.0',
  '2.1.3.0',
  '2.1.3.4',
  '2.1.4.0',
  '2.1.5.0',
  '2.1.6.0',
  '2.2.0.0',
  '2.2.0.7',
  '2.2.0.12',
  '2.2.0.14',
  '2.2.0.19',
  '2.2.0.21',
  '2.2.0.31',
  '2.2.1.0',
];

export const WYNN_VERSION_LATEST = wynn_version_names.length - 1;
// Default to the newest version.
export let wynn_version_id = WYNN_VERSION_LATEST; // Required for copy url...

export function setWynnVersionId(id: number): void {
  wynn_version_id = id;
}

/**
 * A map of all existing major ids.
 */
export let MAJOR_IDS: Record<string, MajorId> | null = null;

export async function load_major_id_data(version_str: string) {
  const getUrl = window.location;
  const baseUrl = `${getUrl.protocol}//${getUrl.host}`;
  // No random string -- we want to use caching
  const url = `${baseUrl}/data/${version_str}/majid.json`;
  MAJOR_IDS = await (await fetch(url)).json();
  console.log('Loaded major id data');
}

export let ENC: unknown = null;
export let DEC: unknown = null;

export async function load_encoding_constants(version_str: string, decoding_version_str?: string) {
  const getUrl = window.location;
  const baseUrl = `${getUrl.protocol}//${getUrl.host}`;
  // No random string -- we want to use caching
  const encoding_url = `${baseUrl}/data/${version_str}/encoding_consts.json`;
  const decoding_url = `${baseUrl}/data/${decoding_version_str}/encoding_consts.json`;
  ENC = await (await fetch(encoding_url)).json();
  if (decoding_version_str !== undefined && decoding_version_str != version_str) {
    DEC = await (await fetch(decoding_url)).json();
  } else {
    DEC = ENC;
  }
  console.log('Loaded encoding data');
}

attachGlobals({
  ItemLoader,
  item_loader,
  items: live(
    () => items,
    (v) => {
      items = v as ItemStatMap[];
    },
  ),
  sets: live(
    () => sets,
    (v) => {
      sets = v as Map<string, SetBonusData>;
    },
  ),
  itemMap: live(
    () => itemMap,
    (v) => {
      itemMap = v as Map<string, ItemStatMap>;
    },
  ),
  idMap: live(
    () => idMap,
    (v) => {
      idMap = v as Map<number, string>;
    },
  ),
  redirectMap: live(
    () => redirectMap,
    (v) => {
      redirectMap = v as Map<number, string>;
    },
  ),
  itemLists,
  none_items,
  clean_item,
  wynn_version_names,
  WYNN_VERSION_LATEST,
  wynn_version_id: live(
    () => wynn_version_id,
    (v) => {
      wynn_version_id = v as number;
    },
  ),
  MAJOR_IDS: live(
    () => MAJOR_IDS,
    (v) => {
      MAJOR_IDS = v as Record<string, MajorId> | null;
    },
  ),
  load_major_id_data,
  load_encoding_constants,
  ENC: live(
    () => ENC,
    (v) => {
      ENC = v;
    },
  ),
  DEC: live(
    () => DEC,
    (v) => {
      DEC = v;
    },
  ),
});
