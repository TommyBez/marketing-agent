import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Plans paid acquisition campaigns and develops the ad creative variants used to test and scale them.',
  model: 'minimax/minimax-m3',
  reasoning: 'medium',
})
