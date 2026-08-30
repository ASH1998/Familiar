/**
 * Phase machine: HUMAN -> FAMILIAR -> DUNGEON -> HUMAN ...
 *
 * The familiar is driven by an external agent that has no idea whose turn it is, so
 * every tool call passes through `guard()` first. Refusals are not error handling —
 * they are how the agent learns the rules. Each one says what to do instead.
 */

import {
  HUMAN_ACTIONS_PER_TURN,
  type GameState,
  log,
} from "./state.js";
import { familiar } from "./familiars.js";
import { stepWight } from "./wight.js";

/** A refused tool call. `ok: false` responses still return prose, never throw. */
export type ToolResult = { ok: boolean; text: string };

export const refuse = (text: string): ToolResult => ({ ok: false, text });
export const allow = (text: string): ToolResult => ({ ok: true, text });

/**
 * Gate every familiar tool. Returns a refusal, or null when the call may proceed.
 *
 * `readOnly` tools (inspect, search, lookup) are exempt from the energy cost but not
 * from the phase check — otherwise the familiar could scout during the human's turn,
 * which would quietly dissolve the information asymmetry.
 */
export function guard(state: GameState, readOnly = false): ToolResult | null {
  if (state.won) {
    return refuse("The dungeon is already open. Nothing more binds you.");
  }
  if (state.phase !== "FAMILIAR") {
    return refuse(
      state.phase === "HUMAN"
        ? "It is not your turn — the adventurer is still acting. Wait for them to finish."
        : "The dungeon is resolving its own turn. Wait.",
    );
  }
  if (!readOnly && state.familiarEnergy <= 0) {
    return refuse(
      "You have no energy left this turn. Call end_familiar_turn to pass, and you will " +
        `regain ${familiar(state).energy} energy on your next turn.`,
    );
  }
  return null;
}

/** Charge one energy for an acting (non-read-only) tool. */
export function spendEnergy(state: GameState): void {
  state.familiarEnergy = Math.max(0, state.familiarEnergy - 1);
}

export function endHumanTurn(state: GameState): void {
  if (state.phase !== "HUMAN") return;
  state.phase = "FAMILIAR";
  state.familiarEnergy = familiar(state).energy;
  log(state, { source: "system", text: "FAMILIAR TURN" });
}

export function endFamiliarTurn(state: GameState): void {
  if (state.phase !== "FAMILIAR") return;
  state.phase = "DUNGEON";
  log(state, { source: "system", text: "DUNGEON TURN" });
}

/**
 * The dungeon's deterministic reaction — design doc §4 Phase 3.
 *
 * Deterministic on purpose: a predictable world is what lets two players with different
 * information reason together. The wight walks a fixed loop, so both of them can plan
 * around it once the human has described where it is.
 */
export function resolveDungeon(state: GameState): void {
  if (state.phase !== "DUNGEON") return;

  const events = stepWight(state);
  for (const text of events) log(state, { source: "system", text });

  state.round += 1;
  state.phase = "HUMAN";
  // A wight contact zeroes the coming turn; don't hand the actions straight back.
  if (state.humanActions !== 0 || events.length === 0) {
    state.humanActions = HUMAN_ACTIONS_PER_TURN;
  }
  log(state, { source: "system", text: `YOUR TURN — round ${state.round}` });
}

/** Advance whatever phase we're in. Used by the UI's "end turn" button and by tests. */
export function advance(state: GameState): void {
  if (state.phase === "HUMAN") endHumanTurn(state);
  else if (state.phase === "FAMILIAR") endFamiliarTurn(state);
  else resolveDungeon(state);
}
