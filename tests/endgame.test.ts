/**
 * Rooms 3 and 4 — Furnace and Familiar Chamber.
 *
 * The Furnace's asymmetry is about *effect*: gauges report bar, never what a conduit drives.
 * The Chamber's is about *presence*: the last action in the game cannot be taken by the
 * familiar at all until the human walks over, and no tool can move them.
 */

import { describe, expect, it } from "vitest";
import { createGame, toolsFor } from "../src/engine/game.js";
import { atPrison, sealTools, tools as chamberTools } from "../src/engine/rooms/chamber.js";
import { tools as furnaceTools } from "../src/engine/rooms/furnace.js";
import type { GameState } from "../src/engine/state.js";
import { endHumanTurn } from "../src/engine/turn.js";

function turn(roomId: "furnace" | "chamber"): GameState {
  const s = createGame(roomId);
  endHumanTurn(s);
  s.familiarEnergy = 99;
  return s;
}

const fTool = (n: string) => furnaceTools.find((t) => t.name === n)!;
const cTool = (n: string) => [...chamberTools, ...sealTools].find((t) => t.name === n)!;

describe("Furnace — pressure, not consequence", () => {
  it("never names what a conduit drives", () => {
    const s = turn("furnace");
    const out = fTool("pressure_inspect").run(s, {}).text;
    expect(out).not.toMatch(/bridge|walkway|span/i);
  });

  it("does nothing while pressure is divided", () => {
    // The first valve opened always takes the full 6 bar, so a divided state is only
    // reachable *after* a single-valve event. Open the dead line first, then a second valve.
    const s = turn("furnace");
    fTool("valve_set").run(s, { valve: "C", state: "open" }); // dead conduit: 6 bar, no effect
    const r = fTool("valve_set").run(s, { valve: "B", state: "open" }); // now 3.0 each
    expect(r.text).toMatch(/3\.0 bar/);
    expect(r.text).toMatch(/Nothing in the room has enough behind it/);
    expect(s.rooms.furnace.solved).toBe(false);
  });

  it("puts the full 6 bar behind whichever valve is opened first", () => {
    // This is what makes the first move a gamble, and what trap_scan is for.
    const s = turn("furnace");
    const r = fTool("valve_set").run(s, { valve: "C", state: "open" });
    expect(r.text).toMatch(/6 bar behind a single conduit/);
  });

  it("extends the bridge only with the bridge valve alone at full pressure", () => {
    const s = turn("furnace");
    fTool("steam_redirect").run(s, { valve: "B" });
    expect(s.rooms.furnace.solved).toBe(true);
  });

  it("costs the adventurer a turn when the wrong valve is driven to full pressure", () => {
    const s = turn("furnace");
    s.humanActions = 3;
    const r = fTool("steam_redirect").run(s, { valve: "A" });
    expect(r.text).toMatch(/seal fails|should not/i);
    expect(s.humanActions).toBe(0); // the strategic cost is real
    expect(s.rooms.furnace.solved).toBe(false);
  });

  it("lets trap_scan buy that mistake back, for one energy", () => {
    const s = turn("furnace");
    s.familiarEnergy = 2;
    const scan = fTool("trap_scan").run(s, {});
    expect(scan.text).toContain("A"); // names the unsafe valve before committing
    expect(s.familiarEnergy).toBe(1);
  });
});

describe("Familiar Chamber — the ending needs a human", () => {
  it("re-registers the Room 1-3 tool names alongside the binding tools", () => {
    const names = toolsFor("chamber").map((t) => t.name);
    expect(names).toContain("binding_release");
    for (const n of ["bookshelf_rotate", "gate_seal", "valve_set"]) {
      expect(names, `${n} should return in the finale`).toContain(n);
    }
  });

  it("refuses release while any seal stands", () => {
    const s = turn("chamber");
    const r = cTool("binding_release").run(s, {});
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/seal\(s\) still stand/i);
  });

  it("breaks a seal only when given the value carved on it", () => {
    const s = turn("chamber");
    expect(cTool("bookshelf_rotate").run(s, { direction: "north" }).text).toMatch(/does not answer/i);
    expect(cTool("bookshelf_rotate").run(s, { direction: "east" }).text).toMatch(/goes out/i);
  });

  it("still refuses release with every seal broken while the human is away", () => {
    const s = turn("chamber");
    cTool("bookshelf_rotate").run(s, { direction: "east" });
    cTool("gate_seal").run(s, { gate: "III" });
    cTool("valve_set").run(s, { valve: "B" });
    expect(atPrison(s)).toBe(false);

    const r = cTool("binding_release").run(s, {});
    expect(r.ok).toBe(false);
    // The refusal has to *teach*, or the ending is unreachable rather than earned.
    expect(r.text).toMatch(/adventurer must be standing at the prison/i);
    expect(s.rooms.chamber.solved).toBe(false);
  });

  it("frees the familiar once the human is at the prison", () => {
    const s = turn("chamber");
    cTool("bookshelf_rotate").run(s, { direction: "east" });
    cTool("gate_seal").run(s, { gate: "III" });
    cTool("valve_set").run(s, { valve: "B" });
    s.player = { x: 6, y: 3 }; // one tile from the prison — only the human can do this
    expect(atPrison(s)).toBe(true);

    const r = cTool("binding_release").run(s, {});
    expect(r.ok).toBe(true);
    expect(s.rooms.chamber.solved).toBe(true);
  });

  it("no tool can move the adventurer", () => {
    // If any chamber tool could reposition the player, the ending would not need a human.
    const s = turn("chamber");
    const before = { ...s.player };
    for (const t of [...chamberTools, ...sealTools]) {
      t.run(s, { direction: "east", gate: "III", valve: "B", state: "open" });
    }
    expect(s.player).toEqual(before);
  });
});
