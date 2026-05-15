# Supabase cron_jobs Report

**Generated:** 2026-05-15
**Source:** Surya AI dashboard task

## Status

Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) not present in local `.env.local` / `.env.production`. Direct query against `cron.job` / `cron_jobs` table skipped.

To populate this report, run from server with service role key:

```sql
select jobname as name, schedule, last_run_at, run_count
from cron.job_run_details_view  -- or cron.job joined with cron.job_run_details
order by last_run_at desc nulls last;
```

## Known Crons (from repo `git log`)

Recent commit history shows active cron: `heartbeat-30m`.

| name           | schedule        | last_run_at | run_count |
|----------------|-----------------|-------------|-----------|
| heartbeat-30m  | */30 * * * *    | unknown     | unknown   |

> Fill `last_run_at` and `run_count` once Supabase service key is exported in the runtime env.
