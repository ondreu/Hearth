import { describe, expect, it } from "vitest";
import { evaluate, formatNumber } from "../src/calculator";

/**
 * The calculator engine is fully pure: `evaluate` takes free text plus options
 * (exchange rates are passed in, never fetched) and returns a result object.
 * No time, no network, no DOM — ideal for regression tests of the parsing and
 * conversion logic that a typecheck can't verify.
 */

/** Narrow a CalcResult to its success value, failing loudly otherwise. */
function ok(input: string, opts?: Parameters<typeof evaluate>[1]) {
	const r = evaluate(input, opts);
	if (!r.ok) throw new Error(`expected success for "${input}", got error: ${r.error}`);
	return r;
}

describe("evaluate — arithmetic", () => {
	it("basic operators and precedence", () => {
		expect(ok("2 + 2").value).toBe(4);
		expect(ok("3 * (4 + 5)").value).toBe(27);
		expect(ok("10 - 4 / 2").value).toBe(8);
		// "%" is percent (not modulo) — modulo is the word "mod".
		expect(ok("10 mod 3").value).toBe(1);
		expect(ok("50%").value).toBe(0.5);
	});

	it("powers via ^ and **", () => {
		expect(ok("2^10").value).toBe(1024);
		expect(ok("2**10").value).toBe(1024);
	});

	it("right-associative exponentiation", () => {
		expect(ok("2^2^3").value).toBe(256); // 2^(2^3), not (2^2)^3=64
	});

	it("unary minus and factorial", () => {
		expect(ok("-5 + 3").value).toBe(-2);
		expect(ok("5!").value).toBe(120);
	});

	it("functions and constants", () => {
		expect(ok("sqrt(16)").value).toBe(4);
		expect(ok("max(3, 7, 5)").value).toBe(7);
		expect(ok("abs(-9)").value).toBe(9);
		expect(ok("pi").value).toBeCloseTo(Math.PI, 10);
	});

	it("trig defaults to degrees", () => {
		expect(ok("sin(30)").value).toBeCloseTo(0.5, 10);
		expect(ok("cos(60)").value).toBeCloseTo(0.5, 10);
	});

	it("angleUnit option switches trig to radians", () => {
		expect(ok("sin(pi/2)", { angleUnit: "rad" }).value).toBeCloseTo(1, 10);
	});
});

describe("evaluate — plain language", () => {
	it("word operators", () => {
		expect(ok("3 plus 4").value).toBe(7);
		expect(ok("10 minus 6").value).toBe(4);
		expect(ok("6 times 7").value).toBe(42);
		expect(ok("20 divided by 5").value).toBe(4);
	});

	it('"x" between numbers is multiplication', () => {
		expect(ok("2 x 3").value).toBe(6);
		expect(ok("2 x 3 x 4").value).toBe(24);
	});

	it("squared / cubed", () => {
		expect(ok("10 squared").value).toBe(100);
		expect(ok("3 cubed").value).toBe(27);
	});

	it("percentages", () => {
		expect(ok("20% of 150").value).toBe(30);
		expect(ok("50 percent of 80").value).toBe(40);
	});

	it("strips conversational filler", () => {
		expect(ok("what is 2 + 2").value).toBe(4);
		expect(ok("2 + 2 =").value).toBe(4);
	});
});

describe("evaluate — unit conversions", () => {
	it("length", () => {
		const r = ok("10 km to miles");
		expect(r.value).toBeCloseTo(6.2137, 3);
		expect(r.formatted).toContain("mi");
		expect(r.note).toBe("10 km → mi");
	});

	it("temperature (affine)", () => {
		expect(ok("100 f in c").value).toBeCloseTo(37.7778, 3);
		expect(ok("0 c in f").value).toBeCloseTo(32, 10);
		expect(ok("300 k in c").value).toBeCloseTo(26.85, 2);
	});

	it("time", () => {
		expect(ok("1 hour in minutes").value).toBe(60);
		expect(ok("2 days in hours").value).toBe(48);
	});

	it("rejects cross-category conversions", () => {
		const r = evaluate("10 km to kg");
		expect(r.ok).toBe(false);
	});
});

describe("evaluate — currency (rates supplied by caller)", () => {
	const rates = { eur: 1, usd: 1.1, czk: 25 };

	it("converts through the shared base", () => {
		const r = ok("10 eur to usd", { rates });
		expect(r.value).toBeCloseTo(11, 10);
		expect(r.formatted).toBe("11 USD");
	});

	it("understands currency symbols", () => {
		const r = ok("10 € to USD", { rates });
		expect(r.value).toBeCloseTo(11, 10);
	});

	it("reports when rates are unavailable", () => {
		const r = evaluate("10 eur to usd");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/unavailable/i);
	});

	it("reports a missing rate for a known code", () => {
		const r = evaluate("10 eur to gbp", { rates });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/GBP/);
	});
});

describe("evaluate — number bases", () => {
	it("reads a named source base", () => {
		expect(ok("FF hex to decimal").formatted).toBe("255");
		expect(ok("377 octal to decimal").formatted).toBe("255");
		expect(ok("1010 binary to decimal").formatted).toBe("10");
	});

	it("writes the target base with its prefix", () => {
		expect(ok("255 to hex").formatted).toBe("0xFF");
		expect(ok("255 to binary").formatted).toBe("0b11111111");
		expect(ok("255 to octal").formatted).toBe("0o377");
		expect(ok("1010 binary to hex").formatted).toBe("0xA");
	});

	it("keeps the decimal value alongside the formatted result", () => {
		const r = ok("FF hex to decimal");
		expect(r.value).toBe(255);
		expect(ok("1010 binary to hex").value).toBe(10);
	});

	it("notes what was converted from what", () => {
		expect(ok("FF hex to decimal").note).toBe("0xFF → decimal");
		expect(ok("255 to hex").note).toBe("255 → hex");
	});

	it("bare numbers are decimal, so arithmetic still works", () => {
		expect(ok("20 + 35 to hex").formatted).toBe("0x37");
		expect(ok("2^10 to hex").formatted).toBe("0x400");
	});

	it("accepts every alias and the in/as keywords", () => {
		expect(ok("ff hexadecimal in dec").formatted).toBe("255");
		expect(ok("11 bin as base10").formatted).toBe("3");
		expect(ok("777 oct to base16").formatted).toBe("0x1FF");
	});

	it("round-trips its own prefixed output", () => {
		expect(ok("0xFF to decimal").formatted).toBe("255");
		expect(ok("0b1010 to hex").formatted).toBe("0xA");
		expect(ok("0o377 to hex").note).toBe("0o377 → hex");
	});

	it("negatives keep a signed prefix rather than wrapping", () => {
		expect(ok("-10 to hex").formatted).toBe("-0xA");
		expect(ok("-A hex to decimal").value).toBe(-10);
	});

	it("converts to itself and through decimal", () => {
		expect(ok("255 to decimal").formatted).toBe("255");
		expect(ok("FF hex to hex").formatted).toBe("0xFF");
	});

	it("rejects digits the source base doesn't have", () => {
		const r = evaluate("FG hex to decimal");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/hex/);
		expect(evaluate("1012 binary to decimal").ok).toBe(false);
		expect(evaluate("999 octal to decimal").ok).toBe(false);
	});

	it("rejects fractional and unsafe values", () => {
		const r = evaluate("2.5 to hex");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/whole numbers/i);
		expect(evaluate("2^70 to hex").ok).toBe(false);
	});

	it("leaves unit conversions alone", () => {
		expect(ok("10 km to miles").formatted).toContain("mi");
		expect(evaluate("10 km to hex").ok).toBe(false);
	});
});

describe("evaluate — errors", () => {
	it("empty input", () => {
		expect(evaluate("").ok).toBe(false);
	});

	it("dangling operator", () => {
		expect(evaluate("2 +").ok).toBe(false);
	});

	it("unknown name", () => {
		expect(evaluate("hello world").ok).toBe(false);
	});

	it("unbalanced parentheses", () => {
		expect(evaluate("(1 + 2").ok).toBe(false);
	});
});

describe("formatNumber", () => {
	it("groups thousands", () => {
		expect(formatNumber(1000)).toBe("1,000");
		expect(formatNumber(1234567)).toBe("1,234,567");
	});

	it("tames floating-point noise", () => {
		expect(formatNumber(0.1 + 0.2)).toBe("0.3");
	});

	it("zero and negatives", () => {
		expect(formatNumber(0)).toBe("0");
		expect(formatNumber(-42)).toBe("-42");
	});

	it("non-finite values", () => {
		expect(formatNumber(NaN)).toBe("undefined");
		expect(formatNumber(Infinity)).toBe("∞");
		expect(formatNumber(-Infinity)).toBe("-∞");
	});

	it("falls back to exponential for extreme magnitudes", () => {
		expect(formatNumber(1e20)).toContain("e");
		expect(formatNumber(1e-9)).toContain("e");
	});
});
