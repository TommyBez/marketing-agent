import { defineAgent } from 'eve'
import { meteredModel } from './lib/metered-model'

export default defineAgent({
  model: meteredModel('xai/grok-4.5', 'marketing-agent'),
  reasoning: 'high',
  limits: { maxSubagentDepth: 2 },
})
