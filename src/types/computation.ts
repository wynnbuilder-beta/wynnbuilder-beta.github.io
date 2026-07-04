/**
 * Computation graph node types.
 */

/** Dirty-state enum used by ComputeNode.update(). */
export type ComputeDirtyState = 0 | 1 | 2;

/** Named input map passed to compute_func — values come from heterogeneous parent nodes. */
export type ComputeInputMap = Map<string, unknown>;

/** Input edge from a parent ComputeNode. */
export interface NodeInput {
  node: ComputeNode<unknown>;
  /** Translation key passed to compute_func; defaults to parent node name. */
  translation: string;
  is_dirty: boolean;
}

export type ComputeFunc<TValue = unknown> = (inputMap: ComputeInputMap) => TValue;

/** Reactive node in the builder computation graph. */
export interface ComputeNode<TValue = unknown> {
  name: string;
  inputs: Map<string, NodeInput>;
  children: ComputeNode<unknown>[];
  value: TValue;
  update_task: ReturnType<typeof setTimeout> | null;
  /** When true, propagate updates even if a parent value is null. */
  fail_cb: boolean;
  /** 2 = dirty, 1 = possibly dirty, 0 = clean */
  dirty: ComputeDirtyState;
  inputs_dirty_count: number;

  update(): ComputeNode<TValue>;
  mark_input_clean(inputName: string, value: unknown): void;
  mark_input_dirty(inputName: string): void;
  mark_dirty(dirtyState?: ComputeDirtyState): ComputeNode<TValue>;
  get_value(): TValue;
  compute_func(inputMap: ComputeInputMap): TValue;
  link_to(parentNode: ComputeNode<unknown>, linkName?: string): ComputeNode<TValue>;
  remove_link(parentNode: ComputeNode<unknown>): ComputeNode<TValue>;
}

/** ValueCheckComputeNode stores last valid value separately. */
export interface ValueCheckComputeNode<TValue = unknown> extends ComputeNode<TValue> {
  valid_val: TValue;
}

/** PassThroughNode exposes breakout sub-nodes for aggregated inputs. */
export interface PassThroughNode extends ComputeNode<ComputeInputMap> {
  breakout_nodes: Map<string, ComputeNode<unknown>>;
}

/** InputNode bound to an HTML input element. */
export interface InputNode extends ValueCheckComputeNode<unknown> {
  input_field: HTMLInputElement;
}

/** Callback scheduled by calcSchedule(). */
export type ComputeScheduleCallback = () => void;
