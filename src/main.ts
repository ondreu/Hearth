import { addIcon, debounce, Platform, Plugin, setIcon, TFolder, WorkspaceLeaf, Notice } from "obsidian";
import { HomeView, VIEW_TYPE_HOME } from "./view";
import { DEFAULT_SETTINGS, fillMissingDefaults, HomeSettings, migrateSettings, timersAllowed } from "./types";
import { HomeSettingTab } from "./settings";
import {
	HEARTH_ICON_ID,
	HEARTH_ICON_SVG,
	HEARTH_ICON_THEMED_ID,
	HEARTH_ICON_THEMED_SVG,
	tabIconIdFor,
} from "./icon";
import type { WorkspacesInstance } from "./obsidian-ext";
import { openFile } from "./opener";
import { EXCALIDRAW_PLUGIN_ID } from "./filetypes";
import { setLanguage, t } from "./i18n";
import { maybeShowWhatsNew } from "./whatsnew";
import { maybeRunSetup, openSetupWizard } from "./onboarding";
import { clearContentSearchCache } from "./query";
import { forgetTaxonomy, OperonSession } from "./operon";

/** Core "Audio recorder" plugin id, used by the "Record voice" mobile action. */
const AUDIO_RECORDER_PLUGIN_ID = "audio-recorder";

/**
 * Whether a leaf is actually on screen, rather than merely open.
 *
 * Obsidian takes an inactive leaf in a tab group out of layout, which is what
 * makes a backgrounded Hearth tab cost nothing to have open. `offsetParent` is
 * null for exactly that case (and for a collapsed sidebar), so it is the cheapest
 * honest test available — no geometry, no observer, no undocumented API.
 *
 * Deliberately conservative: anything it cannot resolve reads as visible, so a
 * board is only ever skipped when it is definitely not being looked at.
 */
function leafIsVisible(leaf: WorkspaceLeaf): boolean {
	const el = leaf.view?.containerEl;
	if (!el) return true;
	return el.offsetParent !== null || el.isShown?.() === true;
}

export default class HearthPlugin extends Plugin {
	settings: HomeSettings;
	/** True when this load had no persisted data at all (a brand-new install),
	 * as opposed to an existing vault that simply predates a given setting.
	 * Used so the "What's new" dialog greets upgraders but not first-timers. */
	isFirstRun = false;
	/** The ribbon crystal, kept so the icon can be swapped when the
	 * themeColorTarget setting changes. */
	private ribbonEl?: HTMLElement;

	/** Hearth's single connection to the Operon plugin's Developer API. Shared
	 * by every Operon card and the settings tab so the vault sees one consumer,
	 * one capability grant and one session — not one per card. Nothing is
	 * negotiated here: the session opens lazily, the first time a card (or the
	 * settings readout) actually asks for it. */
	operon = new OperonSession(this);

	/** Home-view leaves that have already been the active leaf at least once.
	 * Their first activation was the fresh onOpen render, so the focus refresh
	 * (#110) skips it and only re-renders on genuine re-focus (this also avoids
	 * clobbering any search focus set on open). A WeakSet so closed leaves are
	 * collected with no manual bookkeeping. */
	private seenActiveHomeLeaves = new WeakSet<WorkspaceLeaf>();

	/** Debounced live-refresh of open home views on vault changes (#110).
	 * resetTimer=true so a burst of writes (a sync, a bulk edit) coalesces into a
	 * single re-render ~600ms after the last change. */
	private liveRefreshDebounced = debounce(() => this.runLiveRefresh(), 600, true);

	async onload() {
		// Pick the locale from Obsidian's UI language before anything renders or
		// registers a translated command name.
		setLanguage();

		await this.loadSettings();

		// Register both Hearth crystals (brand purple and themeable) so either
		// can be used as the ribbon, tab and header icon per the
		// themeColorTarget setting.
		addIcon(HEARTH_ICON_ID, HEARTH_ICON_SVG);
		addIcon(HEARTH_ICON_THEMED_ID, HEARTH_ICON_THEMED_SVG);

		this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));

		// A renegotiated Operon session may be looking at different settings, so
		// the cached taxonomy it filled is no longer trustworthy.
		this.operon.registerInvalidation(forgetTaxonomy);

		this.ribbonEl = this.addRibbonIcon(
			this.brandIconId(),
			t().ribbon.openHome,
			() => this.activateView(),
		);

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

		// Like the settings button, and for the same reason: run on demand the
		// wizard builds an *additional* dashboard and never overwrites one. Only
		// the first-run prompt may offer to replace the starter board.
		this.addCommand({
			id: "run-setup",
			name: t().commands.runSetup,
			callback: () => openSetupWizard(this, { forceNewDashboard: true }),
		});

		this.registerDashboardCommands();

		this.addSettingTab(new HomeSettingTab(this.app, this));

		// Replace freshly-opened empty tabs with the home view, and refresh a home
		// view whenever the user switches back to its tab (#110).
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.maybeReplaceNewTab(leaf);
				this.maybeRefreshOnFocus(leaf);
			}),
		);

		// Opt-in live refresh: when enabled, re-render open home views a beat after
		// the vault changes so Recent/Bookmarks/query cards stay current without
		// reopening the tab. Registered unconditionally; the handler checks the
		// setting so toggling it takes effect without a reload. Debounced so a burst
		// of writes (a sync, a bulk edit) coalesces into a single re-render.
		const onVaultChange = () => this.liveRefreshDebounced();
		this.registerEvent(this.app.vault.on("create", onVaultChange));
		this.registerEvent(this.app.vault.on("delete", onVaultChange));
		this.registerEvent(this.app.vault.on("rename", onVaultChange));
		this.registerEvent(this.app.vault.on("modify", onVaultChange));

		// Follow core-Workspace loads: when the active workspace matches a
		// dashboard's linked workspace, switch to that dashboard. There is no
		// dedicated "workspace loaded" event, so listen to layout-change;
		// setActiveDashboard no-ops when the dashboard is already active.
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.followLinkedWorkspace()),
		);

		this.app.workspace.onLayoutReady(() => {
			this.applyMobileDefaultDashboard();
			if (this.settings.openOnStartup) void this.activateView();
			// Pop the release-notes dialog after an update (but not on a fresh
			// install). Runs once layout is ready so it doesn't fight startup.
			// The setup wizard is the fresh install's counterpart and is offered
			// after it, so the two can never stack: on a first run the changelog
			// is silently seeded and only the wizard appears.
			void maybeShowWhatsNew(this).then(() => maybeRunSetup(this));
		});
	}

	onunload() {
		// Views are detached automatically by Obsidian on plugin unload.
		// The content-search cache holds lower-cased note bodies, though, so
		// drop it rather than leave a copy of the vault behind after unload.
		clearContentSearchCache();
		// The Operon session holds a reference to that plugin's instance; drop
		// it so an unloaded Hearth isn't left holding a live handle.
		this.operon.invalidate();
	}

	private maybeReplaceNewTab(leaf: WorkspaceLeaf | null) {
		if (!leaf || !this.settings.replaceNewTabs) return;
		if (leaf.getViewState().type !== "empty") return;
		void leaf.setViewState({ type: VIEW_TYPE_HOME });
	}

	/** Name of the workspace we last reacted to, so the link fires once per
	 * workspace load instead of pinning the dashboard on every layout-change. */
	private lastWorkspace?: string;

	/** Switch to the dashboard linked to the currently loaded core-Workspace,
	 * if any. One-way sync: workspace → dashboard, never the reverse. */
	private followLinkedWorkspace() {
		const instance = this.app.internalPlugins.getPluginById("workspaces")
			?.instance as WorkspacesInstance | undefined;
		const active = instance?.activeWorkspace;
		if (!active || active === this.lastWorkspace) return;
		this.lastWorkspace = active;
		const match = this.settings.dashboards.find(
			(d) => d.linkedWorkspace === active,
		);
		if (match) this.setActiveDashboard(match.id);
	}

	/** On mobile, switch to the first dashboard flagged as the mobile default so
	 * a phone/tablet opens on the board tuned for a small screen (#120). Applied
	 * in memory only, without saving: `activeDashboardId` is a single field shared
	 * with desktop through synced settings, so persisting the mobile choice would
	 * drag the desktop's active board along with it on the next sync. Any already
	 * open home view is re-rendered to reflect the switch. */
	private applyMobileDefaultDashboard() {
		if (!Platform.isMobile) return;
		const mobile = this.settings.dashboards.find((d) => d.mobileDefault);
		if (!mobile || this.settings.activeDashboardId === mobile.id) return;
		this.settings.activeDashboardId = mobile.id;
		this.refreshViews();
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

	/** Create a new note in the user's configured default location and open it.
	 * `from` is the view the "New note" button was pressed in, so the note can
	 * replace that Hearth tab when the user asked for "same tab" (#106); the
	 * command palette has no view and falls back to the active leaf. */
	async createNewNote(from?: HomeView) {
		try {
			const parent = this.app.fileManager.getNewFileParent("");
			const file = await this.app.fileManager.createNewMarkdownFile(
				parent instanceof TFolder ? parent : this.app.vault.getRoot(),
				"Untitled",
			);
			await openFile(
				from ?? { app: this.app, settings: this.settings },
				file,
				"newNote",
			);
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

	/** The mark Hearth wears in the ribbon and on its tab: the user's Lucide tab
	 * icon, or the brand/themed crystal. */
	private brandIconId(): string {
		return tabIconIdFor(this.settings.themeColorTarget, this.settings.tabIcon);
	}

	/** Re-apply the tab icon to the ribbon and open tab headers after the tab
	 * icon or themeColorTarget setting changes. */
	refreshBrandIcons() {
		if (this.ribbonEl) setIcon(this.ribbonEl, this.brandIconId());
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((leaf) => {
			// updateHeader is undocumented; when absent the tab icon simply
			// refreshes the next time the leaf re-renders.
			(leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
		});
	}

	/**
	 * Re-render every open home view.
	 *
	 * Only the ones actually on screen, though. A full rebuild tears down and
	 * recreates the whole board — every card body, every embed, every hosted leaf
	 * — and doing that for a leaf sitting behind another tab is work nobody can
	 * see the result of. Nothing goes stale: `maybeRefreshOnFocus` re-renders a
	 * home view when it becomes the active leaf again, so a board skipped here is
	 * rebuilt from current settings before anyone looks at it.
	 */
	refreshViews() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof HomeView && leafIsVisible(leaf)) view.render();
		});
	}

	/** Re-render a home view when it becomes the active leaf again, so content
	 * that changed while it was backgrounded (recents, bookmarks, saved-query
	 * results) is current (#110). The first activation of a leaf was its fresh
	 * onOpen render, so that one is skipped; genuine re-focus re-renders. Skipped
	 * while the board is being arranged so a drag/resize isn't interrupted. */
	private maybeRefreshOnFocus(leaf: WorkspaceLeaf | null) {
		if (!leaf) return;
		const view = leaf.view;
		if (!(view instanceof HomeView)) return;
		if (!this.seenActiveHomeLeaves.has(leaf)) {
			this.seenActiveHomeLeaves.add(leaf);
			return;
		}
		if (view.arrangeMode) return;
		view.render();
	}

	/** Live-refresh handler behind {@link liveRefreshDebounced}. No-op unless the
	 * setting is on; never rebuilds a board mid-arrange. */
	private runLiveRefresh() {
		if (!this.settings.liveRefresh) return;
		// The minimal tier suppresses it without clearing the setting: a full board
		// rebuild on every burst of vault writes is the most expensive thing
		// Hearth does off its own render path. Views still refresh when their tab
		// is focused again, so nothing goes permanently stale.
		if (!timersAllowed(this.settings)) return;
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((leaf) => {
			const view = leaf.view;
			// liveRender, not render: a rebuild triggered by a vault write must not
			// destroy a field the user is typing into — including the field whose
			// own writes triggered it (#212).
			//
			// Visible boards only, for the same reason as refreshViews: rebuilding a
			// board behind another tab on every burst of vault writes is the single
			// most expensive thing Hearth does off its own render path, and the
			// focus refresh brings it up to date before it is seen.
			if (view instanceof HomeView && !view.arrangeMode && leafIsVisible(leaf)) {
				view.liveRender();
			}
		});
	}
}
