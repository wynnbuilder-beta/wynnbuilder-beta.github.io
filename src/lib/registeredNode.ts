/** Lazy-registered value (e.g. compute graph nodes created during page init). */
export type Registered<T> = {
  get(): T;
  tryGet(): T | undefined;
  /** Registration only — call from register*Graph(), not from consumers. */
  set(value: T): void;
};

export function createRegistered<T>(name: string): Registered<T> {
  let value: T | undefined;
  return {
    get() {
      if (value === undefined) {
        throw new Error(`${name} is not registered — call the page/graph init first`);
      }
      return value;
    },
    tryGet() {
      return value;
    },
    set(v) {
      value = v;
    },
  };
}
