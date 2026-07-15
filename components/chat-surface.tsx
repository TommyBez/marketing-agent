import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

interface ChatSurfaceProps extends ComponentProps<'section'> {
  actions?: ReactNode
  composer: ReactNode
  subtitle: string
  title: string
}

export function ChatSurface({
  actions,
  children,
  className,
  composer,
  subtitle,
  title,
  ...props
}: ChatSurfaceProps) {
  return (
    <section className={cn('chat-shell flex min-h-0 flex-1 flex-col', className)} {...props}>
      <CardHeader className="border-b py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="chat-heading truncate">{title}</CardTitle>
            <CardDescription className="chat-subheading mt-1">{subtitle}</CardDescription>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </CardHeader>
      {children}
      {composer}
    </section>
  )
}
