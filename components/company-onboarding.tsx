'use client'

import { analyzeCompany } from '@/app/actions/company'
import { companyAnalysisStages } from '@/components/company-analysis-progress'
import { CompanyOnboardingView } from '@/components/company-onboarding-view'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'

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
      setActiveStage((currentStage) => Math.min(currentStage + 1, companyAnalysisStages.length - 1))
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

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleSubmit(new FormData(event.currentTarget))
  }

  return (
    <CompanyOnboardingView
      activeStage={activeStage}
      error={error}
      isLoading={isLoading}
      onSubmit={handleFormSubmit}
      variant={isCompact ? 'compact' : 'page'}
    />
  )
}
