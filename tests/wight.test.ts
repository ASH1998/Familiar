/**
 * The wight — the dungeon's own move.
 *
 * Two things need guarding: that the DUNGEON phase actually does something, and that the
 * hazard keeps the same asymmetry as the puzzles. `wards_sense` must never leak a bearing,
 * because the bearing is the human's only contribution to dealing with it.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "../src/engine/game.js";
import type { GameState } from "../src/engine/state.js";
import { advance, endHumanTurn } from "../src/engine/turn.js";
import { bearingFrom, spawnWight, stepWight, wardTools } from "../src/engine/wight.js";

const tool = (n: string) => wardTools.find((t) => t.name === n)!;

function withWight(roomId: "library" | "gates" | "furnace" = "library"): GameState {
  const s = createGame(roomId);
  spawnWight(s);
  return s;
}

describe("the dungeon takes a turn", () => {
  it("spawns a wight in rooms that have a patrol", () => {
    expect(withWight("library").wight).toBeDefined();
    expect(withWight("gates").wight).toBeDefined();
  });

  it("has no wight in the final chamber", () => {
    const s = createGame("chamber");
    spawnWight(s);
    expect(s.wight).toBeUndefined();
  });

  it("moves the wight on the DUNGEON phase, not before", () => {
    const s = withWight();
    const start = { ...s.wight!.at };
    endHumanTurn(s); // -> FAMILIAR
    expect(s.wight!.at).toEqual(start);
    advance(s); // -> DUNGEON
    advance(s); // resolve
    expect(s.wight!.at).not.toEqual(start);
  });

  it("walks a closed loop, so both players can plan around it", () => {
    const s = withWight();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      stepWight(s);
      seen.add(`${s.wight!.at.x},${s.wight!.at.y}`);
    }
    expect(seen.size).toBeLessThanOrEqual(s.rooms.library.patrol!.length);
  });

  it("costs the adventurer their turn on contact, and does not damage them", () => {
    const s = withWight();
    s.player = { ...s.wight!.path[1]! }; // stand where it is about to step
    s.humanActions = 3;
    const lines = stepWight(s);
    expect(lines.join(" ")).toMatch(/driven back/i);
    expect(s.humanActions).toBe(0);
    // Pressure, not combat: there is no health to lose and the wight survives.
    expect(s.wight).toBeDefined();
  });

  it("does not hand actions straight back after a contact", () => {
    const s = withWight();
    s.player = { ...s.wight!.path[1]! };
    s.phase = "DUNGEON";
    advance(s);
    expect(s.humanActions).toBe(0);
    expect(s.phase).toBe("HUMAN");
  });
});

describe("the wight keeps the asymmetry", () => {
  it("wards_sense reports distance but never a bearing", () => {
    const s = withWight();
    endHumanTurn(s);
    const out = tool("wards_sense").run(s, {}).text;
    expect(out).toMatch(/pace/);
    expect(out).not.toMatch(/\b(north|south|east|west)\b/);
  });

  it("wards_bind only works with the bearing the human can see", () => {
    const s = withWight();
    endHumanTurn(s);
    s.familiarEnergy = 99;
    const right = bearingFrom(s.player, s.wight!);
    const wrong = right === "east" ? "west" : "east";

    expect(tool("wards_bind").run(s, { direction: wrong }).text).toMatch(/earths itself/i);
    expect(s.wight!.bound).toBe(0);

    expect(tool("wards_bind").run(s, { direction: right }).text).toMatch(/stops moving/i);
    expect(s.wight!.bound).toBe(2);
  });

  it("a bound wight holds still and then releases", () => {
    const s = withWight();
    s.wight!.bound = 2;
    const at = { ...s.wight!.at };
    stepWight(s);
    expect(s.wight!.at).toEqual(at);
    stepWight(s);
    expect(s.wight!.bound).toBe(0);
    stepWight(s);
    expect(s.wight!.at).not.toEqual(at);
  });
});
