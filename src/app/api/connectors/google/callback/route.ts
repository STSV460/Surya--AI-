/**
 * Google Workspace Connector — OAuth Callback
 *
 * GET /api/connectors/google/callback?code=...&state=...
 *
 * 1. Validates state (CSRF check — must match logged-in user's ID)
 * 2. Exchanges authorization code for access + refresh tokens
 * 3. Stores encrypted tokens in connector_tokens with provider = "google-workspace"
 * 4. Redirects user back to /settings
 */

import { auth } from "@/auth";
import { insforgeDb as db } from "@/lib/insforge";
import { encrypt, hmacSha256, timingSafeEqual } from "@/lib/crypto";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min

export async function GET(req: Request) {
  const appUrl = getAppUrl(req);
  const REDIRECT_URI = `${appUrl}/api/connectors/google/callback`;
  const SETTINGS_URL = `${appUrl}/settings`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User denied access or Google returned an error
  if (error || !code || !state) {
    const errParam = error ?? "no_code";
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=${errParam}`);
  }

  // --- CSRF-hardened state verification ------------------------------------
  // Verify all of: HMAC signature, timestamp not expired, browser-bound nonce.
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=server_misconfigured`);
  }

  let userIdFromState: string;
  let nonceFromState: string;
  let tsFromState: string;
  let sigFromState: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 4) throw new Error("bad parts");
    [userIdFromState, nonceFromState, tsFromState, sigFromState] = parts;
  } catch {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=invalid_state`);
  }

  // 1. Timestamp expiry (replay protection)
  const ts = parseInt(tsFromState, 10);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_MAX_AGE_MS) {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=state_expired`);
  }

  // 2. HMAC signature (forgery protection)
  const expectedSig = await hmacSha256(
    `${userIdFromState}.${nonceFromState}.${tsFromState}`,
    secret
  );
  if (!timingSafeEqual(sigFromState, expectedSig)) {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=bad_signature`);
  }

  // 3. Browser-bound nonce cookie (session-pinning protection)
  // Read cookie via Next.js Request API — Cloudflare-style cookie headers OK.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)oauth_workspace_nonce=([^;]+)/);
  const cookieNonce = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  if (!cookieNonce || !timingSafeEqual(cookieNonce, nonceFromState)) {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=nonce_mismatch`);
  }

  // 4. Session must match the user the state was issued for
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userIdFromState) {
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=user_mismatch`);
  }

  const userId = session.user.id;

  // Exchange code for tokens
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[connector/google/callback] token exchange failed:", errBody);
      return NextResponse.redirect(`${SETTINGS_URL}?connector_error=token_exchange_failed`);
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("[connector/google/callback] fetch error:", err);
    return NextResponse.redirect(`${SETTINGS_URL}?connector_error=network_error`);
  }

  // Fetch user's email from Google userinfo endpoint
  let email: string | null = null;
  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userinfoRes.ok) {
      const userinfo = await userinfoRes.json();
      email = userinfo.email ?? null;
    }
  } catch {
    // Non-fatal — email is just for display
  }

  const now = new Date().toISOString();
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const tokenRow = {
    user_id: userId,
    email: email ?? session.user.email ?? "",
    provider: "google-workspace",
    access_token: await encrypt(tokenData.access_token),
    refresh_token: tokenData.refresh_token ? await encrypt(tokenData.refresh_token) : null,
    expires_at: expiresAt,
    updated_at: now,
    created_at: now,
  };

  // Upsert on (user_id, provider) — stores as "google-workspace" so it
  // never conflicts with the basic "google" login token
  const { error: upsertErr } = await db
    .from("connector_tokens")
    .upsert(tokenRow, { onConflict: "user_id,provider" });

  if (upsertErr) {
    // Fallback: delete + insert
    try {
      await db
        .from("connector_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "google-workspace");
      await db.from("connector_tokens").insert(tokenRow);
    } catch (fallbackErr) {
      console.error("[connector/google/callback] fallback insert failed:", fallbackErr);
      return NextResponse.redirect(`${SETTINGS_URL}?connector_error=db_error`);
    }
  }

  // Success — clear nonce cookie so it can't be replayed
  const successRes = NextResponse.redirect(`${SETTINGS_URL}?workspace_connected=1`);
  successRes.cookies.set("oauth_workspace_nonce", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return successRes;
}
