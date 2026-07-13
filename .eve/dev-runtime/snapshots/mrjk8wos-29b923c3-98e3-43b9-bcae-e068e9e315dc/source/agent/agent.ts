import { defineAgent } from 'eve'

export default defineAgent({
  model: 'xai/grok-4.5',
  reasoning: 'high',
  limits: { maxSubagentDepth: 2, maxInputTokensPerSession: 1_000_000, maxOutputTokensPerSession: 100_000 },
  compaction: { thresholdPercent: 0.75 },
})
