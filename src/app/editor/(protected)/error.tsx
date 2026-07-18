'use client'

import { RouteErrorState } from '@/components/ui/RouteErrorState'

export default function EditorRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState reset={reset} workspace />
}
