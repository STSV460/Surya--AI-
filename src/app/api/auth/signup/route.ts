import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsforgeAuthClient } from "@/lib/insforge";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
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
        : message || "Could not create account.",
    },
    { status: isNetworkError ? 503 : status }
  );
}

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password with at least 8 characters." },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const insforgeAuth = createInsforgeAuthClient();
  const authConfig = await insforgeAuth.auth.getPublicAuthConfig();
  if (authConfig.error) {
    return authErrorResponse(authConfig.error.message, authConfig.error.statusCode || 503);
  }

  const { data, error } = await insforgeAuth.auth.signUp({
    email,
    password,
    name,
    redirectTo: `${appOrigin(request)}/login?verified=1`,
  });

  if (error) {
    return authErrorResponse(error.message, error.statusCode || 400);
  }

  return NextResponse.json({
    ok: true,
    requireEmailVerification: data?.requireEmailVerification ?? false,
    verifyEmailMethod: authConfig.data?.verifyEmailMethod ?? "link",
  });
}
