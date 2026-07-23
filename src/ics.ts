/**
 * iCalendar (ICS) fetching, parsing and recurrence expansion for the
 * "calendar" card's external-calendar feature.
 *
 * Feeds are fetched through Obsidian's `requestUrl` (bypassing the browser CORS
 * restrictions a plain `fetch` would hit) and parsed with a small, dependency
 * free RFC 5545 reader — enough for the VEVENTs real calendars (Google, iCloud,
 * Fastmail, Nextcloud, …) publish: all-day and timed events, multi-day spans,
 * and the common recurrence rules (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL,
 * COUNT, UNTIL, weekly BYDAY, and EXDATE exclusions).
 *
 * Results are cached in memory per URL for a card-configurable window, mirroring
 * the RSS card: a board with several calendar cards (and Hearth's frequent full
 * re-renders) makes at most one request per feed per refresh window, degrades
 * gracefully offline (a failed fetch keeps the last good events), and skips the
 * outbound request entirely when the user has disabled external calls.
 *
 * Timezone note: `Z`-suffixed (UTC) and all-day dates are handled exactly.
 * `TZID`-qualified wall-clock times are interpreted in the viewer's local zone —
 * moment ships without a timezone database, so resolving arbitrary IANA zones
 * isn't possible here. For the common case (a calendar in the user's own zone)
 * this is correct; cross-zone events can land an hour or two off.
 */
import { moment as createMoment, requestUrl } from "obsidian";
import { localDayKey } from "./dates";

/** A single parsed VEVENT. Recurrence is kept as the raw RRULE plus EXDATE
 * starts, and expanded lazily per visible window at render time. */
export interface IcsEvent {
	uid: string;
	summary: string;
	location: string;
	/** Free-text notes (DESCRIPTION), unescaped, or "" when absent. */
	description: string;
	/** Associated URL (URL property), or "" when absent. */
	url: string;
	/** Epoch ms of the first occurrence's start. */
	start: number;
	/** Epoch ms of the first occurrence's end. All-day DTEND is exclusive.
	 * null when the event gives no end (treated as instantaneous / one day). */
	end: number | null;
	/** Whether this is a date-only (all-day) event. */
	allDay: boolean;
	/** Raw RRULE value (without the "RRULE:" prefix), or null for one-offs. */
	rrule: string | null;
	/** Epoch ms of excluded occurrence starts (EXDATE). */
	exdates: number[];
}

/** A parsed calendar: its display name plus its events. */
export interface IcsCalendar {
	/** X-WR-CALNAME (or the VCALENDAR NAME), or "" when absent. */
	name: string;
	events: IcsEvent[];
	/** Epoch ms when this was fetched. */
	fetched: number;
}

/** One concrete occurrence produced by expanding an event over a window. */
export interface IcsOccurrence {
	uid: string;
	summary: string;
	location: string;
	description: string;
	url: string;
	start: number;
	end: number | null;
	allDay: boolean;
	/** Filled by the caller: which configured source this came from. */
	sourceId?: string;
}

interface CacheEntry {
	cal: IcsCalendar | null;
	inflight: Promise<IcsCalendar | null> | null;
}

const cache = new Map<string, CacheEntry>();

/** The last-fetched calendar for a URL (possibly stale), or null if never loaded. */
export function cachedCalendar(url: string): IcsCalendar | null {
	return cache.get(url)?.cal ?? null;
}

/**
 * Return a calendar, fetching only when the cache is missing or older than
 * `ttlMs`. Concurrent callers for the same URL share one in-flight request.
 * Never throws: on failure it returns whatever was cached (possibly null).
 *
 * When `disabled` is true (the "disable external calls" setting) no request is
 * made — only an already-cached calendar, if any, is returned. Set `force` to
 * bypass the freshness check for an explicit manual refresh.
 */
export async function loadCalendar(
	url: string,
	opts: { ttlMs: number; disabled?: boolean; force?: boolean } = { ttlMs: 0 },
): Promise<IcsCalendar | null> {
	let entry = cache.get(url);
	if (!entry) {
		entry = { cal: null, inflight: null };
		cache.set(url, entry);
	}
	if (opts.disabled) return entry.cal;
	const fresh = entry.cal && Date.now() - entry.cal.fetched < opts.ttlMs;
	if (fresh && !opts.force) return entry.cal;
	if (entry.inflight) return entry.inflight;

	const current = entry;
	current.inflight = (async () => {
		try {
			// webcal:// is just https for subscription URLs; normalise it so
			// requestUrl (and pasted Apple/Google links) work unchanged.
			const res = await requestUrl({ url: url.replace(/^webcal:/i, "https:") });
			const parsed = parseIcs(res.text);
			// Keep prior events when a fetch returns something unparseable.
			if (parsed) current.cal = parsed;
			return current.cal;
		} catch {
			// Offline or blocked — keep any prior events.
			return current.cal;
		} finally {
			current.inflight = null;
		}
	})();
	return current.inflight;
}

/** Drop cached data so the next load refetches. Used when a source URL changes. */
export function forgetCalendar(url: string): void {
	cache.delete(url);
}

// ---- Parsing --------------------------------------------------------------

/** Parse a raw ICS document into a calendar, or null when it isn't one.
 * Exported for direct use and testing. */
export function parseIcs(raw: string): IcsCalendar | null {
	if (!/BEGIN:VCALENDAR/i.test(raw)) return null;
	const lines = unfold(raw);

	let name = "";
	const events: IcsEvent[] = [];
	let cur: Record<string, { value: string; params: Record<string, string> }[]> | null = null;

	for (const line of lines) {
		const upper = line.toUpperCase();
		if (upper === "BEGIN:VEVENT") {
			cur = {};
			continue;
		}
		if (upper === "END:VEVENT") {
			if (cur) {
				const ev = buildEvent(cur);
				if (ev) events.push(ev);
			}
			cur = null;
			continue;
		}
		const parsed = parseLine(line);
		if (!parsed) continue;
		if (cur) {
			(cur[parsed.name] ??= []).push({ value: parsed.value, params: parsed.params });
		} else if (parsed.name === "X-WR-CALNAME" || (parsed.name === "NAME" && !name)) {
			name = parsed.value;
		}
	}

	return { name, events, fetched: Date.now() };
}

/** Unfold RFC 5545 continuation lines: a CRLF followed by a space or tab
 * continues the previous logical line. Splits on CR, LF or CRLF. */
function unfold(raw: string): string[] {
	const physical = raw.split(/\r\n|\r|\n/);
	const out: string[] = [];
	for (const line of physical) {
		if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
			out[out.length - 1] += line.slice(1);
		} else {
			out.push(line);
		}
	}
	return out;
}

/** Split a content line into its property name, parameters and value.
 * e.g. `DTSTART;TZID=Europe/Paris:20260720T090000` →
 * { name: "DTSTART", params: { TZID: "Europe/Paris" }, value: "20260720T090000" }. */
function parseLine(
	line: string,
): { name: string; params: Record<string, string>; value: string } | null {
	const colon = line.indexOf(":");
	if (colon === -1) return null;
	const head = line.slice(0, colon);
	const value = line.slice(colon + 1);
	const parts = head.split(";");
	const name = parts[0].toUpperCase();
	const params: Record<string, string> = {};
	for (let i = 1; i < parts.length; i++) {
		const eq = parts[i].indexOf("=");
		if (eq === -1) continue;
		params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1).replace(/^"|"$/g, "");
	}
	return { name, params, value };
}

/** Assemble an IcsEvent from a VEVENT's collected properties, or null when it
 * lacks a usable DTSTART. */
function buildEvent(
	props: Record<string, { value: string; params: Record<string, string> }[]>,
): IcsEvent | null {
	const dtstart = props.DTSTART?.[0];
	if (!dtstart) return null;
	const start = parseIcsDate(dtstart.value, dtstart.params);
	if (start === null) return null;
	const allDay = isDateOnly(dtstart.value, dtstart.params);

	let end: number | null = null;
	const dtend = props.DTEND?.[0];
	if (dtend) {
		end = parseIcsDate(dtend.value, dtend.params);
	} else if (props.DURATION?.[0]) {
		const dur = parseDuration(props.DURATION[0].value);
		if (dur !== null) end = start + dur;
	}

	const exdates: number[] = [];
	for (const ex of props.EXDATE ?? []) {
		for (const v of ex.value.split(",")) {
			const ms = parseIcsDate(v.trim(), ex.params);
			if (ms !== null) exdates.push(ms);
		}
	}

	return {
		uid: props.UID?.[0]?.value ?? "",
		summary: unescapeText(props.SUMMARY?.[0]?.value ?? ""),
		location: unescapeText(props.LOCATION?.[0]?.value ?? ""),
		description: unescapeText(props.DESCRIPTION?.[0]?.value ?? ""),
		url: (props.URL?.[0]?.value ?? "").trim(),
		start,
		end,
		allDay,
		rrule: props.RRULE?.[0]?.value ?? null,
		exdates,
	};
}

/** True when a DATE-TIME value is really a date-only (all-day) value. */
function isDateOnly(value: string, params: Record<string, string>): boolean {
	return params.VALUE === "DATE" || /^\d{8}$/.test(value.trim());
}

/** Parse an ICS date or date-time value to epoch ms, or null.
 * - `YYYYMMDD` → local midnight (all-day).
 * - `YYYYMMDDTHHMMSSZ` → UTC.
 * - `YYYYMMDDTHHMMSS` (with or without TZID) → local wall-clock time (see the
 *   module timezone note). */
export function parseIcsDate(value: string, params: Record<string, string> = {}): number | null {
	const v = value.trim();
	const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
	if (dateOnly || params.VALUE === "DATE") {
		const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
		if (!m) return null;
		return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
	}
	const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
	if (!dt) return null;
	const [, y, mo, d, h, mi, s, z] = dt;
	if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
	return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

/** Parse an RFC 5545 DURATION (e.g. `P1DT2H`, `PT30M`, `-P1D`) to ms, or null. */
function parseDuration(value: string): number | null {
	const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
		value.trim(),
	);
	if (!m) return null;
	const [, sign, w, d, h, mi, s] = m;
	const ms =
		(+(w ?? 0) * 7 * 86400 + +(d ?? 0) * 86400 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) *
		1000;
	return sign === "-" ? -ms : ms;
}

/** Reverse ICS text escaping (`\n`, `\,`, `\;`, `\\`). */
function unescapeText(s: string): string {
	return s
		.replace(/\\n/gi, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\");
}

// ---- Recurrence expansion -------------------------------------------------

interface Moment {
	valueOf(): number;
	clone(): Moment;
	add(amount: number, unit: string): Moment;
	isoWeekday(): number;
	toDate(): Date;
}
const moment = createMoment as unknown as (input?: number | Date) => Moment;

const ICAL_DAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/** Hard cap on generated occurrences per event, so a malformed/endless RRULE
 * can never hang a render. */
const MAX_OCCURRENCES = 750;

/**
 * Expand every event into the concrete occurrences that intersect
 * `[windowStart, windowEnd)` (epoch ms). One-offs pass through when they
 * overlap; recurring events are unrolled by their RRULE. Never returns more
 * than MAX_OCCURRENCES per event.
 */
export function expandEvents(
	events: IcsEvent[],
	windowStart: number,
	windowEnd: number,
): IcsOccurrence[] {
	const out: IcsOccurrence[] = [];
	for (const ev of events) {
		const duration = ev.end !== null ? Math.max(0, ev.end - ev.start) : ev.allDay ? 86400_000 : 0;
		const emit = (start: number) => {
			if (ev.exdates.includes(start)) return;
			const end = ev.end !== null || ev.allDay ? start + duration : null;
			const effectiveEnd = end ?? start;
			if (start < windowEnd && effectiveEnd >= windowStart) {
				out.push({
					uid: ev.uid,
					summary: ev.summary,
					location: ev.location,
					description: ev.description,
					url: ev.url,
					start,
					end,
					allDay: ev.allDay,
				});
			}
		};

		if (!ev.rrule) {
			emit(ev.start);
			continue;
		}
		expandRecurring(ev, windowStart, windowEnd, duration, emit);
	}
	return out;
}

/** Unroll one recurring event's RRULE into `emit(startMs)` calls for every
 * occurrence that could intersect the window. */
function expandRecurring(
	ev: IcsEvent,
	windowStart: number,
	windowEnd: number,
	duration: number,
	emit: (start: number) => void,
): void {
	const rule = parseRRule(ev.rrule ?? "");
	if (!rule) {
		emit(ev.start);
		return;
	}
	const until = rule.until ?? Infinity;
	const hardEnd = Math.min(windowEnd, until === Infinity ? windowEnd : until + duration + 1);
	let count = 0;
	let emitted = 0;
	let cursor = moment(ev.start);

	// Weekly BYDAY (e.g. "MO,WE,FR") — the common multi-day weekly case.
	const byDays =
		rule.freq === "WEEKLY" && rule.byday.length
			? rule.byday.map((d) => ICAL_DAYS[d]).filter((n) => n !== undefined)
			: null;

	while (count < MAX_OCCURRENCES) {
		const base = cursor.valueOf();
		if (base > hardEnd) break;

		const starts = byDays ? weeklyStarts(cursor, byDays) : [base];
		for (const start of starts) {
			// BYDAY can name weekdays that fall before DTSTART in its first week;
			// those aren't real occurrences (the series begins at DTSTART).
			if (start < ev.start || start > until) continue;
			if (start + duration >= windowStart && start < windowEnd) emit(start);
			// COUNT is counted across every generated instance, per spec.
			emitted++;
			if (rule.count && emitted >= rule.count) return;
		}

		cursor = advance(cursor, rule.freq, rule.interval);
		count++;
	}
}

/** The concrete occurrence starts within the week of `cursor` that fall on the
 * requested weekdays, preserving the cursor's time-of-day.
 *
 * `byDays` uses RFC 5545's Sunday-based numbering (SU=0 … SA=6, see
 * ICAL_DAYS). `cursor.day()`/`startOf("week")` are locale-aware in moment —
 * for any locale whose week starts on Monday (Czech included), "day 0 of the
 * week" is Monday, not Sunday, so adding a raw SU=0..SA=6 offset from
 * `startOf("week")` landed on the wrong date and shifted events by up to
 * several days. `isoWeekday()` (Mon=1..Sun=7, locale-independent) sidesteps
 * that entirely: converting SU=0 to ISO 7 and MO=1..SA=6 stay as-is, then
 * offsetting straight from the cursor's own ISO weekday. */
function weeklyStarts(cursor: Moment, byDays: number[]): number[] {
	const curIso = cursor.isoWeekday();
	const out: number[] = [];
	for (const dow of byDays) {
		const iso = dow === 0 ? 7 : dow;
		const day = cursor.clone().add(iso - curIso, "days");
		// Re-apply the original time-of-day by copying it off the cursor.
		const c = cursor.toDate();
		const d = day.toDate();
		d.setHours(c.getHours(), c.getMinutes(), c.getSeconds(), c.getMilliseconds());
		out.push(d.getTime());
	}
	return out.sort((a, b) => a - b);
}

function advance(cursor: Moment, freq: string, interval: number): Moment {
	switch (freq) {
		case "DAILY":
			return cursor.clone().add(interval, "days");
		case "WEEKLY":
			return cursor.clone().add(interval, "weeks");
		case "MONTHLY":
			return cursor.clone().add(interval, "months");
		case "YEARLY":
			return cursor.clone().add(interval, "years");
		default:
			// Unknown frequency: step a day so the loop still terminates.
			return cursor.clone().add(1, "days");
	}
}

interface RRule {
	freq: string;
	interval: number;
	count: number | null;
	until: number | null;
	byday: string[];
}

/** Parse an RRULE value into its parts, or null when it has no FREQ. */
function parseRRule(raw: string): RRule | null {
	const parts: Record<string, string> = {};
	for (const kv of raw.split(";")) {
		const eq = kv.indexOf("=");
		if (eq !== -1) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
	}
	if (!parts.FREQ) return null;
	return {
		freq: parts.FREQ.toUpperCase(),
		interval: Math.max(1, parseInt(parts.INTERVAL ?? "1", 10) || 1),
		count: parts.COUNT ? parseInt(parts.COUNT, 10) || null : null,
		until: parts.UNTIL ? parseIcsDate(parts.UNTIL) : null,
		byday: parts.BYDAY
			? parts.BYDAY.split(",").map((d) => d.trim().replace(/^[+-]?\d+/, "").toUpperCase())
			: [],
	};
}

// ---- Day bucketing --------------------------------------------------------

/**
 * Bucket occurrences by local calendar day (`YYYY-MM-DD`). Multi-day events are
 * added to every day they cover: an all-day event's DTEND is exclusive, a timed
 * event that crosses midnight covers each spanned day. Within a day, all-day
 * events sort first, then by start time. Spans are capped so a runaway event
 * can't fill unbounded days.
 */
export function eventsByDay(occ: IcsOccurrence[]): Map<string, IcsOccurrence[]> {
	const map = new Map<string, IcsOccurrence[]>();
	for (const o of occ) {
		const startKey = localDayKey(o.start);
		add(map, startKey, o);
		if (o.end === null) continue;
		// The last covered day: all-day DTEND is exclusive, so step back a ms.
		const lastMs = o.allDay ? o.end - 1 : o.end;
		let day = dayStart(o.start);
		const lastDay = dayStart(lastMs);
		let guard = 0;
		while (day < lastDay && guard < 366) {
			day = dayStart(day + 86400_000 + 3600_000); // +1d (+1h DST slack), renormalised
			const key = localDayKey(day);
			if (key !== startKey) add(map, key, o);
			guard++;
		}
	}
	for (const list of map.values()) {
		list.sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
	}
	return map;
}

function dayStart(ts: number): number {
	const d = new Date(ts);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function add(map: Map<string, IcsOccurrence[]>, key: string, o: IcsOccurrence): void {
	(map.get(key) ?? map.set(key, []).get(key))!.push(o);
}
