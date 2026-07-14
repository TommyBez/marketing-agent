'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { BookOpenText } from 'lucide-react'
import type { ReactNode } from 'react'

interface CompanyBriefDialogProps {
  children: ReactNode
  companyName: string
}

export function CompanyBriefDialog({ children, companyName }: CompanyBriefDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={
        <Button variant="secondary" size="sm" className="size-7 px-0 sm:w-auto sm:px-2.5" />
      }>
        <BookOpenText aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Brand brief</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{companyName} brand brief</DialogTitle>
          <DialogDescription>The shared company context used by every specialist in this workspace.</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
