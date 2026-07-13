'use client'

import { analyzeCompany } from '@/app/actions/company'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Check } from 'lucide-react'
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
      <Card className="w-full max-w-3xl shadow-2xl">
        <CardHeader className="gap-3 px-6 md:px-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-foreground">Initialize workspace</p>
          <CardTitle className="max-w-xl font-serif text-4xl leading-tight text-balance md:text-5xl">Start with what your company already knows.</CardTitle>
          <CardDescription className="max-w-xl text-base leading-7">Paste your website. Context.dev will build the shared company brief your marketing manager and specialists use for every operation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-6 md:px-10">
          <form action={handleSubmit}>
            <FieldGroup>
              <Field data-disabled={isLoading}>
                <FieldLabel htmlFor="websiteUrl">Company website URL</FieldLabel>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input id="websiteUrl" name="websiteUrl" type="url" required disabled={isLoading} placeholder="https://yourcompany.com" className="h-11 flex-1" />
                  <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading}>
                    {isLoading && <Spinner data-icon="inline-start" />}
                    {isLoading ? 'Analyzing brand…' : 'Build company brief'}
                  </Button>
                </div>
                <FieldDescription>Your API key stays server-side and profiles remain private to your account.</FieldDescription>
              </Field>
            </FieldGroup>
          </form>

          {isLoading && (
            <Card size="sm" aria-live="polite" aria-label="Brand analysis progress" className="bg-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Spinner />{analysisStages[activeStage]}</CardTitle>
                <CardDescription>Step {activeStage + 1} of {analysisStages.length}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Progress value={((activeStage + 1) / analysisStages.length) * 100} />
                <div className="flex flex-col gap-2">
                  {analysisStages.map((stage, index) => (
                    <div className="flex items-center gap-3 text-sm" key={stage}>
                      {index < activeStage ? <Check aria-hidden="true" /> : index === activeStage ? <Spinner /> : <span aria-hidden="true" className="size-4 rounded-full border" />}
                      <span className={index <= activeStage ? 'text-foreground' : 'text-muted-foreground'}>{stage}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 bg-transparent px-6 md:px-10">
          <Separator />
          <p className="text-sm leading-6 text-muted-foreground">Company profiles are securely saved and scoped to your authenticated account.</p>
        </CardFooter>
      </Card>
    </section>
  )
}
