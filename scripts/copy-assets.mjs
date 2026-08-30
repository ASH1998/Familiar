/**
 * Copy only the sprites the game actually uses into public/art/, and emit a trimmed
 * sprite manifest alongside them.
 *
 * The asset library is ~8,000 files across two Unity projects and one web export. Shipping
 * it all would be absurd, so this script is the single list of what we depend on. Adding a
 * sprite to the game means adding a line here.
 *
 * Frame layout for character sheets comes from build/atlas.json, never from the PNG's
 * dimensions — see ASSETS-MAP.md §1.2 for why the obvious guess is wrong.
 *
 *   node scripts/copy-assets.mjs        (run `npm run assets:extract` first)
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "art");
const ART = path.join(ROOT, "assets", "art");
const SW = path.join(ROOT, "assets", "SwordSearch-Assets");

/**
 * key -> [source path, metadata]
 *
 * `strip` sprites are horizontal N-frame strips (the assets/art convention).
 * `grid` sprites are R x C grids of frame-sized cells (the Franuka character convention);
 * their frame counts are verified against atlas.json below.
 */
const SPRITES = {
  // --- Room 2: the gates -------------------------------------------------------------
  portal_ice: [`${ART}/portals/spr_ice_portal_strip7.png`, { w: 64, h: 64, frames: 7 }],
  portal_fire: [`${ART}/portals/spr_fire_portal_strip7.png`, { w: 64, h: 64, frames: 7 }],
  portal_nature: [`${ART}/portals/spr_Nature_portal_strip7.png`, { w: 64, h: 64, frames: 7 }],

  // --- Archive tomes ------------------------------------------------------------------
  // NB: "Icons/Book Sprites" are colour-coded BOOK COVERS, not elemental glyphs — they
  // read as books at any scale. They dress the archive well; the gate sigils are drawn as
  // inline SVG in ui/view.ts instead, where leaf/flame/wave need to be unmistakable.
  tome_water: [`${SW}/Art Assets/Icons/Book Sprites/Water.png`, { w: 16, h: 16, frames: 1 }],
  tome_fire: [`${SW}/Art Assets/Icons/Book Sprites/Fire.png`, { w: 16, h: 16, frames: 1 }],
  tome_earth: [`${SW}/Art Assets/Icons/Book Sprites/Earth.png`, { w: 16, h: 16, frames: 1 }],

  // --- Room shell -----------------------------------------------------------------------
  // Floor and wall come from MutterPixel's Dark Dungeon kit (32px), not the Franuka
  // Dungeon pack — that pack's "Tileset.png" is a props sheet (doorways, chests, torches),
  // not tiling floor, and Franuka's other 16px floors are flat colour swatches.
  // The grid is therefore 32px source at 2x; every other sprite renders at 2x too, so
  // pixel density stays uniform (see ASSETS-MAP.md §0 mixing rule).
  floor_1: [`${ART}/stage/dungeon/spr_catacomb_floor_1.png`, { w: 32, h: 32, frames: 1 }],
  floor_2: [`${ART}/stage/dungeon/spr_catacomb_floor_2.png`, { w: 32, h: 32, frames: 1 }],
  floor_3: [`${ART}/stage/dungeon/spr_catacomb_floor_3.png`, { w: 32, h: 32, frames: 1 }],
  wall: [`${ART}/stage/dungeon/spr_catacomb_wall_1.png`, { w: 32, h: 64, frames: 1 }],
  wall_alt: [`${ART}/stage/dungeon/spr_catacomb_wall_3.png`, { w: 32, h: 64, frames: 1 }],
  dungeon_door: [`${ART}/stage/dungeon/spr_catacomb_door.png`, { w: 32, h: 48, frames: 1 }],
  brazier: [`${ART}/stage/dungeon/spr_catacomb_light_strip3.png`, { w: 32, h: 32, frames: 3 }],

  // --- Room 1: the library -------------------------------------------------------------
  // Armour stands stand in for statues: four distinguishable silhouettes at 32x48, which is
  // exactly what a "which one is lit?" puzzle needs (ASSETS-MAP.md §3 Room 1).
  statue_1: [`${ART}/interior/armory/Spr_Armor_Stand_1.png`, { w: 32, h: 48, frames: 1 }],
  statue_2: [`${ART}/interior/armory/Spr_Armor_Stand_2.png`, { w: 32, h: 48, frames: 1 }],
  statue_3: [`${ART}/interior/armory/Spr_Armor_Stand_3.png`, { w: 32, h: 48, frames: 1 }],
  bookshelf: [`${ART}/interior/store/spr_shop_unit_1.png`, { w: 48, h: 96, frames: 1 }],

  // --- Room 3: the furnace ---------------------------------------------------------------
  // Levers stand in for valve wheels: a 2-frame off/on sprite is exactly a valve, and it
  // avoids the brass-recolour pass the sci-fi lab sheet would need (ASSETS-MAP.md §3 Room 3).
  bridge: [`${ART}/world/bridges/spr_bridge_4.png`, { w: 64, h: 64, frames: 1 }],

  // --- Room 4: the familiar chamber --------------------------------------------------------
  prison: [`${ART}/portals/Spr_Void_Portal_strip7.png`, { w: 64, h: 64, frames: 7 }],

  // The adventurer taking a hit. Unity's Damage clip is frames 4-5 of a 4x2 grid — one
  // contiguous row, so it animates in pure CSS like everything else.
  player_hit: [
    `${SW}/Animations/Character Sprites and Animations/Player/Character sprites/Sorcerer_hit.png`,
    { w: 48, h: 48, grid: [4, 2], clip: [4, 5], fps: 10 },
  ],

  // --- The wight: a hazard that patrols during the DUNGEON phase -----------------------
  wight_walk: [`${ART}/enemies/undead/spr_Basic_Skeleton_walk_strip9.png`, { w: 32, h: 32, frames: 9, fps: 9 }],
  wight_idle: [`${ART}/enemies/undead/spr_Basic_Skeleton_Idle_strip9.png`, { w: 32, h: 32, frames: 9, fps: 6 }],
  wight_attack: [`${ART}/enemies/undead/spr_Basic_Skeleton_attack_strip9.png`, { w: 32, h: 32, frames: 9, fps: 12 }],

  // --- Set dressing --------------------------------------------------------------------
  // Non-interactive. The rooms read as abandoned rather than as three props on a floor.
  coffin_1: [`${ART}/stage/dungeon/spr_coffin_1.png`, { w: 32, h: 32, frames: 1 }],
  coffin_2: [`${ART}/stage/dungeon/spr_coffin_2.png`, { w: 32, h: 32, frames: 1 }],
  skull_1: [`${ART}/stage/dungeon/spr_skull_1.png`, { w: 32, h: 32, frames: 1 }],
  skulls: [`${ART}/stage/dungeon/spr_skulls.png`, { w: 32, h: 32, frames: 1 }],
  rubble: [`${ART}/stage/dungeon/spr_smashed_objs.png`, { w: 32, h: 32, frames: 1 }],
  bone_pile: [`${ART}/stage/dungeon/spr_bone_pillow.png`, { w: 16, h: 64, frames: 1 }],
  pillar: [`${ART}/world/ruins/spr_Ancient_Pillow_1.png`, { w: 64, h: 64, frames: 1 }],
  pillar_fallen: [`${ART}/world/ruins/spr_fallen_pillow_1.png`, { w: 64, h: 64, frames: 1 }],
  rock_pile: [`${ART}/world/ruins/spr_Rock_Pile_1.png`, { w: 64, h: 64, frames: 1 }],
  stone: [`${ART}/world/ruins/spr_old_stone_1.png`, { w: 32, h: 32, frames: 1 }],

  // --- Props (Franuka, 16px — half a floor tile, which is normal for tile games) --------
  torch: [`${SW}/Art Assets/Environment/Dungeon/Torch (front).png`, { w: 16, h: 16, frames: 4 }],
  lever: [`${SW}/Art Assets/Environment/Dungeon/Lever.png`, { w: 16, h: 16, frames: 2 }],
  chains: [`${SW}/Art Assets/Environment/Dungeon/Chains.png`, { w: 16, h: 32, frames: 1 }],
  cobweb: [`${SW}/Art Assets/Environment/Spooky/Cobweb_big.png`, { w: 32, h: 32, frames: 1 }],
  // 64x16 is four 16px frames — the cauldron bubbles.
  cauldron: [`${SW}/Art Assets/Environment/Spooky/Cauldron.png`, { w: 16, h: 16, frames: 4, fps: 6 }],

  // --- Characters (grids — frame counts checked against atlas.json) --------------------
  player_idle: [
    `${SW}/Animations/Character Sprites and Animations/Player/Character sprites/Sorcerer_idle.png`,
    { w: 48, h: 48, grid: [4, 4], clip: [8, 9, 10, 11], fps: 12 },
  ],
  // The four selectable familiars. All are 4x4 grids; the idle clip is the top row.
  // Motion in the select cards is the point (cf. the RUNE GOBLIN reference), so these are
  // animated on the title screen as well as in the dungeon.
  familiar_beholder: [
    `${SW}/Animations/Character Sprites and Animations/Enemies/Beholder Purple/Beholder_idle.png`,
    { w: 32, h: 32, grid: [4, 4], clip: [0, 1, 2, 3], fps: 12 },
  ],
  familiar_fairy: [
    `${SW}/Animations/Character Sprites and Animations/Enemies/Fairy/Fairy_idle.png`,
    { w: 16, h: 16, grid: [4, 4], clip: [0, 1, 2, 3], fps: 12 },
  ],
  familiar_imp: [
    `${SW}/Animations/Character Sprites and Animations/Enemies/Imp/Imp_idle.png`,
    { w: 16, h: 16, grid: [4, 4], clip: [0, 1, 2, 3], fps: 12 },
  ],
  familiar_dragon: [
    `${SW}/Animations/Character Sprites and Animations/Enemies/Faerie Dragon/FaerieDragon_idle.png`,
    { w: 32, h: 32, grid: [4, 4], clip: [0, 1, 2, 3], fps: 12 },
  ],

  // --- UI (Franuka kit; already split into individual files) --------------------------
  orb_energy: [`${ART}/ui/kit/Resource-orbs/Orb_Energy.png`, { w: 48, h: 48, frames: 1 }],
  orb_frame: [`${ART}/ui/kit/Resource-orbs/Orb_Frame_Energy.png`, { w: 48, h: 48, frames: 1 }],
  spellbook: [`${ART}/ui/kit/Spellbook---Tabs/Spellbook.png`, { w: 0, h: 0, frames: 1 }],
  banner: [`${ART}/ui/kit/Title-banners/BannerMedium_01A.png`, { w: 48, h: 32, frames: 1 }],
  familiar_portrait: [
    `${SW}/Art Assets/Enemies/EXTRAS/Portraits/Beholder_frame.png`,
    { w: 18, h: 18, frames: 1 },
  ],
};

// Fonts ship alongside the sprites. Self-hosted rather than CDN: the game is a static site
// that may run inside an agent's built-in browser, where an external font request is one more
// thing that can fail silently.
const FONTS = {
  "public-pixel.ttf": `${SW}/Art Assets/Fonts/Public Pixel Regular/public-pixel.regular.ttf`,
  "pixelify-sans.ttf": `${ROOT}/assets/Assets/Resources/RPG UI pack/Fonts/PixelifySans-Regular.ttf`,
};

let atlas = null;
const atlasPath = path.join(ROOT, "build", "atlas.json");
if (fs.existsSync(atlasPath)) {
  atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
} else {
  console.warn("! build/atlas.json missing — run `npm run assets:extract` to verify grids.\n");
}

fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
let copied = 0;
const problems = [];

for (const [key, [src, meta]] of Object.entries(SPRITES)) {
  if (!fs.existsSync(src)) {
    problems.push(`missing source: ${key} -> ${path.relative(ROOT, src)}`);
    continue;
  }
  const dest = path.join(OUT, `${key}.png`);
  fs.copyFileSync(src, dest);
  copied++;

  // Cross-check grid sprites against the real Unity slicing.
  if (meta.grid && atlas) {
    const rel = path.relative(ROOT, src);
    const rec = atlas[rel];
    if (rec) {
      const expected = meta.grid[0] * meta.grid[1];
      if (rec.sprites.length !== expected) {
        problems.push(
          `${key}: declared ${meta.grid.join("x")}=${expected} frames, atlas says ${rec.sprites.length}`,
        );
      }
    }
  }
  manifest[key] = { src: `/art/${key}.png`, ...meta };
}

fs.writeFileSync(
  path.join(OUT, "sprites.json"),
  JSON.stringify(manifest, null, 1) + "\n",
);

const fontDir = path.join(ROOT, "public", "fonts");
fs.mkdirSync(fontDir, { recursive: true });
let fonts = 0;
for (const [name, src] of Object.entries(FONTS)) {
  if (!fs.existsSync(src)) {
    problems.push(`missing font: ${name} -> ${path.relative(ROOT, src)}`);
    continue;
  }
  fs.copyFileSync(src, path.join(fontDir, name));
  fonts++;
}

console.log(`copied ${copied}/${Object.keys(SPRITES).length} sprites -> public/art/`);
console.log(`copied ${fonts}/${Object.keys(FONTS).length} fonts -> public/fonts/`);
console.log(`wrote public/art/sprites.json`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
