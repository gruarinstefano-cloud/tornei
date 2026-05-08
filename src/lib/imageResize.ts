export type ImageType = 'logo_squadra' | 'logo_sponsor' | 'banner'
const SIZES: Record<ImageType, { w: number; h: number }> = {
  logo_squadra: { w: 120, h: 120 },
  logo_sponsor: { w: 240, h: 120 },
  banner: { w: 1200, h: 300 },
}
export async function resizeImage(file: File, type: ImageType): Promise<File> {
  const { w, h } = SIZES[type]
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      const scale = Math.max(w / img.width, h / img.height)
      const sw = img.width * scale, sh = img.height * scale
      const sx = (w - sw) / 2, sy = (h - sh) / 2
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, sx, sy, sw, sh)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Resize failed')); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.88)
    }
    img.onerror = reject; img.src = url
  })
}
