import { attachGlobals, live } from '@/lib/attachGlobals';
import { Loader } from '@/loader';
import type { JsonPayload, RejectFn } from '@/types/loader';

const MAP_DB_VERSION = 3;

export interface TerrLocation {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TerrDataEntry {
  territory: string;
  location: TerrLocation;
  neighbors: string[];
  resources: string[];
  storage: string[];
  emeralds: boolean;
  doubleemeralds: boolean;
  doubleresource: boolean;
  guild?: string;
  [key: string]: unknown;
}

export interface TerrResourceEntry {
  resources: string[];
  storage: string[];
  emeralds: boolean;
  doubleemeralds: boolean;
  doubleresource: boolean;
}

export interface MapLocEntry {
  [key: string]: unknown;
}

export let terrs = new Map<string, TerrLocation>();
export let claims = new Map<string, string>();
export let neighbors = new Map<string, string[]>();
export let resources = new Map<string, TerrResourceEntry>();
export let maplocs: MapLocEntry[] = [];
export let terrdata: Record<string, TerrDataEntry> | TerrDataEntry[] = {};

export class MapLoader extends Loader {
  get remote_paths() {
    return [
      'data/baseline/compressed/terrs_compress',
      'data/baseline/compressed/maploc_compress',
    ];
  }

  get old_data_paths() {
    return 'map';
  }

  process_remote(data: JsonPayload, tsx: IDBTransaction, _reject: RejectFn) {
    const [terrResult, maplocResult] = data as [
      Record<string, TerrDataEntry>,
      { locations: MapLocEntry[] },
    ];
    terrdata = terrResult;
    maplocs = maplocResult.locations;

    window.dispatchEvent(new CustomEvent('wynnb-map-data-updated'));
    console.log(terrdata);
    console.log(maplocs);

    const map_store = tsx.objectStore('map_db');
    for (const terr of Object.entries(terrdata)) {
      map_store.add(terr[1], terr[0]);
    }

    const maploc_store = tsx.objectStore('maploc_db');
    for (const i in maplocs) {
      maploc_store.add(maplocs[i], i);
    }
  }

  process_old_version(_data: JsonPayload) {
    throw new Error('MapLoader does not support old version loading');
  }

  process_local(tsx: IDBTransaction, reject: RejectFn) {
    const map_store = tsx.objectStore('map_db');
    const maploc_store = tsx.objectStore('maploc_db');

    const map_request = map_store.getAll();
    map_request.onerror = () => {
      console.log('Could not read local map db...');
      reject('Could not read local map db...');
    };
    map_request.onsuccess = (event) => {
      console.log('Successfully read local map db.');
      terrdata = (event.target as IDBRequest<TerrDataEntry[]>).result;
    };

    const maploc_request = maploc_store.getAll();
    maploc_request.onerror = () => {
      console.log('Could not read local map locations db...');
      reject('Could not read local map locations db...');
    };
    maploc_request.onsuccess = (event) => {
      console.log('Successfully read local locations map db.');
      maplocs = (event.target as IDBRequest<MapLocEntry[]>).result;
    };
  }

  init_maps() {
    init_map_maps();
  }
}

export const map_loader = new MapLoader('map_db', ['map_db', 'maploc_db'], MAP_DB_VERSION);

export function init_map_maps(): void {
  terrs = new Map();
  neighbors = new Map();
  resources = new Map();

  for (const [, data] of Object.entries(terrdata)) {
    terrs.set(data.territory, data.location);
    neighbors.set(data.territory, data.neighbors);
    resources.set(data.territory, {
      resources: data.resources,
      storage: data.storage,
      emeralds: data.emeralds,
      doubleemeralds: data.doubleemeralds,
      doubleresource: data.doubleresource,
    });
  }
}

export async function load_map_init(init_func: () => void): Promise<void> {
  await map_loader.load_init();
  init_func();
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Saves map data. Meant to be called after territories and guilds are refreshed. */
export function save_map_data(): void {
  if (!map_loader.db) {
    return;
  }
  const mdb = map_loader.db;

  const add_tx2 = mdb.transaction(['map_db'], 'readwrite');
  const map_store = add_tx2.objectStore('map_db');
  for (const terr of Object.entries(terrdata)) {
    map_store.add(terr[1], terr[0]);
  }

  const add_tx3 = mdb.transaction(['maploc_db'], 'readwrite');
  const maploc_store = add_tx3.objectStore('maploc_db');
  for (const i in maplocs) {
    maploc_store.add(maplocs[i], i);
  }

  void Promise.all([transactionDone(add_tx2), transactionDone(add_tx3)]).then(() => {
    mdb.close();
    init_map_maps();
  });
}

attachGlobals({
  MapLoader,
  map_loader,
  terrs: live(
    () => terrs,
    (v) => {
      terrs = v as Map<string, TerrLocation>;
    },
  ),
  claims,
  neighbors: live(
    () => neighbors,
    (v) => {
      neighbors = v as Map<string, string[]>;
    },
  ),
  resources: live(
    () => resources,
    (v) => {
      resources = v as Map<string, TerrResourceEntry>;
    },
  ),
  maplocs: live(
    () => maplocs,
    (v) => {
      maplocs = v as MapLocEntry[];
    },
  ),
  terrdata: live(
    () => terrdata,
    (v) => {
      terrdata = v as Record<string, TerrDataEntry> | TerrDataEntry[];
    },
  ),
  init_map_maps,
  load_map_init,
  save_map_data,
});
