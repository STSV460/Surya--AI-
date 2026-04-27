import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import type { ConnectorToken } from "@/types/connector";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const result = (await db.connectorTokens("find", {
    filter: { userId },
  })) as { documents: ConnectorToken[] };

  const tokens = result.documents ?? [];

  const google = tokens.find((t) => t.provider === "google");
  const github = tokens.find((t) => t.provider === "github");

  return Response.json({
    google: {
      connected: !!google,
      email: google?.email,
      expiresAt: google?.expiresAt,
    },
    github: {
      connected: !!github,
      email: github?.email,
    },
  });
}
