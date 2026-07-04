import { BoolLitTerm, compareLexico } from '@/query';
import { ExprParser } from '@/expr_parser';
import { setHTML } from '@/utils';
import type { Term } from '@/query';

type SearchDbEntry = [Record<string, unknown>, Map<string, unknown>];

export type AdvSearchConfig = {
  loadData: () => { db: SearchDbEntry[]; parser: ExprParser };
  display: (itemExp: Map<string, unknown>, id: string) => void;
  generateEntries: (size: number, itemList: HTMLElement, itemEntries: HTMLElement[]) => void;
  getQueryIdentifiers: () => string[];
};

let advSearchConfig: AdvSearchConfig | null = null;

function requireAdvSearchConfig(): AdvSearchConfig {
  if (advSearchConfig === null) {
    throw new Error('configureAdvSearch() must be called before using advanced search');
  }
  return advSearchConfig;
}

export function configureAdvSearch(config: AdvSearchConfig): void {
  advSearchConfig = config;
}

function checkBool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error(`Expected boolean, but got ${typeof v}`);
  return v;
}

function isIdentifierChar(character: string): boolean {
  return /[\w\d%]/i.test(character);
}

function isIdentifierFirstChar(character: string): boolean {
  return /\w/i.test(character);
}

class AutocompleteContext {
  field: HTMLInputElement;
  text: string;
  cursorPos: number;
  startIndex: number;
  endIndex: number;

  constructor(field: HTMLInputElement) {
    this.field = field;
    this.text = field.value;
    this.cursorPos = this.startIndex = this.endIndex = field.selectionEnd ?? 0;
    while (this.startIndex > 0 && isIdentifierChar(this.text.charAt(this.startIndex - 1))) {
      --this.startIndex;
    }
    if (!isIdentifierFirstChar(this.text.charAt(this.startIndex))) {
      this.startIndex = this.cursorPos;
      return;
    }
    while (this.endIndex < this.text.length && isIdentifierChar(this.text.charAt(this.endIndex))) {
      ++this.endIndex;
    }
  }

  get valid(): boolean {
    return this.endIndex > this.startIndex;
  }

  get complText(): string {
    return this.text.substring(this.startIndex, this.cursorPos);
  }

  insert(completion: string, supplant: boolean): void {
    this.field.setRangeText(completion, this.startIndex, supplant ? this.endIndex : this.cursorPos, 'end');
    this.field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    this.startIndex = this.endIndex = -1;
    setTimeout(() => this.field.focus(), 5);
  }
}

class AutocompleteController {
  ctx: AutocompleteContext;
  completions: string[];
  exprField: ExprField;
  currentFocus: HTMLDivElement | null = null;

  constructor(ctx: AutocompleteContext, completions: string[], exprField: ExprField) {
    this.ctx = ctx;
    this.completions = completions;
    this.exprField = exprField;

    for (const completion of completions) {
      const complElem = document.createElement('div');
      complElem.classList.add('search-field-compl-entry');
      complElem.setAttribute('data-compl', completion);
      complElem.innerText = completion;
      complElem.addEventListener('mousemove', () => this.focus(complElem));
      complElem.addEventListener('mousedown', () => this.complete(completion, true));
      exprField.completions.append(complElem);
    }
  }

  get valid(): boolean {
    return this.ctx.valid && this.completions.length > 0;
  }

  focus(complElem: HTMLDivElement): void {
    if (this.currentFocus !== null) {
      this.currentFocus.classList.remove('focused');
    }
    this.currentFocus = complElem;
    complElem.classList.add('focused');
    complElem.scrollIntoView({ block: 'nearest' });
  }

  focusNext(): void {
    if (this.currentFocus === null || !this.currentFocus.nextSibling) {
      this.focus(this.exprField.completions.firstChild as HTMLDivElement);
    } else {
      this.focus(this.currentFocus.nextSibling as HTMLDivElement);
    }
  }

  focusPrev(): void {
    if (this.currentFocus === null || !this.currentFocus.previousSibling) {
      this.focus(this.exprField.completions.lastChild as HTMLDivElement);
    } else {
      this.focus(this.currentFocus.previousSibling as HTMLDivElement);
    }
  }

  complete(completion: string | null, supplant: boolean): void {
    if (completion === null) {
      completion = this.currentFocus!.getAttribute('data-compl');
      if (completion === null) {
        return;
      }
    }
    this.ctx.insert(completion, supplant);
    this.exprField.clearAutocomplete();
  }
}

type SortOutput = {
  type: string;
  resolve: (i: Record<string, unknown>, ie: Map<string, unknown>) => unknown[];
};

class ExprField {
  field: HTMLInputElement;
  completions: HTMLElement;
  errorText: HTMLElement;
  prevComplText: string | null = null;
  prevComplPos: number | null = null;
  complCtrl: AutocompleteController | null = null;
  compiler: (exprStr: string) => Term | SortOutput;
  output: Term | SortOutput | null = null;
  text: string | null = null;

  constructor(key: string, compiler: (exprStr: string) => Term | SortOutput) {
    this.field = document.getElementById(`search-${key}-field`) as HTMLInputElement;
    this.completions = document.getElementById(`search-${key}-compl`)!;
    this.errorText = document.getElementById(`search-${key}-error`)!;
    this.compiler = compiler;

    this.field.addEventListener('focus', () => this.scheduleAutocomplete());
    this.field.addEventListener('change', () => this.scheduleAutocomplete());
    this.field.addEventListener('keydown', (e) => {
      if (this.complCtrl !== null && this.complCtrl.valid) {
        switch (e.key) {
          case 'Up':
          case 'ArrowUp':
            this.complCtrl.focusPrev();
            break;
          case 'Down':
          case 'ArrowDown':
            this.complCtrl.focusNext();
            break;
          case 'Tab':
            this.complCtrl.complete(null, true);
            break;
          case 'Enter':
            this.complCtrl.complete(null, false);
            break;
          case 'Escape':
            this.clearAutocomplete();
            break;
          default:
            this.scheduleAutocomplete();
            return;
        }
        e.preventDefault();
      } else {
        switch (e.key) {
          case 'Spacebar':
          case ' ':
            if (e.ctrlKey) {
              this.autocomplete();
              return;
            }
            break;
        }
      }
      this.scheduleAutocomplete();
    });
    this.field.addEventListener('mousedown', () => this.scheduleAutocomplete());
    this.field.addEventListener('blur', () => this.clearAutocomplete());
  }

  get value(): string {
    return this.field.value;
  }

  scheduleAutocomplete(): void {
    setTimeout(() => {
      if (this.field.value !== this.prevComplText || this.field.selectionEnd !== this.prevComplPos) {
        this.prevComplText = this.field.value;
        this.prevComplPos = this.field.selectionEnd;
        this.autocomplete();
      }
    }, 1);
  }

  autocomplete(): void {
    while (this.completions.lastChild) {
      this.completions.removeChild(this.completions.lastChild);
    }

    const complCtx = new AutocompleteContext(this.field);
    if (!complCtx.valid) {
      this.clearAutocomplete();
      return;
    }

    const complText = complCtx.complText;
    const completions = requireAdvSearchConfig().getQueryIdentifiers().filter((ident) => ident.startsWith(complText));
    if (completions.length === 0) {
      this.clearAutocomplete();
      return;
    }

    this.complCtrl = new AutocompleteController(complCtx, completions, this);
    this.complCtrl.focusNext();
    this.completions.classList.add('visible');
  }

  clearAutocomplete(): void {
    this.completions.classList.remove('visible');
    this.prevComplText = this.field.value;
    this.prevComplPos = this.field.selectionEnd;
    this.complCtrl = null;
  }

  compile(): boolean {
    if (this.value === this.text) return false;
    this.text = this.value;
    this.errorText.innerText = '';
    try {
      this.output = this.compiler(this.text);
    } catch (e) {
      console.log(e);
      this.errorText.innerText = (e as Error).message;
      this.output = null;
    }
    return true;
  }
}

function stringify(v: unknown): string {
  return typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v);
}

export let searchDb: SearchDbEntry[] = [];
export let exprParser: ExprParser;

export function init_items_adv(): void {
  const config = requireAdvSearchConfig();
  const { db, parser } = config.loadData();
  searchDb = db;
  exprParser = parser;

  const itemList = document.getElementById('item-list')!;
  const itemListFooter = document.getElementById('item-list-footer')!;

  const ITEM_LIST_SIZE = 64;
  const itemEntries: HTMLElement[] = [];

  config.generateEntries(ITEM_LIST_SIZE, itemList, itemEntries);

  const searchFilterField = new ExprField('filter', function (exprStr) {
    const expr = exprParser.parse(exprStr);
    return expr !== null ? expr : new BoolLitTerm(true);
  });
  const searchSortField = new ExprField('sort', function (exprStr) {
    const subExprs = exprStr
      .split(';')
      .map((e) => exprParser.parse(e))
      .filter((f) => f != null) as Term[];
    return {
      type: 'array',
      resolve(i: Record<string, unknown>, ie: Map<string, unknown>) {
        const sortKeys: unknown[] = [];
        for (let k = 0; k < subExprs.length; k++) sortKeys.push(subExprs[k].resolve(i, ie));
        return sortKeys;
      },
    };
  });

  function updateSearch(): void {
    const changed = searchFilterField.compile() || searchSortField.compile();
    if (!changed || searchFilterField.output === null || searchSortField.output === null) return;

    const newUrl =
      `${window.location.protocol}//${window.location.host}${window.location.pathname}` +
      `?f=${encodeURIComponent(searchFilterField.value)}&s=${encodeURIComponent(searchSortField.value)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    itemListFooter.innerText = '';
    for (let i = 0; i < ITEM_LIST_SIZE; i++) {
      setHTML(`item-entry-${i}`, '');
      itemEntries[i].classList.remove('visible');
      setHTML(`item-sort-entry-${i}`, '');
    }

    const searchResults: {
      item: Record<string, unknown>;
      itemExp: Map<string, unknown>;
      sortKeys: unknown[];
    }[] = [];
    try {
      for (let i = 0; i < searchDb.length; i++) {
        const item = searchDb[i][0];
        const itemExp = searchDb[i][1];
        if (checkBool((searchFilterField.output as Term).resolve(item, itemExp))) {
          searchResults.push({
            item,
            itemExp,
            sortKeys: (searchSortField.output as SortOutput).resolve(item, itemExp),
          });
        }
      }
    } catch (e) {
      console.log(e);
      searchFilterField.errorText.innerText = (e as Error).message;
      return;
    }
    if (searchResults.length === 0) {
      itemListFooter.innerText = 'No results!';
      return;
    }
    try {
      searchResults.sort((a, b) => {
        try {
          return compareLexico(a.item, a.sortKeys, b.item, b.sortKeys);
        } catch (e) {
          console.log(a.item, b.item);
          throw e;
        }
      });
    } catch (e) {
      console.log(e);
      searchSortField.errorText.innerText = (e as Error).message;
      return;
    }

    const searchMax = Math.min(searchResults.length, ITEM_LIST_SIZE);
    for (let i = 0; i < searchMax; i++) {
      const result = searchResults[i];
      itemEntries[i].classList.add('visible');
      config.display(result.itemExp, `item-entry-${i}`);

      if (result.sortKeys.length > 0) {
        const sortKeyList = document.createElement('ul');
        sortKeyList.classList.add('item-entry-sort-key', 'itemp', 'T0');
        const sortKeyListContainer = document.getElementById(`item-sort-entry-${i}`)!;
        sortKeyListContainer.append(sortKeyList);
        for (let j = 0; j < result.sortKeys.length; j++) {
          const sortKeyElem = document.createElement('li');
          sortKeyElem.innerText = stringify(result.sortKeys[j]);
          sortKeyList.append(sortKeyElem);
        }
      }
    }
    if (searchMax < searchResults.length) {
      itemListFooter.innerText = `${searchResults.length - searchMax} more...`;
    }
  }

  let updateSearchTask: ReturnType<typeof setTimeout> | null = null;

  function scheduleSearchUpdate(): void {
    if (updateSearchTask !== null) {
      clearTimeout(updateSearchTask);
    }
    updateSearchTask = setTimeout(() => {
      updateSearchTask = null;
      updateSearch();
    }, 500);
  }

  searchFilterField.field.addEventListener('input', () => scheduleSearchUpdate());
  searchSortField.field.addEventListener('input', () => scheduleSearchUpdate());

  if (window.location.search.startsWith('?')) {
    for (const entryStr of window.location.search.substring(1).split('&')) {
      const ndx = entryStr.indexOf('=');
      if (ndx !== -1) {
        switch (entryStr.substring(0, ndx)) {
          case 'f':
            searchFilterField.field.value = decodeURIComponent(entryStr.substring(ndx + 1));
            break;
          case 's':
            searchSortField.field.value = decodeURIComponent(entryStr.substring(ndx + 1));
            break;
        }
      }
    }
  }
  updateSearch();

  searchFilterField.field.focus();
  searchFilterField.field.select();

  document.getElementById('scroll-up')!.addEventListener('mousedown', () => scrollTo({ top: 0, behavior: 'smooth' }));
}

;
