import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn('brand-mark', className)}>
      <img aria-hidden="true" alt="" className="brand-symbol" height="32" src="/icon.svg" width="32" />
      <span className="brand-wordmark">branderize</span>
    </span>
  )
}
