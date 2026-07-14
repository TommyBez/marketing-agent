import { CompanyOnboardingView } from '@/components/company-onboarding-view'

export function LandingAnalyzerDemo() {
  return (
    <div className="landing-analysis-demo">
      <CompanyOnboardingView
        activeStage={2}
        isComplete
        isLoading
        variant="demo"
        websiteUrl="https://northline.studio"
      />
    </div>
  )
}
