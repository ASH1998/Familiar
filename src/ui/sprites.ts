/**
 * Sprite loading and CSS-based animation.
 *
 * Everything renders at a single SCALE so pixel density is uniform across sources of
 * different native sizes (32px dungeon tiles, 16px props, 48px characters, 64px portals).
 * Mixing scale factors is what makes pixel art look wrong; mixing *source sizes* at one
 * scale factor is just how tile games work.
 */

export const SCALE = 2;
/** Floor tiles are 32px native -> 64px on screen. The grid is in these units. */
export const TILE = 32 * SCALE;

export interface SpriteMeta {
  src: string;
  w: number;
  h: number;
  frames?: number;
  /** [rows, cols] for character sheets sliced as a grid. */
  grid?: [number, number];
  /** Frame indices of the animation to play, into the grid in row-major order. */
  clip?: number[];
  fps?: number;
}

export type SpriteManifest = Record<string, SpriteMeta>;

let manifest: SpriteManifest = {};

export async function loadSprites(): Promise<SpriteManifest> {
  const res = await fetch("/art/sprites.json");
  if (!res.ok) throw new Error(`sprites.json: ${res.status}`);
  manifest = (await res.json()) as SpriteManifest;
  injectKeyframes();
  return manifest;
}

export function meta(key: string): SpriteMeta {
  const m = manifest[key];
  if (!m) throw new Error(`unknown sprite "${key}" — add it to scripts/copy-assets.mjs`);
  return m;
}

/**
 * A clip is animatable in pure CSS only if its frames are one contiguous run within a
 * single row — then it's a background-position translation with steps(). Both character
 * clips we ship satisfy this (player idle is row 2 cols 0-3, familiar idle is row 0).
 * Anything else would need a JS-driven frame swap; we assert rather than silently
 * animate the wrong cells.
 */
function contiguousRow(m: SpriteMeta): { row: number; start: number; count: number } | null {
  if (!m.grid || !m.clip || m.clip.length === 0) return null;
  const cols = m.grid[1];
  const rows = m.clip.map((i) => Math.floor(i / cols));
  const first = rows[0]!;
  if (!rows.every((r) => r === first)) return null;
  const colsOf = m.clip.map((i) => i % cols);
  const start = colsOf[0]!;
  const ok = colsOf.every((c, k) => c === start + k);
  return ok ? { row: first, start, count: m.clip.length } : null;
}

/** Build one @keyframes rule per animated sprite, once. */
function injectKeyframes(): void {
  const rules: string[] = [];
  for (const [key, m] of Object.entries(manifest)) {
    const run = contiguousRow(m);
    if (run) {
      const dist = run.count * m.w * SCALE;
      rules.push(
        `@keyframes anim_${key}{from{background-position-x:${-run.start * m.w * SCALE}px}` +
          `to{background-position-x:${-(run.start * m.w * SCALE + dist)}px}}`,
      );
    } else if (m.frames && m.frames > 1) {
      rules.push(
        `@keyframes anim_${key}{from{background-position-x:0}` +
          `to{background-position-x:${-m.frames * m.w * SCALE}px}}`,
      );
    } else if (m.grid && m.clip && m.clip.length > 1) {
      console.warn(`[sprites] ${key}: clip is not a contiguous row; rendering first frame only`);
    }
  }
  const style = document.createElement("style");
  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

/**
 * Style a DOM element as a sprite. Returns the element for chaining.
 *
 * `animate: false` pins a single frame — `frame` chooses which. That is how two-state props
 * render their state: a lever is one sprite with frame 0 closed and frame 1 open.
 */
export function paint(el: HTMLElement, key: string, animate = true, frame = 0): HTMLElement {
  const m = meta(key);
  const run = contiguousRow(m);
  const frames = run?.count ?? m.frames ?? 1;

  el.style.width = `${m.w * SCALE}px`;
  el.style.height = `${m.h * SCALE}px`;
  el.style.backgroundImage = `url("${m.src}")`;
  el.style.imageRendering = "pixelated";
  el.style.backgroundRepeat = "no-repeat";

  // Scale the whole sheet, then offset into it.
  if (m.grid) {
    const [rows, cols] = m.grid;
    el.style.backgroundSize = `${cols * m.w * SCALE}px ${rows * m.h * SCALE}px`;
    el.style.backgroundPositionY = `${-(run?.row ?? 0) * m.h * SCALE}px`;
    el.style.backgroundPositionX = `${-(run?.start ?? 0) * m.w * SCALE}px`;
  } else {
    const total = m.frames ?? 1;
    el.style.backgroundSize = `${total * m.w * SCALE}px ${m.h * SCALE}px`;
    el.style.backgroundPositionX = `${-Math.min(frame, total - 1) * m.w * SCALE}px`;
    el.style.backgroundPositionY = "0";
  }

  if (animate && frames > 1) {
    const fps = m.fps ?? 8;
    el.style.animation = `anim_${key} ${frames / fps}s steps(${frames}) infinite`;
  } else {
    el.style.animation = "";
  }
  return el;
}

/** Create a positioned sprite div at a tile coordinate. */
export function spriteAt(
  key: string,
  tx: number,
  ty: number,
  animate = true,
  frame = 0,
): HTMLElement {
  const el = paint(document.createElement("div"), key, animate, frame);
  const m = meta(key);
  el.style.position = "absolute";
  el.style.left = `${tx * TILE}px`;
  // Anchor tall sprites (walls, gates, characters) to the bottom of their tile.
  el.style.top = `${ty * TILE - (m.h * SCALE - TILE)}px`;
  el.style.zIndex = String(10 + ty);
  return el;
}
