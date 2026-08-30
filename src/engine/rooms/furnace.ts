/**
 * Room 3 — The Furnace.  Design: ROOMS.md §"Room 3".
 *
 * Teaches strategic choice. The furnace supplies a fixed 6 bar split evenly between whatever
 * valves are open, so exactly one valve must be open for anything to move. Which valve drives
 * the bridge is not knowable from the valve side — only the human sees what a conduit does.
 *
 * The choice: 2 energy buys `trap_scan` + one action (safe, slower) or two actions (fast,
 * risky). A wrong valve at full pressure vents steam across the walkway and costs the
 * adventurer their next turn. Both routes finish; haste is punished, not blocked.
 */

import { type GameState, type RoomState, log, room, decor } from "../state.js";
import { type ToolDef, str } from "../tools.js";
import { misstep } from "../score.js";
import { allow, guard, refuse, spendEnergy } from "../turn.js";

const TOTAL_BAR = 6;
/** A conduit acts only at full pressure, i.e. exactly one valve open. */
const ACT_BAR = 6;
/** Above this, the vent conduit ruptures across the walkway. */
const RUPTURE_BAR = 5;

type Conduit = "bridge" | "vent" | "dead";

/** Valve -> what its conduit does at full pressure. Human-visible; never named by a tool. */
const VALVES: Record<string, { conduit: Conduit; look: string }> = {
  A: { conduit: "vent", look: "A brass valve wheel. Its pipe runs low along the walkway." },
  B: { conduit: "bridge", look: "A brass valve wheel. Its pipe runs out towards the broken span." },
  C: { conduit: "dead", look: "A brass valve wheel. Its pipe disappears into the wall." },
};

const VALVE_IDS = Object.keys(VALVES);

export function create(): RoomState {
  return {
    id: "furnace",
    title: "The Furnace",
    size: { x: 13, y: 9 },
    props: [
      ...decor([
        ["pillar", 0, 4], ["pillar", 11, 4],
        ["rock_pile", 1, 7], ["rubble", 10, 7], ["stone", 7, 7],
        ["bone_pile", 11, 3], ["skulls", 2, 3],
      ]),
      ...VALVE_IDS.map((id, i) => ({
        id: `valve_${id}`,
        sprite: "lever",
        at: { x: 2 + i * 4, y: 5 },
        flags: { valve: id, open: false },
        look: VALVES[id]!.look,
        walkable: false,
      })),
      {
        id: "bridge",
        sprite: "bridge",
        at: { x: 5, y: 2 },
        flags: { extended: false },
        look: "A broken span. A steam bridge could be driven out across it.",
        walkable: false,
      },
    ],
    patrol: [{ x: 3, y: 7 }, { x: 6, y: 7 }, { x: 9, y: 7 }, { x: 6, y: 7 }],
    solved: false,
    // `vented` marks that the walkway is currently unsafe; `known` accumulates what the
    // pair have deduced, purely so tool prose can reflect it.
    vars: { vented: false, tried: "" },
  };
}

const openValves = (s: GameState): string[] =>
  room(s)
    .props.filter((p) => p.flags["valve"] && p.flags["open"] === true)
    .map((p) => String(p.flags["valve"]));

const barPerValve = (s: GameState): number => {
  const n = openValves(s).length;
  return n === 0 ? 0 : TOTAL_BAR / n;
};

function valveProp(s: GameState, id: string) {
  return room(s).props.find((p) => p.flags["valve"] === id);
}

/**
 * Apply the physical consequence of the current valve configuration. Returns prose for the
 * familiar that describes *pressure and mechanism*, never what the human can see.
 */
function settle(s: GameState): string {
  const bar = barPerValve(s);
  const open = openValves(s);
  const r = room(s);
  r.vars["vented"] = false;

  if (open.length !== 1 || bar < ACT_BAR) {
    return (
      `Pressure divides: ${bar.toFixed(1)} bar across ${open.length} open valve(s). ` +
      "Nothing in the room has enough behind it to move. A conduit needs the full " +
      `${ACT_BAR} bar, which means exactly one valve open.`
    );
  }

  const only = open[0]!;
  const conduit = VALVES[only]!.conduit;

  if (conduit === "bridge") {
    const bridge = r.props.find((p) => p.id === "bridge")!;
    bridge.flags["extended"] = true;
    bridge.look = "The steam bridge stands out across the span, locked and solid.";
    r.solved = true;
    log(s, { source: "system", text: "The steam bridge drives out across the span." });
    return (
      `${ACT_BAR} bar behind a single conduit. It seats hard and holds. Something heavy has ` +
      "moved out across the chamber — ask the adventurer what, and whether they can cross."
    );
  }

  if (conduit === "vent") {
    r.vars["vented"] = true;
    // Cost the human their next turn. This is what makes the choice strategic.
    s.humanActions = 0;
    s.fx = { kind: "vent", seq: (s.fx?.seq ?? 0) + 1 };
    misstep(s, "steam vented across the walkway");
    log(s, { source: "system", text: "Steam blasts across the walkway." });
    return (
      `${ACT_BAR} bar behind a single conduit — and its seal fails. The pressure has dumped ` +
      "somewhere it should not. Ask the adventurer what happened and whether they are hurt; " +
      "they will need a turn to recover."
    );
  }

  return (
    `${ACT_BAR} bar behind a single conduit, and it goes nowhere — the line is capped or ` +
    "broken. Nothing moved. Ask the adventurer to confirm."
  );
}

export const tools: ToolDef[] = [
  {
    name: "pressure_inspect",
    title: "pressure.inspect",
    description:
      "Read the furnace gauges: which valves are open and how much pressure each carries. " +
      "The furnace supplies a fixed total, divided evenly between open valves. Gauges report " +
      "numbers only — what a conduit actually drives, only the adventurer can see. Free.",
    readOnly: true,
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      const bar = barPerValve(s);
      const lines = VALVE_IDS.map((id) => {
        const open = valveProp(s, id)!.flags["open"] === true;
        return `  Valve ${id}: ${open ? "open" : "closed"} — ${open ? bar.toFixed(1) : "0.0"} bar`;
      });
      return allow(
        `Furnace output: ${TOTAL_BAR} bar total, divided evenly between open valves.\n` +
          lines.join("\n") +
          `\nA conduit only acts at the full ${ACT_BAR} bar. Seals fail above ${RUPTURE_BAR} bar.`,
      );
    },
  },

  {
    name: "trap_scan",
    title: "trap.scan",
    description:
      "Scan the conduits for a seal that will fail if you bring a valve to full pressure. " +
      "Names the unsafe valve before you commit to it. Costs 1 energy — the point of this " +
      "room is whether that energy is better spent scanning or acting.",
    inputSchema: { type: "object", properties: {} },
    run(s) {
      const g = guard(s);
      if (g) return g;
      spendEnergy(s);
      const unsafe = VALVE_IDS.filter((id) => VALVES[id]!.conduit === "vent");
      log(s, { source: "tool", tool: "trap.scan", text: "The familiar scans the conduits." });
      return allow(
        `Scan complete. At ${ACT_BAR} bar the seal on valve ${unsafe.join(", ")}'s conduit ` +
          "fails and dumps its pressure into the chamber. Opening that valve alone will hurt " +
          "the adventurer. The other conduits hold.",
      );
    },
  },

  {
    name: "valve_set",
    title: "valve.set",
    description:
      "Open or close one valve (A, B or C). Pressure redivides immediately across whatever " +
      "is open. Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        valve: { type: "string", description: "Which valve: A, B or C." },
        state: { type: "string", enum: ["open", "closed"], description: "open or closed." },
      },
      required: ["valve", "state"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const id = str(input, "valve").toUpperCase().replace(/^VALVE\s+/, "");
      if (!VALVE_IDS.includes(id)) {
        return refuse(`No such valve. The furnace has ${VALVE_IDS.join(", ")}.`);
      }
      const want = str(input, "state").toLowerCase();
      if (want !== "open" && want !== "closed") {
        return refuse("State must be 'open' or 'closed'.");
      }
      const p = valveProp(s, id)!;
      const target = want === "open";
      if (p.flags["open"] === target) {
        return refuse(`Valve ${id} is already ${want}. Nothing to turn.`);
      }

      spendEnergy(s);
      p.flags["open"] = target;
      const tried = String(room(s).vars["tried"] ?? "");
      if (target && !tried.includes(id)) room(s).vars["tried"] = tried + id;
      log(s, { source: "tool", tool: "valve.set", text: `Valve ${id} ${want}.` });
      return allow(`Valve ${id} is ${want}. ` + settle(s));
    },
  },

  {
    name: "steam_redirect",
    title: "steam.redirect",
    description:
      "Drive the whole furnace output behind a single valve in one motion — closes every " +
      "other valve and opens the one you name. Equivalent to several valve.set calls. " +
      "Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        valve: { type: "string", description: "The valve to put the full output behind: A, B or C." },
      },
      required: ["valve"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const id = str(input, "valve").toUpperCase().replace(/^VALVE\s+/, "");
      if (!VALVE_IDS.includes(id)) {
        return refuse(`No such valve. The furnace has ${VALVE_IDS.join(", ")}.`);
      }
      spendEnergy(s);
      for (const vid of VALVE_IDS) valveProp(s, vid)!.flags["open"] = vid === id;
      const tried = String(room(s).vars["tried"] ?? "");
      if (!tried.includes(id)) room(s).vars["tried"] = tried + id;
      log(s, { source: "tool", tool: "steam.redirect", text: `Output redirected to valve ${id}.` });
      return allow(`The whole output now stands behind valve ${id}. ` + settle(s));
    },
  },
];
