import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsforgeAuthClient } from "@/lib/insforge";

const verifySchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  otp: z.string().trim().regex(/^\d{6}$/),
});

function authErrorResponse(message?: string, status = 400) {
  const isNetworkError = message?.toLowerCase().includes("network request failed");
  return NextResponse.json(
    {
      error: isNetworkError
        ? "Could not reach InsForge Auth. Check internet/backend status and try again."
        : message || "Verification failed.",
    },
    { status: isNetworkError ? 503 : status }
  );
}

export async function POST(request: Request) {
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const { data, error } = await createInsforgeAuthClient().auth.verifyEmail(parsed.data);

  if (error) {
    return authErrorResponse(error.message, error.statusCode || 400);
  }

  return NextResponse.json({
    ok: true,
    email: data?.user?.email ?? parsed.data.email,
  });
}
