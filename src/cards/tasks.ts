import { MarkdownView, Menu, Modal, Notice, setIcon, Setting, TFile, TFolder, type App } from "obsidian";
import { emptyState, moment } from "../cardbodies";
import { formatRelativeDate, parseNaturalDate } from "../dates";
import { addResetButton } from "../editors";
import { t } from "../i18n";
import { FilePickerModal } from "../pickers";
import {
	PRIORITY_EMOJI,
	priorityClass,
	priorityDisplayLabel,
	priorityKey,
	priorityLevel,
	priorityRank,
	readPriorityEmoji,
} from "../priority";
import {
	activeTaskFields,
	type BuiltinTaskField,
	customFieldId,
	customFieldProperty,
	fieldAppliesTo,
	fieldAutoColor,
	fieldColor,
	fieldColorable,
	fieldStyle,
	fieldStyleOptions,
	isCustomField,
	resolveTaskFields,
	taskFieldValues,
} from "../taskfields";
import { inTaskScope, tasksEventRelevant } from "../taskscope";
import {
	type DashboardCard,
	type HomeSettings,
	type TaskDueFilter,
	type TaskFieldConfig,
	type TaskFieldStyle,
	type TaskFilterConfig,
	type TaskMeta,
	type TaskPriorityLevel,
	type TasksConfig,
	type TaskSortField,
	type TaskSortRule,
} from "../types";
import { confirmAction, makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


/** Community plugin id for TaskNotes (used by "tasks" cards in TaskNotes mode). */
const TASKNOTES_PLUGIN_ID = "tasknotes";


/** Frontmatter key the Kanban plugin writes on every board note. Used both to
 * auto-detect a board when none is configured and to confirm a chosen file is
 * actually a Kanban board. */
const KANBAN_FRONTMATTER_KEY = "kanban-plugin";


/** Marks the start of the Kanban plugin's trailing settings block
 * (`%% kanban:settings`). Everything from this line to end-of-file is board
 * metadata, not cards, so parsing and card insertion stop here. */
const KANBAN_SETTINGS_RE = /^\s*%%\s*kanban:settings/i;


/** A Kanban board column: its `##` heading text and the line range
 * `[headingLine, endLine)` (endLine exclusive) that holds its cards. */
interface KanbanColumn {
	heading: string;
	headingLine: number;
	endLine: number;
}


// ---- Tasks ---------------------------------------------------------------

interface TaskHit {
	file: TFile;
	/** Line index for checkbox tasks; -1 for TaskNotes tasks (whole-file, no
	 * single line to jump to or toggle in place). */
	line: number;
	text: string;
	done: boolean;
	due: string | null;
	/** The original due text as written (e.g. "tomorrow"), kept so the display
	 * can show the user's natural-language wording next to the parsed date. */
	dueRaw: string | null;
	/** TaskNotes "scheduled" date (frontmatter), used as a fallback for sorting
	 * when no due date is set. */
	scheduled: string | null;
	/** File creation time (epoch ms), the final sort tiebreaker. */
	created: number;
	/** TaskNotes recurrence rule (e.g. "FREQ=WEEKLY;INTERVAL=1" or an RRULE).
	 * When present the task is recurring; shown as a ↻ badge next to the due
	 * date so the date isn't mistaken for a one-off. */
	recurrence?: string;
	/** TaskNotes complete_instances: the YYYY-MM-DD dates already completed for
	 * a recurring task. Used to mark today's instance done and to reflect an
	 * already-checked checkbox without re-completing. */
	completeInstances?: string[];
	/** Raw TaskNotes status value, shown as a badge instead of a checkbox
	 * since it may not be a simple open/done binary. */
	status?: string;
	/** Raw TaskNotes priority value (e.g. high/normal/low), shown as an
	 * indicator dot + label. */
	priority?: string;
	/** Kanban source: the board column (heading) this card currently lives
	 * under. Used to group cards in the Kanban layout and as the status badge
	 * in the list layout. */
	boardColumn?: string;
	/** Tasks-plugin "start" date (🛫), a card can't be started before it. */
	start?: string | null;
	/** Tasks-plugin "done" date (✅), set when the card was completed. */
	doneDate?: string | null;
	/** Kanban card description: the plain-text lines nested under the card,
	 * shown as sub-bullets. Joined with "\n"; empty when the card has none. */
	description?: string;
	/** Kanban card that is essentially a single link to a note (as produced by
	 * "Convert to note"): the linked note. When set, the card's metadata is read
	 * from that note's frontmatter and its description from the note body, and
	 * "open note" opens it. */
	linkedFile?: TFile | null;
	/** Checkbox source: the raw checkbox status symbol (the char inside `- [ ]`),
	 * used to group the task into its status column on the Kanban board. */
	checkboxStatus?: string;
}


/** The default checkbox task states shown as Kanban columns when the card has
 * no custom set: To do ` `, In progress `/`, Done `x` (done). */
function defaultCheckboxStatuses(): { symbol: string; label: string; done?: boolean }[] {
	return [
		{ symbol: " ", label: t().cards.tasks.toDo },
		{ symbol: "/", label: t().cards.tasks.statusInProgress },
		{ symbol: "x", label: t().cards.tasks.done, done: true },
	];
}


/** The card's configured checkbox statuses, or the default set. Blank/malformed
 * entries are dropped; a status without a label falls back to its symbol. */
function checkboxStatuses(cfg: TasksConfig): { symbol: string; label: string; done?: boolean }[] {
	const custom = (cfg.checkboxStatuses ?? [])
		.filter((s) => s && typeof s.symbol === "string" && s.symbol.length === 1)
		.map((s) => ({ symbol: s.symbol, label: (s.label || "").trim() || s.symbol, done: !!s.done }));
	return custom.length ? custom : defaultCheckboxStatuses();
}


export function renderTasks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.tasks ?? {};
	const container = body.createDiv("hearth-tasks-wrap");
	const refresh = () => void loadAndRenderTasks(view, cfg, container, refresh);
	refresh();
}


/** Resolve TaskNotes' "create new task" command id. Prefer a live lookup (the
 * plugin's command ids have shifted between versions) and fall back to the
 * conventional id. */
function taskNotesCreateCommandId(view: HomeView): string {
	const commands = view.app.commands.listCommands();
	const match =
		commands.find((c) => /^tasknotes[:.]/i.test(c.id) && /create.*task/i.test(c.name)) ??
		commands.find((c) => /tasknotes/i.test(c.id) && /create.*task/i.test(c.name));
	return match?.id ?? "tasknotes:create-new-task";
}


/** A small "+" button that triggers TaskNotes' create-task command, appended to
 * `parent`. */
function taskNotesAddButton(view: HomeView, parent: HTMLElement): void {
	const btn = parent.createEl("button", {
		cls: "hearth-task-add",
		attr: { "aria-label": t().cards.tasks.createNewTask, title: t().cards.tasks.createNewTask },
	});
	setIcon(btn, "plus");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const id = taskNotesCreateCommandId(view);
		if (!view.app.commands.executeCommandById(id)) {
			new Notice(t().notices.taskNotesCreateFailed);
		}
	});
}


/** Places the list layout's controls: the filter/sort controls and a
 * source-appropriate add control (TaskNotes' create command, or a Kanban
 * quick-add into the first column). When the card has a title the controls dock
 * into its title header; otherwise they float over the card's top-right corner. */
function renderTasksListHeader(
	view: HomeView,
	cfg: TasksConfig,
	source: string,
	availableStatuses: string[],
	boardColumns: string[] | undefined,
	container: HTMLElement,
	refresh: () => void,
): void {
	const actions = resolveTaskActionsHost(view, container);
	// Filter and sort controls for the whole list. Like the add control, they're
	// revealed on card hover (see styles.css) so the header stays uncluttered.
	renderTaskFilterControl(view, actions, cfg, availableStatuses, refresh);
	renderTaskListSortControl(view, actions, cfg, availableStatuses, refresh);
	if (source === "tasknotes") {
		// TaskNotes add is a single command button, so it sits with the controls.
		taskNotesAddButton(view, actions);
	} else if (source === "kanban" && boardColumns && boardColumns.length) {
		// Kanban add expands into a form, so give it a full-width row below the
		// header; new cards go into the board's first column.
		const target = boardColumns[0];
		const addHost = container.createDiv("hearth-tasks-listadd");
		renderKanbanAddCard(view, cfg, target, addHost, refresh, {
			extended: cfg.kanbanExtended ?? false,
			markDone: (cfg.kanbanDoneColumns ?? []).includes(target.toLowerCase()),
		});
	}
}


/** Resolve where the list-layout controls (filter/sort/add) should live and
 * return the element to render them into.
 *
 * A titled card docks the controls at the right of its title header, reusing a
 * single host so a task refresh replaces — rather than stacks — them. An
 * untitled card, or any card while arranging (where the header holds the title
 * editor), floats them over the card's top-right corner instead. */
function resolveTaskActionsHost(view: HomeView, container: HTMLElement): HTMLElement {
	const head = view.arrangeMode
		? null
		: container.closest(".hearth-card")?.querySelector<HTMLElement>(".hearth-card-head");
	if (head && !head.classList.contains("is-untitled")) {
		const existing = head.querySelector<HTMLElement>(":scope > .hearth-tasks-headactions");
		if (existing) {
			existing.empty();
			return existing;
		}
		return head.createDiv("hearth-tasks-headactions hearth-tasks-listhead-actions");
	}
	// Untitled (or arranging): float the controls over the card's top-right
	// corner, revealed on hover — matching the add button and embed switcher on
	// headerless cards, and never reserving a row of its own.
	return container.createDiv("hearth-tasks-head hearth-tasks-listhead-actions");
}


/** A short, human-readable label for a recurrence rule (e.g. "FREQ=WEEKLY;
 * INTERVAL=2" → "Repeats weekly"). Returns null if the rule is empty or
 * unparseable. */
function recurrenceLabel(rule: string | undefined): string | null {
	if (!rule) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toLowerCase();
	if (!freq) return t().recurrence.repeats;
	const interval = parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10);
	const units = t().recurrence.units;
	const unit =
		freq === "daily"
			? units.day
			: freq === "weekly"
				? units.week
				: freq === "monthly"
					? units.month
					: freq === "yearly"
						? units.year
						: freq;
	return interval > 1 ? t().recurrence.everyMany(interval, unit) : t().recurrence.everyOne(unit);
}


/** The date used for display/sorting — `due` wins, but recurring tasks use
 * `scheduled` (the next occurrence) since they have no fixed due date. */
function effectiveDate(hit: TaskHit): string | null {
	return hit.due ?? hit.scheduled ?? null;
}


/** Format a due/next-occurrence date for display as a short, human-relative
 * label ("Today", "Tomorrow", "Yesterday", "Friday", "Next Friday", "15 Jul").
 * Recurring tasks append a ↻ symbol so the date isn't mistaken for a one-off
 * and the user knows it's the next occurrence. */
function formatDueLabel(hit: TaskHit): string | null {
	const raw = hit.recurrence ? hit.due ?? hit.scheduled : hit.due;
	if (!raw) return hit.recurrence ? "↻" : null;
	const tail = hit.recurrence ? " ↻" : "";
	return `${formatRelativeDate(raw)}${tail}`;
}


/** Apply a field's per-value colour to a chip, if it has one. The colour rides
 * on a custom property rather than a style attribute so the stylesheet decides
 * what it tints (background, border, dot) per chip style. */
function applyFieldColor(el: HTMLElement, field: TaskFieldConfig, value: string): void {
	const color = fieldColor(field, value);
	if (!color) return;
	el.addClass("is-colored");
	el.style.setProperty("--chip-color", color);
}


/** Draw one metadata value the way its field asks for: a filled chip, a bare
 * coloured dot with the value in the tooltip, or plain text. `extraCls` carries
 * the field's long-standing class names so existing stylesheet (and theme)
 * rules keep applying underneath the style/colour modifiers. */
function renderFieldChip(
	parent: HTMLElement,
	field: TaskFieldConfig,
	value: string,
	opts: { style: TaskFieldStyle; extraCls?: string; title?: string },
): HTMLElement {
	const cls = `hearth-task-chip is-${opts.style}${opts.extraCls ? ` ${opts.extraCls}` : ""}`;
	const el = parent.createDiv(cls);
	if (opts.style === "dot") {
		el.createDiv("hearth-task-chip-dot");
	} else {
		// A custom field can prefix its value ("Project: Hearth") so a bare value
		// like "3" still says what it is; built-ins never set a label.
		if (field.label) el.createSpan({ cls: "hearth-task-chip-label", text: field.label });
		el.createSpan({ cls: "hearth-task-chip-value", text: value });
	}
	applyFieldColor(el, field, value);
	el.setAttribute("title", opts.title ?? value);
	return el;
}


/** A task's priority: the five-level coloured dot, a labelled chip, or plain
 * text, per the field's style. The dot-only form (the Kanban board default)
 * keeps the value in the tooltip. */
function renderPriority(
	parent: HTMLElement,
	field: TaskFieldConfig,
	priority: string,
	style: TaskFieldStyle,
): void {
	const label = priorityDisplayLabel(priority);
	const chip = parent.createDiv(`hearth-task-priority is-${priorityClass(priority)} is-${style}`);
	// The historical class for the compact board form, kept so the existing
	// stylesheet rule (and any theme overriding it) still matches.
	if (style === "dot") chip.addClass("is-dot-only");
	if (style !== "text") chip.createDiv("hearth-task-priority-dot");
	if (style !== "dot") chip.createSpan({ cls: "hearth-task-priority-label", text: label });
	// Priority has its own five-level scale in the stylesheet, so a colour only
	// lands here when the user set one explicitly for this value.
	applyFieldColor(chip, field, priority);
	chip.setAttribute("title", `Priority: ${label}`);
}


/** A pill showing a TaskNotes task's raw status value. The list layout's
 * completion checkbox only says done/not-done, so the actual status (open,
 * in-progress, waiting, …) needs a chip of its own. It's rendered straight
 * after the task title and left-aligned against it (see the `has-statuschip`
 * rules in styles.css) so it reads as part of the task rather than floating
 * among the right-hand priority/date chips. */
function renderTaskStatus(
	row: HTMLElement,
	field: TaskFieldConfig,
	status: string,
	style: TaskFieldStyle,
): void {
	const label = status.trim();
	if (!label) return;
	const chip = row.createDiv(`hearth-task-status hearth-task-statuschip is-${style}`);
	if (style === "dot") chip.createDiv("hearth-task-chip-dot");
	else chip.setText(label);
	applyFieldColor(chip, field, label);
	chip.setAttribute("title", `Status: ${label}`);
	// Marks the row so the title stops growing to fill it, letting the chip sit
	// against the title. Set here rather than matched with :has(), which is
	// avoided in this stylesheet for its broad selector-invalidation cost.
	row.addClass("has-statuschip");
}


/** The date a date field reads off a task. */
function taskFieldDate(hit: TaskHit, id: BuiltinTaskField): string | null {
	if (id === "start") return hit.start ?? null;
	if (id === "scheduled") return hit.scheduled;
	if (id === "doneDate") return hit.doneDate ?? null;
	return hit.due;
}


/** Render one of a task's date indicators: start (🛫), scheduled (⏳), the
 * due/next-occurrence label, or the done date (✅). Start/scheduled/done are
 * parsed only for line-based tasks (checkbox + Kanban), so they render nothing
 * for TaskNotes; the due label keeps its recurrence/overdue treatment for every
 * source. Renders nothing when the task has no such date. */
function renderTaskDateField(
	parent: HTMLElement,
	hit: TaskHit,
	id: BuiltinTaskField,
	today: string,
	style: TaskFieldStyle,
): void {
	const overdue = (d: string | null | undefined) => !hit.done && !!d && d.slice(0, 10) < today;

	if (id === "due") {
		const dueLabel = formatDueLabel(hit);
		if (!dueLabel) return;
		const due = parent.createDiv({ cls: `hearth-task-due is-${style}`, text: dueLabel });
		due.toggleClass("is-overdue", overdue(effectiveDate(hit)));
		if (hit.recurrence) {
			due.addClass("is-recurring");
			due.setAttribute("title", recurrenceLabel(hit.recurrence) ?? t().cards.tasks.recurring);
		}
		return;
	}

	// For recurring cards the scheduled date is folded into the due label (it is
	// the next occurrence), so showing it again would duplicate it.
	if (hit.line < 0) return;
	if (id === "scheduled" && hit.recurrence) return;
	const date = taskFieldDate(hit, id);
	if (!date) return;

	const emoji = id === "start" ? "🛫" : id === "scheduled" ? "⏳" : "✅";
	const title =
		id === "start"
			? t().cards.tasks.startDate
			: id === "scheduled"
				? t().cards.tasks.scheduledDate
				: t().cards.tasks.doneDate;
	// "done" rather than "doneDate" keeps the long-standing class name.
	const kind = id === "doneDate" ? "done" : id;
	const el = parent.createDiv({ cls: `hearth-task-meta hearth-task-meta-${kind} is-${style}` });
	el.createSpan({ cls: "hearth-task-meta-emoji", text: emoji });
	el.appendText(formatRelativeDate(date));
	el.setAttribute("title", `${title}: ${date}`);
	// A done date is history — it is never overdue.
	if (id !== "doneDate") el.toggleClass("is-overdue", overdue(date));
}


/** The note a custom field reads its frontmatter from: the task's own note for
 * a TaskNotes task, the linked note for a Kanban card converted to one, and
 * otherwise the note the task line lives in. */
function fieldSourceFile(hit: TaskHit): TFile {
	return hit.linkedFile ?? hit.file;
}


/** Render a frontmatter property as chips — one per value, so a list property
 * (`contexts: [home, errands]`) reads the way TaskNotes shows it. */
function renderCustomField(
	view: HomeView,
	parent: HTMLElement,
	hit: TaskHit,
	field: TaskFieldConfig,
	style: TaskFieldStyle,
): void {
	const property = customFieldProperty(field.id);
	if (!property) return;
	const frontmatter = view.app.metadataCache.getFileCache(fieldSourceFile(hit))?.frontmatter;
	for (const value of taskFieldValues(frontmatter?.[property])) {
		renderFieldChip(parent, field, value, {
			style,
			extraCls: "hearth-task-custom",
			title: `${property}: ${value}`,
		});
	}
}


/** Where each field is drawn. The list layout is a single row, so all three are
 * the same element and the configured order is the visual order. A Kanban card
 * is three stacked areas (title row, description block, meta row), so a field's
 * style decides which one it lands in and the order applies within each. */
interface TaskFieldHosts {
	/** Beside the task title. */
	inline: HTMLElement;
	/** The metadata row under the title. */
	meta: HTMLElement;
	/** Full-width block under the title (the description). */
	block: HTMLElement;
}


/** Draw a task's metadata: every visible field, in the card's configured order,
 * each in the style it is configured with. This is the one place the two
 * layouts agree on what a task shows. */
function renderTaskFields(
	view: HomeView,
	cfg: TasksConfig,
	hit: TaskHit,
	hosts: TaskFieldHosts,
	today: string,
	layout: "list" | "kanban",
): void {
	const source = cfg.source ?? "checkbox";
	for (const field of activeTaskFields(cfg, view.plugin.settings)) {
		if (field.hidden) continue;
		if (!fieldAppliesTo(field.id, source, taskMetaEnabled(cfg, hit))) continue;
		const style = fieldStyle(field, layout, source);

		if (isCustomField(field.id)) {
			renderCustomField(view, hosts.meta, hit, field, style);
			continue;
		}

		switch (field.id as BuiltinTaskField) {
			case "status":
				// The board already groups by status, so a chip repeating the column
				// it sits in would be noise.
				if (layout === "kanban" || !hit.status) break;
				renderTaskStatus(hosts.inline, field, hit.status, style);
				break;
			case "column":
				if (layout === "kanban" || !hit.boardColumn) break;
				renderFieldChip(hosts.inline, field, hit.boardColumn, {
					style,
					extraCls: "hearth-task-status hearth-task-column",
				});
				break;
			case "priority":
				// A dot is compact enough to sit beside the title; a labelled chip
				// belongs in the metadata row.
				if (!hit.priority) break;
				renderPriority(style === "dot" ? hosts.inline : hosts.meta, field, hit.priority, style);
				break;
			case "description":
				if (!hit.description) break;
				renderTaskDescription(hosts.block, hit.description);
				break;
			default:
				renderTaskDateField(hosts.meta, hit, field.id as BuiltinTaskField, today, style);
				break;
		}
	}
}


/** Render a card's description as muted plain-text sub-bullets (one per line),
 * with no Markdown formatting applied. */
function renderTaskDescription(parent: HTMLElement, description: string): void {
	const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
	if (!lines.length) return;
	const wrap = parent.createDiv("hearth-task-desc");
	for (const line of lines) {
		const item = wrap.createDiv("hearth-task-desc-line");
		item.createSpan({ cls: "hearth-task-desc-bullet", text: "•" });
		item.createSpan({ cls: "hearth-task-desc-text", text: line });
	}
}


/** Whether a line-based task's inline Tasks-plugin metadata (dates, priority,
 * repeat marks) is managed — parsed for display/sorting and written on edits.
 * Kanban cards (identified by `boardColumn`) follow `kanbanExtended` (off by
 * default); plain checkboxes follow `checkboxExtended` (on by default). */
function taskMetaEnabled(cfg: TasksConfig, hit: TaskHit): boolean {
	return hit.boardColumn ? (cfg.kanbanExtended ?? false) : (cfg.checkboxExtended ?? true);
}


/** The default "smart" ordering: due date → scheduled date → priority → created
 * date. Dates compare as strings (YYYY-MM-DD sorts lexically); tasks missing a
 * date sort after those that have one. */
function compareSmart(a: TaskHit, b: TaskHit): number {
	if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
	if (a.due) return -1;
	if (b.due) return 1;
	if (a.scheduled && b.scheduled) return a.scheduled < b.scheduled ? -1 : a.scheduled > b.scheduled ? 1 : 0;
	if (a.scheduled) return -1;
	if (b.scheduled) return 1;
	const pa = priorityRank(a.priority);
	const pb = priorityRank(b.priority);
	if (pa !== pb) return pa - pb;
	return a.created - b.created;
}


/** A chosen sort key + direction. An absent `key` means "smart" (the default
 * chain); an absent `reverse` means ascending. */
type SortKey = NonNullable<TasksConfig["sortKey"]>;

interface SortState {
	key?: SortKey;
	reverse?: boolean;
}


/** Sort a list of tasks in place by the given key and direction. Incomplete
 * tasks always come before completed ones (so "show completed" adds them below
 * rather than crowding out open work); within each group the chosen key
 * applies, and `reverse` flips that key (not the incomplete/complete grouping). */
function sortHits(hits: TaskHit[], key: SortKey, reverse: boolean): void {
	const compare = (a: TaskHit, b: TaskHit): number => {
		switch (key) {
			case "due": {
				const ad = effectiveDate(a);
				const bd = effectiveDate(b);
				if (ad && bd) return ad < bd ? -1 : ad > bd ? 1 : 0;
				if (ad) return -1;
				if (bd) return 1;
				return a.created - b.created;
			}
			case "priority": {
				const d = priorityRank(a.priority) - priorityRank(b.priority);
				return d !== 0 ? d : compareSmart(a, b);
			}
			case "created":
				return a.created - b.created;
			case "alpha":
				return (a.text || a.file.basename).localeCompare(b.text || b.file.basename);
			default:
				return compareSmart(a, b);
		}
	};
	hits.sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		const c = compare(a, b);
		return reverse ? -c : c;
	});
}


/** Compare two tasks on a single custom-sort field, ascending. Tasks missing a
 * value for the field sort after those that have one; ties return 0 so the
 * next rule (or the created-date backstop) decides. */
function compareByField(a: TaskHit, b: TaskHit, field: TaskSortField): number {
	const cmpDate = (x: string | null, y: string | null): number => {
		if (x && y) return x < y ? -1 : x > y ? 1 : 0;
		if (x) return -1;
		if (y) return 1;
		return 0;
	};
	switch (field) {
		case "due":
			return cmpDate(effectiveDate(a), effectiveDate(b));
		case "scheduled":
			return cmpDate(a.scheduled, b.scheduled);
		case "priority":
			return priorityRank(a.priority) - priorityRank(b.priority);
		case "created":
			return a.created - b.created;
		case "alpha":
			return (a.text || a.file.basename).localeCompare(b.text || b.file.basename);
		case "status": {
			const sa = (hitStatusValue(a) ?? "").toLowerCase();
			const sb = (hitStatusValue(b) ?? "").toLowerCase();
			return sa.localeCompare(sb);
		}
	}
	return 0;
}


/** Sort tasks in place by an ordered list of custom rules: each rule is applied
 * as a tiebreaker for the previous, with the file creation time as the final
 * backstop. Like the single-key sort, incomplete tasks always come first. */
function sortHitsByRules(hits: TaskHit[], rules: TaskSortRule[]): void {
	hits.sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		for (const rule of rules) {
			const c = compareByField(a, b, rule.field);
			if (c !== 0) return rule.reverse ? -c : c;
		}
		return a.created - b.created;
	});
}


/** Whether a custom-rules sort is configured (a non-empty rule list). */
function hasCustomSort(cfg: TasksConfig): boolean {
	return !!cfg.sortRules?.length;
}


/** Sort tasks by the card's persistent (whole-list) sort setting: the custom
 * rule list when set, otherwise the single sort key + direction. */
function sortTasks(hits: TaskHit[], cfg: TasksConfig): void {
	if (hasCustomSort(cfg)) sortHitsByRules(hits, cfg.sortRules as TaskSortRule[]);
	else sortHits(hits, cfg.sortKey ?? "smart", !!cfg.sortReverse);
}


/** Available sort keys, in the order shown in the sort menu. */
const TASK_SORT_KEYS: SortKey[] = ["smart", "due", "priority", "created", "alpha"];


/** A minimalistic sort control: a small button that opens a menu to pick a sort
 * key or reverse the direction. `compact` renders it icon-only (for Kanban
 * column headers, where each column sorts independently); otherwise it shows a
 * label too (the list header). `onChange` persists and refreshes. */
function renderTaskSortControl(
	parent: HTMLElement,
	current: SortState,
	compact: boolean,
	onChange: (next: SortState) => void,
): void {
	const active = current.key ?? "smart";
	const labels = t().cards.tasks.sortLabels;
	const btn = parent.createEl("button", {
		cls: compact ? "hearth-kanban-col-sort" : "hearth-tasks-sort",
		attr: { "aria-label": t().cards.tasks.sort, title: t().cards.tasks.sort },
	});
	setIcon(btn, "arrow-up-down");
	if (!compact) btn.createSpan({ cls: "hearth-tasks-sort-label", text: labels[active] });
	if (current.reverse) btn.addClass("is-reversed");
	if (active !== "smart" || current.reverse) btn.addClass("is-active");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const menu = new Menu();
		for (const key of TASK_SORT_KEYS) {
			menu.addItem((item) =>
				item
					.setTitle(labels[key])
					.setChecked(active === key)
					.onClick(() => onChange({ key: key === "smart" ? undefined : key, reverse: current.reverse })),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(t().cards.tasks.sortReverse)
				.setChecked(!!current.reverse)
				.setIcon("arrow-down-up")
				.onClick(() => onChange({ key: current.key, reverse: current.reverse ? undefined : true })),
		);
		menu.showAtMouseEvent(e);
	});
}


/** Fields offered by the custom-sort modal, in menu order. */
const TASK_SORT_FIELDS: TaskSortField[] = ["due", "scheduled", "priority", "created", "alpha", "status"];


/**
 * The list header's sort control. Like {@link renderTaskSortControl} it offers
 * the simple one-key sorts, but it also exposes a "Custom…" option that opens a
 * modal to build an ordered multi-rule sort (mirroring how the filter control
 * opens the filter modal). A custom sort supersedes the simple key; picking a
 * simple key clears it.
 */
function renderTaskListSortControl(
	view: HomeView,
	parent: HTMLElement,
	cfg: TasksConfig,
	availableStatuses: string[],
	refresh: () => void,
): void {
	const custom = hasCustomSort(cfg);
	const active: SortKey = cfg.sortKey ?? "smart";
	const labels = t().cards.tasks.sortLabels;
	const persist = () => {
		void view.plugin.saveData(view.plugin.settings);
		refresh();
	};

	const btn = parent.createEl("button", {
		cls: "hearth-tasks-sort",
		attr: { "aria-label": t().cards.tasks.sort, title: t().cards.tasks.sort },
	});
	setIcon(btn, "arrow-up-down");
	btn.createSpan({
		cls: "hearth-tasks-sort-label",
		text: custom ? t().cards.tasks.sortCustom : labels[active],
	});
	if (!custom && cfg.sortReverse) btn.addClass("is-reversed");
	if (custom || active !== "smart" || cfg.sortReverse) btn.addClass("is-active");

	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const menu = new Menu();
		for (const key of TASK_SORT_KEYS) {
			menu.addItem((item) =>
				item
					.setTitle(labels[key])
					.setChecked(!custom && active === key)
					.onClick(() => {
						cfg.sortRules = undefined;
						cfg.sortKey = key === "smart" ? undefined : key;
						persist();
					}),
			);
		}
		// Reverse applies to the simple key sort; hidden while a custom sort (which
		// carries its own per-rule directions) is active.
		if (!custom) {
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.sortReverse)
					.setChecked(!!cfg.sortReverse)
					.setIcon("arrow-down-up")
					.onClick(() => {
						cfg.sortReverse = cfg.sortReverse ? undefined : true;
						persist();
					}),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(t().cards.tasks.sortCustomOption)
				.setChecked(custom)
				.setIcon("list-ordered")
				.onClick(() => {
					new TaskSortModal(view.app, cfg.sortRules ?? [], availableStatuses, (rules) => {
						cfg.sortRules = rules.length ? rules : undefined;
						persist();
					}).open();
				}),
		);
		menu.showAtMouseEvent(e);
	});
}


/**
 * The custom-sort modal: an ordered list of rules (field + direction) applied
 * in sequence, plus add / reorder / remove controls. Mirrors the filter modal —
 * edits apply on "Apply", "Clear" empties the list, "Cancel" discards them.
 */
class TaskSortModal extends Modal {
	private rules: TaskSortRule[];
	private body: HTMLElement | null = null;

	constructor(
		app: App,
		initial: TaskSortRule[],
		private readonly availableStatuses: string[],
		private readonly onSubmit: (rules: TaskSortRule[]) => void,
	) {
		super(app);
		// Clone so Cancel truly discards edits.
		this.rules = initial.map((r) => ({ ...r }));
	}

	/** Sort fields available in this context (status only when the source exposes
	 * status/column values, matching the filter modal). */
	private fields(): TaskSortField[] {
		return TASK_SORT_FIELDS.filter((f) => f !== "status" || this.availableStatuses.length > 0);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-tasksort-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.sortTitle });
		contentEl.createEl("p", { cls: "hearth-tasksort-hint", text: t().cards.tasks.sortHint });
		this.body = contentEl.createDiv("hearth-tasksort-body");
		this.renderBody();
		this.renderFooter(contentEl);
	}

	private renderBody(): void {
		const body = this.body;
		if (!body) return;
		body.empty();
		const labels = t().cards.tasks;
		const fieldLabels = labels.sortFields;
		const available = this.fields();

		this.rules.forEach((rule, index) => {
			const row = new Setting(body).setClass("hearth-tasksort-rule");
			row.setName(index === 0 ? labels.sortLevelFirst : labels.sortLevelNext);
			row.addDropdown((d) => {
				for (const f of available) d.addOption(f, fieldLabels[f]);
				d.setValue(rule.field).onChange((v) => {
					rule.field = v as TaskSortField;
				});
			});
			row.addDropdown((d) => {
				d.addOption("asc", labels.sortAscending);
				d.addOption("desc", labels.sortDescending);
				d.setValue(rule.reverse ? "desc" : "asc").onChange((v) => {
					rule.reverse = v === "desc" ? true : undefined;
				});
			});
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(labels.sortMoveUp)
					.setDisabled(index === 0)
					.onClick(() => {
						this.moveRule(index, index - 1);
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(labels.sortMoveDown)
					.setDisabled(index === this.rules.length - 1)
					.onClick(() => {
						this.moveRule(index, index + 1);
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(labels.sortRemoveRule)
					.onClick(() => {
						this.rules.splice(index, 1);
						this.renderBody();
					}),
			);
		});

		if (!this.rules.length) {
			body.createDiv({ cls: "hearth-tasksort-empty", text: labels.sortEmpty });
		}

		new Setting(body).addButton((b) =>
			b
				.setButtonText(labels.sortAddRule)
				.setIcon("plus")
				.setDisabled(this.rules.length >= available.length)
				.onClick(() => {
					const used = new Set(this.rules.map((r) => r.field));
					const next = available.find((f) => !used.has(f)) ?? available[0];
					this.rules.push({ field: next });
					this.renderBody();
				}),
		);
	}

	private moveRule(from: number, to: number): void {
		if (to < 0 || to >= this.rules.length) return;
		const [item] = this.rules.splice(from, 1);
		this.rules.splice(to, 0, item);
		this.renderBody();
	}

	private renderFooter(parent: HTMLElement): void {
		new Setting(parent)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.filterApply)
					.setCta()
					.onClick(() => {
						this.onSubmit(this.rules);
						this.close();
					}),
			)
			.addButton((b) =>
				b.setButtonText(t().cards.tasks.filterClear).onClick(() => {
					this.rules = [];
					this.renderBody();
				}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}


// ---- List filter ---------------------------------------------------------

/** The status-like value a task exposes for filtering: the TaskNotes status or
 * the Kanban column, whichever the source provides (checkbox tasks have neither
 * and so aren't offered status chips). */
function hitStatusValue(hit: TaskHit): string | null {
	return hit.status ?? hit.boardColumn ?? null;
}


/** The coarse priority bucket of a task for filtering. No priority — or a value
 * that doesn't map to high/medium/low — counts as "none". */
function hitPriorityLevel(hit: TaskHit): TaskPriorityLevel {
	if (!hit.priority || !hit.priority.trim()) return "none";
	const lvl = priorityLevel(hit.priority);
	return lvl === "other" ? "none" : lvl;
}


/** Whether a filter constrains anything. An all-empty filter is inactive and
 * shows everything, so the control renders as "off" and nothing is filtered. */
function isTaskFilterActive(f: TaskFilterConfig | undefined): boolean {
	if (!f) return false;
	return !!(f.statuses?.length || f.priorities?.length || f.due || (f.text && f.text.trim()));
}


/** Whether a task satisfies a due-date constraint. Dates compare as YYYY-MM-DD
 * strings; "week" means due today through seven days out. */
function taskMatchesDue(hit: TaskHit, due: TaskDueFilter, today: string): boolean {
	const raw = effectiveDate(hit);
	const d = raw ? raw.slice(0, 10) : null;
	switch (due) {
		case "hasDate":
			return !!d;
		case "noDate":
			return !d;
		case "overdue":
			return !!d && d < today && !hit.done;
		case "today":
			return d === today;
		case "week": {
			if (!d) return false;
			const end = moment(today).add(7, "day").format("YYYY-MM-DD");
			return d >= today && d <= end;
		}
	}
	return true;
}


/** Whether a task passes an active filter: it must satisfy every set criterion
 * (statuses, priorities, due, text) — unset criteria impose no constraint. */
function taskMatchesFilter(hit: TaskHit, f: TaskFilterConfig, today: string): boolean {
	if (f.statuses?.length) {
		const v = (hitStatusValue(hit) ?? "").trim().toLowerCase();
		if (!f.statuses.some((s) => s.trim().toLowerCase() === v)) return false;
	}
	if (f.priorities?.length && !f.priorities.includes(hitPriorityLevel(hit))) return false;
	if (f.due && !taskMatchesDue(hit, f.due, today)) return false;
	if (f.text && f.text.trim()) {
		const needle = f.text.trim().toLowerCase();
		if (!(hit.text || hit.file.basename).toLowerCase().includes(needle)) return false;
	}
	return true;
}


/** A filter button styled like the sort control. Shows "active" when the card
 * carries a filter, and opens a modal to edit it (presets + custom criteria). */
function renderTaskFilterControl(
	view: HomeView,
	parent: HTMLElement,
	cfg: TasksConfig,
	availableStatuses: string[],
	refresh: () => void,
): void {
	const btn = parent.createEl("button", {
		cls: "hearth-tasks-filter",
		attr: { "aria-label": t().cards.tasks.filter, title: t().cards.tasks.filter },
	});
	setIcon(btn, "list-filter");
	btn.createSpan({ cls: "hearth-tasks-filter-label", text: t().cards.tasks.filter });
	if (isTaskFilterActive(cfg.taskFilter)) btn.addClass("is-active");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		new TaskFilterModal(view.app, cfg.taskFilter ?? {}, availableStatuses, (next) => {
			cfg.taskFilter = isTaskFilterActive(next) ? next : undefined;
			void view.plugin.saveData(view.plugin.settings);
			refresh();
		}).open();
	});
}


/** The order priority chips appear in the filter modal. */
const TASK_PRIORITY_LEVELS: TaskPriorityLevel[] = ["high", "medium", "low", "none"];


/** The filter modal: quick presets across the top, then editable criteria
 * (due, priority, status, text). Edits are applied on "Apply"; "Cancel"
 * discards them and "Clear" empties every field. */
class TaskFilterModal extends Modal {
	private working: TaskFilterConfig;
	private body: HTMLElement | null = null;

	constructor(
		app: App,
		initial: TaskFilterConfig,
		private readonly availableStatuses: string[],
		private readonly onSubmit: (filter: TaskFilterConfig) => void,
	) {
		super(app);
		// Clone so Cancel truly discards edits.
		this.working = {
			statuses: [...(initial.statuses ?? [])],
			priorities: [...(initial.priorities ?? [])],
			due: initial.due,
			text: initial.text,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-taskfilter-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.filterTitle });
		this.renderPresets(contentEl);
		this.body = contentEl.createDiv("hearth-taskfilter-body");
		this.renderBody();
		this.renderFooter(contentEl);
	}

	/** Preset chips that fill in the criteria below, then re-render the body. */
	private renderPresets(parent: HTMLElement): void {
		const labels = t().cards.tasks.filterPresets;
		const row = parent.createDiv("hearth-taskfilter-presets");
		const preset = (label: string, apply: () => void) => {
			const chip = row.createEl("button", { cls: "hearth-taskfilter-chip", text: label });
			chip.addEventListener("click", () => {
				apply();
				this.renderBody();
			});
		};
		preset(labels.overdue, () => (this.working.due = "overdue"));
		preset(labels.today, () => (this.working.due = "today"));
		preset(labels.week, () => (this.working.due = "week"));
		preset(labels.highPriority, () => (this.working.priorities = ["high"]));
		preset(labels.noDate, () => (this.working.due = "noDate"));
	}

	/** The editable criteria; rebuilt whenever a preset or toggle changes them. */
	private renderBody(): void {
		const body = this.body;
		if (!body) return;
		body.empty();
		const labels = t().cards.tasks;

		// Due-date constraint (a dropdown; "" = any).
		new Setting(body).setName(labels.filterDue).addDropdown((d) => {
			d.addOption("", labels.filterDueAny);
			d.addOption("overdue", labels.filterPresets.overdue);
			d.addOption("today", labels.filterPresets.today);
			d.addOption("week", labels.filterPresets.week);
			d.addOption("hasDate", labels.filterDueHasDate);
			d.addOption("noDate", labels.filterPresets.noDate);
			d.setValue(this.working.due ?? "");
			d.onChange((v) => {
				this.working.due = v ? (v as TaskDueFilter) : undefined;
			});
		});

		// Priority buckets (multi-select chips).
		const prioRow = new Setting(body).setName(labels.filterPriority);
		const prioHost = prioRow.controlEl.createDiv("hearth-taskfilter-chips");
		for (const level of TASK_PRIORITY_LEVELS) {
			this.toggleChip(prioHost, labels.filterPriorityLevels[level], () => (this.working.priorities ?? []).includes(level), () => {
				const set = new Set(this.working.priorities ?? []);
				if (set.has(level)) set.delete(level);
				else set.add(level);
				this.working.priorities = set.size ? [...set] : undefined;
			});
		}

		// Status/column chips (only when the source exposes statuses).
		if (this.availableStatuses.length) {
			const statusRow = new Setting(body).setName(labels.filterStatus);
			const statusHost = statusRow.controlEl.createDiv("hearth-taskfilter-chips");
			for (const status of this.availableStatuses) {
				this.toggleChip(statusHost, status, () => (this.working.statuses ?? []).some((s) => s.toLowerCase() === status.toLowerCase()), () => {
					const cur = this.working.statuses ?? [];
					const has = cur.some((s) => s.toLowerCase() === status.toLowerCase());
					const next = has ? cur.filter((s) => s.toLowerCase() !== status.toLowerCase()) : [...cur, status];
					this.working.statuses = next.length ? next : undefined;
				});
			}
		}

		// Free-text substring.
		new Setting(body).setName(labels.filterText).addText((txt) => {
			txt.setPlaceholder(labels.filterTextPlaceholder).setValue(this.working.text ?? "");
			txt.onChange((v) => (this.working.text = v.trim() || undefined));
		});
	}

	/** A single multi-select chip: reflects `isOn()` and flips it on click. */
	private toggleChip(host: HTMLElement, label: string, isOn: () => boolean, flip: () => void): void {
		const chip = host.createEl("button", { cls: "hearth-taskfilter-chip", text: label });
		chip.toggleClass("is-on", isOn());
		chip.addEventListener("click", () => {
			flip();
			chip.toggleClass("is-on", isOn());
		});
	}

	private renderFooter(parent: HTMLElement): void {
		new Setting(parent)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.filterApply)
					.setCta()
					.onClick(() => {
						this.onSubmit(this.working);
						this.close();
					}),
			)
			.addButton((b) =>
				b.setButtonText(t().cards.tasks.filterClear).onClick(() => {
					this.working = {};
					this.renderBody();
				}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}


async function loadAndRenderTasks(
	view: HomeView,
	cfg: TasksConfig,
	container: HTMLElement,
	refresh: () => void,
): Promise<void> {
	container.empty();
	const source = cfg.source ?? "checkbox";

	let hits: TaskHit[];
	let boardColumns: string[] | undefined;
	if (source === "tasknotes") {
		if (!view.app.plugins.enabledPlugins.has(TASKNOTES_PLUGIN_ID)) {
			emptyState(container, "list-todo", t().cards.empty.tasksEnable);
			return;
		}
		hits = collectTaskNotesTasks(view, cfg);
	} else if (source === "kanban") {
		const board = await collectKanbanTasks(view, cfg);
		if (!board.file) {
			emptyState(container, "list-todo", t().cards.empty.kanbanNoBoard);
			return;
		}
		hits = board.hits;
		boardColumns = board.columns.map((c) => c.heading);
	} else {
		hits = await collectCheckboxTasks(view, cfg);
	}

	sortTasks(hits, cfg);

	if (cfg.layout === "kanban") {
		// TaskNotes' quick-add sits top-right over the board; sorting is per
		// column, handled inside renderTaskKanban.
		if (source === "tasknotes") taskNotesAddButton(view, container.createDiv("hearth-tasks-head"));
		renderTaskKanban(view, cfg, hits, container, refresh, boardColumns);
		return;
	}

	const today: string = moment().format("YYYY-MM-DD");

	// Distinct status/column values present, offered as filter chips (computed
	// from all hits so the choices don't shift as the filter narrows the list).
	const availableStatuses: string[] = [];
	const seenStatus = new Set<string>();
	for (const h of hits) {
		const v = hitStatusValue(h);
		if (v && !seenStatus.has(v.toLowerCase())) {
			seenStatus.add(v.toLowerCase());
			availableStatuses.push(v);
		}
	}

	// List layout: hide completed unless asked, apply any active filter, then cap.
	let list = cfg.showCompleted ? hits : hits.filter((h) => !h.done);
	if (isTaskFilterActive(cfg.taskFilter)) {
		const filter = cfg.taskFilter as TaskFilterConfig;
		list = list.filter((h) => taskMatchesFilter(h, filter, today));
	}
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 10;
	list = list.slice(0, limit);

	// The list's sort/filter/add controls — docked into the card's title header
	// when it has one, otherwise floating over the card's corner. Rendered even
	// when empty so the controls stay reachable.
	renderTasksListHeader(view, cfg, source, availableStatuses, boardColumns, container, refresh);

	if (list.length === 0) {
		const empty = isTaskFilterActive(cfg.taskFilter) ? t().cards.empty.tasksNoMatch : t().cards.empty.tasksEmpty;
		emptyState(container, "list-todo", empty);
		return;
	}

	// The card's "open" status for TaskNotes tasks: the first non-done status
	// value present. Used when a list checkbox reopens a completed task, so it
	// returns to a real open status (e.g. "open") rather than being cleared.
	// Falls back to empty (no status = open) when the card has none to offer.
	const openStatus = hits.find((h) => !h.done && h.status)?.status ?? "";

	const listEl = container.createDiv("hearth-list hearth-tasks");
	for (const hit of list) renderTaskRow(view, cfg, listEl, hit, today, refresh, openStatus);
}


function renderTaskRow(
	view: HomeView,
	cfg: TasksConfig,
	listEl: HTMLElement,
	hit: TaskHit,
	today: string,
	refresh: () => void,
	openStatus: string,
): void {
	const row = listEl.createDiv("hearth-list-item hearth-task");
	row.toggleClass("is-done", hit.done);

	if (hit.linkedFile && hit.recurrence && taskMetaEnabled(cfg, hit)) {
		// Recurring card linked to a note: complete per-occurrence in the note's
		// frontmatter (complete_instances + next scheduled), TaskNotes-style.
		renderRecurringCheckbox(view, hit, today, row, refresh, hit.linkedFile);
	} else if (hit.line >= 0 && hit.recurrence && taskMetaEnabled(cfg, hit)) {
		// Recurring checkbox / Kanban task: complete per-occurrence (stamp today's
		// ✅ and roll the date forward), resetting to open on its next date rather
		// than retiring the line.
		renderLineRecurringCheckbox(view, hit, today, row, refresh);
	} else if (hit.line >= 0) {
		const check = row.createEl("input", {
			cls: "hearth-task-check",
			attr: { type: "checkbox" },
		});
		check.checked = hit.done;
		check.addEventListener("click", (e) => e.stopPropagation());
		check.addEventListener("change", () => {
			// Keep the ✅ done date in sync only when metadata is managed for this
			// task (checkbox tasks by default, Kanban cards in extended mode); a
			// plain task stays plain.
			const done = check.checked;
			const ext = taskMetaEnabled(cfg, hit);
			void setKanbanCardDone(view, hit, done, ext).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		});
	} else if (hit.recurrence) {
		// Recurring TaskNotes tasks complete per-occurrence (complete_instances +
		// next scheduled), not by flipping status — a checkbox does that without
		// needing a status column to drag into.
		renderRecurringCheckbox(view, hit, today, row, refresh);
	} else {
		// Non-recurring TaskNotes task: a completion checkbox, matching the
		// recurring case so the list reads consistently instead of mixing
		// checkboxes with text status badges (#111). Checking sets the done
		// status; unchecking restores the card's open status — mirroring how
		// completing a TaskNotes task moves it to the next/done status.
		renderTaskNotesCheckbox(view, cfg, hit, row, refresh, openStatus);
	}

	const label = row.createDiv({ cls: "hearth-list-label hearth-task-text" });
	fillTaskText(view, label, hit.text || hit.file.basename, hit.file.path);
	// One row, so every field lands in it and the card's configured field order
	// is exactly the left-to-right order: status/column beside the title, then
	// priority, dates and any frontmatter chips.
	renderTaskFields(view, cfg, hit, { inline: row, meta: row, block: row }, today, "list");

	const open = () => void openTask(view, cfg, hit, refresh);
	row.addEventListener("click", open);
	makeClickable(row, open, hit.text || hit.file.basename);
	// Line-based tasks (Kanban cards and plain checkboxes) get the right-click
	// menu; checkboxes get the edit-details item, Kanban also convert/delete.
	if (hit.line >= 0) attachKanbanCardMenu(view, cfg, hit, row, refresh);
}


/** A Kanban board: tasks grouped into status columns, draggable between them.
 * For checkbox tasks the columns are To do / Done; for TaskNotes they're the
 * distinct status values (plus the configured "done" value). Dropping a task in
 * a column writes the new state back to the file. */
function renderTaskKanban(
	view: HomeView,
	cfg: TasksConfig,
	hits: TaskHit[],
	container: HTMLElement,
	refresh: () => void,
	boardColumns?: string[],
): void {
	const source = cfg.source ?? "checkbox";
	const doneValue = (view.plugin.settings.taskNotesDoneValue.trim() || "done");

	// Build the ordered list of columns and assign each hit to one.
	interface Column { key: string; label: string; hits: TaskHit[]; statusSymbol?: string; statusDone?: boolean }
	const columns: Column[] = [];
	const columnFor = new Map<string, Column>();
	const ensure = (key: string, label: string): Column => {
		let col = columnFor.get(key);
		if (!col) {
			col = { key, label, hits: [] };
			columnFor.set(key, col);
			columns.push(col);
		}
		return col;
	};

	if (source === "kanban") {
		// Columns are the board's own headings, kept in board order — including
		// empty lanes, so a card can be dragged into a column that has no cards
		// yet. Cards whose heading somehow isn't listed fall into "No status".
		for (const heading of boardColumns ?? []) ensure(heading.toLowerCase(), heading);
		for (const hit of hits) {
			const key = (hit.boardColumn ?? "").trim().toLowerCase();
			const col = columnFor.get(key) ?? ensure(t().cards.tasks.noStatus.toLowerCase(), t().cards.tasks.noStatus);
			col.hits.push(hit);
		}
	} else if (source === "checkbox") {
		// One column per configured checkbox status (To do / In progress / Done by
		// default), keyed by the status symbol. Cards whose symbol isn't in the
		// set fall into a column of their own so nothing is hidden.
		const statuses = checkboxStatuses(cfg);
		for (const s of statuses) {
			const col = ensure(s.symbol.toLowerCase(), s.label);
			col.statusSymbol = s.symbol;
			col.statusDone = !!s.done;
		}
		for (const hit of hits) {
			const sym = hit.checkboxStatus ?? (hit.done ? "x" : " ");
			let col = columnFor.get(sym.toLowerCase());
			if (!col) {
				col = ensure(sym.toLowerCase(), sym === " " ? t().cards.tasks.toDo : sym);
				col.statusSymbol = sym;
				col.statusDone = hit.done;
			}
			col.hits.push(hit);
		}
	} else {
		// Collect the statuses actually present, then make sure a "done" column
		// exists so tasks can be completed by dragging.
		for (const hit of hits) {
			const status = (hit.status ?? "").trim() || t().cards.tasks.noStatus;
			ensure(status.toLowerCase(), status).hits.push(hit);
		}
		if (!columnFor.has(doneValue.toLowerCase())) ensure(doneValue.toLowerCase(), doneValue);
		// Keep the done column last.
		columns.sort((a, b) => {
			const ad = a.key === doneValue.toLowerCase() ? 1 : 0;
			const bd = b.key === doneValue.toLowerCase() ? 1 : 0;
			return ad - bd || a.label.localeCompare(b.label);
		});
	}

	// Apply the user's saved column order (unlisted keys keep their default
	// position after the listed ones, since sort is stable).
	const order = cfg.kanbanOrder;
	if (order && order.length) {
		const rank = (k: string) => {
			const i = order.indexOf(k);
			return i < 0 ? Number.MAX_SAFE_INTEGER : i;
		};
		columns.sort((a, b) => rank(a.key) - rank(b.key));
	}

	const persist = () => void view.plugin.saveData(view.plugin.settings);
	const hidden = new Set(cfg.kanbanHidden ?? []);
	const visible = columns.filter((c) => !hidden.has(c.key));
	// Columns that auto-complete cards landing in them (Kanban source only).
	const doneColumns = new Set(cfg.kanbanDoneColumns ?? []);
	const extended = cfg.kanbanExtended ?? false;

	// Reorder columns by dragging their headers; persists the full key order.
	const reorder = (fromKey: string, toKey: string) => {
		if (fromKey === toKey) return;
		const keys = columns.map((c) => c.key);
		const fi = keys.indexOf(fromKey);
		const ti = keys.indexOf(toKey);
		if (fi < 0 || ti < 0) return;
		keys.splice(ti, 0, keys.splice(fi, 1)[0]);
		cfg.kanbanOrder = keys;
		persist();
		refresh();
	};

	const hideColumn = (key: string) => {
		cfg.kanbanHidden = [...new Set([...(cfg.kanbanHidden ?? []), key])];
		persist();
		refresh();
	};

	// Toggle a column as a "done column". Turning it on also completes the cards
	// already sitting in it (one batched write); future drops/adds complete
	// automatically via moveTo/addKanbanCard.
	const toggleDoneColumn = (col: Column) => {
		const set = new Set(cfg.kanbanDoneColumns ?? []);
		const turningOn = !set.has(col.key);
		if (turningOn) set.add(col.key);
		else set.delete(col.key);
		cfg.kanbanDoneColumns = set.size ? [...set] : undefined;
		persist();
		const undone = col.hits.filter((h) => !h.done);
		if (turningOn && undone.length) {
			void markCardsDone(view, undone, extended ? moment().format("YYYY-MM-DD") : undefined).then(refresh);
		} else refresh();
	};

	const board = container.createDiv("hearth-kanban");
	const today: string = moment().format("YYYY-MM-DD");

	// Move a dragged task into a target column and persist the change.
	const moveTo = (hit: TaskHit, col: Column) => {
		if (source === "kanban") {
			// Relocate the card's checkbox line under the target heading in the
			// board note. A card's done state normally stays as-is (column and
			// completion are independent), but a column marked as a "done column"
			// completes the card as it lands.
			if ((hit.boardColumn ?? "") === col.label) return;
			const markDone = doneColumns.has(col.key) || undefined;
			const doneDate = markDone && extended ? today : undefined;
			void moveKanbanCard(view, hit, col.label, markDone, doneDate).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		} else if (source === "checkbox") {
			// Write the target column's status symbol onto the checkbox; stamp/clear
			// the ✅ done date to match when metadata is managed.
			const symbol = col.statusSymbol ?? (col.statusDone ? "x" : " ");
			if ((hit.checkboxStatus ?? (hit.done ? "x" : " ")) === symbol) return;
			void setCheckboxSymbol(view, hit, symbol, !!col.statusDone, cfg.checkboxExtended ?? true).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		} else {
			// Recurring TaskNotes tasks complete per-occurrence, not by status:
			// dragging one into the "done" column marks today's instance done and
			// advances its scheduled date instead of setting status=done (which
			// would wrongly retire the whole recurring task).
			if (hit.recurrence && col.key === doneValue.toLowerCase()) {
				void completeRecurringInstance(view, hit).then(refresh);
				return;
			}
			const value = col.label === t().cards.tasks.noStatus ? "" : col.label;
			void setTaskNotesStatus(view, hit, value).then(refresh);
		}
	};

	// Each column sorts independently from its own header, falling back to the
	// card's global sort when it has no override of its own.
	const globalKey: SortKey = cfg.sortKey ?? "smart";
	const globalReverse = !!cfg.sortReverse;

	for (const col of visible) {
		const colSort = cfg.kanbanColumnSort?.[col.key] ?? {};
		// A column with its own override sorts by that; otherwise it follows the
		// card's global sort — the custom rule list when set, else the simple key.
		if (colSort.key || colSort.reverse) {
			sortHits(col.hits, colSort.key ?? globalKey, colSort.reverse ?? globalReverse);
		} else {
			sortTasks(col.hits, cfg);
		}

		const colEl = board.createDiv("hearth-kanban-col");
		colEl.toggleClass("is-done-col", doneColumns.has(col.key) || !!col.statusDone);
		const head = colEl.createDiv("hearth-kanban-col-head");
		const titleEl = head.createSpan({ cls: "hearth-kanban-col-title", text: col.label });
		// Kanban source: double-click the title to rename the board column.
		if (source === "kanban") {
			titleEl.setAttribute("title", t().cards.tasks.renameColumnHint);
			titleEl.addEventListener("dblclick", (e) => {
				e.preventDefault();
				e.stopPropagation();
				startColumnRename(view, cfg, head, titleEl, col.label, refresh);
			});
		}
		head.createSpan({ cls: "hearth-kanban-col-count", text: String(col.hits.length) });
		// Per-column sort control (icon-only). Writes into kanbanColumnSort under
		// this column's key; clearing back to Smart/forward removes the override.
		renderTaskSortControl(head, colSort, true, (next) => {
			const map = { ...(cfg.kanbanColumnSort ?? {}) };
			if (!next.key && !next.reverse) delete map[col.key];
			else map[col.key] = next;
			cfg.kanbanColumnSort = Object.keys(map).length ? map : undefined;
			persist();
			refresh();
		});
		// Kanban source: toggle whether this column auto-completes its cards.
		if (source === "kanban") {
			const isDoneCol = doneColumns.has(col.key);
			const doneBtn = head.createEl("button", {
				cls: "hearth-kanban-col-done",
				attr: {
					"aria-label": isDoneCol
						? t().cards.tasks.unsetDoneColumn(col.label)
						: t().cards.tasks.setDoneColumn(col.label),
				},
			});
			doneBtn.toggleClass("is-active", isDoneCol);
			setIcon(doneBtn, "circle-check-big");
			doneBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				toggleDoneColumn(col);
			});
		}
		const hideBtn = head.createEl("button", {
			cls: "hearth-kanban-col-hide",
			attr: { "aria-label": t().cards.tasks.hideColumn(col.label) },
		});
		setIcon(hideBtn, "eye-off");
		hideBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			hideColumn(col.key);
		});

		// Drag the header to reorder columns (distinct from dragging task cards).
		head.setAttribute("draggable", "true");
		head.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("application/hearth-col", col.key);
			colEl.addClass("is-dragging");
		});
		head.addEventListener("dragend", () => colEl.removeClass("is-dragging"));
		head.addEventListener("dragover", (e) => {
			if (e.dataTransfer?.types.includes("application/hearth-col")) {
				e.preventDefault();
				colEl.addClass("is-col-drop-target");
			}
		});
		head.addEventListener("dragleave", () => colEl.removeClass("is-col-drop-target"));
		head.addEventListener("drop", (e) => {
			const fromKey = e.dataTransfer?.getData("application/hearth-col");
			colEl.removeClass("is-col-drop-target");
			if (fromKey) {
				e.preventDefault();
				e.stopPropagation();
				reorder(fromKey, col.key);
			}
		});

		const colBody = colEl.createDiv("hearth-kanban-col-body");
		colBody.addEventListener("dragover", (e) => {
			// Only task-card drags target the column body (not header reorders).
			if (e.dataTransfer?.types.includes("application/hearth-col")) return;
			e.preventDefault();
			colBody.addClass("is-drop-target");
		});
		colBody.addEventListener("dragleave", () => colBody.removeClass("is-drop-target"));
		colBody.addEventListener("drop", (e) => {
			colBody.removeClass("is-drop-target");
			const raw = e.dataTransfer?.getData("text/plain") ?? "";
			if (!raw) return; // header reorder, handled on the header
			e.preventDefault();
			const idx = parseInt(raw, 10);
			const hit = Number.isNaN(idx) ? null : hits[idx];
			if (hit) moveTo(hit, col);
		});

		for (const hit of col.hits) {
			const idx = hits.indexOf(hit);
			const cardEl = colBody.createDiv("hearth-kanban-card");
			cardEl.toggleClass("is-done", hit.done);
			cardEl.setAttribute("draggable", "true");
			cardEl.addEventListener("dragstart", (e) => {
				e.dataTransfer?.setData("text/plain", String(idx));
				cardEl.addClass("is-dragging");
			});
			cardEl.addEventListener("dragend", () => cardEl.removeClass("is-dragging"));
			// Highlight the task card a dragged task would land on (the card
			// being hovered), with the same dashed outline as column drop.
			cardEl.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				e.preventDefault();
				e.stopPropagation();
				cardEl.addClass("is-drop-target");
			});
			cardEl.addEventListener("dragleave", () => cardEl.removeClass("is-drop-target"));
			cardEl.addEventListener("drop", (e) => {
				cardEl.removeClass("is-drop-target");
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				const raw = e.dataTransfer?.getData("text/plain") ?? "";
				if (!raw) return;
				e.preventDefault();
				e.stopPropagation();
				const fromIdx = parseInt(raw, 10);
				if (Number.isNaN(fromIdx)) return;
				const from = hits[fromIdx];
				if (!from) return;
				if (from === hit) return;
				if (from.status === hit.status) {
					// Same column: reorder within it. No fine-grained order is
					// stored (tasks sort by due), so just move to the same col.
				}
				moveTo(from, col);
			});
		// Recurring TaskNotes tasks get a per-occurrence completion checkbox
		// inline with the task text (in a row), in addition to drag: checking
		// it completes today's instance and advances scheduled without
		// retiring the task.
		const textRow = cardEl.createDiv("hearth-kanban-card-row");
		if (source === "tasknotes" && hit.recurrence) {
			renderRecurringCheckbox(view, hit, today, textRow, refresh);
		} else if (source === "kanban" && hit.linkedFile && hit.recurrence && taskMetaEnabled(cfg, hit)) {
			// Recurring card linked to a note: complete per-occurrence in the note's
			// frontmatter (complete_instances + next scheduled), TaskNotes-style.
			renderRecurringCheckbox(view, hit, today, textRow, refresh, hit.linkedFile);
		} else if (source === "kanban" && hit.line >= 0 && hit.recurrence && taskMetaEnabled(cfg, hit)) {
			// Recurring Kanban card: complete per-occurrence (stamp ✅ today, roll
			// the date forward) rather than retiring the card.
			renderLineRecurringCheckbox(view, hit, today, textRow, refresh);
		} else if (source === "kanban" && hit.line >= 0) {
			// Kanban cards are Markdown checkboxes: a checkbox toggles the card's
			// done state in place, independent of which column it's in.
			const check = textRow.createEl("input", {
				cls: "hearth-task-check",
				attr: { type: "checkbox" },
			});
			check.checked = hit.done;
			const stop = (e: Event) => e.stopPropagation();
			check.addEventListener("click", stop);
			check.addEventListener("mousedown", stop);
			check.addEventListener("pointerdown", stop);
			check.addEventListener("change", () => {
				void setKanbanCardDone(view, hit, check.checked, taskMetaEnabled(cfg, hit)).then((ok) => {
					if (!ok) new Notice(t().notices.taskChangedOnDisk);
					refresh();
				});
			});
			} else if (source === "tasknotes") {
				// Non-recurring TaskNotes card: a checkbox that advances the card to
				// the next swimlane (status column) on tick — stepping through the
				// statuses and eventually into the done column — and back to the
				// first column on untick, mirroring how a task progresses its status
				// (#111). moveTo writes the target column's status to the note.
				const check = textRow.createEl("input", {
					cls: "hearth-task-check",
					attr: { type: "checkbox" },
				});
				check.checked = hit.done;
				const stop = (e: Event) => e.stopPropagation();
				check.addEventListener("click", stop);
				check.addEventListener("mousedown", stop);
				check.addEventListener("pointerdown", stop);
				check.addEventListener("change", () => {
					const idx = visible.indexOf(col);
					const target = check.checked ? visible[idx + 1] : visible[0];
					if (target && target !== col) moveTo(hit, target);
					else refresh();
				});
		}
		const cardText = textRow.createDiv({ cls: "hearth-kanban-card-text" });
		fillTaskText(view, cardText, hit.text || hit.file.basename, hit.file.path);
			// A board card is three stacked areas, so the hosts are created up front
			// and each field lands in the one its style suits: a bare dot fits beside
			// the title, the description is its own block, everything else is a chip
			// in the meta row (where the configured order applies).
			const block = cardEl.createDiv("hearth-kanban-card-block");
			const meta = cardEl.createDiv("hearth-kanban-card-meta");
			renderTaskFields(view, cfg, hit, { inline: textRow, meta, block }, today, "kanban");
			const open = () => void openTask(view, cfg, hit, refresh);
			// A real board/checkbox line (not a note-linked card) can have its title
			// edited inline: double-click swaps the text for an input. Single click
			// still opens the card, so the open is deferred just long enough for a
			// following double-click to cancel it and start editing instead.
			const canEditTitle = hit.line >= 0 && !hit.linkedFile;
			if (canEditTitle) {
				let clickTimer: number | null = null;
				cardEl.addEventListener("click", () => {
					if (clickTimer != null) return;
					clickTimer = window.setTimeout(() => {
						clickTimer = null;
						open();
					}, 220);
				});
				cardEl.addEventListener("dblclick", (e) => {
					e.preventDefault();
					e.stopPropagation();
					if (clickTimer != null) {
						window.clearTimeout(clickTimer);
						clickTimer = null;
					}
					startCardTitleEdit(view, cfg, hit, textRow, cardText, cardEl, refresh);
				});
			} else {
				cardEl.addEventListener("click", open);
			}
			makeClickable(cardEl, open, hit.text || hit.file.basename);
			// Line-based cards (Kanban cards and plain checkboxes) get the
			// right-click menu: edit title/metadata, plus convert/delete for Kanban.
			if (hit.line >= 0) attachKanbanCardMenu(view, cfg, hit, cardEl, refresh);
		}

		// Kanban source: a per-column "add card" affordance that appends a new
		// `- [ ]` item under this column's heading in the board note.
		if (source === "kanban") {
			renderKanbanAddCard(view, cfg, col.label, colBody, refresh, {
				extended: cfg.kanbanExtended ?? false,
				markDone: doneColumns.has(col.key),
			});
		}
	}
}


/** Render a compact "+ Add card" control at the bottom of a Kanban column. On
 * click it swaps to a small form: a text input plus, in extended mode, a due
 * date and priority picker whose values are written onto the card as
 * Tasks-plugin metadata (📅 / ⏫🔼🔽). Enter or clicking away commits, Escape
 * cancels. When the column is a "done column" the new card is added completed. */
function renderKanbanAddCard(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	colBody: HTMLElement,
	refresh: () => void,
	opts: { extended: boolean; markDone: boolean },
): void {
	const addBtn = colBody.createDiv({ cls: "hearth-kanban-add" });
	setIcon(addBtn.createSpan("hearth-kanban-add-icon"), "plus");
	addBtn.createSpan({ cls: "hearth-kanban-add-label", text: t().cards.tasks.addCard });
	addBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		addBtn.hide();
		const form = colBody.createDiv({ cls: "hearth-kanban-add-form" });
		const input = form.createEl("textarea", {
			cls: "hearth-kanban-add-input",
			attr: { rows: "1", placeholder: t().cards.tasks.addCardPlaceholder },
		});

		// Extended mode: dates and priority fields for the new card (the body /
		// description is handled separately below so it can preview the template).
		const readMeta = opts.extended
			? buildTaskDetailFields(form, emptyMeta(), "", false)
			: () => ({ meta: emptyMeta(), description: "" });

		// "Create as note" toggle (per-add; defaults to the card's setting).
		const noteLabel = form.createEl("label", { cls: "hearth-kanban-add-note" });
		const noteToggle = noteLabel.createEl("input", { attr: { type: "checkbox" } });
		noteToggle.checked = !!cfg.newTaskAsNote;
		noteLabel.createSpan({ text: t().cards.tasks.createAsNote });

		// Body / description field. When creating as a note it's the note body,
		// prefilled from the configured template so it's visible and editable
		// before the note is created; otherwise it's the card's inline description.
		const bodyWrap = form.createDiv({ cls: "hearth-taskdetail" });
		const bodyRow = bodyWrap.createDiv({ cls: "hearth-taskdetail-row is-description" });
		const bodyLabel = bodyRow.createSpan({ cls: "hearth-taskdetail-label" });
		const bodyArea = bodyRow.createEl("textarea", {
			cls: "hearth-taskdetail-desc",
			attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
		});

		let prefillText = "";
		const applyPrefill = () => {
			bodyLabel.setText(noteToggle.checked ? t().cards.tasks.noteBody : t().cards.tasks.description);
			// Keep the body field out of the way for a plain (non-extended) checkbox
			// add until the user opts into notes or extended metadata.
			if (opts.extended || noteToggle.checked) bodyWrap.show();
			else bodyWrap.hide();
			if (!prefillText) return;
			if (noteToggle.checked && !bodyArea.value.trim()) bodyArea.value = prefillText;
			else if (!noteToggle.checked && bodyArea.value === prefillText) bodyArea.value = "";
		};
		noteToggle.addEventListener("change", applyPrefill);
		applyPrefill();
		// Load the template body (if any) to preview it in the field.
		const templatePath = cfg.convertNoteTemplate?.trim();
		if (templatePath) {
			const tpl =
				view.app.vault.getAbstractFileByPath(templatePath) ??
				view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
			if (tpl instanceof TFile) {
				void view.app.vault.read(tpl).then((raw) => {
					prefillText = substituteConvertDateTime(raw);
					applyPrefill();
				});
			}
		}

		input.focus();
		let committed = false;
		const cancel = () => {
			if (committed) return;
			form.remove();
			addBtn.show();
		};
		const commit = () => {
			if (committed) return;
			const text = input.value.trim();
			if (!text) return cancel();
			committed = true;
			const meta = readMeta().meta;
			const body = bodyArea.value;
			const asNote = noteToggle.checked;
			const doneDate = opts.markDone && opts.extended ? moment().format("YYYY-MM-DD") : undefined;
			// "Create as note": create the card as its own note (a link) right away
			// instead of an inline checkbox.
			const add = asNote
				? addKanbanCardAsNote(view, cfg, heading, text, meta, body, opts.markDone, doneDate)
				: addKanbanCard(view, cfg, heading, text + buildMetadataSuffix(meta), opts.markDone, doneDate, body);
			void add.then((ok) => {
				if (!ok) new Notice(t().notices.couldNotAddKanbanCard);
				refresh();
			});
		};
		input.addEventListener("keydown", (ke) => {
			if (ke.key === "Enter" && !ke.shiftKey) {
				ke.preventDefault();
				commit();
			} else if (ke.key === "Escape") {
				ke.preventDefault();
				cancel();
			}
		});
		// Commit when focus truly leaves the form; cancel if nothing was typed.
		// Deferred so moving between the text/date/priority fields (and the
		// native date picker returning focus) doesn't commit early.
		form.addEventListener("focusout", () => {
			window.setTimeout(() => {
				if (committed || form.contains(form.ownerDocument.activeElement)) return;
				if (input.value.trim()) commit();
				else cancel();
			}, 0);
		});
		form.addEventListener("click", (ce) => ce.stopPropagation());
	});
}


/** An empty metadata set. */
function emptyMeta(): TaskMeta {
	return { priority: "", recurrence: "", start: "", scheduled: "", due: "" };
}


/** Build the Tasks-plugin metadata tail for a card (e.g. " ⏫ 🔁 every week 🛫
 * 2024-01-10 ⏳ 2024-01-12 📅 2024-01-15"). Emits markers in the Tasks-plugin's
 * conventional order; omits any blank field. */
function buildMetadataSuffix(meta: TaskMeta): string {
	const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
	let s = "";
	if (meta.priority && PRIORITY_EMOJI[meta.priority]) s += ` ${PRIORITY_EMOJI[meta.priority]}`;
	if (meta.recurrence.trim()) s += ` 🔁 ${meta.recurrence.trim()}`;
	if (isDate(meta.start)) s += ` 🛫 ${meta.start}`;
	if (isDate(meta.scheduled)) s += ` ⏳ ${meta.scheduled}`;
	if (isDate(meta.due)) s += ` 📅 ${meta.due}`;
	return s;
}


/** The repeat units offered by the deterministic recurrence picker, mapped to
 * the singular word the Tasks plugin expects ("every day/week/month/year"). */
const RECURRENCE_UNITS = ["day", "week", "month", "year"] as const;


/** Parse a Tasks-plugin recurrence string into the picker's {unit, interval}.
 * Handles "every day", "every week", "every 2 weeks", etc. Unknown/empty rules
 * yield unit "" (no recurrence). */
function parseRecurrence(rule: string): { unit: string; interval: number } {
	const m = /every\s+(\d+)?\s*(day|week|month|year)s?/i.exec(rule.trim());
	if (!m) return { unit: "", interval: 1 };
	return { unit: m[2].toLowerCase(), interval: Math.max(1, parseInt(m[1] ?? "1", 10) || 1) };
}


/** Build a Tasks-plugin recurrence string from the picker's {unit, interval}
 * (e.g. "every week", "every 2 weeks"). Empty unit means no recurrence. */
function buildRecurrence(unit: string, interval: number): string {
	if (!unit) return "";
	const n = Math.max(1, interval || 1);
	return n > 1 ? `every ${n} ${unit}s` : `every ${unit}`;
}


/** Build the shared task-detail fields (priority, repeat, and start/scheduled/
 * due dates) into `parent`, prefilled from `meta`, and return a getter for the
 * current values. Repeat and the dates are mutually exclusive: setting one
 * disables and clears the other. Used by both the Kanban add-card form and the
 * edit dialog. */
function buildTaskDetailFields(
	parent: HTMLElement,
	meta: TaskMeta,
	description: string,
	allowDescription = true,
): () => { meta: TaskMeta; description: string } {
	const grid = parent.createDiv({ cls: "hearth-taskdetail" });

	const row = (labelText: string) => {
		const r = grid.createDiv({ cls: "hearth-taskdetail-row" });
		r.createSpan({ cls: "hearth-taskdetail-label", text: labelText });
		return r;
	};

	const prioRow = row(t().cards.tasks.priority);
	const prio = prioRow.createEl("select", { cls: "hearth-taskdetail-input", attr: { "aria-label": t().cards.tasks.priority } });
	for (const [value, label] of [
		["", t().cards.tasks.priorityNone],
		["highest", t().cards.tasks.priorityHighest],
		["high", t().cards.tasks.priorityHigh],
		["medium", t().cards.tasks.priorityMedium],
		["low", t().cards.tasks.priorityLow],
		["lowest", t().cards.tasks.priorityLowest],
	] as const)
		prio.createEl("option", { value, text: label });
	prio.value = meta.priority;

	// Repeat: unit dropdown + interval number (deterministic, no free text).
	const parsed = parseRecurrence(meta.recurrence);
	const repeatRow = row(t().cards.tasks.recurrenceLabel);
	const repeatUnit = repeatRow.createEl("select", { cls: "hearth-taskdetail-input", attr: { "aria-label": t().cards.tasks.recurrenceLabel } });
	repeatUnit.createEl("option", { value: "", text: t().cards.tasks.recurrenceNever });
	for (const u of RECURRENCE_UNITS)
		repeatUnit.createEl("option", { value: u, text: t().cards.tasks.recurrenceUnits[u] });
	repeatUnit.value = parsed.unit;
	const repeatEvery = repeatRow.createSpan({ cls: "hearth-taskdetail-every", text: t().cards.tasks.recurrenceEvery });
	const repeatInterval = repeatRow.createEl("input", {
		cls: "hearth-taskdetail-interval",
		attr: { type: "number", min: "1", "aria-label": t().cards.tasks.recurrenceInterval },
	});
	repeatInterval.value = String(parsed.interval);

	const dateField = (emoji: string, label: string, value: string) => {
		const r = grid.createDiv({ cls: "hearth-taskdetail-row" });
		r.createSpan({ cls: "hearth-taskdetail-label", text: `${emoji} ${label}` });
		const inp = r.createEl("input", { cls: "hearth-taskdetail-input", attr: { type: "date", "aria-label": label } });
		inp.value = value;
		return inp;
	};
	const start = dateField("🛫", t().cards.tasks.startDate, meta.start);
	const scheduled = dateField("⏳", t().cards.tasks.scheduledDate, meta.scheduled);
	const due = dateField("📅", t().cards.tasks.dueDate, meta.due);
	// A repeating card is anchored by its scheduled date only; a fixed start/due
	// date is mutually exclusive with repeating. Don't show stale start/due
	// values beside an existing repeat.
	if (parsed.unit) {
		start.value = "";
		due.value = "";
	}

	const sync = () => {
		const repeating = repeatUnit.value !== "";
		const hasFixed = start.value !== "" || due.value !== "";
		start.disabled = repeating;
		due.disabled = repeating;
		repeatUnit.disabled = hasFixed;
		repeatInterval.disabled = hasFixed || !repeating;
		repeatEvery.toggleClass("is-disabled", hasFixed || !repeating);
	};
	repeatUnit.addEventListener("change", () => {
		if (repeatUnit.value !== "") {
			start.value = "";
			due.value = "";
		}
		sync();
	});
	[start, due].forEach((d) =>
		d.addEventListener("input", () => {
			if (d.value !== "") {
				repeatUnit.value = "";
				repeatInterval.value = "1";
			}
			sync();
		}),
	);
	sync();

	// Description: plain multiline text, stored as sub-bullets under the card.
	// Only offered where nested lines are a description (Kanban cards), not for
	// plain checkboxes whose nested lines may be sub-tasks.
	let descArea: HTMLTextAreaElement | null = null;
	if (allowDescription) {
		const descRow = grid.createDiv({ cls: "hearth-taskdetail-row is-description" });
		descRow.createSpan({ cls: "hearth-taskdetail-label", text: t().cards.tasks.description });
		descArea = descRow.createEl("textarea", {
			cls: "hearth-taskdetail-desc",
			attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
		});
		descArea.value = description;
	}

	return () => {
		const repeating = repeatUnit.value !== "";
		return {
			meta: {
				priority: prio.value,
				recurrence: repeating ? buildRecurrence(repeatUnit.value, parseInt(repeatInterval.value, 10)) : "",
				start: repeating ? "" : start.value,
				scheduled: scheduled.value,
				due: repeating ? "" : due.value,
			},
			description: descArea ? descArea.value : description,
		};
	};
}


/** A modal to edit a Kanban card's dates, priority and description via {@link
 * buildTaskDetailFields}, prefilled from the card; submits the new values. */
class TaskMetadataModal extends Modal {
	private read: (() => { meta: TaskMeta; description: string }) | null = null;
	constructor(
		app: App,
		private readonly initial: TaskMeta,
		private readonly initialDescription: string,
		private readonly allowDescription: boolean,
		private readonly onSubmit: (meta: TaskMeta, description: string) => void,
	) {
		super(app);
	}
	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-taskdetail-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.editMetadata });
		this.read = buildTaskDetailFields(contentEl, this.initial, this.initialDescription, this.allowDescription);
		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						if (this.read) {
							const r = this.read();
							this.onSubmit(r.meta, r.description);
						}
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}
	onClose(): void {
		this.contentEl.empty();
	}
}


/** A compact quick-view for a line-based task, opened by clicking it: shows the
 * task title, its Tasks-plugin metadata and (for Kanban cards) description, and
 * offers to open the full note or delete the task. When the task's metadata is
 * managed (checkbox extended / Kanban extended) the fields are editable and a
 * Save button writes them back; otherwise the metadata is shown read-only. */
class TaskDetailModal extends Modal {
	private read: (() => { meta: TaskMeta; description: string }) | null = null;
	/** For a linked card, the editable description textarea (its content is
	 * written back to the note body on save). */
	private linkedDescArea: HTMLTextAreaElement | null = null;
	/** For an editable line-based card, the title input (its value is written
	 * back onto the card line on save). */
	private titleInput: HTMLTextAreaElement | null = null;
	/** Description editor shown for Kanban cards when metadata isn't managed
	 * (non-extended mode); saved as sub-bullets under the card, or — for a linked
	 * card — into its note body. Null when the extended-mode fields own it. */
	private descArea: HTMLTextAreaElement | null = null;
	constructor(
		private readonly view: HomeView,
		private readonly cfg: TasksConfig,
		private readonly hit: TaskHit,
		private readonly refresh: () => void,
	) {
		super(view.app);
	}
	onOpen(): void {
		const { contentEl } = this;
		const { view, cfg, hit } = this;
		contentEl.addClass("hearth-taskdetail-modal");
		const isKanban = !!hit.boardColumn;
		const editable = taskMetaEnabled(cfg, hit);
		// A card linked to a note stores its metadata in that note's frontmatter
		// (edited here, written back there) and its description inside the note
		// body (edited in a textarea below the metadata, written back to the note).
		const linked = !!hit.linkedFile;
		// A real board/checkbox line (not a note-linked card) can have its title
		// rewritten here; a linked card's title is its note, so it stays read-only.
		const canEditTitle = hit.line >= 0 && !linked;

		if (canEditTitle) {
			const titleInput = contentEl.createEl("textarea", {
				cls: "hearth-taskdetail-title-edit",
				attr: { rows: "1", "aria-label": t().cards.tasks.editTitle, placeholder: t().cards.tasks.titlePlaceholder },
			});
			titleInput.value = hit.text || "";
			this.titleInput = titleInput;
		} else {
			const title = contentEl.createEl("h3", { cls: "hearth-taskdetail-title" });
			fillTaskText(view, title, hit.text || hit.file.basename, hit.file.path);
		}

		if (editable) {
			const current: TaskMeta = {
				priority: priorityKey(hit.priority),
				recurrence: hit.recurrence ?? "",
				start: hit.start ?? "",
				scheduled: hit.scheduled ?? "",
				due: hit.due ?? "",
			};
			this.read = buildTaskDetailFields(contentEl, current, hit.description ?? "", isKanban && !linked);
			if (linked && hit.linkedFile) {
				// Description lives inside the linked note — edit it in its own
				// textarea, prefilled from the note body once it loads.
				const descWrap = contentEl.createDiv({ cls: "hearth-taskdetail" });
				const descRow = descWrap.createDiv({ cls: "hearth-taskdetail-row is-description" });
				descRow.createSpan({ cls: "hearth-taskdetail-label", text: t().cards.tasks.description });
				const area = descRow.createEl("textarea", {
					cls: "hearth-taskdetail-desc",
					attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
				});
				this.linkedDescArea = area;
				void readNoteDescription(view, hit.linkedFile).then((desc) => {
					// Don't clobber edits the user already started typing.
					if (!area.value) area.value = desc;
				});
			}
		} else {
			// Read-only summary of whatever metadata the task carries (from the card
			// or, for a linked card, its note's frontmatter) — metadata editing stays
			// behind the "Dates & priorities" toggle. The description, however, is
			// editable here for Kanban cards even with that toggle off.
			const today: string = moment().format("YYYY-MM-DD");
			const chips = contentEl.createDiv("hearth-taskdetail-readonly");
			// The quick view is the task's detail sheet, so it shows every piece of
			// metadata in its default style — independent of which fields the card
			// it was opened from happens to display.
			if (hit.priority) renderPriority(chips, { id: "priority" }, hit.priority, "pill");
			for (const id of ["start", "scheduled", "due", "doneDate"] as const) {
				renderTaskDateField(chips, hit, id, today, "text");
			}
			if (!chips.childNodes.length)
				chips.createSpan({ cls: "hearth-taskdetail-empty", text: t().cards.tasks.noMetadata });
			if (isKanban) {
				// Kanban card: an editable description (sub-bullets under the card, or
				// the note body for a linked card).
				const descWrap = contentEl.createDiv({ cls: "hearth-taskdetail" });
				const descRow = descWrap.createDiv({ cls: "hearth-taskdetail-row is-description" });
				descRow.createSpan({ cls: "hearth-taskdetail-label", text: t().cards.tasks.description });
				const area = descRow.createEl("textarea", {
					cls: "hearth-taskdetail-desc",
					attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
				});
				this.descArea = area;
				if (linked && hit.linkedFile) {
					void readNoteDescription(view, hit.linkedFile).then((desc) => {
						// Don't clobber edits the user already started typing.
						if (!area.value) area.value = desc;
					});
				} else {
					area.value = hit.description ?? "";
				}
			} else if (hit.description) {
				// Plain checkbox: nested lines may be sub-tasks, so show read-only.
				renderTaskDescription(contentEl, hit.description);
			}
		}

		const actions = new Setting(contentEl);
		if (editable || canEditTitle || this.descArea) {
			actions.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						const r = this.read?.();
						const linkedDescArea = this.linkedDescArea;
						const ownDescArea = this.descArea;
						const newTitle = this.titleInput?.value.trim();
						void (async () => {
							// Write metadata first (it also rewrites the description
							// sub-bullets and preserves the card's current title), then the
							// title — that order keeps each write's stored-line guard matching.
							if (r) {
								const ok = await setKanbanCardMetadata(view, hit, r.meta, r.description);
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
							} else if (ownDescArea && !hit.linkedFile) {
								// Non-extended Kanban card: description-only write (no metadata
								// managed, so the card's markers are left untouched).
								const ok = await setKanbanCardDescription(view, hit, ownDescArea.value);
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
							}
							if (canEditTitle && newTitle && newTitle !== (hit.text || "")) {
								const ok = await setKanbanCardText(view, hit, newTitle, editable);
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
							}
							// A linked card's description is written back to the note body,
							// whichever mode edited it.
							const linkedDesc = linkedDescArea ?? ownDescArea;
							if (hit.linkedFile && linkedDesc) await writeNoteDescription(view, hit.linkedFile, linkedDesc.value);
							this.refresh();
						})();
						this.close();
					}),
			);
		}
		actions.addButton((b) =>
			b
				.setButtonText(t().cards.tasks.openNote)
				.setIcon("file-symlink")
				.onClick(() => {
					this.close();
					void openTaskFile(view, hit);
				}),
		);
		actions.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().cards.tasks.deleteTask)
				.onClick(() => {
					confirmAction(view.app, {
						title: t().cards.tasks.deleteTask,
						message: t().cards.tasks.deleteTaskConfirm,
						confirmText: t().cards.tasks.deleteTask,
						onConfirm: () => {
							void deleteKanbanCard(view, hit).then((ok) => {
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
								this.refresh();
								this.close();
							});
						},
					});
				}),
		);
	}
	onClose(): void {
		this.contentEl.empty();
	}
}


/** Scan plain Markdown `- [ ]`/`- [x]` checkboxes in every in-scope note,
 * reading the full obsidian-tasks emoji metadata (priority, repeat, and the
 * start/scheduled/due/done dates) off each line — the same set the Kanban
 * source understands — so plain checkboxes get the same indicators, sorting and
 * editing. The metadata is stripped from the displayed text. When the card's
 * "Dates & priorities" toggle is off, checkboxes are read as plain text: the
 * emoji stay in the visible text and no dates/priority are parsed. */
async function collectCheckboxTasks(view: HomeView, cfg: TasksConfig): Promise<TaskHit[]> {
	const extended = cfg.checkboxExtended ?? true;
	const statuses = checkboxStatuses(cfg);
	// Symbols recognised as tasks: the configured ones, plus the always-valid
	// blank/done marks. Anything else inside `- [ ]` is left alone (so a stray
	// `- [1]` reference isn't mistaken for a task).
	const known = new Map(statuses.map((s) => [s.symbol.toLowerCase(), s]));
	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		// Obsidian's metadata cache already indexes which list items are tasks
		// (`listItems[].task`), so a note with none can be skipped without the
		// read + per-line regex scan — the dominant cost when the scope holds
		// many task-free notes. Only skip when the cache is actually present:
		// if a file isn't indexed yet (cache == null, e.g. right after
		// creation) fall back to the full scan so its tasks still show, healing
		// on the metadataCache "changed" redraw once indexing catches up.
		const cache = view.app.metadataCache.getFileCache(file);
		if (cache && !cache.listItems?.some((li) => li.task !== undefined)) continue;
		const content = await view.app.vault.cachedRead(file);
		const lines = content.split("\n");
		lines.forEach((line, i) => {
			const match = /^\s*[-*+]\s\[(.)\]\s*(.*)$/.exec(line);
			if (!match) return;
			const symbol = match[1];
			const st = known.get(symbol.toLowerCase());
			// Only known status symbols (or the built-in blank/done marks) count.
			if (!st && !/[ xX]/.test(symbol)) return;
			const raw = match[2].trim();
			if (!raw) return; // ignore empty checkboxes ("- [ ]")
			const done = st ? !!st.done : symbol.toLowerCase() === "x";
			if (!extended) {
				// Plain mode: keep the line's text verbatim, no metadata parsing.
				hits.push({
					file,
					line: i,
					text: raw,
					done,
					checkboxStatus: symbol,
					due: null,
					dueRaw: null,
					scheduled: null,
					start: null,
					doneDate: null,
					created: file.stat.ctime,
				});
				return;
			}
			// The due date accepts natural-language wording (today, next friday,
			// in 3 days, …) which we resolve to a date; the rest are ISO dates.
			const dueExpr = readEmojiField(raw, "📅");
			let due: string | null = null;
			let dueRaw: string | null = null;
			if (dueExpr) {
				dueRaw = dueExpr;
				due = resolveDate(dueExpr);
			}
			hits.push({
				file,
				line: i,
				text: stripTaskMetadata(raw),
				done,
				checkboxStatus: symbol,
				due,
				dueRaw,
				scheduled: readEmojiDate(raw, "⏳") || null,
				start: readEmojiDate(raw, "🛫") || null,
				doneDate: readEmojiDate(raw, "✅") || null,
				created: file.stat.ctime,
				recurrence: readEmojiField(raw, "🔁") ?? undefined,
				priority: readPriorityEmoji(raw),
			});
		});
	}
	return hits;
}


/** Read TaskNotes task notes directly via frontmatter (see TasksConfig.source
 * doc for why: no stable public API, and field names are user-remappable).
 * Only files that actually have the configured status field are treated as
 * tasks, so unrelated notes with a `due` or `priority` property aren't
 * mistaken for one. */
/** Build a predicate deciding whether a TaskNotes status value counts as
 * complete. If the card lists its own complete statuses (`taskNotesDoneStatuses`,
 * e.g. "done" + "canceled") those win; otherwise the single global done value
 * (Settings → Hearth) is used. Comparison is case-insensitive. */
function doneStatusMatcher(cfg: TasksConfig, globalDoneValue: string): (status: string) => boolean {
	const custom = (cfg.taskNotesDoneStatuses ?? [])
		.map((v) => v.trim().toLowerCase())
		.filter(Boolean);
	const done = custom.length ? new Set(custom) : new Set([globalDoneValue.trim().toLowerCase() || "done"]);
	return (status: string) => done.has(status.trim().toLowerCase());
}


/** Coerce a frontmatter scalar to a string, treating missing, empty, or
 * non-scalar (object/array) values as absent. Guards against a YAML object
 * being rendered as the literal "[object Object]" in task metadata. */
function scalarField(v: unknown): string | undefined {
	if (typeof v === "string") return v || undefined;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	return undefined;
}


function collectTaskNotesTasks(view: HomeView, cfg: TasksConfig): TaskHit[] {
	const s = view.plugin.settings;
	const statusField = s.taskNotesStatusField.trim() || "status";
	const dueField = s.taskNotesDueField.trim() || "due";
	const priorityField = s.taskNotesPriorityField.trim() || "priority";
	// Which status values count as complete. A per-card list (e.g. "done" +
	// "canceled") overrides the single global done value; otherwise fall back to
	// that global value alone.
	const isDone = doneStatusMatcher(cfg, s.taskNotesDoneValue);

	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const cache = view.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || !(statusField in fm)) continue;
		const status = String(fm[statusField] ?? "");
		const dueRawVal: unknown = fm[dueField];
		// TaskNotes stores due as YYYY-MM-DD by convention, but users may have
		// written a natural-language date — resolve either to YYYY-MM-DD and
		// keep the raw wording for display.
		let due: string | null = null;
		let dueRaw: string | null = null;
		if (typeof dueRawVal === "string" && dueRawVal.trim()) {
			const expr = dueRawVal.trim();
			dueRaw = expr;
			due = resolveDate(expr);
		}
		// TaskNotes' scheduled field is conventionally "scheduled"; read it as
		// a fallback sort key when no due date is set.
		const scheduledRaw: unknown = fm["scheduled"];
		const scheduled: string | null = typeof scheduledRaw === "string" ? scheduledRaw : null;
		const priority = scalarField(fm[priorityField]);
		// TaskNotes stores the recurrence rule in a "recurrence" frontmatter
		// field (an RRULE like "FREQ=WEEKLY;INTERVAL=1" or "RRULE:FREQ=DAILY").
		const recurrence = scalarField(fm["recurrence"]);
		// TaskNotes records each completed occurrence of a recurring task as a
		// YYYY-MM-DD entry in "complete_instances". Read it so the completion
		// checkbox can reflect today's state and avoid double-completing.
		const ciRaw: unknown = fm["complete_instances"];
		const completeInstances: string[] = Array.isArray(ciRaw)
			? ciRaw.map((v) => String(v)).filter(Boolean)
			: [];
		hits.push({
			file,
			line: -1,
			text: String(fm.title ?? file.basename),
			done: isDone(status),
			due,
			dueRaw,
			scheduled,
			created: file.stat.ctime,
			recurrence,
			completeInstances,
			status,
			priority,
		});
	}
	return hits;
}


// ---- Kanban plugin board -------------------------------------------------

/** Resolve the Kanban board note for a card. Prefers the explicitly configured
 * `kanbanFile` path; otherwise auto-detects the first in-scope note whose
 * frontmatter carries the `kanban-plugin` key the Kanban plugin writes. */
function resolveKanbanFile(app: App, cfg: TasksConfig): TFile | null {
	const path = cfg.kanbanFile?.trim();
	if (path) {
		const f = app.vault.getAbstractFileByPath(path);
		return f instanceof TFile ? f : null;
	}
	for (const file of app.vault.getMarkdownFiles()) {
		if (!inTaskScope(file.path, cfg)) continue;
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm && KANBAN_FRONTMATTER_KEY in fm) return file;
	}
	return null;
}


/** Parse a Kanban board's `##` headings into ordered columns with the line
 * range that holds each column's cards. Frontmatter and the trailing
 * `%% kanban:settings` block are excluded. `footerStart` marks where the
 * settings block begins (or EOF), so callers never write past the cards. */
function parseKanbanColumns(lines: string[]): { columns: KanbanColumn[]; footerStart: number } {
	let footerStart = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (KANBAN_SETTINGS_RE.test(lines[i])) {
			footerStart = i;
			break;
		}
	}
	// Skip YAML frontmatter so a `---` fence isn't mistaken for content.
	let start = 0;
	if (lines[0]?.trim() === "---") {
		for (let i = 1; i < footerStart; i++) {
			if (lines[i].trim() === "---") {
				start = i + 1;
				break;
			}
		}
	}
	const columns: KanbanColumn[] = [];
	for (let i = start; i < footerStart; i++) {
		const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
		if (!m) continue;
		if (columns.length) columns[columns.length - 1].endLine = i;
		columns.push({ heading: m[1].trim(), headingLine: i, endLine: footerStart });
	}
	return { columns, footerStart };
}


/** The checkbox-item pattern shared by the Kanban parser (a card is a plain
 * Markdown task item, same as a checkbox task). The status char may be any
 * single character so custom statuses (`[/]`, `[-]`, …) are handled too. */
const KANBAN_CARD_RE = /^\s*[-*+]\s\[(.)\]\s*(.*)$/;


/** The extent of a Kanban card starting at `cardLine`: its item line plus any
 * deeper-indented, non-blank continuation lines (the card's description). `end`
 * is the exclusive line after the block; `descLines` is the continuation text
 * with its indentation and any list marker stripped. */
function cardBlockRange(lines: string[], cardLine: number): { end: number; descLines: string[] } {
	const indent = (/^(\s*)/.exec(lines[cardLine])?.[1] ?? "").length;
	const descLines: string[] = [];
	let end = cardLine + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		descLines.push(l.replace(/^\s*(?:[-*+]\s+)?/, ""));
		end++;
	}
	return { end, descLines };
}


/** Build the nested description bullet lines for a card whose item line has the
 * given indent (each non-empty description line becomes an indented `- ` item,
 * one level deeper). */
function descriptionBullets(description: string, itemIndent: string): string[] {
	return description
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => `${itemIndent}\t- ${l}`);
}


/** If `text` is essentially a single link to a note (`[[Note]]`, `[[Note|alias]]`
 * or `[alias](Note.md)`) — the shape "Convert to note" leaves on the board —
 * return the resolved note, else null. */
function soleLinkedNote(view: HomeView, text: string, sourcePath: string): TFile | null {
	const s = text.trim();
	let target: string | null = null;
	const wiki = /^\[\[([^\]]+?)\]\]$/.exec(s);
	if (wiki) {
		target = wiki[1].split("|")[0].trim();
	} else {
		const md = /^\[[^\]]*\]\(([^)]+?)\)$/.exec(s);
		if (md) {
			try {
				target = decodeURIComponent(md[1].trim());
			} catch {
				target = md[1].trim();
			}
		}
	}
	if (!target) return null;
	// Drop any heading/block anchor and a trailing ".md" so linkpath resolution
	// matches whether the link was written as a path or a bare basename.
	target = target.replace(/[#^].*$/, "").replace(/\.md$/i, "").trim();
	if (!target) return null;
	const f = view.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	return f instanceof TFile ? f : null;
}


/** Read a linked note's body (frontmatter stripped) as plain description lines,
 * with any leading list marker removed. Joined with "\n"; empty when the note
 * has no body. Used to show a converted card's description "inside the note". */
async function readNoteDescription(view: HomeView, file: TFile): Promise<string> {
	let content: string;
	try {
		content = await view.app.vault.cachedRead(file);
	} catch {
		return "";
	}
	const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	return body
		.split(/\r?\n/)
		.map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim())
		.filter(Boolean)
		.join("\n");
}


/** Write a linked note's description (the body below its frontmatter) from the
 * quick-view editor: keeps the frontmatter intact and replaces the body with the
 * edited lines as bullet points. */
async function writeNoteDescription(view: HomeView, file: TFile, description: string): Promise<void> {
	try {
		const content = await view.app.vault.read(file);
		const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content)?.[0] ?? "";
		const bullets = description
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => `- ${l}`)
			.join("\n");
		const next = fm ? (bullets ? `${fm.replace(/\r?\n?$/, "\n")}\n${bullets}\n` : fm) : bullets ? `${bullets}\n` : "";
		await view.app.vault.modify(file, next);
	} catch {
		new Notice(t().notices.taskChangedOnDisk);
	}
}


/** Read a Kanban board note: each `##` heading is a column and each checkbox
 * item beneath it is a card. In extended mode the Tasks-plugin emoji metadata
 * (📅 due, ⏫/🔼/🔽 priority, 🔁 recurrence) is parsed off each card so due dates
 * and priorities display and sort; otherwise cards are read as-is (plain text).
 * Returns the ordered columns too, so the Kanban layout can show empty lanes. */
async function collectKanbanTasks(
	view: HomeView,
	cfg: TasksConfig,
): Promise<{ hits: TaskHit[]; columns: KanbanColumn[]; file: TFile | null }> {
	const file = resolveKanbanFile(view.app, cfg);
	if (!file) return { hits: [], columns: [], file: null };
	const content = await view.app.vault.cachedRead(file);
	const lines = content.split("\n");
	const { columns } = parseKanbanColumns(lines);
	const extended = cfg.kanbanExtended ?? false;
	const hits: TaskHit[] = [];
	for (const col of columns) {
		let i = col.headingLine + 1;
		while (i < col.endLine) {
			const m = KANBAN_CARD_RE.exec(lines[i]);
			if (!m) {
				i++;
				continue;
			}
			const { end, descLines } = cardBlockRange(lines, i);
			const rawText = m[2].trim();
			if (!rawText) {
				// Ignore empty checkboxes ("- [ ]") and skip past their block.
				i = end;
				continue;
			}
			let text = rawText;
			let due: string | null = null;
			let dueRaw: string | null = null;
			let scheduled: string | null = null;
			let start: string | null = null;
			let doneDate: string | null = null;
			let priority: string | undefined;
			let recurrence: string | undefined;
			if (extended) {
				const dueExpr = readEmojiField(rawText, "📅");
				if (dueExpr) {
					dueRaw = dueExpr;
					due = resolveDate(dueExpr);
				}
				scheduled = readEmojiDate(rawText, "⏳") || null;
				start = readEmojiDate(rawText, "🛫") || null;
				doneDate = readEmojiDate(rawText, "✅") || null;
				priority = readPriorityEmoji(rawText);
				recurrence = readEmojiField(rawText, "🔁") ?? undefined;
				text = stripTaskMetadata(rawText);
			}
			// A card that is just a link to a note (as "Convert to note" produces)
			// is treated as that note: metadata missing from the card is read from
			// the note's frontmatter so it still shows and sorts, and "open note"
			// opens the linked note.
			const linkedFile = soleLinkedNote(view, extended ? text : stripTaskMetadata(rawText), file.path);
			let completeInstances: string[] | undefined;
			if (extended && linkedFile) {
				const fm = view.app.metadataCache.getFileCache(linkedFile)?.frontmatter;
				if (fm) {
					const fmStr = (k: string): string | null => {
						const v: unknown = fm[k];
						return typeof v === "string" && v.trim() ? v.trim() : null;
					};
					if (!due) {
						const d = fmStr("due");
						if (d) {
							dueRaw = d;
							due = resolveDate(d);
						}
					}
					scheduled = scheduled || fmStr("scheduled");
					start = start || fmStr("start");
					doneDate = doneDate || fmStr("done");
					const fmPrio = fmStr("priority");
					if (!priority && fmPrio) priority = PRIORITY_EMOJI[fmPrio] ?? fmPrio;
					recurrence = recurrence || fmStr("recurrence") || undefined;
					const ci: unknown = fm["complete_instances"];
					if (Array.isArray(ci)) completeInstances = ci.map((v) => String(v)).filter(Boolean);
				}
			}
			hits.push({
				file,
				line: i,
				text,
				done: m[1].toLowerCase() === "x",
				due,
				dueRaw,
				scheduled,
				start,
				doneDate,
				created: file.stat.ctime,
				recurrence,
				priority,
				boardColumn: col.heading,
				description: descLines.join("\n"),
				linkedFile,
				completeInstances,
			});
			i = end;
		}
	}
	return { hits, columns, file };
}


/** Every Tasks-plugin metadata emoji marker, used to strip metadata from a
 * card's display text and to compare cards ignoring their metadata. */
const TASK_EMOJI_CLASS = "📅⏳🛫🔁✅❌➕⏫🔼🔽🔺⏬";


/** The subset of metadata emoji Hearth's editor manages (due/scheduled/start/
 * recurrence/priority). Completion (✅), created (➕) and cancelled (❌) markers
 * are left untouched when rewriting a card's metadata. */
const MANAGED_EMOJI_CLASS = "📅⏳🛫🔁⏫🔼🔽🔺⏬";


/** The single source of truth for turning a raw date expression — an ISO date
 * (YYYY-MM-DD) or natural-language wording ("today", "next friday", "in 3
 * days") — into a validated YYYY-MM-DD, or null when it isn't a real date. Both
 * the task card and the detail modal resolve dates through here (via the fields
 * they read), so they can never disagree about what a string means. Crucially
 * there is NO "already ISO-shaped, pass it through" shortcut: an impossible ISO
 * date (2026-02-31, month 13) is calendar-invalid and resolves to null rather
 * than leaking to the card as a bogus date. `parseNaturalDate` already accepts
 * any valid ISO date verbatim (regardless of how far out), so nothing valid is
 * lost. */
function resolveDate(expr: string): string | null {
	return parseNaturalDate(expr);
}


/** Read a Tasks-plugin date field (e.g. 📅) and resolve it to YYYY-MM-DD, or
 * "" when absent/unparseable. Accepts natural-language wording. */
function readEmojiDate(text: string, emoji: string): string {
	const expr = readEmojiField(text, emoji);
	if (!expr) return "";
	return resolveDate(expr) ?? "";
}


/** Strip all Tasks-plugin emoji metadata (each marker and its trailing value up
 * to the next marker) from a task's text, collapsing leftover whitespace. Used
 * for clean Kanban card display and for stable text comparison on writeback
 * (idempotent, so a raw and an already-stripped text compare equal). */
function stripTaskMetadata(text: string): string {
	const re = new RegExp(`[${TASK_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	return text.replace(re, "").replace(/\s+/g, " ").trim();
}


/** Add or remove the Tasks-plugin done-date marker (✅ YYYY-MM-DD) on a card's
 * text: any existing ✅ field is dropped, then today's is appended when `done`.
 * Used to keep the completion date in sync as cards are checked/unchecked. */
function withDoneDate(text: string, done: boolean, today: string): string {
	const re = new RegExp(`✅[^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = text.replace(re, "").replace(/\s+/g, " ").trim();
	return done ? `${base} ✅ ${today}`.trim() : base;
}


/** Set (or, when null, remove) a Tasks-plugin date field (e.g. 📅/⏳/🛫) on a
 * task's text to `date`, replacing any existing value for that marker. */
function withEmojiDate(text: string, emoji: string, date: string | null): string {
	const re = new RegExp(`${emoji}[^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = text.replace(re, "").replace(/\s+/g, " ").trim();
	return date ? `${base} ${emoji} ${date}`.trim() : base;
}


/** Complete (or un-complete) the current occurrence of a recurring checkbox /
 * Kanban task in place, TaskNotes-style: the line stays unchecked (a recurring
 * task never retires) but on completion its ✅ done date is stamped to today and
 * its reference date (📅 due, else ⏳ scheduled, else 🛫 start) rolls forward to
 * the next occurrence — so it reads as done today and resets to open on its next
 * date. Un-completing removes today's ✅ and rolls the reference date back to
 * today. Bails (false) when the stored line no longer matches. */
async function setLineRecurringInstanceDone(
	view: HomeView,
	hit: TaskHit,
	done: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const today: string = moment().format("YYYY-MM-DD");
	const rule = hit.recurrence ?? readEmojiField(m[2], "🔁") ?? "";
	// The reference date the recurrence advances: due first, then scheduled, then
	// start (whichever the card carries).
	const refEmoji = readEmojiField(m[2], "📅")
		? "📅"
		: readEmojiField(m[2], "⏳")
			? "⏳"
			: readEmojiField(m[2], "🛫")
				? "🛫"
				: null;
	let body = withDoneDate(m[2], false, today); // strip any existing ✅ first
	if (done) {
		if (refEmoji) {
			const curRef = readEmojiDate(m[2], refEmoji);
			// Advance from whichever is later — the card's date or today — so a
			// same-day or overdue occurrence lands on a future date.
			const from = curRef && curRef > today ? curRef : today;
			const next = nextRecurrenceDate(rule, from);
			if (next) body = withEmojiDate(body, refEmoji, next);
		}
		body = `${body} ✅ ${today}`.trim();
	} else if (refEmoji) {
		// Restore the occurrence being un-completed to today.
		body = withEmojiDate(body, refEmoji, today);
	}
	// A recurring task never retires its line — keep the checkbox unchecked so it
	// stays open; today's completion is tracked by the ✅ date instead.
	const prefix = cur
		.slice(0, cur.length - m[2].length)
		.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre} ${post}`);
	lines[hit.line] = `${prefix}${body}`.trimEnd();
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Flip a Kanban card's checkbox to `done` in place, and — in extended mode —
 * add/remove its ✅ done date to match. Bails (false) if the stored line no
 * longer matches the card. */
async function setKanbanCardDone(
	view: HomeView,
	hit: TaskHit,
	done: boolean,
	extended: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const marker = cur
		.slice(0, cur.length - m[2].length)
		.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}${done ? "x" : " "}${post}`);
	const body = extended ? withDoneDate(m[2], done, moment().format("YYYY-MM-DD")) : m[2];
	lines[hit.line] = `${marker}${body}`;
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Move a Kanban card's checkbox line (plus any nested continuation lines) out
 * of its current column and under `targetHeading` in the board note. The card's
 * done state normally stays as-is (column and completion are independent), but
 * when `markDone` is set — the target is a "done column" — the card is checked
 * as it lands. Bails (returning false) if the stored line no longer matches. */
async function moveKanbanCard(
	view: HomeView,
	hit: TaskHit,
	targetHeading: string,
	markDone?: boolean,
	doneDate?: string,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m) return false; // line changed under us
	if (stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;

	// Capture the card block: the item line plus any deeper-indented, non-blank
	// continuation lines (nested content that belongs to the card).
	const indent = (/^(\s*)/.exec(cur)?.[1] ?? "").length;
	let end = hit.line + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		end++;
	}
	const block = lines.slice(hit.line, end);
	if (markDone) {
		const bm = KANBAN_CARD_RE.exec(block[0]);
		const bodyMarker = block[0]
			.slice(0, block[0].length - (bm?.[2].length ?? 0))
			.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}x${post}`);
		const body = doneDate && bm ? withDoneDate(bm[2], true, doneDate) : bm?.[2] ?? "";
		block[0] = `${bodyMarker}${body}`;
	}
	// Also drop one trailing blank line so blanks don't accumulate on each move.
	let removeEnd = end;
	if (lines[removeEnd]?.trim() === "") removeEnd++;
	lines.splice(hit.line, removeEnd - hit.line);

	if (!insertCardBlock(lines, targetHeading, block)) return false;
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Append a new card under `heading` in the configured board note, checked when
 * `markDone` (the target is a "done column") and unchecked otherwise. Any
 * `description` is written as plain-text sub-bullets under the card. */
async function addKanbanCard(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	text: string,
	markDone?: boolean,
	doneDate?: string,
	description?: string,
): Promise<boolean> {
	const file = resolveKanbanFile(view.app, cfg);
	if (!file) return false;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	let body = text.replace(/\r?\n/g, " ").trim();
	if (markDone && doneDate) body = withDoneDate(body, true, doneDate);
	const block = [`- [${markDone ? "x" : " "}] ${body}`, ...descriptionBullets(description ?? "", "")];
	if (!insertCardBlock(lines, heading, block)) return false;
	await view.app.vault.modify(file, lines.join("\n"));
	return true;
}


/** Add a new Kanban card as its own note (a link on the board) instead of an
 * inline checkbox — the same result as adding a card and immediately converting
 * it, honouring the card's convert-to-note template and metadata-to-frontmatter
 * options. Creates the note (template + description bullets, and frontmatter
 * metadata when scraping), then inserts a link card into `heading`'s column. */
async function addKanbanCardAsNote(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	title: string,
	meta: TaskMeta,
	noteBody: string,
	markDone?: boolean,
	doneDate?: string,
): Promise<boolean> {
	const board = resolveKanbanFile(view.app, cfg);
	if (!board) return false;
	const safeTitle =
		(title || "Untitled").replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
	let note: TFile;
	try {
		const parent = view.app.fileManager.getNewFileParent(board.path);
		const folder = parent instanceof TFolder ? parent : view.app.vault.getRoot();
		note = await view.app.fileManager.createNewMarkdownFile(folder, safeTitle);
	} catch {
		return false;
	}
	// The note body is whatever the add form assembled (a template preview the
	// user may have edited, or plain text) with {{title}} resolved now.
	const body = applyConvertTemplate(noteBody ?? "", safeTitle).replace(/\s+$/, "");
	if (body) await view.app.vault.modify(note, `${body}\n`);

	// Metadata: to the note's frontmatter when scraping, else onto the board link
	// as emoji markers (matching convert-to-note).
	const scrape = cfg.convertMetadataToFrontmatter ?? false;
	if (scrape) {
		await writeMetadataFrontmatter(view, note, meta);
		if (markDone && doneDate) {
			try {
				await view.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
					fm["done"] = doneDate;
				});
			} catch {
				// Frontmatter write failed — the note and link are still created.
			}
		}
	}

	const content = await view.app.vault.read(board);
	const lines = content.split("\n");
	const link = view.app.fileManager.generateMarkdownLink(note, board.path);
	let cardBody = link;
	if (!scrape) {
		cardBody = `${link}${buildMetadataSuffix(meta)}`;
		if (markDone && doneDate) cardBody = withDoneDate(cardBody, true, doneDate);
	}
	const block = [`- [${markDone ? "x" : " "}] ${cardBody}`.trimEnd()];
	if (!insertCardBlock(lines, heading, block)) return false;
	await view.app.vault.modify(board, lines.join("\n"));
	return true;
}


/** Mark a batch of Kanban cards (all in the same board note) done in a single
 * write, stamping the ✅ done date when `doneDate` is given. Skips any line that
 * no longer matches its card. Used when a column is toggled into a "done
 * column" so the cards already in it complete at once. */
async function markCardsDone(view: HomeView, hits: TaskHit[], doneDate?: string): Promise<void> {
	if (!hits.length) return;
	const file = hits[0].file;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	let changed = false;
	for (const hit of hits) {
		const line = lines[hit.line];
		const m = line != null ? KANBAN_CARD_RE.exec(line) : null;
		if (!m) continue;
		if (stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) continue;
		const marker = line
			.slice(0, line.length - m[2].length)
			.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}x${post}`);
		const body = doneDate ? withDoneDate(m[2], true, doneDate) : m[2];
		lines[hit.line] = `${marker}${body}`;
		changed = true;
	}
	if (changed) await view.app.vault.modify(file, lines.join("\n"));
}


/** Attach a right-click menu to a task row/card. Every metadata-capable task
 * (Kanban cards, and plain checkboxes — which always read their marks) offers
 * "Edit dates & priority"; Kanban cards additionally offer convert-to-note and
 * delete. Kanban cards get a description field in the editor; checkboxes don't
 * (their nested lines may be sub-tasks, not a description). */
function attachKanbanCardMenu(
	view: HomeView,
	cfg: TasksConfig,
	hit: TaskHit,
	el: HTMLElement,
	refresh: () => void,
): void {
	const isKanban = !!hit.boardColumn;
	// Metadata editing is offered wherever the marks are managed (checkboxes by
	// default, Kanban cards in extended mode). A card linked to a note edits its
	// note's frontmatter instead of the board line (handled in setKanbanCardMetadata).
	const canEditMeta = taskMetaEnabled(cfg, hit);
	// Nothing to show for a plain checkbox with metadata off — leave the native
	// context menu alone rather than popping an empty one.
	if (!canEditMeta && !isKanban) return;
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const menu = new Menu();
		if (canEditMeta) {
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.editMetadata)
					.setIcon("calendar-clock")
					.onClick(() => {
						const current: TaskMeta = {
							priority: priorityKey(hit.priority),
							recurrence: hit.recurrence ?? "",
							start: hit.start ?? "",
							scheduled: hit.scheduled ?? "",
							due: hit.due ?? "",
						};
						// A linked card's description lives in its note, so only its
						// metadata (frontmatter) is editable here.
						new TaskMetadataModal(view.app, current, hit.description ?? "", isKanban && !hit.linkedFile, (meta, description) => {
							void setKanbanCardMetadata(view, hit, meta, description).then((ok) => {
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
								refresh();
							});
						}).open();
					}),
			);
		}
		if (isKanban) {
			// A card already linked to a note has nothing to convert.
			if (!hit.linkedFile) {
				menu.addItem((item) =>
					item
						.setTitle(t().cards.tasks.convertToNote)
						.setIcon("file-output")
						.onClick(() => void convertKanbanCardToNote(view, cfg, hit).then(refresh)),
				);
			}
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.deleteCard)
					.setIcon("trash-2")
					.onClick(() => {
						void deleteKanbanCard(view, hit).then((ok) => {
							if (!ok) new Notice(t().notices.taskChangedOnDisk);
							refresh();
						});
					}),
			);
		}
		menu.showAtMouseEvent(e);
	});
}


/** Render task text into `el`, turning `[[wikilinks]]` and `[label](url)` into
 * clickable links (the rest stays plain text). Link clicks open the target and
 * stop propagation so they don't also trigger the card's open-on-click. */
function fillTaskText(view: HomeView, el: HTMLElement, text: string, sourcePath: string): void {
	const re = /\[\[([^\]]+?)\]\]|\[([^\]]+?)\]\(([^)]+?)\)/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) el.appendText(text.slice(last, m.index));
		if (m[1] != null) {
			const [target, alias] = m[1].split("|");
			const link = el.createSpan({ cls: "hearth-task-link", text: (alias ?? target).trim() });
			link.addEventListener("click", (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
				void view.app.workspace.openLinkText(target.trim(), sourcePath, false);
			});
		} else {
			const link = el.createSpan({ cls: "hearth-task-link", text: m[2] });
			const url = m[3];
			link.addEventListener("click", (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
				if (/^https?:\/\//i.test(url)) window.open(url, "_blank");
				else void view.app.workspace.openLinkText(url, sourcePath, false);
			});
		}
		last = re.lastIndex;
	}
	if (last < text.length) el.appendText(text.slice(last));
	if (!el.childNodes.length) el.appendText(text);
}


/** Set (or clear) a Kanban card's due date and priority, rewriting the card
 * line's Tasks-plugin metadata in place while preserving its text and any link.
 * `due` is "" to clear; `priority` is "high"/"medium"/"low" or "" to clear. */
async function setKanbanCardMetadata(
	view: HomeView,
	hit: TaskHit,
	meta: TaskMeta,
	description: string,
): Promise<boolean> {
	// A card linked to a note keeps its metadata in that note's frontmatter —
	// edits are written there, not onto the board link.
	if (hit.linkedFile) return writeMetadataFrontmatter(view, hit.linkedFile, meta);
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	// Strip the managed markers (priority/recurrence/start/scheduled/due and
	// their values) from the card text, leaving ✅/➕/❌ untouched, then re-append
	// the new markers.
	const managedRe = new RegExp(`[${MANAGED_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = m[2].replace(managedRe, "").replace(/\s+/g, " ").trim();
	const itemIndent = /^(\s*)/.exec(cur)?.[1] ?? "";
	const prefix = cur.slice(0, cur.length - m[2].length);
	const newItem = `${prefix}${base}${buildMetadataSuffix(meta)}`.trimEnd();
	if (hit.boardColumn) {
		// Kanban card: replace the item line and its old description sub-bullets
		// with the new item line and freshly-built description bullets.
		const { end } = cardBlockRange(lines, hit.line);
		lines.splice(hit.line, end - hit.line, newItem, ...descriptionBullets(description, itemIndent));
	} else {
		// Plain checkbox: rewrite only the item line, leaving any nested lines
		// (which may be sub-tasks, not a description) untouched.
		lines[hit.line] = newItem;
	}
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Rewrite a line-based card's title text in place, preserving its checkbox mark
 * and any Tasks-plugin metadata markers (dates, priority, repeat, and the ✅/➕/❌
 * stamps). Only the descriptive text is replaced; nested description lines are
 * left untouched. `extended` mirrors {@link taskMetaEnabled}: when on, the emoji
 * markers are treated as metadata and reattached after the new title; when off,
 * the whole line text is the title and is replaced verbatim. Bails (returns
 * false) if the stored line no longer matches the card, or the new title is empty. */
async function setKanbanCardText(
	view: HomeView,
	hit: TaskHit,
	newText: string,
	extended: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const clean = newText.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
	if (!clean) return false; // never write a text-less card
	const prefix = cur.slice(0, cur.length - m[2].length);
	let rest: string;
	if (extended) {
		// Pull out every metadata marker (in order) so interspersed dates/priority
		// survive, then reattach them after the freshly-typed title.
		const markerRe = new RegExp(`[${TASK_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
		const markers: string[] = [];
		let mm: RegExpExecArray | null;
		while ((mm = markerRe.exec(m[2])) !== null) markers.push(mm[0].trim());
		rest = [clean, ...markers].join(" ").replace(/\s+/g, " ").trim();
	} else {
		rest = clean;
	}
	const newItem = `${prefix}${rest}`.trimEnd();
	if (newItem === cur) return true; // no-op edit
	lines[hit.line] = newItem;
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Set (or clear) a Kanban card's description, independent of its metadata: a
 * card linked to a note writes it to the note body; a normal card replaces the
 * nested `- ` sub-bullets under its item line, leaving the item line (title and
 * metadata) untouched. This is the description-only path used when Tasks-plugin
 * metadata isn't managed (`kanbanExtended` off), so no markers are rewritten.
 * Bails (returns false) if the stored line no longer matches the card. */
async function setKanbanCardDescription(
	view: HomeView,
	hit: TaskHit,
	description: string,
): Promise<boolean> {
	if (hit.linkedFile) {
		await writeNoteDescription(view, hit.linkedFile, description);
		return true;
	}
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const itemIndent = /^(\s*)/.exec(cur)?.[1] ?? "";
	const { end } = cardBlockRange(lines, hit.line);
	// Swap just the description sub-bullets (item line + 1 … block end) for the
	// freshly-built ones, keeping the card's title/metadata line as-is.
	lines.splice(hit.line + 1, end - (hit.line + 1), ...descriptionBullets(description, itemIndent));
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Delete a Kanban card (its checkbox line plus any nested continuation lines,
 * and one trailing blank line) from the board note. Bails if the stored line no
 * longer matches the card. */
async function deleteKanbanCard(view: HomeView, hit: TaskHit): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const indent = (/^(\s*)/.exec(cur)?.[1] ?? "").length;
	let end = hit.line + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		end++;
	}
	let removeEnd = end;
	if (lines[removeEnd]?.trim() === "") removeEnd++;
	lines.splice(hit.line, removeEnd - hit.line);
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Swap a card's title for an inline text input so it can be renamed in place,
 * mirroring the column rename. Enter (or blur) commits, Escape cancels; the
 * card's drag is suspended while editing so selecting text doesn't start a drag,
 * and clicks on the input are kept from bubbling to the card's open handler. */
function startCardTitleEdit(
	view: HomeView,
	cfg: TasksConfig,
	hit: TaskHit,
	row: HTMLElement,
	textEl: HTMLElement,
	card: HTMLElement,
	refresh: () => void,
): void {
	const extended = taskMetaEnabled(cfg, hit);
	const wasDraggable = card.getAttribute("draggable");
	card.setAttribute("draggable", "false");
	textEl.hide();
	const input = row.createEl("textarea", {
		cls: "hearth-kanban-card-edit",
		attr: { rows: "1", "aria-label": t().cards.tasks.editTitleHint },
	});
	row.insertBefore(input, textEl);
	input.value = hit.text || "";
	input.focus();
	input.select();
	let done = false;
	const cleanup = () => {
		input.remove();
		textEl.show();
		if (wasDraggable != null) card.setAttribute("draggable", wasDraggable);
	};
	const commit = () => {
		if (done) return;
		done = true;
		const next = input.value.trim();
		cleanup();
		if (next && next !== (hit.text || "")) {
			void setKanbanCardText(view, hit, next, extended).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		}
	};
	const cancel = () => {
		if (done) return;
		done = true;
		cleanup();
	};
	input.addEventListener("keydown", (ke) => {
		// Enter commits (a card title is a single line); Shift+Enter is ignored so
		// it can't split the title. Escape cancels.
		if (ke.key === "Enter" && !ke.shiftKey) {
			ke.preventDefault();
			commit();
		} else if (ke.key === "Escape") {
			ke.preventDefault();
			cancel();
		}
	});
	input.addEventListener("blur", commit);
	// Keep clicks/drags on the input from bubbling to the card's open/drag handlers.
	for (const type of ["mousedown", "click", "dblclick", "pointerdown"])
		input.addEventListener(type, (e) => e.stopPropagation());
}


/** Swap a Kanban column's title span for an inline text input to rename it.
 * Enter (or blur) commits, Escape cancels; the header's drag is suspended while
 * editing so text selection doesn't start a column drag. */
function startColumnRename(
	view: HomeView,
	cfg: TasksConfig,
	head: HTMLElement,
	titleEl: HTMLElement,
	oldLabel: string,
	refresh: () => void,
): void {
	const wasDraggable = head.getAttribute("draggable");
	head.setAttribute("draggable", "false");
	titleEl.hide();
	const input = head.createEl("input", {
		cls: "hearth-kanban-col-rename",
		attr: { type: "text", "aria-label": t().cards.tasks.renameColumnHint },
	});
	head.insertBefore(input, titleEl);
	input.value = oldLabel;
	input.focus();
	input.select();
	let done = false;
	const cleanup = () => {
		input.remove();
		titleEl.show();
		if (wasDraggable != null) head.setAttribute("draggable", wasDraggable);
	};
	const commit = () => {
		if (done) return;
		done = true;
		const next = input.value.trim();
		cleanup();
		if (next && next !== oldLabel) void renameKanbanColumn(view, cfg, oldLabel, next).then(refresh);
	};
	const cancel = () => {
		if (done) return;
		done = true;
		cleanup();
	};
	input.addEventListener("keydown", (ke) => {
		if (ke.key === "Enter") {
			ke.preventDefault();
			commit();
		} else if (ke.key === "Escape") {
			ke.preventDefault();
			cancel();
		}
	});
	input.addEventListener("blur", commit);
	// Keep clicks/drags on the input from bubbling to the header's handlers.
	for (const type of ["mousedown", "click", "dblclick", "pointerdown"])
		input.addEventListener(type, (e) => e.stopPropagation());
}


/** Rename a Kanban board column: rewrite its `## heading` line and remap the
 * card's stored column keys (order/hidden/done) from the old to the new key. */
async function renameKanbanColumn(
	view: HomeView,
	cfg: TasksConfig,
	oldHeading: string,
	newHeading: string,
): Promise<void> {
	const file = resolveKanbanFile(view.app, cfg);
	if (!file) return;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	const { columns } = parseKanbanColumns(lines);
	const col = columns.find((c) => c.heading === oldHeading);
	if (!col) return;
	lines[col.headingLine] = `## ${newHeading}`;
	await view.app.vault.modify(file, lines.join("\n"));
	// Remap the lowercased column keys the config stores.
	const oldKey = oldHeading.toLowerCase();
	const newKey = newHeading.toLowerCase();
	const remap = (arr: string[] | undefined) => arr?.map((k) => (k === oldKey ? newKey : k));
	cfg.kanbanOrder = remap(cfg.kanbanOrder);
	cfg.kanbanHidden = remap(cfg.kanbanHidden);
	cfg.kanbanDoneColumns = remap(cfg.kanbanDoneColumns);
	await view.plugin.saveData(view.plugin.settings);
}


/** Convert a Kanban card into its own note (like the Kanban plugin): create a
 * note in the user's default new-note location named after the card, then
 * replace the card's text with a link to it — preserving the checkbox state and
 * any Tasks-plugin metadata tail. */
async function convertKanbanCardToNote(view: HomeView, cfg: TasksConfig, hit: TaskHit): Promise<void> {
	const board = hit.file;
	const content = await view.app.vault.read(board);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) {
		new Notice(t().notices.taskChangedOnDisk);
		return;
	}
	// Sanitise the card title for use as a filename.
	const title = (stripTaskMetadata(m[2]) || "Untitled").replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
	// The card's nested lines are its description — they move into the note (as
	// bullet points), not left orphaned on the board.
	const { end, descLines } = cardBlockRange(lines, hit.line);
	let note: TFile;
	try {
		const parent = view.app.fileManager.getNewFileParent(board.path);
		const folder = parent instanceof TFolder ? parent : view.app.vault.getRoot();
		note = await view.app.fileManager.createNewMarkdownFile(folder, title);
	} catch {
		new Notice(t().notices.couldNotConvertCard);
		return;
	}
	// Seed the note body: an optional template (Obsidian-core-style
	// {{title}}/{{date}}/{{time}} substitution) followed by the card's
	// description as bullet points. A missing/unreadable template is skipped
	// rather than aborting the convert.
	const bodyParts: string[] = [];
	const templatePath = cfg.convertNoteTemplate?.trim();
	if (templatePath) {
		const tpl =
			view.app.vault.getAbstractFileByPath(templatePath) ??
			view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				bodyParts.push(applyConvertTemplate(await view.app.vault.read(tpl), title));
			} catch {
				// Template unreadable — carry on without it.
			}
		}
	}
	if (descLines.length) bodyParts.push(descLines.map((l) => `- ${l.trim()}`).join("\n"));
	if (bodyParts.length) await view.app.vault.modify(note, bodyParts.join("\n\n"));

	// Optionally scrape the card's Tasks-plugin metadata into the note's YAML
	// frontmatter (read straight off the card text so it works even when the
	// card wasn't parsed in extended mode). When scraping, the metadata now
	// lives in the note, so the emoji tail is dropped from the board link.
	const scrape = cfg.convertMetadataToFrontmatter ?? false;
	if (scrape) await writeTaskFrontmatter(view, note, m[2]);

	const link = view.app.fileManager.generateMarkdownLink(note, board.path);
	const meta = scrape ? "" : extractMetadataTail(m[2]);
	// Everything before the card's text (indent + `- [x] `) is preserved; the
	// card's description lines are removed from the board (they moved into the
	// note), leaving just the link line.
	const prefix = cur.slice(0, cur.length - m[2].length);
	lines.splice(hit.line, end - hit.line, `${prefix}${link}${meta ? ` ${meta}` : ""}`);
	await view.app.vault.modify(board, lines.join("\n"));
}


/** Substitute the note-template variables supported for convert-to-note:
 * {{title}}, {{date}}, {{time}} and their {{date:FMT}}/{{time:FMT}} formatted
 * variants (mirrors the daily-note template substitution). */
function applyConvertTemplate(raw: string, title: string): string {
	const now = moment();
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, now.format("YYYY-MM-DD"))
		.replace(/\{\{\s*time\s*\}\}/gi, now.format("HH:mm"))
		.replace(/\{\{\s*title\s*\}\}/gi, title);
}


/** Substitute only the date/time template variables (leaving {{title}} for when
 * the card's title is known at create time). Used to preview a template's body
 * in the add-card form. */
function substituteConvertDateTime(raw: string): string {
	const now = moment();
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, now.format("YYYY-MM-DD"))
		.replace(/\{\{\s*time\s*\}\}/gi, now.format("HH:mm"));
}


/** Write a card's Tasks-plugin metadata (read from its raw text) into a note's
 * YAML frontmatter, using conventional keys (priority, due, scheduled, start,
 * done, recurrence). Only fields the card actually carries are written; merges
 * with any frontmatter a template already added. */
async function writeTaskFrontmatter(view: HomeView, note: TFile, rawText: string): Promise<void> {
	const priority = priorityKey(readPriorityEmoji(rawText));
	const due = readEmojiDate(rawText, "📅");
	const scheduled = readEmojiDate(rawText, "⏳");
	const start = readEmojiDate(rawText, "🛫");
	const done = readEmojiDate(rawText, "✅");
	const recurrence = readEmojiField(rawText, "🔁");
	try {
		await view.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
			if (priority) fm["priority"] = priority;
			if (due) fm["due"] = due;
			if (scheduled) fm["scheduled"] = scheduled;
			if (start) fm["start"] = start;
			if (done) fm["done"] = done;
			if (recurrence) fm["recurrence"] = recurrence;
		});
	} catch {
		// Frontmatter write failed — the link and note are still created.
	}
}


/** Write edited task metadata into a note's YAML frontmatter, using the same
 * conventional keys convert-to-note scrapes to (priority/recurrence/start/
 * scheduled/due). Empty fields are removed. Used when editing a converted
 * (linked) card's metadata from the quick view or right-click editor. */
async function writeMetadataFrontmatter(view: HomeView, file: TFile, meta: TaskMeta): Promise<boolean> {
	const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
	try {
		await view.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const set = (k: string, v: string) => {
				if (v) fm[k] = v;
				else delete fm[k];
			};
			set("priority", meta.priority);
			set("recurrence", meta.recurrence.trim());
			set("start", isDate(meta.start) ? meta.start : "");
			set("scheduled", isDate(meta.scheduled) ? meta.scheduled : "");
			set("due", isDate(meta.due) ? meta.due : "");
		});
	} catch {
		return false;
	}
	return true;
}


/** The substring of a card's text from its first Tasks-plugin metadata emoji to
 * the end (trimmed), or "" when the card carries no metadata. Used to keep
 * due/priority markers on the card when its text is replaced with a link. */
function extractMetadataTail(text: string): string {
	const idx = text.search(new RegExp(`[${TASK_EMOJI_CLASS}]`, "u"));
	return idx >= 0 ? text.slice(idx).trim() : "";
}


/** Insert a card block after the last existing card in the named column (or
 * right after the heading when the column is empty), keeping a blank line
 * before whatever follows. Mutates `lines`. Returns false if the column heading
 * isn't found. */
function insertCardBlock(lines: string[], heading: string, block: string[]): boolean {
	const { columns } = parseKanbanColumns(lines);
	const target = columns.find((c) => c.heading === heading);
	if (!target) return false;
	let insertAt = target.headingLine + 1;
	for (let i = target.headingLine + 1; i < target.endLine; i++) {
		if (KANBAN_CARD_RE.test(lines[i])) insertAt = i + 1;
	}
	// When the column is empty, skip a blank line right under the heading so the
	// card sits directly below it rather than after the gap.
	if (insertAt === target.headingLine + 1 && lines[insertAt]?.trim() === "") insertAt++;
	const toInsert = [...block];
	if (lines[insertAt] != null && lines[insertAt].trim() !== "") toInsert.push("");
	lines.splice(insertAt, 0, ...toInsert);
	return true;
}


/** Read the value of a Tasks-plugin emoji field from a checkbox line, e.g.
 * `📅 tomorrow` or `📅 2024-01-15`. Returns the trimmed value up to the next
 * known emoji marker or end of line, or null when the marker isn't present. */
function readEmojiField(text: string, emoji: string): string | null {
	const idx = text.indexOf(emoji);
	if (idx < 0) return null;
	let rest = text.slice(idx + emoji.length);
	// Stop at the next emoji marker (any of the Tasks-plugin conventions).
	const next = rest.search(new RegExp(`[${TASK_EMOJI_CLASS}]`, "u"));
	if (next >= 0) rest = rest.slice(0, next);
	const value = rest.trim();
	return value || null;
}


/** The checkbox marker at the start of a list item, capturing the state char so
 * only that bracket is flipped (never a stray "[x]" elsewhere in the text). The
 * state char may be any single character to support custom statuses. */
const CHECKBOX_MARKER = /^(\s*[-*+]\s\[)(.)(\])/;


/** Set a checkbox task's status symbol in place (used when a checkbox card is
 * dragged between the board's status columns). Only the leading `[·]` marker is
 * changed; when metadata is managed the ✅ done date is stamped for a done status
 * and cleared otherwise. Returns false when the stored line no longer matches. */
async function setCheckboxSymbol(
	view: HomeView,
	hit: TaskHit,
	symbol: string,
	done: boolean,
	extended: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const line = lines[hit.line];
	const match = line != null ? CHECKBOX_MARKER.exec(line) : null;
	if (!match) return false;
	const rest = line.slice(match[0].length);
	if (stripTaskMetadata(rest) !== stripTaskMetadata(hit.text)) return false;
	const marker = line
		.slice(0, match[0].length)
		.replace(CHECKBOX_MARKER, (_m, pre: string, _state: string, post: string) => `${pre}${symbol}${post}`);
	const body = extended ? withDoneDate(rest, done, moment().format("YYYY-MM-DD")) : rest;
	lines[hit.line] = `${marker}${body}`.trimEnd();
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}


/** Write a TaskNotes task's status frontmatter field (used by the Kanban board
 * when a card is dragged to another status column). */
/** The status value written when a TaskNotes task is marked done: the card's
 * first configured "done" status when set (so a card treating both "done" and
 * "canceled" as complete writes "done"), otherwise the global done value. */
function doneWriteValue(view: HomeView, cfg: TasksConfig): string {
	const custom = (cfg.taskNotesDoneStatuses ?? []).map((v) => v.trim()).filter(Boolean);
	return custom[0] ?? (view.plugin.settings.taskNotesDoneValue.trim() || "done");
}

/** A completion checkbox for a non-recurring TaskNotes task (list layout).
 * Checking writes the done status; unchecking restores the card's open status
 * (see openStatus in renderTaskList). Clicks are swallowed so ticking the box
 * doesn't also open the note. */
function renderTaskNotesCheckbox(
	view: HomeView,
	cfg: TasksConfig,
	hit: TaskHit,
	row: HTMLElement,
	refresh: () => void,
	openStatus: string,
): void {
	const check = row.createEl("input", {
		cls: "hearth-task-check",
		attr: { type: "checkbox" },
	});
	check.checked = hit.done;
	// Swallow the pointer/click so ticking the box neither opens the note nor
	// (on a draggable Kanban card) starts a drag.
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		const value = check.checked ? doneWriteValue(view, cfg) : openStatus;
		void setTaskNotesStatus(view, hit, value).then(refresh);
	});
}

async function setTaskNotesStatus(view: HomeView, hit: TaskHit, value: string): Promise<void> {
	const field = view.plugin.settings.taskNotesStatusField.trim() || "status";
	try {
		await view.app.fileManager.processFrontMatter(hit.file, (fm) => {
			fm[field] = value;
		});
	} catch {
		new Notice(t().notices.couldNotUpdateTaskStatus);
	}
}


/** Compute the next occurrence date (YYYY-MM-DD) of a TaskNotes recurrence
 * rule strictly after `fromDate` (YYYY-MM-DD). Handles the common FREQ values
 * (DAILY/WEEKLY/MONTHLY/YEARLY) with INTERVAL and BYDAY; weeks are aligned to
 * the rule's DTSTART so a "weekly on Monday, every 1 week" anchored on a
 * Monday keeps landing on Mondays. Returns null when the rule can't be parsed
 * or no occurrence is found within a sane horizon (~2 years). */
function nextOccurrence(rule: string, fromDate: string): string | null {
	if (!rule || !fromDate) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const dtRaw = /DTSTART[:=](\d{8})/i.exec(r)?.[1];
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toUpperCase();
	if (!freq) return null;
	const interval = Math.max(1, parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10) || 1);
	const bydayRaw = /BYDAY=([A-Z,]+)/i.exec(r)?.[1];
	const dtstart = dtRaw
		? moment(`${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`)
		: null;
	const from = moment(fromDate);
	const wdMap: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
	const weekdays = bydayRaw
		? bydayRaw
				.split(",")
				.map((d) => wdMap[d.trim().toUpperCase()] ?? -1)
				.filter((w) => w >= 0)
		: dtstart
			? [dtstart.day()]
			: [];

	const cursor = from.clone().add(1, "day");
	const limit = 730;
	for (let i = 0; i < limit; i++) {
		const daysSince = dtstart ? cursor.diff(dtstart, "days") : 0;
		if (daysSince < 0) {
			cursor.add(1, "day");
			continue;
		}
		if (freq === "DAILY") {
			if (daysSince % interval === 0) return cursor.format("YYYY-MM-DD");
		} else if (freq === "WEEKLY") {
			if (weekdays.length === 0) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			} else if (weekdays.includes(cursor.day())) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "MONTHLY") {
			if (dtstart && cursor.date() === dtstart.date()) {
				const monthsSince =
					(cursor.year() - dtstart.year()) * 12 + (cursor.month() - dtstart.month());
				if (monthsSince >= 0 && monthsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "YEARLY") {
			if (
				dtstart &&
				cursor.date() === dtstart.date() &&
				cursor.month() === dtstart.month()
			) {
				const yearsSince = cursor.year() - dtstart.year();
				if (yearsSince >= 0 && yearsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		}
		cursor.add(1, "day");
	}
	return null;
}


/** Next occurrence strictly after `fromDate` for either an RRULE ("FREQ=…") or
 * a Tasks-plugin "every N unit" recurrence string (e.g. "every 2 weeks"), as
 * YYYY-MM-DD. Null when the rule is empty or unparseable. Used to roll a
 * recurring checkbox/Kanban task's date forward as each occurrence completes. */
function nextRecurrenceDate(rule: string, fromDate: string): string | null {
	if (!rule || !fromDate) return null;
	if (/FREQ=/i.test(rule)) return nextOccurrence(rule, fromDate);
	const { unit, interval } = parseRecurrence(rule);
	if (!unit) return null;
	return moment(fromDate).add(interval, unit).format("YYYY-MM-DD");
}


/** Mark today's occurrence of a recurring TaskNotes task complete the way
 * TaskNotes does: append today's YYYY-MM-DD to `complete_instances` (deduped,
 * kept sorted) and advance `scheduled` to the next occurrence derived from the
 * recurrence rule. The task's `status` is left untouched — a recurring task
 * stays open and just rolls forward to its next due date. */
async function completeRecurringInstance(view: HomeView, hit: TaskHit, targetFile?: TFile): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	const next = nextRecurrenceDate(hit.recurrence, today);
	try {
		await view.app.fileManager.processFrontMatter(targetFile ?? hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v))
				: [];
			if (!instances.includes(today)) {
				instances.push(today);
				instances.sort();
				fm["complete_instances"] = instances;
			}
			if (next) {
				fm["scheduled"] = timeMatch ? `${next}T${timeMatch[1]}` : next;
			}
		});
	} catch {
		new Notice(t().notices.couldNotCompleteRecurring);
	}
}


/** Undo today's completion of a recurring TaskNotes task: remove today from
 * `complete_instances` and roll `scheduled` back to today (the occurrence we
 * just un-completed). Used when the user unchecks the box to cancel a
 * mistaken completion. */
async function uncompleteRecurringInstance(view: HomeView, hit: TaskHit, targetFile?: TFile): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	try {
		await view.app.fileManager.processFrontMatter(targetFile ?? hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v)).filter((d) => d !== today)
				: [];
			fm["complete_instances"] = instances;
			// Restore the occurrence date the checkbox represents (today),
			// keeping any time component the task already had.
			fm["scheduled"] = timeMatch ? `${today}T${timeMatch[1]}` : today;
		});
	} catch {
		new Notice(t().notices.couldNotUndoRecurring);
	}
}


/** Render a small checkbox that completes today's occurrence of a recurring
 * TaskNotes task on check, and undoes it on uncheck (removes today from
 * complete_instances and rolls scheduled back to today). Pre-checked when
 * today is already in complete_instances. Stops propagation so it never
 * triggers the row/card click or drag. Rendered as the first child of `parent`
 * so it sits before the task text. */
function renderRecurringCheckbox(
	view: HomeView,
	hit: TaskHit,
	today: string,
	parent: HTMLElement,
	refresh: () => void,
	targetFile?: TFile,
): void {
	const check = parent.createEl("input", {
		cls: "hearth-task-check hearth-task-check-recurring",
		attr: { type: "checkbox", "aria-label": t().cards.tasks.markOccurrence },
	});
	// Move it to the very front so it leads the task text regardless of what
	// the caller appends afterwards.
	parent.insertBefore(check, parent.firstChild);
	check.checked = (hit.completeInstances ?? []).includes(today);
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		const wasChecked = (hit.completeInstances ?? []).includes(today);
		if (check.checked && !wasChecked) {
			void completeRecurringInstance(view, hit, targetFile).then(refresh);
		} else if (!check.checked && wasChecked) {
			void uncompleteRecurringInstance(view, hit, targetFile).then(refresh);
		} else {
			// State already matches the data — keep the checkbox in sync.
			check.checked = wasChecked;
		}
	});
}


/** Render the per-occurrence completion checkbox for a recurring checkbox /
 * Kanban task (one carrying a 🔁 mark). Checked when the task's ✅ done date is
 * today; checking stamps today and rolls the reference date to the next
 * occurrence, unchecking undoes it — so it resets to open on its next date.
 * Rendered as the first child of `parent`. */
function renderLineRecurringCheckbox(
	view: HomeView,
	hit: TaskHit,
	today: string,
	parent: HTMLElement,
	refresh: () => void,
): void {
	const check = parent.createEl("input", {
		cls: "hearth-task-check hearth-task-check-recurring",
		attr: { type: "checkbox", "aria-label": t().cards.tasks.markOccurrence },
	});
	parent.insertBefore(check, parent.firstChild);
	check.checked = hit.doneDate === today;
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		void setLineRecurringInstanceDone(view, hit, check.checked).then((ok) => {
			if (!ok) new Notice(t().notices.taskChangedOnDisk);
			refresh();
		});
	});
}


/** The slice of TaskNotes' plugin surface this uses. All optional and duck-typed:
 * TaskNotes ships no stable public types, so each accessor is probed before use
 * and may be absent or reshaped between versions. */
interface TaskNotesLike {
	openTaskEditModal?: (task: unknown) => unknown;
	cacheManager?: { getTaskInfo?: (path: string) => unknown };
	api?: { tasks?: { get?: (path: string) => unknown } };
}


/** Best-effort: open a TaskNotes task in TaskNotes' own edit modal rather than
 * the raw Markdown note. TaskNotes exposes no stable public API, so this resolves
 * the plugin's own task object for the file and hands it to `openTaskEditModal`,
 * returning whether it handled the open; the caller falls back to opening the
 * file when it didn't.
 *
 * The modal requires TaskNotes' `TaskInfo` (title/status/priority/…), not a
 * `TFile`: passing the file leaves the modal with a broken change-detection
 * baseline that traps every button but Delete (see issue #72). `openTaskEditModal`
 * is async, so a bad argument never throws synchronously — resolving the info up
 * front (and awaiting the open) is the only way to know we really handled it. */
async function openInTaskNotes(view: HomeView, file: TFile): Promise<boolean> {
	const plugin = view.app.plugins.plugins[TASKNOTES_PLUGIN_ID] as TaskNotesLike | undefined;
	if (!plugin || typeof plugin.openTaskEditModal !== "function") return false;
	const task = await resolveTaskNotesInfo(plugin, file.path);
	if (!task) return false;
	try {
		await plugin.openTaskEditModal(task);
		return true;
	} catch {
		// Internal error — fall through to a plain file open.
		return false;
	}
}


/** Resolve TaskNotes' `TaskInfo` for a note path via whichever accessor the
 * installed version exposes: the cache manager first, then the public runtime
 * API (`api.tasks.get`). Both are best-effort and may be absent or reshaped
 * between TaskNotes versions, so failures fall through to the next. */
async function resolveTaskNotesInfo(plugin: TaskNotesLike, path: string): Promise<unknown> {
	const cache = plugin.cacheManager;
	if (typeof cache?.getTaskInfo === "function") {
		try {
			const info = await cache.getTaskInfo(path);
			if (info) return info;
		} catch {
			// Fall through to the public API.
		}
	}
	const get = plugin.api?.tasks?.get;
	if (typeof get === "function") {
		try {
			const info = await get(path);
			if (info) return info;
		} catch {
			// No resolver worked.
		}
	}
	return null;
}


async function openTask(view: HomeView, cfg: TasksConfig, hit: TaskHit, refresh: () => void): Promise<void> {
	// Line-based tasks (checkboxes / Kanban cards) open a compact quick-view by
	// default — metadata + description with open-note / delete actions — instead
	// of jumping straight into the file. TaskNotes tasks (whole-file, no line)
	// keep opening in their own editor. Storing `taskQuickView: false` restores
	// the old open-on-click behaviour.
	if (hit.line >= 0 && (cfg.taskQuickView ?? true)) {
		new TaskDetailModal(view, cfg, hit, refresh).open();
		return;
	}
	await openTaskFile(view, hit);
}


/** Open a task's underlying file: TaskNotes tasks in TaskNotes' own editor when
 * possible, otherwise the note, scrolled to the task's line for line-based
 * tasks. */
async function openTaskFile(view: HomeView, hit: TaskHit): Promise<void> {
	// A card that links to a note opens that note directly (not the board line).
	if (hit.linkedFile) {
		await view.app.workspace.getLeaf(true).openFile(hit.linkedFile);
		return;
	}
	// TaskNotes tasks (no line) open in TaskNotes' own editor when possible.
	if (hit.line < 0 && (await openInTaskNotes(view, hit.file))) return;

	const leaf = view.app.workspace.getLeaf(true);
	// Scroll to the task's line via ephemeral state rather than a setCursor call
	// right after openFile: in a freshly created leaf the editor isn't laid out
	// yet, so an immediate scroll is discarded and the note opens at the top
	// (#118). Obsidian applies `eState.line` once the MarkdownView has mounted,
	// so the note lands on the task. The setCursor below then places the caret.
	const openState = hit.line >= 0 ? { eState: { line: hit.line } } : undefined;
	await leaf.openFile(hit.file, openState);
	if (hit.line >= 0 && leaf.view instanceof MarkdownView) {
		leaf.view.editor.setCursor({ line: hit.line, ch: 0 });
	}
}


// ---- Field customization -------------------------------------------------

/** What the fields editor found in the vault: the frontmatter properties a
 * custom field could read, and the distinct values each field actually has (so
 * colours are offered for values the user really uses, not a blank list). */
interface TaskFieldDiscovery {
	properties: string[];
	values: Map<string, string[]>;
}


/** Copy a field list deeply enough that the copy shares nothing mutable with
 * the original — the colour maps included. */
function cloneTaskFields(fields: TaskFieldConfig[]): TaskFieldConfig[] {
	return fields.map((f) => ({ ...f, colors: f.colors ? { ...f.colors } : undefined }));
}


/** How many values a single field offers colour swatches for. A property with
 * hundreds of distinct values (a date, an id) is not something anyone colours
 * by hand, and the list has to stay navigable. */
const FIELD_VALUE_LIMIT = 40;


/**
 * Scan the card's scope for the values its fields can take.
 *
 * Deliberately a light frontmatter read rather than the render-time collectors:
 * the editor only needs distinct values and property names, it runs without a
 * view, and `metadataCache` already holds every frontmatter block parsed. The
 * Kanban board is the one file actually read, for its column headings.
 */
async function discoverTaskFields(
	app: App,
	cfg: TasksConfig | null,
	settings: HomeSettings,
	fields: TaskFieldConfig[],
): Promise<TaskFieldDiscovery> {
	// The global list belongs to no card, so it scans the whole vault and offers
	// the values of every source rather than just one card's.
	const source = cfg?.source ?? null;
	const scope = cfg ?? {};
	const properties = new Set<string>();
	const values = new Map<string, Set<string>>();
	const record = (id: string, raw: unknown) => {
		const set = values.get(id) ?? new Set<string>();
		for (const value of taskFieldValues(raw)) {
			if (set.size < FIELD_VALUE_LIMIT) set.add(value);
		}
		values.set(id, set);
	};

	const statusField = settings.taskNotesStatusField.trim() || "status";
	const priorityField = settings.taskNotesPriorityField.trim() || "priority";
	const customProperties = fields
		.filter((f) => isCustomField(f.id))
		.map((f) => customFieldProperty(f.id))
		.filter(Boolean);

	for (const file of app.vault.getMarkdownFiles()) {
		if (!inTaskScope(file.path, scope)) continue;
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!frontmatter) continue;
		for (const key of Object.keys(frontmatter)) properties.add(key);
		if (source === "tasknotes" || source === null) {
			record("status", frontmatter[statusField]);
			record("priority", frontmatter[priorityField]);
		}
		for (const property of customProperties) {
			record(customFieldId(property), frontmatter[property]);
		}
	}

	// Priority for the line-based sources is one of the five Tasks-plugin
	// levels, which are known without scanning anything.
	if (source !== "tasknotes") record("priority", Object.keys(PRIORITY_EMOJI));

	// Board columns are headings in the board note, not frontmatter.
	if (source === "kanban" && cfg) {
		const board = resolveKanbanFile(app, cfg);
		if (board) {
			const lines = (await app.vault.cachedRead(board)).split("\n");
			record("column", parseKanbanColumns(lines).columns.map((c) => c.heading));
		}
	}

	return {
		properties: [...properties].sort((a, b) => a.localeCompare(b)),
		values: new Map([...values].map(([id, set]) => [id, [...set].sort((a, b) => a.localeCompare(b))])),
	};
}


/**
 * The fields editor: which metadata each task shows, in what order, and how.
 *
 * The list is every built-in field plus any frontmatter properties the user
 * added, in display order — turning one off marks it hidden rather than
 * dropping it, so its place in the order survives. Clicking a field's palette
 * button drills into its colours: the same modal, with the list swapped for the
 * values that field takes in this vault.
 */
export class TaskFieldsModal extends Modal {
	private fields: TaskFieldConfig[];
	private body: HTMLElement | null = null;
	private discovery: TaskFieldDiscovery = { properties: [], values: new Map() };
	/** Non-null while drilled into one field's colours. */
	private editingColors: string | null = null;

	/**
	 * @param cfg  The card being edited, or null when editing the global list in
	 *             Settings → Hearth. A card scopes the vault scan to its folders
	 *             and greys out fields its source cannot provide; the global list
	 *             belongs to no source, so it offers every field.
	 */
	constructor(
		app: App,
		private readonly cfg: TasksConfig | null,
		private readonly settings: HomeSettings,
		initial: TaskFieldConfig[] | undefined,
		private readonly onApply: (fields: TaskFieldConfig[]) => void,
	) {
		super(app);
		// Clone (colours included) so Cancel truly discards edits, and so an
		// Apply that keeps the modal open can't mutate what it already saved.
		this.fields = cloneTaskFields(resolveTaskFields(initial));
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-taskfields-modal");
		contentEl.createEl("h3", { text: t().editors.tasks.fieldsTitle });
		contentEl.createEl("p", {
			cls: "hearth-taskfields-hint",
			text: t().editors.tasks.fieldsHint,
		});
		this.body = contentEl.createDiv("hearth-taskfields-body");
		this.renderBody();
		this.renderFooter(contentEl);
		// Values arrive from a vault scan; redraw once they do so the colour
		// editor can offer real swatches.
		void discoverTaskFields(this.app, this.cfg, this.settings, this.fields).then((found) => {
			this.discovery = found;
			this.renderBody();
		});
	}

	/** A field's name in the editor: the built-in's label, or the property. */
	private fieldName(id: string): string {
		if (isCustomField(id)) return customFieldProperty(id);
		return t().editors.tasks.fieldNames[id as BuiltinTaskField] ?? id;
	}

	private renderBody(): void {
		const body = this.body;
		if (!body) return;
		body.empty();
		if (this.editingColors) this.renderColorEditor(body, this.editingColors);
		else this.renderFieldList(body);
	}

	private renderFieldList(body: HTMLElement): void {
		const labels = t().editors.tasks;
		const cfg = this.cfg;
		const source = cfg?.source ?? "checkbox";
		// Extended parsing is per task kind at render time; for the editor the
		// card-level toggle is what decides whether the emoji dates can appear.
		const metaEnabled =
			source === "kanban" ? (cfg?.kanbanExtended ?? false) : (cfg?.checkboxExtended ?? true);

		this.fields.forEach((field, index) => {
			// The global list belongs to no single source, so every field is live
			// there; only a card can say a field its source never produces is inert.
			const applies = !cfg || fieldAppliesTo(field.id, source, metaEnabled);
			const row = new Setting(body).setClass("hearth-taskfields-row");
			row.setName(this.fieldName(field.id));
			// A field the current source never produces stays listed (so switching
			// source back restores it) but says why it does nothing.
			if (!applies) row.setDesc(labels.fieldNotAvailable);
			row.settingEl.toggleClass("is-inactive", !applies);

			row.addToggle((tg) =>
				tg
					.setValue(!field.hidden)
					.setTooltip(labels.fieldShow)
					.onChange((v) => {
						field.hidden = v ? undefined : true;
						this.renderBody();
					}),
			);

			const styles = fieldStyleOptions(field.id);
			if (styles.length && !field.hidden) {
				row.addDropdown((d) => {
					for (const style of styles) d.addOption(style, labels.fieldStyles[style]);
					d.setValue(fieldStyle(field, this.cfg?.layout ?? "list", source)).onChange((v) => {
						field.style = v as TaskFieldStyle;
						this.renderBody();
					});
				});
			}

			if (fieldColorable(field.id) && !field.hidden) {
				row.addExtraButton((b) =>
					b
						.setIcon("palette")
						.setTooltip(labels.fieldColors)
						.onClick(() => {
							this.editingColors = field.id;
							this.renderBody();
						}),
				);
			}

			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(labels.fieldMoveUp)
					.setDisabled(index === 0)
					.onClick(() => this.move(index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(labels.fieldMoveDown)
					.setDisabled(index === this.fields.length - 1)
					.onClick(() => this.move(index, index + 1)),
			);
			// Built-ins are hidden, never removed — the list is the full set of what
			// Hearth can show, and dropping one would only make it unreachable.
			if (isCustomField(field.id)) {
				row.addExtraButton((b) =>
					b
						.setIcon("trash-2")
						.setTooltip(labels.fieldRemove)
						.onClick(() => {
							this.fields.splice(index, 1);
							this.renderBody();
						}),
				);
			}
		});

		this.renderAddCustom(body);
	}

	/** Add a frontmatter property as a chip. The menu offers the properties
	 * actually present on notes in scope; the input takes anything else. */
	private renderAddCustom(body: HTMLElement): void {
		const labels = t().editors.tasks;
		let typed = "";
		const add = (property: string) => {
			const name = property.trim();
			if (!name) return;
			const id = customFieldId(name);
			if (this.fields.some((f) => f.id === id)) {
				new Notice(labels.fieldAlreadyAdded(name));
				return;
			}
			this.fields.push({ id });
			this.renderBody();
		};

		const setting = new Setting(body)
			.setClass("hearth-taskfields-add")
			.setName(labels.fieldAddCustom)
			.setDesc(labels.fieldAddCustomDesc);
		setting.addText((txt) => {
			txt.setPlaceholder(labels.fieldAddCustomPlaceholder).onChange((v) => (typed = v));
			txt.inputEl.addEventListener("keydown", (e) => {
				if (e.key !== "Enter") return;
				e.preventDefault();
				add(typed);
			});
		});
		const used = new Set(this.fields.map((f) => f.id));
		const available = this.discovery.properties.filter((p) => !used.has(customFieldId(p)));
		setting.addExtraButton((b) => {
			b.setIcon("list").setTooltip(labels.fieldPickProperty).setDisabled(!available.length);
			// The extra-button callback gets no event, so the menu is anchored to the
			// button itself rather than a mouse position.
			b.onClick(() => {
				const menu = new Menu();
				for (const property of available) {
					menu.addItem((item) => item.setTitle(property).onClick(() => add(property)));
				}
				const rect = b.extraSettingsEl.getBoundingClientRect();
				menu.showAtPosition({ x: rect.left, y: rect.bottom });
			});
		});
		setting.addButton((b) => b.setButtonText(labels.fieldAdd).onClick(() => add(typed)));
	}

	/** One field's colours: a swatch per value it takes in this vault, plus a
	 * catch-all and a way to colour a value the scan didn't find. */
	private renderColorEditor(body: HTMLElement, id: string): void {
		const labels = t().editors.tasks;
		const field = this.fields.find((f) => f.id === id);
		if (!field) {
			this.editingColors = null;
			this.renderBody();
			return;
		}

		new Setting(body)
			.setClass("hearth-taskfields-back")
			.setName(labels.fieldColorsFor(this.fieldName(id)))
			.addExtraButton((b) =>
				b
					.setIcon("arrow-left")
					.setTooltip(labels.fieldBack)
					.onClick(() => {
						this.editingColors = null;
						this.renderBody();
					}),
			);

		new Setting(body)
			.setName(labels.fieldAutoColor)
			.setDesc(labels.fieldAutoColorDesc)
			.addToggle((tg) =>
				tg.setValue(fieldAutoColor(field)).onChange((v) => {
					// Store the explicit choice only when it differs from the field's
					// default, so an untouched field keeps falling back to it.
					const isDefault = v === (field.id !== "priority");
					field.autoColor = isDefault ? undefined : v;
					this.renderBody();
				}),
			);

		const swatch = (key: string, name: string, preview: string) => {
			const setting = new Setting(body).setClass("hearth-taskfields-color").setName(name);
			const current = field.colors?.[key];
			// Show what the value looks like today: the set colour, the auto one, or
			// nothing (the plain muted chip).
			const shown = current ?? (key !== "*" ? fieldColor(field, preview) : null);
			const dot = setting.controlEl.createDiv("hearth-taskfields-swatch");
			if (shown) dot.style.setProperty("--chip-color", shown);
			dot.toggleClass("is-unset", !shown);
			setting.addColorPicker((picker) => {
				if (shown?.startsWith("#")) picker.setValue(shown);
				picker.onChange((value) => {
					field.colors = { ...(field.colors ?? {}), [key]: value };
					this.renderBody();
				});
			});
			setting.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(labels.fieldColorReset)
					.setDisabled(!current)
					.onClick(() => {
						const colors = { ...(field.colors ?? {}) };
						delete colors[key];
						field.colors = Object.keys(colors).length ? colors : undefined;
						this.renderBody();
					}),
			);
		};

		swatch("*", labels.fieldColorEveryValue, "");
		const discovered = this.discovery.values.get(id) ?? [];
		// Values the user coloured but the scan no longer finds stay editable, so a
		// stale entry can be cleared instead of lingering invisibly.
		const configured = Object.keys(field.colors ?? {}).filter((k) => k !== "*");
		const seen = new Set<string>();
		for (const value of [...discovered, ...configured]) {
			const key = value.trim().toLowerCase();
			if (!key || seen.has(key)) continue;
			seen.add(key);
			swatch(key, value, value);
		}

		if (!discovered.length && !configured.length) {
			body.createDiv({ cls: "hearth-taskfields-empty", text: labels.fieldNoValues });
		}
	}

	private move(from: number, to: number): void {
		if (to < 0 || to >= this.fields.length) return;
		const [item] = this.fields.splice(from, 1);
		this.fields.splice(to, 0, item);
		this.renderBody();
	}

	/** Hand the current list to the caller. Always a fresh copy: the modal keeps
	 * editing its own array after an Apply that leaves it open, and nothing it
	 * does afterwards may reach into what was already saved. */
	private apply(): void {
		this.onApply(cloneTaskFields(this.fields));
	}

	private renderFooter(parent: HTMLElement): void {
		new Setting(parent)
			.addButton((b) =>
				b
					.setButtonText(t().editors.tasks.fieldsApplyClose)
					.setCta()
					.onClick(() => {
						this.apply();
						this.close();
					}),
			)
			// Apply without closing, so the card behind can be watched while the
			// fields are tuned.
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.filterApply)
					.setTooltip(t().editors.tasks.fieldsApplyDesc)
					.onClick(() => this.apply()),
			)
			.addButton((b) =>
				b.setButtonText(t().editors.tasks.fieldsReset).onClick(() => {
					this.fields = resolveTaskFields(undefined);
					this.editingColors = null;
					this.renderBody();
				}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}


/** A one-line summary of what a card shows, so the editor says what is
 * configured without opening the modal. */
function taskFieldsSummary(cfg: TasksConfig, settings: HomeSettings): string {
	const source = cfg.source ?? "checkbox";
	const metaEnabled =
		source === "kanban" ? (cfg.kanbanExtended ?? false) : (cfg.checkboxExtended ?? true);
	const shown = activeTaskFields(cfg, settings)
		.filter((f) => !f.hidden && fieldAppliesTo(f.id, source, metaEnabled))
		.map((f) =>
			isCustomField(f.id)
				? customFieldProperty(f.id)
				: (t().editors.tasks.fieldNames[f.id as BuiltinTaskField] ?? f.id),
		);
	return shown.length ? shown.join(", ") : t().editors.tasks.fieldsNone;
}


export function tasksEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.tasks ??= {});

	new Setting(containerEl)
		.setName(t().editors.tasks.source)
		.setDesc(t().editors.tasks.sourceDesc)
		.addDropdown((d) => {
			d.addOption("checkbox", t().editors.tasks.sourceCheckbox);
			d.addOption("tasknotes", t().editors.tasks.sourceTaskNotes);
			d.addOption("kanban", t().editors.tasks.sourceKanban);
			d.setValue(cfg.source ?? "checkbox").onChange((v) => {
				cfg.source = v as TasksConfig["source"];
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	// Kanban source: pick the board note and choose plain vs. Tasks-plugin
	// (extended) card parsing.
	if (cfg.source === "kanban") {
		const boardSetting = new Setting(containerEl)
			.setName(t().editors.tasks.kanbanBoard)
			.setDesc(t().editors.tasks.kanbanBoardDesc);
		boardSetting.addText((txt) =>
			txt
				.setPlaceholder(t().editors.tasks.kanbanBoardPlaceholder)
				.setValue(cfg.kanbanFile ?? "")
				.onChange((v) => {
					cfg.kanbanFile = v.trim() || undefined;
					ctx.opts.save();
				}),
		);
		boardSetting.addExtraButton((b) =>
			b
				.setIcon("file-symlink")
				.setTooltip(t().editors.tasks.pickBoard)
				.onClick(() => {
					new FilePickerModal(
						ctx.app,
						(file) => {
							cfg.kanbanFile = file.path;
							ctx.opts.save();
							ctx.requestRender();
						},
						t().editors.tasks.pickBoard,
						(file) => {
							const fm =
								ctx.app.metadataCache.getFileCache(file)?.frontmatter;
							return !!fm && "kanban-plugin" in fm;
						},
					).open();
				}),
		);

		new Setting(containerEl)
			.setName(t().editors.tasks.kanbanExtended)
			.setDesc(t().editors.tasks.kanbanExtendedDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.kanbanExtended ?? false).onChange((v) => {
					cfg.kanbanExtended = v || undefined;
					ctx.opts.save();
				}),
			);

		// Convert-to-note options (the card right-click "Convert to note"
		// action): seed the new note from a template, and/or scrape the card's
		// metadata into the note's frontmatter instead of onto the board link.
		const tplSetting = new Setting(containerEl)
			.setName(t().editors.tasks.convertTemplate)
			.setDesc(t().editors.tasks.convertTemplateDesc);
		tplSetting.addText((txt) =>
			txt
				.setPlaceholder(t().editors.tasks.convertTemplatePlaceholder)
				.setValue(cfg.convertNoteTemplate ?? "")
				.onChange((v) => {
					cfg.convertNoteTemplate = v.trim() || undefined;
					ctx.opts.save();
				}),
		);
		tplSetting.addExtraButton((b) =>
			b
				.setIcon("file-symlink")
				.setTooltip(t().editors.tasks.pickTemplate)
				.onClick(() => {
					new FilePickerModal(
						ctx.app,
						(file) => {
							cfg.convertNoteTemplate = file.path;
							ctx.opts.save();
							ctx.requestRender();
						},
						t().editors.tasks.pickTemplate,
					).open();
				}),
		);

		new Setting(containerEl)
			.setName(t().editors.tasks.convertScrape)
			.setDesc(t().editors.tasks.convertScrapeDesc)
			.addToggle((tg) =>
				tg
					.setValue(cfg.convertMetadataToFrontmatter ?? false)
					.onChange((v) => {
						cfg.convertMetadataToFrontmatter = v || undefined;
						ctx.opts.save();
					}),
			);

		new Setting(containerEl)
			.setName(t().editors.tasks.newTaskAsNote)
			.setDesc(t().editors.tasks.newTaskAsNoteDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.newTaskAsNote ?? false).onChange((v) => {
					cfg.newTaskAsNote = v || undefined;
					ctx.opts.save();
				}),
			);
	}

	// Checkbox source: parse the inline Tasks-plugin metadata (dates, priority,
	// repeat) — the counterpart of the Kanban "Dates & priorities" toggle. On
	// by default; storing `false` opts out and reads checkboxes as plain text.
	if ((cfg.source ?? "checkbox") === "checkbox") {
		new Setting(containerEl)
			.setName(t().editors.tasks.checkboxExtended)
			.setDesc(t().editors.tasks.checkboxExtendedDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.checkboxExtended ?? true).onChange((v) => {
					cfg.checkboxExtended = v ? undefined : false;
					ctx.opts.save();
					ctx.requestRender();
				}),
			);

		// Custom checkbox statuses: the board columns / task states, one per
		// line as `[symbol] Label`, with a trailing "(done)" to mark completed
		// states. Blank uses the default set (To do / In progress / Done).
		const defaultStatusText =
			`[ ] ${t().cards.tasks.toDo}\n` +
			`[/] ${t().cards.tasks.statusInProgress}\n` +
			`[x] ${t().cards.tasks.done} (done)`;
		const statusText = (cfg.checkboxStatuses ?? []).length
			? (cfg.checkboxStatuses ?? [])
					.map((s) => `[${s.symbol}] ${s.label}${s.done ? " (done)" : ""}`)
					.join("\n")
			: defaultStatusText;
		new Setting(containerEl)
			.setName(t().editors.tasks.checkboxStatuses)
			.setDesc(t().editors.tasks.checkboxStatusesDesc)
			.addTextArea((ta) => {
				ta.setValue(statusText)
					.setPlaceholder(defaultStatusText)
					.onChange((v) => {
						const parsed = v
							.split("\n")
							.map((line) => {
								const m = /^\s*\[(.)\]\s*(.*)$/.exec(line);
								if (!m) return null;
								let label = m[2].trim();
								let done = false;
								const dm = /\(done\)\s*$/i.exec(label);
								if (dm) {
									done = true;
									label = label.slice(0, dm.index).trim();
								}
								return {
									symbol: m[1],
									label: label || m[1],
									done: done || undefined,
								};
							})
							.filter(
								(
									s,
								): s is {
									symbol: string;
									label: string;
									done: boolean | undefined;
								} => s !== null,
							);
						cfg.checkboxStatuses = parsed.length ? parsed : undefined;
						ctx.opts.save();
					});
				ta.inputEl.rows = 4;
				ta.inputEl.addClass("hearth-tasks-statuses-input");
			});
	}

	// TaskNotes source: which status values count as complete. Empty uses the
	// single global done value (Settings → Hearth); listing values here (e.g.
	// "done" and "canceled") treats each as complete.
	if (cfg.source === "tasknotes") {
		new Setting(containerEl)
			.setName(t().editors.tasks.doneStatuses)
			.setDesc(t().editors.tasks.doneStatusesDesc)
			.addTextArea((ta) => {
				ta.setValue((cfg.taskNotesDoneStatuses ?? []).join("\n"))
					.setPlaceholder(t().editors.tasks.doneStatusesPlaceholder)
					.onChange((v) => {
						const parsed = v
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						cfg.taskNotesDoneStatuses = parsed.length ? parsed : undefined;
						ctx.opts.save();
					});
				ta.inputEl.rows = 3;
				ta.inputEl.addClass("hearth-tasks-statuses-input");
			});
	}

	// Quick-view on click applies to line-based tasks (checkboxes and Kanban
	// cards); TaskNotes tasks always open in their own editor.
	if ((cfg.source ?? "checkbox") !== "tasknotes") {
		new Setting(containerEl)
			.setName(t().editors.tasks.quickView)
			.setDesc(t().editors.tasks.quickViewDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.taskQuickView ?? true).onChange((v) => {
					cfg.taskQuickView = v ? undefined : false;
					ctx.opts.save();
				}),
			);
	}

	new Setting(containerEl)
		.setName(t().editors.tasks.layout)
		.setDesc(t().editors.tasks.layoutDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.tasks.layoutList);
			d.addOption("kanban", t().editors.tasks.layoutKanban);
			d.setValue(cfg.layout ?? "list").onChange((v) => {
				cfg.layout = v === "kanban" ? "kanban" : undefined;
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if (
		cfg.layout === "kanban" &&
		(cfg.kanbanHidden?.length ||
			cfg.kanbanOrder?.length ||
			cfg.kanbanDoneColumns?.length)
	) {
		const parts: string[] = [];
		if (cfg.kanbanHidden?.length)
			parts.push(t().editors.tasks.kanbanHidden(cfg.kanbanHidden.join(", ")));
		if (cfg.kanbanDoneColumns?.length)
			parts.push(
				t().editors.tasks.kanbanDoneColumns(cfg.kanbanDoneColumns.join(", ")),
			);
		const reset = new Setting(containerEl)
			.setName(t().editors.tasks.kanbanColumns)
			.setDesc(
				parts.length ? parts.join(" ") : t().editors.tasks.kanbanCustomOrder,
			);
		if (cfg.kanbanHidden?.length) {
			reset.addButton((b) =>
				b.setButtonText(t().editors.tasks.showAll).onClick(() => {
					cfg.kanbanHidden = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
			);
		}
		reset.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.tasks.resetColumns)
				.onClick(() => {
					cfg.kanbanHidden = undefined;
					cfg.kanbanOrder = undefined;
					cfg.kanbanDoneColumns = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}

	// Which metadata each task shows, in what order and how. Only offered once
	// the feature is switched on globally (Settings → Hearth → Integrations),
	// so a card nobody has customized shows no controls for it at all. This is
	// the card's *display*, unrelated to the field-name mapping in those same
	// settings — that says where to read a value from, not whether to show it.
	if (ctx.opts.settings.taskFieldsEnabled) {
		const own = cfg.taskFieldsEnabled ?? false;
		const fields = new Setting(containerEl)
			.setName(t().editors.tasks.fields)
			.setDesc(own ? taskFieldsSummary(cfg, ctx.opts.settings) : t().editors.tasks.fieldsFollowGlobal)
			.addToggle((tg) =>
				tg.setValue(own).onChange((v) => {
					cfg.taskFieldsEnabled = v || undefined;
					// Start from whatever the card shows right now, so switching to
					// its own list is a starting point rather than a reset.
					if (v && !cfg.taskFields?.length) {
						cfg.taskFields = cloneTaskFields(resolveTaskFields(ctx.opts.settings.taskFields));
					}
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}),
			);
		if (own) {
			fields.addButton((b) =>
				b.setButtonText(t().editors.tasks.fieldsCustomize).onClick(() => {
					new TaskFieldsModal(ctx.app, cfg, ctx.opts.settings, cfg.taskFields, (next) => {
						cfg.taskFields = next.length ? next : undefined;
						ctx.opts.save();
						ctx.requestRender();
						// Redraw the board behind the modal so an Apply that keeps it
						// open shows its effect straight away.
						ctx.opts.rerender();
					}).open();
				}),
			);
			addResetButton(ctx, fields, t().editors.tasks.fieldsReset, () => {
				cfg.taskFields = undefined;
			});
		}
	}

	new Setting(containerEl)
		.setName(t().editors.tasks.showCompleted)
		.setDesc(
			cfg.layout === "kanban"
				? t().editors.tasks.showCompletedKanbanDesc
				: "",
		)
		.addToggle((t) =>
			t.setValue(cfg.showCompleted ?? false).onChange((v) => {
				cfg.showCompleted = v || undefined;
				ctx.opts.save();
			}),
		);

	const maxTasks = new Setting(containerEl)
		.setName(t().editors.tasks.maxTasks)
		.setDesc(t().editors.tasks.maxTasksDesc);
	maxTasks.addText((t) => {
		t.setValue(String(cfg.count ?? 10)).onChange((v) => {
			const n = parseInt(v, 10);
			cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		t.inputEl.type = "number";
		t.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, maxTasks, t().settings.resetField, () => {
		cfg.count = undefined;
	});

	new Setting(containerEl).setName(t().editors.tasks.folders).setHeading();
	new Setting(containerEl)
		.setName(t().editors.tasks.scope)
		.addDropdown((d) => {
			d.addOption("all", t().editors.tasks.scopeAll);
			d.addOption("whitelist", t().editors.tasks.scopeWhitelist);
			d.addOption("blacklist", t().editors.tasks.scopeBlacklist);
			d.setValue(cfg.folderScope ?? "all").onChange((v) => {
				cfg.folderScope = v as TasksConfig["folderScope"];
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if ((cfg.folderScope ?? "all") !== "all") {
		new Setting(containerEl)
			.setDesc(t().editors.tasks.foldersDesc)
			.addTextArea((t) => {
				t.setValue((cfg.folders ?? []).join("\n")).onChange((v) => {
					cfg.folders = v
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					ctx.opts.save();
				});
				t.inputEl.rows = 3;
			});
	}
}

/** Tasks pulled from the vault, as a list or kanban board. Redraws live, but a
 * folder-scoped card ignores changes it can provably never read. */
export const tasksCard: CardDefinition<"tasks"> = {
	kind: "tasks",
	templates: [
		{ id: "tasks", name: "Tasks", icon: "list-todo", build: () => ({ kind: "tasks", title: "Tasks", tasks: {}, w: 4, h: 4 }) },
	],
	render: (view, card, body) => renderTasks(view, card, body),
	renderEditor: (container, ctx) => tasksEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.tasks)
			copy.tasks = {
				...source.tasks,
				folders: source.tasks.folders ? [...source.tasks.folders] : undefined,
				kanbanOrder: source.tasks.kanbanOrder ? [...source.tasks.kanbanOrder] : undefined,
				kanbanHidden: source.tasks.kanbanHidden ? [...source.tasks.kanbanHidden] : undefined,
				kanbanDoneColumns: source.tasks.kanbanDoneColumns
					? [...source.tasks.kanbanDoneColumns]
					: undefined,
				kanbanColumnSort: source.tasks.kanbanColumnSort
					? Object.fromEntries(
							Object.entries(source.tasks.kanbanColumnSort).map(([k, v]) => [k, { ...v }]),
						)
					: undefined,
				sortRules: source.tasks.sortRules ? source.tasks.sortRules.map((r) => ({ ...r })) : undefined,
				taskFields: source.tasks.taskFields
					? source.tasks.taskFields.map((f) => ({
							...f,
							colors: f.colors ? { ...f.colors } : undefined,
						}))
					: undefined,
			};
	},
	liveness: {
		mode: "vault",
		shouldRedraw: (card, ev) => tasksEventRelevant(card.tasks, ev.file, ev.oldPath),
	},
};
