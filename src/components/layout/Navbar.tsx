'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Logo } from './Logo'

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Beranda', href: '/' },
    { name: 'Cari Obat', href: '/obat' },
    { name: 'Kalkulator', href: '/kalkulator' },
    { name: 'Tentang Kami', href: '/tentang' },
  ]

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-surface/95 backdrop-blur-md border-b border-border py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="container flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-primary'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              {link.name}
            </Link>
          ))}
          
          <Link 
            href="/masuk"
            className="ml-2 px-5 py-2.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary hover:text-white transition-colors"
          >
            Login
          </Link>
        </div>

        {/* Mobile Nav Toggle */}
        <div className="flex items-center md:hidden">
          <button 
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
        <div id="mobile-navigation-menu" className="md:hidden absolute top-full left-0 right-0 bg-surface border-b border-border p-6 shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`text-lg font-medium transition-colors ${
                  pathname === link.href ? 'text-primary' : 'text-text hover:text-primary'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px w-full bg-border" />
            <Link 
              href="/masuk"
              onClick={() => setIsOpen(false)}
              className="w-full py-4 text-center rounded-xl bg-primary text-white font-semibold"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
