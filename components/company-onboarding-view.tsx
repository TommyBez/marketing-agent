import { CompanyAnalysisProgress } from '@/components/company-analysis-progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import type { FormEventHandler } from 'react'

export type CompanyOnboardingVariant = 'page' | 'compact' | 'demo'

export interface CompanyOnboardingViewProps {
  activeStage?: number
  error?: string
  inputId?: string
  isComplete?: boolean
  isLoading?: boolean
  onSubmit?: FormEventHandler<HTMLFormElement>
  variant?: CompanyOnboardingVariant
  websiteUrl?: string
}

export function CompanyOnboardingView({
  activeStage = 0,
  error = '',
  inputId,
  isComplete = false,
  isLoading = false,
  onSubmit,
  variant = 'page',
  websiteUrl,
}: CompanyOnboardingViewProps) {
  const isCompact = variant === 'compact'
  const isDemo = variant === 'demo'
  const isAnalyzing = isLoading && !isComplete
  const websiteInputId = inputId ?? (isCompact ? 'dialogWebsiteUrl' : isDemo ? 'demoWebsiteUrl' : 'websiteUrl')

  const input = (
    <FieldGroup>
      <Field data-disabled={isAnalyzing}>
        <FieldLabel htmlFor={websiteInputId}>Company website URL</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id={websiteInputId}
            name="websiteUrl"
            type="url"
            required={!isDemo}
            disabled={isAnalyzing && !isDemo}
            readOnly={isDemo}
            tabIndex={isDemo ? -1 : undefined}
            defaultValue={websiteUrl}
            placeholder="https://yourcompany.com"
            className="h-11 flex-1"
          />
          <Button
            type={isDemo ? 'button' : 'submit'}
            size="lg"
            disabled={isAnalyzing && !isDemo}
            aria-busy={isAnalyzing}
            tabIndex={isDemo ? -1 : undefined}
          >
            {isAnalyzing && <Spinner data-icon="inline-start" />}
            {isComplete ? 'Workspace ready' : isAnalyzing ? 'Analyzing…' : 'Build workspace'}
          </Button>
        </div>
        <FieldDescription>Each workspace and its conversations remain private to your account.</FieldDescription>
      </Field>
    </FieldGroup>
  )

  const content = (
    <>
      <CardHeader className={isCompact ? 'px-0 pt-0' : isDemo ? 'gap-3' : 'gap-3 px-6 md:px-10'}>
        {!isCompact && !isDemo && <p className="auth-brandline">Create workspace</p>}
        <CardTitle
          className={
            isCompact || isDemo
              ? 'text-2xl font-bold tracking-tight text-balance'
              : 'max-w-xl text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-balance md:text-5xl'
          }
        >
          {isCompact ? 'Create another workspace' : isDemo ? 'Start with your website.' : 'Start with what your company already knows.'}
        </CardTitle>
        <CardDescription className={isCompact || isDemo ? 'leading-6' : 'max-w-xl text-base leading-7'}>
          Paste your company website. Branderize will analyze it and build a private company brief.
        </CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? 'flex flex-col gap-5 px-0' : isDemo ? 'flex flex-col gap-5' : 'flex flex-col gap-6 px-6 md:px-10'}>
        {isDemo ? <div aria-hidden="true" inert>{input}</div> : <form onSubmit={onSubmit}>{input}</form>}

        {(isLoading || isComplete) && <CompanyAnalysisProgress activeStage={activeStage} isComplete={isComplete} />}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
      {!isCompact && !isDemo && (
        <CardFooter className="flex-col items-stretch gap-4 bg-transparent px-6 md:px-10">
          <Separator />
          <p className="text-sm leading-6 text-muted-foreground">Company profiles are securely saved and scoped to your authenticated account.</p>
        </CardFooter>
      )}
    </>
  )

  if (isCompact) return <div className="flex flex-col gap-4">{content}</div>
  if (isDemo) return <Card className="w-full" data-onboarding-state={isComplete ? 'complete' : isAnalyzing ? 'analyzing' : 'idle'}>{content}</Card>

  return (
    <section className="flex flex-1 items-center justify-center p-5 md:p-10">
      <Card className="auth-panel w-full max-w-3xl">{content}</Card>
    </section>
  )
}
