import type { Build } from './builder/build';
import { getAtreeCollectSpells } from './builder/atree';
import { tryGetBuildDispNode } from './builder/builder_graph';
import { getSpellCost } from './display';
import { make_elem } from './utils';
import type { BuildStatMap, ManaCycleEntry, SpellDefinition } from './types/stats';

const spellMap = () =>
  (getAtreeCollectSpells().value as Map<number, SpellDefinition>);

function getCycle(): number[] {
  const spellCycleEl = document.getElementById('spell-cycle') as HTMLInputElement;
  const spellCycleStr = spellCycleEl.value;
  const cycle: number[] = [];
  for (let i = 0; i < spellCycleStr.length; i++) {
    const spellIndex = parseInt(spellCycleStr.charAt(i));
    const spell = spellMap().get(spellIndex);
    if (spell) {
      cycle.push(spellIndex);
    }
  }
  return cycle;
}

export function manaInputChanged(_build: Build, stats: BuildStatMap): void {
  const cycle = getCycle();

  let hasDifferentSpells = false;
  for (let i = 0; i < cycle.length; i++) {
    for (let j = 0; j < cycle.length; j++) {
      if (cycle[i] !== cycle[j]) {
        hasDifferentSpells = true;
        break;
      }
    }
    if (hasDifferentSpells) break;
  }

  if (hasDifferentSpells) {
    calculateMana(cycle, _build, stats);
  } else {
    document.getElementById('mana-used')!.textContent = '-';
    document.getElementById('mana-gained')!.textContent = '-';
    document.getElementById('net-mana')!.textContent = '-';
    (document.getElementById('net-mana') as HTMLElement).style.color = '';
  }
}

export function calculateMana(cycle: number[], _build: Build, stats: BuildStatMap): void {
  const includeManaSteal = (document.getElementById('mana-steal-check') as HTMLInputElement).checked;
  let cps = parseFloat((document.getElementById('cps-count') as HTMLInputElement).value);
  if (Number.isNaN(cps)) {
    cps = 9;
  }
  const mr = (stats.get('mr') as number) ?? 0;
  const ms = (stats.get('ms') as number) ?? 0;
  const manaGained = 5 + mr / 5.0 + (includeManaSteal ? ms / 3 : 0);
  // I don't like this either, maybe find a different way to handle transcendence & paradox?
  let manaMult = 1;
  for (const [, v] of (stats.get('manaMult') as Map<string, number>).entries()) {
    manaMult *= 1 + v / 100;
  }

  const cycleEntries: ManaCycleEntry[] = [];
  for (let i = 0; i < cycle.length; i++) {
    const spell = spellMap().get(cycle[i]);
    if (!spell) {
      continue;
    }
    const spell_cost = getSpellCost(stats, spell, false) / manaMult;
    const mana_gain = spell.mana_gained ?? 0;
    cycleEntries.push([spell_cost, mana_gain, cycle[i]]);
  }

  while (cycleEntries[0][2] === cycleEntries[cycleEntries.length - 1][2]) {
    cycleEntries.unshift(cycleEntries.pop()!);
  }

  // jank way to detect generalist
  if (stats.get('activateGeneralist')) {
    const recentSpells = new Set<number>();
    let lastSeen: number | null = null;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < cycleEntries.length; i++) {
        const spellId = cycleEntries[i][2];
        if (spellId !== lastSeen) {
          recentSpells.add(spellId);
          lastSeen = spellId;
        }
        if (recentSpells.size >= 3) {
          // This cast is procc'd
          if (pass === 1) {
            cycleEntries[i][0] = 1;
          }
          recentSpells.clear();
          lastSeen = null;
        }
      }
    }
  }

  const cycle_cost: number[] = [];
  for (let i = 0; i < 2; i++) {
    const cost = Math.max(cycleEntries[i][0], 1) - cycleEntries[i][1];
    cycle_cost.push(cost < 0 ? cost : cost <= 1 ? 1 : cost);
  }

  // +5 per consecutive repeat
  let repeat = 0;
  for (let i = 2; i < cycleEntries.length; i++) {
    if (cycleEntries[i - 1][2] === cycleEntries[i - 2][2]) {
      repeat++;
      const penalized = Math.max(cycleEntries[i][0] + repeat * 5, 1) - cycleEntries[i][1];
      cycle_cost.push(penalized);
    } else {
      repeat = 0;
      const cost = Math.max(cycleEntries[i][0], 1) - cycleEntries[i][1];
      cycle_cost.push(cost);
    }
  }

  // Wrap-around penalty
  if (cycleEntries[cycleEntries.length - 1][2] === cycleEntries[cycleEntries.length - 2][2]) {
    repeat++;
    cycle_cost[0] += Math.max(repeat * 5 + Math.min(cycleEntries[0][0], 0), 0);
  }

  const manaUsed = (cps * cycle_cost.reduce((acc, val) => acc + val, 0)) / cycle_cost.length / 3;
  const netMana = manaGained - manaUsed;
  const bpactUsage = manaUsed - Math.max(manaGained, 0);
  document.getElementById('mana-used')!.textContent = manaUsed.toFixed(2);
  document.getElementById('mana-gained')!.textContent = manaGained.toFixed(2);
  const netEl = document.getElementById('net-mana') as HTMLElement;
  netEl.textContent = netMana.toFixed(2);
  netEl.style.color = netMana >= 0 ? '#4caf50' : '#f44336';
  const parent_div = netEl.parentElement!.parentElement!;

  for (const elem of parent_div.children) {
    if (elem.classList.contains('other-resource')) {
      elem.remove();
    }
  }

  if (bpactUsage > 0 && stats.get('bloodPactCost')) {
    const healthDrain = ((stats.get('bloodPactCost') as number) / 100) * bpactUsage;
    const bpactLabel = make_elem('span', ['other-resource'], { textContent: 'Blood Pact/s: ' });
    const bpactDrain = make_elem('span', ['Health'], { textContent: healthDrain.toFixed(2) + '%' });
    const bpactDuration = make_elem('span', [], { textContent: ' | ' + (100 / healthDrain).toFixed(2) + 's' });
    bpactLabel.appendChild(bpactDrain);
    bpactLabel.appendChild(bpactDuration);
    parent_div.appendChild(bpactLabel);
  }
}

function scheduleBuildDisplayUpdate(): void {
  const buildDispNode = tryGetBuildDispNode();
  if (buildDispNode) {
    buildDispNode.mark_dirty().update();
  }
}

/** Register builder-only mana cycle inputs. Call from wireBuilderGraph(). */
export function initManaCalcListeners(): void {
  const spellCycle = document.getElementById('spell-cycle');
  const cpsCount = document.getElementById('cps-count');
  const manaStealCheck = document.getElementById('mana-steal-check');
  if (!spellCycle || !cpsCount || !manaStealCheck) {
    return;
  }
  spellCycle.addEventListener('input', scheduleBuildDisplayUpdate);
  cpsCount.addEventListener('input', scheduleBuildDisplayUpdate);
  manaStealCheck.addEventListener('change', scheduleBuildDisplayUpdate);
}

;
