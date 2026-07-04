import { all_types, expandIngredient, expandRecipe } from '@/build_utils';
import {
  Craft,
  CRAFTER_ENC,
  decodeCraft,
  encodeCraft,
  levelTypes,
  recipeTypes,
} from '@/craft';
import { ingredient_loader, ingList, ingMap, recipeMap } from '@/load_ing';
import {
  displayExpandedIngredient,
  displayExpandedItem,
  displayRecipeStats,
  itemBGPositions,
} from '@/display';
import { apply_weapon_powders } from '@/powders';
import { newIcons } from '@/icons';
import { copyTextToClipboard, getValue, setValue, toggleButton } from '@/utils';
import type { ExpandedItem } from '@/types/item';

const ing_url_base = location.href.split('#')[0];
const ing_url_tag = location.hash.slice(1);

export const ING_BUILD_VERSION = '7.0.1';

export let player_craft: Craft | undefined;

const atkSpdButtons = ['slow-atk-button', 'normal-atk-button', 'fast-atk-button'];

export function init_crafter(): void {
  try {
    document.getElementById('recipe-choice')!.addEventListener('input', () => {
      updateMaterials();
      updateCraftedImage();
      calculateCraftSchedule();
    });
    document.getElementById('level-choice')!.addEventListener('input', () => {
      updateMaterials();
      calculateCraftSchedule();
    });
    const hash_input = document.getElementById('hash-input') as HTMLInputElement;
    hash_input.addEventListener('input', (ev) => handleHashInput(hash_input, ev));

    for (let i = 1; i < 7; ++i) {
      document.getElementById('ing-choice-' + i)!.addEventListener('input', () => calculateCraftSchedule());
    }

    wireCrafterEvents();
    populateFields();
    decodeCraftPopulateFields(ing_url_tag);
  } catch (error) {
    console.log(error);
  }
}

/** Wire static HTML controls on the crafter page (replaces inline onclick). */
function wireCrafterEvents(): void {
  for (const buttonId of atkSpdButtons) {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      toggleAtkSpd(buttonId);
      calculateCraftSchedule();
    });
  }

  for (let i = 1; i < 3; i++) {
    for (let j = 1; j < 4; j++) {
      const buttonId = `mat-${i}-${j}`;
      document.getElementById(buttonId)?.addEventListener('click', () => {
        toggleMaterial(buttonId);
        calculateCraftSchedule();
      });
    }
  }

  document.getElementById('reset-button')?.addEventListener('click', resetFields);
  document.getElementById('copy-hash-button')?.addEventListener('click', copyRecipeHash);
  document.getElementById('copy-button')?.addEventListener('click', copyRecipe);
  document.getElementById('share-button')?.addEventListener('click', shareRecipe);
}

export function handleHashInput(hash_input: HTMLInputElement, inputEvent: Event): void {
  const orig_hash = location.hash;
  hash_input.classList.remove('is-invalid');
  try {
    decodeCraftPopulateFields((inputEvent.target as HTMLInputElement).value);
  } catch {
    hash_input.classList.add('is-invalid');
    location.hash = orig_hash;
  }
}

export function updateMaterials(): void {
  const recipeName = getValue('recipe-choice') ? getValue('recipe-choice') : 'Potion';
  const levelRange = getValue('level-choice') ? getValue('level-choice') : '117-119';
  const recipe = expandRecipe(recipeMap.get(recipeName + '-' + levelRange)!);
  if (recipe !== undefined) {
    try {
      document.getElementById('mat-1')!.textContent =
        (recipe.get('materials') as ExpandedItem[])[0].get('item')!.toString().split(' ').slice(1).join(' ') + ' Tier:';
      document.getElementById('mat-2')!.textContent =
        (recipe.get('materials') as ExpandedItem[])[1].get('item')!.toString().split(' ').slice(1).join(' ') + ' Tier:';
    } catch (error) {
      // legacy: swallow
    }
  } else {
    document.getElementById('mat-1')!.textContent = 'Material 1 Tier:';
    document.getElementById('mat-2')!.textContent = 'Material 2 Tier:';
  }
}

export function toggleAtkSpd(buttonId: string): void {
  const elem = document.getElementById(buttonId)!;
  if (elem.classList.contains('toggleOn')) {
    elem.classList.remove('toggleOn');
  } else {
    for (const button of atkSpdButtons) {
      document.getElementById(button)!.classList.remove('toggleOn');
    }
    elem.classList.add('toggleOn');
  }
}

let doCraftTask: ReturnType<typeof setTimeout> | null = null;

export function calculateCraftSchedule(): void {
  console.log('Craft Schedule called');
  if (doCraftTask !== null) {
    clearTimeout(doCraftTask);
  }
  doCraftTask = setTimeout(function () {
    doCraftTask = null;
    calculateCraft();
    window.dispatchEvent(new Event('resize'));
  }, 250);
}

export function calculateCraft(): void {
  for (const i of document.getElementsByClassName('hide-container-block')) {
    (i as HTMLElement).style.display = 'block';
  }
  for (const i of document.getElementsByClassName('hide-container-grid')) {
    (i as HTMLElement).style.display = 'grid';
  }

  let recipeName = getValue('recipe-choice') === '' ? 'Potion' : getValue('recipe-choice');
  const levelrange = getValue('level-choice') === '' ? '117-119' : getValue('level-choice');
  const maxlevel = Number(levelrange.split('-')[1]);
  const recipe = expandRecipe(recipeMap.get(recipeName + '-' + levelrange)!);
  const mat_tiers: number[] = [];
  for (let i = 1; i < 3; i++) {
    for (let j = 1; j < 4; j++) {
      const elem = document.getElementById('mat-' + i + '-' + j)!;
      if (elem.classList.contains('toggleOn')) {
        mat_tiers.push(j);
        break;
      }
    }
    if (mat_tiers.length < i) {
      mat_tiers.push(3);
      document.getElementById('mat-' + i + '-3')!.classList.add('toggleOn');
    }
  }
  const ingreds: ExpandedItem[] = [];
  for (let i = 1; i < 7; i++) {
    getValue('ing-choice-' + i) === ''
      ? ingreds.push(expandIngredient(ingMap.get('No Ingredient')!))
      : ingreds.push(expandIngredient(ingMap.get(getValue('ing-choice-' + i))!));
  }
  let atkSpd: 'SLOW' | 'NORMAL' | 'FAST' = 'NORMAL';
  for (const b of atkSpdButtons) {
    const button = document.getElementById(b)!;
    if (button.classList.contains('toggleOn')) {
      atkSpd = b.split('-')[0].toUpperCase() as 'SLOW' | 'NORMAL' | 'FAST';
    }
  }

  player_craft = new Craft(recipe, mat_tiers, ingreds, atkSpd, '');

  const craft_str = encodeCraft(player_craft).toB64();
  location.hash = craft_str;
  setValue('hash-input', 'CR-' + craft_str);
  player_craft.setHash(craft_str);
  console.log(player_craft);

  document.getElementById('mat-1')!.textContent =
    (recipe.get('materials') as ExpandedItem[])[0].get('item')!.toString().split(' ').slice(1).join(' ') + ' Tier:';
  document.getElementById('mat-2')!.textContent =
    (recipe.get('materials') as ExpandedItem[])[1].get('item')!.toString().split(' ').slice(1).join(' ') + ' Tier:';

  displayRecipeStats(player_craft, 'recipe-stats');

  const mock_item = player_craft.statMap;
  if (mock_item.get('category') === 'weapon') {
    apply_weapon_powders(mock_item);
  }
  displayExpandedItem(mock_item, 'craft-stats');

  for (let i = 1; i < 7; i++) {
    displayExpandedIngredient(player_craft.ingreds[i - 1], 'ing-' + i + '-stats');
  }

  const warning_elem = document.getElementById('craft-warnings')!;
  warning_elem.textContent = '';
  warning_elem.classList.add('warning');
  const type = player_craft.recipe.get('skill') as string;
  for (const ingred of player_craft.ingreds) {
    if (!(ingred.get('skills') as string[]).includes(type)) {
      const p = document.createElement('p');
      p.textContent =
        'WARNING: ' +
        ingred.get('name') +
        ' cannot be used for ' +
        type.charAt(0) +
        type.substring(1).toLowerCase() +
        '!';
      warning_elem.appendChild(p);
    }
    if ((ingred.get('lvl') as number) > maxlevel) {
      const p = document.createElement('p');
      p.textContent =
        'WARNING: ' + ingred.get('name') + ' is too high level for level range ' + levelrange + '!';
      warning_elem.appendChild(p);
    }
  }
  const missing_durability = player_craft.statMap.get('missingDurability');
  const missing_duration = player_craft.statMap.get('missingDuration');

  if (player_craft.statMap.get('category') === 'consumable') {
    if (missing_duration) {
      const p = document.createElement('p');
      p.textContent = 'WARNING: Recipe requires ' + -Number(missing_duration) + ' more duration to work!';
      warning_elem.appendChild(p);
    }
  } else if (missing_durability) {
    const p = document.createElement('p');
    p.textContent = 'WARNING: Recipe requires ' + -Number(missing_durability) + ' more durability to work!';
    warning_elem.appendChild(p);
  }
}

export function decodeCraftPopulateFields(urlTag: string): void {
  if (urlTag) {
    if (urlTag.startsWith('CR-')) {
      urlTag = urlTag.substring(3);
      location.hash = urlTag;
    }
    const craft = decodeCraft({ hash: urlTag })!;

    for (let i = 0; i < 6; i++) {
      const ing = craft.ingreds[i];
      if (ing.get('id') !== 4000) {
        setValue('ing-choice-' + (i + 1), craft.ingreds[i].get('name'));
      }
    }

    const recipe = craft.recipe.get('name') as string;
    const seperator_idx = recipe.search('-');
    const recipe_name = recipe.substring(0, seperator_idx);
    const recipe_level = recipe.substring(seperator_idx + 1);

    setValue('recipe-choice', recipe_name);
    updateCraftedImage();
    setValue('level-choice', recipe_level);

    for (let i = 0; i < CRAFTER_ENC.NUM_MATS; ++i) {
      const matId = `mat-${i + 1}-${craft.mat_tiers[i]}`;
      const matButton = document.getElementById(matId)!;
      if (!matButton.classList.contains('toggleOn')) {
        toggleMaterial(`mat-${i + 1}-${craft.mat_tiers[i]}`);
      }
    }

    const atkSpdId = CRAFTER_ENC.CRAFTED_ATK_SPD[craft.atkSpd] as number;
    const button = document.getElementById(atkSpdButtons[atkSpdId])!;
    if (!button.classList.contains('toggleOn')) {
      toggleAtkSpd(atkSpdButtons[atkSpdId]);
    }

    calculateCraft();
  }
}

export function populateFields(): void {
  const recipe_list = document.getElementById('recipe-choices')!;
  for (const recipe of recipeTypes) {
    const el = document.createElement('option');
    el.value = recipe.charAt(0) + recipe.substring(1).toLowerCase();
    recipe_list.appendChild(el);
  }
  const level_list = document.getElementById('level-choices')!;
  for (const range of levelTypes) {
    const el = document.createElement('option');
    el.value = range;
    level_list.appendChild(el);
  }
  for (let i = 1; i < 7; i++) {
    const ing_list = document.getElementById('ing-choices-' + i)!;
    for (const ing of ingList) {
      const el = document.createElement('option');
      el.value = ing;
      ing_list.appendChild(el);
    }
  }
}

export function copyRecipeHash(): void {
  if (player_craft) {
    copyTextToClipboard('CR-' + location.hash.slice(1));
    document.getElementById('copy-hash-button')!.textContent = 'Copied!';
  }
}

export function copyRecipe(): void {
  if (player_craft) {
    copyTextToClipboard(ing_url_base + location.hash);
    document.getElementById('copy-button')!.textContent = 'Copied!';
  }
}

export function shareRecipe(): void {
  if (player_craft) {
    let copyString = ing_url_base + location.hash + '\n';
    const name = player_craft.recipe.get('name')!.toString().split('-');
    copyString +=
      ' > ' +
      name[0] +
      ' ' +
      'Lv. ' +
      name[1] +
      '-' +
      name[2] +
      ' (' +
      player_craft.mat_tiers[0] +
      '\u272B, ' +
      player_craft.mat_tiers[1] +
      '\u272B)\n';
    const names = [
      player_craft.ingreds[0].get('displayName'),
      player_craft.ingreds[1].get('displayName'),
      player_craft.ingreds[2].get('displayName'),
      player_craft.ingreds[3].get('displayName'),
      player_craft.ingreds[4].get('displayName'),
      player_craft.ingreds[5].get('displayName'),
    ];
    const buffer1 = Math.max(names[0]!.toString().length, names[2]!.toString().length, names[4]!.toString().length);
    const buffer2 = Math.max(names[1]!.toString().length, names[3]!.toString().length, names[5]!.toString().length);
    for (const i in names) {
      const nameStr = names[i]!.toString();
      let spaces: number;
      if (Number(i) % 2 == 0) {
        spaces = buffer1 - nameStr.length;
      } else {
        spaces = buffer2 - nameStr.length;
      }
      for (let j = 0; j < spaces; j++) {
        if (j % 2 == 0) {
          names[i] += '  ';
        } else {
          names[i] = '  ' + names[i];
        }
      }
    }
    copyString += ' > [' + names[0] + ' | ' + names[1] + '\n';
    copyString += ' >  ' + names[2] + ' | ' + names[3] + '\n';
    copyString += ' >  ' + names[4] + ' | ' + names[5] + ']';
    copyTextToClipboard(copyString);
    document.getElementById('share-button')!.textContent = 'Copied!';
  }
}

export function toggleMaterial(buttonId: string): void {
  const elem = document.getElementById(buttonId)!;
  const mat = buttonId.split('-')[1];
  if (!elem.classList.contains('toggleOn')) {
    toggleButton(buttonId);
    for (let i = 1; i < 4; i++) {
      if ('mat-' + mat + '-' + i !== buttonId) {
        document.getElementById('mat-' + mat + '-' + i)!.classList.remove('toggleOn');
      }
    }
  } else {
    toggleButton(buttonId);
  }
}

export function updateCraftedImage(): void {
  const input = document.getElementById('recipe-choice') as HTMLInputElement;
  if (all_types.includes(input.value)) {
    const img = document.getElementById('recipe-img') as HTMLElement;
    if (['potion', 'scroll', 'food'].includes(input.value.toLowerCase())) {
      img.style.backgroundImage = "url('../media/items/common.png')";
      img.style.backgroundSize = '500% 100%';
    } else {
      img.style.backgroundImage = "url('../media/items/" + (newIcons ? 'new' : 'old') + ".png')";
      img.style.backgroundSize = '1200% 100%';
    }
    img.style.backgroundPosition = itemBGPositions[input.value.toLowerCase()];
  }
}

export function resetFields(): void {
  for (let i = 1; i < 3; i++) {
    for (let j = 1; j < 4; j++) {
      document.getElementById('mat-' + i + '-' + j)!.classList.remove('toggleOn');
    }
  }
  for (let i = 1; i < 7; i++) {
    setValue('ing-choice-' + i, '');
  }
  setValue('recipe-choice', '');
  setValue('level-choice', '');
  location.hash = '';
  calculateCraft();
}

let crafterPageInitialized = false;

export async function initCrafterPage(): Promise<void> {
  if (crafterPageInitialized) return;
  crafterPageInitialized = true;
  await ingredient_loader.load_init();
  init_crafter();
}
