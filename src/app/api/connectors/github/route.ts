import { auth } from "@/auth";
import { getGitHubToken, isConnectorError } from "@/lib/google-apis";
import axios from "axios";
import { connectorLimiter } from "@/lib/rate-limit";

const GITHUB_API = "https://api.github.com";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting — 20 connector requests per minute per user
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
    const token = await getGitHubToken(userId);
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (action === "list_repos") {
      const { maxResults = 10 } = body;
      const res = await axios.get(`${GITHUB_API}/user/repos`, {
        headers,
        params: { per_page: Math.min(maxResults, 30), sort: "updated" },
      });

      const repos = res.data.map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        language: r.language,
        stargazersCount: r.stargazers_count,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url,
      }));

      return Response.json({ repos });
    }

    if (action === "list_issues") {
      const { owner, repo, state = "open" } = body;
      const res = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
        headers,
        params: { state, per_page: 20 },
      });

      const issues = res.data
        .filter((i: Record<string, unknown>) => !i.pull_request)
        .map((i: Record<string, unknown>) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          body: (i.body as string | null)?.slice(0, 500),
          createdAt: i.created_at,
          htmlUrl: i.html_url,
          labels: (i.labels as Array<{ name: string }>).map((l) => l.name),
        }));

      return Response.json({ issues });
    }

    if (action === "create_issue") {
      const { owner, repo, title, body: issueBody, labels = [] } = body;
      const res = await axios.post(
        `${GITHUB_API}/repos/${owner}/${repo}/issues`,
        { title, body: issueBody, labels },
        { headers }
      );

      return Response.json({
        success: true,
        issueNumber: res.data.number,
        htmlUrl: res.data.html_url,
        message: `Issue #${res.data.number} created in ${owner}/${repo}`,
      });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    if (isConnectorError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (axios.isAxiosError(err)) {
      return Response.json(
        { error: err.response?.data?.message ?? err.message },
        { status: err.response?.status ?? 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
