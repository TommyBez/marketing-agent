'use client'

import { saveConversation, titleConversation } from '@/app/actions/thread'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EveMessage } from 'eve/client'
import { Client, type HandleMessageStreamEvent, type SessionState } from 'eve/client'
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
  const sessionRef = useRef<SessionState>(initialSession ?? { streamIndex: 0 })
  const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistenceChainRef = useRef<Promise<void>>(Promise.resolve())
  const clientRef = useRef<Client | null>(null)
  const [displayTitle, setDisplayTitle] = useState(conversationTitle)
  const [isRestoring, setIsRestoring] = useState(Boolean(initialSession?.sessionId))

  if (!clientRef.current) {
    clientRef.current = new Client({
      host: '',
      headers: { 'x-relay-workspace-id': workspaceId },
      preserveCompletedSessions: true,
    })
  }
  const durableSessionRef = useRef(clientRef.current.session(sessionRef.current))

  function persistConversation(isImmediate = false) {
    if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current)
    const persist = () => {
      const session = sessionRef.current
      const events = [...eventsRef.current]
      persistenceChainRef.current = persistenceChainRef.current
        .catch(() => undefined)
        .then(() => saveConversation(workspaceId, conversationId, session, events, firstMessageRef.current))
    }
    if (isImmediate) persist()
    else persistenceTimerRef.current = setTimeout(persist, 750)
  }

  const agent = useEveAgent({
    initialEvents,
    initialSession,
    optimistic: false,
    session: durableSessionRef.current,
    onEvent: (event) => {
      eventsRef.current.push(event)
      persistConversation()
    },
    onSessionChange: (session) => {
      sessionRef.current = session
      persistConversation()
    },
    onFinish: async (snapshot) => {
      eventsRef.current = [...snapshot.events]
      sessionRef.current = snapshot.session
      persistConversation(true)
      await persistenceChainRef.current
      router.refresh()
    },
  })
  const [message, setMessage] = useState('')
  const isBusy = isRestoring || agent.status === 'submitted' || agent.status === 'streaming'

  useEffect(() => {
    const abortController = new AbortController()
    const savedSession = sessionRef.current

    async function restoreStream() {
      if (!savedSession.sessionId) {
        setIsRestoring(false)
        return
      }
      try {
        for await (const event of durableSessionRef.current.stream({
          startIndex: savedSession.streamIndex,
          signal: abortController.signal,
        })) {
          eventsRef.current.push(event)
        }
      } catch (error) {
        if (!abortController.signal.aborted) console.error('[v0] Failed to restore eve stream:', error)
      } finally {
        if (!abortController.signal.aborted) {
          sessionRef.current = durableSessionRef.current.state
          persistConversation(true)
          setIsRestoring(false)
          router.refresh()
        }
      }
    }

    void restoreStream()
    return () => {
      abortController.abort()
      if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current)
    }
  }, [])

  async function sendMessage(text: string) {
    const nextMessage = text.trim()
    if (!nextMessage || isBusy) return
    if (displayTitle === 'New conversation' && !firstMessageRef.current) {
      firstMessageRef.current = nextMessage
      setDisplayTitle(createConversationTitle(nextMessage))
      void titleConversation(workspaceId, conversationId, nextMessage).then(() => router.refresh())
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
    <section className="flex min-h-0 flex-1 flex-col bg-card">
      <CardHeader className="border-b py-3">
        <CardTitle className="truncate">{displayTitle}</CardTitle>
        <CardDescription>Marketing Manager for {companyName} · 6 specialists available</CardDescription>
      </CardHeader>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto min-h-full w-full max-w-3xl gap-6 p-4 md:p-6">
          {messages.length === 0 ? (
            <ConversationEmptyState className="flex-1 items-start justify-end p-0 text-left">
              <div className="flex w-full flex-col items-start gap-4">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl text-balance">What should we work on today?</h2>
                  <p className="max-w-xl leading-6 text-muted-foreground">
                    Ask for a launch plan, SEO audit, landing page rewrite, campaign brief, or a coordinated review.
                  </p>
                </div>
                <Suggestions className="w-full">
                  {suggestedPrompts.map((prompt) => (
                    <Suggestion key={prompt} suggestion={prompt} disabled={isBusy} onClick={(suggestion) => void sendMessage(suggestion)} />
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
                  </MessageActions>
                )}
              </Message>
            )
          })}
          {isBusy && !isStreamingText && (
            <Shimmer className="text-sm" duration={1.5}>
              {isRestoring ? 'Reconnecting to the team…' : 'The manager is coordinating the team…'}
            </Shimmer>
          )}
          {agent.error && (
            <Alert variant="destructive"><AlertDescription>{agent.error.message}</AlertDescription></Alert>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-3 md:px-6 md:pb-5">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask your marketing manager…"
              aria-label="Message"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-1 text-muted-foreground text-xs">Enter to send · Shift+Enter for a new line</span>
            </PromptInputTools>
            <PromptInputSubmit
              status={isRestoring ? 'submitted' : agent.status}
              onStop={() => agent.stop()}
              disabled={isBusy ? isRestoring : !message.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  )
}
