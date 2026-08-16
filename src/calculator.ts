/**
 * A small, self-contained calculator engine for the "calculator" card.
 *
 * It answers three kinds of question, in the spirit of Wolfram Alpha's input
 * box — all typed as free text into one field:
 *   1. Arithmetic:        `2 + 2`, `3 * (4 + 5)`, `2^10`, `sqrt(16)`, `sin(30)`
 *   2. Unit conversions:  `10 km to miles`, `100 f in c`, `1 hour in minutes`
 *   3. Plain language:    `20% of 150`, `3 plus 4`, `10 squared`, `2 x 3`
 *   4. Currency:          `10 € to USD`, `$5 in czk` (needs exchange rates)
 *   5. Number bases:      `FF hex to decimal`, `1010 binary to hex`, `255 to hex`
 *
 * Everything except currency is computed locally — no network, no dependencies.
 * Currency conversions use exchange rates the caller supplies (fetched and
 * cached by src/currency.ts); without them a currency query reports that rates
 * are unavailable rather than guessing.
 */
import { CURRENCY_CODES, CURRENCY_SYMBOLS } from "./currency";

/** Options that tune how an expression is evaluated. */
export interface CalcOptions {
	/** Angle unit assumed for trig functions and their inverses. Default "deg"
	 * (so `sin(30)` is 0.5, which is what most casual users expect). */
	angleUnit?: "deg" | "rad";
	/** Exchange rates for currency conversions: each ISO code (lowercase) mapped
	 * to its units per one unit of some shared base, including that base = 1.
	 * Omitted when no rates are available (offline / not yet fetched). */
	rates?: Record<string, number>;
}

const CURRENCY_SET = new Set(CURRENCY_CODES);

/** Resolve a raw token to an ISO currency code, or null if it isn't one. */
function lookupCurrency(raw: string): string | null {
	const key = raw.trim().toLowerCase();
	return CURRENCY_SET.has(key) ? key : null;
}

/** A successful evaluation. */
export interface CalcSuccess {
	ok: true;
	/** The numeric result. */
	value: number;
	/** The result formatted for display (grouped, trimmed, with any unit). */
	formatted: string;
	/** A short explanation of what was computed (e.g. "10 km → mi"). */
	note?: string;
}

/** A failed evaluation, with a human-readable reason. */
export interface CalcError {
	ok: false;
	error: string;
}

export type CalcResult = CalcSuccess | CalcError;

// ---- Units -------------------------------------------------------------

/** A linear unit: value_in_base = value * factor. */
interface LinearUnit {
	category: string;
	factor: number;
	/** Canonical short label shown in results (e.g. "mi", "kg"). */
	label: string;
}

/**
 * Unit table keyed by lowercase alias. Every non-temperature unit is linear
 * (a factor to its category's base unit); temperature is handled separately
 * because it needs an offset, not just a scale.
 */
const UNITS: Record<string, LinearUnit> = {};

function defUnit(aliases: string[], category: string, factor: number, label: string): void {
	for (const a of aliases) UNITS[a] = { category, factor, label };
}

// Length (base: metre)
defUnit(["m", "meter", "meters", "metre", "metres"], "length", 1, "m");
defUnit(["km", "kilometer", "kilometers", "kilometre", "kilometres"], "length", 1000, "km");
defUnit(["cm", "centimeter", "centimeters", "centimetre", "centimetres"], "length", 0.01, "cm");
defUnit(["mm", "millimeter", "millimeters", "millimetre", "millimetres"], "length", 0.001, "mm");
defUnit(["um", "µm", "micron", "microns", "micrometer", "micrometers"], "length", 1e-6, "µm");
defUnit(["nm", "nanometer", "nanometers"], "length", 1e-9, "nm");
defUnit(["mi", "mile", "miles"], "length", 1609.344, "mi");
defUnit(["yd", "yard", "yards"], "length", 0.9144, "yd");
defUnit(["ft", "foot", "feet"], "length", 0.3048, "ft");
defUnit(["in", "inch", "inches"], "length", 0.0254, "in");
defUnit(["nmi", "nauticalmile", "nauticalmiles"], "length", 1852, "nmi");

// Mass (base: kilogram)
defUnit(["kg", "kilogram", "kilograms"], "mass", 1, "kg");
defUnit(["g", "gram", "grams"], "mass", 0.001, "g");
defUnit(["mg", "milligram", "milligrams"], "mass", 1e-6, "mg");
defUnit(["t", "tonne", "tonnes", "ton", "tons"], "mass", 1000, "t");
defUnit(["lb", "lbs", "pound", "pounds"], "mass", 0.45359237, "lb");
defUnit(["oz", "ounce", "ounces"], "mass", 0.028349523125, "oz");
defUnit(["st", "stone", "stones"], "mass", 6.35029318, "st");

// Time (base: second)
defUnit(["s", "sec", "secs", "second", "seconds"], "time", 1, "s");
defUnit(["ms", "millisecond", "milliseconds"], "time", 0.001, "ms");
defUnit(["min", "mins", "minute", "minutes"], "time", 60, "min");
defUnit(["h", "hr", "hrs", "hour", "hours"], "time", 3600, "h");
defUnit(["day", "days"], "time", 86400, "day");
defUnit(["week", "weeks", "wk"], "time", 604800, "week");
defUnit(["month", "months"], "time", 2629800, "month");
defUnit(["year", "years", "yr", "yrs"], "time", 31557600, "year");

// Volume (base: litre)
defUnit(["l", "liter", "liters", "litre", "litres"], "volume", 1, "L");
defUnit(["ml", "milliliter", "milliliters", "millilitre", "millilitres"], "volume", 0.001, "mL");
defUnit(["cl", "centiliter", "centiliters"], "volume", 0.01, "cL");
defUnit(["dl", "deciliter", "deciliters"], "volume", 0.1, "dL");
defUnit(["gal", "gallon", "gallons"], "volume", 3.785411784, "gal");
defUnit(["qt", "quart", "quarts"], "volume", 0.946352946, "qt");
defUnit(["pt", "pint", "pints"], "volume", 0.473176473, "pt");
defUnit(["cup", "cups"], "volume", 0.2365882365, "cup");
defUnit(["floz", "fluidounce", "fluidounces"], "volume", 0.0295735296, "fl oz");
defUnit(["tbsp", "tablespoon", "tablespoons"], "volume", 0.0147867648, "tbsp");
defUnit(["tsp", "teaspoon", "teaspoons"], "volume", 0.00492892159, "tsp");

// Area (base: square metre)
defUnit(["m2", "sqm", "squaremeter", "squaremeters", "squaremetre", "squaremetres"], "area", 1, "m²");
defUnit(["km2", "sqkm", "squarekilometer", "squarekilometers"], "area", 1e6, "km²");
defUnit(["cm2", "sqcm"], "area", 1e-4, "cm²");
defUnit(["mm2", "sqmm"], "area", 1e-6, "mm²");
defUnit(["ha", "hectare", "hectares"], "area", 10000, "ha");
defUnit(["acre", "acres"], "area", 4046.8564224, "acre");
defUnit(["ft2", "sqft", "squarefoot", "squarefeet"], "area", 0.09290304, "ft²");
defUnit(["mi2", "sqmi", "squaremile", "squaremiles"], "area", 2589988.110336, "mi²");
defUnit(["in2", "sqin"], "area", 0.00064516, "in²");

// Speed (base: metre / second)
defUnit(["mps", "m/s"], "speed", 1, "m/s");
defUnit(["kph", "kmh", "km/h"], "speed", 0.2777777777777778, "km/h");
defUnit(["mph", "mi/h"], "speed", 0.44704, "mph");
defUnit(["knot", "knots", "kn", "kt"], "speed", 0.5144444444444445, "kn");
defUnit(["fps", "ft/s"], "speed", 0.3048, "ft/s");

// Digital storage (base: byte; decimal SI vs. binary IEC)
defUnit(["b", "byte", "bytes"], "data", 1, "B");
defUnit(["bit", "bits"], "data", 0.125, "bit");
defUnit(["kb", "kilobyte", "kilobytes"], "data", 1e3, "KB");
defUnit(["mb", "megabyte", "megabytes"], "data", 1e6, "MB");
defUnit(["gb", "gigabyte", "gigabytes"], "data", 1e9, "GB");
defUnit(["tb", "terabyte", "terabytes"], "data", 1e12, "TB");
defUnit(["pb", "petabyte", "petabytes"], "data", 1e15, "PB");
defUnit(["kib", "kibibyte", "kibibytes"], "data", 1024, "KiB");
defUnit(["mib", "mebibyte", "mebibytes"], "data", 1048576, "MiB");
defUnit(["gib", "gibibyte", "gibibytes"], "data", 1073741824, "GiB");
defUnit(["tib", "tebibyte", "tebibytes"], "data", 1099511627776, "TiB");

// Angle (base: radian)
defUnit(["rad", "radian", "radians"], "angle", 1, "rad");
defUnit(["deg", "degree", "degrees", "°"], "angle", Math.PI / 180, "°");
defUnit(["grad", "gradian", "gradians", "gon"], "angle", Math.PI / 200, "grad");
defUnit(["turn", "turns", "rev", "revolution", "revolutions"], "angle", 2 * Math.PI, "turn");

/** Temperature units — handled specially (affine, not linear). */
const TEMP_UNITS: Record<string, string> = {
	c: "c", celsius: "c", "°c": "c",
	f: "f", fahrenheit: "f", "°f": "f",
	k: "k", kelvin: "k",
};
const TEMP_LABEL: Record<string, string> = { c: "°C", f: "°F", k: "K" };

/** Normalize a raw unit string for lookup: trim, lowercase, drop internal
 * spaces so "square meters" and "fl oz" match their spaceless aliases. */
function normalizeUnit(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "")
		.replace(/²/g, "2")
		.replace(/³/g, "3");
}

/** Resolve a unit alias to its table entry, retrying without a trailing "s". */
function lookupUnit(raw: string): LinearUnit | null {
	const key = normalizeUnit(raw);
	if (UNITS[key]) return UNITS[key];
	if (key.endsWith("s") && UNITS[key.slice(0, -1)]) return UNITS[key.slice(0, -1)];
	return null;
}

function lookupTemp(raw: string): string | null {
	const key = normalizeUnit(raw);
	return TEMP_UNITS[key] ?? null;
}

function toCelsius(value: number, unit: string): number {
	if (unit === "f") return (value - 32) * 5 / 9;
	if (unit === "k") return value - 273.15;
	return value;
}

function fromCelsius(c: number, unit: string): number {
	if (unit === "f") return c * 9 / 5 + 32;
	if (unit === "k") return c + 273.15;
	return c;
}

// ---- Number bases ------------------------------------------------------

/** A number base the calculator can read from and write to. */
interface NumberBase {
	radix: number;
	/** Name used in notes and errors ("hex", "binary"). */
	label: string;
	/** Notation written before the digits ("0x"); empty for decimal. */
	prefix: string;
}

/** Base table keyed by lowercase alias, in the same spirit as UNITS. */
const BASES: Record<string, NumberBase> = {};

function defBase(aliases: string[], radix: number, label: string, prefix: string): void {
	for (const a of aliases) BASES[a] = { radix, label, prefix };
}

defBase(["bin", "binary", "base2"], 2, "binary", "0b");
defBase(["oct", "octal", "base8"], 8, "octal", "0o");
defBase(["dec", "decimal", "base10"], 10, "decimal", "");
defBase(["hex", "hexadecimal", "base16"], 16, "hex", "0x");

/** Decimal is the assumed base everywhere a query doesn't name one. */
const DECIMAL = BASES.decimal;

/** Prefixes recognised on a bare literal, mapped to their base. */
const BASE_PREFIXES: Record<string, NumberBase> = {
	"0b": BASES.binary,
	"0o": BASES.octal,
	"0x": BASES.hex,
};

/** Resolve a raw token to a number base, or null if it isn't one. */
function lookupBase(raw: string): NumberBase | null {
	return BASES[normalizeUnit(raw)] ?? null;
}

/** The digits legal in a base: 0-9 then a-z, as many as the radix allows. */
function baseDigitsRe(radix: number): RegExp {
	const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, radix);
	return new RegExp(`^[${digits}]+$`, "i");
}

/**
 * Read a single literal in the given base: an optional sign, the base's own
 * prefix if the user typed one, then digits (which may be grouped with `_`,
 * `,` or spaces, as they are elsewhere in the calculator). Returns null when
 * the text isn't a valid literal in that base.
 */
function parseInBase(raw: string, base: NumberBase): number | null {
	const m = /^([+-]?)\s*(.+)$/.exec(raw.trim());
	if (!m) return null;
	let digits = m[2].replace(/[_,\s]/g, "");
	if (base.prefix && digits.toLowerCase().startsWith(base.prefix)) {
		digits = digits.slice(base.prefix.length);
	}
	if (!digits || !baseDigitsRe(base.radix).test(digits)) return null;
	const value = parseInt(digits, base.radix);
	if (!Number.isSafeInteger(value)) return null;
	return m[1] === "-" ? -value : value;
}

/**
 * Read a bare prefixed literal ("0xFF", "-0b1010") — the notation this module
 * itself prints, so a result can be pasted straight back in. Prefixed literals
 * inside larger expressions (`0xFF & 0x0F`) are deliberately not supported:
 * that needs tokenizer-level literals and bitwise operators.
 */
function parsePrefixed(raw: string): { value: number; base: NumberBase } | null {
	const m = /^([+-]?)\s*(0[box])([0-9a-z_, ]+)$/i.exec(raw.trim());
	if (!m) return null;
	const base = BASE_PREFIXES[m[2].toLowerCase()];
	const digits = parseInBase(m[3], base);
	if (digits === null) return null;
	return { value: m[1] === "-" ? -digits : digits, base };
}

/**
 * Write a number in the given base. Negatives carry a sign in front of the
 * digits (`-0xA`) rather than being wrapped into two's complement, because the
 * calculator has no bit width to wrap them at and treats negatives as signed
 * values everywhere else.
 */
function formatInBase(value: number, base: NumberBase): string {
	if (base.radix === 10) return formatNumber(value);
	const sign = value < 0 ? "-" : "";
	return `${sign}${base.prefix}${Math.abs(value).toString(base.radix).toUpperCase()}`;
}

// ---- Expression evaluator (recursive descent) --------------------------

type TokenType = "num" | "ident" | "op" | "lparen" | "rparen" | "comma" | "bang";
interface Token {
	type: TokenType;
	value: string;
}

const CONSTANTS: Record<string, number> = {
	pi: Math.PI,
	"π": Math.PI,
	tau: Math.PI * 2,
	e: Math.E,
	phi: (1 + Math.sqrt(5)) / 2,
};

/** Single-argument functions available in expressions. */
function makeFunctions(angleUnit: "deg" | "rad"): Record<string, (args: number[]) => number> {
	const toRad = (x: number) => (angleUnit === "deg" ? (x * Math.PI) / 180 : x);
	const fromRad = (x: number) => (angleUnit === "deg" ? (x * 180) / Math.PI : x);
	return {
		sqrt: (a) => Math.sqrt(a[0]),
		cbrt: (a) => Math.cbrt(a[0]),
		abs: (a) => Math.abs(a[0]),
		ln: (a) => Math.log(a[0]),
		log: (a) => (a.length > 1 ? Math.log(a[1]) / Math.log(a[0]) : Math.log10(a[0])),
		log10: (a) => Math.log10(a[0]),
		log2: (a) => Math.log2(a[0]),
		exp: (a) => Math.exp(a[0]),
		sin: (a) => Math.sin(toRad(a[0])),
		cos: (a) => Math.cos(toRad(a[0])),
		tan: (a) => Math.tan(toRad(a[0])),
		asin: (a) => fromRad(Math.asin(a[0])),
		acos: (a) => fromRad(Math.acos(a[0])),
		atan: (a) => fromRad(Math.atan(a[0])),
		sinh: (a) => Math.sinh(a[0]),
		cosh: (a) => Math.cosh(a[0]),
		tanh: (a) => Math.tanh(a[0]),
		round: (a) => Math.round(a[0]),
		floor: (a) => Math.floor(a[0]),
		ceil: (a) => Math.ceil(a[0]),
		sign: (a) => Math.sign(a[0]),
		fact: (a) => factorial(a[0]),
		factorial: (a) => factorial(a[0]),
		min: (a) => Math.min(...a),
		max: (a) => Math.max(...a),
		pow: (a) => Math.pow(a[0], a[1]),
		root: (a) => Math.pow(a[1], 1 / a[0]),
	};
}

function factorial(n: number): number {
	if (n < 0 || !Number.isInteger(n)) return NaN;
	let out = 1;
	for (let i = 2; i <= n; i++) out *= i;
	return out;
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const s = input;
	while (i < s.length) {
		const ch = s[i];
		if (ch === " " || ch === "\t") {
			i++;
			continue;
		}
		if ((ch >= "0" && ch <= "9") || ch === ".") {
			let j = i + 1;
			while (j < s.length && /[0-9._]/.test(s[j])) j++;
			// Scientific notation: 1e5, 2.5e-3
			if (j < s.length && (s[j] === "e" || s[j] === "E")) {
				let k = j + 1;
				if (k < s.length && (s[k] === "+" || s[k] === "-")) k++;
				if (k < s.length && s[k] >= "0" && s[k] <= "9") {
					j = k;
					while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
				}
			}
			tokens.push({ type: "num", value: s.slice(i, j).replace(/_/g, "") });
			i = j;
			continue;
		}
		if (/[a-zµπ°]/i.test(ch)) {
			let j = i + 1;
			while (j < s.length && /[a-z0-9µπ°]/i.test(s[j])) j++;
			tokens.push({ type: "ident", value: s.slice(i, j).toLowerCase() });
			i = j;
			continue;
		}
		if ("+-*/^%".includes(ch)) {
			// Support "**" as an alias for "^".
			if (ch === "*" && s[i + 1] === "*") {
				tokens.push({ type: "op", value: "^" });
				i += 2;
				continue;
			}
			tokens.push({ type: "op", value: ch });
			i++;
			continue;
		}
		if (ch === "(") {
			tokens.push({ type: "lparen", value: ch });
			i++;
			continue;
		}
		if (ch === ")") {
			tokens.push({ type: "rparen", value: ch });
			i++;
			continue;
		}
		if (ch === ",") {
			tokens.push({ type: "comma", value: ch });
			i++;
			continue;
		}
		if (ch === "!") {
			tokens.push({ type: "bang", value: ch });
			i++;
			continue;
		}
		throw new Error(`Unexpected character "${ch}"`);
	}
	return tokens;
}

/** Recursive-descent parser + evaluator over a token stream. */
class Parser {
	private pos = 0;
	private functions: Record<string, (args: number[]) => number>;

	constructor(private tokens: Token[], angleUnit: "deg" | "rad") {
		this.functions = makeFunctions(angleUnit);
	}

	parse(): number {
		const v = this.parseExpr();
		if (this.pos < this.tokens.length) {
			throw new Error("Unexpected trailing input");
		}
		return v;
	}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	private parseExpr(): number {
		let left = this.parseTerm();
		while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
			const op = this.tokens[this.pos++].value;
			const right = this.parseTerm();
			left = op === "+" ? left + right : left - right;
		}
		return left;
	}

	private parseTerm(): number {
		let left = this.parseUnary();
		for (;;) {
			const tok = this.peek();
			if (tok?.type === "op" && (tok.value === "*" || tok.value === "/" || tok.value === "%")) {
				this.pos++;
				const right = this.parseUnary();
				if (tok.value === "*") left = left * right;
				else if (tok.value === "/") left = left / right;
				else left = left % right;
			} else if (tok?.type === "ident" && tok.value === "mod") {
				this.pos++;
				const right = this.parseUnary();
				left = left % right;
			} else {
				break;
			}
		}
		return left;
	}

	private parseUnary(): number {
		const tok = this.peek();
		if (tok?.type === "op" && (tok.value === "+" || tok.value === "-")) {
			this.pos++;
			const v = this.parseUnary();
			return tok.value === "-" ? -v : v;
		}
		return this.parsePower();
	}

	private parsePower(): number {
		const base = this.parsePostfix();
		if (this.peek()?.type === "op" && this.peek()!.value === "^") {
			this.pos++;
			const exp = this.parseUnary(); // right-associative
			return Math.pow(base, exp);
		}
		return base;
	}

	private parsePostfix(): number {
		let v = this.parsePrimary();
		while (this.peek()?.type === "bang") {
			this.pos++;
			v = factorial(v);
		}
		return v;
	}

	private parsePrimary(): number {
		const tok = this.peek();
		if (!tok) throw new Error("Unexpected end of input");

		if (tok.type === "num") {
			this.pos++;
			const n = Number(tok.value);
			if (Number.isNaN(n)) throw new Error(`Invalid number "${tok.value}"`);
			return n;
		}

		if (tok.type === "lparen") {
			this.pos++;
			const v = this.parseExpr();
			if (this.peek()?.type !== "rparen") throw new Error("Missing closing ')'");
			this.pos++;
			return v;
		}

		if (tok.type === "ident") {
			this.pos++;
			const name = tok.value;
			// Function call: identifier immediately followed by "(".
			if (this.peek()?.type === "lparen") {
				const fn = this.functions[name];
				if (!fn) throw new Error(`Unknown function "${name}"`);
				this.pos++;
				const args: number[] = [];
				if (this.peek()?.type !== "rparen") {
					args.push(this.parseExpr());
					while (this.peek()?.type === "comma") {
						this.pos++;
						args.push(this.parseExpr());
					}
				}
				if (this.peek()?.type !== "rparen") throw new Error("Missing closing ')'");
				this.pos++;
				return fn(args);
			}
			// Constant.
			if (name in CONSTANTS) return CONSTANTS[name];
			throw new Error(`Unknown name "${name}"`);
		}

		throw new Error(`Unexpected "${tok.value}"`);
	}
}

// ---- Plain-language preprocessing --------------------------------------

/** Rewrite spoken-word math into symbols the tokenizer understands. */
function normalizeExpression(input: string): string {
	let s = ` ${input.toLowerCase()} `;
	// Word operators (whole words only).
	s = s.replace(/\bmultiplied by\b/g, " * ");
	s = s.replace(/\bdivided by\b/g, " / ");
	s = s.replace(/\bplus\b/g, " + ");
	s = s.replace(/\bminus\b/g, " - ");
	s = s.replace(/\btimes\b/g, " * ");
	s = s.replace(/\bover\b/g, " / ");
	// "x" between numbers as multiplication: 3 x 4. A lookahead keeps the right
	// operand out of the match so chains ("2 x 3 x 4") convert every "x".
	s = s.replace(/(\d)\s*x\s*(?=\d)/g, "$1 * ");
	// Powers spoken as words.
	s = s.replace(/\bsquared\b/g, " ^ 2 ");
	s = s.replace(/\bcubed\b/g, " ^ 3 ");
	s = s.replace(/\bto the power of\b/g, " ^ ");
	// Percentages: "20% of 150" → (20/100)*150 ; leftover "%" → /100.
	s = s.replace(/%\s*of\b/g, " /100* ");
	s = s.replace(/\bpercent of\b/g, " /100* ");
	s = s.replace(/\bpercent\b/g, " /100 ");
	s = s.replace(/%/g, " /100 ");
	return s.trim();
}

/** Rewrite currency signs to ISO codes so "$10" / "10€" become "10 usd" /
 * "10 eur" — a form the conversion parser understands. Runs before conversion
 * detection so both prefix and suffix symbols, and a bare target sign, resolve. */
function normalizeCurrencySymbols(input: string): string {
	const signs = Object.keys(CURRENCY_SYMBOLS).join("");
	const cls = `[${signs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`;
	let s = input;
	// Sign directly before a number: "$10" → "10 usd".
	s = s.replace(new RegExp(`(${cls})\\s*(\\d[\\d.,]*)`, "g"), (_m, sign: string, num: string) => `${num} ${CURRENCY_SYMBOLS[sign]} `);
	// Sign directly after a number: "10€" → "10 eur".
	s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s*(${cls})`, "g"), (_m, num: string, sign: string) => `${num} ${CURRENCY_SYMBOLS[sign]} `);
	// Any remaining bare sign (e.g. a conversion target "… to £").
	s = s.replace(new RegExp(cls, "g"), (sign) => ` ${CURRENCY_SYMBOLS[sign]} `);
	return s.replace(/\s+/g, " ").trim();
}

/** Strip conversational lead-ins/trailers ("what is …", "= "). */
function stripFiller(input: string): string {
	let s = input.trim();
	s = s.replace(/^\s*(what\s+is|whats|what's|calculate|compute|convert|how\s+much\s+is|evaluate)\s+/i, "");
	s = s.replace(/^=\s*/, "");
	s = s.replace(/[=?]+\s*$/, "");
	return s.trim();
}

// ---- Number formatting -------------------------------------------------

/** Format a number for display: tame floating-point noise, group thousands,
 * and fall back to exponential notation for very large/small magnitudes. */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) {
		return Number.isNaN(value) ? "undefined" : value > 0 ? "∞" : "-∞";
	}
	if (value === 0) return "0";
	const abs = Math.abs(value);
	if (abs >= 1e15 || abs < 1e-6) {
		return value.toExponential(6).replace(/\.?0+e/, "e");
	}
	// Round to 10 significant decimals to absorb 0.1+0.2 style noise.
	const rounded = Number(value.toPrecision(12));
	const parts = rounded.toString().split(".");
	const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

// ---- Public entry point ------------------------------------------------

const CONVERSION_RE = /^(.*\S)\s+(?:to|in|into|as)\s+([^\s].*?)$/i;

/** Try to interpret the input as a unit conversion. Returns null if it isn't
 * one (so the caller can fall back to plain expression evaluation). */
function tryConvert(input: string, opts: CalcOptions): CalcResult | null {
	const m = CONVERSION_RE.exec(input);
	if (!m) return null;
	const [, leftRaw, targetRaw] = m;

	const targetLinear = lookupUnit(targetRaw);
	const targetTemp = lookupTemp(targetRaw);
	const targetCurrency = lookupCurrency(targetRaw);
	const targetBase = lookupBase(targetRaw);
	if (!targetLinear && !targetTemp && !targetCurrency && !targetBase) return null; // not a conversion.

	// Bases read their own left-hand side: it may name a source base ("FF hex")
	// rather than end in a unit, so it can't go through extractTrailingUnit.
	if (targetBase) return convertBase(leftRaw, targetBase, opts);

	// Split the left side into a numeric expression and its trailing source unit.
	const src = extractTrailingUnit(leftRaw);
	if (!src) return null;

	let value: number;
	try {
		value = evaluateExpression(src.expr, opts);
	} catch {
		return null;
	}

	// Currency conversions need externally-supplied exchange rates.
	if (targetCurrency || src.currency) {
		if (!targetCurrency || !src.currency) {
			return { ok: false, error: "Can't convert between currency and other units" };
		}
		const rates = opts.rates;
		if (!rates) return { ok: false, error: "Exchange rates unavailable" };
		const rFrom = rates[src.currency];
		const rTo = rates[targetCurrency];
		if (!rFrom || !rTo) {
			const missing = (!rFrom ? src.currency : targetCurrency).toUpperCase();
			return { ok: false, error: `No exchange rate for ${missing}` };
		}
		// Rates are per shared base, so cross-convert through the base.
		const out = (value / rFrom) * rTo;
		const rounded = Math.round(out * 100) / 100;
		return {
			ok: true,
			value: out,
			formatted: `${formatNumber(rounded)} ${targetCurrency.toUpperCase()}`,
			note: `${formatNumber(value)} ${src.currency.toUpperCase()} → ${targetCurrency.toUpperCase()}`,
		};
	}

	// Temperature conversions are affine and stay within the temperature domain.
	if (targetTemp || src.temp) {
		if (!targetTemp || !src.temp) {
			return { ok: false, error: "Can't convert between temperature and other units" };
		}
		const celsius = toCelsius(value, src.temp);
		const out = fromCelsius(celsius, targetTemp);
		return {
			ok: true,
			value: out,
			formatted: `${formatNumber(out)} ${TEMP_LABEL[targetTemp]}`,
			note: `${formatNumber(value)} ${TEMP_LABEL[src.temp]} → ${TEMP_LABEL[targetTemp]}`,
		};
	}

	const from = src.linear!;
	const to = targetLinear!;
	if (from.category !== to.category) {
		return { ok: false, error: `Can't convert ${from.label} to ${to.label}` };
	}
	const out = (value * from.factor) / to.factor;
	return {
		ok: true,
		value: out,
		formatted: `${formatNumber(out)} ${to.label}`,
		note: `${formatNumber(value)} ${from.label} → ${to.label}`,
	};
}

/**
 * Convert the left-hand side of a "… to <base>" query into the target base.
 * The source base is whichever one the query names ("FF hex", "1010 binary")
 * or the prefix it carries ("0xFF"); anything else is an ordinary decimal
 * expression, so plain arithmetic still works (`20 + 35 to hex`).
 */
function convertBase(leftRaw: string, target: NumberBase, opts: CalcOptions): CalcResult | null {
	const trimmed = leftRaw.trim();
	// A trailing word naming the source base, e.g. the "hex" of "FF hex".
	const named = /^(.*?)\s*([a-z][a-z0-9]*)\s*$/i.exec(trimmed);
	const namedBase = named ? lookupBase(named[2]) : null;

	let value: number;
	let source = DECIMAL;
	if (namedBase) {
		const digits = named![1].trim();
		if (!digits) return null; // a bare "hex to decimal" names no quantity.
		const parsed = parseInBase(digits, namedBase);
		if (parsed === null) return { ok: false, error: `"${digits}" isn't a ${namedBase.label} number` };
		value = parsed;
		source = namedBase;
	} else {
		const prefixed = parsePrefixed(trimmed);
		if (prefixed) {
			value = prefixed.value;
			source = prefixed.base;
		} else {
			try {
				value = evaluateExpression(trimmed, opts);
			} catch {
				return null;
			}
		}
	}

	if (!Number.isFinite(value)) return { ok: false, error: "Not a number" };
	if (!Number.isInteger(value)) return { ok: false, error: `Only whole numbers convert to ${target.label}` };
	if (!Number.isSafeInteger(value)) return { ok: false, error: "Number too large to convert exactly" };

	return {
		ok: true,
		value,
		formatted: formatInBase(value, target),
		note: `${formatInBase(value, source)} → ${target.label}`,
	};
}

/** Pull a trailing unit token off an expression like "10 km" or "5 * 2 kg". */
function extractTrailingUnit(
	leftRaw: string,
): { expr: string; linear?: LinearUnit; temp?: string; currency?: string } | null {
	const trimmed = leftRaw.trim();
	// Match a trailing unit token as the candidate unit. The token must start
	// with a letter/symbol (so a bare number isn't mistaken for a unit) but may
	// carry trailing digits/superscripts so area aliases (m2, ft2, m², cm3) match.
	const m = /^(.*?)([a-zµπ°][a-z0-9µπ°/²³]*)\s*$/i.exec(trimmed);
	if (!m) return null;
	const unitRaw = m[2];
	const exprPart = m[1].trim();
	if (!exprPart) return null; // e.g. bare "km" with no quantity.

	const linear = lookupUnit(unitRaw);
	if (linear) return { expr: exprPart, linear };
	const temp = lookupTemp(unitRaw);
	if (temp) return { expr: exprPart, temp };
	const currency = lookupCurrency(unitRaw);
	if (currency) return { expr: exprPart, currency };
	return null;
}

/** Evaluate a plain arithmetic expression (already free of conversion syntax). */
function evaluateExpression(input: string, opts: CalcOptions): number {
	const normalized = normalizeExpression(input);
	const tokens = tokenize(normalized);
	if (tokens.length === 0) throw new Error("Empty expression");
	const parser = new Parser(tokens, opts.angleUnit ?? "deg");
	return parser.parse();
}

/**
 * Evaluate a free-text query and return either a formatted result or an error.
 * This is the single entry point the calculator card calls.
 */
export function evaluate(rawInput: string, opts: CalcOptions = {}): CalcResult {
	const input = stripFiller(normalizeCurrencySymbols(rawInput));
	if (!input) return { ok: false, error: "" };

	// Unit conversion first (it recognises the "… to/in/as unit" shape).
	try {
		const conv = tryConvert(input, opts);
		if (conv) return conv;
	} catch {
		/* fall through to plain evaluation */
	}

	try {
		const value = evaluateExpression(input, opts);
		if (Number.isNaN(value)) return { ok: false, error: "Not a number" };
		return { ok: true, value, formatted: formatNumber(value) };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "Invalid expression" };
	}
}
