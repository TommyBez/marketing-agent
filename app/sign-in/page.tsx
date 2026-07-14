import { AuthForm } from '@/components/auth-form'
import { BrandMark } from '@/components/brand-mark'
import { auth, isLocalAuthBypassEnabled } from '@/lib/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/workspace')

  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Branderize home"><BrandMark /></Link>
      <section className="auth-panel flex w-full max-w-md flex-col gap-8 rounded-2xl p-7 md:p-8">
        <div>
          <p className="auth-brandline mb-3">Branderize workspace</p>
          <h1 className="text-balance">Your workspace starts here</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isLocalAuthBypassEnabled
              ? 'Enter your email, then use any code. No email is sent in local development.'
              : 'Enter your email and we will send a one-time code. No password to remember.'}
          </p>
        </div>
        <AuthForm localAuthBypassEnabled={isLocalAuthBypassEnabled} />
      </section>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {isLocalAuthBypassEnabled
          ? 'New email? Local development will create your private workspace when you continue.'
          : 'New email? We will create your private workspace after you verify the code.'}
      </p>
    </main>
  )
}
