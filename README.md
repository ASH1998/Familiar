# Dungeon Familiar

A turn-based co-op dungeon where a **human** manipulates the physical room and an **AI familiar**
manipulates the dungeon's hidden systems through [WebMCP](https://webmachinelearning.github.io/webmcp/).

Each room registers a different set of WebMCP tools, so **discovering tools is the progression
mechanic**. Neither player can finish a room alone — the familiar has no eyes, and the human has no
access to the machinery.

- **[How to play](docs/HOW-TO-PLAY.md)** — the loop and the keys
- **[Story](docs/STORY.md)** — narrative, voice notes, intro copy
- **[Handoff](docs/HANDOFF.md)** — invariants, traps, what is unverified
- Design: [Dungeon Familiar — WebMCP Game Plan.md](<Dungeon Familiar — WebMCP Game Plan.md>)
- Room designs: [ROOMS.md](ROOMS.md)
- Build plan: [PLAN.md](PLAN.md) · Progress: [progress.md](progress.md)
- Asset reference: [ASSETS-MAP.md](ASSETS-MAP.md)

---

## Run it

```bash
npm install
npm run assets:extract   # parses Unity .meta/.anim -> build/atlas.json + clips.json
npm run assets:copy      # copies the ~22 sprites we use -> public/art/
npm run dev
```

`assets:extract` needs Python 3 and the `assets/` folder. Both asset steps only need re-running when
`scripts/copy-assets.mjs` changes.

```bash
npm test         # engine + asymmetry invariants
npm run build    # typecheck + production build
```

---

## The WebMCP integration

Tools are registered on `document.modelContext` — **not** `navigator.modelContext`, which is
deprecated as of Chromium 150. The getter moved from Navigator to Document in the 2026-05-27 spec
draft; most tutorials online still show the old name. `src/webmcp/shim.ts` falls back to the old
location so older runtimes still work.

Everything is registered from the **top-level page**: tools inside iframes are not discovered.

### How tool discovery becomes a game mechanic

Entering a room registers its tool set against an `AbortController`; leaving aborts it, dropping the
tools. Watch the tool list while walking between rooms and you can see the dungeon's capabilities
change.

```ts
// src/webmcp/registry.ts
if (roomController) unregister(roomToolNames, roomController, strategy);
roomController = new AbortController();
for (const def of toolsFor(room)) {
  await mc().registerTool(toWebMCPTool(def, suffix), { signal: roomController.signal });
}
```

`AbortSignal` unregistration landed in **Chrome 153**. On older builds `abort()` is accepted and
ignored, so re-entering a room would throw `InvalidStateError` on the duplicate name.
`detectUnregisterStrategy()` probes for this at startup and picks one of three paths — `abort`,
a non-spec `unregisterTool(name)`, or per-visit name suffixes as a last resort. The chosen strategy
is shown in the top bar.

### Playing as the familiar

**This page ships no LLM, no API key and no backend.** It registers WebMCP tools and waits — the
agent comes from whatever harness you are running. If you have no WebMCP-capable client, the dungeon
cannot be solved, which is the honest shape of a game whose second player is an agent.

**ChatGPT desktop app** (shipped Aug 25 2026) or **Codex** — open the deployed HTTPS URL in the
built-in browser and ask it to play. Requires **GPT-5.6 Sol or Terra**; Luna has WebMCP disabled.

**Chrome Canary 146+** for development: enable `chrome://flags/#enable-webmcp-testing`, then use the
DevTools WebMCP panel or the Model Context Tool Inspector extension to list and invoke tools by hand.

**Any browser**: the registry is also maintained locally, so the game loads, renders and stays
solvable from the console without WebMCP. This is not a second agent and not a mock — the local
registry and the WebMCP one are built from the same `ToolDef`s in the same call, and `callTool()` is
the single execution path for both, so the rules cannot diverge between a real client and a test:

```js
df.listTools()                              // what the familiar can call right now
df.callTool("resonance_inspect", {})
df.callTool("gate_charge", { gate: "II" })
df.status()                                 // WebMCP availability + unregister strategy
```

### Admin / demo mode

**`Shift + L + A`** toggles a demo panel: jump to any of the four rooms, force the phase, refill
energy, force-solve, reset. Rooms are normally gated behind solving the previous one, which is right
for play and useless when showing someone the finale in a hurry.

---

## Design invariants

**The engine is the referee.** An external agent has no idea whose turn it is, so every tool passes
through `guard()` first and refusals explain what to do instead:

> *"You have no energy left this turn. Call end_familiar_turn to pass, and you will regain 2 energy
> on your next turn."*

Refusals are not error handling — they are how the agent learns the rules without any prompt
engineering. `get_game_state` is deliberately exempt from the phase check so an agent can always
find out why it was refused.

**The familiar has no eyes.** No tool response may reveal what only the human can see. In the Gate
Chamber, `gate_charge` returns *"Gate II is charged"* and nothing else — the colour and the sigil
reach the familiar only if the human describes them. This is one careless template literal away from
collapsing, so `tests/asymmetry.test.ts` runs every tool against every plausible input and fails the
build on any colour word. Tool responses also never echo agent-supplied input back, which is the
other way a leak gets in.

**`engine/` imports nothing from `webmcp/` or `ui/`.** The rules stay pure and testable, and the
agent can only reach state through defined tools.

---

## Credits

Art by **[Franuka](https://franuka.itch.io/)** (RPG UI pack, Fantasy RPG series) — crediting
franuka.itch.io is a licence condition of that pack, not a courtesy. Dungeon tiles, portals and
props by **MutterPixel Studio**. Full attribution and licence terms in
[ASSETS-MAP.md](ASSETS-MAP.md) §2.
