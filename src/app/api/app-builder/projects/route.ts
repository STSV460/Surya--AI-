import { auth } from "@/auth";
import { db } from "@/lib/insforge";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  const result = await db.appBuilderProjects("find", {
    filter: { userId },
    sort: { updatedAt: -1 },
    limit: 50,
  });
  return Response.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const doc = {
    id,
    userId,
    name: body.name?.slice(0, 120) || "Untitled App",
    files: {},
    messages: [],
    previewMode: "none",
    createdAt: now,
    updatedAt: now,
  };

  await db.appBuilderProjects("insertOne", { document: doc });
  return Response.json({ document: doc });
}
