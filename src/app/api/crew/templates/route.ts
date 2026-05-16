export const runtime = "edge";
export const maxDuration = 60;

function url() {
  const base = process.env.CREW_SERVICE_URL;
  if (!base) throw new Error("CREW_SERVICE_URL is not configured");
  return `${base.replace(/\/$/, "")}/api/crew/templates`;
}

async function proxy(req: Request, method: "GET" | "POST") {
  let endpoint: string;
  try {
    endpoint = url();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  const upstream = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: method === "POST" ? await req.text() : undefined,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  return proxy(req, "GET");
}

export async function POST(req: Request) {
  return proxy(req, "POST");
}
