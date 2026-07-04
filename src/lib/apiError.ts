import { NextResponse } from 'next/server';

type Context = { route: string } & Record<string, unknown>;

/**
 * Log a handled server error as one structured JSON line (Vercel ingests
 * function stdout/stderr into Runtime Logs / Observability — searchable by
 * errorId, no external logging vendor) and return the generated errorId.
 */
export function logServerError(error: unknown, context: Context): string {
  const errorId = crypto.randomUUID();
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      level: 'error',
      errorId,
      message: err.message,
      stack: err.stack,
      ...context,
    })
  );
  return errorId;
}

/** Log + build the canonical 500 response with a correlatable errorId. */
export function serverError(error: unknown, context: Context): NextResponse {
  const errorId = logServerError(error, context);
  return NextResponse.json(
    { error: 'Internal server error', errorId },
    { status: 500 }
  );
}
