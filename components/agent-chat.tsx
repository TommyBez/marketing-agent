'use client'

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { AgentPart } from '@/components/agent-activity'
import { SaveArtifactAction } from '@/components/save-artifact-action'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EveMessage } from 'eve/client'
import {
  Client,
  isCurrentTurnBoundaryEvent,
  type ClientSession,
  type HandleMessageStreamEvent,
  type MessageResponse as EveMessageResponse,
  type SendTurnInput,
  type SessionState,
} from 'eve/client'
import { useEveAgent } from 'eve/react'
import { Check, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface AgentChatProps {
  companyName: string
  conversationId: string
  conversationTitle: string
  initialEvents?: HandleMessageStreamEvent[]
  initialSession?: SessionState
  workspaceId: string
}

const suggestedPrompts = [
  'Audit our positioning',
  'Plan the next 30 days',
  'Find SEO opportunities',
  'Draft a campaign brief',
  'Rewrite our landing page',
]

const streamReconnectAttempts = 40

function createConversationTitle(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim()
  return normalized.length > 64 ? `${normalized.slice(0, 61).trimEnd()}…` : normalized
}

function getMessageText(message: EveMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
}

function needsStreamRestore(session: SessionState | undefined, events: readonly HandleMessageStreamEvent[] | undefined) {
  if (!session?.sessionId) return false
  const lastEvent = events?.at(-1)
  return !lastEvent || !isCurrentTurnBoundaryEvent(lastEvent)
}

function isFailedSessionEvent(event: HandleMessageStreamEvent | undefined) {
  return event?.type === 'session.failed'
}

function getInitialSessionError(
  session: SessionState | undefined,
  events: readonly HandleMessageStreamEvent[] | undefined,
) {
  if (session?.sessionId || !events?.length || isCurrentTurnBoundaryEvent(events.at(-1)!)) return ''
  return 'This conversation lost its Eve session cursor and cannot be resumed safely. Start a new conversation.'
}

function normalizeInitialSession(session: SessionState | undefined): SessionState {
  return {
    ...session,
    streamIndex: session?.streamIndex ?? 0,
  }
}

function CopyMessageAction({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false)

  return (
    <MessageAction
      label="Copy message"
      tooltip={isCopied ? 'Copied' : 'Copy'}
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }}
    >
      {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  )
}

export function AgentChat({ companyName, conversationId, conversationTitle, initialEvents, initialSession, workspaceId }: AgentChatProps) {
  const router = useRouter()
  const firstMessageRef = useRef('')
  const eventsRef = useRef<HandleMessageStreamEvent[]>([...(initialEvents ?? [])])
  const sessionRef = useRef<SessionState>(normalizeInitialSession(initialSession))
  const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistenceChainRef = useRef<Promise<void>>(Promise.resolve())
  const clientRef = useRef<Client | null>(null)
  const durableSessionRef = useRef<ClientSession | null>(null)
  const [displayTitle, setDisplayTitle] = useState(conversationTitle)
  const [isRestoring, setIsRestoring] = useState(() => needsStreamRestore(initialSession, initialEvents))
  const [restoreError, setRestoreError] = useState(() => getInitialSessionError(initialSession, initialEvents))

  if (!clientRef.current) {
    clientRef.current = new Client({
      host: '',
      headers: { 'x-relay-workspace-id': workspaceId },
      maxReconnectAttempts: streamReconnectAttempts,
      preserveCompletedSessions: true,
    })
  }

  async function persistToApi(payload: Record<string, unknown>) {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (response.ok) return
    const result = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(result?.error ?? 'Unable to persist the Eve conversation')
  }

  function enqueueConversationPersistence() {
    const session = sessionRef.current
    const events = [...eventsRef.current]
    const nextPersistence = persistenceChainRef.current
      .catch(() => undefined)
      .then(() => persistToApi({
        operation: 'transcript',
        sessionState: session,
        events,
        firstMessage: firstMessageRef.current,
      }))
    persistenceChainRef.current = nextPersistence
    return nextPersistence
  }

  function persistConversation(isImmediate = false): Promise<void> {
    if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current)
    if (isImmediate) return enqueueConversationPersistence()
    persistenceTimerRef.current = setTimeout(() => {
      void enqueueConversationPersistence().catch((error) => {
        console.error('[v0] Failed to persist Eve conversation:', error)
        setRestoreError('The Eve session could not be saved safely. Reload before continuing.')
      })
    }, 750)
    return Promise.resolve()
  }

  function persistSessionCursor(session: SessionState) {
    const nextPersistence = persistenceChainRef.current
      .catch(() => undefined)
      .then(() => persistToApi({
        operation: 'session',
        sessionState: session,
        firstMessage: firstMessageRef.current,
      }))
    persistenceChainRef.current = nextPersistence
    return nextPersistence
  }

  async function handleSessionAccepted<TOutput>(response: EveMessageResponse<TOutput>) {
    const currentSession = sessionRef.current
    if (currentSession.sessionId && currentSession.sessionId !== response.sessionId) {
      throw new Error('Eve returned a different session for this conversation')
    }

    const nextSession = {
      continuationToken: response.continuationToken ?? currentSession.continuationToken,
      sessionId: response.sessionId,
      streamIndex: currentSession.streamIndex,
    }
    sessionRef.current = nextSession
    await persistSessionCursor(nextSession)
  }

  if (!durableSessionRef.current) {
    const session = clientRef.current.session(sessionRef.current)
    const send = session.send.bind(session)
    session.send = async function trackedSend<TOutput = unknown>(input: SendTurnInput<TOutput>) {
      const response = await send<TOutput>(input)
      await handleSessionAccepted(response)
      return response
    }
    durableSessionRef.current = session
  }

  const agent = useEveAgent({
    initialEvents,
    initialSession,
    optimistic: false,
    session: durableSessionRef.current,
    onEvent: (event) => {
      eventsRef.current.push(event)
      if (sessionRef.current.sessionId) {
        sessionRef.current = {
          ...sessionRef.current,
          streamIndex: sessionRef.current.streamIndex + 1,
        }
      }
      persistConversation()
    },
    onSessionChange: (session) => {
      if (session.sessionId) sessionRef.current = session
    },
    onFinish: async (snapshot) => {
      eventsRef.current = [...snapshot.events]
      if (snapshot.session.sessionId) sessionRef.current = snapshot.session
      try {
        await persistConversation(true)
        router.refresh()
      } catch (error) {
        console.error('[v0] Failed to persist completed Eve turn:', error)
        setRestoreError('The completed Eve turn could not be saved safely. Reload before continuing.')
      }
    },
  })
  const [message, setMessage] = useState('')
  const isAgentProcessing = agent.status === 'submitted' || agent.status === 'streaming'
  const isComposerBlocked = isRestoring || Boolean(restoreError)
  const isBusy = isComposerBlocked || isAgentProcessing

  useEffect(() => {
    const abortController = new AbortController()
    const savedSession = sessionRef.current

    async function restoreStream() {
      try {
        if (savedSession.sessionId && savedSession.streamIndex > (initialSession?.streamIndex ?? 0)) {
          await persistSessionCursor(savedSession)
        }
        if (!needsStreamRestore(savedSession, initialEvents)) {
          setIsRestoring(false)
          return
        }
        let reachedBoundary = false
        for await (const event of durableSessionRef.current!.stream({
          startIndex: savedSession.streamIndex,
          signal: abortController.signal,
        })) {
          eventsRef.current.push(event)
          sessionRef.current = {
            ...sessionRef.current,
            streamIndex: sessionRef.current.streamIndex + 1,
          }
          persistConversation()
          if (isCurrentTurnBoundaryEvent(event)) {
            reachedBoundary = true
            break
          }
        }
        if (!reachedBoundary) {
          if (abortController.signal.aborted) return
          throw new Error('The Eve stream disconnected before the turn reached a safe boundary. Reload to retry.')
        }
        sessionRef.current = durableSessionRef.current!.state.sessionId
          ? durableSessionRef.current!.state
          : sessionRef.current
        await persistConversation(true)
        if (!abortController.signal.aborted) {
          setIsRestoring(false)
          router.refresh()
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('[v0] Failed to restore eve stream:', error)
          setRestoreError(error instanceof Error ? error.message : 'Unable to reconnect to the Eve session')
          setIsRestoring(false)
        }
      }
    }

    const restoreTimer = setTimeout(() => void restoreStream(), 0)
    return () => {
      clearTimeout(restoreTimer)
      abortController.abort()
      if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current)
    }
  }, [])

  async function sendMessage(text: string) {
    const nextMessage = text.trim()
    if (!nextMessage || isBusy) return
    if (isFailedSessionEvent(eventsRef.current.at(-1))) {
      setRestoreError('This Eve session has ended. Start a new conversation to continue.')
      return
    }
    if (!sessionRef.current.sessionId && eventsRef.current.some((event) => event.type === 'session.started')) {
      setRestoreError('This conversation lost its Eve session cursor and cannot be continued safely. Start a new conversation.')
      return
    }
    if (displayTitle === 'New conversation' && !firstMessageRef.current) {
      firstMessageRef.current = nextMessage
      setDisplayTitle(createConversationTitle(nextMessage))
    }
    setMessage('')
    await agent.send({ message: nextMessage })
  }

  async function respondToInput(requestId: string, response: { optionId?: string; text?: string }) {
    await agent.send({ inputResponses: [{ requestId, ...response }] })
  }

  function handleSubmit(promptMessage: PromptInputMessage) {
    void sendMessage(promptMessage.text ?? message)
  }

  const messages = agent.data.messages
  const lastMessage = messages.at(-1)
  const isStreamingText = agent.status === 'streaming'
    && lastMessage?.role === 'assistant'
    && lastMessage.parts.at(-1)?.type === 'text'

  return (
    <section className="chat-shell flex min-h-0 flex-1 flex-col">
      <CardHeader className="border-b py-3">
        <CardTitle className="chat-heading truncate">{displayTitle}</CardTitle>
        <CardDescription className="chat-subheading">Brand director for {companyName}, with 6 specialists available</CardDescription>
      </CardHeader>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto min-h-full w-full max-w-3xl gap-6 p-4 md:p-6">
          {messages.length === 0 ? (
            <ConversationEmptyState className="flex-1 items-start justify-end p-0 text-left">
              <div className="flex w-full flex-col items-start gap-4">
                <div className="space-y-2">
                  <h2 className="chat-empty-title">What should we make unmistakably yours?</h2>
                  <p className="max-w-xl leading-6 text-muted-foreground">
                    Ask for a launch plan, SEO audit, landing page rewrite, campaign brief, or a coordinated review.
                  </p>
                </div>
                <Suggestions className="w-full">
                  {suggestedPrompts.map((prompt) => (
                    <Suggestion className="h-auto min-h-10 rounded-xl border-border/70 bg-background/60 px-4 py-2 text-xs" key={prompt} suggestion={prompt} disabled={isBusy} onClick={(suggestion) => void sendMessage(suggestion)} />
                  ))}
                </Suggestions>
              </div>
            </ConversationEmptyState>
          ) : messages.map((item, messageIndex) => {
            const isLatestMessage = messageIndex === messages.length - 1
            const messageText = getMessageText(item)

            return (
              <Message from={item.role} key={item.id}>
                <MessageContent className="group-[.is-assistant]:w-full">
                  {item.parts.map((part, partIndex) => {
                    if (part.type !== 'text') {
                      return <AgentPart key={`${part.type}-${partIndex}`} part={part} isBusy={isBusy} onRespond={respondToInput} />
                    }
                    if (item.role === 'user') return <p className="whitespace-pre-wrap" key={partIndex}>{part.text}</p>

                    const isAnimating = isBusy && isLatestMessage && part.state === 'streaming'
                    return (
                      <MessageResponse
                        className="min-w-0"
                        key={partIndex}
                        mode={isAnimating ? 'streaming' : 'static'}
                        isAnimating={isAnimating}
                      >
                        {part.text}
                      </MessageResponse>
                    )
                  })}
                </MessageContent>
                {item.role === 'assistant' && messageText && !(isBusy && isLatestMessage) && (
                  <MessageActions className="-ml-2">
                    <CopyMessageAction text={messageText} />
                    <SaveArtifactAction workspaceId={workspaceId} conversationId={conversationId} text={messageText} />
                  </MessageActions>
                )}
              </Message>
            )
          })}
          {isBusy && !isStreamingText && (
            <Shimmer className="text-sm" duration={1.5}>
              {isRestoring ? 'The team is still working…' : 'The manager is coordinating the team…'}
            </Shimmer>
          )}
          {agent.error && (
            <Alert variant="destructive"><AlertDescription>{agent.error.message}</AlertDescription></Alert>
          )}
          {restoreError && (
            <Alert variant="destructive"><AlertDescription>{restoreError}</AlertDescription></Alert>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="composer-shell w-full p-3 md:px-6 md:pb-5">
        <div className="mx-auto w-full max-w-3xl">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask your brand director…"
              aria-label="Message"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-1 text-muted-foreground text-xs">Enter to send / Shift+Enter for a new line</span>
            </PromptInputTools>
            <PromptInputSubmit
              status={isRestoring ? 'submitted' : agent.status}
              onStop={() => agent.stop()}
              disabled={isComposerBlocked || (!isAgentProcessing && !message.trim())}
            />
          </PromptInputFooter>
        </PromptInput>
        </div>
      </div>
    </section>
  )
}
