import { AuthForm } from '@/components/auth-form'
import { BrandMark } from '@/components/brand-mark'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/workspace')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Relay home"><BrandMark /></Link>
      <section className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-7 shadow-2xl md:p-8">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-foreground">Relay workspace</p>
          <h1 className="font-serif text-3xl text-balance">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your marketing team is ready to pick up where you left off.</p>
        </div>
        <AuthForm mode="sign-in" />
      </section>
      <p className="text-center text-sm text-muted-foreground">New here? <Link className="font-medium text-foreground underline underline-offset-4" href="/sign-up">Create a workspace</Link></p>
    </main>
  )
}
