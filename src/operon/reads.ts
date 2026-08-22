import type {
	ContractWarningV1,
	ErrorActionV1,
	FreshnessV1,
	TaskFinderScopeV1,
	TaskQueryFiltersV1,
	TaskQueryPageV1,
} from "@stratejya/operon-cli/contracts/v1";
import type { OperonAccess, OperonSession } from "./api";
import type { OperonCatalog, OperonTask, OperonTaxonomy, OperonTimerState } from "./types";

/**
 * Thin, never-throwing wrappers over the Operon reads Hearth uses.
 *
 * Two rules run through all of them:
 *
 * - Nothing rejects. Every call is wrapped, and an out-of-contract response is
 *   reported as a failure rather than thrown, so a card renders an explanation
 *   instead of taking the dashboard render down with it.
 * - Safety metadata survives. Operon's results carry freshness, warnings and
 *   truncation, and its docs are explicit that discarding them is how an
 *   integration ends up confidently drawing a stale or partial picture. The
 *   result type keeps them and the cards surface them.
 */

/** How current a read was, in the form the card header needs. */
export interface OperonFreshness {
	/** False when Operon reports its own view as settling or unverified. */
	verified: boolean;
	source: FreshnessV1["source"];
	observedAt: string;
}

export interface OperonReadFailure {
	/** Operon's structured error code, or "unknown" for an off-contract reply. */
	code: string;
	/** Operon's suggested next step, used to decide whether to renegotiate. */
	action: ErrorActionV1;
	reason: string;
}

export type OperonResult<T> =
	| { ok: true; value: T; freshness: OperonFreshness; warnings: readonly ContractWarningV1[] }
	| { ok: false; error: OperonReadFailure };

/** A bounded set of tasks plus what Operon had to leave out. */
export interface OperonTaskPage {
	tasks: readonly OperonTask[];
	/** What Operon matched, versus what it returned. */
	page: TaskQueryPageV1;
}

/**
 * Consistency for dashboard reads. Cards redraw on every vault change, so
 * source-verifying each one would re-read files on every keystroke in an open
 * note; "best-effort" serves the index and reports its own coherence, which is
 * what the staleness indicator shows.
 */
const DASHBOARD_CONSISTENCY = "best-effort" as const;

const CONTRACT_VERSION = 1 as const;

/** Correlation id for one read. Not an authority or idempotency claim — Operon
 * owns those — just something to tie a request to its result, so the fallback
 * for a context without randomUUID only has to be unique, not unguessable. */
function requestId(): string {
	const uuid = activeWindow.crypto?.randomUUID?.();
	if (uuid) return uuid;
	return `hearth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function freshnessOf(freshness: FreshnessV1 | undefined): OperonFreshness {
	return {
		verified: freshness?.coherence === "verified",
		source: freshness?.source ?? "persisted-index",
		observedAt: freshness?.observedAt ?? "",
	};
}

/** Narrow a structured error to the three fields Hearth acts on. Typed
 * structurally rather than as the DTO so an immutable snapshot passes without a
 * cast, and so a field added upstream never breaks this call site. */
function failure(
	error: { code: string; reason: string; action: ErrorActionV1 } | undefined,
	fallbackReason: string,
): OperonReadFailure {
	if (!error) return { code: "unknown", action: "report-bug", reason: fallbackReason };
	return { code: error.code, action: error.action, reason: error.reason };
}

/**
 * Whether a failure means "the session you hold is no longer the right one".
 * Operon's error actions are the contract for this; anything else is a result
 * to report, not a reason to retry — its docs are explicit that a failure is
 * not an invitation to reissue.
 */
export function shouldRenegotiate(error: OperonReadFailure): boolean {
	return error.action === "rediscover" || error.action === "request-authority";
}

/** Run one read against a live session, renegotiating once if Operon says the
 * session is stale. Anything else is returned as-is. */
async function withApi<T>(
	session: OperonSession,
	run: (access: OperonAccess) => Promise<OperonResult<T>>,
): Promise<OperonResult<T>> {
	const access = session.access();
	if (!access.api) {
		return {
			ok: false,
			error: {
				code: "capability-unavailable",
				action: "request-authority",
				reason: access.state,
			},
		};
	}
	const first = await run(access);
	if (first.ok || !shouldRenegotiate(first.error)) return first;

	session.invalidate();
	const retry = session.access();
	if (!retry.api) return first;
	return run(retry);
}

/** Guard against an off-contract reply (a plugin build that returns something
 * other than the V1 result shape) before touching its fields. */
function isResult(value: unknown): value is { ok: boolean } {
	return typeof value === "object" && value !== null && "ok" in value;
}

/** Tasks matching a filter set. */
export function queryTasks(
	session: OperonSession,
	filters: TaskQueryFiltersV1,
	limit: number,
): Promise<OperonResult<OperonTaskPage>> {
	return withApi(session, async (access) => {
		const api = access.api;
		if (!api) return { ok: false, error: failure(undefined, "no session") };
		try {
			const result = await api.tasks.query({
				contractVersion: CONTRACT_VERSION,
				requestId: requestId(),
				consistency: DASHBOARD_CONSISTENCY,
				kind: "task-query",
				filters,
				limit,
			});
			if (!isResult(result)) {
				return { ok: false, error: failure(undefined, "task-query returned no result") };
			}
			if (!result.ok) return { ok: false, error: failure(result.error, "task-query failed") };
			return {
				ok: true,
				value: { tasks: result.tasks, page: result.page },
				freshness: freshnessOf(result.freshness),
				warnings: result.warnings ?? [],
			};
		} catch (err) {
			return { ok: false, error: failure(undefined, String(err)) };
		}
	});
}

/**
 * Operon's own scoped views ("overdue", "happens-today", ...). Preferred over a
 * hand-rolled date filter because what counts as happening today — across due,
 * scheduled and recurrence — is Operon's definition to make, not Hearth's.
 */
export function findTasks(
	session: OperonSession,
	scope: TaskFinderScopeV1,
	limit: number,
	filters?: Omit<TaskQueryFiltersV1, "text" | "parentOperonId" | "filePath">,
): Promise<OperonResult<OperonTaskPage>> {
	return withApi(session, async (access) => {
		const api = access.api;
		if (!api) return { ok: false, error: failure(undefined, "no session") };
		try {
			const result = await api.tasks.find({
				contractVersion: CONTRACT_VERSION,
				requestId: requestId(),
				consistency: DASHBOARD_CONSISTENCY,
				kind: "task-finder",
				scope,
				filters,
				limit,
			});
			if (!isResult(result)) {
				return { ok: false, error: failure(undefined, "task-finder returned no result") };
			}
			if (!result.ok) return { ok: false, error: failure(result.error, "task-finder failed") };
			// The finder returns scored rows of tasks and of projects; a
			// dashboard list wants the tasks, in the order Operon ranked them.
			const tasks: OperonTask[] = [];
			for (const row of result.rows) {
				if (row.kind === "task") tasks.push(row.task);
			}
			return {
				ok: true,
				value: { tasks, page: result.page },
				freshness: freshnessOf(result.freshness),
				warnings: result.warnings ?? [],
			};
		} catch (err) {
			return { ok: false, error: failure(undefined, String(err)) };
		}
	});
}

/**
 * One catalog snapshot: Operon's taxonomy *and* its policies.
 *
 * Both arrive in the same read, and the policies are worth keeping. They carry
 * `creation`, which decides where a new task lands — the setting behind
 * "Configured Daily Note target is unavailable or invalid" and the other
 * create-time refusals, which are otherwise impossible to explain from an
 * error code alone.
 */
export function readCatalog(session: OperonSession): Promise<OperonResult<OperonCatalog>> {
	return withApi(session, async (access) => {
		const api = access.api;
		if (!api) return { ok: false, error: failure(undefined, "no session") };
		try {
			const result = await api.catalog.snapshot({
				contractVersion: CONTRACT_VERSION,
				requestId: requestId(),
				consistency: DASHBOARD_CONSISTENCY,
				kind: "catalog",
			});
			if (!isResult(result)) {
				return { ok: false, error: failure(undefined, "catalog returned no result") };
			}
			if (!result.ok) return { ok: false, error: failure(result.error, "catalog failed") };
			return {
				ok: true,
				// Policies are optional in the DTO so a V1 client can still read
				// a catalog from an older runtime; a card degrades to "no hint"
				// rather than to no taxonomy.
				value: { taxonomy: result.taxonomy, policies: result.policies ?? null },
				freshness: freshnessOf(result.freshness),
				warnings: result.warnings ?? [],
			};
		} catch (err) {
			return { ok: false, error: failure(undefined, String(err)) };
		}
	});
}

/** The running timer, if any, plus whether one is starting or stopping. */
export function readTimer(session: OperonSession): Promise<OperonResult<OperonTimerState>> {
	return withApi(session, async (access) => {
		const api = access.api;
		if (!api) return { ok: false, error: failure(undefined, "no session") };
		try {
			const result = await api.timers.read({
				contractVersion: CONTRACT_VERSION,
				requestId: requestId(),
				consistency: DASHBOARD_CONSISTENCY,
				kind: "timer-read",
			});
			if (!isResult(result)) {
				return { ok: false, error: failure(undefined, "timer-read returned no result") };
			}
			if (!result.ok) return { ok: false, error: failure(result.error, "timer-read failed") };
			return {
				ok: true,
				value: result.state,
				freshness: freshnessOf(result.freshness),
				warnings: result.warnings ?? [],
			};
		} catch (err) {
			return { ok: false, error: failure(undefined, String(err)) };
		}
	});
}
