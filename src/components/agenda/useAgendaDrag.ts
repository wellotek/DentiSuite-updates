import { useCallback, useEffect, useState } from 'react'
import type { Appointment } from '../../types'

/** Tracks HTML5 drag state and always tears down window listeners on unmount. */
export function useAgendaDrag() {
  const [dragging, setDragging] = useState<Appointment | null>(null)
  const [preview, setPreview] = useState<{ key: string; time: string } | null>(null)

  const clear = useCallback(() => {
    setDragging(null)
    setPreview(null)
  }, [])

  useEffect(() => {
    function onEnd() {
      clear()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') clear()
    }
    window.addEventListener('dragend', onEnd)
    window.addEventListener('drop', onEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('dragend', onEnd)
      window.removeEventListener('drop', onEnd)
      window.removeEventListener('keydown', onKey)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
  }, [clear])

  return { dragging, setDragging, preview, setPreview, clear }
}
