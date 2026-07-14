import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

interface ChatSurfaceProps extends ComponentProps<'section'> {
  composer: ReactNode
  subtitle: string
  title: string
}

export function ChatSurface({
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
        <CardTitle className="chat-heading truncate">{title}</CardTitle>
        <CardDescription className="chat-subheading">{subtitle}</CardDescription>
      </CardHeader>
      {children}
      {composer}
    </section>
  )
}
