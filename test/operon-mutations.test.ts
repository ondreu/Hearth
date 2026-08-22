import { describe, expect, it, vi } from "vitest";
import type {
	CapabilityIdV1,
	DeveloperApiChannelStatusV1,
	DeveloperMutationPlanHandleV1,
	TaskContextV1,
} from "@stratejya/operon-cli/contracts/v1";
import {
	OPERON_ALL_CAPABILITIES,
	OPERON_READ_CAPABILITIES,
	OPERON_WRITE_CAPABILITIES,
	operonCapabilities,
	writesGranted,
} from "../src/operon/api";
import type { OperonAccess, OperonSession } from "../src/operon/api";
import {
	canWrite,
	classifyExecution,
	createIntent,
	createTarget,
	createTask,
	isMutable,
	needsConfirmation,
	targetOf,
	transitionIntent,
	transitionTask,
} from "../src/operon/mutations";
import type { OperonPolicies, OperonTask } from "../src/operon/types";

/**
 * The rules behind Hearth's two Operon writes.
 *
 * Three of them are the ones that would do real damage if they drifted:
 *
 * - an `outcome-unknown` apply must be *recovered* (same plan) and never
 *   retried, because a retry can apply the change twice;
 * - a transition must carry the status the board was drawn from, so a stale
 *   board loses the race instead of silently reverting someone else's change;
 * - write capabilities are requested only when the vault opted in, since
 *   Operon's grant is all-or-nothing and a wider request suspends the grant
 *   read-only users already gave.
 */

function status(
	overrides: Partial<DeveloperApiChannelStatusV1> = {},
	granted: readonly CapabilityIdV1[] = OPERON_ALL_CAPABILITIES,
): DeveloperApiChannelStatusV1 {
	return {
		contractVersion: 1,
		kind: "developer-api-channel-status",
		runtimeApiVersion: 1,
		availability: "available",
		reason: "ready",
		authority: "granted",
		admission: { reads: true, writes: true },
		capabilities: [],
		grant: {
			state: "active",
			revision: 1,
			requestedCapabilities: OPERON_ALL_CAPABILITIES,
			grantedCapabilities: granted,
			effectiveCapabilities: granted,
		},
		...overrides,
	};
}

function task(overrides: Partial<TaskContextV1> = {}): OperonTask {
	return {
		identity: { operonId: "op-1", validity: "canonical", mutationAllowed: true },
		description: "Write the thing",
		representation: "inline",
		locator: { representation: "inline", filePath: "Notes/Inbox.md", lineNumber: 12 },
		checkbox: "open",
		workflow: {
			pipeline: { id: "pipe-1", label: "Default" },
			status: { id: "todo", label: "To do" },
		},
		dates: {},
		datetimes: {},
		relationships: {
			childOperonIds: [],
			blockingOperonIds: [],
			blockedByOperonIds: [],
			relatedOperonIds: [],
		},
		recurrence: { repeating: false },
		tracker: { active: false },
		pinned: false,
		sourceRevision: { algorithm: "sha256", contentDigest: "abc" },
		contextRevision: {
			index: { status: "available", sessionId: "s", ramGeneration: 1, snapshotId: "x", committedAt: "" },
			settingsFingerprint: "f",
			pinnedGeneration: 0,
			activeTrackerGeneration: 0,
			repeatSeriesRevision: 0,
			projectSerialGeneration: 0,
			projectSerialSignature: "",
		},
		...overrides,
	} as OperonTask;
}

function plan(overrides: Partial<DeveloperMutationPlanHandleV1> = {}): DeveloperMutationPlanHandleV1 {
	return {
		contractVersion: 1,
		kind: "developer-mutation-plan",
		recoveryRef: "rec-1",
		planDigest: "digest-1",
		capability: "tasks.transition.preview",
		mutationKind: "task.transition",
		createdAt: "",
		expiresAt: "",
		riskLevel: "routine",
		requiresConsent: false,
		targets: [],
		predictedEffects: [],
		warnings: [],
		...overrides,
	} as DeveloperMutationPlanHandleV1;
}

/** A session whose apply() returns whatever the test asks for, recording every
 * call so the test can assert what was *not* called as well as what was. */
function session(
	applyResults: { status: string }[],
	opts: {
		access?: Partial<OperonAccess>;
		previewOk?: boolean;
		plan?: DeveloperMutationPlanHandleV1;
		applyThrows?: boolean;
	} = {},
) {
	const calls = { preview: 0, apply: 0, recover: 0 };
	/** Digests the plans were applied and recovered under, so a test can prove
	 * a recovery resolved the *same* plan rather than a freshly previewed one. */
	const digests = { applied: [] as string[], recovered: [] as string[] };
	const previewed = opts.plan ?? plan();
	const api = {
		mutations: {
			preview: vi.fn(() => {
				calls.preview++;
				return Promise.resolve(
					opts.previewOk === false
						? { ok: false, error: { code: "refused", reason: "nope" } }
						: { ok: true, plan: previewed, warnings: [] },
				);
			}),
			apply: vi.fn((input: { plan: DeveloperMutationPlanHandleV1 }) => {
				calls.apply++;
				digests.applied.push(input.plan.planDigest);
				if (opts.applyThrows) return Promise.reject(new Error("boom"));
				return Promise.resolve(applyResults[0] ?? { status: "applied" });
			}),
			recover: vi.fn((input: { plan?: DeveloperMutationPlanHandleV1 }) => {
				calls.recover++;
				if (input.plan) digests.recovered.push(input.plan.planDigest);
				return Promise.resolve(applyResults[1] ?? { status: "applied" });
			}),
		},
	};
	const access: OperonAccess = {
		state: "ready",
		api: api as never,
		status: status(),
		error: null,
		retryAfterMs: null,
		missing: [],
		canWrite: true,
		...opts.access,
	};
	return {
		calls,
		digests,
		api,
		session: { access: () => access } as unknown as OperonSession,
	};
}

describe("requested capabilities", () => {
	it("asks for reads only until the vault opts into writes", () => {
		expect(operonCapabilities(false)).toBe(OPERON_READ_CAPABILITIES);
		expect(operonCapabilities(false)).not.toContain("tasks.transition.apply");
	});

	it("adds both halves of every mutation once writes are on", () => {
		const all = operonCapabilities(true);
		for (const id of OPERON_WRITE_CAPABILITIES) expect(all).toContain(id);
		// Operon refuses to apply a plan whose preview capability was never
		// granted, so a set with one half of a pair is useless.
		expect(all).toContain("tasks.transition.preview");
		expect(all).toContain("tasks.transition.apply");
		expect(all).toContain("tasks.create.preview");
		expect(all).toContain("tasks.create.apply");
	});

	it("returns the same array for the same answer, so a session can compare it", () => {
		// Identity is what stops access() renegotiating on every render.
		expect(operonCapabilities(true)).toBe(operonCapabilities(true));
		expect(operonCapabilities(false)).toBe(operonCapabilities(false));
	});
});

describe("writesGranted", () => {
	it("accepts a session that was granted every write capability", () => {
		expect(writesGranted(status())).toBe(true);
	});

	it("refuses when the channel isn't admitting writes yet", () => {
		expect(writesGranted(status({ admission: { reads: true, writes: false } }))).toBe(false);
	});

	it("refuses a grant narrowed to the reads", () => {
		expect(writesGranted(status({}, OPERON_READ_CAPABILITIES))).toBe(false);
	});

	it("refuses a partially granted write scope", () => {
		const partial: CapabilityIdV1[] = [...OPERON_READ_CAPABILITIES, "tasks.transition.preview"];
		expect(writesGranted(status({}, partial))).toBe(false);
	});

	it("refuses when there is no status at all", () => {
		expect(writesGranted(null)).toBe(false);
	});
});

describe("canWrite", () => {
	const base: OperonAccess = {
		state: "ready",
		api: null,
		status: null,
		error: null,
		retryAfterMs: null,
		missing: [],
		canWrite: true,
	};

	it("needs a ready session", () => {
		expect(canWrite(base)).toBe(true);
		expect(canWrite({ ...base, state: "pending" })).toBe(false);
	});

	it("needs the grant, not just the setting", () => {
		expect(canWrite({ ...base, canWrite: false })).toBe(false);
	});
});

describe("transitionIntent", () => {
	it("targets the task by id and by the locator it was read from", () => {
		const t = task();
		expect(targetOf(t)).toEqual({
			operonId: "op-1",
			locator: { representation: "inline", filePath: "Notes/Inbox.md", lineNumber: 12 },
		});
	});

	it("carries the status the board was drawn from as the expected state", () => {
		const intent = transitionIntent(task(), "doing");
		expect(intent.capability).toBe("tasks.transition.preview");
		expect(intent.mutationKind).toBe("task.transition");
		expect(intent.spec).toMatchObject({
			operation: "transition",
			targetStatusId: "doing",
			expectedStatusId: "todo",
		});
	});

	it("omits the expected status for a task that has no workflow", () => {
		const intent = transitionIntent(task({ workflow: undefined }), "doing");
		const spec = intent.spec as unknown as { expectedStatusId?: string };
		expect(spec.expectedStatusId).toBeUndefined();
	});
});

describe("createIntent", () => {
	it("leaves where a task goes to Operon's own settings", () => {
		const intent = createIntent({ description: "Buy milk" });
		expect(intent.capability).toBe("tasks.create.preview");
		const spec = intent.spec as unknown as { items: { target: { mode: string }; fields: unknown[] }[] };
		expect(spec.items[0].target).toEqual({ mode: "configured-default" });
		expect(spec.items[0].fields).toEqual([]);
	});

	it("asks for a specific representation only when the card chose one", () => {
		const spec = (intent: ReturnType<typeof createIntent>) =>
			(intent.spec as unknown as { items: { target: Record<string, unknown> }[] }).items[0].target;
		// Still Operon's configured path in every case — only the representation
		// is ever Hearth's to state.
		expect(spec(createIntent({ description: "x" }))).toEqual({ mode: "configured-default" });
		expect(spec(createIntent({ description: "x", createAs: "file" }))).toEqual({
			representation: "file",
			mode: "configured-default",
		});
		expect(spec(createIntent({ description: "x", createAs: "inline" }))).toEqual({
			representation: "inline",
			mode: "configured-default",
		});
	});

	it("passes the column's status and an optional due date through", () => {
		const intent = createIntent({ description: "Buy milk", statusId: "doing", due: "2026-09-01" });
		const spec = intent.spec as unknown as {
			items: { statusId?: string; fields: { field: string; value: string }[] }[];
		};
		expect(spec.items[0].statusId).toBe("doing");
		expect(spec.items[0].fields).toEqual([{ kind: "date", field: "dateDue", value: "2026-09-01" }]);
	});
});

/** Only the creation half of Operon's policies matters here. */
function policies(creation: Partial<OperonPolicies["creation"]>): OperonPolicies {
	return {
		creation: {
			descriptionRequired: false,
			assigneesRequired: false,
			defaultEstimateMinutes: 0,
			defaultToFileTask: false,
			fileTaskTargetFolder: "Tasks",
			fileTaskTemplateFolder: "Templates",
			inlineTaskSaveMode: "daily-notes",
			inlineTaskTargetFile: "Inbox.md",
			inlineTaskHeading: "## Tasks",
			dailyNoteAddsStartDate: false,
			dailyNoteAddsScheduledDate: false,
			createDailyNotesAsFileTasks: false,
			calendarInlineTaskHeading: "",
			builtInTemplateCandidates: [],
			...creation,
		},
	} as OperonPolicies;
}

describe("createTarget", () => {
	it("names the daily note when that is Operon's inline target", () => {
		// The case behind "Configured Daily Note target is unavailable or
		// invalid": without this, the refusal names a setting the user has no
		// way to identify from Hearth.
		expect(createTarget(policies({ inlineTaskSaveMode: "daily-notes" }))).toEqual({ kind: "daily" });
	});

	it("names the specific file, the active file and the ask-every-time mode", () => {
		expect(createTarget(policies({ inlineTaskSaveMode: "specific-file" }))).toEqual({
			kind: "file",
			path: "Inbox.md",
		});
		expect(createTarget(policies({ inlineTaskSaveMode: "active-file" }))).toEqual({ kind: "active" });
		expect(createTarget(policies({ inlineTaskSaveMode: "ask-every-time" }))).toEqual({ kind: "ask" });
	});

	it("follows Operon's own file-task default when the card expresses no preference", () => {
		expect(createTarget(policies({ defaultToFileTask: true }))).toEqual({
			kind: "note",
			folder: "Tasks",
		});
	});

	it("lets the card pick the other target when one of them can't be resolved", () => {
		const daily = policies({ inlineTaskSaveMode: "daily-notes" });
		expect(createTarget(daily, "file")).toEqual({ kind: "note", folder: "Tasks" });
		expect(createTarget(policies({ defaultToFileTask: true }), "inline")).toEqual({ kind: "daily" });
	});

	it("says nothing rather than guessing when the runtime publishes no policies", () => {
		expect(createTarget(null)).toEqual({ kind: "unknown" });
	});
});

describe("needsConfirmation", () => {
	it("applies routine plans without asking", () => {
		expect(needsConfirmation(plan({ riskLevel: "routine" }))).toBe(false);
		expect(needsConfirmation(plan({ riskLevel: "none" }))).toBe(false);
	});

	it("asks whenever Operon says consent is required", () => {
		expect(needsConfirmation(plan({ requiresConsent: true }))).toBe(true);
	});

	it("asks above routine risk even when consent wasn't demanded", () => {
		expect(needsConfirmation(plan({ riskLevel: "elevated" }))).toBe(true);
		expect(needsConfirmation(plan({ riskLevel: "destructive" }))).toBe(true);
	});
});

describe("classifyExecution", () => {
	it("maps the two terminal successes", () => {
		expect(classifyExecution({ status: "applied" } as never)).toBe("applied");
		expect(classifyExecution({ status: "already-applied" } as never)).toBe("already-applied");
	});

	it("maps a clean refusal to failed", () => {
		expect(classifyExecution({ status: "failed" } as never)).toBe("failed");
	});

	it("never reports a possibly-applied mutation as failed", () => {
		// Both of these mean "it may have landed". Calling either a failure is
		// what leads a caller to retry, and a retried mutation is a doubled one.
		expect(classifyExecution({ status: "partial" } as never)).toBe("unknown");
		expect(classifyExecution({ status: "outcome-unknown" } as never)).toBe("unknown");
	});
});

describe("transitionTask", () => {
	it("previews then applies, and reports the applied outcome", async () => {
		const s = session([{ status: "applied" }]);
		const result = await transitionTask(s.session, task(), "doing");
		expect(result).toEqual({ ok: true, outcome: "applied" });
		expect(s.calls).toEqual({ preview: 1, apply: 1, recover: 0 });
	});

	it("recovers the same plan when the outcome is unknown, instead of retrying", async () => {
		const s = session([{ status: "outcome-unknown" }, { status: "applied" }]);
		const result = await transitionTask(s.session, task(), "doing");
		expect(result).toEqual({ ok: true, outcome: "applied" });
		// One preview, one apply, one recover: no second preview (which would be
		// a new plan) and no second apply (which would be a second write).
		expect(s.calls).toEqual({ preview: 1, apply: 1, recover: 1 });
		// And it recovered the plan that was applied, not a new one.
		expect(s.digests.recovered).toEqual(s.digests.applied);
	});

	it("stops after one recovery and reports the state as unknown", async () => {
		const s = session([{ status: "outcome-unknown" }, { status: "outcome-unknown" }]);
		const result = await transitionTask(s.session, task(), "doing");
		expect(result.ok).toBe(false);
		expect(result.outcome).toBe("unknown");
		expect(s.calls.recover).toBe(1);
	});

	it("does not write when the task is dropped back on its own column", async () => {
		const s = session([{ status: "applied" }]);
		const result = await transitionTask(s.session, task(), "todo");
		expect(result).toEqual({ ok: true, outcome: "already-applied" });
		expect(s.calls.preview).toBe(0);
	});

	it("refuses a task Operon marked as unsafe to target", async () => {
		const s = session([{ status: "applied" }]);
		const frozen = task({ identity: { operonId: "op-1", validity: "duplicate", mutationAllowed: false } });
		expect(isMutable(frozen)).toBe(false);
		const result = await transitionTask(s.session, frozen, "doing");
		expect(result.ok).toBe(false);
		expect(s.calls.preview).toBe(0);
	});

	it("does nothing when the session may not write", async () => {
		const s = session([{ status: "applied" }], { access: { canWrite: false } });
		const result = await transitionTask(s.session, task(), "doing");
		expect(result.ok).toBe(false);
		expect(s.calls.preview).toBe(0);
	});

	it("reports a refused preview without applying", async () => {
		const s = session([{ status: "applied" }], { previewOk: false });
		const result = await transitionTask(s.session, task(), "doing");
		expect(result).toMatchObject({ ok: false, outcome: "failed", reason: "nope" });
		expect(s.calls.apply).toBe(0);
	});

	it("asks before applying a plan that needs consent, and abandons it on no", async () => {
		const s = session([{ status: "applied" }], { plan: plan({ requiresConsent: true }) });
		const result = await transitionTask(s.session, task(), "doing", () => Promise.resolve(false));
		expect(result).toMatchObject({ ok: false, cancelled: true });
		expect(s.calls.apply).toBe(0);
	});

	it("applies once the user agrees", async () => {
		const s = session([{ status: "applied" }], { plan: plan({ riskLevel: "elevated" }) });
		const result = await transitionTask(s.session, task(), "doing", () => Promise.resolve(true));
		expect(result.ok).toBe(true);
		expect(s.calls.apply).toBe(1);
	});

	it("treats a throwing apply as unknown, never as a failure", async () => {
		const s = session([{ status: "applied" }], { applyThrows: true });
		const result = await transitionTask(s.session, task(), "doing");
		expect(result.outcome).toBe("unknown");
	});
});

describe("createTask", () => {
	it("creates through preview and apply", async () => {
		const s = session([{ status: "applied" }]);
		const result = await createTask(s.session, { description: "  Buy milk  ", statusId: "todo" });
		expect(result.ok).toBe(true);
		expect(s.api.mutations.preview).toHaveBeenCalledWith(
			expect.objectContaining({ capability: "tasks.create.preview" }),
		);
	});

	it("refuses an empty description without calling Operon", async () => {
		const s = session([{ status: "applied" }]);
		const result = await createTask(s.session, { description: "   " });
		expect(result.ok).toBe(false);
		expect(s.calls.preview).toBe(0);
	});
});
