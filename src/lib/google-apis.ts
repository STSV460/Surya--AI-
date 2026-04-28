import { google } from "googleapis";
import { db } from "@/lib/insforge";
import { encrypt, decryptOrPlain } from "@/lib/crypto";
import type { ConnectorToken } from "@/types/connector";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface ConnectorError {
  code: "NOT_CONNECTED" | "TOKEN_EXPIRED";
  message: string;
}

export function isConnectorError(err: unknown): err is ConnectorError {
  return typeof err === "object" && err !== null && "code" in err;
}

export async function getGoogleClient(userId: string) {
  const result = (await db.connectorTokens("findOne", {
    filter: { userId, provider: "google" },
  })) as { document: ConnectorToken | null };

  if (!result.document) {
    throw {
      code: "NOT_CONNECTED",
      message: "Google account not connected. Please sign in with Google.",
    } as ConnectorError;
  }

  const token = result.document;
  // Decrypt tokens retrieved from DB
  let accessToken = await decryptOrPlain(token.accessToken);
  const refreshToken = token.refreshToken ? await decryptOrPlain(token.refreshToken) : null;

  // Refresh if expired or expiring within buffer window
  if (token.expiresAt) {
    const expiresAt = new Date(token.expiresAt).getTime();
    if (Date.now() + TOKEN_REFRESH_BUFFER_MS > expiresAt) {
      if (!refreshToken) {
        throw {
          code: "NOT_CONNECTED",
          message: "Google token expired. Please sign in again.",
        } as ConnectorError;
      }

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();

      if (refreshData.error === "invalid_grant") {
        await db.connectorTokens("deleteOne", {
          filter: { userId, provider: "google" },
        });
        throw {
          code: "TOKEN_EXPIRED",
          message: "Google token revoked. Please sign in again.",
        } as ConnectorError;
      }

      if (!refreshRes.ok || !refreshData.access_token) {
        throw {
          code: "TOKEN_EXPIRED",
          message: "Failed to refresh Google token. Please sign in again.",
        } as ConnectorError;
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(
        Date.now() + refreshData.expires_in * 1000
      ).toISOString();

      await db.connectorTokens("updateOne", {
        filter: { userId, provider: "google" },
        update: {
          $set: {
            accessToken: await encrypt(accessToken), // Encrypt before storing
            expiresAt: newExpiresAt,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
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

