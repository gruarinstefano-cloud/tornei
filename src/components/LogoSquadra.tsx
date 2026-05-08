import Image from 'next/image'

type Props = {
  squadra: { nome: string; logo_url?: string | null }
  size?: number
  className?: string
}

export default function LogoSquadra({ squadra, size = 28, className = '' }: Props) {
  if (squadra.logo_url) {
    return (
      <Image
        src={squadra.logo_url}
        alt={squadra.nome}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={`rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {squadra.nome.slice(0, 2).toUpperCase()}
    </div>
  )
}
