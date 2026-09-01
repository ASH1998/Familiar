# WebMCP Integration

Tools register on `document.modelContext`, not `navigator.modelContext`. Chromium deprecated the
Navigator getter in version 150; the 2026-05-27 spec draft moved the getter to Document, and most
tutorials online still show the old name. `src/webmcp/shim.ts` falls back to the old location, so
older runtimes still work.

Everything registers from the top-level page. Tools inside iframes stay undiscovered.

## Tool discovery as a game mechanic

Entering a room registers its tool set against an `AbortController`. Leaving the room aborts it and
drops the tools. Watch the tool list while walking between rooms and you see the dungeon's
capabilities change.

```ts
// src/webmcp/registry.ts
if (roomController) unregister(roomToolNames, roomController, strategy);
roomController = new AbortController();
for (const def of toolsFor(room)) {
  await mc().registerTool(toWebMCPTool(def, suffix), { signal: roomController.signal });
}
```

`AbortSignal` unregistration landed in Chrome 153. Older builds accept `abort()` and ignore it, so
re-entering a room throws `InvalidStateError` on the duplicate tool name. `detectUnregisterStrategy()`
probes for this at startup and picks one of three paths: the spec `abort`, a non-spec
`unregisterTool(name)`, or per-visit name suffixes as a last resort. The top bar shows the chosen
strategy.

## Playing as the familiar

This page ships no LLM, no API key, and no backend. It registers WebMCP tools and waits. The agent
comes from whatever harness drives the browser. Without a WebMCP-capable client, you can't solve the
dungeon. That's the honest shape of a game whose second player is an agent.

- **ChatGPT desktop app** (shipped Aug 25 2026) or **Codex**: open the deployed HTTPS URL in the
  built-in browser and ask it to play. Both need **GPT-5.6 Sol or Terra**; Luna has WebMCP disabled.
- **Chrome Canary 146+** for development: enable `chrome://flags/#enable-webmcp-testing`, then list
  and invoke tools by hand from the DevTools WebMCP panel or the Model Context Tool Inspector
  extension.
- **Any browser**: the registry also runs locally, so the game loads, renders, and stays solvable
  from the console with no WebMCP client. The local registry and the WebMCP one build from the same
  `ToolDef`s in the same call, and `callTool()` is the single execution path for both, so the rules
  can't diverge between a real client and a test:

```js
df.listTools()                              // what the familiar can call right now
df.callTool("resonance_inspect", {})
df.callTool("gate_charge", { gate: "II" })
df.status()                                 // WebMCP availability + unregister strategy
```

## Admin / demo mode

`Shift + L + A` toggles a demo panel: jump to any of the four rooms, force the phase, refill energy,
force-solve, reset. Rooms normally gate behind solving the previous one. That's right for play and
useless when showing someone the finale in a hurry.
