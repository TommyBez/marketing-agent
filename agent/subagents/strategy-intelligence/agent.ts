import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Builds market and customer intelligence, strategic options, plans, offers, pricing, psychology, and expert council synthesis.',
  model: meteredModel('openai/gpt-5.6-luna', 'strategy-intelligence'),
  reasoning: 'xhigh',
})
