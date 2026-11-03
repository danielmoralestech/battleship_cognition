import { loadView, saveView } from '../storage/persist'

export type ViewMode = '2d' | '3d'

/** `?view=2d|3d` wins (and is remembered); otherwise the saved choice; otherwise 2D. */
export function initialView(): ViewMode {
  const param = new URLSearchParams(window.location.search).get('view')
  if (param === '2d' || param === '3d') {
    saveView(param)
    return param
  }
  return loadView() ?? '2d'
}

/** Saves the choice and drops a stale `?view=` so a reload keeps it. */
export function rememberView(view: ViewMode) {
  saveView(view)
  const url = new URL(window.location.href)
  if (url.searchParams.has('view')) {
    url.searchParams.delete('view')
    window.history.replaceState(window.history.state, '', url)
  }
}

/** three.js r163+ requires WebGL 2. */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export const load3DView = () => import('../three/Battle3D')
