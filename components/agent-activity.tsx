'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EveMessageInputRequest, EveMessagePart } from 'eve/react'
import { Bot, Check, ExternalLink, FileText, LoaderCircle, LockKeyhole, Wrench } from 'lucide-react'
import { useState } from 'react'

interface AgentPartProps {
  isBusy: boolean
  onRespond: (requestId: string, response: { optionId?: string; text?: string }) => Promise<void>
  part: EveMessagePart
}

function formatName(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getToolStatus(part: Extract<EveMessagePart, { type: 'dynamic-tool' }>) {
  if (part.state === 'output-available') return 'Completed'
  if (part.state === 'output-error') return 'Failed'
  if (part.state === 'output-denied') return 'Declined'
  if (part.state === 'approval-requested') return 'Needs input'
  if (part.state === 'approval-responded') return 'Responding'
  return 'Running'
}

function HumanInput({ isBusy, onRespond, request }: {
  isBusy: boolean
  onRespond: AgentPartProps['onRespond']
  request: EveMessageInputRequest
}) {
  const [freeform, setFreeform] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function respond(response: { optionId?: string; text?: string }) {
    if (isBusy || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onRespond(request.requestId, response)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Alert className="mt-2 border-primary/30 bg-primary/5">
      <LockKeyhole />
      <AlertTitle>Manager approval</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{request.prompt}</p>
        {request.options && request.options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {request.options.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={option.style === 'danger' ? 'destructive' : option.style === 'primary' ? 'default' : 'outline'}
                disabled={isBusy || isSubmitting}
                onClick={() => void respond({ optionId: option.id })}
                title={option.description}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
        {(request.allowFreeform || request.display === 'text') && (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const text = freeform.trim()
              if (text) void respond({ text })
            }}
          >
            <Input
              value={freeform}
              onChange={(event) => setFreeform(event.target.value)}
              placeholder="Type your response"
              disabled={isBusy || isSubmitting}
              aria-label="Approval response"
            />
            <Button type="submit" size="sm" disabled={!freeform.trim() || isBusy || isSubmitting}>Send</Button>
          </form>
        )}
      </AlertDescription>
    </Alert>
  )
}

function ToolPart({ isBusy, onRespond, part }: AgentPartProps & { part: Extract<EveMessagePart, { type: 'dynamic-tool' }> }) {
  const request = part.toolMetadata?.eve?.inputRequest
  const hasPendingRequest = Boolean(request && !part.toolMetadata?.eve?.inputResponse)
  const isFailed = part.state === 'output-error'

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Wrench className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{formatName(part.toolMetadata?.eve?.name ?? part.toolName)}</span>
        <Badge variant={isFailed ? 'destructive' : 'outline'}>{getToolStatus(part)}</Badge>
      </div>
      {part.state === 'output-error' && <p className="mt-2 text-sm text-destructive">{part.errorText}</p>}
      {hasPendingRequest && request && <HumanInput isBusy={isBusy} onRespond={onRespond} request={request} />}
    </div>
  )
}

function AuthorizationPart({ part }: { part: Extract<EveMessagePart, { type: 'authorization' }> }) {
  if (part.state === 'completed') {
    return (
      <Alert>
        <Check />
        <AlertTitle>{part.displayName}</AlertTitle>
        <AlertDescription>{part.outcome === 'authorized' ? 'Connection authorized.' : `Authorization ${part.outcome}.`}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <LockKeyhole />
      <AlertTitle>Connect {part.displayName}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{part.authorization?.instructions ?? part.description}</p>
        {part.authorization?.userCode && <code className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-foreground">{part.authorization.userCode}</code>}
        {part.authorization?.url && (
          <Button render={<a href={part.authorization.url} target="_blank" rel="noreferrer" />} size="sm" className="w-fit">
            Authorize <ExternalLink />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function AgentPart({ isBusy, onRespond, part }: AgentPartProps) {
  if (part.type === 'dynamic-tool') return <ToolPart isBusy={isBusy} onRespond={onRespond} part={part} />
  if (part.type === 'authorization') return <AuthorizationPart part={part} />
  if (part.type === 'reasoning') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {part.state === 'streaming' ? <LoaderCircle className="animate-spin" /> : <Check />}
        <span>{part.state === 'streaming' ? 'Planning the next step' : 'Plan completed'}</span>
      </div>
    )
  }
  if (part.type === 'file') {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <FileText className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{part.filename ?? 'Attachment'}</span>
        {part.url && <Button render={<a href={part.url} target="_blank" rel="noreferrer" />} variant="ghost" size="sm">Open <ExternalLink /></Button>}
      </div>
    )
  }
  if (part.type === 'step-start') {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot /><span>Specialist step started</span></div>
  }
  return null
}
