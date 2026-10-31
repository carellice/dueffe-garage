import { useSyncExternalStore } from 'react'
import { useStore } from './store.ts'

// The color schemes of MainActivity.kt (darkColorScheme / lightColorScheme) and the brand palette
// of GarageDesign.kt. Every token becomes a CSS variable; screens only use the variables.

export const Gold = '#FFD84D'
export const Black = '#09080A'
export const Cream = '#FFF8E9'
export const Muted = '#B7A98E'
export const Amber = '#FF9F1C'
export const Ember = '#FF6B3D'

type Scheme = Record<string, string>

const dark: Scheme = {
  primary: Gold, onPrimary: Black, background: Black, surface: '#16141A',
  surfaceContainerLowest: Black, surfaceContainerLow: '#16141A', surfaceContainer: '#16141A',
  surfaceContainerHigh: '#221F25', surfaceContainerHighest: '#2C2930',
  surfaceVariant: '#27242B', onSurfaceVariant: Muted, outline: '#6E6252', outlineVariant: '#49454F',
  onBackground: Cream, onSurface: Cream, secondary: Muted,
  secondaryContainer: '#3D3214', onSecondaryContainer: Gold, error: '#FF6B6B',
  accentA: Gold, accentB: Amber, onAccent: Black,
  glowA: 'rgba(255,216,77,.10)', glowB: 'rgba(255,159,28,.07)',
  hairline: 'rgba(255,255,255,.07)', navBorder: 'rgba(255,255,255,.08)', pinBorder: 'rgba(255,255,255,.07)',
  cardShadow: 'none', navShadow: '0 12px 32px rgba(255,216,77,.22)',
}

const light: Scheme = {
  primary: '#8A5A00', onPrimary: '#FFFFFF', background: '#F7F3EA', surface: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#FFFCF5',
  surfaceContainer: '#F8F5ED', surfaceContainerHigh: '#F0EBDF',
  surfaceContainerHighest: '#E9E2D3', surfaceVariant: '#E9E2D3',
  onSurfaceVariant: '#665B46', outline: '#85745A', outlineVariant: '#CAC4D0',
  onBackground: Black, onSurface: Black, secondary: '#665B46',
  secondaryContainer: '#FFE7A3', onSecondaryContainer: '#3A2A00', error: '#B3261E',
  accentA: '#E0A100', accentB: '#E86A12', onAccent: '#FFFFFF',
  glowA: 'rgba(255,201,77,.22)', glowB: 'rgba(255,179,138,.18)',
  hairline: 'rgba(0,0,0,.05)', navBorder: 'rgba(0,0,0,.05)', pinBorder: 'rgba(0,0,0,.06)',
  cardShadow: '0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05)', navShadow: '0 12px 30px rgba(0,0,0,.22)',
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (l) => {
      media?.addEventListener('change', l)
      return () => media?.removeEventListener('change', l)
    },
    () => media?.matches ?? false,
  )
}

/** isDark of GarageApp: theme "light", "dark" or "system". */
export function useIsDark(): boolean {
  const theme = useStore((s) => s.settings.theme)
  const system = useSystemDark()
  return theme === 'dark' ? true : theme === 'light' ? false : system
}

export function applyTheme(isDark: boolean) {
  const scheme = isDark ? dark : light
  const root = document.documentElement
  for (const [k, v] of Object.entries(scheme)) root.style.setProperty(`--${k}`, v)
  root.style.colorScheme = isDark ? 'dark' : 'light'
  root.dataset.theme = isDark ? 'dark' : 'light'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', scheme.background))
}

/** Urgency palette for deadlines (urgencyFor in GarageDesign.kt). */
export function urgencyFor(days: number | null, isDark: boolean): { label: string; color: string } {
  if (days == null) return { label: 'Da verificare', color: isDark ? '#B7A98E' : '#66563C' }
  if (days < 0) return { label: 'Scaduta', color: isDark ? '#FF6B6B' : '#C62828' }
  if (days <= 30) return { label: 'Imminente', color: isDark ? '#FF9F43' : '#D35400' }
  if (days <= 100) return { label: 'In arrivo', color: isDark ? '#FFD84D' : '#9A6B00' }
  return { label: 'Tranquilla', color: isDark ? '#5FD4A0' : '#1E8A5A' }
}

export type Appearance = { label: string; icon: string; tint: string; background: string }

/** maintenanceAppearance in Screens.kt: in dark mode the tint at 16 % is the background. */
export function maintenanceAppearance(type: string, isDark: boolean): Appearance {
  const make = (label: string, icon: string, tint: string, background: string, darkTint: string): Appearance =>
    isDark ? { label, icon, tint: darkTint, background: alpha(darkTint, 0.16) } : { label, icon, tint, background }
  switch (type) {
    case 'service': return make('Tagliando', 'wrench', '#1B5A8A', '#E5F0FF', '#7DB8FF')
    case 'inspection': return make('Revisione', 'settings-nav', '#15703F', '#E0F5E6', '#6FE0A0')
    case 'tax': return make('Bollo', 'receipt', '#B4530B', '#FFEAD6', '#FFA45C')
    case 'insurance': return make('Assicurazione', 'shield', '#8A5C00', '#FFF0CC', '#FFD84D')
    case 'tires': return make('Cambio gomme', 'tire', '#7B2D8E', '#F3E6FA', '#D69CFF')
    default: return make('Altro', 'more', '#66563C', '#F1ECE3', '#CDBB98')
  }
}

export function documentAppearance(category: string, isDark: boolean): Appearance {
  if (['insurance', 'inspection', 'tax', 'service'].includes(category)) return maintenanceAppearance(category, isDark)
  return { ...maintenanceAppearance('tires', isDark), label: 'Altro', icon: 'more' }
}

/** Color.copy(alpha = a) for a #RRGGBB color. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
