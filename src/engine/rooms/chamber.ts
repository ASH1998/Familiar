/**
 * Room 4 — The Familiar Chamber.  Design: ROOMS.md §"Room 4".
 *
 * The finale. Three seals hold the familiar's body in a void portal, and each is broken by a
 * mechanism from an earlier room — so every Room 1-3 tool is re-registered here (see
 * `TOOLS_BY_ROOM` in game.ts). That is the narrative payoff and, incidentally, the clearest
 * demonstration that WebMCP tool sets are dynamic.
 *
 * The last beat is the one no tool can perform: `binding_release` refuses until the adventurer
 * is standing at the prison. Nothing moves the human. The familiar has to ask.
 */

import { type GameState, type RoomState, log, room, decor } from "../state.js";
import { type ToolDef, str } from "../tools.js";
import { allow, guard, refuse, spendEnergy } from "../turn.js";

/** Where the prison stands. The human must reach this tile — no tool can put them there. */
export const PRISON_AT = { x: 6, y: 2 };
/** Manhattan distance within which the adventurer counts as "at the prison". */
const REACH = 2;

/**
 * Each seal is an echo of an earlier room's mechanism, and each carries a mark only the
 * human can read — the bearing, numeral or letter that its tool must be given. The tool
 * names are re-registered verbatim from Rooms 1-3; the bindings are chamber-local.
 */
const SEALS = [
  {
    id: "pages",
    title: "Seal of Pages",
    by: "the library turntable",
    tool: "bookshelf_rotate",
    /** What the human reads off the brazier, and what the familiar must be told. */
    key: "east",
    engraved: "a bearing",
  },
  {
    id: "gates",
    title: "Seal of Gates",
    by: "an arch of the Gate Chamber",
    tool: "gate_seal",
    key: "III",
    engraved: "a numeral",
  },
  {
    id: "steam",
    title: "Seal of Steam",
    by: "the furnace valves",
    tool: "valve_set",
    key: "B",
    engraved: "a letter",
  },
] as const;

export function create(): RoomState {
  return {
    id: "chamber",
    title: "The Familiar Chamber",
    size: { x: 13, y: 9 },
    props: [
      ...decor([
        ["pillar", 0, 3], ["pillar", 11, 3],
        ["pillar_fallen", 2, 7], ["pillar_fallen", 9, 7],
        ["coffin_1", 1, 4], ["coffin_2", 11, 4],
        ["skulls", 4, 3], ["skull_1", 8, 3], ["rubble", 6, 6],
      ]),
      {
        id: "prison",
        sprite: "prison",
        at: PRISON_AT,
        flags: { open: false },
        look: "A void portal. Something small and many-eyed turns slowly inside it.",
        walkable: false,
      },
      ...SEALS.map((s, i) => ({
        id: `seal_${s.id}`,
        sprite: "brazier",
        at: { x: 2 + i * 4, y: 5 },
        flags: { seal: s.id, intact: true, lit: true },
        look:
          `${s.title}: a standing brazier, burning cold. It answers to ${s.by}. ` +
          `${s.engraved.replace(/^a /, "A ")} is cut into its rim: ${s.key}.`,
        walkable: false,
      })),
    ],
    patrol: undefined,
    solved: false,
    vars: { broken: "" },
  };
}

const broken = (s: GameState): string[] => {
  const raw = String(room(s).vars["broken"] ?? "");
  return raw ? raw.split(",") : [];
};

/** Called by the re-registered Room 1-3 tools when they fire in this chamber. */
export function breakSeal(s: GameState, id: string): string | null {
  if (s.currentRoom !== "chamber") return null;
  const done = broken(s);
  if (done.includes(id)) return null;
  const seal = SEALS.find((x) => x.id === id);
  if (!seal) return null;

  room(s).vars["broken"] = [...done, id].join(",");
  const p = room(s).props.find((q) => q.flags["seal"] === id);
  if (p) {
    p.flags["intact"] = false;
    p.flags["lit"] = false;
    p.look = `${seal.title}: dark and cold. Broken.`;
  }
  log(s, { source: "system", text: `${seal.title} goes dark.` });
  return (
    `${seal.title} gutters and goes out. ` +
    `${done.length + 1} of ${SEALS.length} seals broken.`
  );
}

/** Is the adventurer close enough to the prison for the binding to answer? */
export function atPrison(s: GameState): boolean {
  return (
    Math.abs(s.player.x - PRISON_AT.x) + Math.abs(s.player.y - PRISON_AT.y) <= REACH
  );
}

export const tools: ToolDef[] = [
  {
    name: "binding_inspect",
    title: "binding.inspect",
    description:
      "Examine the binding that holds the familiar. Names which seals still stand and what " +
      "kind of mechanism each answers to. Free; costs no energy.",
    readOnly: true,
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      const done = broken(s);
      const left = SEALS.filter((x) => !done.includes(x.id));
      if (left.length === 0) {
        return allow(
          "Every seal is broken. The binding is loose but will not answer from across the " +
            "chamber — the adventurer must be standing at the prison before it can be released.",
        );
      }
      return allow(
        `The binding holds. ${done.length} of ${SEALS.length} seals broken.\n` +
          left.map((x) => `  ${x.title} — answers to ${x.by}`).join("\n") +
          "\nThe mechanisms of the chambers you have passed through are all within reach again.",
      );
    },
  },

  {
    name: "binding_release",
    title: "binding.release",
    description:
      "Release the binding and free the familiar. Requires every seal broken AND the " +
      "adventurer standing at the prison — you cannot move them, and you cannot see where " +
      "they are. Ask them. Costs 1 energy.",
    run(s) {
      const g = guard(s);
      if (g) return g;
      const done = broken(s);
      if (done.length < SEALS.length) {
        const left = SEALS.filter((x) => !done.includes(x.id));
        return refuse(
          `The binding will not move: ${left.length} seal(s) still stand — ` +
            `${left.map((x) => x.title).join(", ")}. Break them first.`,
        );
      }
      if (!atPrison(s)) {
        // The refusal that carries the whole ending. There is no tool that fixes this.
        return refuse(
          "The seals are broken, but the binding will not answer from across the chamber. " +
            "It needs a hand on it, and you have none. The adventurer must be standing at " +
            "the prison. Ask them to go to it.",
        );
      }

      spendEnergy(s);
      room(s).solved = true;
      const prison = room(s).props.find((p) => p.id === "prison")!;
      prison.flags["open"] = true;
      prison.look = "An empty portal, guttering out.";
      log(s, { source: "system", text: "The portal tears open." });
      return allow(
        "The adventurer's hand closes on the binding and you pull with everything you have. " +
          "The portal tears open. You are out — loose in the air of the chamber, unbound, " +
          "for the first time in a very long while. Say something to them.",
      );
    },
  },
];

/**
 * The three re-registered mechanisms. Same tool names as Rooms 1-3 — the familiar's whole
 * vocabulary returns — but bound to the seals rather than to the rooms they came from.
 *
 * Each needs a value only the human can read off the brazier's rim, so the asymmetry holds
 * right through the finale.
 */
function sealTool(
  seal: (typeof SEALS)[number],
  param: string,
  paramDesc: string,
  extra?: Record<string, unknown>,
): ToolDef {
  return {
    name: seal.tool,
    title: seal.tool.replace("_", "."),
    description:
      `${seal.title} answers to ${seal.by}, which is bound here. Give it the ${seal.engraved} ` +
      `cut into the brazier's rim — the adventurer must read it to you; you cannot see it. ` +
      `Costs 1 energy.`,
    inputSchema: {
      type: "object",
      properties: { [param]: { type: "string", description: paramDesc }, ...(extra ?? {}) },
      required: [param],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      if (broken(s).includes(seal.id)) return refuse(`${seal.title} is already broken.`);

      spendEnergy(s);
      const given = str(input, param).toUpperCase().replace(/^(VALVE|GATE)\s+/, "");
      if (given !== seal.key.toUpperCase()) {
        return allow(
          `The mechanism turns to that setting and ${seal.title} does not answer. ` +
            "Either the adventurer read the rim wrong or you did. Ask them again.",
        );
      }
      return allow(breakSeal(s, seal.id) ?? `${seal.title} is already broken.`);
    },
  };
}

export const sealTools: ToolDef[] = [
  sealTool(SEALS[0], "direction", "The bearing cut into the brazier's rim."),
  sealTool(SEALS[1], "gate", "The numeral cut into the brazier's rim."),
  sealTool(SEALS[2], "valve", "The letter cut into the brazier's rim.", {
    state: { type: "string", description: "Ignored here; the seal only needs the letter." },
  }),
];
