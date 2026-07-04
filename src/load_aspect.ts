import { classes } from '@/build_utils';
import { attachGlobals, live } from '@/lib/attachGlobals';
import { Loader } from '@/loader';
import { wynn_version_names, WYNN_VERSION_LATEST } from '@/load_item';
import type { AspectDatabase, AspectIdMap, AspectMap, AspectSpec, NoneAspect } from '@/types/aspect';
import type { PlayerClass } from '@/types/stats';
import type { JsonPayload, RejectFn } from '@/types/loader';

const ASPECT_DB_VERSION = 36;

export let aspects: AspectDatabase = {};
export let aspect_map = new Map<PlayerClass, AspectMap>();
export let aspect_id_map = new Map<PlayerClass, AspectIdMap>();

export const none_aspect: NoneAspect = {
  displayName: 'No Aspect',
  id: 256,
  tier: 'Normal',
  tiers: [],
  NONE: true,
};

export class AspectLoader extends Loader {
  get remote_paths() {
    return `data/${wynn_version_names[WYNN_VERSION_LATEST]}/aspects`;
  }

  get old_data_paths() {
    return 'aspects';
  }

  process_remote(data: JsonPayload, tsx: IDBTransaction, reject: RejectFn) {
    aspects = data as AspectDatabase;
    tsx.onabort = () => {
      reject('Not enough space...');
    };
    for (const [c, aspect_arr] of Object.entries(aspects)) {
      const class_store = tsx.objectStore(c);
      for (const aspect_spec of aspect_arr) {
        class_store.add(aspect_spec, aspect_spec.displayName);
      }
    }
  }

  process_old_version(data: JsonPayload) {
    aspects = data as AspectDatabase;
  }

  process_local(tsx: IDBTransaction, reject: RejectFn) {
    for (const c of classes) {
      const class_store = tsx.objectStore(c);
      const req = class_store.getAll();
      req.onerror = () => {
        reject(`Could not read local object store for ${c}.`);
      };
      req.onsuccess = (event) => {
        aspects[c] = (event.target as IDBRequest<AspectSpec[]>).result;
        console.log(`Successfully read local aspect db for ${c}.`);
      };
    }
  }

  init_maps() {
    for (const c of Object.keys(aspects)) {
      const cls = c as PlayerClass;
      aspect_map.set(cls, new Map());
      aspect_id_map.set(cls, new Map());

      aspect_map.get(cls)!.set(none_aspect.displayName, none_aspect);
      aspect_id_map.get(cls)!.set(none_aspect.id, none_aspect);

      for (const aspect of aspects[c]) {
        aspect.NONE = false;
        aspect_id_map.get(cls)!.set(aspect.id, aspect);
        aspect_map.get(cls)!.set(aspect.displayName, aspect);
      }
    }
  }
}

export const aspect_loader = new AspectLoader('aspect_db', [...classes], ASPECT_DB_VERSION);

attachGlobals({
  AspectLoader,
  aspect_loader,
  aspects: live(
    () => aspects,
    (v) => {
      aspects = v as AspectDatabase;
    },
  ),
  aspect_map,
  aspect_id_map,
  none_aspect,
});
