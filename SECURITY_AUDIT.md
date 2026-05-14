# Surya AI Security Audit

Last updated: 2026-05-10

## Executive Summary

Surya AI is a user-authenticated AI application with chat, projects, media generation, app previews, Google/GitHub connectors, and InsForge-backed persistence. The highest risks found in this pass were credential exposure in local repo-adjacent files, dependency advisories, weak request validation, automatic execution of mutating AI tools, and insufficient CI guardrails.

No secret values are recorded in this report.

## Findings

| ID | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| SAI-001 | Critical | Secrets | A local AWS helper script contained real-looking runtime credentials for OAuth, InsForge, media providers, and token encryption. | Remediated in code by replacing the script with env-driven input. Rotate all exposed values out-of-band before production deploy. |
| SAI-002 | High | Dependencies | `next`, `axios`, and unused `xlsx` created high-risk audit findings. | Remediated by updating `next`/`axios` and removing unused `xlsx`. |
| SAI-003 | High | Rate limiting | DB limiter used a head-count query but read `data.length`, allowing undercounting. | Remediated by using the returned `count` and failing closed for AI routes. |
| SAI-004 | High | AI tools | Mutating tools could be exposed to model-driven execution. | Remediated by filtering automatic tools to read/search only and returning `CONFIRMATION_REQUIRED` for write tools. |
| SAI-005 | Medium | API validation | Several API routes accepted unvalidated JSON or query params. | Partially remediated with Zod validation on chat, research, projects, memory, search, app-builder, GitHub, image generation, and media upload routes. Continue extending to all remaining routes. |
| SAI-006 | Medium | Auth/IDOR | InsForge server client uses an admin key, making route-level ownership checks mandatory. | Existing ownership checks were preserved; central auth helpers were added for reuse. Continue moving routes to shared helpers. |
| SAI-007 | Medium | Browser security | No app-level CSP was present; deployed headers did not show CSP. | Remediated with CSP and same-origin API checks in `src/proxy.ts`. |
| SAI-008 | Medium | App previews | App-builder preview accepted wildcard `postMessage` responses and one preview iframe used `allow-same-origin`. | Remediated by validating message source and removing `allow-same-origin` from the WebContainer preview iframe. |
| SAI-009 | Medium | CI | Generated directories were linted, and no secret scan was enforced. | Remediated with ESLint global ignores and a Security CI workflow with Gitleaks, audit, lint, and build. |
| SAI-010 | Operational | Deployment | Canonical deployment values mixed apex and `www` domains; one env name used `Large_MODEL`. | Remediated in tracked AWS/Cloudflare/GitHub workflow config. |

## Residual Risk

- Runtime secret rotation is not complete until values are revoked and regenerated in Vercel, Google Cloud, GitHub OAuth, InsForge, AWS Secrets Manager, and all provider dashboards.
- Rotating `TOKEN_ENCRYPTION_KEY` will make existing encrypted connector tokens unreadable unless a migration is performed. The safest immediate production action is to clear connector tokens and ask users to reconnect.
- `npm audit --omit=dev` still reports moderate advisories tied to Next's bundled PostCSS metadata. Do not downgrade Next to satisfy that audit suggestion; monitor for the next patched Next release.
- Google Workspace routes are partly stubbed or REST-backed depending on deployment constraints. Avoid enabling write scopes or write actions until explicit user-confirmation UI exists.

## Required Before Production Redeploy

1. Rotate every exposed credential and update deployment environments.
2. Clear or migrate stored connector tokens after `TOKEN_ENCRYPTION_KEY` rotation.
3. Run `npm audit --omit=dev --audit-level=high`.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Verify authenticated API routes return 401 without a session and cannot access another user's IDs.
7. Verify deployed response headers include CSP, HSTS, `X-Content-Type-Options`, and no wildcard CORS on authenticated API responses.
