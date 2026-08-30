/**
 * Room 1 — The Clockwork Library.
 *
 * Same asymmetry contract as the Gate Chamber: the familiar may never learn which statue is
 * lit or what is carved on it. Here the leak surface is different — bearings and marks
 * rather than colours — so it needs its own guard.
 */

import { describe, expect, it } from "vitest";
import { createGame, toolsFor } from "../src/engine/game.js";
import { tools as libTools } from "../src/engine/rooms/library.js";
import type { GameState } from "../src/engine/state.js";
import { endHumanTurn } from "../src/engine/turn.js";

const tool = (name: string) => libTools.find((t) => t.name === name)!;

function familiarTurn(): GameState {
  const s = createGame("library");
  endHumanTurn(s);
  s.familiarEnergy = 99;
  return s;
}

/** Which statue is lit, read the way only the human could. */
const litId = (s: GameState) =>
  s.rooms.library.props.find((p) => p.flags["lit"] === true)!.flags["statue"];

const markOf = (s: GameState, id: unknown) =>
  String(s.rooms.library.props.find((p) => p.flags["statue"] === id)!.flags["mark"]);

const BEARING: Record<string, string> = { crescent: "north", eye: "east", spiral: "west" };

describe("Clockwork Library asymmetry", () => {
  it("never reveals which statue is lit, or what is carved on it", () => {
    const s = familiarTurn();
    const calls: Array<[string, Record<string, unknown>]> = [
      ["statue_inspect", { statue: "A" }],
      ["statue_inspect", { statue: "B" }],
      ["statue_inspect", { statue: "C" }],
      ["statue_inspect", { statue: "Z" }],
      ["gate_inspect_lock", {}],
    ];
    // The leak shape is a statue id sitting next to "lit" in the same sentence — e.g.
    // "Statue B is lit" or "the lit statue is B". A bare "A"/"a" elsewhere is just English.
    const REVEALS_LIT = /(statue\s+[ABC]\b[^.]*\blit\b)|(\blit\b[^.]*\bstatue\s+[ABC]\b)/i;
    for (const [name, input] of calls) {
      const out = tool(name).run(s, input).text;
      expect(out, `${name} named a mark`).not.toMatch(/crescent|eye|spiral/i);
      expect(out, `${name} revealed the lit statue`).not.toMatch(REVEALS_LIT);
    }
  });

  it("gives the mark -> bearing mapping only through the archive", () => {
    const s = familiarTurn();
    // The familiar can translate a mark it has been *told*, but nothing tells it the mark.
    expect(tool("archive_search").run(s, { mark: "crescent" }).text).toContain("north");
    expect(tool("archive_search").run(s, { mark: "eye" }).text).toContain("east");
    expect(tool("archive_search").run(s, { mark: "spiral" }).text).toContain("west");
  });

  it("does not echo an unknown mark back into the response", () => {
    const s = familiarTurn();
    const out = tool("archive_search").run(s, { mark: "zzz-injected" }).text;
    expect(out).not.toContain("zzz-injected");
  });
});

describe("Clockwork Library puzzle", () => {
  const rotate = (s: GameState, d: string) => tool("bookshelf_rotate").run(s, { direction: d });

  it("accepts the bearing named by the lit statue's mark and advances", () => {
    const s = familiarTurn();
    const expected = BEARING[markOf(s, litId(s))]!;
    const r = rotate(s, expected);
    expect(r.text).toMatch(/accepts it/i);
    expect(s.rooms.library.vars["aligned"]).toBe(1);
  });

  it("resets the mechanism on a wrong bearing", () => {
    const s = familiarTurn();
    rotate(s, BEARING[markOf(s, litId(s))]!);
    expect(s.rooms.library.vars["aligned"]).toBe(1);
    // "south" is never a correct answer — no mark maps to it.
    const r = rotate(s, "south");
    expect(r.text).toMatch(/rejects|resets/i);
    expect(s.rooms.library.vars["aligned"]).toBe(0);
  });

  it("opens the gate after three correct bearings in a row", () => {
    const s = familiarTurn();
    for (let i = 0; i < 3; i++) rotate(s, BEARING[markOf(s, litId(s))]!);
    expect(s.rooms.library.solved).toBe(true);
  });

  it("rejects a non-bearing without spending energy", () => {
    const s = familiarTurn();
    s.familiarEnergy = 2;
    expect(rotate(s, "up").ok).toBe(false);
    expect(s.familiarEnergy).toBe(2);
  });
});

describe("tool sets are per-room", () => {
  it("registers a different set for each implemented room", () => {
    const lib = toolsFor("library").map((t) => t.name);
    const gates = toolsFor("gates").map((t) => t.name);
    expect(lib).toContain("bookshelf_rotate");
    expect(gates).toContain("gate_charge");
    // No overlap — walking between rooms genuinely changes what the familiar can do.
    expect(lib.filter((n) => gates.includes(n))).toEqual([]);
  });
});
