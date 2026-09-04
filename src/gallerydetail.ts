/**
 * One dashboard, in full — and the page for whoever made it.
 *
 * The browse grid answers "which of these", and this answers "is this the one".
 * That means the things you cannot see in a thumbnail: what is actually on the
 * board, what it needs installed that you may not have, how much of it is
 * fetched from the internet, how big the file is, and who — provably — made it.
 *
 * Installing does not have its own path. The package is downloaded and handed
 * to the same import dialog a file picked off disk goes to, which is what keeps
 * a downloaded board from getting a *weaker* check than one found in a forum
 * post: the signature is verified against the bytes as served, the missing
 * notes and plugins are named, and nothing global is touched. See
 * `src/gallery/install.ts`.
 */

import { Modal, Notice, setIcon } from "obsidian";
import type HearthPlugin from "./main";
import { t } from "./i18n";
import { confirmAction, makeClickable } from "./ui";
import { openImportPackage, vaultIdentity } from "./exportimport";
import {
	cardKindLabel,
	galleryDate,
	galleryErrorText,
	renderAuthor,
	renderEmpty,
	renderEntryCard,
	renderPreview,
} from "./galleryui";
import {
	fetchEntryPackage,
	type GalleryClient,
	type GalleryEntryDetail,
	type GalleryEntrySummary,
	type GalleryProfile,
	type VoteValue,
} from "./gallery";

/** What the browse modal wants to hear about. */
export interface EntryViewHooks {
	/** A vote landed, so the row behind this modal is out of date. */
	onChanged?: (entry: GalleryEntrySummary) => void;
	/** The board was installed and the import dialog has taken over. */
	onInstalled?: () => void;
	onOpenProfile?: (publicKey: string) => void;
}

/** Open one entry. Fetches the detail; the id is all the caller needs to have. */
export function openGalleryEntry(
	plugin: HearthPlugin,
	client: GalleryClient,
	id: string,
	hooks: EntryViewHooks = {},
): void {
	new GalleryEntryModal(plugin, client, id, hooks).open();
}

class GalleryEntryModal extends Modal {
	private plugin: HearthPlugin;
	private client: GalleryClient;
	private id: string;
	private hooks: EntryViewHooks;

	private entry: GalleryEntryDetail | null = null;
	private error: string | null = null;
	private busy = false;

	constructor(
		plugin: HearthPlugin,
		client: GalleryClient,
		id: string,
		hooks: EntryViewHooks,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.client = client;
		this.id = id;
		this.hooks = hooks;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-gallery-detail-modal");
		this.titleEl.setText(t().gallery.browse.loading);
		this.render();
		void this.load();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async load(): Promise<void> {
		try {
			this.entry = await this.client.entry(this.id);
			this.error = null;
		} catch (err) {
			this.error = galleryErrorText(err);
		}
		this.render();
	}

	private render(): void {
		const body = this.contentEl;
		body.empty();
		const strings = t().gallery.detail;

		if (this.error) {
			this.titleEl.setText(t().gallery.browse.title);
			renderEmpty(body, "cloud-off", this.error);
			return;
		}
		const entry = this.entry;
		if (!entry) {
			renderEmpty(body, "loader", t().gallery.browse.loading);
			return;
		}

		this.titleEl.setText(entry.name);

		const hero = body.createDiv("hearth-gallery-detail-hero");
		renderPreview(
			hero,
			entry.preview,
			entry.hasWallpaper ? this.client.wallpaperUrl(entry.id) : undefined,
		).addClass("is-large");

		const head = body.createDiv("hearth-gallery-detail-head");
		const byline = head.createDiv("hearth-gallery-detail-byline");
		renderAuthor(byline, entry, this.hooks.onOpenProfile
			? (publicKey) => {
					this.close();
					this.hooks.onOpenProfile?.(publicKey);
				}
			: undefined);
		byline.createSpan({
			cls: "hearth-gallery-chip",
			text: t().gallery.categories[entry.category],
		});
		this.renderVotes(head, entry);

		if (entry.description) {
			body.createEl("p", {
				cls: "hearth-gallery-detail-desc",
				text: entry.description,
			});
		}

		this.renderFacts(body, entry);
		this.renderContents(body, entry);
		this.renderRequires(body, entry);
		this.renderTags(body, entry);
		this.renderActions(body, entry);
	}

	// ---- Votes ----------------------------------------------------------

	/**
	 * Up, score, down — the whole of the reputation model on screen.
	 *
	 * Reddit-style: the number is ups minus downs and can be negative. Pressing
	 * the arrow you already chose clears the vote, which is the behaviour every
	 * control shaped like this has, and the tallies come back from the server
	 * rather than being guessed locally — a host may weight or age its score,
	 * and a number that disagreed with the one the listing shows would be worse
	 * than a moment's wait.
	 */
	private renderVotes(parent: HTMLElement, entry: GalleryEntryDetail): void {
		const strings = t().gallery.detail;
		const box = parent.createDiv("hearth-gallery-vote");

		const up = box.createEl("button", {
			cls: "hearth-gallery-vote-btn",
			attr: { "aria-label": strings.upvoteAria, "aria-pressed": String(entry.myVote === 1) },
		});
		up.toggleClass("is-active", entry.myVote === 1);
		setIcon(up, "arrow-big-up");
		up.addEventListener("click", () => void this.vote(entry.myVote === 1 ? 0 : 1));

		box.createSpan({
			cls: "hearth-gallery-vote-score",
			text: t().gallery.browse.score(entry.score),
		});

		const down = box.createEl("button", {
			cls: "hearth-gallery-vote-btn",
			attr: { "aria-label": strings.downvoteAria, "aria-pressed": String(entry.myVote === -1) },
		});
		down.toggleClass("is-active", entry.myVote === -1);
		setIcon(down, "arrow-big-down");
		down.addEventListener("click", () => void this.vote(entry.myVote === -1 ? 0 : -1));
	}

	private async vote(value: VoteValue): Promise<void> {
		const entry = this.entry;
		if (!entry || this.busy) return;
		// Voting is signed, so it needs a key — and a vault that has never
		// published has none. Minting one here costs nothing and reveals
		// nothing: the handle is derived from a secret that stays in the vault
		// and says nothing about who anybody is.
		const identity = vaultIdentity(this.plugin, true);
		if (!identity) {
			new Notice(t().gallery.errors.unauthorized);
			return;
		}
		this.busy = true;
		try {
			await this.client.signIn(identity.key, identity.publicKey);
			const tallies = await this.client.vote(entry.id, value);
			this.entry = { ...entry, ...tallies };
			this.hooks.onChanged?.(this.entry);
			this.render();
		} catch (err) {
			new Notice(galleryErrorText(err));
		} finally {
			this.busy = false;
		}
	}

	// ---- The body -------------------------------------------------------

	/** The one-line facts: when, how many, how big, what wrote it. */
	private renderFacts(body: HTMLElement, entry: GalleryEntryDetail): void {
		const strings = t().gallery.detail;
		const facts = body.createDiv("hearth-gallery-facts");

		const add = (icon: string, text: string): void => {
			if (!text) return;
			const row = facts.createDiv("hearth-gallery-fact");
			setIcon(row.createSpan("hearth-gallery-fact-icon"), icon);
			row.createSpan({ cls: "hearth-gallery-fact-text", text });
		};

		add("download", t().gallery.browse.downloads(entry.downloads));
		const published = galleryDate(entry.publishedAt);
		if (published) add("calendar-plus", strings.published(published));
		// Only when it says something the published date doesn't.
		const updated = galleryDate(entry.updatedAt);
		if (updated && updated !== published) add("history", strings.updated(updated));
		if (entry.version) add("tag", strings.version(entry.version));
		if (entry.pluginVersion) add("package", strings.madeWith(entry.pluginVersion));
		if (entry.sizeBytes) add("file", strings.size(Math.max(1, Math.round(entry.sizeBytes / 1024))));
		// Said here, before the download, rather than only in the import dialog
		// afterwards: a board that phones out is a thing to know about while you
		// are still deciding.
		add(
			entry.remoteRefs ? "globe" : "shield",
			entry.remoteRefs ? strings.remote(entry.remoteRefs) : strings.noRemote,
		);
		if (!entry.author) add("shield-alert", strings.unverified);
	}

	/** What is on the board, counted by kind. */
	private renderContents(body: HTMLElement, entry: GalleryEntryDetail): void {
		if (entry.cards.length === 0) return;
		const strings = t().gallery.detail;
		body.createDiv({ cls: "hearth-gallery-section", text: strings.contents });
		const list = body.createDiv("hearth-gallery-kinds");
		for (const card of entry.cards) {
			const { name, icon } = cardKindLabel(card.kind);
			const chip = list.createDiv("hearth-gallery-kind");
			setIcon(chip.createSpan("hearth-gallery-kind-icon"), icon);
			chip.createSpan({ cls: "hearth-gallery-kind-name", text: name });
			if (card.count > 1) {
				chip.createSpan({ cls: "hearth-gallery-kind-count", text: `×${card.count}` });
			}
		}
	}

	/** What it wants installed. Advisory — the importer lands the board either
	 * way and names the gaps; this is the same list, early enough to matter. */
	private renderRequires(body: HTMLElement, entry: GalleryEntryDetail): void {
		const strings = t().gallery.detail;
		const groups: [string, string[]][] = [
			[strings.requiresPlugins, entry.requires.plugins],
			[strings.requiresViews, entry.requires.viewTypes],
			[strings.requiresSettings, entry.requires.settings],
		];
		const any = groups.some(([, values]) => values.length > 0);
		body.createDiv({ cls: "hearth-gallery-section", text: strings.requires });
		if (!any) {
			body.createDiv({ cls: "hearth-gallery-note", text: strings.nothingRequired });
			return;
		}
		for (const [label, values] of groups) {
			if (values.length === 0) continue;
			const row = body.createDiv("hearth-gallery-requires-row");
			row.createSpan({ cls: "hearth-gallery-requires-label", text: label });
			const chips = row.createDiv("hearth-gallery-requires-chips");
			for (const value of values) {
				chips.createSpan({ cls: "hearth-gallery-chip", text: value });
			}
		}
	}

	private renderTags(body: HTMLElement, entry: GalleryEntryDetail): void {
		if (entry.tags.length === 0) return;
		const row = body.createDiv("hearth-gallery-requires-row");
		row.createSpan({ cls: "hearth-gallery-requires-label", text: t().gallery.detail.tags });
		const chips = row.createDiv("hearth-gallery-requires-chips");
		for (const tag of entry.tags) chips.createSpan({ cls: "hearth-gallery-chip", text: tag });
	}

	private renderActions(body: HTMLElement, entry: GalleryEntryDetail): void {
		const strings = t().gallery.detail;
		const actions = body.createDiv("hearth-gallery-actions");

		// The reader's own entry gets the one thing only they can do with it.
		const mine = vaultIdentity(this.plugin)?.publicKey;
		if (mine && entry.author?.publicKey === mine) {
			const remove = actions.createEl("button", {
				cls: "hearth-gallery-remove",
				text: t().gallery.publish.unpublish,
			});
			remove.addEventListener("click", () => this.confirmUnpublish(entry));
		}

		const install = actions.createEl("button", {
			cls: "mod-cta",
			text: this.busy ? strings.installing : strings.install,
			attr: { "aria-label": strings.installAria(entry.name) },
		});
		install.disabled = this.busy;
		install.addEventListener("click", () => void this.install(entry));
	}

	private async install(entry: GalleryEntryDetail): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		this.render();
		try {
			const fetched = await fetchEntryPackage(this.client, entry.id);
			this.close();
			this.hooks.onInstalled?.();
			// Handed on as bytes: the import dialog verifies the signature over
			// exactly what was served, and applies it through the same sanitizers
			// a file off disk goes through.
			openImportPackage(this.plugin, fetched.json, fetched.pkg);
		} catch (err) {
			new Notice(galleryErrorText(err));
		} finally {
			this.busy = false;
			if (this.entry) this.render();
		}
	}

	private confirmUnpublish(entry: GalleryEntryDetail): void {
		const strings = t().gallery.publish;
		confirmAction(this.app, {
			title: strings.unpublish,
			message: strings.unpublishConfirm(entry.name),
			confirmText: strings.unpublish,
			onConfirm: () => void this.unpublish(entry),
		});
	}

	private async unpublish(entry: GalleryEntryDetail): Promise<void> {
		const identity = vaultIdentity(this.plugin);
		if (!identity) return;
		try {
			await this.client.signIn(identity.key, identity.publicKey);
			await this.client.unpublish(entry.id);
			new Notice(t().gallery.publish.unpublished);
			this.close();
		} catch (err) {
			new Notice(galleryErrorText(err));
		}
	}
}

// ---- Profiles ----------------------------------------------------------

/** What the profile view tells its opener. */
export interface ProfileViewHooks {
	onOpenEntry?: (id: string) => void;
}

/**
 * Everything one handle has published, and what it adds up to.
 *
 * Fetched by public key rather than by handle: the key is the identity and the
 * handle is a rendering of it, so a profile keyed on the name would be a
 * profile keyed on a derived value — and the derivation is one-way, so the
 * server could not resolve it back without keeping a second index that could
 * disagree with the first.
 */
export function openGalleryProfile(
	plugin: HearthPlugin,
	client: GalleryClient,
	publicKey: string,
	hooks: ProfileViewHooks = {},
): void {
	new GalleryProfileModal(plugin, client, publicKey, hooks).open();
}

class GalleryProfileModal extends Modal {
	private plugin: HearthPlugin;
	private client: GalleryClient;
	private publicKey: string;
	private hooks: ProfileViewHooks;
	private profile: GalleryProfile | null = null;
	private error: string | null = null;

	constructor(
		plugin: HearthPlugin,
		client: GalleryClient,
		publicKey: string,
		hooks: ProfileViewHooks,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.client = client;
		this.publicKey = publicKey;
		this.hooks = hooks;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-gallery-modal");
		this.titleEl.setText(t().gallery.browse.loading);
		this.render();
		void this.load();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async load(): Promise<void> {
		try {
			this.profile = await this.client.profile(this.publicKey);
			this.error = null;
		} catch (err) {
			this.error = galleryErrorText(err);
		}
		this.render();
	}

	private render(): void {
		const body = this.contentEl;
		body.empty();
		const strings = t().gallery.profile;

		if (this.error) {
			renderEmpty(body, "cloud-off", this.error);
			return;
		}
		const profile = this.profile;
		if (!profile) {
			renderEmpty(body, "loader", t().gallery.browse.loading);
			return;
		}

		this.titleEl.setText(strings.title(profile.author.handle));
		body.createEl("p", { cls: "hearth-modal-intro", text: strings.subtitle });

		const stats = body.createDiv("hearth-gallery-profile-stats");
		const stat = (label: string, value: string): void => {
			const box = stats.createDiv("hearth-gallery-profile-stat");
			box.createDiv({ cls: "hearth-gallery-profile-stat-value", text: value });
			box.createDiv({ cls: "hearth-gallery-profile-stat-label", text: label });
		};
		// The sum across everything they have published — the number the profile
		// exists to show, and the only one that describes a maker rather than a
		// board.
		stat(strings.totalScore, t().gallery.browse.score(profile.totalScore));
		stat(strings.totalDownloads, String(profile.totalDownloads));
		stat(strings.published(profile.entries.length), String(profile.entries.length));

		const firstSeen = galleryDate(profile.firstSeenAt);
		if (firstSeen) {
			body.createDiv({ cls: "hearth-gallery-note", text: strings.firstSeen(firstSeen) });
		}

		if (profile.entries.length === 0) {
			renderEmpty(body, "inbox", strings.empty);
			return;
		}

		const grid = body.createDiv("hearth-gallery-grid");
		for (const entry of profile.entries) {
			renderEntryCard(grid, entry, {
				wallpaperUrl: entry.hasWallpaper ? this.client.wallpaperUrl(entry.id) : undefined,
				onOpen: (chosen) => {
					this.close();
					this.hooks.onOpenEntry?.(chosen.id);
				},
			});
		}
	}
}
