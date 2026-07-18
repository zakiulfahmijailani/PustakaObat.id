'use client'

import { RouteErrorState } from '@/components/ui/RouteErrorState'

export default function PublicRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState reset={reset} />
}
