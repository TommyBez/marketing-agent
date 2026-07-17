import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Orchestrates launches and recurring distribution through partners, PR, directories, lead magnets, free tools, and marketing loops.',
  model: meteredModel('deepseek/deepseek-v4-pro', 'gtm-distribution'),
  reasoning: 'high',
})
