'use client'

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import {
  SpecialistActivityItem,
  type SpecialistActivityStatus,
} from '@/components/specialist-activity-item'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EveMessageInputRequest, EveMessagePart } from 'eve/react'
import { Check, ExternalLink, FileText, LockKeyhole, X } from 'lucide-react'
import { useState } from 'react'

interface AgentPartProps {
  isBusy: boolean
  onRespond: (requestId: string, response: { optionId?: string; text?: string }) => Promise<void>
  part: EveMessagePart
}

type EveToolPart = Extract<EveMessagePart, { type: 'dynamic-tool' }>

function formatName(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getToolTitle(part: EveToolPart) {
  const name = formatName(part.toolMetadata?.eve?.name ?? part.toolName)
  if (part.toolMetadata?.eve?.kind === 'subagent-call' && !/specialist/i.test(name)) return `${name} specialist`
  if (part.toolMetadata?.eve?.kind === 'load-skill') return `Skill / ${name}`
  return name
}

function hasContent(value: unknown) {
  if (value === undefined || value === null) return false
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return false
  return true
}

function getActivityStatus(state: EveToolPart['state']): SpecialistActivityStatus {
  if (state === 'input-streaming') return 'queued'
  if (state === 'input-available' || state === 'approval-responded') return 'running'
  if (state === 'output-available') return 'completed'
  if (state === 'approval-requested') return 'waiting'
  return 'failed'
}

function HumanInput({ isBusy, onRespond, part, request }: {
  isBusy: boolean
  onRespond: AgentPartProps['onRespond']
  part: EveToolPart
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

  const approval = part.approval && part.approval.approved !== undefined
    ? { id: part.approval.id, approved: part.approval.approved, reason: part.approval.reason }
    : { id: part.approval?.id ?? request.requestId }

  return (
    <Confirmation
      approval={approval}
      state={part.state}
      className="border-primary/30 bg-primary/5"
    >
      <ConfirmationTitle>
        <span className="flex items-start gap-2 font-medium">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          {request.prompt}
        </span>
      </ConfirmationTitle>
      <ConfirmationRequest>
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
      </ConfirmationRequest>
      <ConfirmationActions className="flex-wrap justify-start self-start">
        {request.options?.map((option) => (
          <ConfirmationAction
            key={option.id}
            variant={option.style === 'danger' ? 'destructive' : option.style === 'primary' ? 'default' : 'outline'}
            disabled={isBusy || isSubmitting}
            onClick={() => void respond({ optionId: option.id })}
            title={option.description}
          >
            {option.label}
          </ConfirmationAction>
        ))}
      </ConfirmationActions>
      <ConfirmationAccepted>
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <Check className="size-4 text-success" />
          Approved
        </span>
      </ConfirmationAccepted>
      <ConfirmationRejected>
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <X className="size-4 text-destructive" />
          Declined
        </span>
      </ConfirmationRejected>
    </Confirmation>
  )
}

function ToolPart({ isBusy, onRespond, part }: AgentPartProps & { part: EveToolPart }) {
  const request = part.toolMetadata?.eve?.inputRequest
  const showInput = part.state !== 'input-streaming' && hasContent(part.input)

  return (
    <div className="flex w-full flex-col gap-2">
      <SpecialistActivityItem
        defaultOpen={part.state === 'output-error'}
        kind={part.toolMetadata?.eve?.kind}
        status={getActivityStatus(part.state)}
        state={part.state}
        title={getToolTitle(part)}
        toolName={part.toolName}
      >
        {showInput && <ToolInput input={part.input} />}
        <ToolOutput output={part.state === 'output-available' ? part.output : undefined} errorText={part.errorText} />
      </SpecialistActivityItem>
      {request && <HumanInput isBusy={isBusy} onRespond={onRespond} part={part} request={request} />}
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
    if (!part.text.trim()) return null
    return (
      <Reasoning className="mb-0 w-full" isStreaming={part.state === 'streaming'}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  }
  if (part.type === 'file') {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <FileText className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{part.filename ?? 'Attachment'}</span>
        {part.url && <Button render={<a href={part.url} target="_blank" rel="noreferrer" />} variant="ghost" size="sm">Open <ExternalLink /></Button>}
      </div>
    )
  }
  return null
}
