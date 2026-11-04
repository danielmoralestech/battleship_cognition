import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../storage/persist'

export interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

export const SettingsContext = createContext<SettingsApi>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
})

export const useSettings = () => useContext(SettingsContext)
