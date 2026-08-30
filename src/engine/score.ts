/**
 * Progress and scoring.
 *
 * The point is not a leaderboard — it is that both players can tell whether they are getting
 * anywhere. Without it a long room feels identical to a stuck one, and the familiar in
 * particular has no way to know whether its last three calls helped.
 *
 * So the numbers are shaped to answer two questions:
 *   "are we moving forward?"  -> chambers cleared
 *   "are we doing it well?"   -> missteps, and rounds spent
 *
 * A misstep is a real setback the pair caused: a mechanism reset, a steam vent, a wight
 * contact. Refusals are NOT missteps — refusals are how the agent learns the rules, and
 * penalising them would teach it to guess silently instead of asking.
 */

import type { GameState } from "./state.js";

export const TOTAL_CHAMBERS = 4;

/** Rounds a well-played run takes per chamber. Used only to grade pace, never to gate. */
const PAR_ROUNDS_PER_CHAMBER = 6;

export interface Score {
  chambers: number;
  rounds: number;
  missteps: number;
  toolCalls: number;
  points: number;
  rank: string;
}

/** Record a setback. Called by rooms when something the pair did actually undoes progress. */
export function misstep(s: GameState, why: string): void {
  s.missteps = (s.missteps ?? 0) + 1;
  s.lastMisstep = why;
}

export function chambersCleared(s: GameState): number {
  return Object.values(s.rooms).filter((r) => r.solved).length;
}

export function score(s: GameState): Score {
  const chambers = chambersCleared(s);
  const rounds = s.round;
  const missteps = s.missteps ?? 0;
  const toolCalls = s.toolCalls ?? 0;

  const par = Math.max(1, chambers) * PAR_ROUNDS_PER_CHAMBER;
  const pace = Math.max(0, par - rounds); // positive when ahead of par

  const points = Math.max(0, chambers * 100 + pace * 5 - missteps * 15);

  return { chambers, rounds, missteps, toolCalls, points, rank: rankFor(chambers, points) };
}

function rankFor(chambers: number, points: number): string {
  if (chambers < TOTAL_CHAMBERS) return "—";
  if (points >= 420) return "Unbound";
  if (points >= 340) return "Wardens";
  if (points >= 260) return "Company";
  return "Survivors";
}

/** One line for the HUD. */
export function progressLine(s: GameState): string {
  const sc = score(s);
  return (
    `${sc.chambers}/${TOTAL_CHAMBERS} chambers · ${sc.points} pts` +
    (sc.missteps > 0 ? ` · ${sc.missteps} misstep${sc.missteps === 1 ? "" : "s"}` : "")
  );
}
