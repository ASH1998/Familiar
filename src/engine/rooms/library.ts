/**
 * Room 1 — The Clockwork Library.
 *
 * Three statues stand around a rotating bookshelf mechanism. One statue is lit at a time.
 * Beneath each is a carved mark; the archive knows which compass bearing each mark means.
 * Rotate the bookshelf to the lit statue's bearing, three times in a row, and the gate opens.
 *
 * The split:
 *   - Only the human can see *which* statue is lit and *what* is carved beneath it.
 *   - Only the familiar can read the archive (mark -> bearing) and turn the mechanism.
 *   - `statue_inspect` reports the mechanism's linkage, never the mark or the light.
 *
 * This room exists mainly to prove the headline mechanic: walking in registers four new
 * tools and walking out drops them.
 */

import { type GameState, type RoomState, log, room, decor } from "../state.js";
import { familiar, forgive } from "../familiars.js";
import { misstep } from "../score.js";
import { type ToolDef, str } from "../tools.js";
import { allow, guard, refuse, spendEnergy } from "../turn.js";

/** Carved mark -> compass bearing. The archive holds this; the human cannot read it. */
const MARK_BEARING: Record<string, string> = {
  crescent: "north",
  eye: "east",
  spiral: "west",
};

const STATUES = [
  { id: "A", mark: "crescent", sprite: "statue_1" },
  { id: "B", mark: "eye", sprite: "statue_2" },
  { id: "C", mark: "spiral", sprite: "statue_3" },
];

const BEARINGS = ["north", "east", "south", "west"];
const ROUNDS_TO_SOLVE = 3;

export function create(): RoomState {
  return {
    id: "library",
    title: "The Clockwork Library",
    size: { x: 13, y: 9 },
    props: [
      ...decor([
        ["pillar", 0, 3], ["pillar", 11, 3],
        ["pillar_fallen", 10, 6], ["rubble", 11, 7],
        ["skulls", 1, 7], ["stone", 3, 7], ["stone", 9, 2],
        ["bone_pile", 4, 2], ["rock_pile", 0, 6],
      ]),
      ...STATUES.map((s, i) => ({
        id: `statue_${s.id}`,
        sprite: s.sprite,
        at: { x: 2 + i * 4, y: 3 },
        // `lit` is set for exactly one statue at a time — human-only information, like
        // `mark`. No tool handler in this file reads either.
        flags: { statue: s.id, mark: s.mark, lit: i === 0 },
        look: `A worn statue. A ${s.mark} is carved into its plinth.`,
        walkable: false,
      })),
      {
        id: "bookshelf",
        sprite: "bookshelf",
        at: { x: 6, y: 6 },
        flags: { facing: "north" },
        look: "A tall bookshelf on a brass turntable. It faces north.",
        walkable: false,
      },
    ],
    patrol: [{ x: 1, y: 6 }, { x: 4, y: 6 }, { x: 8, y: 6 }, { x: 11, y: 6 }, { x: 8, y: 6 }, { x: 4, y: 6 }],
    solved: false,
    vars: { aligned: 0, lit: "A" },
  };
}

const litStatue = (s: GameState): string => String(room(s).vars["lit"] ?? "A");

function advanceLit(s: GameState): void {
  const order = STATUES.map((x) => x.id);
  const i = order.indexOf(litStatue(s));
  const next = order[(i + 1) % order.length]!;
  room(s).vars["lit"] = next;
  for (const p of room(s).props) {
    if (p.flags["statue"]) p.flags["lit"] = p.flags["statue"] === next;
  }
}

export const tools: ToolDef[] = [
  {
    name: "archive_search",
    title: "archive.search",
    description:
      "Search the library's archive for what a carved mark means. Pass the mark as the " +
      "adventurer describes it — for example 'crescent', 'eye' or 'spiral'. The archive " +
      "returns the compass bearing that mark stands for. Free; costs no energy.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        mark: { type: "string", description: "The carved mark, as described by the adventurer." },
      },
      required: ["mark"],
    },
    run(s, input) {
      const g = guard(s, true);
      if (g) return g;
      const mark = str(input, "mark").toLowerCase();
      if (!mark) return refuse("Name a mark to search for.");
      const bearing = MARK_BEARING[mark];
      if (!bearing) {
        return allow(
          `The archive holds no entry for that mark. Catalogued marks: ${Object.keys(MARK_BEARING).join(", ")}. ` +
            "Ask the adventurer to describe the carving again.",
        );
      }
      const extra = familiar(s).loremind
        ? "\nThe whole catalogue: " +
          Object.entries(MARK_BEARING).map(([m, b]) => `${m} = ${b}`).join(", ") + "."
        : "";
      return allow(`The archive: the ${mark} stands for ${bearing}.${extra}`);
    },
  },

  {
    name: "statue_inspect",
    title: "statue.inspect",
    description:
      "Inspect a statue's mechanism (A, B or C) — whether its linkage is engaged with the " +
      "bookshelf turntable. You cannot see the statue itself, nor which one the chamber has " +
      "lit, nor what is carved on it. Ask the adventurer for that. Free; costs no energy.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { statue: { type: "string", description: "Which statue: A, B or C." } },
      required: ["statue"],
    },
    run(s, input) {
      const g = guard(s, true);
      if (g) return g;
      const id = str(input, "statue").toUpperCase().replace(/^STATUE\s+/, "");
      if (!STATUES.some((x) => x.id === id)) {
        return refuse("No such statue here. The library holds A, B and C.");
      }
      const aligned = Number(room(s).vars["aligned"] ?? 0);
      return allow(
        `Statue ${id}: its linkage runs into the turntable and is sound. ` +
          `The mechanism has accepted ${aligned} of ${ROUNDS_TO_SOLVE} bearings so far. ` +
          "Which statue is lit, and what is carved on it, only the adventurer can tell you.",
      );
    },
  },

  {
    name: "bookshelf_rotate",
    title: "bookshelf.rotate",
    description:
      "Turn the central bookshelf to a compass bearing: north, east, south or west. If it " +
      "matches the bearing marked on the statue the chamber has lit, the mechanism accepts " +
      "it and lights the next statue. A wrong bearing resets the mechanism. Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: BEARINGS,
          description: "north, east, south or west.",
        },
      },
      required: ["direction"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const dir = str(input, "direction").toLowerCase();
      if (!BEARINGS.includes(dir)) {
        return refuse(`Not a bearing. The turntable accepts ${BEARINGS.join(", ")}.`);
      }

      spendEnergy(s);
      const shelf = room(s).props.find((p) => p.id === "bookshelf")!;
      shelf.flags["facing"] = dir;
      shelf.look = `A tall bookshelf on a brass turntable. It faces ${dir}.`;

      const lit = litStatue(s);
      const expected = MARK_BEARING[STATUES.find((x) => x.id === lit)!.mark]!;
      log(s, { source: "tool", tool: "bookshelf.rotate", text: `The bookshelf grinds to ${dir}.` });

      if (dir !== expected) {
        if (forgive(s)) {
          return allow(
            `The bookshelf turns to ${dir} and the mechanism baulks — but something small and ` +
              "contrary holds it in place. Nothing resets. Ask the adventurer again.",
          );
        }
        misstep(s, "the library mechanism reset");
        room(s).vars["aligned"] = 0;
        room(s).vars["lit"] = "A";
        for (const p of room(s).props) {
          if (p.flags["statue"]) p.flags["lit"] = p.flags["statue"] === "A";
        }
        return allow(
          `The bookshelf turns to ${dir}. Something slips — the mechanism rejects it and ` +
            "resets. The chamber lights a statue again. Ask the adventurer which one, and " +
            "what is carved on it.",
        );
      }

      const aligned = Number(room(s).vars["aligned"] ?? 0) + 1;
      room(s).vars["aligned"] = aligned;

      if (aligned >= ROUNDS_TO_SOLVE) {
        room(s).solved = true;
        log(s, { source: "system", text: "The gate behind the shelves swings wide." });
        return allow(
          `The bookshelf turns to ${dir}. The mechanism seats itself with a heavy click — ` +
            `that was ${ROUNDS_TO_SOLVE} of ${ROUNDS_TO_SOLVE}. The gate behind the shelves ` +
            "swings wide. Tell the adventurer the way is open.",
        );
      }

      advanceLit(s);
      return allow(
        `The bookshelf turns to ${dir}. The mechanism accepts it — ${aligned} of ` +
          `${ROUNDS_TO_SOLVE}. The chamber lights a different statue. Ask the adventurer ` +
          "which one is lit now, and what is carved beneath it.",
      );
    },
  },

  {
    name: "gate_inspect_lock",
    title: "gate.inspect_lock",
    description:
      "Examine the lock on the library's far gate: how many bearings the mechanism has " +
      "accepted, and how many remain. Free; costs no energy.",
    readOnly: true,
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      const aligned = Number(room(s).vars["aligned"] ?? 0);
      return allow(
        room(s).solved
          ? "The lock hangs open. The way through is clear."
          : `The lock holds. ${aligned} of ${ROUNDS_TO_SOLVE} bearings accepted. ` +
            "One statue is lit at a time; the turntable must face the bearing its mark names.",
      );
    },
  },
];
