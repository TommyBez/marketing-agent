'use client'

import { saveConversation, titleConversation } from '@/app/actions/thread'
import { AgentActivity } from '@/components/agent-activity'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Message, MessageContent, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import type { HandleMessageStreamEvent, SessionState } from 'eve/client'
import { useEveAgent } from 'eve/react'
import { ArrowUp, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

interface AgentChatProps {
  companyName: string
  conversationId: string
  conversationTitle: string
  initialEvents?: HandleMessageStreamEvent[]
  initialSession?: SessionState
  workspaceId: string
}

const suggestedPrompts = ['Audit our positioning', 'Plan the next 30 days', 'Find SEO opportunities']

function createConversationTitle(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim()
  return normalized.length > 64 ? `${normalized.slice(0, 61).trimEnd()}…` : normalized
}

export function AgentChat({ companyName, conversationId, conversationTitle, initialEvents, initialSession, workspaceId }: AgentChatProps) {
  const router = useRouter()
  const firstMessageRef = useRef('')
  const [displayTitle, setDisplayTitle] = useState(conversationTitle)
  const agent = useEveAgent({
    headers: { 'x-relay-workspace-id': workspaceId },
    initialEvents,
    initialSession,
    onFinish: async (snapshot) => {
      await saveConversation(workspaceId, conversationId, snapshot.session, snapshot.events, firstMessageRef.current)
      router.refresh()
    },
  })
  const [message, setMessage] = useState('')
  const isBusy = agent.status === 'submitted' || agent.status === 'streaming'

  async function sendMessage() {
    const nextMessage = message.trim()
    if (!nextMessage || isBusy) return
    if (displayTitle === 'New conversation' && !firstMessageRef.current) {
      firstMessageRef.current = nextMessage
      setDisplayTitle(createConversationTitle(nextMessage))
      await titleConversation(workspaceId, conversationId, nextMessage)
      router.refresh()
    }
    setMessage('')
    await agent.send({ message: nextMessage })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-card">
      <CardHeader className="border-b py-3">
        <CardTitle className="truncate">{displayTitle}</CardTitle>
        <CardDescription>Marketing Manager for {companyName} · 6 specialists available</CardDescription>
      </CardHeader>

      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
          <MessageScrollerContent className="p-4 md:p-6">
            {agent.data.messages.length === 0 ? (
              <Empty className="min-h-full items-start justify-end text-left">
                <EmptyHeader className="items-start text-left">
                  <EmptyTitle className="font-serif text-3xl text-balance">What should we work on today?</EmptyTitle>
                  <EmptyDescription className="max-w-xl leading-6">Ask for a launch plan, SEO audit, landing page rewrite, campaign brief, or a coordinated review.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="max-w-none items-start">
                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <Button key={prompt} variant="outline" size="sm" onClick={() => setMessage(prompt)}>{prompt}</Button>
                    ))}
                  </div>
                </EmptyContent>
              </Empty>
            ) : agent.data.messages.map((item) => (
              <MessageScrollerItem key={item.id} scrollAnchor>
                <Message align={item.role === 'user' ? 'end' : 'start'}>
                  <MessageContent>
                    <MessageHeader>{item.role === 'user' ? 'You' : 'Manager'}</MessageHeader>
                    <Bubble variant={item.role === 'user' ? 'default' : 'ghost'} align={item.role === 'user' ? 'end' : 'start'}>
                      <BubbleContent>
                        <div className="flex flex-col gap-3">
                          {item.parts.map((part, index) => part.type === 'text' ? <p className="whitespace-pre-wrap" key={index}>{part.text}</p> : null)}
                        </div>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {agent.events.length > 0 && (
              <MessageScrollerItem scrollAnchor>
                <AgentActivity events={agent.events} isBusy={isBusy} />
              </MessageScrollerItem>
            )}
            {isBusy && (
              <MessageScrollerItem scrollAnchor>
                <Marker>
                  <MarkerIcon><Spinner /></MarkerIcon>
                  <MarkerContent>The manager is coordinating the team…</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            )}
            {agent.error && (
              <MessageScrollerItem scrollAnchor>
                <Alert variant="destructive"><AlertDescription>{agent.error.message}</AlertDescription></Alert>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t p-3 md:p-4">
        <InputGroup className="h-auto min-h-28 items-end">
          <InputGroupTextarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
              event.preventDefault()
              void sendMessage()
            }}
            placeholder="Ask your marketing manager…"
            disabled={isBusy}
            aria-label="Message"
            className="min-h-24 pb-12"
          />
          <InputGroupAddon align="block-end" className="absolute inset-x-0 bottom-0 justify-end">
            {isBusy ? (
              <InputGroupButton size="icon-sm" variant="secondary" onClick={() => agent.stop()} aria-label="Stop generating">
                <Square />
              </InputGroupButton>
            ) : (
              <InputGroupButton size="icon-sm" variant="default" onClick={() => void sendMessage()} disabled={!message.trim()} aria-label="Send message">
                <ArrowUp />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </section>
  )
}
