/**
 * DOM rendering: the room, the HUD, and the familiar's panel.
 *
 * Full re-render on each change. The rooms are ~165 tiles and turns are seconds apart, so
 * a diffing layer would be complexity with nothing to buy it.
 */

import { FAMILIARS } from "../engine/familiars.js";
import { progressLine } from "../engine/score.js";
import { PRISON_AT } from "../engine/rooms/chamber.js";
import { type GameState, room } from "../engine/state.js";
import { TILE, spriteAt } from "./sprites.js";

const $ = (id: string) => document.getElementById(id)!;

/**
 * Gate sigils, drawn rather than sprited.
 *
 * The obvious candidate — `Icons/Book Sprites/` — turned out to be colour-coded *book
 * covers*, which read as books at any size. These three shapes have to be unmistakable at
 * a glance, because the human describing one aloud is half the puzzle. `crispEdges` keeps
 * them consistent with the pixel art around them.
 */
const SIGIL_SVG: Record<string, string> = {
  leaf: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <path fill="#6fbf5a" d="M8 1c4 2 6 5 6 8 0 0-4 1-6-1-2-2-2-5 0-7z"/>
    <path stroke="#2f6b28" stroke-width="1" d="M8 2v11"/></svg>`,
  flame: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <path fill="#e8823c" d="M8 1c3 4 5 5 5 8a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2 1 2 0-3 1-4 2-6z"/>
    <path fill="#f6d05e" d="M8 8c1 2 2 2 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z"/></svg>`,
  wave: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" fill="none"
      stroke="#57b6d8" stroke-width="2" stroke-linecap="square">
    <path d="M1 5c2-2 4 2 6 0s4-2 6 0"/><path d="M1 9c2-2 4 2 6 0s4-2 6 0"/>
    <path d="M1 13c2-2 4 2 6 0s4-2 6 0"/></svg>`,
  crescent: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <path fill="#e6d9a8" d="M11 1a7 7 0 1 0 0 14A9 9 0 0 1 11 1z"/></svg>`,
  eye: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <path fill="#cfc4e8" d="M1 8c3-4 11-4 14 0-3 4-11 4-14 0z"/>
    <circle cx="8" cy="8" r="3" fill="#3b2f5c"/><circle cx="8" cy="8" r="1" fill="#e8dfc8"/></svg>`,
  spiral: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" fill="none"
      stroke="#d9a441" stroke-width="2" stroke-linecap="square">
    <path d="M8 8h3v3H5V5h9"/></svg>`,
};

/**
 * What colour a lit prop throws on the floor. Human-only information by construction — this
 * is the renderer, and no tool ever reads it.
 */
/**
 * Props whose sprite art is a *glowing* thing — portals and the prison. They throw a small
 * pool even when dormant, because a sprite that visibly glows while lighting nothing looks
 * broken. Charging one makes it blaze; the difference has to stay unmistakable, since telling
 * lit from dormant is the human's job.
 */
const ALWAYS_GLOWS = new Set(["portal_ice", "portal_nature", "portal_fire", "prison"]);

const PROP_LIGHT: Record<string, string> = {
  portal_ice: "rgba(96,208,255,0.55)",
  portal_nature: "rgba(120,240,150,0.5)",
  portal_fire: "rgba(255,150,70,0.55)",
  prison: "rgba(180,110,255,0.55)",
  brazier: "rgba(255,176,72,0.5)",
  statue_1: "rgba(255,230,170,0.45)",
  statue_2: "rgba(255,230,170,0.45)",
  statue_3: "rgba(255,230,170,0.45)",
};

/** Marks the human can see carved on a prop, matched out of its `look` text. */
const MARK_RE = /\b(leaf|flame|wave|crescent|eye|spiral)\b/;

/**
 * A pool of light on the floor. Pure CSS, blended additively, sitting under the sprite that
 * casts it — cheaper and better-looking than baking light into the tiles, and it is what
 * makes the chamber read as lit rather than merely dark.
 */
function lightPool(tx: number, ty: number, colour: string, radius: number, strength: number) {
  const el = document.createElement("div");
  el.className = "light";
  el.style.left = `${tx * TILE + TILE / 2}px`;
  el.style.top = `${ty * TILE + TILE / 2}px`;
  el.style.width = `${radius}px`;
  el.style.height = `${radius}px`;
  el.style.background = `radial-gradient(circle, ${colour} 0%, transparent 70%)`;
  el.style.opacity = String(strength);
  return el;
}

/**
 * The binding sigil turning under the prison. Drawn rather than sprited so it can rotate
 * cleanly — a pixel sprite rotated off-axis shimmers badly.
 */
const RITUAL_SVG = `<svg viewBox="0 0 200 200" aria-hidden="true">
  <g fill="none" stroke="#b07cff" stroke-width="1.4" opacity="0.75">
    <circle cx="100" cy="100" r="92"/>
    <circle cx="100" cy="100" r="70" stroke-dasharray="7 11"/>
    <circle cx="100" cy="100" r="44" stroke-dasharray="3 9"/>
    <polygon points="100,16 173,142 27,142"/>
    <polygon points="100,184 27,58 173,58" opacity="0.6"/>
  </g>
</svg>`;

/** Deterministic floor variation — same tile always gets the same texture. */
function floorKey(x: number, y: number): string {
  return `floor_${((x * 7 + y * 13) % 3) + 1}`;
}

export interface ViewHandlers {
  onInspect: (propId: string) => void;
  onEndTurn: () => void;
  onSay: (text: string) => void;
  /** Walk through an opened door into the next chamber — this is what swaps the tool set. */
  onExit: () => void;
  /** Walk to a tile. Room 4's ending depends on this: no tool can move the adventurer. */
  onMove: (x: number, y: number) => void;
}

/**
 * Fit the fixed-size tile grid into whatever the world column gives us. Integer-ish scaling
 * would be ideal for pixel art, but a room that is cut off is worse than one that is
 * scaled to 0.87 — and `image-rendering: pixelated` keeps the result crisp either way.
 */
function fitStage(stage: HTMLElement, w: number, h: number): void {
  const wrap = $("stage-wrap");
  const fit = $("stage-fit");
  const pad = 40;
  const scale = Math.min(1, (wrap.clientWidth - pad) / w, (wrap.clientHeight - pad) / h);
  // `transform` does not change layout size, so the sizing box has to be told the
  // post-scale dimensions or the centring works on the unscaled box and the room clips.
  stage.style.transform = `scale(${scale})`;
  stage.style.transformOrigin = "top left";
  fit.style.width = `${w * scale}px`;
  fit.style.height = `${h * scale}px`;
}

export function renderRoom(state: GameState, h: ViewHandlers): void {
  const r = room(state);
  const stage = $("stage");
  stage.innerHTML = "";
  const w = r.size.x * TILE;
  const h2 = r.size.y * TILE;
  stage.style.width = `${w}px`;
  stage.style.height = `${h2}px`;
  fitStage(stage, w, h2);

  // Floor.
  for (let y = 0; y < r.size.y; y++) {
    for (let x = 0; x < r.size.x; x++) {
      const t = spriteAt(floorKey(x, y), x, y, false);
      t.style.zIndex = "0";
      stage.appendChild(t);
    }
  }

  // Back wall along the top row.
  for (let x = 0; x < r.size.x; x++) {
    stage.appendChild(spriteAt(x % 4 === 3 ? "wall_alt" : "wall", x, 1, false));
  }

  // Exit door, set into the back wall. The wall is drawn at z-index 11 (10 + its row), so
  // the door has to sit ABOVE that — at 8 it was rendering behind the wall and reading as
  // clipped, which is what "the door is out of bounds" was.
  const door = spriteAt("dungeon_door", Math.floor(r.size.x / 2), 1, false);
  door.style.zIndex = "14";
  if (r.solved) {
    stage.appendChild(lightPool(Math.floor(r.size.x / 2), 2, "rgba(255,210,74,0.55)", 340, 1));
    door.className = "prop door--open";
    door.title = "The way is open — step through";
    door.addEventListener("click", h.onExit);
  } else {
    door.style.filter = "brightness(0.55)";
    door.title = "Locked.";
  }
  stage.appendChild(door);

  // Braziers flanking the chamber — animated, and the only warm light in the room.
  for (const bx of [0, r.size.x - 1]) {
    stage.appendChild(lightPool(bx, r.size.y - 2, "rgba(255,176,72,0.5)", 300, 0.85));
    const b = spriteAt("brazier", bx, r.size.y - 2);
    b.style.zIndex = "70";
    stage.appendChild(b);
  }

  // Props.
  for (const p of r.props) {
    const lit = p.flags["charged"] === true || p.flags["lit"] === true;
    const sealed = p.flags["sealed"] === true;
    const dimWhenCold = "charged" in p.flags || "lit" in p.flags;
    // Two-state props (valves) pick a frame; animated ones (lit gates, braziers) loop.
    const twoState = "open" in p.flags && p.sprite === "lever";
    const el = spriteAt(
      p.sprite,
      p.at.x,
      p.at.y,
      (lit && !sealed) || (p.sprite === "brazier" && p.flags["lit"] !== false),
      twoState && p.flags["open"] === true ? 1 : 0,
    );
    el.className = "prop";
    el.dataset["id"] = p.id;
    // A dormant gate shows frame 0 and reads as cold stone; sealed gates dim.
    // Portals and the prison always glow. There is no dimmed "dormant" look for them: the
    // sprite art is a lit portal, and every attempt to signal dormancy by darkening it just
    // produced washed-out grey. Only a *sealed* gate dims, because that is a finished state
    // and worth showing.
    const glows = ALWAYS_GLOWS.has(p.sprite);
    el.style.filter = sealed
      ? "grayscale(1) brightness(0.55)"
      : glows || lit
        ? "brightness(1.25) saturate(1.3) drop-shadow(0 0 14px rgba(255,255,255,0.5))"
        : dimWhenCold
          ? "grayscale(0.45) brightness(0.85)"
          : "";

    // Light cast on the floor, tinted to whatever throws it.
    const tint = PROP_LIGHT[p.sprite] ?? "rgba(220,200,255,0.45)";
    if (!sealed && (glows || lit)) {
      stage.appendChild(lightPool(p.at.x, p.at.y + 1, tint, 320, 0.95));
      el.classList.add("prop--lit");
    }

    // A prop that has not happened yet should not be sitting there looking finished.
    if ("extended" in p.flags && p.flags["extended"] !== true) {
      el.style.opacity = "0.18";
      el.style.filter = "grayscale(1) brightness(0.5)";
    }
    if (twoState && p.flags["open"] === true) {
      el.style.filter = "drop-shadow(0 0 8px rgba(217,164,65,0.8)) brightness(1.2)";
    }
    el.title = p.look ?? p.id;
    el.addEventListener("click", () => h.onInspect(p.id));
    stage.appendChild(el);

    // Sigil carved beneath the arch — human-only information, and the thing the human
    // has to describe out loud for the familiar to look up.
    const sigil = String(p.look ?? "").match(MARK_RE)?.[1];
    if (sigil) {
      const s = document.createElement("div");
      s.className = "sigil";
      s.innerHTML = SIGIL_SVG[sigil]!;
      s.style.left = `${p.at.x * TILE + TILE}px`;
      s.style.top = `${(p.at.y + 1) * TILE}px`;
      stage.appendChild(s);
    }
  }

  // Click-to-walk. Mapping through getBoundingClientRect keeps this correct under the
  // fit-to-viewport transform, which offsetX/offsetY would not.
  stage.onclick = (ev) => {
    if ((ev.target as HTMLElement).closest(".prop")) return; // props handle their own clicks
    const box = stage.getBoundingClientRect();
    const sx = box.width / w;
    const sy = box.height / h2;
    const tx = Math.floor((ev.clientX - box.left) / (TILE * sx));
    const ty = Math.floor((ev.clientY - box.top) / (TILE * sy));
    if (tx >= 0 && ty >= 0 && tx < r.size.x && ty < r.size.y) h.onMove(tx, ty);
  };

  // The Familiar Chamber is staged rather than merely dressed: a bound sigil turning on the
  // floor beneath the prison, and motes rising off it. Both are CSS — no extra sprites, and
  // they give the final room the only continuous motion in the game.
  if (r.id === "chamber") {
    const circle = document.createElement("div");
    circle.className = "ritual";
    circle.style.left = `${(PRISON_AT.x + 1) * TILE}px`;
    circle.style.top = `${(PRISON_AT.y + 1) * TILE + TILE / 2}px`;
    circle.innerHTML = RITUAL_SVG;
    stage.appendChild(circle);

    const motes = document.createElement("div");
    motes.className = "motes";
    motes.style.left = `${(PRISON_AT.x + 1) * TILE}px`;
    motes.style.top = `${(PRISON_AT.y + 1) * TILE}px`;
    for (let i = 0; i < 14; i++) {
      const m = document.createElement("i");
      m.style.left = `${(i * 37) % 200 - 100}px`;
      m.style.animationDelay = `${(i * 0.47) % 6}s`;
      m.style.animationDuration = `${5 + ((i * 13) % 40) / 10}s`;
      motes.appendChild(m);
    }
    stage.appendChild(motes);
  }

  // The wight. The human can see exactly where it is and which way it lies — which is the
  // whole reason `wards_sense` deliberately reports distance and not bearing.
  if (state.wight) {
    const w = state.wight;
    const lunging = state.fx?.kind === "hit" && state.fx.seq === lastFxSeq;
    const el = spriteAt(
      lunging ? "wight_attack" : w.bound > 0 ? "wight_idle" : "wight_walk",
      w.at.x,
      w.at.y,
    );
    el.className = "wight" + (w.bound > 0 ? " wight--bound" : "");
    el.title = w.bound > 0 ? "Bound by the familiar's wards." : "A wight, walking its round.";
    stage.appendChild(el);
  }

  // The adventurer. While a hit is fresh they play the Damage clip and shake, so being
  // driven back reads as something that happened rather than a silent teleport.
  const hurt = state.fx?.kind === "hit" && state.fx.seq === lastFxSeq;
  const player = spriteAt(hurt ? "player_hit" : "player_idle", state.player.x, state.player.y);
  if (hurt) player.className = "player--hurt";
  stage.appendChild(player);
  const fam = spriteAt(FAMILIARS[state.familiar].sprite, state.player.x + 1, state.player.y - 1);
  fam.style.zIndex = "90";
  stage.appendChild(fam);
}

export function renderHud(state: GameState, h: ViewHandlers): void {
  const phase =
    state.phase === "HUMAN" ? "YOUR TURN" : state.phase === "FAMILIAR" ? "FAMILIAR TURN" : "DUNGEON";
  $("phase").textContent = phase;
  $("round").textContent = `Round ${state.round}`;

  // Actions remaining. This was tracked and enforced but never shown, so running out looked
  // like the game had simply stopped responding to clicks.
  $("progress").textContent = progressLine(state);

  const act = $("actions");
  act.textContent =
    state.phase === "HUMAN" ? `${state.humanActions} action${state.humanActions === 1 ? "" : "s"}` : "";
  act.className = state.humanActions === 0 ? "spent" : "";

  // What the human can see and the familiar cannot. Phrased as a prompt to speak.
  const hz = $("hazard");
  if (state.wight) {
    const w = state.wight;
    const d = Math.max(
      Math.abs(w.at.x - state.player.x),
      Math.abs(w.at.y - state.player.y),
    );
    const dx = w.at.x - state.player.x;
    const dy = w.at.y - state.player.y;
    const dir =
      Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "east" : "west") : dy >= 0 ? "south" : "north";
    hz.textContent = w.bound > 0
      ? `wight bound (${w.bound})`
      : `wight ${d} ${d === 1 ? "pace" : "paces"} ${dir}`;
    hz.className = w.bound > 0 ? "bound" : d <= 2 ? "near" : "";
  } else {
    hz.textContent = "";
    hz.className = "";
  }

  const orbs = $("energy");
  orbs.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const o = document.createElement("div");
    o.className = "orb" + (i < state.familiarEnergy ? " orb--full" : "");
    orbs.appendChild(o);
  }
  $("energy-label").textContent = `${state.familiarEnergy} energy`;

  const btn = $("end-turn") as HTMLButtonElement;
  btn.disabled = state.phase !== "HUMAN";
  btn.textContent = state.phase === "HUMAN" ? "End turn" : "Waiting…";
  btn.onclick = h.onEndTurn;
}

export function renderPanel(state: GameState): void {
  const el = $("log");
  el.innerHTML = "";
  for (const entry of state.log.slice(-40)) {
    const line = document.createElement("div");
    line.className = `line line--${entry.source}`;
    if (entry.source === "tool" && entry.tool) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = entry.tool;
      line.appendChild(tag);
    }
    line.appendChild(document.createTextNode(entry.text));
    el.appendChild(line);
  }
  el.scrollTop = el.scrollHeight;
}

/** Spellbook tabs — one per room, lit once that room's tools have been registered. */
export function renderTabs(state: GameState, toolNames: string[]): void {
  const el = $("tabs");
  el.innerHTML = "";
  for (const id of ["library", "gates", "furnace", "chamber"] as const) {
    const tab = document.createElement("div");
    const known = state.discovered.includes(id);
    tab.className = "tab" + (known ? " tab--known" : "") + (id === state.currentRoom ? " tab--active" : "");
    tab.textContent = state.rooms[id].title.replace(/^The /, "");
    el.appendChild(tab);
  }
  $("tools").textContent = toolNames.length
    ? toolNames.join("  ·  ")
    : "no tools registered — WebMCP unavailable";
}

/**
 * Announce a tool call over the board — design doc §10: *"FAMILIAR USED: ROTATE BOOKSHELF III"*.
 * Keyed on `seq` so a re-render for any other reason does not replay the banner.
 */
let lastAnnounced = 0;
/** Which fx the renderer is currently showing. Cleared on a timer by `playFx`. */
let lastFxSeq = -1;
let seenFxSeq = 0;

/**
 * Start a one-shot visual event. Must run BEFORE `renderRoom`, because the room reads
 * `lastFxSeq` to decide whether to draw the adventurer mid-hit — running it afterwards meant
 * the shake fired but the Damage frames never appeared.
 *
 * The engine only sets `{kind, seq}`; how long it lasts is a rendering concern, so the timer
 * lives here rather than in game state.
 */
function beginFx(state: GameState, rerender: () => void): void {
  const fx = state.fx;
  if (!fx || fx.seq === seenFxSeq) return;
  seenFxSeq = fx.seq;
  lastFxSeq = fx.seq;

  const stage = $("stage-wrap");
  stage.classList.add(fx.kind === "vent" ? "shock--vent" : "shock--hit");
  window.setTimeout(() => {
    stage.classList.remove("shock--hit", "shock--vent");
    lastFxSeq = -1;
    rerender();
  }, 900);
}

function announceTool(state: GameState): void {
  const t = state.lastTool;
  if (!t || t.seq === lastAnnounced) return;
  lastAnnounced = t.seq;

  const el = $("tool-banner");
  el.innerHTML =
    `<span class="tool-banner-label">Familiar used</span>` +
    `<span class="tool-banner-name">${t.title}</span>`;
  el.classList.remove("show");
  // Force a reflow so the animation restarts on consecutive calls.
  void el.offsetWidth;
  el.classList.add("show");
}

export function render(state: GameState, toolNames: string[], h: ViewHandlers): void {
  beginFx(state, () => render(state, toolNames, h));
  renderRoom(state, h);
  renderHud(state, h);
  renderPanel(state);
  renderTabs(state, toolNames);
  announceTool(state);
}
