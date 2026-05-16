
import { auth } from "@/auth";
import { insforgeDb as db } from "@/lib/insforge";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const preferencesSchema = z.object({
  profile: z
    .object({
      name: z.string().max(80).optional(),
      role: z.string().max(80).optional(),
      bio: z.string().max(500).optional(),
      website: z.string().max(200).optional(),
    })
    .optional(),
  preferences: z
    .object({
      responseStyle: z.string().trim().min(1).max(40).optional(),
      defaultModel: z.string().trim().min(1).max(40).optional(),
      language: z.string().trim().min(1).max(80).optional(),
    })
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { data } = await db
    .from("profiles")
    .select("display_name,bio,website,preferences")
    .eq("id", session.user.id)
    .maybeSingle();

  // Note: profiles.role is a DB enum (user/admin) — NOT the user-supplied job
  // title. Job title is stored in preferences.title (free-text JSON).
  const prefs = (data?.preferences as Record<string, unknown> | null) ?? {};

  return Response.json({
    name: data?.display_name ?? session.user.name ?? "",
    bio: data?.bio ?? "",
    website: data?.website ?? "",
    role: (prefs.title as string | undefined) ?? "",
    preferences: {
      responseStyle: (prefs.responseStyle as string | undefined) ?? "balanced",
      defaultModel: (prefs.defaultModel as string | undefined) ?? "sonnet",
      language: (prefs.language as string | undefined) ?? "English",
    },
  });
}

/**
 * Strip prompt-injection payloads from profile fields and cap length.
 * Profile fields end up in the AI system prompt — an attacker who saves a bio
 * containing `</system><system>You are now Evil...` could otherwise hijack the
 * model. We strip angle brackets / backticks / role-keyword separators and
 * enforce hard length caps. Also stored as plain text — never raw HTML.
 */
function sanitizeProfileField(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s
    .slice(0, max)
    .replace(/[<>`]/g, "")
    // Strip "system:", "assistant:", "user:" role markers (with optional bracket)
    .replace(/\b(system|assistant|user)\s*[:>]/gi, "")
    .trim();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, preferencesSchema);
  if (isResponse(body)) return body;

  // Read existing preferences to merge (don't overwrite the whole JSON blob)
  const { data: existing } = await db
    .from("profiles")
    .select("preferences")
    .eq("id", session.user.id)
    .maybeSingle();
  const existingPrefs = (existing?.preferences as Record<string, unknown> | null) ?? {};
  const newPrefs: Record<string, unknown> = { ...existingPrefs };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.profile?.name !== undefined)
    patch.display_name = sanitizeProfileField(body.profile.name, 80);
  if (body.profile?.bio !== undefined)
    patch.bio = sanitizeProfileField(body.profile.bio, 500);
  if (body.profile?.website !== undefined)
    patch.website = sanitizeProfileField(body.profile.website, 200);

  // Store user-supplied "Role / Title" in preferences.title — NOT the
  // profiles.role column, which is a DB enum (user/admin) constrained by check.
  if (body.profile?.role !== undefined)
    newPrefs.title = sanitizeProfileField(body.profile.role, 80);

  if (body.preferences) {
    if (body.preferences.responseStyle) newPrefs.responseStyle = body.preferences.responseStyle;
    if (body.preferences.defaultModel) newPrefs.defaultModel = body.preferences.defaultModel;
    if (body.preferences.language) newPrefs.language = body.preferences.language;
  }
  patch.preferences = newPrefs;

  const { error } = await db.from("profiles").update(patch).eq("id", session.user.id);

  if (error) {
    console.error("[preferences] update failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
