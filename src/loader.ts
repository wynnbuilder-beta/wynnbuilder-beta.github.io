import type { JsonPayload, LoaderPaths, RejectFn } from './types/loader';
import { sleep } from './utils';

/**
 * An interface encapsulating common behaviour in the loading of data from remote and local databases.
 *
 * Implementors must implement the following functions:
 * - process_remote
 * - process_local
 * - process_old_version
 * - init_maps
 *
 * And the following getters:
 * - remote_paths
 * - old_data_paths
 */
export class Loader {
  db: IDBDatabase | null = null;
  in_progress = false;
  complete = false;
  reload = false;
  db_name: string;
  store_names: string[];
  db_version: number;

  constructor(db_name: string, store_names: string[], db_version: number) {
    this.db_name = db_name;
    this.store_names = store_names;
    this.db_version = db_version;
  }

  /**
   * Load data from remote DB (aka a big json file) and process it, populating the local DB in the process. Calls init_maps() on success.
   * Loading is complete after calling this function.
   */
  async load(): Promise<void> {
    const data = await Loader.load_json(this.remote_paths, 'no-cache');
    return new Promise((resolve, reject) => {
      const tsx = this.write_transaction();
      this.process_remote(data, tsx, reject);
      tsx.oncomplete = () => {
        this.init_maps();
        this.complete = true;
        this.db!.close();
        resolve();
      };
    });
  }

  /*
   * Load data from local DB (aka indexedDB) and process it. Calls init_maps() on success.
   * Loading is complete after calling this function.
   */
  load_local(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tsx = this.read_transaction();
      this.process_local(tsx, reject);
      tsx.oncomplete = () => {
        try {
          this.init_maps();
        } catch (e) {
          reject(e);
          return;
        }
        this.complete = true;
        this.db!.close();
        resolve();
      };
    });
  }

  /**
   * Load data of a provided version (aka a big json file) and process it. Calls init_maps() on success.
   * Loading is complete after calling this function.
   */
  async load_old_version(version_str: string): Promise<void> {
    let paths: string | string[] = this.old_data_paths;
    if (Array.isArray(paths)) {
      paths = paths.map((path) => `data/${version_str}/${path}`);
    } else {
      paths = `data/${version_str}/${paths}`;
    }
    const data = await Loader.load_json(paths);
    this.in_progress = true;
    this.process_old_version(data);
    this.init_maps();
    this.complete = true;
  }

  /**
   * Load one or multiple json files from a given path.
   * the path provided does not need to end with `.json`.
   * Returns a promise that resolves to the parsed json files in the order provided
   * in paths.
   */
  static async load_json(
    paths: LoaderPaths,
    cache_mode: RequestCache = 'default',
  ): Promise<JsonPayload | JsonPayload[]> {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const base_url = `${protocol}//${host}`;

    if (typeof paths === 'string') {
      const url = `${base_url}/${paths}.json`;
      return (await fetch(url, { cache: cache_mode })).json();
    }
    if (typeof paths === 'object' && paths !== null && Symbol.iterator in paths) {
      const promises: Response[] = [];
      for (const path of paths) {
        const url = `${base_url}/${path}.json`;
        promises.push(await fetch(url, { cache: cache_mode }));
      }
      return Promise.all(promises.map((promise) => promise.json()));
    }
    throw new TypeError('`Argument` must be an iterable or string.');
  }

  /** Returns a read-only transaction into all stores of the database linked to this loader. */
  read_transaction(): IDBTransaction {
    return this.db!.transaction(this.store_names, 'readonly');
  }

  /** Returns a read-write transaction into all stores of the database linked to this loader. */
  write_transaction(): IDBTransaction {
    return this.db!.transaction(this.store_names, 'readwrite');
  }

  /**
   * Initializes the loading procedure.
   * Upgrades the linked database in case of a version change, then reads the data into memory.
   */
  async load_init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.db_name, this.db_version);

      request.onerror = () => {
        reject('DB failed to open...');
      };

      request.onsuccess = async (event: Event) => {
        const target = event.target as IDBOpenDBRequest;
        this.db = target.result;

        if (this.in_progress) {
          while (!this.complete) {
            await sleep(100);
          }
          console.log('Skipping load...');
        } else {
          this.in_progress = true;
          if (this.reload) {
            console.log(`Populating ${this.db_name} and loading the new data...`);
            await this.load();
          } else {
            console.log(`Using existing ${this.db_name} data...`);
            try {
              await this.load_local();
            } catch (e) {
              console.warn(`${this.db_name} appears corrupt, reloading from remote...`, e);
              this.db!.close();
              await new Promise<void>((res, rej) => {
                const del = indexedDB.deleteDatabase(this.db_name);
                del.onsuccess = () => res();
                del.onerror = () => rej('Failed to delete corrupt DB');
              });
              const req2 = indexedDB.open(this.db_name, this.db_version);
              req2.onupgradeneeded = (upgradeEvent: IDBVersionChangeEvent) => {
                const db = (upgradeEvent.target as IDBOpenDBRequest).result;
                for (const store_name of this.store_names) {
                  db.createObjectStore(store_name);
                }
              };
              await new Promise<void>((res, rej) => {
                req2.onsuccess = () => res();
                req2.onerror = () => rej('Failed to reopen DB after corruption');
              });
              this.db = req2.result;
              await this.load();
            }
          }
        }
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        this.reload = true;

        const db = (event.target as IDBOpenDBRequest).result;

        try {
          for (const existing_obj_store of db.objectStoreNames) {
            db.deleteObjectStore(existing_obj_store);
          }
        } catch (error) {
          console.log('Could not delete item DB. This is probably fine');
        }

        for (const store_name of this.store_names) {
          db.createObjectStore(store_name);
        }

        console.log('DB setup complete...');
      };
    });
  }

  /** Paths corresponding to the versioned data of the loader. */
  get old_data_paths(): LoaderPaths {
    throw new Error(`Loader of ${this.db_name} does not implement the getter old_data_paths`);
  }

  /** Paths corresponding to the remote data of the loader. */
  get remote_paths(): LoaderPaths {
    throw new Error(`Loader of ${this.db_name} does not implement the getter remote_paths`);
  }

  /**
   * Process the payload returned remotely.
   * This method populates the local database with the remote data and loads it into memory.
   * Must be synchronous.
   */
  process_remote(_data: JsonPayload, _tsx: IDBTransaction, _reject: RejectFn): void {
    throw new Error(`Loader of ${this.db_name} does not implement process_remote`);
  }

  /**
   * Process the local user data.
   * This method loads the data from the local database into memory.
   * Must be synchronous.
   */
  process_local(_tsx: IDBTransaction, _reject: RejectFn): void {
    throw new Error(`Loader of ${this.db_name} does not implement process_local`);
  }

  /**
   * Process the returned versioned data.
   * This method loads the data into memory.
   * Must be synchronous.
   */
  process_old_version(_data: JsonPayload): void {
    throw new Error(`Loader of ${this.db_name} does not implement process_old_version`);
  }

  /**
   * Operate on the in-memory data loaded by one of the processing functions
   * to initialize Wynnbuilder global maps that are used throughout the codebase.
   * Must be synchronous.
   */
  init_maps(): void {
    throw new Error(`Loader of ${this.db_name} does not implement init_maps`);
  }
}

;
