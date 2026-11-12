import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(), name: text("name").notNull(),
  color: text("color").notNull().default("#2563eb"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("projects_owner_name").on(table.ownerId, table.name)]);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(), name: text("name").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("tasks_owner_name").on(table.ownerId, table.name)]);

export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }), ownerId: text("owner_id").notNull(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  workDate: text("work_date").notNull(), startMinute: integer("start_minute").notNull(), endMinute: integer("end_minute").notNull(),
  isRandD: integer("is_r_and_d", { mode: "boolean" }).notNull().default(false),
  note: text("note").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("entries_owner_date").on(table.ownerId, table.workDate)]);

export const dailyTodos = sqliteTable("daily_todos", {
  id: integer("id").primaryKey({ autoIncrement: true }), ownerId: text("owner_id").notNull(),
  workDate: text("work_date").notNull(), text: text("text").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("daily_todos_owner_date").on(table.ownerId, table.workDate)]);
