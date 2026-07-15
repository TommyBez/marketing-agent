import { BrandMark } from '@/components/brand-mark'
import { Skeleton } from '@/components/ui/skeleton'

export function AuthPageSkeleton() {
  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5" aria-busy="true" aria-label="Loading authentication">
      <BrandMark />
      <section className="auth-panel flex w-full max-w-md flex-col gap-8 rounded-2xl p-7 md:p-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </section>
      <Skeleton className="h-4 w-72 max-w-full" />
    </main>
  )
}
