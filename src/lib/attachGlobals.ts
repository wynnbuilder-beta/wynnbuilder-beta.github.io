export type LiveBinding<T = unknown> = {
  __live: true;
  get: () => T;
  set?: (value: T) => void;
};

/** Wrap a module `let` export so attachGlobals keeps a live window binding. */
export function live<T>(getter: () => T, setter?: (value: T) => void): LiveBinding<T> {
  return { __live: true, get: getter, set: setter };
}

function isLiveBinding(value: unknown): value is LiveBinding {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__live' in value &&
    (value as LiveBinding).__live === true
  );
}

export function attachLiveGlobal(
  name: string,
  getter: () => unknown,
  setter?: (value: unknown) => void,
): void {
  const descriptor: PropertyDescriptor = {
    get: getter,
    enumerable: true,
    configurable: true,
  };
  if (setter) {
    descriptor.set = setter;
  }
  Object.defineProperty(window, name, descriptor);
}

export function attachGlobals(bindings: Record<string, unknown>): void {
  for (const [key, binding] of Object.entries(bindings)) {
    if (isLiveBinding(binding)) {
      attachLiveGlobal(key, binding.get, binding.set);
    } else {
      (window as unknown as Record<string, unknown>)[key] = binding;
    }
  }
}
