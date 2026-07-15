import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import { emailTailwindConfig } from './tailwind.config'

interface WorkspaceInvitationEmailProps {
  invitationUrl: string
  inviterName: string
  organizationName: string
  role: string
}

export function WorkspaceInvitationEmail({
  invitationUrl,
  inviterName,
  organizationName,
  role,
}: WorkspaceInvitationEmailProps) {
  return (
    <Html dir="ltr" lang="en">
      <Tailwind config={emailTailwindConfig}>
        <Head />
        <Body className="m-0 bg-brand-paper py-10 font-sans text-brand-ink">
          <Preview>{inviterName} invited you to collaborate in {organizationName}.</Preview>
          <Container className="mx-auto max-w-[600px] px-5">
            <Section className="rounded-[18px] border border-solid border-brand-border bg-brand-surface p-8">
              <Text className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[2px] text-brand-accent">
                branderize / workspace invitation
              </Text>
              <Heading as="h1" className="mb-0 mt-7 text-[32px] font-bold leading-[36px] tracking-[-1px] text-brand-ink">
                Join {organizationName}.
              </Heading>
              <Text className="mb-0 mt-4 text-[16px] leading-[26px] text-brand-muted">
                {inviterName} invited you to collaborate as {role === 'admin' ? 'an admin' : 'a member'} in this Branderize workspace.
              </Text>
              <Section className="my-8">
                <Button
                  href={invitationUrl}
                  className="box-border rounded-[10px] bg-brand-accent px-6 py-3 text-center text-[15px] font-bold text-brand-ink no-underline"
                >
                  Accept invitation
                </Button>
              </Section>
              <Text className="m-0 text-[14px] leading-[23px] text-brand-muted">
                This invitation expires in seven days and only works for the email address it was sent to.
              </Text>
              <Hr className="my-8 border-0 border-t border-solid border-brand-border" />
              <Text className="m-0 text-[12px] leading-[20px] text-brand-muted">
                If you were not expecting this invitation, you can safely ignore this email.
              </Text>
            </Section>
            <Text className="mb-0 mt-5 text-center text-[12px] text-brand-muted">
              Branderize · Brief once. Move as one.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

WorkspaceInvitationEmail.PreviewProps = {
  invitationUrl: 'https://example.com/accept-invitation?id=invitation-id',
  inviterName: 'Alex Morgan',
  organizationName: 'Northline',
  role: 'member',
} satisfies WorkspaceInvitationEmailProps

export default WorkspaceInvitationEmail
