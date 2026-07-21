import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Creates and edits campaign copy plus organic social, image, and video assets across owned channels.',
  model: meteredModel('anthropic/claude-sonnet-5', 'copy-creative'),
  reasoning: 'medium',
})
