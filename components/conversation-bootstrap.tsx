'use client'

import { createConversation } from '@/app/actions/thread'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function ConversationBootstrap({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const startedRef = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void createConversation(workspaceId)
      .then((conversation) => {
        router.replace(`/workspace/${workspaceId}?conversation=${conversation.id}`)
        router.refresh()
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Unable to create a conversation')
      })
  }, [attempt, router, workspaceId])

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                startedRef.current = false
                setError('')
                setAttempt((current) => current + 1)
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <Spinner /> Preparing your first conversation…
    </div>
  )
}
