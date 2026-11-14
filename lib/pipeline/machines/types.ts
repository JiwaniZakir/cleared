/**
 * The shape of every state machine: a table of
 * `{ from, event, to, actor, gates[], notify[] }`. The service layer looks a
 * transition up here and refuses anything the table does not have
 * (`conflict`). Every transition writes an audit_event.
 */
import type { Gate } from "@/lib/pipeline/errors";
import type { Role, Side } from "@/lib/pipeline/vocab";

/**
 * Who may trigger a transition. "agent" is a person through their own token,
 * "web" a signed-in person confirming on a page, "system" a timer, a
 * webhook or the follow-on effect of another transition.
 */
export type TransitionActor =
  | { via: "agent" | "web"; side: Side; roles?: readonly Role[] }
  | { via: "system" };

export interface Transition<S extends string, E extends string> {
  /** `null` for the transition that creates the row. */
  from: S | null;
  event: E;
  to: S;
  actors: readonly TransitionActor[];
  /** Gates checked before the transition, plus named preconditions. */
  gates: readonly (Gate | string)[];
  /** Who is told: member roles, "candidate", or both. */
  notify: readonly (Role | "candidate")[];
}

export type MachineTable<S extends string, E extends string> = readonly Transition<S, E>[];

/** The transition for `event` from `from`, or undefined (the service then refuses with `conflict`). */
export function findTransition<S extends string, E extends string>(table: MachineTable<S, E>, from: S | null, event: E): Transition<S, E> | undefined {
  return table.find((t) => t.from === from && t.event === event);
}
