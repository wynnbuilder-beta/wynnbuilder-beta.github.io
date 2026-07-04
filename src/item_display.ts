/*
 * File for display commands specific to the single item page.
 */
import { idPrefixes, idSuffixes } from './display_constants';
import { itemMap } from '@/load_item';
import { ingMap } from '@/load_ing';
import { reversedIDs, rolledIDs } from './build_utils';
import { toggleAmps } from './item';
import { make_elem, ROMAN_NUMERAL_MAP, toggleButton } from './utils';
import type { ExpandedItem } from './types/item';

interface DropData {
  name: string;
  coords?: number[] | number[][];
}

interface ItemCloneMeta {
  droppedBy?: DropData[];
  dropInfo?: {
    name?: string;
    type?: string;
    coordinates?: string | number[];
  };
}

function makeInfoRow(title: string, value: unknown): HTMLElement {
  const row = make_elem('div', [
    'row',
    'rounded',
    'scaled-font',
    'border',
    'border-1',
    'border-dark',
    'dark-shadow',
    'p-1',
    'm-1',
    'text-capitalize',
    'justify-content-start',
  ]);
  row.appendChild(make_elem('span', ['col-4', 'col-lg-2'], { textContent: title }));
  row.appendChild(make_elem('span', ['col'], { textContent: String(value) }));
  return row;
}

/** Displays the ID costs of an item */
export function displayIDCosts(elemID: string, item: ExpandedItem): void {
  const parent_elem = document.getElementById(elemID);
  if (!parent_elem) return;

  const tier = item.get('tier');
  if (
    (item.has('fixID') && item.get('fixID')) ||
    ['Normal', 'Crafted', 'Custom', 'none', ' '].includes(String(tier))
  ) {
    return;
  }

  /** Returns [invSpace, E, EB, LE, Stx LE] */
  function emsToInvSpace(ems: number): [number, number, number, number, number] {
    let stx = Math.floor(ems / 262144);
    ems -= stx * 4096 * 64;
    let LE = Math.floor(ems / 4096);
    ems -= LE * 4096;
    let EB = Math.floor(ems / 64);
    ems -= EB * 64;
    const e = ems;
    return [stx + Math.ceil(LE / 64) + Math.ceil(EB / 64) + Math.ceil(e / 64), e, EB, LE, stx];
  }

  function getIDCost(tierName: string, lvl: number): number {
    switch (tierName) {
      case 'Unique':
        return Math.round(0.5 * lvl + 3);
      case 'Rare':
        return Math.round(1.2 * lvl + 8);
      case 'Legendary':
        return Math.round(4.5 * lvl + 12);
      case 'Fabled':
        return Math.round(12 * lvl + 26);
      case 'Mythic':
        return Math.round(18 * lvl + 90);
      case 'Set':
        return Math.round(1.5 * lvl + 8);
      default:
        return -1;
    }
  }

  parent_elem.style.cssText = 'display: visible';
  let lvl = item.get('lvl');
  if (typeof lvl === 'string') {
    lvl = parseFloat(lvl);
  }

  const title_elem = make_elem('p', ['text-center', String(tier)], { textContent: 'Identification costs' });
  parent_elem.appendChild(title_elem);

  const grid_item = make_elem('div', ['row', 'p-2', 'justify-content-center']);
  parent_elem.appendChild(grid_item);

  let IDcost = getIDCost(String(tier), lvl as number);
  const initIDcost = IDcost;
  let invSpace = emsToInvSpace(IDcost);
  let rerolls = 0;

  while (invSpace[0] <= 28 && IDcost > 0) {
    const container = make_elem('div', [
      'container',
      'rounded',
      'col-lg-3',
      'col-sm-12',
      'scaled-font',
      'border',
      'border-1',
      'border-dark',
      'dark-shadow',
      'p-3',
      'm-1',
    ]);
    const container_title = make_elem('p', ['text-center', 'text-decoration-underline'], {
      style: { color: 'white' },
      textContent: rerolls == 0 ? 'Initial ID: ' : `Reroll to [${rerolls + 1}]: `,
    });

    const total_cost_container = make_elem('p', []);
    const total_cost_number = make_elem('b', ['Set'], { textContent: `${IDcost} ` });
    const total_cost_suffix = make_elem('b', [], { textContent: 'Emeralds' });
    total_cost_container.append(total_cost_number, total_cost_suffix);

    container.append(container_title, total_cost_container, make_elem('hr', []));

    const classes = ['', 'emerald', 'emerald-block', 'liquid-emerald', 'liquid-emerald-stack'];
    const esuffixes = ['', 'Emeralds', 'EB', 'LE', 'LE Stacks'];
    for (let i = 4; i > 0; i--) {
      if (invSpace[i] == 0) continue;
      const n_container = make_elem('div', ['row', 'justify-content-start', 'my-2']);
      const img = make_elem('div', ['col-2', classes[i]]);
      const n_number = make_elem('div', ['col-2', 'Set'], { textContent: invSpace[i] });
      const n_suffix = make_elem('div', ['col-8'], { textContent: esuffixes[i] });
      n_container.append(img, n_number, n_suffix);
      container.appendChild(n_container);
    }

    grid_item.appendChild(container);

    rerolls += 1;
    IDcost = Math.round(initIDcost * 5 ** rerolls);
    invSpace = emsToInvSpace(IDcost);
  }
}

/** Displays Additional Info for an item or ingredient */
export function displayAdditionalInfo(elemID: string, item: ExpandedItem): void {
  const parent_elem = document.getElementById(elemID);
  if (!parent_elem) return;

  const title_elem = make_elem('p', ['text-center', String(item.get('tier'))], { textContent: 'Additional Info' });
  parent_elem.appendChild(title_elem);

  let item_clone: ItemCloneMeta | undefined;
  if (itemMap) {
    item_clone = itemMap.get(String(item.get('displayName'))) as ItemCloneMeta | undefined;
  } else if (ingMap) {
    item_clone = ingMap.get(String(item.get('displayName'))) as ItemCloneMeta | undefined;
  }

  if (!item_clone) return;

  if (item_clone.droppedBy) {
    const dropMap = new Map<string, number[][]>();
    for (const dropData of item_clone.droppedBy) {
      if (dropMap.has(dropData.name) && dropData.coords) {
        if (Array.isArray(dropData.coords[0])) {
          for (const subDrop of dropData.coords as number[][]) {
            dropMap.get(dropData.name)!.push(subDrop);
          }
        } else {
          dropMap.get(dropData.name)!.push(dropData.coords as number[]);
        }
      } else if (dropData.coords) {
        if (Array.isArray(dropData.coords[0])) {
          for (const subDrop of dropData.coords as number[][]) {
            dropMap.set(dropData.name, [subDrop]);
          }
        } else {
          dropMap.set(dropData.name, [dropData.coords as number[]]);
        }
      } else {
        dropMap.set(dropData.name, []);
      }
    }
    const dropDisplay = make_elem('div', [
      'row',
      'rounded',
      'scaled-font',
      'border',
      'border-1',
      'border-dark',
      'dark-shadow',
      'p-1',
      'm-1',
      'text-capitalize',
      'justify-content-start',
    ]);
    dropDisplay.appendChild(make_elem('b', ['text-center', 'text-decoration-underline'], { textContent: 'Dropped By' }));

    const list = make_elem('ul', [], {});
    list.style.cssText = 'padding: 0; margin: 0; list-style: none; width: 100%;';

    for (const [name, coords] of dropMap) {
      const li = make_elem('li', [], {});
      li.style.cssText = 'border-bottom: 1px solid #ccc; padding: 0.25rem 0.5rem;';

      li.appendChild(make_elem('b', [], { textContent: name }));

      if (coords.length > 0) {
        const coordList = make_elem('ul', [], {});
        coordList.style.cssText = 'display: flex; flex-wrap: wrap; padding: 0; margin: 0; list-style: none;';

        for (const coord of coords) {
          const coordItem = make_elem('li', [], {
            textContent: '[' + coord[0] + ', ' + coord[1] + ', ' + coord[2] + ']',
          });
          coordItem.style.cssText = 'padding: 0.5rem;';
          coordList.appendChild(coordItem);
        }
        li.appendChild(coordList);
      }

      list.appendChild(li);
    }

    dropDisplay.appendChild(list);
    parent_elem.appendChild(dropDisplay);
  } else if (item_clone.dropInfo === undefined) {
    parent_elem.appendChild(
      makeInfoRow('Drop Type:', item.has('drop') ? item.get('drop') : 'No drop metadata found.'),
    );
  } else {
    parent_elem.appendChild(makeInfoRow('Drops From:', item_clone.dropInfo.name));
    if (item_clone.dropInfo.type !== undefined) {
      parent_elem.appendChild(makeInfoRow('Type:', item_clone.dropInfo.type));
    }
    if (item_clone.dropInfo.coordinates !== undefined) {
      parent_elem.appendChild(makeInfoRow('Coordinates:', `(${item_clone.dropInfo.coordinates})`));
    }
  }
}

/** Displays the individual probabilities of each possible value of each rollable ID for this item. */
export function displayIDProbabilities(parent_id: string, item: ExpandedItem, amp: number): void {
  if (item.has('fixID') && item.get('fixID')) return;
  const parent_elem = document.getElementById(parent_id);
  if (!parent_elem) return;

  parent_elem.style.display = '';
  parent_elem.innerHTML = '';
  const title_elem = make_elem('p', ['text-center', 'm-auto', 'mb-3', 'text-decoration-underline', 'title'], {
    textContent: 'Identification Probabilities',
    id: 'ID_PROB_TITLE',
  });
  parent_elem.appendChild(title_elem);

  const disclaimer_elem = make_elem('p', [], {
    textContent:
      'Disclaimer: IDs are rolled on a uniform distribution. A chance of 0% means that either the minimum or maximum possible multiplier must be rolled to get this value.',
  });

  parent_elem.appendChild(disclaimer_elem);

  const amp_row = make_elem('p', ['col'], { id: 'amp_row' });
  amp_row.appendChild(make_elem('b', [], { textContent: 'Corkian Amplifier: ' }));

  for (let i = 1; i < 5; i++) {
    const ampBtn = document.createElement('button');
    ampBtn.id = `cork_amp_${i}`;
    ampBtn.textContent = ROMAN_NUMERAL_MAP.get(i)!;
    amp_row.appendChild(ampBtn);
    ampBtn.addEventListener('click', () => {
      toggleAmps(i);
    });
  }
  parent_elem.appendChild(amp_row);

  if (amp != 0) {
    toggleButton('cork_amp_' + amp);
  }

  const item_name = String(item.get('displayName'));
  const itemBase = itemMap.get(item_name) as Record<string, number> | undefined;
  if (!itemBase) return;

  const table_elem = document.createElement('table');
  parent_elem.appendChild(table_elem);
  for (const [id, val] of Object.entries(itemBase)) {
    if (rolledIDs.includes(id)) {
      const maxRolls = item.get('maxRolls') as Map<string, number> | undefined;
      const minRolls = item.get('minRolls') as Map<string, number> | undefined;
      if (!maxRolls?.get(id)) {
        continue;
      }
      let min = minRolls!.get(id)!;
      let max = maxRolls.get(id)!;
      if ((val > 0) == !reversedIDs.includes(id)) {
        const base = itemBase[id];
        if (reversedIDs.includes(id)) {
          min = Math.min(Math.floor((0.3 + 0.05 * amp) * base), -1);
        } else {
          min = Math.max(Math.round((0.3 + 0.05 * amp) * base), 1);
        }
      }

      const row_title = document.createElement('tr');
      const title_left = document.createElement('td');
      const left_val_title = document.createElement('b');
      const left_val_elem = document.createElement('b');
      title_left.style.textAlign = 'left';
      left_val_title.textContent = idPrefixes[id] + 'Base ';
      left_val_elem.textContent = val + idSuffixes[id];
      if ((val > 0) == !reversedIDs.includes(id)) {
        left_val_elem.classList.add('positive');
      } else if ((val > 0) == reversedIDs.includes(id)) {
        left_val_elem.classList.add('negative');
      }
      title_left.append(left_val_title, left_val_elem);
      row_title.appendChild(title_left);

      const title_right = document.createElement('td');
      const title_right_text = document.createElement('b');
      title_right.style.textAlign = 'left';
      title_right_text.textContent = '[ ' + min + idSuffixes[id] + ', ' + max + idSuffixes[id] + ' ]';
      if (
        (min > 0 && max > 0 && !reversedIDs.includes(id)) ||
        (min < 0 && max < 0 && reversedIDs.includes(id))
      ) {
        title_right_text.classList.add('positive');
      } else if (
        (min < 0 && max < 0 && !reversedIDs.includes(id)) ||
        (min > 0 && max > 0 && reversedIDs.includes(id))
      ) {
        title_right_text.classList.add('negative');
      }
      title_right.appendChild(title_right_text);

      const title_input = document.createElement('td');
      const title_input_slider = document.createElement('input');
      title_input_slider.type = 'range';
      title_input_slider.id = id + '-slider';
      if (!reversedIDs.includes(id)) {
        title_input_slider.step = '1';
        title_input_slider.min = `${min}`;
        title_input_slider.max = `${max}`;
        title_input_slider.value = `${max}`;
      } else {
        title_input_slider.step = '1';
        title_input_slider.min = `${-1 * min}`;
        title_input_slider.max = `${-1 * max}`;
        title_input_slider.value = `${-1 * max}`;
      }
      const title_input_textbox = document.createElement('input');
      title_input_textbox.type = 'text';
      title_input_textbox.value = `${max}`;
      title_input_textbox.id = id + '-textbox';
      title_input_textbox.classList.add('small-input');
      title_input.appendChild(title_input_slider);
      title_input.appendChild(title_input_textbox);

      row_title.appendChild(title_left);
      row_title.appendChild(title_right);
      row_title.appendChild(title_input);

      const row_chances = document.createElement('tr');
      const chance_cdf = document.createElement('td');
      const chance_pdf = document.createElement('td');
      const cdf_p = document.createElement('p');
      cdf_p.id = id + '-cdf';
      const pdf_p = document.createElement('p');
      pdf_p.id = id + '-pdf';

      chance_cdf.appendChild(cdf_p);
      chance_pdf.appendChild(pdf_p);
      row_chances.appendChild(chance_cdf);
      row_chances.appendChild(chance_pdf);

      table_elem.appendChild(row_title);
      table_elem.appendChild(row_chances);

      stringPDF(id, max, val, amp);
      stringCDF(id, max, val, amp);
      title_input_slider.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const id_name = target.id.split('-')[0];
        const textbox_elem = document.getElementById(id_name + '-textbox') as HTMLInputElement | null;

        if (reversedIDs.includes(id_name)) {
          if (Number(target.value) < -1 * min) {
            target.value = String(-1 * min);
          }
          if (Number(target.value) > -1 * max) {
            target.value = String(-1 * max);
          }
          stringPDF(id_name, -1 * Number(target.value), val, amp);
          stringCDF(id_name, -1 * Number(target.value), val, amp);
        } else {
          if (Number(target.value) < min) {
            target.value = String(min);
          }
          if (Number(target.value) > max) {
            target.value = String(max);
          }
          stringPDF(id_name, 1 * Number(target.value), val, amp);
          stringCDF(id_name, 1 * Number(target.value), val, amp);
        }

        if (textbox_elem && textbox_elem.value !== target.value) {
          if (reversedIDs.includes(id_name)) {
            textbox_elem.value = String(-Number(target.value));
          } else {
            textbox_elem.value = target.value;
          }
        }
      });
      title_input_textbox.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const id_name = target.id.split('-')[0];
        if (reversedIDs.includes(id_name)) {
          if (Number(target.value) > min) {
            target.value = String(min);
          }
          if (Number(target.value) < max) {
            target.value = String(max);
          }
        } else {
          if (Number(target.value) < min) {
            target.value = String(min);
          }
          if (Number(target.value) > max) {
            target.value = String(max);
          }
        }
        const slider_elem = document.getElementById(id_name + '-slider') as HTMLInputElement | null;
        if (slider_elem && slider_elem.value !== target.value) {
          slider_elem.value = String(-Number(target.value));
        }

        stringPDF(id_name, 1 * Number(target.value), val, amp);
        stringCDF(id_name, 1 * Number(target.value), val, amp);
      });
    }
  }
}

function stringPDF(id: string, val: number, base: number, amp: number): void {
  let p: number;
  let min: number;
  let max: number;
  let minr: number;
  let maxr: number;
  let minround: number;
  let maxround: number;
  const floorval = reversedIDs.includes(id) ? -1 : 1;
  if ((base > 0) == !reversedIDs.includes(id)) {
    minr = 0.3 + 0.05 * amp;
    maxr = 1.3;
    if (reversedIDs.includes(id)) {
      min = Math.min(floorval, Math.round(minr * base));
      max = Math.min(floorval, Math.round(maxr * base));
      minround = min == max ? maxr : Math.min(maxr, (val - 0.5) / base);
      maxround = min == max ? minr : Math.max(minr, (val + 0.5) / base);
    } else {
      min = Math.max(floorval, Math.round(minr * base));
      max = Math.max(floorval, Math.round(maxr * base));
      minround = min == max ? minr : Math.max(minr, (val - 0.5) / base);
      maxround = min == max ? maxr : Math.min(maxr, (val + 0.5) / base);
    }
  } else {
    minr = 1.3;
    maxr = 0.7;
    if (reversedIDs.includes(id)) {
      min = Math.max(-floorval, Math.round(minr * base));
      max = Math.max(-floorval, Math.round(maxr * base));
      minround = min == max ? maxr : Math.max(maxr, (val - 0.5) / base);
      maxround = min == max ? minr : Math.min(minr, (val + 0.5) / base);
    } else {
      min = Math.min(-floorval, Math.round(minr * base));
      max = Math.min(-floorval, Math.round(maxr * base));
      minround = min == max ? minr : Math.min(minr, (val - 0.5) / base);
      maxround = min == max ? maxr : Math.max(maxr, (val + 0.5) / base);
    }
  }
  p = (Math.abs(maxround - minround) / Math.abs(maxr - minr)) * 100;

  const b1 = document.createElement('b');
  b1.textContent = 'Roll exactly ';
  const b2 = document.createElement('b');
  b2.textContent = val + idSuffixes[id];
  if ((val > 0) == !reversedIDs.includes(id)) {
    b2.classList.add('positive');
  }
  if ((val > 0) == reversedIDs.includes(id)) {
    b2.classList.add('negative');
  }
  const b3 = document.createElement('b');
  b3.textContent = ': ' + p.toFixed(3) + '%';
  const pdfEl = document.getElementById(id + '-pdf')!;
  pdfEl.innerHTML = '';
  pdfEl.appendChild(b1);
  pdfEl.appendChild(b2);
  pdfEl.appendChild(b3);
}

function stringCDF(id: string, val: number, base: number, amp: number): void {
  let p: number;
  let min: number;
  let max: number;
  let minr: number;
  let maxr: number;
  let minround: number;
  let maxround: number;
  const floorval = reversedIDs.includes(id) ? -1 : 1;
  if ((base > 0) == !reversedIDs.includes(id)) {
    minr = 0.3 + 0.05 * amp;
    maxr = 1.3;
    if (reversedIDs.includes(id)) {
      min = Math.min(floorval, Math.round(minr * base));
      max = Math.min(floorval, Math.round(maxr * base));
      minround = min == max ? maxr : Math.min(maxr, (val - 0.5) / base);
      maxround = min == max ? minr : Math.max(minr, (val + 0.5) / base);
    } else {
      min = Math.max(floorval, Math.round(minr * base));
      max = Math.max(floorval, Math.round(maxr * base));
      minround = min == max ? minr : Math.max(minr, (val - 0.5) / base);
      maxround = min == max ? maxr : Math.min(maxr, (val + 0.5) / base);
    }
  } else {
    minr = 1.3;
    maxr = 0.7;
    if (reversedIDs.includes(id)) {
      min = Math.max(-floorval, Math.round(minr * base));
      max = Math.max(-floorval, Math.round(maxr * base));
      minround = min == max ? maxr : Math.max(maxr, (val - 0.5) / base);
      maxround = min == max ? minr : Math.min(minr, (val + 0.5) / base);
    } else {
      min = Math.min(-floorval, Math.round(minr * base));
      max = Math.min(-floorval, Math.round(maxr * base));
      minround = min == max ? minr : Math.min(minr, (val - 0.5) / base);
      maxround = min == max ? maxr : Math.max(maxr, (val + 0.5) / base);
    }
  }
  if (reversedIDs.includes(id)) {
    p = (Math.abs(maxr - maxround) / Math.abs(maxr - minr)) * 100;
  } else {
    p = (Math.abs(maxr - minround) / Math.abs(maxr - minr)) * 100;
  }
  const b1 = document.createElement('b');
  b1.textContent = 'Roll ';
  const b2 = document.createElement('b');
  b2.textContent = val + idSuffixes[id];
  if ((val > 0) == !reversedIDs.includes(id)) {
    b2.classList.add('positive');
  }
  if ((val > 0) == reversedIDs.includes(id)) {
    b2.classList.add('negative');
  }
  const b3 = document.createElement('b');
  b3.textContent = ' or better: ' + p.toFixed(3) + '%';
  const cdfEl = document.getElementById(id + '-cdf')!;
  cdfEl.innerHTML = '';
  cdfEl.appendChild(b1);
  cdfEl.appendChild(b2);
  cdfEl.appendChild(b3);
}

;
