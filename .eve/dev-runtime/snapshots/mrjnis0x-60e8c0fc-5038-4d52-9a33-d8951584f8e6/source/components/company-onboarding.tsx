'use client'

import { analyzeCompany } from '@/app/actions/company'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const analysisStages = [
  'Connecting to your website',
  'Reading brand and positioning',
  'Building the shared company brief',
] as const

export function CompanyOnboarding() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading) return
    const interval = window.setInterval(() => {
      setActiveStage((currentStage) => Math.min(currentStage + 1, analysisStages.length - 1))
    }, 1600)
    return () => window.clearInterval(interval)
  }, [isLoading])

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setActiveStage(0)
    setError('')
    try {
      await analyzeCompany(String(formData.get('websiteUrl')))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to analyze this website')
      setIsLoading(false)
    }
  }

  return (
    <section className="flex flex-1 items-center justify-center p-5 md:p-10">
      <div className="flex w-full max-w-3xl flex-col gap-8 rounded-2xl border bg-card p-6 shadow-2xl md:p-10">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-foreground">Initialize workspace</p>
          <h1 className="max-w-xl font-serif text-4xl leading-tight text-balance md:text-5xl">Start with what your company already knows.</h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">Paste your website. Context.dev will build the shared company brief your marketing manager and specialists use for every operation.</p>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="websiteUrl">Company website URL</label>
          <input id="websiteUrl" name="websiteUrl" type="url" required disabled={isLoading} placeholder="https://yourcompany.com" className="h-13 min-w-0 flex-1 rounded-lg border bg-background px-4 text-base outline-none focus:ring-2 disabled:opacity-60" />
          <button disabled={isLoading} aria-busy={isLoading} className="pressable-motion flex h-13 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-70">
            {isLoading ? 'Analyzing brand…' : 'Build company brief'}
          </button>
        </form>

        {isLoading && (
          <div aria-live="polite" aria-label="Brand analysis progress" className="ui-state-enter flex flex-col gap-4 rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{analysisStages[activeStage]}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Step {activeStage + 1} of {analysisStages.length}</p>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full origin-left rounded-full bg-accent-foreground transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none" style={{ transform: `scaleX(${(activeStage + 1) / analysisStages.length})` }} />
            </div>
            <div className="flex flex-col gap-2">
              {analysisStages.map((stage, index) => (
                <div className="flex items-center gap-3 text-sm" key={stage}>
                  <span aria-hidden="true" className={`size-2 rounded-full transition-colors ${index <= activeStage ? 'bg-accent-foreground' : 'bg-muted'}`} />
                  <span className={index <= activeStage ? 'text-foreground' : 'text-muted-foreground'}>{stage}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Keep this page open while we retrieve and securely save your company context.</p>
          </div>
        )}

        {error && <p role="alert" className="ui-state-enter text-sm text-destructive">{error}</p>}
        <p className="border-t pt-5 text-sm leading-6 text-muted-foreground">Your API key stays server-side. Company profiles are private and scoped to your account.</p>
      </div>
    </section>
  )
}
