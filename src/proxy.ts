import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED = ["/chat", "/projects", "/app-builder", "/crew-builder", "/media", "/settings"];

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function compactHeader(value: string) {
  return value.replace(/\s{2,}/g, " ").trim();
}

function securityHeaders(isApi: boolean) {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' blob:";

  return {
    "Content-Security-Policy": compactHeader(`
      default-src 'self';
      ${scriptSrc};
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: https:;
      font-src 'self' data:;
      media-src 'self' blob: data: https:;
      connect-src 'self' https://*.insforge.app https://api.github.com https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com ${process.env.CREW_SERVICE_URL ?? ""};
      frame-src 'self' blob:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    ...(isApi ? { "Cache-Control": "no-store" } : {}),
  };
}

function applySecurityHeaders(response: NextResponse, isApi: boolean) {
  for (const [key, value] of Object.entries(securityHeaders(isApi))) {
    response.headers.set(key, value);
  }
  response.headers.delete("Access-Control-Allow-Origin");
  return response;
}

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function allowedOrigins(requestOrigin: string) {
  return new Set(
    [
      requestOrigin,
      process.env.NEXTAUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.replace(/\/$/, ""))
  );
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // API routes authenticate/authorize inside each handler. For browser-origin
  // state-changing calls, require same-origin to reduce CSRF/CORS surprises.
  if (isApi) {
    const origin = req.headers.get("origin")?.replace(/\/$/, "");
    if (origin && STATE_CHANGING.has(req.method) && !allowedOrigins(nextUrl.origin).has(origin)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Cross-origin API request blocked" }, { status: 403 }),
        true
      );
    }
    return applySecurityHeaders(NextResponse.next(), true);
  }

  // Always allow Next.js internals and static public assets.
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/logo") ||
    path.startsWith("/public")
  ) {
    return applySecurityHeaders(NextResponse.next(), false);
  }

  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));
  const isLoggedIn = !!session?.user;

  // Unauthenticated user hitting protected route → redirect to login
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return applySecurityHeaders(redirectNoStore(loginUrl), false);
  }

  // Logged-in user hitting /login OR landing page → redirect to chat
  if ((path === "/login" || path === "/") && isLoggedIn) {
    return applySecurityHeaders(redirectNoStore(new URL("/chat", nextUrl.origin)), false);
  }

  return applySecurityHeaders(NextResponse.next(), false);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
