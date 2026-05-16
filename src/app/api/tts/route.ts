import { auth } from "@/auth";

export const runtime = "edge";
export const maxDuration = 60;

const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
const DEFAULT_VOICE = "Fritz-PlayAI";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "TTS unavailable — GROQ_API_KEY not set in environment." },
      { status: 503 }
    );
  }

  let body: { text?: string; voice?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return new Response("`text` is required", { status: 400 });
  }

  // Groq playai-tts max input ~10k chars per request
  const input = text.slice(0, 10000);
  const voice = body.voice?.trim() || DEFAULT_VOICE;

  const groq = await fetch(GROQ_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "playai-tts",
      voice,
      input,
      response_format: "wav",
    }),
  });

  if (!groq.ok) {
    const errText = await groq.text();
    return Response.json(
      { error: "groq_tts_failed", detail: errText.slice(0, 500) },
      { status: groq.status }
    );
  }

  return new Response(groq.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
