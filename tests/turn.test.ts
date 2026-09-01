/**
 * Turn machine, energy scarcity, and the refusal paths.
 *
 * Refusals are the interface an external agent actually learns from, so they are tested
 * as behaviour, not treated as error handling.
 */

import { describe, expect, it } from "vitest";
import { FAMILIARS } from "../src/engine/familiars.js";
import { createGame } from "../src/engine/game.js";
import { globalTools } from "../src/engine/global.js";
import { tools as gateTools } from "../src/engine/rooms/gates.js";
import type { GameState } from "../src/engine/state.js";
import { advance, endHumanTurn } from "../src/engine/turn.js";

const tool = (name: string) =>
  [...gateTools, ...globalTools].find((t) => t.name === name)!;

const familiarTurn = (): GameState => {
  const s = createGame("gates");
  endHumanTurn(s);
  return s;
};

describe("phase machine", () => {
  it("cycles HUMAN -> FAMILIAR -> DUNGEON -> HUMAN and increments the round", () => {
    const s = createGame("gates");
    expect(s.phase).toBe("HUMAN");
    advance(s);
    expect(s.phase).toBe("FAMILIAR");
    advance(s);
    expect(s.phase).toBe("DUNGEON");
    advance(s);
    expect(s.phase).toBe("HUMAN");
    expect(s.round).toBe(2);
  });

  it("restores energy to the bound familiar's allowance, whichever it is", () => {
    for (const id of ["beholder", "fairy", "imp", "dragon"] as const) {
      const s = createGame("gates", id);
      s.familiarEnergy = 0;
      endHumanTurn(s);
      expect(s.familiarEnergy, `${id} should regain ${FAMILIARS[id].energy}`).toBe(
        FAMILIARS[id].energy,
      );
    }
  });
});

describe("refusals teach the rules", () => {
  it("refuses acting tools outside the familiar's turn, and says why", () => {
    const s = createGame("gates"); // HUMAN phase
    const r = tool("gate_charge").run(s, { gate: "I" });
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/not your turn/i);
  });

  it("refuses read-only tools outside the familiar's turn too", () => {
    // Otherwise the familiar could scout during the human's turn and the asymmetry leaks.
    const s = createGame("gates");
    expect(tool("resonance_inspect").run(s, {}).ok).toBe(false);
  });

  it("always allows get_game_state so the agent can never deadlock", () => {
    const s = createGame("gates"); // HUMAN phase
    expect(tool("get_game_state").run(s, {}).ok).toBe(true);
  });

  it("refuses when out of energy and names the recovery action", () => {
    const s = familiarTurn();
    s.familiarEnergy = 0;
    const r = tool("gate_charge").run(s, { gate: "I" });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("end_familiar_turn");
  });

  it("charges energy for acting tools but not for read-only ones", () => {
    const s = familiarTurn();
    const full = s.familiarEnergy;
    tool("resonance_inspect").run(s, {});
    expect(s.familiarEnergy).toBe(full);
    tool("gate_charge").run(s, { gate: "I" });
    expect(s.familiarEnergy).toBe(full - 1);
  });

  it("rejects an unknown gate without spending energy", () => {
    const s = familiarTurn();
    const full = s.familiarEnergy;
    const r = tool("gate_charge").run(s, { gate: "IX" });
    expect(r.ok).toBe(false);
    expect(s.familiarEnergy).toBe(full);
  });
});

describe("gate puzzle", () => {
  const charge = (s: GameState, g: string) => tool("gate_charge").run(s, { gate: g });
  const seal = (s: GameState, g: string) => tool("gate_seal").run(s, { gate: g });

  it("requires a gate to be lit before it can be sealed", () => {
    const s = familiarTurn();
    const r = seal(s, "II");
    expect(r.text).toMatch(/dormant/i);
  });

  it("resets every seal when sealed out of order", () => {
    const s = familiarTurn();
    s.familiarEnergy = 99;
    charge(s, "I");
    charge(s, "II");
    charge(s, "III");
    seal(s, "II"); // Nature — correct first
    expect(s.rooms.gates.vars["sealed"]).toBe("Nature");
    const r = seal(s, "I"); // Ice — should be Flame
    expect(r.text).toMatch(/shatters/i);
    expect(s.rooms.gates.vars["sealed"]).toBe("");
    expect(s.rooms.gates.props.every((p) => !p.flags["charged"])).toBe(true);
  });

  it("solves the room when sealed Nature -> Flame -> Ice", () => {
    const s = familiarTurn();
    s.familiarEnergy = 99;
    for (const g of ["I", "II", "III"]) charge(s, g);
    seal(s, "II"); // Nature
    seal(s, "III"); // Flame
    const last = seal(s, "I"); // Ice
    expect(s.rooms.gates.solved).toBe(true);
    expect(last.text).toMatch(/door/i);
  });

  it("is not solvable without the human: the order is by element, the gates are not labelled", () => {
    // The archive gives element names; nothing in any tool response maps element -> gate.
    const s = familiarTurn();
    s.familiarEnergy = 99;
    const plinth = tool("resonance_inspect").run(s, {}).text;
    expect(plinth).toContain("Nature");
    expect(plinth).not.toMatch(/gate (I|II|III) .*(Nature|Flame|Ice)/i);
    for (const g of ["I", "II", "III"]) {
      expect(charge(s, g).text).not.toMatch(/Nature|Flame|Ice/);
    }
  });
});

describe("the familiar can hear without ending its turn", () => {
  it("returns only what the human has said since the last listen", () => {
    const s = familiarTurn();
    expect(tool("listen").run(s, {}).text).toMatch(/nothing new/i);

    s.log.push({ source: "human", text: "Gate II is green, with a leaf beneath it." });
    const heard = tool("listen").run(s, {});
    expect(heard.text).toContain("leaf");

    // Already consumed — a second listen must not replay it.
    expect(tool("listen").run(s, {}).text).toMatch(/nothing new/i);
  });

  it("works outside the familiar's turn, so the agent is never deaf", () => {
    const s = createGame("gates"); // HUMAN phase
    s.log.push({ source: "human", text: "the left arch is burning" });
    expect(tool("listen").run(s, {}).ok).toBe(true);
  });

  it("does not report the familiar's own speech back to it", () => {
    const s = familiarTurn();
    tool("speak_to_adventurer").run(s, { message: "Which arch is lit?" });
    expect(tool("listen").run(s, {}).text).toMatch(/nothing new/i);
  });
});
