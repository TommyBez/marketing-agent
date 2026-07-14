import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

interface ChatComposerSurfaceProps extends ComponentProps<'div'> {
  contentClassName?: string
}

export function ChatComposerSurface({
  children,
  className,
  contentClassName,
  ...props
}: ChatComposerSurfaceProps) {
  return (
    <div className={cn('composer-shell w-full p-3 md:px-6 md:pb-5', className)} {...props}>
      <div className={cn('mx-auto w-full max-w-3xl', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
