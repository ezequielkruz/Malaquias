export type ThemeId =
  | 'vibrant-gold-green-blue'
  | 'gold-light'
  | 'clean-light'
  | 'gold-dark'
  | 'midnight'
  | 'executive-vibrant-light'
  | 'executive-vibrant-dark'
  | 'electric-contrast-light'
  | 'night-gold-dark'
  | 'festive-eve'
  | 'corona-dark';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  isDark: boolean;
  swatchColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'vibrant-gold-green-blue',
    label: 'Honey Opal Sunset',
    isDark: false,
    swatchColor: '#ECB914',
  },
  {
    id: 'gold-light',
    label: 'Claro Dourado (Gold Light)',
    isDark: false,
    swatchColor: '#B45309',
  },
  {
    id: 'clean-light',
    label: 'Sapphire Nightfall Whisper',
    isDark: false,
    swatchColor: '#0474C4',
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
  {
    id: 'executive-vibrant-light',
    label: 'Amethyst Mint Harmony',
    isDark: false,
    swatchColor: '#8DF688',
  },
  {
    id: 'executive-vibrant-dark',
    label: 'Executivo Vibrante (Escuro)',
    isDark: true,
    swatchColor: '#FBBF24',
  },
  {
    id: 'electric-contrast-light',
    label: 'Amethyst Dawn Haze',
    isDark: false,
    swatchColor: '#DCCE40',
  },
  {
    id: 'night-gold-dark',
    label: 'Noite & Ouro (Escuro)',
    isDark: true,
    swatchColor: '#D97706',
  },
  {
    id: 'festive-eve',
    label: 'Festive Eve',
    isDark: true,
    swatchColor: '#C04AFF',
  },
  {
    id: 'corona-dark',
    label: 'Corona Dark',
    isDark: true,
    swatchColor: '#AF1763',
  },
];

const THEME_STORAGE_KEY = 'gestor_financeiro_theme';

export function isValidThemeId(val: unknown): val is ThemeId {
  return (
    val === 'vibrant-gold-green-blue' ||
    val === 'gold-light' ||
    val === 'clean-light' ||
    val === 'gold-dark' ||
    val === 'midnight' ||
    val === 'executive-vibrant-light' ||
    val === 'executive-vibrant-dark' ||
    val === 'electric-contrast-light' ||
    val === 'night-gold-dark' ||
    val === 'festive-eve' ||
    val === 'corona-dark'
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
