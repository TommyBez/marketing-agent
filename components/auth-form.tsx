'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

type AuthStep = 'email' | 'otp'

function authErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'INVALID_OTP':
      return 'That code is not valid. Check the email and try again.'
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one to continue.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Too many incorrect attempts. Request a new code to continue.'
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests. Wait a minute before asking for another code.'
    default:
      return error.message ?? 'We could not complete sign-in. Please try again.'
  }
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  return localPart.replaceAll(/[._+-]+/g, ' ').trim() || 'Branderize user'
}

export function AuthForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(targetEmail: string) {
    setIsLoading(true)
    setError('')

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: targetEmail,
        type: 'sign-in',
      })

      if (result.error) {
        setError(authErrorMessage(result.error))
        return
      }

      setEmail(targetEmail)
      setStep('otp')
    } catch {
      setError('We could not send the code. Check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    if (step === 'email') {
      await sendCode(String(formData.get('email')).trim().toLowerCase())
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const otp = String(formData.get('otp')).replaceAll(/\D/g, '')
      const result = await authClient.signIn.emailOtp({
        email,
        name: displayNameFromEmail(email),
        otp,
      })

      if (result.error) {
        setError(authErrorMessage(result.error))
        return
      }

      router.push('/workspace')
      router.refresh()
    } catch {
      setError('We could not verify the code. Check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function useDifferentEmail() {
    setError('')
    setStep('email')
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        {step === 'email' ? (
          <Field data-disabled={isLoading}>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email} required disabled={isLoading} autoFocus />
            <FieldDescription>We will email you a secure, one-time sign-in code.</FieldDescription>
          </Field>
        ) : (
          <>
            <Field data-disabled={isLoading}>
              <FieldLabel htmlFor="otp">Six-digit code</FieldLabel>
              <InputOTP
                id="otp"
                name="otp"
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={isLoading}
                autoFocus
                aria-describedby="otp-description"
                containerClassName="w-full justify-center"
                onComplete={() => formRef.current?.requestSubmit()}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11 font-mono text-lg sm:size-12" />
                  <InputOTPSlot index={1} className="size-11 font-mono text-lg sm:size-12" />
                  <InputOTPSlot index={2} className="size-11 font-mono text-lg sm:size-12" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-11 font-mono text-lg sm:size-12" />
                  <InputOTPSlot index={4} className="size-11 font-mono text-lg sm:size-12" />
                  <InputOTPSlot index={5} className="size-11 font-mono text-lg sm:size-12" />
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription id="otp-description">
                Sent to <span className="font-medium text-foreground">{email}</span>. The code expires in five minutes.
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" variant="link" size="sm" disabled={isLoading} onClick={() => sendCode(email)}>
                Send a new code
              </Button>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <Button type="button" variant="link" size="sm" disabled={isLoading} onClick={useDifferentEmail}>
                Use another email
              </Button>
            </div>
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading} className="w-full">
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading
              ? step === 'email' ? 'Sending code…' : 'Checking code…'
              : step === 'email' ? 'Email me a code' : 'Open workspace'}
          </Button>
          <FieldError className="sr-only">{error}</FieldError>
        </Field>
      </FieldGroup>
    </form>
  )
}
