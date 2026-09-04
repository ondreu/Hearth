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
import type { AuthorIdentity } from "./identity";
import { t } from "./i18n";
import { confirmAction } from "./ui";
import { createIdentity, openImportPackage, vaultIdentity } from "./exportimport";
import { renderAvatar } from "./galleryavatar";
import {
	activate,
	cardKindLabel,
	openPictureViewer,
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
	type GalleryComment,
	MAX_COMMENT_LENGTH,
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
	private comments: GalleryComment[] = [];
	private commentTotal = 0;
	private commentDraft = "";
	private commentsLoaded = false;

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
		if (this.entry) void this.loadComments();
	}

	/**
	 * The comments, fetched after the board itself.
	 *
	 * A second request rather than a field on the entry, so a listing does not
	 * carry every remark on every board — and so the slower of the two does not
	 * hold up the thing somebody actually opened the modal for. A gallery that
	 * cannot answer it is not an error: the board is still there and installable,
	 * so the section simply says nothing.
	 */
	private async loadComments(): Promise<void> {
		try {
			const page = await this.client.comments(this.id);
			this.comments = page.comments;
			this.commentTotal = page.total;
		} catch {
			this.comments = [];
			this.commentTotal = 0;
		}
		this.commentsLoaded = true;
		if (this.containerEl.isConnected) this.render();
	}

	private render(): void {
		const body = this.contentEl;
		body.empty();

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
		const shot = entry.hasSnapshot ? this.client.snapshotUrl(entry.id) : undefined;
		const frame = renderPreview(hero, {
			wallpaper: entry.hasWallpaper ? this.client.wallpaperUrl(entry.id) : undefined,
			snapshot: shot,
			large: true,
		});
		// Only the photograph is worth enlarging; the drawing is already as much
		// detail as it has.
		if (shot) {
			// `renderPreview` drops the image and falls back to the placeholder
			// when the host serves something that isn't a picture. The frame has
			// to stop offering to open one too, or the placeholder opens an
			// empty viewer — hence the flag rather than only the class: the
			// listener outlives the styling.
			let broken = false;
			frame.addClass("is-zoomable");
			activate(
				frame,
				() => {
					if (!broken) openPictureViewer(shot, entry.name);
				},
				t().gallery.detail.enlarge,
			);
			frame.querySelector("img")?.addEventListener("error", () => {
				broken = true;
				frame.removeClass("is-zoomable");
				frame.removeAttribute("role");
				frame.removeAttribute("tabindex");
			});
		}

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
		this.renderComments(body, entry);
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
		// published has none. Minting one silently would be giving somebody a
		// name they never asked for and a key they don't know to keep, so the
		// button asks first and says what it is making.
		const identity = vaultIdentity(this.plugin) ?? (await this.askForIdentity());
		if (!identity) return;
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

	/**
	 * "You need a handle to do that — make one?"
	 *
	 * Resolves to the new identity, or null if they said no. Asked at the point
	 * of the action rather than on the way in, because reading a gallery needs
	 * no identity at all and being asked for one at the door would suggest
	 * otherwise.
	 */
	private askForIdentity(): Promise<AuthorIdentity | null> {
		const strings = t().gallery.browse;
		return new Promise((resolve) => {
			confirmAction(this.app, {
				title: t().portable.exportModal.identityCreate,
				message: strings.needsIdentityVote,
				confirmText: t().portable.exportModal.identityCreate,
				onConfirm: () => void createIdentity(this.plugin, () => this.render()).then(resolve),
				onDismiss: () => resolve(null),
			});
		});
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
		// The author's own note about how it is meant to look. Text, never a
		// link and never an install prompt.
		if (entry.theme) add("palette", strings.theme(entry.theme));
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

	// ---- Comments -------------------------------------------------------

	/**
	 * What people have said about this board, and a box to say something.
	 *
	 * Flat and newest first: a board's comments are "does this need Dataview
	 * 0.5" and "the third card wants a folder set" — remarks, not a discussion,
	 * and threading them would be building a forum inside a modal.
	 *
	 * Every body is a text node. It is the only free prose in this API that
	 * somebody other than the board's own author wrote, and the one place where
	 * treating a response as markup would matter.
	 */
	private renderComments(body: HTMLElement, entry: GalleryEntryDetail): void {
		const strings = t().gallery.comments;
		body.createDiv({
			cls: "hearth-gallery-section",
			text: this.commentTotal ? strings.heading(this.commentTotal) : strings.headingEmpty,
		});

		if (!this.commentsLoaded) {
			body.createDiv({ cls: "hearth-gallery-note", text: t().gallery.browse.loading });
			return;
		}

		const mine = vaultIdentity(this.plugin)?.publicKey;
		const list = body.createDiv("hearth-gallery-comments");
		for (const comment of this.comments) {
			const row = list.createDiv("hearth-gallery-comment");
			const head = row.createDiv("hearth-gallery-comment-head");
			const who = head.createSpan({
				cls: "hearth-gallery-comment-author",
				text: comment.author?.handle ?? t().gallery.browse.anonymous,
			});
			// A handle is a way to somebody's shelf wherever it appears — in a
			// listing row, on a board, and here.
			const key = comment.author?.publicKey;
			if (key && this.hooks.onOpenProfile) {
				who.addClass("is-clickable");
				activate(who, () => {
					this.close();
					this.hooks.onOpenProfile?.(key);
				}, t().gallery.detail.profile(comment.author!.handle));
			}
			const when = galleryDate(comment.createdAt);
			if (when) head.createSpan({ cls: "hearth-gallery-comment-date", text: when });
			// The comment's author may remove it, and so may the owner of the
			// board it is on — which is the whole of moderation here, in the
			// hands of the person with the most reason to use it.
			if (mine && (comment.author?.publicKey === mine || entry.author?.publicKey === mine)) {
				const remove = head.createEl("button", {
					cls: "hearth-gallery-comment-remove",
					attr: { "aria-label": strings.remove },
				});
				setIcon(remove, "trash-2");
				remove.addEventListener("click", () => void this.removeComment(comment));
			}
			// `text`, never markup: this is prose from a stranger.
			row.createDiv({ cls: "hearth-gallery-comment-body", text: comment.body });
		}
		if (this.comments.length === 0) {
			list.createDiv({ cls: "hearth-gallery-note", text: strings.none });
		}

		const compose = body.createDiv("hearth-gallery-compose");
		const field = compose.createEl("textarea", {
			cls: "hearth-gallery-compose-input",
			attr: {
				placeholder: strings.placeholder,
				"aria-label": strings.placeholder,
				maxlength: String(MAX_COMMENT_LENGTH),
				rows: "3",
			},
		});
		field.value = this.commentDraft;
		field.addEventListener("input", () => {
			// Kept on the modal, because posting a vote redraws it and a redraw
			// that blanks a half-typed comment is the worst kind of small bug.
			this.commentDraft = field.value;
		});
		const send = compose.createEl("button", { cls: "mod-cta", text: strings.post });
		send.addEventListener("click", () => void this.postComment());
	}

	private async postComment(): Promise<void> {
		const draft = this.commentDraft.trim();
		if (!draft || this.busy) return;
		const identity = vaultIdentity(this.plugin) ?? (await this.askForIdentity());
		if (!identity) return;
		this.busy = true;
		try {
			await this.client.signIn(identity.key, identity.publicKey);
			const posted = await this.client.comment(this.id, draft);
			// Newest first, and put in place rather than refetched: the page the
			// reader is looking at is the one it belongs at the top of.
			this.comments = [posted, ...this.comments];
			this.commentTotal += 1;
			this.commentDraft = "";
			this.render();
		} catch (err) {
			new Notice(galleryErrorText(err));
		} finally {
			this.busy = false;
		}
	}

	private async removeComment(comment: GalleryComment): Promise<void> {
		const identity = vaultIdentity(this.plugin);
		if (!identity) return;
		try {
			await this.client.signIn(identity.key, identity.publicKey);
			await this.client.deleteComment(comment.id);
			this.comments = this.comments.filter((c) => c.id !== comment.id);
			this.commentTotal = Math.max(0, this.commentTotal - 1);
			this.render();
		} catch (err) {
			new Notice(galleryErrorText(err));
		}
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
			// Only while the modal is still on screen: a successful install
			// closed it, and drawing into a detached `contentEl` would refill
			// the element `onClose` had just emptied.
			if (this.entry && this.containerEl.isConnected) this.render();
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

		// A masthead rather than a row of numbers: the mark, the handle, when
		// they started, and what they have earned — read top to bottom, which is
		// how a page about a person reads.
		const head = body.createDiv("hearth-gallery-profile-head");
		renderAvatar(head, profile.author.publicKey, "is-large");
		const who = head.createDiv("hearth-gallery-profile-who");
		who.createDiv({ cls: "hearth-gallery-profile-handle", text: profile.author.handle });
		const firstSeen = galleryDate(profile.firstSeenAt);
		if (firstSeen) {
			who.createDiv({ cls: "hearth-gallery-profile-since", text: strings.firstSeen(firstSeen) });
		}
		who.createDiv({ cls: "hearth-gallery-profile-note", text: strings.subtitle });

		const stats = body.createDiv("hearth-gallery-profile-stats");
		const stat = (label: string, value: string, hint?: string): void => {
			const box = stats.createDiv("hearth-gallery-profile-stat");
			box.createDiv({ cls: "hearth-gallery-profile-stat-value", text: value });
			box.createDiv({ cls: "hearth-gallery-profile-stat-label", text: label });
			if (hint) box.setAttribute("aria-label", `${label}: ${value}. ${hint}`);
		};
		// "Karma", not "score": a board has a score, and a person who has
		// published eight of them has something the sum of those scores is a
		// worse name for.
		stat(strings.karma, t().gallery.browse.score(profile.totalScore), strings.karmaHint);
		stat(strings.totalDownloads, String(profile.totalDownloads));
		stat(strings.published(profile.entries.length), String(profile.entries.length));

		// A handle with nothing published is a real state — a key that has voted
		// or commented but never uploaded — and an empty grid under three zeroes
		// reads as a page that failed to load.
		if (profile.entries.length === 0) {
			renderEmpty(body, "inbox", strings.empty);
			return;
		}

		const grid = body.createDiv("hearth-gallery-grid");
		for (const entry of profile.entries) {
			renderEntryCard(grid, entry, {
				wallpaper: entry.hasWallpaper ? this.client.wallpaperUrl(entry.id) : undefined,
				snapshot: entry.hasSnapshot ? this.client.snapshotUrl(entry.id) : undefined,
				onOpen: (chosen) => {
					this.close();
					this.hooks.onOpenEntry?.(chosen.id);
				},
			});
		}
	}
}
