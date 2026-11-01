import { useSyncExternalStore } from 'react'
import { useStore } from './store.ts'

// The two color schemes of MainActivity.kt (darkColorScheme / lightColorScheme) and the brand
// colors of GarageDesign.kt, as CSS variables.

export const Gold = '#FFD84D'
export const Amber = '#FF9F1C'
export const Ember = '#FF6B3D'
export const Black = '#09080A'
export const Cream = '#FFF8E9'
export const Muted = '#B7A98E'

type Scheme = Record<string, string>

const dark: Scheme = {
  primary: Gold, onPrimary: Black, background: Black, surface: '#16141A',
  surfaceContainerLowest: Black, surfaceContainerLow: '#16141A', surfaceContainer: '#16141A',
  surfaceContainerHigh: '#221F25', surfaceContainerHighest: '#2C2930', surfaceVariant: '#27242B',
  onSurfaceVariant: Muted, outline: '#6E6252', outlineVariant: '#49454F', onBackground: Cream, onSurface: Cream,
  secondary: Muted, secondaryContainer: '#3D3214', onSecondaryContainer: Gold, error: '#FF6B6B',
  inverseSurface: '#E6E0E9', inverseOnSurface: '#322F35',
  accentA: Gold, accentB: Amber, onAccent: Black,
  hairline: 'rgba(255,255,255,.07)', navHairline: 'rgba(255,255,255,.08)',
}

const light: Scheme = {
  primary: '#8A5A00', onPrimary: '#FFFFFF', background: '#F7F3EA', surface: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#FFFCF5', surfaceContainer: '#F8F5ED',
  surfaceContainerHigh: '#F0EBDF', surfaceContainerHighest: '#E9E2D3', surfaceVariant: '#E9E2D3',
  onSurfaceVariant: '#665B46', outline: '#85745A', outlineVariant: '#CAC4D0', onBackground: Black, onSurface: Black,
  secondary: '#665B46', secondaryContainer: '#FFE7A3', onSecondaryContainer: '#3A2A00', error: '#B3261E',
  inverseSurface: '#322F35', inverseOnSurface: '#F5EFF7',
  accentA: '#E0A100', accentB: '#E86A12', onAccent: '#FFFFFF',
  hairline: 'rgba(0,0,0,.05)', navHairline: 'rgba(0,0,0,.05)',
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function systemDark() {
  return useSyncExternalStore(
    (l) => {
      media?.addEventListener('change', l)
      return () => media?.removeEventListener('change', l)
    },
    () => media?.matches ?? false,
  )
}

/** isDark of MainActivity: "light", "dark" or the system setting. */
export function useDark(): boolean {
  const theme = useStore((s) => s.settings.theme)
  const system = systemDark()
  return theme === 'LIGHT' ? false : theme === 'DARK' ? true : system
}

export function applyTheme(isDark: boolean) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(isDark ? dark : light)) root.style.setProperty(`--${key}`, value)
  root.style.colorScheme = isDark ? 'dark' : 'light'
  root.dataset.dark = String(isDark)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', isDark ? dark.background : light.background))
}

/** urgencyFor(days): the deadline palette, readable in both themes. */
export function urgencyFor(days: number | null, isDark: boolean): { label: string; color: string } {
  if (days == null) return { label: 'Da verificare', color: isDark ? '#B7A98E' : '#66563C' }
  if (days < 0) return { label: 'Scaduta', color: isDark ? '#FF6B6B' : '#C62828' }
  if (days <= 30) return { label: 'Imminente', color: isDark ? '#FF9F43' : '#D35400' }
  if (days <= 100) return { label: 'In arrivo', color: isDark ? '#FFD84D' : '#9A6B00' }
  return { label: 'Tranquilla', color: isDark ? '#5FD4A0' : '#1E8A5A' }
}

export type Appearance = { label: string; icon: import('./icons.gen.ts').IconName; tint: string; background: string }

const appearance = (label: string, icon: Appearance['icon'], tint: string, background: string, darkTint: string, isDark: boolean): Appearance =>
  isDark ? { label, icon, tint: darkTint, background: alpha(darkTint, 0.16) } : { label, icon, tint, background }

/** maintenanceAppearance(type) of Screens.kt. */
export function maintenanceAppearance(type: string, isDark: boolean): Appearance {
  switch (type) {
    case 'service': return appearance('Tagliando', 'wrench', '#1B5A8A', '#E5F0FF', '#7DB8FF', isDark)
    case 'inspection': return appearance('Revisione', 'settingsNav', '#15703F', '#E0F5E6', '#6FE0A0', isDark)
    case 'tax': return appearance('Bollo', 'receipt', '#B4530B', '#FFEAD6', '#FFA45C', isDark)
    case 'insurance': return appearance('Assicurazione', 'shield', '#8A5C00', '#FFF0CC', '#FFD84D', isDark)
    case 'tires': return appearance('Cambio gomme', 'tire', '#7B2D8E', '#F3E6FA', '#D69CFF', isDark)
    default: return appearance('Altro', 'more', '#66563C', '#F1ECE3', '#CDBB98', isDark)
  }
}

/** documentAppearance(category) */
export function documentAppearance(category: string, isDark: boolean): Appearance {
  if (['insurance', 'inspection', 'tax', 'service'].includes(category)) return maintenanceAppearance(category, isDark)
  return { ...maintenanceAppearance('tires', isDark), label: 'Altro', icon: 'more' }
}

/** Color.copy(alpha = a) for a #RRGGBB color. */
export function alpha(hex: string, a: number): string {
  const v = hex.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** accentGradient() */
export const accentGradient = 'linear-gradient(135deg, var(--accentA), var(--accentB))'
