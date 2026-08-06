import type { TaskFieldConfig, TaskFieldStyle } from "./types";

/**
 * Which metadata a "tasks" card shows on each task, in what order, and how each
 * piece is drawn. Everything here is pure config/string logic — no Obsidian, no
 * DOM — so the resolution rules (defaults, ordering, colouring) can be tested
 * without the card registry, the same way priority.ts and taskscope.ts are.
 *
 * A field is either one of the built-ins below (metadata Hearth parses itself)
 * or a frontmatter property, addressed as `fm:<property>`. Both share one
 * ordered list on the card, so a custom chip can sit between two built-ins.
 */


/** The metadata Hearth parses for every task, in the order a card shows it when
 * the user has not reordered anything. This order is the historical one the
 * card rendered before fields became configurable, so an unconfigured card
 * looks exactly as it did. */
export const BUILTIN_TASK_FIELDS = [
	"status",
	"column",
	"priority",
	"start",
	"scheduled",
	"due",
	"doneDate",
	"description",
] as const;

export type BuiltinTaskField = (typeof BUILTIN_TASK_FIELDS)[number];


/** Prefix marking a field id as a frontmatter property rather than a built-in.
 * `fm:project` reads the `project` property off the task's note. */
export const CUSTOM_FIELD_PREFIX = "fm:";


/** Whether `id` addresses a frontmatter property (`fm:project`) rather than one
 * of the built-in fields. */
export function isCustomField(id: string): boolean {
	return id.startsWith(CUSTOM_FIELD_PREFIX);
}


/** The frontmatter property a custom field reads, or "" for a built-in. */
export function customFieldProperty(id: string): string {
	return isCustomField(id) ? id.slice(CUSTOM_FIELD_PREFIX.length).trim() : "";
}


/** The field id addressing a frontmatter property. */
export function customFieldId(property: string): string {
	return `${CUSTOM_FIELD_PREFIX}${property.trim()}`;
}


/** Whether a field id is one Hearth can render: a known built-in, or a custom
 * field naming a non-empty property. */
function isKnownField(id: string): boolean {
	if (isCustomField(id)) return customFieldProperty(id).length > 0;
	return (BUILTIN_TASK_FIELDS as readonly string[]).includes(id);
}


/** Fields that only exist for a given source/mode, used to hide controls that
 * could never render anything:
 *
 * - `status` is the TaskNotes status value; the other sources have none.
 * - `column` is the Kanban board column a card sits in.
 * - `start`, `scheduled` and `doneDate` come from the Tasks-plugin emoji markers
 *   on a line-based task, so they need extended parsing to be on.
 *
 * `metaEnabled` mirrors the card's `checkboxExtended`/`kanbanExtended` toggle.
 */
export function fieldAppliesTo(
	id: string,
	source: "checkbox" | "tasknotes" | "kanban",
	metaEnabled: boolean,
): boolean {
	if (isCustomField(id)) return true;
	switch (id as BuiltinTaskField) {
		case "status":
			return source === "tasknotes";
		case "column":
			return source === "kanban";
		case "start":
		case "scheduled":
		case "doneDate":
			return source !== "tasknotes" && metaEnabled;
		case "description":
			return source !== "tasknotes";
		default:
			return true;
	}
}


/** The default, unconfigured field list: every built-in, visible, in order. */
export function defaultTaskFields(): TaskFieldConfig[] {
	return BUILTIN_TASK_FIELDS.map((id) => ({ id }));
}


/**
 * The field list a card renders: the stored list with unusable entries dropped
 * and duplicates collapsed, or the defaults when nothing is stored.
 *
 * Built-ins the stored list never mentions are appended (visible) at the end.
 * That only happens for a card configured by an older version that did not know
 * the field yet — the editor always writes every built-in, marking the ones the
 * user turned off `hidden` rather than dropping them, so hiding a field is
 * never mistaken for "this card predates it".
 */
export function resolveTaskFields(stored: TaskFieldConfig[] | undefined): TaskFieldConfig[] {
	if (!stored?.length) return defaultTaskFields();
	const out: TaskFieldConfig[] = [];
	const seen = new Set<string>();
	for (const field of stored) {
		const id = field.id?.trim();
		if (!id || seen.has(id) || !isKnownField(id)) continue;
		seen.add(id);
		out.push({ ...field, id });
	}
	for (const id of BUILTIN_TASK_FIELDS) {
		if (!seen.has(id)) out.push({ id });
	}
	return out;
}


/** The built-in style for each field when the user hasn't chosen one. Dates and
 * the description read as text (they carry their own emoji/bullets); everything
 * else is a chip. */
const DEFAULT_FIELD_STYLE: Record<BuiltinTaskField, TaskFieldStyle> = {
	status: "pill",
	column: "pill",
	priority: "pill",
	due: "text",
	scheduled: "text",
	start: "text",
	doneDate: "text",
	description: "text",
};


/**
 * How a field renders. An explicit `style` always wins; otherwise the field's
 * default applies, with one exception: priority on a Kanban board defaults to a
 * bare dot, because a board card is too narrow for a labelled chip. (That was
 * the hard-coded behaviour before fields were configurable.)
 */
export function fieldStyle(
	field: TaskFieldConfig,
	layout: "list" | "kanban",
	source: "checkbox" | "tasknotes" | "kanban",
): TaskFieldStyle {
	if (field.style && fieldStyleOptions(field.id).includes(field.style)) return field.style;
	if (field.id === "priority" && layout === "kanban" && source === "kanban") return "dot";
	if (isCustomField(field.id)) return "pill";
	return DEFAULT_FIELD_STYLE[field.id as BuiltinTaskField] ?? "text";
}


/** Whether a field can be styled at all. The description is always its own
 * block of sub-bullets — pill/dot make no sense for multi-line text. */
export function fieldStyleable(id: string): boolean {
	return id !== "description";
}


/** The styles a field can be drawn in, in the order the editor offers them. A
 * date renders as a relative label ("Tomorrow", "15 Jul") that a bare dot could
 * not convey, so dates are text or a chip — never a dot. */
export function fieldStyleOptions(id: string): TaskFieldStyle[] {
	if (!fieldStyleable(id)) return [];
	if (isCustomField(id)) return ["pill", "dot", "text"];
	switch (id as BuiltinTaskField) {
		case "due":
		case "scheduled":
		case "start":
		case "doneDate":
			return ["text", "pill"];
		default:
			return ["pill", "dot", "text"];
	}
}


/** Whether a field's chips can carry per-value colours. Dates are relative
 * labels ("Tomorrow") whose colour already means something — overdue — so they
 * are left alone. */
export function fieldColorable(id: string): boolean {
	if (isCustomField(id)) return true;
	return id === "status" || id === "column" || id === "priority";
}


/**
 * Coerce a frontmatter value into the chips it renders as. A list property
 * (`contexts: [home, errands]`) becomes one chip per entry, matching how
 * TaskNotes shows multi-value fields; a scalar becomes a single chip. Anything
 * empty, or a nested object with no sensible text, renders nothing.
 */
export function taskFieldValues(raw: unknown): string[] {
	const scalar = (v: unknown): string | null => {
		if (typeof v === "string") return v.trim() || null;
		if (typeof v === "number" && Number.isFinite(v)) return String(v);
		if (typeof v === "boolean") return String(v);
		return null;
	};
	if (Array.isArray(raw)) {
		const out: string[] = [];
		for (const entry of raw) {
			const value = scalar(entry);
			if (value !== null && !out.includes(value)) out.push(value);
		}
		return out;
	}
	const value = scalar(raw);
	return value === null ? [] : [value];
}


/** The theme colours auto-assigned to chip values. Obsidian variables (rather
 * than fixed hex) so a chip keeps working in any theme, light or dark. */
const AUTO_COLOR_VARS = [
	"--color-blue",
	"--color-green",
	"--color-orange",
	"--color-purple",
	"--color-cyan",
	"--color-pink",
	"--color-yellow",
	"--color-red",
];


/** A stable index into the auto palette for a value: the same status always
 * gets the same colour, on every card and across restarts, without anything
 * being stored. (FNV-1a, chosen for spreading short similar words like
 * "todo"/"done" across different buckets.) */
function autoColorIndex(value: string): number {
	let hash = 0x811c9dc5;
	const key = value.trim().toLowerCase();
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0) % AUTO_COLOR_VARS.length;
}


/** The auto-assigned colour for a value, as a CSS value usable directly. */
export function autoFieldColor(value: string): string {
	return `var(${AUTO_COLOR_VARS[autoColorIndex(value)]})`;
}


/** Whether a field colours its chips automatically when no explicit colour is
 * set for a value. On by default for the free-form values (status, board column
 * and frontmatter properties), where a colour is what makes one value tell
 * itself apart from another at a glance; off for priority, which has its own
 * meaningful five-level scale in the stylesheet. */
export function fieldAutoColor(field: TaskFieldConfig): boolean {
	if (!fieldColorable(field.id)) return false;
	return field.autoColor ?? field.id !== "priority";
}


/**
 * The colour a value's chip is drawn in, or null to leave it to the stylesheet
 * (the muted default chip, or priority's own level colours).
 *
 * An explicit per-value colour wins, then a `*` entry colouring every value of
 * the field, then the auto palette when the field allows it.
 */
export function fieldColor(field: TaskFieldConfig, value: string): string | null {
	if (!fieldColorable(field.id)) return null;
	const colors = field.colors ?? {};
	const explicit = colors[value.trim().toLowerCase()] ?? colors["*"];
	if (explicit) return explicit;
	return fieldAutoColor(field) ? autoFieldColor(value) : null;
}
