import { App, Component, MarkdownRenderer, Modal, Setting } from "obsidian";
import changelogMarkdown from "../CHANGELOG.md";
import { t } from "./i18n";
import type HearthPlugin from "./main";

/** One release section parsed out of `CHANGELOG.md`: its version and the raw
 * Markdown of that section (its `##` heading plus body). */
export interface ChangelogEntry {
	version: string;
	markdown: string;
}

/** A release heading like `## [1.8.0] - 2026-07-11`. The bracketed version is
 * captured, tolerating a stray quote (e.g. a malformed `## ["1.9.0]`). */
const HEADING_RE = /^##\s+\[["']?([^\]"']+?)["']?\]/;
/** A Markdown link-reference definition, e.g. `[1.8.0]: https://…`. These sit
 * in a block at the foot of the file and turn the version headings into links. */
const LINK_DEF_RE = /^\[[^\]]+\]:\s+\S/;

/**
 * Split the changelog Markdown into per-release entries (newest first, matching
 * the file's order) plus the trailing block of link-reference definitions. The
 * preamble above the first `##` heading is dropped; the link definitions are
 * pulled out so they can be re-appended after whichever entries are shown, so
 * each version heading still renders as a link.
 */
function parseChangelog(md: string): { entries: ChangelogEntry[]; linkDefs: string } {
	const entries: ChangelogEntry[] = [];
	const linkDefs: string[] = [];
	let current: { version: string; body: string[] } | null = null;

	const flush = () => {
		if (current) {
			entries.push({ version: current.version, markdown: current.body.join("\n").trim() });
		}
	};

	for (const line of md.split("\n")) {
		if (LINK_DEF_RE.test(line)) {
			linkDefs.push(line);
			continue;
		}
		const heading = HEADING_RE.exec(line);
		if (heading) {
			flush();
			current = { version: heading[1], body: [line] };
		} else if (current) {
			current.body.push(line);
		}
		// Lines before the first heading are the file preamble — ignored.
	}
	flush();

	return { entries, linkDefs: linkDefs.join("\n") };
}

const parsed = parseChangelog(changelogMarkdown);

/**
 * The changelog, **newest entry first**, parsed straight from `CHANGELOG.md` at
 * build time (it's bundled as text — see esbuild's `.md` loader). The "What's
 * new" dialog is thus a live mirror of that file: cut a release by editing
 * `CHANGELOG.md` and nothing here needs touching.
 */
export const CHANGELOG: ChangelogEntry[] = parsed.entries;

/** The link-reference definitions that back the version headings, re-appended
 * to whatever slice of entries the dialog renders. */
const LINK_DEFS = parsed.linkDefs;

/** The numeric release components of a version, ignoring any pre-release suffix
 * (`1.9.0-beta.1` → `[1, 9, 0]`), so beta and stable builds compare by release. */
function versionParts(v: string): number[] {
	return v
		.split("-")[0]
		.split(".")
		.map((n) => parseInt(n, 10) || 0);
}

/** Whether release `a` is strictly newer than release `b` (semver-style, by
 * numeric components; pre-release suffixes are ignored). */
function isNewer(a: string, b: string): boolean {
	const pa = versionParts(a);
	const pb = versionParts(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = pa[i] ?? 0;
		const y = pb[i] ?? 0;
		if (x !== y) return x > y;
	}
	return false;
}

/**
 * The entries strictly newer than {@link seen}, newest first. An empty or
 * unrecognised `seen` (a much older build, or none recorded) sorts below every
 * release, so the whole log is returned and nothing is silently withheld.
 */
export function entriesSince(seen: string): ChangelogEntry[] {
	return CHANGELOG.filter((e) => isNewer(e.version, seen));
}

/**
 * The "What's new" dialog: the relevant slice of `CHANGELOG.md` rendered as
 * Markdown (one section per release, newest first). Purely informational.
 */
export class WhatsNewModal extends Modal {
	private readonly entries: ChangelogEntry[];
	private readonly renderComponent = new Component();

	constructor(app: App, entries: ChangelogEntry[]) {
		super(app);
		this.entries = entries;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hearth-whatsnew-modal");
		this.titleEl.setText(t().whatsNew.title);

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-intro",
			text: t().whatsNew.intro,
		});

		const body = contentEl.createDiv({ cls: "hearth-whatsnew-body" });
		const sections = this.entries.map((e) => e.markdown).join("\n\n");
		const md = LINK_DEFS ? `${sections}\n\n${LINK_DEFS}` : sections;
		this.renderComponent.load();
		void MarkdownRenderer.render(this.app, md, body, "", this.renderComponent);

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-footer",
			text: t().whatsNew.footer,
		});

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText(t().whatsNew.close)
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onClose(): void {
		this.renderComponent.unload();
		this.contentEl.empty();
	}
}

/**
 * Show the "What's new" dialog once per version bump, listing only the entries
 * newer than the version the user last saw. A genuinely fresh install is seeded
 * silently so first-time users aren't greeted by a changelog. Any other version
 * change — including an existing vault upgrading into the first build that ships
 * this feature, where {@link HomeSettings.lastSeenVersion} is still empty — pops
 * the dialog and records the new version so it won't show again until the next
 * update.
 */
export async function maybeShowWhatsNew(plugin: HearthPlugin): Promise<void> {
	const current = plugin.manifest.version;
	const seen = plugin.settings.lastSeenVersion;

	if (seen === current) return;

	const entries = entriesSince(seen);
	plugin.settings.lastSeenVersion = current;
	await plugin.saveData(plugin.settings);

	// First-ever run: record the version but don't greet a brand-new user with a
	// changelog for a build they never ran the predecessor of.
	if (plugin.isFirstRun || entries.length === 0) return;
	new WhatsNewModal(plugin.app, entries).open();
}
