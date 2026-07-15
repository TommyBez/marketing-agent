import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { BrandMark } from '@/components/brand-mark'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPublicShareByPublicId } from '@/lib/public-share'
import { getCurrentSession } from '@/lib/session'
import { ArrowUpRight, Eye, LockKeyhole } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface PublicSharePageProps {
  params: Promise<{ publicId: string }>
}

export async function generateMetadata({ params }: PublicSharePageProps): Promise<Metadata> {
  const { publicId } = await params
  const share = await getPublicShareByPublicId(publicId)
  if (!share) notFound()
  const title = `${share.snapshot.title} | Shared with Branderize`
  const description = `A read-only ${share.snapshot.type} shared from Branderize.`

  return {
    title,
    description,
    openGraph: {
      description,
      siteName: 'branderize',
      title,
      type: 'article',
    },
    referrer: 'no-referrer',
    robots: 'noindex, nofollow, noarchive',
    twitter: {
      card: 'summary_large_image',
      description,
      title,
    },
  }
}

export default function PublicSharePage({ params }: PublicSharePageProps) {
  return (
    <main className="min-h-dvh bg-[var(--brand-paper)] text-[var(--brand-ink)]">
      <PublicShareHeader />
      <Suspense fallback={<PublicShareContentSkeleton />}>
        <PublicShareContent params={params} />
      </Suspense>
    </main>
  )
}

async function PublicShareContent({ params }: PublicSharePageProps) {
  const { publicId } = await params
  const share = await getPublicShareByPublicId(publicId)
  if (!share) notFound()

  const { snapshot } = share
  const createdAt = share.createdAt.toISOString()
  const createdLabel = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(share.createdAt)

  return (
    <div className="mx-auto grid w-[min(100%-2rem,72rem)] gap-8 py-10 md:py-16">
        <section className="grid gap-5 border-b border-[var(--brand-rule)] pb-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:pb-10">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--brand-accent-text)]">
              {snapshot.type} shared by {snapshot.workspaceName}
            </p>
            <h1 className="mt-3 max-w-4xl text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-5xl md:text-6xl">
              {snapshot.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)] md:pb-1">
            <LockKeyhole className="size-3.5" />
            <span>Captured <time dateTime={createdAt}>{createdLabel}</time></span>
          </div>
        </section>

        <article className="min-w-0 rounded-2xl border border-[var(--brand-stage-border)] bg-card text-card-foreground shadow-[var(--elevation-4)]">
          {snapshot.type === 'artifact' ? (
            <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-10 md:px-12">
              <MessageResponse mode="static" className="min-w-0 text-[0.95rem] leading-7">
                {snapshot.content}
              </MessageResponse>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-7 px-4 py-6 sm:px-7 sm:py-9 md:px-10">
              {snapshot.messages.map((message, index) => (
                <Message from={message.role} key={`${message.role}-${index}`}>
                  <MessageContent className="group-[.is-assistant]:w-full">
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    ) : (
                      <MessageResponse mode="static" className="min-w-0">
                        {message.text}
                      </MessageResponse>
                    )}
                  </MessageContent>
                </Message>
              ))}
            </div>
          )}
        </article>

        <Suspense fallback={<PublicShareCallToAction href="/sign-in" />}>
          <SessionAwarePublicShareCallToAction />
        </Suspense>

        <footer className="flex flex-col gap-2 border-t border-[var(--brand-rule)] pt-5 text-xs text-[var(--brand-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Shared from {snapshot.workspaceName}. This snapshot cannot be edited or continued.</span>
          <Link href="/" className="font-medium text-[var(--brand-ink)] hover:underline hover:underline-offset-4">branderize</Link>
        </footer>
    </div>
  )
}

function PublicShareHeader() {
  return (
    <header className="border-b border-[var(--brand-rule)] bg-[color-mix(in_oklch,var(--brand-paper)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-[min(100%-2rem,72rem)] items-center justify-between gap-4">
        <Link href="/" aria-label="Branderize home"><BrandMark className="text-sm" /></Link>
        <Badge variant="outline" className="gap-1.5 border-[var(--brand-rule)] bg-transparent font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-muted)]">
          <Eye className="size-3" />Read-only snapshot
        </Badge>
      </div>
    </header>
  )
}

function PublicShareCallToAction({ href }: { href: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--brand-accent)] px-5 py-8 text-[var(--brand-accent-ink)] sm:px-8 sm:py-10 md:px-12">
      <div className="relative z-10 flex flex-col items-start justify-between gap-7 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--brand-on-accent-muted)]">Your brand, next</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold leading-none tracking-[-0.045em] sm:text-4xl">
            Put the same marketing team behind your brand.
          </h2>
          <p className="mt-4 max-w-xl leading-6 text-[var(--brand-on-accent-muted)]">
            Brief your company once. Branderize coordinates the right specialists and returns one clear answer.
          </p>
        </div>
        <Link
          href={href}
          className={buttonVariants({
            variant: 'secondary',
            size: 'lg',
            className: 'landing-closing-cta',
          })}
        >
          Use Branderize for your brand
          <ArrowUpRight className="size-4" data-icon="inline-end" />
        </Link>
      </div>
    </section>
  )
}

async function SessionAwarePublicShareCallToAction() {
  const session = await getCurrentSession()
  return <PublicShareCallToAction href={session?.user ? '/workspace' : '/sign-in'} />
}

function PublicShareContentSkeleton() {
  return (
    <div className="mx-auto grid w-[min(100%-2rem,72rem)] gap-8 py-10 md:py-16" aria-busy="true" aria-label="Loading shared snapshot">
      <section className="grid gap-5 border-b border-[var(--brand-rule)] pb-8 md:pb-10">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-14 w-4/5" />
      </section>
      <div className="rounded-2xl border border-[var(--brand-stage-border)] bg-card p-6 shadow-[var(--elevation-4)] sm:p-10">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-4 h-5 w-full" />
        <Skeleton className="mt-3 h-5 w-11/12" />
        <Skeleton className="mt-3 h-5 w-2/3" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}
