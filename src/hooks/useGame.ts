import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createAI } from '../ai'
import { gameReducer, createInitialState } from '../engine/game'
import { createRng } from '../engine/rng'
import { getTargetView } from '../engine/view'
import type { Coord, Difficulty, GameState, PlacedShip, ShipType } from '../engine/types'
import { loadGame, loadStats, recordResult, saveGame } from '../storage/persist'

export const AI_TURN_DELAY_MS = 700

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function difficultyFromUrl(): Difficulty | null {
  const value = new URLSearchParams(window.location.search).get('difficulty')
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : null
}

function syncDifficultyToUrl(difficulty: Difficulty) {
  const url = new URL(window.location.href)
  url.searchParams.set('difficulty', difficulty)
  window.history.replaceState(null, '', url)
}

function initState(): GameState {
  const saved = loadGame()
  const urlDifficulty = difficultyFromUrl()
  if (saved) {
    return saved.phase === 'setup' && urlDifficulty
      ? { ...saved, difficulty: urlDifficulty }
      : saved
  }
  return createInitialState(urlDifficulty ?? 'medium')
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initState)
  const [stats, setStats] = useState(loadStats)
  const rng = useRef(createRng())
  const prevPhase = useRef(state.phase)

  const seed = () => rng.current.int(2 ** 31)

  useEffect(() => saveGame(state), [state])
  useEffect(() => syncDifficultyToUrl(state.difficulty), [state.difficulty])

  useEffect(() => {
    if (state.phase !== 'playing' || state.turn !== 'ai') return
    const timer = setTimeout(() => {
      const view = getTargetView(state.boards.human, state.rules)
      const coord = createAI(state.difficulty).chooseShot(view, rng.current)
      dispatch({ type: 'FIRE', by: 'ai', coord })
    }, AI_TURN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (prevPhase.current === 'playing' && state.phase === 'gameOver' && state.winner) {
      setStats(recordResult(state.difficulty, state.winner === 'human'))
    }
    prevPhase.current = state.phase
  }, [state.phase, state.winner, state.difficulty])

  return {
    state,
    stats,
    placeShip: useCallback((ship: PlacedShip) => dispatch({ type: 'PLACE_SHIP', ship }), []),
    removeShip: useCallback(
      (shipType: ShipType) => dispatch({ type: 'REMOVE_SHIP', shipType }),
      [],
    ),
    randomizeFleet: useCallback(() => dispatch({ type: 'RANDOMIZE_FLEET', seed: seed() }), []),
    clearFleet: useCallback(() => dispatch({ type: 'RESET' }), []),
    setDifficulty: useCallback(
      (difficulty: Difficulty) => dispatch({ type: 'SET_DIFFICULTY', difficulty }),
      [],
    ),
    startGame: useCallback(() => dispatch({ type: 'START_GAME', seed: seed() }), []),
    fire: useCallback((coord: Coord) => dispatch({ type: 'FIRE', by: 'human', coord }), []),
    playAgain: useCallback((keepFleet: boolean) => dispatch({ type: 'RESET', keepFleet }), []),
  }
}

export type GameApi = ReturnType<typeof useGame>
