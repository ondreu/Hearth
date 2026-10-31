import { describe, expect, it } from "vitest";
import { CURRENCY_CODES, parseEcbRates, parseFrankfurterRates } from "../src/currency";

/**
 * A real ECB daily reference-rate document (trimmed to the Cube tree, the values
 * are the fix of 2026-10-30). The parser has to keep working against the actual
 * shape: rates live on `<Cube currency='…' rate='…'/>`, one per line, with a
 * dated parent `<Cube time='…'>` that carries no rate.
 */
const ECB_DAILY = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
	<gesmes:subject>Reference rates</gesmes:subject>
	<Cube>
		<Cube time='2026-10-30'>
			<Cube currency='USD' rate='1.1172'/>
			<Cube currency='JPY' rate='175.68'/>
			<Cube currency='CZK' rate='24.353'/>
			<Cube currency='DKK' rate='7.4735'/>
			<Cube currency='GBP' rate='0.83380'/>
			<Cube currency='HUF' rate='366.33'/>
			<Cube currency='PLN' rate='4.4038'/>
			<Cube currency='RON' rate='5.3447'/>
			<Cube currency='SEK' rate='10.9780'/>
			<Cube currency='CHF' rate='0.9194'/>
			<Cube currency='ISK' rate='136.00'/>
			<Cube currency='NOK' rate='10.3120'/>
			<Cube currency='TRY' rate='55.8015'/>
			<Cube currency='AUD' rate='1.5904'/>
			<Cube currency='BRL' rate='6.0692'/>
			<Cube currency='CAD' rate='1.5606'/>
			<Cube currency='CNY' rate='7.4326'/>
			<Cube currency='HKD' rate='8.7652'/>
			<Cube currency='IDR' rate='20275.17'/>
			<Cube currency='ILS' rate='3.4950'/>
			<Cube currency='INR' rate='106.0840'/>
			<Cube currency='KRW' rate='1491.76'/>
			<Cube currency='MXN' rate='21.1237'/>
			<Cube currency='MYR' rate='4.5325'/>
			<Cube currency='NZD' rate='1.9823'/>
			<Cube currency='PHP' rate='71.143'/>
			<Cube currency='SGD' rate='1.4282'/>
			<Cube currency='THB' rate='37.683'/>
			<Cube currency='ZAR' rate='18.6455'/>
		</Cube>
	</Cube>
</gesmes:Envelope>`;

describe("parseEcbRates", () => {
	it("reads the daily reference rates, EUR as the base", () => {
		const rates = parseEcbRates(ECB_DAILY);
		expect(rates).not.toBeNull();
		expect(rates?.eur).toBe(1);
		expect(rates?.usd).toBe(1.1172);
		expect(rates?.czk).toBe(24.353);
		expect(Object.keys(rates ?? {})).toHaveLength(30); // 29 published + EUR
	});

	it("lowercases the codes, so they line up with what the calculator types", () => {
		const rates = parseEcbRates(ECB_DAILY) ?? {};
		expect(Object.keys(rates).every((code) => code === code.toLowerCase())).toBe(true);
	});

	it("does not depend on the order of the attributes", () => {
		const swapped = "<Cube><Cube rate='7.5' currency='PLN'/></Cube>";
		expect(parseEcbRates(swapped)).toEqual({ eur: 1, pln: 7.5 });
	});

	it("ignores rates that are not a positive number", () => {
		const junk = "<Cube><Cube currency='USD' rate='0'/><Cube currency='JPY' rate='abc'/>" +
			"<Cube currency='CZK' rate='-3'/><Cube currency='GBP' rate='0.83'/></Cube>";
		expect(parseEcbRates(junk)).toEqual({ eur: 1, gbp: 0.83 });
	});

	// A documented failure has to fall through to the second source (Frankfurter)
	// rather than be cached as an empty table that renders as "rates unavailable".
	it("is null when the document carries no rates", () => {
		expect(parseEcbRates("")).toBeNull();
		expect(parseEcbRates("<html><body>Service Unavailable</body></html>")).toBeNull();
		expect(parseEcbRates("<Cube><Cube time='2026-10-30'/></Cube>")).toBeNull();
	});
});

describe("parseFrankfurterRates", () => {
	it("reads the JSON mirror into the same shape", () => {
		expect(parseFrankfurterRates({ base: "EUR", rates: { USD: 1.1172, CZK: 24.353 } })).toEqual({
			eur: 1,
			usd: 1.1172,
			czk: 24.353,
		});
	});

	it("keeps a non-EUR base and marks it as 1", () => {
		expect(parseFrankfurterRates({ base: "USD", rates: { EUR: 0.9 } })).toEqual({
			usd: 1,
			eur: 0.9,
		});
	});

	it("falls back to EUR when the payload omits the base", () => {
		expect(parseFrankfurterRates({ rates: { USD: 1.1 } })?.eur).toBe(1);
	});

	it("drops junk rates and is null when nothing usable is left", () => {
		expect(parseFrankfurterRates({ rates: { USD: 0, JPY: "1.2", CZK: 24 } })).toEqual({
			eur: 1,
			czk: 24,
		});
		expect(parseFrankfurterRates(null)).toBeNull();
		expect(parseFrankfurterRates({})).toBeNull();
		expect(parseFrankfurterRates({ rates: {} })).toBeNull();
	});
});

describe("CURRENCY_CODES", () => {
	// Pins the list against what the ECB actually publishes: a currency the ECB
	// has retired (BGN, after Bulgaria adopted the euro in January 2026) or a
	// typo would offer a unit the rate table can never answer for.
	it("names exactly the units the ECB publishes a rate for", () => {
		const published = parseEcbRates(ECB_DAILY) ?? {};
		expect([...CURRENCY_CODES].sort()).toEqual(Object.keys(published).sort());
	});

	it("has no duplicates", () => {
		expect(new Set(CURRENCY_CODES).size).toBe(CURRENCY_CODES.length);
	});
});
