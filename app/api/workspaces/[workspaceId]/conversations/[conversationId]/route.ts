import {
  ConversationPersistenceError,
  persistConversationSession,
  persistConversationTranscript,
} from '@/lib/conversation-persistence'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const persistenceRequestSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('session'),
    sessionState: z.unknown(),
    firstMessage: z.string().optional(),
  }),
  z.object({
    operation: z.literal('transcript'),
    sessionState: z.unknown(),
    events: z.unknown(),
    firstMessage: z.string().optional(),
  }),
])

interface PersistenceRouteContext {
  params: Promise<{ workspaceId: string; conversationId: string }>
}

export async function POST(request: Request, context: PersistenceRouteContext) {
  try {
    const { workspaceId, conversationId } = await context.params
    const payload = persistenceRequestSchema.parse(await request.json())

    if (payload.operation === 'session') {
      await persistConversationSession(workspaceId, conversationId, payload.sessionState, payload.firstMessage)
    } else {
      await persistConversationTranscript(
        workspaceId,
        conversationId,
        payload.sessionState,
        payload.events,
        payload.firstMessage,
      )
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[v0] Failed to persist Eve conversation:', error)
    const status = error instanceof ConversationPersistenceError
      ? error.status
      : error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to persist the Eve conversation' },
      { status },
    )
  }
}
