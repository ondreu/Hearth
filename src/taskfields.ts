import { priorityDisplayLabel, priorityKey, PRIORITY_EMOJI } from "./priority";
import type { TaskFieldDef, TaskFieldKey, TaskFieldStyle, TaskValueMap } from "./types";

/**
 * User-defined task fields: what a "tasks" card shows on each task once field
 * customization is switched on. Pure config/string logic — no Obsidian, no DOM
 * — so the resolution rules can be tested without the card registry, the same
 * way priority.ts and taskscope.ts are.
 *
 * The model is deliberately open. Hearth offers no list of fields to pick from:
 * a field is something the user builds — a name, a display style, and one or
 * more keys that feed it. A key reads either a frontmatter property or one of
 * the values Hearth parses itself, and can map each raw value to a nicer label
 * and a colour.
 *
 * While customization is off, none of this is consulted: the card renders the
 * fixed metadata it always has (see `renderLegacyTaskFields` in cards/tasks.ts).
 */


/** Values Hearth parses itself, offered as key sources alongside frontmatter.
 * These are the only way to reach metadata that isn't in frontmatter at all —
 * a checkbox line's ⏫ priority, a Kanban card's column, a parsed due date. */
export const TASK_BUILTIN_SOURCES = [
	"status",
	"column",
	"priority",
	"start",
	"scheduled",
	"due",
	"doneDate",
	"description",
] as const;

export type TaskBuiltinSource = (typeof TASK_BUILTIN_SOURCES)[number];


/** Sources that carry a date, rendered with their own emoji marker and the
 * overdue treatment rather than as a plain value. */
const DATE_SOURCES: readonly string[] = ["start", "scheduled", "due", "doneDate"];


const FRONTMATTER_PREFIX = "fm:";
const BUILTIN_PREFIX = "builtin:";


/** The key source addressing a frontmatter property. */
export function frontmatterSource(property: string): string {
	return `${FRONTMATTER_PREFIX}${property.trim()}`;
}


/** The key source addressing one of Hearth's own parsed values. */
export function builtinSource(id: TaskBuiltinSource): string {
	return `${BUILTIN_PREFIX}${id}`;
}


/** The frontmatter property a source reads, or "" when it isn't one. */
export function sourceProperty(source: string): string {
	return source.startsWith(FRONTMATTER_PREFIX)
		? source.slice(FRONTMATTER_PREFIX.length).trim()
		: "";
}


/** The built-in value a source reads, or null when it isn't one. */
export function sourceBuiltin(source: string): TaskBuiltinSource | null {
	if (!source.startsWith(BUILTIN_PREFIX)) return null;
	const id = source.slice(BUILTIN_PREFIX.length).trim();
	return (TASK_BUILTIN_SOURCES as readonly string[]).includes(id)
		? (id as TaskBuiltinSource)
		: null;
}


/** Whether a source is one Hearth can read at all. */
export function isKnownSource(source: string): boolean {
	return sourceProperty(source).length > 0 || sourceBuiltin(source) !== null;
}


/** Whether a source produces a date (rendered with its marker and overdue
 * treatment) rather than a plain value. */
export function isDateSource(source: string): boolean {
	const builtin = sourceBuiltin(source);
	return builtin !== null && DATE_SOURCES.includes(builtin);
}


/**
 * The three positions a date can hold relative to today. A date key colours and
 * labels by these instead of by value: there is no list of dates to map, but
 * "overdue", "today" and "upcoming" is exactly the distinction that matters on
 * a task. Stored in the same `values` list as an ordinary mapping, under these
 * reserved match strings.
 */
export const DATE_RELATIONS = ["<today", "today", ">today"] as const;

export type DateRelation = (typeof DATE_RELATIONS)[number];


/** Where a date sits relative to today. Both are compared as YYYY-MM-DD, which
 * sorts lexically, so a value carrying a time (or any trailing text) is
 * truncated to its date part first. */
export function dateRelation(date: string, today: string): DateRelation {
	const day = date.slice(0, 10);
	if (day < today) return "<today";
	if (day > today) return ">today";
	return "today";
}


/** Whether a key's value is a date: always for the built-in date sources, and
 * for a frontmatter property the user marked as one. */
export function keyIsDate(key: TaskFieldKey): boolean {
	return isDateSource(key.source) || !!key.isDate;
}


/** How a date should be shown, given where it falls relative to today. An
 * absent label means "use the date's own relative label" — the mapping is
 * usually there for the colour alone. */
export function dateDisplay(key: TaskFieldKey, relation: DateRelation): TaskValueDisplay {
	const hit = (key.values ?? []).find(
		(v: TaskValueMap) => (v.match ?? "").trim().toLowerCase() === relation,
	);
	return { label: hit?.label?.trim() || "", color: hit?.color?.trim() || null };
}


/** Whether a source produces the multi-line description block, which is drawn
 * as sub-bullets and so takes no display style or value mapping. */
export function isDescriptionSource(source: string): boolean {
	return sourceBuiltin(source) === "description";
}


/** A fresh field id. Only has to be unique within one card's list, so the
 * timestamp + random suffix used elsewhere in Hearth is plenty. */
export function newTaskFieldId(): string {
	return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}


/** An empty field, ready to be named and given keys. */
export function newTaskField(name: string): TaskFieldDef {
	return { id: newTaskFieldId(), name, keys: [] };
}


/**
 * The stored field list, with anything unrenderable removed: keys naming a
 * source Hearth can't read, and (after that) fields left with no keys at all.
 *
 * An empty result is a legitimate configuration — "show no metadata" — and is
 * never substituted with defaults. That is the whole point of the feature: once
 * it is on, a task shows what was asked for and nothing else.
 */
export function resolveTaskFields(stored: TaskFieldDef[] | undefined): TaskFieldDef[] {
	if (!stored?.length) return [];
	const out: TaskFieldDef[] = [];
	for (const field of stored) {
		const keys = (field.keys ?? []).filter((k) => isKnownSource(k.source ?? ""));
		if (!keys.length) continue;
		out.push({ ...field, keys });
	}
	return out;
}


/**
 * The fields a card renders, or null when it should fall back to the fixed
 * metadata it has always shown.
 *
 * Three layers: the global master switch (off = null, whatever is stored), the
 * global field list, and a card that opted out of it with its own.
 */
export function activeTaskFields(
	card: { taskFieldsEnabled?: boolean; taskFields?: TaskFieldDef[] },
	global: { taskFieldsEnabled: boolean; taskFields: TaskFieldDef[] },
): TaskFieldDef[] | null {
	if (!global.taskFieldsEnabled) return null;
	if (card.taskFieldsEnabled) return resolveTaskFields(card.taskFields);
	return resolveTaskFields(global.taskFields);
}


/** How a field's values are drawn. The description ignores this — it is always
 * its own block of sub-bullets. A date honours every style: as a dot it keeps
 * the colour its relation to today gives it and moves the wording into the
 * tooltip. */
export function fieldStyle(field: TaskFieldDef): TaskFieldStyle {
	return field.display ?? "pill";
}


/**
 * Whether a style colours the whole task rather than adding something to it.
 * An ambient field renders no chip at all: its value is carried by the row's
 * own tint or ring, which also means it can only say one thing per task.
 */
export function isAmbientStyle(style: TaskFieldStyle): boolean {
	return style === "hue" || style === "glow";
}


/**
 * The field that owns the task's ambient colouring, or null when none asks for
 * it. A task has one background and one ring, so the two ambient styles share
 * them: the first field asking for either takes them, and any later one paints
 * nothing at all. The editor uses this to keep a second one from being chosen —
 * a field that silently does nothing is worse than an option that isn't there.
 */
export function ambientOwner(fields: TaskFieldDef[]): TaskFieldDef | null {
	return fields.find((f) => isAmbientStyle(fieldStyle(f))) ?? null;
}


/** Default strength for each ambient style, as a percentage. A tint sits behind
 * the task's text and has to stay out of its way; a ring sits outside it and
 * can afford to be bolder. */
const AMBIENT_DEFAULT_OPACITY: Record<string, number> = { hue: 14, glow: 45 };


/** How strongly an ambient field colours its task, 1-100. Clamped, because the
 * value is persisted and a hand-edited 0 (or 5000) would either do nothing or
 * make the task unreadable. */
export function fieldOpacity(field: TaskFieldDef): number {
	const fallback = AMBIENT_DEFAULT_OPACITY[fieldStyle(field)] ?? 100;
	const raw = field.opacity;
	if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
	return Math.max(1, Math.min(100, Math.round(raw)));
}


/**
 * Coerce a raw value into the values it renders as. A list property
 * (`contexts: [home, errands]`) becomes one value per entry, matching how
 * TaskNotes shows multi-value fields; a scalar becomes a single value.
 * Anything empty, or an object with no sensible text, renders nothing.
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


/**
 * The names a raw value can be matched by, most specific first. Priority is the
 * case that needs more than one: the same level arrives as "⏫" off a checkbox
 * line, as "high" from TaskNotes frontmatter and as "urgent" from a
 * hand-written property, so a mapping written against any of those has to catch
 * the others.
 *
 * The raw value always comes first, and that ordering is the point: folding the
 * value onto its level *before* the lookup made every mapping written against
 * what the vault actually holds ("urgent", "p1", "🔺") miss, because the lookup
 * only ever saw the coarse level it had been folded onto.
 */
export function sourceValueAliases(source: string, value: string): string[] {
	const out = [value];
	const add = (alias: string) => {
		const needle = alias.trim().toLowerCase();
		if (!needle) return;
		if (out.some((v) => v.trim().toLowerCase() === needle)) return;
		out.push(alias);
	};
	if (sourceBuiltin(source) === "priority") {
		const key = priorityKey(value);
		add(key);
		add(PRIORITY_EMOJI[key] ?? "");
	}
	return out;
}


/** How a value reads when no mapping claims it. Only priority needs anything
 * but itself: a bare "⏫" is not a label, so it shows as the word it stands for
 * — exactly as the fixed layout has always drawn it. */
function unmappedLabel(source: string, value: string): string {
	return sourceBuiltin(source) === "priority" ? priorityDisplayLabel(value) : value;
}


/** How one value should be displayed: the label to show and the colour to draw
 * it in. A value with no mapping shows itself, uncoloured — nothing is hidden
 * for want of having been mapped. */
export interface TaskValueDisplay {
	label: string;
	color: string | null;
}


/** Resolve a raw value against a key's mappings. Matching is case-insensitive
 * on the trimmed value; the first matching entry wins, so an earlier entry can
 * deliberately shadow a later one. The value is tried under each of its aliases
 * in turn, so a mapping written against exactly what the vault holds is found
 * first and one written against the level it folds onto still catches it. */
export function displayValue(key: TaskFieldKey, value: string): TaskValueDisplay {
	const fallback = unmappedLabel(key.source, value);
	const entries = key.values ?? [];
	for (const alias of sourceValueAliases(key.source, value)) {
		const needle = alias.trim().toLowerCase();
		const hit = entries.find((v: TaskValueMap) => (v.match ?? "").trim().toLowerCase() === needle);
		if (hit) return { label: hit.label?.trim() || fallback, color: hit.color?.trim() || null };
	}
	return { label: fallback, color: null };
}


/** The theme colours the editor offers as quick picks. Obsidian variables
 * rather than fixed hex, so a chip keeps working in any theme, light or dark. */
export const TASK_COLOR_PRESETS = [
	"--color-red",
	"--color-orange",
	"--color-yellow",
	"--color-green",
	"--color-cyan",
	"--color-blue",
	"--color-purple",
	"--color-pink",
] as const;


/** A preset colour as a CSS value. */
export function presetColor(name: string): string {
	return `var(${name})`;
}
