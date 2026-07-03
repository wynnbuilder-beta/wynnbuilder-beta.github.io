/**
 * Computation graph node types.
 */

/** Dirty-state enum used by ComputeNode.update(). */
export type ComputeDirtyState = 0 | 1 | 2;

/** Input edge from a parent ComputeNode. */
export interface NodeInput {
  node: ComputeNode;
  /** Translation key passed to compute_func; defaults to parent node name. */
  translation: string;
  is_dirty: boolean;
}

export type ComputeFunc = (inputMap: Map<string, unknown>) => unknown;

/** Reactive node in the builder computation graph. */
export interface ComputeNode {
  name: string;
  inputs: Map<string, NodeInput>;
  children: ComputeNode[];
  value: unknown;
  update_task: ReturnType<typeof setTimeout> | null;
  /** When true, propagate updates even if a parent value is null. */
  fail_cb: boolean;
  /** 2 = dirty, 1 = possibly dirty, 0 = clean */
  dirty: ComputeDirtyState;
  inputs_dirty_count: number;

  update(): ComputeNode;
  mark_input_clean(inputName: string, value: unknown): void;
  mark_input_dirty(inputName: string): void;
  mark_dirty(dirtyState?: ComputeDirtyState): ComputeNode;
  get_value(): unknown;
  compute_func(inputMap: Map<string, unknown>): unknown;
  link_to(parentNode: ComputeNode, linkName?: string): ComputeNode;
  remove_link(parentNode: ComputeNode): ComputeNode;
}

/** ValueCheckComputeNode stores last valid value separately. */
export interface ValueCheckComputeNode extends ComputeNode {
  valid_val: unknown;
}

/** PassThroughNode exposes breakout sub-nodes for aggregated inputs. */
export interface PassThroughNode extends ComputeNode {
  breakout_nodes: Map<string, ComputeNode>;
}

/** InputNode bound to an HTML input element. */
export interface InputNode extends ValueCheckComputeNode {
  input_field: HTMLElement;
}

/** Callback scheduled by calcSchedule(). */
export type ComputeScheduleCallback = () => void;
