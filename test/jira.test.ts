import { describe, expect, it } from "vitest";
import {
	buildJiraUrl,
	composeJiraJql,
	createJiraLoadCoordinator,
	deriveJiraOptions,
	discoverSprintFieldId,
	escapeJqlString,
	filterJiraOptions,
	jiraSearchFields,
	parseSprintNames,
} from "../src/jira";
import {
	exportLayout,
	exportSettings,
	sanitizeJira,
} from "../src/layout";
import {
	DEFAULT_SETTINGS,
	type DashboardCard,
	type HomeSettings,
	type JiraSelections,
} from "../src/types";

describe("escapeJqlString", () => {
	it("escapes quotes, backslashes, and line breaks", () => {
		expect(escapeJqlString('QA "ready" \\ blocked\nnext')).toBe(
			'QA \\"ready\\" \\\\ blocked\\nnext',
		);
	});
});

describe("composeJiraJql", () => {
	it("parenthesizes the saved filter JQL and combines multi-select clauses", () => {
		const selections: JiraSelections = {
			status: ["In Progress", 'Ready "QA"'],
			assignee: ["Jane Doe"],
			priority: [],
			issueType: ["Story", "Bug"],
			sprint: [],
			fixVersion: ["Release 1"],
		};

		expect(composeJiraJql("project = APP ORDER BY updated DESC", selections)).toBe(
			'(project = APP) AND status IN ("In Progress", "Ready \\"QA\\"")' +
				' AND assignee IN ("Jane Doe") AND issuetype IN ("Story", "Bug")' +
				' AND fixVersion IN ("Release 1") ORDER BY updated DESC',
		);
	});

	it("returns only a parenthesized base query when selections are empty", () => {
		expect(composeJiraJql("project = APP", {})).toBe("(project = APP)");
	});

	it("does not treat ORDER BY text inside a quoted value as the sort clause", () => {
		expect(
			composeJiraJql(
				'summary ~ "please order by request" ORDER BY updated DESC',
				{ status: ["Open"] },
			),
		).toBe(
			'(summary ~ "please order by request") AND status IN ("Open") ORDER BY updated DESC',
		);
	});

	it("never emits empty parentheses for empty or order-only base JQL", () => {
		expect(composeJiraJql("", {})).toBe("");
		expect(composeJiraJql("ORDER BY updated DESC", {})).toBe(
			"ORDER BY updated DESC",
		);
		expect(composeJiraJql("", { status: ["Open"] })).toBe(
			'status IN ("Open")',
		);
	});
});

describe("deriveJiraOptions", () => {
	it("derives sorted unique options while retaining selected missing values", () => {
		const options = deriveJiraOptions(
			[
				{
					key: "APP-1",
					fields: {
						summary: "One",
						status: { name: "Done", statusCategory: { key: "done" } },
						priority: { name: "High" },
						issuetype: { name: "Bug" },
						assignee: { name: "jdoe", displayName: "Jane Doe" },
						customfield_10020: [{ name: "Sprint 2" }],
						fixVersions: [{ name: "Release 1" }],
					},
				},
				{
					key: "APP-2",
					fields: {
						summary: "Two",
						status: { name: "Open", statusCategory: { key: "new" } },
						priority: { name: "High" },
						issuetype: { name: "Story" },
						assignee: null,
						customfield_10020: { name: "Sprint 1" },
						fixVersions: [],
					},
				},
			],
			{ status: ["Archived"], sprint: ["Sprint 3"] },
			"customfield_10020",
		);

		expect(options.status).toEqual(["Archived", "Done", "Open"]);
		expect(options.priority).toEqual(["High"]);
		expect(options.issueType).toEqual(["Bug", "Story"]);
		expect(options.assignee).toEqual(["jdoe"]);
		expect(options.sprint).toEqual(["Sprint 1", "Sprint 2", "Sprint 3"]);
		expect(options.fixVersion).toEqual(["Release 1"]);
	});

	it("leaves sprint empty when Jira does not return a sprint-shaped field", () => {
		const options = deriveJiraOptions(
			[
				{
					key: "APP-1",
					fields: {
						summary: "One",
						status: { name: "Open", statusCategory: { key: "new" } },
						priority: null,
						issuetype: { name: "Task" },
						assignee: null,
						fixVersions: [],
					},
				},
			],
			{},
		);
		expect(options.sprint).toEqual([]);
	});
});

describe("filterJiraOptions", () => {
	const options = ["Sprint 10", "Platform Sprint", "Release train"];

	it("returns every option for an empty or whitespace-only query", () => {
		const unfiltered = filterJiraOptions(options, "");
		expect(unfiltered).toEqual(options);
		expect(unfiltered).not.toBe(options);
		expect(filterJiraOptions(options, "   ")).toEqual(options);
	});

	it("matches case-insensitive substrings after trimming the query", () => {
		expect(filterJiraOptions(options, "  SPRINT  ")).toEqual([
			"Sprint 10",
			"Platform Sprint",
		]);
	});

	it("returns an empty list when no options match without mutating the input", () => {
		expect(filterJiraOptions(options, "missing")).toEqual([]);
		expect(options).toEqual(["Sprint 10", "Platform Sprint", "Release train"]);
	});
});

describe("Jira sprint field discovery", () => {
	it("prefers the Greenhopper schema custom key", () => {
		expect(
			discoverSprintFieldId([
				{ id: "customfield_1", name: "Sprint" },
				{
					id: "customfield_2",
					name: "Iteration",
					schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" },
				},
			]),
		).toBe("customfield_2");
	});

	it("falls back to a field named Sprint", () => {
		expect(
			discoverSprintFieldId([{ id: "customfield_7", name: "Sprint" }]),
		).toBe("customfield_7");
		expect(discoverSprintFieldId([{ id: "summary", name: "Summary" }])).toBeNull();
	});

	it("parses object, array, and legacy Greenhopper sprint values", () => {
		expect(
			parseSprintNames([
				{ name: "Sprint 1" },
				"com.atlassian.greenhopper.service.sprint.Sprint@abc[id=2,name=Sprint 2,state=ACTIVE]",
			]),
		).toEqual(["Sprint 1", "Sprint 2"]);
	});

	it("requests only a discovered sprint field id", () => {
		expect(jiraSearchFields("customfield_10020")).toContain("customfield_10020");
		expect(jiraSearchFields(null)).not.toContain("sprint");
	});
});

describe("buildJiraUrl", () => {
	it("builds API URLs only beneath the configured host and relative API path", () => {
		expect(
			buildJiraUrl(
				"https://jira.example.com/",
				"/rest/api/latest",
				"/filter/favourite",
			).toString(),
		).toBe("https://jira.example.com/rest/api/latest/filter/favourite");
	});

	it("rejects unsupported hosts and absolute API paths", () => {
		expect(() => buildJiraUrl("file:///etc", "/rest/api/latest", "/search")).toThrow();
		expect(() =>
			buildJiraUrl("http://jira.example.com", "/rest/api/latest", "/search"),
		).toThrow();
		expect(() =>
			buildJiraUrl(
				"https://jira.example.com",
				"https://evil.example/api",
				"/search",
			),
		).toThrow();
		expect(() =>
			buildJiraUrl(
				"https://jira.example.com",
				"/rest/api/latest",
				"https://evil.example/search",
			),
		).toThrow();
	});
});

describe("Jira load coordinator", () => {
	it("runs one trailing request when a change arrives during an active load", async () => {
		const calls: string[] = [];
		let release: (() => void) | undefined;
		const first = new Promise<void>((resolve) => {
			release = resolve;
		});
		const coordinator = createJiraLoadCoordinator(async (kind: string) => {
			calls.push(kind);
			if (calls.length === 1) await first;
		});

		coordinator.request("full");
		coordinator.request("refined");
		expect(calls).toEqual(["full"]);
		release?.();
		await coordinator.idle();
		expect(calls).toEqual(["full", "refined"]);
	});

	it("drops queued work after destruction", async () => {
		let release: (() => void) | undefined;
		const first = new Promise<void>((resolve) => {
			release = resolve;
		});
		const calls: string[] = [];
		const coordinator = createJiraLoadCoordinator(async (kind: string) => {
			calls.push(kind);
			await first;
		});
		coordinator.request("full");
		coordinator.request("refined");
		coordinator.destroy();
		release?.();
		await coordinator.idle();
		expect(calls).toEqual(["full"]);
	});

	it("accepts a later request after a failed load", async () => {
		const calls: string[] = [];
		const coordinator = createJiraLoadCoordinator(async (kind: string) => {
			calls.push(kind);
			if (kind === "first") throw new Error("failed");
		});
		coordinator.request("first");
		await expect(coordinator.idle()).rejects.toThrow("failed");
		coordinator.request("second");
		await coordinator.idle();
		expect(calls).toEqual(["first", "second"]);
	});
});

function jiraCard(id: string, pat: string): DashboardCard {
	return {
		id,
		kind: "jira",
		x: 0,
		y: 0,
		w: 4,
		h: 4,
		jira: {
			host: "https://jira.example.com",
			pat,
			filterId: "10001",
			filterName: "Team work",
			maxResults: 25,
		},
	};
}

function settingsWithJira(pat: string): HomeSettings {
	return {
		...DEFAULT_SETTINGS,
		dashboards: [
			{ id: "dashboard", name: "Dashboard", cards: [jiraCard("card", pat)] },
		],
		activeDashboardId: "dashboard",
		pinnedCards: [jiraCard("pinned", pat)],
	};
}

describe("Jira export credential scrubbing", () => {
	it("excludes PATs from layout exports without mutating live settings", () => {
		const sentinel = "PAT_SENTINEL_LAYOUT";
		const settings = settingsWithJira(sentinel);
		const exported = exportLayout(settings);

		expect(exported).not.toContain(sentinel);
		expect(exported).toContain("https://jira.example.com");
		expect(exported).toContain("Team work");
		expect(settings.dashboards[0].cards[0].jira?.pat).toBe(sentinel);
		expect(settings.pinnedCards[0].jira?.pat).toBe(sentinel);
	});

	it("excludes PATs from full settings exports without mutating live settings", () => {
		const sentinel = "PAT_SENTINEL_SETTINGS";
		const settings = settingsWithJira(sentinel);
		const exported = exportSettings(settings);

		expect(exported).not.toContain(sentinel);
		expect(exported).toContain("https://jira.example.com");
		expect(exported).toContain("Team work");
		expect(settings.dashboards[0].cards[0].jira?.pat).toBe(sentinel);
		expect(settings.pinnedCards[0].jira?.pat).toBe(sentinel);
	});
});

describe("sanitizeJira", () => {
	it("allowlists and clamps a valid imported configuration", () => {
		expect(
			sanitizeJira({
				host: "https://jira.example.com/",
				pat: "secret",
				apiBasePath: "/rest/api/3",
				filterId: "10001",
				filterName: "My filter",
				controls: ["status", "sprint", "invalid"],
				selections: {
					status: ["Open", 3],
					sprint: ["Sprint 1"],
					other: ["drop"],
				},
				maxResults: 9999,
				refreshMin: -4,
				cacheMin: 12,
				untrusted: "drop",
			}),
		).toEqual({
			host: "https://jira.example.com",
			pat: "secret",
			apiBasePath: "/rest/api/3",
			filterId: "10001",
			filterName: "My filter",
			controls: ["status", "sprint"],
			selections: { status: ["Open"], sprint: ["Sprint 1"] },
			maxResults: 200,
			refreshMin: 0,
			cacheMin: 12,
		});
	});

	it("does not crash on malformed nested values", () => {
		expect(sanitizeJira(null)).toEqual({});
		expect(sanitizeJira({ controls: "status", selections: 42 })).toEqual({});
		expect(sanitizeJira({ selections: { status: null, sprint: "bad" } })).toEqual({
			selections: {},
		});
	});
});
