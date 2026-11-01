type Spring = { type: 'spring'; stiffness: number; damping: number; mass: number }
type Tween = { type: 'tween'; duration: number; ease: [number, number, number, number] | 'linear'; delay?: number }

/** Compose Spring.Stiffness* constants. */
export const Stiffness = { High: 10000, Medium: 1500, MediumLow: 400, Low: 200, VeryLow: 50 } as const

/** Compose spring(dampingRatio, stiffness) as a framer-motion transition (mass 1). */
export function spring(dampingRatio = 1, stiffness: number = Stiffness.Medium): Spring {
  return { type: 'spring', stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness), mass: 1 }
}

/** Compose FastOutSlowInEasing. */
export const fastOutSlowIn: [number, number, number, number] = [0.4, 0, 0.2, 1]

/** Compose tween(durationMillis, delayMillis, easing); the default easing is FastOutSlowIn. */
export function tween(durationMs: number, ease: [number, number, number, number] | 'linear' = fastOutSlowIn, delayMs = 0): Tween {
  return { type: 'tween', duration: durationMs / 1000, ease, ...(delayMs ? { delay: delayMs / 1000 } : {}) }
}

/** Light tick like HapticFeedbackType.ContextClick, where the browser can vibrate. */
export function haptic(long = false) {
  try { navigator.vibrate?.(long ? 25 : 8) } catch { /* not supported */ }
}
