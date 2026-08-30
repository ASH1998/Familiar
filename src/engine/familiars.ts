/**
 * The four bindable familiars.
 *
 * Each carries one mechanical affinity, stated on its card the way RUNE GOBLIN states rune
 * affinities: what it *changes*, not what it is like.
 *
 * **Hard constraint on perks.** No affinity may give the familiar sight. Anything that let it
 * perceive colour, bearing, position or which statue is lit would dissolve the asymmetry the
 * whole game rests on. Perks therefore only touch tempo (energy), duration (wards),
 * forgiveness (resets) and archive depth — never perception.
 */

import type { GameState } from "./state.js";

export type FamiliarId = "beholder" | "fairy" | "imp" | "dragon";

export interface Familiar {
  id: FamiliarId;
  name: string;
  epithet: string;
  sprite: string;
  /** Short lowercase tokens, shown as its affinities. */
  tags: string[];
  /** What the affinity actually changes, mechanically. */
  affinity: string;
  /** Energy per familiar turn. */
  energy: number;
  /** How many rounds `wards_bind` holds the wight. */
  wardRounds: number;
  /** First wrong answer in each room is forgiven instead of resetting progress. */
  forgiving: boolean;
  /** Archive tools append the full catalogue rather than only the answer. */
  loremind: boolean;
}

export const FAMILIARS: Record<FamiliarId, Familiar> = {
  beholder: {
    id: "beholder",
    name: "Beholder",
    epithet: "The Watcher",
    sprite: "familiar_beholder",
    tags: ["many_eyes", "old_binding"],
    affinity: "Eye affinity: 3 energy each turn instead of 2. One more move before you must pass.",
    energy: 3,
    wardRounds: 2,
    forgiving: false,
    loremind: false,
  },
  fairy: {
    id: "fairy",
    name: "Fairy",
    epithet: "The Spark",
    sprite: "familiar_fairy",
    tags: ["thread", "ward_light"],
    affinity: "Ward affinity: bindings hold the wight for 4 rounds instead of 2. Room to work.",
    energy: 2,
    wardRounds: 4,
    forgiving: false,
    loremind: false,
  },
  imp: {
    id: "imp",
    name: "Imp",
    epithet: "The Trickster",
    sprite: "familiar_imp",
    tags: ["broken_mark", "small_teeth"],
    affinity: "Chaos affinity: the first wrong answer in each chamber is forgiven, not reset.",
    energy: 2,
    wardRounds: 2,
    forgiving: true,
    loremind: false,
  },
  dragon: {
    id: "dragon",
    name: "Faerie Dragon",
    epithet: "The Loremind",
    sprite: "familiar_dragon",
    tags: ["leaf", "long_memory"],
    affinity: "Archive affinity: lookups return the whole catalogue, not just the one entry.",
    energy: 2,
    wardRounds: 2,
    forgiving: false,
    loremind: true,
  },
};

export const FAMILIAR_ORDER: FamiliarId[] = ["beholder", "fairy", "imp", "dragon"];

export function familiar(s: GameState): Familiar {
  return FAMILIARS[s.familiar];
}

/**
 * Spend the Imp's one forgiveness for this room, if it has one left. Returns true when the
 * mistake was absorbed and the caller should skip its reset.
 */
export function forgive(s: GameState): boolean {
  if (!familiar(s).forgiving) return false;
  const key = `forgiven_${s.currentRoom}`;
  if (s.rooms[s.currentRoom].vars[key]) return false;
  s.rooms[s.currentRoom].vars[key] = true;
  return true;
}
