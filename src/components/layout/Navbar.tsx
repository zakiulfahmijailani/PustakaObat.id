'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { Logo } from './Logo'

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const navLinks = [
    { name: 'Beranda', href: '/' },
    { name: 'Informasi Obat', href: '/obat' },
    { name: 'Tanya Farmasis', href: '/tanya' },
    { name: 'Kalkulator Dosis', href: '/kalkulator' },
  ]

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-surface/80 backdrop-blur-md border-b border-border py-4' : 'bg-transparent py-6'
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
          
          <div className="h-4 w-px bg-border mx-2" />
          
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-2 transition-colors text-text-muted hover:text-primary"
            aria-label="Toggle Dark Mode"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <Link 
            href="/masuk"
            className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm"
          >
            Masuk
          </Link>
        </div>

        {/* Mobile Nav Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          <button 
            onClick={toggleTheme}
            className="min-h-11 min-w-11 p-2 rounded-full hover:bg-surface-2 transition-colors text-text-muted"
            aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
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
              Masuk
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
