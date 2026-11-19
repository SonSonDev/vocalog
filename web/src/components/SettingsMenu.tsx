import { PERIODS } from '@vocalog/shared';
import type { Period } from '@vocalog/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ACCENTS } from '../accents.ts';
import { fetchMe } from '../api.ts';
import { effectiveTheme, resetSettings, timeZoneNames, updateSettings, useSettings } from '../settings.ts';
import type { Density, ThemeMode, WeekStart } from '../settings.ts';
import { useRemote } from '../useRemote.ts';

const PERIOD_LABELS: Record<Period, string> = { '7d': '7 j', '30d': '30 j', '1y': '1 an', all: 'Tout' };

/** A row of the panel: a label and a switch of two to four buttons, one pressed. */
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div class="settings-row">
      <span class="settings-label">{label}</span>
      <div class="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The settings menu: a button in the top bar that opens a panel. Everything is kept in this browser and applied at once.
 * Escape or a click outside closes it, and the focus goes back to the button.
 */
export function SettingsMenu() {
  const settings = useSettings();
  const { data: me } = useRemote('me', fetchMe);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const theme = effectiveTheme(settings.theme, window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div class="settings" ref={root}>
      <button ref={button} type="button" class="topbar-button" aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-panel" onClick={() => setOpen(!open)}>
        Réglages
      </button>
      {open && (
        <div id="settings-panel" class="settings-panel" role="dialog" aria-label="Réglages" ref={panel}>
          <Choice<ThemeMode>
            label="Thème"
            value={settings.theme}
            options={[
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
              { value: 'system', label: 'Système' },
            ]}
            onChange={(value) => updateSettings({ theme: value })}
          />

          <div class="settings-row">
            <span class="settings-label" id="accent-label">
              Couleur
            </span>
            <div class="swatches" role="radiogroup" aria-labelledby="accent-label">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  class="swatch"
                  role="radio"
                  aria-checked={accent.id === settings.accent}
                  aria-label={accent.label}
                  data-tip={accent.label}
                  style={{ '--swatch': accent[theme].accent }}
                  onClick={() => updateSettings({ accent: accent.id })}
                />
              ))}
            </div>
          </div>

          <Choice<Density>
            label="Densité"
            value={settings.density}
            options={[
              { value: 'comfortable', label: 'Confortable' },
              { value: 'compact', label: 'Compacte' },
            ]}
            onChange={(value) => updateSettings({ density: value })}
          />

          <Choice<'normal' | 'reduced'>
            label="Animations"
            value={settings.reduceMotion ? 'reduced' : 'normal'}
            options={[
              { value: 'normal', label: 'Normales' },
              { value: 'reduced', label: 'Réduites' },
            ]}
            onChange={(value) => updateSettings({ reduceMotion: value === 'reduced' })}
          />

          <Choice<Period>
            label="Période par défaut"
            value={settings.defaultPeriod}
            options={PERIODS.map((period) => ({ value: period, label: PERIOD_LABELS[period] }))}
            onChange={(value) => updateSettings({ defaultPeriod: value })}
          />

          <Choice<WeekStart>
            label="Semaine"
            value={settings.weekStart}
            options={[
              { value: 'monday', label: 'Début lundi' },
              { value: 'sunday', label: 'Début dimanche' },
            ]}
            onChange={(value) => updateSettings({ weekStart: value })}
          />

          <label class="settings-row">
            <span class="settings-label">Fuseau horaire</span>
            <select class="settings-select" value={settings.timeZone} onChange={(event) => updateSettings({ timeZone: event.currentTarget.value })}>
              <option value="server">Serveur ({me?.serverTimeZone ?? '…'})</option>
              <option value="browser">Cet appareil ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
              <optgroup label="Autres fuseaux">
                {timeZoneNames().map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <button type="button" class="settings-reset" onClick={resetSettings}>
            Rétablir les réglages d’origine
          </button>
        </div>
      )}
    </div>
  );
}
