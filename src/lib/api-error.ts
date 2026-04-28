// randomUUID via globalThis.crypto (Web Crypto API)

/**
 * Sanitized API error response. Logs full error server-side, returns only a
 * generic message + requestId to the client. Use everywhere instead of
 * leaking err.message / err.code / stack traces.
 */
export function apiError(
  publicMessage: string,
  status = 500,
  cause?: unknown,
  context?: string,
): Response {
  const requestId = randomUUID();
  if (cause !== undefined) {
    const tag = context ? `[${context}]` : "[apiError]";
    console.error(tag, "requestId=", requestId, cause);
  }
  return Response.json({ error: publicMessage, requestId }, { status });
}

export function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export function forbidden() {
  return new Response("Forbidden", { status: 403 });
}

export function notFound() {
  return new Response("Not found", { status: 404 });
}
