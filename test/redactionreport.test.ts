import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	REDACTION_REPORT_TITLE,
	redactionReportGithubUrl,
	type RedactionReportContext,
} from "../src/gallery/redactionreport";

/**
 * The "something of mine is readable in this picture" link in the publish
 * dialog.
 *
 * One-shot, like the card request: the author clicks, GitHub's issue form
 * opens, and whatever is (or isn't) prefilled is what arrives. Nothing fails
 * visibly when a field id in `bug_report.yml` is renamed — the box is simply
 * empty — so the ids are pinned against the form file itself.
 */

const ctx: RedactionReportContext = {
	hearthVersion: "3.1.0",
	obsidianVersion: "1.8.7",
	platform: "Desktop",
};

describe("redactionReportGithubUrl", () => {
	it("opens the bug form on the Hearth repository", () => {
		const url = new URL(redactionReportGithubUrl(ctx));
		expect(url.origin + url.pathname).toBe("https://github.com/ondreu/hearth/issues/new");
		expect(url.searchParams.get("template")).toBe("bug_report.yml");
		expect(url.searchParams.get("labels")).toBe("bug");
		expect(url.searchParams.get("title")).toBe(REDACTION_REPORT_TITLE);
	});

	it("prefills field ids the issue form actually declares", () => {
		const form = readFileSync(".github/ISSUE_TEMPLATE/bug_report.yml", "utf8");
		const declared = [...form.matchAll(/^\s+id:\s*(\S+)/gm)].map((m) => m[1]);
		const url = new URL(redactionReportGithubUrl(ctx));
		const prefilled = [...url.searchParams.keys()].filter(
			(key) => !["template", "labels", "title"].includes(key),
		);
		expect(prefilled.length).toBeGreaterThan(0);
		for (const key of prefilled) expect(declared).toContain(key);
	});

	it("fills in the versions the form asks for, so nobody has to be asked", () => {
		const params = new URL(redactionReportGithubUrl(ctx)).searchParams;
		expect(params.get("hearth-version")).toBe("3.1.0");
		expect(params.get("obsidian-version")).toBe("1.8.7");
		expect(params.get("what-happened")).toContain("Desktop");
	});

	/**
	 * The report is about a leak, and the person filing it is looking at the
	 * thing that leaked. Asking for it in the issue would be asking them to
	 * publish it the other way round.
	 */
	it("asks for a description rather than the private text itself", () => {
		const said = new URL(redactionReportGithubUrl(ctx)).searchParams.get("what-happened") ?? "";
		expect(said).toContain("please don't paste the private part");
	});
});
