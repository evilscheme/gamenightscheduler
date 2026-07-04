export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      level: 'error',
      unhandled: true,
      errorId: crypto.randomUUID(),
      message: err.message,
      stack: err.stack,
      path: request?.path,
      method: request?.method,
    })
  );
}
