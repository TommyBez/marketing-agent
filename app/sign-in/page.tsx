import { AuthForm } from '@/components/auth-form'
import { BrandMark } from '@/components/brand-mark'
import { auth } from '@/lib/auth'
import { getPendingInvitationSignInContext } from '@/lib/invitation-access'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface SignInPageProps {
  searchParams: Promise<{ callbackURL?: string; invitationId?: string }>
}

function safeCallbackURL(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/workspace'
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackURL: requestedCallbackURL, invitationId } = await searchParams
  const callbackURL = invitationId
    ? `/accept-invitation?id=${encodeURIComponent(invitationId)}`
    : safeCallbackURL(requestedCallbackURL)
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect(callbackURL)

  const invitationContext = invitationId
    ? await getPendingInvitationSignInContext(invitationId)
    : null
  if (invitationId && !invitationContext) redirect(callbackURL)

  const isInvitationSignIn = Boolean(invitationContext)

  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Branderize home"><BrandMark /></Link>
      <section className="auth-panel flex w-full max-w-md flex-col gap-8 rounded-2xl p-7 md:p-8">
        <div>
          <p className="auth-brandline mb-3">{isInvitationSignIn ? 'Workspace invitation' : 'Branderize workspace'}</p>
          <h1 className="text-balance">{isInvitationSignIn ? `Join ${invitationContext?.organizationName}` : 'Your workspace starts here'}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isInvitationSignIn
              ? 'Enter the one-time code we are sending to the invited email address.'
              : 'Enter your email and we will send a one-time code. No password to remember.'}
          </p>
        </div>
        <AuthForm
          autoSendCode={isInvitationSignIn}
          callbackURL={callbackURL}
          initialEmail={invitationContext?.email}
          allowEmailChange={!isInvitationSignIn}
        />
      </section>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {isInvitationSignIn
          ? 'After verification, you can review and accept the workspace invitation.'
          : 'New email? We will create your private workspace after you verify the code.'}
      </p>
    </main>
  )
}
