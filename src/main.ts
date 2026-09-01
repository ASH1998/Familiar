/**
 * Wiring: engine <-> WebMCP registry <-> DOM.
 *
 * The human plays through the DOM; the familiar plays through WebMCP. Both mutate the
 * same GameState, and every mutation funnels back through `rerender`.
 */

import { ROOM_ORDER, createGame } from "./engine/game.js";
import { atPrison } from "./engine/rooms/chamber.js";
import { notes, score } from "./engine/score.js";
import { spawnWight } from "./engine/wight.js";
import { FAMILIARS, type FamiliarId } from "./engine/familiars.js";
import { type GameState, type RoomId, log, prop, room } from "./engine/state.js";
import { advance } from "./engine/turn.js";
import {
  activeToolNames,
  callTool,
  enterRoom,
  listTools,
  registerGlobals,
  status,
} from "./webmcp/registry.js";
import { isLegacyLocation } from "./webmcp/shim.js";
import { installAdmin } from "./ui/admin.js";
import { showEnding, showTitle } from "./ui/title.js";
import { loadSprites, paint } from "./ui/sprites.js";
import { render, type ViewHandlers } from "./ui/view.js";

let state: GameState = createGame("library");

const handlers: ViewHandlers = {
  onInspect(id) {
    if (state.phase !== "HUMAN") {
      log(state, { source: "system", text: "Not your turn." });
      return rerender();
    }
    const p = prop(state, id);
    if (!p) return;
    // Inspecting is free — the human's job is to look, and charging for it would make
    // the asymmetry feel like a tax rather than a role.
    log(state, { source: "human", text: p.look ?? `You see ${p.id}.` });
    if (p.flags["charged"] === true && p.flags["sealed"] !== true) {
      log(state, {
        source: "human",
        text: "It is blazing — you can see the light and the sigil clearly. Tell the familiar.",
      });
    }
    rerender();
  },

  onEndTurn() {
    advance(state); // HUMAN -> FAMILIAR
    rerender();
  },

  onSay(text) {
    log(state, { source: "human", text });
    rerender();
  },

  /**
   * Walk through an opened door. This is the headline mechanic: the previous room's tools
   * are unregistered and the next room's are registered, so an agent watching the tool list
   * sees the dungeon's capabilities change as the human moves.
   */
  onExit() {
    void enterNextRoom();
  },

  onMove(x, y) {
    if (state.phase !== "HUMAN") {
      log(state, { source: "system", text: "Not your turn." });
      return rerender();
    }
    if (state.humanActions <= 0) {
      log(state, { source: "system", text: "No actions left. End your turn." });
      return rerender();
    }
    const r = room(state);
    if (r.props.some((p) => p.walkable === false && p.at.x === x && p.at.y === y)) {
      log(state, { source: "system", text: "Something is in the way." });
      return rerender();
    }
    state.player = { x, y };
    state.humanActions -= 1;
    log(state, { source: "human", text: `You walk to (${x}, ${y}).` });
    if (state.currentRoom === "chamber" && atPrison(state)) {
      log(state, {
        source: "human",
        text: "You are close enough to touch the prison. Tell the familiar.",
      });
    }
    rerender();
  },
};

async function enterNextRoom(): Promise<void> {
  const i = ROOM_ORDER.indexOf(state.currentRoom);
  const next = ROOM_ORDER[i + 1];
  if (!next) {
    log(state, { source: "system", text: "There is nothing beyond this chamber. Yet." });
    return rerender();
  }
  await goToRoom(next);
}

/** Move to a room and swap the registered tool set. Used by doors and by admin mode. */
async function goToRoom(next: RoomId): Promise<void> {
  const before = activeToolNames();
  state.currentRoom = next;
  if (!state.discovered.includes(next)) state.discovered.push(next);
  state.phase = "HUMAN";
  state.player = { x: Math.floor(state.rooms[next].size.x / 2), y: state.rooms[next].size.y - 2 };
  spawnWight(state);

  const after = await enterRoom(next, registryOpts);

  log(state, { source: "system", text: state.rooms[next].title.toUpperCase() });
  log(state, {
    source: "system",
    text:
      `Capabilities changed — ${before.length} tools withdrawn, ${after.length} discovered: ` +
      after.join(", "),
  });
  rerender();
}

const registryOpts = { getState: () => state, onChange: () => rerender() };

function rerender(): void {
  // Panel head follows whichever familiar is bound. `paint` is needed rather than a plain
  // background-image: these are 4x4 sheets, so a naive `contain` would show all 16 frames.
  const f = FAMILIARS[state.familiar];
  const portrait = document.getElementById("portrait")!;
  paint(portrait, f.sprite, true);
  portrait.style.transform = `scale(${f.sprite === "familiar_fairy" || f.sprite === "familiar_imp" ? 1.6 : 0.9})`;
  document.querySelector("#panel h1")!.textContent = f.name;

  if (room(state).solved && state.currentRoom === "chamber" && !state.won) {
    log(state, { source: "system", text: "THE FAMILIAR IS FREE" });
    state.won = true;
    // Let the last tool response land before the card covers the screen.
    setTimeout(() => showEnding(score(state), notes(state), () => void restart()), 1400);
  }
  render(state, activeToolNames(), handlers);
}

function showWebMCPStatus(): void {
  const el = document.getElementById("webmcp-status")!;
  const s = status();
  if (!s.available) {
    el.className = "warn";
    el.textContent = `no webmcp · ${s.callable.length} tools`;
    return;
  }
  el.className = "ok";
  el.textContent =
    `webmcp:${s.location} · ${s.unregisterStrategy} · ` +
    `${s.globalTools.length + s.roomTools.length} tools`;
  if (isLegacyLocation()) {
    console.warn("[webmcp] using deprecated navigator.modelContext (Chromium <150 behaviour)");
  }
}

/** Rebind and start over from the title screen. */
async function restart(): Promise<void> {
  showTitle((id) => void beginRun(id));
}

/** Start a run with the chosen familiar. */
async function beginRun(id: FamiliarId): Promise<void> {
  Object.assign(state, createGame("library", id));
  await enterRoom(state.currentRoom, registryOpts);
  spawnWight(state);
  log(state, {
    source: "system",
    text: `${FAMILIARS[id].name.toUpperCase()} — ${FAMILIARS[id].epithet.toUpperCase()}`,
  });
  showWebMCPStatus();
  rerender();
}

async function boot(): Promise<void> {
  await loadSprites();


  const say = document.getElementById("say") as HTMLInputElement;
  say.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && say.value.trim()) {
      handlers.onSay(say.value.trim());
      say.value = "";
    }
  });

  // Always build the registry. When WebMCP is present it is mirrored there for the player's
  // agent; when it is absent the same tools stay callable, which keeps the game testable.
  await registerGlobals(registryOpts);
  await enterRoom(state.currentRoom, registryOpts);
  spawnWight(state);

  window.addEventListener("resize", rerender);

  installAdmin({
    getState: () => state,
    goToRoom,
    solveRoom: () => {
      room(state).solved = true;
      log(state, { source: "system", text: "[admin] room force-solved" });
    },
    reset: () => {
      const fresh = createGame(state.currentRoom);
      Object.assign(state, fresh);
      log(state, { source: "system", text: "[admin] game reset" });
    },
    rerender,
  });

  showWebMCPStatus();
  rerender();
  showTitle((id) => void beginRun(id));

  // Expose for the WebMCP spike and manual poking in DevTools.
  Object.assign(window as unknown as Record<string, unknown>, {
    df: { state, status, tools: activeToolNames, listTools, callTool, rerender },
  });
}

void boot();
