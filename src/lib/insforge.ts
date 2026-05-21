/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * InsForge SDK — The sole data layer for Surya AI.
 * Uses @insforge/sdk (Supabase/PostgREST-compatible BaaS).
 * All database operations go through this file.
 *
 * Exports:
 *   createInsforgeAuthClient — auth-only client using anon key, never admin/service key
 *   insforgeDb  — raw PostgREST client (used by auth.ts, already uses snake_case)
 *   db          — MongoDB-style wrappers with camelCase↔snake_case conversion
 */

import { createClient } from "@insforge/sdk";

// --- Environment Validation ---
// Note: do NOT throw at module load — `next build` and OpenNext page-data
// collection import this file before runtime env is wired. Validation is
// deferred to first DB call where missing values surface as fetch errors
// with a useful message.
const requiredEnv = [
  "INSFORGE_BASE_URL",
  "INSFORGE_API_KEY",
  "INSFORGE_ANON_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV === "production") {
  // Warn only — do not throw, otherwise build-time static analysis crashes.
  console.warn(
    `[insforge] Missing env vars at module load: ${missing.join(", ")}. ` +
      "Requests will fail until these are set at runtime."
  );
}

const INSFORGE_BASE_URL = process.env.INSFORGE_BASE_URL ?? "";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY ?? "";
const INSFORGE_ANON_KEY = process.env.INSFORGE_ANON_KEY ?? "";

// Auth client factory — uses anon key only. Keep admin/service key away from
// login flows. Create per request because the SDK stores session tokens.
export function createInsforgeAuthClient() {
  return createClient({
    baseUrl: INSFORGE_BASE_URL,
    anonKey: INSFORGE_ANON_KEY,
    isServerMode: true,
    timeout: 120_000,
  });
}

// Server-side client — uses admin API key for Authorization (bypasses RLS)
// timeout 120s: Opus/Sonnet/Gemini regularly need >30s for council memos.
export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
  isServerMode: true,
  timeout: 120_000,
});

// Set the API key as the auth token so the SDK sends
// "Authorization: Bearer ik_..." instead of the anon JWT.
// The InsForge backend grants admin/service-role access to ik_ keys,
// which bypasses Row Level Security on database operations.
type AuthHttpClient = {
  setAuthToken: (token: string) => void;
};

(insforge.getHttpClient() as AuthHttpClient).setAuthToken(INSFORGE_API_KEY);

// Raw PostgREST client — used by auth.ts for direct .from() queries (snake_case)
export const insforgeDb = insforge.database;

// ---------------------------------------------------------------------------
// Case conversion helpers
// ---------------------------------------------------------------------------

/** camelCase → snake_case */
function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** snake_case → camelCase */
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Recursively convert object keys to snake_case */
function snakeKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toSnake(k)] = v;
  }
  return out;
}

/** Recursively convert object keys to camelCase */
function camelKeys(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toCamel(k)] = Array.isArray(v)
      ? v.map((item) => (item && typeof item === "object" ? camelKeys(item) : item))
      : v && typeof v === "object"
      ? camelKeys(v)
      : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// MongoDB-style wrapper — used by all API routes
// ---------------------------------------------------------------------------

type Operation = "find" | "findOne" | "insertOne" | "updateOne" | "deleteOne";

async function dbQuery(
  table: string,
  op: Operation,
  payload: Record<string, any>
): Promise<any> {
  const client = insforge.database;

  switch (op) {
    case "find": {
      const { filter = {}, sort, limit } = payload;
      let query = client.from(table).select("*");
      const snakeFilter = snakeKeys(filter);
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
      if (sort) {
        const snakeSort = snakeKeys(sort as Record<string, any>);
        for (const [key, dir] of Object.entries(snakeSort)) {
          // MongoDB convention: 1 = asc, -1 = desc
          query = query.order(key, { ascending: (dir as number) >= 0 });
        }
      }
      if (limit) query = query.limit(limit as number);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { documents: (data ?? []).map(camelKeys) };
    }

    case "findOne": {
      const { filter = {} } = payload;
      let query = client.from(table).select("*");
      const snakeFilter = snakeKeys(filter);
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return { document: data ? camelKeys(data) : null };
    }

    case "insertOne": {
      const { document } = payload;
      const snakeDoc = snakeKeys(document);
      const { data, error } = await client.from(table).insert(snakeDoc).select();
      if (error) {
        console.error(`[InsForge insertOne ${table}] ERROR:`, error.code, error.message);
        const err = new Error(error.message || "Insert failed") as Error & { code?: string; table?: string };
        err.code = error.code;
        err.table = table;
        throw err;
      }
      if (!data || data.length === 0) {
        console.error(`[InsForge insertOne ${table}] empty result — insert silently dropped`);
        throw new Error(`Insert into ${table} returned no rows (possibly RLS or schema issue)`);
      }
      return { document: camelKeys(data[0]) };
    }

    case "updateOne": {
      const { filter = {}, update } = payload;
      // Support both { $set: {...} } and plain object
      const updateData: Record<string, any> = update?.$set ?? update ?? {};
      const snakeFilter = snakeKeys(filter);
      const snakeUpdate = snakeKeys(updateData);
      let query = client.from(table).update(snakeUpdate);
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query.select().maybeSingle();
      if (error && error.code && error.message) {
        if (error.code === "42501") {
          console.warn(`[InsForge updateOne ${table}] soft-fail (${error.code}):`, error.message);
          return { document: camelKeys(snakeUpdate) };
        }
        console.error(`[InsForge updateOne ${table}]`, error.code, error.message);
        throw new Error(error.message);
      }
      return { document: data ? camelKeys(data) : camelKeys(snakeUpdate) };
    }

    case "deleteOne": {
      const { filter = {} } = payload;
      const snakeFilter = snakeKeys(filter);
      let query = client.from(table).delete();
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
      const { error } = await query;
      if (error) throw new Error(error.message);
      return { deleted: true };
    }

    default:
      throw new Error(`Unknown InsForge operation: ${op}`);
  }
}

const makeCollection =
  (table: string) =>
  (op: Operation, payload: Record<string, any>) =>
    dbQuery(table, op, payload);

export const db = {
  users:           makeCollection("users"),
  conversations:   makeCollection("conversations"),
  messages:        makeCollection("messages"),
  projects:        makeCollection("projects"),
  knowledgeFiles:  makeCollection("knowledge_files"),
  artifacts:       makeCollection("artifacts"),
  memory:          makeCollection("memory_entries"),
  skills:          makeCollection("skills"),
  scheduledTasks:  makeCollection("scheduled_tasks"),
  n8nConnections:  makeCollection("n8n_connections"),
  connectorTokens: makeCollection("connector_tokens"),
  usageLogs:       makeCollection("usage_logs"),
  appBuilderProjects: makeCollection("app_builder_projects"),
  appBuilderMessages: makeCollection("app_builder_messages"),
  mediaAssets:     makeCollection("media_assets"),
};
