/**
 * Core game state. Pure data — this module imports nothing.
 *
 * Invariant enforced across the whole engine: state that only the *human* can perceive
 * (colours, sprites, spatial arrangement) is never returned by a familiar tool. See
 * `rooms/gates.ts` for the sharpest case, and `tests/asymmetry.test.ts` for the guard.
 */

export type RoomId = "library" | "gates" | "furnace" | "chamber";

export type Phase = "HUMAN" | "FAMILIAR" | "DUNGEON";

/** A grid position, in tiles. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Something the human can see and interact with in the room. The familiar never
 * receives these objects — only whatever prose a specific tool chooses to reveal.
 */
export interface Prop {
  id: string;
  /** Sprite key, resolved against the sprite manifest in ui/sprites.ts. */
  sprite: string;
  at: Vec2;
  /** Free-form per-room state: { charged: true }, { facing: "north" }, ... */
  flags: Record<string, string | number | boolean>;
  /** Shown to the human on inspect. Never sent to the familiar. */
  look?: string;
  /** Human can walk onto this tile. */
  walkable?: boolean;
}

export interface RoomState {
  id: RoomId;
  title: string;
  /** Patrol loop for this room's wight, if it has one. */
  patrol?: Vec2[];
  /** Tile grid dimensions. */
  size: Vec2;
  props: Prop[];
  /** Set once the room's puzzle is solved; unlocks the exit. */
  solved: boolean;
  /** Per-room scratch state (charge order, valve settings, ...). */
  vars: Record<string, string | number | boolean>;
}

export interface LogEntry {
  /** Who produced this line. */
  source: "system" | "human" | "familiar" | "tool";
  text: string;
  /** For tool entries: the tool name, for the panel's display. */
  tool?: string;
}

export interface GameState {
  phase: Phase;
  /** Which familiar the player bound at the title screen. */
  familiar: import("./familiars.js").FamiliarId;
  /** The dungeon's own piece. Present only in rooms that have one. */
  wight?: import("./wight.js").Wight;
  /** Increments on each full HUMAN -> FAMILIAR -> DUNGEON cycle. */
  round: number;
  currentRoom: RoomId;
  rooms: Record<RoomId, RoomState>;
  /** Where the adventurer is standing. */
  player: Vec2;
  humanActions: number;
  familiarEnergy: number;
  /** Rooms whose tool sets have been registered at least once — drives the spellbook tabs. */
  discovered: RoomId[];
  log: LogEntry[];
  /** True once the familiar is freed. */
  won: boolean;
  /**
   * The most recent tool the familiar fired. `seq` increments on every call so the view can
   * tell a repeat from a re-render — design doc §10 wants tool calls to visibly announce
   * themselves, not just quietly change the board.
   */
  lastTool?: { title: string; seq: number };
  /** Setbacks the pair caused (resets, vents, wight contacts). Refusals are NOT missteps. */
  missteps?: number;
  lastMisstep?: string;
  /** Total tool calls, for the end-of-run summary. */
  toolCalls?: number;
  /** Transient visual event for the renderer. `seq` increments so repeats replay. */
  fx?: { kind: "hit" | "vent"; seq: number };
}

/**
 * Set dressing. Non-interactive, no flags, no tools — these exist so the chamber reads as a
 * place rather than as three props on a floor. `walkable: false` still blocks movement, so
 * they shape the route the adventurer has to take past the wight.
 */
export function decor(items: Array<[string, number, number, string?]>): Prop[] {
  return items.map(([sprite, x, y, look], i) => ({
    id: `decor_${sprite}_${i}`,
    sprite,
    at: { x, y },
    flags: {},
    look: look ?? "Old stone and older bones.",
    walkable: false,
  }));
}

export const HUMAN_ACTIONS_PER_TURN = 3;
export const FAMILIAR_ENERGY_PER_TURN = 2;

export function room(state: GameState): RoomState {
  return state.rooms[state.currentRoom];
}

export function prop(state: GameState, id: string): Prop | undefined {
  return room(state).props.find((p) => p.id === id);
}

export function log(state: GameState, entry: LogEntry): void {
  state.log.push(entry);
  // The panel only ever renders the tail; keep memory bounded on long sessions.
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
