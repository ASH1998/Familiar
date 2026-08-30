/**
 * Room 2 — The Gate Chamber.
 *
 * Three portal arches. Each has an element, a sigil the human can see carved beneath it,
 * and a colour the human can see when it ignites. The gates must be SEALED in the order
 * the archive records — by element name.
 *
 * The split:
 *   - The familiar can charge and seal gates, and can read the archive. It learns the
 *     required order (element names) and the sigil->element mapping.
 *   - The familiar CANNOT perceive which gate is which. `gate_charge` returns only that
 *     the gate is lit. No colour, no sigil, no element.
 *   - The human sees a gate blaze cyan with a wave carved beneath it, and must say so.
 *
 * Neither half is sufficient. That is the entire point of the room, and it is one careless
 * template literal away from being destroyed — hence `tests/asymmetry.test.ts`.
 */

import { type GameState, type RoomState, log, room, decor } from "../state.js";
import { familiar, forgive } from "../familiars.js";
import { misstep } from "../score.js";
import { type ToolDef, str } from "../tools.js";
import { allow, guard, refuse, spendEnergy, type ToolResult } from "../turn.js";

/** Element -> the sigil carved beneath its gate (what the human reads aloud). */
const SIGIL_OF: Record<string, string> = {
  Nature: "leaf",
  Flame: "flame",
  Ice: "wave",
};

/** The archive's required sealing order. */
const SEAL_ORDER = ["Nature", "Flame", "Ice"] as const;

/** Which gate is which. Human-visible facts (colour, sprite) live only on the props. */
const GATES: Record<string, { element: string; sprite: string; colour: string }> = {
  I: { element: "Ice", sprite: "portal_ice", colour: "cyan" },
  II: { element: "Nature", sprite: "portal_nature", colour: "green" },
  III: { element: "Flame", sprite: "portal_fire", colour: "orange" },
};

export function create(): RoomState {
  return {
    id: "gates",
    title: "The Gate Chamber",
    size: { x: 13, y: 9 },
    props: [
      ...decor([
        ["pillar", 0, 6], ["pillar", 11, 6],
        ["coffin_1", 1, 7], ["coffin_2", 11, 7],
        ["skull_1", 6, 5], ["rubble", 3, 7], ["stone", 9, 7],
      ]),
      ...Object.entries(GATES).map(([id, g], i) => ({
      id: `gate_${id}`,
      sprite: g.sprite,
      at: { x: 1 + i * 4, y: 3 },
      flags: { charged: false, sealed: false, gate: id },
      // `look` is the human's channel. It names the colour and sigil on purpose —
      // and it is never read by any tool handler below.
      look: `Gate ${id}: a dormant stone arch. A ${SIGIL_OF[g.element]} is carved beneath it.`,
      walkable: false,
      })),
    ],
    patrol: [{ x: 2, y: 6 }, { x: 5, y: 6 }, { x: 8, y: 6 }, { x: 10, y: 6 }, { x: 8, y: 6 }, { x: 5, y: 6 }],
    solved: false,
    vars: { sealed: "" },
  };
}

/** Gates sealed so far, in order, as element names. */
const sealedElements = (s: GameState): string[] => {
  const raw = String(room(s).vars["sealed"] ?? "");
  return raw ? raw.split(",") : [];
};

function gateProp(s: GameState, id: string) {
  return room(s).props.find((p) => p.flags["gate"] === id);
}

const GATE_IDS = Object.keys(GATES);

function resolveGate(s: GameState, input: Record<string, unknown>): string | ToolResult {
  const raw = str(input, "gate").toUpperCase().replace(/^GATE\s+/, "");
  if (!raw) return refuse(`Name a gate. The chamber holds ${GATE_IDS.join(", ")}.`);
  if (!GATE_IDS.includes(raw)) {
    return refuse(`No such gate here. The chamber holds ${GATE_IDS.join(", ")}.`);
  }
  return raw;
}

export const tools: ToolDef[] = [
  {
    name: "resonance_inspect",
    title: "resonance.inspect",
    description:
      "Read the resonance plinth at the centre of the Gate Chamber. Reports how many gates " +
      "are lit and how many are sealed, and the order in which the gates must be sealed. " +
      "It reports elements by name only — the plinth cannot tell you which arch is which.",
    readOnly: true,
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      const props = room(s).props.filter((p) => "charged" in p.flags);
      const lit = props.filter((p) => p.flags["charged"] && !p.flags["sealed"]).length;
      const done = sealedElements(s);
      const next = SEAL_ORDER[done.length];
      return allow(
        `The plinth hums. Gates lit: ${lit}. Gates sealed: ${done.length} of ${SEAL_ORDER.length}.\n` +
          `Required sealing order: ${SEAL_ORDER.join(" -> ")}.\n` +
          (next
            ? `Next to seal: the gate of ${next}. The plinth does not know which arch that is — ` +
              `ask the adventurer what they can see.`
            : "All gates are sealed."),
      );
    },
  },

  {
    name: "archive_lookup_sigil",
    title: "archive.lookup_sigil",
    description:
      "Look up a sigil in the dungeon archive and learn which element it marks. Pass the " +
      "sigil as the adventurer describes it, for example 'leaf', 'flame' or 'wave'.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        sigil: {
          type: "string",
          description: "The sigil as described by the adventurer, e.g. 'leaf'.",
        },
      },
      required: ["sigil"],
    },
    run(s, input) {
      const g = guard(s, true);
      if (g) return g;
      const sigil = str(input, "sigil").toLowerCase();
      if (!sigil) return refuse("Name a sigil to look up.");
      const hit = Object.entries(SIGIL_OF).find(([, v]) => v === sigil);
      if (!hit) {
        // Deliberately does not echo the query back. The agent knows what it asked, and
        // echoing untrusted input into tool prose is exactly how a leak gets in later.
        return allow(
          `The archive has no entry for that sigil. Known sigils: ${Object.values(SIGIL_OF).join(", ")}. ` +
            "Ask the adventurer to describe the carving again.",
        );
      }
      const extra = familiar(s).loremind
        ? "\nThe whole catalogue: " +
          Object.entries(SIGIL_OF).map(([e, sg]) => `${sg} = ${e}`).join(", ") + "."
        : "";
      return allow(`The archive: the ${sigil} sigil marks ${hit[0]}.${extra}`);
    },
  },

  {
    name: "gate_charge",
    title: "gate.charge",
    description:
      "Channel energy into one of the three arches (I, II or III), lighting it. You will " +
      "not perceive what manifests — you have no eyes in this chamber. Ask the adventurer " +
      "what they see. Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        gate: { type: "string", description: "Which arch: I, II or III." },
      },
      required: ["gate"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const id = resolveGate(s, input);
      if (typeof id !== "string") return id;
      const p = gateProp(s, id)!;
      if (p.flags["sealed"]) return refuse(`Gate ${id} is already sealed. It cannot be relit.`);
      if (p.flags["charged"]) {
        return refuse(`Gate ${id} is already lit. Ask the adventurer what they can see.`);
      }
      spendEnergy(s);
      p.flags["charged"] = true;
      log(s, { source: "tool", tool: "gate.charge", text: `Gate ${id} ignites.` });
      // Deliberately says nothing about colour, sigil or element.
      return allow(
        `Gate ${id} is charged. Something has manifested in the arch, but you cannot see it. ` +
          "Ask the adventurer to describe the light and the carving beneath it.",
      );
    },
  },

  {
    name: "gate_seal",
    title: "gate.seal",
    description:
      "Seal a lit arch (I, II or III). Gates must be sealed in the order the archive " +
      "records. Sealing out of order breaks the resonance and unseals every gate. Costs 1 energy.",
    inputSchema: {
      type: "object",
      properties: {
        gate: { type: "string", description: "Which arch to seal: I, II or III." },
      },
      required: ["gate"],
    },
    run(s, input) {
      const g = guard(s);
      if (g) return g;
      const id = resolveGate(s, input);
      if (typeof id !== "string") return id;
      const p = gateProp(s, id)!;
      if (p.flags["sealed"]) return refuse(`Gate ${id} is already sealed.`);
      if (!p.flags["charged"]) {
        return refuse(`Gate ${id} is dormant. Charge it before it can be sealed.`);
      }

      spendEnergy(s);
      const element = GATES[id]!.element;
      const done = sealedElements(s);
      const expected = SEAL_ORDER[done.length]!;

      if (element !== expected) {
        if (forgive(s)) {
          return allow(
            `Gate ${id} was not the gate of ${expected} — but the resonance shivers and holds. ` +
              "Nothing is undone this once. Ask the adventurer what the other arches show.",
          );
        }
        misstep(s, "the gate resonance shattered");
        // Reset: every seal fails, gates go dark.
        for (const q of room(s).props) {
          if ("charged" in q.flags) {
            q.flags["sealed"] = false;
            q.flags["charged"] = false;
          }
        }
        room(s).vars["sealed"] = "";
        log(s, { source: "tool", tool: "gate.seal", text: `Gate ${id} rejects the seal.` });
        return allow(
          `Gate ${id} was not the gate of ${expected}. The resonance shatters — every gate ` +
            "falls dark and all seals are undone. Begin again: charge a gate and ask the " +
            "adventurer what it shows.",
        );
      }

      p.flags["sealed"] = true;
      const next = [...done, element];
      room(s).vars["sealed"] = next.join(",");
      log(s, { source: "tool", tool: "gate.seal", text: `Gate ${id} sealed.` });

      if (next.length === SEAL_ORDER.length) {
        room(s).solved = true;
        log(s, { source: "system", text: "The chamber's far door grinds open." });
        return allow(
          `Gate ${id} seals. That was the last of them — ${SEAL_ORDER.join(", ")}, in order. ` +
            "The far door of the chamber grinds open. Tell the adventurer they can pass.",
        );
      }
      return allow(
        `Gate ${id} seals. That was the gate of ${element}. ` +
          `${next.length} of ${SEAL_ORDER.length} sealed. Next: the gate of ${SEAL_ORDER[next.length]}.`,
      );
    },
  },
];
