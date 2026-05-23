export const runtime = "edge";

export async function GET() {
  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      groq: Boolean(process.env.GROQ_API_KEY),
      google_client_id: Boolean(process.env.GOOGLE_CLIENT_ID),
      google_client_secret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      nextauth_secret: Boolean(process.env.NEXTAUTH_SECRET),
      nextauth_url: process.env.NEXTAUTH_URL ?? null,
      brave_search: Boolean(process.env.BRAVE_SEARCH_API_KEY),
      insforge: Boolean(process.env.INSFORGE_API_KEY ?? process.env.INSFORGE_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  });
}
