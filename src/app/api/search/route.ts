
import { auth } from "@/auth";
import { getAppUrl } from "@/lib/app-url";
import { parseSearchParams, isResponse } from "@/lib/validation";
import { z } from "zod";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = parseSearchParams(req, searchParamsSchema);
  if (isResponse(params)) return params;

  const appUrl = getAppUrl(req);
  const cookie = req.headers.get("cookie") ?? "";

  try {
    const res = await fetch(`${appUrl}/api/connectors/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ action: "search", query: params.q, limit: params.limit }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Upstream search failed");
      return Response.json(
        { error: errorText || `Upstream returned ${res.status}`, results: [], query: params.q, count: 0 },
        { status: res.status }
      );
    }

    const raw = await res.json().catch(() => null);
    const results = Array.isArray(raw?.results) ? raw.results : [];
    return Response.json({ results, query: params.q, count: results.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search request failed";
    console.error("[search] fetch error:", msg);
    return Response.json({ error: msg, results: [], query: q, count: 0 }, { status: 500 });
  }
}
