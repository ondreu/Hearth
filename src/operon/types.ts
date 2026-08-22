import type {
	CatalogPoliciesV1,
	CatalogPipelineV1,
	CatalogPriorityV1,
	CatalogStatusV1,
	CatalogTaxonomyV1,
	DeepReadonlyV1,
	TaskContextV1,
	TimerStateV1,
} from "@stratejya/operon-cli/contracts/v1";

/**
 * Hearth-local names for the Operon V1 read DTOs it renders.
 *
 * Operon hands out immutable snapshots (`DeepReadonlyV1`) and exports that
 * helper precisely so consumers can keep the boundary in their own types.
 * Aliasing them here means the rest of Hearth writes `OperonTask` rather than
 * `DeepReadonlyV1<TaskContextV1>`, and there is exactly one place to look when
 * a contract shape moves upstream.
 */

/** One task as Operon reports it — inline or file, with its dates, workflow,
 * priority, recurrence, tracker and locator. */
export type OperonTask = DeepReadonlyV1<TaskContextV1>;

/** Operon's taxonomy: the pipelines, their statuses, and the priority scale. */
export type OperonTaxonomy = DeepReadonlyV1<CatalogTaxonomyV1>;

/** Operon's own rules — most usefully `creation`, which says where a new task
 * goes: inline into the daily note, into one specific file, into the active
 * file, or as its own note. Hearth never applies these itself (Operon does);
 * it reads them so a refusal can name the setting behind it. */
export type OperonPolicies = DeepReadonlyV1<CatalogPoliciesV1>;

/** One catalog snapshot: what things are called, and how Operon behaves. */
export interface OperonCatalog {
	taxonomy: OperonTaxonomy;
	policies: OperonPolicies | null;
}

export type OperonPipeline = DeepReadonlyV1<CatalogPipelineV1>;

/** A status within a pipeline: label, order, color, icon, and the flags that
 * say whether it finishes or cancels the task. */
export type OperonStatus = DeepReadonlyV1<CatalogStatusV1>;

export type OperonPriority = DeepReadonlyV1<CatalogPriorityV1>;

/** The running timer, plus any start/stop still in flight. */
export type OperonTimerState = DeepReadonlyV1<TimerStateV1>;
