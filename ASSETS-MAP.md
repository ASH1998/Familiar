# Dungeon Familiar — Asset Mind Map

> **Purpose:** a lookup table so nobody (human or LLM) has to go spelunking through 3 asset roots
> and ~8,000 files to answer "what sprite do I use for X?"
>
> Companion to [Dungeon Familiar — WebMCP Game Plan.md](Dungeon%20Familiar%20—%20WebMCP%20Game%20Plan.md).
> All paths are relative to the repo root. Paths with spaces are given verbatim — quote them in shell.

---

## 0. TL;DR — the decision

> ### ✅ Decisions locked (2026-08-30)
> 1. **Art direction — Franuka.** Confirmed. Extract from `SwordSearch-Assets/`.
>    ⚠️ *Amended in build:* Franuka has no usable dungeon **floor/wall** tiles, so the room
>    shell is MutterPixel's 32px Dark Dungeon kit and the whole game renders at **2×**
>    (64px tiles), not 16px@3×. Props, characters and UI are still Franuka. See §10.
> 2. **Room 3 palette — recolour the lab sheet to brass/copper.** See §3 Room 3 for the one-line method.
> 3. **The familiar is a Beholder.** Purple variant. See §5.
> 4. **Room 2 is no longer the Observatory** — there is no telescope in these folders. Reframed as
>    **The Gate Chamber**, built entirely from assets on hand. See §3 Room 2.
>
> **Nothing needs buying.** The only genuine gap left is audio — and it's coverable with CC0. See §8.

**Build the game in the Franuka "Fantasy RPG" 16px top-down style.**

Reason: one artist (Franuka) made *all four* things the plan needs to look coherent —
the dungeon mechanisms, the interior tilesets, the player/creature sprites, **and** the RPG UI kit
already sitting in `assets/art/ui/kit/`. Nothing else in these folders gives you that.

More importantly, the Franuka **Dungeon** pack is the only set here that ships the exact
vocabulary the core loop needs: **levers, gates, doors, and traps as multi-frame animations**.
That is the whole game — familiar calls a WebMCP tool, a mechanism visibly moves.

| | Direction A — **Franuka 16px** ✅ pick this | Direction B — MutterPixel 32px |
|---|---|---|
| Grid | 16px (render at 3× = 48px tiles) | 32px (render at 2× = 64px) |
| Mechanisms | ✅ lever, gate, door, spike/arrow/fire trap, torch — all animated | ❌ none |
| Interiors | ✅ bookshelves, tables, candles, rugs, cauldrons | ⚠️ tavern/store/armory only |
| Characters | ✅ Sorcerer + 54 creatures + chatheads | ⚠️ skeletons, rats, villagers |
| UI | ✅ same artist as `art/ui/kit` | ❌ mismatched |
| Mood | warm, readable, "board game" | dark, moody, atmospheric |
| Where | `assets/SwordSearch-Assets/` (Unity, needs extraction) | `assets/art/` (already web-ready + manifest) |

**Mixing rule:** the two are different pixel densities and will fight. Use MutterPixel sprites
**only as non-tiling full-frame illustration** (room title cards, map nodes, the end screen) where
they never sit next to a 16px tile. Named exceptions are listed in §5.

---

## 1. The three asset roots

| Root | What it is | Format | Web-ready? |
|---|---|---|---|
| `assets/art/` | Curated library from a previous **web** game. 2,842 PNGs, flat folders. | PNG + `manifest.json` | ✅ **yes** — paths already `/art/...` |
| `assets/SwordSearch-Assets/` | A Unity RPG project. The **richest art**, buried in Unity layout. | PNG + `.meta` + `.anim` | ⚠️ copy the PNGs out; mine `.meta`/`.anim` with §1.3 |
| `assets/Assets/` | Unity survivors-like template. Mostly duplicates of `art/`. | Unity | ❌ **skip** — see §1.4 |

> **"Can we use PNGs and Unity assets together?"** — yes, because they are the same thing. The
> Unity folders contain plain PNGs; nothing needs converting to display them. The only Unity-specific
> data is the sidecar slicing and animation metadata, and §1.3 extracts that to JSON.

### 1.1 `assets/art/manifest.json` — use this, don't `ls`

Pre-built index of every sprite: category, dimensions, and frame count. Query it instead of walking dirs:

```bash
python3 -c "
import json
d=json.load(open('assets/art/manifest.json'))
for i in d['items']:
    if 'catacomb' in i['name']:
        print(i['src'], i['w'], i['h'], 'frames:', i['frames'])
"
```

Schema: `{"cats": [...], "items": [{"src","cat","name","w","h","frames"}]}`.
`w`/`h` are **per-frame** dimensions; `frames` is the strip length.

### 1.2 Frame conventions

- `assets/art/` — filename suffix `_stripN` means a horizontal strip of **N** frames.
  `spr_Chest_1_strip9.png` = 9 frames, each 32×32. Reliable; `manifest.json` already records it.
- `assets/SwordSearch-Assets/` — **no reliable rule. Do not guess from dimensions.**
  Run the extractor (§1.3) and read the real slicing.

> ⚠️ **The obvious guess is wrong for every character sheet.** "frames = width ÷ height" holds for
> the flat prop strips (`Bat.png` 64×16 → 4 × 16×16) but the character sheets are **grids**, and
> some are vertical:
>
> | File | Size | Actual | Naive guess |
> |---|---|---|---|
> | `Sorcerer_idle.png` | 192×192 | **16** frames, 4×4 grid @48px | 1 ✗ |
> | `Fairy_idle.png` | 64×64 | **16** frames, 4×4 grid @16px | 1 ✗ |
> | `Beholder_idle.png` | 128×128 | **16** frames, 4×4 grid @32px | 1 ✗ |
> | `Sorcerer_cast.png` | 48×192 | **4** frames, stacked **vertically** | — ✗ |
> | `Bat.png` | 64×16 | 4 frames, horizontal | 4 ✓ |
>
> And a 16-frame sheet does not mean a 16-frame animation — the Player `Idle` clip uses only
> sprites 8–11 of `Sorcerer_idle.png`'s sixteen. The clip data (§1.3) is the only source of truth
> for which frames play, in what order, at what rate.

- Franuka character packs ship at **48×48** (100%) and **96×96** (200%).
  `Sorcerer_idle_holding_book.png` (384×384) is the 2× version of a 192×192 sheet.

### 1.3 Converting the Unity assets — `tools/unity-extract.py`

There is nothing to convert about the **art**: every one of those files is an ordinary PNG that a
browser will render as-is. Copy them out and ignore the Unity folder structure.

What *is* worth recovering is the two sidecar file types, both plain YAML:

| File | Holds | Worth it? |
|---|---|---|
| `*.png.meta` | Hand-authored sprite slicing — name + rect + pivot + 9-slice border | For the big sheets, yes |
| `*.anim` | Animation clips — which sprites, in what order, at what fps | **Yes — irreplaceable** |

`tools/unity-extract.py` parses both without Unity and writes two JSON files.
It flips Unity's bottom-left rect origin to top-left, so the numbers drop straight into
`background-position` / `drawImage`.

```bash
python3 tools/unity-extract.py --out build --copy-png
```

Actual output over both Unity roots:

```
.png.meta scanned    6632
textures indexed     6632
  multi-sprite       1067  (hand-sliced sheets)
named sprite rects   24883
animation clips      779
  unresolved frames  26        (99.9% resolved)
```

`clips.json` entries look like this — this is the part you cannot reconstruct from the PNG:

```json
"…/Player/Idle.anim": {
  "clip": "Idle", "fps": 12.0,
  "textures": ["…/Sorcerer_idle.png"],
  "frames": [
    {"t": 0.0,        "sprite": "Sorcerer_idle 1_8"},
    {"t": 0.16666667, "sprite": "Sorcerer_idle 1_9"},
    {"t": 0.33333334, "sprite": "Sorcerer_idle 1_10"},
    {"t": 0.5,        "sprite": "Sorcerer_idle 1_11"}
  ]
}
```

Cross-reference `sprite` against `atlas.json` to get the pixel rect. Clips were recovered for
**70 character folders** (Player, 54 enemies, NPCs) — up to 9 clips each.

**Two honest limits:**

1. **Slicing only exists where someone sliced it.** 501 of 3,889 SwordSearch PNGs are sliced.
   Notably **`Environment/Dungeon/` — all 33 files — has no slicing at all.** The mechanism sprites
   at the heart of §4 are uniform horizontal strips, so `width ÷ height` is correct *there*; it just
   isn't correct for characters.
2. **9-slice borders are nearly absent** — only 48 sprites repo-wide carry one (the Interior pack and
   `UI books & more`). The Franuka UI-kit sheets have none, so panel/button 9-slice values must be
   eyeballed. The kit's individual PNGs (`art/ui/kit/…`) make that easy — they're already separate files.

**Practical consequence:** for UI, use the pre-split PNGs in `assets/art/ui/kit/` and skip the atlas
entirely. Use the extractor for **characters and creatures**, where the clip data is the whole value.

### 1.4 What to ignore entirely

- `assets/Assets/` — Unity template (`Tiny Swords`, tower-defense prefabs, scenes, C# scripts).
  Its one useful thing is the **fonts** (§9). Tiny Swords is a bright cartoon RTS style that
  clashes with everything else.
- `*.controller`, `*.prefab`, `*.asset`, `*.aseprite`, `*.xcf` — editor files, nothing to recover.
  **Do not delete `*.png.meta` or `*.anim`** — they carry the slicing rects and frame timings that
  §1.3 extracts. They are useless *at runtime*, but they are the build input.
- `assets/SwordSearch-Assets/{Scripts,Scenes,Word Lists,Book Lists,Story and Dialogues}` — that game's
  logic and content, not ours. `Sound Effects/` is 5 files named `test 1–5.mp3`; assume placeholder.

---

## 2. ⚠️ License gates — read before shipping

`assets/art/ATTRIBUTION.md` is a real audit (written in Turkish) and it flags folders as unsafe.
Honor it.

### ❌ Do not use

| Path | Why |
|---|---|
| `assets/art/ui/*.png` (root files only) | Mixed scrape-dump. Contains **`Teemo Basic emote animations sprite sheet.png` — Riot Games IP**, plus SEO-slug PNGs from free-PNG scraper sites. |
| `assets/art/ui/borders/` | Same dump, provenance unknown. |
| `assets/art/pickups/` | Same. |
| `assets/art/misc/` | Same (includes `misc/single/` keycap sprites). |
| `assets/art/icons/` | 48 status/spell icons, **source never identified**, PNG metadata stripped. Use `SwordSearch-Assets/Art Assets/Icons/` instead — 210 icons, from a licensed pack. |

> `assets/art/ui/kit/` is **fine** — that's the Franuka RPG UI pack, a different thing that happens
> to live under the same parent. `-maxdepth 1` matters if you ever prune.

### ✅ Cleared for commercial use

| Source | Covers | Terms |
|---|---|---|
| **Franuka** (franuka.itch.io) | `art/ui/kit/`, `art/cursors/`, and the whole `SwordSearch` Fantasy RPG series | **Credit link to franuka.itch.io is mandatory**, not optional |
| **MutterPixel Studio** | `art/{hub,interior,npc,portals,loot,chests,stage,town,world}`, `art/enemies/{undead,vermin}` | Commercial OK; credit appreciated. No reselling raw assets. |
| **Szadi art** | `art/tiles/` (RF_Catacombs) | Public domain |
| **CraftPix** | `art/fx/` | Royalty-free, unlimited commercial |
| **LuizMelo** | `art/heroes/`, `art/enemies/` (root) | **CC0** — no attribution required |

**Action item:** put a Credits screen in the demo with `franuka.itch.io`. It's a licence condition,
and it costs one line of HTML.

---

## 3. Rooms — the plan's four rooms, mapped

Base for every room: `SwordSearch-Assets/Art Assets/Environment/Dungeon/Tileset.png` (448×48, 16px grid)
for floor/wall, dressed with the pack listed below.

### Room 1 — The Clockwork Library

| Plan element | Asset | Path (under `assets/`) |
|---|---|---|
| **Rotating bookshelves** | Bookshelf tiles in the Interior sheet — rotation is a CSS transform, not new art | `SwordSearch-Assets/Art Assets/Environment/Interior/Fantasy RPG Interior Pack (16x16 grid).png` |
| Reading tables, chairs, rugs, candles | same sheet | ↑ |
| Standing candle (animated) | `Candle_Animated.png` | `SwordSearch-Assets/Art Assets/Environment/Interior/` |
| **Statues** (plan wants 3 with symbols) | 4 armour stands = 4 distinguishable "statues", 32×48 | `art/interior/armory/Spr_Armor_Stand_{1,2,3,4}.png` |
| Alt. single big statue | `spr_old_statue.png` 96×96 (MutterPixel — see mixing rule) | `art/world/ruins/` |
| **Locked gate** | `Spiked gate (front).png` / `(side).png` — 4-frame open/close | `SwordSearch-Assets/Art Assets/Environment/Dungeon/` |
| Door | `Door (front).png` / `Door (side).png` — 4-frame | ↑ |
| Torches | `Torch (front).png` / `(side).png` — 4-frame loop | ↑ |
| Scattered books / archive clutter | `Book.png`, `Book outline.png` | `SwordSearch-Assets/Art Assets/Environment/Interior/` |
| Room title card / map node | `Spr_Ruined_Library.png` 256×256 | `art/hub/ruins/` |

### Room 2 — The Gate Chamber *(replaces "The Observatory")*

**Why reframed:** there is no telescope sprite in any of these folders, and the Observatory puzzle
was built around one. The plan's *purpose* for Room 2 — **"introduce incomplete information"**, where
the familiar operates a device but cannot perceive the result — is preserved exactly. Only the device
changed, to the best-looking thing we already own.

**The room:** three dormant portal arches along the far wall, a resonance plinth, an archive plinth.

`art/portals/` holds **8 animated portals**, 64×64, 7-frame loops, each a stone arch with a glowing
interior — and each a **completely unmistakable colour**: ice (cyan), fire (orange), Nature (green),
holy (gold), dark / Void (purple-black), Lava (red), lighting (white-blue). That colour legibility is
the whole mechanic.

**The asymmetry:**

- The familiar calls `gate.charge("II")` and gets back only **`"Gate II is charged."`** — no colour,
  no element. It is blind to what manifested.
- The human sees Gate II blaze **green with a leaf sigil** and says so.
- `archive.lookup_sigil("leaf")` tells the familiar that green/leaf = **Nature**, and that the
  archive's sealing order is *Nature → Flame → Ice*.
- Only now can either side act. The familiar knows the **order by element name**; the human knows
  which gate is **which colour**. Neither mapping exists on the other side.

That satisfies plan §14 (human information + agent capability + communication) without a single new
asset. It's also a clean place to stage the "new capabilities discovered" beat — entering the chamber
registers `gate.*` and `resonance.*`.

| Element | Asset | Path |
|---|---|---|
| **The three gates** (pick the most distinct colours) | `spr_ice_portal_strip7.png`, `spr_fire_portal_strip7.png`, `spr_Nature_portal_strip7.png` — 64×64, **7 frames** | `art/portals/` |
| Spare gates for Room 4 callbacks | `spr_holy_`, `spr_dark_`, `spr_Lava_`, `spr_lighting_`, `Spr_Void_Portal_strip7.png` | ↑ |
| **Sigils** under each gate | ⚠️ Drawn as inline SVG in `src/ui/view.ts` — see correction below | — |
| Archive tomes (element-coloured **books**) | `Fire.png`, `Water.png`, `Earth.png`, `Lightning.png`, `Darkness.png`, `Healing.png` (16×16) | `SwordSearch-Assets/Art Assets/Icons/Book Sprites/` |
| Archive page the familiar reads | `Book.png`, `Just the inside v2/v3/v4.png` | `SwordSearch-Assets/Art Assets/GUI/Book v2/` |
| Resonance plinth / control panel | panel + pedestal parts from `tilesStuff.png` | `…/Environment/Sciency stuff/marceles laboratory/` |
| Gate ignition flare | `pixelfx{fire,water,earth}/…` matched to the gate's element | `SwordSearch-Assets/Art Assets/Attacks/` |
| Floor glow under a charged gate | `glowCircle.png`, `Ring.png` | `SwordSearch-Assets/Art Assets/Generic/` |
| Room title card / map node | `Spr_Magical_Observatory.png` 256×256 — still perfect as an establishing illustration | `art/town/` |

> ⚠️ **Correction, found in build.** `Icons/Book Sprites/` are colour-coded **book covers**,
> not elemental glyphs — every one reads as a book at any scale. They are good for dressing
> an archive and useless as carved sigils. The three gate sigils (leaf / flame / wave) are
> drawn as inline SVG in `src/ui/view.ts` with `shape-rendering: crispEdges`, which also
> makes them unmistakable at demo scale — worth it, since the human describing one aloud is
> half the puzzle.

**Element ↔ portal mapping** (6 clean pairs out of 8 portals):

| Sigil | Gate |
|---|---|
| `Fire.png` | `spr_fire_portal` (orange) or `spr_Lava_Portal` (red) |
| `Water.png` | `spr_ice_portal` (cyan) |
| `Earth.png` | `spr_Nature_portal` (green) |
| `Lightning.png` | `spr_lighting_portal` (white-blue) |
| `Darkness.png` | `spr_dark_portal` / `Spr_Void_Portal` (purple-black) |
| `Healing.png` | `spr_holy_portal` (gold) |

> ⚠️ **The one deliberate style exception.** The portals are MutterPixel, not Franuka — this breaks
> the §0 mixing rule on purpose, because 8 animated 7-frame gates is the best VFX in the repo and the
> demo needs the visual punch here.
>
> **Pixel density still matches exactly:** render the portals at **3×** like everything else
> (64 × 3 = 192px = a 4×4-tile monumental gate) and both layers land at 3 screen pixels per source
> pixel. Only the *drawing style* differs, and a glowing arch is mostly light and colour — low style
> signature. Worth a 10-minute side-by-side before committing.
>
> **Pure-Franuka fallback if it clashes:** `Environment/Spooky/Door_1..Door_6.png` each ship an
> `(open)` variant — six doors, tinted per element with a sigil above. Less spectacle, zero risk.

### Room 3 — The Furnace

| Plan element | Asset | Path |
|---|---|---|
| **Pressure gauges, valve wheels, pipes, control panels, hazard stripes** | `tilesStuff.png` (592×256, 16px) — a sci-fi lab sheet with exactly these parts | `SwordSearch-Assets/Art Assets/Environment/Sciency stuff/marceles laboratory/` |
| Machine walls / floor | `tilesWalls.png`, `tilesFloor.png` | ↑ |
| **Flowing liquid / steam channels** (animated) | `spriteSheet_tiledLiquids_16x16.png` 256×48 | ↑ |
| Indicator lights (animated) | `spriteSheet_lightBulbSmallAnimation_16x16.png` 128×16 | ↑ |
| Furnace fire (animated) | `spriteSheet_fireEffect03_21x26.png` | ↑ |
| Alt. fire, fantasy palette | `spr_Traven_fire_strip15.png` (15 frames), `spr_cozy_fire_on_strip3.png` | `art/interior/tavern/`, `art/hub/lights/` |
| Fireplace / grate | `Fireplace_Grate.png` | `SwordSearch-Assets/Art Assets/Environment/Interior/` |
| Cauldron | `Cauldron.png` | `SwordSearch-Assets/Art Assets/Environment/Spooky/` |
| **Hazard** — spike trap | `Spikes trap.png` 64×16, 4-frame | `SwordSearch-Assets/Art Assets/Environment/Dungeon/` |
| Hazard — fire / arrow / poison trap | `Fire trap.png` + `Fire trap (projectile).png`, same for Arrow & Poison | ↑ |
| **Moving platforms** | Dungeon `Tileset.png` floor tiles, translated in JS | ↑ |

> ✅ **Decided: recolour to brass/copper.** The lab sheet ships sci-fi blue/purple with yellow hazard
> stripes and will not sit next to warm fantasy stone untouched.
>
> Cheapest version that works — a CSS filter on the machinery layer only, no asset edits, tune live:
>
> ```css
> .layer-machinery { filter: hue-rotate(-150deg) saturate(0.75) sepia(0.35); }
> ```
>
> If it needs to be exact, bake it instead: sample the sheet's palette, map each blue/purple ramp
> onto a brass ramp, and write the recoloured PNGs into the build. Do the CSS version first — it may
> simply be good enough, and it costs one line.

### Room 4 — The Familiar Chamber

| Plan element | Asset | Path |
|---|---|---|
| **The familiar's prison** | `Science Vat v2…v8.png`, `Science Tube.png` — a creature suspended in a tube reads instantly | `SwordSearch-Assets/Art Assets/Environment/Custom Stuff/` |
| Alt. magical prison | `Spr_Void_Portal_strip7.png`, `spr_dark_portal_strip7.png` (7-frame loops, 64×64) | `art/portals/` |
| Chains / bindings | `Chains.png` 16×32 | `SwordSearch-Assets/Art Assets/Environment/Dungeon/` |
| Chains, hanging braziers, cauldrons, pillars | `decorative.png` 256×256 | `art/tiles/` |
| Ritual circle | `Ring.png`, `Circle.png`, `Filled Circle for masking.png` | `SwordSearch-Assets/Art Assets/Generic/` |
| Cobwebs, coffins, bones | `Cobweb_big/small.png`, `Coffin_1/2.png`, `Bones_1..4.png` | `SwordSearch-Assets/Art Assets/Environment/Spooky/` |
| Final transformation FX | `pixelfxdark/Demon Ritual/`, `pixelfxlightning/Thunder II/` | `SwordSearch-Assets/Art Assets/Attacks/` |
| End-screen illustration | `Spr_Ruined_Castle.png` 512×512, `Spr_Gothic_Cathedral.png` 512×512 | `art/hub/ruins/` |

---

## 4. WebMCP tool → visible change

This is the table that matters. Plan §10: *"When WebMCP actions occur, they should visibly animate."*
Every tool needs a sprite whose state change the player can *see*.

| Tool (plan §13) | Sprite | Frames | Visible change |
|---|---|---|---|
| `lever.pull()` / any binary switch | `Environment/Dungeon/Lever.png` | 32×16 → **2** | flips left↔right |
| `gate.open()` / `gate.close()` | `Environment/Dungeon/Spiked gate (front).png` | 64×16 → **4** | portcullis raises |
| `door.unlock()` | `Environment/Dungeon/Door (front).png` | 64×16 → **4** | swings open |
| `bookshelf.rotate()` | Interior-pack bookshelf tile | 1 | CSS `rotate()` + dust puff |
| `platform.rotate(dir)` | Dungeon `Tileset.png` floor tiles | 1 | CSS transform on a tile group |
| `trap.arm()` / `trap.disarm()` | `Spikes trap.png` | 64×16 → **4** | spikes extend/retract |
| `trap.scan()` | `Arrow/Fire/Poison trap.png` + `(projectile)` | 16×16 + 48×32 | hidden traps flash visible |
| `torch.light()` | `Torch (front).png` | 64×16 → **4** | flame loop starts, room brightens |
| `chest.open()` | `Large chest.png` / `Small chest.png` | 64×16 → **4** | lid opens |
| `steam.redirect()` | `spriteSheet_tiledLiquids_16x16.png` | 256×48 | flow animates down a new pipe |
| `valve.open/close()` | valve wheels in `tilesStuff.png` | 1 | rotate + gauge needle moves |
| `pressure.inspect()` | gauge sprites in `tilesStuff.png` | 1 | needle sweeps, readout in panel |
| `archive.search()` | `GUI/Book v2/Book.png` + `Book Turn v7 - 1..5.png` | 5 | page-turn in the familiar panel |
| `gate.charge(id)` *(Room 2)* | `art/portals/spr_*_portal_strip7.png` | **7** | arch ignites — **colour is the human-only channel**, the tool returns no colour |
| `gate.seal(id)` | same, played in reverse | **7** | arch dims to dormant stone |
| `archive.lookup_sigil(x)` | `Icons/Book Sprites/*.png` on a `Book v2` page | 1 | glyph + its lore appear in the familiar panel |
| `resonance.inspect()` | plinth readout from `tilesStuff.png` | 1 | numbers only — deliberately not colours |
| Familiar spends energy | `art/ui/kit/Resource-orbs/Orb_Energy.png` | 1 | orb drains |
| Any tool discovered | `art/ui/kit/Spellbook---Tabs/Tab*_Bottom_*.png` | 1 | new tab slides into the spellbook |

**The tool-discovery moment** (plan §11: *"New capabilities discovered"*) is the demo's hook.
Render it as a new **tab appearing on the spellbook** — Franuka ships 15 bottom tabs
(`Tab01_Bottom_Normal` … `Tab15_Bottom_Normal`, each with a `_Selected` state). One tab per room's
toolset, greyed until discovered.

---

## 5. Characters

### The Adventurer (human player)

**`SwordSearch-Assets/Animations/Character Sprites and Animations/Player/Character sprites/Sorcerer_*.png`**

48×48 frames, Franuka. 25 animations: `idle`, `cast`, `melee`, `ranged`, `push`, `grab`, `mining`,
`jump`, `falling`, `hit`, `die`, `sleeping`, `itemGot`, and — perfect for this game —
`Sorcerer_idle_holding_book.png` (an adventurer carrying the grimoire the familiar lives in).

Alternates, same pack, same style: `Art Assets/Characters/fantasyrpgheroespack/` (Beastmaster, Fox,
Swashbuckler portraits — full sheets are in the Animations folder).

> ⚠️ **`assets/art/heroes/` is a trap.** 813 files, 4 gorgeous animated heroes — but they are
> **side-view platformer** sprites (jump / roll / air-attack, 288×128 canvas). They cannot be used in
> a top-down room. CC0 and beautiful; wrong projection. Leave them.

### The Familiar (AI player) — ✅ **Beholder, purple**

A floating eye bound to the dungeon: it reads instantly as *"sees what you cannot"*, which is the
whole premise. Base path:
`SwordSearch-Assets/Animations/Character Sprites and Animations/Enemies/Beholder Purple/`

Sheets are **32×32 frames** in 4×4 grids (`Beholder_idle.png` 128×128 = 16 sprites). Clips recovered
by the extractor, all at **12 fps**:

| Clip | Frames | Source sheet |
|---|---|---|
| `Idle` | 4 | `Beholder_idle.png` |
| `Walk` | 4 | `Beholder_move.png` |
| `Damage` | 3 | `Beholder_hit.png` |
| `Die` | 2 | `Beholder_hit.png` |
| `Attack` | 12 | `Beholder_attack (purple).png` + others — see warning |

> ⚠️ **The `Attack` clip is authored wrong in the source project.** Purple's clip pulls frames from
> **`Beholder_attack (yellow).png`** as well as its own sheet (Green's does the same). Play it
> naively and the familiar flickers yellow mid-cast. Either remap those frames onto the purple sheet
> — the grids are identical, so it's an index swap — or just don't use `Attack`. The familiar
> doesn't fight; `Idle` + `Walk` + a glow is all the demo needs.

**Portrait for the side panel** — Beholder ships no chatheads, but a portrait exists:
`SwordSearch-Assets/Art Assets/Enemies/EXTRAS/Portraits/Beholder{,_frame,_noOutline}.png` (18×18).

For emotional states in dialogue, pair it with the generic emote set (they're not character-specific):
`Art Assets/Characters/fantasyrpgheroespack/Character portraits & Emotes/Emote_{question,alert,talking,yes,no,nervous,laughing,angry,sleeping}.png` + `DialogBubble_1..3.png`.

Colour variants if purple reads badly against the dungeon palette: `Beholder Green/`, `Beholder Yellow/`.

<details><summary>Alternates considered (not chosen)</summary>

| Candidate | Path | Frame | Note |
|---|---|---|---|
| Fairy | `Enemies/Fairy/` | 16×16 | Only creature that ships its own `Chatheads.png` |
| Imp | `Enemies/Imp/` | 16×16 | Mischievous, classic bound-familiar |
| Faerie Dragon | `Enemies/Faerie Dragon/` | 32×32 | Biggest presence, best for a finale reveal |
</details>

**Familiar portrait for the side panel:**
`Art Assets/Characters/fantasyrpgheroespack/Character portraits & Emotes/` — `Fox.png` (18×16) plus
`Fox (happy|sad|angry|nervous|sleeping).png`, each in `_frame` and `_noOutline` variants, plus
`Empty frame.png`, `DialogBubble_1..3.png`, and 11 `Emote_*.png`
(`question`, `alert`, `talking`, `yes`, `no`, `laughing`, `nervous`, `angry`, `sleeping`).

**Player portrait:** `Player/Chatheads/{Normal,Happy,Angry,Sad,Surprised,Questioning,Worried}.png`
(21×16). Use `Questioning` when the familiar asks the human to describe something — that's the
information-asymmetry beat from plan §8, rendered.

### Enemies / hazards

- **54 creatures**, idle + move + attack + hit + die each:
  `SwordSearch-Assets/Animations/Character Sprites and Animations/Enemies/`
  → `Skeleton`, `Slime`, `Bat`, `Mummy`, `Lich`, `Death Knight`, `Wizard`, `Goblin`, `Imp`,
  `Dragon Red/Green/Black`, `Beholder ×3`, `Owlbear`, `Griffin`, `Troll`, `Cyclops`, `Anubis`, …
- Simple 4-frame versions: `Art Assets/NPCs/Dungeon Creatures/{Bat,Knight,Skeleton,Slime (blue|green|red)}.png` (64×16)
- Undead 3/4-view, 32px: `art/enemies/undead/spr_{Basic,Armored}_Skeleton_*_strip9.png`, `spr_Bone_Archer_*_strip7.png`
- Vermin: `art/enemies/vermin/spr_rat_{1,2}_{idle,walk,bite,death}_strip13.png`

### NPCs

- `Art Assets/NPCs/Townsfolk 1/` — Alchemist, Barmaid, Farmer, Merchant (`_idle` + `_walk`)
- `Art Assets/NPCs/Townsfolk 2/`, `Desert NPCs`, `Winter NPCs`
- Big talking-head portraits (1080×1080, 4 moods each): `art/npc/{scholar,guard,merchant}/`
  — **too large and stylistically apart** from 16px sprites; use only as a full-panel cutscene image,
  if at all. The **Scholar** fits the archive/lore role if you want one.

---

## 6. UI / HUD — `assets/art/ui/kit/` (Franuka RPG UI, 633 files)

Maps almost 1:1 onto the layout in plan §10.

| HUD element | Asset |
|---|---|
| **Familiar energy** (`● ● ○`) | `Resource-orbs/Orb_Energy.png` + `Orb_Frame_Energy.png` (48×48). HP/MP twins exist. |
| Fancy orb frames | `Resource-orbs/DecoratedFrame{1,2}_{Left,Right}.png` (80×80, dragon-headed) |
| **Familiar tool panel** | `Spellbook---Tabs/Spellbook.png`, `Spellbook_WithTabs.png`, `Spellbook_Opening/Closing`, `Spellbook_NextPage/PreviousPage`, `PageFold_Left/Right` |
| **Tool discovery** | `Spellbook---Tabs/Tab01..Tab15_Bottom_{Normal,Selected}` (also Left/Right edges for Tab01–06) |
| Panels / dialog boxes | `Background-boxes/BGbox_01A..04A.png` (48×48, 9-slice) |
| **Turn banner** ("YOUR TURN" / "FAMILIAR TURN") | `Title-banners/BannerMedium_*.png` (48×32), `BannerSmall_*.png` (48×16) — 6 styles × Normal/Pressed/Selected |
| Buttons | `Buttons/Button_{1..6}{A..E}_{Normal,Pressed,Selected}.png` |
| Action-count / progress bars | `Sliders---Bars/Slider{01,02,03}_{Box,Bar01..Bar08,Button}.png` |
| Section rules | `Dividers/Divider_01..11.png` |
| Toggles | `Checkboxes/Checkbox_0{1,2,3}{A,B}_{On,Off,Bullet}.png` |
| Inventory / tool slots | `-tem-slots/Slot_0{1,2,3}_{Empty,Weapon,Potion,Ring,Armor,Shield,…}.png` (16×16) |
| Small UI icons | `Mini-icons/Icon_01..32` × `{plain,_Outline,_Selected}` (96 files) |
| Cursors | `Cursors/Command_{Inspect,Move,Attack,Dialog,Spell,Trade,Message,Settings}.png` — **one cursor per human action verb from plan §4** |
| Cursors, 2× (CSS can't scale cursors) | `art/cursors/Cursor02@2x.png`, `Hand01_Up@2x.png` |
| Whole-kit reference sheet | `art/ui/kit/ui-1x.png` (1024²) and `ui-2x.png` (2048²) — open this first when hunting |

### Secondary UI (SwordSearch, use if you need a second visual register)

- `Art Assets/GUI/Book v2/Book.png` + `Just the inside v2/v3/v4.png` — a large open book, better than
  the Franuka spellbook if the familiar panel is the dominant screen element
- `Art Assets/GUI/Book/Book Turn v7 - 1..5.png` — 5-frame page-turn animation
- `Art Assets/GUI/Wooden Pixel Art GUI/` — Home / Map / Pause / Play / Settings buttons + a 32×32 9-slice
- `Art Assets/GUI/Lucid V1.2/PNG/Shadow/16/` — ~60 clean 16px system icons (Clock, Bookmark, File, Exit, arrows, cursors)
- `Art Assets/GUI/Cryo's Mini GUI/GUI/GUI_1x.png` + `Buttons/buttons_1x_sliced.png` — pre-sliced 9-slice
- `Art Assets/GUI/Free Paper UI System/` — player-status panels *(licence: no redistribution, even modified)*
- `Art Assets/Icons/Basic Icons/` — **210 generic 16px icons**. Use these for tool icons instead of
  the provenance-unknown `art/icons/`.
- `Art Assets/Environment/Town/Objects/Wooden sign (book|magic|skull|potion|sword|shield|leaf|beer).png`
  — themed signposts, good for labelling rooms on a map

---

## 7. FX — feedback when a tool fires

| Need | Path |
|---|---|
| **Elemental spell FX**, 5 schools × ~8 tiers each | `SwordSearch-Assets/Art Assets/Attacks/pixelfx{fire,water,earth,lightning,dark}/` — e.g. `pixelfxdark/{Doom,Seeker,Sorrow,Demon Ritual,Buff}`, `pixelfxlightning/{Chain,Shock,Thunder I/II}` |
| Impact / hit flashes | `art/fx/Retro Impact Effect Pack 5 {A..F}.png` (576×1920 sheets) |
| Named spell strips | `art/fx/{Lightning,Fire-ball,Fire-wall,Explosion,Black-hole,Shield,Spikes,Sun-strike,Midas-touch}.png` |
| Projectiles | `Art Assets/Characters/fantasyrpgheroespack/Projectiles & Breakables/{Fireball,MagicMissile,IceShard,LightningBolt,Arrow,Bomb,Dagger,Boomerang,Spear}.png` (each + `_impact`, some + `_initial`) |
| Breakables | same folder — `Pot`, `Box`, `Grass` × `{,_breaking,_broken}` |
| Slash | `art/fx/vfx_slash-Sheet - Copie.png` |
| Scorch / puddle / footprint decals | `Art Assets/Generic/{Scorch Mark 1,2, Puddle 1,2, Footprint}.png` |
| Portal / gate opening | `art/portals/spr_{dark,fire,holy,ice,lava,lighting,Nature,Void}_portal_strip7.png` (64×64, 7 frames) |
| Torch/fire ambience | `art/hub/lights/spr_fire_toruch_strip3.png`, `spr_cozy_fire_on_strip3.png`, `spr_light_overlay.png` |

---

## 8. Gaps — what does *not* exist here

### Resolved — no purchase needed

| Was missing | Status |
|---|---|
| ~~Telescope~~ | ✅ **Moot.** Room 2 reframed as the Gate Chamber (§3), built from `art/portals/`. |
| ~~Star chart / constellations~~ | ✅ Moot with the same reframe. |
| Rune / arcane symbols | ✅ `Icons/Book Sprites/` — 7 glyphs, each with a "Big Version". Enough for the gate puzzle and Room 1. |
| Three distinct statues | ✅ `art/interior/armory/Spr_Armor_Stand_{1,2,3,4}.png` — 4 distinguishable silhouettes, 32×48. |
| Owl statue specifically | ⚠️ No owl sprite. Swap the plan's worked example to armour stands, or lift `Enemies/Owlbear/` art. Cosmetic. |
| Pressure gauges in a fantasy palette | ✅ CSS recolour, §3 Room 3. |

### Still open — **audio, and only audio**

| Missing | Impact | Fix |
|---|---|---|
| **SFX** | Every mechanism in §4 wants a sound — lever, gate, door, page-turn, portal ignite, energy spend | **CC0, free.** [Kenney](https://kenney.nl/assets) UI + impact packs cover ~90% of it. |
| **Ambience / music** | One dungeon drone carries the whole 2–3 min demo | **CC0, free.** OpenGameArt or Freesound; one loop is enough. |

`SwordSearch-Assets/Sound Effects/` is five files named `test 1–5.mp3` — placeholders, not a library.

> **Budget answer: don't buy anything.** Every visual need is covered by what's already here, and the
> audio gap is fully served by CC0 packs. The one thing worth *considering* — not needed — is a
> licensed spell/ability icon set to replace `art/icons/` (§2, provenance unresolved). Even that is
> avoidable: `Art Assets/Icons/Basic Icons/` gives 210 licensed 16px icons, which is more than the
> 10–15 tools in the plan's scope will ever need.

---

## 9. Fonts

| Font | Path | Notes |
|---|---|---|
| **FantasyRPGtext** | `assets/Assets/Resources/RPG UI pack/Fonts/FantasyRPGtext (size 8).ttf` | ⚠️ Franuka's own — **only at multiples of 8px** (8, 16, 24…). It is a bitmap font; off-multiples turn to mush. |
| **FantasyRPGtitle** | `…/FantasyRPGtitle (size 11).ttf` | ⚠️ **multiples of 11 only** |
| FantasyRPGtitleOutline | `…/FantasyRPGtitleOutline (size 13).ttf` | multiples of 13 |
| PixelifySans-Regular | `…/PixelifySans-Regular.ttf` | true-scaling, safe fallback |
| Public Pixel / Pixel Book Out / outline-pixel7 / Atlantis | `assets/SwordSearch-Assets/Art Assets/Fonts/` | alternates |

Bitmap-sheet versions of the Franuka fonts (if you'd rather render glyphs from an atlas):
`art/ui/kit/Fonts/FontText_{White,Gold,Red,Brown}.png` and `FontTitle_{...}.png`.

Set `image-rendering: pixelated` globally and pin the pixel scale to an integer. Both matter more
than the font choice.

---

## 10. Quick lookup

```bash
# Search everything by keyword (skip Unity metadata)
find assets -iname "*lever*" ! -name "*.meta"

# Query the art/ manifest by category
python3 -c "
import json, collections
d = json.load(open('assets/art/manifest.json'))
by = collections.defaultdict(list)
for i in d['items']: by[i['cat']].append(i)
for x in by['stage/dungeon']: print(x['src'], f\"{x['w']}x{x['h']}\", 'frames:', x['frames'])
"

# Dimensions of any PNG (macOS)
sips -g pixelWidth -g pixelHeight "assets/SwordSearch-Assets/Art Assets/Environment/Dungeon/Lever.png"

# Extract SwordSearch PNGs into a web-servable tree
rsync -a --include='*/' --include='*.png' --exclude='*' \
  "assets/SwordSearch-Assets/Art Assets/" public/art2/
```

### Folder cheat-sheet

> ⚠️ **Correction, found in build.** `Environment/Dungeon/Tileset.png` (448×48) is a **props
> sheet** — doorways, brick wall, chests, torches, potions, keys — *not* a tiling floor/wall
> set. Franuka's other 16px ground tiles (`Town/Tileset/Road_tile.png`, `Dirt_tile.png`) are
> flat colour swatches meant to be tinted, not textured stone.
>
> The room shell therefore uses **MutterPixel's Dark Dungeon kit** at 32px:
> `art/stage/dungeon/spr_catacomb_floor_{1,2,3}.png`, `spr_catacomb_wall_{1,3}.png`,
> `spr_catacomb_door.png`, `spr_catacomb_light_strip3.png` (animated brazier).
>
> **This changes the render scale from the original plan.** The grid is 32px source at
> **2×** (64px tiles), and *everything* renders at 2× — 16px props become 32px (half a
> tile, normal for tile games), 48px characters become 96px, 64px portals become 128px
> (2×2 tiles). One scale factor everywhere keeps pixel density uniform; mixing source sizes
> at a single scale is just how tile games work. See `src/ui/sprites.ts` (`SCALE`, `TILE`).

| Looking for… | Go to |
|---|---|
| A dungeon **mechanism** that animates | `SwordSearch-Assets/Art Assets/Environment/Dungeon/` |
| Room **furniture** | `…/Environment/Interior/Fantasy RPG Interior Pack (16x16 grid).png` |
| **Spooky** dressing (coffins, cobwebs, cauldrons, gravestones, 6 doors) | `…/Environment/Spooky/` |
| **Machinery** (pipes, gauges, valves, panels) | `…/Environment/Sciency stuff/marceles laboratory/` |
| Caves, ladders, science vats | `…/Environment/Custom Stuff/` |
| **Characters**, animated | `SwordSearch-Assets/Animations/Character Sprites and Animations/{Player,Enemies,NPCs}/` |
| **Portraits & emotes** | `…/Art Assets/Characters/fantasyrpgheroespack/Character portraits & Emotes/` |
| **Spell FX** | `…/Art Assets/Attacks/pixelfx*/` |
| **UI** | `assets/art/ui/kit/` — start with `ui-1x.png` |
| Generic **icons** | `…/Art Assets/Icons/Basic Icons/` (210) |
| **Big illustrations** (title cards, map nodes) | `art/hub/ruins/`, `art/town/` |
| Dark 32px dungeon (Direction B) | `art/stage/dungeon/`, `art/world/ruins/`, `art/tiles/decorative.png` |
| Loot, chests, coins | `art/{loot,chests}/` (32px) or `…/Environment/Dungeon/` (16px) |

---

## 11. Decisions — settled 2026-08-30

| # | Question | Answer |
|---|---|---|
| 1 | Art direction | ✅ **Franuka 16px.** Extract from `SwordSearch-Assets/` via §1.3. |
| 2 | Room 3 palette | ✅ **Recolour to brass/copper.** CSS filter first (§3 Room 3). |
| 3 | The familiar | ✅ **Beholder, purple** (§5). Mind the mis-authored `Attack` clip. |
| 4 | Room 2 / telescope | ✅ **Reframed as the Gate Chamber**, existing assets only (§3). |
| — | Buy anything? | ✅ **No.** Audio via CC0 is the only outstanding need (§8). |

### Next steps

1. Run `python3 tools/unity-extract.py --out build --copy-png` to get the web tree + `atlas.json` + `clips.json`.
2. Pin the render scale to **3×** (`image-rendering: pixelated`, 16px source → 48px tiles).
3. Spike the Gate Chamber first — it exercises portals, sigils, the archive book, and the
   tool-discovery beat in one room, and it's the demo's centrepiece.
4. Side-by-side the portals against Franuka tiles (§3 Room 2 warning). Fallback is one line away.
5. Pull CC0 audio once something is on screen.
6. Add a Credits screen with a **franuka.itch.io** link — licence condition, not optional (§2).
