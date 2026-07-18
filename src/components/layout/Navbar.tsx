'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { Logo } from './Logo'

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => firstMobileLinkRef.current?.focus())
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const navLinks = [
    { name: 'Beranda', href: '/' },
    { name: 'Cari Obat', href: '/obat' },
    { name: 'Kalkulator', href: '/kalkulator' },
    { name: 'Tentang Kami', href: '/tentang' },
  ]

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav
      aria-label="Navigasi utama"
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,padding,box-shadow] duration-200 ${
        isScrolled ? 'border-b border-border bg-surface/95 py-3 shadow-sm backdrop-blur-md' : 'bg-background/90 py-4 backdrop-blur-sm md:py-5'
      }`}
    >
      <div className="container flex items-center justify-between">
        <Link href="/" className="rounded-xl transition-opacity hover:opacity-80" aria-label="PustakaObat.id, kembali ke beranda">
          <Logo />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-surface-2 hover:text-primary'
              }`}
            >
              {link.name}
            </Link>
          ))}
          
          <Link 
            href="/masuk"
            className="ml-1 inline-flex min-h-11 items-center rounded-full border border-primary/20 bg-primary/5 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Login
          </Link>
        </div>

        {/* Mobile Nav Toggle */}
        <div className="flex items-center md:hidden">
          <button 
            ref={menuButtonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="min-h-11 min-w-11 p-2 rounded-full hover:bg-surface-2 transition-colors text-text"
            aria-label={isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation-menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="fixed inset-0 top-[76px] bg-text/20 backdrop-blur-sm md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false) }}>
          <div id="mobile-navigation-menu" className="absolute inset-x-0 top-0 border-b border-border bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <div className="flex flex-col gap-2">
            <form action="/obat" method="get" className="mb-3 flex min-h-12 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
              <Search size={18} className="shrink-0 text-primary" aria-hidden="true" />
              <label htmlFor="mobile-nav-search" className="sr-only">Cari obat</label>
              <input id="mobile-nav-search" name="q" type="search" placeholder="Cari nama obat" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none" />
            </form>
            {navLinks.map((link, index) => (
              <Link 
                ref={index === 0 ? firstMobileLinkRef : undefined}
                key={link.name} 
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`flex min-h-12 items-center rounded-xl px-4 text-base font-semibold transition-colors ${
                  isActive(link.href) ? 'bg-primary/10 text-primary' : 'text-text hover:bg-surface-2 hover:text-primary'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="my-2 h-px w-full bg-border" />
            <Link 
              href="/masuk"
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-center font-semibold text-white"
            >
              Login
            </Link>
          </div>
          </div>
        </div>
      )}
    </nav>
  )
}
