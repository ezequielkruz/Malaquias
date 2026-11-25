export type ThemeId =
  | 'vibrant-gold-green-blue'
  | 'gold-light'
  | 'clean-light'
  | 'gold-dark'
  | 'midnight';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  isDark: boolean;
  swatchColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'vibrant-gold-green-blue',
    label: 'Vibrante Ouro, Verde & Azul',
    isDark: false,
    swatchColor: '#D97706',
  },
  {
    id: 'gold-light',
    label: 'Claro Dourado (Gold Light)',
    isDark: false,
    swatchColor: '#B45309',
  },
  {
    id: 'clean-light',
    label: 'Claro Clássico (Clean Light)',
    isDark: false,
    swatchColor: '#2563EB',
  },
  {
    id: 'gold-dark',
    label: 'Escuro Dourado (Gold Dark)',
    isDark: true,
    swatchColor: '#FBBF24',
  },
  {
    id: 'midnight',
    label: 'Escuro Oceano (Midnight)',
    isDark: true,
    swatchColor: '#10B981',
  },
];

const THEME_STORAGE_KEY = 'gestor_financeiro_theme';

export function isValidThemeId(val: unknown): val is ThemeId {
  return (
    val === 'vibrant-gold-green-blue' ||
    val === 'gold-light' ||
    val === 'clean-light' ||
    val === 'gold-dark' ||
    val === 'midnight'
  );
}

export function loadTheme(): ThemeId {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'vibrant-gold-green-blue';
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemeId(saved) ? saved : 'vibrant-gold-green-blue';
  } catch {
    return 'vibrant-gold-green-blue';
  }
}

export function saveTheme(theme: ThemeId): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const opt = THEME_OPTIONS.find((o) => o.id === theme);
  if (opt?.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
