import React from 'react'

/** Public brand mark: an opened capsule that grows into a small sprout. */
export const Logo = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-primary" aria-hidden="true">
        <path d="M5.8 12.1 12.1 5.8a6.1 6.1 0 0 1 8.6 0l3.5 3.5-14.9 14.9-3.5-3.5a6.1 6.1 0 0 1 0-8.6Z" fill="currentColor" />
        <path d="m20.2 9.3 4.1 4.1-15 15-4.1-4.1 15-15Z" fill="white" opacity=".92" />
        <path d="m27.9 5.7 6.4 6.4a6.1 6.1 0 0 1 0 8.6L28.5 26 13.7 11.2l5.6-5.6a6.1 6.1 0 0 1 8.6 0Z" fill="currentColor" opacity=".82" />
        <path d="M20 31.8v-5.1M20 29.3c-3.7 0-6.6-2.3-7.5-5.6 3.7 0 6.6 2.3 7.5 5.6ZM20 29.3c3.7 0 6.6-2.3 7.5-5.6-3.7 0-6.6 2.3-7.5 5.6Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16.4" cy="19.8" r="1.35" fill="#C99B3B" />
        <circle cx="20" cy="17.2" r="1.35" fill="#C99B3B" />
        <circle cx="23.6" cy="19.8" r="1.35" fill="#C99B3B" />
      </svg>
      <span className="text-lg font-bold tracking-[-0.055em] text-text sm:text-xl">
        Pustaka<span className="text-primary">Obat</span><span className="text-text-muted">.id</span>
      </span>
    </div>
  )
}
