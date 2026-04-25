'use client'
import Image from 'next/image'
import type { Torneo, Sponsor } from '@/lib/types'

type Props = {
  torneo: Torneo
  sponsor: Sponsor[]
}

export default function BannerTorneo({ torneo, sponsor }: Props) {
  const primary = torneo.colore_primario || '#1e40af'

  return (
    <div className="w-full">
      {/* Banner immagine */}
      {torneo.banner_url ? (
        <div className="relative w-full" style={{ height: '180px' }}>
          <Image
            src={torneo.banner_url}
            alt={torneo.nome}
            fill
            className="object-cover"
            priority
          />
          {/* Overlay con nome torneo */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end px-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 border-2 border-white/40"
                style={{ background: primary }}>
                {(torneo.nome_societa || torneo.nome).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-bold text-xl leading-tight drop-shadow">{torneo.nome_societa || torneo.nome}</div>
                <div className="text-white/80 text-sm">{torneo.nome}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Fallback senza immagine */
        <div className="px-4 py-4" style={{ background: primary + '18', borderBottom: `2px solid ${primary}30` }}>
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: primary }}>
              {(torneo.nome_societa || torneo.nome).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg leading-tight">{torneo.nome_societa || torneo.nome}</div>
              <div className="text-sm text-gray-500">{torneo.nome}</div>
            </div>
          </div>
        </div>
      )}

      {/* Striscia sponsor */}
      {sponsor.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-4 overflow-x-auto">
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">Con il supporto di</span>
            <div className="flex items-center gap-4 flex-1">
              {sponsor.sort((a, b) => a.ordine - b.ordine).map(s => (
                <SponsorBadge key={s.id} sponsor={s}/>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SponsorBadge({ sponsor }: { sponsor: Sponsor }) {
  const inner = sponsor.logo_url ? (
    <Image
      src={sponsor.logo_url}
      alt={sponsor.nome}
      width={120}
      height={60}
      className="object-contain"
    />
  ) : (
    <span className="text-sm font-medium text-gray-600 whitespace-nowrap px-2">{sponsor.nome}</span>
  )

  if (sponsor.sito_web) {
    return (
      <a href={sponsor.sito_web} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center h-10 px-2 rounded hover:bg-gray-50 transition flex-shrink-0"
        title={sponsor.nome}>
        {inner}
      </a>
    )
  }
  return (
    <div className="flex items-center justify-center h-10 px-2 flex-shrink-0" title={sponsor.nome}>
      {inner}
    </div>
  )
}
