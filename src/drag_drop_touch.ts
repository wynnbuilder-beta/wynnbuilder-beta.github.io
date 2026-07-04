/*
	DragDropTouch by Bernardo Castilho
	https://github.com/Bernardo-Castilho/dragdroptouch
	MIT License

	Note: it only works on a real phone for some reason, it doesn't work on desktop browser simulations of phones for some reason.
*/

interface Point {
  x: number;
  y: number;
}

interface DragImageOffset {
  x: number;
  y: number;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DragDropTouch {
  export class DataTransfer {
    private _dropEffect = 'move';
    private _effectAllowed = 'all';
    private _data: Record<string, string> = {};

    get dropEffect(): string {
      return this._dropEffect;
    }
    set dropEffect(value: string) {
      this._dropEffect = value;
    }

    get effectAllowed(): string {
      return this._effectAllowed;
    }
    set effectAllowed(value: string) {
      this._effectAllowed = value;
    }

    get types(): string[] {
      return Object.keys(this._data);
    }

    clearData(type?: string | null): void {
      if (type != null) {
        delete this._data[type.toLowerCase()];
      } else {
        this._data = {};
      }
    }

    getData(type: string): string {
      return this._data[type.toLowerCase()] || '';
    }

    setData(type: string, value: string): void {
      this._data[type.toLowerCase()] = value;
    }

    setDragImage(img: HTMLElement, x: number, y: number): void {
      const inst = DragDropTouch._instance!;
      inst.setDragImage(img, x, y);
    }
  }

  export class DragDropTouch {
    static _instance: DragDropTouch | null = null;
    static _THRESHOLD = 5;
    static _OPACITY = 0.5;
    static _DBLCLICK = 500;
    static _CTXMENU = 900;
    static _ISPRESSHOLDMODE = false;
    static _PRESSHOLDAWAIT = 400;
    static _PRESSHOLDMARGIN = 25;
    static _PRESSHOLDTHRESHOLD = 0;
    static _rmvAtts = 'id,class,style,draggable'.split(',');
    static _kbdProps = 'altKey,ctrlKey,metaKey,shiftKey'.split(',');
    static _ptProps = 'pageX,pageY,clientX,clientY,screenX,screenY,offsetX,offsetY'.split(',');

    private _lastClick = 0;
    private _dragSource: HTMLElement | null = null;
    private _lastTouch: TouchEvent | null = null;
    private _lastTarget: Element | null = null;
    private _ptDown: Point | null = null;
    private _isDragEnabled = false;
    private _isDropZone = false;
    private _dataTransfer = new DataTransfer();
    private _pressHoldInterval: ReturnType<typeof setTimeout> | undefined;
    private _img: HTMLElement | null = null;
    private _imgCustom: HTMLElement | null = null;
    private _imgOffset: DragImageOffset = { x: 0, y: 0 };

    setDragImage(img: HTMLElement, x: number, y: number): void {
      this._imgCustom = img;
      this._imgOffset = { x, y };
    }

    constructor() {
      if (DragDropTouch._instance) {
        throw 'DragDropTouch instance already created.';
      }
      let passive = false;
      document.addEventListener(
        'test',
        () => {},
        {
          get passive() {
            passive = true;
            return true;
          },
        },
      );
      if (navigator.maxTouchPoints) {
        const d = document;
        const ts = this._touchstart.bind(this);
        const tm = this._touchmove.bind(this);
        const te = this._touchend.bind(this);
        const opt = passive ? { passive: false, capture: false } : false;
        d.addEventListener('touchstart', ts, opt);
        d.addEventListener('touchmove', tm, opt);
        d.addEventListener('touchend', te);
        d.addEventListener('touchcancel', te);
      }
    }

    static getInstance(): DragDropTouch | null {
      return DragDropTouch._instance;
    }

    private _touchstart(e: TouchEvent): void {
      if (!this._shouldHandle(e)) return;
      if (
        Date.now() - this._lastClick < DragDropTouch._DBLCLICK &&
        this._dispatchEvent(e, 'dblclick', e.target as Element)
      ) {
        e.preventDefault();
        this._reset();
        return;
      }
      this._reset();
      const src = this._closestDraggable(e.target as Element);
      if (!src) return;
      if (
        this._dispatchEvent(e, 'mousemove', e.target as Element) ||
        this._dispatchEvent(e, 'mousedown', e.target as Element)
      ) {
        return;
      }
      this._dragSource = src;
      this._ptDown = this._getPoint(e);
      this._lastTouch = e;
      e.preventDefault();
      setTimeout(() => {
        if (this._dragSource === src && this._img == null) {
          if (this._dispatchEvent(e, 'contextmenu', src)) {
            this._reset();
          }
        }
      }, DragDropTouch._CTXMENU);
      if (DragDropTouch._ISPRESSHOLDMODE) {
        this._pressHoldInterval = setTimeout(() => {
          this._isDragEnabled = true;
          this._touchmove(e);
        }, DragDropTouch._PRESSHOLDAWAIT);
      }
    }

    private _touchmove(e: TouchEvent): void {
      if (this._shouldCancelPressHoldMove(e)) {
        this._reset();
        return;
      }
      if (!this._shouldHandleMove(e) && !this._shouldHandlePressHoldMove(e)) return;
      const target = this._getTarget(e);
      if (this._dispatchEvent(e, 'mousemove', target)) {
        this._lastTouch = e;
        e.preventDefault();
        return;
      }
      if (this._dragSource && !this._img && this._shouldStartDragging(e)) {
        this._dispatchEvent(e, 'dragstart', this._dragSource);
        this._createImage(e);
        this._dispatchEvent(e, 'dragenter', target);
      }
      if (this._img) {
        this._lastTouch = e;
        e.preventDefault();
        this._dispatchEvent(e, 'drag', this._dragSource!);
        if (target !== this._lastTarget) {
          if (this._lastTouch) {
            this._dispatchEvent(this._lastTouch, 'dragleave', this._lastTarget!);
          }
          this._dispatchEvent(e, 'dragenter', target);
          this._lastTarget = target;
        }
        this._moveImage(e);
        this._isDropZone = this._dispatchEvent(e, 'dragover', target);
      }
    }

    private _touchend(e: TouchEvent): void {
      if (!this._shouldHandle(e)) return;
      if (this._lastTouch && this._dispatchEvent(this._lastTouch, 'mouseup', e.target as Element)) {
        e.preventDefault();
        return;
      }
      if (!this._img) {
        this._dragSource = null;
        if (this._lastTouch) {
          this._dispatchEvent(this._lastTouch, 'click', e.target as Element);
        }
        this._lastClick = Date.now();
      }
      this._destroyImage();
      if (this._dragSource) {
        if (e.type.indexOf('cancel') < 0 && this._isDropZone && this._lastTouch && this._lastTarget) {
          this._dispatchEvent(this._lastTouch, 'drop', this._lastTarget);
        }
        if (this._lastTouch) {
          this._dispatchEvent(this._lastTouch, 'dragend', this._dragSource);
        }
        this._reset();
      }
    }

    private _shouldHandle(e: TouchEvent): boolean {
      return !!(e && !e.defaultPrevented && e.touches && e.touches.length < 2);
    }

    private _shouldHandleMove(e: TouchEvent): boolean {
      return !DragDropTouch._ISPRESSHOLDMODE && this._shouldHandle(e);
    }

    private _shouldHandlePressHoldMove(e: TouchEvent): boolean {
      return !!(DragDropTouch._ISPRESSHOLDMODE && this._isDragEnabled && e.touches && e.touches.length);
    }

    private _shouldCancelPressHoldMove(e: TouchEvent): boolean {
      return DragDropTouch._ISPRESSHOLDMODE && !this._isDragEnabled && this._getDelta(e) > DragDropTouch._PRESSHOLDMARGIN;
    }

    private _shouldStartDragging(e: TouchEvent): boolean {
      const d = this._getDelta(e);
      return d > DragDropTouch._THRESHOLD || (DragDropTouch._ISPRESSHOLDMODE && d >= DragDropTouch._PRESSHOLDTHRESHOLD);
    }

    private _reset(): void {
      this._destroyImage();
      this._dragSource = null;
      this._lastTouch = null;
      this._lastTarget = null;
      this._ptDown = null;
      this._isDragEnabled = false;
      this._isDropZone = false;
      this._dataTransfer = new DataTransfer();
      clearInterval(this._pressHoldInterval);
    }

    private _getPoint(e: TouchEvent | Touch, page?: boolean): Point {
      const t = 'touches' in e && e.touches ? e.touches[0] : (e as Touch);
      return { x: page ? t.pageX : t.clientX, y: page ? t.pageY : t.clientY };
    }

    private _getDelta(e: TouchEvent): number {
      if (DragDropTouch._ISPRESSHOLDMODE && !this._ptDown) return 0;
      const p = this._getPoint(e);
      return Math.abs(p.x - this._ptDown!.x) + Math.abs(p.y - this._ptDown!.y);
    }

    private _getTarget(e: TouchEvent): Element {
      const p = this._getPoint(e);
      let t = document.elementFromPoint(p.x, p.y);
      while (t && getComputedStyle(t).pointerEvents === 'none') {
        t = t.parentElement;
      }
      return t!;
    }

    private _createImage(e: TouchEvent): void {
      if (this._img) this._destroyImage();
      const src = this._imgCustom || this._dragSource!;
      this._img = src.cloneNode(true) as HTMLElement;
      this._copyStyle(src, this._img);
      this._img.style.top = this._img.style.left = '-9999px';
      if (!this._imgCustom) {
        const rc = src.getBoundingClientRect();
        const pt = this._getPoint(e);
        this._imgOffset = { x: pt.x - rc.left, y: pt.y - rc.top };
        this._img.style.opacity = DragDropTouch._OPACITY.toString();
      }
      this._moveImage(e);
      document.body.appendChild(this._img);
    }

    private _destroyImage(): void {
      if (this._img?.parentElement) {
        this._img.parentElement.removeChild(this._img);
      }
      this._img = null;
      this._imgCustom = null;
    }

    private _moveImage(e: TouchEvent): void {
      requestAnimationFrame(() => {
        if (!this._img) return;
        const p = this._getPoint(e, true);
        const s = this._img.style;
        s.position = 'absolute';
        s.pointerEvents = 'none';
        s.zIndex = '999999';
        s.left = Math.round(p.x - this._imgOffset.x) + 'px';
        s.top = Math.round(p.y - this._imgOffset.y) + 'px';
      });
    }

    private _copyProps(dst: Record<string, unknown>, src: Record<string, unknown>, props: string[]): void {
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        dst[p] = src[p];
      }
    }

    private _copyStyle(src: Element, dst: Element): void {
      DragDropTouch._rmvAtts.forEach((a) => {
        dst.removeAttribute(a);
      });
      if (src instanceof HTMLCanvasElement && dst instanceof HTMLCanvasElement) {
        dst.width = src.width;
        dst.height = src.height;
        dst.getContext('2d')!.drawImage(src, 0, 0);
      }
      const cs = getComputedStyle(src);
      const dstEl = dst as HTMLElement;
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i];
        if (p.indexOf('transition') < 0) {
          dstEl.style.setProperty(p, cs.getPropertyValue(p));
        }
      }
      dstEl.style.pointerEvents = 'none';
      for (let i = 0; i < src.children.length; i++) {
        this._copyStyle(src.children[i], dst.children[i]);
      }
    }

    private _dispatchEvent(e: TouchEvent, type: string, target: Element): boolean {
      if (!e || !target) return false;
      const evt = document.createEvent('Event');
      const touch = e.touches ? e.touches[0] : e;
      evt.initEvent(type, true, true);
      const mouseEvt = evt as unknown as Record<string, unknown> & { dataTransfer?: DataTransfer };
      mouseEvt.button = 0;
      mouseEvt.which = 1;
      mouseEvt.buttons = 1;
      this._copyProps(
        mouseEvt as unknown as Record<string, unknown>,
        e as unknown as Record<string, unknown>,
        DragDropTouch._kbdProps,
      );
      this._copyProps(
        mouseEvt as unknown as Record<string, unknown>,
        touch as unknown as Record<string, unknown>,
        DragDropTouch._ptProps,
      );
      mouseEvt.dataTransfer = this._dataTransfer;
      target.dispatchEvent(evt);
      return evt.defaultPrevented;
    }

    private _closestDraggable(t: Element | null): HTMLElement | null {
      for (; t; t = t.parentElement) {
        if (t.hasAttribute('draggable') && (t as HTMLElement).draggable) {
          return t as HTMLElement;
        }
      }
      return null;
    }
  }

  DragDropTouch._instance = new DragDropTouch();
}

;
