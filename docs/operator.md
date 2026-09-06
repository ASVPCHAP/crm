# Rockwall Partners — production operator guide

This fork deploys Comp AI CRM for Anthony Chapman (GitHub: ASVPCHAP).
The Vercel team in Cursor is **Verolyn** (`verolyn1`, Hobby).
The Git repository is `https://github.com/ASVPCHAP/crm` on branch `release`.

Comp AI is three Vercel projects plus one Postgres.
All three projects share `DATABASE_URL` and `BETTER_AUTH_SECRET`.

| Project | Root | Framework | Build command |
| --- | --- | --- | --- |
| `crm-app` | `apps/app` | Next.js | Vercel default (`next build`) |
| `crm-api` | repository root (empty) | Other | `bun apps/api/scripts/build-func.mjs` |
| `crm-agent` | `apps/agent` | Other | `bun run build` (`eve build`) |

Install command for every project: leave empty so Vercel runs `bun install`.
The repo declares `packageManager: bun@1.3.12` and `engines.node: >=22`.
Do not regenerate `apps/api/src/generated/server.ts` on Vercel.

## Blocker: connect GitHub to Vercel

A create-project call on 2026-09-03 failed with:

> To link a GitHub repository, you need to install the GitHub integration first.

Complete these clicks, then a later agent run can create the three projects.

1. Open [https://github.com/apps/vercel](https://github.com/apps/vercel).
2. Click **Install** or **Configure**.
3. Choose the **ASVPCHAP** account.
4. Grant access to **crm** (or all repositories).
5. Click **Install** / **Save**.
6. Open [https://vercel.com/verolyn1](https://vercel.com/verolyn1).
7. Open **Settings → Git**.
8. Confirm GitHub is connected as ASVPCHAP.
9. If the team shows no GitHub connection, click **Connect GitHub** and approve access to `ASVPCHAP/crm`.

Do not import the upstream `trycompai/crm` repository.
Import this fork only.

## Create the three projects

After GitHub is connected, create three projects from `ASVPCHAP/crm`, production branch `release`.

### crm-app

1. New Project → Import `ASVPCHAP/crm`.
2. Project name: `crm-app`.
3. Root Directory: `apps/app`.
4. Framework Preset: Next.js.
5. Create Project. The first deploy can fail until env vars exist. That is expected.

### crm-api

1. New Project → Import `ASVPCHAP/crm` again.
2. Project name: `crm-api`.
3. Root Directory: leave empty (repository root).
4. Framework Preset: Other.
5. Build Command: `bun apps/api/scripts/build-func.mjs`.
6. Output Directory: leave empty. The script writes `.vercel/output`.
7. Create Project.

### crm-agent

1. New Project → Import `ASVPCHAP/crm` again.
2. Project name: `crm-agent`.
3. Root Directory: `apps/agent`.
4. Framework Preset: Other.
5. Build Command: `bun run build`.
6. Create Project.

Record the three production origins. They look like:

- App: `https://crm-app.vercel.app`
- API: `https://crm-api.vercel.app`
- Agent: `https://crm-agent.vercel.app`

Replace those hostnames with the real ones Vercel prints.

## Provision Neon Postgres

1. Open [https://vercel.com/verolyn1/~/stores](https://vercel.com/dashboard/verolyn1/stores).
2. Click **Create Database → Neon Postgres**.
3. Accept Neon terms if the page asks.
4. Name the store `crm`.
5. Region: `Washington, D.C., USA (iad1)` to match the API function.
6. Connect the store to **crm-app**, **crm-api**, and **crm-agent**.
7. Environments: Production, Preview, and Development.
8. Confirm each project has `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` (or `DATABASE_URL_UNPOOLED`).

The API production build runs `prisma migrate deploy` when `VERCEL_ENV=production`.
Do not run `db push` against this database from a laptop.

## Optional: Blob and Redis

Vercel Blob stores profile photos. Without it, contacts show initials.

1. Open the crm-api project → **Storage → Blob → Create**.
2. Connect the same store to crm-api and crm-agent.
3. Confirm `BLOB_READ_WRITE_TOKEN` is set on those two projects.

Upstash Redis is optional. Skip it for a first install.
Without `REDIS_URL` the API caches in memory on each instance.

## Shared secrets

Generate three values. Do not commit them.

```sh
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # AGENT_BRIDGE_SECRET
openssl rand -base64 32   # CRON_SECRET
```

Paste the **same** `BETTER_AUTH_SECRET` on all three projects.
A mismatch sends the browser around `/sign-in` forever.

## Environment variables

Set these on **Production, Preview, and Development** unless noted.

### All three projects

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | From Neon (already injected if you connected the store) |
| `BETTER_AUTH_SECRET` | The first generated secret |
| `ALLOWED_SIGN_IN` | `rockwallpartners.com,asvpchap@gmail.com` |

### crm-app and crm-api

| Variable | Value |
| --- | --- |
| `API_URL` | `https://<crm-api-origin>` (no trailing slash) |
| `APP_URL` | `https://<crm-app-origin>` (no trailing slash) |

### crm-app and crm-agent

| Variable | Value |
| --- | --- |
| `AGENT_BRIDGE_SECRET` | The second generated secret |
| `AGENT_URL` | `https://<crm-agent-origin>` (scheme required) |

### crm-api only

| Variable | Value |
| --- | --- |
| `DIRECT_DATABASE_URL` or `POSTGRES_URL_NON_POOLING` | Neon unpooled URL (injected by Neon) |
| `CRON_SECRET` | The third generated secret |
| `AGENT_URL` | `https://<crm-agent-origin>` |
| `AGENT_BRIDGE_SECRET` | The same second secret |

### Do not set yet

| Variable | Why |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Anthony creates the Google OAuth client first |
| `AUTH_COOKIE_DOMAIN` | Do not set this on `*.vercel.app`. Browsers reject `.vercel.app` |
| `AI_GATEWAY_API_KEY` | Vercel OIDC supplies the model. No key. |
| `CONTEXT_DEV_API_KEY` | Not an env var. Set it in the app after sign-in. |
| `MICROSOFT_*` | Skip unless you add Entra later. |

Redeploy all three projects after the env vars are saved.

## Custom domains (required for sign-in)

`crm-app.vercel.app` and `crm-api.vercel.app` do not share a cookie domain.
The API writes the session cookie. The app reads it.
Without one parent domain, sign-in finishes and the app still sends you to `/sign-in`.

Add two hostnames on one parent you control, for example:

- `crm.rockwallpartners.com` → crm-app
- `api.crm.rockwallpartners.com` → crm-api

Then set `AUTH_COOKIE_DOMAIN=.rockwallpartners.com` on crm-app and crm-api.
Set `API_URL` and `APP_URL` to those https origins.
Redeploy both projects.

The agent can stay on `*.vercel.app`. `AGENT_URL` is server-side only.

## Google OAuth checklist

You cannot create this client from the deploy agent.
Do this in [Google Cloud Console](https://console.cloud.google.com/).

1. Create or pick a Google Cloud project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. Enable **Google Calendar API**.
4. **APIs & Services → OAuth consent screen**.
5. User type: **Internal** if this is a Workspace project. External needs verification for `gmail.readonly`.
6. App name: Rockwall Partners CRM. Support email: `anthony@rockwallpartners.com`.
7. Scopes will include Gmail readonly and Calendar. The app requests them at sign-in.
8. Test users (External only): `asvpchap@gmail.com` and `anthony@rockwallpartners.com`.
9. **Credentials → Create credentials → OAuth client ID → Web application**.
10. Authorised JavaScript origins:
    - `https://<crm-api-origin>`
    - `https://<crm-app-origin>`
11. Authorised redirect URIs (API origin only):
    - `https://<crm-api-origin>/api/auth/callback/google`
12. Copy Client ID and Client Secret.
13. In Vercel, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on **crm-app** and **crm-api**. Set both or neither.
14. Redeploy crm-app and crm-api.

The browser starts sign-in on the app origin. Better Auth builds the Google redirect from `API_URL`.
A redirect URI on the app origin fails with "redirect_uri did not match".

## After the first production API deploy

The crm-api production build applies Prisma migrations.
Open the deploy log and confirm:

- `applying migrations (prisma migrate deploy)`
- `schema matches`

Then:

1. Open the app origin. You should see sign-in.
2. Sign in with `anthony@rockwallpartners.com` or `asvpchap@gmail.com`.
3. Complete onboarding.
4. Open **Settings → General**.
5. Paste the Context API key (LinkedIn + company brand). This is not an env var.
6. Saving the key starts the company sweep.

Rockwall Partners copy, if the workspace profile asks: they help small businesses save time and make more money.

## AGENT_BRIDGE_SECRET

Set the **same** value on crm-app, crm-api, and crm-agent.

| Symptom | Cause |
| --- | --- |
| Agent tab `503` | Secret missing on the app |
| Agent tab `401` | The three projects hold different secrets |
| Agent tab `502` | `AGENT_URL` is wrong or the agent is down |

The browser never calls the agent. The app proxies `/eve/v1/*` and signs a short token.

## Mailbox cron

`apps/api/vercel.json` and the API build output register:

| Path | Schedule |
| --- | --- |
| `POST /internal/sync/mailboxes` | `*/5 * * * *` |
| `POST /internal/sync/rates` | `0 6 * * *` |
| `POST /internal/telemetry/rollup` | `0 7 * * *` |
| `POST /internal/tracking/retention` | `0 4 * * *` |
| `POST /internal/archive/prune` | `0 5 * * *` |

Vercel sends `Authorization: Bearer <CRON_SECRET>`.
The route fails closed when `CRON_SECRET` is unset.

Hobby plans turn minute-level crons into daily crons.
For a five-minute mailbox sync, move crm-api to Pro.

Manual run:

```sh
curl -X POST "https://<crm-api-origin>/internal/sync/mailboxes" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

`/internal/sync/google` is an alias of the same route.

## Hobby plan notes

The Verolyn team is on Hobby.

- Five-minute crons become daily.
- Vercel Sandbox and some eve features can require Pro.
- Custom domains work on Hobby.

## What this agent already did

- Confirmed the fork, `release` branch, and Vercel team `verolyn1`.
- Failed to create Git-linked projects: GitHub App is not installed.
- Generated secrets in the private deploy message. They are not in this file.
- Synced API Build Output crons with `apps/api/vercel.json`.
