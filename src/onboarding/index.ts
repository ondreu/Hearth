/**
 * First-run setup: the wizard that builds a new user's first dashboard.
 *
 * Three modules, split by what they need:
 *
 *  - `detect.ts` — what this vault already has (plugins, a TaskNotes
 *    configuration, a Kanban board, a base). Probes the app; the interesting
 *    reductions are pure.
 *  - `plan.ts` — what the answers mean: which cards, configured how, laid out
 *    where, and which settings change. Entirely pure, and tested.
 *  - `wizard.ts` — the asking. Obsidian UI only.
 *
 * Import from here rather than reaching into the modules directly.
 */
export { detectSetup, taskNotesImport } from "./detect";
export type {
	DetectedIntegration,
	SetupDetection,
	SetupIntegrationId,
	TaskNotesImport,
} from "./detect";
export {
	applySetup,
	boardRows,
	defaultAnswers,
	isUntouchedStarterBoard,
	planCards,
	PURPOSE_ICONS,
	SETUP_BACKGROUNDS,
	SETUP_PURPOSES,
	SETUP_SURFACES,
	SURFACE_PRESETS,
} from "./plan";
export type {
	PlannedCard,
	SetupAnswers,
	SetupBackground,
	SetupOutcome,
	SetupPurpose,
	SetupSurface,
	SetupTarget,
} from "./plan";
export { maybeRunSetup, openSetupWizard, SetupWizardModal } from "./wizard";
export type { SetupWizardOptions } from "./wizard";
