import type {
	CreateTaskItemV1,
	DeveloperMutationExecutionResultV1,
	DeveloperMutationPlanHandleV1,
	DeveloperMutationPreviewInputV1,
	ExactMutationTargetV1,
	RiskLevelV1,
	StructuredErrorV1,
} from "@stratejya/operon-cli/contracts/v1";
import type { OperonAccess, OperonSession } from "./api";
import type { OperonPolicies, OperonTask } from "./types";

/**
 * The two Operon writes Hearth performs: moving a task to another status
 * (dragging it across the board) and creating one (the card's "+").
 *
 * Operon does not take a write as a single call. Every mutation is
 * **preview → apply**, and the plan the preview returns is the only thing
 * `apply` accepts — the consumer cannot assemble one, cannot re-target it and
 * cannot replay it. Three rules from its contract shape this module:
 *
 * - **A failure is not an invitation to retry.** `apply` reports its own
 *   terminal outcome, and only `partial` / `outcome-unknown` may be followed
 *   up — with `recover(plan)`, the *same* plan, never a fresh preview. Retrying
 *   a mutation whose outcome is unknown is how an integration writes twice.
 * - **Consent is the host's.** A plan can come back `requiresConsent`, or at an
 *   elevated risk level, and Hearth asks the user before applying rather than
 *   deciding on their behalf.
 * - **Expected state travels with the intent.** A transition carries the status
 *   Hearth believed the task was in, so a board drawn from a stale read is
 *   refused by Operon instead of quietly overwriting someone else's change.
 *
 * Like `reads.ts`, nothing here throws: every path returns a result a card can
 * render.
 */

const CONTRACT_VERSION = 1 as const;

/** Risk levels Hearth applies without asking. Anything above these — or any
 * plan Operon marks as needing consent — goes to the user first. */
const SILENT_RISK: readonly RiskLevelV1[] = ["none", "routine"];

/** What a write did, in the only terms the contract allows a consumer to act
 * on. `unknown` is not a failure: Operon is telling us the mutation may have
 * landed, and the one legal follow-up is recovering the same plan. */
export type OperonWriteOutcome = "applied" | "already-applied" | "failed" | "unknown";

export type OperonWriteResult =
	| { ok: true; outcome: "applied" | "already-applied" }
	/** The user declined at the confirmation step. Not an error to report. */
	| { ok: false; outcome: "failed"; cancelled: true; reason: string }
	| { ok: false; outcome: OperonWriteOutcome; cancelled?: false; reason: string };

/** Whether writes can be attempted at all right now: the user opted in, Operon
 * granted the write capabilities, and its channel admits writes. */
export function canWrite(access: OperonAccess): boolean {
	return access.state === "ready" && access.canWrite;
}

/**
 * Whether this particular task may be mutated. Operon decides — an ambiguous
 * or duplicated id makes a task unsafe to target, and it says so on the task
 * rather than failing later at apply time.
 */
export function isMutable(task: OperonTask): boolean {
	return task.identity.mutationAllowed;
}

/** The exact target for a task-scoped mutation: Operon's id *and* the source
 * locator it came from, so the write is refused if the task has moved. */
export function targetOf(task: OperonTask): ExactMutationTargetV1 {
	return { operonId: task.identity.operonId, locator: task.locator };
}

/** The preview intent for dragging a task into another status column. */
export function transitionIntent(
	task: OperonTask,
	targetStatusId: string,
): DeveloperMutationPreviewInputV1 {
	return {
		capability: "tasks.transition.preview",
		mutationKind: "task.transition",
		target: targetOf(task),
		spec: {
			operation: "transition",
			targetStatusId,
			// The status the board was drawn from. Operon rejects the write if
			// the task has moved since, which is the difference between "your
			// drag lost a race" and "your drag silently undid a change".
			expectedStatusId: task.workflow?.status.id,
		},
	};
}

/**
 * How the card asks for a new task to be represented.
 *
 * `undefined` leaves it entirely to Operon. The other two still leave *where*
 * to Operon's settings — they only pick which of its two configured targets to
 * use. That matters when one of them is unreachable: a vault whose inline
 * target is the daily note gets "Configured Daily Note target is unavailable or
 * invalid" from Operon, and choosing "file" is a real way past it rather than a
 * workaround Hearth invents by writing somewhere itself.
 */
export type OperonCreateAs = "inline" | "file";

/** What the "+" on a card can set on a new task. Everything but the text is
 * optional: the quick-add is meant to be one line and Enter. */
export interface OperonNewTask {
	description: string;
	/** The column it was added to, when it was added to a board. */
	statusId?: string;
	priorityId?: string;
	/** ISO day (YYYY-MM-DD). */
	due?: string;
	createAs?: OperonCreateAs;
}

/**
 * Where a new task would land, in the terms Operon's own settings use.
 *
 * Pure, and derived from the catalog Operon publishes — so when it refuses a
 * create, the card can name the setting responsible instead of repeating an
 * error code. "unknown" covers an older runtime that publishes no policies.
 */
export type OperonCreateTarget =
	| { kind: "daily" }
	| { kind: "file"; path: string }
	| { kind: "active" }
	| { kind: "ask" }
	| { kind: "note"; folder: string }
	| { kind: "unknown" };

export function createTarget(
	policies: OperonPolicies | null,
	createAs?: OperonCreateAs,
): OperonCreateTarget {
	const creation = policies?.creation;
	if (!creation) return { kind: "unknown" };
	// An explicit choice decides the representation; otherwise Operon's own
	// default does.
	const asFile = createAs === "file" || (createAs === undefined && creation.defaultToFileTask);
	if (asFile) return { kind: "note", folder: creation.fileTaskTargetFolder };
	switch (creation.inlineTaskSaveMode) {
		case "daily-notes":
			return { kind: "daily" };
		case "specific-file":
			return { kind: "file", path: creation.inlineTaskTargetFile };
		case "active-file":
			return { kind: "active" };
		default:
			// "ask-every-time" has no answer a dashboard card can give: there is
			// no prompt in the mutation contract to answer it with.
			return { kind: "ask" };
	}
}

/**
 * The preview intent for creating a task.
 *
 * `configured-default` is deliberate: where a new task lives, and whether it is
 * an inline checkbox or its own note, is a decision the user already made in
 * Operon's settings. A dashboard card that overrode it would put tasks
 * somewhere Operon's own quick-add would not.
 */
export function createIntent(input: OperonNewTask): DeveloperMutationPreviewInputV1 {
	const item: CreateTaskItemV1 = {
		itemRef: "hearth-1",
		description: input.description,
		// Still `configured-default` in every case: the card may pick which of
		// Operon's two configured targets to use, never a path of its own.
		target: input.createAs
			? { representation: input.createAs, mode: "configured-default" }
			: { mode: "configured-default" },
		fields: input.due ? [{ kind: "date", field: "dateDue", value: input.due }] : [],
	};
	if (input.statusId) item.statusId = input.statusId;
	if (input.priorityId) item.priorityId = input.priorityId;
	return {
		capability: "tasks.create.preview",
		mutationKind: "task.create",
		spec: { operation: "create", items: [item] },
	};
}

/** Whether a plan may be applied without asking the user first. */
export function needsConfirmation(plan: DeveloperMutationPlanHandleV1): boolean {
	return plan.requiresConsent || !SILENT_RISK.includes(plan.riskLevel);
}

/**
 * Read an execution result as the four outcomes a consumer may act on.
 *
 * Split out from the call path because this is the part that must not drift:
 * treating `outcome-unknown` as a failure invites a retry, and a retried
 * mutation is a doubled one.
 */
export function classifyExecution(
	result: Pick<DeveloperMutationExecutionResultV1, "status">,
): OperonWriteOutcome {
	switch (result.status) {
		case "applied":
			return "applied";
		case "already-applied":
			return "already-applied";
		case "failed":
			return "failed";
		default:
			// "partial" and "outcome-unknown": the write may have landed.
			return "unknown";
	}
}

function reasonOf(error: StructuredErrorV1 | undefined, fallback: string): string {
	if (!error) return fallback;
	return error.reason || error.code || fallback;
}

/** How a card asks the user to confirm a plan Operon flagged. Returning false
 * abandons the write; the plan simply expires. */
export type OperonConfirm = (plan: DeveloperMutationPlanHandleV1) => Promise<boolean>;

/**
 * preview → (confirm) → apply → (recover once).
 *
 * The single place a write happens, so the sequence is written once and every
 * caller gets the recovery rule for free.
 */
async function runMutation(
	session: OperonSession,
	intent: DeveloperMutationPreviewInputV1,
	confirm: OperonConfirm | undefined,
): Promise<OperonWriteResult> {
	const access = session.access();
	if (!canWrite(access) || !access.api) {
		return { ok: false, outcome: "failed", reason: access.state };
	}
	const api = access.api;

	let preview;
	try {
		preview = await api.mutations.preview(intent);
	} catch (err) {
		return { ok: false, outcome: "failed", reason: String(err) };
	}
	if (!preview?.ok) {
		return { ok: false, outcome: "failed", reason: reasonOf(preview?.error, "preview failed") };
	}
	const plan = preview.plan;

	if (confirm && needsConfirmation(plan)) {
		const agreed = await confirm(plan);
		// An unapplied plan needs no cleanup: it expires on its own, and there
		// is no cancel call in the contract to make.
		if (!agreed) return { ok: false, outcome: "failed", cancelled: true, reason: "cancelled" };
	}

	let execution;
	try {
		execution = await api.mutations.apply({ plan });
	} catch (err) {
		// A throwing apply is the worst case: the write may have been dispatched
		// before the throw, so this is "unknown", never "failed".
		return { ok: false, outcome: "unknown", reason: String(err) };
	}

	let outcome = classifyExecution(execution);
	if (outcome === "unknown") {
		// The one legal follow-up: resolve the *same* plan. Never a new preview,
		// and never more than once — a second unknown is a state only Operon can
		// settle, and the card says so rather than writing again.
		try {
			execution = await api.mutations.recover({ plan });
			outcome = classifyExecution(execution);
		} catch (err) {
			return { ok: false, outcome: "unknown", reason: String(err) };
		}
	}

	if (outcome === "applied" || outcome === "already-applied") return { ok: true, outcome };
	return {
		ok: false,
		outcome,
		reason: reasonOf(execution.error, outcome === "unknown" ? "outcome unknown" : "apply failed"),
	};
}

/** Move a task to another status — what a drop on a board column means. */
export function transitionTask(
	session: OperonSession,
	task: OperonTask,
	targetStatusId: string,
	confirm?: OperonConfirm,
): Promise<OperonWriteResult> {
	if (!isMutable(task)) {
		return Promise.resolve({ ok: false, outcome: "failed", reason: "mutation-not-allowed" });
	}
	if (task.workflow?.status.id === targetStatusId) {
		// Dropping a task back where it came from is not a write.
		return Promise.resolve({ ok: true, outcome: "already-applied" });
	}
	return runMutation(session, transitionIntent(task, targetStatusId), confirm);
}

/** Create a task through Operon, in whatever place and shape its own settings
 * prescribe. */
export function createTask(
	session: OperonSession,
	input: OperonNewTask,
	confirm?: OperonConfirm,
): Promise<OperonWriteResult> {
	const description = input.description.trim();
	if (!description) {
		return Promise.resolve({ ok: false, outcome: "failed", reason: "empty-description" });
	}
	return runMutation(session, createIntent({ ...input, description }), confirm);
}
