import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Improves onboarding, lifecycle messaging, community, referrals, paywalls, and churn prevention across the customer journey.',
  model: meteredModel('deepseek/deepseek-v4-pro', 'lifecycle-retention'),
  reasoning: 'high',
})
