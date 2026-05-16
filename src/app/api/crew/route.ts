export const runtime = "edge";
export const maxDuration = 300;

function crewServiceUrl(path = "/api/crew/run") {
  const base = process.env.CREW_SERVICE_URL;
  if (!base) throw new Error("CREW_SERVICE_URL is not configured");
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function POST(req: Request) {
  let url: string;
  try {
    url = crewServiceUrl();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Cookie: req.headers.get("cookie") ?? "",
      Accept: "text/event-stream",
    },
    body: await req.text(),
  });

  if (!upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
