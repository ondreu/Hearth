import { addIcon, Plugin, TFolder, WorkspaceLeaf, Notice } from "obsidian";
import { HomeView, VIEW_TYPE_HOME } from "./view";
import { DEFAULT_SETTINGS, fillMissingDefaults, HomeSettings, migrateSettings } from "./types";
import { HomeSettingTab } from "./settings";
import { HEARTH_ICON_ID, HEARTH_ICON_SVG } from "./icon";
import { EXCALIDRAW_PLUGIN_ID } from "./filetypes";
import { setLanguage, t } from "./i18n";
import { maybeShowWhatsNew } from "./whatsnew";

/** Core "Audio recorder" plugin id, used by the "Record voice" mobile action. */
const AUDIO_RECORDER_PLUGIN_ID = "audio-recorder";

export default class HearthPlugin extends Plugin {
	settings: HomeSettings;
	/** True when this load had no persisted data at all (a brand-new install),
	 * as opposed to an existing vault that simply predates a given setting.
	 * Used so the "What's new" dialog greets upgraders but not first-timers. */
	isFirstRun = false;

	async onload() {
		// Pick the locale from Obsidian's UI language before anything renders or
		// registers a translated command name.
		setLanguage();

		await this.loadSettings();

		// Register the Hearth crystal so it can be used as the ribbon, tab and
		// header icon.
		addIcon(HEARTH_ICON_ID, HEARTH_ICON_SVG);

		this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));

		this.addRibbonIcon(HEARTH_ICON_ID, t().ribbon.openHome, () => this.activateView());

		this.addCommand({
			id: "open-home",
			name: t().commands.openHome,
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "new-note",
			name: t().commands.newNote,
			callback: () => this.createNewNote(),
		});

		this.addCommand({
			id: "new-drawing",
			name: t().commands.newDrawing,
			callback: () => this.createNewDrawing(),
		});

		this.addCommand({
			id: "record-voice",
			name: t().commands.recordVoice,
			callback: () => this.recordVoice(),
		});

		this.addCommand({
			id: "open-daily-note",
			name: t().commands.openDailyNote,
			callback: () => this.openDailyNote(),
		});

		this.registerDashboardCommands();

		this.addSettingTab(new HomeSettingTab(this.app, this));

		// Replace freshly-opened empty tabs with the home view.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => this.maybeReplaceNewTab(leaf)),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openOnStartup) void this.activateView();
			// Pop the release-notes dialog after an update (but not on a fresh
			// install). Runs once layout is ready so it doesn't fight startup.
			void maybeShowWhatsNew(this);
		});
	}

	onunload() {
		// Views are detached automatically by Obsidian on plugin unload.
	}

	private maybeReplaceNewTab(leaf: WorkspaceLeaf | null) {
		if (!leaf || !this.settings.replaceNewTabs) return;
		if (leaf.getViewState().type !== "empty") return;
		void leaf.setViewState({ type: VIEW_TYPE_HOME });
	}

	/** Switch the active dashboard and refresh any open home views. */
	setActiveDashboard(id: string) {
		if (this.settings.activeDashboardId === id) return;
		this.settings.activeDashboardId = id;
		void this.saveData(this.settings);
		this.refreshViews();
	}

	private cycleDashboard(direction: 1 | -1) {
		const dashboards = this.settings.dashboards;
		if (dashboards.length < 2) return;
		const current = dashboards.findIndex(
			(d) => d.id === this.settings.activeDashboardId,
		);
		const start = current < 0 ? 0 : current;
		const next = (start + direction + dashboards.length) % dashboards.length;
		this.setActiveDashboard(dashboards[next].id);
	}

	/**
	 * Commands to jump straight to a dashboard by position, plus next/previous.
	 * No default hotkeys are bound (Mod+number is taken by core tab switching);
	 * users can assign their own in Settings → Hotkeys.
	 */
	private registerDashboardCommands() {
		for (let i = 1; i <= 9; i++) {
			this.addCommand({
				id: `switch-dashboard-${i}`,
				name: t().commands.switchDashboard(i),
				checkCallback: (checking) => {
					const dash = this.settings.dashboards[i - 1];
					if (!dash) return false;
					if (!checking) this.setActiveDashboard(dash.id);
					return true;
				},
			});
		}

		this.addCommand({
			id: "next-dashboard",
			name: t().commands.nextDashboard,
			callback: () => this.cycleDashboard(1),
		});
		this.addCommand({
			id: "previous-dashboard",
			name: t().commands.previousDashboard,
			callback: () => this.cycleDashboard(-1),
		});
	}

	async activateView() {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true });
		await workspace.revealLeaf(leaf);
	}

	/** Create a new note in the user's configured default location and open it. */
	async createNewNote() {
		try {
			const parent = this.app.fileManager.getNewFileParent("");
			const file = await this.app.fileManager.createNewMarkdownFile(
				parent instanceof TFolder ? parent : this.app.vault.getRoot(),
				"Untitled",
			);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file);
		} catch (err) {
			// Fall back to the core command if the internal API shape changes.
			if (!this.app.commands.executeCommandById("file-explorer:new-file")) {
				new Notice(t().notices.couldNotCreateNote);
				console.error("Hearth new note error", err);
			}
		}
	}

	/** Create a new Excalidraw drawing via the Excalidraw plugin's own "new
	 * drawing" command (its id isn't part of any stable API, so it's matched
	 * by prefix + name rather than hardcoded). */
	createNewDrawing() {
		if (!this.app.plugins.enabledPlugins.has(EXCALIDRAW_PLUGIN_ID)) {
			new Notice(t().notices.enableExcalidraw);
			return;
		}
		const cmd = this.app.commands
			.listCommands()
			.find((c) => c.id.startsWith(`${EXCALIDRAW_PLUGIN_ID}:`) && /new/i.test(c.name));
		if (!cmd || !this.app.commands.executeCommandById(cmd.id)) {
			new Notice(t().notices.excalidrawCommandMissing);
		}
	}

	/** Start/stop voice recording via the core Audio recorder plugin. */
	recordVoice() {
		const plugin = this.app.internalPlugins.getPluginById(AUDIO_RECORDER_PLUGIN_ID);
		if (!plugin?.enabled) {
			new Notice(t().notices.enableAudioRecorder);
			return;
		}
		const cmd = this.app.commands
			.listCommands()
			.find((c) => c.id.startsWith(`${AUDIO_RECORDER_PLUGIN_ID}:`));
		if (!cmd || !this.app.commands.executeCommandById(cmd.id)) {
			new Notice(t().notices.couldNotRecordVoice);
		}
	}

	/** Open today's daily note via the core Daily notes plugin. */
	openDailyNote() {
		const plugin = this.app.internalPlugins.getPluginById("daily-notes");
		if (!plugin?.enabled) {
			new Notice(t().notices.enableDailyNotes);
			return;
		}
		if (!this.app.commands.executeCommandById("daily-notes")) {
			new Notice(t().notices.couldNotOpenDaily);
		}
	}

	/** Run any command by id, surfacing a Notice if it no longer resolves (e.g.
	 * the plugin providing it was disabled). Used by the mobile action bar. */
	runCommandOrNotice(commandId: string) {
		if (!commandId || !this.app.commands.executeCommandById(commandId)) {
			new Notice(t().notices.commandNotFound(commandId));
		}
	}

	async loadSettings() {
		const raw = ((await this.loadData()) ?? {}) as Record<string, unknown>;
		// No persisted keys at all => a genuinely fresh install. An existing vault
		// that merely lacks a newly-added field (like lastSeenVersion) still has
		// its other settings here, so it is correctly treated as an upgrade.
		this.isFirstRun = Object.keys(raw).length === 0;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		// Backfill nested config defaults too, not just top-level keys, so an
		// object persisted by an older version isn't missing a nested field.
		fillMissingDefaults(
			this.settings as unknown as Record<string, unknown>,
			DEFAULT_SETTINGS as unknown as Record<string, unknown>,
		);
		// A one-way migration (e.g. the commandId → target fold) mutates settings
		// in memory only; without flushing it here the legacy data would survive
		// in storage and the migration would re-run every start, never actually
		// retiring the deprecated field. Persist immediately when that happens.
		const migrated = migrateSettings(this.settings, raw);
		if (migrated) await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	refreshViews() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof HomeView) view.render();
		});
	}
}
