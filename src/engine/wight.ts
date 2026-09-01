/**
 * The wight — the dungeon's own move.
 *
 * Design doc §4 Phase 3 wants the dungeon to act: *"Skeleton moves 2 tiles. Poison spreads
 * one tile."* Without it the DUNGEON phase is a counter and the turn structure has no teeth.
 *
 * This is **not** a combat system (design doc §15 scopes that out). The wight cannot be
 * killed and the adventurer has no attack. It patrols a fixed path; if it reaches the
 * adventurer it drives them back and costs them their next turn. It is pressure, not a fight.
 *
 * And it carries the same asymmetry as everything else:
 *   - The human SEES it — where it is, which way it is facing.
 *   - The familiar can only SENSE it: distance, never direction (`wards_sense`).
 *   - Binding it needs the direction, which only the human can supply (`wards_bind`).
 *
 * So the hazard is another reason to talk, rather than a reason to fight.
 */

import { type GameState, type Vec2, log, room } from "./state.js";
import { familiar } from "./familiars.js";
import { misstep } from "./score.js";
import { type ToolDef, str } from "./tools.js";
import { allow, guard, refuse, spendEnergy } from "./turn.js";

export interface Wight {
  at: Vec2;
  /** Fixed patrol loop. Deterministic, so both players can reason about it. */
  path: Vec2[];
  step: number;
  /** Rounds remaining bound in place. */
  bound: number;
}

/**
 * Expand a list of waypoints into every tile between them.
 *
 * Rooms declare a patrol as corners; without this the wight teleported 3-4 tiles per dungeon
 * turn, which made `wards_sense` actively misleading — "5 paces away" could be adjacent on the
 * next turn. A hazard the pair cannot plan around is noise, not pressure.
 */
function expand(waypoints: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const a = waypoints[i]!;
    const b = waypoints[(i + 1) % waypoints.length]!;
    out.push({ ...a });
    let cur = { ...a };
    while (cur.x !== b.x || cur.y !== b.y) {
      cur = {
        x: cur.x + Math.sign(b.x - cur.x),
        y: cur.y + Math.sign(b.y - cur.y),
      };
      if (cur.x === b.x && cur.y === b.y) break; // the next iteration pushes it as `a`
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Put a wight on this room's patrol, or clear it if the room has none. Called on entry, so
 * re-entering a chamber resets the hazard rather than leaving it wherever it was.
 */
export function spawnWight(s: GameState): void {
  const waypoints = room(s).patrol;
  if (!waypoints || waypoints.length === 0) {
    delete s.wight;
    return;
  }
  const path = expand(waypoints);
  s.wight = { at: { ...path[0]! }, path, step: 0, bound: 0 };
}

/**
 * How many dungeon turns until the wight is adjacent, walking its loop from where it stands.
 * Returns null if it never gets within reach on this circuit — which is information the pair
 * can act on, so it is worth being exact about.
 */
export function turnsUntilContact(s: GameState): number | null {
  const w = s.wight;
  if (!w) return null;
  let step = w.step;
  for (let n = 1; n <= w.path.length; n++) {
    step = (step + 1) % w.path.length;
    const at = w.path[step]!;
    if (Math.max(Math.abs(at.x - s.player.x), Math.abs(at.y - s.player.y)) <= 1) {
      return n + w.bound;
    }
  }
  return null;
}

export const DIRECTIONS = ["north", "south", "east", "west"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Chebyshev distance — the wight moves on a grid, so diagonals are one step. */
export function distanceTo(w: Wight, p: Vec2): number {
  return Math.max(Math.abs(w.at.x - p.x), Math.abs(w.at.y - p.y));
}

/** Which way the wight lies from the adventurer. Human-visible; never returned by a tool. */
export function bearingFrom(p: Vec2, w: Wight): Direction {
  const dx = w.at.x - p.x;
  const dy = w.at.y - p.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "south" : "north";
}

/**
 * The dungeon's turn. Deterministic: one step along the patrol, then a check for contact.
 * Returns log lines rather than writing them, so `resolveDungeon` owns the ordering.
 */
export function stepWight(s: GameState): string[] {
  const w = s.wight;
  if (!w) return [];
  const lines: string[] = [];

  if (w.bound > 0) {
    w.bound -= 1;
    lines.push(
      w.bound === 0
        ? "The wight shudders and the wards let go of it."
        : `The wight strains against the wards. (${w.bound} more round${w.bound === 1 ? "" : "s"})`,
    );
    return lines;
  }

  w.step = (w.step + 1) % w.path.length;
  w.at = { ...w.path[w.step]! };
  lines.push("The wight shifts a pace along its round.");

  if (distanceTo(w, s.player) <= 1) {
    // Cost, not damage. The adventurer is driven back and loses the coming turn.
    s.humanActions = 0;
    const r = room(s);
    s.player = { x: Math.floor(r.size.x / 2), y: r.size.y - 2 };
    s.fx = { kind: "hit", seq: (s.fx?.seq ?? 0) + 1 };
    misstep(s, "the wight reached the adventurer");
    lines.push("The wight reaches the adventurer — they are driven back to the entrance.");
  }
  return lines;
}

/** Tools registered for the whole session alongside the familiar's senses. */
export const wardTools: ToolDef[] = [
  {
    name: "wards_sense",
    title: "wards.sense",
    description:
      "Feel along the dungeon's ward network for anything moving in this chamber. Reports " +
      "how far it stands from the adventurer, how many dungeon turns until it reaches them, " +
      "and whether it is bound. It cannot tell you which direction — the wards carry distance, " +
      "not bearing. Ask the adventurer for that. Free; costs no energy.",
    readOnly: true,
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      const w = s.wight;
      if (!w) return allow("The ward network is quiet. Nothing is moving in this chamber.");
      const d = distanceTo(w, s.player);
      const eta = turnsUntilContact(s);
      // Distance alone was not actionable, because the thing moves. Time-to-contact is the
      // number the pair can actually plan against — and it is still not a bearing.
      const warning =
        eta === null
          ? "On its present round it does not come within reach of them."
          : eta === 1
            ? "IT REACHES THEM ON THE NEXT DUNGEON TURN."
            : `It reaches them in ${eta} dungeon turns if neither of them moves.`;
      return allow(
        `Something is moving on the wards. It stands ${d} pace${d === 1 ? "" : "s"} from the ` +
          `adventurer.${w.bound > 0 ? ` It is bound for ${w.bound} more round(s).` : ""}\n` +
          `${warning}\n` +
          "The wards carry no bearing — ask the adventurer which way it lies from them.",
      );
    },
  },

  {
    name: "wards_bind",
    title: "wards.bind",
    description:
      "Throw a binding ward in one direction from the adventurer: north, south, east or " +
      "west. If the thing on the wards lies that way, it is held for two rounds. Get the " +
      "direction wrong and the ward earths itself harmlessly. Only the adventurer can see " +
      "which way it lies. Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: [...DIRECTIONS],
          description: "Direction from the adventurer: north, south, east or west.",
        },
      },
      required: ["direction"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const dir = str(input, "direction").toLowerCase();
      if (!DIRECTIONS.includes(dir as Direction)) {
        return refuse(`Not a direction. The wards take ${DIRECTIONS.join(", ")}.`);
      }
      const w = s.wight;
      if (!w) return refuse("There is nothing on the wards in this chamber to bind.");

      spendEnergy(s);
      if (bearingFrom(s.player, w) !== dir) {
        log(s, { source: "tool", tool: "wards.bind", text: `A ward earths itself to the ${dir}.` });
        return allow(
          `The ward goes out to the ${dir} and earths itself against nothing. Either the ` +
            "adventurer read the bearing wrong or it has moved. Ask them again.",
        );
      }

      w.bound = familiar(s).wardRounds;
      log(s, { source: "tool", tool: "wards.bind", text: "The wight is bound." });
      return allow(
        `The ward closes to the ${dir} and something heavy stops moving. It is held for ` +
          `${w.bound} rounds. Tell the adventurer they have room to work.`,
      );
    },
  },
];
