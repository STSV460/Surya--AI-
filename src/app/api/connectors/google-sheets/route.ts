/**
 * Google Sheets connector — Kimi K2.5 generates spreadsheet structure as JSON,
 * we push to Google Sheets API using user's workspace OAuth token.
 *
 * POST body: { topic: string, columns?: number, rows?: number }
 * Response: { url, id, title, rowCount, colCount }
 */

import { auth } from "@/auth";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { connectorLimiter } from "@/lib/rate-limit";
import { getValidWorkspaceToken } from "@/lib/google-workspace";

export const maxDuration = 60;

interface SheetSpec {
  title: string;
  headers: string[];
  rows: string[][];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const { success } = await connectorLimiter.check(userId);
  if (!success) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: { topic?: string; rows?: number; columns?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic) return Response.json({ error: "topic is required" }, { status: 400 });
  const targetRows = Math.max(5, Math.min(100, body.rows ?? 20));

  const accessToken = await getValidWorkspaceToken(userId);
  if (!accessToken) {
    return Response.json(
      { error: "Google Workspace not connected. Connect it in Settings → Connected Accounts." },
      { status: 400 }
    );
  }

  // 1. Generate sheet content with Kimi K2.5
  let spec: SheetSpec;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (aiClient.chat.completions.create as any)({
      model: MODEL_MAP.kimi,
      messages: [
        {
          role: "system",
          content: `You generate Google Sheets data as JSON. Return ONLY valid JSON (no markdown fences, no prose):
{
  "title": "Sheet title",
  "headers": ["Col1", "Col2", "Col3"],
  "rows": [["v1","v2","v3"], ["v1","v2","v3"]]
}
Rules: pick useful columns for the topic, ${targetRows} data rows of realistic values, all values are strings.`,
        },
        { role: "user", content: `Topic: ${topic}` },
      ],
      stream: false,
      maxTokens: 8192,
    });
    const text: string = completion?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    spec = JSON.parse(jsonMatch[0]) as SheetSpec;
    if (!spec.title || !Array.isArray(spec.headers) || !Array.isArray(spec.rows)) {
      throw new Error("Invalid sheet shape");
    }
  } catch (err) {
    console.error("[sheets] gen failed:", err);
    return Response.json({ error: "Failed to generate sheet content" }, { status: 500 });
  }

  // 2. Create spreadsheet
  let spreadsheetId: string;
  try {
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { title: spec.title } }),
    });
    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("[sheets] create failed:", createRes.status, errBody);
      return Response.json({ error: "Google Sheets create failed" }, { status: 500 });
    }
    const j = await createRes.json();
    spreadsheetId = j.spreadsheetId;
  } catch (err) {
    console.error("[sheets] create error:", err);
    return Response.json({ error: "Network error creating spreadsheet" }, { status: 500 });
  }

  // 3. Append headers + rows
  const values = [spec.headers, ...spec.rows.map((r) => r.map((c) => String(c ?? "")))];
  try {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }
    );
    if (!appendRes.ok) {
      const errBody = await appendRes.text();
      console.error("[sheets] append failed:", appendRes.status, errBody);
    }
  } catch (err) {
    console.error("[sheets] append error:", err);
  }

  return Response.json({
    id: spreadsheetId,
    title: spec.title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    rowCount: spec.rows.length,
    colCount: spec.headers.length,
  });
}
