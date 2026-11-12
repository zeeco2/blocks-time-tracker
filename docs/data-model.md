# Data model

The schema is defined in `Blocks-Cloudflare/db/schema.ts`.

## Projects

- `id`: integer primary key
- `owner_id`: authenticated owner identifier
- `name`: unique per owner
- `color`: display color
- `archived`: soft-archive flag
- `created_at`: creation timestamp

The UI/API has a broad project color palette and avoids duplicate displayed colors where possible.

`deleteProject` requires an owned project ID and explicit confirmation. It deletes the owner's entries for that project followed by the project in one atomic D1 batch. Shared task rows are retained. No schema migration is needed.

## Tasks

- `id`: integer primary key
- `owner_id`: authenticated owner identifier
- `name`: unique per owner
- `archived`: soft-archive flag
- `created_at`: creation timestamp

Task rows remain reusable across projects to preserve existing entries, exports, and backups; there is no project-task join table. The entry form accepts free text rather than a task ID. `saveEntry` trims and validates task text (1–80 characters), then creates or reuses the exact owner-scoped name, including archived names. The unique owner/name key handles simultaneous saves. Editing task text changes only the entry reference and never renames a shared task row. Older clients may still submit an owned task ID. No schema migration is required for this workflow.

## Entries

- `id`: integer primary key
- `owner_id`: authenticated owner identifier
- `project_id`: project reference
- `task_id`: task reference
- `work_date`: local calendar date in `YYYY-MM-DD`
- `start_minute`, `end_minute`: minutes after midnight
- `is_r_and_d`: boolean
- `note`: optional text stored as a non-null string
- `created_at`, `updated_at`: timestamps

An index covers `(owner_id, work_date)`. All reads and mutations must remain owner-scoped. New migrations belong in `Blocks-Cloudflare/drizzle/` and must not be replayed after they have been applied.

## Daily todos

- `id`: integer primary key
- `owner_id`: authenticated owner identifier
- `work_date`: selected local calendar date in `YYYY-MM-DD`
- `text`: editable to-do text
- `completed`: boolean completion state
- `position`: stable display position
- `created_at`, `updated_at`: timestamps

An index covers `(owner_id, work_date)`. Daily to-do reads and mutations are owner-scoped.
