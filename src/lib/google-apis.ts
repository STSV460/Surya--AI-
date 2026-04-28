/**
 * Google API helpers — edge-compatible stub
 *
 * The full implementation depends on the `googleapis` npm package, which
 * uses Node-only APIs (fs, process internals) and cannot run on Cloudflare
 * Pages' edge runtime. The Google connector endpoints (calendar/drive/docs/
 * gmail) are temporarily disabled until they're rewritten using direct
 * REST calls (fetch) to https://www.googleapis.com/*.
 *
 * What's still here:
 *   - `getGitHubToken` — pure DB lookup + decrypt, no googleapis dependency
 *   - `isConnectorError` — type guard
 *
 * Token persistence in `src/auth.ts` is unaffected; tokens still get
 * encrypted and stored on sign-in.
 */

import { db } from "@/lib/insforge";
import { decryptOrPlain } from "@/lib/crypto";
import type { ConnectorToken } from "@/types/connector";

interface ConnectorError {
  code: "NOT_CONNECTED" | "TOKEN_EXPIRED" | "NOT_AVAILABLE";
  message: string;
}

export function isConnectorError(err: unknown): err is ConnectorError {
  return typeof err === "object" && err !== null && "code" in err;
}

/**
 * @deprecated Disabled in edge build. Returns a NOT_AVAILABLE error so
 * callers (the 4 Google connector routes) can return a 503.
 */
export async function getGoogleClient(_userId: string): Promise<never> {
  throw {
    code: "NOT_AVAILABLE",
    message:
      "Google connectors are temporarily unavailable in this deployment. " +
      "The googleapis SDK is not edge-compatible; routes will be rewritten " +
      "with direct REST calls in a follow-up.",
  } as ConnectorError;
}

export async function getGitHubToken(userId: string): Promise<string> {
  const result = (await db.connectorTokens("findOne", {
    filter: { userId, provider: "github" },
  })) as { document: ConnectorToken | null };

  if (!result.document?.accessToken) {
    throw {
      code: "NOT_CONNECTED",
      message: "GitHub account not connected. Please sign in with GitHub.",
    } as ConnectorError;
  }

  return await decryptOrPlain(result.document.accessToken);
}
