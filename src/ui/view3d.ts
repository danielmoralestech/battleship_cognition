/** `?view=3d` opts into the experimental three.js battle view. */
export const wants3DView = () => new URLSearchParams(window.location.search).get('view') === '3d'

/** three.js r163+ requires WebGL 2. */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export const load3DView = () => import('../three/Battle3D')
