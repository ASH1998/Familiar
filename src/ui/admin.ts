/**
 * Demo/admin mode — toggled with **Shift + L + A**.
 *
 * Rooms are normally gated behind solving the previous one, which is right for play and
 * useless when showing someone Room 4 in a hurry. This panel jumps to any room, refills
 * energy, force-solves, and resets.
 *
 * Deliberately not hidden behind a build flag: the point is to demo the game on a laptop
 * that is already running the production build.
 */

import type { GameState, RoomId } from "../engine/state.js";
import { ROOM_ORDER } from "../engine/game.js";

export interface AdminHooks {
  getState: () => GameState;
  goToRoom: (room: RoomId) => Promise<void>;
  solveRoom: () => void;
  reset: () => void;
  rerender: () => void;
}

const CHORD = ["l", "a"];

/**
 * Listen for the chord. Shift must be held, and `l` then `a` pressed in order with nothing
 * else in between — loose enough to hit reliably in front of an audience, tight enough not
 * to fire while typing in the "describe what you see" box.
 */
export function installAdmin(hooks: AdminHooks): void {
  let progress = 0;
  let panel: HTMLElement | null = null;

  window.addEventListener("keydown", (e) => {
    // Never swallow keystrokes meant for the message input.
    if (e.target instanceof HTMLInputElement) return;
    if (!e.shiftKey) {
      progress = 0;
      return;
    }
    const key = e.key.toLowerCase();
    if (key === CHORD[progress]) {
      progress += 1;
      if (progress === CHORD.length) {
        progress = 0;
        panel ? close() : open();
      }
    } else if (key !== "shift") {
      progress = 0;
    }
  });

  function close(): void {
    panel?.remove();
    panel = null;
  }

  function open(): void {
    panel = document.createElement("div");
    panel.id = "admin";
    render();
    document.body.appendChild(panel);
  }

  function render(): void {
    if (!panel) return;
    const s = hooks.getState();
    panel.innerHTML = "";

    const head = document.createElement("header");
    head.innerHTML = `<strong>ADMIN</strong> <span>shift+L+A to close</span>`;
    panel.appendChild(head);

    const rooms = document.createElement("div");
    rooms.className = "admin-row";
    for (const id of ROOM_ORDER) {
      const b = document.createElement("button");
      b.textContent = s.rooms[id].title.replace(/^The /, "");
      if (id === s.currentRoom) b.className = "on";
      b.onclick = async () => {
        await hooks.goToRoom(id);
        render();
      };
      rooms.appendChild(b);
    }
    panel.appendChild(rooms);

    const acts = document.createElement("div");
    acts.className = "admin-row";
    const add = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => {
        fn();
        hooks.rerender();
        render();
      };
      acts.appendChild(b);
    };
    add("Familiar turn", () => {
      s.phase = "FAMILIAR";
      s.familiarEnergy = 99;
    });
    add("Human turn", () => {
      s.phase = "HUMAN";
      s.humanActions = 9;
    });
    add("+energy", () => {
      s.familiarEnergy += 5;
    });
    add("Solve room", hooks.solveRoom);
    add("Reset", hooks.reset);
    panel.appendChild(acts);

    const info = document.createElement("pre");
    info.textContent = [
      `room     ${s.currentRoom}`,
      `phase    ${s.phase}   round ${s.round}`,
      `energy   ${s.familiarEnergy}   actions ${s.humanActions}`,
      `player   (${s.player.x}, ${s.player.y})`,
      `solved   ${s.rooms[s.currentRoom].solved}`,
      `vars     ${JSON.stringify(s.rooms[s.currentRoom].vars)}`,
    ].join("\n");
    panel.appendChild(info);
  }
}
