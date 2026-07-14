import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Check } from 'lucide-react'

export const companyAnalysisStages = [
  'Connecting to your website',
  'Reading brand and positioning',
  'Building the shared company brief',
] as const

export interface CompanyAnalysisProgressProps {
  activeStage?: number
  isComplete?: boolean
}

export function CompanyAnalysisProgress({ activeStage = 0, isComplete = false }: CompanyAnalysisProgressProps) {
  const currentStage = Math.min(Math.max(activeStage, 0), companyAnalysisStages.length - 1)
  const progress = isComplete ? 100 : ((currentStage + 1) / companyAnalysisStages.length) * 100

  return (
    <Card size="sm" aria-live="polite" aria-label="Brand analysis progress" className="bg-background" data-analysis-state={isComplete ? 'complete' : 'active'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isComplete ? <Check aria-hidden="true" /> : <Spinner aria-hidden="true" />}
          {isComplete ? 'Company brief ready' : companyAnalysisStages[currentStage]}
        </CardTitle>
        <CardDescription>
          {isComplete ? `${companyAnalysisStages.length} steps complete` : `Step ${currentStage + 1} of ${companyAnalysisStages.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={progress} />
        <div className="flex flex-col gap-2">
          {companyAnalysisStages.map((stage, index) => {
            const isStageComplete = isComplete || index < currentStage
            const isStageActive = !isComplete && index === currentStage

            return (
              <div
                className="flex items-center gap-3 text-sm"
                data-analysis-stage={isStageComplete ? 'complete' : isStageActive ? 'active' : 'pending'}
                key={stage}
              >
                {isStageComplete ? <Check aria-hidden="true" /> : isStageActive ? <Spinner aria-hidden="true" /> : <span aria-hidden="true" className="size-4 rounded-full border" />}
                <span className={isStageComplete || isStageActive ? 'text-foreground' : 'text-muted-foreground'}>{stage}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
