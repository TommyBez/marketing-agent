import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Builds qualified pipeline and equips the revenue team through prospecting, cold email, sales enablement, and RevOps.',
  model: meteredModel('openai/gpt-5.6-luna', 'revenue-sales'),
  reasoning: 'xhigh',
})
