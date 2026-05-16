import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";
import { isResponse, parseJson } from "@/lib/validation";
import { z } from "zod";

const calendarBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list_events"),
    maxResults: z.coerce.number().int().min(1).max(30).optional().default(10),
    timeMin: z.string().trim().max(80).optional(),
    timeMax: z.string().trim().max(80).optional(),
  }),
]);

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  status?: string;
}

function googleWorkspaceMissing() {
  return Response.json(
    { error: "Google Workspace not connected. Connect it in Settings > Connected Accounts.", code: "NOT_CONNECTED" },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await parseJson(req, calendarBodySchema);
  if (isResponse(body)) return body;

  const accessToken = await getValidWorkspaceToken(session.user.id);
  if (!accessToken) return googleWorkspaceMissing();

  try {
    const params = new URLSearchParams({
      maxResults: String(body.maxResults),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: body.timeMin ?? new Date().toISOString(),
    });
    if (body.timeMax) params.set("timeMax", body.timeMax);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      return Response.json({ error: await res.text() }, { status: res.status });
    }

    const data = (await res.json()) as { items?: CalendarEvent[] };
    return Response.json({
      events: (data.items ?? []).map((event) => ({
        id: event.id,
        summary: event.summary ?? "(No title)",
        description: event.description ?? "",
        location: event.location ?? "",
        htmlLink: event.htmlLink,
        start: event.start,
        end: event.end,
        attendees: event.attendees ?? [],
        status: event.status,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
