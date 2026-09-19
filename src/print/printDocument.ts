export type PrintIframeMode = 'hidden' | 'a4-preview'

export type PrintViaIframeOptions = {
  html: string
  /** hidden: compact iframe (finance/stock). a4-preview: off-screen A4 frame (prescription). */
  mode?: PrintIframeMode
  /** Delay before window.print() for simple documents. */
  printDelayMs?: number
  /** Remove iframe after print (simple mode). */
  removeDelayMs?: number
  title?: string
  /** Called after iframe document is ready (a4-preview). */
  onReady?: (doc: Document, win: Window) => void | Promise<void>
}

/**
 * Shared print bootstrap via temporary iframe.
 * Preserves historical behavior for both report styles.
 */
export async function printHtmlViaIframe(options: PrintViaIframeOptions): Promise<void> {
  const mode = options.mode ?? 'hidden'
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  if (options.title) iframe.setAttribute('title', options.title)

  if (mode === 'a4-preview') {
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:1;visibility:visible;background:#fff;'
  } else {
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  }

  document.body.appendChild(iframe)

  if (mode === 'hidden') {
    const doc = iframe.contentDocument
    if (!doc) {
      iframe.remove()
      return
    }
    doc.open()
    doc.write(options.html)
    doc.close()
    window.setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      window.setTimeout(() => iframe.remove(), options.removeDelayMs ?? 1000)
    }, options.printDelayMs ?? 350)
    return
  }

  // a4-preview: srcdoc + readiness (prescription path)
  try {
    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const hasSheet = () => Boolean(iframe.contentDocument?.querySelector('.sheet'))
      iframe.onload = () => {
        if (hasSheet()) done()
      }
      iframe.srcdoc = options.html
      if (hasSheet()) done()
      window.setTimeout(done, 800)
    })

    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) {
      iframe.remove()
      throw new Error('iframe.contentDocument / contentWindow unavailable')
    }

    if (options.onReady) await options.onReady(doc, win)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      iframe.remove()
    }
    win.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)
    win.focus()
    win.print()
  } catch (error) {
    iframe.remove()
    throw error
  }
}
