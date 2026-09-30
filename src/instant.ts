/**
 * Instant answers for the search bar: what a query *is*, when it isn't (only)
 * a search for a note.
 *
 * Typed into the vault search, some queries have an answer of their own:
 *
 * | typed                                  | answer                                |
 * | -------------------------------------- | ------------------------------------- |
 * | `1+1`, `20% of 150`, `10 km to mi`     | the calculator's result               |
 * | `20 CZK to EUR`, `20美元换成欧元`, `eur/usd` | the conversion and the pair's chart |
 * | `$AAPL`, `apple stock`, `Siemens Aktie`  | a live quote and chart                |
 * | `weather Prague`, `météo Paris`        | the weather there                     |
 * | `wiki Prague`, `wiki:de Prag`          | the Wikipedia article's summary       |
 * | `coin flip`, `pile ou face`, `roll 2d6` | a coin, dice, a random number        |
 * | `time in Tokyo`, `东京时间`             | the clock there, and the offset       |
 * | `days until 2026-12-24`, `Tage bis …`  | a day count                           |
 * | `today + 45 days`, `vendredi prochain` | the date                              |
 * | `=…`                                   | forces the calculator                 |
 *
 * Phrases are understood in the languages Hearth has a translation for —
 * English, German, French and Chinese.
 *
 * This file only decides which of those a query is. It is pure — no DOM, no
 * network — so the rules are tested directly (test/instant.test.ts); the
 * answer panel that fetches and draws lives in instantview.ts.
 *
 * Detection is deliberately conservative: the answer sits above the ordinary
 * note results, so a false positive costs a row, but a missed note name costs
 * more. A bare number, a date or a time of day is never a calculation, and
 * the network is reached only for a query that plainly asks for something
 * from it: a `$` or a "stock"/"Aktie"/"en bourse"/"股价" lookup, the weather, a wiki
 * summary, or a currency conversion (which needs rates).
 */
import { moment as createMoment } from "obsidian";
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
	/** A market lookup: a ticker, a fund code or a name to search. `keyword`
	 * when asked for in words (`apple stock`) rather than with `$`. */
	| { kind: "market"; query: string; keyword: boolean }
	/** The weather at a place, as typed. */
	| { kind: "weather"; place: string }
	/** A Wikipedia summary; `lang` picks the wiki, null for Obsidian's. */
	| { kind: "wiki"; query: string; lang: string | null }
	/** Chance: a coin, dice, or a whole number in a range. */
	| { kind: "coin" }
	| { kind: "dice"; count: number; sides: number }
	| { kind: "random"; min: number; max: number }
	/** A date (YYYY-MM-DD), optionally as a count of days to or from it. */
	| { kind: "date"; date: string; count?: "until" | "since" }
	/** The time somewhere: an IANA zone and the place as typed. */
	| { kind: "time"; zone: string; place: string };

/**
 * The answers that can be switched off one by one — vault-wide, per board and
 * per search-bar card (see effectiveHiddenInstantAnswers in types.ts). Chance
 * covers the coin, dice and random numbers.
 */
export const INSTANT_FEATURES = ["calc", "currency", "market", "weather", "wiki", "chance", "date", "time"] as const;
export type InstantFeature = (typeof INSTANT_FEATURES)[number];

/** Whether a stored id names a feature (for sanitizing imported settings). */
export function isInstantFeature(id: unknown): id is InstantFeature {
	return typeof id === "string" && (INSTANT_FEATURES as readonly string[]).includes(id);
}

/** The switchable feature an answer belongs to. */
export function instantFeature(intent: InstantIntent): InstantFeature {
	switch (intent.kind) {
		case "coin":
		case "dice":
		case "random":
			return "chance";
		default:
			return intent.kind;
	}
}

/** A leading `$` asks for a market lookup; a leading `=` forces the calculator. */
export const MARKET_PREFIX = "$";
export const CALC_PREFIX = "=";

const CURRENCIES = new Set(CURRENCY_CODES);

/** Places whose zone isn't named after them, or is named in another of the
 * languages Hearth speaks (English, German, French, Chinese). Keys are
 * folded (see fold below): lower case, no accents. */
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
	"los angeles": "America/Los_Angeles",
	houston: "America/Chicago",
	dallas: "America/Chicago",
	austin: "America/Chicago",
	beijing: "Asia/Shanghai",
	shenzhen: "Asia/Shanghai",
	hongkong: "Asia/Hong_Kong",
	delhi: "Asia/Kolkata",
	"new delhi": "Asia/Kolkata",
	mumbai: "Asia/Kolkata",
	bangalore: "Asia/Kolkata",
	india: "Asia/Kolkata",
	japan: "Asia/Tokyo",
	kyiv: "Europe/Kyiv",
	kiev: "Europe/Kyiv",
	munich: "Europe/Berlin",
	sydney: "Australia/Sydney",
	// German names.
	peking: "Asia/Shanghai",
	tokio: "Asia/Tokyo",
	prag: "Europe/Prague",
	wien: "Europe/Vienna",
	rom: "Europe/Rome",
	warschau: "Europe/Warsaw",
	moskau: "Europe/Moscow",
	munchen: "Europe/Berlin",
	koln: "Europe/Berlin",
	hamburg: "Europe/Berlin",
	frankfurt: "Europe/Berlin",
	kopenhagen: "Europe/Copenhagen",
	kairo: "Africa/Cairo",
	"neu-delhi": "Asia/Kolkata",
	// French names.
	pekin: "Asia/Shanghai",
	japon: "Asia/Tokyo",
	singapour: "Asia/Singapore",
	inde: "Asia/Kolkata",
	"nouvelle-delhi": "Asia/Kolkata",
	"nouvelle delhi": "Asia/Kolkata",
	londres: "Europe/London",
	edimbourg: "Europe/London",
	bruxelles: "Europe/Brussels",
	lisbonne: "Europe/Lisbon",
	barcelone: "Europe/Madrid",
	geneve: "Europe/Zurich",
	francfort: "Europe/Berlin",
	cologne: "Europe/Berlin",
	milan: "Europe/Rome",
	venise: "Europe/Rome",
	vienne: "Europe/Vienna",
	varsovie: "Europe/Warsaw",
	copenhague: "Europe/Copenhagen",
	athenes: "Europe/Athens",
	moscou: "Europe/Moscow",
	"le caire": "Africa/Cairo",
	"le cap": "Africa/Johannesburg",
	montreal: "America/Toronto",
	quebec: "America/Toronto",
	mexico: "America/Mexico_City",
	// Chinese names.
	北京: "Asia/Shanghai",
	上海: "Asia/Shanghai",
	深圳: "Asia/Shanghai",
	广州: "Asia/Shanghai",
	香港: "Asia/Hong_Kong",
	台北: "Asia/Taipei",
	东京: "Asia/Tokyo",
	首尔: "Asia/Seoul",
	新加坡: "Asia/Singapore",
	悉尼: "Australia/Sydney",
	迪拜: "Asia/Dubai",
	莫斯科: "Europe/Moscow",
	伦敦: "Europe/London",
	巴黎: "Europe/Paris",
	柏林: "Europe/Berlin",
	布拉格: "Europe/Prague",
	维也纳: "Europe/Vienna",
	罗马: "Europe/Rome",
	马德里: "Europe/Madrid",
	纽约: "America/New_York",
	华盛顿: "America/New_York",
	芝加哥: "America/Chicago",
	洛杉矶: "America/Los_Angeles",
	旧金山: "America/Los_Angeles",
	多伦多: "America/Toronto",
	温哥华: "America/Vancouver",
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

/** Collapse whitespace; the phrase rules below match case-insensitively. */
function tidy(text: string): string {
	return text.trim().replace(/\s+/g, " ");
}

/** The first rule that matches, and its capture groups. */
function firstMatch(text: string, rules: readonly RegExp[]): RegExpExecArray | null {
	for (const rule of rules) {
		const m = rule.exec(text);
		if (m) return m;
	}
	return null;
}

// ---- Time somewhere ------------------------------------------------------

const TIME_RULES: readonly RegExp[] = [
	/^(?:time|current time|local time|what time is it)\s+(?:in|at)\s+(.+?)\??$/i,
	/^(.+?)\s+(?:time|local time)$/i,
	/^(?:zeit|uhrzeit|wie sp(?:ä|a)t ist es)\s+in\s+(.+?)\??$/i,
	/^(.+?)\s+(?:zeit|uhrzeit)$/i,
	/^(?:l['’]\s?)?heure(?: locale)?\s+(?:à|a|au|aux|en)\s+(.+?)\s*\??$/i,
	/^quelle heure (?:est-il|il est)\s+(?:à|a|au|aux|en)\s+(.+?)\s*\??$/i,
	/^(.+?)\s+heure(?: locale)?$/i,
	/^(.+?)\s*(?:现在几点|几点了|时间)[?？]?$/,
];

function detectTime(q: string, zones: readonly string[]): InstantIntent | null {
	const m = firstMatch(q, TIME_RULES);
	if (!m) return null;
	const zone = resolveZone(m[1], zones);
	return zone ? { kind: "time", zone, place: m[1] } : null;
}

// ---- Dates ---------------------------------------------------------------

const FR_UNITS: Record<string, string> = { semaine: "week", mois: "month", annee: "year", an: "year" };
const WEEKDAY_WORDS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

/** German, French and Chinese date words, in the English the date parser
 * reads. Accents are folded first, so "année" and "annee" read alike. */
function englishDate(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/(\d+)\s*天后/g, "in $1 days")
		.replace(/(\d+)\s*(?:周|星期)后/g, "in $1 weeks")
		.replace(/(\d+)\s*个月后/g, "in $1 months")
		.replace(/(\d+)\s*年后/g, "in $1 years")
		.replace(/今天/g, "today")
		.replace(/明天/g, "tomorrow")
		.replace(/昨天/g, "yesterday")
		.replace(/(\d)\s*天/g, "$1 days")
		.replace(/(\d)\s*(?:周|星期)/g, "$1 weeks")
		.replace(/(\d)\s*个月/g, "$1 months")
		.replace(/(\d)\s*年/g, "$1 years")
		.replace(/(^|\s)heute(?=\s|$|[+-])/g, "$1today")
		.replace(/(^|\s)morgen(?=\s|$)/g, "$1tomorrow")
		.replace(/(^|\s)gestern(?=\s|$)/g, "$1yesterday")
		.replace(/(\d\s*)(?:tagen|tage|tag)(?=\s|$)/g, "$1days")
		.replace(/(\d\s*)(?:wochen|woche)(?=\s|$)/g, "$1weeks")
		.replace(/(\d\s*)(?:monaten|monate|monat)(?=\s|$)/g, "$1months")
		.replace(/(\d\s*)(?:jahren|jahre|jahr)(?=\s|$)/g, "$1years")
		.replace(/(^|\s)n(?:ä|a)chste[nrs]?(?=\s)/g, "$1next")
		.replace(/(^|\s)diese[nrs]?(?=\s)/g, "$1this")
		.replace(/montag/g, "monday")
		.replace(/dienstag/g, "tuesday")
		.replace(/mittwoch/g, "wednesday")
		.replace(/donnerstag/g, "thursday")
		.replace(/freitag/g, "friday")
		.replace(/samstag|sonnabend/g, "saturday")
		.replace(/sonntag/g, "sunday")
		// French. Adjectives follow the noun: "vendredi prochain", "la semaine
		// prochaine", so the word order is swapped after the words are.
		.replace(/aujourd['’]hui/g, "today")
		.replace(/(^|\s)demain(?=\s|$)/g, "$1tomorrow")
		.replace(/(^|\s)hier(?=\s|$)/g, "$1yesterday")
		.replace(/(^|\s)dans(?=\s+\d)/g, "$1in")
		.replace(/(\d\s*)jours?(?=\s|$)/g, "$1days")
		.replace(/(\d\s*)semaines?(?=\s|$)/g, "$1weeks")
		.replace(/(\d\s*)mois(?=\s|$)/g, "$1months")
		.replace(/(\d\s*)(?:annees?|ans?)(?=\s|$)/g, "$1years")
		.replace(/(^|\s)(fin|debut)\s+(?:du|de la|de l['’]|de)\s*(semaine|mois|annee)(?=\s|$)/g, (_m, pre: string, edge: string, unit: string) => `${pre}${edge === "fin" ? "end" : "start"} of ${FR_UNITS[unit]}`)
		.replace(/(^|\s)(?:(?:la|le)\s+|l['’]\s?)?(semaine|mois|annee|an)\s+prochaine?(?=\s|$)/g, (_m, pre: string, unit: string) => `${pre}next ${FR_UNITS[unit]}`)
		.replace(/(^|\s)lundi(?=\s|$)/g, "$1monday")
		.replace(/(^|\s)mardi(?=\s|$)/g, "$1tuesday")
		.replace(/(^|\s)mercredi(?=\s|$)/g, "$1wednesday")
		.replace(/(^|\s)jeudi(?=\s|$)/g, "$1thursday")
		.replace(/(^|\s)vendredi(?=\s|$)/g, "$1friday")
		.replace(/(^|\s)samedi(?=\s|$)/g, "$1saturday")
		.replace(/(^|\s)dimanche(?=\s|$)/g, "$1sunday")
		.replace(new RegExp(`(^|\\s)(${WEEKDAY_WORDS})\\s+prochain(?=\\s|$)`, "g"), "$1next $2")
		.replace(new RegExp(`(^|\\s)ce\\s+(${WEEKDAY_WORDS})(?=\\s|$)`, "g"), "$1this $2")
		.replace(new RegExp(`(^|\\s)prochain\\s+(${WEEKDAY_WORDS})(?=\\s|$)`, "g"), "$1next $2")
		.replace(/\s+/g, " ")
		.trim();
}

const COUNT_UNTIL: readonly RegExp[] = [
	/^(?:days?|how many days)\s+(?:until|till|to|before)\s+(.+)$/i,
	/^tage\s+bis\s+(.+)$/i,
	/^(?:combien de )?jours\s+(?:jusqu['’]\s?(?:à|a|au)|avant(?:\s+le)?)\s+(.+?)\s*\??$/i,
	/^(?:距离?|到)\s*(.+?)\s*还有(?:几|多少)天[?？]?$/,
];
const COUNT_SINCE: readonly RegExp[] = [
	/^(?:days?|how many days)\s+(?:since|from|after)\s+(.+)$/i,
	/^tage\s+seit\s+(.+)$/i,
	/^(?:combien de )?jours\s+depuis(?:\s+le)?\s+(.+?)\s*\??$/i,
	/^(?:自|从)?\s*(.+?)\s*(?:以来|至今)(?:已经)?(?:过了)?(?:几|多少)天[?？]?$/,
];
const SHIFT_RE =
	/^(today|now|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\s*([+-])\s*(\d+)\s*(d|days?|w|wks?|weeks?|m|mos?|months?|y|yrs?|years?)$/;
/** The one call this module makes on moment, typed here as in dates.ts: some
 * toolchains cannot resolve the type of the moment Obsidian re-exports, which
 * would leave the call untyped. */
interface ShiftMoment {
	add(amount: number, unit: string): ShiftMoment;
	format(fmt: string): string;
}
const moment = createMoment as unknown as (input: string, format: string) => ShiftMoment;
const SHIFT_UNITS: Record<string, "day" | "week" | "month" | "year"> = { d: "day", w: "week", m: "month", y: "year" };
/** Phrases worth answering with a date on their own. A bare ISO date or a
 * weekday is left alone: typed into a vault search, that is far more often
 * the name of a daily note than a question. */
const DATE_PHRASE_RE =
	/^(?:today|tomorrow|yesterday|next (?:week|month|year|[a-z]+day)|this [a-z]+day|in \d+ (?:days?|weeks?|months?|years?)|(?:end|start) of (?:week|month|year)|eow|eom|eoy)$/;

function detectDate(q: string): InstantIntent | null {
	const until = firstMatch(q, COUNT_UNTIL);
	const since = until ? null : firstMatch(q, COUNT_SINCE);
	const count = until ?? since;
	if (count) {
		const date = parseNaturalDate(englishDate(count[1]));
		return date ? { kind: "date", date, count: until ? "until" : "since" } : null;
	}
	const text = englishDate(q);
	const shift = SHIFT_RE.exec(text);
	if (shift) {
		const start = parseNaturalDate(shift[1]);
		if (!start) return null;
		const unit = SHIFT_UNITS[shift[4].charAt(0)];
		const amount = Number(shift[3]) * (shift[2] === "-" ? -1 : 1);
		return { kind: "date", date: moment(start, "YYYY-MM-DD").add(amount, unit).format("YYYY-MM-DD") };
	}
	if (DATE_PHRASE_RE.test(text)) {
		const date = parseNaturalDate(text);
		return date ? { kind: "date", date } : null;
	}
	return null;
}

// ---- Market, weather, Wikipedia --------------------------------------------

/** A name with a word that says "the market price of": `apple stock`,
 * `Siemens Aktie`, `LVMH en bourse`, `茅台股价`. French has no one-word
 * marker that isn't also an everyday note title ("action", "cours"), so
 * only the unambiguous phrases are read. */
const MARKET_RULES: readonly RegExp[] = [
	/^(.+?)\s+(?:stock|stocks|shares?|stock price|share price|price|quote|etf|fund)$/i,
	/^(?:stock|stocks|quote|price of|share price of)\s+(.+)$/i,
	/^(.+?)\s+(?:aktie|aktien|aktienkurs|kurs|fonds)$/i,
	/^(?:aktie|aktienkurs|kurs)\s+(.+)$/i,
	/^(.+?)\s+(?:en bourse|cours de bourse|cours de l['’]action)$/i,
	/^(?:cours de l['’]action|cours de bourse)\s+(.+)$/i,
	/^(.+?)\s*(?:股价|股票|行情|基金|价格|走势)$/,
];

const WEATHER_RULES: readonly RegExp[] = [
	/^(?:weather|forecast|weather forecast)(?:\s+(?:in|for|at))?\s+(.+)$/i,
	/^(.+?)\s+(?:weather|forecast)$/i,
	/^(?:wetter|wettervorhersage)(?:\s+(?:in|f(?:ü|u)r))?\s+(.+)$/i,
	/^(.+?)\s+(?:wetter)$/i,
	/^(?:m(?:é|e)t(?:é|e)o|pr(?:é|e)visions? m(?:é|e)t(?:é|e)o)(?:\s+(?:à|a|au|aux|en|de|du|pour|sur))?\s+(.+)$/i,
	/^(.+?)\s+m(?:é|e)t(?:é|e)o$/i,
	/^(?:天气预报|天气)\s*(.+)$/,
	/^(.+?)\s*(?:天气预报|天气)$/,
];

/** `wiki Prague`, `Prague wiki`, `wiki:de Prag`, `维基 布拉格`. The optional
 * `:xx` picks the wiki's language; without it, Obsidian's is used. */
const WIKI_RULES: readonly { re: RegExp; query: number; lang: number }[] = [
	{ re: /^(?:wiki|wikip(?:e|é)dia)(?::([a-z]{2,3}))?\s+(.+)$/i, query: 2, lang: 1 },
	{ re: /^(.+?)\s+(?:wiki|wikip(?:e|é)dia)(?::([a-z]{2,3}))?$/i, query: 1, lang: 2 },
	{ re: /^(?:维基百科|维基)\s*(.+)$/, query: 1, lang: 0 },
	{ re: /^(.+?)\s*(?:维基百科|维基)$/, query: 1, lang: 0 },
];

function detectWiki(q: string): InstantIntent | null {
	for (const rule of WIKI_RULES) {
		const m = rule.re.exec(q);
		if (!m) continue;
		const query = m[rule.query].trim();
		if (!query) return null;
		const lang = rule.lang ? m[rule.lang]?.toLowerCase() ?? null : /\p{Script=Han}/u.test(query) ? "zh" : null;
		return { kind: "wiki", query, lang };
	}
	return null;
}

// ---- Chance ----------------------------------------------------------------

const COIN_RE =
	/^(?:coin|coin ?flip|flip a coin|toss a coin|heads or tails|m(?:ü|u)nze|m(?:ü|u)nzwurf|m(?:ü|u)nze werfen|kopf oder zahl|pile ou face|(?:tirer|jouer) (?:à|a) pile ou face|lancer une pi(?:è|e)ce|抛硬币|掷硬币|扔硬币|硬币)$/i;
const DIE_RE =
	/^(?:roll|dice|roll a die|roll dice|w(?:ü|u)rfel|w(?:ü|u)rfeln|lancer (?:un|le) d(?:é|e)|lancer (?:les|des) d(?:é|e)s|掷骰子|骰子)$/i;
const DICE_RE = /^(?:roll\s+|w(?:ü|u)rfel\s+|lancer\s+|掷\s*)?(\d{0,3})\s*[dw](\d{1,4})$/i;
const RANDOM_RE =
	/^(?:random|random number|rand|zufall|zufallszahl|nombre al(?:é|e)atoire|al(?:é|e)atoire|随机数|随机)(?:\s*(?:between\s+|zwischen\s+|entre\s+)?(-?\d+)(?:\s*(?:-|to|and|bis|und|et|à|到|至|~)\s*(-?\d+))?)?$/i;

/** Largest range or dice count worth answering; beyond it it's a typo. */
const CHANCE_MAX = 1e9;

function detectChance(q: string): InstantIntent | null {
	if (COIN_RE.test(q)) return { kind: "coin" };
	if (DIE_RE.test(q)) return { kind: "dice", count: 1, sides: 6 };
	const dice = DICE_RE.exec(q);
	if (dice) {
		const count = dice[1] ? Number(dice[1]) : 1;
		const sides = Number(dice[2]);
		if (count < 1 || count > 100 || sides < 2) return null;
		return { kind: "dice", count, sides };
	}
	const random = RANDOM_RE.exec(q);
	if (random) {
		let min = 1;
		let max = 100;
		if (random[1] !== undefined && random[2] !== undefined) {
			min = Number(random[1]);
			max = Number(random[2]);
		} else if (random[1] !== undefined) {
			max = Number(random[1]);
		}
		if (min > max) [min, max] = [max, min];
		if (Math.abs(min) > CHANCE_MAX || Math.abs(max) > CHANCE_MAX || min === max) return null;
		return { kind: "random", min, max };
	}
	return null;
}

/** A whole number in [min, max], from a source of [0, 1) (Math.random). */
export function rollBetween(min: number, max: number, rnd: () => number): number {
	return min + Math.floor(rnd() * (max - min + 1));
}

// ---- Numbers ---------------------------------------------------------------

/** A bare number, a date or a time of day: never read as a sum, even though
 * `2026-10-02` evaluates (to 2014). */
function notMath(query: string): boolean {
	return (
		/^[-+]?[\d\s.,]+$/.test(query) ||
		/^\d{1,4}[-./]\d{1,2}(?:[-./]\d{1,4})?\.?$/.test(query) ||
		/^\d{1,2}:\d{2}/.test(query)
	);
}

/** `FF hex to decimal`: hex digits may all be letters, so a query that names
 * hex as its source gets to the calculator without a digit. Only this shape —
 * a word that could be a hex number, "hex", a connector and a target. */
const HEX_WORDS_RE = /^[0-9a-f]+\s+hex(?:adecimal|adécimal)?\s+(?:to|in|into|as|nach|en)\s+\S+$/i;

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
	if (!conv || conv.from === conv.to) return null;
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
export function detectInstant(
	raw: string,
	zones: readonly string[] = [],
	enabled: (feature: InstantFeature) => boolean = () => true,
): InstantIntent | null {
	const intent = detectAny(tidy(raw), zones, enabled);
	return intent && enabled(instantFeature(intent)) ? intent : null;
}

/** The first reading of a query whose feature is on. A switched-off feature
 * is skipped rather than ending the search, so with the market answer off,
 * `apple stock` is left to the notes but `1+1` still sums. */
function detectAny(
	query: string,
	zones: readonly string[],
	enabled: (feature: InstantFeature) => boolean,
): InstantIntent | null {
	if (!query) return null;

	// `$` followed by a letter: a market lookup. `$5 to czk` stays a currency
	// conversion — a dollar sign before a number is money, not a ticker.
	if (query.startsWith(MARKET_PREFIX)) {
		const rest = query.slice(MARKET_PREFIX.length).trim();
		if (rest && !/^[\d.,]/.test(rest)) return enabled("market") ? { kind: "market", query: rest, keyword: false } : null;
	}

	if (query.startsWith(CALC_PREFIX)) {
		const rest = query.slice(CALC_PREFIX.length).trim();
		if (!rest) return null;
		const currency = enabled("currency") ? detectCurrency(rest) : null;
		return currency ?? { kind: "calc", input: rest, forced: true };
	}

	const currency = enabled("currency") ? detectCurrency(query) : null;
	if (currency) return currency;

	const market = enabled("market") ? firstMatch(query, MARKET_RULES) : null;
	if (market && market[1].trim()) return { kind: "market", query: market[1].trim(), keyword: true };

	const weather = enabled("weather") ? firstMatch(query, WEATHER_RULES) : null;
	if (weather && weather[1].trim()) return { kind: "weather", place: weather[1].trim() };

	const wiki = enabled("wiki") ? detectWiki(query) : null;
	if (wiki) return wiki;

	const chance = enabled("chance") ? detectChance(query) : null;
	if (chance) return chance;

	const time = enabled("time") ? detectTime(query, zones) : null;
	if (time) return time;
	const date = enabled("date") ? detectDate(query) : null;
	if (date) return date;

	if (!enabled("calc") || !(/\d/.test(query) || HEX_WORDS_RE.test(query)) || notMath(query)) return null;
	const res = evaluate(query);
	if (!res.ok || !Number.isFinite(res.value)) return null;
	return { kind: "calc", input: query, forced: false };
}

/** Whether an answer should take Enter from the note results. What the reader
 * typed a phrase for — a sum, a quote, the weather — takes it; a date or a
 * clock is a side note to a query that may well be a note's name, so the
 * first note keeps Enter. */
export function instantTakesEnter(intent: InstantIntent): boolean {
	return intent.kind !== "date" && intent.kind !== "time";
}

/** Whether the query is a lookup of its own, with no note search beside it. */
export function instantOnly(intent: InstantIntent): boolean {
	return (intent.kind === "market" && !intent.keyword) || (intent.kind === "calc" && intent.forced);
}
