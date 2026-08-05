import { describe, expect, it } from "vitest";
import type {
	CapabilityIdV1,
	DeveloperApiChannelStatusV1,
	DeveloperApiGrantStateV1,
	DeveloperApiGrantSummaryV1,
} from "@stratejya/operon-cli/contracts/v1";
import {
	OPERON_READ_CAPABILITIES,
	accessErrorOf,
	classifyAccess,
	isTransientAccessState,
	missingCapabilities,
} from "../src/operon/api";

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
	});

	it("surfaces the grant state ahead of everything else", () => {
		expect(classifyAccess(false, status({ grant: grant("pending") }))).toBe("pending");
		expect(classifyAccess(false, status({ grant: grant("suspended") }))).toBe("suspended");
		expect(classifyAccess(false, status({ grant: grant("revoked") }))).toBe("revoked");
	});

	// The first request from a new consumer reliably hits this: evaluating the
	// grant observes an unseen consumer version, which enqueues a write, and the
	// same call then reports its store busy. Operon does not record a request on
	// that path, so calling it "suspended" would point the user at an empty list
	// and leave the card stuck on a state that resolves itself.
	it("treats a busy grant store as transient, not as something to review", () => {
		expect(
			classifyAccess(false, status({ grant: grant("suspended", []) }), {
				code: "authority-insufficient",
				reason: "Not covered by an active exact-capability grant.",
				reasonCode: "grant-persistence-unavailable",
			}),
		).toBe("booting");
	});

	it("still reports a genuine suspension the user has to review", () => {
		expect(
			classifyAccess(false, status({ grant: grant("suspended", []) }), {
				code: "authority-insufficient",
				reason: "Not covered by an active exact-capability grant.",
				reasonCode: "consumer-version-major-change",
			}),
		).toBe("suspended");
	});

	// The exact shape observed in a real vault on a first connection. Operon
	// evaluates the grant as pending, records the request (which enqueues a
	// write), and only then builds the status by evaluating a second time — by
	// which point its store reports busy and the re-evaluation says "suspended".
	// Reading the status here told the user their access had been suspended and
	// to go review it, when in fact the request had just been filed for them.
	it("believes the evaluation Operon acted on, not the one taken after", () => {
		expect(
			classifyAccess(false, status({ grant: grant("suspended", []) }), {
				code: "authority-insufficient",
				reason: "The Developer API request is not covered by an active exact-capability grant.",
				reasonCode: "capability-approval-required",
				grantState: "pending",
			}),
		).toBe("pending");
	});

	it("marks exactly the states that resolve without the user", () => {
		expect(isTransientAccessState("booting")).toBe(true);
		for (const state of ["absent", "error", "unsupported", "pending", "suspended", "revoked", "ready"] as const) {
			expect(isTransientAccessState(state)).toBe(false);
		}
	});

	it("reports a grant lost mid-session rather than claiming the session is live", () => {
		// The accessor said ok, but the grant is gone: the next read would be
		// refused, so the card must not draw as if it were connected.
		expect(classifyAccess(true, status({ grant: grant("revoked") }))).toBe("revoked");
	});

	// The distinction this suite exists for. Operon records a pending grant
	// request only once it has evaluated one — the path that also puts `grant`
	// on the status. Refusals that happen earlier (a rejected request shape, an
	// unverified consumer, a runtime facade that never came up) file nothing,
	// so calling them "pending" sends the user to a settings list that is empty
	// and gives them nothing to approve.
	it("does not claim pending when Operon never evaluated a grant", () => {
		const early = status({ authority: "revoked", reason: "accessor-unavailable" });
		expect(early.grant).toBeUndefined();
		expect(classifyAccess(false, early)).toBe("error");
	});

	it("reports pending only when Operon actually recorded the request", () => {
		// authority is "revoked" here too — reads aren't admitted yet — so the
		// grant state, not the authority field, has to be what decides.
		const filed = status({ authority: "revoked", grant: grant("pending", []) });
		expect(classifyAccess(false, filed)).toBe("pending");
	});

	it("treats an uninitialised runtime as booting, not as a refusal", () => {
		expect(
			classifyAccess(false, status({ reason: "accessor-unavailable" }), {
				code: "handler-unavailable",
				reason: "The Operon Runtime facade has not been initialized.",
			}),
		).toBe("booting");
	});

	it("treats an unloading Operon as booting", () => {
		expect(classifyAccess(false, status({ reason: "unloading" }))).toBe("booting");
	});

	it("does not call a session ready while Operon still refuses reads", () => {
		expect(
			classifyAccess(true, { ...status({ grant: grant("active") }), admission: { reads: false, writes: false } }),
		).toBe("booting");
	});

	it("distinguishes an unavailable runtime from an approval problem", () => {
		expect(
			classifyAccess(false, {
				...status({ availability: "unavailable", reason: "booting", grant: grant("active") }),
				admission: { reads: false, writes: false },
			}),
		).toBe("booting");
	});

	it("surfaces a refusal on an otherwise active grant instead of silently retrying", () => {
		// e.g. capability-unavailable: approved, admitted, still refused.
		expect(classifyAccess(false, status({ grant: grant("active") }))).toBe("error");
	});
});

describe("accessErrorOf", () => {
	it("keeps the code, sentence and finer-grained reason code", () => {
		expect(
			accessErrorOf({
				contractVersion: 1,
				code: "authority-insufficient",
				reason: "Not covered by an active grant.",
				retryable: false,
				action: "request-authority",
				details: { reasonCode: "developer-api-consumer-unverified" },
			}),
		).toEqual({
			code: "authority-insufficient",
			reason: "Not covered by an active grant.",
			reasonCode: "developer-api-consumer-unverified",
			grantState: undefined,
		});
	});

	it("keeps the grant state Operon acted on", () => {
		expect(
			accessErrorOf({
				code: "authority-insufficient",
				reason: "x",
				details: { reasonCode: "capability-approval-required", grantState: "pending" },
			})?.grantState,
		).toBe("pending");
	});

	it("ignores anything that isn't a structured error", () => {
		expect(accessErrorOf(null)).toBeNull();
		expect(accessErrorOf(undefined)).toBeNull();
		expect(accessErrorOf("boom")).toBeNull();
		expect(accessErrorOf({ reason: "no code" })).toBeNull();
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
