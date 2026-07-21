import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Measures funnels, diagnoses conversion friction, improves signup and popup experiences, and designs controlled experiments.',
  model: meteredModel('zai/glm-5.2', 'conversion-experimentation'),
  reasoning: 'high',
})
