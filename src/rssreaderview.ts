import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { findRssCard } from "./rssfeeds";
import { readReaderState, RssReader, VIEW_TYPE_RSS_READER, type RssReaderHost, type RssReaderState } from "./rssreader";
import { t } from "./i18n";
import { applyPageDesign, vaultUiDesign } from "./uidesign";

/**
 * The RSS reader as a tab of its own (#377), as the folder browser has one
 * (#375).
 *
 * The dialog is for reading an entry or two and getting back to the board; a
 * tab is for reading a feed — the list beside the entry, the whole page, and
 * the tab's back and forward buttons walking the entries read. It survives a
 * reload on the entry it was showing.
 *
 * The reader itself is the dialog's (`RssReader` in `rssreader.ts`): this
 * view only hosts it — finds the card it reads by id (a tab outlives edits to
 * the card, and the card itself), persists where it is, and names the tab.
 */
export class RssReaderView extends ItemView {
	private state: RssReaderState = { card: "", feed: "", entry: "" };
	private reader: RssReader | null = null;
	private title = "";

	constructor(leaf: WorkspaceLeaf, private readonly plugin: HearthPlugin) {
		super(leaf);
		this.navigation = true;
	}

	getViewType(): string {
		return VIEW_TYPE_RSS_READER;
	}

	getDisplayText(): string {
		return this.title || t().cards.rss.reader.title;
	}

	getIcon(): string {
		return "rss";
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), ...this.state };
	}

	/** Take a state — a reloaded workspace, a card opening this tab, or a step
	 * through the tab's history. Every move to another entry is a history
	 * entry, so Back returns to the one read before. */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		const next = readReaderState(state);
		if (next.entry !== this.state.entry || next.feed !== this.state.feed) result.history = true;
		this.state = next;
		this.dress();
		this.reader?.setState(next);
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("hearth-rss-reader-view");
		const host: RssReaderHost = {
			app: this.app,
			settings: this.plugin.settings,
			opener: { app: this.app, settings: this.plugin.settings, leaf: this.leaf },
			card: () => findRssCard(this.plugin.settings, this.state.card),
			setTitle: (text) => {
				if (text === this.title) return;
				this.title = text;
				this.updateHeader();
			},
			navigate: (state) => {
				void this.leaf.setViewState({ type: VIEW_TYPE_RSS_READER, state: { ...state }, active: true });
			},
		};
		this.reader = new RssReader(host, this.contentEl, this.state);
		this.dress();
		this.reader.draw();
	}

	/** Redraw after a settings change — the design, terminal mode, the card's
	 * own settings — the way the boards are. */
	refresh(): void {
		this.dress();
		this.reader?.draw();
	}

	/** Wear the design of the card or dialog that opened the tab, else the
	 * vault's — and terminal mode's over either. */
	private dress(): void {
		applyPageDesign(this.contentEl, this.state.design ?? vaultUiDesign());
	}

	async onClose(): Promise<void> {
		this.reader?.destroy();
		this.reader = null;
		this.contentEl.empty();
	}

	/** Have the tab's header say what is shown. `updateHeader` is not public
	 * API; without it the header catches up on the next layout change. */
	private updateHeader(): void {
		try {
			(this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
		} catch {
			// The header keeps its old name until Obsidian next redraws it.
		}
	}
}
