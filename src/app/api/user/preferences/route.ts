export const runtime = "edge";

import { auth } from "@/auth";
import { insforgeDb as db } from "@/lib/insforge";

interface Preferences {
  responseStyle?: string;
  defaultModel?: string;
  language?: string;
  bio?: string;
  website?: string;
  role?: string;
  name?: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { data } = await db
    .from("profiles")
    .select("display_name,bio,website,role,preferences")
    .eq("id", session.user.id)
    .maybeSingle();

  return Response.json({
    name: data?.display_name ?? session.user.name ?? "",
    bio: data?.bio ?? "",
    website: data?.website ?? "",
    role: data?.role ?? "",
    preferences: data?.preferences ?? {
      responseStyle: "balanced",
      defaultModel: "sonnet",
      language: "English",
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    profile?: { name?: string; role?: string; bio?: string; website?: string };
    preferences?: Preferences;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.profile?.name !== undefined) patch.display_name = body.profile.name;
  if (body.profile?.bio !== undefined) patch.bio = body.profile.bio;
  if (body.profile?.website !== undefined) patch.website = body.profile.website;
  if (body.preferences) patch.preferences = body.preferences;

  const { error } = await db.from("profiles").update(patch).eq("id", session.user.id);

  if (error) {
    console.error("[preferences] update failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}