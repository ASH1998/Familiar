# Dungeon Familiar — Development & WebMCP Integration Plan

## Context

We have a design doc (`Dungeon Familiar — WebMCP Game Plan.md`), a fully-mapped asset library
(`ASSETS-MAP.md`), and an asset extractor (`tools/unity-extract.py`). **There is no code yet** — the
repo is three files plus `assets/`. This plan covers building the game and wiring it to WebMCP.

The premise: a turn-based co-op dungeon where the **human** manipulates the physical room and an **AI
familiar** manipulates the dungeon's hidden systems through WebMCP tools. Each room registers a
different tool set, so *tool discovery is itself the progression mechanic*.

**Two findings from research reshaped the approach:**

1. **The API moved.** It is `document.modelContext.registerTool()`. `navigator.modelContext` is
   deprecated (Chromium 150); the getter moved from Navigator to Document in the May 27 2026 draft.
   Most tutorials online still show the old name.
2. **ChatGPT's desktop browser really does consume WebMCP tools** — shipped Aug 25 2026, and Codex
   with it. The familiar is therefore a genuinely external agent, and the page needs no LLM, no API
   key and no backend of its own.

Scope confirmed: **all four rooms**, DOM+CSS rendering, and **no LLM in the page** — the site
registers WebMCP tools and waits for the player's own harness (ChatGPT, Codex, anything
implementing `document.modelContext`) to supply the agent. See §8.

---

## 1. Stack

| Choice | Why |
|---|---|
| **Vite + TypeScript**, no UI framework | Fast dev server, static build. The game is a handful of DOM nodes and a state machine — React earns nothing here. |
| **DOM + CSS sprites** | Confirmed. Tiles/props are positioned `div`s with `background-image`; animation via CSS `steps()`. The HUD and world share one layout system. |
| **Netlify** deploy | WebMCP requires HTTPS (localhost counts as secure). Netlify is a challenge sponsor with a prize pool. |
| **Vitest** for engine tests | The engine is pure functions — cheap to test, and the asymmetry invariants (§5) genuinely need it. |

---

## 2. File layout

```
src/
  engine/                 pure state machine — no DOM, no WebMCP imports
    state.ts              GameState, RoomState, Phase, entity types
    turn.ts               phase machine: HUMAN -> FAMILIAR -> DUNGEON
    actions.ts            applyHumanAction / applyFamiliarTool / resolveDungeon
    rooms/                room data + puzzle logic (one file per room)
      library.ts  gates.ts  furnace.ts  chamber.ts
  webmcp/
    registry.ts           room tool-set <-> document.modelContext lifecycle
    shim.ts               feature detection + unregister fallbacks
    tools.ts              ToolDef type; maps engine actions to WebMCP tools
  ui/
    render.ts             room -> DOM diff
    sprites.ts            atlas.json lookup + CSS animation helpers
    hud.ts                energy orbs, turn banner
    panel.ts              spellbook: tool log, familiar speech, discovered tabs
  main.ts
public/art/               curated sprites only (see §7)
scripts/copy-assets.mjs   copies the used-sprite list out of assets/
tools/unity-extract.py    exists
```

**Hard rule:** `engine/` imports nothing from `webmcp/` or `ui/`. Tools and renderers depend on the
engine, never the reverse. This is what makes the rules testable and keeps the agent from reaching
into arbitrary state — plan §12's determinism requirement.

---

## 3. The WebMCP layer

### Registration

```ts
// webmcp/shim.ts
export const mc = () => document.modelContext ?? (navigator as any).modelContext;
export const hasWebMCP = () => typeof mc()?.registerTool === "function";
```

ChatGPT's docs specify exactly this feature-detect. **Tools must be registered in the top-level
page — tools inside iframes are not discovered.**

### Dynamic registration is the core mechanic

Each room owns an `AbortController`. Entering registers its tools with `{ signal }`; leaving calls
`controller.abort()`, which unregisters them.

```ts
// webmcp/registry.ts
let current: AbortController | null = null;

export async function enterRoom(room: RoomId, ctx: EngineCtx) {
  current?.abort();                       // drop the previous room's tools
  current = new AbortController();
  for (const def of TOOLS_BY_ROOM[room]) {
    await mc().registerTool(toWebMCPTool(def, ctx), { signal: current.signal });
  }
}
```

**Three gotchas that will bite:**

- **AbortSignal unregistration landed in Chrome 153.** If the runtime is older, `abort()` won't
  unregister and re-entering a room throws `InvalidStateError` on the duplicate name. `shim.ts` must
  try `signal`, fall back to `unregisterTool(name)` if present, and otherwise namespace tool names
  per visit as a last resort.
- **Duplicate names throw.** Always unregister before re-registering.
- **Name tool functions `archive_search`, not `archive.search`.** MCP names are conventionally
  `^[a-zA-Z0-9_-]{1,64}$`; dots are a risk not worth taking. Keep the dotted form as display text in
  the UI, where the design doc's aesthetic actually matters.

### Return values

Chrome's docs show `execute` returning **a string**; the spec says `Promise<any>`. Return strings —
it satisfies both. Every tool returns prose the agent can reason about, including refusals.

---

## 4. Turn system, and why refusals matter

An external agent can call a tool at any moment; it has no idea whose turn it is. **The engine is the
referee, and tool responses teach the rules.**

```
HUMAN (n actions) -> FAMILIAR (n energy) -> DUNGEON (deterministic) -> repeat
```

Every tool passes through one guard before it does anything:

```ts
if (state.phase !== "FAMILIAR")
  return "It is not your turn. The adventurer is still acting.";
if (state.familiarEnergy <= 0)
  return "You have no energy left this turn. Call end_familiar_turn to pass.";
```

This makes the design doc's §9 scarcity real, and it means a well-behaved agent learns the loop from
the tools themselves — no prompt engineering required.

**Always-registered tools** (never unregistered, they're the familiar's senses and voice):

| Tool | Purpose |
|---|---|
| `get_game_state` | Turn, phase, energy, room name, tools discovered. **Deliberately not visual.** |
| `speak_to_adventurer` | Renders the familiar's line into the in-game panel. This is how an *external* agent's voice reaches the screen — essential for the demo and the recording. |
| `end_familiar_turn` | Pass. |

---

## 5. Rooms and tools (~16 total)

Per `ASSETS-MAP.md` §3. Every puzzle must require human info **+** agent capability **+**
communication (design doc §14).

| Room | Tools | The asymmetry |
|---|---|---|
| **1. Clockwork Library** | `archive_search`, `bookshelf_rotate`, `statue_inspect`, `gate_inspect_lock` | Human sees which symbol sits under which statue; archive knows what symbols mean. |
| **2. Gate Chamber** | `gate_charge`, `gate_seal`, `archive_lookup_sigil`, `resonance_inspect` | **`gate_charge` returns only `"Gate II is charged."`** Colour is the human's channel; the archive gives the order by element *name*. Neither side holds both halves. |
| **3. Furnace** | `pressure_inspect`, `valve_set`, `steam_redirect`, `trap_scan` | Familiar reads gauges and reroutes steam; human sees where the hazard actually moved. |
| **4. Familiar Chamber** | `binding_inspect`, `binding_release` + Room 1–3 tools re-registered | Finale: human physically reaches the prison, which unlocks `binding_release`. |

> **Invariant, and it needs a unit test:** no Room 2 tool response may contain a colour word. It is
> the one line of code that makes or breaks the room's whole point, and it is exactly the kind of
> thing that gets "helpfully" broken later. Test it: assert no response matches
> `/cyan|blue|green|orange|red|gold|purple/i`.

---

## 6. Rendering

- Room = CSS-grid of 16px tiles rendered at **3×** (48px), `image-rendering: pixelated`.
- Props/entities absolutely positioned; z-order by row.
- Sprite animation: `background-position` + `animation: steps(n)`. A 7-frame portal is ~4 lines.
- Tool feedback is a promise chain: `executeTool` resolves *after* its animation finishes, so the
  agent's next call sees a settled world.
- Panel: Franuka spellbook (`art/ui/kit/Spellbook---Tabs/`) — one tab per room's tool set, greyed
  until discovered. **This is the demo's money shot**: a tab lighting up as tools register.

---

## 7. Assets

Do **not** ship all 3,889 PNGs. Curate:

1. `pnpm assets:extract` → `tools/unity-extract.py --out build --copy-png`, producing `atlas.json`
   (24,883 sprite rects) and `clips.json` (779 clips, 12fps).
2. `src/ui/sprites.ts` holds a **manifest of used sprites**; `scripts/copy-assets.mjs` copies only
   those into `public/art/`.
3. Character frame layout comes from `atlas.json`, never from dimensions —
   `ASSETS-MAP.md` §1.2 documents why the obvious guess is wrong (`Sorcerer_idle.png` is a 4×4 grid
   of 16, not a 4-frame strip).
4. **Skip the Beholder `Attack` clip** — it is mis-authored upstream and pulls yellow frames into the
   purple animation (`ASSETS-MAP.md` §5). `Idle` + `Walk` is all the familiar needs.

Credits screen with a **franuka.itch.io** link is a licence condition, not a nicety (`ASSETS-MAP.md` §2).

---

## 8. How the familiar connects

**The page ships no LLM, no API key, and no server.** It is a static site that registers
WebMCP tools and waits. The agent is supplied by whatever harness the human is using.

Any WebMCP-capable client can play it:

| Client | Status |
|---|---|
| **ChatGPT desktop app**, built-in browser | Shipped 2026-08-25. Requires **GPT-5.6 Sol or Terra** — Luna has WebMCP disabled. |
| **Codex** | Discovers and uses site tools in the same built-in browser. |
| **Chrome Canary 146+** | `chrome://flags/#enable-webmcp-testing`, then the DevTools WebMCP panel or the Model Context Tool Inspector extension. Manual invocation — good for development. |
| Anything else implementing `document.modelContext` | Works by construction. |

Consequences worth stating, because they simplify everything downstream:

- **No API keys**, no `.env`, no secret to keep out of git, no proxy function, no per-play cost.
- **No backend.** Netlify serves static files; there is nothing to deploy but `dist/`.
- The registry is still maintained locally as well as mirrored into `document.modelContext`.
  That is not a fallback agent — it is what keeps the game **playable and unit-testable** in a
  browser with no WebMCP, and it keeps `callTool()` as the single execution path so the rules
  cannot diverge between a real client and a test.
- If the human has no WebMCP-capable harness, the dungeon simply cannot be solved. That is the
  honest shape of the thing: the familiar is a real second player, not a chatbot bolted on.

## 9. Build order

Each step ends somewhere demoable.

1. **Scaffold** — Vite+TS, asset extraction, `copy-assets`, one room rendering from tile data.
2. **Engine** — state, phases, energy, human actions. Playable solo, no agent.
3. **WebMCP spike** — register two Room 2 tools; verify in Chrome Canary
   (`chrome://flags/#enable-webmcp-testing` + Model Context Tool Inspector + DevTools WebMCP panel).
   *Do this early — it de-risks everything downstream.*
4. **Gate Chamber complete** — 4 tools, portal animations, sigils, archive page, win state.
   **The whole interaction model is proven here.**
5. **Agent end-to-end** — deploy to Netlify, play it through ChatGPT/Codex's built-in browser.
   Fix what breaks. *Do this before building more rooms — it validates the whole WebMCP layer.*
6. **Room 1 (Library)** — proves dynamic registration: tools swap on transition, a new tab lights up.
7. **Rooms 3 & 4** — Furnace, then the finale.
8. **Polish** — turn banners, tool-call animations, credits, opening/closing text.

---

## 10. Verification

| Layer | How |
|---|---|
| Engine | `vitest` on pure reducers: phase transitions, energy exhaustion, refusal paths, and the Room 2 colour-leak invariant (§5). |
| Registration | Chrome Canary + `chrome://flags/#enable-webmcp-testing`; DevTools WebMCP panel shows live tools. Assert count changes on room transition — that IS the mechanic. |
| Tool behaviour | Model Context Tool Inspector: invoke each tool manually with edge-case args; confirm refusals when out of phase or out of energy. |
| End-to-end | ChatGPT or Codex built-in browser (Sol/Terra) on the Netlify URL, played cold without coaching. If the agent can't infer the loop from tool descriptions and refusals, the descriptions are wrong. |
| No-WebMCP browser | Game still loads, renders, and is solvable via `df.callTool()` in the console — proves the engine is independent of the transport. |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Agent ignores turns and spams tools | Engine refuses out-of-phase calls with an explanatory string. Refusals are a feature. |
| `AbortSignal` unregistration unsupported in the runtime | `shim.ts` fallback chain (§3). Verify in step 3, not step 7. |
| ChatGPT's browser behaves differently from Chrome Canary | Step 6 is deliberately early; don't leave the real client until the end. |
| Agent solves rooms alone | Enforce asymmetry in the tool layer — no colours, no positions, no visual state. Unit-tested. |
| Scope | Steps 1–6 are a complete submission on their own. Rooms 3–4 are additive. |
| Player has no WebMCP-capable harness | Accepted by design — the familiar is a real second player. The page says so plainly in its status bar. |
| Portal style clash (`ASSETS-MAP.md` §3) | 10-min side-by-side in step 4; Franuka door fallback is one line. |
