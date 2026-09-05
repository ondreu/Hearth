/**
 * "Something of mine is readable in this picture" — the bug report that says so.
 *
 * The publish dialog blanks a board's contents before it photographs it (see
 * `snapshot.ts`) and then shows the author the result, because a promise about
 * what a redacted screenshot contains is worth much less than the screenshot.
 * That check only means something if there is somewhere to go when it fails:
 * a card whose contents survived the blanking is a hole in the redaction, and
 * a hole in the redaction is a bug that will publish somebody else's notes
 * next week if nobody hears about it.
 *
 * So the dialog offers this alongside the picture: don't publish, and file it.
 * Pure string building, like `src/cardrequest.ts`, so the URL — and its field
 * ids staying in step with `.github/ISSUE_TEMPLATE/bug_report.yml` — can be
 * tested without touching Obsidian.
 *
 * The prompt text is deliberately **not** localized, for the same reason the
 * card request isn't: it is the body of a message to the maintainer, who reads
 * English, and a half-translated report is harder to act on than an English
 * one. The dialog's own labels around the link are localized as usual.
 */

/** GitHub's issue-form endpoint, and the form this report opens. */
const GITHUB_NEW_ISSUE_URL = "https://github.com/ondreu/hearth/issues/new";
const BUG_REPORT_FORM = "bug_report.yml";

/** What the report stamps in so the maintainer doesn't have to ask "which
 * version, on what?" first. Same shape as a card request's context. */
export interface RedactionReportContext {
	/** The running Hearth version, from the plugin manifest. */
	hearthVersion: string;
	/** Obsidian's `apiVersion`. */
	obsidianVersion: string;
	/** "Desktop" / "Mobile". A snapshot is a desktop thing today, but the field
	 * costs nothing and a mobile build that grows one will want it. */
	platform: string;
}

/** The issue title. Prefixed to match the bug form's own `title:` default, so
 * these arrive named like every other bug. */
export const REDACTION_REPORT_TITLE = "[Bug]: Snapshot redaction left something readable";

/** The "What happened?" prompt (form field `what-happened`). */
const WHAT_HAPPENED = [
	"Publishing a dashboard to the gallery. The picture Hearth took of the board",
	"still shows something of mine that should have been blanked out.",
	"",
	"Which card was it (the card's kind, and its title if it has one):",
	"",
	"What was readable in it (describe it — please don't paste the private part):",
	"",
].join("\n");

/** The "Steps to reproduce" prompt (form field `repro`). */
const REPRO = [
	"What the card was showing when the picture was taken (a note, a query, a",
	"web page, an embedded view…):",
	"",
	"Anything unusual about it — a plugin-backed card, a card mid-load, a card",
	"scrolled part-way:",
	"",
].join("\n");

/**
 * A pre-filled GitHub bug report about a snapshot that leaked.
 *
 * GitHub's issue *forms* accept a query parameter per field id, so
 * `what-happened`, `repro` and the two version inputs land in the right boxes
 * of `bug_report.yml`. Renaming a field there without renaming it here
 * silently drops that box's prefill — the unit test pins the ids that must
 * match. `platform` is a dropdown and is left for the reporter: the values it
 * accepts are its own option labels, and guessing one wrong drops the prefill
 * for that box anyway.
 */
export function redactionReportGithubUrl(ctx: RedactionReportContext): string {
	const params = new URLSearchParams({
		template: BUG_REPORT_FORM,
		labels: "bug",
		title: REDACTION_REPORT_TITLE,
		"what-happened": `${WHAT_HAPPENED}\n${ctx.platform}`,
		repro: REPRO,
		"hearth-version": ctx.hearthVersion,
		"obsidian-version": ctx.obsidianVersion,
	});
	return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`;
}
