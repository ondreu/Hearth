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

import { type App, Modal, Notice, Platform, Setting, TFile } from "obsidian";
import type HearthPlugin from "./main";
import type { Dashboard } from "./types";
import { detectLanguage, t } from "./i18n";
import { downloadTextFile, pickTextFile, promptForText } from "./ui";
import { type AuthorIdentity, identityFromKey, newAuthorKey } from "./identity";
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

/** Open the export dialog for one board. */
export function openExportDashboard(plugin: HearthPlugin, dash: Dashboard): void {
	new ExportDashboardModal(plugin, dash).open();
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
 * `decorate` adds a control ahead of the two buttons — the export dialog puts
 * its "include this" switch there. `onChanged` is called after the key is
 * replaced, since the handle on screen is then the wrong one. `mint` is for the
 * dialog that is about to use the identity; see {@link vaultIdentity}.
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
		.setDesc(identity ? strings.identityDesc(identity.handle) : strings.identityNew);
	decorate?.(row);
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
	return row;
}

/** Asking for the key is asking for an identity, so this mints one if the vault
 * hasn't got one yet — writing it down before it is needed is the whole point
 * of the button. */
async function copyRecoveryKey(plugin: HearthPlugin, onChanged: () => void): Promise<void> {
	const strings = t().portable.exportModal;
	const had = plugin.settings.authorKey !== "";
	const identity = vaultIdentity(plugin, true);
	if (!identity) return;
	try {
		await navigator.clipboard.writeText(identity.key);
		new Notice(strings.identityCopied);
	} catch {
		// A clipboard a plugin can't reach is not a reason to lose the key:
		// show it instead, so it can be selected by hand.
		new Notice(strings.identityCopyFailed(identity.key));
	}
	// The row said "you'll get one when you export"; now there is one to show.
	if (!had) onChanged();
}

/** Paste a key from another install. The handle comes back with it — that is
 * what carrying the key means. */
async function restoreIdentity(plugin: HearthPlugin, onChanged: () => void): Promise<void> {
	const strings = t().portable.exportModal;
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
class ExportDashboardModal extends Modal {
	private plugin: HearthPlugin;
	private dash: Dashboard;
	private opts: ExportDashboardOptions = { flatten: true, embedAssets: true };
	/** The one-switch summary of the section below. */
	private stripPrivate = false;
	/** What that switch means, tunable in the details section. */
	private strip: StripOptions = { ...DEFAULT_STRIP };
	private includeIdentity = true;
	private meta = { name: "", description: "", tags: "" };
	private busy = false;
	/** The disclosure, so a choice above it can redraw its contents in place. */
	private details?: HTMLDetailsElement;

	constructor(plugin: HearthPlugin, dash: Dashboard) {
		super(plugin.app);
		this.plugin = plugin;
		this.dash = dash;
		this.meta.name = dash.name;
	}

	onOpen(): void {
		this.render();
	}

	/** Drawn from scratch, so replacing the vault's identity can redraw the row
	 * that shows it. */
	private render(): void {
		const strings = t().portable.exportModal;
		this.titleEl.setText(strings.title);
		const body = this.contentEl;
		body.empty();
		body.createEl("p", { text: strings.intro, cls: "hearth-modal-intro" });

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
			.setName(strings.tags)
			.setDesc(strings.tagsDesc)
			.addText((tx) =>
				tx.setPlaceholder(strings.tagsPlaceholder).onChange((v) => {
					this.meta.tags = v;
				}),
			);

		identitySetting(this.plugin, body, () => this.render(), {
			// About to publish: the handle has to exist so it can be shown.
			mint: true,
			decorate: (row) => {
				row.addToggle((tg) =>
					tg.setValue(this.includeIdentity).onChange((v) => {
						this.includeIdentity = v;
					}),
				);
			},
		});

		new Setting(body).setName(strings.contents).setHeading();

		// The wallpaper choice, which is the one people will look for.
		new Setting(body)
			.setName(strings.embedAssets)
			.setDesc(strings.embedAssetsDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.embedAssets !== false).onChange((v) => {
					this.opts.embedAssets = v;
				}),
			);

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

		this.detailsSection(body);

		new Setting(body)
			.addButton((b) => b.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(strings.exportButton)
					.setCta()
					.onClick(() => void this.run()),
			);
		if (Platform.isMobile) {
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
			const setting = new Setting(inner)
				.setName(strings.groups[group])
				.setDesc(strings.groupDesc[group])
				.addToggle((tg) =>
					tg.setValue(this.strip[group] === true).onChange((v) => {
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
			if (this.strip[group] !== true) continue;
			const list = setting.descEl.createEl("ul", { cls: "hearth-export-values" });
			for (const value of unique(values)) list.createEl("li", { text: value });
		}

		const total = previewStrip(pkg, this.strip).length;
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

	private async run(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		const strings = t().portable.exportModal;
		try {
			// Exporting is the moment a board becomes a shared work, so it is
			// given an identity here and keeps it. Without that, every export of
			// the same board would be a different dashboard as far as an importer
			// could tell, and "here's the updated version" could only ever land
			// beside the old one. Saved, so the next export agrees with this one.
			if (!this.dash.sourceId) {
				this.dash.sourceId = newSourceId();
				await this.plugin.saveData(this.plugin.settings);
			}
			const tags = this.meta.tags
				.split(",")
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => tag !== "");
			const outcome = await exportDashboardFile(this.app, this.plugin.settings, this.dash, {
				...this.opts,
				strip: this.stripPrivate ? this.strip : undefined,
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
		} catch {
			new Notice(t().notices.exportFailed);
		} finally {
			this.busy = false;
		}
	}
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
