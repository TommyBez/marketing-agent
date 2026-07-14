import 'server-only'

import { get } from '@vercel/blob'
import type { HandleMessageStreamEvent } from 'eve/client'
import { z } from 'zod'

const transcriptEventsSchema = z.array(z.unknown())
const transcriptPointerSchema = z.object({ blobPath: z.string().min(1) })

export async function readConversationTranscript(value: unknown) {
  const inlineTranscript = transcriptEventsSchema.safeParse(value)
  if (inlineTranscript.success) return inlineTranscript.data as HandleMessageStreamEvent[]

  const pointer = transcriptPointerSchema.safeParse(value)
  if (!pointer.success) return []

  const result = await get(pointer.data.blobPath, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) return []

  const payload = await new Response(result.stream).json()
  return transcriptEventsSchema.parse(payload) as HandleMessageStreamEvent[]
}

export function getConversationTranscriptBlobPath(value: unknown) {
  const pointer = transcriptPointerSchema.safeParse(value)
  return pointer.success ? pointer.data.blobPath : null
}
