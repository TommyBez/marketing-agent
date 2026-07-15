import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Builds market and customer intelligence, strategic options, plans, offers, pricing, psychology, and expert council synthesis.',
  model: 'openai/gpt-5.6-luna',
  reasoning: 'xhigh',
})
