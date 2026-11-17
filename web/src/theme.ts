export type Theme = 'light' | 'dark';

const KEY = 'vocalog-theme';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The saved theme, or the system one. Storage may be unavailable (private window): never throw. */
export function loadTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore: fall back to the system theme
  }
  return systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // ignore: the theme still applies for this visit
  }
}
