/**
 * Google Workspace token helper.
 *
 * Reads the user's google-workspace OAuth token from `connector_tokens`,
 * decrypts it, refreshes via Google's token endpoint if expired, and
 * returns a valid access_token ready to use for Slides/Sheets/Docs/Drive
 * API calls.
 *
 * Returns null if the user hasn't connected Google Workspace, or if the
 * refresh fails.
 */

import { insforgeDb as db } from "@/lib/insforge";
import { encrypt, decrypt } from "@/lib/crypto";

interface ConnectorTokenRow {
  user_id: string;
  email: string | null;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

const REFRESH_BUFFER_MS = 60 * 1000; // refresh if <60s of life left

export async function getValidWorkspaceToken(userId: string): Promise<string | null> {
  // 1. Load token row
  const { data, error } = await db
    .from("connector_tokens")
    .select("user_id,email,provider,access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .eq("provider", "google-workspace")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as ConnectorTokenRow;
  const accessTokenPlain = await decrypt(row.access_token);
  if (!accessTokenPlain) return null;

  // 2. Check expiry
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const now = Date.now();
  if (expiresAt > now + REFRESH_BUFFER_MS) {
    return accessTokenPlain;
  }

  // 3. Refresh
  if (!row.refresh_token) {
    console.warn("[workspace] token expired but no refresh_token stored");
    return null;
  }
  const refreshTokenPlain = await decrypt(row.refresh_token);
  if (!refreshTokenPlain) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[workspace] Google OAuth client config missing");
    return null;
  }

  let refreshed: {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenPlain,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("[workspace] refresh failed:", res.status, errBody);
      return null;
    }
    refreshed = await res.json();
  } catch (err) {
    console.error("[workspace] refresh fetch error:", err);
    return null;
  }

  // 4. Persist new access_token
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  try {
    await db
      .from("connector_tokens")
      .update({
        access_token: await encrypt(refreshed.access_token),
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google-workspace");
  } catch (err) {
    console.warn("[workspace] failed to persist refreshed token:", err);
    // Still return the new token — caller can use it for this request
  }

  return refreshed.access_token;
}
