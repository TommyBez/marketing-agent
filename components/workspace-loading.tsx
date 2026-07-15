import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function WorkspaceFrameSkeleton() {
  return (
    <div className="flex min-h-0 flex-1" aria-busy="true" aria-label="Loading workspace">
      <aside className="hidden w-64 shrink-0 border-r p-4 md:flex md:flex-col md:gap-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-11/12" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-15 shrink-0 items-center justify-between gap-4 border-b px-4">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-24" />
        </div>
        <WorkspaceConversationSkeleton />
      </div>
    </div>
  )
}

export function WorkspaceConversationSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label="Loading conversation">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-3/4" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="mt-auto h-28 w-full" />
    </div>
  )
}

export function WorkspaceLoadingPage() {
  return (
    <main className="workspace-shell flex h-dvh min-h-[640px] p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <WorkspaceFrameSkeleton />
      </Card>
    </main>
  )
}
