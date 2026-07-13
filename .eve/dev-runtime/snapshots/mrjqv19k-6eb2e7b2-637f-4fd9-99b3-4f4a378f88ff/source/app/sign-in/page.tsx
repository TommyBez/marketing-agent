import { AuthForm } from '@/components/auth-form'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/workspace')
  return <main className="flex min-h-screen items-center justify-center p-5"><section className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-7 shadow-2xl"><div className="flex flex-col gap-4"><div><p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-foreground">Relay workspace</p><h1 className="font-serif text-3xl text-balance">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Your marketing team is ready to pick up where you left off.</p></div></div><AuthForm mode="sign-in" /><p className="text-center text-sm text-muted-foreground">New here? <Link className="font-medium text-foreground underline" href="/sign-up">Create a workspace</Link></p></section></main>
}
