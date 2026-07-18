import Image from 'next/image'
import React from 'react'

/** Shared PustakaObat.id wordmark used by the public and staff interfaces. */
export const Logo = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <Image src="/logo.svg" alt="PustakaObat.id" width={1200} height={360} priority className="h-auto w-[178px] sm:w-[205px]" />
    </div>
  )
}
