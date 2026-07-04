import { aspect_map, none_aspect } from '@/load_aspect';
import { ComputeNode, calcSchedule, graph_live_update } from '@/computation_graph';
import { isMobile, make_elem } from '@/utils';
import { aspect_fields } from './builder_constants';
import { create_autocomplete } from './autocomplete';
import type {
  AspectInputResult,
  AspectMap,
  AspectSpec,
  AspectTuple,
  AspectUiTier,
} from '@/types/aspect';
import type { PlayerClass } from '@/types/stats';

export let aspect_inputs: AspectInputNode[] = [];
export let aspect_agg_node: AspectAggregateNode | undefined;

export function setAspectAggNode(node: AspectAggregateNode | undefined): void {
  aspect_agg_node = node;
}

export const aspect_tiers: AspectUiTier[] = ['Legendary', 'Fabled', 'Mythic'];
export const num_aspects = 5;

let aspect_inputs_dropdowns_ctx = new Map<
  string,
  ReturnType<typeof create_autocomplete>
>();
let active_aspects: AspectMap | null = null;
let aspect_aliases: Map<string, string> | null = null;

function bindInputField(node: ComputeNode, input_field: HTMLInputElement): void {
  input_field.addEventListener('input', () => {
    if (graph_live_update) calcSchedule(node, 500);
  });
  input_field.addEventListener('change', () => {
    if (graph_live_update) calcSchedule(node, 5);
  });
}

/**
 * Populate the aspect autocomplete list dynamically based on the choice of weapon.
 */
export class AspectAutocompleteInitNode extends ComputeNode {
  field: string;

  constructor(name: string, field: string) {
    super(name);
    this.field = field;
  }

  compute_func(input_map: Map<string, unknown>): void {
    const active_class = input_map.get('player-class') as PlayerClass | null;
    if (active_class === null) return;

    active_aspects = aspect_map.get(active_class)!;
    const class_aspect_names = [...active_aspects.keys()];

    aspect_aliases = new Map();
    for (const [display_name, aspect] of active_aspects) {
      if ('aliases' in aspect && aspect.aliases !== 'NO_ALIAS' && aspect.aliases) {
        for (const alias of aspect.aliases) {
          class_aspect_names.push(alias);
          aspect_aliases.set(alias, display_name);
        }
      }
    }

    if (!aspect_inputs_dropdowns_ctx.has(this.name)) {
      const aspect_ac_cb = (v: string) => {
        if (aspect_aliases!.has(v)) {
          v = aspect_aliases!.get(v)!;
        }
        return v;
      };
      aspect_inputs_dropdowns_ctx.set(
        this.name,
        create_autocomplete(class_aspect_names, active_aspects, this.field, aspect_ac_cb),
      );
    } else {
      const autocomplete_ctx = aspect_inputs_dropdowns_ctx.get(this.name)!;
      autocomplete_ctx.data.src = class_aspect_names;
      autocomplete_ctx.resultItem.element = (item, data) => {
        item.classList.add(active_aspects!.get(data.value)!.tier);
      };
    }
  }
}

/** Validate and fetch aspects from a linked aspect input field. */
export class AspectInputNode extends ComputeNode {
  input_field: HTMLInputElement;

  constructor(name: string, input_field: HTMLInputElement) {
    super(name);
    this.input_field = input_field;
    bindInputField(this, input_field);
  }

  compute_func(input_map: Map<string, unknown>): AspectInputResult {
    const ret: AspectInputResult = {
      spec: none_aspect,
      class: input_map.get('player-class') as PlayerClass | null,
    };
    if (this.input_field.value === '' || active_aspects === null) {
      return ret;
    }

    const aspect = active_aspects.get(this.input_field.value);

    if (!aspect && this.input_field !== document.activeElement) {
      this.input_field.value = '';
    } else if (aspect) {
      ret.spec = aspect;
    }

    return ret;
  }
}

/** Get a specific tier from the aspect; defaults to the max tier. */
export class AspectTierInputNode extends ComputeNode {
  input_field: HTMLInputElement;

  constructor(name: string, input_field: HTMLInputElement) {
    super(name);
    this.input_field = input_field;
    bindInputField(this, input_field);
  }

  compute_func(input_map: Map<string, unknown>): AspectTuple {
    const aspect = (input_map.get('aspect-spec') as AspectInputResult).spec;
    if (!aspect || aspect.NONE) {
      this.input_field.value = '';
      return [none_aspect, 1];
    }

    const tier_num = this.input_field.value;
    if (tier_num == '' || parseInt(tier_num) <= 0 || parseInt(tier_num) > aspect.tiers.length) {
      this.input_field.value = String(aspect.tiers.length);
    }
    return [aspect, parseInt(this.input_field.value)];
  }
}

/** Aggregate all aspects; validate uniqueness and single mythic. */
export class AspectAggregateNode extends ComputeNode {
  compute_func(input_map: Map<string, unknown>): AspectTuple[] {
    const aspects: AspectTuple[] = [];
    let has_mythic = false;
    const previous_aspect_ids = new Set<number>();

    for (const field of aspect_fields) {
      let err = false;
      document.getElementById(field + '-choice')!.classList.remove('is-invalid');

      const aspect_tuple = input_map.get(field + '-tiered') as AspectTuple;
      const [aspect] = aspect_tuple;

      if (aspect.NONE) {
        aspects.push(aspect_tuple);
        continue;
      }

      if (previous_aspect_ids.has(aspect.id)) {
        err = true;
      }
      previous_aspect_ids.add(aspect.id);

      if (aspect.tier === 'Mythic') {
        if (has_mythic) {
          err = true;
        } else {
          has_mythic = true;
        }
      }

      if (err) {
        document.getElementById(field + '-choice')!.classList.add('is-invalid');
      }

      aspects.push(aspect_tuple);
    }
    return aspects;
  }
}

type TooltipGeneratorFn = (tooltip_elem: HTMLElement, args: unknown) => void;

/**
 * Renders tooltips for hoverable images (aspects, tomes, etc.).
 * Intended to be inherited, not instantiated directly.
 */
export class TooltipGeneratorNode extends ComputeNode {
  trigger: HTMLElement;
  bounding_elem: HTMLElement;
  tooltip_generator_fn: TooltipGeneratorFn;
  tooltip_elem: HTMLElement | null = null;

  constructor(
    name: string,
    trigger: HTMLElement,
    bounding_elem: HTMLElement,
    tooltip_generator_fn: TooltipGeneratorFn,
  ) {
    super(name);
    this.trigger = trigger;
    this.bounding_elem = bounding_elem;
    this.tooltip_generator_fn = tooltip_generator_fn;
  }

  compute_func(input_map: Map<string, unknown>): void {
    const args = input_map.get('tooltip-args');

    if (!isMobile) {
      this.trigger.onmouseover = () => {
        this.tooltip_elem = make_elem(
          'div',
          ['rounded-bottom', 'dark-4', 'border', 'dark-shadow', 'text-start'],
          {
            style: {
              position: 'absolute',
              zIndex: '100',
              top:
                this.trigger.getBoundingClientRect().top + window.pageYOffset + 50 + 'px',
              left: this.trigger.getBoundingClientRect().left + 'px',
              width:
                (this.bounding_elem.getBoundingClientRect().width / 2) * 0.95 + 'px',
            },
          },
        );
        this.trigger.appendChild(this.tooltip_elem);
        this.tooltip_generator_fn(this.tooltip_elem, args);
      };

      this.trigger.onmouseout = () => {
        if (this.tooltip_elem) this.tooltip_elem.remove();
      };
    } else {
      this.trigger.onclick = () => {
        const bg = make_elem('div', [], {
          style: {
            position: 'fixed',
            'z-index': 10000,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            'background-color': 'rgba(0, 0, 0, 0.6)',
            'padding-top': '10vh',
            'padding-left': '2.5vw',
            'user-select': 'none',
          },
        });
        bg.onclick = (e: MouseEvent) => {
          if (e.target !== bg) {
            return;
          }
          bg.remove();
        };

        this.tooltip_elem = make_elem(
          'div',
          ['rounded-bottom', 'dark-4', 'border', 'dark-shadow', 'text-start'],
          {
            style: {
              max_height: '80vh',
              width: '95vw',
              'overflow-y': 'scroll',
            },
          },
        );
        document.body.appendChild(bg);
        bg.appendChild(this.tooltip_elem);
        this.tooltip_generator_fn(this.tooltip_elem, args);
      };
    }
  }
}

export function generate_aspect_tooltip(
  tooltip_elem: HTMLElement,
  [aspect, tier]: AspectTuple,
): void {
  const title = make_elem('p', [aspect.tier, 'scaled-font', 'mx-1', 'my-1']);
  const body = make_elem('p', ['mc-gray', 'scaled-font', 'text-wrap', 'mx-1', 'my-1']);
  title.innerHTML = aspect.displayName;
  const numberRegex = /[+-]?\d+(\.\d+)?[%+s]?/g;
  body.innerHTML = aspect.tiers[tier - 1].description.replace(
    numberRegex,
    (m) => "<span class = 'mc-white'>" + m + '</span>',
  );
  tooltip_elem.appendChild(title);
  tooltip_elem.appendChild(body);
}

export class AspectRenderNode extends TooltipGeneratorNode {
  constructor(name: string, trigger: HTMLElement, bounding_elem: HTMLElement) {
    super(name, trigger, bounding_elem, generate_aspect_tooltip);
  }

  compute_func(input_map: Map<string, unknown>): void {
    const [aspect] = input_map.get('tooltip-args') as AspectTuple;

    if (aspect.NONE) {
      this.trigger.onmouseover = undefined;
      this.trigger.onmouseout = undefined;
      this.trigger.onclick = undefined;
      return;
    }

    super.compute_func(input_map);
  }
}

/** Display the image and color of the aspect based on its tier. */
export class AspectInputDisplayNode extends ComputeNode {
  input_field: HTMLInputElement;
  image_div: HTMLElement;

  constructor(name: string, input_field: HTMLInputElement, image_div: HTMLElement) {
    super(name);
    this.input_field = input_field;
    this.image_div = image_div;
  }

  compute_func(input_map: Map<string, unknown>): void {
    const aspect = (input_map.get('aspect-spec') as AspectInputResult).spec;
    this.input_field.classList.remove(...aspect_tiers);
    this.image_div.classList.remove(
      ...[
        'aspect-image-Assassin',
        'aspect-image-Mage',
        'aspect-image-Warrior',
        'aspect-image-Shaman',
        'aspect-image-Archer',
        'aspect-image-None',
        'Legendary-shadow',
        'Fabled-shadow',
        'Mythic-shadow',
      ],
    );
    if (aspect && !aspect.NONE) {
      this.input_field.classList.add(aspect.tier as AspectUiTier);
      const player_class = (input_map.get('aspect-spec') as AspectInputResult).class || 'None';
      this.image_div.classList.add('aspect-image-' + player_class);
      this.image_div.classList.add(aspect.tier + '-shadow');
    } else {
      this.image_div.classList.add('aspect-image-None');
    }
  }
}

;
