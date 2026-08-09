import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CARD_REQUEST_EMAIL,
	CARD_REQUEST_TITLE,
	cardRequestGithubUrl,
	cardRequestMailtoUrl,
	type CardRequestContext,
} from "../src/cardrequest";

/**
 * The "Request a card" links at the bottom of the add-card picker.
 *
 * Both are one-shot: the user clicks, a composer opens, and whatever is (or
 * isn't) prefilled is what the maintainer receives. There is no error to
 * observe if a prefill silently stops landing — which is exactly what happens
 * when a field id in `feature_request.yml` is renamed — so the ids are pinned
 * against the form file itself here.
 */

const ctx: CardRequestContext = {
	hearthVersion: "1.18.0",
	obsidianVersion: "1.8.7",
	platform: "Desktop",
};

describe("cardRequestGithubUrl", () => {
	it("opens the feature-request form on the Hearth repository", () => {
		const url = new URL(cardRequestGithubUrl(ctx));
		expect(url.origin + url.pathname).toBe("https://github.com/ondreu/hearth/issues/new");
		expect(url.searchParams.get("template")).toBe("feature_request.yml");
		expect(url.searchParams.get("labels")).toBe("enhancement");
		expect(url.searchParams.get("title")).toBe(CARD_REQUEST_TITLE);
	});

	it("prefills field ids the issue form actually declares", () => {
		const form = readFileSync(".github/ISSUE_TEMPLATE/feature_request.yml", "utf8");
		const declared = [...form.matchAll(/^\s+id:\s*(\S+)/gm)].map((m) => m[1]);
		const url = new URL(cardRequestGithubUrl(ctx));
		const prefilled = [...url.searchParams.keys()].filter(
			(key) => !["template", "labels", "title"].includes(key),
		);
		expect(prefilled.length).toBeGreaterThan(0);
		for (const key of prefilled) expect(declared).toContain(key);
	});

	it("stamps the environment into the request", () => {
		const idea = new URL(cardRequestGithubUrl(ctx)).searchParams.get("idea") ?? "";
		expect(idea).toContain("Hearth 1.18.0");
		expect(idea).toContain("Obsidian 1.8.7");
		expect(idea).toContain("Desktop");
	});
});

describe("cardRequestMailtoUrl", () => {
	it("addresses the maintainer with a subject and a body", () => {
		const url = cardRequestMailtoUrl(ctx);
		expect(url.startsWith(`mailto:${CARD_REQUEST_EMAIL}?`)).toBe(true);
		const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
		expect(params.get("subject")).toBe(CARD_REQUEST_TITLE);
		expect(params.get("body")).toContain("I'd like to suggest a new card for Hearth.");
		expect(params.get("body")).toContain("Hearth 1.18.0 · Obsidian 1.8.7 · Desktop");
	});

	// Mail clients differ on whether they decode "+" in a body; several paste it
	// through as a literal plus, turning every space in the template into one.
	it("percent-encodes spaces rather than writing +", () => {
		const url = cardRequestMailtoUrl(ctx);
		expect(url).toContain("%20");
		expect(url.slice(url.indexOf("?"))).not.toContain("+");
	});
});
