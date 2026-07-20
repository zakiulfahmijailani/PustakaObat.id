import Image from 'next/image'
import React from 'react'

/** Shared PustakaObat.id brand logo used by the public and staff interfaces. */
export const Logo = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <Image
        src="/brand-logo.png"
        alt="PustakaObat.id — Pustaka Obat Indonesia"
        width={1548}
        height={395}
        priority
        className="h-auto w-[178px] sm:w-[205px]"
      />
    </div>
  )
}
