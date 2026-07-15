import 'server-only'

import { get } from '@vercel/blob'
import type { HandleMessageStreamEvent } from 'eve/client'
import { z } from 'zod'

// Eve exposes HandleMessageStreamEvent as a type, but no canonical runtime schema.
// Validate the container here rather than maintaining a divergent partial event union.
const transcriptEventsSchema = z.array(z.unknown())
const transcriptPointerSchema = z.object({ blobPath: z.string().min(1) })

export async function readConversationTranscript(
  value: unknown,
): Promise<HandleMessageStreamEvent[]> {
  const inlineTranscript = transcriptEventsSchema.safeParse(value)
  if (inlineTranscript.success) return inlineTranscript.data as HandleMessageStreamEvent[]

  const pointer = transcriptPointerSchema.safeParse(value)
  if (!pointer.success) return []

  try {
    const result = await get(pointer.data.blobPath, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) return []

    const payload = await new Response(result.stream).json()
    const transcript = transcriptEventsSchema.safeParse(payload)
    return transcript.success ? transcript.data as HandleMessageStreamEvent[] : []
  } catch {
    return []
  }
}

export function getConversationTranscriptBlobPath(value: unknown) {
  const pointer = transcriptPointerSchema.safeParse(value)
  return pointer.success ? pointer.data.blobPath : null
}
