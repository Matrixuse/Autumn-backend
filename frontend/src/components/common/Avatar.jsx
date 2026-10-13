import { useState } from 'react'

export default function Avatar({ label = 'A', image, size = 'md' }) {
  const [failedImage, setFailedImage] = useState(null)
  const dimensions = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-9 w-9 text-xs'
  const hasImage = typeof image === 'string' && image.length > 0 && image !== failedImage

  return (
    hasImage ?
      <img src={image} alt="Profile" onError={() => setFailedImage(image)} className={`${dimensions} rounded-full object-cover`} /> :
        <div className={`${dimensions} grid place-items-center rounded-full border border-[#1c5387] bg-[#0b2446] font-bold text-[#e0ebec]`}>
            {label.slice(0, 2).toUpperCase()}
        </div>
  )
}