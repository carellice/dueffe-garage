import { getStore, updateSettings } from './store.ts'

// GarageRepository.setPin / verifyPin: PBKDF2-HMAC-SHA256, 120 000 iterations, 32 byte salt,
// 256 bit hash, kept on this device for this account.

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function pinHash(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 120_000 }, key, 256)
  return new Uint8Array(bits)
}

export const hasPin = () => !!getStore().settings.pinHash && !!getStore().settings.pinSalt

export async function setPin(pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('Il PIN deve avere da 4 a 8 cifre')
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const hash = await pinHash(pin, salt)
  updateSettings({ pinSalt: b64(salt), pinHash: b64(hash), pinLength: pin.length })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const { pinSalt, pinHash: stored } = getStore().settings
  if (!pinSalt || !stored) return false
  try {
    const expected = unb64(stored)
    const actual = await pinHash(pin, unb64(pinSalt))
    if (expected.length !== actual.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
    return diff === 0
  } catch {
    return false
  }
}
