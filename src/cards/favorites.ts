import { setIcon, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { favoritesEditor } from "../editors";
import { iconForFile } from "../filetypes";
import { t } from "../i18n";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Favorites (curated note cards) ------------------------------------

export function renderFavorites(view: HomeView, body: HTMLElement): void {
	const paths = view.plugin.settings.favorites;
	if (!paths.length) {
		emptyState(body, "star", t().cards.empty.favoritesEmpty);
		return;
	}

	const grid = body.createDiv("hearth-favorites");
	for (const path of paths) {
		const file = view.app.vault.getAbstractFileByPath(path);
		const card = grid.createDiv("hearth-fav-card");
		if (file instanceof TFile) {
			setIcon(card.createDiv("hearth-fav-icon"), iconForFile(file));
			card.createDiv({ cls: "hearth-fav-name", text: file.basename });
			const open = () => void view.app.workspace.getLeaf(true).openFile(file);
			card.addEventListener("click", open);
			makeClickable(card, open, file.basename);
		} else {
			card.addClass("is-missing");
			setIcon(card.createDiv("hearth-fav-icon"), "file-x");
			card.createDiv({ cls: "hearth-fav-name", text: path });
		}
	}
}

/** The user's starred notes (a Hearth-global list). */
export const favoritesCard: CardDefinition<"favorites"> = {
	kind: "favorites",
	templates: [
		{ id: "favorites", name: "Favorites", icon: "star", build: () => ({ kind: "favorites", title: "Favorites", w: 4, h: 3 }) },
	],
	render: (view, _card, body) => renderFavorites(view, body),
	renderEditor: (container, ctx) => favoritesEditor(ctx, container),
	liveness: { mode: "static" },
};
