# Blocks application

This folder holds the Blocks app: a React 19 interface on [vinext](https://github.com/cloudflare/vinext) that runs as a Cloudflare Worker with a D1 database. Run every npm command from here.

See the [repository README](../README.md) for what Blocks does and the [docs](../docs/) for architecture, data model and features.

## Prerequisites

- Node.js `>=22.13.0`
- Windows, macOS or Linux

## Scripts

| Command | What it does |
| --- | --- |
| `npm run install:ci` | One locked dependency install from `package-lock.json` |
| `npm run dev` | Development server with hot reload (port 5173 by default) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests in `tests/` |
| `npm run build` | Production build into `dist/` |
| `npm start` | Run the built Worker locally through Wrangler on `127.0.0.1` |
| `npm run db:generate` | Generate a Drizzle migration after a schema change |

## Local database

Local development uses a local D1 database under `.wrangler/state`. It starts empty and is never connected to a deployed database.

1. Build once with `npm run build`. This writes `dist/server/wrangler.json` with the local bindings.
2. Apply each migration in `drizzle/` once, in filename order:

   ```sh
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dry_roughhouse.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_clumsy_silverclaw.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_nappy_siren.sql
   ```

3. Start `npm run dev` or `npm start`.

In development, requests without an identity header use a single `local-preview` owner, so no login is needed locally. Production builds reject requests that carry no authenticated identity.

## Configuration files

- `.openai/hosting.json` declares the D1 binding name (`DB`) used for local bindings. It is read by `vite.config.ts`.
- `wrangler.example.jsonc` is the deployment template. Copy it to `wrangler.cloudflare.jsonc` (ignored by Git) and add your own IDs. See [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md).
- `drizzle.config.ts` and `db/schema.ts` define the schema and migration output.

## Licenses of bundled code

- `build/sites-vite-plugin.LICENSE` covers the build plugin sources in `build/`.
- `vendor/shadcn-tailwind-4.13.0.LICENSE.md` covers the vendored shadcn Tailwind styles.
