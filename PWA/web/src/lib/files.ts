import type { GarageDocument } from '../../../shared/model.ts'

// The Android pickers (PickVisualMedia, TakePicture, OpenDocument, CreateDocument) and the
// ACTION_VIEW / ACTION_SEND intents, done with the browser's own file input, Web Share and downloads.

/** True while a picker or the share sheet is open: hiding the page then must not lock Garage. */
export let externalActivity = false
export const setExternalActivity = (value: boolean) => { externalActivity = value }

export function pickFile(accept: string, capture = false): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', 'environment')
    input.style.display = 'none'
    document.body.appendChild(input)
    let done = false
    const finish = (file: File | null) => {
      if (done) return
      done = true
      input.remove()
      window.removeEventListener('focus', onFocus)
      setTimeout(() => setExternalActivity(false), 1500)
      resolve(file)
    }
    // No "cancel" event on older browsers: when the page gets the focus back without a file, it was cancelled.
    const onFocus = () => setTimeout(() => finish(input.files?.[0] ?? null), 800)
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => finish(null))
    window.addEventListener('focus', onFocus)
    setExternalActivity(true)
    input.click()
  })
}

export function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('File non leggibile'))
    reader.readAsDataURL(blob)
  })
}

/** A photo made smaller for the server: longest side [maxSide], JPEG. */
export async function compressImage(file: Blob, maxSide = 2048, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto non leggibile'))), 'image/jpeg', quality))
}

export const documentUrl = (doc: Pick<GarageDocument, 'id' | 'updatedAt'>) => `/files/document/${doc.id}?v=${encodeURIComponent(doc.updatedAt)}`
export const vehiclePhotoUrl = (v: { id: string; updatedAt: string }) => `/files/vehicle/${v.id}?v=${encodeURIComponent(v.updatedAt)}`

function extension(doc: GarageDocument): string {
  if (/\.[a-z0-9]{2,5}$/i.test(doc.name)) return ''
  return doc.mimeType === 'application/pdf' ? '.pdf' : doc.mimeType === 'image/jpeg' ? '.jpg' : doc.mimeType === 'image/png' ? '.png' : ''
}

async function documentFile(doc: GarageDocument): Promise<File> {
  const response = await fetch(documentUrl(doc), { credentials: 'same-origin' })
  if (!response.ok) throw new Error('File non disponibile')
  return new File([await response.blob()], doc.name + extension(doc), { type: doc.mimeType })
}

/** openDocument: the browser shows PDFs and images itself; other files are downloaded. */
export async function openDocument(doc: GarageDocument, onError: (message: string) => void) {
  try {
    const file = await documentFile(doc)
    const url = URL.createObjectURL(file)
    if (file.type === 'application/pdf' || file.type.startsWith('image/') || file.type.startsWith('text/')) {
      const opened = window.open(url, '_blank')
      if (!opened) download(file, file.name)
    } else download(file, file.name)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    onError('Nessuna app disponibile per aprire questo file')
  }
}

/** shareDocument: the system share sheet, or a download where sharing files is not possible. */
export async function shareDocument(doc: GarageDocument, onError: (message: string) => void) {
  try {
    const file = await documentFile(doc)
    if (navigator.canShare?.({ files: [file] })) {
      setExternalActivity(true)
      try {
        await navigator.share({ files: [file], title: 'Condividi documento' })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') throw e
      } finally {
        setTimeout(() => setExternalActivity(false), 1500)
      }
    } else download(file, file.name)
  } catch {
    onError('Condivisione non disponibile')
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
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
