/**
 * Turning an external calendar event into a vault note.
 *
 * The note is described by a note template (`src/clip.ts`) — name, folder,
 * typed properties and a body, all text with `{{variable|filter}}`
 * placeholders — the same kind of template a feed entry is saved with. This
 * module supplies what is calendar-specific: the variables an event fills a
 * template with, the template a card starts from, and the upgrade from the
 * older per-field routing rules (`fields`, `filename`), which a card saved
 * before templates may still hold.
 *
 * Pure (no vault access): it returns the note's pieces, and the caller writes
 * them.
 */
import {
	buildClipNote,
	clipDate,
	commonClipVars,
	type BuiltClipNote,
	type ClipDefaults,
	type ClipProperty,
	type ClipTemplate,
	type ClipVars,
} from "./clip";

export { sanitizeFilename } from "./clip";

/** The event values the routing rules of old could name. */
export type EventField =
	| "summary"
	| "date"
	| "start"
	| "end"
	| "location"
	| "description"
	| "url"
	| "calendar";

/** Where an old routing rule sent a field. */
export type EventFieldAction = "ignore" | "frontmatter" | "body";

/** One routing rule as cards saved them before note templates. Read only to
 * upgrade (see {@link upgradeEventNote}). */
export interface EventNoteFieldRule {
	field: EventField;
	action: EventFieldAction;
	key?: string;
	format?: string;
}

/** A calendar card's event → note template. The two legacy fields are only
 * ever read, to upgrade a card saved before templates. */
export interface EventNoteConfig extends ClipTemplate {
	/** Legacy: the note name before templates, now {@link ClipTemplate.name}. */
	filename?: string;
	/** Legacy: the routing rules before templates, now properties + body. */
	fields?: EventNoteFieldRule[];
}

/** The event data this module consumes (a superset survives fine). */
export interface EventNoteInput {
	uid: string;
	summary: string;
	location: string;
	description: string;
	url: string;
	start: number;
	end: number | null;
	allDay: boolean;
	/** The source calendar's display name. */
	calendar: string;
}

/** The assembled note, ready for the caller to write to disk. */
export type BuiltEventNote = BuiltClipNote;

/** Frontmatter property that stores the event UID when
 * {@link ClipTemplate.linkKey} is unset. */
export const DEFAULT_EVENT_LINK_KEY = "event_uid";

/** Where a card's template starts: the date as a date property, the time,
 * place and calendar beside it, the description as the body. */
export const EVENT_NOTE_DEFAULTS: ClipDefaults = {
	name: "{{title}}",
	folder: "",
	properties: [
		{ name: "date", value: "{{date}}", type: "date" },
		{ name: "time", value: "{{start}}", type: "text" },
		{ name: "location", value: "{{location}}", type: "text" },
		{ name: "calendar", value: "{{calendar}}", type: "text" },
	],
	body: "{{description}}",
	linkKey: DEFAULT_EVENT_LINK_KEY,
};

/** The variables an event offers a template, in the order the editor lists
 * them. `summary` is the old name for `title` and stays for old templates. */
export const EVENT_CLIP_VARIABLES = [
	"title",
	"date",
	"start",
	"end",
	"location",
	"description",
	"url",
	"calendar",
	"uid",
	"today",
	"now",
] as const;

/** An event's template variables. A date reads as a day and a time as a
 * clock time unless a `date` filter says otherwise; an all-day event has no
 * clock time, so its start and end read as days. */
export function eventClipVars(ev: EventNoteInput, now = Date.now()): ClipVars {
	const timeFmt = ev.allDay ? "YYYY-MM-DD" : "HH:mm";
	return {
		...commonClipVars(now),
		title: ev.summary,
		summary: ev.summary,
		date: clipDate(ev.start, "YYYY-MM-DD"),
		start: clipDate(ev.start, timeFmt),
		end: ev.end === null ? "" : clipDate(ev.end, timeFmt),
		location: ev.location,
		description: ev.description,
		url: ev.url,
		calendar: ev.calendar,
		uid: ev.uid,
	};
}

/** The property names the old rules used when a rule named none. */
const LEGACY_KEYS: Record<EventField, string> = {
	summary: "title",
	date: "date",
	start: "start",
	end: "end",
	location: "location",
	description: "description",
	url: "url",
	calendar: "calendar",
};

const LEGACY_DATE_FIELDS: readonly EventField[] = ["date", "start", "end"];

/** One old rule's value as a placeholder. */
function legacyPlaceholder(rule: EventNoteFieldRule): string {
	const field = rule.field === "summary" ? "title" : rule.field;
	const format = rule.format?.trim();
	return format && LEGACY_DATE_FIELDS.includes(rule.field) ? `{{${field}|date:"${format}"}}` : `{{${field}}}`;
}

/**
 * Turn a card's old routing rules into a template, in place: `filename`
 * becomes the note name, each property rule a property, each body rule a body
 * section (under its heading, when it had one). A card with no rules of its
 * own had the defaults, which the template defaults reproduce, so it keeps
 * none. Returns the same object, for chaining; a card already on templates is
 * left alone.
 */
export function upgradeEventNote(cfg: EventNoteConfig): EventNoteConfig {
	if (cfg.filename !== undefined) {
		if (cfg.name === undefined) cfg.name = cfg.filename.replace(/\{\{\s*summary\b/gi, "{{title");
		delete cfg.filename;
	}
	if (cfg.fields !== undefined) {
		const rules = cfg.fields;
		delete cfg.fields;
		if (cfg.properties === undefined && cfg.body === undefined) {
			const properties: ClipProperty[] = [];
			const body: string[] = [];
			for (const rule of rules) {
				if (rule.action === "frontmatter") {
					properties.push({
						name: (rule.key || LEGACY_KEYS[rule.field]).trim(),
						value: legacyPlaceholder(rule),
						type: rule.field === "date" && !rule.format ? "date" : "text",
					});
				} else if (rule.action === "body") {
					const heading = rule.key?.trim();
					const value = legacyPlaceholder(rule);
					body.push(heading ? `## ${heading}\n\n${value}` : value);
				}
			}
			cfg.properties = properties;
			cfg.body = body.join("\n\n");
		}
	}
	return cfg;
}

/**
 * Assemble the note for an event. `templateContent` is the raw text of the
 * configured template note (already read by the caller), or "" for none.
 * A card still on the old routing rules is read as the template they upgrade
 * to, without changing what it stores.
 */
export function buildEventNote(
	ev: EventNoteInput,
	cfg: EventNoteConfig,
	templateContent = "",
	now = Date.now(),
): BuiltEventNote {
	const template = upgradeEventNote({
		...cfg,
		properties: cfg.properties?.map((p) => ({ ...p })),
		fields: cfg.fields?.map((f) => ({ ...f })),
	});
	return buildClipNote(template, EVENT_NOTE_DEFAULTS, eventClipVars(ev, now), {
		templateText: templateContent,
		linkValue: ev.uid,
		fallbackName: ev.summary || "Event",
	});
}
