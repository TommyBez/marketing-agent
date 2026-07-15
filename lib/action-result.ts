export type ActionResult<T = null> =
  | { data: T; ok: true }
  | { message: string; ok: false }

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { data, ok: true }
}

export function actionFailure(message: string): ActionResult<never> {
  return { message, ok: false }
}
