/**
 * File containing compute graph structure of the builder page.
 */

import {
  Item,
  merge_stat,
  expandRecipe,
  type_to_skill,
  wep_to_class,
  skill,
  skillpoint_final_mult,
  skp_elements,
  skp_order,
  levelToSkillPoints,
  skillPointsToPercentage,
  reversedIDs,
} from '@/build_utils';
import {
  ComputeNode,
  InputNode,
  ValueCheckComputeNode,
  calcSchedule,
  setGraphLiveUpdate,
  getComputeInput,
  type ComputeInputMap,
} from '@/computation_graph';
import { Craft, decodeCraft, encodeCraft } from '@/craft';
import { decodeCustom } from '@/custom';
import { calculateSpellDamage, get_base_dps } from '@/damage_calc';
import {
  build_detailed_display_commands,
  build_overall_display_commands,
  idPrefixes,
  idSuffixes,
} from '@/display_constants';
import { itemBGPositions } from '@/display';
import { itemMap, none_items, getActiveSetBonus } from '@/load_item';
import { recipeMap } from '@/load_ing';
import { tomeMap, none_tomes } from '@/load_tome';
import { manaInputChanged, initManaCalcListeners } from '@/mana_calc';
import {
  applyArmorPowders,
  apply_weapon_powders,
  powderIDs,
  powderLevelReq,
  powderSpecialStats,
  POWDER_TIERS,
} from '@/powders';
import { createRegistered } from '@/lib/registeredNode';
import {
  AspectAggregateNode,
  AspectAutocompleteInitNode,
  AspectInputDisplayNode,
  AspectInputNode,
  AspectRenderNode,
  AspectTierInputNode,
  TooltipGeneratorNode,
  aspect_agg_node,
  aspect_inputs,
  setAspectAggNode,
} from './aspects';
import { Build, classDefenseMultipliers } from './build';
import {
  AbilityTreeEnsureNodesNode,
  getAtreeCollectSpells,
  getAtreeMerge,
  getAtreeNode,
  getAtreeRawStats,
  getAtreeScaling,
  getAtreeScalingStats,
  getAtreeStateNode,
  getAtreeValidate,
  atree_set_state,
  registerAtreeGraph,
} from './atree';
import {
  atree_data,
  build_powders,
  decodeAtree,
  encodeBuild,
  player_build,
  setBuildPowders,
} from './build_encode_decode';
import {
  aspect_fields,
  build_fields,
  editable_item_fields,
  equipment_fields,
  equipment_inputs,
  powder_inputs,
  raid_buff_map,
  tome_fields,
} from './builder_constants';
import {
  displayBuildStats,
  displayExpandedItem,
  displayPoisonDamage,
  displayPowderSpecials,
  displaySetBonuses,
  displaySpellDamage,
} from '@/display';
import {
  capitalizeFirst,
  collapse_element,
  make_elem,
  rawToPct,
  rawToPctUncapped,
  setText,
  setValue,
  zip2,
  zip3,
} from '@/utils';
import type { ATree, RenderedATree } from '@/types/atree';
import type { SkillpointVector, SpellDefinition, BuildStatMap, ComputedSpellPart } from '@/types/stats';

const preScaleAggNodeRef = createRegistered<ComputeNode>('pre_scale_agg_node');
export function getPreScaleAggNode(): ComputeNode { return preScaleAggNodeRef.get(); }
export function tryGetPreScaleAggNode(): ComputeNode | undefined { return preScaleAggNodeRef.tryGet(); }

const armorPowderNodeRef = createRegistered<ComputeNode>('armor_powder_node');
export function getArmorPowderNode(): ComputeNode { return armorPowderNodeRef.get(); }
export function tryGetArmorPowderNode(): ComputeNode | undefined { return armorPowderNodeRef.tryGet(); }

export const damageMultipliers = new Map([["totem", 0.2], ["warscream", 0.0], ["emboldeningcry", 0.0], ["fortitude", 0.40], ["hauntingfanatic", 0.0], ["hauntinglunatic", 0.0]]);

const boostsNodeRef = createRegistered<ComputeNode>('boosts_node');
export function getBoostsNode(): ComputeNode { return boostsNodeRef.get(); }
export function tryGetBoostsNode(): ComputeNode | undefined { return boostsNodeRef.tryGet(); }

let raid_buff_node: ComputeNode;

export function updateRaidBuffs(raid: string, tier: number, buttonId: string) {
    let prefix = (buttonId).split("-")[0].replace(' ', '_') + '-';
    let elem = document.getElementById(buttonId);
    if (elem.classList.contains("toggleOn")) { elem.classList.remove("toggleOn"); }
    else {
        const raids = ['notg', 'nol', 'tcc', 'tna', 'wtp'];
        let raid_tier = document.getElementById(raid + "-" + tier);
        for (let buff of raid_tier.children) {
            if (buff.classList.contains("toggleOn")) { buff.classList.remove("toggleOn"); }
        }

        // shut off the buffs from other raids
        for (const other_raid of raids) {
            if (other_raid == raid) {
                continue;
            }
            
            for (let i = 1; i <= 3; i++) {
                let other_tier = document.getElementById(other_raid + "-" + i);
                for (let buff of other_tier.children) {
                    if (buff.classList.contains("toggleOn")) { buff.classList.remove("toggleOn"); }
                }
            }
        }
        elem.classList.add("toggleOn");
    }
    raid_buff_node.mark_dirty().update();
}

/* Updates all spell boosts
*/
export function update_boosts(buttonId: string) {
    let elem = document.getElementById(buttonId);
    if (elem.classList.contains("toggleOn")) {
        elem.classList.remove("toggleOn");
    } else {
        elem.classList.add("toggleOn");
    }
    getBoostsNode().mark_dirty().update();
}

export let specialNames = ["Quake", "Chain Lightning", "Curse", "Courage", "Wind Prison"];

const powderSpecialInputRef = createRegistered<ComputeNode>('powder_special_input');
export function getPowderSpecialInput(): ComputeNode { return powderSpecialInputRef.get(); }
export function tryGetPowderSpecialInput(): ComputeNode | undefined { return powderSpecialInputRef.tryGet(); }

export function updatePowderSpecials(buttonId: string) {
    let prefix = (buttonId).split("-")[0].replace(' ', '_') + '-';
    let elem = document.getElementById(buttonId);
    if (elem.classList.contains("toggleOn")) { elem.classList.remove("toggleOn"); }
    else {
        for (let i = 1; i < 8; i++) { //toggle all pressed buttons of the same powder special off
            //name is same, power is i
            const elem2 = document.getElementById(prefix + i);
            if (elem2.classList.contains("toggleOn")) { elem2.classList.remove("toggleOn"); }
        }
        //toggle the pressed button on
        elem.classList.add("toggleOn");
    }
    getPowderSpecialInput().mark_dirty().update();
}

class PowderSpecialCalcNode extends ComputeNode {
    constructor() { super('builder-powder-special-apply'); }

    compute_func(input_map) {
        const powder_specials = input_map.get('powder-specials');
        let stats = new Map();
        for (const [special, power] of powder_specials) {
            if (special["weaponSpecialEffects"].has("Damage Boost")) {
                let name = special["weaponSpecialName"];
                if (name === "Courage" || name === "Curse" || name == "Wind Prison") { // Master mod all the way
                    stats.set("damMult." + name, special.weaponSpecialEffects.get("Damage Boost")[power - 1]);
                    // legacy
                    stats.set("poisonPct", special.weaponSpecialEffects.get("Damage Boost")[power - 1]);
                }
            }
        }
        return stats;
    }
}

class PowderSpecialDisplayNode extends ComputeNode {
    // TODO: Refactor this entirely to be adding more spells to the spell list
    constructor() {
        super('builder-powder-special-display');
        this.fail_cb = true;
    }

    compute_func(input_map: ComputeInputMap): null {
        const powder_specials = getComputeInput<[typeof powderSpecialStats[number], number][]>(input_map, 'powder-specials');
        const stats = getComputeInput<BuildStatMap>(input_map, 'stats');
        const weapon = getComputeInput<Build>(input_map, 'build').weapon.statMap;
        displayPowderSpecials(document.getElementById("powder-special-stats"), powder_specials, stats, weapon);
        return null;
    }
}

/**
 * Node for getting an item's stats from an item input field.
 *
 * Signature: ItemInputNode() => Item | null
 */
class ItemInputNode extends InputNode {
    none_item: Item;
    category: string | undefined;

    /**
     * Make an item stat pulling compute node.
     *
     * @param name: Name of this node.
     * @param item_input_field: Input field (html element) to listen for item names from.
     * @param none_item: Item object to use as the "none" for this field.
     */
    constructor(name, item_input_field, none_item) {
        super(name, item_input_field);
        this.none_item = new Item(none_item);
        this.category = this.none_item.statMap.get('category') as string | undefined;
        if (this.category == 'armor' || this.category == 'weapon') {
            this.none_item.statMap.set('powders', []);
            apply_weapon_powders(this.none_item.statMap); // Needed to put in damagecalc zeros
        }
        this.none_item.statMap.set('NONE', true);
    }

    compute_func(input_map) {
        // built on the assumption of no one will type in CI/CR letter by letter
        let item_text = this.input_field.value;
        if (!item_text) {
            return this.none_item;
        }

        let item;
        if (item_text.slice(0, 3) == "CI-") { item = decodeCustom({ hash: item_text.substring(3) }); }
        else if (item_text.slice(0, 3) == "CR-") { item = decodeCraft({ hash: item_text.substring(3) }); }
        else if (itemMap.has(item_text)) { item = new Item(itemMap.get(item_text)); }
        else if (tomeMap.has(item_text)) { item = new Item(tomeMap.get(item_text)); }

        if (item) {
            let type_match;
            if (this.category == 'weapon') {
                type_match = item.statMap.get('category') == 'weapon';
            } else if (item.statMap.get("crafted")) {
                const fieldType = this.none_item.statMap.get('type') as string;
                const fieldSkill = type_to_skill(fieldType);
                const itemSkillMatchesField = item.recipe.get('skill') === fieldSkill;

                type_match = item.statMap.get('type') === fieldType;

                // Different type but same crafting skill group, re-encode the item to the correct type
                if (!type_match && itemSkillMatchesField) {
                    const originalRecipeName = item.recipe.get("name");
                    const levelRange = originalRecipeName.substring(originalRecipeName.indexOf("-") + 1);
                    const recipeName = `${capitalizeFirst(fieldType)}-${levelRange}`;
                    const newRecipe = expandRecipe(recipeMap.get(recipeName));
                    // TODO(@orgold): the way crafted items handle hash setting is kinda silly? why not just automatically apply based on calc?
                    item = new Craft(newRecipe, item.mat_tiers, item.ingreds, item.atkSpd, "");
                    item.setHash(encodeCraft(item).toB64());
                    this.input_field.value = item.hash;
                    type_match = true;
                }
            } else {
                type_match = item.statMap.get('type') == this.none_item.statMap.get('type');
            }

            if (type_match) {
                return item;
            }
        }
        else if (this.none_item.statMap.get('category') === 'weapon' && item_text.startsWith("Morph-")) {
            let replace_items = ["Morph-Stardust",
                "Morph-Steel",
                "Morph-Iron",
                "Morph-Gold",
                "Morph-Topaz",
                "Morph-Emerald",
                "Morph-Amethyst",
                "Morph-Ruby",
                item_text.substring(6)
            ]

            for (const [i, x] of zip2(equipment_inputs, replace_items)) { setValue(i, x); }

            for (const node of equip_inputs) {
                if (node !== this) {
                    // save a tiny bit of compute
                    calcSchedule(node, 10);
                }
            }
            // Needed to push the weapon node's updates forward
            return this.compute_func(input_map);
        }
        return null;
    }
}

/**
 * Node for updating item input fields from parsed items.
 *
 * Signature: ItemInputDisplayNode(item: Item, powdering: List[powder]) => Item
 */
class ItemPowderingNode extends ComputeNode {
    constructor(name) { super(name); }

    compute_func(input_map) {
        const powdering = input_map.get('powdering');
        const input_item = input_map.get('item');
        const item = input_item.copy(); // TODO: performance

        const max_slots = item.statMap.get('slots');
        item.statMap.set('powders', powdering.slice(0, max_slots));
        if (item.statMap.get('category') == 'armor') {
            applyArmorPowders(item.statMap);
        }
        else if (item.statMap.get('category') == 'weapon') {
            apply_weapon_powders(item.statMap);
        }
        return item;
    }
}

/**
 * Node for updating item input fields from parsed items.
 *
 * Signature: ItemInputDisplayNode(item: Item) => null
 */
class ItemInputDisplayNode extends ComputeNode {
    input_field: HTMLElement;
    health_field: HTMLElement | null;
    level_field: HTMLElement | null;
    image: HTMLElement;

    constructor(name, eq, item_image) {
        super(name);
        this.input_field = document.getElementById(eq + "-choice");
        this.health_field = document.getElementById(eq + "-health");
        this.level_field = document.getElementById(eq + "-lv");
        this.image = item_image;
        this.fail_cb = true;
    }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "ItemInputDisplayNode accepts exactly one input (item)"; }
        const [item] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element

        this.input_field.classList.remove("text-light", "is-invalid", 'Normal', 'Unique', 'Rare', 'Legendary', 'Fabled', 'Mythic', 'Set', 'Crafted', 'Custom');
        this.input_field.classList.add("text-light");
        this.image.classList.remove('Normal-shadow', 'Unique-shadow', 'Rare-shadow', 'Legendary-shadow', 'Fabled-shadow', 'Mythic-shadow', 'Set-shadow', 'Crafted-shadow', 'Custom-shadow');

        if (this.health_field) {
            // Doesn't exist for weapons.
            this.health_field.textContent = "0";
        }
        if (this.level_field) {
            // Doesn't exist for tomes.
            this.level_field.textContent = "0";
        }
        if (!item) {
            this.input_field.classList.add("is-invalid");
            return null;
        }

        if (item.statMap.has('NONE')) {
            return null;
        }

        const tier = item.statMap.get('tier');
        this.input_field.classList.add(tier);
        if (this.health_field) {
            // Doesn't exist for weapons.
            this.health_field.textContent = item.statMap.get('hp');
        }
        if (this.level_field) {
            // Doesn't exist for tomes.
            this.level_field.textContent = item.statMap.get('lvl');
        }
        this.image.classList.add(tier + "-shadow");
        return null;
    }
}

/**
 * Node for rendering an item.
 *
 * Signature: ItemDisplayNode(item: Item) => null
 */
class ItemDisplayNode extends ComputeNode {
    target_elem: string;

    constructor(name, target_elem) {
        super(name);
        this.target_elem = target_elem;
    }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "ItemInputDisplayNode accepts exactly one input (item)"; }
        const [item] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element

        displayExpandedItem(item.statMap, this.target_elem);
        collapse_element("#" + this.target_elem);
    }
}

/**
 * Change the weapon to match correct type.
 *
 * Signature: WeaponInputDisplayNode(item: Item) => null
 */
class WeaponInputDisplayNode extends ComputeNode {
    image: HTMLElement;
    dps_field: HTMLElement;

    constructor(name, image_field, dps_field) {
        super(name);
        this.image = image_field;
        this.dps_field = dps_field;
    }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "WeaponDisplayNode accepts exactly one input (item)"; }
        const [item] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element

        const type = item.statMap.get('type');
        this.image.style.backgroundPosition = itemBGPositions[type];

        const dpsResult = get_base_dps(item.statMap);
        let dps: number;
        if (typeof dpsResult === 'number') {
            dps = dpsResult;
        } else {
            dps = dpsResult[1];
        }
        if (isNaN(dps)) {
            dps = 0;
        }
        this.dps_field.textContent = String(Math.round(dps));
    }
}

/**
 * Encode the build into a url-able string.
 *
 * Signature: BuildEncodeNode(build: Build,
 *                            helmet-powder: List[powder],
 *                            chestplate-powder: List[powder],
 *                            leggings-powder: List[powder],
 *                            boots-powder: List[powder],
 *                            weapon-powder: List[powder]) => str
 */
class BuildEncodeNode extends ComputeNode {
    constructor() { super("builder-encode"); }

    compute_func(input_map) {
        const build = input_map.get('build');
        const atree = input_map.get('atree');
        const atree_state = input_map.get('atree-state');
        const aspects = input_map.get('aspects');
        let powders = [
            input_map.get('helmet-powder'),
            input_map.get('chestplate-powder'),
            input_map.get('leggings-powder'),
            input_map.get('boots-powder'),
            input_map.get('weapon-powder')
        ];
        const skillpoints: SkillpointVector = [
            input_map.get('str'),
            input_map.get('dex'),
            input_map.get('int'),
            input_map.get('def'),
            input_map.get('agi')
        ] as SkillpointVector;
        setBuildPowders(powders);
        return encodeBuild(build, powders, skillpoints, atree, atree_state, aspects);
    }
}

/**
 * Update the window's URL.
 *
 * Signature: URLUpdateNode(build_str: str) => null
 */
class URLUpdateNode extends ComputeNode {
    constructor() { super("builder-url-update"); }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "URLUpdateNode accepts exactly one input (build_str)"; }
        const [build_str] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element
        // Using `history.pushState` instead of `location.replace` prevents the browser from refreshing the page upon URL change.
        window.history.pushState(null, "", location.origin + location.pathname + '#' + build_str.toB64());
    }
}

/**
 * Create a "build" object from a set of equipments.
 * Returns a new Build object, or null if all items are NONE items.
 *
 * Signature: BuildAssembleNode(helmet: Item,
 *                              chestplate: Item,
 *                              leggings: Item,
 *                              boots: Item,
 *                              ring1: Item,
 *                              ring2: Item,
 *                              bracelet: Item,
 *                              necklace: Item,
 *                              weapon: Item,
 *                              level: int) => Build | null
 */
class BuildAssembleNode extends ComputeNode<Build | null> {
    constructor() { super("builder-make-build"); }

    compute_func(input_map: ComputeInputMap): Build | null {
        let equipments = [
            getComputeInput<Item>(input_map, 'helmet'),
            getComputeInput<Item>(input_map, 'chestplate'),
            getComputeInput<Item>(input_map, 'leggings'),
            getComputeInput<Item>(input_map, 'boots'),
            getComputeInput<Item>(input_map, 'ring1'),
            getComputeInput<Item>(input_map, 'ring2'),
            getComputeInput<Item>(input_map, 'bracelet'),
            getComputeInput<Item>(input_map, 'necklace'),
        ];

        let tomes = [
            getComputeInput<Item>(input_map, 'weaponTome1'),
            getComputeInput<Item>(input_map, 'weaponTome2'),
            getComputeInput<Item>(input_map, 'armorTome1'),
            getComputeInput<Item>(input_map, 'armorTome2'),
            getComputeInput<Item>(input_map, 'armorTome3'),
            getComputeInput<Item>(input_map, 'armorTome4'),
            getComputeInput<Item>(input_map, 'guildTome1'),
            getComputeInput<Item>(input_map, 'lootrunTome1'),
            getComputeInput<Item>(input_map, 'gatherXpTome1'),
            getComputeInput<Item>(input_map, 'gatherXpTome2'),
            getComputeInput<Item>(input_map, 'dungeonXpTome1'),
            getComputeInput<Item>(input_map, 'dungeonXpTome2'),
            getComputeInput<Item>(input_map, 'mobXpTome1'),
            getComputeInput<Item>(input_map, 'mobXpTome2'),

        ];
        // I hate wynncraft but I'm lazy
        const wynn_equip = [
            getComputeInput<Item>(input_map, 'boots'),
            getComputeInput<Item>(input_map, 'leggings'),
            getComputeInput<Item>(input_map, 'chestplate'),
            getComputeInput<Item>(input_map, 'helmet'),
            getComputeInput<Item>(input_map, 'ring1'),
            getComputeInput<Item>(input_map, 'ring2'),
            getComputeInput<Item>(input_map, 'bracelet'),
            getComputeInput<Item>(input_map, 'necklace'),
            getComputeInput<Item>(input_map, 'guildTome1')
        ];

        let weapon = getComputeInput<Item>(input_map, 'weapon');

        let level = parseInt(String(getComputeInput<unknown>(input_map, 'level-input')));
        if (isNaN(level)) {
            level = 121;
        }

        const all_none = equipments.concat([...tomes, weapon]).every(x => x.statMap.has('NONE'));
        if (all_none && !location.hash) {
            return null;
        }
        return new Build(level, equipments, tomes, weapon, wynn_equip);
    }
}

class PlayerClassNode extends ValueCheckComputeNode {
    constructor(name) { super(name); }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "PlayerClassNode accepts exactly one input (build)"; }
        const [build] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element
        if (build.weapon.statMap.has('NONE')) { return null; }
        return wep_to_class.get(build.weapon.statMap.get('type'));
    }
}

/**
 * Read an input field and parse into a list of powderings.
 * Every two characters makes one powder. If parsing fails, NULL is returned.
 *
 * Signature: PowderInputNode(item: Item) => List[powder] | null
 */
class PowderInputNode extends InputNode {

    constructor(name, input_field) { super(name, input_field); this.fail_cb = true; }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "PowderInputNode accepts exactly one input (item)"; }
        const [item] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element
        if (item === null) {
            this.input_field.placeholder = 'powders';
            return [];
        }

        if (item.statMap.has('slots')) {
            this.input_field.placeholder = item.statMap.get('slots') + ' slots';
        }

        // TODO: haha improve efficiency to O(n) dumb
        let input = this.input_field.value.trim();
        let powdering = [];
        let errorederrors = [];
        while (input) {
            let first = input.slice(0, 2).toLowerCase();
            let powder = powderIDs.get(first);
            if (powder === undefined) {
                if (first.length > 0) {
                    errorederrors.push(first);
                } else {
                    break;
                }
            } else {
                powdering.push(powder);
            }
            input = input.slice(2);
        }

        if (this.input_field.getAttribute("placeholder") != null) {
            if (item.statMap.get('slots') < powdering.length) {
                errorederrors.push("Too many powders: " + powdering.length);
            }
        }

        if (errorederrors.length) {
            this.input_field.classList.add("is-invalid");
        } else {
            this.input_field.classList.remove("is-invalid");
        }

        return powdering;
    }
}

/*
 * Get all defensive stats for this build.
 */
export { getDefenseStats } from './defense_stats';

/**
 * Display spell damage from spell parts.
 * Currently kinda janky / TODO while we rework the internal rep. of spells.
 *
 * Signature: SpellDisplayNode(stats: StatMap,
 *                             spell-info: [Spell, SpellParts],
 *                             spell-damage: List[SpellDamage]) => null
 */
export class SpellDisplayNode extends ComputeNode {
    spell: SpellDefinition;

    constructor(spell) {
        super("builder-spell" + spell.base_spell + "-display");
        this.spell = spell;
    }

    compute_func(input_map: ComputeInputMap): null {
        const stats = getComputeInput<BuildStatMap>(input_map, 'stats');
        const damages = getComputeInput<ComputedSpellPart[]>(input_map, 'spell-damage');
        const spell = this.spell;

        const i = this.spell.base_spell;
        let parent_elem = document.getElementById("spell" + i + "-info");
        let overallparent_elem = document.getElementById("spell" + i + "-infoAvg");
        displaySpellDamage(parent_elem, overallparent_elem, stats, spell, i, damages);
        return null;
    }
}

/**
 * Display build stats.
 *
 * Signature: BuildDisplayNode(build: Build) => null
 */
class BuildDisplayNode extends ComputeNode<null> {
    constructor() { super("builder-stats-display"); }

    compute_func(input_map: ComputeInputMap): null {
        const build = getComputeInput<Build>(input_map, 'build');
        const stats = getComputeInput<BuildStatMap>(input_map, 'stats');
        displayBuildStats('summary-stats', build, build_overall_display_commands, stats);
        displayBuildStats("detailed-stats", build, build_detailed_display_commands, stats);
        displaySetBonuses("set-info", build);
        // TODO: move weapon out?
        // displayDefenseStats(document.getElementById("defensive-stats"), stats);

        displayPoisonDamage(document.getElementById("build-poison-stats"), stats);
        manaInputChanged(build, stats);
        return null;
    }
}

/**
 * Show warnings for skillpoints, level, set bonus for a build
 * Also shosw skill point remaining and other misc. info
 *
 * Signature: DisplayBuildWarningNode(build: Build, str: int, dex: int, int: int, def: int, agi: int) => null
 */
class DisplayBuildWarningsNode extends ComputeNode {
    constructor() { super("builder-show-warnings"); }

    compute_func(input_map) {
        const build = input_map.get('build');
        const min_assigned = build.base_skillpoints;
        const base_totals = build.total_skillpoints;
        const skillpoints = [
            input_map.get('str'),
            input_map.get('dex'),
            input_map.get('int'),
            input_map.get('def'),
            input_map.get('agi')
        ];
        const tome_skp = build.tomes[6].statMap.get("skillpoints") || [0, 0, 0, 0, 0];
        let skp_effects = ["% damage", "% crit", "% cost red.", "% resist", "% dodge"];
        let total_assigned = 0;
        const assigned_per_type = [];
        const levelCap = levelToSkillPoints(build.level);
        const noGuildTome = build.tomes[6].statMap.has('NONE');

        for (let i in skp_order) { //big bren
            const assigned = skillpoints[i] - base_totals[i] + min_assigned[i]
            setText(skp_order[i] + "-skp-base", "Original: " + base_totals[i]);
            const tome_bonus = tome_skp[i];
            setText(skp_order[i] + "-skp-assign", "Assign: " + assigned + (tome_bonus ? " (+" + tome_bonus + ")" : ""));
            setValue(skp_order[i] + "-skp", skillpoints[i]);
            let linebreak = document.createElement("br");
            linebreak.classList.add("itemp");
            setText(skp_order[i] + "-skp-pct", (skillPointsToPercentage(skillpoints[i]) * 100 * skillpoint_final_mult[i]).toFixed(1).concat(skp_effects[i]));
            assigned_per_type.push(assigned);
            total_assigned += assigned;
        }

        // Pre-compute which guild tome(s), if any, save the build
        const SP_SHORT = ["Str", "Dex", "Int", "Def", "Agi"];
        const over_indices = [];
        for (let i = 0; i < 5; i++) if (assigned_per_type[i] > 100) over_indices.push(i);
        const deficit = total_assigned - levelCap;
        const working_focused = [];
        if (noGuildTome && deficit <= 4 && (deficit > 0 || over_indices.length > 0)) {
            for (let i = 0; i < 5; i++) {
                const others_ok = assigned_per_type.every((v, j) => j === i || v <= 100);
                const absorbs_deficit = Math.min(4, assigned_per_type[i]) >= deficit;
                if (others_ok && assigned_per_type[i] <= 104 && absorbs_deficit) working_focused.push(i);
            }
        }
        const rainbow_works = noGuildTome
            && assigned_per_type.every(v => v <= 101)
            && deficit <= assigned_per_type.filter(v => v > 0).length;
        const tome_needed = deficit > 0 || over_indices.length > 0;

        for (let i = 0; i < 5; i++) {
            document.getElementById(skp_order[i] + "-warnings").textContent = '';
            const assigned = assigned_per_type[i];
            if (assigned > 100) {
                const focusedCovers = working_focused.includes(i);
                const rainbowCovers = rainbow_works && assigned <= 101;
                if (focusedCovers || rainbowCovers) continue;
                let skp_warning = document.createElement("p");
                skp_warning.classList.add("warning", "small-text");
                skp_warning.textContent = "Cannot assign " + assigned + " skillpoints in " + skill[i] + " manually.";
                document.getElementById(skp_order[i] + "-warnings").appendChild(skp_warning);
            }
        }

        let summarybox = document.getElementById("summary-box");
        summarybox.textContent = "";

        let remainingSkp = make_elem("p", ['scaled-font', 'my-0']);
        let remainingSkpTitle = make_elem("b", [], { textContent: "Assigned " + total_assigned + " skillpoints. Remaining skillpoints: " });
        let remainingSkpContent = document.createElement("b");
        remainingSkpContent.textContent = "" + (levelToSkillPoints(build.level) - total_assigned);
        remainingSkpContent.classList.add(levelToSkillPoints(build.level) - total_assigned < 0 ? "negative" : "positive");

        remainingSkp.append(remainingSkpTitle);
        remainingSkp.append(remainingSkpContent);

        summarybox.append(remainingSkp);

        let tomeText = null;
        if (tome_needed) {
            let parts = working_focused.map(i => SP_SHORT[i]).join("/");
            if (rainbow_works) parts = parts ? parts + " or Rainbow" : "Rainbow";
            if (parts) tomeText = "WARNING: Build requires a " + parts + " Tome.";
        }
        if (tomeText) {
            let skpWarning = document.createElement("span");
            skpWarning.classList.add("warning-yellow");
            skpWarning.textContent = tomeText;
            summarybox.append(skpWarning);
        } else if (total_assigned > levelCap) {
            let skpWarning = document.createElement("span");
            skpWarning.classList.add("warning");
            skpWarning.textContent = "WARNING: Too many skillpoints need to be assigned!";
            let skpCount = document.createElement("p");
            skpCount.classList.add("warning");
            skpCount.textContent = "For level " + (build.level > 101 ? "101+" : build.level) + ", there are only " + levelCap + " skill points available.";
            summarybox.append(skpWarning);
            summarybox.append(skpCount);
        }
        let lvlWarning;
        for (const item of build.items) {
            let item_lvl;
            if (item.statMap.get("crafted")) {
                //item_lvl = item.get("lvlLow") + "-" + item.get("lvl");
                item_lvl = item.statMap.get("lvlLow");
            }
            else {
                item_lvl = item.statMap.get("lvl");
            }

            if (build.level < item_lvl) {
                if (!lvlWarning) {
                    lvlWarning = document.createElement("p");
                    lvlWarning.classList.add("itemp"); lvlWarning.classList.add("warning");
                    lvlWarning.textContent = "WARNING: A level " + build.level + " player cannot use some piece(s) of this build."
                }
                let baditem = document.createElement("p");
                baditem.classList.add("nocolor"); baditem.classList.add("itemp");
                baditem.textContent = item.statMap.get("displayName") + " requires level " + item_lvl + " to use.";
                lvlWarning.appendChild(baditem);
            }
            
            let powders = item.statMap.get("powders");
            if (powders) {
                for (const powder of powders) {
                    if (item_lvl < powderLevelReq[powder % POWDER_TIERS]) {
                        if (!lvlWarning) {
                            lvlWarning = document.createElement("p");
                            lvlWarning.classList.add("itemp"); lvlWarning.classList.add("warning");
                            lvlWarning.textContent = item.statMap.get("displayName") + " cannot have tier " + (powder % POWDER_TIERS + 1) + " powders. Item must be level " + powderLevelReq[powder % POWDER_TIERS] + " or higher.";
                            break;
                        }
                    }
                }
            }
        }
        if (lvlWarning) {
            summarybox.append(lvlWarning);
        }
        for (const [setName, count] of build.activeSetCounts) {
            const bonus = getActiveSetBonus(setName, count);
            if (bonus?.illegal) {
                let setWarning = document.createElement("p");
                setWarning.classList.add("itemp"); setWarning.classList.add("warning");
                setWarning.textContent = "WARNING: illegal item combination: " + setName
                summarybox.append(setWarning);
            }
        }
    }
}

/**
 * Aggregate stats from all inputs (merges statmaps).
 *
 * Signature: AggregateStatsNode(*args) => StatMap
 */
class AggregateStatsNode extends ComputeNode<BuildStatMap> {
    constructor(name) { super(name); }

    compute_func(input_map: ComputeInputMap): BuildStatMap {
        const output_stats = new Map() as BuildStatMap;
        for (const [k, v] of input_map.entries()) {
            if (!(v instanceof Map)) continue;
            for (const [k2, v2] of v.entries()) {
                merge_stat(output_stats, k2, v2);
            }
        }
        return output_stats;
    }
}

let radiance_affected = [ /*"hp"*/, "fDef", "wDef", "aDef", "tDef", "eDef", "hprPct", "mr", "sdPct", "mdPct", "ls", "ms",
    // "xpb", "lb",
    "ref",
    /*"str", "dex", "int", "agi", "def",*/  // TODO its affected but i have to make it not affect req
    "thorns", "expd", "spd", "atkTier", "poison", "hpBonus", "spRegen", "eSteal", "hprRaw", "sdRaw", "mdRaw", "fDamPct", "wDamPct", "aDamPct", "tDamPct", "eDamPct", "fDefPct", "wDefPct", "aDefPct", "tDefPct", "eDefPct", "fixID", "category", "spPct1", "spRaw1", "spPct2", "spRaw2", "spPct3", "spRaw3", "spPct4", "spRaw4", "rSdRaw", "sprint", "sprintReg", "jh",

    // "lq", "gXp", "gSpd",

    // wynn2 damages.
    "eMdPct", "eMdRaw", "eSdPct", "eSdRaw",/*"eDamPct,"*/"eDamRaw",//"eDamAddMin","eDamAddMax",
    "tMdPct", "tMdRaw", "tSdPct", "tSdRaw",/*"tDamPct,"*/"tDamRaw",//"tDamAddMin","tDamAddMax",
    "wMdPct", "wMdRaw", "wSdPct", "wSdRaw",/*"wDamPct,"*/"wDamRaw",//"wDamAddMin","wDamAddMax",
    "fMdPct", "fMdRaw", "fSdPct", "fSdRaw",/*"fDamPct,"*/"fDamRaw",//"fDamAddMin","fDamAddMax",
    "aMdPct", "aMdRaw", "aSdPct", "aSdRaw",/*"aDamPct,"*/"aDamRaw",//"aDamAddMin","aDamAddMax",
    "nMdPct", "nMdRaw", "nSdPct", "nSdRaw", "nDamPct", "nDamRaw",//"nDamAddMin","nDamAddMax",      // neutral which is now an element
/*"mdPct","mdRaw","sdPct","sdRaw",*/"damPct", "damRaw",//"damAddMin","damAddMax",          // These are the old ids. Become proportional.
    "rMdPct", "rMdRaw", "rSdPct",/*"rSdRaw",*/"rDamPct", "rDamRaw",//"rDamAddMin","rDamAddMax",  // rainbow (the "element" of all minus neutral). rSdRaw is rainraw
    "critDamPct",
    //"spPct1Final", "spPct2Final", "spPct3Final", "spPct4Final",
    "healPct", "kb", "weakenEnemy", "slowEnemy", "rDefPct"
];
/**
 * Scale stats if radiance is enabled.
 * TODO: skillpoints...
 */
const radianceNodeRef = createRegistered<ComputeNode>('radiance_node');
export function getRadianceNode(): ComputeNode { return radianceNodeRef.get(); }
export function tryGetRadianceNode(): ComputeNode | undefined { return radianceNodeRef.tryGet(); }

/* Updates all spell boosts
*/
export function update_radiance(input: string) {
    let elem = document.getElementById(input + '-boost');
    if (elem.classList.contains("toggleOn")) {
        elem.classList.remove("toggleOn");
    } else {
        elem.classList.add("toggleOn");
    }
    getRadianceNode().mark_dirty().update();
}


/**
 * Aggregate editable ID stats with build and weapon type.
 *
 * Signature: AggregateEditableIDNode(build: Build, weapon: Item, *args) => StatMap
 */
class AggregateEditableIDNode extends ComputeNode {
    constructor() { super("builder-aggregate-inputs"); }

    compute_func(input_map) {
        const build = input_map.get('build'); input_map.delete('build');

        const output_stats = new Map(build.statMap);
        for (const [k, v] of input_map.entries()) {
            output_stats.set(k, v);
        }

        output_stats.set('classDef', classDefenseMultipliers.get(build.weapon.statMap.get("type")));
        return output_stats;
    }
}

const editIdOutputRef = createRegistered<EditableIDSetterNode>('edit_id_output');
export function getEditIdOutput(): EditableIDSetterNode { return editIdOutputRef.get(); }
export function tryGetEditIdOutput(): EditableIDSetterNode | undefined { return editIdOutputRef.tryGet(); }

export function resetEditableIDs() {
    getEditIdOutput().mark_dirty().update();
    getEditIdOutput().notify();
}
/**
 * Set the editble id fields.
 *
 * Signature: EditableIDSetterNode(build: Build) => null
 */
class EditableIDSetterNode extends ComputeNode {
    notify_nodes: ComputeNode[];

    constructor(notify_nodes) {
        super("builder-id-setter");
        this.notify_nodes = notify_nodes.slice();
        for (const child of this.notify_nodes) {
            child.link_to(this);
            child.fail_cb = true;
        }
    }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "EditableIDSetterNode accepts exactly one input (build)"; }
        const [build] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element
        for (const id of editable_item_fields) {
            const val = build.statMap.get(id);
            (document.getElementById(id) as HTMLInputElement).value = val;
            document.getElementById(id + '-base').textContent = 'Original Value: ' + val;
        }
    }

    notify() {
        // NOTE: DO NOT merge these loops for performance reasons!!!
        for (const node of this.notify_nodes) {
            node.mark_dirty();
        }
        for (const node of this.notify_nodes) {
            node.update();
        }
    }
}

/**
 * Set skillpoint fields from build.
 * This is separate because..... because of the way we work with edit ids vs skill points during the load sequence....
 *
 * Signature: SkillPointSetterNode(build: Build) => null
 */
class SkillPointSetterNode extends ComputeNode {
    notify_nodes: ComputeNode[];
    skillpoints: number[] | null;

    constructor(notify_nodes) {
        super("builder-skillpoint-setter");
        this.notify_nodes = notify_nodes.slice();
        this.skillpoints = null;
        for (const child of this.notify_nodes) {
            child.link_to(this);
            child.fail_cb = true;
        }
    }

    compute_func(input_map) {
        if (input_map.size !== 1) { throw "SkillPointSetterNode accepts exactly one input (build)"; }
        const [build] = input_map.values();  // Extract values, pattern match it into size one list and bind to first element

        for (const [idx, elem] of skp_order.entries()) {
            (document.getElementById(elem + '-skp') as HTMLInputElement).value = String(build.total_skillpoints[idx]);
        }

        if (this.skillpoints !== null) {
            for (const [idx, elem] of skp_order.entries()) {
                if (this.skillpoints[idx] !== null) {
                    (document.getElementById(elem + '-skp') as HTMLInputElement).value = String(this.skillpoints[idx]);
                }
            }
            this.skillpoints = null;
        }
    }

    update(skillpoints = null) {
        this.skillpoints = skillpoints;
        return super.update()
    }
}

/**
 * Get number (possibly summed) from a text input.
 *
 * Signature: SumNumberInputNode() => int
 */
class SumNumberInputNode extends InputNode {
    compute_func(input_map) {
        let value = this.input_field.value;
        if (value === "") { value = "0"; }

        let input_num = 0;
        if (value.includes("+")) {
            let skp = value.split("+");
            for (const s of skp) {
                const val = parseInt(s, 10);
                if (isNaN(val)) {
                    return null;
                }
                input_num += val;
            }
        } else {
            input_num = parseInt(value, 10);
            if (isNaN(input_num)) {
                return null;
            }
        }
        return input_num;
    }
}

function generateTomeTooltip(tooltip_elem, tome) {
    const title = make_elem("p", [tome.statMap.get("tier"), "scaled-font", "mx-1", "my-1"]);
    const body = make_elem("p", ["mc-gray", "scaled-font", "text-wrap", "mx-1", "my-1"]);
    title.innerHTML = tome.statMap.get("displayName");
    let numberRegex = /[+-]?\d+(\.\d+)?[%+s]?/g; // +/- (optional), 1 or more digits, period followed by 1 or more digits (optional), %/+/s (optional)

    // To display:
    // - Tome level
    body.appendChild(make_elem("div", ["col"], {
        textContent: `Combat Level Min: ${tome.statMap.get("lvl")}`
    }));

    body.appendChild(make_elem("br", [], {}));

    // - Tome skillpoint bonuses
    let skp_bonuses = tome.statMap.get("skillpoints");
    if (skp_bonuses) {
        for (let [i, skp] of skp_order.entries()) {
            if (skp_bonuses[i] != 0) {
                let skp_div = make_elem("div", ["col"], {});
                let skp_title = make_elem("span", ["mc-white"], {
                    textContent: `${idPrefixes[skp]}`
                });
                let bonus_elem = make_elem("span", [skp_bonuses[i] < 0 ? "negative" : "positive"], {
                    textContent: `${skp_bonuses[i]}`
                });
                skp_div.append(skp_title, bonus_elem);
                body.appendChild(skp_div)
            }
        }
    }

    // - Tome stats
    let minRolls = tome.statMap.get("minRolls");
    let maxRolls = tome.statMap.get("maxRolls");

    for (const [id, value] of minRolls) {
        if (value == 0) continue;

        let value_max = maxRolls.get(id);

        let style = value < 0 ? "negative" : "positive";
        if (reversedIDs.includes(id)) {
            style === "positive" ? style = "negative" : style = "positive";
        }
        let id_row = make_elem("div", ["col"], {});
        let col_row = make_elem("div", ["row"], {});

        let minElem = make_elem("div", [style, "col", "text-start"], {
            textContent: `${value}${idSuffixes[id]}`
        });
        minElem.style.cssText += "flex-grow: 0"

        let idTitle = make_elem("div", ["mc-white", "col", "text-center"], {
            textContent: `${idPrefixes[id]}`
        });
        idTitle.style.cssText += "flex-grow: 1"

        let maxElem = make_elem("div", [style, "col", "text-end"], {
            textContent: `${value_max}${idSuffixes[id]}`
        });
        maxElem.style.cssText += "flex-grow: 0"

        col_row.append(minElem, idTitle, maxElem);
        id_row.append(col_row);
        body.append(id_row)
    }

    tooltip_elem.appendChild(title);
    tooltip_elem.appendChild(body);
}

/*
 * Renders the tooltips for tomes.
 * Signature TomeHoverRenderNode(name, trigger, bounding_elem) => None
 *
 * @param {name} the name of the node
 * @param {trigger} the trigger div
 * @param {bounding_elem} the box bounding (loosely) the elements.
 *
 * Notice that we're using the `on{event}` property instead of addEventListener to overwrite the listener
 * function every time an aspect update occurs.
 *
 * TODO(@orgold): Factor this into a more generic function (duplicate aspect logic).
 */
class TomeHoverRenderNode extends TooltipGeneratorNode {
    constructor(name, trigger, bounding_elem) {
        super(name, trigger, bounding_elem, generateTomeTooltip);
    }

    compute_func(input_map) {
        let tome = input_map.get('tooltip-args');

        // Clean up listeners
        if (tome.statMap.get("NONE")) {
            this.trigger.onmouseover = undefined;
            this.trigger.onmouseout = undefined;
            this.trigger.onclick = undefined;
            return;
        };
        super.compute_func(input_map)
    }
}

export let item_final_nodes: ComputeNode[] = [];
export let powder_nodes: ComputeNode[] = [];
export let edit_input_nodes: ComputeNode[] = [];
export let skp_inputs: (ComputeNode & { input_field?: HTMLInputElement; value?: number })[] = [];
export let equip_inputs: ComputeNode[] = [];

const buildNodeRef = createRegistered<BuildAssembleNode>('build_node');
export function getBuildNode(): BuildAssembleNode { return buildNodeRef.get(); }
export function tryGetBuildNode(): BuildAssembleNode | undefined { return buildNodeRef.tryGet(); }

const statAggNodeRef = createRegistered<AggregateStatsNode>('stat_agg_node');
export function getStatAggNode(): AggregateStatsNode { return statAggNodeRef.get(); }
export function tryGetStatAggNode(): AggregateStatsNode | undefined { return statAggNodeRef.tryGet(); }

const editAggNodeRef = createRegistered<AggregateEditableIDNode>('edit_agg_node');
export function getEditAggNode(): AggregateEditableIDNode { return editAggNodeRef.get(); }
export function tryGetEditAggNode(): AggregateEditableIDNode | undefined { return editAggNodeRef.tryGet(); }

const atreeGraphCreatorRef = createRegistered<AbilityTreeEnsureNodesNode>('atree_graph_creator');
export function getAtreeGraphCreator(): AbilityTreeEnsureNodesNode { return atreeGraphCreatorRef.get(); }
export function tryGetAtreeGraphCreator(): AbilityTreeEnsureNodesNode | undefined { return atreeGraphCreatorRef.tryGet(); }

const buildDispNodeRef = createRegistered<BuildDisplayNode>('build_disp_node');
export function getBuildDispNode(): BuildDisplayNode { return buildDispNodeRef.get(); }
export function tryGetBuildDispNode(): BuildDisplayNode | undefined { return buildDispNodeRef.tryGet(); }

let builderInputNodesRegistered = false;

/** Register builder-only input nodes (armor powder, boosts, raid buff, powder special, radiance). */
export function registerBuilderInputNodes(): void {
    if (builderInputNodesRegistered) return;
    builderInputNodesRegistered = true;

    armorPowderNodeRef.set(new (class extends ComputeNode {
        constructor() { super('builder-armor-powder-input'); }

        compute_func(input_map) {
            let damage_boost = 0;
            let def_boost = 0;
            let statMap = new Map();
            for (const [e, elem] of zip2(skp_elements, skp_order)) {
                let val = parseInt((document.getElementById(elem + "_boost_armor") as HTMLInputElement).value);
                statMap.set(e + 'DamPct', val);
            }
            return statMap;
        }
    })());

    const boostToggleElems = new Map<string, HTMLElement>();
    for (const key of damageMultipliers.keys()) {
        const elem = document.getElementById(key + "-boost");
        if (elem) boostToggleElems.set(key, elem);
    }
    const judgementBoostElem = document.getElementById('judgement-boost');

    boostsNodeRef.set(new (class extends ComputeNode {
        constructor() { super('builder-boost-input'); }

        compute_func(input_map) {
            let damage_boost = 0;
            let str_boost = 0;
            let vuln_boost = 0;
            let def_boost = 0;
            let weaken_boost = 0;
            for (const [key, value] of damageMultipliers) {
                const elem = boostToggleElems.get(key);
                if (!elem) {
                    continue;
                }
                if (elem.classList.contains("toggleOn")) {
                    if (value > damage_boost) { damage_boost = value }
                    if (key === "warscream") { def_boost += .20 }
                    else if (key === "emboldeningcry") { def_boost += .05; str_boost += .08 }
                    else if (key === "hauntingfanatic") { vuln_boost += .15 }
                    else if (key === "hauntinglunatic") { weaken_boost += .15 }
                }
            }
            let res = new Map();
            res.set('damMult.Potion', 100 * damage_boost);
            res.set('damMult.Strength', 100 * str_boost);
            res.set('damMult.Vulnerability', 100 * vuln_boost);
            res.set('defMult.Potion', 100 * def_boost);
            res.set('defMult.AbilityWeaken', 100 * weaken_boost);

            if (judgementBoostElem?.classList.contains("toggleOn")) {
                res.set('damMult.Judgement', 20);
                res.set('defMult.Judgement', 20);
            }
            return res;
        }
    })());

    raid_buff_node = new (class extends ComputeNode {
        constructor() { super('builder-raid-buff-input'); }

        compute_func(input_map) {
            const raids = ['notg', 'nol', 'tcc', 'tna', 'wtp'];
            let statMap = new Map();
            let toggledBuffs = [];
            for (const raid of raids) {
                for (let i = 1; i <= 3; i++) {
                    let other_tier = document.getElementById(raid + "-" + i);
                    for (let buff of other_tier.children) {
                        if (buff.classList.contains("toggleOn")) { toggledBuffs.push(buff.id) }
                    }
                }
            }

            for (const buff of toggledBuffs) {
                for (const [stat, val] of raid_buff_map.get(buff)) {
                    if (statMap.has(stat)) {
                        statMap.set(stat, val + statMap.get(stat));
                    }
                    else {
                        statMap.set(stat, val);
                    }
                }
            }
            return statMap;
        }
    })();

    powderSpecialInputRef.set(new (class extends ComputeNode {
        constructor() { super('builder-powder-special-input'); }

        compute_func(input_map) {
            let powder_specials = []; // [ [special, power], [special, power]]
            for (const sName of specialNames) {
                for (let i = 1; i < 8; i++) {
                    if (document.getElementById(sName.replace(" ", "_") + "-" + i).classList.contains("toggleOn")) {
                        let powder_special = powderSpecialStats[specialNames.indexOf(sName.replace("_", " "))];
                        powder_specials.push([powder_special, i]);
                        break;
                    }
                }
            }
            return powder_specials;
        }
    })());

    const radianceBoostElem = document.getElementById('radiance-boost')!;
    const divineHonorBoostElem = document.getElementById('divinehonor-boost')!;
    const shineBoostElem = document.getElementById('shine-boost')!;

    radianceNodeRef.set(new (class extends ComputeNode {
        constructor() { super('radiance-node->:('); }

        compute_func(input_map) {
            const statmap = [...input_map.values()][0] as Map<string, number>;
            var boost = 1;
            if (radianceBoostElem.classList.contains("toggleOn")) {
                boost += 0.15;
            }
            if (divineHonorBoostElem.classList.contains("toggleOn")) {
                boost += 0.05;
            }
            if (shineBoostElem.classList.contains("toggleOn")) {
                boost += 0.05;
            }
            if (judgementBoostElem?.classList.contains("toggleOn")) {
                boost = 1.4;
            }

            if (boost != 1.0) {
                const ret = new Map(statmap);
                for (const val of radiance_affected) {
                    if (reversedIDs.includes(val)) {
                        if ((ret.get(val) || 0) < 0) {
                            ret.set(val, Math.floor((ret.get(val) || 0) * boost));
                        }
                    }
                    else {
                        if ((ret.get(val) || 0) > 0) {
                            ret.set(val, Math.floor((ret.get(val) || 0) * boost));
                        }
                    }
                }
                
                // Radiance only affects the skillpoints granted from items (and consu apparently?)
                skp_order.forEach((skp, i) => {
                    if (!player_build) return;
                    if ((player_build.total_item_skillpoints[i] || 0) > 0) {
                        ret.set(skp, Math.floor((ret.get(skp) || 0) + player_build.total_item_skillpoints[i] * (boost-1)));
                    }
                });
                return ret;
            }
            else {
                return statmap;
            }
        }
    })());
}

/** Register all builder compute graph nodes (input nodes + ability tree). */
export function registerBuilderGraph(): void {
    registerBuilderInputNodes();
    registerAtreeGraph();
}

let graphWired = false;

/**
 * Wire registered builder nodes into the compute graph and run the initial update cascade.
 *
 * Parameters:
 *  skillpoints: skillpoint overrides from decodeHash(), or null for defaults.
 */
export function wireBuilderGraph(skillpoints: number[] | null) {
    if (graphWired) return;
    graphWired = true;

    // Phase 1/3: Set up item input, propagate updates, etc.

    // Level input node.
    let level_input = new InputNode('level-input', document.getElementById('level-choice') as HTMLInputElement);

    // "Build" now only refers to equipment and level (no powders). Powders are injected before damage calculation / stat display.
    const buildNode = new BuildAssembleNode();
    buildNodeRef.set(buildNode);
    buildNode.link_to(level_input);
    getAtreeMerge().link_to(buildNode, "build");


    let build_encode_node = new BuildEncodeNode();
    build_encode_node.link_to(buildNode, 'build');

    // Bind item input fields to input nodes, and some display stuff (for auto colorizing stuff).
    for (const [eq, display_elem, none_item] of zip3(equipment_fields, build_fields, none_items)) {
        let input_field = document.getElementById(eq + "-choice");
        let item_image = document.getElementById(eq + "-img");

        let item_input: ComputeNode = new ItemInputNode(eq + '-input', input_field as HTMLInputElement, none_item);
        equip_inputs.push(item_input);
        if (powder_inputs.includes(eq + '-powder')) { // TODO: fragile
            const powder_name = eq + '-powder';
            let powder_node = new PowderInputNode(powder_name, document.getElementById(powder_name) as HTMLInputElement)
                .link_to(item_input, 'item');
            powder_nodes.push(powder_node);
            build_encode_node.link_to(powder_node, powder_name);
            let item_powdering = new ItemPowderingNode(eq + '-powder-apply')
                .link_to(powder_node, 'powdering').link_to(item_input, 'item');
            item_input = item_powdering;
        }
        item_final_nodes.push(item_input);
        new ItemInputDisplayNode(eq + '-input-display', eq, item_image).link_to(item_input);
        new ItemDisplayNode(eq + '-item-display', display_elem).link_to(item_input);
        //new PrintNode(eq+'-debug').link_to(item_input);
        //document.querySelector("#"+eq+"-tooltip").setAttribute("onclick", "collapse_element('#"+ eq +"-tooltip');"); //toggle_plus_minus('" + eq + "-pm'); 
        buildNode.link_to(item_input, eq);
    }

    for (const [eq, none_item] of zip2(tome_fields, [none_tomes[0], none_tomes[0], none_tomes[1], none_tomes[1], none_tomes[1], none_tomes[1], none_tomes[2], none_tomes[3], none_tomes[4], none_tomes[4], none_tomes[5], none_tomes[5], none_tomes[6], none_tomes[6]])) {
        let input_field = document.getElementById(eq + "-choice");
        let item_image = document.getElementById(eq + "-img");

        let item_input: ComputeNode = new ItemInputNode(eq + '-input', input_field as HTMLInputElement, none_item);
        equip_inputs.push(item_input);
        item_final_nodes.push(item_input);
        new ItemInputDisplayNode(eq + '-input-display', eq, item_image).link_to(item_input);
        let tomeDropdown = document.getElementById('tomes-dropdown');
        let tomeImage = document.getElementById(`${eq}-img-loc`);
        new TomeHoverRenderNode(`{eq}-render`, tomeImage, tomeDropdown).link_to(item_input, 'tooltip-args');
        buildNode.link_to(item_input, eq);
    }

    // weapon image changer node.
    let weapon_image = document.getElementById("weapon-img");
    let weapon_dps = document.getElementById("weapon-dps");
    new WeaponInputDisplayNode('weapon-type-display', weapon_image, weapon_dps).link_to(item_final_nodes[8]);

    // linking to atree verification
    getAtreeValidate().link_to(level_input, 'level');

    let url_update_node = new URLUpdateNode();
    url_update_node.link_to(build_encode_node, 'build-str');

    // Phase 2/3: Set up editable IDs, skill points; use decodeBuild() skill points, calculate damage

    // Create one node that will be the "aggregator node" (listen to all the editable id nodes, as well as the build_node (for non editable stats) and collect them into one statmap)
    const preScaleAggNode = new AggregateStatsNode('pre-scale-stats');
    preScaleAggNodeRef.set(preScaleAggNode);
    const statAggNode = new AggregateStatsNode('final-stats');
    statAggNodeRef.set(statAggNode);
    const editAggNode = new AggregateEditableIDNode();
    editAggNodeRef.set(editAggNode);
    editAggNode.link_to(buildNode, 'build');
    for (const field of editable_item_fields) {
        // Create nodes that listens to each editable id input, the node name should match the "id"
        const elem = document.getElementById(field);
        const node = new SumNumberInputNode('builder-' + field + '-input', elem as HTMLInputElement);

        editAggNode.link_to(node, field);
        edit_input_nodes.push(node);
    }
    // Edit IDs setter declared up here to set ids so they will be populated by default.
    const editIdOutput = new EditableIDSetterNode(edit_input_nodes);    // Makes shallow copy of list.
    editIdOutputRef.set(editIdOutput);
    editIdOutput.link_to(buildNode);
    editAggNode.link_to(editIdOutput, 'edit-id-setter');

    for (const skp of skp_order) {
        const elem = document.getElementById(skp + '-skp');
        const node = new SumNumberInputNode('builder-' + skp + '-input', elem as HTMLInputElement);

        editAggNode.link_to(node, skp);
        build_encode_node.link_to(node, skp);
        edit_input_nodes.push(node);
        skp_inputs.push(node as ComputeNode & { input_field?: HTMLInputElement; value?: number });
    }
    preScaleAggNode.link_to(editAggNode);

    // Phase 3/3: Set up atree and aspect stuff.

    let class_node = new PlayerClassNode('builder-class').link_to(buildNode);
    // These two are defined in `builder/atree.js`
    getAtreeNode().link_to(class_node, 'player-class');
    getAtreeMerge().link_to(class_node, 'player-class');
    preScaleAggNode.link_to(getAtreeRawStats(), 'atree-raw-stats');
    preScaleAggNode.link_to(raid_buff_node, 'raid-buff');
    getRadianceNode().link_to(preScaleAggNode, 'stats');
    getAtreeScaling().link_to(getRadianceNode(), 'scale-stats');
    statAggNode.link_to(getRadianceNode(), 'pre-scaling');
    statAggNode.link_to(getAtreeScalingStats(), 'atree-scaling');

    build_encode_node.link_to(getAtreeNode(), 'atree').link_to(getAtreeStateNode(), 'atree-state');

    setAspectAggNode(new AspectAggregateNode('final-aspects'));
    const aspects_dropdown = document.getElementById('aspects-dropdown');
    for (const field of aspect_fields) {
        const aspect_input_field = document.getElementById(field + '-choice');
        const aspect_tier_input_field = document.getElementById(field + '-tier-choice');
        const aspect_image_div = document.getElementById(field + '-img');
        const aspect_image_loc_div = document.getElementById(field + '-img-loc');
        new AspectAutocompleteInitNode(field + '-autocomplete', field).link_to(class_node, 'player-class');
        const aspect_input = new AspectInputNode(field + '-input', aspect_input_field as HTMLInputElement).link_to(class_node, 'player-class');
        new AspectInputDisplayNode(field + '-input', aspect_input_field as HTMLInputElement, aspect_image_div).link_to(aspect_input, "aspect-spec");
        aspect_inputs.push(aspect_input);
        const aspect_tier_input = new AspectTierInputNode(field + '-tier-input', aspect_tier_input_field as HTMLInputElement).link_to(aspect_input, 'aspect-spec');
        new AspectRenderNode(field + '-render', aspect_image_loc_div, aspects_dropdown).link_to(aspect_tier_input, 'tooltip-args');
        aspect_agg_node!.link_to(aspect_tier_input, field + '-tiered');
    }
    build_encode_node.link_to(aspect_agg_node!, 'aspects');

    getAtreeMerge().link_to(aspect_agg_node!);

    // ---------------------------------------------------------------
    //  Trigger the update cascade for build!
    // ---------------------------------------------------------------
    for (const input_node of equip_inputs) {
        input_node.update();
    }

    getArmorPowderNode().update();
    getBoostsNode().update();
    level_input.update();
    raid_buff_node.update();

    const atreeGraphCreator = new AbilityTreeEnsureNodesNode(buildNode, statAggNode)
        .link_to(getAtreeCollectSpells(), 'spells');
    atreeGraphCreatorRef.set(atreeGraphCreator);

    // kinda janky, manually set atree and update. Some wasted compute here
    const atreeNode = getAtreeNode();
    if (atree_data !== null && atreeNode.value !== null) { // janky check if atree is valid
        const atreeStateNode = getAtreeStateNode();
        const atree_state = atreeStateNode.value;
        if (atree_data.length > 0) {
            try {
                const active_nodes = decodeAtree(atreeNode.value as ATree, atree_data as unknown as Parameters<typeof decodeAtree>[1]);
                for (const node of active_nodes) {
                    atree_set_state((atree_state as RenderedATree).get(node.ability.id), true);
                }
                atreeStateNode.mark_dirty().update();
            } catch (e) {
                console.error(e);
                console.log("Failed to decode atree. This can happen when updating versions. Give up!")
            }
        }
    }

    for (const aspect_input_node of aspect_inputs) {
        aspect_input_node.update();
    }

    // Powder specials.
    let powder_special_calc = new PowderSpecialCalcNode().link_to(getPowderSpecialInput(), 'powder-specials');
    new PowderSpecialDisplayNode().link_to(getPowderSpecialInput(), 'powder-specials')
        .link_to(statAggNode, 'stats').link_to(buildNode, 'build');
    preScaleAggNode.link_to(powder_special_calc, 'powder-boost');
    statAggNode.link_to(getArmorPowderNode(), 'armor-powder');
    getPowderSpecialInput().update();

    // Potion boost.
    statAggNode.link_to(getBoostsNode(), 'potion-boost');

    // Also do something similar for skill points
    const buildDispNode = new BuildDisplayNode();
    buildDispNodeRef.set(buildDispNode);
    buildDispNode.link_to(buildNode, 'build');
    buildDispNode.link_to(statAggNode, 'stats');

    for (const node of edit_input_nodes) {
        node.update();
    }

    let skp_output = new SkillPointSetterNode(skp_inputs);
    skp_output.link_to(buildNode);
    skp_output.update().mark_dirty().update(skillpoints);
    let build_warnings_node = new DisplayBuildWarningsNode();
    build_warnings_node.link_to(buildNode, 'build');
    for (const [skp_input, skp] of zip2(skp_inputs, skp_order)) {
        build_warnings_node.link_to(skp_input, skp);
    }
    build_warnings_node.update();

    // call node.update() for each skillpoint node and stat edit listener node manually
    // NOTE: the text boxes for skill points are already filled out by decodeBuild() so this will fix them
    // this will propagate the update to the `stat_agg_node`, and then to damage calc

    console.log("Set up graph");
    setGraphLiveUpdate(true);
    initManaCalcListeners();
}

;

