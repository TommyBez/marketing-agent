import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowUpRight, BookOpenText, Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

export interface CompanyBriefData {
  name: string
  websiteUrl: string
  summary?: string | null
  audience?: string | null
  offering?: string | null
  voice?: string | null
}

interface CompanyBriefProps extends Omit<ComponentProps<'article'>, 'children'> {
  brief: CompanyBriefData
  density?: 'compact' | 'default'
}

interface LedgerRowProps {
  label: string
  children: ReactNode
  isCompact: boolean
  emphasized?: boolean
  section?: string
}

function cleanValue(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback
}

function getWebsite(websiteUrl: string) {
  try {
    const url = new URL(websiteUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    return { href: url.toString(), label: url.hostname.replace(/^www\./, '') }
  } catch {
    return { href: undefined, label: websiteUrl.trim() || 'Website unavailable' }
  }
}

function LedgerRow({ label, children, isCompact, emphasized = false, section }: LedgerRowProps) {
  return (
    <div
      data-company-brief-field
      data-company-brief-section={section}
      className={cn(
        'grid items-start gap-x-3 border-t border-border',
        isCompact ? 'grid-cols-[5rem_minmax(0,1fr)]' : 'grid-cols-[8.5rem_minmax(0,1fr)]',
        emphasized && 'bg-muted/45',
        emphasized
          ? isCompact ? 'px-4 py-3.5' : 'px-5 py-4 sm:px-6'
          : isCompact ? 'px-4 py-2.5' : 'px-5 py-3.5 sm:px-6',
      )}
    >
      <h3
        className={cn(
          'font-mono font-semibold uppercase tracking-[0.14em]',
          emphasized ? 'text-primary' : 'text-muted-foreground',
          isCompact ? 'text-[9px]' : 'text-[10px]',
          emphasized ? 'pt-1' : 'pt-0.5',
        )}
      >
        {label}
      </h3>
      {children}
    </div>
  )
}

export function CompanyBrief({ brief, density = 'default', className, ...props }: CompanyBriefProps) {
  const isCompact = density === 'compact'
  const name = cleanValue(brief.name, 'Company profile')
  const website = getWebsite(brief.websiteUrl)
  const summary = cleanValue(
    brief.summary,
    `A working positioning summary for ${name}, ready to be refined as more context is confirmed.`,
  )
  const audience = cleanValue(
    brief.audience,
    'Audience signals will sharpen as Branderize learns from your conversations.',
  )
  const offering = cleanValue(
    brief.offering,
    'The core offer will be clarified as product and customer evidence is added.',
  )
  const voice = cleanValue(brief.voice, 'Clear, credible, and customer-focused.')

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden bg-card py-0 text-card-foreground',
        isCompact ? 'rounded-lg' : 'rounded-xl',
        className,
      )}
    >
      <article {...props}>
        <header
          data-company-brief-section="header"
          className={cn('flex items-center justify-between gap-4', isCompact ? 'p-4' : 'px-5 py-4 sm:px-6')}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm',
              isCompact ? 'size-8' : 'size-9',
            )}>
              <BookOpenText aria-hidden="true" className={isCompact ? 'size-4' : 'size-4.5'} />
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className={cn(
                'truncate font-semibold leading-tight tracking-tight text-foreground',
                isCompact ? 'text-base' : 'text-lg',
              )}>
                {name}
              </h2>
              {website.href ? (
                <a
                  className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href={website.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{website.label}</span>
                  <ArrowUpRight aria-hidden="true" className="size-3 shrink-0" />
                </a>
              ) : (
                <p className="truncate text-xs text-muted-foreground">{website.label}</p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] sm:inline-flex">
            Shared context
          </Badge>
        </header>

        <div data-company-brief-section="fields">
          <LedgerRow label="Positioning" isCompact={isCompact} emphasized section="positioning">
            <p className={cn(
              'font-medium text-foreground text-pretty',
              isCompact ? 'text-sm leading-5' : 'text-base leading-relaxed sm:text-[1.05rem]',
            )}>
              {summary}
            </p>
          </LedgerRow>
          <LedgerRow label="Audience" isCompact={isCompact}>
            <p className={cn('text-foreground', isCompact ? 'text-xs leading-5' : 'text-sm leading-6')}>{audience}</p>
          </LedgerRow>
          <LedgerRow label="Offering" isCompact={isCompact}>
            <p className={cn('text-foreground', isCompact ? 'text-xs leading-5' : 'text-sm leading-6')}>{offering}</p>
          </LedgerRow>
          <LedgerRow label="Voice" isCompact={isCompact}>
            <p className={cn('text-foreground', isCompact ? 'text-xs leading-5' : 'text-sm leading-6')}>{voice}</p>
          </LedgerRow>
        </div>

        <footer data-company-brief-section="footer" className={cn(
          'flex items-center gap-2 border-t bg-muted/25 font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground',
          isCompact ? 'px-4 py-3' : 'px-5 py-3.5 sm:px-6',
        )}>
          <Check aria-hidden="true" className="size-3 text-success" />
          Shared with assigned specialists
        </footer>
      </article>
    </Card>
  )
}
