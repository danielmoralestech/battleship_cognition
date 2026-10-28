import {
  allShipsSunk,
  createBoard,
  hasBeenShot,
  inBounds,
  isFleetComplete,
  randomPlacement,
  receiveShot,
  upsertShip,
  validatePlacement,
} from './board'
import { createRng } from './rng'
import { STANDARD_RULES } from './rules'
import type { Coord, Difficulty, GameState, PlacedShip, PlayerId, RuleSet, ShipType } from './types'

export type GameAction =
  | { type: 'PLACE_SHIP'; ship: PlacedShip }
  | { type: 'REMOVE_SHIP'; shipType: ShipType }
  | { type: 'RANDOMIZE_FLEET'; seed: number }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'START_GAME'; seed: number }
  | { type: 'FIRE'; by: PlayerId; coord: Coord }
  | { type: 'RESET'; keepFleet?: boolean }

export const opponentOf = (p: PlayerId): PlayerId => (p === 'human' ? 'ai' : 'human')

export function createInitialState(
  difficulty: Difficulty = 'medium',
  rules: RuleSet = STANDARD_RULES,
): GameState {
  return {
    phase: 'setup',
    rules,
    difficulty,
    turn: 'human',
    boards: { human: createBoard(), ai: createBoard() },
    log: [],
    winner: null,
  }
}

export function canFire(state: GameState, by: PlayerId, coord: Coord): boolean {
  if (state.phase !== 'playing' || state.turn !== by) return false
  const target = state.boards[opponentOf(by)]
  return inBounds(coord, state.rules.gridSize) && !hasBeenShot(target, coord)
}

/** Pure reducer. Invalid actions return the current state unchanged. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_SHIP': {
      if (state.phase !== 'setup') return state
      const ships = state.boards.human.ships
      if (validatePlacement(ships, action.ship, state.rules) !== null) return state
      return withHumanShips(state, upsertShip(ships, action.ship))
    }
    case 'REMOVE_SHIP': {
      if (state.phase !== 'setup') return state
      return withHumanShips(
        state,
        state.boards.human.ships.filter((s) => s.type !== action.shipType),
      )
    }
    case 'RANDOMIZE_FLEET': {
      if (state.phase !== 'setup') return state
      return withHumanShips(state, randomPlacement(state.rules, createRng(action.seed)))
    }
    case 'SET_DIFFICULTY': {
      if (state.phase !== 'setup') return state
      return { ...state, difficulty: action.difficulty }
    }
    case 'START_GAME': {
      if (state.phase !== 'setup' || !isFleetComplete(state.boards.human.ships, state.rules))
        return state
      const rng = createRng(action.seed)
      return {
        ...state,
        phase: 'playing',
        turn: rng.next() < 0.5 ? 'human' : 'ai',
        boards: {
          human: createBoard(state.boards.human.ships),
          ai: createBoard(randomPlacement(state.rules, rng)),
        },
        log: [],
        winner: null,
      }
    }
    case 'FIRE': {
      if (!canFire(state, action.by, action.coord)) return state
      const defender = opponentOf(action.by)
      const outcome = receiveShot(state.boards[defender], action.coord, state.rules.gridSize)
      const boards = { ...state.boards, [defender]: outcome.board }
      const log = [
        ...state.log,
        {
          id: state.log.length + 1,
          by: action.by,
          coord: action.coord,
          result: outcome.result,
          ...(outcome.sunkShip ? { sunkShip: outcome.sunkShip } : {}),
        },
      ]
      if (allShipsSunk(outcome.board)) {
        return { ...state, boards, log, phase: 'gameOver', winner: action.by }
      }
      const keepsTurn = state.rules.extraShotOnHit && outcome.result !== 'miss'
      return { ...state, boards, log, turn: keepsTurn ? action.by : defender }
    }
    case 'RESET': {
      const fresh = createInitialState(state.difficulty, state.rules)
      return action.keepFleet ? withHumanShips(fresh, state.boards.human.ships) : fresh
    }
  }
}

function withHumanShips(state: GameState, ships: PlacedShip[]): GameState {
  return { ...state, boards: { ...state.boards, human: createBoard(ships) } }
}
