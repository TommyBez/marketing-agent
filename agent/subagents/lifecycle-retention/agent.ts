import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Improves onboarding, lifecycle messaging, community, referrals, paywalls, and churn prevention across the customer journey.',
  model: 'deepseek/deepseek-v4-pro',
  reasoning: 'high',
})
