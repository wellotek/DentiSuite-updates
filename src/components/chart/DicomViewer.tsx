import { useEffect, useRef, useState } from 'react'
import { Contrast, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { parseDicom, renderDicomToImageData, bytesToBlob, type DicomImage } from '../../lib/dicom'

interface Props {
  buffer: ArrayBuffer
  title: string
}

export function DicomViewer({ buffer, title }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<DicomImage | null>(null)
  const [error, setError] = useState('')
  const [jpegUrl, setJpegUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [center, setCenter] = useState(128)
  const [width, setWidth] = useState(256)
  const drag = useRef<{ x: number; y: number; c: number; w: number } | null>(null)

  useEffect(() => {
    try {
      const parsed = parseDicom(buffer)
      setImage(parsed)
      setCenter(parsed.windowCenter)
      setWidth(parsed.windowWidth)
      if (parsed.jpegBytes) {
        const url = URL.createObjectURL(bytesToBlob(parsed.jpegBytes, 'image/jpeg'))
        setJpegUrl(url)
        return () => URL.revokeObjectURL(url)
      }
      setJpegUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture DICOM impossible')
    }
  }, [buffer])

  useEffect(() => {
    if (!image || image.pixels.length === 0 || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    canvasRef.current.width = image.cols
    canvasRef.current.height = image.rows
    ctx.putImageData(renderDicomToImageData(image, center, width), 0, 0)
  }, [image, center, width])

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, c: center, w: width }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    setWidth(Math.max(1, drag.current.w + dx * 2))
    setCenter(drag.current.c + dy)
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  const filter = jpegUrl
    ? `brightness(${Math.max(0.3, center / 128)}) contrast(${Math.max(0.3, width / 256)})`
    : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto text-sm font-semibold text-white">{title}</p>
        <Tool icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} />
        <span className="text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
        <Tool icon={ZoomIn} onClick={() => setZoom((z) => Math.min(4, z + 0.15))} />
        <Tool icon={RotateCw} onClick={() => setRotation((r) => (r + 90) % 360)} />
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Contrast className="h-3.5 w-3.5" /> Glisser : contraste / luminosité
        </span>
      </div>
      <div
        className="flex min-h-0 flex-1 cursor-crosshair items-center justify-center overflow-auto rounded-xl bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null
        }}
        onWheel={(e) => {
          e.preventDefault()
          setZoom((z) => Math.min(4, Math.max(0.3, z + (e.deltaY > 0 ? -0.1 : 0.1))))
        }}
      >
        <div style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center' }}>
          {jpegUrl ? (
            <img src={jpegUrl} alt={title} style={{ filter, maxWidth: '70vw', maxHeight: '70vh' }} />
          ) : (
            <canvas ref={canvasRef} className="max-h-[70vh] max-w-[70vw]" />
          )}
        </div>
      </div>
    </div>
  )
}

function Tool({ icon: Icon, onClick }: { icon: typeof ZoomIn; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-white/10 p-1.5 text-white hover:bg-white/20"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
