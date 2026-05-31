# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs the Electron app with the local game files)
npm start

# Build portable Windows .exe
npm run build

# Build unpacked Windows directory (for testing the built output)
npm run build:dir

# Check for upstream game updates (dry-run)
./scripts/sync.sh --check

# Sync game modules from upstream cat.g8hh.com.cn
./scripts/sync.sh --force
```

There are no tests or linters configured in this project.

## Architecture

This is **Kittens Game — Desktop Edition**: an Electron wrapper around bloodrizer's incremental/idle browser game "Kittens Game." The desktop port adds file-based saves (instead of localStorage-only), native menus (Save/Export/Import shortcuts), and a quit-with-save dialog.

### Electron layer (3 files)

| File | Role |
|---|---|
| `main.js` | Main process: window creation (1280×860, min 650×500), application menu (Game/View/Help), IPC handlers for file save/load, quit-with-save dialog. Saves are written to `%APPDATA%/kittens-game/saves/`. |
| `preload.js` | Context bridge: exposes `window.electronAPI` with `saveGameFile`, `loadLatestSave`, `listSaves`, `loadSaveFile`. `contextIsolation` is on; `nodeIntegration` is off. |
| `package.json` | electron-builder config targeting Windows portable builds. App ID: `com.kittensgame.desktop`. |

### Game engine (in `app/`)

The game is the original Kittens Game web code, loaded as a single-page app in the renderer. It uses **Dojo Toolkit** (`dojo.declare` for OOP-style classes), **jQuery**, and **React** (for select UI panels). Modules are loaded dynamically at startup via **SystemJS**.

**Startup sequence** (in `app/index.html`):
1. Load libraries (React, jQuery, Dojo, lz-string, Dropbox, MD5, SystemJS)
2. Load `config.js` → `i18n.js` → `core.js`
3. Load all game module JS files in dependency order (resources → calendar → buildings → village → science → workshop → diplomacy → religion → achievements → settings → JSX panels → ui → space → prestige → time → stats → challenges → void → math → game → toolbar)
4. Call `initGame()` which creates `GamePage`, attaches `DesktopUI`, and starts the game loop

**Class hierarchy** (Dojo declares, so all use `dojo.declare`):

- `com.nuclearunicorn.core.Control` — root base class for all game components
- `com.nuclearunicorn.core.TabManager` extends `Control` — base for every game subsystem manager (buildings, science, workshop, religion, space, etc.). Each TabManager owns a `meta` array of items (techs, upgrades, buildings, etc.) with effects, prices, and unlock conditions.
- `classes.game.GamePage` — the top-level game controller, owns references to all managers (`resPool`, `science`, `workshop`, `bld`, `religion`, `space`, `prestige`, `diplomacy`, `achievements`, `calendar`, `village`, `time`, `challenges`, `void`, `stats`)
- `classes.game.Timer` — game loop: drives periodic updates via registered event handlers at varying frequencies
- `classes.game.Telemetry` — analytics/error tracking
- `classes.game.Server` — KGNet cloud save/profile sync
- `classes.ui.UISystem` → `classes.ui.DesktopUI` — UI abstraction; DesktopUI is the desktop-specific renderer with React dirty-component tracking
- `mixin.IReactAware` — React-Dojo bridge mixin for rendering React components inside Dojo UI
- `classes.KGConfig` — static configuration (available locales, color schemes, notation types)
- `classes.managers.*Manager` — each game subsystem (ResourceManager, ScienceManager, WorkshopManager, ReligionManager, SpaceManager, etc.)

**Key game files in `app/js/`**:

| File | Manager class | Purpose |
|---|---|---|
| `resources.js` | ResourceManager | All game resources (catnip, wood, minerals, kittens, faith, etc.) with type, visibility, and reset persistence flags |
| `buildings.js` | (BuildingManager) | Buildings that produce/consume resources |
| `science.js` | ScienceManager | Technology tree with unlock conditions and prices |
| `workshop.js` | WorkshopManager | Craftable upgrades and workshop items |
| `religion.js` | ReligionManager | Faith, unicorns, tears, relics, transcendence tiers, cryptotheology |
| `space.js` | SpaceManager | Space missions, planets, starcharts |
| `prestige.js` | PrestigeManager | Paragon, karma, reset mechanics |
| `time.js` | (TimeManager) | Temporal paradox, time crystals, chronospheres |
| `diplomacy.js` | DiplomacyManager | Zebras, nagas, leviathans, trade |
| `achievements.js` | AchievementManager | Achievement tracking and unlocks |
| `village.js` | (VillageManager) | Kittens, jobs, census |
| `calendar.js` | CalendarManager | In-game calendar, seasons, events |
| `challenges.js` | ChallengeManager | Challenge modes |
| `void.js` | VoidManager | Void/endgame content |
| `stats.js` | StatsManager | Statistics tracking |
| `math.js` | Math utilities | Number formatting, notation conversion |
| `ui.js` | UISystem / DesktopUI | UI rendering, tab switching, scheme management |
| `toolbar.js` | | Top toolbar |
| `settings.js` | | Settings & options |

**React JSX panels** (`app/js/jsx/`): `left.jsx.js`, `mid.jsx.js`, `toolbar.jsx.js`, `chiral.jsx.js`, `queue.jsx.js` — these render specific UI panels using React and subscribe to Dojo's `ui/update` topic for reactivity.

**Internationalization**: `app/i18n.js` uses Dojo topics. Translations live in `app/res/i18n/en.json` (fallback) and `app/res/i18n/crowdin/{locale}.json` (Crowdin-sourced). Default language is `zh` (Chinese). The `$I()` function retrieves localized strings by key.

**Themes**: CSS files in `app/res/theme_*.css` (28 themes total). Default is "night". Schemes are enumerated in `config.js`.

**Desktop additions to the upstream game** (in `app/index.html`):
- `saveToFile()` / `loadFromFile()` functions bridging the game's save data through `window.electronAPI` to the filesystem
- Cheats panel ("金手指") with trilingual i18n (zh/zht/en) using `data-ci18n` attributes
- Custom label translation hooks on language change
- `#restore-link` in the top bar for restoring from the last file backup

### Sync with upstream

`scripts/sync.sh` compares the local `app/build.version.json` against `https://cat.g8hh.com.cn/build.version.json`, then diffs module lists, locales, and schemes. It downloads changed/new JS modules, i18n files, and CSS. New modules detected remotely must be manually added to `app/index.html`'s modules array.

## Important patterns

- **Dojo declare quirks**: In `dojo.declare` classes, array/object fields in the class definition are STATIC and shared across instances. Always initialize them in the `constructor`. Methods are NOT inherited automatically; use `this.inherited(arguments)` to call the parent method.
- **Module loading is sequential and ordered**: each `_import()` call returns a deferred that chains to the next. The load order in the modules array in `index.html` matters — `game.js` must load last (it depends on all subsystems).
- **IPC flow for saves**: renderer calls `window.electronAPI.saveGameFile(data)` → preload forwards via `ipcRenderer.invoke` → main process writes to `%APPDATA%/kittens-game/saves/save_YYYYMMDD_HHMMSS.txt` and `latest.txt`.
- **The `app/` directory is the renderer**: everything under `app/` runs in the browser context with context isolation. Node APIs are only available in `main.js` and `preload.js`.
