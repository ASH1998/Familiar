/**
 * Game construction and the room/tool index.
 *
 * All four rooms are implemented. Designs live in ROOMS.md.
 */

import * as chamber from "./rooms/chamber.js";
import * as furnace from "./rooms/furnace.js";
import * as gates from "./rooms/gates.js";
import * as library from "./rooms/library.js";
import { FAMILIARS, type FamiliarId } from "./familiars.js";
import {
  HUMAN_ACTIONS_PER_TURN,
  type GameState,
  type RoomId,
} from "./state.js";
import type { ToolDef } from "./tools.js";

export const ROOM_ORDER: RoomId[] = ["library", "gates", "furnace", "chamber"];

export function createGame(
  startRoom: RoomId = "gates",
  bound: FamiliarId = "beholder",
): GameState {
  return {
    familiar: bound,
    phase: "HUMAN",
    round: 1,
    currentRoom: startRoom,
    rooms: {
      library: library.create(),
      gates: gates.create(),
      furnace: furnace.create(),
      chamber: chamber.create(),
    },
    player: { x: 6, y: 7 },
    humanActions: HUMAN_ACTIONS_PER_TURN,
    familiarEnergy: FAMILIARS[bound].energy,
    discovered: [startRoom],
    log: [{ source: "system", text: "You are not alone down here." }],
    won: false,
    lastTool: undefined,
    missteps: 0,
    toolCalls: 0,
  };
}

/** Room tool sets. Registered on room entry, dropped on exit — the progression mechanic. */
export const TOOLS_BY_ROOM: Record<RoomId, ToolDef[]> = {
  library: library.tools,
  gates: gates.tools,
  furnace: furnace.tools,
  // The finale re-registers Room 1-3 tool *names* alongside the binding tools — the
  // familiar's whole vocabulary returns at once. See ROOMS.md §"Room 4".
  chamber: [...chamber.tools, ...chamber.sealTools],
};

export function toolsFor(room: RoomId): ToolDef[] {
  return TOOLS_BY_ROOM[room];
}
