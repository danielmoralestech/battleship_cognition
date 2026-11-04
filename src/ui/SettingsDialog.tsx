import { useEffect, useRef } from 'react'
import { useSettings } from './settings'

/** Game preferences. `onClose` should return focus to whatever opened it. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings()
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-left shadow-2xl"
      >
        <h2 id="settings-title" className="text-lg font-bold text-slate-100">
          Settings
        </h2>
        <ul className="mt-2 divide-y divide-slate-800">
          <SettingSwitch
            ref={first}
            id="setting-sound"
            label="Sound"
            description="Gunfire, splashes, explosions and fanfares."
            checked={settings.sound}
            onChange={(sound) => update({ sound })}
          />
        </ul>
        <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

function SettingSwitch({
  ref,
  id,
  label,
  description,
  checked,
  onChange,
}: {
  ref?: React.Ref<HTMLButtonElement>
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <span id={`${id}-label`} className="font-medium text-slate-100">
          {label}
        </span>
        <p id={`${id}-desc`} className="text-sm text-slate-400">
          {description}
        </p>
      </div>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </li>
  )
}
