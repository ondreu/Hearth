/**
 * The dialogs around the portable-package engine: export a board, import a
 * file, back up and restore a vault.
 *
 * Everything about *what* travels lives in `src/portable/`; this file is the
 * two conversations that wrap it.
 *
 * On the way out there are only two questions worth asking, because everything
 * else about a board is not a choice: the cards' settings, the cards pinned to
 * every board, the notes a favourites card shows — all of it is part of what is
 * on screen, and none of it is something a dashboard shows you a difference
 * between, so all of it simply travels. What is left is whether the pictures
 * ride along, and whether the author's private things are left out. A
 * disclosure below them tunes each group of that separately and *lists the
 * values*, so "leave out my private information" can be checked rather than
 * trusted — and it is built only when it is opened.
 *
 * Who the file is by is not a question either. A typed name is personal data
 * Hearth has no reason to hold and a label anybody can claim, so the dialog
 * shows an anonymous handle derived from a key that never leaves the vault
 * (`src/identity.ts`) and offers to copy or replace that key.
 *
 * On the way in the question is what you are about to get. A downloaded board
 * routinely mentions notes you haven't got and plugins you haven't installed,
 * so the import dialog reads the file first and says what it found, what it
 * needs and what is missing, *before* anything is applied — and then adds the
 * board rather than replacing your vault, which is what makes importing a
 * stranger's dashboard a safe thing to do at all.
 */

import { type App, Modal, Notice, Platform, Setting, setIcon, TFile } from "obsidian";
import type HearthPlugin from "./main";
import { activeDashboard, type Dashboard } from "./types";
import { detectLanguage, t } from "./i18n";
import { confirmAction, downloadTextFile, pickTextFile, promptForText } from "./ui";
import { type AuthorIdentity, identityFromKey, newAuthorKey } from "./identity";
import {
	asGalleryCategory,
	DEFAULT_GALLERY_CATEGORY,
	GALLERY_CATEGORIES,
	GalleryError,
	type BoardSnapshot,
	canSnapshot,
	captureBoard,
	galleryBlockedByExternalCalls,
	galleryClient,
	galleryConfigured,
	previewFromPackage,
	publishDashboard,
} from "./gallery";
import { galleryErrorText, renderPreview } from "./galleryui";
import {
	captureDashboard,
	describeReferences,
	type ExportDashboardOptions,
	exportDashboardFile,
	exportLayoutFile,
	exportSettingsFile,
	existingBoardFor,
	type HearthPackage,
	type ImportResult,
	type ImportWarning,
	importPackageFile,
	newSourceId,
	PACKAGE_FILENAMES,
	packageAuthor,
	previewStrip,
	readPackage,
	type ReferenceScope,
	type SignatureState,
	type StripOptions,
	vaultEnvironment,
	verifyPackageSignature,
} from "./portable";

/** Save an export: download it (desktop) or write it to the vault root (mobile,
 * which can't download). Shared by every export route. */
export async function saveExport(
	app: App,
	filename: string,
	content: string,
	notice: string = t().notices.exported,
): Promise<void> {
	if (!Platform.isMobile) {
		downloadTextFile(filename, content);
		new Notice(notice);
		return;
	}
	try {
		const existing = app.vault.getAbstractFileByPath(filename);
		if (existing instanceof TFile) await app.vault.modify(existing, content);
		else await app.vault.create(filename, content);
		new Notice(t().notices.exportedToVault(filename));
	} catch {
		new Notice(t().notices.exportFailed);
	}
}

/** Options every export route fills in the same way. */
function commonOptions(plugin: HearthPlugin): { pluginVersion: string; locale: string } {
	return { pluginVersion: plugin.manifest.version, locale: detectLanguage() };
}

/** Export the whole dashboard setup (every board plus the layout globals). */
export async function exportLayout(plugin: HearthPlugin): Promise<void> {
	const outcome = exportLayoutFile(plugin.settings, commonOptions(plugin));
	await saveExport(plugin.app, PACKAGE_FILENAMES.layout, outcome.json, t().notices.layoutExported);
}

/** Export every setting: the full backup. */
export async function exportSettings(plugin: HearthPlugin): Promise<void> {
	const outcome = exportSettingsFile(plugin.settings, commonOptions(plugin));
	await saveExport(plugin.app, PACKAGE_FILENAMES.settings, outcome.json);
}

/** Where a shared board is going. See {@link ShareDashboardModal}. */
type ShareMode = "export" | "publish";

/** Open the share dialog for one board, on the "save a file" side. */
export function openExportDashboard(plugin: HearthPlugin, dash: Dashboard): void {
	new ShareDashboardModal(plugin, dash, "export").open();
}

/**
 * Open the same dialog on the "publish" side.
 *
 * Falls back to the file side when no gallery is configured rather than opening
 * a form whose button cannot do anything: the destination switch says why, and
 * saving a file is the thing that still works.
 */
export function openPublishDashboard(plugin: HearthPlugin, dash: Dashboard): void {
	new ShareDashboardModal(plugin, dash, galleryConfigured(plugin) ? "publish" : "export").open();
}

/**
 * Open the import dialog for a package already in hand.
 *
 * The gallery's install path comes through here: the bytes it downloaded go to
 * exactly the dialog a file picked off disk goes to, so a board from a stranger
 * on the internet gets the signature check, the missing-note list and the
 * sanitizers, not a shortcut around them.
 */
export function openImportPackage(
	plugin: HearthPlugin,
	json: string,
	pkg: HearthPackage,
): void {
	new ImportModal(plugin, json, pkg).open();
}

/**
 * What "leave out my private information" leaves out.
 *
 * Paths (the author's folder structure), private feeds and hosts and their
 * town, and the prose they jotted on their own board. Not the queries — a board
 * stripped of them stops doing anything — and not command ids or view types,
 * which name plugins rather than people. Both of those can still be turned on
 * by hand in the details section, which is the whole reason it exists.
 */
const DEFAULT_STRIP: StripOptions = { paths: true, private: true, content: true };

/** The strip groups, in the order the details section lists them. */
const STRIP_GROUPS = ["paths", "private", "content", "queries", "plugins"] as const;
type StripGroup = (typeof STRIP_GROUPS)[number];

/** Which reference scopes each group covers, for listing the values it removes
 * and for saying what the file still carries when nothing is being removed. */
const GROUP_SCOPES: Record<StripGroup, readonly ReferenceScope[]> = {
	paths: ["vaultPath", "asset"],
	private: ["privateUrl", "privateHost", "place"],
	content: ["userContent"],
	queries: ["userQuery"],
	plugins: ["commandId", "viewType"],
};

/**
 * This vault's export identity, and the only place its key is ever created.
 *
 * `mint` decides whether a vault that has none gets one now. The export dialog
 * mints — it is about to publish, and the handle has to be on screen *before*
 * anything is written, so nobody publishes under a name they have not seen. The
 * settings tab does not: a vault that has never shared anything has no identity
 * to have, and merely reading a settings page is not a reason to acquire one.
 */
export function vaultIdentity(plugin: HearthPlugin, mint = false): AuthorIdentity | null {
	const s = plugin.settings;
	if (!s.authorKey && mint) {
		s.authorKey = newAuthorKey();
		void plugin.saveData(s);
	}
	return s.authorKey ? identityFromKey(s.authorKey) : null;
}

/**
 * The row that shows who this vault publishes as, and the two things you can do
 * about it: copy the key that carries the handle elsewhere, or paste one in.
 *
 * There is deliberately no field to type a name into. A typed name is personal
 * data Hearth has no reason to hold and a label anybody could claim; this
 * handle is computed from a secret the vault never sends, so it is anonymous,
 * the same on every export, and not something a stranger can publish under.
 * See `src/identity.ts`.
 *
 * The handle is the point of the row, so it is *shown* rather than mentioned
 * inside a paragraph — a name people are asked to recognise on somebody else's
 * board and to keep a key for should not be a word in the middle of an
 * explanation.
 *
 * The buttons depend on whether there is an identity at all, because the two
 * states want different things:
 *
 * - **None yet** — one button that makes one, and one that pastes in a key from
 *   another install. There is nothing to copy.
 * - **One already** — copy the key (the thing worth doing before it is needed)
 *   and replace it. No "generate", because generating over an identity is
 *   throwing one away, and the thing that does that is called "use a different
 *   key" and asks first.
 *
 * `decorate` adds a control ahead of the buttons — the share dialog puts its
 * "include this" switch there. `onChanged` is called after the identity changes,
 * since the handle on screen is then the wrong one. `mint` mints silently for a
 * caller that is about to *use* the identity; see {@link vaultIdentity}.
 */
export function identitySetting(
	plugin: HearthPlugin,
	containerEl: HTMLElement,
	onChanged: () => void,
	opts: { mint?: boolean; decorate?: (row: Setting) => void } = {},
): Setting {
	const strings = t().portable.exportModal;
	const { mint, decorate } = opts;
	const identity = vaultIdentity(plugin, mint);
	const row = new Setting(containerEl)
		.setName(strings.identity)
		.setDesc(identity ? strings.identityDesc : strings.identityNew);

	// The handle itself, at a size that says it is a name rather than a setting
	// value. Selectable, because people copy it into a message to say "that one
	// is mine".
	if (identity) {
		row.nameEl.createDiv({ cls: "hearth-identity-handle", text: identity.handle });
	}

	decorate?.(row);

	if (identity) {
		row.addExtraButton((b) =>
			b
				.setIcon("clipboard-copy")
				.setTooltip(strings.identityCopy)
				.onClick(() => void copyRecoveryKey(plugin, onChanged)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("key-round")
				.setTooltip(strings.identityRestore)
				.onClick(() => void restoreIdentity(plugin, onChanged)),
		);
	} else {
		row.addButton((b) =>
			b
				.setButtonText(strings.identityCreate)
				.setCta()
				.onClick(() => void createIdentity(plugin, onChanged)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("key-round")
				.setTooltip(strings.identityRestore)
				.onClick(() => void restoreIdentity(plugin, onChanged)),
		);
	}

	// The one thing about this scheme that can go permanently wrong, said where
	// it cannot be walked past. Nothing but this vault holds the key, so there
	// is no reset and nobody to ask — which is a fine trade only if the user
	// finds out before they need it rather than after. It stops appearing once
	// the key has actually been copied.
	if (identity && !plugin.settings.authorKeySaved) {
		const warning = new Setting(containerEl)
			.setDesc(strings.identityUnsaved)
			.addButton((b) =>
				b
					.setButtonText(strings.identityCopy)
					.setCta()
					.onClick(() => void copyRecoveryKey(plugin, onChanged)),
			);
		warning.settingEl.addClass("hearth-setting-warning");
	}
	return row;
}

/**
 * Make this vault an identity, on purpose.
 *
 * Separate from the silent minting {@link vaultIdentity} does for a caller
 * that is mid-publish: this is somebody pressing a button that says what it
 * makes, so it says what was made — the handle is the thing they now have, and
 * finding out what you are called by looking for it later is worse.
 */
export async function createIdentity(
	plugin: HearthPlugin,
	onChanged: () => void,
): Promise<AuthorIdentity | null> {
	const identity = vaultIdentity(plugin, true);
	if (!identity) return null;
	new Notice(t().portable.exportModal.identityCreated(identity.handle));
	onChanged();
	return identity;
}

/** Asking for the key is asking for an identity, so this mints one if the vault
 * hasn't got one yet — writing it down before it is needed is the whole point
 * of the button. */
async function copyRecoveryKey(plugin: HearthPlugin, onChanged: () => void): Promise<void> {
	const strings = t().portable.exportModal;
	const identity = vaultIdentity(plugin, true);
	if (!identity) return;
	try {
		await navigator.clipboard.writeText(identity.key);
		new Notice(strings.identityCopied);
	} catch {
		// A clipboard a plugin can't reach is not a reason to lose the key:
		// show it instead, so it can be selected by hand. Still counts as having
		// been handed over — it is on screen, and repeating the warning would
		// then be nagging about something the user has already been given.
		new Notice(strings.identityCopyFailed(identity.key));
	}
	plugin.settings.authorKeySaved = true;
	await plugin.saveData(plugin.settings);
	// The row may have said "you'll get one when you export", and the warning
	// below it has just earned its retirement.
	onChanged();
}

/** Paste a key from another install. The handle comes back with it — that is
 * what carrying the key means. */
async function restoreIdentity(plugin: HearthPlugin, onChanged: () => void): Promise<void> {
	const strings = t().portable.exportModal;
	// Pasting a key over one the user has never been shown destroys a handle
	// nothing can bring back — the one irreversible thing in this whole feature,
	// reachable by a mis-click on the button beside it. A key they *have* copied
	// is theirs to put back, so that case is not worth a dialog.
	if (plugin.settings.authorKey !== "" && !plugin.settings.authorKeySaved) {
		const proceed = await new Promise<boolean>((resolve) => {
			confirmAction(plugin.app, {
				title: strings.identityReplaceTitle,
				message: strings.identityReplaceWarning,
				confirmText: strings.identityReplaceConfirm,
				onConfirm: () => resolve(true),
				onDismiss: () => resolve(false),
			});
		});
		if (!proceed) return;
	}
	const typed = await promptForText(plugin.app, {
		title: strings.identityRestore,
		label: strings.identityRestoreLabel,
		placeholder: "HEARTH-XXXXX-XXXXX-XXXXX-XXXXX",
	});
	if (typed === null) return;
	const identity = identityFromKey(typed);
	if (!identity) {
		new Notice(strings.identityRestoreFailed);
		return;
	}
	plugin.settings.authorKey = identity.key;
	// Pasted in from somewhere else, so it is by definition already written
	// down: warning the user to save what they just typed reads as a bug.
	plugin.settings.authorKeySaved = true;
	await plugin.saveData(plugin.settings);
	new Notice(strings.identityRestored(identity.handle));
	onChanged();
}

/**
 * Export one board.
 *
 * The dialog is two dialogs. The one everybody sees asks four things — what to
 * call it, whether the pictures travel, and whether the author's private things
 * are left out — because those are the only decisions most exports involve. The
 * one behind the disclosure is for the export that isn't ordinary: it tunes
 * each group of what-gets-left-out separately, and it *shows the values*, so
 * "leave out my private information" is a claim that can be checked rather than
 * trusted. It is built the first time it is opened and rebuilt when a choice
 * above it changes, so an export nobody opens it for costs nothing.
 */
/**
 * Sharing a board: one dialog, two destinations.
 *
 * Saving a file and publishing to a gallery ask almost exactly the same
 * questions — what is this board called, what is it for, what of your vault
 * should travel with it — and the small number of places they differ are
 * differences in *defaults*, not in the conversation. So they are one dialog
 * with a switch at the top rather than two that drift apart, and the switch is
 * the first thing on screen because it changes what the rest of it means.
 *
 * What publishing pins, and why each is not a switch:
 *
 * | | Save a file | Publish |
 * | --- | --- | --- |
 * | Pictures travel | your choice, on by default | always — a wallpaper left as a path arrives missing in every vault but yours |
 * | Private things come out | your choice, **off** by default | always — your own copy has to keep working; a stranger's copy has no reason to name your folders |
 * | Signed | your choice | always — an unsigned entry has no provable author, so anybody can later claim it |
 *
 * The details section still tunes *which* groups the strip takes, because a
 * board whose text cards are part of the design is a real thing to publish.
 * What is not there on the publish side is the switch that turns the strip off.
 */
class ShareDashboardModal extends Modal {
	private plugin: HearthPlugin;
	private dash: Dashboard;
	private mode: ShareMode;
	private opts: ExportDashboardOptions = { flatten: true, embedAssets: true };
	/** The one-switch summary of the section below. Publishing pins it on. */
	private stripPrivate = false;
	/** What that switch means, tunable in the details section. */
	private strip: StripOptions = { ...DEFAULT_STRIP };
	private includeIdentity = true;
	private meta = { name: "", description: "", tags: "", category: DEFAULT_GALLERY_CATEGORY };
	/** "Recommended with <theme>", filled in from the vault's active theme when
	 * switched on. Empty means the author isn't claiming one. */
	private theme = "";
	/** The picture of the board, once one has been taken. Held here rather than
	 * captured at publish so the author sees exactly what will be uploaded. */
	private snapshot: BoardSnapshot | null = null;
	private capturing = false;
	private busy = false;
	/** The disclosure, so a choice above it can redraw its contents in place. */
	private details?: HTMLDetailsElement;

	constructor(plugin: HearthPlugin, dash: Dashboard, mode: ShareMode) {
		super(plugin.app);
		this.plugin = plugin;
		this.dash = dash;
		this.mode = mode;
		this.meta.name = dash.name;
		if (mode === "publish") this.stripPrivate = true;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-share-modal");
		this.render();
	}

	private get publishing(): boolean {
		return this.mode === "publish";
	}

	/** Drawn from scratch, so switching destination — or replacing the vault's
	 * identity — redraws everything that depends on it. */
	private render(): void {
		const strings = t().portable.exportModal;
		this.titleEl.setText(this.publishing ? t().gallery.publish.title : strings.title);
		const body = this.contentEl;
		body.empty();

		this.renderHero(body);
		this.renderDestination(body);
		body.createEl("p", {
			text: this.publishing ? t().gallery.publish.intro : strings.intro,
			cls: "hearth-modal-intro",
		});
		// The one thing about publishing that is not undoable, said before the
		// fields rather than beside the button: copies stay installed after an
		// entry is withdrawn, and that is worth knowing while you are still
		// deciding whether to fill the form in.
		if (this.publishing) {
			body.createDiv({ cls: "hearth-share-warning", text: t().gallery.publish.warning });
		}

		this.renderListingFields(body);

		identitySetting(this.plugin, body, () => this.render(), {
			// About to publish: the handle has to exist so it can be shown.
			mint: true,
			decorate: (row) => {
				// Publishing without an identity is publishing something nobody
				// can prove they wrote, so there is nothing to switch off.
				if (this.publishing) return;
				row.addToggle((tg) =>
					tg.setValue(this.includeIdentity).onChange((v) => {
						this.includeIdentity = v;
					}),
				);
			},
		});

		new Setting(body).setName(strings.contents).setHeading();
		this.renderContentChoices(body);
		this.renderSnapshot(body);
		this.detailsSection(body);
		this.renderFooter(body);
	}

	/**
	 * A photograph of the board, and the switch that takes one.
	 *
	 * Only offered for the board that is actually on screen behind this dialog —
	 * capturing works by photographing the window, so a board that isn't
	 * rendered cannot be in the frame — and only on a build that can capture at
	 * all. Everywhere else the drawn preview stands.
	 *
	 * The captured image is shown here, at size, before anything is uploaded.
	 * That is the point: a promise about what a redacted screenshot contains is
	 * worth much less than the screenshot.
	 */
	private renderSnapshot(body: HTMLElement): void {
		const strings = t().portable.exportModal;
		if (!canSnapshot() || !this.isActiveBoard()) return;

		const row = new Setting(body)
			.setName(strings.snapshot)
			.setDesc(strings.snapshotDesc)
			.addToggle((tg) =>
				tg
					.setValue(this.snapshot !== null)
					.setDisabled(this.capturing)
					.onChange((v) => {
						if (!v) {
							this.snapshot = null;
							this.render();
							return;
						}
						void this.takeSnapshot();
					}),
			);

		if (this.capturing) {
			row.descEl.createDiv({
				cls: "hearth-export-values-empty",
				text: strings.snapshotWorking,
			});
			return;
		}
		if (!this.snapshot) return;

		// Shown as an image element with a data URI this vault just produced —
		// not a URL, not markup, and never anything that arrived from outside.
		const shot = body.createDiv("hearth-share-snapshot");
		const img = shot.createEl("img", { cls: "hearth-share-snapshot-img" });
		img.src = `data:${this.snapshot.mime};base64,${this.snapshot.data}`;
		img.alt = strings.snapshot;
		shot.createDiv({
			cls: "hearth-share-snapshot-note",
			text: strings.snapshotTaken(Math.max(1, Math.round(this.snapshot.bytes / 1024))),
		});
	}

	/** Whether the board being shared is the one rendered behind this dialog. */
	private isActiveBoard(): boolean {
		return activeDashboard(this.plugin.settings).id === this.dash.id;
	}

	/** Find the rendered board to photograph, or null if it isn't on screen. */
	private boardEl(): HTMLElement | null {
		return this.app.workspace.containerEl.querySelector<HTMLElement>(".hearth-home");
	}

	private async takeSnapshot(): Promise<void> {
		const board = this.boardEl();
		if (!board) {
			new Notice(t().portable.exportModal.snapshotFailed);
			return;
		}
		this.capturing = true;
		this.render();
		// The dialog is in front of the board, so it steps out of the frame for
		// the moment of the capture rather than closing — its state survives and
		// the flicker is one frame of an action that already takes a second.
		this.snapshot = await captureBoard(board, [this.containerEl]);
		this.capturing = false;
		if (!this.snapshot) new Notice(t().portable.exportModal.snapshotFailed);
		this.render();
	}

	/** The board itself, drawn the way the gallery will draw it. Sharing a
	 * dashboard is the one export where what it *looks like* is the point, and
	 * this is the same thumbnail a listing shows — so the preview is checked
	 * here rather than discovered after the upload. */
	private renderHero(body: HTMLElement): void {
		const hero = body.createDiv("hearth-share-hero");
		const preview = previewFromPackage(
			exportPreviewPackage(this.plugin, this.dash, this.opts),
		);
		// Once a picture has been taken it is what a listing will show, so it is
		// what the dialog shows too — the thumbnail here is a preview of the
		// entry, not a second opinion about it.
		renderPreview(hero, preview, {
			snapshot: this.snapshot
				? `data:${this.snapshot.mime};base64,${this.snapshot.data}`
				: undefined,
		});
		const text = hero.createDiv("hearth-share-hero-text");
		text.createDiv({ cls: "hearth-share-hero-name", text: this.meta.name || this.dash.name });
		const count = this.dash.cards.length;
		text.createDiv({
			cls: "hearth-share-hero-sub",
			text: t().gallery.browse.cardCount(count),
		});
	}

	/** Save a file, or publish. The switch that decides what the rest means. */
	private renderDestination(body: HTMLElement): void {
		const strings = t().portable.exportModal;
		const row = body.createDiv("hearth-share-modes");
		const configured = galleryConfigured(this.plugin);

		const tab = (mode: ShareMode, label: string, icon: string, enabled: boolean): void => {
			const btn = row.createEl("button", { cls: "hearth-share-mode" });
			btn.toggleClass("is-active", this.mode === mode);
			btn.setAttribute("aria-pressed", String(this.mode === mode));
			btn.disabled = !enabled;
			setIcon(btn.createSpan("hearth-share-mode-icon"), icon);
			btn.createSpan({ cls: "hearth-share-mode-label", text: label });
			btn.addEventListener("click", () => {
				if (this.mode === mode) return;
				this.mode = mode;
				// Publishing pins the strip on; coming back from it leaves it on,
				// which is the safe direction for a switch to be sticky in.
				if (mode === "publish") this.stripPrivate = true;
				this.render();
			});
		};

		tab("export", strings.saveFile, "download", true);
		tab("publish", t().gallery.browse.publish, "upload", configured);
		if (!configured) {
			row.createDiv({
				cls: "hearth-share-modes-note",
				text: galleryBlockedByExternalCalls(this.plugin)
					? t().gallery.errors.externalCallsOff
					: t().gallery.errors.noHost,
			});
		}
	}

	/** Name, description, category, tags — what a listing is made of, and what
	 * a file carries so it can become one later. */
	private renderListingFields(body: HTMLElement): void {
		const strings = t().portable.exportModal;

		new Setting(body)
			.setName(strings.name)
			.setDesc(strings.nameDesc)
			.addText((tx) =>
				tx.setValue(this.meta.name).onChange((v) => {
					this.meta.name = v;
				}),
			);

		new Setting(body)
			.setName(strings.description)
			.setDesc(strings.descriptionDesc)
			.addTextArea((ta) =>
				ta.setValue(this.meta.description).onChange((v) => {
					this.meta.description = v;
				}),
			);

		new Setting(body)
			.setName(t().gallery.publish.category)
			.setDesc(t().gallery.publish.categoryDesc)
			.addDropdown((dd) => {
				for (const category of GALLERY_CATEGORIES) {
					dd.addOption(category, t().gallery.categories[category]);
				}
				dd.setValue(this.meta.category).onChange((v) => {
					this.meta.category = asGalleryCategory(v);
				});
			});

		// What the board was built to look like under. A toggle rather than a
		// field, because the answer is already on the reader's screen and asking
		// them to type their own theme's name is asking them to get it wrong.
		const active = activeThemeName(this.plugin);
		new Setting(body)
			.setName(strings.theme)
			.setDesc(active ? strings.themeDesc(active) : strings.themeNone)
			.addToggle((tg) =>
				tg
					.setValue(this.theme !== "")
					.setDisabled(active === "")
					.onChange((v) => {
						this.theme = v ? active : "";
					}),
			);

		new Setting(body)
			.setName(strings.tags)
			.setDesc(strings.tagsDesc)
			.addText((tx) =>
				// `setValue` like the fields above it: this dialog redraws itself
				// when the identity row or the destination changes, and a field
				// that forgets what was typed still exports it — so the file would
				// carry tags the dialog had stopped showing.
				tx
					.setPlaceholder(strings.tagsPlaceholder)
					.setValue(this.meta.tags)
					.onChange((v) => {
						this.meta.tags = v;
					}),
			);
	}

	/**
	 * The content switches.
	 *
	 * The wallpaper is a top-level choice on both sides and on by default. It is
	 * the setting people look for, and burying it — or, worse, pinning it out of
	 * sight — means a published board arrives grey in every vault but its
	 * author's with nothing on screen having said it would.
	 *
	 * The strip is the difference between the two sides. Saving a file offers
	 * it, off by default, because a copy of your own board needs its paths to
	 * keep working. Publishing does it, and says what it takes rather than
	 * offering a switch: the list is right there, checkable in the details
	 * section against the actual values.
	 */
	private renderContentChoices(body: HTMLElement): void {
		const strings = t().portable.exportModal;

		// The wallpaper choice, which is the one people will look for.
		new Setting(body)
			.setName(strings.embedAssets)
			.setDesc(strings.embedAssetsDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.embedAssets !== false).onChange((v) => {
					this.opts.embedAssets = v;
					this.render();
				}),
			);

		if (this.publishing) {
			// Not a switch, and not one line of reassurance either: the four
			// groups that come out, named, and the two that stay, named — so
			// "what am I about to publish" is answered here rather than only
			// inside a disclosure nobody opens.
			const removed = new Setting(body).setName(strings.publishRemovesTitle);
			removed.settingEl.addClass("hearth-setting-note");
			const list = removed.descEl.createEl("ul", { cls: "hearth-export-values" });
			for (const line of strings.publishRemoves) list.createEl("li", { text: line });
			removed.descEl.createDiv({
				cls: "hearth-export-values-empty",
				text: strings.publishKeeps,
			});
			return;
		}

		new Setting(body)
			.setName(strings.stripPrivate)
			.setDesc(strings.stripPrivateDesc)
			.addToggle((tg) =>
				tg.setValue(this.stripPrivate).onChange((v) => {
					this.stripPrivate = v;
					note?.settingEl.toggleClass("is-hidden", v);
					this.redrawDetails();
				}),
			);

		// A count of what the file will mention, up here where it is read
		// without opening anything: an export carries paths on purpose, and
		// anyone about to publish one should meet that fact before they scroll
		// past it. It goes away when the switch above removes them.
		const note = this.referenceNote(body);
		note?.settingEl.toggleClass("is-hidden", this.stripPrivate);
	}

	private renderFooter(body: HTMLElement): void {
		const strings = t().portable.exportModal;
		new Setting(body)
			.addButton((b) => b.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(
						this.publishing
							? this.busy
								? t().gallery.publish.publishing
								: t().gallery.publish.button
							: strings.exportButton,
					)
					.setCta()
					.setDisabled(this.busy)
					.onClick(() => void (this.publishing ? this.runPublish() : this.runExport())),
			);
		if (Platform.isMobile && !this.publishing) {
			const note = new Setting(body).setDesc(t().settings.layout.exportMobileTooltip);
			note.settingEl.addClass("hearth-setting-note");
		}
	}

	/** One line saying how much of this vault the file mentions, or nothing when
	 * it mentions none of it. */
	private referenceNote(body: HTMLElement): Setting | null {
		const strings = t().portable.exportModal;
		const preview = describeReferences(
			exportPreviewPackage(this.plugin, this.dash, this.opts),
		);
		const paths = preview.byScope.vaultPath.length + preview.byScope.asset.length;
		const feeds = preview.byScope.privateUrl.length;
		if (paths === 0 && feeds === 0) return null;
		const note = new Setting(body).setDesc(strings.referenceNote(paths, feeds));
		note.settingEl.addClass("hearth-setting-note");
		return note;
	}

	// ---- The details section -------------------------------------------

	/** The disclosure itself. Empty until it is opened — the contents walk the
	 * whole package to list its references, and an export nobody expands should
	 * not pay for that. */
	private detailsSection(body: HTMLElement): void {
		const strings = t().portable.exportModal;
		const details = body.createEl("details", { cls: "hearth-export-details" });
		details.createEl("summary", { text: strings.detailsSummary });
		const inner = details.createDiv("hearth-export-details-body");
		this.details = details;
		details.addEventListener("toggle", () => {
			if (!details.open) return;
			this.renderDetails(inner);
		});
	}

	/** Rebuild the details in place, but only while they are on screen. */
	private redrawDetails(): void {
		const details = this.details;
		if (!details?.open) return;
		const inner = details.querySelector<HTMLElement>(".hearth-export-details-body");
		if (inner) this.renderDetails(inner);
	}

	private renderDetails(inner: HTMLElement): void {
		const strings = t().portable.exportModal;
		inner.empty();

		// The look, which is a question about *this* export rather than about
		// privacy, so it leads.
		new Setting(inner)
			.setName(strings.flatten)
			.setDesc(strings.flattenDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.flatten !== false).onChange((v) => {
					this.opts.flatten = v;
					// Flattening writes the vault's background onto the board, so
					// it can add a picture path to the lists below. Redraw, or
					// they stop being the truth.
					this.redrawDetails();
				}),
			);

		const pkg = exportPreviewPackage(this.plugin, this.dash, this.opts);

		if (this.stripPrivate) this.renderStripGroups(inner, pkg);
		else this.renderCarried(inner, pkg);
	}

	/** With the switch on: one row per group, each saying exactly what it takes
	 * out, and the values themselves underneath. */
	private renderStripGroups(inner: HTMLElement, pkg: HearthPackage): void {
		const strings = t().portable.exportModal;
		inner.createEl("p", { text: strings.stripIntro, cls: "hearth-modal-intro" });

		for (const group of STRIP_GROUPS) {
			const values = previewStrip(pkg, { [group]: true }).map((v) => v.value);
			// Publishing pins these two on, so they are shown as facts about the
			// upload rather than as choices that would be ignored.
			const pinned = this.publishing && (group === "paths" || group === "private");
			const setting = new Setting(inner)
				.setName(strings.groups[group])
				.setDesc(strings.groupDesc[group])
				.addToggle((tg) =>
					tg
						.setValue(pinned || this.strip[group] === true)
						.setDisabled(pinned)
						.onChange((v) => {
							this.strip[group] = v;
							this.redrawDetails();
						}),
				);
			// Nothing in this board falls in this group: say so rather than
			// offering a switch that would do nothing.
			if (values.length === 0) {
				setting.descEl.createDiv({
					cls: "hearth-export-values-empty",
					text: strings.groupEmpty,
				});
				continue;
			}
			if (!pinned && this.strip[group] !== true) continue;
			const list = setting.descEl.createEl("ul", { cls: "hearth-export-values" });
			for (const value of unique(values)) list.createEl("li", { text: value });
		}

		const total = previewStrip(pkg, this.effectiveStrip()).length;
		const note = new Setting(inner).setDesc(strings.stripTotal(total));
		note.settingEl.addClass("hearth-setting-note");
	}

	/** With the switch off: everything the file will mention, listed by what
	 * kind of thing it is. The same walk, read the other way round. */
	private renderCarried(inner: HTMLElement, pkg: HearthPackage): void {
		const strings = t().portable.exportModal;
		inner.createEl("p", { text: strings.carriedIntro, cls: "hearth-modal-intro" });

		const report = describeReferences(pkg);
		let anything = false;
		for (const group of STRIP_GROUPS) {
			const values = unique(
				GROUP_SCOPES[group].flatMap((scope) => report.byScope[scope]),
			);
			if (values.length === 0) continue;
			anything = true;
			const setting = new Setting(inner).setName(strings.groups[group]);
			setting.settingEl.addClass("hearth-setting-note");
			const list = setting.descEl.createEl("ul", { cls: "hearth-export-values" });
			for (const value of values) list.createEl("li", { text: value });
		}
		if (!anything) {
			inner.createEl("p", { text: strings.carriedNothing, cls: "hearth-modal-intro" });
		}
	}

	// ---- Running --------------------------------------------------------

	/** The strip as it will actually run: the tuned groups, with the two a
	 * publish pins forced on. One function, so the total shown in the details
	 * section is computed from the same thing the export uses. */
	private effectiveStrip(): StripOptions {
		return this.publishing
			? { ...this.strip, paths: true, private: true }
			: { ...this.strip };
	}

	/** Split from the tags field so both destinations lower-case and de-blank
	 * them the same way. */
	private tagList(): string[] {
		return this.meta.tags
			.split(",")
			.map((tag) => tag.trim().toLowerCase())
			.filter((tag) => tag !== "");
	}

	/**
	 * Give the board its published identity, if it hasn't got one.
	 *
	 * Sharing is the moment a board becomes a shared work, so it is given an
	 * identity here and keeps it. Without that, every export of the same board
	 * would be a different dashboard as far as an importer could tell, and
	 * "here's the updated version" could only ever land beside the old one.
	 */
	private async ensureSourceId(): Promise<void> {
		if (this.dash.sourceId) return;
		this.dash.sourceId = newSourceId();
		await this.plugin.saveData(this.plugin.settings);
	}

	private async runExport(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		const strings = t().portable.exportModal;
		try {
			await this.ensureSourceId();
			const tags = this.tagList();
			const outcome = await exportDashboardFile(this.app, this.plugin.settings, this.dash, {
				...this.opts,
				strip: this.stripPrivate ? this.effectiveStrip() : undefined,
				// The signing key, not the handle: `exportDashboardFile` signs the
				// finished file (see `signature.ts`), and the handle it prints is
				// computed from the key rather than passed in beside it.
				signWith: this.includeIdentity
					? (vaultIdentity(this.plugin, true)?.key ?? undefined)
					: undefined,
				...commonOptions(this.plugin),
				meta: {
					name: this.meta.name.trim() || this.dash.name,
					description: this.meta.description.trim() || undefined,
					category: this.meta.category,
					theme: this.theme || undefined,
					snapshot: this.snapshot ?? undefined,
					tags: tags.length ? tags : undefined,
				},
			});
			this.close();
			await saveExport(this.app, dashboardFilename(this.meta.name), outcome.json);
			// Embedding can decline: a wallpaper over the cap, or one no longer in
			// the vault. Saying so beats a board that turns up bare.
			const skipped = outcome.assets?.skipped ?? [];
			if (skipped.length) {
				new Notice(strings.assetsSkipped(skipped.map((a) => a.path).join(", ")));
			}
			// A residual is the strip's own admission that the reference table
			// missed something. Rare, and worth a look before the file is shared.
			const residual = outcome.strip?.residual ?? [];
			if (residual.length) {
				new Notice(strings.stripResidual(residual.length));
			}
			// Asked for a signature and didn't get one: the file is still a good
			// board, but it will import as unattributed, and finding that out
			// from the importer is worse than hearing it here.
			if (this.includeIdentity && !outcome.signed) {
				new Notice(strings.signFailed);
			}
		} catch {
			new Notice(t().notices.exportFailed);
		} finally {
			this.busy = false;
		}
	}

	private async runPublish(): Promise<void> {
		if (this.busy) return;
		const strings = t().gallery.publish;
		const client = galleryClient(this.plugin);
		if (!client) {
			new Notice(t().gallery.errors.noHost);
			return;
		}
		if (!this.meta.name.trim() && !this.dash.name.trim()) {
			new Notice(strings.needsName);
			return;
		}
		const identity = vaultIdentity(this.plugin, true);
		if (!identity) {
			new Notice(t().gallery.errors.unsigned);
			return;
		}

		this.busy = true;
		this.render();
		try {
			await this.ensureSourceId();
			const result = await publishDashboard(
				client,
				this.app,
				this.plugin.settings,
				this.dash,
				{
					name: this.meta.name,
					description: this.meta.description,
					category: this.meta.category,
					theme: this.theme,
					snapshot: this.snapshot,
					tags: this.tagList(),
					strip: this.effectiveStrip(),
					flatten: this.opts.flatten !== false,
					signWith: identity.key,
				},
				commonOptions(this.plugin),
				identity.publicKey,
			);
			this.close();
			const name = this.meta.name.trim() || this.dash.name;
			new Notice(
				result.held
					? strings.doneHeld(name)
					: result.updated
						? strings.doneUpdate(name)
						: strings.done(name),
			);
			// The two things a successful publish should still say out loud: a
			// picture that couldn't be carried, and the strip's own admission
			// that the reference table missed something.
			if (result.skippedAssets.length) {
				new Notice(
					t().portable.exportModal.assetsSkipped(result.skippedAssets.join(", ")),
				);
			}
			if (result.residual.length) new Notice(strings.residual(result.residual.length));
		} catch (err) {
			new Notice(
				err instanceof GalleryError && err.code === "rejected" && err.detail === "unsigned"
					? t().gallery.errors.unsigned
					: galleryErrorText(err),
			);
		} finally {
			this.busy = false;
			if (this.containerEl.isConnected) this.render();
		}
	}
}

/**
 * The active community theme's name, or "" for Obsidian's default look.
 *
 * `customCss` is an internal, so it is read defensively: a build that doesn't
 * have it, or has it in another shape, means the toggle is simply not offered
 * rather than the dialog failing to draw.
 */
function activeThemeName(plugin: HearthPlugin): string {
	const theme = plugin.app.customCss?.theme;
	return typeof theme === "string" ? theme.trim().slice(0, 60) : "";
}

/** Distinct values, in the order first seen. */
function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

/** A package built for preview only: the same capture the export runs, so the
 * counts shown are the counts the file will carry — but nothing is read from
 * disk and nothing is written. */
function exportPreviewPackage(
	plugin: HearthPlugin,
	dash: Dashboard,
	opts: ExportDashboardOptions,
): HearthPackage {
	return captureDashboard(plugin.settings, dash, opts);
}

/** A filename from the board's name: lower case, words joined by hyphens, and
 * always recognisable as a Hearth dashboard. */
export function dashboardFilename(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return slug ? `hearth-dashboard-${slug}.json` : PACKAGE_FILENAMES.dashboard;
}

/** Pick a file and open the import dialog for it. */
export async function pickAndImport(plugin: HearthPlugin): Promise<void> {
	const json = await pickTextFile();
	if (json === null) return;
	const outcome = readPackage(json);
	if (!outcome.pkg) {
		new Notice(t().notices.layoutImportError(t().layout.notAHearthLayout));
		return;
	}
	new ImportModal(plugin, json, outcome.pkg).open();
}

/**
 * What you are about to import, then the choice of how.
 *
 * Reads the file and describes it before touching anything: its name and
 * author, what it needs installed, which of its notes this vault hasn't got,
 * whether it brought its pictures. The default lands it as a new board and
 * leaves every global setting alone; a package this vault has imported before
 * can be updated in place instead.
 */
class ImportModal extends Modal {
	private plugin: HearthPlugin;
	private json: string;
	private pkg: HearthPackage;
	private existing?: Dashboard;
	private mode: "add" | "replaceBoard" | "replaceAll" = "add";
	/** Checked once, before anything mutates the package: applying it rewrites
	 * asset references, which would invalidate a signature that was fine. */
	private signature: SignatureState;
	private busy = false;

	constructor(plugin: HearthPlugin, json: string, pkg: HearthPackage) {
		super(plugin.app);
		this.plugin = plugin;
		this.json = json;
		this.pkg = pkg;
		this.signature = verifyPackageSignature(pkg);
		this.existing = existingBoardFor(plugin.settings, pkg);
		// A whole-vault file defaults to what it is: a restore.
		if (pkg.hearth.kind !== "dashboard") this.mode = "replaceAll";
		else if (this.existing) this.mode = "replaceBoard";
	}

	onOpen(): void {
		this.titleEl.setText(t().portable.importModal.title);
		this.render();
	}

	/** Drawn from scratch whenever the mode changes, since the warning list and
	 * the confirm button's emphasis both depend on it. */
	private render(): void {
		const strings = t().portable.importModal;
		const body = this.contentEl;
		body.empty();

		this.summary(body);
		this.modeChoice(body);
		this.warnings(body);

		new Setting(body)
			.addButton((b) => b.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((b) => {
				b.setButtonText(strings.importButton)
					.setCta()
					.onClick(() => void this.run());
				// A restore throws the vault's own settings away, so it reads as
				// the destructive action it is.
				if (this.mode === "replaceAll") b.buttonEl.addClass("hearth-danger-btn");
			});
	}

	/** Name, author, description, and what the package is. */
	private summary(body: HTMLElement): void {
		const strings = t().portable.importModal;
		const meta = this.pkg.meta;
		const report = describeReferences(this.pkg);

		const kindLabel = strings.kinds[this.pkg.hearth.kind];
		const name = meta?.name?.trim();
		body.createEl("h3", { text: name || kindLabel, cls: "hearth-import-name" });
		// An author is shown only when the file's signature checks out. The name
		// in `meta.author` is never read: it is recomputed from the public key,
		// and then only believed if the signature proves the holder of that key
		// made this file. See `portable/signature.ts`.
		const author = packageAuthor(this.pkg);
		const byline = [
			kindLabel,
			author ? strings.by(author) : "",
			this.pkg.hearth.plugin ? strings.madeWith(this.pkg.hearth.plugin) : "",
		].filter((part) => part !== "");
		body.createEl("p", { text: byline.join(" · "), cls: "hearth-import-byline" });
		// A broken signature is worth saying out loud, because it means one of
		// two specific things — the file was edited after it was signed, or
		// somebody copied an author's handle without being able to sign for it.
		if (this.signature === "invalid") {
			body.createEl("p", {
				text: strings.signatureInvalid,
				cls: "hearth-setting-warning hearth-import-warning",
			});
		}
		if (meta?.description?.trim()) {
			body.createEl("p", { text: meta.description.trim() });
		}

		const facts: string[] = [];
		if (report.cardKinds.length) facts.push(strings.cardCount(report.cardKinds.length));
		if (report.assetCount) facts.push(strings.assetCount(report.assetCount));
		const paths = report.byScope.vaultPath.length + report.byScope.asset.length;
		if (paths) facts.push(strings.pathCount(paths));
		if (this.pkg.requires?.plugins?.length) {
			facts.push(strings.needsPlugins(this.pkg.requires.plugins.join(", ")));
		}
		if (facts.length) {
			const list = body.createEl("ul", { cls: "hearth-setting-note-list" });
			for (const fact of facts) list.createEl("li", { text: fact });
		}
	}

	/** Add, update in place, or restore. */
	private modeChoice(body: HTMLElement): void {
		const strings = t().portable.importModal;
		const isDashboard = this.pkg.hearth.kind === "dashboard";

		new Setting(body)
			.setName(strings.mode)
			.setDesc(strings.modeDesc)
			.addDropdown((d) => {
				d.addOption("add", isDashboard ? strings.modeAdd : strings.modeAddBoards);
				if (isDashboard && this.existing) {
					d.addOption("replaceBoard", strings.modeReplaceBoard(this.existing.name));
				}
				if (!isDashboard) d.addOption("replaceAll", strings.modeReplaceAll);
				d.setValue(this.mode);
				d.onChange((v) => {
					this.mode = v as typeof this.mode;
					this.render();
				});
			});

		if (this.mode === "replaceAll") {
			const note = new Setting(body).setDesc(strings.replaceAllWarning);
			note.settingEl.addClass("hearth-setting-warning");
		}
	}

	/** What this vault is missing, checked before anything is applied. */
	private warnings(body: HTMLElement): void {
		const env = vaultEnvironment(this.app);
		const report = describeReferences(this.pkg);
		const missing: string[] = [];
		for (const path of report.byScope.vaultPath) {
			if (!env.pathExists?.(path, false) && !env.pathExists?.(path, true)) {
				missing.push(path);
			}
		}
		const missingPlugins = (this.pkg.requires?.plugins ?? []).filter(
			(id) => !env.pluginEnabled?.(id),
		);
		// A board can name pages and pictures on the web — an embedded page, a
		// feed, a wallpaper by URL. Worth saying plainly for a board that came
		// from someone else, because opening it will fetch them.
		const remote = report.byScope.publicUrl;
		if (missing.length === 0 && missingPlugins.length === 0 && remote.length === 0) {
			return;
		}

		const strings = t().portable.importModal;
		const note = new Setting(body).setName(strings.heads).setHeading();
		note.settingEl.addClass("hearth-setting-note");
		const list = body.createEl("ul", { cls: "hearth-setting-note-list" });
		if (missingPlugins.length) {
			list.createEl("li", { text: strings.missingPlugins(missingPlugins.join(", ")) });
		}
		if (missing.length) {
			list.createEl("li", {
				text: strings.missingPaths(missing.length, missing.slice(0, 3).join(", ")),
			});
		}
		if (remote.length) {
			list.createEl("li", { text: strings.remoteContent(remote.length) });
		}
		list.createEl("li", { text: strings.missingFine });
	}

	private async run(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			const result = await importPackageFile(this.app, this.plugin.settings, this.json, {
				mode: this.mode,
				targetBoardId: this.existing?.id,
				env: vaultEnvironment(this.app),
			});
			if (!result.ok) {
				new Notice(t().notices.layoutImportError(result.error ?? ""));
				return;
			}
			this.close();
			await this.plugin.saveSettings();
			// An import can carry a different tab icon or theme-colour target, and
			// neither the ribbon button nor an open tab header is redrawn by a
			// settings save on its own.
			this.plugin.refreshBrandIcons();
			if (result.activeDashboardId) {
				this.plugin.setActiveDashboard(result.activeDashboardId);
			}
			new Notice(importedNotice(result));
		} finally {
			this.busy = false;
		}
	}
}

/** One line saying what the import did, and what to know about it. */
export function importedNotice(result: ImportResult): string {
	const strings = t().portable.importModal;
	const parts: string[] = [];
	if (result.added.length === 1) parts.push(strings.addedOne(result.added[0].name));
	else if (result.added.length > 1) parts.push(strings.addedMany(result.added.length));
	if (result.replaced.length === 1) {
		parts.push(strings.replacedOne(result.replaced[0].name));
	} else if (result.replaced.length > 1) {
		parts.push(strings.restored);
	}
	if (result.assetsWritten.length) {
		parts.push(strings.assetsWritten(result.assetsWritten.length));
	}
	const summary = warningSummary(result.warnings);
	if (summary) parts.push(summary);
	return parts.join(" ") || t().notices.layoutImported;
}

/** The warnings worth putting in a notice, counted rather than listed. */
function warningSummary(warnings: ImportWarning[]): string {
	const strings = t().portable.importModal;
	const count = (code: ImportWarning["code"]): number =>
		warnings.filter((w) => w.code === code).length;
	const parts: string[] = [];
	const paths = count("missingPath");
	if (paths) parts.push(strings.warnMissingPaths(paths));
	const plugins = count("missingPlugin");
	if (plugins) parts.push(strings.warnMissingPlugins(plugins));
	if (count("settingRequired")) parts.push(strings.warnTaskFields);
	if (count("unknownCardKind")) parts.push(strings.warnUnknownCards);
	if (count("assetMissing")) parts.push(strings.warnAssets);
	return parts.join(" ");
}
