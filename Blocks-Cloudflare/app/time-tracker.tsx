"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { BarChart3, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Code2, Download, FileText, Globe2, Link as LinkIcon, Mail, MessageSquare, MoreHorizontal, Palette, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { chartSegments, monthlyExpectedMinutes, monthlyTargetMinutes, STANDARD_DAY_MINUTES, WEEKLY_TARGET_MINUTES, weeklyExpectedMinutes } from "./time-metrics";

type Project = { id: number; name: string; color: string; archived: boolean };
type Task = { id: number; name: string; archived: boolean };
type Entry = { id: number; projectId: number; taskId: number; workDate: string; startMinute: number; endMinute: number; isRandD: boolean; note: string };
type Todo = { id: number; workDate: string; text: string; completed: boolean; position: number };
type QuickLink = { id: number; name: string; url: string; icon: string; position: number };
type View = "day" | "week" | "month";
type Theme = "nord" | "dracula" | "solarized" | "gruvbox";
const themes: Theme[] = ["nord", "dracula", "solarized", "gruvbox"];
const iso = (date: Date) => format(date, "yyyy-MM-dd");
const fromIso = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const asTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const friendlyTime = (minutes: number) => {
  const normalized = minutes % 1440, hours = Math.floor(normalized / 60), mins = normalized % 60;
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

export default function TimeTracker({ displayName }: { displayName: string }) {
  const [projects, setProjects] = useState<Project[]>([]), [tasks, setTasks] = useState<Task[]>([]), [entries, setEntries] = useState<Entry[]>([]), [todos, setTodos] = useState<Todo[]>([]), [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [view, setView] = useState<View>("week"), [cursor, setCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ workDate: iso(new Date()), projectId: "", taskName: "", start: "09:00", end: "10:00", isRandD: false, note: "" });
  const [theme, setTheme] = useState<Theme>("nord"), [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const cardClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null), suppressCardClick = useRef(false);
  const [createKind, setCreateKind] = useState<"project" | null>(null), [newName, setNewName] = useState("");
  const [manageKind, setManageKind] = useState<"project" | null>(null);
  const [newTodo, setNewTodo] = useState("");
  const [quickLinkEditor, setQuickLinkEditor] = useState<QuickLink | "new" | null>(null);
  const [quickLinkForm, setQuickLinkForm] = useState({ name: "", url: "", icon: "link" });

  async function load() {
    setLoading(true); const response = await fetch("/api/data"); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load data");
    setProjects(data.projects); setTasks(data.tasks); setEntries(data.entries); setTodos(data.todos || []);
    setForm(current => { const lastEnd = (data.entries as Entry[]).filter(entry => entry.workDate === current.workDate).reduce((latest, entry) => Math.max(latest, entry.endMinute), 0); return { ...current, projectId: current.projectId || String(data.projects[0]?.id || ""), ...(lastEnd ? { start: asTime(lastEnd), end: asTime(Math.min(1440, lastEnd + 60)) } : {}) }; }); setLoading(false);
  }
  useEffect(() => {
    const setup = window.setTimeout(() => { const saved = localStorage.getItem("blocks-theme") as Theme | null; const selected = saved && themes.includes(saved) ? saved : "nord"; setTheme(selected); document.documentElement.dataset.theme = selected; try { setQuickLinks(JSON.parse(localStorage.getItem("blocks-quick-links") || "[]")); } catch { setQuickLinks([]); } const now = new Date(); const currentMinute = Math.min(1435, Math.round((now.getHours() * 60 + now.getMinutes()) / 5) * 5); setForm(current => ({ ...current, workDate: iso(now), start: asTime(currentMinute), end: asTime(Math.min(1440, currentMinute + 60)) })); load().catch(e => { setError(e.message); setLoading(false); }); }, 0);
    return () => window.clearTimeout(setup);
  }, []);
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const timer = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const recentIds = useMemo(() => {
    const ordered = [...entries].sort((a, b) => `${b.workDate}-${String(b.startMinute).padStart(4, "0")}-${b.id}`.localeCompare(`${a.workDate}-${String(a.startMinute).padStart(4, "0")}-${a.id}`));
    return { projects: [...new Set(ordered.map(entry => entry.projectId))] };
  }, [entries]);
  const orderedProjects = useMemo(() => [...projects.filter(p => !p.archived)].sort((a, b) => { const ai = recentIds.projects.indexOf(a.id), bi = recentIds.projects.indexOf(b.id); return (ai < 0 ? 99999 : ai) - (bi < 0 ? 99999 : bi) || a.name.localeCompare(b.name); }), [projects, recentIds]);
  const monthEntries = useMemo(() => entries.filter(e => e.workDate.startsWith(format(cursor, "yyyy-MM"))), [entries, cursor]);
  const monthMinutes = monthEntries.reduce((sum, e) => sum + e.endMinute - e.startMinute, 0);

  async function action(payload: Record<string, unknown>) {
    setError(""); const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong"); return data;
  }
  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    try { const wasEditing = editingId !== null, nextStart = Math.min(1435, toMinutes(form.end)); await action({ action: "saveEntry", id: editingId, workDate: form.workDate, projectId: Number(form.projectId), taskName: form.taskName, startMinute: toMinutes(form.start), endMinute: toMinutes(form.end), isRandD: form.isRandD, note: form.note }); setEditingId(null); setForm(current => ({ ...current, start: asTime(nextStart), end: asTime(Math.min(1440, nextStart + 60)), taskName: "", isRandD: false, note: "" })); await load(); setSavedMessage(wasEditing ? "Changes saved" : "Block added"); window.setTimeout(() => setSavedMessage(""), 2200); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save entry"); }
  }
  function editEntry(entry: Entry) { setEditingId(entry.id); setCursor(fromIso(entry.workDate)); setForm({ workDate: entry.workDate, projectId: String(entry.projectId), taskName: taskMap.get(entry.taskId)?.name || "", start: asTime(entry.startMinute), end: asTime(entry.endMinute), isRandD: entry.isRandD, note: entry.note }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function chooseTheme(next: Theme) { setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("blocks-theme", next); }
  function selectWorkDate(workDate: string) { if (!workDate) return; setCursor(fromIso(workDate)); if (editingId !== null) { setForm(current => ({ ...current, workDate })); return; } const lastEnd = entries.filter(entry => entry.workDate === workDate).reduce((latest, entry) => Math.max(latest, entry.endMinute), 0); const now = new Date(); const currentMinute = Math.min(1435, Math.round((now.getHours() * 60 + now.getMinutes()) / 5) * 5); const start = lastEnd || (workDate === iso(now) ? currentMinute : 540); setForm(current => ({ ...current, workDate, start: asTime(start), end: asTime(Math.min(1440, start + 60)) })); }
  function openEntryDay(entry: Entry) { const [year, month, day] = entry.workDate.split("-").map(Number); setCursor(new Date(year, month - 1, day)); setForm(current => ({ ...current, workDate: entry.workDate })); setView("day"); }
  async function removeEntry(id: number) { if (!confirm("Delete this time block?")) return; try { await action({ action: "deleteEntry", id }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete entry"); } }
  async function createItem(event: React.FormEvent) {
    event.preventDefault(); if (!createKind || !newName.trim()) return;
    try { const data = await action({ action: "createProject", name: newName }); await load(); setForm(current => ({ ...current, projectId: String(data.project.id) })); setCreateKind(null); setNewName(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create item"); }
  }
  async function addTodo(event: React.FormEvent) {
    event.preventDefault(); if (!newTodo.trim()) return;
    try { await action({ action: "createTodo", workDate: form.workDate, text: newTodo }); setNewTodo(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not add to-do"); }
  }
  async function updateTodo(todo: Todo, changes: Partial<Pick<Todo, "text" | "completed">>) {
    const next = { ...todo, ...changes }; if (!next.text.trim()) return;
    setTodos(current => current.map(item => item.id === todo.id ? next : item));
    try { await action({ action: "updateTodo", id: todo.id, text: next.text, completed: next.completed }); }
    catch (e) { setTodos(current => current.map(item => item.id === todo.id ? todo : item)); setError(e instanceof Error ? e.message : "Could not update to-do"); }
  }
  async function removeTodo(id: number) {
    const previous = todos; setTodos(current => current.filter(todo => todo.id !== id));
    try { await action({ action: "deleteTodo", id }); }
    catch (e) { setTodos(previous); setError(e instanceof Error ? e.message : "Could not delete to-do"); }
  }
  function openQuickLinkEditor(link?: QuickLink) { setQuickLinkEditor(link || "new"); setQuickLinkForm(link ? { name: link.name, url: link.url, icon: link.icon } : { name: "", url: "", icon: "link" }); }
  function saveQuickLink(event: React.FormEvent) {
    event.preventDefault(); let normalizedUrl = "";
    try { const parsed = new URL(quickLinkForm.url); if (["http:", "https:"].includes(parsed.protocol)) normalizedUrl = parsed.toString(); } catch { /* validation below */ }
    if (!quickLinkForm.name.trim() || !normalizedUrl) { setError("Enter a valid bookmark name and HTTP(S) URL"); return; }
    const next = quickLinkEditor === "new" ? [...quickLinks, { id: Date.now(), name: quickLinkForm.name.trim().slice(0, 80), url: normalizedUrl, icon: quickLinkForm.icon, position: quickLinks.length }] : quickLinks.map(link => link.id === quickLinkEditor?.id ? { ...link, name: quickLinkForm.name.trim().slice(0, 80), url: normalizedUrl, icon: quickLinkForm.icon } : link);
    setQuickLinks(next); localStorage.setItem("blocks-quick-links", JSON.stringify(next)); setQuickLinkEditor(null); setError("");
  }
  function removeQuickLink() {
    if (!quickLinkEditor || quickLinkEditor === "new") return;
    const next = quickLinks.filter(link => link.id !== quickLinkEditor.id); setQuickLinks(next); localStorage.setItem("blocks-quick-links", JSON.stringify(next)); setQuickLinkEditor(null);
  }
  async function updateItem(id: number, name: string, color?: string) {
    if (!manageKind) return;
    await action({ action: "updateProject", id, name, color }); await load(); setManageKind(null); setSavedMessage("Project updated"); window.setTimeout(() => setSavedMessage(""), 2200);
  }
  async function deleteProject(id: number) {
    await action({ action: "deleteProject", id, confirmDelete: true });
    if (entries.some(entry => entry.id === editingId && entry.projectId === id)) setEditingId(null);
    setForm(current => current.projectId === String(id) ? { ...current, projectId: "", taskName: "", note: "", isRandD: false } : current);
    await load();
    setManageKind(null);
    setSavedMessage("Project deleted");
    window.setTimeout(() => setSavedMessage(""), 2200);
  }
  function changePeriod(direction: number) { const next = view === "day" ? addDays(cursor, direction) : view === "week" ? addWeeks(cursor, direction) : addMonths(cursor, direction); selectWorkDate(iso(next)); }

  async function exportExcel() {
    const ExcelJS = await import("exceljs"); const wb = new ExcelJS.Workbook(); wb.creator = "Blocks"; wb.created = new Date();
    const randdMinutes = monthEntries.filter(e => e.isRandD).reduce((sum, e) => sum + e.endMinute - e.startMinute, 0);
    const summary = wb.addWorksheet("Summary"); summary.columns = [{ width: 24 }, { width: 18 }]; summary.addRows([["Monthly summary", format(cursor, "MMMM yyyy")], ["Total hours", monthMinutes / 1440], ["R&D hours", randdMinutes / 1440], ["Percentage R&D", monthMinutes ? randdMinutes / monthMinutes : 0]]); summary.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } }; summary.getCell("B2").numFmt = "[h]:mm"; summary.getCell("B3").numFmt = "[h]:mm"; summary.getCell("B4").numFmt = "0.00%";
    const sheet = wb.addWorksheet("Timesheet", { views: [{ state: "frozen", xSplit: 2, ySplit: 2 }] }); const dates = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
    sheet.addRow(["Timesheet", format(cursor, "MMMM yyyy")]); sheet.mergeCells(1, 2, 1, dates.length + 3); sheet.addRow(["Project", "Task", ...dates.map(d => format(d, "dd EEE")), "Total"]);
    const projectIds = Array.from(new Set(monthEntries.map(entry => entry.projectId))).sort((a, b) => (projectMap.get(a)?.name || "").localeCompare(projectMap.get(b)?.name || ""));
    for (const projectId of projectIds) {
      const projectEntries = monthEntries.filter(entry => entry.projectId === projectId);
      const taskIds = Array.from(new Set(projectEntries.map(entry => entry.taskId))).sort((a, b) => (taskMap.get(a)?.name || "").localeCompare(taskMap.get(b)?.name || ""));
      taskIds.forEach((taskId, index) => {
        const taskEntries = projectEntries.filter(entry => entry.taskId === taskId);
        const daily = dates.map(date => taskEntries.filter(entry => entry.workDate === iso(date)).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0) / 1440);
        sheet.addRow([index === 0 ? projectMap.get(projectId)?.name || "" : "", taskMap.get(taskId)?.name || "", ...daily, daily.reduce((sum, value) => sum + value, 0)]);
      });
    }
    const totalRow = sheet.addRow(["", "Total", ...dates.map(d => monthEntries.filter(e => e.workDate === iso(d)).reduce((s, e) => s + e.endMinute - e.startMinute, 0) / 1440), monthMinutes / 1440]);
    sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } }; sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } }; totalRow.font = { bold: true }; sheet.columns.forEach((column, index) => { column.width = index === 0 ? 24 : index === 1 ? 34 : 12; }); sheet.getColumn(2).alignment = { wrapText: true, vertical: "middle" };
    for (let row = 3; row <= sheet.rowCount; row++) for (let col = 3; col <= dates.length + 3; col++) sheet.getCell(row, col).numFmt = "[h]:mm";
    const detail = wb.addWorksheet("Detailed Entries"); detail.columns = [{ header: "Date", key: "date", width: 14 }, { header: "Project", key: "project", width: 24 }, { header: "Task", key: "task", width: 24 }, { header: "R&D", key: "randd", width: 10 }, { header: "Start", key: "start", width: 10 }, { header: "Finish", key: "finish", width: 10 }, { header: "Duration", key: "duration", width: 12 }, { header: "Note", key: "note", width: 40 }];
    monthEntries.forEach(e => detail.addRow({ date: e.workDate, project: projectMap.get(e.projectId)?.name, task: taskMap.get(e.taskId)?.name, randd: e.isRandD ? "Yes" : "No", start: asTime(e.startMinute), finish: asTime(e.endMinute), duration: (e.endMinute - e.startMinute) / 1440, note: e.note })); detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; detail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } }; detail.getColumn("duration").numFmt = "[h]:mm";
    const buffer = await wb.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Blocks_${format(cursor, "yyyy_MM")}.xlsx`; link.click(); URL.revokeObjectURL(link.href);
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>, entry: Entry, edge: "start" | "end") {
    event.preventDefault(); event.stopPropagation(); suppressCardClick.current = true;
    const initialY = event.clientY, snapshot = entries.map(item => ({ ...item })); let finalStart = entry.startMinute, finalEnd = entry.endMinute, moved = false;
    const sameDay = snapshot.filter(item => item.workDate === entry.workDate).sort((a, b) => a.startMinute - b.startMinute), index = sameDay.findIndex(item => item.id === entry.id), previous = index > 0 ? sameDay[index - 1] : null, next = index < sameDay.length - 1 ? sameDay[index + 1] : null;
    const move = (pointer: PointerEvent) => {
      const delta = Math.round((((pointer.clientY - initialY) * 1.25) / 5)) * 5; moved = moved || Math.abs(pointer.clientY - initialY) > 2;
      finalStart = entry.startMinute; finalEnd = entry.endMinute; const adjusted = snapshot.map(item => ({ ...item }));
      if (edge === "start") { finalStart = Math.max(0, Math.min(entry.endMinute - 5, entry.startMinute + delta)); if (previous && previous.endMinute > finalStart) { finalStart = Math.max(finalStart, previous.startMinute + 5); const neighbour = adjusted.find(item => item.id === previous.id); if (neighbour) neighbour.endMinute = finalStart; } }
      else { finalEnd = Math.min(1440, Math.max(entry.startMinute + 5, entry.endMinute + delta)); if (next && next.startMinute < finalEnd) { finalEnd = Math.min(finalEnd, next.endMinute - 5); const neighbour = adjusted.find(item => item.id === next.id); if (neighbour) neighbour.startMinute = finalEnd; } }
      const target = adjusted.find(item => item.id === entry.id); if (target) { target.startMinute = finalStart; target.endMinute = finalEnd; } setEntries(adjusted);
    };
    const finish = async () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); window.setTimeout(() => { suppressCardClick.current = false; }, 80); if (!moved) { setEntries(snapshot); return; } try { await action({ action: "resizeEntry", id: entry.id, startMinute: finalStart, endMinute: finalEnd }); await load(); setSavedMessage("Block resized"); window.setTimeout(() => setSavedMessage(""), 1800); } catch (e) { setEntries(snapshot); setError(e instanceof Error ? e.message : "Could not resize block"); } };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setEntries(snapshot); suppressCardClick.current = false; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  }
  const renderCard = (entry: Entry, compact = false) => { const project = projectMap.get(entry.projectId), task = taskMap.get(entry.taskId), minutes = entry.endMinute - entry.startMinute, height = compact ? 34 + minutes * .55 : (entry.note ? 72 : 48) + minutes * .18; const open = () => { if (suppressCardClick.current) return; if (!compact) return editEntry(entry); if (cardClickTimer.current) clearTimeout(cardClickTimer.current); cardClickTimer.current = setTimeout(() => editEntry(entry), 220); }; return <div key={entry.id} className={`entry-card ${compact ? "compact" : ""}`} role="button" tabIndex={0} onClick={open} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") open(); }} onDoubleClick={() => { if (!compact || suppressCardClick.current) return; if (cardClickTimer.current) clearTimeout(cardClickTimer.current); openEntryDay(entry); }} style={{ borderLeftColor: project?.color || "#64748b", minHeight: compact ? "36px" : "48px", height: `${height}px` }}><button type="button" className="card-resize-handle top" aria-label={`Adjust start time for ${project?.name || "block"}`} onPointerDown={event => beginResize(event, entry, "start")}/><span className="entry-main"><span className="project-dot" style={{ background: project?.color }} /><strong>{project?.name}</strong><span>{task?.name}</span>{entry.isRandD && <em className="randd-badge">R&D</em>}</span><span className="entry-time">{asTime(entry.startMinute)}–{asTime(entry.endMinute)}</span>{!compact && <span className="entry-duration">{duration(minutes)}</span>}<MoreHorizontal size={17} />{!compact && entry.note && <span className="entry-note">{entry.note}</span>}<button type="button" className="card-resize-handle bottom" aria-label={`Adjust finish time for ${project?.name || "block"}`} onPointerDown={event => beginResize(event, entry, "end")}/></div>; };
  const dayEntries = (date: Date) => entries.filter(e => e.workDate === iso(date));
  const weekDays = eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) });
  const monthDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) });
  const selectedMinutes = dayEntries(fromIso(form.workDate)).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0);
  const weekTotals = weekDays.map(day => ({ day, minutes: dayEntries(day).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0) }));
  const weekMinutes = weekTotals.reduce((sum, item) => sum + item.minutes, 0);
  const maxOvertimeMinutes = Math.max(0, ...weekTotals.map(item => item.minutes - STANDARD_DAY_MINUTES));
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }), currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const currentWeekMinutes = entries.filter(entry => { const date = fromIso(entry.workDate); return date >= currentWeekStart && date <= currentWeekEnd; }).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0);
  const currentMonthPrefix = format(now, "yyyy-MM");
  const currentMonthMinutes = entries.filter(entry => entry.workDate.startsWith(currentMonthPrefix)).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0);
  const currentMonthTarget = monthlyTargetMinutes(now), currentWeekExpected = weeklyExpectedMinutes(now), currentMonthExpected = monthlyExpectedMinutes(now);
  const randdMinutes = monthEntries.filter(entry => entry.isRandD).reduce((sum, entry) => sum + entry.endMinute - entry.startMinute, 0);
  const projectTotals = Array.from(monthEntries.reduce((totals, entry) => totals.set(entry.projectId, (totals.get(entry.projectId) || 0) + entry.endMinute - entry.startMinute), new Map<number, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const selectedTodos = todos.filter(todo => todo.workDate === form.workDate).sort((a, b) => a.position - b.position);

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><BrandMark/><span className="brand">Blocks</span></div><nav className="quick-links" aria-label="Quick links">{quickLinks.map(link => <span className="quick-link-wrap" key={link.id}><button className="quick-link" type="button" title={link.url} onClick={() => window.open(link.url, `blocks-quick-link-${link.id}`)}><QuickLinkIcon name={link.icon}/><span>{link.name}</span></button><button className="quick-link-edit" type="button" aria-label={`Edit ${link.name}`} onClick={() => openQuickLinkEditor(link)}><Pencil size={11}/></button></span>)}<button className="quick-link-add" type="button" onClick={() => openQuickLinkEditor()}><Plus size={15}/><span>Add link</span></button></nav><div className="topbar-actions"><ThemePicker value={theme} onChange={chooseTheme}/><span className="user-label">{displayName}</span></div></header>
    <section className="workspace">
      <form className="entry-form" onSubmit={saveEntry}><div className="form-heading"><div><p className="eyebrow">Quick entry</p><h1>{editingId ? "Edit time block" : "Add time block"}</h1></div>{editingId && <div className="heading-actions"><button type="button" className="icon-button danger" aria-label="Delete entry" onClick={() => removeEntry(editingId)}><Trash2 size={17}/></button><button type="button" className="icon-button" aria-label="Cancel editing" onClick={() => setEditingId(null)}><X size={18}/></button></div>}</div>
        <div className="form-grid"><label className="date-field">Date<span className="date-control"><CalendarDays size={17}/><strong>{format(fromIso(form.workDate), "d MMM yyyy")}</strong><input className="native-date-input" type="date" value={form.workDate} onChange={e => selectWorkDate(e.target.value)} aria-label="Choose work date"/></span></label>
          <SearchableSelect label="Project" placeholder="Choose project" items={orderedProjects} value={form.projectId} recentIds={recentIds.projects} onChange={value => setForm({ ...form, projectId: value })} onCreate={() => setCreateKind("project")} onManage={() => setManageKind("project")}/>
          <label>Task<input value={form.taskName} onChange={e => setForm({ ...form, taskName: e.target.value })} placeholder="What did you work on?" required maxLength={80}/></label>
          <label className="note-field"><span className="field-label-row"><strong>Note</strong><small>optional</small></span><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Add an optional note"/></label><label className="randd-field"><input type="checkbox" checked={form.isRandD} onChange={e => setForm({ ...form, isRandD: e.target.checked })}/><span>R&D</span></label><button className="primary-button" type="submit">{editingId ? "Save changes" : "Add block"}</button>
          <button type="button" className="time-summary" onClick={() => setTimeEditorOpen(true)}><Clock3 size={19}/><span><small>Time block</small><strong>{friendlyTime(toMinutes(form.start))} – {friendlyTime(toMinutes(form.end))}</strong></span><em>{duration(toMinutes(form.end) - toMinutes(form.start))}</em></button>
        </div>{error && <p className="error-message">{error}</p>}{savedMessage && <div className="save-toast" role="status"><Check size={16}/>{savedMessage}</div>}
      </form>
      <section className="calendar-section"><div className="calendar-toolbar"><div className="period-controls"><button onClick={() => changePeriod(-1)} aria-label="Previous period"><ChevronLeft size={19}/></button><button className="today-button" onClick={() => selectWorkDate(iso(new Date()))}>Today</button><button onClick={() => changePeriod(1)} aria-label="Next period"><ChevronRight size={19}/></button><h2>{view === "day" ? format(cursor, "EEEE, d MMMM") : view === "week" ? `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}` : format(cursor, "MMMM yyyy")}</h2></div><div className="toolbar-actions"><div className="view-switch">{(["day", "week", "month"] as View[]).map(v => <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{v}</button>)}</div><button className="export-button" onClick={exportExcel}><Download size={17}/> Export Excel</button></div></div>
        {loading ? <div className="empty-state">Loading your blocks…</div> : view === "day" ? <div className="day-view">{dayEntries(cursor).length ? dayEntries(cursor).map(e => renderCard(e)) : <Empty/>}</div> : view === "week" ? <div className="week-grid">{weekDays.map(day => <div className={`week-day ${iso(day) === iso(new Date()) ? "is-today" : ""}`} key={iso(day)}><button className="day-heading" onClick={() => { setCursor(day); selectWorkDate(iso(day)); setView("day"); }}><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong><small>{duration(dayEntries(day).reduce((s,e) => s + e.endMinute-e.startMinute,0))}</small></button><div className="day-stack">{dayEntries(day).map(e => renderCard(e, true))}</div></div>)}</div> : <div className="month-grid">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div className="month-weekday" key={d}>{d}</div>)}{monthDays.map(day => <button className={`month-day ${!isSameMonth(day, cursor) ? "outside" : ""} ${iso(day) === iso(new Date()) ? "is-today" : ""}`} key={iso(day)} onClick={() => { setCursor(day); selectWorkDate(iso(day)); setView("day"); }}><span className="month-date">{format(day, "d")}</span><span className="month-total">{duration(dayEntries(day).reduce((s,e)=>s+e.endMinute-e.startMinute,0))}</span>{dayEntries(day).slice(0,3).map(e => <span className="month-chip" key={e.id} style={{ borderLeftColor: projectMap.get(e.projectId)?.color }}>{projectMap.get(e.projectId)?.name} · {taskMap.get(e.taskId)?.name}{e.isRandD ? " · R&D" : ""}</span>)}{dayEntries(day).length > 3 && <small>+{dayEntries(day).length - 3} more</small>}</button>)}</div>}
      </section>
      <aside className="dashboard-rail">
        <section className="dashboard-card overview-card"><header><span><BarChart3 size={16}/> Overview</span><small>{format(now, "MMM yyyy")}</small></header><div className="stat-grid"><div><span>Selected day</span><strong>{duration(selectedMinutes)}</strong></div><ProgressStat label="This week" actual={currentWeekMinutes} target={WEEKLY_TARGET_MINUTES} expected={currentWeekExpected}/><ProgressStat label="This month" actual={currentMonthMinutes} target={currentMonthTarget} expected={currentMonthExpected}/><div><span>R&amp;D share</span><strong>{monthMinutes ? `${Math.round(randdMinutes / monthMinutes * 100)}%` : "0%"}</strong></div></div></section>
        <section className="dashboard-card chart-card"><header><span>Weekly hours</span><small>{duration(weekMinutes)}</small></header><div className="week-chart" aria-label="Hours recorded by day this week"><span className="chart-reference">8 h</span>{weekTotals.map(item => { const segments = chartSegments(item.minutes, maxOvertimeMinutes); return <div className="chart-column" key={iso(item.day)} title={`${format(item.day, "EEEE")}: ${duration(item.minutes)}${item.minutes > STANDARD_DAY_MINUTES ? ` (${duration(item.minutes - STANDARD_DAY_MINUTES)} overtime)` : ""}`}><span>{item.minutes ? `${Math.round(item.minutes / 60 * 10) / 10}` : ""}</span><div className="chart-track"><i className="regular-hours" style={{ height: `${segments.regularHeight}%` }}/><i className="overtime-hours" style={{ bottom: `${segments.regularHeight}%`, height: `${segments.overtimeHeight}%` }}/></div><small>{format(item.day, "EEEEE")}</small></div>; })}</div></section>
        <section className="dashboard-card project-chart"><header><span>Top projects</span><small>{format(cursor, "MMM")}</small></header>{projectTotals.length ? <div className="project-bars">{projectTotals.map(([projectId, minutes]) => <div className="project-bar" key={projectId}><div><span><i style={{ background: projectMap.get(projectId)?.color }}/>{projectMap.get(projectId)?.name || "Project"}</span><strong>{duration(minutes)}</strong></div><b><i style={{ width: `${monthMinutes ? minutes / monthMinutes * 100 : 0}%`, background: projectMap.get(projectId)?.color }}/></b></div>)}</div> : <p className="dashboard-empty">No project time this month yet.</p>}</section>
        <section className="dashboard-card todo-card"><header><span>Daily to-do</span><small>{format(fromIso(form.workDate), "d MMM")}</small></header><form className="todo-add" onSubmit={addTodo}><input value={newTodo} onChange={event => setNewTodo(event.target.value)} placeholder="Add a task for this day" maxLength={180}/><button type="submit" aria-label="Add to-do"><Plus size={17}/></button></form><div className="todo-list">{selectedTodos.map(todo => <div className={`todo-row ${todo.completed ? "completed" : ""}`} key={todo.id}><button className="todo-check" type="button" aria-label={todo.completed ? "Mark incomplete" : "Mark complete"} onClick={() => updateTodo(todo, { completed: !todo.completed })}>{todo.completed && <Check size={13}/>}</button><input value={todo.text} aria-label="Edit to-do" onChange={event => setTodos(current => current.map(item => item.id === todo.id ? { ...item, text: event.target.value } : item))} onBlur={event => updateTodo(todo, { text: event.target.value })}/><button className="todo-delete" type="button" aria-label="Delete to-do" onClick={() => removeTodo(todo.id)}><X size={14}/></button></div>)}{!selectedTodos.length && <p className="dashboard-empty">Nothing planned for this day.</p>}</div></section>
        <button className="backup-button" onClick={() => { const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), projects, tasks, entries, todos }, null, 2)], { type: "application/json" }); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="blocks-backup.json"; a.click(); URL.revokeObjectURL(a.href); }}><Download size={15}/> Download backup</button>
      </aside>
    </section>
    {createKind && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={createItem}><button type="button" className="modal-close" onClick={() => setCreateKind(null)}><X size={18}/></button><p className="eyebrow">New {createKind}</p><h2>Create {createKind}</h2><label>Name<input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. P3"/></label><button className="primary-button" type="submit">Create {createKind}</button></form></div>}
    {manageKind && <ManageItemsModal kind={manageKind} items={projects} entries={entries} onSave={updateItem} onDelete={deleteProject} onClose={() => setManageKind(null)}/>}
    {quickLinkEditor && <div className="modal-backdrop" role="presentation"><form className="modal quick-link-modal" onSubmit={saveQuickLink}><button type="button" className="modal-close" onClick={() => setQuickLinkEditor(null)}><X size={18}/></button><p className="eyebrow">Bookmark bar</p><h2>{quickLinkEditor === "new" ? "Add quick link" : "Edit quick link"}</h2><label>Name<input autoFocus value={quickLinkForm.name} onChange={event => setQuickLinkForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Gmail" maxLength={80}/></label><label>URL<input value={quickLinkForm.url} onChange={event => setQuickLinkForm(current => ({ ...current, url: event.target.value }))} placeholder="https://example.com" inputMode="url"/></label><fieldset className="icon-picker"><legend>Icon</legend>{quickLinkIconNames.map(icon => <button type="button" key={icon} className={quickLinkForm.icon === icon ? "active" : ""} aria-label={`Use ${icon} icon`} onClick={() => setQuickLinkForm(current => ({ ...current, icon }))}><QuickLinkIcon name={icon}/></button>)}</fieldset><div className="quick-link-modal-actions">{quickLinkEditor !== "new" && <button type="button" className="delete-link-button" onClick={removeQuickLink}><Trash2 size={15}/> Delete</button>}<button className="primary-button" type="submit">Save link</button></div></form></div>}
    {timeEditorOpen && <TimeBlockEditor start={toMinutes(form.start)} end={toMinutes(form.end)} onChange={(start, end) => setForm(current => ({ ...current, start: asTime(start), end: asTime(end) }))} onClose={() => setTimeEditorOpen(false)}/>} 
  </main>;
}
function ProgressStat({ label, actual, target, expected }: { label: string; actual: number; target: number; expected: number }) {
  const variance = actual - expected;
  const state = variance > 0 ? "ahead" : variance < 0 ? "behind" : "on-track";
  const varianceText = variance === 0 ? "On track" : `${variance > 0 ? "+" : "−"}${Math.floor(Math.abs(variance) / 60)}h ${String(Math.abs(variance) % 60).padStart(2, "0")}m ${variance > 0 ? "ahead" : "behind"}`;
  return <div className="progress-stat"><span>{label}</span><strong>{duration(actual)}</strong><small>{duration(target)} target · {Math.round(actual / target * 100)}%</small><b className={state}>{varianceText}</b><i><em style={{ width: `${Math.min(100, actual / target * 100)}%` }}/></i></div>;
}
function Empty() { return <div className="empty-state"><CalendarDays size={24}/><strong>No blocks recorded</strong><span>Add one above or choose another day.</span></div>; }

function BrandMark() { return <svg className="brand-mark" viewBox="0 0 64 64" role="img" aria-label="Blocks"><rect x="6" y="6" width="14" height="52" rx="5" fill="currentColor"/><rect x="24" y="6" width="25" height="14" rx="6" fill="var(--blue)"/><rect x="24" y="25" width="20" height="14" rx="6" fill="color-mix(in srgb,var(--blue) 68%,white)"/><rect x="24" y="44" width="25" height="14" rx="6" fill="var(--blue)"/><rect x="45" y="14" width="13" height="15" rx="6" fill="var(--blue)"/><rect x="45" y="35" width="13" height="15" rx="6" fill="var(--blue)"/></svg>; }

const quickLinkIconNames = ["link", "globe", "briefcase", "mail", "message", "file", "code", "star"];
function QuickLinkIcon({ name }: { name: string }) { const icons = { link: LinkIcon, globe: Globe2, briefcase: BriefcaseBusiness, mail: Mail, message: MessageSquare, file: FileText, code: Code2, star: Star }; const Icon = icons[name as keyof typeof icons] || LinkIcon; return <Icon size={15}/>; }

function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const [open, setOpen] = useState(false); const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  return <div className="theme-picker" ref={rootRef}><button type="button" className={`theme-trigger ${open ? "open" : ""}`} onClick={() => setOpen(current => !current)} aria-haspopup="listbox" aria-expanded={open}><Palette size={16}/><span>{value[0].toUpperCase() + value.slice(1)}</span><ChevronDown size={15}/></button>{open && <div className="theme-menu" role="listbox">{themes.map(theme => <button type="button" role="option" aria-selected={theme === value} key={theme} onClick={() => { onChange(theme); setOpen(false); }}><i className={`theme-swatch ${theme}`}/><span>{theme[0].toUpperCase() + theme.slice(1)}</span>{theme === value && <Check size={15}/>}</button>)}</div>}</div>;
}

function ManageItemsModal({ kind, items, entries, onSave, onDelete, onClose }: { kind: "project"; items: Project[]; entries: Entry[]; onSave: (id: number, name: string, color?: string) => Promise<void>; onDelete: (id: number) => Promise<void>; onClose: () => void }) {
  const first = items.find(item => !item.archived) || items[0];
  const [selectedId, setSelectedId] = useState(first?.id || 0), selected = items.find(item => item.id === selectedId);
  const [name, setName] = useState(first?.name || ""), [color, setColor] = useState(first?.color || "#2563eb");
  const [saving, setSaving] = useState(false), [confirmingDelete, setConfirmingDelete] = useState(false), [error, setError] = useState("");
  const entryCount = entries.filter(entry => entry.projectId === selectedId).length;
  function choose(item: Project) { setSelectedId(item.id); setName(item.name); setColor(item.color); setConfirmingDelete(false); setError(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selectedId || !name.trim() || saving || confirmingDelete) return;
    setSaving(true); setError("");
    try { await onSave(selectedId, name.trim(), color); } catch (e) { setError(e instanceof Error ? e.message : "Could not save project"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!selectedId || saving) return;
    setSaving(true); setError("");
    try { await onDelete(selectedId); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete project"); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="modal manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-projects-title" onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={saving}><X size={18}/></button>
    <p className="eyebrow">Projects</p><h2 id="manage-projects-title">Manage {kind}s</h2>
    <div className="manage-layout"><div className="manage-list" role="listbox" aria-label="projects">{items.map(item => <button type="button" role="option" aria-selected={item.id === selectedId} disabled={saving} key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => choose(item)}><i className="project-dot" style={{ background: item.color }}/><span>{item.name}</span>{item.id === selectedId && <Check size={15}/>}</button>)}</div>
      {selected ? <div className="manage-fields">{confirmingDelete ? <div className="project-delete-confirmation">
        <h3>Delete {selected.name}?</h3>
        <p>This permanently deletes the project{entryCount ? ` and ${entryCount} time ${entryCount === 1 ? "block" : "blocks"} recorded under it` : ""}. This cannot be undone.</p>
        <p>Other projects and shared task names stay intact.</p>
        <button className="project-delete-button" type="button" onClick={remove} disabled={saving}>{saving ? "Deleting…" : "Permanently delete project"}</button>
        <button className="project-keep-button" type="button" onClick={() => { setConfirmingDelete(false); setError(""); }} disabled={saving}>Keep project</button>
      </div> : <>
        <label>Name<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={80} disabled={saving}/></label>
        <label>Color<span className="color-control"><input type="color" value={color} onChange={event => setColor(event.target.value)} disabled={saving}/><strong>{color.toUpperCase()}</strong></span></label>
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button className="project-delete-button" type="button" onClick={() => { setConfirmingDelete(true); setError(""); }} disabled={saving}><Trash2 size={15}/> Delete project</button>
      </>}{error && <p className="error-message" role="alert">{error}</p>}</div> : <p className="no-results">No projects yet.</p>}
    </div></form></div>;
}

function SearchableSelect<T extends { id: number; name: string; color?: string }>({ label, placeholder, items, value, recentIds, onChange, onCreate, onManage }: { label: string; placeholder: string; items: T[]; value: string; recentIds: number[]; onChange: (value: string) => void; onCreate: () => void; onManage: () => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLInputElement>(null);
  const selected = items.find(item => String(item.id) === value);
  const filtered = items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setQuery(""); } }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  function choose(id: number) { onChange(String(id)); setOpen(false); setQuery(""); }
  return <div className="custom-field" ref={rootRef}><span className="field-label">{label}</span><button type="button" className={`select-trigger ${open ? "open" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (open) setQuery(""); setOpen(current => !current); }}><span className="select-value">{selected?.color && <i className="project-dot" style={{ background: selected.color }}/>}<span className={!selected ? "placeholder" : ""}>{selected?.name || placeholder}</span></span><ChevronDown size={17}/></button>{open && <div className="select-popover"><div className="select-search"><Search size={15}/><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } if (event.key === "Enter" && filtered[0]) choose(filtered[0].id); }} placeholder={`Search ${label.toLowerCase()}s…`} aria-label={`Search ${label.toLowerCase()}s`}/></div><div className="select-options" role="listbox">{filtered.length ? filtered.map(item => <button type="button" role="option" aria-selected={String(item.id) === value} className="select-option" key={item.id} onClick={() => choose(item.id)}>{item.color && <i className="project-dot" style={{ background: item.color }}/>}<span>{item.name}</span>{recentIds.slice(0, 3).includes(item.id) && <small>Recent</small>}{String(item.id) === value && <Check size={15}/>}</button>) : <p className="no-results">No matches</p>}</div><div className="select-actions"><button type="button" onClick={() => { setOpen(false); setQuery(""); onCreate(); }}><Plus size={16}/>Create new</button><button type="button" onClick={() => { setOpen(false); setQuery(""); onManage(); }}><Pencil size={15}/>Manage {label.toLowerCase()}s</button></div></div>}</div>;
}

const HOUR_HEIGHT = 72;
function TimeBlockEditor({ start, end, onChange, onClose }: { start: number; end: number; onChange: (start: number, end: number) => void; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialStart = useRef(start);
  const drag = useRef<{ mode: "move" | "start" | "end"; y: number; start: number; end: number } | null>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, initialStart.current / 60 * HOUR_HEIGHT - 130); }, []);
  function begin(event: React.PointerEvent, mode: "move" | "start" | "end") { event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); drag.current = { mode, y: event.clientY, start, end }; }
  function move(event: React.PointerEvent) {
    if (!drag.current) return; const delta = Math.round(((event.clientY - drag.current.y) / HOUR_HEIGHT * 60) / 5) * 5; const original = drag.current;
    if (original.mode === "move") { const length = original.end - original.start; const nextStart = Math.max(0, Math.min(1440 - length, original.start + delta)); onChange(nextStart, nextStart + length); }
    if (original.mode === "start") onChange(Math.max(0, Math.min(original.end - 5, original.start + delta)), original.end);
    if (original.mode === "end") onChange(original.start, Math.min(1440, Math.max(original.start + 5, original.end + delta)));
  }
  function finish() { drag.current = null; }
  function nudge(which: "start" | "end", amount: number) { if (which === "start") onChange(Math.max(0, Math.min(end - 5, start + amount)), end); else onChange(start, Math.min(1440, Math.max(start + 5, end + amount))); }
  const top = start / 60 * HOUR_HEIGHT, height = Math.max(28, (end - start) / 60 * HOUR_HEIGHT);
  return <div className="modal-backdrop"><section className="time-editor" role="dialog" aria-modal="true" aria-label="Adjust time block"><header><div><p className="eyebrow">Drag to adjust</p><h2>{friendlyTime(start)} – {friendlyTime(end)}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close time editor"><X size={18}/></button></header><div className="timeline-scroll" ref={scrollRef}><div className="timeline-canvas" onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>{Array.from({ length: 25 }, (_, hour) => <div className="timeline-hour" style={{ top: hour * HOUR_HEIGHT }} key={hour}><span>{friendlyTime(hour * 60)}</span></div>)}<div className="draggable-time-block" style={{ top, height }} onPointerDown={e => begin(e, "move")}><button type="button" className="resize-handle top" aria-label="Adjust start" onPointerDown={e => begin(e, "start")}/><strong>{friendlyTime(start)}</strong><span>{duration(end - start)}</span><strong>{friendlyTime(end)}</strong><button type="button" className="resize-handle bottom" aria-label="Adjust finish" onPointerDown={e => begin(e, "end")}/></div></div></div><footer><div className="time-nudges"><span>Start</span><button type="button" onClick={() => nudge("start", -5)}>−5</button><strong>{friendlyTime(start)}</strong><button type="button" onClick={() => nudge("start", 5)}>+5</button></div><div className="time-nudges"><span>Finish</span><button type="button" onClick={() => nudge("end", -5)}>−5</button><strong>{friendlyTime(end)}</strong><button type="button" onClick={() => nudge("end", 5)}>+5</button></div><button type="button" className="primary-button" onClick={onClose}>Done</button></footer></section></div>;
}
