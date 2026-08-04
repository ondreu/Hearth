import { describe, expect, it } from "vitest";
import type {
	CapabilityIdV1,
	DeveloperApiChannelStatusV1,
	DeveloperApiGrantStateV1,
	DeveloperApiGrantSummaryV1,
} from "@stratejya/operon-cli/contracts/v1";
import { OPERON_READ_CAPABILITIES, classifyAccess, missingCapabilities } from "../src/operon/api";

/**
 * The rules every Operon card and the settings readout branch on.
 *
 * Getting these wrong is not a cosmetic problem: "Operon isn't installed" and
 * "you haven't approved Hearth yet" send the user to completely different
 * places, and an `ok` session that Operon has not actually admitted for reads
 * would have each card fail on its first call instead of explaining itself.
 */

function status(overrides: Partial<DeveloperApiChannelStatusV1> = {}): DeveloperApiChannelStatusV1 {
	return {
		contractVersion: 1,
		kind: "developer-api-channel-status",
		runtimeApiVersion: 1,
		availability: "available",
		reason: "ready",
		authority: "granted",
		admission: { reads: true, writes: false },
		capabilities: [],
		...overrides,
	};
}

function grant(
	state: DeveloperApiGrantStateV1,
	granted: readonly CapabilityIdV1[] = OPERON_READ_CAPABILITIES,
): DeveloperApiGrantSummaryV1 {
	return {
		state,
		revision: 1,
		requestedCapabilities: OPERON_READ_CAPABILITIES,
		grantedCapabilities: granted,
		// Operon reports the intersection separately; Hearth reads requested vs
		// granted, so the fixture mirrors granted here rather than diverging.
		effectiveCapabilities: granted,
	};
}

describe("classifyAccess", () => {
	it("reports a fully admitted session as ready", () => {
		expect(classifyAccess(true, status({ grant: grant("active") }))).toBe("ready");
	});

	it("treats a missing status as Operon simply not being there", () => {
		expect(classifyAccess(false, null)).toBe("absent");
		expect(classifyAccess(true, null)).toBe("absent");
	});

	it("separates a device that can never host the API from one that can", () => {
		expect(classifyAccess(false, status({ reason: "unsupported-platform" }))).toBe("unsupported");
		expect(classifyAccess(false, status({ reason: "unsupported-version" }))).toBe("unsupported");
		expect(classifyAccess(false, status({ reason: "accessor-unavailable" }))).toBe("absent");
	});

	it("surfaces the grant state ahead of everything else", () => {
		expect(classifyAccess(false, status({ grant: grant("pending") }))).toBe("pending");
		expect(classifyAccess(false, status({ grant: grant("suspended") }))).toBe("suspended");
		expect(classifyAccess(false, status({ grant: grant("revoked") }))).toBe("revoked");
	});

	it("reports a grant lost mid-session rather than claiming the session is live", () => {
		// The accessor said ok, but the grant is gone: the next read would be
		// refused, so the card must not draw as if it were connected.
		expect(classifyAccess(true, status({ grant: grant("revoked") }))).toBe("revoked");
	});

	it("calls a first, ungranted request pending — that request is what queues the approval", () => {
		expect(classifyAccess(false, status({ authority: "read-only", reason: "ready" }))).toBe("pending");
	});

	it("does not call a session ready while Operon still refuses reads", () => {
		expect(
			classifyAccess(true, { ...status({ grant: grant("active") }), admission: { reads: false, writes: false } }),
		).toBe("booting");
	});

	it("distinguishes an unavailable runtime from an approval problem", () => {
		expect(
			classifyAccess(false, status({ availability: "unavailable", reason: "booting", grant: grant("active") })),
		).toBe("booting");
	});
});

describe("missingCapabilities", () => {
	it("lists everything when no grant record exists yet", () => {
		expect(missingCapabilities(null)).toEqual([...OPERON_READ_CAPABILITIES]);
		expect(missingCapabilities(status())).toEqual([...OPERON_READ_CAPABILITIES]);
	});

	it("names only what a partial approval left out, in requested order", () => {
		const partial = status({ grant: grant("pending", ["system.health", "tasks.query"]) });
		expect(missingCapabilities(partial)).toEqual([
			"system.capabilities",
			"catalog.read",
			"tasks.read",
			"tasks.finder",
			"timers.read",
		]);
	});

	it("is empty once every requested capability is granted", () => {
		expect(missingCapabilities(status({ grant: grant("active") }))).toEqual([]);
	});
});
