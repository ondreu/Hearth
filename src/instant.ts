/**
 * Instant answers for the search bar: what a query *is*, when it isn't (only)
 * a search for a note.
 *
 * Typed into the vault search, some queries have an answer of their own:
 *
 * | typed                              | answer                                   |
 * | ---------------------------------- | ---------------------------------------- |
 * | `1+1`, `20% of 150`, `10 km to mi` | the calculator's result                  |
 * | `20 CZK to EUR`, `eur/usd`         | the conversion, plus the pair's chart    |
 * | `$AAPL`, `$apple`, `$btc`          | a live quote and chart (market lookup)   |
 * | `time in Tokyo`, `tokyo time`      | the clock there, and the offset to here  |
 * | `days until 2026-12-24`            | a day count                              |
 * | `today + 45 days`, `next friday`   | the date                                 |
 * | `=…`                               | forces the calculator                    |
 *
 * This file only decides which of those a query is. It is pure — no DOM, no
 * network — so the rules are tested directly (test/instant.test.ts); the
 * answer panel that fetches and draws lives in instantview.ts.
 *
 * Detection is deliberately conservative: the answer sits above the ordinary
 * note results, so a false positive costs a row, but a missed note name costs
 * more. A bare number, a date or a time of day is never a calculation, and
 * nothing here reaches the network unless the reader typed the `$` that asks
 * for a market lookup (or a currency conversion, which needs rates).
 */
import { moment } from "obsidian";
import { currencyConversion, evaluate } from "./calculator";
import { CURRENCY_CODES } from "./currency";
import { parseNaturalDate } from "./dates";

/** What a search query asks for, beyond matching notes. */
export type InstantIntent =
	/** Arithmetic or a unit conversion, answered by the calculator. `forced`
	 * when typed after `=`, so an error is worth showing. */
	| { kind: "calc"; input: string; forced: boolean }
	/** A currency conversion: `input` is what the calculator evaluates once it
	 * has rates, `from`/`to` name the pair (ISO, lower case) for the chart. */
	| { kind: "currency"; input: string; from: string; to: string }
	/** A market lookup (`$…`): a ticker, a fund code or a name to search. */
	| { kind: "market"; query: string }
	/** A date (YYYY-MM-DD), optionally as a count of days to or from it. */
	| { kind: "date"; date: string; count?: "until" | "since" }
	/** The time somewhere: an IANA zone and the place as typed. */
	| { kind: "time"; zone: string; place: string };

/** A leading `$` asks for a market lookup; a leading `=` forces the calculator. */
export const MARKET_PREFIX = "$";
export const CALC_PREFIX = "=";

const CURRENCIES = new Set(CURRENCY_CODES);

/** Places whose zone isn't named after them (or is named in another language). */
const ZONE_ALIASES: Record<string, string> = {
	utc: "UTC",
	gmt: "UTC",
	nyc: "America/New_York",
	"new york": "America/New_York",
	washington: "America/New_York",
	boston: "America/New_York",
	miami: "America/New_York",
	atlanta: "America/New_York",
	sf: "America/Los_Angeles",
	"san francisco": "America/Los_Angeles",
	seattle: "America/Los_Angeles",
	"silicon valley": "America/Los_Angeles",
	la: "America/Los_Angeles",
	houston: "America/Chicago",
	dallas: "America/Chicago",
	austin: "America/Chicago",
	beijing: "Asia/Shanghai",
	peking: "Asia/Shanghai",
	shenzhen: "Asia/Shanghai",
	hongkong: "Asia/Hong_Kong",
	delhi: "Asia/Kolkata",
	"new delhi": "Asia/Kolkata",
	mumbai: "Asia/Kolkata",
	bangalore: "Asia/Kolkata",
	india: "Asia/Kolkata",
	japan: "Asia/Tokyo",
	tokio: "Asia/Tokyo",
	kyiv: "Europe/Kyiv",
	kiev: "Europe/Kyiv",
	kyjev: "Europe/Kyiv",
	// Czech and German names for the places people most often ask about.
	praha: "Europe/Prague",
	prag: "Europe/Prague",
	brno: "Europe/Prague",
	londyn: "Europe/London",
	london: "Europe/London",
	pariz: "Europe/Paris",
	paris: "Europe/Paris",
	berlin: "Europe/Berlin",
	mnichov: "Europe/Berlin",
	munchen: "Europe/Berlin",
	munich: "Europe/Berlin",
	viden: "Europe/Vienna",
	wien: "Europe/Vienna",
	rim: "Europe/Rome",
	rom: "Europe/Rome",
	varsava: "Europe/Warsaw",
	warschau: "Europe/Warsaw",
	moskva: "Europe/Moscow",
	moskau: "Europe/Moscow",
	madrid: "Europe/Madrid",
	zurich: "Europe/Zurich",
	curych: "Europe/Zurich",
	// Czech after "čas v …" takes the locative.
	praze: "Europe/Prague",
	brne: "Europe/Prague",
	londyne: "Europe/London",
	parizi: "Europe/Paris",
	berline: "Europe/Berlin",
	vidni: "Europe/Vienna",
	rime: "Europe/Rome",
	varsave: "Europe/Warsaw",
	moskve: "Europe/Moscow",
	tokiu: "Asia/Tokyo",
	pekingu: "Asia/Shanghai",
	"new yorku": "America/New_York",
	"san franciscu": "America/Los_Angeles",
	"los angeles": "America/Los_Angeles",
	sydney: "Australia/Sydney",
	dubaji: "Asia/Dubai",
};

/** Lower case, accents off, separators as spaces: "São_Paulo" → "sao paulo". */
function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[_\s]+/g, " ")
		.trim();
}

/**
 * The IANA zone a place names, or null. `zones` is the runtime's list
 * (`Intl.supportedValuesOf("timeZone")`); a place matches a zone's city part
 * ("tokyo" → Asia/Tokyo), the whole zone ("europe/prague"), or an alias.
 */
export function resolveZone(place: string, zones: readonly string[]): string | null {
	const key = fold(place);
	if (!key) return null;
	const alias = ZONE_ALIASES[key];
	if (alias) return alias;
	for (const zone of zones) {
		if (fold(zone) === key) return zone;
	}
	for (const zone of zones) {
		const city = zone.split("/").pop() ?? "";
		if (fold(city) === key) return zone;
	}
	return null;
}

/** Minutes a zone is ahead of UTC at a moment (negative west of Greenwich),
 * or null if the runtime doesn't know the zone. */
export function zoneOffsetMinutes(zone: string, at: Date): number | null {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}).formatToParts(at);
	} catch {
		return null;
	}
	const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
	const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
	if (!Number.isFinite(wall)) return null;
	const whole = Math.floor(at.getTime() / 1000) * 1000;
	return Math.round((wall - whole) / 60_000);
}

/** "+2", "−5:30", "±0" — an offset in hours, as a clock reader writes it. */
export function formatOffset(minutes: number): string {
	if (minutes === 0) return "±0";
	const sign = minutes > 0 ? "+" : "−";
	const abs = Math.abs(minutes);
	const h = Math.floor(abs / 60);
	const m = abs % 60;
	return m ? `${sign}${h}:${String(m).padStart(2, "0")}` : `${sign}${h}`;
}

/** Whole calendar days from one YYYY-MM-DD to another (negative if earlier). */
export function daysBetween(from: string, to: string): number {
	const a = Date.parse(`${from}T00:00:00Z`);
	const b = Date.parse(`${to}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000);
}

/** The ISO week a YYYY-MM-DD falls in. */
export function isoWeek(date: string): number {
	const d = new Date(`${date}T00:00:00Z`);
	const weekday = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - weekday + 3);
	const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
	const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
	firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
	return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

const TIME_RE = /^(?:time|current time|what time is it|cas|kolik je hodin)\s+(?:in|at|v|ve)\s+(.+?)\??$/;
const TIME_SUFFIX_RE = /^(.+?)\s+time$/;

function detectTime(folded: string, zones: readonly string[]): InstantIntent | null {
	const m = TIME_RE.exec(folded) ?? TIME_SUFFIX_RE.exec(folded);
	if (!m) return null;
	const zone = resolveZone(m[1], zones);
	return zone ? { kind: "time", zone, place: m[1] } : null;
}

const COUNT_RE = /^(?:days?|dny|dnu)\s+(until|till|to|before|since|from|after|do|od)\s+(.+)$/;
const UNTIL_WORDS = new Set(["until", "till", "to", "before", "do"]);
const SHIFT_RE =
	/^(today|now|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\s*([+-])\s*(\d+)\s*(d|days?|w|wks?|weeks?|m|mos?|months?|y|yrs?|years?)$/;
const SHIFT_UNITS: Record<string, "day" | "week" | "month" | "year"> = { d: "day", w: "week", m: "month", y: "year" };
/** Phrases worth answering with a date on their own. A bare ISO date or a
 * weekday is left alone: typed into a vault search, that is far more often
 * the name of a daily note than a question. */
const DATE_PHRASE_RE =
	/^(?:today|tomorrow|yesterday|next (?:week|month|year|[a-z]+day)|this [a-z]+day|in \d+ (?:days?|weeks?|months?|years?)|(?:end|start) of (?:week|month|year)|eow|eom|eoy)$/;

function detectDate(folded: string): InstantIntent | null {
	const count = COUNT_RE.exec(folded);
	if (count) {
		const date = parseNaturalDate(count[2]);
		if (!date) return null;
		return { kind: "date", date, count: UNTIL_WORDS.has(count[1]) ? "until" : "since" };
	}
	const shift = SHIFT_RE.exec(folded);
	if (shift) {
		const start = parseNaturalDate(shift[1]);
		if (!start) return null;
		const unit = SHIFT_UNITS[shift[4].charAt(0)];
		const amount = Number(shift[3]) * (shift[2] === "-" ? -1 : 1);
		return { kind: "date", date: moment(start, "YYYY-MM-DD").add(amount, unit).format("YYYY-MM-DD") };
	}
	if (DATE_PHRASE_RE.test(folded)) {
		const date = parseNaturalDate(folded);
		return date ? { kind: "date", date } : null;
	}
	return null;
}

/** A bare number, a date or a time of day: never read as a sum, even though
 * `2026-10-02` evaluates (to 2014). */
function notMath(query: string): boolean {
	return (
		/^[-+]?[\d\s.,]+$/.test(query) ||
		/^\d{1,4}[-./]\d{1,2}(?:[-./]\d{1,4})?\.?$/.test(query) ||
		/^\d{1,2}:\d{2}/.test(query)
	);
}

/** A currency conversion, as the calculator will evaluate it. */
function detectCurrency(query: string): InstantIntent | null {
	const pair = /^([a-z]{3})\s*\/\s*([a-z]{3})$/i.exec(query);
	if (pair) {
		const from = pair[1].toLowerCase();
		const to = pair[2].toLowerCase();
		if (!CURRENCIES.has(from) || !CURRENCIES.has(to) || from === to) return null;
		return { kind: "currency", input: `1 ${from} to ${to}`, from, to };
	}
	const conv = currencyConversion(query);
	if (!conv) return null;
	return {
		kind: "currency",
		input: conv.hasAmount ? query : `1 ${conv.from} to ${conv.to}`,
		from: conv.from,
		to: conv.to,
	};
}

/**
 * What a search query asks for, or null when it's only a search. `zones` is
 * the runtime's list of time zones (empty where the runtime can't list them;
 * aliases still work).
 */
export function detectInstant(raw: string, zones: readonly string[] = []): InstantIntent | null {
	const query = raw.trim();
	if (!query) return null;

	// `$` followed by a letter: a market lookup. `$5 to czk` stays a currency
	// conversion — a dollar sign before a number is money, not a ticker.
	if (query.startsWith(MARKET_PREFIX)) {
		const rest = query.slice(MARKET_PREFIX.length).trim();
		if (rest && !/^[\d.,]/.test(rest)) return { kind: "market", query: rest };
	}

	if (query.startsWith(CALC_PREFIX)) {
		const rest = query.slice(CALC_PREFIX.length).trim();
		if (!rest) return null;
		return detectCurrency(rest) ?? { kind: "calc", input: rest, forced: true };
	}

	const currency = detectCurrency(query);
	if (currency) return currency;

	const folded = fold(query);
	const time = detectTime(folded, zones);
	if (time) return time;
	const date = detectDate(folded);
	if (date) return date;

	if (!/\d/.test(query) || notMath(query)) return null;
	const res = evaluate(query);
	if (!res.ok || !Number.isFinite(res.value)) return null;
	return { kind: "calc", input: query, forced: false };
}

/** Whether an answer should take Enter from the note results. A sum or a
 * quote is what the reader typed for; a date or a clock is a side note to a
 * query that may well be a note's name, so the first note keeps Enter. */
export function instantTakesEnter(intent: InstantIntent): boolean {
	return intent.kind === "calc" || intent.kind === "currency" || intent.kind === "market";
}

/** Whether the query is a lookup of its own, with no note search beside it. */
export function instantOnly(intent: InstantIntent): boolean {
	return intent.kind === "market" || (intent.kind === "calc" && intent.forced);
}
