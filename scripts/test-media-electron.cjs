const { app } = require('electron')
const fs = require('fs')
const path = require('path')

app.setPath('userData', path.join(process.env.APPDATA, 'dentisuite'))

app.whenReady().then(() => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const dir = path.join(app.getPath('userData'), 'media', 'ptest')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, 'mtest.png')
  fs.writeFileSync(dest, png)
  const read = fs.readFileSync(dest)
  const ok = read.equals(png)
  fs.unlinkSync(dest)
  try {
    fs.rmdirSync(dir)
  } catch {
    /* keep if not empty */
  }
  console.log(ok ? `electron userData media write ok: ${dest}` : 'electron media write failed')
  app.exit(ok ? 0 : 1)
})
