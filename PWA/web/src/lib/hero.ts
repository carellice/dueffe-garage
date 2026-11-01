// Modifier.containerTransform: the element that a page grows from (the "Aggiungi auto" button, a
// vehicle card...). Screens register their elements by key; the navigation reads where they are.

const elements = new Map<string, HTMLElement>()

export function heroRef(key: string) {
  return (el: HTMLElement | null) => {
    if (el) elements.set(key, el)
    else if (elements.get(key) && !elements.get(key)!.isConnected) elements.delete(key)
  }
}

export type HeroBox = { x: number; y: number; width: number; height: number; radius: number }

/** Where [key] is now, relative to [container], or null when it is not on screen. */
export function heroBox(key: string, container: HTMLElement | null): HeroBox | null {
  const el = elements.get(key)
  if (!el || !el.isConnected || !container) return null
  const r = el.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  if (r.width === 0 || r.bottom < c.top || r.top > c.bottom) return null
  return { x: r.left - c.left, y: r.top - c.top, width: r.width, height: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 }
}
