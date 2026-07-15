import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Builds qualified pipeline and equips the revenue team through prospecting, cold email, sales enablement, and RevOps.',
  model: 'openai/gpt-5.6-luna',
  reasoning: 'xhigh',
})
