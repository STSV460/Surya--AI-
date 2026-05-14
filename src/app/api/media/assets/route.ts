
import { auth } from "@/auth";
import { listAssets, getAsset, deleteAsset } from "@/lib/media/assets";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const asset = await getAsset(id, session.user.id);
    if (!asset) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ asset });
  }

  const assets = await listAssets(session.user.id);
  return Response.json({ assets });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await deleteAsset(id, session.user.id);
  return Response.json({ deleted: true });
}