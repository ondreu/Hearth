import { describe, expect, it } from "vitest";
import { isCjkLanguage } from "../src/i18n";

describe("isCjkLanguage", () => {
	it("matches Chinese, Japanese and Korean, with regional variants", () => {
		expect(isCjkLanguage("zh")).toBe(true);
		expect(isCjkLanguage("zh-CN")).toBe(true);
		expect(isCjkLanguage("zh-TW")).toBe(true);
		expect(isCjkLanguage("ja")).toBe(true);
		expect(isCjkLanguage("ko")).toBe(true);
	});


	it("ignores case", () => {
		expect(isCjkLanguage("ZH-TW")).toBe(true);
	});


	it("leaves other languages alone", () => {
		expect(isCjkLanguage("en")).toBe(false);
		expect(isCjkLanguage("de")).toBe(false);
		expect(isCjkLanguage("")).toBe(false);
	});
});
