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

interface CompanyOnboardingProps {
  isCompact?: boolean
  onCreated?: () => void
}

export function CompanyOnboarding({ isCompact = false, onCreated }: CompanyOnboardingProps) {
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
      const workspace = await analyzeCompany(String(formData.get('websiteUrl')))
      onCreated?.()
      router.push(`/workspace/${workspace.id}`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to analyze this website')
      setIsLoading(false)
    }
  }

  const content = (
    <>
      <CardHeader className={isCompact ? 'px-0 pt-0' : 'gap-3 px-6 md:px-10'}>
        {!isCompact && <p className="auth-brandline">Create workspace</p>}
        <CardTitle className={isCompact ? 'text-2xl font-bold tracking-tight text-balance' : 'max-w-xl text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-balance md:text-5xl'}>
          {isCompact ? 'Create another workspace' : 'Start with what your company already knows.'}
        </CardTitle>
        <CardDescription className={isCompact ? 'leading-6' : 'max-w-xl text-base leading-7'}>
          Paste your company website. Branderize will analyze it and build a private company brief.
        </CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? 'flex flex-col gap-5 px-0' : 'flex flex-col gap-6 px-6 md:px-10'}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit(new FormData(event.currentTarget))
          }}
        >
          <FieldGroup>
            <Field data-disabled={isLoading}>
              <FieldLabel htmlFor={isCompact ? 'dialogWebsiteUrl' : 'websiteUrl'}>Company website URL</FieldLabel>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input id={isCompact ? 'dialogWebsiteUrl' : 'websiteUrl'} name="websiteUrl" type="url" required disabled={isLoading} placeholder="https://yourcompany.com" className="h-11 flex-1" />
                <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading}>
                  {isLoading && <Spinner data-icon="inline-start" />}
                  {isLoading ? 'Analyzing…' : 'Build workspace'}
                </Button>
              </div>
              <FieldDescription>Each workspace and its conversations remain private to your account.</FieldDescription>
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
      {!isCompact && (
        <CardFooter className="flex-col items-stretch gap-4 bg-transparent px-6 md:px-10">
          <Separator />
          <p className="text-sm leading-6 text-muted-foreground">Company profiles are securely saved and scoped to your authenticated account.</p>
        </CardFooter>
      )}
    </>
  )

  if (isCompact) return <div className="flex flex-col gap-4">{content}</div>

  return (
    <section className="flex flex-1 items-center justify-center p-5 md:p-10">
      <Card className="auth-panel w-full max-w-3xl">{content}</Card>
    </section>
  )
}
