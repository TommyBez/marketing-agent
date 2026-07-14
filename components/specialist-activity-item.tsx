'use client'

import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool'
import { cn } from '@/lib/utils'
import type { DynamicToolUIPart } from 'ai'
import type { ReactNode } from 'react'

export type SpecialistActivityStatus = 'queued' | 'running' | 'completed' | 'waiting' | 'failed'

interface SpecialistActivityItemProps {
  children?: ReactNode
  className?: string
  defaultOpen?: boolean
  kind?: string
  status: SpecialistActivityStatus
  state?: DynamicToolUIPart['state']
  title: string
  toolName: string
}

const toolStateByStatus = {
  queued: 'input-streaming',
  running: 'input-available',
  completed: 'output-available',
  waiting: 'approval-requested',
  failed: 'output-error',
} as const satisfies Record<SpecialistActivityStatus, DynamicToolUIPart['state']>

export function SpecialistActivityItem({
  children,
  className,
  defaultOpen,
  kind,
  status,
  state,
  title,
  toolName,
}: SpecialistActivityItemProps) {
  return (
    <Tool
      className={cn('mb-0', className)}
      data-activity-status={status}
      data-tool-kind={kind}
      data-tool-name={toolName}
      defaultOpen={defaultOpen}
    >
      <ToolHeader
        type="dynamic-tool"
        toolName={toolName}
        title={title}
        state={state ?? toolStateByStatus[status]}
      />
      {children !== undefined && <ToolContent>{children}</ToolContent>}
    </Tool>
  )
}
