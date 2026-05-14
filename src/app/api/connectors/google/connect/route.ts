/**
 * Google Workspace Connector — Initiate OAuth
 *
 * GET /api/connectors/google/connect
 *
 * Builds a Google OAuth URL requesting workspace scopes (Gmail, Drive,
 * Calendar, Docs) and redirects the user to Google's consent screen.
 * Uses the user's session ID as the OAuth `state` parameter for CSRF
 * protection.
 *
 * This is a SEPARATE flow from NextAuth login. Login only requests
 * `openid email profile`; workspace scopes are requested here so Google
 * doesn't show the "not verified" warning for regular sign-in.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { hmacSha256 } from "@/lib/crypto";

const WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

export async function GET(req: Request) {
  const appUrl = getAppUrl(req);
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${appUrl}/api/connectors/google/callback`;

  if (!clientId) {
    return Response.json({ error: "Missing Google OAuth config" }, { status: 500 });
  }

  // CSRF-hardened state: HMAC-signed payload + httpOnly nonce cookie + 10-min expiry.
  // Layers protect against replay (timestamp), session-binding bypass (cookie nonce),
  // and forged user IDs (HMAC over the full payload using NEXTAUTH_SECRET).
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const nonce = crypto.randomUUID();
  const ts = Date.now().toString();
  const payload = `${session.user.id}.${nonce}.${ts}`;
  const sig = await hmacSha256(payload, secret);
  const state = Buffer.from(`${payload}.${sig}`).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: WORKSPACE_SCOPES,
    access_type: "offline",
    prompt: "consent",          // Force consent so we always get a refresh_token
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const res = NextResponse.redirect(googleAuthUrl);
  res.cookies.set("oauth_workspace_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return res;
}
