interface LogoProps {
  compact?: boolean
  light?: boolean
  name?: string
  tagline?: string
  src?: string
}

export function Logo({ compact = false, light = false, name = 'DentiSuite', tagline, src }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      {src ? (
        <img src={src} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/20" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-clinic-400 to-clinic-800 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden>
            <path d="M12 2c-2.4 0-4.3 1.7-4.8 4-.6 2.6.2 5.2 1.1 7.6.6 1.6 1.2 3.2 1.2 4.9 0 1.4.8 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0-1.7.6-3.3 1.2-4.9.9-2.4 1.7-5 1.1-7.6C16.3 3.7 14.4 2 12 2zm0 3.2c.7 0 1.3.6 1.3 1.3S12.7 7.8 12 7.8 10.7 7.2 10.7 6.5 11.3 5.2 12 5.2z" />
          </svg>
        </div>
      )}
      {!compact && (
        <div className="leading-tight">
          <p className={`text-[15px] font-semibold tracking-tight ${light ? 'text-white' : 'text-clinic-900'}`}>
            {name}
          </p>
          {tagline && (
            <p className={`text-[11px] ${light ? 'text-clinic-200' : 'text-slate-500'}`}>{tagline}</p>
          )}
        </div>
      )}
    </div>
  )
}
