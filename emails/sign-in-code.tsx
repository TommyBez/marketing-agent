import {
  Body,
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

interface SignInCodeEmailProps {
  expiresInMinutes: number
  otp: string
}

export function SignInCodeEmail({ expiresInMinutes, otp }: SignInCodeEmailProps) {
  return (
    <Html dir="ltr" lang="en">
      <Tailwind config={emailTailwindConfig}>
        <Head />
        <Body className="m-0 bg-brand-paper py-10 font-sans text-brand-ink">
          <Preview>Finish signing in to your Branderize workspace.</Preview>
          <Container className="mx-auto max-w-[600px] px-5">
            <Section className="rounded-[18px] border border-solid border-brand-border bg-brand-surface p-8">
              <Text className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[2px] text-brand-accent">
                branderize / secure access
              </Text>
              <Heading as="h1" className="mb-0 mt-7 text-[32px] font-bold leading-[36px] tracking-[-1px] text-brand-ink">
                Your workspace is waiting.
              </Heading>
              <Text className="mb-0 mt-4 text-[16px] leading-[26px] text-brand-muted">
                Enter this one-time code on the sign-in screen. No password needed.
              </Text>
              <Section className="my-8 rounded-[12px] bg-brand-accent px-6 py-5 text-center">
                <Text
                  className="m-0 font-mono text-[34px] font-bold leading-[42px] text-brand-ink"
                  style={{ letterSpacing: '8px' }}
                >
                  {otp}
                </Text>
              </Section>
              <Text className="m-0 text-[14px] leading-[23px] text-brand-muted">
                The code expires in {expiresInMinutes} minutes and can be used once. If you did not request it, you can safely ignore this email.
              </Text>
              <Hr className="my-8 border-0 border-t border-solid border-brand-border" />
              <Text className="m-0 text-[12px] leading-[20px] text-brand-muted">
                Branderize keeps your company brief, workspace, and conversations private to your account.
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

SignInCodeEmail.PreviewProps = {
  expiresInMinutes: 5,
  otp: '482913',
} satisfies SignInCodeEmailProps

export default SignInCodeEmail
