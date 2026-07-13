'use client'

import { analyzeCompany } from '@/app/actions/company'
import { ArrowRight, Globe2, Loader2, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CompanyOnboarding() {
  const router = useRouter(); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState('')
  async function handleSubmit(formData: FormData) {
    setIsLoading(true); setError('')
    try { await analyzeCompany(String(formData.get('websiteUrl'))); router.refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to analyze this website'); setIsLoading(false) }
  }
  return <section className="flex flex-1 items-center justify-center p-5 md:p-10"><div className="flex w-full max-w-3xl flex-col gap-8 rounded-2xl border bg-card p-6 shadow-2xl md:p-10"><div className="flex flex-col gap-5"><span className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Globe2 className="size-5" /></span><div className="flex flex-col gap-3"><p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-foreground">Initialize workspace</p><h1 className="max-w-xl font-serif text-4xl leading-tight text-balance md:text-5xl">Start with what your company already knows.</h1><p className="max-w-xl text-base leading-7 text-muted-foreground">Paste your website. Context.dev will build the shared company brief your marketing manager and specialists use for every operation.</p></div></div><form action={handleSubmit} className="flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="websiteUrl">Company website URL</label><input id="websiteUrl" name="websiteUrl" type="url" required placeholder="https://yourcompany.com" className="h-13 min-w-0 flex-1 rounded-lg border bg-background px-4 text-base outline-none focus:ring-2"/><button disabled={isLoading} className="flex h-13 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{isLoading ? <Loader2 className="size-4 animate-spin"/> : <>Build company brief<ArrowRight className="size-4"/></>}</button></form>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex items-start gap-3 border-t pt-5 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-foreground"/><p>Your API key stays server-side. Company profiles are private and scoped to your account.</p></div></div></section>
}
