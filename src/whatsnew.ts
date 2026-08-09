import { App, Component, MarkdownRenderer, Modal, Setting } from "obsidian";
import changelogMarkdown from "../CHANGELOG.md";
import { isNewer, parseChangelog, type ChangelogEntry } from "./changelog";
import { t } from "./i18n";
import type HearthPlugin from "./main";

export type { ChangelogEntry };

/**
 * The changelog, **newest entry first**, parsed straight from `CHANGELOG.md` at
 * build time (it's bundled as text — see esbuild's `.md` loader). The "What's
 * new" dialog is thus a live mirror of that file: cut a release by editing
 * `CHANGELOG.md` and nothing here needs touching.
 */
export const CHANGELOG: ChangelogEntry[] = parseChangelog(changelogMarkdown);

/**
 * The entries strictly newer than {@link seen}, newest first. An empty or
 * unrecognised `seen` (a much older build, or none recorded) sorts below every
 * release, so the whole log is returned and nothing is silently withheld.
 */
export function entriesSince(seen: string): ChangelogEntry[] {
	return CHANGELOG.filter((e) => isNewer(e.version, seen));
}

/**
 * The "What's new" dialog: the relevant slice of `CHANGELOG.md`, one release
 * per section, newest first. The version heading is drawn as a header row
 * rather than left to Markdown, so the version, its date and its compare link
 * line up the same way for every release; only the section body is rendered as
 * Markdown. Purely informational.
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

		// Only this scrolls, so the intro stays put and the close button below
		// stays reachable no matter how long the log is.
		const body = contentEl.createDiv({ cls: "hearth-whatsnew-body" });
		this.renderComponent.load();
		for (const entry of this.entries) this.renderEntry(body, entry);

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

	/** One release: a version header, then the section body as Markdown. */
	private renderEntry(parent: HTMLElement, entry: ChangelogEntry): void {
		const section = parent.createDiv({ cls: "hearth-whatsnew-release" });
		const header = section.createDiv({ cls: "hearth-whatsnew-release-header" });

		const version = header.createEl("h2", { cls: "hearth-whatsnew-version" });
		if (entry.url) {
			version.createEl("a", {
				text: entry.version,
				href: entry.url,
				cls: "hearth-whatsnew-version-link",
				attr: { rel: "noopener" },
			});
		} else {
			version.setText(entry.version);
		}

		if (entry.date) {
			header.createSpan({ cls: "hearth-whatsnew-date", text: entry.date });
		}

		const bodyEl = section.createDiv({ cls: "hearth-whatsnew-release-body" });
		void MarkdownRenderer.render(this.app, entry.markdown, bodyEl, "", this.renderComponent);
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
