const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

function safeMediaDest(userData, patientId, fileId, name) {
  const safeId = String(patientId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  const safeFileId = String(fileId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.dcm', '.dicom'])
  const rawExt = path.extname(String(name || '')).toLowerCase()
  const ext = allowed.has(rawExt) ? rawExt : ''
  if (!safeId || !safeFileId) return { ok: false, error: 'invalid' }
  const dir = path.join(userData, 'media', safeId)
  const filename = `${safeFileId}${ext}`
  const dest = path.resolve(dir, filename)
  const rel = path.relative(dir, dest)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return { ok: false, error: 'path' }
  return { ok: true, dir, dest, filename }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dentisuite-media-'))
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const jpg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAIAAwAD/2Q==',
  'base64',
)

const pngDest = safeMediaDest(tmp, 'p1', 'm1', 'Radio dentaire.png')
assert.ok(pngDest.ok)
assert.ok(pngDest.dest.endsWith(`${path.sep}m1.png`))
fs.mkdirSync(pngDest.dir, { recursive: true })
fs.writeFileSync(pngDest.dest, png)
assert.ok(fs.existsSync(pngDest.dest))
assert.strictEqual(fs.readFileSync(pngDest.dest).equals(png), true)

const jpegDest = safeMediaDest(tmp, 'p1', 'm2', 'scan.jpeg')
assert.ok(jpegDest.ok)
assert.ok(jpegDest.dest.endsWith('m2.jpeg'))
fs.writeFileSync(jpegDest.dest, jpg)

const spaces = safeMediaDest(tmp, 'p1', 'm3', 'radio gauche.jpg')
assert.ok(spaces.ok)
assert.ok(spaces.filename === 'm3.jpg')

const accents = safeMediaDest(tmp, 'p1', 'm4', 'cliché-été.png')
assert.ok(accents.ok)

const traversal = safeMediaDest(tmp, 'p1', '../windows', '../../x.png')
assert.ok(traversal.ok)
assert.strictEqual(traversal.filename, 'windows.png')
assert.ok(!traversal.dest.includes('..'))

const otherPatient = safeMediaDest(tmp, 'p2', 'm1', 'x.png')
assert.ok(otherPatient.ok)
assert.notStrictEqual(path.dirname(otherPatient.dest), pngDest.dir)

const p2dir = fs.existsSync(path.join(tmp, 'media', 'p2'))
assert.strictEqual(p2dir, false)

fs.rmSync(tmp, { recursive: true, force: true })
console.log('media store path tests ok')
