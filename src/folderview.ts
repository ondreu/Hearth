import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import {
	defaultBrowseState,
	FolderBrowser,
	folderTitle,
	readBrowseState,
	ROOT,
	VIEW_TYPE_FOLDER,
	watchBrowsedFolder,
	type BrowserHost,
	type FolderBrowseState,
} from "./cards/folder";
import type HearthPlugin from "./main";
import { applyPageDesign, vaultUiDesign } from "./uidesign";

/**
 * The folder browser as a tab of its own (#375).
 *
 * The dialog over the board is a good way to look into a folder and get back
 * to the board; it is a poor place to spend time in one — it covers the board,
 * caps its height, and is gone the moment a note is opened. A tab has the whole
 * page, survives a reload on the folder it was showing, and walks its folders
 * through the tab's own back and forward buttons.
 *
 * The browser itself is the dialog's (`FolderBrowser` in `cards/folder.ts`):
 * this view only hosts it — persists its state, names the tab, and redraws it
 * when the folder it shows changes on disk, as the dialog does.
 */
export class FolderView extends ItemView {
	private state: FolderBrowseState = defaultBrowseState(ROOT);
	private browser: FolderBrowser | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: HearthPlugin) {
		super(leaf);
		this.navigation = true;
	}

	getViewType(): string {
		return VIEW_TYPE_FOLDER;
	}

	getDisplayText(): string {
		return folderTitle(this.app, this.state.path);
	}

	getIcon(): string {
		return "folder-open";
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), ...this.state };
	}

	/**
	 * Take a state — a reloaded workspace, the card opening this tab, or a step
	 * through the tab's history. A change of folder is recorded as a history
	 * entry, so Back returns to the folder before it; a change of sort or layout
	 * is not, since that is the same page drawn differently.
	 */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		const next = readBrowseState(state);
		if (next.path !== this.state.path) result.history = true;
		this.state = next;
		this.dress();
		this.browser?.setState(next);
		this.updateHeader();
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("hearth-folder-view");
		const host: BrowserHost = {
			app: this.app,
			settings: this.plugin.settings,
			opener: { app: this.app, settings: this.plugin.settings, leaf: this.leaf },
			// The tab's header is the title; a second one inside the page would
			// only say it again.
			setTitle: () => this.updateHeader(),
			navigate: (path) => {
				void this.leaf.setViewState({
					type: VIEW_TYPE_FOLDER,
					state: { ...this.state, path },
					active: true,
				});
			},
			changed: (state) => {
				this.state = state;
				this.app.workspace.requestSaveLayout();
			},
		};
		this.browser = new FolderBrowser(host, this.contentEl.createDiv(), this.state);
		this.dress();
		this.browser.draw();
		this.watchVault();
	}

	/** Redraw after a settings change — the design, terminal mode, the
	 * performance tier, Front Matter Title — the way the boards are. */
	refresh(): void {
		this.dress();
		this.browser?.draw();
	}

	/**
	 * Wear the design a dialog opened from the same place would: the card's or
	 * dialog's that opened the tab, else the vault's — and terminal mode's,
	 * vault-wide, over either. Re-run on every refresh, since a tab outlives
	 * the settings it was opened under.
	 */
	private dress(): void {
		applyPageDesign(this.contentEl, this.state.design ?? vaultUiDesign());
	}

	async onClose(): Promise<void> {
		this.browser?.destroy();
		this.browser = null;
		this.contentEl.empty();
	}

	/** Redraw when something on the page changes on disk. */
	private watchVault(): void {
		for (const ref of watchBrowsedFolder(this.app, () => this.browser)) this.registerEvent(ref);
	}

	/** Have the tab's header say the folder now shown. `updateHeader` is not
	 * public API; without it the header catches up on the next layout change. */
	private updateHeader(): void {
		try {
			(this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
		} catch {
			// The header keeps its old name until Obsidian next redraws it.
		}
	}
}
