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

import { type GameState, log } from "./state.js";

export const TOTAL_CHAMBERS = 4;

/**
 * Rounds a well-played run takes per chamber. Six was a guess made before anyone had played;
 * play-testing put a competent chamber nearer twelve rounds, since every clue costs a
 * describe-and-answer exchange. Used only to grade pace, never to gate.
 */
const PAR_ROUNDS_PER_CHAMBER = 12;

export interface Score {
  chambers: number;
  rounds: number;
  missteps: number;
  toolCalls: number;
  wastedCalls: number;
  points: number;
  rank: string;
}

/** One plain-language line about how the run went. */
export interface Note {
  label: string;
  detail: string;
  points: number;
}

/**
 * Record a setback. Called by rooms when something the pair did actually undoes progress.
 * `delta` is announced in the log so a point change is never silent — a score that moves
 * without explanation teaches nothing.
 */
export function misstep(s: GameState, why: string): void {
  s.missteps = (s.missteps ?? 0) + 1;
  s.lastMisstep = why;
  log(s, { source: "system", text: `-${MISSTEP_COST} pts — ${why}` });
}

/** A refused call. Not a misstep, but it is a wasted exchange and worth surfacing. */
export function wasted(s: GameState): void {
  s.wastedCalls = (s.wastedCalls ?? 0) + 1;
}

export const MISSTEP_COST = 15;
const CHAMBER_POINTS = 100;
const PACE_POINTS = 5;

export function chambersCleared(s: GameState): number {
  return Object.values(s.rooms).filter((r) => r.solved).length;
}

export function score(s: GameState): Score {
  const chambers = chambersCleared(s);
  const rounds = s.round;
  const missteps = s.missteps ?? 0;
  const toolCalls = s.toolCalls ?? 0;

  const wastedCalls = s.wastedCalls ?? 0;
  const par = Math.max(1, chambers) * PAR_ROUNDS_PER_CHAMBER;
  const pace = Math.max(0, par - rounds); // positive when ahead of par

  const points = Math.max(
    0,
    chambers * CHAMBER_POINTS + pace * PACE_POINTS - missteps * MISSTEP_COST,
  );

  return {
    chambers,
    rounds,
    missteps,
    toolCalls,
    wastedCalls,
    points,
    rank: rankFor(chambers, points),
  };
}

/**
 * The post-game breakdown. Plain language, because "412 points" tells the pair nothing about
 * what they did well or badly — and the whole point of scoring here is feedback, not ranking.
 */
export function notes(s: GameState): Note[] {
  const sc = score(s);
  const out: Note[] = [];
  const par = Math.max(1, sc.chambers) * PAR_ROUNDS_PER_CHAMBER;

  out.push({
    label: "Chambers cleared",
    detail: `${sc.chambers} of ${TOTAL_CHAMBERS}`,
    points: sc.chambers * CHAMBER_POINTS,
  });

  if (sc.rounds < par) {
    out.push({
      label: "Fast puzzle solving",
      detail: `${sc.rounds} rounds against a par of ${par}`,
      points: (par - sc.rounds) * PACE_POINTS,
    });
  } else {
    out.push({
      label: "Took your time",
      detail: `${sc.rounds} rounds against a par of ${par} — no bonus`,
      points: 0,
    });
  }

  if (sc.missteps > 0) {
    out.push({
      label: sc.missteps === 1 ? "One setback" : `${sc.missteps} setbacks`,
      detail: s.lastMisstep ? `most recently, ${s.lastMisstep}` : "resets and hazards",
      points: -sc.missteps * MISSTEP_COST,
    });
  } else {
    out.push({ label: "Clean run", detail: "no resets, no hazards", points: 0 });
  }

  if (sc.wastedCalls > 0) {
    out.push({
      label: `${sc.wastedCalls} refused call${sc.wastedCalls === 1 ? "" : "s"}`,
      detail: "out of turn or out of energy — costs nothing, but wastes an exchange",
      points: 0,
    });
  }

  out.push({
    label: "Tool calls",
    detail: `${sc.toolCalls} in total`,
    points: 0,
  });

  return out;
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
