import { auth } from "@/auth";
import { extractBrain, type BrainSurface } from "@/lib/brain";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

export const runtime = "edge";
export const maxDuration = 60;

const schema = z.object({
  surface: z.enum(["chat", "code", "projects", "media", "global"]),
  userMessage: z.string().trim().min(1).max(80_000),
  assistantMessage: z.string().trim().max(80_000).optional().default(""),
  sourceMsgId: z.string().trim().min(1).max(160).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, schema);
  if (isResponse(body)) return body;

  const result = await extractBrain({
    userId: session.user.id,
    surface: body.surface as BrainSurface,
    userMessage: body.userMessage,
    assistantMessage: body.assistantMessage,
    sourceMsgId: body.sourceMsgId,
  });

  return Response.json(result);
}
