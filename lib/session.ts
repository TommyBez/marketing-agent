import 'server-only'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { cache } from 'react'

export const getRequestAuthContext = cache(async () => {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  return { requestHeaders, session }
})

export async function getCurrentSession() {
  return (await getRequestAuthContext()).session
}
