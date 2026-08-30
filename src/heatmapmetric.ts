import { localDayKey, parseNaturalDate } from "./dates";
import type { HeatmapConfig, HeatmapRule, HeatmapRuleField, HeatmapRuleOp } from "./types";

/**
 * The custom metric behind the heatmap card's advanced mode.
 *
 * Basic mode counts every markdown note on the day it was edited (or created),
 * which is all a "vault activity" grid needs. Advanced mode lets the grid stand
 * for something the vault actually tracks: workouts logged in a `date`
 * property, minutes read summed from `minutes`, notes tagged `#project` only —
 * a date to bucket by, a value to add, and rules picking which notes count.
 *
 * Everything here is pure and works on plain data ({@link HeatmapNote}), so it
 * is unit-testable without an Obsidian vault; the caller (see
 * `advancedActivityByDay` in `cardbodies.ts`) is the only part that touches the
 * metadata cache.
 */

/** Everything the metric reads about one note. */
export interface HeatmapNote {
	/** Vault-relative path, e.g. "Journal/2026-08-30.md". */
	path: string;
	/** File creation time, epoch ms. */
	ctime: number;
	/** Last modification time, epoch ms. */
	mtime: number;
	/** Parsed frontmatter, or undefined when the note has none. */
	frontmatter?: Record<string, unknown>;
	/** Every tag on the note, frontmatter and inline, each with its leading "#". */
	tags?: string[];
}

/** Read a frontmatter key case-insensitively — YAML keys are written however
 * the author felt that day ("Date", "date"), and a rule shouldn't silently miss
 * because of it. An exact hit wins; otherwise the first case-insensitive one. */
export function frontmatterValue(note: HeatmapNote, key: string): unknown {
	const fm = note.frontmatter;
	const k = key.trim();
	if (!fm || !k) return undefined;
	if (k in fm) return fm[k];
	const lower = k.toLowerCase();
	for (const name of Object.keys(fm)) {
		if (name.toLowerCase() === lower) return fm[name];
	}
	return undefined;
}

/** Flatten a frontmatter value to the strings a rule compares against. A list
 * yields one entry per item, so `contains` on a list property tests the items
 * rather than a stringified array. */
function asStrings(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) return value.flatMap((v) => asStrings(v));
	if (typeof value === "object") {
		const date = value as { toISOString?: () => string };
		if (typeof date.toISOString === "function") return [date.toISOString()];
		return [JSON.stringify(value)];
	}
	if (typeof value === "string") return [value];
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return [String(value)];
	}
	// A symbol or function in frontmatter isn't something a rule can compare.
	return [];
}

/** The parent folder of a note's path ("" for a note at the vault root). */
function folderOf(path: string): string {
	const cut = path.lastIndexOf("/");
	return cut < 0 ? "" : path.slice(0, cut);
}

/** The values a rule tests, and whether the field is present at all. `missing`
 * is not "has no value" — a property set to an empty string is still set. */
function subject(note: HeatmapNote, rule: HeatmapRule): { present: boolean; values: string[] } {
	const field: HeatmapRuleField = rule.field ?? "property";
	if (field === "tag") {
		const tags = note.tags ?? [];
		return { present: tags.length > 0, values: tags };
	}
	if (field === "folder") return { present: true, values: [folderOf(note.path)] };
	if (field === "path") return { present: true, values: [note.path] };
	const raw = frontmatterValue(note, rule.key ?? "");
	return { present: raw != null, values: asStrings(raw) };
}

/** A tag comparison is written however the user types it — with or without the
 * "#", and matching nested tags by their prefix ("#work" covers "#work/admin").
 * Normalising both sides here keeps every operator honest about that. */
function normalizeTag(text: string): string {
	return text.trim().replace(/^#/, "").toLowerCase();
}

/** The number in a value, or null when it isn't one. Blank is not zero. */
export function asNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "string") {
		const text = value.trim();
		if (!text) return null;
		const n = Number(text);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

/** Compare two values that are meant to be ordered: numerically when both are
 * numbers, by date when both are dates, and lexicographically otherwise (so
 * `gt`/`lt` still do something sensible on plain text). */
function compare(left: string, right: string): number {
	const ln = asNumber(left);
	const rn = asNumber(right);
	if (ln !== null && rn !== null) return ln === rn ? 0 : ln < rn ? -1 : 1;
	const ld = dayKeyOf(left);
	const rd = dayKeyOf(right);
	if (ld && rd) return ld === rd ? 0 : ld < rd ? -1 : 1;
	const la = left.trim().toLowerCase();
	const ra = right.trim().toLowerCase();
	return la === ra ? 0 : la < ra ? -1 : 1;
}

/** Does one note satisfy one rule? A rule that names no property key (and no
 * value where one is needed) is treated as unfinished and passes, so a
 * half-typed row in the editor doesn't blank the card. */
export function matchesRule(note: HeatmapNote, rule: HeatmapRule): boolean {
	const field: HeatmapRuleField = rule.field ?? "property";
	const op: HeatmapRuleOp = rule.op ?? "is";
	if (field === "property" && !(rule.key ?? "").trim()) return true;

	const { present, values } = subject(note, rule);
	if (op === "exists") return present;
	if (op === "missing") return !present;

	const raw = (rule.value ?? "").trim();
	if (!raw) return true;

	const tag = field === "tag";
	const needle = tag ? normalizeTag(raw) : raw.toLowerCase();
	const haystack = values.map((v) => (tag ? normalizeTag(v) : v.trim().toLowerCase()));

	switch (op) {
		case "is":
			// A tag matches its own name or any nested tag beneath it.
			return haystack.some((v) => v === needle || (tag && v.startsWith(`${needle}/`)));
		case "isNot":
			return !haystack.some((v) => v === needle || (tag && v.startsWith(`${needle}/`)));
		case "contains":
			return haystack.some((v) => v.includes(needle));
		case "notContains":
			return !haystack.some((v) => v.includes(needle));
		case "gt":
			return values.some((v) => compare(v, raw) > 0);
		case "lt":
			return values.some((v) => compare(v, raw) < 0);
		default:
			return true;
	}
}

/** Does a note pass the card's rules? No rules counts every note; "all" is AND,
 * "any" is OR. */
export function matchesRules(note: HeatmapNote, cfg: HeatmapConfig): boolean {
	const rules = cfg.rules ?? [];
	if (rules.length === 0) return true;
	if ((cfg.match ?? "all") === "any") return rules.some((r) => matchesRule(note, r));
	return rules.every((r) => matchesRule(note, r));
}

/** The local calendar day a single frontmatter value stands for, as
 * `YYYY-MM-DD`, or null when it isn't a date. Understands what actually turns
 * up in frontmatter: an ISO date or datetime, a Date the YAML parser already
 * built, an epoch timestamp, and a daily-note link (`[[2026-08-30]]`). */
export function dayKeyOf(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "number") {
		// Bare years ("2026") are not timestamps; anything else is treated as
		// epoch milliseconds, the unit every Obsidian file stat uses.
		if (!Number.isFinite(value) || value < 100_000) return null;
		return localDayKey(value);
	}
	if (typeof value === "object") {
		const date = value as { getTime?: () => number };
		if (typeof date.getTime === "function") {
			const ts = date.getTime();
			return Number.isFinite(ts) ? localDayKey(ts) : null;
		}
		return null;
	}
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!text) return null;
	// An ISO date, with or without a time part. Taken as a local wall-clock day:
	// a note dated 2026-08-30T23:30 belongs to the 30th wherever it is read.
	const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(text);
	if (iso) {
		const y = Number(iso[1]);
		const m = Number(iso[2]);
		const d = Number(iso[3]);
		if (m < 1 || m > 12 || d < 1 || d > 31) return null;
		const probe = new Date(y, m - 1, d);
		if (probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
		return `${iso[1]}-${iso[2]}-${iso[3]}`;
	}
	// Everything else — "[[2026-08-30]]", "30/08/2026", "today" — goes through
	// the same natural-date parser task due dates use.
	return parseNaturalDate(text);
}

/** Which date an advanced card buckets by. Falls back to the basic card's own
 * metric, so turning Advanced on keeps counting exactly what the card counted a
 * moment earlier rather than silently resetting to "modified". */
export function heatmapSource(cfg: HeatmapConfig): "modified" | "created" | "property" {
	return cfg.source ?? cfg.metric ?? "modified";
}

/** Every day a note lands on. A list-valued date property counts once per
 * parseable entry, so `dates: [a, b]` marks both days. */
export function noteDayKeys(note: HeatmapNote, cfg: HeatmapConfig): string[] {
	const source = heatmapSource(cfg);
	if (source === "created") return [localDayKey(note.ctime)];
	if (source === "modified") return [localDayKey(note.mtime)];
	const raw = frontmatterValue(note, cfg.dateProperty ?? "");
	const parts = Array.isArray(raw) ? raw : [raw];
	const keys: string[] = [];
	for (const part of parts) {
		const key = dayKeyOf(part);
		if (key && !keys.includes(key)) keys.push(key);
	}
	return keys;
}

/** What a note adds to each of its days: one, or the number in the configured
 * property. A "sum" note whose property isn't a number adds nothing — it has no
 * value to contribute, and counting it as 1 would quietly mix two metrics. */
export function noteWeight(note: HeatmapNote, cfg: HeatmapConfig): number {
	if ((cfg.value ?? "count") !== "sum") return 1;
	const raw = frontmatterValue(note, cfg.valueProperty ?? "");
	const parts = Array.isArray(raw) ? raw : [raw];
	let total = 0;
	let found = false;
	for (const part of parts) {
		const n = asNumber(part);
		if (n === null) continue;
		total += n;
		found = true;
	}
	return found ? total : 0;
}

/** Bucket notes into days by the card's custom metric, keyed `YYYY-MM-DD` —
 * the advanced-mode counterpart of `activityByDay`. */
export function heatmapByDay(notes: Iterable<HeatmapNote>, cfg: HeatmapConfig): Map<string, number> {
	const counts = new Map<string, number>();
	for (const note of notes) {
		if (!matchesRules(note, cfg)) continue;
		const weight = noteWeight(note, cfg);
		if (weight === 0) continue;
		for (const key of noteDayKeys(note, cfg)) {
			counts.set(key, (counts.get(key) ?? 0) + weight);
		}
	}
	return counts;
}

/** Display a day's total: whole numbers plainly, summed fractions to one
 * decimal (and never "3.0"), so a tooltip reads as a number a person wrote. */
export function formatHeatValue(value: number): string {
	if (Number.isInteger(value)) return String(value);
	return String(Math.round(value * 10) / 10);
}

/** Does the card's config actually need the metadata cache? A rule, a date
 * property or a summed value does; an advanced card that only renamed its unit
 * does not, and can keep using the cheap file-stat scan. */
export function needsMetadata(cfg: HeatmapConfig): boolean {
	if (!cfg.advanced) return false;
	if (heatmapSource(cfg) === "property") return true;
	if ((cfg.value ?? "count") === "sum") return true;
	return (cfg.rules ?? []).length > 0;
}
