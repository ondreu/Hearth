import { Component, MarkdownRenderer, Setting } from "obsidian";
import { cardOverlayButton, emptyState } from "../cardbodies";
import { t } from "../i18n";
import { isViewTypeHostable, mountLeafView } from "../leafview";
import { type DashboardCard } from "../types";
import {
	VAULT_PET_BLOCK,
	VAULT_PET_HOUSE_VIEW,
	VAULT_PET_PLUGIN_ID,
	isVaultPetAvailable,
	openVaultPetHouse,
	vaultPetDisplay,
} from "../vaultpet";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Vault Pet ----------------------------------------------------------
//
// A house on the board for the Vault Pet community plugin. Hearth's own "Pet"
// card is a different animal entirely — it is drawn here, feeds on vault
// timestamps and keeps no state. This card keeps no state either, but for the
// opposite reason: everything it shows belongs to Vault Pet, which owns the XP,
// the quests, the badges and the sprite. The card is a window onto that plugin,
// never a second implementation of it (see `../vaultpet.ts`).
//
// Two displays, both of them the plugin's own surfaces:
//
//   • "pet" (default) — the plugin's `vault-pet` fenced block, the same compact
//     card its "Insert pet card" command writes into a note. Rendering a block
//     rather than reading the plugin's numbers means the sprite animates, the
//     level bar fills and clicking pets the pet, all under the plugin's control,
//     and Hearth never polls: the plugin repaints its own blocks.
//   • "house" — the `vault-pet-house` side-panel view, hosted as a detached
//     leaf exactly as the Plugin view card hosts any registered view. Quests,
//     dex, badges, wardrobe and stats, in a card instead of the sidebar.
//
// Missing plugin, disabled plugin, a future version that drops the block or
// renames the view: each degrades to a named prompt rather than an empty card.


/** Draw the card: the plugin's pet block, or its house view hosted in the body. */
export function renderVaultPet(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	if (!isVaultPetAvailable(view.app)) {
		emptyState(body, "egg", t().cards.empty.vaultPetInstall);
		return;
	}

	const cfg = (card.vaultPet ??= {});
	// The house is one click away whichever display the card is on — the block
	// display has no way into quests or the dex on its own, and the hosted house
	// is worth opening full-height now and then.
	if (!cfg.hideOpenButton) {
		cardOverlayButton(body, "house", t().cards.vaultPet.openHouse, (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			openVaultPetHouse(view.app);
		});
	}

	if (vaultPetDisplay(card) === "house") {
		renderVaultPetHouse(view, card, body, component);
		return;
	}

	const host = body.createDiv("hearth-vaultpet-block");
	// The plugin's processor ignores the block's contents and renders into `el`,
	// registering the child on the render context so it is torn down with
	// `component` — the same lifetime every other card body has.
	void MarkdownRenderer.render(view.app, VAULT_PET_BLOCK, host, "", component);
}


/** Host Vault Pet's house view inside the card body. */
function renderVaultPetHouse(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	if (!isViewTypeHostable(view.app, VAULT_PET_HOUSE_VIEW)) {
		emptyState(body, "egg", t().cards.empty.vaultPetNoHouse);
		return;
	}
	// No class of its own: `.hearth-leaf-host` carries everything a hosted view
	// needs, and the card root already announces its kind (`data-kind`) for a
	// CSS snippet that wants to single this one out.
	const host = body.createDiv("hearth-leaf-host");
	// The house scrolls and sizes itself, so let it fill the card edge to edge
	// like every other hosted view.
	body.addClass("hearth-card-body-live");
	// Its leaf header is a title bar meant for the sidebar; the card already has
	// one of its own, so drop it unless the user asks for it back.
	if (!card.vaultPet?.showHeader) host.addClass("hearth-leaf-hide-header");
	if (!mountLeafView(view.app, VAULT_PET_HOUSE_VIEW, host, component)) {
		host.remove();
		body.removeClass("hearth-card-body-live");
		emptyState(body, "egg", t().cards.empty.vaultPetNoHouse);
	}
}


/** The card's Content-tab settings: which of the plugin's two surfaces the card
 * shows, and the two bits of chrome around it. */
export function vaultPetEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.vaultPet;
	const cfg = (ctx.card.vaultPet ??= {});

	if (!isVaultPetAvailable(ctx.app)) {
		// Same posture as the Git card's editor: say what is missing rather than
		// offering settings that cannot do anything yet. The card is still
		// configurable — the settings below apply the moment the plugin arrives.
		const note = new Setting(containerEl).setName(strings.missing).setDesc(strings.missingDesc);
		note.settingEl.addClass("hearth-setting-note");
	}

	new Setting(containerEl)
		.setName(strings.display)
		.setDesc(strings.displayDesc)
		.addDropdown((d) => {
			d.addOption("pet", strings.displayPet);
			d.addOption("house", strings.displayHouse);
			d.setValue(vaultPetDisplay(ctx.card)).onChange((v) => {
				cfg.display = v === "house" ? "house" : undefined;
				ctx.opts.save();
				ctx.requestRender();
				ctx.opts.rerender();
			});
		});

	if (vaultPetDisplay(ctx.card) === "house") {
		new Setting(containerEl)
			.setName(strings.showHeader)
			.setDesc(strings.showHeaderDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.showHeader ?? false).onChange((v) => {
					cfg.showHeader = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	new Setting(containerEl)
		.setName(strings.openButton)
		.setDesc(strings.openButtonDesc)
		.addToggle((tg) =>
			tg.setValue(!cfg.hideOpenButton).onChange((v) => {
				cfg.hideOpenButton = v ? undefined : true;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}


/** A card that houses the Vault Pet plugin — its pet card, or its whole house. */
export const vaultPetCard: CardDefinition<"vaultpet"> = {
	kind: "vaultpet",
	templates: [
		{
			id: "vault-pet",
			name: "Vault Pet",
			icon: "egg",
			build: () => ({ kind: "vaultpet", title: "Vault Pet", vaultPet: {}, w: 3, h: 4 }),
			requires: {
				name: "Vault Pet",
				pluginId: VAULT_PET_PLUGIN_ID,
				satisfied: (app) => isVaultPetAvailable(app),
			},
		},
		{
			id: "vault-pet-house",
			name: "Vault Pet house",
			icon: "house",
			build: () => ({
				kind: "vaultpet",
				title: "Pet house",
				vaultPet: { display: "house" },
				w: 5,
				h: 6,
			}),
			requires: {
				name: "Vault Pet",
				pluginId: VAULT_PET_PLUGIN_ID,
				satisfied: (app) => isVaultPetAvailable(app),
			},
		},
	],
	render: (view, card, body, component) => renderVaultPet(view, card, body, component),
	renderEditor: (container, ctx) => vaultPetEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.vaultPet) copy.vaultPet = { ...source.vaultPet };
	},
	// The plugin repaints its own block and its own view as the vault changes,
	// so a redraw here would only throw away a live sprite and restart it.
	liveness: { mode: "static" },
};
