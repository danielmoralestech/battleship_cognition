/** How long a shell takes to reach its target; impact visuals wait for it. */
export const SHELL_MS = 450

/** Gap between the chained explosions that run along a sinking ship's cells. */
export const SINK_CHAIN_MS = 90

/** When a just-sunk ship's wreck appears: after the shell lands and the explosions run its length. */
export function wreckRevealMs(length: number): number {
  return SHELL_MS + 120 + length * SINK_CHAIN_MS
}
