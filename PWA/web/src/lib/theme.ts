import { useSyncExternalStore } from 'react'
import { useStore } from './store.ts'

// The two color schemes of MainActivity.kt (darkColorScheme / lightColorScheme) and the brand
// colors of GarageDesign.kt, as CSS variables.

// Cockpit palette: carbon surfaces, frost text, one ice-blue accent (GarageDesign.kt).
export const Ice = '#6FD3FF'
export const IceDeep = '#0A66D0'
export const Carbon = '#07090C'
export const CarbonPanel = '#10141A'
export const CarbonRaised = '#181D25'
export const Frost = '#EEF1F5'
export const Steel = '#8B95A7'

type Scheme = Record<string, string>

const dark: Scheme = {
  primary: Ice, onPrimary: Carbon, background: Carbon, surface: CarbonPanel,
  surfaceContainerLowest: Carbon, surfaceContainerLow: CarbonPanel, surfaceContainer: CarbonPanel,
  surfaceContainerHigh: CarbonRaised, surfaceContainerHighest: '#212733', surfaceVariant: CarbonRaised,
  onSurfaceVariant: Steel, outline: '#5A6476', outlineVariant: '#2C3340', onBackground: Frost, onSurface: Frost,
  secondary: Steel, secondaryContainer: 'rgba(111,211,255,.16)', onSecondaryContainer: Ice, error: '#FF5A5F',
  inverseSurface: '#E6E0E9', inverseOnSurface: '#322F35',
  accentA: Ice, accentB: Ice, onAccent: Carbon,
  hairline: 'rgba(255,255,255,.07)', navHairline: 'rgba(255,255,255,.08)',
}

const light: Scheme = {
  primary: IceDeep, onPrimary: '#FFFFFF', background: '#F2F4F7', surface: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F8F9FB', surfaceContainer: '#F2F4F7',
  surfaceContainerHigh: '#E9ECF1', surfaceContainerHighest: '#E1E5EC', surfaceVariant: '#E9ECF1',
  onSurfaceVariant: '#5B6475', outline: '#7A8496', outlineVariant: '#CDD3DC', onBackground: '#0B0D12', onSurface: '#0B0D12',
  secondary: '#5B6475', secondaryContainer: '#DCE9FB', onSecondaryContainer: '#0A3D7A', error: '#C62828',
  inverseSurface: '#322F35', inverseOnSurface: '#F5EFF7',
  accentA: IceDeep, accentB: IceDeep, onAccent: '#FFFFFF',
  hairline: 'rgba(0,0,0,.07)', navHairline: 'rgba(0,0,0,.07)',
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
  if (days == null) return { label: 'Da verificare', color: isDark ? Steel : '#5B6475' }
  if (days < 0) return { label: 'Scaduta', color: isDark ? '#FF5A5F' : '#C62828' }
  if (days <= 30) return { label: 'Imminente', color: isDark ? '#FFA24C' : '#C75000' }
  if (days <= 100) return { label: 'In arrivo', color: isDark ? '#FFD45C' : '#8F6A00' }
  return { label: 'Tranquilla', color: isDark ? '#4FE0A6' : '#138A57' }
}

/** How full a deadline gauge is: empty a year away, full when due. */
export const deadlineFraction = (days: number | null) => days == null ? 0 : days <= 0 ? 1 : Math.min(1, Math.max(0.04, 1 - days / 365))

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

/** The accent fill (solid in the cockpit look). */
export const accentGradient = 'var(--primary)'
