import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsforgeAuthClient } from "@/lib/insforge";

const resendSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

function appOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin;
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return requestUrl.origin;
}

function authErrorResponse(message?: string, status = 400) {
  const isNetworkError = message?.toLowerCase().includes("network request failed");
  return NextResponse.json(
    {
      error: isNetworkError
        ? "Could not reach InsForge Auth. Check internet/backend status and try again."
        : message || "Could not resend verification email.",
    },
    { status: isNetworkError ? 503 : status }
  );
}

export async function POST(request: Request) {
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { error } = await createInsforgeAuthClient().auth.resendVerificationEmail({
    email: parsed.data.email,
    redirectTo: `${appOrigin(request)}/login?verified=1`,
  });

  if (error) {
    return authErrorResponse(error.message, error.statusCode || 400);
  }

  return NextResponse.json({ ok: true });
}
