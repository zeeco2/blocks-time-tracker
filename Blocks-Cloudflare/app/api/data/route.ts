import { and, asc, eq, max } from "drizzle-orm";
import { getDb } from "../../../db";
import { dailyTodos, entries, projects, tasks } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function ownerId() {
  const user = await getChatGPTUser();
  if (user) return user.userId;
  if (process.env.NODE_ENV !== "production") return "local-preview";
  return null;
}
const cleanName = (value: unknown) => String(value ?? "").trim().slice(0, 80);
const cleanNote = (value: unknown) => String(value ?? "").trim().slice(0, 500);
const cleanTodo = (value: unknown) => String(value ?? "").trim().slice(0, 180);
const projectColors = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#e11d48", "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#f43f5e", "#0ea5e9", "#a855f7", "#22c55e", "#f59e0b"];

export async function GET() {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const [projectRows, taskRows, entryRows, todoRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.ownerId, owner)).orderBy(asc(projects.name)),
    db.select().from(tasks).where(eq(tasks.ownerId, owner)).orderBy(asc(tasks.name)),
    db.select().from(entries).where(eq(entries.ownerId, owner)).orderBy(asc(entries.workDate), asc(entries.startMinute)),
    db.select().from(dailyTodos).where(eq(dailyTodos.ownerId, owner)).orderBy(asc(dailyTodos.workDate), asc(dailyTodos.position)),
  ]);
  const usedColors = new Set<string>();
  const distinctProjects = projectRows.map((project, index) => {
    let color = project.color.toLowerCase();
    if (usedColors.has(color)) color = projectColors.find(candidate => !usedColors.has(candidate)) || projectColors[index % projectColors.length];
    usedColors.add(color);
    return { ...project, color };
  });
  return Response.json({ projects: distinctProjects, tasks: taskRows, entries: entryRows, todos: todoRows });
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const db = getDb();
  try {
    if (body.action === "createProject") {
      const name = cleanName(body.name);
      if (!name) return Response.json({ error: "Project name is required" }, { status: 400 });
      const existing = await db.select({ color: projects.color }).from(projects).where(eq(projects.ownerId, owner));
      const counts = new Map(projectColors.map(color => [color, 0]));
      existing.forEach(project => { const color = project.color.toLowerCase(); counts.set(color, (counts.get(color) || 0) + 1); });
      const nextColor = [...projectColors].sort((a, b) => (counts.get(a) || 0) - (counts.get(b) || 0))[0];
      const [row] = await db.insert(projects).values({ ownerId: owner, name, color: cleanName(body.color) || nextColor }).returning();
      return Response.json({ project: row }, { status: 201 });
    }
    if (body.action === "createTask") {
      const name = cleanName(body.name);
      if (!name) return Response.json({ error: "Task name is required" }, { status: 400 });
      const [row] = await db.insert(tasks).values({ ownerId: owner, name }).returning();
      return Response.json({ task: row }, { status: 201 });
    }
    if (body.action === "createTodo") {
      const workDate = String(body.workDate ?? ""), text = cleanTodo(body.text);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !text) return Response.json({ error: "Enter a valid to-do" }, { status: 400 });
      const [last] = await db.select({ position: max(dailyTodos.position) }).from(dailyTodos).where(and(eq(dailyTodos.ownerId, owner), eq(dailyTodos.workDate, workDate)));
      const [row] = await db.insert(dailyTodos).values({ ownerId: owner, workDate, text, position: (last?.position ?? -1) + 1 }).returning();
      return Response.json({ todo: row }, { status: 201 });
    }
    if (body.action === "updateTodo") {
      const id = Number(body.id), text = cleanTodo(body.text);
      if (!id || !text) return Response.json({ error: "To-do text is required" }, { status: 400 });
      const [row] = await db.update(dailyTodos).set({ text, completed: Boolean(body.completed), updatedAt: new Date().toISOString() }).where(and(eq(dailyTodos.id, id), eq(dailyTodos.ownerId, owner))).returning();
      if (!row) return Response.json({ error: "To-do not found" }, { status: 404 });
      return Response.json({ todo: row });
    }
    if (body.action === "deleteTodo") {
      await db.delete(dailyTodos).where(and(eq(dailyTodos.id, Number(body.id)), eq(dailyTodos.ownerId, owner)));
      return Response.json({ ok: true });
    }
    if (body.action === "updateProject") {
      const id = Number(body.id), name = cleanName(body.name), color = String(body.color ?? "");
      if (!id || !name || !/^#[0-9a-f]{6}$/i.test(color)) return Response.json({ error: "Enter a valid project name and color" }, { status: 400 });
      const [row] = await db.update(projects).set({ name, color }).where(and(eq(projects.id, id), eq(projects.ownerId, owner))).returning();
      if (!row) return Response.json({ error: "Project not found" }, { status: 404 });
      return Response.json({ project: row });
    }
    if (body.action === "deleteProject") {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Invalid project" }, { status: 400 });
      const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, owner))).limit(1);
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
      if (body.confirmDelete !== true) return Response.json({ error: "Confirm deletion of the project and all its time blocks" }, { status: 400 });
      // D1 batches are atomic: a failed project delete must not lose its entries.
      await db.batch([
        db.delete(entries).where(and(eq(entries.projectId, id), eq(entries.ownerId, owner))),
        db.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, owner))),
      ]);
      return Response.json({ ok: true });
    }
    if (body.action === "updateTask") {
      const id = Number(body.id), name = cleanName(body.name);
      if (!id || !name) return Response.json({ error: "Task name is required" }, { status: 400 });
      const [row] = await db.update(tasks).set({ name }).where(and(eq(tasks.id, id), eq(tasks.ownerId, owner))).returning();
      if (!row) return Response.json({ error: "Task not found" }, { status: 404 });
      return Response.json({ task: row });
    }
    if (body.action === "saveEntry") {
      const projectId = Number(body.projectId), startMinute = Number(body.startMinute), endMinute = Number(body.endMinute);
      const workDate = String(body.workDate ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !projectId || startMinute < 0 || endMinute <= startMinute || endMinute > 1440) return Response.json({ error: "Enter a valid date and time range" }, { status: 400 });
      const ownedProject = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, owner))).limit(1);
      if (!ownedProject.length) return Response.json({ error: "Invalid project" }, { status: 400 });
      if (body.id) {
        const [existingEntry] = await db.select({ id: entries.id }).from(entries).where(and(eq(entries.id, Number(body.id)), eq(entries.ownerId, owner))).limit(1);
        if (!existingEntry) return Response.json({ error: "Time block not found" }, { status: 404 });
      }
      let taskId: number;
      if (body.taskName !== undefined) {
        const name = typeof body.taskName === "string" ? body.taskName.trim() : "";
        if (!name || name.length > 80) return Response.json({ error: "Enter a task between 1 and 80 characters" }, { status: 400 });
        // Reuse names without renaming shared task rows or changing earlier entries.
        // The unique owner/name key also handles simultaneous saves of the same text.
        await db.insert(tasks).values({ ownerId: owner, name }).onConflictDoNothing({ target: [tasks.ownerId, tasks.name] });
        const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.ownerId, owner), eq(tasks.name, name))).limit(1);
        taskId = task.id;
      } else {
        // Keep older clients that submit a task ID compatible with existing records.
        const legacyTaskId = Number(body.taskId);
        if (!Number.isInteger(legacyTaskId) || legacyTaskId <= 0) return Response.json({ error: "Task is required" }, { status: 400 });
        const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, legacyTaskId), eq(tasks.ownerId, owner))).limit(1);
        if (!task) return Response.json({ error: "Invalid task" }, { status: 400 });
        taskId = task.id;
      }
      const values = { projectId, taskId, workDate, startMinute, endMinute, isRandD: Boolean(body.isRandD), note: cleanNote(body.note), updatedAt: new Date().toISOString() };
      if (body.id) {
        const [row] = await db.update(entries).set(values).where(and(eq(entries.id, Number(body.id)), eq(entries.ownerId, owner))).returning();
        return Response.json({ entry: row });
      }
      const [row] = await db.insert(entries).values({ ...values, ownerId: owner }).returning();
      return Response.json({ entry: row }, { status: 201 });
    }
    if (body.action === "deleteEntry") {
      await db.delete(entries).where(and(eq(entries.id, Number(body.id)), eq(entries.ownerId, owner)));
      return Response.json({ ok: true });
    }
    if (body.action === "resizeEntry") {
      const id = Number(body.id), requestedStart = Number(body.startMinute), requestedEnd = Number(body.endMinute);
      if (!id || requestedStart < 0 || requestedEnd <= requestedStart || requestedEnd > 1440) return Response.json({ error: "Enter a valid time range" }, { status: 400 });
      const [target] = await db.select().from(entries).where(and(eq(entries.id, id), eq(entries.ownerId, owner))).limit(1);
      if (!target) return Response.json({ error: "Time block not found" }, { status: 404 });
      const dayEntries = await db.select().from(entries).where(and(eq(entries.ownerId, owner), eq(entries.workDate, target.workDate))).orderBy(asc(entries.startMinute));
      const index = dayEntries.findIndex(entry => entry.id === id), previous = index > 0 ? dayEntries[index - 1] : null, next = index < dayEntries.length - 1 ? dayEntries[index + 1] : null;
      let startMinute = Math.max(0, Math.min(requestedStart, requestedEnd - 5));
      let endMinute = Math.min(1440, Math.max(requestedEnd, startMinute + 5));
      const now = new Date().toISOString();
      if (startMinute < target.startMinute && previous && previous.endMinute > startMinute) {
        startMinute = Math.max(startMinute, previous.startMinute + 5);
        await db.update(entries).set({ endMinute: startMinute, updatedAt: now }).where(and(eq(entries.id, previous.id), eq(entries.ownerId, owner)));
      }
      if (endMinute > target.endMinute && next && next.startMinute < endMinute) {
        endMinute = Math.min(endMinute, next.endMinute - 5);
        await db.update(entries).set({ startMinute: endMinute, updatedAt: now }).where(and(eq(entries.id, next.id), eq(entries.ownerId, owner)));
      }
      const [row] = await db.update(entries).set({ startMinute, endMinute, updatedAt: now }).where(and(eq(entries.id, id), eq(entries.ownerId, owner))).returning();
      return Response.json({ entry: row });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message.includes("UNIQUE")) return Response.json({ error: "That name already exists" }, { status: 409 });
    return Response.json({ error: message }, { status: 500 });
  }
}
