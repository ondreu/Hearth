import { setIcon, TFile } from "obsidian";
import { openFile, openLink } from "./opener";
import type { HomeView } from "./view";
import type { MobileActionButton } from "./types";

/**
 * The mobile action bar: a customizable row of buttons (New note, New
 * drawing, Record voice, Open daily note by default) shown under the search
 * bar and filters in Mobile mode, pinned to the bottom quarter of the screen.
 * Each button runs an Obsidian command, opens a vault note/file, or opens a
 * URL — configurable in settings, just like a launchpad tile.
 */
export function renderMobileActionBar(view: HomeView, parent: HTMLElement): void {
	const buttons = view.plugin.settings.mobileActionButtons;
	if (buttons.length === 0) return;

	const bar = parent.createDiv("hearth-mobile-actions");
	for (const btn of buttons) {
		const el = bar.createEl("button", {
			cls: "hearth-mobile-action",
			attr: { "aria-label": btn.label || actionTarget(btn) },
		});
		setIcon(el.createSpan("hearth-mobile-action-icon"), btn.icon || "circle");
		el.createSpan({ cls: "hearth-mobile-action-label", text: btn.label });
		el.addEventListener("click", () => runMobileAction(view, btn));
	}
}

/** The button's target. The pre-1.9.0 `commandId` is folded into `target`
 * before a button ever reaches here — by `migrateSettings` on load and by
 * `sanitizeMobileActionButton` on import — so `target` is the only source. */
export function actionTarget(btn: MobileActionButton): string {
	return btn.target ?? "";
}

/** Run a mobile action button: execute its command, open its note/file, or
 * open its URL — mirroring how launchpad tiles resolve their target. */
function runMobileAction(view: HomeView, btn: MobileActionButton): void {
	const target = actionTarget(btn);
	if (!target) return;
	switch (btn.type ?? "command") {
		case "url":
			window.open(target, "_blank");
			break;
		case "note": {
			const file = view.app.vault.getAbstractFileByPath(target);
			if (file instanceof TFile) void openFile(view, file, "card");
			else void openLink(view, target, "", "card");
			break;
		}
		case "command":
		default:
			view.plugin.runCommandOrNotice(target);
	}
}
