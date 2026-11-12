# Blocks time tracker

Blocks is a small, self-hosted time tracker that records work as blocks on a calendar and exports monthly timesheets to Excel.

## Background

Blocks replaces retrospective time entry in Toggl and simplifies monthly timesheet creation. You record work after a few hours rather than running a timer: choose a project, type what you did, and drag or resize a block on the calendar. At the end of the month, one export produces the Excel timesheet.

Every block can carry an R&D flag, and the export reports R&D hours and the R&D share of the month. The dashboard measures the week against 40 hours and the month against eight hours per weekday, and compares recorded time with the working time elapsed so far (09:00–17:00 on weekdays).

## Features

- Calendar: day, week and month views. Week block height matches duration, and double-clicking a week block opens its day.
- Entry: searchable project picker with recent choices first, free-text tasks, optional notes and an R&D flag. New blocks start where the last one ended.
- Editing on the calendar: drag a block or its edges with five-minute snapping. Growing a block into its neighbour shortens the neighbour instead of overlapping it.
- Dashboard: day, week, month and R&D statistics, weekly hours with overtime shown separately, and top projects for the month.
- Daily to-dos tied to the selected work date.
- Excel export with Summary, Timesheet and Detailed Entries sheets, plus a JSON backup of all data.
- Projects: colours, renaming, and permanent deletion with a confirmation that shows how many blocks are affected.
- Quick links: a browser-saved bookmark bar in the header.
- Themes: Nord, Dracula, Solarized and Gruvbox.

Screenshots are coming later.

## Stack

- React 19 on [vinext](https://github.com/cloudflare/vinext) (Next-compatible, built on Vite)
- Cloudflare Workers with a D1 (SQLite) database
- Drizzle ORM and migrations
- ExcelJS for client-side workbook generation
- Tailwind CSS 4 and shadcn-style UI components
- Vitest and ESLint
- Cloudflare Access for login; there is no in-app password system

## Run locally

You need Node.js 22.13.0 or newer.

```sh
cd Blocks-Cloudflare
npm run install:ci
npm run lint
npm run test
npm run build
npm run dev
```

Local development uses its own empty local D1 database and does not need a login. To create the tables, apply the migrations once as described in [the application README](Blocks-Cloudflare/README.md#local-database).

## Deploy your own

Blocks deploys to your own Cloudflare account as a Worker with a D1 database, behind Cloudflare Access. Copy `Blocks-Cloudflare/wrangler.example.jsonc` to `Blocks-Cloudflare/wrangler.cloudflare.jsonc` (ignored by Git), add your account and database IDs, then follow [CLOUDFLARE_DEPLOY.md](Blocks-Cloudflare/CLOUDFLARE_DEPLOY.md). Access must cover every route to the Worker; [Deploy your own](docs/deploy-your-own.md) gives the reasons and lists each Cloudflare component.

## Repository layout

- `Blocks-Cloudflare/`: the application, tests, migrations and build tooling. Run npm commands here.
- `docs/`: project documentation.

## Documentation

- [Architecture](docs/architecture.md): runtime, code map, request flow, authentication and design decisions
- [Data model](docs/data-model.md): tables and ownership rules
- [Features](docs/features.md): detailed behaviour of every feature
- [Deploy your own](docs/deploy-your-own.md): running Blocks on your own Cloudflare account

## License

[MIT](LICENSE). Bundled third-party code keeps its own license: see `Blocks-Cloudflare/build/sites-vite-plugin.LICENSE` and `Blocks-Cloudflare/vendor/shadcn-tailwind-4.13.0.LICENSE.md`.
