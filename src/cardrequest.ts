/**
 * "Request a card" — the two links at the bottom of the add-card picker.
 *
 * The card catalogue is large but finite, and the picker is exactly where
 * someone notices the card they wanted isn't there. Rather than leave them to
 * find the repository on their own, the picker offers a pre-filled GitHub
 * feature request and a pre-filled email, both built here.
 *
 * Pure string building, so the URLs (and their prompts staying in step with
 * `.github/ISSUE_TEMPLATE/feature_request.yml`) are unit-testable — no Obsidian
 * API is touched.
 *
 * The prompt text is deliberately **not** localized: it is the body of a
 * message addressed to the maintainer, who reads English, and a half-translated
 * issue is harder to act on than an English one. The picker's own labels around
 * these links are localized as usual.
 */

/** Where an emailed card request goes. */
export const CARD_REQUEST_EMAIL = "ondrej.uhnavy@proton.me";

/** GitHub's issue-form endpoint, and the form the request opens. */
const GITHUB_NEW_ISSUE_URL = "https://github.com/ondreu/hearth/issues/new";
const FEATURE_REQUEST_FORM = "feature_request.yml";

/** Everything the templates stamp into a request so the maintainer doesn't have
 * to ask "which version, on what?" first. */
export interface CardRequestContext {
	/** The running Hearth version, from the plugin manifest. */
	hearthVersion: string;
	/** Obsidian's `apiVersion`. */
	obsidianVersion: string;
	/** "Desktop" / "Mobile" — enough to tell whether a card idea is even
	 * feasible where it would be used. */
	platform: string;
}

/** The issue/email title. Prefixed to match the feature-request form's own
 * `title:` default, so the two paths produce consistently named requests. */
export const CARD_REQUEST_TITLE = "[Feature]: New card: ";

/** The "What problem would this solve?" prompt (form field `problem`). */
const PROBLEM_PROMPT = [
	"What I want on my dashboard that no current card gives me:",
	"",
	"",
	"How I get at this information today (another plugin, a note, outside Obsidian):",
	"",
].join("\n");

/** The "Your idea" prompt (form field `idea`). */
const IDEA_PROMPT = [
	"Card name:",
	"",
	"What it shows:",
	"",
	"Where its data comes from (a plugin, a file, a web service…):",
	"",
	"What clicking things on it should do:",
	"",
].join("\n");

/** The environment footer both templates end with. */
function environmentLines(ctx: CardRequestContext): string {
	return [
		`Hearth ${ctx.hearthVersion}`,
		`Obsidian ${ctx.obsidianVersion}`,
		ctx.platform,
	].join(" · ");
}

/**
 * A pre-filled GitHub feature request.
 *
 * GitHub's issue *forms* accept a query parameter per field id, so `problem`
 * and `idea` land in the right boxes of `feature_request.yml`. Renaming a field
 * there without renaming it here silently drops that box's prefill — the unit
 * test pins the ids that must match.
 */
export function cardRequestGithubUrl(ctx: CardRequestContext): string {
	const params = new URLSearchParams({
		template: FEATURE_REQUEST_FORM,
		labels: "enhancement",
		title: CARD_REQUEST_TITLE,
		problem: PROBLEM_PROMPT,
		idea: `${IDEA_PROMPT}\n\n${environmentLines(ctx)}`,
	});
	return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`;
}

/**
 * A pre-filled email to the maintainer, for people who would rather not have
 * (or sign in to) a GitHub account.
 *
 * `encodeURIComponent` rather than `URLSearchParams`: mail clients want `%20`
 * in a mailto body, and `URLSearchParams` would write `+`, which several
 * clients paste through literally.
 */
export function cardRequestMailtoUrl(ctx: CardRequestContext): string {
	const body = [
		"Hi Ondrej,",
		"",
		"I'd like to suggest a new card for Hearth.",
		"",
		PROBLEM_PROMPT,
		"",
		IDEA_PROMPT,
		"",
		"---",
		environmentLines(ctx),
	].join("\n");
	const subject = encodeURIComponent(CARD_REQUEST_TITLE);
	return `mailto:${CARD_REQUEST_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
}
