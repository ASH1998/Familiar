/**
 * Binds engine tools to the browser's WebMCP surface.
 *
 * This is where "tool discovery is the progression mechanic" happens: entering a room
 * registers its tool set, leaving unregisters it. An agent watching the tool list sees the
 * dungeon's capabilities change as the human walks through it.
 *
 * The registry is maintained locally *and* mirrored into `document.modelContext`. The local
 * copy is not a mock of the WebMCP one — they are built from the same ToolDefs in the same
 * call. It exists so the game is playable and testable in browsers that have no WebMCP yet
 * (as of Aug 2026 that is most of them), and so the in-page familiar has something to drive
 * when the page is not open in ChatGPT's browser.
 */

import { globalTools } from "../engine/global.js";
import { wasted } from "../engine/score.js";
import { wardTools } from "../engine/wight.js";
import { toolsFor } from "../engine/game.js";
import type { GameState, RoomId } from "../engine/state.js";
import type { ToolDef } from "../engine/tools.js";
import {
  detectUnregisterStrategy,
  hasWebMCP,
  mc,
  unregister,
  type UnregisterStrategy,
  visitSuffix,
} from "./shim.js";

export interface RegistryOptions {
  getState: () => GameState;
  /** Called after any tool runs, so the UI can re-render. */
  onChange: () => void;
}

export interface LiveTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: object;
  readOnly: boolean;
}

let strategy: UnregisterStrategy = "none";
let roomController: AbortController | null = null;
let opts: RegistryOptions | null = null;
const visits: Partial<Record<RoomId, number>> = {};

/** name -> def, for everything currently callable. Globals never leave. */
const live = new Map<string, ToolDef>();
let roomToolNames: string[] = [];

export function activeToolNames(): string[] {
  return [...roomToolNames];
}

/** Everything the familiar can call right now. */
export function listTools(): LiveTool[] {
  return [...live.values()].map((d) => ({
    name: d.name,
    title: d.title,
    description: d.description,
    ...(d.inputSchema ? { inputSchema: d.inputSchema } : {}),
    readOnly: d.readOnly === true,
  }));
}

/**
 * Invoke a tool by name. This is the single execution path — WebMCP's `execute` callback
 * and the in-page familiar both land here, so the rules cannot diverge between drivers.
 */
export function callTool(name: string, input: Record<string, unknown>): string {
  const def = live.get(name);
  if (!def) {
    return `There is no such tool here. Available: ${[...live.keys()].join(", ")}.`;
  }
  const state = opts!.getState();
  state.toolCalls = (state.toolCalls ?? 0) + 1;
  const result = def.run(state, input ?? {});
  if (!result.ok) wasted(state);
  // Announce every successful acting call. Refusals and read-only lookups are not events —
  // banner-ing them would make the board flash constantly and mean nothing.
  if (result.ok && !def.readOnly) {
    state.lastTool = { title: def.title, seq: (state.lastTool?.seq ?? 0) + 1 };
  }
  opts!.onChange();
  return result.text;
}

/**
 * Adapt an engine ToolDef into a WebMCP tool. Thin on purpose: energy is charged by the
 * tool handlers themselves so there is one source of truth for the rule, and the result is
 * coerced to a string because Chrome documents a string return while the spec allows `any`.
 */
function toWebMCPTool(def: ToolDef, suffix: string): ModelContextTool {
  return {
    name: def.name + suffix,
    title: def.title,
    description: def.description,
    ...(def.inputSchema ? { inputSchema: def.inputSchema } : {}),
    annotations: { readOnlyHint: def.readOnly === true },
    execute: (input) => callTool(def.name + suffix, input ?? {}),
  };
}

/** Register the always-on tools. Call once at startup. */
export async function registerGlobals(options: RegistryOptions): Promise<void> {
  opts = options;
  for (const def of [...globalTools, ...wardTools]) live.set(def.name, def);

  if (!hasWebMCP()) return;
  strategy = await detectUnregisterStrategy();
  for (const def of [...globalTools, ...wardTools]) {
    try {
      await mc()!.registerTool(toWebMCPTool(def, ""));
    } catch (err) {
      console.error(`[webmcp] failed to register global ${def.name}:`, err);
    }
  }
}

/**
 * Swap the registered tool set to `room`'s. Safe to call on every transition; dropping the
 * previous set first is what keeps duplicate-name registration from throwing.
 */
export async function enterRoom(room: RoomId, options: RegistryOptions): Promise<string[]> {
  opts = options;

  for (const name of roomToolNames) live.delete(name);
  if (roomController) unregister(roomToolNames, roomController, strategy);

  const visit = (visits[room] = (visits[room] ?? 0) + 1);
  const suffix = visitSuffix(visit, strategy);
  roomController = new AbortController();
  roomToolNames = [];

  for (const def of toolsFor(room)) {
    const name = def.name + suffix;
    live.set(name, def);
    roomToolNames.push(name);

    if (hasWebMCP()) {
      try {
        await mc()!.registerTool(toWebMCPTool(def, suffix), { signal: roomController.signal });
      } catch (err) {
        // A duplicate name here means the runtime could not unregister. Surface it loudly:
        // silently losing a tool would make the room quietly unsolvable.
        console.error(`[webmcp] failed to register ${name}:`, err);
      }
    }
  }
  return [...roomToolNames];
}

/** Diagnostics for the dev overlay and the WebMCP spike. */
export function status() {
  return {
    available: hasWebMCP(),
    location: document.modelContext ? "document" : navigator.modelContext ? "navigator" : "none",
    unregisterStrategy: strategy,
    globalTools: [...globalTools, ...wardTools].map((t) => t.name),
    roomTools: [...roomToolNames],
    callable: [...live.keys()],
  };
}
