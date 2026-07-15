'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Loader2, LogOut } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/Button'

export function LogoutButton({ className, variant = 'ghost', children = 'Keluar' }: Pick<ButtonProps, 'className' | 'variant' | 'children'>) {
  const [loading, setLoading] = useState(false)

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await signOut({ redirectTo: '/login' })
      }}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
      {children}
    </Button>
  )
}

