import { auth } from "@/auth";
import { getGitHubToken, isConnectorError } from "@/lib/google-apis";
import { connectorLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({
  repoName: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/),
  private: z.boolean().optional().default(true),
  files: z.record(z.string().max(240), z.string().max(500_000)),
  commitMessage: z.string().trim().min(1).max(200).default("Add Surya Code build"),
  branch: z.string().trim().min(1).max(80).optional(),
});

async function gh(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { res, data };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });

  const body = await parseJson(req, schema);
  if (isResponse(body)) return body;

  try {
    const token = await getGitHubToken(session.user.id);
    const user = await gh("/user", token);
    if (!user.res.ok) return Response.json({ error: user.data.message ?? "GitHub user failed" }, { status: user.res.status });
    const owner = user.data.login as string;

    let repo = await gh(`/repos/${owner}/${body.repoName}`, token);
    if (repo.res.status === 404) {
      repo = await gh("/user/repos", token, {
        method: "POST",
        body: JSON.stringify({ name: body.repoName, private: body.private, auto_init: true }),
      });
    }
    if (!repo.res.ok) return Response.json({ error: repo.data.message ?? "Repo create failed" }, { status: repo.res.status });

    const defaultBranch = body.branch ?? repo.data.default_branch ?? "main";
    const ref = await gh(`/repos/${owner}/${body.repoName}/git/ref/heads/${defaultBranch}`, token);
    const baseSha = ref.data.object?.sha;
    if (!ref.res.ok || !baseSha) return Response.json({ error: ref.data.message ?? "Branch ref missing" }, { status: ref.res.status });

    const baseCommit = await gh(`/repos/${owner}/${body.repoName}/git/commits/${baseSha}`, token);
    const baseTree = baseCommit.data.tree?.sha;
    const treeItems = await Promise.all(
      Object.entries(body.files).map(async ([path, content]) => {
        const blob = await gh(`/repos/${owner}/${body.repoName}/git/blobs`, token, {
          method: "POST",
          body: JSON.stringify({ content, encoding: "utf-8" }),
        });
        if (!blob.res.ok) throw new Error(blob.data.message ?? `Blob failed: ${path}`);
        return { path, mode: "100644", type: "blob", sha: blob.data.sha };
      })
    );

    const tree = await gh(`/repos/${owner}/${body.repoName}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTree, tree: treeItems }),
    });
    if (!tree.res.ok) return Response.json({ error: tree.data.message ?? "Tree failed" }, { status: tree.res.status });

    const commit = await gh(`/repos/${owner}/${body.repoName}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({ message: body.commitMessage, tree: tree.data.sha, parents: [baseSha] }),
    });
    if (!commit.res.ok) return Response.json({ error: commit.data.message ?? "Commit failed" }, { status: commit.res.status });

    const update = await gh(`/repos/${owner}/${body.repoName}/git/refs/heads/${defaultBranch}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.data.sha, force: false }),
    });
    if (!update.res.ok) return Response.json({ error: update.data.message ?? "Ref update failed" }, { status: update.res.status });

    return Response.json({
      htmlUrl: repo.data.html_url,
      defaultBranch,
      commitUrl: commit.data.html_url,
    });
  } catch (err) {
    if (isConnectorError(err)) return Response.json({ error: err.message, code: err.code }, { status: 400 });
    return Response.json({ error: err instanceof Error ? err.message : "GitHub push failed" }, { status: 500 });
  }
}
