import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-grow pt-24 outline-none md:pt-32">
        {children}
      </main>
      <Footer />
    </div>
  )
}
