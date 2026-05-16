/**
 * Google API helpers.
 *
 * Google Workspace connector routes use direct REST calls with fetch so they
 * work in serverless/edge-compatible deployments without the Node-only
 * `googleapis` SDK. This file only keeps the legacy getGoogleClient guard plus
 * the GitHub token helper used by the GitHub connector.
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
 * @deprecated Use direct Google REST APIs with getValidWorkspaceToken instead.
 */
export async function getGoogleClient(): Promise<never> {
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
