/**
 * Isomorphic id/time helpers. Works in both the Node main process and the
 * browser-based renderer (both expose a Web Crypto `randomUUID`).
 */
export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
