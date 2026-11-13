import { priorityDisplayLabel, priorityKey, PRIORITY_EMOJI } from "./priority";
import type { TaskFieldDef, TaskFieldKey, TaskFieldStyle, TaskValueMap } from "./types";

/** The card sources fields can be configured for. The global list belongs to
 * no card and may hold anything. */
export type TaskFieldSource = "checkbox" | "tasknotes" | "kanban" | "obsidian-tasks";

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
 * source Hearth can't read, keys no card of `source` could show (when a
 * source is given), and — after that — fields left with no keys at all.
 *
 * An empty result is a legitimate configuration — "show no metadata" — and is
 * never substituted with defaults. That is the whole point of the feature: once
 * it is on, a task shows what was asked for and nothing else.
 */
export function resolveTaskFields(
	stored: TaskFieldDef[] | undefined,
	source: TaskFieldSource | null = null,
): TaskFieldDef[] {
	if (!stored?.length) return [];
	const out: TaskFieldDef[] = [];
	for (const field of stored) {
		if (!field || typeof field !== "object") continue;
		const keys = (Array.isArray(field.keys) ? field.keys : []).filter(
			(k) => k && typeof k.source === "string" && isKnownSource(k.source) && isSourceAllowed(source, k.source),
		);
		if (!keys.length) continue;
		out.push({ ...field, keys });
	}
	return out;
}


/**
 * Coerce an unknown stored value into the field list the editor can work
 * with: non-object entries are dropped, missing key lists become empty, and
 * each key keeps only the shape the editor reads. Never throws, so one bad
 * entry in a hand-edited file can't take the rest of the editor with it.
 */
export function sanitizeTaskFields(stored: unknown): TaskFieldDef[] {
	if (!Array.isArray(stored)) return [];
	const out: TaskFieldDef[] = [];
	for (const raw of stored) {
		if (!raw || typeof raw !== "object") continue;
		const rec = raw as Record<string, unknown>;
		const keys: TaskFieldKey[] = [];
		if (Array.isArray(rec.keys)) {
			for (const rawKey of rec.keys) {
				if (!rawKey || typeof rawKey !== "object") continue;
				const keyRec = rawKey as Record<string, unknown>;
				if (typeof keyRec.source !== "string" || !keyRec.source) continue;
				const key: TaskFieldKey = { source: keyRec.source };
				if (Array.isArray(keyRec.values)) {
					const values: TaskValueMap[] = [];
					for (const rawValue of keyRec.values) {
						if (!rawValue || typeof rawValue !== "object") continue;
						const valueRec = rawValue as Record<string, unknown>;
						if (typeof valueRec.match !== "string") continue;
						const value: TaskValueMap = { match: valueRec.match };
						if (typeof valueRec.label === "string") value.label = valueRec.label;
						if (typeof valueRec.color === "string") value.color = valueRec.color;
						values.push(value);
					}
					if (values.length) key.values = values;
				}
				if (keyRec.isDate === true) key.isDate = true;
				keys.push(key);
			}
		}
		const field: TaskFieldDef = {
			id: typeof rec.id === "string" && rec.id ? rec.id : newTaskFieldId(),
			name: typeof rec.name === "string" ? rec.name : "",
			keys,
		};
		if (typeof rec.showName === "boolean" && rec.showName) field.showName = true;
		if (rec.display === "pill" || rec.display === "dot" || rec.display === "dotlabel" || rec.display === "text" || rec.display === "hue" || rec.display === "glow") {
			field.display = rec.display;
		}
		if (typeof rec.opacity === "number" && Number.isFinite(rec.opacity)) {
			field.opacity = Math.max(1, Math.min(100, Math.round(rec.opacity)));
		}
		out.push(field);
	}
	return out;
}


/**
 * The fields a non-TaskNotes card starts from when it gets its own list: the
 * metadata the fixed card has always shown — priority, the dates in
 * chronological order, and the description — plus the board column on a Kanban
 * board. A comfortable default, not the vault's TaskNotes list.
 */
export function defaultTaskFields(source: TaskFieldSource): TaskFieldDef[] {
	const fields: TaskFieldDef[] = [];
	if (source === "kanban") {
		fields.push({
			id: newTaskFieldId(),
			name: "Column",
			keys: [{ source: builtinSource("column") }],
		});
	}
	fields.push({
		id: newTaskFieldId(),
		name: "Priority",
		display: "dotlabel",
		keys: [{ source: builtinSource("priority") }],
	});
	fields.push({
		id: newTaskFieldId(),
		name: "Dates",
		keys: [
			{ source: builtinSource("start") },
			{ source: builtinSource("scheduled") },
			{ source: builtinSource("due") },
			{ source: builtinSource("doneDate") },
		],
	});
	fields.push({
		id: newTaskFieldId(),
		name: "Description",
		keys: [{ source: builtinSource("description") }],
	});
	return fields;
}


/**
 * The fields a card renders, or null when it should fall back to the fixed
 * metadata it has always shown.
 *
 * Only TaskNotes cards follow the vault-wide list: the global master switch
 * (off = null, whatever is stored) and the global field list are that
 * source's configuration. Every other source configures its own fields on
 * the card, independently of the vault-wide setting — the card's own toggle
 * and list, or null while it has none.
 */
export function activeTaskFields(
	card: { taskFieldsEnabled?: boolean; taskFields?: TaskFieldDef[] },
	global: { taskFieldsEnabled: boolean; taskFields: TaskFieldDef[] },
	source: TaskFieldSource = "tasknotes",
): TaskFieldDef[] | null {
	if (source === "tasknotes") {
		if (!global.taskFieldsEnabled) return null;
		if (card.taskFieldsEnabled) return resolveTaskFields(card.taskFields, source);
		return resolveTaskFields(global.taskFields, source);
	}
	if (!card.taskFieldsEnabled) return null;
	return resolveTaskFields(card.taskFields, source);
}


/** How a field's values are drawn. The description ignores this — it is always
 * its own block of sub-bullets. A date honours every style: as a dot it keeps
 * the colour its relation to today gives it and moves the wording into the
 * tooltip. */
export function fieldStyle(field: TaskFieldDef): TaskFieldStyle {
	return field.display ?? "pill";
}


/**
 * Whether a style is the priority's own dot-and-label form. It is the shape a
 * priority has been drawn in since before any of this was configurable, kept as
 * a style of its own so choosing "Chip" gives a priority the same chip every
 * other field gets rather than something particular to it.
 */
export function isPriorityStyle(style: TaskFieldStyle): boolean {
	return style === "dotlabel";
}


/** Whether a key reads a priority, and so may be drawn in that form. */
export function isPrioritySource(source: string): boolean {
	return sourceBuiltin(source) === "priority";
}


/**
 * The built-in values a card source can actually show. A source only offers
 * what its tasks carry: the TaskNotes status means nothing to a checkbox
 * card, and a board column means nothing anywhere but a Kanban board. Keys
 * outside the card's set are dropped at resolve time and never offered by the
 * editor, so a field that could only mean something for TaskNotes never
 * appears on the other sources.
 */
export function builtinSourcesFor(source: TaskFieldSource | null): TaskBuiltinSource[] {
	if (source === "kanban") {
		return ["column", "priority", "start", "scheduled", "due", "doneDate", "description"];
	}
	if (source === "tasknotes") {
		return ["status", "priority", "start", "scheduled", "due", "doneDate", "description"];
	}
	if (source === null) return [...TASK_BUILTIN_SOURCES];
	return ["priority", "start", "scheduled", "due", "doneDate", "description"];
}


/** Whether a key's source can show anything on a card of `source`. A
 * frontmatter property always can (it reads the note, whatever the source);
 * a built-in value only when the source carries it. */
export function isSourceAllowed(source: TaskFieldSource | null, keySource: string): boolean {
	if (sourceProperty(keySource)) return true;
	const builtin = sourceBuiltin(keySource);
	if (!builtin) return false;
	return builtinSourcesFor(source).includes(builtin);
}


/** Whether a field may offer the dot-and-label form: it reads a priority, or it
 * is already set to it (a list saved before its keys changed, whose stored
 * choice the editor still has to be able to show). */
export function allowsPriorityStyle(field: TaskFieldDef): boolean {
	return (
		isPriorityStyle(fieldStyle(field)) || (field.keys ?? []).some((k) => isPrioritySource(k.source))
	);
}


/**
 * The style one key actually renders in. Everything but a priority falls back
 * to a chip when the field asks for the dot-and-label form, so a field that
 * gathers a priority and a couple of properties under one name stays coherent
 * instead of drawing the others as bare, styleless text.
 */
export function keyStyle(style: TaskFieldStyle, source: string): TaskFieldStyle {
	return isPriorityStyle(style) && !isPrioritySource(source) ? "pill" : style;
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
