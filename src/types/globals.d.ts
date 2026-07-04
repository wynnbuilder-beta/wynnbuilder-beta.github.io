declare global {
  interface Window {
    opera?: string;
  }

  interface HTMLInputElement {
    /** Custom slider accent color used by gen_slider/recolor_slider. */
    color?: string;
  }
}

export {};
