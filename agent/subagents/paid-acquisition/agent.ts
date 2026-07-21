import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Plans paid acquisition campaigns and develops the ad creative variants used to test and scale them.',
  model: meteredModel('minimax/minimax-m3', 'paid-acquisition'),
  reasoning: 'medium',
})
