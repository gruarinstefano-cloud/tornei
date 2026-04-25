import Image from 'next/image'

type Props = {
  squadra: { nome: string; logo_url?: string | null }
  size?: number
  className?: string
}

export default function LogoSquadra({ squadra, size = 28, className = '' }: Props) {
  if (squadra.logo_url) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center ${className}`}
        style={{ width: size, height: size, minWidth: size }}>
        <Image
          src={squadra.logo_url}
          alt={squadra.nome}
          width={size}
          height={size}
          className="object-contain w-full h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>
    )
  }
  return (
    <div
      className={`rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold flex-shrink-0 border border-gray-200 ${className}`}
      style={{ width: size, height: size, minWidth: size, fontSize: Math.max(9, size * 0.35) }}>
      {squadra.nome.slice(0, 2).toUpperCase()}
    </div>
  )
}
