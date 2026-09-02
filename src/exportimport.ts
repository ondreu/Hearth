/**
 * The dialogs around the portable-package engine: export a board, import a
 * file, back up and restore a vault.
 *
 * Everything about *what* travels lives in `src/portable/`; this file is the
 * two conversations that wrap it.
 *
 * On the way out the question is what to include — a shared board usually wants
 * its wallpaper carried and its look pinned, a backup of your own vault wants
 * neither — and none of it is guessed: the dialog asks, with the consequence of
 * each choice written next to it.
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
import { downloadTextFile, pickTextFile } from "./ui";
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
	PACKAGE_FILENAMES,
	readPackage,
	vaultEnvironment,
} from "./portable";

/** Save an export: download it (desktop) or write it to the vault root (mobile,
 * which can't download). Shared by every export route. */
export async function saveExport(
	app: App,
	filename: string,
	content: string,
): Promise<void> {
	if (!Platform.isMobile) {
		downloadTextFile(filename, content);
		new Notice(t().notices.layoutExported);
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
	await saveExport(plugin.app, PACKAGE_FILENAMES.layout, outcome.json);
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
 * Export one board, with the choices that change what the file is for.
 *
 * The defaults describe sharing, because that is what exporting a single board
 * is nearly always for: pin the look, carry the pictures, leave the vault-wide
 * extras behind. Every one of them can be turned around.
 */
class ExportDashboardModal extends Modal {
	private plugin: HearthPlugin;
	private dash: Dashboard;
	private opts: ExportDashboardOptions = {
		flatten: true,
		embedAssets: true,
		includePinnedCards: false,
		includeFavorites: false,
	};
	private meta = { name: "", description: "", author: "", tags: "" };
	private busy = false;

	constructor(plugin: HearthPlugin, dash: Dashboard) {
		super(plugin.app);
		this.plugin = plugin;
		this.dash = dash;
		this.meta.name = dash.name;
	}

	onOpen(): void {
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
			.setName(strings.author)
			.setDesc(strings.authorDesc)
			.addText((tx) =>
				tx.setValue(this.meta.author).onChange((v) => {
					this.meta.author = v;
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
			.setName(strings.pinLook)
			.setDesc(strings.pinLookDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.flatten !== false).onChange((v) => {
					this.opts.flatten = v;
				}),
			);

		new Setting(body)
			.setName(strings.includePinned)
			.setDesc(strings.includePinnedDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.includePinnedCards === true).onChange((v) => {
					this.opts.includePinnedCards = v;
				}),
			);

		new Setting(body)
			.setName(strings.includeFavorites)
			.setDesc(strings.includeFavoritesDesc)
			.addToggle((tg) =>
				tg.setValue(this.opts.includeFavorites === true).onChange((v) => {
					this.opts.includeFavorites = v;
				}),
			);

		// What the file will say about the author's vault. Shown rather than
		// buried: an export carries paths on purpose (the author's own copy has
		// to keep working), and anyone about to publish one should know that.
		this.referenceNote(body);

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

	/** A count of what this board points at in the vault, so "this file mentions
	 * my folders" is never a surprise. */
	private referenceNote(body: HTMLElement): void {
		const strings = t().portable.exportModal;
		const preview = describeReferences(
			exportPreviewPackage(this.plugin, this.dash, this.opts),
		);
		const paths = preview.byScope.vaultPath.length + preview.byScope.asset.length;
		const feeds = preview.byScope.privateUrl.length;
		if (paths === 0 && feeds === 0) return;
		const note = new Setting(body).setDesc(strings.referenceNote(paths, feeds));
		note.settingEl.addClass("hearth-setting-note");
	}

	private async run(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		const strings = t().portable.exportModal;
		try {
			const tags = this.meta.tags
				.split(",")
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => tag !== "");
			const outcome = await exportDashboardFile(this.app, this.plugin.settings, this.dash, {
				...this.opts,
				...commonOptions(this.plugin),
				meta: {
					name: this.meta.name.trim() || this.dash.name,
					description: this.meta.description.trim() || undefined,
					author: this.meta.author.trim() || undefined,
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
		} catch {
			new Notice(t().notices.exportFailed);
		} finally {
			this.busy = false;
		}
	}
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
	private applyPinnedCards = false;
	private applyFavorites = false;
	private busy = false;

	constructor(plugin: HearthPlugin, json: string, pkg: HearthPackage) {
		super(plugin.app);
		this.plugin = plugin;
		this.json = json;
		this.pkg = pkg;
		this.existing = existingBoardFor(plugin.settings, pkg);
		// A whole-vault file defaults to what it is: a restore.
		if (pkg.hearth.kind !== "dashboard") this.mode = "replaceAll";
		else if (this.existing) this.mode = "replaceBoard";
	}

	onOpen(): void {
		const strings = t().portable.importModal;
		this.titleEl.setText(strings.title);
		const body = this.contentEl;
		body.empty();

		this.summary(body);
		this.modeChoice(body);
		this.extras(body);
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
		const byline = [
			kindLabel,
			meta?.author?.trim() ? strings.by(meta.author.trim()) : "",
			this.pkg.hearth.plugin ? strings.madeWith(this.pkg.hearth.plugin) : "",
		].filter((part) => part !== "");
		body.createEl("p", { text: byline.join(" · "), cls: "hearth-import-byline" });
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
					// The warning list and the button's emphasis both depend on it.
					this.onOpen();
				});
			});

		if (this.mode === "replaceAll") {
			const note = new Setting(body).setDesc(strings.replaceAllWarning);
			note.settingEl.addClass("hearth-setting-warning");
		}
	}

	/** The vault-wide extras a package may carry, each off until asked for. */
	private extras(body: HTMLElement): void {
		const strings = t().portable.importModal;
		if (this.pkg.hearth.kind !== "dashboard" || this.mode === "replaceAll") return;
		const payload = this.pkg.payload as {
			pinnedCards?: unknown[];
			favorites?: unknown[];
		};
		if (payload.pinnedCards?.length) {
			new Setting(body)
				.setName(strings.applyPinned)
				.setDesc(strings.applyPinnedDesc(payload.pinnedCards.length))
				.addToggle((tg) =>
					tg.setValue(this.applyPinnedCards).onChange((v) => {
						this.applyPinnedCards = v;
					}),
				);
		}
		if (payload.favorites?.length) {
			new Setting(body)
				.setName(strings.applyFavorites)
				.setDesc(strings.applyFavoritesDesc(payload.favorites.length))
				.addToggle((tg) =>
					tg.setValue(this.applyFavorites).onChange((v) => {
						this.applyFavorites = v;
					}),
				);
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
		if (missing.length === 0 && missingPlugins.length === 0) return;

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
		list.createEl("li", { text: strings.missingFine });
	}

	private async run(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			const result = await importPackageFile(this.app, this.plugin.settings, this.json, {
				mode: this.mode,
				targetBoardId: this.existing?.id,
				applyPinnedCards: this.applyPinnedCards,
				applyFavorites: this.applyFavorites,
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
