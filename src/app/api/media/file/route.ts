
import { auth } from "@/auth";
import { getAsset } from "@/lib/media/assets";

const MIME_BY_TYPE: Record<string, string> = {
  video: "video/mp4",
  avatar: "video/mp4",
  film: "video/mp4",
  audio: "audio/mpeg",
  image: "image/jpeg",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const asset = await getAsset(id, session.user.id);
  if (!asset?.storageUrl) return new Response("Not found", { status: 404 });

  const upstream = await fetch(asset.storageUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }

  const range = req.headers.get("range");
  const headers = new Headers();
  headers.set("Content-Type", MIME_BY_TYPE[asset.assetType] ?? "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Accept-Ranges", "bytes");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  if (range) {
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}