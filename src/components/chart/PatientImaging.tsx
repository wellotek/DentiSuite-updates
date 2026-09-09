import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ImagePlus, Trash2, Upload, X, ZoomIn } from 'lucide-react'
import type { PatientMedia } from '../../types'
import { useT } from '../../i18n'
import { dicomThumbnailDataUrl, isDicomBuffer } from '../../lib/dicom'
import {
  downloadBuffer,
  imageThumbnail,
  isDicomFile,
  isImageFile,
  loadMediaBuffer,
  mediaErrorCode,
  removeMediaBlob,
  saveMediaBlob,
} from '../../lib/mediaFiles'
import { DicomViewer } from './DicomViewer'

interface Props {
  patientId: string
  media: PatientMedia[]
  onAdd: (draft: Omit<PatientMedia, 'id'>) => void
  onUpdate: (id: string, patch: Partial<PatientMedia>) => void
  onDelete: (id: string) => void
}

export function PatientImaging({ patientId, media, onAdd, onUpdate, onDelete }: Props) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PatientMedia | null>(null)
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
  const ordered = [...media].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const ingest = useCallback(
    async (files: FileList | File[]) => {
      setError('')
      setBusy(true)
      let imported = 0
      const failures: string[] = []
      try {
        for (const file of Array.from(files)) {
          try {
            const dicom = isDicomFile(file)
            const image = isImageFile(file)
            if (!dicom && !image) {
              failures.push(`${file.name}: ${t('chart.mediaType')}`)
              continue
            }
            const fileId = `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`
            const saved = await saveMediaBlob(patientId, fileId, file)
            let kind: 'image' | 'dicom' = image && !dicom ? 'image' : 'dicom'
            let thumbnailUrl = ''
            try {
              if (kind === 'dicom' || dicom) {
                if (isDicomBuffer(saved.buffer)) {
                  kind = 'dicom'
                  thumbnailUrl = await dicomThumbnailDataUrl(saved.buffer)
                } else if (image) {
                  kind = 'image'
                  thumbnailUrl = await imageThumbnail(file)
                }
              } else {
                thumbnailUrl = await imageThumbnail(file)
              }
            } catch {
              thumbnailUrl = ''
            }
            const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
            onAdd({
              patientId,
              title,
              kind,
              mime: file.type || (kind === 'dicom' ? 'application/dicom' : 'image/jpeg'),
              originalName: file.name,
              filename: saved.filename,
              dataUrl: saved.dataUrl,
              thumbnailUrl,
              createdAt: new Date().toISOString(),
              size: file.size,
            })
            imported += 1
          } catch (error) {
            if (import.meta.env.DEV) console.error('[imaging]', file.name, error)
            const key = (
              {
                too_large: 'chart.mediaTooLarge',
                inaccessible: 'chart.mediaInaccessible',
                unsupported: 'chart.mediaType',
                folder: 'chart.mediaFolder',
                ipc: 'chart.mediaIpc',
                patient: 'chart.mediaPatient',
                save: 'chart.mediaSave',
                generic: 'chart.mediaError',
              } as const
            )[mediaErrorCode(error)]
            failures.push(`${file.name}: ${t(key)}`)
          }
        }
        if (failures.length) {
          const summary = imported
            ? t('chart.mediaPartial').replace('{ok}', String(imported)).replace('{fail}', String(failures.length))
            : ''
          setError([summary, ...failures].filter(Boolean).join(' · '))
        }
      } finally {
        setBusy(false)
      }
    },
    [onAdd, patientId, t],
  )

  async function openPreview(item: PatientMedia) {
    setPreview(item)
    setPreviewBuffer(null)
    if (item.kind === 'dicom') {
      try {
        setPreviewBuffer(await loadMediaBuffer(item))
      } catch {
        setError(t('chart.mediaError'))
      }
    }
  }

  async function download(item: PatientMedia) {
    const buffer = await loadMediaBuffer(item)
    downloadBuffer(item.originalName, buffer, item.mime)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{t('chart.imaging')}</h2>
        <p className="text-xs text-slate-500">{t('chart.imagingHint')}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) void ingest(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center ${
          dragOver ? 'border-clinic-500 bg-clinic-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <Upload className="mb-2 h-6 w-6 text-clinic-700" />
        <p className="text-sm font-medium text-slate-700">{t('chart.drop')}</p>
        <p className="mt-0.5 text-xs text-slate-500">JPG, PNG, DICOM (.dcm)</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-clinic-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-clinic-800 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {busy ? t('common.loading') : t('chart.upload')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.dcm,.dicom,application/dicom"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void ingest(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {ordered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">{t('chart.mediaEmpty')}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button type="button" onClick={() => void openPreview(item)} className="relative block aspect-[4/3] w-full bg-slate-100">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-slate-400">DICOM</span>
                )}
                <span className="absolute end-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  {item.kind === 'dicom' ? 'DICOM' : 'IMG'}
                </span>
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </span>
              </button>
              <div className="space-y-1.5 p-2.5">
                <input
                  value={item.title}
                  onChange={(e) => onUpdate(item.id, { title: e.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-1 text-xs font-semibold text-slate-800 outline-none hover:border-slate-200 focus:border-clinic-400"
                />
                <p className="truncate text-[10px] text-slate-500" title={item.originalName}>
                  {item.originalName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {item.kind === 'dicom' ? 'DICOM' : (item.originalName.split('.').pop() || 'IMG').toUpperCase()} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('fr-FR')} · {(item.size / 1024).toFixed(0)} Ko
                </p>
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => void download(item)} className="rounded-md p-1 text-clinic-800 hover:bg-clinic-50">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {confirmId === item.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        void removeMediaBlob(patientId, item.filename)
                        onDelete(item.id)
                        setConfirmId(null)
                      }}
                      className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    >
                      {t('common.delete')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(item.id)} className="rounded-md p-1 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{preview.title}</p>
            <button type="button" onClick={() => setPreview(null)} className="rounded-md p-1.5 text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          {preview.kind === 'dicom' ? (
            previewBuffer ? (
              <DicomViewer buffer={previewBuffer} title={preview.title} />
            ) : (
              <p className="text-sm text-slate-300">{t('common.loading')}</p>
            )
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <LightboxImage media={preview} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function LightboxImage({ media }: { media: PatientMedia }) {
  const [src, setSrc] = useState(media.thumbnailUrl || media.dataUrl || '')
  useEffect(() => {
    let url = ''
    void loadMediaBuffer(media)
      .then((buffer) => {
        url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: media.mime || 'image/jpeg' }))
        setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [media])
  if (!src) return null
  return <img src={src} alt={media.title} className="max-h-full max-w-full object-contain" />
}
