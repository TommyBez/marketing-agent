import { defineAgent } from 'eve'
import { meteredModel } from '../../lib/metered-model'

export default defineAgent({
  description:
    'Owns organic discovery across AI SEO, app stores, comparison content, content strategy, programmatic SEO, schema, audits, and site architecture.',
  model: meteredModel('deepseek/deepseek-v4-pro', 'content-organic'),
  reasoning: 'high',
})
