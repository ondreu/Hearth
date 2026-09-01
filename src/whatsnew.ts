import { App, Component, MarkdownRenderer, Modal, setIcon, Setting } from "obsidian";
import changelogMarkdown from "../CHANGELOG.md";
import {
	isNewer,
	parseChangelog,
	type ChangeKind,
	type ChangelogEntry,
	type ChangelogItem,
} from "./changelog";
import { t } from "./i18n";
import { kofiTipButton } from "./kofi";
import { makeClickable } from "./ui";
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

/** The Lucide glyph for each kind of change. */
const KIND_ICONS: Record<ChangeKind, string> = {
	added: "sparkles",
	changed: "refresh-cw",
	fixed: "wrench",
	removed: "minus-circle",
	deprecated: "archive",
	security: "shield",
	other: "info",
};

const ISSUE_URL = "https://github.com/ondreu/hearth/issues/";

/** Above this many headlines the dialog offers a filter box — below it, there
 * is nothing to hunt through. */
const FILTER_THRESHOLD = 12;
/** Above this many headlines the expand/collapse-all control is worth its row. */
const TOOLBAR_THRESHOLD = 3;

/** One headline row and the detail panel it opens. */
interface ItemView {
	/** The whole row: summary plus (once opened) its details. */
	el: HTMLElement;
	/** The detail panel. Empty until the row is first opened. */
	detailEl: HTMLElement;
	/** The chevron, rotated by CSS when open. */
	chevronEl: HTMLElement;
	item: ChangelogItem;
	/** Headline and details, lower-cased once, for the filter to match on. */
	haystack: string;
	rendered: boolean;
	expanded: boolean;
}

/** One release: its header, the sections below it, and every row in them. */
interface ReleaseView {
	el: HTMLElement;
	bodyEl: HTMLElement;
	items: ItemView[];
	collapsed: boolean;
}

/**
 * The "What's new" dialog: the relevant slice of `CHANGELOG.md`, one release
 * per section, newest first.
 *
 * `CHANGELOG.md` is written as a bold headline sentence per change followed by
 * the paragraphs explaining it, so rendering a release as one block of Markdown
 * gives several screens of prose to read before knowing whether any of it
 * matters. The dialog therefore renders the *headlines* as a list — grouped
 * under their Added/Changed/Fixed heading, with the issue they close beside
 * them — and folds each explanation away until the row is clicked. Nothing is
 * summarised or rewritten: every word still comes from the file, one click
 * further in. Purely informational.
 */
export class WhatsNewModal extends Modal {
	private readonly entries: ChangelogEntry[];
	private readonly renderComponent = new Component();
	private readonly releases: ReleaseView[] = [];
	/** Set when every row is open, so the toolbar button can say which way it
	 * now goes. */
	private allExpanded = false;
	private expandAllEl?: HTMLElement;
	private emptyEl?: HTMLElement;

	constructor(app: App, entries: ChangelogEntry[]) {
		super(app);
		this.entries = entries;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hearth-whatsnew-modal");
		this.titleEl.setText(t().whatsNew.title);
		this.renderComponent.load();

		const total = this.entries.reduce(
			(n, e) => n + e.sections.reduce((m, s) => m + s.items.length, 0),
			0,
		);

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-intro",
			text: total > 0 ? t().whatsNew.introHint : t().whatsNew.intro,
		});

		if (total > TOOLBAR_THRESHOLD) this.renderToolbar(contentEl, total > FILTER_THRESHOLD);

		// Only this scrolls, so the intro and the toolbar stay put and the close
		// button below stays reachable no matter how long the log is.
		const body = contentEl.createDiv({ cls: "hearth-whatsnew-body" });
		// Only the newest release starts open: with a whole log on screen, the
		// rest are one line each until asked for.
		this.entries.forEach((entry, i) => this.renderEntry(body, entry, i > 0));

		this.emptyEl = body.createEl("p", { cls: "hearth-whatsnew-empty" });
		this.emptyEl.hide();

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-footer",
			text: t().whatsNew.footer,
		});

		// The tip button sits to the *left* of the close button: a release the
		// reader just found worth reading is the one moment asking is fair, and
		// left of the CTA keeps it out of the path of the click that dismisses
		// the dialog.
		new Setting(contentEl)
			.addButton((b) => kofiTipButton(b))
			.addButton((b) =>
				b
					.setButtonText(t().whatsNew.close)
					.setCta()
					.onClick(() => this.close()),
			);
	}

	/** The filter box and the expand/collapse-all control. */
	private renderToolbar(parent: HTMLElement, withFilter: boolean): void {
		const bar = parent.createDiv({ cls: "hearth-whatsnew-toolbar" });

		if (withFilter) {
			const search = bar.createDiv({ cls: "hearth-whatsnew-search" });
			setIcon(search.createSpan({ cls: "hearth-whatsnew-search-icon" }), "search");
			const input = search.createEl("input", {
				cls: "hearth-whatsnew-filter",
				type: "search",
				attr: {
					placeholder: t().whatsNew.filterPlaceholder,
					"aria-label": t().whatsNew.filterPlaceholder,
				},
			});
			input.addEventListener("input", () => this.applyFilter(input.value));
		}

		const toggle = bar.createDiv({ cls: "hearth-whatsnew-expand-all" });
		this.expandAllEl = toggle;
		toggle.setText(t().whatsNew.expandAll);
		const flip = () => {
			this.setAllExpanded(!this.allExpanded);
			toggle.setText(this.allExpanded ? t().whatsNew.collapseAll : t().whatsNew.expandAll);
		};
		makeClickable(toggle, flip);
		toggle.addEventListener("click", flip);
	}

	/** One release: a header carrying the version, its date and a count per kind
	 * of change, then the sections themselves. */
	private renderEntry(parent: HTMLElement, entry: ChangelogEntry, collapsed: boolean): void {
		const section = parent.createDiv({ cls: "hearth-whatsnew-release" });
		const view: ReleaseView = {
			el: section,
			bodyEl: section.createDiv({ cls: "hearth-whatsnew-release-body" }),
			items: [],
			collapsed: false,
		};
		this.releases.push(view);

		// The header is built after the body element so it can be moved above it,
		// keeping the DOM order readable while the closure below has both.
		const header = section.createDiv({ cls: "hearth-whatsnew-release-header" });
		section.insertBefore(header, view.bodyEl);

		const chevron = header.createSpan({ cls: "hearth-whatsnew-release-chevron" });
		setIcon(chevron, "chevron-down");

		const version = header.createEl("h2", { cls: "hearth-whatsnew-version" });
		if (entry.url) {
			const link = version.createEl("a", {
				text: entry.version,
				href: entry.url,
				cls: "hearth-whatsnew-version-link",
				attr: { rel: "noopener", "aria-label": t().whatsNew.releaseNotes(entry.version) },
			});
			// The link is inside the header, which toggles — don't do both.
			link.addEventListener("click", (e) => e.stopPropagation());
		} else {
			version.setText(entry.version);
		}

		if (entry.date) {
			header.createSpan({ cls: "hearth-whatsnew-date", text: entry.date });
		}

		// A count per kind, so a release says what it holds while still folded.
		const counts = header.createDiv({ cls: "hearth-whatsnew-counts" });
		for (const s of entry.sections) {
			if (s.items.length === 0) continue;
			const pill = counts.createSpan({ cls: `hearth-whatsnew-count is-${s.kind}` });
			pill.createSpan({ cls: "hearth-whatsnew-count-dot" });
			pill.createSpan({ text: `${s.items.length} ${this.kindLabel(s.kind, s.label)}` });
		}

		for (const s of entry.sections) {
			const group = view.bodyEl.createDiv({ cls: `hearth-whatsnew-group is-${s.kind}` });
			const label = group.createDiv({ cls: "hearth-whatsnew-group-label" });
			setIcon(label.createSpan({ cls: "hearth-whatsnew-group-icon" }), KIND_ICONS[s.kind]);
			label.createSpan({ text: this.kindLabel(s.kind, s.label) });

			if (s.prose) {
				const prose = group.createDiv({ cls: "hearth-whatsnew-prose" });
				void MarkdownRenderer.render(this.app, s.prose, prose, "", this.renderComponent);
			}

			const list = group.createDiv({ cls: "hearth-whatsnew-items" });
			for (const item of s.items) view.items.push(this.renderItem(list, item));
		}

		const toggle = () => this.setReleaseCollapsed(view, !view.collapsed);
		makeClickable(header, toggle, t().whatsNew.releaseToggle(entry.version));
		header.addEventListener("click", toggle);
		this.setReleaseCollapsed(view, collapsed);
	}

	/** One change: its headline, always visible, and the detail panel it opens. */
	private renderItem(parent: HTMLElement, item: ChangelogItem): ItemView {
		const el = parent.createDiv({ cls: "hearth-whatsnew-item" });
		const summary = el.createDiv({ cls: "hearth-whatsnew-item-summary" });

		const chevron = summary.createSpan({ cls: "hearth-whatsnew-item-chevron" });
		if (item.details) setIcon(chevron, "chevron-right");

		const headline = summary.createDiv({ cls: "hearth-whatsnew-headline" });
		// Rendered as Markdown so inline code and links in a headline survive;
		// CSS keeps the paragraph it comes wrapped in on one line.
		void MarkdownRenderer.render(this.app, item.headline, headline, "", this.renderComponent);

		if (item.issues.length > 0) {
			const refs = summary.createDiv({ cls: "hearth-whatsnew-issues" });
			for (const n of item.issues) {
				const link = refs.createEl("a", {
					cls: "hearth-whatsnew-issue",
					text: `#${n}`,
					href: `${ISSUE_URL}${n}`,
					attr: { rel: "noopener", "aria-label": t().whatsNew.issue(n) },
				});
				link.addEventListener("click", (e) => e.stopPropagation());
			}
		}

		const view: ItemView = {
			el,
			detailEl: el.createDiv({ cls: "hearth-whatsnew-detail" }),
			chevronEl: chevron,
			item,
			haystack: `${item.headline}\n${item.details}`.toLowerCase(),
			rendered: false,
			expanded: false,
		};
		view.detailEl.hide();

		if (item.details) {
			const toggle = () => this.setItemExpanded(view, !view.expanded);
			makeClickable(summary, toggle);
			summary.setAttribute("aria-expanded", "false");
			summary.addEventListener("click", toggle);
		} else {
			// Nothing to open: a plain row, not a dead button.
			summary.addClass("is-static");
		}

		return view;
	}

	/** Open or close one row, rendering its Markdown the first time it opens. */
	private setItemExpanded(view: ItemView, expanded: boolean): void {
		if (!view.item.details) return;
		view.expanded = expanded;
		view.el.toggleClass("is-expanded", expanded);
		view.el
			.querySelector(".hearth-whatsnew-item-summary")
			?.setAttribute("aria-expanded", String(expanded));
		setIcon(view.chevronEl, expanded ? "chevron-down" : "chevron-right");

		if (expanded && !view.rendered) {
			view.rendered = true;
			void MarkdownRenderer.render(
				this.app,
				view.item.details,
				view.detailEl,
				"",
				this.renderComponent,
			);
		}
		if (expanded) view.detailEl.show();
		else view.detailEl.hide();
	}

	private setReleaseCollapsed(view: ReleaseView, collapsed: boolean): void {
		view.collapsed = collapsed;
		view.el.toggleClass("is-collapsed", collapsed);
		view.el
			.querySelector(".hearth-whatsnew-release-header")
			?.setAttribute("aria-expanded", String(!collapsed));
		if (collapsed) view.bodyEl.hide();
		else view.bodyEl.show();
	}

	/** Open (or close) every row in one go. */
	private setAllExpanded(expanded: boolean): void {
		this.allExpanded = expanded;
		for (const release of this.releases) {
			if (expanded) this.setReleaseCollapsed(release, false);
			for (const item of release.items) this.setItemExpanded(item, expanded);
		}
	}

	/**
	 * Hide the rows that don't match `query`, along with any group or release
	 * left empty. Matching is a plain case-insensitive substring test over the
	 * headline *and* its details, so a term buried in an explanation still finds
	 * the change it belongs to. An empty query restores the view untouched —
	 * which rows were open is preserved throughout.
	 */
	private applyFilter(query: string): void {
		const q = query.trim().toLowerCase();
		let hits = 0;

		for (const release of this.releases) {
			let releaseHits = 0;
			for (const item of release.items) {
				const match = q === "" || item.haystack.includes(q);
				item.el.toggleClass("is-filtered-out", !match);
				if (match) releaseHits++;
			}
			hits += releaseHits;

			// A group whose every row is hidden loses its label too.
			for (const group of Array.from(
				release.bodyEl.querySelectorAll<HTMLElement>(".hearth-whatsnew-group"),
			)) {
				const visible = group.querySelectorAll(
					".hearth-whatsnew-item:not(.is-filtered-out)",
				).length;
				group.toggleClass("is-filtered-out", q !== "" && visible === 0);
			}

			release.el.toggleClass("is-filtered-out", q !== "" && releaseHits === 0);
			// While filtering, a release with matches is opened so they are
			// actually on screen; clearing the box leaves things as they are.
			if (q !== "" && releaseHits > 0) this.setReleaseCollapsed(release, false);
		}

		if (!this.emptyEl) return;
		if (q !== "" && hits === 0) {
			this.emptyEl.setText(t().whatsNew.noMatches(query.trim()));
			this.emptyEl.show();
		} else {
			this.emptyEl.hide();
		}
	}

	/** The display label for a section: our own wording for a known kind, the
	 * file's own heading for anything else. */
	private kindLabel(kind: ChangeKind, label: string): string {
		return kind === "other" ? label || t().whatsNew.kinds.other : t().whatsNew.kinds[kind];
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
