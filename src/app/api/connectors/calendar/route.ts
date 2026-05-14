
/**
 * calendar connector — stubbed for edge-runtime build.
 *
 * The original implementation used the `googleapis` SDK which is
 * Node-only and cannot run on Cloudflare Pages' edge runtime. This
 * route returns 503 until the implementation is rewritten with direct
 * REST calls to googleapis.com.
 */
export async function POST() {
  return Response.json(
    {
      error:
        "calendar connector is temporarily unavailable in this deployment.",
      code: "NOT_AVAILABLE",
    },
    { status: 503 }
  );
}
