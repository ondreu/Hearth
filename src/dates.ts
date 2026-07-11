import { moment as createMoment } from "obsidian";
import { t } from "./i18n";

/* A minimal, dependency-free natural-language date parser for task due dates.
 * Understands the everyday phrasings people jot down next to a checkbox or in
 * a TaskNotes `due` field: "today", "tomorrow", "yesterday", "next friday",
 * "friday", "in 3 days", "3 days", "next week", "end of month", "eow", an ISO
 * date (YYYY-MM-DD), or an English/Czech weekday name. Returns YYYY-MM-DD, or
 * null when the input isn't a recognised date expression (so the caller can
 * keep showing the raw text verbatim rather than inventing a date). */

interface Moment {
	format(fmt?: string): string;
	clone(): Moment;
	startOf(unit: string): Moment;
	endOf(unit: string): Moment;
	subtract(amount: number, unit: string): Moment;
	add(amount: number, unit: string): Moment;
	day(): number;
	diff(other: Moment, unit?: string): number;
	/** moment's isValid is a METHOD. Typed as such so a bare `m.isValid`
	 * (forgetting the call) is caught by the compiler (TS2774) rather than
	 * silently evaluating a truthy function reference. */
	isValid(): boolean;
}
interface MomentFn {
	(input?: string): Moment;
}
const moment = createMoment as unknown as MomentFn;

const WEEKDAYS: Record<string, number> = {
	// 1=Mon … 7=Sun (ISO weekday)
	sunday: 7, sun: 7,
	monday: 1, mon: 1,
	tuesday: 2, tue: 2, tues: 2,
	wednesday: 3, wed: 3, weds: 3,
	thursday: 4, thu: 4, thur: 4, thurs: 4,
	friday: 5, fri: 5,
	saturday: 6, sat: 6,
	// Czech
	pon: 1, pondeli: 1, "pondělí": 1,
	uto: 2, ut: 2, utery: 2, "úterý": 2,
	st: 3, stra: 3, streda: 3, "středa": 3,
	ct: 4, ctt: 4, ctvrtek: 4, "čt": 4, "čtvrtek": 4,
	pa: 5, pat: 5, patek: 5, "pá": 5, "pátek": 5,
	so: 6, sob: 6, sobota: 6,
	ne: 7, ned: 7, nedele: 7, "ně": 7, "neděle": 7,
};

/** Parse a natural-language date expression to YYYY-MM-DD (null if not a date). */
export function parseNaturalDate(input: string): string | null {
	const raw = input.trim().toLowerCase();
	if (!raw) return null;

	// Already an ISO date — pass through so existing YYYY-MM-DD entries work.
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
	if (iso) {
		const m = moment(`${iso[1]}-${iso[2]}-${iso[3]}`);
		if (!m.isValid()) return null;
		return m.format("YYYY-MM-DD");
	}

	const today = moment();

	// Bare weekday → the next occurrence (today's weekday rolls to next week).
	const wd = WEEKDAYS[raw];
	if (wd != null) return nextWeekday(today, wd).format("YYYY-MM-DD");
	if (raw.startsWith("next ")) {
		const w = WEEKDAYS[raw.slice(5).trim()];
		if (w != null) return nextWeekday(today, w, 1).format("YYYY-MM-DD");
	}
	// "this friday" → the same weekday this week (or today if it matches today).
	if (raw.startsWith("this ")) {
		const w = WEEKDAYS[raw.slice(5).trim()];
		if (w != null) return thisWeekday(today, w).format("YYYY-MM-DD");
	}

	const single: Record<string, () => string> = {
		today: () => today.format("YYYY-MM-DD"),
		tomorrow: () => today.clone().add(1, "day").format("YYYY-MM-DD"),
		tmrw: () => today.clone().add(1, "day").format("YYYY-MM-DD"),
		yesterday: () => today.clone().subtract(1, "day").format("YYYY-MM-DD"),
		tonight: () => today.format("YYYY-MM-DD"),
		now: () => today.format("YYYY-MM-DD"),
	};
	if (single[raw]) return single[raw]();

	// "next week" / "next month" / "next year"
	const nextUnit = /^next\s+(week|month|year)$/.exec(raw);
	if (nextUnit) return today.clone().add(1, nextUnit[1]).format("YYYY-MM-DD");

	// "in 3 days", "in 2 weeks", "in 1 month"
	const inN = /^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/.exec(raw);
	if (inN) {
		const unit = inN[2].endsWith("s") ? inN[2].slice(0, -1) : inN[2];
		return today.clone().add(parseInt(inN[1], 10), unit).format("YYYY-MM-DD");
	}
	// "3 days", "2 weeks", "1 month" (implicit "in")
	const nUnits = /^(\d+)\s+(day|days|week|weeks|month|months|year|years)$/.exec(raw);
	if (nUnits) {
		const unit = nUnits[2].endsWith("s") ? nUnits[2].slice(0, -1) : nUnits[2];
		return today.clone().add(parseInt(nUnits[1], 10), unit).format("YYYY-MM-DD");
	}

	// "end of week/month/year" + short forms
	const eow = /^end\s+of\s+(week|month|year)$/.exec(raw);
	if (eow) return today.clone().endOf(eow[1]).format("YYYY-MM-DD");
	const eowShort: Record<string, string> = { eow: "week", eom: "month", eoy: "year" };
	if (eowShort[raw]) return today.clone().endOf(eowShort[raw]).format("YYYY-MM-DD");

	// "start of week/month/year"
	const sow = /^start\s+of\s+(week|month|year)$/.exec(raw);
	if (sow) return today.clone().startOf(sow[1]).format("YYYY-MM-DD");

	// "next monday" already handled above; fall back to moment's own parser
	// for anything else (covers some locale-aware forms) — but only accept it
	// when it lands within a sane window (±5 years) so stray words don't get
	// silently coerced into weird dates.
	const guessed = moment(raw);
	if (guessed.isValid()) {
		const diff = Math.abs(guessed.diff(today, "year"));
		if (diff <= 5) return guessed.format("YYYY-MM-DD");
	}
	return null;
}

/** Format a YYYY-MM-DD (or datetime) as a short, human-relative label for the
 *  tasks card: "Today", "Tomorrow", "Yesterday", the weekday name for the
 *  rest of the week ("Friday"), "Next Friday" / "Last Friday" for the week
 *  after that, and a compact "D MMM" (e.g. "15 Jul") beyond. The caller adds
 *  the ↻ recurring suffix and the overdue tint; this returns only the date
 *  wording. Falls back to the raw string when it can't be parsed as a date. */
export function formatRelativeDate(dateStr: string): string {
	const iso = dateStr.slice(0, 10);
	const target = moment(iso);
	if (!target.isValid()) return dateStr;
	const today = moment().startOf("day");
	const m = target.startOf("day");
	const diff = Math.round(m.diff(today, "day"));
	if (diff === 0) return t().dates.today;
	if (diff === 1) return t().dates.tomorrow;
	if (diff === -1) return t().dates.yesterday;
	if (diff >= 2 && diff <= 6) return capitalize(m.format("dddd"));
	if (diff <= -2 && diff >= -6) return t().dates.daysAgo(Math.abs(diff));
	if (diff >= 7 && diff <= 13) return t().dates.nextWeekday(capitalize(m.format("dddd")));
	if (diff <= -7 && diff >= -13) return t().dates.lastWeekday(capitalize(m.format("dddd")));
	return m.format("D MMM");
}

function capitalize(s: string): string {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The next occurrence of weekday `target` (ISO 1..7). If `target` equals
 * today's weekday, `minForward` controls whether it rolls to next week (1) or
 * stays today (0). */
function nextWeekday(today: Moment, target: number, minForward = 0): Moment {
	const cur = isoWeekday(today);
	let diff = target - cur;
	if (diff < minForward) diff += 7;
	return today.clone().add(diff, "day");
}

function thisWeekday(today: Moment, target: number): Moment {
	const cur = isoWeekday(today);
	let diff = target - cur;
	if (diff < 0) diff += 7;
	return today.clone().add(diff, "day");
}

function isoWeekday(m: Moment): number {
	// moment's isoWeekday(): 1..7 (Mon..Sun). Fall back to day()+1 mapping if
	// the method isn't present on the (narrowly typed) Moment surface.
	const anyM = m as unknown as { isoWeekday?: () => number };
	if (typeof anyM.isoWeekday === "function") return anyM.isoWeekday();
	const d = m.day(); // 0..6 (Sun..Sat) in moment
	return d === 0 ? 7 : d;
}
