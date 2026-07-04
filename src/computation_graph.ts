import type { ComputeDirtyState, ComputeInputMap } from './types/computation';

export type { ComputeInputMap } from './types/computation';

export let all_nodes = new Set<ComputeNode<unknown>>();
export let node_debug_stack: string[] = [];
export let COMPUTE_GRAPH_DEBUG = true;

/** Read a typed value from a compute node input map. */
export function getComputeInput<T>(input_map: ComputeInputMap, key: string): T {
  return input_map.get(key) as T;
}

export class NodeInput {
  node: ComputeNode<unknown>;
  translation: string;
  is_dirty: boolean;

  constructor(node: ComputeNode<unknown>, translation = node.name) {
    this.node = node;
    this.translation = translation;
    this.is_dirty = false;
  }
}

export class ComputeNode<TValue = unknown> {
  inputs = new Map<string, NodeInput>();
  children: ComputeNode<unknown>[] = [];
  value: TValue = null as TValue;
  name: string;
  update_task: ReturnType<typeof setTimeout> | null = null;
  fail_cb = false;
  dirty: ComputeDirtyState = 2;
  inputs_dirty_count = 0;

  constructor(name: string) {
    this.name = name;
    if (COMPUTE_GRAPH_DEBUG) {
      all_nodes.add(this);
    }
  }

  update(): this {
    if (this.inputs_dirty_count != 0) {
      return this;
    }
    if (this.dirty === 0) {
      return this;
    }
    if (COMPUTE_GRAPH_DEBUG) {
      node_debug_stack.push(this.name);
    }
    if (this.dirty == 2) {
      const calc_inputs: ComputeInputMap = new Map();
      for (const input of this.inputs.values()) {
        if (input.node.dirty) {
          if (COMPUTE_GRAPH_DEBUG) {
            console.log(node_debug_stack);
            console.log(this);
          }
          throw 'Invalid compute graph state!';
        }
        calc_inputs.set(input.translation, input.node.value);
      }
      this.value = this.compute_func(calc_inputs);
    }
    this.dirty = 0;
    for (const child of this.children) {
      child.mark_input_clean(this.name, this.value);
    }
    if (COMPUTE_GRAPH_DEBUG) {
      node_debug_stack.pop();
    }
    return this;
  }

  mark_input_clean(input_name: string, value: unknown): void {
    if (value !== null || this.fail_cb) {
      const input = this.inputs.get(input_name)!;
      if (input.is_dirty) {
        input.is_dirty = false;
        this.inputs_dirty_count -= 1;
      }
      if (this.inputs_dirty_count === 0) {
        this.update();
      }
    }
  }

  mark_input_dirty(input_name: string): void {
    const input = this.inputs.get(input_name)!;
    if (!input.is_dirty) {
      input.is_dirty = true;
      this.inputs_dirty_count += 1;
    }
  }

  mark_dirty(dirty_state: ComputeDirtyState = 2): this {
    if (this.dirty < dirty_state) {
      this.dirty = dirty_state;
      for (const child of this.children) {
        child.mark_input_dirty(this.name);
        child.mark_dirty(dirty_state);
      }
    }
    return this;
  }

  get_value(): TValue {
    return this.value;
  }

  compute_func(_input_map: ComputeInputMap): TValue {
    throw 'no compute func specified';
  }

  link_to(parent_node: ComputeNode<unknown>, link_name?: string): this {
    const input = new NodeInput(parent_node, link_name ?? parent_node.name);
    if (parent_node.dirty || (parent_node.value === null && !this.fail_cb)) {
      this.inputs_dirty_count += 1;
      input.is_dirty = true;
    }
    this.inputs.set(parent_node.name, input);
    parent_node.children.push(this);
    return this;
  }

  remove_link(parent_node: ComputeNode<unknown>): this {
    const was_dirty = this.inputs.get(parent_node.name)!.is_dirty;
    this.inputs.delete(parent_node.name);
    if (was_dirty) {
      this.inputs_dirty_count -= 1;
    }

    const idx = parent_node.children.indexOf(this);
    parent_node.children.splice(idx, 1);
    return this;
  }
}

export class ValueCheckComputeNode<TValue = unknown> extends ComputeNode<TValue> {
  valid_val: TValue = null as TValue;

  update(): this {
    if (this.inputs_dirty_count != 0) {
      return this;
    }
    if (this.dirty === 0) {
      return this;
    }
    if (COMPUTE_GRAPH_DEBUG) {
      node_debug_stack.push(this.name);
    }

    const calc_inputs: ComputeInputMap = new Map();
    for (const input of this.inputs.values()) {
      calc_inputs.set(input.translation, input.node.value);
    }
    const val = this.compute_func(calc_inputs);
    if (val !== null) {
      if (val !== this.valid_val) {
        super.mark_dirty(2);
      }
      this.valid_val = val;
    }
    this.value = val;
    this.dirty = 0;
    for (const child of this.children) {
      child.mark_input_clean(this.name, this.value);
    }
    if (COMPUTE_GRAPH_DEBUG) {
      node_debug_stack.pop();
    }
    return this;
  }

  mark_dirty(_dirty_state: ComputeDirtyState = 1): this {
    return super.mark_dirty(1);
  }
}

export let graph_live_update = false;

export function setGraphLiveUpdate(live: boolean): void {
  graph_live_update = live;
}

/**
 * Schedule a ComputeNode to be updated.
 */
export function calcSchedule(node: ComputeNode<unknown>, timeout: number): void {
  if (node.update_task !== null) {
    clearTimeout(node.update_task);
  }
  node.mark_dirty();
  node.update_task = setTimeout(function () {
    if (COMPUTE_GRAPH_DEBUG) {
      node_debug_stack = [];
    }
    graph_live_update = false;
    node.update();
    node.update_task = null;
    graph_live_update = true;
  }, timeout);
}

export class PrintNode extends ComputeNode<null> {
  constructor(name: string) {
    super(name);
    this.fail_cb = true;
  }

  compute_func(input_map: ComputeInputMap): null {
    console.log([this.name, input_map]);
    return null;
  }
}

/**
 * Node for getting an input from an input field.
 * Fires updates whenever the input field is updated.
 */
export class InputNode extends ValueCheckComputeNode<unknown> {
  input_field: HTMLInputElement;

  constructor(name: string, input_field: HTMLInputElement) {
    super(name);
    this.input_field = input_field;
    this.input_field.addEventListener('input', () => {
      if (graph_live_update) calcSchedule(this, 500);
    });
    this.input_field.addEventListener('change', () => {
      if (graph_live_update) calcSchedule(this, 5);
    });
  }

  compute_func(_input_map: ComputeInputMap): unknown {
    return this.input_field.value;
  }
}

/**
 * Passthrough node for simple aggregation.
 */
export class PassThroughNode extends ComputeNode<ComputeInputMap> {
  breakout_nodes = new Map<string, ComputeNode<unknown>>();

  compute_func(input_map: ComputeInputMap): ComputeInputMap {
    return input_map;
  }

  get_node(sub_input: string): ComputeNode<unknown> {
    if (this.breakout_nodes.has(sub_input)) {
      return this.breakout_nodes.get(sub_input)!;
    }
    const _name = this.name;
    const ret = new (class extends ComputeNode<unknown> {
      constructor() {
        super('passthrough-' + _name + '-' + sub_input);
      }
      compute_func(input_map: ComputeInputMap): unknown {
        return (input_map.get(_name) as Map<string, unknown>).get(sub_input);
      }
    })().link_to(this);
    this.breakout_nodes.set(sub_input, ret);
    return ret;
  }
}

;
