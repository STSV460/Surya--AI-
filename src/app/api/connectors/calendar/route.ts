export const runtime = "edge";

import { auth } from "@/auth";
import { getGoogleClient, isConnectorError } from "@/lib/google-apis";
import { google } from "googleapis";
import { connectorLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const userId = session.user.id;
  const body = await req.json();
  const { action } = body;

  try {
    const oauth2Client = await getGoogleClient(userId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    if (action === "list_events") {
      const { maxResults = 10, timeMin, timeMax } = body;

      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin ?? new Date().toISOString(),
        timeMax: timeMax ?? undefined,
        maxResults: Math.min(maxResults, 20),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (res.data.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        description: e.description,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        attendees: (e.attendees ?? []).map((a) => a.email),
      }));

      return Response.json({ events });
    }

    if (action === "create_event") {
      const { summary, description, startDateTime, endDateTime, attendees = [] } = body;

      // Default end time: 1 hour after start
      const start = new Date(startDateTime);
      const end = endDateTime
        ? new Date(endDateTime)
        : new Date(start.getTime() + 60 * 60 * 1000);

      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary,
          description: description ?? undefined,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: attendees.map((email: string) => ({ email })),
        },
      });

      return Response.json({
        success: true,
        eventId: res.data.id,
        htmlLink: res.data.htmlLink,
        message: `Event "${summary}" created successfully.`,
      });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    if (isConnectorError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}