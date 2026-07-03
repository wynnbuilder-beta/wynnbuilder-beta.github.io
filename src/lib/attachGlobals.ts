export function attachGlobals(bindings: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(bindings)) {
    (window as unknown as Record<string, unknown>)[key] = value;
  }
}
