import { AuthForm } from '@/components/auth-form'
import { auth } from '@/lib/auth'
import { Sparkles } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/workspace')
  return <main className="flex min-h-screen items-center justify-center p-5"><section className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-7 shadow-2xl"><div className="flex flex-col gap-4"><span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Sparkles className="size-5" /></span><div><p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-foreground">Marketing OS</p><h1 className="font-serif text-3xl text-balance">Meet your marketing team</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Create a workspace, add your website, and turn company context into coordinated execution.</p></div></div><AuthForm mode="sign-up" /><p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-foreground underline" href="/sign-in">Sign in</Link></p></section></main>
}
