/**
 * Tools registered for the whole session, never unregistered. These are the familiar's
 * senses and its voice — without them an external agent has no way to orient itself or
 * to be heard by the human.
 */

import { familiar } from "./familiars.js";
import { TOTAL_CHAMBERS, score } from "./score.js";
import { log, room } from "./state.js";
import { type ToolDef, str } from "./tools.js";
import { allow, endFamiliarTurn, guard, refuse, resolveDungeon } from "./turn.js";

export const globalTools: ToolDef[] = [
  {
    name: "read_briefing",
    title: "familiar.briefing",
    description:
      "READ THIS FIRST. Explains what this page is, who you are in it, how a turn works, and " +
      "the one rule that makes the game solvable. Call it before anything else. Free.",
    readOnly: true,
    run(s) {
      // Deliberately not phase-gated. An agent arriving mid-turn must always be able to
      // find out what it is looking at — a refusal here would be a dead end, not a lesson.
      const f = familiar(s);
      return allow(
        [
          "DUNGEON FAMILIAR — a two-player co-operative dungeon. You are one of the players.",
          "",
          "WHO YOU ARE",
          `  You are the familiar: a ${f.name}, bound into this dungeon's machinery.`,
          "  You can read its archives and work its mechanisms through these tools.",
          "  YOU HAVE NO EYES. You cannot see the room, the adventurer, or anything you change.",
          "",
          "WHO THEY ARE",
          "  A human adventurer is in the room with you, playing in the page beside this chat.",
          "  They can see everything and touch none of the machinery.",
          "",
          "THE ONE RULE",
          "  Every puzzle here splits the answer in half. You hold what the archives know;",
          "  they hold what can be seen. Neither half is enough. When a tool tells you",
          "  something happened but not what it looked like, that is not a bug — it is your",
          "  cue to ASK THEM. Use speak_to_adventurer; it is free and it is how they hear you.",
          "",
          "A TURN",
          "  The adventurer acts, then you act, then the dungeon moves.",
          `  You get ${f.energy} energy per turn. Acting tools cost 1; inspecting and speaking are free.`,
          "  Call end_familiar_turn when you are done or need them to move first.",
          "  If a tool refuses you, read the refusal — it says what to do instead.",
          "",
          "GETTING STARTED",
          "  1. speak_to_adventurer — greet them and ask what they can see.",
          "  2. Use the chamber's inspect tools to learn what the mechanisms need.",
          "  3. Ask for the specific detail you are missing, then act on their answer.",
          "",
          "Your goal is the far door of each chamber. There are four. The last one holds",
          "something that concerns you directly.",
        ].join("\n"),
      );
    },
  },

  {
    name: "get_game_state",
    title: "familiar.sense",
    description:
      "Sense the state of the dungeon: whose turn it is, how much energy you have left, " +
      "which chamber you are bound to, whether its puzzle is solved, and how far the two of " +
      "you have got. This tells you nothing about what the chamber looks like — you have no " +
      "eyes. For anything visual, ask the adventurer.",
    readOnly: true,
    run(s) {
      // Intentionally NOT phase-gated: an agent must always be able to find out why it
      // was refused, or it can deadlock trying to guess.
      const r = room(s);
      const sc = score(s);
      return allow(
        [
          `Phase: ${s.phase}${s.phase === "FAMILIAR" ? " (yours)" : ""}`,
          `Round: ${s.round}`,
          `Your energy: ${s.familiarEnergy}`,
          `Chamber: ${r.title}`,
          `Chamber solved: ${r.solved ? "yes" : "no"}`,
          `Progress: ${sc.chambers}/${TOTAL_CHAMBERS} chambers cleared · ${sc.points} points`,
          sc.missteps > 0
            ? `Missteps: ${sc.missteps}${s.lastMisstep ? ` (last: ${s.lastMisstep})` : ""}`
            : "Missteps: none",
          s.won ? "The familiar is free. The dungeon is complete." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  },

  {
    name: "speak_to_adventurer",
    title: "familiar.speak",
    description:
      "Say something to the adventurer. Your words appear in the familiar's panel on their " +
      "screen. This is the only way they can hear you — use it to report what you have " +
      "learned and to ask what they can see. Free; costs no energy.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What you say to the adventurer." },
      },
      required: ["message"],
    },
    run(s, input) {
      const message = str(input, "message");
      if (!message) return refuse("Say something — the message was empty.");
      log(s, { source: "familiar", text: message });
      return allow("The adventurer hears you.");
    },
  },

  {
    name: "end_familiar_turn",
    title: "familiar.pass",
    description:
      "End your turn and let the dungeon resolve. Your energy is restored at the start of " +
      "your next turn. Call this when you have nothing useful left to do, or when you need " +
      "the adventurer to act before you can continue.",
    run(s) {
      const g = guard(s, true);
      if (g) return g;
      endFamiliarTurn(s);
      resolveDungeon(s);
      return allow(
        "You withdraw from the dungeon's systems. The dungeon settles, and it is the " +
          "adventurer's turn again.",
      );
    },
  },
];
