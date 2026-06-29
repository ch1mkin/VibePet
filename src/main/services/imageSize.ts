import { readFileSync } from 'node:fs'

export interface ImageSize {
  width: number
  height: number
}

/**
 * Best-effort image dimension reader for the formats we accept (PNG/GIF/WebP/JPEG).
 * Returns null when the size can't be determined. Used to pre-fill sprite geometry.
 */
export function readImageSize(filePath: string): ImageSize | null {
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return null
  }
  return png(buf) ?? gif(buf) ?? webp(buf) ?? jpeg(buf)
}

function png(b: Buffer): ImageSize | null {
  // 89 50 4E 47 0D 0A 1A 0A, then IHDR with width/height at bytes 16/20.
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

function gif(b: Buffer): ImageSize | null {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return null
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
}

function webp(b: Buffer): ImageSize | null {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    return null
  }
  const format = b.toString('ascii', 12, 16)
  if (format === 'VP8X') {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
  }
  if (format === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  if (format === 'VP8L') {
    const bits = b.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return null
}

function jpeg(b: Buffer): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = b[offset + 1]
    // SOF0–SOF15 (excluding DHT/DAC/RST) carry the frame dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) }
    }
    offset += 2 + b.readUInt16BE(offset + 2)
  }
  return null
}
