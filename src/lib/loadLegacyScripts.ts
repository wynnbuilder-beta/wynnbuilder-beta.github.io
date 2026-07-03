/** Load classic (non-module) scripts in order, preserving global scope. */
export function loadLegacyScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(el);
  });
}

export async function loadLegacyScripts(sources: string[]): Promise<void> {
  for (const src of sources) {
    await loadLegacyScript(src);
  }
}
