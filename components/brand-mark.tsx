import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn('flex items-center gap-2.5 font-semibold', className)}>
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-sm text-primary-foreground">
        R
      </span>
      Relay
    </span>
  )
}
