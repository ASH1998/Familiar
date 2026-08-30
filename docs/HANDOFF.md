# Handoff

For whoever picks this up next (Codex). Read this before changing anything in `src/engine/`.

---

## 1. The one thing that is not verified

**No part of `src/webmcp/` has ever run against a real WebMCP client.**

It is written against the spec and Chrome's docs, and it works against the local registry, but
nothing here has been exercised by ChatGPT's or Codex's built-in browser. Four rooms of tool
registration sit on top of it.

**Do this first**, before any feature work:

1. Deploy the static build (`npm run build` → `dist/`). No backend, no env vars, no keys.
2. Open it in ChatGPT desktop / Codex's built-in browser (**GPT-5.6 Sol or Terra** — Luna has
   WebMCP disabled) and ask the agent to play.
3. Check in order:
   - Does `document.modelContext.registerTool` accept our tool shapes at all?
   - Does the tool list actually *change* when the human walks through a door? That is the
     headline mechanic; if unregistration silently no-ops, every room after the first breaks.
   - What does `detectUnregisterStrategy()` report? The top bar prints it.
   - Does the agent infer the turn loop from tool descriptions and refusals, with no coaching?

If (4) fails, **the fix is the tool descriptions, not the game.** They are the entire interface.

---

## 2. Invariants — do not break these

### The familiar has no eyes

No tool response may contain anything only the human can perceive: colour, bearing, position,
which statue is lit, what a conduit physically does. This is not flavour — it is the entire
design. If a tool leaks it, the agent solves the room alone and the game has no reason to exist.

Guarded by `tests/asymmetry.test.ts`, `library.test.ts`, `wight.test.ts`. **If one of those
fails, the code is wrong, not the test.** Both times I loosened an assertion during development
it was because the *test* was badly written (an `\b[ABC]\b` regex matching the English word
"a"), never because the leak was acceptable.

Two ways it sneaks back in:
- Adding a helpful detail to a tool response because it "reads better".
- **Echoing agent-supplied input back into prose.** Already caused one real failure. Tools
  deliberately do not repeat the query they were given.

### Familiar perks may not grant perception

`src/engine/familiars.ts` has a comment saying this. A perk like "senses the wight's bearing"
is the obvious next one to add and it would dissolve the game. Perks touch tempo, duration,
forgiveness and archive depth only.

### `engine/` imports nothing from `webmcp/` or `ui/`

Keeps the rules pure and testable, and means the agent can only reach state through defined
tools. `webmcp/registry.ts` and `ui/` depend on the engine, never the reverse.

### `callTool()` is the single execution path

WebMCP's `execute` callback and everything else land there. Do not add a second way to run a
tool, or the rules will diverge between a real client and a test.

---

## 3. Where things are

```
src/engine/          pure state machine — no DOM, no WebMCP
  state.ts           GameState, RoomState, Prop, decor()
  turn.ts            HUMAN -> FAMILIAR -> DUNGEON, guard(), spendEnergy()
  tools.ts           ToolDef contract
  global.ts          always-on tools: sense, speak, pass
  wight.ts           the dungeon's own move + ward tools
  familiars.ts       the four selectable familiars and their perks
  game.ts            createGame(), TOOLS_BY_ROOM
  rooms/             library · gates · furnace · chamber
src/webmcp/
  shim.ts            feature detect, unregister-strategy probe
  registry.ts        room tool-set lifecycle, callTool()
src/ui/              sprites · view · title · admin
scripts/copy-assets.mjs   the list of every sprite and font we ship
tools/unity-extract.py    Unity .meta/.anim -> atlas.json + clips.json
```

Docs: [ROOMS.md](../ROOMS.md) (puzzle designs) · [ASSETS-MAP.md](../ASSETS-MAP.md) (8,000 files,
licences, traps) · [PLAN.md](../PLAN.md) · [progress.md](../progress.md) ·
[HOW-TO-PLAY.md](HOW-TO-PLAY.md)

---

## 4. Traps that already cost time

| Trap | Detail |
|---|---|
| **Sprite keys are strings** | Renaming one in `copy-assets.mjs` without updating `view.ts` compiles fine and breaks at runtime. `meta()` throws loudly on purpose — keep that. |
| **Character sheets are grids, not strips** | `Sorcerer_idle.png` is 4×4 of 16, not a 4-frame strip, and its Idle clip plays only frames 8–11. Never infer frame layout from dimensions; read `build/atlas.json`. |
| **`visitSuffix` must stay gated on `hasWebMCP()`** | It renames tools per room-visit as a last-resort fallback. Ungated, it silently renamed every tool out from under `callTool` in browsers without WebMCP — i.e. the ones used to develop. |
| **64px decor spans 2 tiles** | `x: 12` in a 13-wide room overhangs the edge. Max is 11. |
| **`Icons/Book Sprites/` are book covers** | Not elemental glyphs, despite the names. Sigils are inline SVG in `view.ts`. |
| **`Environment/Dungeon/Tileset.png` is a props sheet** | Not floor tiles. The room shell is MutterPixel 32px; everything renders at `SCALE = 2`. |
| **Beholder's `Attack` clip is mis-authored upstream** | Pulls yellow frames into the purple sheet. Unused; do not reach for it. |

---

## 5. What is left

| Item | Notes |
|---|---|
| **Verify against a real client** | §1. Blocks confidence in everything else. |
| Deploy to own domain / ChatGPT Sites | Static; nothing to configure. |
| Audio — SFX + one ambient loop | Nothing usable in `assets/` (5 files named `test 1–5.mp3`). CC0 packs cover it. |
| Credits screen | **Licence condition**, not a courtesy: the Franuka pack requires a link to franuka.itch.io. See ASSETS-MAP §2. |
| Hazard variety per room | Optional. One wight behaviour is reused in 3 rooms — it gives the turn cycle stakes but every room asks the human the same question ("which bearing?"). ROOMS.md sketches a per-room alternative. |

Also in ASSETS-MAP §2: `art/ui/`, `art/ui/borders/`, `art/pickups/`, `art/misc/` and `art/icons/`
are flagged **do not use** — one contains a Riot Games sprite sheet. Nothing currently ships
from them; keep it that way.

---

## 6. State of the build

45 tests · typecheck clean · ~47 kB JS. All four rooms playable end to end, title screen,
ending card, admin mode on `Shift + L + A`.
