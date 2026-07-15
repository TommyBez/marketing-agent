import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Creates and edits campaign copy plus organic social, image, and video assets across owned channels.',
  model: 'anthropic/claude-sonnet-5',
  reasoning: 'medium',
})
