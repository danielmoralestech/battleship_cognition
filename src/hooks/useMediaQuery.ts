import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** wide: desktop/tablet; landscape: phone on its side; portrait: phone upright. */
export type BattleLayout = 'wide' | 'landscape' | 'portrait'

const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 540px)'

export function useBattleLayout(): BattleLayout {
  const wide = useMediaQuery('(min-width: 1024px)')
  const landscape = useMediaQuery(LANDSCAPE_PHONE_QUERY)
  if (landscape) return 'landscape'
  return wide ? 'wide' : 'portrait'
}
