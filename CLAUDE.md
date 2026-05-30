# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kittens Game - Desktop Edition. An Electron 33 wrapper around the web-based incremental/idle game "Kittens Game" by bloodrizer. The game itself is a complex resource-management simulation with 20+ interconnected subsystems (buildings, science, religion, space, time, prestige, etc.).

## Commands

```bash
npm start          # Run the Electron app (dev)
npm run build      # Build portable Windows .exe via electron-builder
npm run build:dir  # Build unpacked Windows directory
```

There are no tests or linters in this project.

## Architecture

### Electron shell (thin layer)

- **`main.js`** — Main process. Creates the BrowserWindow, builds the native menu (Game/View/Help), and registers IPC handlers for file-based save/load. Saves are stored in `%APPDATA%/kittens-game/saves/`. On window close, shows a "Save & Quit" dialog that calls into the game's `saveToFile()` via `executeJavaScript`.
- **`preload.js`** — Context bridge. Exposes `window.electronAPI` (with `saveGameFile`, `loadLatestSave`, `listSaves`, `loadSaveFile`) to the renderer. Uses `contextIsolation: true`, `nodeIntegration: false`.

### Game engine (renderer process)

All game code lives under `app/`. The game loads via SystemJS dynamic module imports orchestrated in `app/index.html`.

**Entry point and bootstrap (`app/index.html`):**
1. Loads third-party libs via `<script>` tags (React, jQuery, Dojo, LZ-String, Dropbox, MD5, SystemJS)
2. Sets default language to `zh` (Chinese) in localStorage
3. Loads theme CSS based on saved UI settings
4. Fetches `build.version.json` to get build revision
5. Imports `config.js` then `i18n.js`, then `core.js`, then all game modules in dependency order
6. Calls `initGame()` which instantiates `gamePage` (the global game singleton) and starts the main loop

**Core classes (`app/core.js`):**
- `com.nuclearunicorn.core.Control` — Base class for all game components
- `com.nuclearunicorn.core.TabManager` — Base class for all subsystem managers (buildings, science, workshop, etc.). Handles effect registration, metadata, and panel management. Every manager that has game-mechanical effects should extend this.

**Main game engine (`app/game.js` — ~5700 lines):**
- `classes.game.Timer` — Custom timer, drives the game loop at 5 ticks/second (200ms/tick). Handlers register with a frequency (in ticks).
- `com.nuclearunicorn.game.ui.GamePage` — The central game class. Instantiated as the global `gamePage`. Owns all managers, the resource pool, calendar, timer, telemetry, and server client. Key subsystems are instantiated in its constructor.
- `classes.game.Server` — Mediator for KGNet cloud saves and MOTD. Loads `server.json` for configuration.
- `classes.game.Telemetry` — Analytics/error reporting (New Relic integration).
- `com.nuclearunicorn.game.EffectsManager` — Maps effect names to metadata (display title, resource association, type like "ratio"/"perTick"/"fixed").
- `classes.game.UndoChange` — Undo system, records game actions that can be reversed.

**Game subsystem managers (`app/js/*.js`):**
Each file implements one manager, all namespaced under `classes.managers.*`. They follow the TabManager pattern:
- `resources.js` — ResourcePool, resource definitions, production/consumption
- `buildings.js` — BuildingsManager: all buildable structures
- `science.js` — ScienceManager: tech tree and policies
- `workshop.js` — WorkshopManager: craftable upgrades
- `religion.js` — ReligionManager: faith, solar revolution, cryptotheology
- `space.js` — SpaceManager: space buildings and exploration
- `time.js` — TimeManager: temporal paradox, chronospheres, time crystals
- `prestige.js` — PrestigeManager: paragon, karma, burned paragon
- `void.js` — VoidManager: void space and related mechanics
- `diplomacy.js` — DiplomacyManager: trading, race relations
- `village.js` — VillageManager: kitten population and jobs
- `achievements.js` — Achievements system
- `challenges.js` — ChallengesManager: challenge modes
- `calendar.js` — Calendar: in-game time, seasons, years
- `math.js` — Math utilities
- `stats.js` — StatsManager: statistics tracking
- `settings.js` — SettingsManager: boolean game options
- `ui.js` — DesktopUI: rendering, tab switching, filters
- `toolbar.js` — Top toolbar rendering

**JSX UI components (`app/js/jsx/*.jsx.js`):**
React components for the main UI panels. Rendered via React (included as `react.min.js`):
- `left.jsx.js` — Left column (building list)
- `mid.jsx.js` — Center column (main game view)
- `toolbar.jsx.js` — Top toolbar with tab navigation
- `chiral.jsx.js` — Chiral/cloud save panel
- `queue.jsx.js` — Crafting queue panel

**Config and i18n:**
- `app/config.js` — `KGConfig`: available locales (`zh`, `zht`), 27 color schemes (10 default, 17 unlockable), notation types
- `app/i18n.js` — `com.nuclearunicorn.i18n.Lang`: loads locale JSON from `app/res/i18n/`, provides `$I()` for translation keys
- `app/server.json` — Server-side configuration (MOTD, telemetry endpoint)

**Third-party libraries (`app/lib/`):**
Dojo Toolkit (dojo.xd.js — used for `dojo.declare` class system, `dojo.hitch`, pub/sub), React (React 0.14), jQuery, LZ-String (save compression), Dropbox API, MD5, SystemJS (module loader), Babel standalone plugin.

### Key architectural patterns

- **Class system**: The game uses Dojo's `dojo.declare(className, superclass, proto)` for all classes. Methods are NOT inherited automatically — use `this.inherited(arguments)` to call the base method. Static fields declared in the prototype object are shared across all instances; mutable fields must be initialized in the constructor.
- **Module loading**: All game modules are loaded dynamically via `System.import()` in `app/index.html`. The load order is critical: config → i18n → core → game subsystem modules → game.js → toolbar.js. Each import appends `?rev_=<buildRevision>` for cache busting.
- **Global singleton**: `gamePage` (instance of `com.nuclearunicorn.game.ui.GamePage`) is the global entry point. Set in `initGame()` via `gamePage = game = new com.nuclearunicorn.game.ui.GamePage()`.
- **Effect caching**: Each manager's `updateEffectCached()` writes to `gamePage.globalEffectsCached`, which is cleared and rebuilt every 5 ticks by `gamePage.updateCaches()`.
- **Save system**: `gamePage.save()` serializes game state to JSON → compressed with LZ-String → stored in localStorage key `com.nuclearunicorn.kittengame.savedata`. The Electron shell adds file-based saves via IPC.
- **Context isolation**: The renderer cannot access Node.js APIs directly. All native operations go through `window.electronAPI` (exposed via preload).
- **i18n**: Default language is Chinese (`zh`). Translation strings use `$I("key.path")` and are stored in `app/res/i18n/{lang}.json`. Crowdin is used for community translations.

### Version and build

Version is `1.5.0.2` (displayed as `1.5.0.2.r{revision}`). Build revision is stored in `app/build.version.json`. The version string `1502` is hardcoded in `index.html` as the `version` variable and checked for auto-update in `server.json`.
