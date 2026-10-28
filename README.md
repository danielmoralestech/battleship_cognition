# battleship_cognition

Battleship Game for Cognition Interview

A browser version of the classic Battleship board game played against an AI opponent. It runs
entirely client-side and is hosted on GitHub Pages.

**Play it:** https://danielmoralestech.github.io/battleship_cognition/

## Rules (v1)

- Each player has a 10x10 grid.
- Fleet:

  | Ship       | Length |
  | ---------- | ------ |
  | Carrier    | 5      |
  | Battleship | 4      |
  | Cruiser    | 3      |
  | Submarine  | 3      |
  | Destroyer  | 2      |

- Ships are placed horizontally or vertically only (no diagonals).
- Ships may not overlap, but they may touch.
- Players take one shot per turn.
- Hits, misses and sinks are announced ("You sank my Battleship!").
- Firing at a square you have already shot is blocked.
- The first player is chosen at random.
- The first player to sink all 17 squares of the enemy fleet wins.

The rules live in a configurable `RuleSet` (`src/engine/rules.ts`), so variants can be added later
without touching the engine.

## AI difficulties

| Difficulty | Strategy                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Easy       | Fires at random untried squares.                                                                                                                      |
| Medium     | Hunt/target: hunts on a checkerboard (parity) pattern, then targets the squares around a hit until the ship is sunk.                                  |
| Hard       | Probability density: for every untried square, counts how many placements of the remaining ships could cover it, and fires at the most likely square. |

## Tech stack

- [Vite 6](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) for layout and styling
- [Motion](https://motion.dev/) for hit/sink animations
- [Vitest](https://vitest.dev/) for unit tests
- ESLint + Prettier
- GitHub Actions for CI and GitHub Pages deployment

## Architecture

```
src/
  engine/    Pure TypeScript game rules and reducer (no React, no DOM)
  ai/        Stateless AI opponents
  ui/        React components
  hooks/     React hooks connecting the UI to the engine and AI
  effects/   Motion animations driven by engine shot events
  storage/   localStorage persistence
```

- **`src/engine`**: the rules and a pure reducer that takes the game state plus an action
  (place ship, fire, ...) and returns the next state and the shot events it produced. It has no
  side effects, so it is easy to unit test and replay.
- **`src/ai`**: AI opponents implement `chooseShot(view, rng)`. They only see a `TargetView`, which
  is what a human sees of the enemy board (unknown / miss / hit / sunk). They never see ship
  positions. The AIs are stateless: every decision comes from that view, so a saved game resumes
  without restoring AI memory.
- **`src/ui` + `src/hooks`**: React components render the boards and controls. Hooks own the game
  state, dispatch actions to the engine reducer and ask the AI for its move on its turn.
- **`src/effects`**: visual effects (per-ship hit and sink animations) built with Motion. They react
  to the shot events emitted by the engine, so the engine stays free of presentation logic.
- **`src/storage`**: saves and loads the game state and settings from `localStorage`.

## Local development

Requires Node 22.

```sh
npm ci                # install dependencies
npm run dev           # start the dev server
npm test              # run the unit tests once
npm run test:watch    # run tests in watch mode
npm run lint          # ESLint
npm run typecheck     # TypeScript project build check
npm run format        # format with Prettier (format:check to verify)
npm run build         # production build into dist/
npm run preview       # serve the production build locally
```

The app is served under `/battleship_cognition/` (the `base` in `vite.config.ts`) to match the
GitHub Pages URL.

## CI and deployment

- `.github/workflows/ci.yml` runs lint, typecheck, format check, tests and build on every pull
  request and on pushes to `main`.
- `.github/workflows/deploy.yml` runs the tests, builds the app and deploys `dist/` to GitHub Pages
  on every push to `main`. It can also be started manually from the Actions tab.

### One-time setup

GitHub Pages must be configured to deploy from Actions: in the repository go to
**Settings -> Pages -> Build and deployment -> Source** and select **GitHub Actions**.
