'use client'

import { Badge } from '@/components/ui/badge'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import type { HandleMessageStreamEvent } from 'eve/client'
import { Bot, Brain, Check, ChevronDown, CircleDashed, Wrench } from 'lucide-react'

interface AgentActivityProps {
  events: readonly HandleMessageStreamEvent[]
  isBusy: boolean
}

interface ActivityItem {
  id: string
  kind: 'reasoning' | 'tool' | 'subagent'
  label: string
  detail?: string
  output?: string
  status: 'running' | 'completed' | 'failed'
}

function formatName(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getActivity(events: readonly HandleMessageStreamEvent[]) {
  const items = new Map<string, ActivityItem>()

  for (const event of events) {
    if (event.type === 'reasoning.appended') {
      const id = `reasoning-${event.data.turnId}-${event.data.stepIndex}`
      items.set(id, {
        id,
        kind: 'reasoning',
        label: 'Thinking',
        detail: event.data.reasoningSoFar,
        status: 'running',
      })
    }

    if (event.type === 'reasoning.completed') {
      const id = `reasoning-${event.data.turnId}-${event.data.stepIndex}`
      items.set(id, {
        id,
        kind: 'reasoning',
        label: 'Thought process',
        detail: event.data.reasoning,
        status: 'completed',
      })
    }

    if (event.type === 'actions.requested') {
      for (const action of event.data.actions) {
        if (action.kind === 'tool-call') {
          items.set(action.callId, {
            id: action.callId,
            kind: 'tool',
            label: formatName(action.toolName),
            detail: formatValue(action.input),
            status: 'running',
          })
        }

        if (action.kind === 'subagent-call' || action.kind === 'remote-agent-call') {
          const name = action.kind === 'subagent-call' ? action.subagentName : action.remoteAgentName
          items.set(action.callId, {
            id: action.callId,
            kind: 'subagent',
            label: formatName(name),
            detail: action.description,
            status: 'running',
          })
        }
      }
    }

    if (event.type === 'action.result') {
      const current = items.get(event.data.result.callId)
      const result = event.data.result
      const name = result.kind === 'tool-result'
        ? result.toolName
        : result.kind === 'subagent-result'
          ? result.subagentName
          : result.name ?? 'Skill'

      items.set(result.callId, {
        id: result.callId,
        kind: result.kind === 'subagent-result' ? 'subagent' : 'tool',
        label: current?.label ?? formatName(name),
        detail: current?.detail,
        output: event.data.error?.message ?? formatValue(result.output),
        status: event.data.status === 'completed' ? 'completed' : 'failed',
      })
    }

    if (event.type === 'subagent.called') {
      const current = items.get(event.data.callId)
      items.set(event.data.callId, {
        id: event.data.callId,
        kind: 'subagent',
        label: current?.label ?? formatName(event.data.name),
        detail: current?.detail,
        status: 'running',
      })
    }

    if (event.type === 'subagent.started') {
      items.set(event.data.callId, {
        id: event.data.callId,
        kind: 'subagent',
        label: formatName(event.data.subagentName),
        status: 'running',
      })
    }

    if (event.type === 'subagent.event') {
      const current = items.get(event.data.callId)
      const childEvent = event.data.event
      let output = current?.output

      if (childEvent.type === 'message.appended') output = childEvent.data.messageSoFar
      if (childEvent.type === 'message.completed') output = childEvent.data.message ?? output
      if (childEvent.type === 'reasoning.appended') output = childEvent.data.reasoningSoFar

      items.set(event.data.callId, {
        id: event.data.callId,
        kind: 'subagent',
        label: current?.label ?? formatName(event.data.subagentName),
        detail: current?.detail,
        output,
        status: 'running',
      })
    }

    if (event.type === 'subagent.completed') {
      const current = items.get(event.data.callId)
      items.set(event.data.callId, {
        id: event.data.callId,
        kind: 'subagent',
        label: current?.label ?? formatName(event.data.subagentName),
        detail: current?.detail,
        output: event.data.output,
        status: 'completed',
      })
    }
  }

  return Array.from(items.values())
}

function ActivityIcon({ item }: { item: ActivityItem }) {
  if (item.status === 'completed') return <Check />
  if (item.kind === 'reasoning') return <Brain />
  if (item.kind === 'subagent') return <Bot />
  if (item.kind === 'tool') return <Wrench />
  return <CircleDashed />
}

function ActivityRow({ item, isLatest }: { item: ActivityItem; isLatest: boolean }) {
  const isOpen = item.status === 'running' && isLatest
  const hasDetails = Boolean(item.detail || item.output)

  if (!hasDetails) {
    return (
      <Marker>
        <MarkerIcon><ActivityIcon item={item} /></MarkerIcon>
        <MarkerContent>{item.label}</MarkerContent>
        <Badge variant="outline">{item.status === 'running' ? 'Running' : item.status}</Badge>
      </Marker>
    )
  }

  return (
    <details className="group rounded-lg border bg-muted/40 p-3" open={isOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground"><ActivityIcon item={item} /></span>
        <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
        <Badge variant="outline">{item.status === 'running' ? 'Running' : item.status}</Badge>
        <ChevronDown className="text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 pt-3 text-xs leading-5 text-muted-foreground">
        {item.detail && <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans">{item.detail}</pre>}
        {item.output && (
          <div className="flex flex-col gap-1 border-t pt-3">
            <span className="font-medium text-foreground">Output</span>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono">{item.output}</pre>
          </div>
        )}
      </div>
    </details>
  )
}

export function AgentActivity({ events, isBusy }: AgentActivityProps) {
  const activity = getActivity(events)
  if (activity.length === 0) return null

  return (
    <div className="flex flex-col gap-2" aria-live="polite" aria-label="Agent activity">
      {activity.map((item, index) => (
        <ActivityRow key={item.id} item={item} isLatest={isBusy && index === activity.length - 1} />
      ))}
    </div>
  )
}
