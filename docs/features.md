# Features

## Time entry

- Select or create a project, then type a required task directly as free text (up to 80 characters). Saving creates or reuses its stored name automatically; no task setup or dropdown is needed.
- New blocks start with a blank task field. Editing loads the existing task text; changing it affects only that block, preserving earlier entries.
- The date control shows the selected work date with a calendar icon and opens the device-native date picker.
- Calendar previous, next, and Today controls keep the selected work date synchronized with the visible day, week, or month.
- The searchable, scrollable project selector shows recent choices first.
- Project colors appear in selectors and calendar entries.
- New entries default to one hour and begin at the last entry's finish time for that date, or the current rounded time when appropriate.
- A draggable time editor supports moving the whole block, resizing either edge, five-minute snapping, and five-minute nudge buttons.
- Optional notes and an R&D flag are stored per entry.
- Existing blocks can be edited or deleted.
- Existing projects can be renamed from the project selector menu; project colors can also be edited.
- The project menu's Manage projects dialog can permanently delete a project and all its time blocks. A separate confirmation names the project and shows its block count, with a Keep project option. Shared tasks, other projects, and other owners' records remain unchanged.

## Calendar

- Day, week, and month views.
- Day view displays entry notes.
- Week block height reflects duration.
- Double-clicking a week block opens its day view.
- Day and week blocks have draggable top and bottom edges with five-minute snapping and continuous live height feedback.
- Expanding a block into its nearest same-day neighbour shortens that neighbour from the touching edge while preserving a minimum five-minute block.

## Appearance

- The Modular B is the product mark in the header and browser favicon.
- The header scrolls away with the page instead of remaining pinned.
- A browser-saved bookmark bar in the header supports adding, editing, deleting, and launching quick links with a choice of icons.
- Quick links reuse the named browser tab previously opened by Blocks when that tab is still available.
- Manrope is the primary interface typeface; JetBrains Mono is used for dates, times, durations, and numeric totals.
- Nord, Dracula, Solarized, and Gruvbox themes.
- Time blocks retain their project-color edge and use stronger borders, surface contrast, and elevation to stand apart from the calendar background.
- The theme chooser uses the same custom popover styling and interaction states as the project selector.
- Tactile hover, focus, press, and save-confirmation states.
- Responsive layout for smaller screens.

## Export and backup

Excel tabs are ordered `Summary`, `Timesheet`, then `Detailed Entries`.

The Timesheet groups rows by project while retaining one row per task. The project name appears only on the first task row in each project group; later rows leave the Project cell blank. Daily values and totals are calculated separately for every project/task pair.

The Summary includes total hours, R&D hours, and R&D percentage. Detailed Entries preserves every block, including date, project, task, R&D status, start, finish, duration, and note.

A JSON backup download contains projects, tasks, entries, and daily to-dos.

## Dashboard and daily planning

- A right-side dashboard shows selected-day, current-week, current-month, and monthly R&D statistics.
- Current-week progress uses a 40-hour target. Current-month progress uses eight hours for every Monday through Friday in the calendar month.
- Weekly and monthly schedule variance compares recorded time with working time elapsed between 09:00 and 17:00 on weekdays. The dashboard refreshes this calculation every minute.
- Weekly hours and monthly top-project charts are derived from recorded time blocks.
- Weekly bars keep the eight-hour reference at 80% of the chart height. Regular time uses the existing blue below that line; overtime uses a lighter blue stacked above it.
- Each selected date has an editable daily to-do list with add, edit, complete, and delete actions.
- The main workspace stays left-aligned, while the dashboard uses the available right-side space and stacks responsively on smaller screens.
