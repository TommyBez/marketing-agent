import { AsyncLocalStorage } from 'node:async_hooks'

interface InvitationDeliveryState {
  failure: unknown | null
}

const invitationDeliveryState = new AsyncLocalStorage<InvitationDeliveryState>()

export async function propagateInvitationDeliveryFailure<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const state: InvitationDeliveryState = { failure: null }
  return invitationDeliveryState.run(state, async () => {
    const result = await operation()
    if (state.failure !== null) throw state.failure
    return result
  })
}

export function recordInvitationDeliveryFailure(cause: unknown): void {
  const state = invitationDeliveryState.getStore()
  if (state) state.failure = cause
}
