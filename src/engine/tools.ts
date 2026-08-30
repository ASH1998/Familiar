/**
 * The engine-side tool contract.
 *
 * Rooms declare tools as plain data + a handler over GameState. Nothing here knows about
 * `document.modelContext` — `webmcp/registry.ts` adapts these into WebMCP tools, and
 * `agent/familiar.ts` reaches them through the same registry. One definition, two drivers.
 */

import type { GameState, RoomId } from "./state.js";
import type { ToolResult } from "./turn.js";

export interface ToolDef {
  /**
   * Wire name. Underscores, not dots: MCP names are conventionally
   * /^[a-zA-Z0-9_-]{1,64}$/ and dots are not worth the risk.
   */
  name: string;
  /** Dotted display form for the UI, e.g. "archive.search" — cosmetic only. */
  title: string;
  description: string;
  inputSchema?: object;
  /**
   * Read-only tools cost no energy. They are still phase-gated: letting the familiar
   * scout during the human's turn would dissolve the asymmetry the game is built on.
   */
  readOnly?: boolean;
  run(state: GameState, input: Record<string, unknown>): ToolResult;
}

/** Tool sets keyed by room, registered on entry and dropped on exit. */
export type ToolsByRoom = Record<RoomId, ToolDef[]>;

/** Narrow an untrusted agent-supplied field to a trimmed string. */
export function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}
