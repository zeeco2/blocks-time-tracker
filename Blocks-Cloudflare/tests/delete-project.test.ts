import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUser: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: mocks.getUser }));
import { POST } from "../app/api/data/route";

let sqlite: DatabaseSync;
const owner = "cloudflare:owner@example.com";
const remove = (changes: Record<string, unknown> = {}) => POST(new Request("http://localhost/api/data", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "deleteProject", id: 1, confirmDelete: true, ...changes }),
}));

// Exercise the production D1 adapter against SQLite, including atomic batch rollback.
function prepare(sql: string, params: unknown[] = []) {
  return {
    bind: (...values: unknown[]) => prepare(sql, values),
    raw: async () => sqlite.prepare(sql).all(...params as never[]).map(row => Object.values(row)),
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...params as never[]) }),
    run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params as never[]) }),
  };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0000_dry_roughhouse.sql", "0001_clumsy_silverclaw.sql", "0002_nappy_siren.sql"]) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  const client = {
    prepare,
    batch: async (statements: ReturnType<typeof prepare>[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  mocks.getDb.mockReturnValue(drizzle(client as unknown as D1Database));
  mocks.getUser.mockResolvedValue({ userId: owner });
  sqlite.prepare("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(1, owner, "Delete me");
  sqlite.prepare("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(2, owner, "Keep me");
  sqlite.prepare("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(3, "other-owner", "Other project");
  sqlite.prepare("INSERT INTO tasks (id, owner_id, name) VALUES (?, ?, ?)").run(1, owner, "Shared task");
});

afterEach(() => { sqlite.close(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

const addEntry = (id: number, projectId: number, entryOwner = owner) => sqlite.prepare(
  "INSERT INTO entries (id, owner_id, project_id, task_id, work_date, start_minute, end_minute) VALUES (?, ?, ?, 1, '2026-11-12', 540, 600)",
).run(id, entryOwner, projectId);

describe("project deletion", () => {
  it("deletes an empty project and allows its name to be reused", async () => {
    expect((await remove()).status).toBe(200);
    expect(sqlite.prepare("SELECT id FROM projects WHERE id = 1").get()).toBeUndefined();
    expect(() => sqlite.prepare("INSERT INTO projects (owner_id, name) VALUES (?, ?)").run(owner, "Delete me")).not.toThrow();
  });

  it("deletes only the project's entries and keeps shared tasks and other owners' data", async () => {
    addEntry(1, 1); addEntry(2, 1); addEntry(3, 2); addEntry(4, 3, "other-owner");
    expect((await remove()).status).toBe(200);
    expect(sqlite.prepare("SELECT id FROM entries ORDER BY id").all().map(row => row.id)).toEqual([3, 4]);
    expect(sqlite.prepare("SELECT id FROM projects ORDER BY id").all().map(row => row.id)).toEqual([2, 3]);
    expect(sqlite.prepare("SELECT id FROM tasks").all()).toHaveLength(1);
  });

  it("requires explicit confirmation before removing any data", async () => {
    addEntry(1, 1);
    expect((await remove({ confirmDelete: false })).status).toBe(400);
    expect(sqlite.prepare("SELECT id FROM projects WHERE id = 1").get()).toBeDefined();
    expect(sqlite.prepare("SELECT id FROM entries").all()).toHaveLength(1);
  });

  it("rejects other owners' projects and unknown projects", async () => {
    expect((await remove({ id: 3 })).status).toBe(404);
    expect((await remove({ id: 999 })).status).toBe(404);
    expect(sqlite.prepare("SELECT id FROM projects").all()).toHaveLength(3);
  });

  it.each([0, -1, 1.5, "invalid", null])("rejects invalid project id %j", async id => {
    expect((await remove({ id })).status).toBe(400);
  });

  it("rolls back the entry deletes when deleting the project fails", async () => {
    addEntry(1, 1);
    sqlite.exec("CREATE TRIGGER block_project_delete BEFORE DELETE ON projects BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END;");
    expect((await remove()).status).toBe(500);
    expect(sqlite.prepare("SELECT id FROM entries WHERE id = 1").get()).toBeDefined();
    expect(sqlite.prepare("SELECT id FROM projects WHERE id = 1").get()).toBeDefined();
  });

  it("rejects anonymous production requests before accessing the database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockResolvedValue(null);
    mocks.getDb.mockClear();
    expect((await remove()).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
