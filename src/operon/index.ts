/**
 * Operon integration — Hearth's client for the Operon plugin's in-process
 * Developer API V1.
 *
 * The split:
 *
 * - `api.ts`      accessor probe, session lifecycle, access-state rules
 * - `reads.ts`    never-throwing wrappers over the reads Hearth uses
 * - `mutations.ts` the preview → apply → recover flow behind the two writes
 * - `catalog.ts`  short-lived cache of Operon's taxonomy
 * - `map.ts`      pure shaping (due buckets, day groups, board columns, sort)
 * - `open.ts`     opening a task's note at its locator
 * - `types.ts`    Hearth-local names for the V1 read DTOs
 *
 * Cards import from here and never reach into Operon directly, so a contract
 * change upstream lands in one directory. Nothing in Hearth parses Operon's
 * markdown or reimplements its rules — the API is the only seam.
 */

export {
	OPERON_ALL_CAPABILITIES,
	OPERON_MIN_APP_VERSION,
	OPERON_PLUGIN_ID,
	OPERON_READ_CAPABILITIES,
	OPERON_WRITE_CAPABILITIES,
	OperonSession,
	accessErrorOf,
	classifyAccess,
	getOperonAccessor,
	isOperonAvailable,
	isOperonPlatformSupported,
	isTransientAccessState,
	missingCapabilities,
	operonCapabilities,
	retryDelayMs,
	writesGranted,
	type OperonAccess,
	type OperonAccessError,
	type OperonAccessState,
} from "./api";

export {
	findTasks,
	queryTasks,
	readTaxonomy,
	readTimer,
	shouldRenegotiate,
	type OperonFreshness,
	type OperonReadFailure,
	type OperonResult,
	type OperonTaskPage,
} from "./reads";

export {
	canWrite,
	classifyExecution,
	createIntent,
	createTask,
	isMutable,
	needsConfirmation,
	targetOf,
	transitionIntent,
	transitionTask,
	type OperonConfirm,
	type OperonNewTask,
	type OperonWriteOutcome,
	type OperonWriteResult,
} from "./mutations";

export { cachedTaxonomy, forgetTaxonomy, loadTaxonomy, warmTaxonomy } from "./catalog";

export {
	addDays,
	boardColumns,
	dayKey,
	dueRange,
	dueState,
	findPriority,
	findStatus,
	formatElapsed,
	groupByDay,
	isClosed,
	sortTasks,
	taskDay,
	type OperonDayGroup,
	type OperonDueState,
	type OperonSortKey,
} from "./map";

export { openOperonTask } from "./open";

export type {
	OperonPipeline,
	OperonPriority,
	OperonStatus,
	OperonTask,
	OperonTaxonomy,
	OperonTimerState,
} from "./types";
