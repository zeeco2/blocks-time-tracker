# Architecture

## Runtime

- React 19 interface using Next-compatible [vinext](https://github.com/cloudflare/vinext).
- TypeScript application deployed as a Cloudflare Worker.
- Static client assets are served from `dist/client`.
- The server entry is generated at `dist/server/index.js`.
- Cloudflare D1 provides persistent SQLite-compatible storage.
- Drizzle ORM defines and queries the schema.
- ExcelJS generates `.xlsx` files in the browser.

## Code map

All paths are under `Blocks-Cloudflare/`.

| Path | Role |
| --- | --- |
| `app/page.tsx` | Server entry page: resolves the visitor, then renders the tracker |
| `app/time-tracker.tsx` | The client application: calendar, editor, dashboard, to-dos, export |
| `app/time-metrics.ts` | Weekly/monthly targets, schedule variance and chart data |
| `app/api/data/route.ts` | The single owner-scoped JSON API for reads and mutations |
| `app/chatgpt-auth.ts` | Identity adapter that turns request headers into an owner |
| `db/schema.ts`, `db/index.ts` | Drizzle schema and the D1 binding accessor |
| `drizzle/` | SQL migrations and Drizzle metadata |
| `components/ui/` | UI primitives |
| `build/`, `scripts/` | Vite plugins, local Worker shim, install and run helpers |
| `tests/` | Vitest unit tests |

## Request flow

`app/page.tsx` obtains the authenticated visitor, then renders `app/time-tracker.tsx`. The client reads and writes data through `app/api/data/route.ts`. The route obtains the current owner identity and applies `owner_id` filters to every query.

Project edits update existing owner-scoped records. Entry saves resolve free-text task names to owner-scoped task records automatically; changing the task text on an entry never renames a shared task record. Legacy task create/update API actions remain available for compatibility. Direct block resizing is persisted through an owner-scoped action that may also adjust the immediately adjacent entry on the same date to resolve an overlap. Daily to-do mutations use the same owner-scoped API; dashboard statistics are derived in the client from the owner's existing time entries. Header quick links are browser-local preferences and do not touch D1.

## Authentication

Cloudflare Access is the production login gate. `app/chatgpt-auth.ts` accepts `cf-access-authenticated-user-email`, normalizes it to lowercase, and derives the owner key as `cloudflare:<email>`. This gives each authenticated email a separate data set in the shared D1 database.

The adapter also supports host-provided `oai-authenticated-user-*` identity headers. In development, requests with no identity use a local preview owner.

The app trusts these headers as set by the platform in front of it; it does not verify the Access JWT itself. A deployment must therefore keep Cloudflare Access in front of every route that reaches the Worker (see [Deploy your own](deploy-your-own.md)). The app has no password system of its own, and Access policies are managed in Cloudflare, outside the app.

## Important boundaries

- Authentication establishes the owner ID before any data access.
- The API validates project and task ownership before saving an entry.
- Project deletion batches the owner-scoped entry and project deletes atomically, so a failed project delete rolls back its entry deletes. The UI requires confirmation and clears any editor for a deleted entry.
- Client state is not an authorization boundary.
- Cloudflare bindings are accessed through the Worker environment.

## Design decisions

- Manual block entry is the primary workflow; a running timer is not required.
- Tasks are free text after choosing a project. Task records are kept and reused by exact name per owner, so changing an entry's task text never renames tasks used by earlier blocks.
- R&D is a per-entry flag and is carried into exports.
- Day and week blocks support direct edge resizing. Collision resolution shortens the immediately adjacent block instead of permitting an overlap; both blocks keep at least five minutes.
- Daily to-dos follow the selected work date and sit beside the time insights instead of becoming a separate project-management system.
- Dashboard charts are derived from time entries in the client, so the API stays a simple owner-scoped data endpoint.
- Excel is generated client-side. Workbook order is Summary, Timesheet, Detailed Entries; the Timesheet keeps one row per task while showing each project name once, and Detailed Entries is the audit trail of individual blocks.
- Data for multiple users shares one D1 database, partitioned by `owner_id`.
- The app deploys as a Worker, not a static Pages upload, because it needs persistent storage and server-side user isolation.

## Known limitations

- Local `npm run dev` can fail on some Windows setups with a Miniflare runtime crash (`ERR_RUNTIME_FAILURE` / `std::terminate`). Production builds and deployments are unaffected.
- Project colors are presentation data. Stored duplicates are normalized in API responses where possible, but the database does not enforce color uniqueness.
- Free-text task names are limited to 80 characters. Identical names are reused across an owner's projects.
- Excel output is generated in the browser. Large data sets may warrant server-side export or lazy-loading ExcelJS.
- There is no in-app import/restore flow for JSON backups.
