import { CompanyAnalysisProgress, companyAnalysisStages } from '@/components/company-analysis-progress'
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
  const isPage = variant === 'page'
  const isAnalyzing = isLoading && !isComplete
  const websiteInputId = inputId ?? (isCompact ? 'dialogWebsiteUrl' : isDemo ? 'demoWebsiteUrl' : 'websiteUrl')

  // 1e — one focused field: the URL field is the hero, progress lives in the field's underline.
  if (isPage) {
    const currentStage = Math.min(Math.max(activeStage, 0), companyAnalysisStages.length - 1)
    const showProgress = isLoading || isComplete
    const progress = isComplete ? 100 : isAnalyzing ? ((currentStage + 1) / companyAnalysisStages.length) * 100 : 0
    const fieldState = isComplete ? 'complete' : isAnalyzing ? 'analyzing' : 'idle'
    const statusLine = isComplete
      ? 'Company brief ready'
      : `Step ${currentStage + 1} of ${companyAnalysisStages.length} — ${companyAnalysisStages[currentStage]}`

    return (
      <section className="onboarding-focus-shell flex flex-1 items-center justify-center p-5 md:p-10">
        <Card className="auth-panel onboarding-focus-panel w-full max-w-2xl">
          <p className="auth-brandline">Create workspace</p>
          <h1 className="onboarding-focus-title text-balance">Start with what your company already knows.</h1>
          <p className="onboarding-focus-lede">
            Paste your company website. Branderize will analyze it and build a private company brief.
          </p>
          <form onSubmit={onSubmit} className="onboarding-focus-form">
            <div className="onboarding-focus-field" data-state={fieldState}>
              <label htmlFor={websiteInputId} className="sr-only">Company website URL</label>
              <Input
                id={websiteInputId}
                name="websiteUrl"
                type="url"
                required
                disabled={isAnalyzing}
                defaultValue={websiteUrl}
                placeholder="https://yourcompany.com"
                className="onboarding-focus-input"
              />
              <Button
                type="submit"
                size="lg"
                className="onboarding-focus-submit"
                disabled={isAnalyzing}
                aria-busy={isAnalyzing}
              >
                {isAnalyzing && <Spinner data-icon="inline-start" />}
                {isComplete ? 'Workspace ready' : isAnalyzing ? 'Analyzing…' : 'Build workspace'}
              </Button>
              <span aria-hidden="true" className="onboarding-focus-underline" style={{ width: `${progress}%` }} />
            </div>
            <div className="onboarding-focus-meta">
              <p>Each workspace and its conversations remain private to your account.</p>
              {showProgress && (
                <span className="onboarding-focus-status" role="status" aria-live="polite">{statusLine}</span>
              )}
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </form>
        </Card>
      </section>
    )
  }

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
      <CardHeader className={isCompact ? 'px-0 pt-0' : 'gap-3'}>
        <CardTitle className="text-2xl font-bold tracking-tight text-balance">
          {isCompact ? 'Create another workspace' : 'Start with your website.'}
        </CardTitle>
        <CardDescription className="leading-6">
          Paste your company website. Branderize will analyze it and build a private company brief.
        </CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? 'flex flex-col gap-5 px-0' : 'flex flex-col gap-5'}>
        {isDemo ? <div aria-hidden="true" inert>{input}</div> : <form onSubmit={onSubmit}>{input}</form>}

        {(isLoading || isComplete) && <CompanyAnalysisProgress activeStage={activeStage} isComplete={isComplete} />}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
      {!isCompact && !isDemo && (
        <CardFooter className="flex-col items-stretch gap-4 bg-transparent">
          <Separator />
          <p className="text-sm leading-6 text-muted-foreground">Company profiles are securely saved and scoped to your authenticated account.</p>
        </CardFooter>
      )}
    </>
  )

  if (isCompact) return <div className="flex flex-col gap-4">{content}</div>

  return <Card className="w-full" data-onboarding-state={isComplete ? 'complete' : isAnalyzing ? 'analyzing' : 'idle'}>{content}</Card>
}
