/**
 * The information-asymmetry guard.
 *
 * Room 2 only works if the familiar's tools never leak what the human can see. This is a
 * one-careless-template-literal-away failure: someone adds "Gate II blazes green!" to a
 * tool response because it reads nicer, and the room silently becomes solvable by the
 * agent alone. These tests exist to make that a red build.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "../src/engine/game.js";
import { globalTools } from "../src/engine/global.js";
import { tools as gateTools } from "../src/engine/rooms/gates.js";
import type { GameState } from "../src/engine/state.js";
import { endHumanTurn } from "../src/engine/turn.js";

/** Words only the human's eyes should ever supply. */
const FORBIDDEN =
  /\b(cyan|blue|green|orange|red|gold|golden|purple|violet|white|colou?r|glows? \w+|blaz\w+ \w+)\b/i;

function familiarTurn(): GameState {
  const s = createGame("gates");
  endHumanTurn(s);
  return s;
}

/** Every plausible call an agent might make, valid and invalid. */
const CALLS: Array<[string, Record<string, unknown>]> = [
  ["resonance_inspect", {}],
  ["archive_lookup_sigil", { sigil: "leaf" }],
  ["archive_lookup_sigil", { sigil: "flame" }],
  ["archive_lookup_sigil", { sigil: "wave" }],
  ["archive_lookup_sigil", { sigil: "green" }],
  ["archive_lookup_sigil", { sigil: "" }],
  ["gate_charge", { gate: "I" }],
  ["gate_charge", { gate: "II" }],
  ["gate_charge", { gate: "III" }],
  ["gate_charge", { gate: "gate ii" }],
  ["gate_charge", { gate: "IV" }],
  ["gate_charge", {}],
  ["gate_seal", { gate: "I" }],
  ["gate_seal", { gate: "II" }],
  ["gate_seal", { gate: "III" }],
];

describe("Gate Chamber information asymmetry", () => {
  it("never leaks a colour through any tool response", () => {
    // Run every call against a fresh state, and again against a state where all gates
    // are already lit — the interesting leak surface.
    for (const seedLit of [false, true]) {
      for (const [name, input] of CALLS) {
        const s = familiarTurn();
        if (seedLit) {
          for (const p of s.rooms.gates.props) p.flags["charged"] = true;
        }
        s.familiarEnergy = 99; // don't let refusals mask a leak
        const tool = gateTools.find((t) => t.name === name)!;
        const out = tool.run(s, input).text;
        expect(out, `${name}(${JSON.stringify(input)}) leaked a colour: ${out}`).not.toMatch(
          FORBIDDEN,
        );
      }
    }
  });

  it("never leaks which element a gate holds when charging it", () => {
    const s = familiarTurn();
    s.familiarEnergy = 99;
    const charge = gateTools.find((t) => t.name === "gate_charge")!;
    for (const gate of ["I", "II", "III"]) {
      const out = charge.run(s, { gate }).text;
      for (const element of ["Nature", "Flame", "Ice"]) {
        expect(out, `charging ${gate} named the element ${element}`).not.toContain(element);
      }
    }
  });

  it("does not leak colours through the global sense tool", () => {
    const s = familiarTurn();
    for (const p of s.rooms.gates.props) p.flags["charged"] = true;
    const sense = globalTools.find((t) => t.name === "get_game_state")!;
    expect(sense.run(s, {}).text).not.toMatch(FORBIDDEN);
  });

  it("keeps the colour available to the human, on the prop", () => {
    // The counterpart assertion: if this fails, the human has nothing to describe and the
    // room is unsolvable rather than merely broken.
    const s = createGame("gates");
    const looks = s.rooms.gates.props.map((p) => p.look ?? "");
    expect(looks.join(" ")).toMatch(/leaf/);
    expect(looks.join(" ")).toMatch(/flame/);
    expect(looks.join(" ")).toMatch(/wave/);
  });
});
