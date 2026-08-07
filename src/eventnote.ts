/**
 * Turning an external calendar event into a vault note, driven entirely by the
 * calendar card's `eventNote` configuration.
 *
 * The design goal is flexibility: the user decides what happens to each event
 * value. Every field (name, date, start/end time, location, description, URL,
 * calendar) is routed by a rule to one of three destinations — dropped, written
 * as a frontmatter property (under a key they choose), or appended to the note
 * body (optionally under a heading). A template can seed the body, the filename
 * is a placeholder pattern, and a link key stores the event UID so the same
 * event always maps to the same note.
 *
 * This module is pure (no Obsidian file I/O): it takes an event plus the config
 * and returns the pieces — folder, filename, body and frontmatter — that the
 * caller writes to disk. That keeps every substitution and routing rule unit
 * testable without a vault.
 */
import { moment as createMoment } from "obsidian";

/** The event values that can be routed into a note. */
export type EventField =
	| "summary"
	| "date"
	| "start"
	| "end"
	| "location"
	| "description"
	| "url"
	| "calendar";

/** Where a field's value goes. */
export type EventFieldAction = "ignore" | "frontmatter" | "body";

/** One routing rule: send `field` to `action`, under an optional `key`
 * (frontmatter property name, or a body heading) and `format` (for dates). */
export interface EventNoteFieldRule {
	field: EventField;
	action: EventFieldAction;
	/** Frontmatter property name, or heading for a body section. */
	key?: string;
	/** moment format string for date/time fields (date, start, end). */
	format?: string;
}

/** The calendar card's event → note configuration. */
export interface EventNoteConfig {
	/** Show the "Create note" action in the event modal. */
	enabled?: boolean;
	/** Target folder (vault-relative). Empty = vault root. */
	folder?: string;
	/** Filename pattern with `{{field}}` placeholders. Default `{{summary}}`. */
	filename?: string;
	/** Optional template file whose contents seed the body (placeholders
	 * substituted). */
	template?: string;
	/** Frontmatter property that stores the event UID, so an event maps to one
	 * note. Empty string disables linking. Default `event_uid`. */
	linkKey?: string;
	/** Per-field routing rules. When omitted, {@link DEFAULT_EVENT_NOTE_FIELDS}
	 * apply. */
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
export interface BuiltEventNote {
	folder: string;
	filename: string;
	body: string;
	frontmatter: Record<string, string>;
}

/** Sensible out-of-the-box routing so the feature works before any tuning:
 * date and time as frontmatter, description into the body, location/url/calendar
 * as frontmatter. The name is always the filename, so it needs no rule. */
export const DEFAULT_EVENT_NOTE_FIELDS: EventNoteFieldRule[] = [
	{ field: "date", action: "frontmatter", key: "date", format: "YYYY-MM-DD" },
	{ field: "start", action: "frontmatter", key: "time", format: "HH:mm" },
	{ field: "location", action: "frontmatter", key: "location" },
	{ field: "calendar", action: "frontmatter", key: "calendar" },
	{ field: "description", action: "body" },
];

const DEFAULT_KEYS: Record<EventField, string> = {
	summary: "title",
	date: "date",
	start: "start",
	end: "end",
	location: "location",
	description: "description",
	url: "url",
	calendar: "calendar",
};

const moment = createMoment as unknown as (input?: number | Date) => { format(fmt?: string): string };

/** The formatted string value of a single event field. Date/time fields honour
 * `format` (default day for `date`, time for `start`/`end`); all-day events have
 * no clock time, so `start`/`end` fall back to the date. Returns "" when the
 * event has no value for the field. */
export function eventFieldValue(field: EventField, ev: EventNoteInput, format?: string): string {
	switch (field) {
		case "summary":
			return ev.summary;
		case "location":
			return ev.location;
		case "description":
			return ev.description;
		case "url":
			return ev.url;
		case "calendar":
			return ev.calendar;
		case "date":
			return moment(new Date(ev.start)).format(format || "YYYY-MM-DD");
		case "start":
			return ev.allDay
				? moment(new Date(ev.start)).format(format || "YYYY-MM-DD")
				: moment(new Date(ev.start)).format(format || "HH:mm");
		case "end":
			if (ev.end === null) return "";
			return ev.allDay
				? moment(new Date(ev.end)).format(format || "YYYY-MM-DD")
				: moment(new Date(ev.end)).format(format || "HH:mm");
	}
}

/** Substitute `{{field}}` and `{{field:FMT}}` placeholders in `text`. Unknown
 * tokens are left untouched so template authors see their typos. */
export function applyEventPlaceholders(text: string, ev: EventNoteInput): string {
	return text.replace(/\{\{\s*([a-z]+)\s*(?::\s*([^}]+?)\s*)?\}\}/gi, (whole, name: string, fmt?: string) => {
		const field = name.toLowerCase();
		if (!isEventField(field)) return whole;
		return eventFieldValue(field, ev, fmt);
	});
}

function isEventField(name: string): name is EventField {
	return name in DEFAULT_KEYS;
}

/** Strip characters illegal in a vault filename, collapse whitespace. */
export function sanitizeFilename(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Assemble the note for an event from the config. `templateContent` is the raw
 * text of the configured template (already read by the caller), or "" for none.
 * Pure — the caller handles folder creation, filename collisions and writing.
 */
export function buildEventNote(
	ev: EventNoteInput,
	cfg: EventNoteConfig,
	templateContent = "",
): BuiltEventNote {
	const rules = cfg.fields ?? DEFAULT_EVENT_NOTE_FIELDS;
	const frontmatter: Record<string, string> = {};
	const bodyParts: string[] = [];

	for (const rule of rules) {
		if (rule.action === "ignore") continue;
		const value = eventFieldValue(rule.field, ev, rule.format);
		if (!value) continue;
		if (rule.action === "frontmatter") {
			frontmatter[(rule.key || DEFAULT_KEYS[rule.field]).trim()] = value;
		} else {
			const heading = rule.key?.trim();
			bodyParts.push(heading ? `## ${heading}\n\n${value}` : value);
		}
	}

	// The link key ties the event to its note (one note per UID). Empty disables.
	const linkKey = cfg.linkKey === undefined ? "event_uid" : cfg.linkKey.trim();
	if (linkKey && ev.uid) frontmatter[linkKey] = ev.uid;

	let body = templateContent ? applyEventPlaceholders(templateContent, ev) : "";
	if (bodyParts.length) body = body ? `${body.replace(/\s+$/, "")}\n\n${bodyParts.join("\n\n")}` : bodyParts.join("\n\n");

	const filename =
		sanitizeFilename(applyEventPlaceholders(cfg.filename || "{{summary}}", ev)) ||
		sanitizeFilename(ev.summary) ||
		"Event";

	return {
		folder: (cfg.folder || "").trim().replace(/^\/+|\/+$/g, ""),
		filename,
		body,
		frontmatter,
	};
}
