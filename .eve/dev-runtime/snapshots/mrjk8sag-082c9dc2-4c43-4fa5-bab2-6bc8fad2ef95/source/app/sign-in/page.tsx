import { AuthForm } from '@/components/auth-form'
import { auth } from '@/lib/auth'
import { Sparkles } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')
  return <main className="flex min-h-screen items-center justify-center p-5"><section className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-7 shadow-2xl"><div className="flex flex-col gap-4"><span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Sparkles className="size-5" /></span><div><h1 className="font-serif text-3xl text-balance">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Your marketing team is ready to pick up where you left off.</p></div></div><AuthForm mode="sign-in" /><p className="text-center text-sm text-muted-foreground">New here? <Link className="font-medium text-foreground underline" href="/sign-up">Create a workspace</Link></p></section></main>
}
