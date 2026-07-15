import { defineAgent } from 'eve'

export default defineAgent({
  description:
    'Measures funnels, diagnoses conversion friction, improves signup and popup experiences, and designs controlled experiments.',
  model: 'zai/glm-5.2',
  reasoning: 'high',
})
