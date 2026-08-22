/**
 * Locale-tolerant matching of daily-note filenames (issue #229).
 *
 * A daily note is named by a moment format string, and several of its tokens
 * render differently per locale: `dd`/`ddd`/`dddd` (weekday), `Do` (ordinal
 * day), `MMM`/`MMMM` (month name), `A`/`a` (meridiem). The file on disk was
 * written by whoever created it — the core Daily notes plugin, Periodic Notes
 * with its own locale override, a template, or another machine — so formatting
 * the same date under the locale moment happens to be running in *now* can
 * produce a different name than the one that exists: "Mi, 19.08.2026.md" for
 * an existing "Wed, 19.08.2026.md". A caller that only builds a path and looks
 * it up then misses the note entirely (a day streak reads 0, a calendar day
 * loses its dot).
 *
 * `dailyNameMatcher` turns the format into a regular expression that reads the
 * date back *out* of a filename, wildcarding every locale-dependent token —
 * none of them carries date information a numeric token doesn't already pin
 * down. It only reports a matcher when the format fixes the year, month and
 * day numerically; any other format (a month spelled out, a day-of-year, an
 * ISO-week date) keeps the exact-path behaviour it has always had, because
 * there the filename can't be read back without knowing the writing locale.
 */

export interface DailyNameMatcher {
	/** True when the format contains a token that renders per locale — the only
	 * case where scanning the folder can find a note a formatted path missed. */
	localeDependent: boolean;
	/** The `YYYY-MM-DD` day a filename (no folder, no `.md`) encodes, or null
	 * when the name isn't a daily note in this format. */
	dayKey(name: string): string | null;
}


/** moment format tokens, longest first so `YYYY` wins over `YY`. */
const TOKEN =
	/^(?:YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|Do|DD|D|dddd|ddd|dd|do|d|E|e|Q|Wo|WW|W|wo|ww|w|gggg|gg|GGGG|GG|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|SS|S|ZZ|Z|A|a|X|x)/;

/** Tokens whose rendering depends on the active locale. */
const LOCALE_TOKENS = new Set(["MMMM", "MMM", "Do", "do", "dddd", "ddd", "dd", "Wo", "wo", "A", "a"]);

/** Tokens we can't invert: they either name the date in words (month names) or
 * express it in a numbering we'd have to reconstruct (day of year, ISO weeks).
 * A format using one keeps exact-path matching. */
const OPAQUE_TOKENS = new Set([
	"MMMM",
	"MMM",
	"DDDD",
	"DDD",
	"Wo",
	"WW",
	"W",
	"wo",
	"ww",
	"w",
	"gggg",
	"gg",
	"GGGG",
	"GG",
]);

/** Everything else: the regex fragment a token matches, with no date meaning. */
const FILLERS: Record<string, string> = {
	dddd: "[^/]+?",
	ddd: "[^/]+?",
	dd: "[^/]+?",
	do: "\\d{1,2}[^\\d/]{0,3}",
	d: "\\d",
	E: "\\d",
	e: "\\d",
	Q: "\\d",
	HH: "\\d{2}",
	H: "\\d{1,2}",
	hh: "\\d{2}",
	h: "\\d{1,2}",
	kk: "\\d{2}",
	k: "\\d{1,2}",
	mm: "\\d{2}",
	m: "\\d{1,2}",
	ss: "\\d{2}",
	s: "\\d{1,2}",
	SSS: "\\d{3}",
	SS: "\\d{2}",
	S: "\\d",
	ZZ: "[+-]\\d{4}",
	Z: "[+-]\\d{2}:\\d{2}",
	A: "[^/]+?",
	a: "[^/]+?",
	X: "\\d+",
	x: "\\d+",
};


function escapeLiteral(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


/**
 * Build a matcher for a daily-note filename format, or null when the format
 * can't be read back (no numeric year/month/day, or an opaque token).
 */
export function dailyNameMatcher(format: string): DailyNameMatcher | null {
	let source = "";
	let localeDependent = false;
	let groups = 0;
	// Capture-group index per date part; 0 means "not seen yet". A repeated
	// token (say two `DD`) is matched non-capturing the second time, so the
	// group numbering stays stable.
	let year = 0;
	let yearShort = false;
	let month = 0;
	let day = 0;

	for (let i = 0; i < format.length; ) {
		const ch = format[i];
		// moment's own escaping: [text] is emitted verbatim.
		if (ch === "[") {
			const end = format.indexOf("]", i + 1);
			if (end === -1) return null;
			source += escapeLiteral(format.slice(i + 1, end));
			i = end + 1;
			continue;
		}
		const token = TOKEN.exec(format.slice(i))?.[0];
		if (!token) {
			source += escapeLiteral(ch);
			i += 1;
			continue;
		}
		i += token.length;
		if (OPAQUE_TOKENS.has(token)) return null;
		if (LOCALE_TOKENS.has(token)) localeDependent = true;

		if (token === "YYYY" || token === "YY") {
			const digits = token === "YYYY" ? "\\d{4}" : "\\d{2}";
			if (year) source += `(?:${digits})`;
			else {
				year = ++groups;
				yearShort = token === "YY";
				source += `(${digits})`;
			}
		} else if (token === "MM" || token === "M") {
			const digits = token === "MM" ? "\\d{2}" : "\\d{1,2}";
			if (month) source += `(?:${digits})`;
			else {
				month = ++groups;
				source += `(${digits})`;
			}
		} else if (token === "DD" || token === "D" || token === "Do") {
			const digits = token === "DD" ? "\\d{2}" : "\\d{1,2}";
			const suffix = token === "Do" ? "[^\\d/]{0,3}" : "";
			if (day) source += `(?:${digits})${suffix}`;
			else {
				day = ++groups;
				source += `(${digits})${suffix}`;
			}
		} else {
			source += FILLERS[token] ?? escapeLiteral(token);
		}
	}

	if (!year || !month || !day) return null;

	const re = new RegExp(`^${source}$`);
	return {
		localeDependent,
		dayKey(name: string): string | null {
			const m = re.exec(name);
			if (!m) return null;
			let y = Number(m[year]);
			// moment's two-digit year rule: 00–68 is 2000s, 69–99 is 1900s.
			if (yearShort) y += y < 69 ? 2000 : 1900;
			const mo = Number(m[month]);
			const d = Number(m[day]);
			// Reject a name that parses but isn't a real date (31.02, month 13).
			const date = new Date(Date.UTC(y, mo - 1, d));
			if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
				return null;
			}
			return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		},
	};
}
