import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUser: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: mocks.getUser }));
import { GET, POST } from "../app/api/data/route";

let sqlite: DatabaseSync;
const owner = "cloudflare:owner@example.com";
const otherOwner = "cloudflare:other@example.com";
const save = (changes: Record<string, unknown> = {}) => POST(new Request("http://localhost/api/data", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "saveEntry", projectId: 1, taskName: "Investigate issue #42", workDate: "2026-11-12", startMinute: 540, endMinute: 600, ...changes }),
}));

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  // Existing schema as an isolated in-memory fixture; no D1 binding or migration CLI.
  for (const file of ["0000_dry_roughhouse.sql", "0001_clumsy_silverclaw.sql", "0002_nappy_siren.sql"]) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  mocks.getDb.mockReturnValue(drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === "run") { statement.run(...params); return { rows: [] }; }
    return { rows: statement.all(...params).map(row => Object.values(row)) };
  }));
  mocks.getUser.mockResolvedValue({ userId: owner });
  sqlite.prepare("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(1, owner, "Project A");
  sqlite.prepare("INSERT INTO projects (id, owner_id, name) VALUES (?, ?, ?)").run(2, otherOwner, "Other project");
});
afterEach(() => { sqlite.close(); vi.clearAllMocks(); });

describe("free-text task entry", () => {
  it("saves arbitrary text without setup or a note and returns it on reload", async () => {
    const response = await save({ taskName: "  Review API / fix #42 – café  " });
    expect(response.status).toBe(201);
    const { entry } = await response.json();
    expect(entry.note).toBe("");
    const data = await (await GET()).json();
    expect(data.tasks).toEqual([expect.objectContaining({ id: entry.taskId, name: "Review API / fix #42 – café", ownerId: owner })]);
    expect(data.entries).toEqual([expect.objectContaining({ id: entry.id, taskId: entry.taskId, projectId: 1 })]);
  });

  it("reuses task names for repeated and concurrent saves", async () => {
    const responses = await Promise.all([save(), save()]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const data = await (await GET()).json();
    expect(data.tasks).toHaveLength(1);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].taskId).toBe(data.entries[1].taskId);
  });

  it("changes only the edited entry and preserves previous task history", async () => {
    const { entry: first } = await (await save()).json();
    const { entry: second } = await (await save()).json();
    const response = await save({ id: first.id, taskName: "Write release notes", note: "Optional detail", isRandD: true });
    expect(response.status).toBe(200);
    const { entry: edited } = await response.json();
    expect(edited.taskId).not.toBe(first.taskId);
    expect(edited.note).toBe("Optional detail");
    expect(edited.isRandD).toBe(true);
    const data = await (await GET()).json();
    expect(data.entries.find((entry: { id: number }) => entry.id === second.id).taskId).toBe(second.taskId);
    expect(data.tasks.find((task: { id: number }) => task.id === second.taskId).name).toBe("Investigate issue #42");
    expect(data.tasks.find((task: { id: number }) => task.id === edited.taskId).name).toBe("Write release notes");
  });

  it("keeps archived task references usable when their text is unchanged", async () => {
    sqlite.prepare("INSERT INTO tasks (id, owner_id, name, archived) VALUES (?, ?, ?, 1)").run(7, owner, "Old task");
    const { entry } = await (await save({ taskName: "Old task" })).json();
    expect(entry.taskId).toBe(7);
    expect((await (await GET()).json()).tasks).toHaveLength(1);
  });

  it("resolves names within the authenticated owner only", async () => {
    sqlite.prepare("INSERT INTO tasks (id, owner_id, name) VALUES (?, ?, ?)").run(7, otherOwner, "Investigate issue #42");
    const { entry } = await (await save()).json();
    expect(entry.taskId).not.toBe(7);
    expect((await (await GET()).json()).tasks).toEqual([expect.objectContaining({ id: entry.taskId, ownerId: owner })]);
  });

  it.each(["", "   ", "x".repeat(81), 123])("rejects invalid task text %j without adding records", async taskName => {
    expect((await save({ taskName })).status).toBe(400);
    const data = await (await GET()).json();
    expect(data.tasks).toHaveLength(0);
    expect(data.entries).toHaveLength(0);
  });

  it("accepts the existing 80-character task name limit", async () => {
    expect((await save({ taskName: "x".repeat(80) })).status).toBe(201);
  });

  it("rejects another owner's project before creating a task", async () => {
    expect((await save({ projectId: 2 })).status).toBe(400);
    expect((await (await GET()).json()).tasks).toHaveLength(0);
  });

  it("rejects another owner's entry before creating a task or changing history", async () => {
    mocks.getUser.mockResolvedValue({ userId: otherOwner });
    const { entry } = await (await save({ projectId: 2 })).json();
    mocks.getUser.mockResolvedValue({ userId: owner });
    expect((await save({ id: entry.id, taskName: "Unrelated task" })).status).toBe(404);
    expect((await (await GET()).json()).tasks).toHaveLength(0);
    mocks.getUser.mockResolvedValue({ userId: otherOwner });
    expect((await (await GET()).json()).entries).toEqual([expect.objectContaining({ id: entry.id, taskId: entry.taskId })]);
  });

  it("accepts task IDs from older clients while checking task ownership", async () => {
    sqlite.prepare("INSERT INTO tasks (id, owner_id, name) VALUES (?, ?, ?)").run(7, owner, "Existing task");
    sqlite.prepare("INSERT INTO tasks (id, owner_id, name) VALUES (?, ?, ?)").run(8, otherOwner, "Other task");
    expect((await save({ taskName: undefined, taskId: 7 })).status).toBe(201);
    expect((await save({ taskName: undefined, taskId: 8 })).status).toBe(400);
    expect((await save({ taskName: undefined })).status).toBe(400);
  });
});
