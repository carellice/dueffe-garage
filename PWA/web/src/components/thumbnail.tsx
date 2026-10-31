import { useEffect, useState, type CSSProperties } from 'react'
import type { GarageDocument } from '../../../shared/model.ts'
import { documentAppearance, useIsDark } from '../lib/theme.ts'
import { documentUrl } from '../lib/files.ts'
import { Icon } from './ui.tsx'

// DocumentThumbnail: images shown as they are, the first page of a PDF rendered (PdfRenderer on
// Android, pdf.js here, loaded only when a PDF needs it).

const previews = new Map<string, Promise<string | null>>()

async function renderPdf(url: string, maxPixels: number): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const data = await (await fetch(url, { credentials: 'same-origin' })).arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: maxPixels / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = maxPixels
  canvas.height = Math.min(maxPixels * 2, Math.max(100, Math.round(viewport.height)))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  pdf.destroy()
  return canvas.toDataURL('image/jpeg', 0.85)
}

function preview(doc: GarageDocument, maxPixels: number): Promise<string | null> {
  const url = documentUrl(doc)
  if (doc.mimeType.startsWith('image/')) return Promise.resolve(url)
  if (doc.mimeType !== 'application/pdf') return Promise.resolve(null)
  const key = `${url}@${maxPixels}`
  let p = previews.get(key)
  if (!p) {
    p = renderPdf(url, maxPixels).catch(() => null)
    previews.set(key, p)
  }
  return p
}

export function DocumentThumbnail({ document: doc, category, style, maxPixels = 320 }: { document: GarageDocument; category: string; style?: CSSProperties; maxPixels?: number }) {
  const appearance = documentAppearance(category, useIsDark())
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setFailed(false)
    preview(doc, maxPixels).then((s) => { if (live) setSrc(s) })
    return () => { live = false }
  }, [doc.id, doc.updatedAt, doc.mimeType, maxPixels])
  return (
    <div style={{ width: 72, height: 72, borderRadius: 13, background: appearance.background, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', ...style }}>
      {src && !failed
        ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <Icon name="document" size={32} color={appearance.tint} />}
    </div>
  )
}
