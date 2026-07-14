import { AuthForm } from '@/components/auth-form'
import { BrandMark } from '@/components/brand-mark'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/workspace')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Relay home"><BrandMark /></Link>
      <section className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-7 shadow-2xl md:p-8">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-foreground">Marketing OS</p>
          <h1 className="font-serif text-3xl text-balance">Meet your marketing team</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a workspace, add your website, and turn company context into coordinated execution.</p>
        </div>
        <AuthForm mode="sign-up" />
      </section>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-foreground underline underline-offset-4" href="/sign-in">Sign in</Link></p>
    </main>
  )
}
