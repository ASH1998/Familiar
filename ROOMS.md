# Room designs

Every room must satisfy design doc §14: **human information + agent capability + communication**.
If either player can solve it alone, the room is broken.

The recurring test: *could the familiar solve this with no human in the room?* If yes, some tool is
leaking what only eyes can see. Each room has a matching guard in `tests/`.

| Room | Teaches | Status |
|---|---|---|
| 1. Clockwork Library | The basic loop: describe → look up → act | ✅ built |
| 2. Gate Chamber | Incomplete information — the familiar is blind | ✅ built |
| 3. Furnace | Strategic choice — actions cost, mistakes cost more | ✅ built |
| 4. Familiar Chamber | Everything at once, plus physical presence | ✅ built |
| The wight | The dungeon takes a turn of its own | ✅ built |

---

## Room 1 — The Clockwork Library ✅

Three statues, one lit at a time, each with a mark carved beneath (crescent / eye / spiral). A
bookshelf on a turntable.

- **Human only:** which statue is lit, and which mark is on it.
- **Familiar only:** the archive's mark → bearing mapping, and the turntable.

`archive_search(mark)` · `statue_inspect(statue)` · `bookshelf_rotate(direction)` ·
`gate_inspect_lock()`

Three correct bearings in a row opens the gate; a wrong one resets to zero.

---

## Room 2 — The Gate Chamber ✅

Three portal arches. Sealing order is fixed by element name; which arch is which element is
visible only as colour and sigil.

- **Human only:** what colour each lit arch burns, and the sigil beneath it.
- **Familiar only:** the required sealing order, and the sigil → element mapping.

`resonance_inspect()` · `archive_lookup_sigil(sigil)` · `gate_charge(gate)` · `gate_seal(gate)`

`gate_charge` returns *"Gate II is charged"* and nothing more.

> Rendering note: the arches glow permanently — there is no dimmed dormant look. Charging is a
> prerequisite and an energy cost, not a visual reveal. The human can read all three colours
> from the start; the familiar still cannot read any of them.

---

## Room 3 — The Furnace ✅

**Teaches:** strategic choice. Design doc §7: *"The player needs steam to power a bridge. But
redirecting steam may activate another hazard."*

### The room

A collapsed span the adventurer must cross. A steam bridge can be driven out across it, but only at
full pressure. Three valves (**A**, **B**, **C**) feed three conduits; the furnace supplies a fixed
**6 bar** total, divided evenly among whichever valves are open.

- 3 valves open → 2 bar each → nothing moves
- 2 valves open → 3 bar each → nothing moves
- **1 valve open → 6 bar → that conduit acts**

So exactly one valve must be open. Which one drives the bridge is not knowable from the valve side.

### The asymmetry

| Familiar sees | Human sees |
|---|---|
| Pressure per valve, in bar | Which conduit is actually moving |
| Which valves are open | The bridge extending, or scalding steam across the walkway |
| That a conduit ruptures above 5 bar | Where it is safe to stand |

`pressure_inspect()` reports numbers and open/closed state — never what a conduit *does*.
The human must say *"the bridge is grinding outward"* or *"steam just blew across the walkway."*

### The strategic choice

This is the room's point. The familiar has **2 energy** per turn, and:

| Tool | Cost | Effect |
|---|---|---|
| `pressure_inspect` | free | bar per valve, open/closed |
| `trap_scan` | **1** | names which conduit will rupture at the *current* pressure — before you commit |
| `valve_set(valve, state)` | **1** | open or close one valve |
| `steam_redirect(conduit)` | **1** | force the main flow to a named conduit |

Two energy buys either **scan then act** (safe, slow — 3 turns minimum) or **act twice** (fast,
risky). Guessing wrong vents steam across the walkway: the adventurer is driven back to the
entrance and loses their next turn. That is a real cost, so the choice is real.

### Solution shape

1. Familiar opens one valve, human reports what moved. (Costs 1; deduction begins.)
2. Wrong valve → steam vents → human retreats, loses a turn. Familiar has learned one conduit.
3. `trap_scan` before the next attempt avoids repeating the mistake.
4. Correct valve at 6 bar → bridge extends → human crosses.

Three valves means at most two wrong guesses. A careless agent brute-forces it and costs the human
two turns; a careful one scans and loses none. **Both routes finish** — the room punishes haste
without blocking it, which is what makes it a choice rather than a puzzle gate.

### Assets

`lever` (2-frame off/on) per valve · `spr_bridge_4` for the span · **`spr_Traven_fire_strip15`
(15 frames) as the furnace itself**, lighting the room · boiler, workbench, tools, crates,
barrels, logs. Per ASSETS-MAP §3 the lab sheet would need a brass recolour; levers avoid that
entirely and read correctly as valves at this scale.

Each valve's **pipe is drawn to whatever it actually feeds**, and an open one runs bright with
an animated flow plus CSS steam. Human-only by construction — the renderer never reports to a
tool — so the human reads the room instead of reading `look` text, while the familiar still has
only gauges.

---

## Room 4 — The Familiar Chamber ✅

**Teaches:** everything at once, and one thing no tool can do.

Design doc §7: *"The player discovers that the familiar itself is trapped inside the dungeon. Tools
from previous rooms become relevant again. The human must physically reach the familiar's prison."*

### The room

The familiar's body hangs in a void portal at the far end. Three **seals** hold it — and each seal
is a mechanism from a room already visited:

| Seal | Broken by | Room |
|---|---|---|
| Seal of Pages | `bookshelf_rotate` to a bearing the archive names | 1 |
| Seal of Gates | `gate_charge` then `gate_seal` on the right arch | 2 |
| Seal of Steam | `valve_set` to the right pressure | 3 |

**All tools from Rooms 1–3 are re-registered on entry.** The familiar's full vocabulary returns at
once — which is the narrative payoff and, incidentally, the clearest possible demonstration that
WebMCP tool sets are dynamic.

### The finale

`binding_release` is registered **but refuses** until two things are true:

1. All three seals are broken, and
2. **the adventurer is standing at the prison.**

The second is the point. There is no tool that moves the human — the familiar cannot reach the
prison, cannot see the prison, and cannot walk. It has to *ask*. The last action of the game is the
human stepping forward because the familiar asked them to.

```
Human walks to the prison
   → binding_release stops refusing
   → familiar calls it
   → the dungeon opens
```

### The asymmetry

| Familiar sees | Human sees |
|---|---|
| Which seals remain, by name | Which seal each mechanism corresponds to, physically |
| Every Room 1–3 tool | Where the prison is, and where they are standing |
| That the release is refused, and *why* | The familiar's body in the portal |

`binding_inspect()` is free and names the remaining seals. Its refusal text for `binding_release`
does the teaching: *"The seals are broken, but the binding will not answer from across the chamber.
The adventurer must be standing at the prison."*

### Assets

`Spr_Void_Portal_strip7` for the prison (row 3 — row 2 overlaps the exit door) · `brazier` ×3 as
the seals · chains, cobwebs, coffins and bubbling cauldrons as dressing.

Staged with two CSS-only effects, and the only continuous motion in the game: a counter-rotating
**binding sigil** on the floor under the prison (inline SVG — a rotated pixel sprite shimmers),
and **motes** rising off it.

---

## The wight — the dungeon's own move

Design doc §4 Phase 3 wants the dungeon to *act*: *"Skeleton moves 2 tiles. Poison spreads one
tile."* Without it the DUNGEON phase is a counter and the turn structure has no stakes.

**This is not a combat system** (§15 scopes that out). The wight cannot be killed and the
adventurer has no attack. It walks a fixed patrol; if it reaches the adventurer it drives them
back to the entrance and costs them their next turn. Pressure, not a fight.

It carries the same asymmetry as everything else, which is what earns it a place:

| Familiar | Human |
|---|---|
| `wards_sense` — **distance only**, never bearing | Sees exactly where it is and which way it lies |
| `wards_bind(direction)` — holds it 2 rounds if the direction is right | Must read the bearing aloud |

So the hazard is one more reason to talk. A familiar that guesses the bearing wastes energy on a
ward that earths itself; one that asks gets two clear rounds to work.

Both ward tools are **global** — registered for the whole session alongside the familiar's
senses, since the wight follows you between chambers. Patrols are per-room (`RoomState.patrol`);
the Familiar Chamber deliberately has none, so the finale is quiet.

## Set dressing

Every room carries non-interactive decor — pillars, fallen pillars, coffins, skulls, bone piles,
rubble, rock piles — via `decor()` in `engine/state.ts`. It is `walkable: false`, so it also
shapes the route the adventurer has to take past the wight.

> ⚠️ 64px decor (`pillar`, `pillar_fallen`, `rock_pile`) spans **2 tiles**. In a 13-wide room the
> maximum x is **11**; at 12 it overhangs the edge.

---

## Admin mode

`Shift + L + A` toggles a demo panel: jump to any room, set energy, force-solve, reset. Rooms are
otherwise gated behind solving the previous one, which is correct for play and useless for showing
someone Room 4 in a hurry.
