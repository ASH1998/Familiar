# Dungeon Familiar — WebMCP Game Plan

## 1. Concept

**Dungeon Familiar** is a turn-based cooperative puzzle-adventure where a human player and an AI agent explore a magical dungeon together.

The human controls the adventurer inside the dungeon.

The AI plays the role of a magical familiar bound to the dungeon's systems.

They do not have the same abilities.

The human can physically explore rooms, inspect objects, move items, fight enemies, and notice visual clues.

The familiar can interact with magical mechanisms exposed through **WebMCP tools**.

Neither side can complete the dungeon alone.

---

# 2. Core Idea

The central mechanic is:

> **The human interacts with the physical dungeon.  
> The AI interacts with the dungeon's hidden systems.**

Each room exposes a different set of WebMCP tools to the familiar.

For example, entering a library may expose:

```text
search_archive()
rotate_bookshelf()
inspect_catalog()
activate_rune()
```

Entering an observatory may instead expose:

```text
rotate_telescope()
inspect_star_chart()
change_lens()
open_dome()
```

The AI's capabilities therefore change as the player explores.

**Discovering new WebMCP tools becomes part of dungeon progression.**

---

# 3. Why WebMCP Matters

The game should not feel like:

> "An AI agent playing a browser game."

WebMCP should instead act as the familiar's interface into the dungeon.

The player sees the dungeon visually.

The familiar sees structured capabilities exposed by the current room.

Example:

The player enters a room containing:

- Three stone statues
- A locked gate
- A rotating floor
- Symbols painted on the walls

The player tells the familiar:

> The owl statue has a red crescent underneath it.

The room exposes:

```text
archive.lookup_symbol()
platform.rotate()
statue.inspect_mechanism()
gate.inspect_lock()
```

The familiar investigates:

> The archive says the red crescent represents north.

It then uses:

```text
platform.rotate("north")
```

The dungeon visibly changes.

The human can now continue.

This creates the loop:

```text
Human observes
      ↓
Human acts
      ↓
New information / tools become available
      ↓
Agent reasons
      ↓
Agent invokes WebMCP tools
      ↓
Dungeon changes
      ↓
Human responds
```

---

# 4. Turn System

The game is fully turn-based so AI latency feels natural.

Each round contains three phases.

## Phase 1 — Human Turn

The player gets a limited number of actions.

Example:

```text
YOUR TURN

Actions remaining: 2
```

Possible actions:

- Move
- Inspect
- Pick up object
- Place object
- Attack
- Speak to NPC
- Interact with physical mechanism
- End turn

---

## Phase 2 — Familiar Turn

The AI familiar gets its own turn.

Example:

```text
FAMILIAR TURN

The familiar is examining the room...
```

The familiar can:

- Query systems
- Search archives
- Activate mechanisms
- Unlock magical devices
- Manipulate room infrastructure
- Inspect hidden state

The familiar may have a limited number of tool actions per turn.

Example:

```text
Familiar actions: 2
```

This prevents the agent from simply calling every tool.

Tool usage becomes part of the strategy.

---

## Phase 3 — Dungeon Resolution

The dungeon reacts deterministically.

Example:

```text
DUNGEON TURN

Skeleton moves 2 tiles.

East platform rotates.

Poison spreads one tile.

Gate remains locked.
```

Then the next human turn begins.

---

# 5. Player Roles

## Human — The Adventurer

The human has access to things the AI cannot directly understand or manipulate.

Examples:

- Visual clues
- Spatial layout
- Character movement
- Combat
- Physical objects
- NPC conversations
- Choosing risk
- Interpreting ambiguous scenes

The human acts through the game's visual interface.

---

## AI — The Familiar

The familiar interacts with WebMCP-exposed systems.

Examples:

- Ancient archives
- Magical machinery
- Dungeon maps
- Rune networks
- Door mechanisms
- Observatory controls
- Trap systems
- Hidden sensors

The familiar operates through semantic tools rather than clicking the UI.

---

# 6. Dynamic Tool Discovery

One of the strongest mechanics should be that **WebMCP tools appear and disappear based on game state**.

The familiar does not have every capability from the beginning.

Example:

### Entrance Hall

Available tools:

```text
inspect_dungeon_map()
inspect_door()
```

---

### Clockwork Library

New tools:

```text
search_catalog()
rotate_bookshelf()
read_archivist_notes()
```

---

### Observatory

New tools:

```text
rotate_telescope()
inspect_constellation()
change_lens()
```

---

### Furnace Chamber

New tools:

```text
inspect_pressure()
open_valve()
redirect_steam()
activate_furnace()
```

The familiar progressively gains access to more of the dungeon.

This makes WebMCP capability discovery itself part of exploration.

---

# 7. Room Design

The prototype should contain approximately **3–4 rooms**.

Enough to demonstrate different WebMCP interactions without creating a large game.

---

## Room 1 — The Clockwork Library

Purpose:

Teach the player how human observations and AI tools interact.

Visual elements:

- Rotating bookshelves
- Owl statue
- Moon symbols
- Locked gate
- Mechanical floor

Possible tools:

```text
archive.search()
bookshelf.rotate()
statue.inspect()
gate.inspect()
```

Example puzzle:

The player sees symbols underneath several statues.

The AI searches the archive to determine their meaning.

The player physically rotates statues.

The AI rotates the central bookshelf mechanism.

Together they reveal the exit.

---

## Room 2 — The Observatory

Purpose:

Introduce incomplete information.

Visual elements:

- Telescope
- Star map
- Colored lenses
- Rotating dome
- Constellation symbols

Possible tools:

```text
telescope.rotate()
lens.change()
star_archive.search()
dome.open()
```

The AI can operate the telescope but cannot see the resulting projected image clearly.

The human must describe what appears.

Example:

Agent:

> I have aligned the telescope with the Wolf constellation. What do you see?

Player:

> Three blue stars and one red star.

The AI interprets this using the archive.

This creates real cooperative communication.

---

## Room 3 — The Furnace

Purpose:

Introduce strategic choices.

Visual elements:

- Steam pipes
- Pressure gauges
- Moving platforms
- Locked furnace
- Enemy / hazard

Possible tools:

```text
pressure.inspect()
steam.redirect()
valve.open()
valve.close()
```

The player needs steam to power a bridge.

But redirecting steam may activate another hazard.

The AI helps manage the system while the human navigates the physical room.

---

## Room 4 — The Familiar Chamber

Purpose:

Final puzzle combining previous mechanics.

The player discovers that the familiar itself is trapped inside the dungeon.

The final objective is to free it.

Tools from previous rooms become relevant again.

The human must physically reach the familiar's prison.

The AI must manipulate the dungeon's systems to create the route.

Final interaction:

```text
Human action
→ unlocks final WebMCP capability
→ familiar uses it
→ dungeon transforms
→ familiar is released
```

This gives the demo a satisfying narrative payoff.

---

# 8. Information Asymmetry

The game becomes interesting when both sides know different things.

Examples:

### Human-only information

The human can see:

- Statue orientation
- Colors
- Enemy locations
- Visual symbols
- Physical arrangements

The AI does not automatically receive this information.

The player must describe it.

---

### Familiar-only information

The familiar can access:

- Hidden mechanism state
- Historical records
- Trap networks
- Machine configuration
- Rune databases

The human cannot directly access these systems.

The familiar must explain what it discovers.

---

This creates actual conversation rather than simple commands.

---

# 9. Scarce Familiar Actions

The familiar should not have unlimited tool usage.

Example:

```text
FAMILIAR ENERGY

● ● ○

2 actions remaining
```

Using WebMCP tools consumes energy.

Example:

```text
archive.search()        1 energy
bookshelf.rotate()      1 energy
trap.scan()             1 energy
```

Now the agent must reason about what actions are worth taking.

This also makes tool calls feel like game moves rather than backend operations.

---

# 10. Visual Style

The game should be highly visual and immediately understandable in a demo.

Possible style:

**Pixel-art / illustrated fantasy board game**

Camera:

- Top-down
- Isometric
- Or 2.5D dungeon

The screen should clearly show:

### Main area

The dungeon room.

### Side panel

The familiar.

Example:

```text
┌─────────────────────────────┐
│                             │
│        DUNGEON ROOM         │
│                             │
│      Player      Statue     │
│                             │
│              Locked Gate    │
│                             │
├─────────────────────┬───────┤
│ Familiar            │ Turn  │
│                     │       │
│ "I found something" │ 2 AP  │
└─────────────────────┴───────┘
```

When WebMCP actions occur, they should visibly animate in the game.

Example:

```text
FAMILIAR USED:

ROTATE BOOKSHELF III
```

The bookshelf rotates on screen.

---

# 11. Demo Flow

The hackathon demo should be around **2–3 minutes**.

## Opening

Show the player entering the dungeon.

Text:

> You are not alone down here.

The familiar appears.

---

## First interaction

Player notices symbols.

Player:

> The owl has a red moon underneath it.

Agent uses:

```text
archive.search("red moon")
```

Agent discovers its meaning.

Then:

```text
bookshelf.rotate("north")
```

The environment visibly changes.

---

## Dynamic WebMCP moment

Player enters Observatory.

New tools appear.

```text
New capabilities discovered:

telescope.rotate
star_archive.search
lens.change
```

This is an important demo moment.

It visually communicates that WebMCP capabilities change with application state.

---

## Cooperative puzzle

Agent rotates telescope.

Player interprets projected image.

Player communicates observation.

Agent searches archive.

Together they solve the room.

---

## Finale

Player reaches the familiar chamber.

The final tool becomes available.

Agent uses it.

Dungeon transforms.

Familiar escapes.

End screen:

> **Dungeon Cleared**
>
> Human + Familiar

---

# 12. Technical Architecture

High-level architecture:

```text
Human
  │
  │ Visual UI interactions
  ▼
Dungeon Web App
  │
  │ Game state
  ▼
Game Engine
  │
  ├── Room state
  ├── Player state
  ├── Puzzle state
  ├── Turn system
  └── Tool availability
        │
        ▼
     WebMCP
        │
        ▼
AI Familiar
```

The game engine remains deterministic.

The AI does not directly manipulate arbitrary state.

Instead it interacts through clearly defined semantic WebMCP tools.

Example:

```javascript
rotateBookshelf({
  bookshelf: "III",
  direction: "north"
})
```

The backend validates the action.

Then game state updates.

---

# 13. WebMCP Tool Design

Tools should represent meaningful game capabilities rather than low-level UI actions.

Good:

```text
archive.search_symbol()
telescope.align_constellation()
steam.redirect()
bookshelf.rotate()
```

Avoid:

```text
click_button()
click_coordinates()
press_key()
```

The purpose is to demonstrate that WebMCP gives agents **semantic interfaces to interactive applications**.

---

# 14. Important Design Rule

Every major puzzle should require:

```text
Human information
+
Agent capability
+
Communication
```

If the human can solve a puzzle alone, it is weak.

If the agent can solve it alone, it is also weak.

The strongest puzzles require both.

---

# 15. Prototype Scope

For the hackathon, keep the scope small.

Build:

- One player character
- One AI familiar
- Three polished rooms
- Turn system
- Dynamic WebMCP tool registration
- Around 10–15 meaningful tools
- Three cooperative puzzles
- One final combined puzzle
- Strong animations and visual feedback

Do not build:

- Large combat system
- Large procedural dungeon
- Multiplayer
- Inventory complexity
- Character progression
- Large story system
- Real-time gameplay

The goal is to demonstrate the interaction model.

---

# 16. Core Pitch

> **Dungeon Familiar is a turn-based cooperative adventure where the human controls the physical world and an AI familiar controls the dungeon's hidden systems through WebMCP.**
>
> Every room exposes new capabilities to the agent, turning WebMCP tool discovery itself into a game mechanic.
>
> The human sees things the AI cannot see.  
> The AI can manipulate things the human cannot touch.
>
> They have to talk, reason, and act together to escape.

---

# 17. What Makes It Special

The interesting part is not that an agent can play the game.

The interesting part is that:

> **The agent is actually one of the players.**

WebMCP defines what that player is capable of doing.

The webpage becomes a shared environment where humans and agents have different roles, different information, and different actions.

That is the interaction model the prototype should prove.