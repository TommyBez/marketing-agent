import { defineMcpClientConnection } from 'eve/connections'

export default defineMcpClientConnection({
  url: 'https://context-dev.stlmcp.com',
  description: 'Context.dev brand intelligence and web research. Retrieve company profiles, scrape clean page markdown, crawl websites, extract structured facts, and research competitors.',
  headers: { 'x-context-dev-api-key': process.env.CONTEXT_DEV_API_KEY ?? '' },
})
