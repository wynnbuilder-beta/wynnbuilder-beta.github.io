/** Minimal Leaflet typings for map.ts (full @types/leaflet not installed). */
declare namespace L {
  interface Map {
    fitBounds(bounds: LatLngBoundsExpression): this;
    setView(center: LatLngTuple, zoom?: number): this;
    addEventListener(type: string, fn: (ev: LeafletMouseEvent) => void): this;
    on(type: string, fn: (ev: LeafletMouseEvent) => void): this;
    removeLayer(layer: Layer): this;
  }

  interface Layer {
    addTo(map: Map): this;
    bindTooltip(content: string, options?: Record<string, unknown>): this;
    on(type: string, fn: (e: LeafletMouseEvent) => void): this;
  }

  interface Marker extends Layer {}
  interface Polygon extends Layer {}
  interface Polyline extends Layer {}
  interface ImageOverlay extends Layer {}

  interface LeafletMouseEvent {
    latlng: { lat: number; lng: number };
    originalEvent: MouseEvent;
  }

  type LatLngBoundsExpression = [LatLngTuple, LatLngTuple];
  type LatLngTuple = [number, number];

  interface MapOptions {
    crs?: unknown;
    minZoom?: number;
    maxZoom?: number;
    zoomControl?: boolean;
    zoom?: number;
  }

  interface IconOptions {
    iconUrl: string;
    iconSize: [number, number];
    iconAnchor: [number, number];
    shadowUrl?: string;
    shadowSize?: [number, number];
    shadowAnchor?: [number, number];
    className?: string;
  }

  interface MarkerOptions {
    icon?: Icon;
  }

  interface Icon {
    options: IconOptions;
  }

  const CRS: { Simple: unknown };

  function map(id: string, options?: MapOptions): Map;
  function imageOverlay(url: string, bounds: LatLngBoundsExpression, options?: Record<string, unknown>): ImageOverlay;
  function marker(latlng: LatLngTuple, options?: MarkerOptions): Marker;
  function polygon(latlngs: LatLngTuple[], options?: Record<string, unknown>): Polygon;
  function polyline(latlngs: LatLngTuple[], options?: Record<string, unknown>): Polyline;
  function icon(options: IconOptions): Icon;

  namespace control {
    function zoom(options?: { position?: string }): { addTo(map: Map): void };
  }
}

declare const L: typeof L;
