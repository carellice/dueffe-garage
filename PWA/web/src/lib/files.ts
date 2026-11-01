import { toast } from '../components/overlays.tsx'
import { fileUrl } from './store.ts'
import type { GarageDocument } from '../../../shared/model.ts'

// openDocument / shareDocument / copyPlate of MainActivity.kt.

export function openDocument(doc: GarageDocument) {
  const opened = window.open(fileUrl('document', doc.id, doc.updatedAt), '_blank', 'noopener')
  if (opened === null) location.href = fileUrl('document', doc.id, doc.updatedAt)
}

function extension(doc: GarageDocument) {
  if (doc.mimeType === 'application/pdf') return '.pdf'
  if (doc.mimeType === 'image/jpeg') return '.jpg'
  if (doc.mimeType === 'image/png') return '.png'
  return ''
}

export async function shareDocument(doc: GarageDocument) {
  try {
    const response = await fetch(fileUrl('document', doc.id, doc.updatedAt), { credentials: 'same-origin' })
    if (!response.ok) throw new Error()
    const blob = await response.blob()
    const name = /\.[a-z0-9]{2,5}$/i.test(doc.name) ? doc.name : doc.name + extension(doc)
    const file = new File([blob], name, { type: doc.mimeType || blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: doc.name })
      return
    }
    download(blob, name)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    toast('Condivisione non disponibile', true)
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/** A picked file as a data URL, for the JSON upload. */
export function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('File non leggibile'))
    reader.readAsDataURL(file)
  })
}

/** The vehicle photo as JPEG, at most 1600 px per side (the phone kept the original file). */
export async function photoDataUrl(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('File troppo grande')
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('Foto non leggibile')
  }
}

/** Opens the system file picker; resolves null when nothing is chosen. */
export function pickFile(accept: string, capture?: 'environment'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    let settled = false
    input.onchange = () => {
      settled = true
      resolve(input.files?.[0] ?? null)
      input.remove()
    }
    input.addEventListener('cancel', () => { if (!settled) resolve(null); input.remove() })
    document.body.appendChild(input)
    input.click()
  })
}
