/**
 * Terminal mode's text primitives: widths, padding, truncation and the
 * segment/line model every text-drawn card is built from.
 *
 * Pure on purpose — no Obsidian import and no DOM — so the arithmetic the whole
 * character grid rests on is unit-testable on its own (test/tui-text.test.ts).
 *
 * Everything here counts in *cells*, not in JavaScript string length. A cell is
 * one column of the grid: Latin, box drawing and block characters take one;
 * East Asian wide characters take two; combining marks take none. Getting this
 * wrong is what makes a terminal UI's right-hand borders wobble, so every
 * measurement goes through {@link cellWidth}.
 */

/** The look a run of text takes. Each maps to one `hearth-tui-*` class in
 * styles.css, and every colour behind them comes from the active scheme. */
export type TuiStyle =
	| "dim"
	| "faint"
	| "accent"
	| "green"
	| "red"
	| "yellow"
	| "blue"
	| "magenta"
	| "cyan"
	| "bold"
	| "italic"
	| "underline"
	| "strike"
	| "reverse"
	| "header"
	| "header-sort"
	| "block"
	| "heat1"
	| "heat2"
	| "heat3"
	| "heat4"
	| "rule";

/** One run of text in a single look, optionally interactive. */
export interface Seg {
	text: string;
	style?: TuiStyle | TuiStyle[];
	/** Makes the run a control: clicked or activated with Enter/Space. */
	onClick?: (evt: MouseEvent | KeyboardEvent) => void;
	/** Right-click (or long-press) on the run. */
	onMenu?: (evt: MouseEvent) => void;
	/** Tooltip / accessible label for an interactive run whose text is terse. */
	label?: string;
	/** A colour of the user's own (a task field's, a calendar's) — any CSS
	 * colour. Takes precedence over the style's colour. */
	color?: string;
}

/** One row of the grid. */
export type Line = Seg[];

/** Build a segment. */
export function seg(text: string, style?: TuiStyle | TuiStyle[], onClick?: Seg["onClick"]): Seg {
	return onClick ? { text, style, onClick } : style ? { text, style } : { text };
}

/** The styles of a segment as an array. */
export function styles(s: Seg): TuiStyle[] {
	if (!s.style) return [];
	return Array.isArray(s.style) ? s.style : [s.style];
}

/** A copy of `s` with `extra` added to its styles. */
export function withStyle(s: Seg, ...extra: TuiStyle[]): Seg {
	return { ...s, style: [...styles(s), ...extra] };
}

// ---- Widths -----------------------------------------------------------------

/** Unicode ranges drawn two cells wide in a terminal (East Asian Wide and
 * Fullwidth). Kept to the blocks text in a vault realistically contains. */
const WIDE_RANGES: [number, number][] = [
	[0x1100, 0x115f], // Hangul Jamo initials
	[0x2e80, 0x303e], // CJK radicals, punctuation
	[0x3041, 0x33ff], // Hiragana, Katakana, CJK symbols
	[0x3400, 0x4dbf], // CJK extension A
	[0x4e00, 0x9fff], // CJK unified ideographs
	[0xa000, 0xa4cf], // Yi
	[0xac00, 0xd7a3], // Hangul syllables
	[0xf900, 0xfaff], // CJK compatibility ideographs
	[0xfe30, 0xfe4f], // CJK compatibility forms
	[0xff00, 0xff60], // Fullwidth forms
	[0xffe0, 0xffe6], // Fullwidth signs
	[0x20000, 0x3fffd], // CJK extensions B and up
];

/** Combining marks and other zero-width code points. */
function isZeroWidth(cp: number): boolean {
	return (
		(cp >= 0x0300 && cp <= 0x036f) ||
		(cp >= 0x1ab0 && cp <= 0x1aff) ||
		(cp >= 0x1dc0 && cp <= 0x1dff) ||
		(cp >= 0x20d0 && cp <= 0x20ff) ||
		(cp >= 0xfe00 && cp <= 0xfe0f) ||
		(cp >= 0xfe20 && cp <= 0xfe2f) ||
		cp === 0x200b ||
		cp === 0x200c ||
		cp === 0x200d ||
		cp === 0x2060 ||
		cp === 0xfeff
	);
}

/** How many cells one code point takes: 0, 1 or 2. */
export function cellWidth(ch: string): number {
	const cp = ch.codePointAt(0) ?? 0;
	if (cp < 0x20 || isZeroWidth(cp)) return 0;
	if (cp < 0x1100) return 1;
	for (const [lo, hi] of WIDE_RANGES) if (cp >= lo && cp <= hi) return 2;
	return 1;
}

/** Whether a code point is drawn two cells wide. */
export function isWide(ch: string): boolean {
	return cellWidth(ch) === 2;
}

/** The width of a string in cells. */
export function strWidth(s: string): number {
	let n = 0;
	for (const ch of s) n += cellWidth(ch);
	return n;
}

/** The width of a line in cells. */
export function lineWidth(line: Line): number {
	let n = 0;
	for (const s of line) n += strWidth(s.text);
	return n;
}

// ---- Emoji ------------------------------------------------------------------

/**
 * Emoji a vault commonly carries, and the ASCII a terminal would write instead.
 * Anything not listed is dropped (see {@link asciify}).
 */
const EMOJI_ASCII: Record<string, string> = {
	"🙂": ":)", "😊": ":)", "😀": ":D", "😃": ":D", "😄": ":D", "😁": ":D", "😆": "XD", "😂": ":'D", "🤣": "XD",
	"😉": ";)", "😍": "<3", "🥰": "<3", "😘": ":*", "😎": "B)", "🤔": "?", "😐": ":|", "😑": ":|", "🙁": ":(",
	"☹": ":(", "😞": ":(", "😢": ":'(", "😭": ":'(", "😡": ">:(", "😠": ">:(", "😮": ":O", "😲": ":O", "😱": ":O",
	"😴": "zZ", "🤯": "*_*", "😇": "O:)", "🙃": "(:", "😜": ";P", "😛": ":P", "🤓": "8)", "🥳": "\\o/", "🙌": "\\o/",
	"❤": "<3", "💜": "<3", "💙": "<3", "💚": "<3", "💛": "<3", "🧡": "<3", "🖤": "<3", "🤍": "<3", "💔": "</3",
	"👍": "+1", "👎": "-1", "👏": "*clap*", "🙏": "*thanks*", "👋": "o/", "💪": "*",
	"✅": "[x]", "☑": "[x]", "✔": "v", "❌": "[ ]", "✖": "x", "❎": "x", "⬜": "[ ]", "🔲": "[ ]", "🔳": "[ ]",
	"⭐": "*", "🌟": "*", "✨": "*", "💫": "*", "🔥": "^", "💥": "!", "❗": "!", "❕": "!", "❓": "?",
	"❔": "?", "‼": "!!", "⁉": "!?", "🚨": "!", "🚩": "!", "📌": "*", "📍": "*", "🔖": "*",
	"➕": "+", "➖": "-", "➗": "/", 
	"🔄": "(r)", "🔁": "(r)", "🔂": "(r)", "⏸": "||", "⏹": "[]", "⏺": "o", "⏩": ">>", "⏪": "<<",
	"📅": "[cal]", "📆": "[cal]", "🗓": "[cal]", "⏰": "[t]", "⏱": "[t]", "⌛": "[t]", "⏳": "[t]", "🕐": "[t]",
	"📝": "[note]", "📄": "[doc]", "📃": "[doc]", "📑": "[doc]", "📁": "[dir]", "📂": "[dir]", "🗂": "[dir]",
	"📚": "[books]", "📖": "[book]", "📕": "[book]", "📗": "[book]", "📘": "[book]", "📙": "[book]", "🔗": "[link]",
	"📎": "[att]", "✏": "[edit]", "🖊": "[edit]", "🔍": "[?]", "🔎": "[?]", "💡": "[idea]", "🧠": "[brain]",
	"🏠": "[home]", "🏡": "[home]", "💼": "[work]", "🎯": "[goal]", "🏆": "[win]", "🎉": "\\o/", "🎊": "\\o/",
	"🎁": "[gift]", "📦": "[box]", "🛒": "[cart]", "💰": "$", "💵": "$", "💸": "$", "💳": "[card]", "📈": "[up]",
	"📉": "[down]", "📊": "[chart]", "🔔": "[bell]", "🔕": "[mute]", "📣": "[!]", "📢": "[!]", "💬": "[msg]",
	"📧": "[mail]", "✉": "[mail]", "📨": "[mail]", "📞": "[tel]", "📱": "[phone]", "💻": "[pc]", "🖥": "[pc]",
	"⚙": "[cfg]", "🔧": "[fix]", "🛠": "[fix]", "🔨": "[fix]", "🧪": "[test]", "🐛": "[bug]", "🚀": "[go]",
	"☀": "*", "🌞": "*", "🌤": "*~", "⛅": "~*", "🌥": "~", "☁": "~", "🌦": "~/", "🌧": "//", "⛈": "/!", "🌩": "!",
	"❄": "*", "🌨": "**", "🌫": "==", "🌈": "(rb)", "🌙": ")", "🌛": ")", "🌜": "(", "⭕": "o", "🔴": "(o)",
	"🟠": "(o)", "🟡": "(o)", "🟢": "(o)", "🔵": "(o)", "🟣": "(o)", "⚫": "(o)", "⚪": "( )", "🟥": "[#]",
	"🟧": "[#]", "🟨": "[#]", "🟩": "[#]", "🟦": "[#]", "🟪": "[#]", "⬛": "[#]", "🐱": "=^.^=", "🐶": "U^.^U",
	"☕": "c[_]", "🍺": "[beer]", "🍕": "[pizza]", "🎵": "d", "🎶": "dd", "🎧": "[music]", "📷": "[cam]",
	"🎬": "[film]", "🎮": "[game]", "🏃": "[run]", "🚴": "[bike]", "✈": "[fly]", "🚗": "[car]", "🌍": "(o)",
	"🌎": "(o)", "🌏": "(o)", "🔒": "[lock]", "🔓": "[open]", "🔑": "[key]", "♻": "(r)", "🗑": "[bin]",
	"🧹": "[clean]", "💤": "zZ", "🤖": "[bot]", "👀": "o_o", "👤": "[me]", "👥": "[us]",
};

/** Pictographic code points: the emoji a font without colour glyphs would draw
 * as tofu, or wider than one cell. */
const PICTO = /\p{Extended_Pictographic}/u;

/**
 * Terminal-safe text: every emoji replaced by its ASCII equivalent where one
 * exists, and dropped where none does. Flags become their two-letter region
 * code (🇨🇿 → CZ); skin tones, variation selectors and joiners are removed.
 *
 * Text without an emoji in it comes back unchanged, so this is cheap to run on
 * everything a card draws.
 */
export function asciify(s: string): string {
	if (!/[\u2190-\u2bff\u{1f000}-\u{1faff}\u2600-\u27bf\u203c\u2049]/u.test(s)) return s;
	let out = "";
	let dropped = false;
	const cps = Array.from(s);
	for (let i = 0; i < cps.length; i++) {
		const ch = cps[i];
		const cp = ch.codePointAt(0) ?? 0;
		// Regional indicator pair: a flag, written as its region code.
		if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
			const next = cps[i + 1]?.codePointAt(0) ?? 0;
			if (next >= 0x1f1e6 && next <= 0x1f1ff) {
				out += String.fromCharCode(0x41 + cp - 0x1f1e6, 0x41 + next - 0x1f1e6);
				i++;
			} else dropped = true;
			continue;
		}
		// Joiners, variation selectors, skin tones and the keycap mark.
		if (cp === 0x200d || cp === 0xfe0f || cp === 0xfe0e || cp === 0x20e3 || (cp >= 0x1f3fb && cp <= 0x1f3ff)) continue;
		const mapped = EMOJI_ASCII[ch];
		if (mapped !== undefined) {
			out += mapped;
			// Skip the rest of a ZWJ sequence: its parts are one picture.
			while (cps[i + 1] === "\u200d" && cps[i + 2]) i += 2;
			continue;
		}
		// Pictographs outside the symbol blocks the terminal font draws itself
		// (arrows, ✓ ✗ ⚠ ⚡ and friends stay).
		if (PICTO.test(ch) && (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf && !KEPT_SYMBOLS.has(ch)))) {
			dropped = true;
			continue;
		}
		out += ch;
	}
	// A dropped emoji between two words leaves a double space behind it.
	return dropped ? out.replace(/ {2,}/g, " ").trim() : out;
}

/** Symbols in the emoji ranges that the bundled font draws as plain text, so
 * {@link asciify} keeps them. */
const KEPT_SYMBOLS = new Set(["⚡", "⚠", "✓", "✕", "✗", "✶", "❮", "❯"]);

// ---- Padding and truncation -------------------------------------------------

/** The ellipsis a truncated run ends in. */
export const ELLIPSIS = "…";

/** Cut `s` to at most `w` cells, ending in an ellipsis when anything was cut. */
export function truncate(s: string, w: number): string {
	if (w <= 0) return "";
	if (strWidth(s) <= w) return s;
	let out = "";
	let n = 0;
	for (const ch of s) {
		const cw = cellWidth(ch);
		if (n + cw > w - 1) break;
		out += ch;
		n += cw;
	}
	// A wide character that didn't fit leaves a one-cell hole; fill it so the
	// ellipsis lands on the last cell.
	return out + " ".repeat(Math.max(0, w - 1 - n)) + ELLIPSIS;
}

/** `s` padded (or cut) to exactly `w` cells, text on the left. */
export function padEnd(s: string, w: number): string {
	const t = truncate(s, w);
	return t + " ".repeat(Math.max(0, w - strWidth(t)));
}

/** `s` padded (or cut) to exactly `w` cells, text on the right. */
export function padStart(s: string, w: number): string {
	const t = truncate(s, w);
	return " ".repeat(Math.max(0, w - strWidth(t))) + t;
}

/** `s` centred in exactly `w` cells. */
export function padCenter(s: string, w: number): string {
	const t = truncate(s, w);
	const room = Math.max(0, w - strWidth(t));
	const left = Math.floor(room / 2);
	return " ".repeat(left) + t + " ".repeat(room - left);
}

/**
 * `line` made exactly `w` cells wide: cut with an ellipsis at the first
 * segment that overflows, or padded with plain spaces. Interactive segments
 * keep their handlers when cut.
 */
export function fit(line: Line, w: number): Line {
	const out: Line = [];
	let n = 0;
	for (const s of line) {
		if (n >= w) break;
		const sw = strWidth(s.text);
		if (n + sw <= w) {
			out.push(s);
			n += sw;
		} else {
			out.push({ ...s, text: truncate(s.text, w - n) });
			n = w;
		}
	}
	if (n < w) out.push({ text: " ".repeat(w - n) });
	return out;
}

/** `left` and `right` on one line of `w` cells, `right` flush right; `left`
 * gives way when they don't both fit. */
export function spread(left: Line, right: Line, w: number): Line {
	const rw = lineWidth(right);
	if (rw >= w) return fit(right, w);
	return [...fit(left, w - rw), ...right];
}

/** `line` centred in `w` cells. */
export function centerLine(line: Line, w: number): Line {
	const lw = lineWidth(line);
	if (lw >= w) return fit(line, w);
	const left = Math.floor((w - lw) / 2);
	return fit([{ text: " ".repeat(left) }, ...line], w);
}

/** Every segment of `line` in `style` as well as its own. */
export function styleLine(line: Line, ...extra: TuiStyle[]): Line {
	return line.map((s) => withStyle(s, ...extra));
}

/** `line` with the cells from `from` (inclusive) to `to` (exclusive) in
 * `style` as well — the rest untouched. Segments straddling an edge are split. */
export function styleRange(line: Line, from: number, to: number, ...extra: TuiStyle[]): Line {
	const out: Line = [];
	let n = 0;
	for (const s of line) {
		const chars = Array.from(s.text);
		let buf = "";
		let inside: boolean | null = null;
		const flush = () => {
			if (!buf) return;
			out.push(inside ? withStyle({ ...s, text: buf }, ...extra) : { ...s, text: buf });
			buf = "";
		};
		for (const ch of chars) {
			const w = cellWidth(ch);
			const now = n >= from && n < to;
			if (inside !== null && now !== inside) flush();
			inside = now;
			buf += ch;
			n += w;
		}
		flush();
	}
	return out;
}

/**
 * Word-wrap `text` to lines of at most `w` cells. Words longer than a line are
 * broken; explicit newlines are kept.
 */
export function wrap(text: string, w: number): string[] {
	if (w <= 0) return [];
	const out: string[] = [];
	for (const para of text.split("\n")) {
		let cur = "";
		let curW = 0;
		for (const word of para.split(/ +/)) {
			if (!word) continue;
			let rest = word;
			let restW = strWidth(rest);
			while (restW > w) {
				if (cur) {
					out.push(cur);
					cur = "";
					curW = 0;
				}
				let head = "";
				let hw = 0;
				const chars = Array.from(rest);
				let i = 0;
				for (; i < chars.length; i++) {
					const cw = cellWidth(chars[i]);
					if (hw + cw > w) break;
					head += chars[i];
					hw += cw;
				}
				out.push(head);
				rest = chars.slice(i).join("");
				restW = strWidth(rest);
			}
			if (!rest) continue;
			const need = curW === 0 ? restW : curW + 1 + restW;
			if (need > w) {
				out.push(cur);
				cur = rest;
				curW = restW;
			} else {
				cur = curW === 0 ? rest : `${cur} ${rest}`;
				curW = need;
			}
		}
		out.push(cur);
	}
	return out;
}

/**
 * Soft-wrap a styled line to lines of at most `w` cells, breaking after the
 * last space that fits (or mid-word when a word is longer than the line).
 * Continuation lines start with `indent` spaces, so a wrapped list item lines
 * up under its text. Segments keep their styles and handlers across the break.
 */
export function wrapLine(line: Line, w: number, indent = 0): Line[] {
	if (w <= 0) return [];
	if (lineWidth(line) <= w) return [line];
	type Cell = { ch: string; w: number; seg: Seg };
	const cells: Cell[] = [];
	for (const s of line) for (const ch of s.text) cells.push({ ch, w: cellWidth(ch), seg: s });
	const out: Line[] = [];
	const pad = Math.min(indent, Math.max(0, w - 4));
	let i = 0;
	let first = true;
	while (i < cells.length) {
		const room = first ? w : w - pad;
		let n = 0;
		let end = i;
		let lastSpace = -1;
		while (end < cells.length && n + cells[end].w <= room) {
			if (cells[end].ch === " ") lastSpace = end;
			n += cells[end].w;
			end++;
		}
		// Break after the last space when the line would otherwise split a word.
		if (end < cells.length && lastSpace > i) end = lastSpace + 1;
		if (end === i) end = i + 1;
		const row: Line = first || pad === 0 ? [] : [{ text: " ".repeat(pad) }];
		for (let k = i; k < end; k++) {
			const prev = row[row.length - 1];
			// Characters of one segment share its style object, so they merge
			// back into one run; a run from another segment starts a new one.
			if (prev && prev.onClick === cells[k].seg.onClick && prev.style === cells[k].seg.style) {
				prev.text += cells[k].ch;
			} else row.push({ ...cells[k].seg, text: cells[k].ch });
		}
		// Trailing spaces at a break are not worth a cell.
		const last = row[row.length - 1];
		if (last && end < cells.length) last.text = last.text.replace(/ +$/, "");
		out.push(row);
		// Skip the spaces a break swallowed.
		i = end;
		while (i < cells.length && cells[i].ch === " " && end < cells.length) i++;
		first = false;
	}
	return out;
}

// ---- Small drawings ---------------------------------------------------------

/** The eight block heights a sparkline or bar is drawn in, lowest first. */
export const BLOCKS = "▁▂▃▄▅▆▇█";

/** A sparkline of `values`, one cell per value, the last `w` values shown. */
export function sparkline(values: readonly number[], w: number): string {
	const v = values.filter((x) => Number.isFinite(x)).slice(-Math.max(0, w));
	if (v.length === 0) return "";
	const lo = Math.min(...v);
	const hi = Math.max(...v);
	const span = hi - lo || 1;
	return v.map((x) => BLOCKS[Math.round(((x - lo) / span) * (BLOCKS.length - 1))]).join("");
}

/** A horizontal bar `w` cells long, `fraction` of it filled in eighths. */
export function hbar(fraction: number, w: number): string {
	const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
	const eighths = Math.round(f * w * 8);
	const full = Math.floor(eighths / 8);
	const part = eighths % 8;
	const partials = " ▏▎▍▌▋▊▉";
	return ("█".repeat(full) + (part ? partials[part] : "")).padEnd(w, " ").slice(0, w);
}

/**
 * An htop meter: `[||||||||      3/14]`. `parts` are fractions of the whole
 * with a style each (done in green, overdue in red…); `label` is written at the
 * right end inside the brackets, the way htop writes its percentages.
 */
export function meter(parts: readonly { fraction: number; style: TuiStyle }[], label: string, w: number): Line {
	const inner = Math.max(1, w - 2);
	const labelW = Math.min(inner, strWidth(label));
	const room = Math.max(0, inner - labelW - (labelW > 0 ? 1 : 0));
	const line: Line = [{ text: "[", style: "bold" }];
	let used = 0;
	for (const p of parts) {
		const n = Math.max(0, Math.min(room - used, Math.round(Math.max(0, p.fraction) * room)));
		if (n > 0) line.push({ text: "|".repeat(n), style: p.style });
		used += n;
	}
	line.push({ text: " ".repeat(Math.max(0, inner - used - labelW)) });
	if (labelW > 0) line.push({ text: truncate(label, labelW), style: "dim" });
	line.push({ text: "]", style: "bold" });
	return line;
}

/** Relative age of `ms` ago, terminal-short: `4m`, `3h`, `2d`, `5w`, `8mo`, `2y`. */
export function shortAge(ms: number): string {
	const m = Math.max(0, Math.round(ms / 60000));
	if (m < 1) return "now";
	if (m < 60) return `${m}m`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h`;
	const d = Math.round(h / 24);
	if (d < 14) return `${d}d`;
	if (d < 60) return `${Math.round(d / 7)}w`;
	if (d < 730) return `${Math.round(d / 30)}mo`;
	return `${Math.round(d / 365)}y`;
}
