import { acceptWorkspaceInvitation } from '@/app/actions/organization'
import { BrandMark } from '@/components/brand-mark'
import { SignOutButton } from '@/components/sign-out-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface AcceptInvitationPageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const invitationId = (await searchParams).id
  if (!invitationId) return <InvalidInvitation />

  const requestHeaders = await headers()
  const currentSession = await auth.api.getSession({ headers: requestHeaders })
  if (!currentSession?.user) {
    const callbackURL = `/accept-invitation?id=${encodeURIComponent(invitationId)}`
    redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`)
  }

  const invitation = await auth.api.getInvitation({
    query: { id: invitationId },
    headers: requestHeaders,
  }).catch(() => null)

  if (!invitation) {
    return (
      <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
        <Link href="/" aria-label="Branderize home"><BrandMark /></Link>
        <Card className="auth-panel w-full max-w-lg">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
            <CardDescription>This invitation is invalid, expired, or belongs to a different email address.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button render={<Link href="/workspace" />}>Open workspace</Button>
            <SignOutButton />
          </CardContent>
        </Card>
      </main>
    )
  }

  const acceptAction = acceptWorkspaceInvitation.bind(null, invitation.id)
  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Branderize home"><BrandMark /></Link>
      <Card className="auth-panel w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Workspace invitation</Badge>
            <Badge variant="outline" className="capitalize">{invitation.role}</Badge>
          </div>
          <CardTitle>Join {invitation.organizationName}</CardTitle>
          <CardDescription>
            {invitation.inviterEmail} invited {currentSession.user.email} to collaborate in this Branderize workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <AlertDescription>Members share the company brief, conversations, and saved artifacts in this workspace.</AlertDescription>
          </Alert>
          <form action={acceptAction}>
            <Button type="submit" size="lg" className="w-full">Accept and open workspace</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function InvalidInvitation() {
  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
      <Link href="/" aria-label="Branderize home"><BrandMark /></Link>
      <Card className="auth-panel w-full max-w-lg">
        <CardHeader>
          <CardTitle>Invalid invitation link</CardTitle>
          <CardDescription>Ask the workspace owner to send you a new invitation.</CardDescription>
        </CardHeader>
        <CardContent><Button render={<Link href="/" />}>Back to Branderize</Button></CardContent>
      </Card>
    </main>
  )
}
