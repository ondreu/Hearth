/**
 * @vitest-environment jsdom
 *
 * The card and board dialogs leave out the tabs terminal mode has no use for:
 * it draws every card board as text, in its own frames and colours, so a
 * card's Style tab and a board's Style and Background tabs would change
 * nothing. A plugin board, which terminal mode leaves as it is, keeps them.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import { DEFAULT_SETTINGS, type HomeSettings } from "../src/types";
import type { HearthModalTab } from "../src/tabbedmodal";

let CardSettingsModal: typeof import("../src/editors").CardSettingsModal;

beforeAll(async () => {
	installObsidianDom();
	({ CardSettingsModal } = await import("../src/editors"));
});

function settings(terminal: boolean): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.terminalMode = terminal || undefined;
	return s;
}

/** The tabs a card's dialog offers. Built without Obsidian's Modal, whose
 * constructor needs the app: the tab list reads nothing but the options. */
function cardTabs(terminal: boolean): string[] {
	const modal = Object.create(CardSettingsModal.prototype) as { opts: unknown; hearthTabs(): HearthModalTab[] };
	modal.opts = { settings: settings(terminal) };
	return modal.hearthTabs().map((tab) => tab.id);
}

describe("card settings tabs", () => {
	it("offers Style outside terminal mode", () => {
		expect(cardTabs(false)).toEqual(["content", "style", "layout"]);
	});

	it("leaves Style out in terminal mode", () => {
		expect(cardTabs(true)).toEqual(["content", "layout"]);
	});
});
