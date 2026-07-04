/**
 * Loader infrastructure types.
 */

export type LoaderPaths = string | string[];
export type JsonPayload = unknown;
export type RejectFn = (reason?: unknown) => void;

export type FetchCacheMode = RequestCache;

export interface LoaderImplementor {
  readonly remote_paths: LoaderPaths;
  readonly old_data_paths: LoaderPaths;
  process_remote(data: JsonPayload, tsx: IDBTransaction, reject: RejectFn): void;
  process_local(tsx: IDBTransaction, reject: RejectFn): void;
  process_old_version(data: JsonPayload): void;
  init_maps(): void;
}
