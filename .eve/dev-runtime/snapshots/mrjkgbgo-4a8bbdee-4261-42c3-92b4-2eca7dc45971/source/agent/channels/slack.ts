import { connectSlackCredentials } from '@vercel/connect/eve'
import { slackChannel } from 'eve/channels/slack'

export default slackChannel({
  credentials: connectSlackCredentials(process.env.SLACK_CONNECTOR_ID ?? 'slack/marketing-manager'),
  threadContext: { since: 'last-agent-reply' },
})
