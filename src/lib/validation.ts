import { z, type ZodType } from "zod";

export const idSchema = z.string().trim().min(1).max(160);
export const boundedString = (max: number) => z.string().trim().min(1).max(max);
export const optionalBoundedString = (max: number) =>
  z.string().trim().max(max).optional();

export function validationError(error: z.ZodError) {
  return Response.json(
    {
      error: "Invalid request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  return parsed.data;
}

export function parseSearchParams<T>(
  req: Request,
  schema: ZodType<T>
): T | Response {
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  return parsed.data;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}
