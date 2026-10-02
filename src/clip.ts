/**
 * Note templates: how a thing from outside the vault — a calendar event, a
 * feed entry — becomes a note.
 *
 * Modelled on the Obsidian Web Clipper, whose templates many people already
 * know: a template is a note name, a folder, a list of properties and a body,
 * and every one of them is text with `{{variable}}` placeholders that can be
 * piped through filters — `{{published|date:"YYYY-MM-DD"}}`,
 * `{{title|lower|truncate:40}}`, `{{categories|wikilink|join}}`. Each property
 * has a type, as in Obsidian's own property editor, so a list stays a list
 * and a date stays a date.
 *
 * This replaces the calendar's older "field routing" rules (send each event
 * value to a property, the body or nowhere). Those were a second, weaker
 * template language with its own vocabulary; a template you can read top to
 * bottom says the same thing, and says it the way the note will look. The
 * old `{{field:FORMAT}}` placeholders still work, as shorthand for the date
 * filter, so templates written for them keep working.
 *
 * Pure: no vault access. The caller resolves the variables, reads any template
 * note, and writes the result (see {@link buildClipNote}).
 */
import { moment as createMoment } from "obsidian";

/** A point in time with the format it reads as when no filter says otherwise. */
export interface ClipDate {
	date: number;
	format: string;
}

/** What a variable holds. */
export type ClipValue = string | string[] | ClipDate;

/** The variables a template is filled from, by name. */
export type ClipVars = Record<string, ClipValue | undefined>;

/** The types a property can have — the ones Obsidian's property editor knows. */
export type ClipPropertyType = "text" | "list" | "number" | "checkbox" | "date" | "datetime";

export const CLIP_PROPERTY_TYPES: readonly ClipPropertyType[] = [
	"text",
	"list",
	"number",
	"checkbox",
	"date",
	"datetime",
];

/** One frontmatter property: its name, a value template, and its type. */
export interface ClipProperty {
	name: string;
	value: string;
	type?: ClipPropertyType;
}

/** A note template as a card stores it. Every field left out takes the
 * kind's default ({@link ClipDefaults}), so a fresh card works untouched and
 * an edited one stores only what was changed. */
export interface ClipTemplate {
	/** Show the "Save as note" / "Create note" action. Default true. */
	enabled?: boolean;
	/** Folder for new notes; may hold variables (`Clippings/{{feed}}`). */
	folder?: string;
	/** The note's name. */
	name?: string;
	/** The note's properties, in order. */
	properties?: ClipProperty[];
	/** The note's body. */
	body?: string;
	/** A vault note whose text opens the body, filled the same way. */
	template?: string;
	/** Property that ties the note to its source (an event's UID, an entry's
	 * id), so the same thing always opens the same note. Empty: never. */
	linkKey?: string;
}

/** What a template falls back to, field by field. */
export interface ClipDefaults {
	name: string;
	folder: string;
	properties: ClipProperty[];
	body: string;
	linkKey: string;
}

const moment = createMoment as unknown as (input?: number | Date) => { format(fmt?: string): string; isValid(): boolean };

/** A date variable. */
export function clipDate(ms: number, format: string): ClipDate {
	return { date: ms, format };
}

function isDate(v: ClipValue | undefined): v is ClipDate {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A value as text: a list joins with commas, a date takes its own format. */
export function clipText(v: ClipValue | undefined): string {
	if (v === undefined) return "";
	if (Array.isArray(v)) return v.join(", ");
	if (isDate(v)) return moment(v.date).format(v.format);
	return v;
}

function isEmpty(v: ClipValue | undefined): boolean {
	if (v === undefined) return true;
	if (Array.isArray(v)) return v.length === 0;
	if (isDate(v)) return false;
	return v.trim() === "";
}

/** Variables every template has, whatever it is filled from. */
export function commonClipVars(now = Date.now()): ClipVars {
	return {
		now: clipDate(now, "YYYY-MM-DD HH:mm"),
		today: clipDate(now, "YYYY-MM-DD"),
	};
}

// ---- Parsing ------------------------------------------------------------

/** `{{ … }}`, lazily, so two on one line stay two. */
const TOKEN = /\{\{([\s\S]*?)\}\}/g;

interface Expression {
	name: string;
	filters: { name: string; args: string[] }[];
}

/** Split on `sep` outside double or single quotes. */
function splitOutside(text: string, sep: string): string[] {
	const parts: string[] = [];
	let quote: string | null = null;
	let current = "";
	for (const ch of text) {
		if (quote) {
			if (ch === quote) quote = null;
			current += ch;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
		} else if (ch === sep) {
			parts.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts;
}

function unquote(arg: string): string {
	const s = arg.trim();
	if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
	return s;
}

/** Parse the inside of a `{{ }}`, or null when it names no variable. The
 * legacy `{{date:YYYY-MM-DD}}` form (a colon straight after the name, before
 * any pipe) is read as `{{date|date:"YYYY-MM-DD"}}`. */
function parseExpression(inner: string): Expression | null {
	const pieces = splitOutside(inner, "|");
	let head = pieces[0].trim();
	const filters: Expression["filters"] = [];
	const legacy = /^([a-z_][\w]*)\s*:\s*(.+)$/i.exec(head);
	if (legacy) {
		head = legacy[1];
		filters.push({ name: "date", args: [unquote(legacy[2])] });
	}
	if (!/^[a-z_][\w]*$/i.test(head)) return null;
	for (const raw of pieces.slice(1)) {
		const at = raw.indexOf(":");
		const name = (at < 0 ? raw : raw.slice(0, at)).trim().toLowerCase();
		const args = at < 0 ? [] : splitOutside(raw.slice(at + 1), ",").map(unquote);
		if (name) filters.push({ name, args });
	}
	return { name: head.toLowerCase(), filters };
}

// ---- Filters --------------------------------------------------------------

/** The filters a template can use, for the editor's reference list. */
export const CLIP_FILTERS = [
	"date",
	"lower",
	"upper",
	"title",
	"capitalize",
	"trim",
	"truncate",
	"replace",
	"default",
	"split",
	"join",
	"first",
	"last",
	"list",
	"wikilink",
	"link",
	"blockquote",
	"safe_name",
] as const;

export type ClipFilter = (typeof CLIP_FILTERS)[number];

/** Apply `fn` to each item of a list, or to the text of anything else. */
function eachText(v: ClipValue, fn: (s: string) => string): ClipValue {
	return Array.isArray(v) ? v.map(fn) : fn(clipText(v));
}

function titleCase(s: string): string {
	return s.toLowerCase().replace(/(^|[\s\-_/])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function applyFilter(v: ClipValue, name: string, args: string[]): ClipValue {
	switch (name as ClipFilter) {
		case "date": {
			const fmt = args[0] || "YYYY-MM-DD";
			if (isDate(v)) return moment(v.date).format(fmt);
			const text = clipText(v).trim();
			const ms = Date.parse(text);
			return Number.isNaN(ms) ? text : moment(ms).format(fmt);
		}
		case "lower":
			return eachText(v, (s) => s.toLowerCase());
		case "upper":
			return eachText(v, (s) => s.toUpperCase());
		case "title":
			return eachText(v, titleCase);
		case "capitalize":
			return eachText(v, (s) => s.charAt(0).toUpperCase() + s.slice(1));
		case "trim":
			return eachText(v, (s) => s.trim());
		case "truncate": {
			const max = Number.parseInt(args[0] ?? "", 10);
			if (!(max > 0)) return v;
			return eachText(v, (s) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s));
		}
		case "replace": {
			const [from, to = ""] = args;
			if (!from) return v;
			return eachText(v, (s) => s.split(from).join(to));
		}
		case "default":
			return isEmpty(v) ? (args[0] ?? "") : v;
		case "split": {
			if (Array.isArray(v)) return v;
			const sep = args[0] || ",";
			return clipText(v)
				.split(sep)
				.map((s) => s.trim())
				.filter(Boolean);
		}
		case "join":
			return Array.isArray(v) ? v.join(args[0] ?? ", ") : v;
		case "first":
			return Array.isArray(v) ? (v[0] ?? "") : v;
		case "last":
			return Array.isArray(v) ? (v[v.length - 1] ?? "") : v;
		case "list":
			return (Array.isArray(v) ? v : [clipText(v)]).filter((s) => s.trim()).map((s) => `- ${s}`).join("\n");
		case "wikilink":
			return eachText(v, (s) => (s.trim() ? `[[${s.trim()}]]` : s));
		case "link": {
			const label = args[0];
			return eachText(v, (s) => (s.trim() ? `[${label || s}](${s.trim()})` : s));
		}
		case "blockquote":
			return clipText(v)
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n");
		case "safe_name":
			return eachText(v, sanitizeFilename);
		default:
			// An unknown filter changes nothing; the preview shows the typo.
			return v;
	}
}

// ---- Rendering --------------------------------------------------------------

/** One expression's value, or undefined when it names no known variable. */
function evaluate(expr: Expression, vars: ClipVars): ClipValue | undefined {
	if (!(expr.name in vars)) return undefined;
	let value: ClipValue = vars[expr.name] ?? "";
	for (const f of expr.filters) value = applyFilter(value, f.name, f.args);
	return value;
}

/** Fill every placeholder in `text`. A placeholder naming no known variable is
 * left as written, so a typo shows in the note (and the preview) rather than
 * vanishing. */
export function renderClip(text: string, vars: ClipVars): string {
	return text.replace(TOKEN, (whole, inner: string) => {
		const expr = parseExpression(inner);
		if (!expr) return whole;
		const value = evaluate(expr, vars);
		return value === undefined ? whole : clipText(value);
	});
}

/** A template's value with its shape kept: a template that is exactly one
 * placeholder yields that placeholder's value (a list stays a list, a date a
 * date); anything else is rendered to text. */
export function renderClipValue(text: string, vars: ClipVars): ClipValue {
	const only = /^\s*\{\{([\s\S]*?)\}\}\s*$/.exec(text);
	if (only && !only[1].includes("}}")) {
		const expr = parseExpression(only[1]);
		if (expr) {
			const value = evaluate(expr, vars);
			if (value !== undefined) return value;
		}
	}
	return renderClip(text, vars);
}

/** A property's value as it goes into frontmatter, or undefined when it comes
 * out empty and the property is left out. */
export function clipPropertyValue(prop: ClipProperty, vars: ClipVars): unknown {
	const value = renderClipValue(prop.value, vars);
	if (isEmpty(value)) return undefined;
	switch (prop.type ?? "text") {
		case "list": {
			const items = Array.isArray(value)
				? value
				: clipText(value)
						.split(",")
						.map((s) => s.trim());
			const kept = items.filter((s) => s.trim());
			return kept.length ? kept : undefined;
		}
		case "number": {
			const n = Number(clipText(value).trim().replace(",", "."));
			return Number.isFinite(n) ? n : undefined;
		}
		case "checkbox":
			return /^(true|yes|1|on|x)$/i.test(clipText(value).trim());
		case "date":
			return isDate(value) ? moment(value.date).format("YYYY-MM-DD") : clipText(value);
		case "datetime":
			return isDate(value) ? moment(value.date).format("YYYY-MM-DDTHH:mm") : clipText(value);
		default:
			return clipText(value);
	}
}

/** Strip characters a vault file name can't hold, collapse whitespace. */
export function sanitizeFilename(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim();
}

/** A folder path from a filled template: each segment made safe, empty ones
 * dropped. */
function sanitizeFolder(path: string): string {
	return path
		.split("/")
		.map((seg) => sanitizeFilename(seg))
		.filter(Boolean)
		.join("/");
}

/** The assembled note, ready for the caller to write. */
export interface BuiltClipNote {
	folder: string;
	filename: string;
	frontmatter: Record<string, unknown>;
	body: string;
}

/** A template with every field it leaves out taken from the defaults. */
export function resolveClipTemplate(cfg: ClipTemplate, defaults: ClipDefaults): Required<Omit<ClipTemplate, "enabled" | "template">> & Pick<ClipTemplate, "template"> {
	return {
		folder: cfg.folder ?? defaults.folder,
		name: cfg.name ?? defaults.name,
		properties: cfg.properties ?? defaults.properties,
		body: cfg.body ?? defaults.body,
		template: cfg.template,
		linkKey: cfg.linkKey ?? defaults.linkKey,
	};
}

/**
 * Fill a template. `templateText` is the template note's raw text (already
 * read by the caller), or "" for none; it opens the body. `linkValue` is what
 * the link property stores (the event's UID, the entry's id).
 */
export function buildClipNote(
	cfg: ClipTemplate,
	defaults: ClipDefaults,
	vars: ClipVars,
	opts: { templateText?: string; linkValue?: string; fallbackName?: string } = {},
): BuiltClipNote {
	const t = resolveClipTemplate(cfg, defaults);
	const frontmatter: Record<string, unknown> = {};
	for (const prop of t.properties) {
		const key = prop.name.trim();
		if (!key) continue;
		const value = clipPropertyValue(prop, vars);
		if (value !== undefined) frontmatter[key] = value;
	}
	const linkKey = t.linkKey.trim();
	if (linkKey && opts.linkValue) frontmatter[linkKey] = opts.linkValue;

	const parts = [opts.templateText ? renderClip(opts.templateText, vars) : "", renderClip(t.body, vars)]
		.map((s) => s.replace(/^\s*\n|\s+$/g, ""))
		.filter(Boolean);

	const filename =
		sanitizeFilename(renderClip(t.name, vars)) || sanitizeFilename(opts.fallbackName ?? "") || "Untitled";

	return {
		folder: sanitizeFolder(renderClip(t.folder, vars)),
		filename,
		frontmatter,
		body: parts.join("\n\n"),
	};
}

/** The note as text — frontmatter block and body — for the editor's
 * preview. Not what is written: the file gets its frontmatter through
 * Obsidian's own `processFrontMatter`, which picks the YAML quoting. */
export function previewClipNote(note: BuiltClipNote): string {
	const lines: string[] = [];
	const keys = Object.keys(note.frontmatter);
	if (keys.length) {
		lines.push("---");
		for (const key of keys) {
			const v = note.frontmatter[key];
			if (Array.isArray(v)) {
				lines.push(`${key}:`);
				for (const item of v) lines.push(`  - ${String(item)}`);
			} else {
				lines.push(`${key}: ${String(v)}`);
			}
		}
		lines.push("---");
	}
	if (note.body) lines.push(note.body);
	return lines.join("\n");
}
