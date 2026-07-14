import { SignInCodeEmail } from '@/emails/sign-in-code'
import { createHash } from 'node:crypto'
import { Resend } from 'resend'

interface SendSignInCodeEmailOptions {
  expiresInMinutes: number
  otp: string
  to: string
}

function requireEmailEnv(name: 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable ${name}, required to send authentication emails`)
  }
  return value
}

export function assertEmailDeliveryConfigured(): void {
  requireEmailEnv('RESEND_API_KEY')
  requireEmailEnv('RESEND_FROM_EMAIL')
}

function otpIdempotencyKey({ otp, to }: Pick<SendSignInCodeEmailOptions, 'otp' | 'to'>): string {
  const digest = createHash('sha256')
    .update(`sign-in:${to.toLowerCase()}:${otp}`)
    .digest('hex')

  return `sign-in-otp/${digest}`
}

export async function sendSignInCodeEmail({
  expiresInMinutes,
  otp,
  to,
}: SendSignInCodeEmailOptions): Promise<void> {
  const resend = new Resend(requireEmailEnv('RESEND_API_KEY'))
  const resendFromEmail = requireEmailEnv('RESEND_FROM_EMAIL')
  const { error } = await resend.emails.send(
    {
      from: resendFromEmail,
      react: <SignInCodeEmail expiresInMinutes={expiresInMinutes} otp={otp} />,
      subject: 'Your Branderize sign-in code',
      tags: [{ name: 'email_type', value: 'sign_in_otp' }],
      to: [to],
    },
    { idempotencyKey: otpIdempotencyKey({ otp, to }) },
  )

  if (error) {
    throw new Error('Resend could not send the authentication email', { cause: error })
  }
}
