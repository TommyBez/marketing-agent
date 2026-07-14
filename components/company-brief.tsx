import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  BookOpenText,
  Check,
  MessageSquareText,
  PackageOpen,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'

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

interface BriefFieldProps {
  icon: LucideIcon
  label: string
  value: string
  isCompact: boolean
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

function BriefField({ icon: Icon, label, value, isCompact }: BriefFieldProps) {
  return (
    <section data-company-brief-field className={cn('min-w-0 border-t border-border', isCompact ? 'pt-3' : 'pt-4')}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-primary" />
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</h3>
      </div>
      <p className={cn('text-foreground', isCompact ? 'text-xs leading-5' : 'text-sm leading-6')}>{value}</p>
    </section>
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
        <header data-company-brief-section="header" className={cn('flex items-start justify-between gap-5', isCompact ? 'p-4' : 'p-5 pr-12 sm:p-6 sm:pr-14')}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm',
              isCompact ? 'size-8' : 'size-10',
            )}>
              <BookOpenText aria-hidden="true" className={isCompact ? 'size-4' : 'size-5'} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Company brief</p>
              <h2 className={cn(
                'truncate font-semibold leading-tight tracking-tight text-foreground',
                isCompact ? 'mt-1 text-base' : 'mt-1.5 text-xl',
              )}>
                {name}
              </h2>
              {website.href ? (
                <a
                  className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href={website.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{website.label}</span>
                  <ArrowUpRight aria-hidden="true" className="size-3 shrink-0" />
                </a>
              ) : (
                <p className="mt-1 truncate text-xs text-muted-foreground">{website.label}</p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="hidden font-mono text-[9px] uppercase tracking-[0.12em] sm:inline-flex">
            Shared context
          </Badge>
        </header>

        <section data-company-brief-section="positioning" className={cn('relative border-y bg-muted/45', isCompact ? 'px-4 py-4' : 'px-5 py-5 sm:px-6')}>
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Target aria-hidden="true" className="size-3.5" />
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">Positioning</h3>
          </div>
          <p className={cn(
            'max-w-3xl font-medium text-foreground text-balance',
            isCompact ? 'text-sm leading-5' : 'text-base leading-7 sm:text-lg',
          )}>
            {summary}
          </p>
        </section>

        <div data-company-brief-section="fields" className={cn(
          'grid',
          isCompact ? 'gap-3 p-4' : 'gap-5 p-5 sm:p-6 md:grid-cols-3',
        )}>
          <BriefField icon={UsersRound} label="Audience" value={audience} isCompact={isCompact} />
          <BriefField icon={PackageOpen} label="Offering" value={offering} isCompact={isCompact} />
          <BriefField icon={MessageSquareText} label="Voice" value={voice} isCompact={isCompact} />
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
