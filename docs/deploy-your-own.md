# Deploy your own

Blocks runs on your own Cloudflare account: one Worker, one D1 database, and a Cloudflare Access application in front of it. The full commands are in [`Blocks-Cloudflare/CLOUDFLARE_DEPLOY.md`](../Blocks-Cloudflare/CLOUDFLARE_DEPLOY.md).

## What you need

- A Cloudflare account with Workers and D1 available.
- Cloudflare Zero Trust, for Access.
- Node.js `>=22.13.0`.

## Components

| Component | Default name | Where it is configured |
| --- | --- | --- |
| Worker | `blocks-time-tracker` | `name` in `wrangler.cloudflare.jsonc` |
| D1 database | `blocks-time-tracker-db` | `d1_databases` in `wrangler.cloudflare.jsonc` |
| D1 binding | `DB` | `wrangler.cloudflare.jsonc` and `.openai/hosting.json` |
| Login | Cloudflare Access self-hosted app | Cloudflare Zero Trust dashboard |

`wrangler.cloudflare.jsonc` is ignored by Git. Create it from `wrangler.example.jsonc` and put your own account ID and D1 database ID in it. These IDs are not secrets, but they tie a checkout to one account, so they stay out of the repository.

## Steps in brief

1. Install dependencies and log in to Wrangler.
2. Copy `wrangler.example.jsonc` to `wrangler.cloudflare.jsonc` and fill in your account ID.
3. Create the D1 database and paste its ID into the config.
4. Build, then apply every SQL file in `Blocks-Cloudflare/drizzle/` in filename order, once.
5. Deploy with `npx wrangler deploy --config wrangler.cloudflare.jsonc`.
6. Put Cloudflare Access in front of the hostname and allow only the users who should have access.

## Access requirement

Blocks has no password system. It reads the verified email from the `cf-access-authenticated-user-email` header that Access adds and uses it as the data owner. A request that reaches the Worker without passing through Access can set that header itself and claim any identity. Before you store real data:

- Protect your custom domain with an Access application.
- Disable the default Worker subdomain route and preview URLs in the Worker settings, or add them to the same Access application.
- Add end users to the Access policy; they do not need to be Cloudflare account members.

## Updating

Run `npm run build` and `npx wrangler deploy --config wrangler.cloudflare.jsonc`. Only apply a new migration when an update adds one, and apply each migration once per database.

## Data and backups

All data lives in your D1 database. The app's JSON backup download contains projects, tasks, entries and daily to-dos. Keep backups and exports outside the repository; the root `.gitignore` already excludes `backups/`, `exports/` and local database files.
