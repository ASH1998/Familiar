# Progress

Running log for **Dungeon Familiar**. Newest first.
Plan: [PLAN.md](PLAN.md) · Assets: [ASSETS-MAP.md](ASSETS-MAP.md) · Setup: [README.md](README.md)

---

## Status — 2026-08-30

### ✅ Done

**Game**
- All **4 rooms** built and playable end to end: Library → Gate Chamber → Furnace → Familiar Chamber
- Turn system: HUMAN → FAMILIAR → DUNGEON, with action/energy scarcity
- **DUNGEON phase acts** — the wight patrols, contact costs the adventurer a turn
- Movement (click to walk), room transitions through opened doors
- Win state: the familiar is freed

**WebMCP**
- `document.modelContext.registerTool()` with `navigator` fallback for older runtimes
- **Dynamic per-room registration** — the headline mechanic, verified: entering a room swaps the tool set
- Unregister-strategy probe with 3 fallback paths (`abort` → `unregisterTool` → name suffixes)
- **20 distinct tools**: 5 global (senses, voice, pass, 2 ward tools) + 4 per room + 5 in the finale
- Every tool phase-gated; refusals explain what to do instead

**Content & polish**
- Set dressing in every room (pillars, coffins, skulls, rubble) — `walkable: false`, shapes routes
- Sprite pipeline: Unity `.meta`/`.anim` → `atlas.json` (24,883 rects) + `clips.json` (779 clips)
- 40 curated sprites shipped; grid declarations cross-checked against the atlas
- **Admin/demo mode** — `Shift + L + A`: jump rooms, force phase/energy, force-solve, reset

**Quality**
- **45 tests**, typecheck clean, ~40 kB JS build
- Asymmetry invariants tested per room — no tool may leak what only the human can see
- Docs: [PLAN.md](PLAN.md) · [ROOMS.md](ROOMS.md) · [ASSETS-MAP.md](ASSETS-MAP.md) · [README.md](README.md)

### ⏳ Pending

| # | Item | Why it matters |
|---|---|---|
| 1 | Verify against a real WebMCP client | 👤 **User will do on Codex.** All of `src/webmcp/` is still unverified against a client. |
| 2 | ~~Netlify~~ → **own domain + ChatGPT Sites** | Static build, no backend, no keys — deploys anywhere. |
| 3 | Hazard variety per room | 🔵 Optional. The wight is one behaviour reused in 3 rooms. |
| 4 | Audio — SFX + ambient loop | 👤 **User will do next.** |
| 5 | ~~Opening / closing screens~~ | ✅ **Done.** Title = familiar-select with 4 animated cards + affinities; ending card. |
| 6 | ~~Credits screen~~ | 👤 User will add manually. |
| 7 | ~~Animation polish~~ | ✅ **Done.** Tool-call banner over the board (design doc §10) + actions-remaining readout. |

### ❌ Cut

- ~~In-page LLM familiar / Claude API driver~~ — the site ships no LLM, no API key, no backend

---

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-08-30 | **The site ships no LLM, no API key, no backend.** It registers WebMCP tools and waits; the agent comes from the player's harness (ChatGPT, Codex, any `document.modelContext` client). | Removes cost, key management, proxy functions and secret-handling entirely. The familiar is a real second player, not a chatbot bolted on. If the player has no WebMCP-capable harness, the dungeon cannot be solved — that is the honest shape of the thing. |
| 2026-08-30 | Room 2 is **The Gate Chamber**, not the Observatory. | No telescope sprite exists in any asset folder. Portals give a stronger asymmetry and better visuals. |
| 2026-08-30 | The familiar is a **purple Beholder**. | Floating eye = "sees what you cannot". Skip its `Attack` clip — mis-authored upstream, pulls yellow frames in. |
| 2026-08-30 | Render at **2×, 32px grid** (not 16px @ 3×). | Franuka has no usable dungeon floor/wall tiles. Room shell is MutterPixel 32px; one scale factor everywhere keeps pixel density uniform. |
| 2026-08-30 | Tool names use `_`, not `.` (`gate_charge`, not `gate.charge`). | MCP names are conventionally `^[a-zA-Z0-9_-]{1,64}$`. Dotted form kept as UI display text only. |

---

## Open risks

| Risk | Status |
|---|---|
| **WebMCP registration never verified against a real client.** All of `src/webmcp/` is written to spec + Chrome docs but has only run in a browser without WebMCP. | ⏳ Blocks confidence in everything downstream. Do before more rooms. |
| `AbortSignal` unregistration is Chrome 153+; older runtimes silently ignore it and re-entering a room throws on duplicate names. | Mitigated by `detectUnregisterStrategy()` (3 fallback paths), but the fallbacks are also unverified. |
| ChatGPT's browser may behave differently from Chrome Canary. | Unmitigated until step 6. |
| No audio at all. | Deferred by agreement. CC0 packs cover it. |

---

## Log

### 2026-08-30 — Familiar Chamber: overlap fix + staging

**The prison overlapped the exit door.** Both sat in the centre column: the door is drawn into
the back wall spanning y 32–128, and the 64px prison anchored at row 2 spanned y 64–192 — a full
tile of overlap. Moved the prison to row 3, where it starts exactly where the door ends
(verified: `prisonTop 87 === doorBottom 87`).

**Staged the finale properly.** It was the blandest room in the game, which is backwards for the
place the whole thing has been walking towards. Now 29 props: coffins along both walls, chains
hanging near the prison, cobwebs in the corners, bubbling cauldrons, bone piles, rubble.

New sprites: `chains`, `cobweb`, `cauldron`. Two had wrong dimensions in my first pass — cobweb
is 32×32 not 16×16, and the cauldron is 64×16, i.e. **four frames**, so it bubbles.

**Animation.** The chamber is the only room with continuous motion, saved deliberately for the
ending:

- A **binding sigil** turning on the floor beneath the prison — inline SVG, two rings
  counter-rotating at 44s and 31s so it reads as machinery rather than decoration. Drawn rather
  than sprited because a pixel sprite rotated off-axis shimmers.
- **Motes** lifting off the sigil — 14 CSS particles on staggered delays and durations.

Both are pure CSS over existing assets: no new art, and nothing for the engine to know about.

### 2026-08-30 — Portals always glow

Settled: portals and the prison glow permanently. No dimmed "dormant" look. Every attempt to
signal dormancy by darkening the sprite produced washed-out grey, because the art *is* a lit
portal. Only a **sealed** gate dims — that is a finished state and worth showing.

Checked the puzzle still works, since the Gate Chamber depends on the human's eyes: it does.
The familiar still cannot see any colour; the human still has to describe them; the archive is
still the only route from sigil to element. The one change is that the human can now read all
three arches at once instead of one per charge — `gate_charge` is a prerequisite and an energy
cost rather than a reveal. Pacing shifts slightly; the asymmetry does not.

### 2026-08-30 — Dormant portals looked lit but lit nothing

Reported as "does not glow on Chrome". Blending was not the problem — verified in Chromium:
the pools render, `mix-blend-mode: screen` computes, all visible.

The actual bug was mine, introduced when I softened the dormant filter in the lighting pass.
**The portal sprite art depicts a glowing portal whether or not the gate is charged.** With the
dormant filter brightened, a dormant gate looked switched on while casting no light at all —
visually contradictory, and worse, it blurred the lit/dormant distinction, which is the human's
half of the Gate Chamber puzzle.

Fixed by making the lighting match the art rather than fighting it:

- `ALWAYS_GLOWS` (portals, prison) cast a **small faint pool even when dormant** — a quarter of
  the radius, a third of the strength.
- Charged props get the full pool **plus `.prop--lit`**, a slow brightness/bloom pulse. The
  pulse is the cheapest unmistakable "this one is ON" cue.

The gap between the two states is now larger than it was before the lighting pass, not smaller —
which is what the puzzle needs.

### 2026-08-30 — Lighting pass + the door was behind the wall

Two bugs spotted from a screenshot.

**The door was rendering behind the wall.** `spriteAt` assigns `z-index: 10 + row`, so the wall
at row 1 got 11 — and the door was hardcoded to 8. It was being painted over, which read as
clipped/"out of bounds". Now 14. Verified numerically: door spans y 22–87 against the wall's
0–87, bottom-aligned, inside the stage.

**Nothing in the room emitted light.** Dormant props were crushed by
`grayscale(0.85) brightness(0.6)` — enough to turn every arch to near-black slate — and the
braziers were sprites that lit nothing.

- Dormant is now `grayscale(0.45) brightness(0.85)`: cold, but still recognisably carved stone.
- Lit props get `brightness(1.25) saturate(1.3)` plus a bloom.
- Added `lightPool()` — a `mix-blend-mode: screen` radial gradient on the floor, tinted per prop
  (`PROP_LIGHT`): cyan under the ice gate, green under nature, orange under fire, warm amber
  under braziers, gold under an opened door. Blending additively keeps the floor tiles readable
  underneath instead of painting a coloured disc over them.

### 2026-08-30 — Hit feedback, harness briefing, scoring, story doc

Four gaps the user spotted from playing, not from the todo list.

**1. Nothing animated on a hit.** The wight reaching you zeroed your actions and teleported you
to the entrance in total silence. Now: the adventurer plays Unity's Damage clip (frames 4–5 of
`Sorcerer_hit.png` — a contiguous row, so it animates in CSS), the wight plays its attack strip,
and the room shakes with a red vignette. The furnace vent gets the same treatment in gold.

Ordering bug caught immediately: `playFx` ran *after* `renderRoom`, so the shake fired but the
Damage frames never drew. Renamed to `beginFx` and moved to the top of `render()`.

**2. The agent arrived with no instructions.** Added **`read_briefing`** — an always-registered,
never-phase-gated tool whose description begins "READ THIS FIRST". It states what the page is,
that the familiar has no eyes, how a turn works, and gives three concrete opening moves. This is
the WebMCP-native way to orient a harness: not a system prompt we do not control, but a tool the
agent can discover and call.

**3. No sense of progress.** `engine/score.ts`: chambers cleared, rounds, tool calls, missteps,
points and a rank. Shown in the top bar, in `get_game_state` (so the *familiar* can tell whether
it is helping), and as a summary sheet on the ending card.

Deliberate: **refusals are not missteps.** Only real setbacks count — a mechanism reset, a steam
vent, a wight contact. Penalising refusals would teach the agent to guess silently instead of
asking, which is the exact opposite of the game.

**4. [docs/STORY.md](docs/STORY.md)** — the full narrative for the intro, plus voice notes and
liftable lines.

### 2026-08-30 — Tool-call announcement, actions readout, handoff doc

**A real usability bug, not polish:** `humanActions` was tracked and enforced but never
displayed anywhere. Running out of actions looked like the game had stopped responding to
clicks. Now shown in the top bar, red at zero.

**Tool-call announcement** — design doc §10 wanted *"FAMILIAR USED: ROTATE BOOKSHELF III"* over
the board. `GameState.lastTool` carries a `seq` that increments per call, so the banner replays
on a repeat but not on an unrelated re-render. Only successful *acting* calls announce —
banner-ing refusals and read-only lookups would make the board flash constantly and mean nothing.

**[docs/HANDOFF.md](docs/HANDOFF.md)** written for the Codex handover: what is unverified, the
invariants that must not be broken (and why loosening the asymmetry tests is almost always
wrong), where everything lives, and the seven traps that already cost time.

### 2026-08-30 — Visual pass: palette and type from the RUNE GOBLIN reference

The colours read as washed out and the type had no character. Pulled the actual values from
the user's repo (`app/rpg_static/rpg.css`, `frontend/src/styles.css`) rather than eyeballing
the screenshot.

**Palette** — the problem was saturation, not brightness. The old scheme was warm cream/olive
on grey (`--ink: #e8dfc8`, `--ink-dim: #9a917f`); the reference is saturated violet on
near-black:

```
--bg #0e0b14   --panel #1a1426   --ink #e7d9ff   --accent #b07cff
--muted #9c8bc4  --gold #ffd24a  --green #6df5a0  --hp #ff5d73  --border #34254d
```

**Type** — the reference uses **Press Start 2P** for headings and plain mono for prose. We
already had a licensed equivalent in the asset pack: **Public Pixel**, now self-hosted from
`public/fonts/` rather than pulled from a CDN, since the game may run inside an agent's
built-in browser where an external font request is one more thing that can fail silently.
Headings, tabs, tool tags and system lines use it; prose stays mono because a bitmap face is
unreadable in quantity.

**A real bug surfaced while checking the result.** Tool names had silently become
`archive_search_v2`, `bookshelf_rotate_v2`… — `visitSuffix()` fires when the runtime cannot
unregister, but it was not gated on WebMCP actually being present. With no WebMCP the local
registry deletes its own entries cleanly, so the suffix was pure harm: it renamed every tool
out from under `callTool`, which broke the game in exactly the browsers used to develop it.
Now gated on `hasWebMCP()`.

### 2026-08-30 — Title screen: familiar select

Built from the RUNE GOBLIN reference the user shared. The lessons taken: the title screen does
*work* rather than being a splash; the tagline is a hook that raises a question rather than an
explainer; the cards carry **animated** sprites; and each card states what its affinity
mechanically *changes*, not what it is like.

The analogue here is **choose your familiar** — four, each with one affinity:

| | Affinity |
|---|---|
| **Beholder** · The Watcher | 3 energy per turn instead of 2 |
| **Fairy** · The Spark | wards hold the wight 4 rounds instead of 2 |
| **Imp** · The Trickster | first wrong answer in each chamber is forgiven, not reset |
| **Faerie Dragon** · The Loremind | archive lookups return the whole catalogue |

**Hard constraint on perks, written into `familiars.ts`:** no affinity may give the familiar
*sight*. Anything granting perception of colour, bearing, position or which statue is lit would
dissolve the asymmetry the whole game rests on. Perks only touch tempo, duration, forgiveness
and archive depth.

Also: a closing card, and the panel head now follows whichever familiar is bound.

**A rename broke the game and TypeScript could not catch it.** `familiar_idle` became four
`familiar_*` sprites, but `view.ts` still asked for the old key — sprite keys are strings, so
this only surfaced at runtime. The manifest's `throw` on an unknown sprite is what made it
loud rather than silently blank; worth keeping.

Two CSS bugs found by looking: centring a flex container that overflows clips the top of the
content (ate the title on short viewports — fixed with `margin: auto` on an inner wrapper), and
`#title h1` being an id selector meant `.ending h1` never won, so the ending card was the wrong
colour.

### 2026-08-30 — Content pass: the dungeon acts, and the rooms are furnished

The rooms were three props on an empty floor and the DUNGEON phase incremented a counter and
nothing else. Both fixed.

**The wight.** A skeleton patrols a fixed loop; on the dungeon's turn it takes a step, and if it
reaches the adventurer it drives them back to the entrance and costs them their next turn. Not
combat — it cannot be killed and there is no attack (design doc §15 scopes that out) — but the
turn structure now has stakes.

It keeps the same asymmetry as the puzzles, which is what justifies it existing:
`wards_sense` returns **distance and never bearing**; `wards_bind(direction)` needs the bearing,
which only the human can see. A familiar that guesses wastes a ward; one that asks gets two clear
rounds. Both ward tools are global, since the wight follows you between chambers. The Familiar
Chamber has no patrol on purpose — the finale should be quiet.

**Set dressing.** `decor()` in `engine/state.ts`; every room now has pillars, coffins, skulls,
bone piles and rubble. It is `walkable: false`, so it also shapes the route past the wight.

Caught by looking rather than by tests: 64px decor spans two tiles, so `x: 12` in a 13-wide room
overhung the edge, and the top bar wrapped into the stage once the hazard readout was added.

### 2026-08-30 — All four rooms complete + admin mode

Designs written to [ROOMS.md](ROOMS.md) before building, per request.

**Room 3 — The Furnace.** Teaches strategic choice. The furnace supplies a fixed 6 bar split
evenly between open valves, so exactly one valve must be open for anything to move. Gauges
report bar; only the human sees what a conduit *drives*. Two energy buys either
`trap_scan` + one action (safe) or two actions (risky) — a wrong valve at full pressure vents
steam across the walkway and costs the adventurer their next turn. Both routes finish, so
haste is punished rather than blocked.

**Room 4 — The Familiar Chamber.** All Room 1–3 tool *names* are re-registered alongside the
binding tools, so the familiar's whole vocabulary returns at once. Three seals, each bound to
an earlier room's mechanism, each needing a value only the human can read off its rim.

Then the ending: `binding_release` refuses until the adventurer is **standing at the prison**.
No tool moves the human, and the familiar cannot see where they are — so the last action of the
game is the human walking over because the familiar asked. Verified:

> *"The seals are broken, but the binding will not answer from across the chamber. It needs a
> hand on it, and you have none. The adventurer must be standing at the prison."*

`tests/endgame.test.ts` asserts no chamber tool can reposition the player — if one could, the
ending would not need a human at all.

**Movement** added (click to walk, costs an action) because Room 4 requires it.

**Admin mode — `Shift + L + A`.** Jump to any room, force phase/energy, force-solve, reset.
Rooms are otherwise gated behind solving the previous one, which is right for play and useless
for demoing Room 4 to someone. Not behind a build flag — the point is to demo from the
production build. It ignores keystrokes aimed at the message input.

**Two visual bugs found by looking at it:** valves rendered frame 0 regardless of state (added
a `frame` argument to `paint()`), and the bridge sat there looking finished before it extended
(now near-transparent until it does).

A test of mine was wrong again, and it was worth the catch: I asserted a divided-pressure state
straight after opening one valve, but the *first* valve opened always takes the full 6 bar — a
divided state is only reachable after a single-valve event. The test now walks a path that
actually occurs in play.

### 2026-08-30 — Room 1 + room transitions: the headline mechanic works

The Clockwork Library is playable, and walking through an opened door now swaps the
registered tool set. Verified in-browser:

```
BEFORE: get_game_state, speak_to_adventurer, end_familiar_turn,
        archive_search, statue_inspect, bookshelf_rotate, gate_inspect_lock
AFTER : get_game_state, speak_to_adventurer, end_familiar_turn,
        resonance_inspect, archive_lookup_sigil, gate_charge, gate_seal
```

Globals persist; room tools are withdrawn and replaced. The panel logs
`CAPABILITIES CHANGED — 4 TOOLS WITHDRAWN, 4 DISCOVERED: …`, which is the demo beat from
design doc §11. Spellbook tabs light as rooms are discovered.

**Library puzzle** — one statue is lit at a time with a mark carved beneath (crescent / eye /
spiral). Only the human sees which statue and which mark; only the familiar can read the
archive (mark → bearing) and turn the bookshelf. Three correct bearings in a row opens the
gate; a wrong one resets. Marks are inline SVG, same approach as the gate sigils.

The game now starts in the Library so the progression runs in narrative order.

`won` now fires only in the final chamber — previously any solved room ended the game, which
would have stopped play at the first door.

Second test-side false positive caught and fixed: `\b[ABC]\b` with the `i` flag matches the
English word "a", so the lit-statue assertion fired on "lit **a**t a time". Tightened to the
real leak shape (a statue id adjacent to "lit" in one sentence) rather than loosened.

### 2026-08-30 — Cut the second driver, and every API dependency with it

The site works only with a WebMCP-capable harness — ChatGPT's built-in browser, Codex, or
anything else implementing `document.modelContext`. No LLM ships in the page, no API key, no
proxy, no backend. Plan step 5 removed and §8 rewritten.

The local tool registry stays, but it is **not** a fallback agent: it is what keeps the game
playable and unit-testable in a browser with no WebMCP, and it keeps `callTool()` as the
single execution path so the rules cannot diverge between a real client and a test.

### 2026-08-30 — Gate Chamber playable end to end

Charge → describe → look up sigil → seal in element order → door opens. Verified in-browser
through the tool layer; no colour leaked in any response.

- `src/engine/` — pure state machine, imports nothing from `webmcp/` or `ui/`
- `src/webmcp/` — `document.modelContext` registration + unregister-strategy probe
- `src/ui/` — DOM/CSS sprites, 2× scale, fit-to-viewport
- 7 tools live: 3 global + 4 room

**Corrections to ASSETS-MAP found while building** (both now fixed in that doc):

1. `Icons/Book Sprites/` are colour-coded **book covers**, not elemental glyphs. Gate sigils
   are inline SVG instead.
2. `Environment/Dungeon/Tileset.png` is a **props sheet**, not floor/wall tiles — and
   Franuka's other 16px ground tiles are flat colour swatches. Room shell switched to
   MutterPixel's 32px Dark Dungeon kit, which is what forced the 2× scale decision.

The asymmetry test caught a real leak: `archive_lookup_sigil` echoed the agent's own query
back into its response. Fixed in the tool rather than by loosening the test — echoing
untrusted input is how a genuine leak arrives later.

### 2026-08-30 — Asset extraction

`tools/unity-extract.py` parses Unity `.png.meta` and `.anim` sidecars without Unity:
**24,883 sprite rects** across 1,067 hand-sliced sheets, **779 animation clips**, 26
unresolved frames (99.9%). This is the only source of truth for character frame layout —
`Sorcerer_idle.png` is a 4×4 grid of 16, not the 4-frame strip its dimensions suggest, and
its `Idle` clip plays only frames 8–11.

`scripts/copy-assets.mjs` copies the ~22 sprites actually used into `public/art/` and
cross-checks every grid declaration against the atlas.
