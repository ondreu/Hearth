import { setTooltip, Setting, TFile } from "obsidian";
import { applyTileSize, emptyState, makeTileDraggable, makeTileResizable, markOverlappingTiles } from "../cardbodies";
import { moveItem } from "../editors";
import { t } from "../i18n";
import { openFile, openLink as openLinkTarget } from "../opener";
import { CommandPickerModal } from "../pickers";
import { addIconHelp, applyTileVisual } from "../widgeticon";
import { type DashboardCard, type LinkItem } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Links / launchpad --------------------------------------------------

export function renderLinks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const links = card.links ?? [];
	if (links.length === 0) {
		emptyState(body, "layout-grid", t().cards.empty.linksEmpty);
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	// Flag the card body so CSS can disable the card drag overlay over tiles in
	// arrange mode (tiles are self-contained widgets with their own resize).
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, link.sizeW, link.sizeH, link.size, baseTile, link.col, link.row);
		applyTileVisual(view, tile, link.icon, "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		const open = () => openLink(view, link);
		// In arrange mode, clicking a tile must NOT trigger its action — the
		// click is almost always the tail end of a resize/drag gesture.
		if (!view.arrangeMode) {
			tile.addEventListener("click", open);
			makeClickable(tile, open, link.label || link.target);
		}

		// Tiles can only be resized/repositioned while the dashboard is in
		// arrange mode.
		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => link.sizeW, (v) => {
				link.sizeW = v;
			}, () => link.sizeH, (v) => {
				link.sizeH = v;
			}, () => link.size, (v) => {
				link.size = v;
			});
			makeTileDraggable(view, grid, tile, links, link, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}


function openLink(view: HomeView, link: LinkItem): void {
	switch (link.type) {
		case "url":
			if (link.target) window.open(link.target, "_blank");
			break;
		case "command":
			if (link.target) view.app.commands.executeCommandById(link.target);
			break;
		case "note": {
			const file = view.app.vault.getAbstractFileByPath(link.target);
			if (file instanceof TFile) void openFile(view, file, "link");
			else if (link.target) void openLinkTarget(view, link.target, "", "link");
			break;
		}
	}
}


export function linksEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	new Setting(containerEl).setName(t().editors.links.heading).setHeading();
	const card = ctx.card;
	const links = (card.links ??= []);

	new Setting(containerEl)
		.setName(t().editors.links.autoShift)
		.setDesc(t().editors.links.autoShiftDesc)
		.addToggle((t) =>
			t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
				card.tileAutoFlow = v;
				ctx.opts.save();
			}),
		);

	links.forEach((link, index) => {
		const row = new Setting(containerEl).setClass("hearth-link-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.links.labelPlaceholder)
				.setValue(link.label)
				.onChange((v) => {
					link.label = v;
					ctx.opts.save();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.links.iconPlaceholder)
				.setValue(link.icon)
				.onChange((v) => {
					link.icon = v;
					ctx.opts.save();
				});
			setTooltip(txt.inputEl, t().editors.iconHelp);
		});
		addIconHelp(row.controlEl);
		row.addDropdown((d) => {
			(Object.keys(t().editors.linkTypes) as LinkItem["type"][]).forEach(
				(k) => {
					d.addOption(k, t().editors.linkTypes[k]);
				},
			);
			d.setValue(link.type).onChange((v) => {
				link.type = v as LinkItem["type"];
				ctx.opts.save();
				// The target control differs by type (a command picker vs. a
				// free-text path/URL field), so rebuild the editor to swap it.
				ctx.requestRender();
			});
		});
		if (link.type === "command") {
			// Commands are addressed by an opaque id (e.g. "editor:toggle-bold")
			// that users can't be expected to know, so offer a fuzzy picker over
			// the registered commands instead of a raw text field. This mirrors
			// how the "commands" card adds tiles and is what makes command links
			// actually fire.
			row.addButton((b) => {
				const current = link.target
					? ctx.app.commands.listCommands().find((c) => c.id === link.target)
					: undefined;
				b.setButtonText(
					current ? current.name : t().editors.links.pickCommand,
				);
				b.onClick(() => {
					new CommandPickerModal(ctx.app, (command) => {
						link.target = command.id;
						// Prefill an empty label with the command name so the tile
						// isn't blank; leave a user-set label untouched.
						if (!link.label) link.label = command.name;
						// Adopt the command's own icon if the link is still on the
						// default; a user-chosen icon is left alone.
						if ((!link.icon || link.icon === "link") && command.icon) {
							link.icon = command.icon;
						}
						ctx.opts.save();
						ctx.requestRender();
					}).open();
				});
			});
		} else {
			row.addText((txt) =>
				txt
					.setPlaceholder(
						link.type === "url"
							? t().editors.links.targetUrl
							: t().editors.links.targetNote,
					)
					.setValue(link.target)
					.onChange((v) => {
						link.target = v;
						ctx.opts.save();
					}),
			);
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, links, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === links.length - 1)
				.onClick(() => moveItem(ctx, links, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.links.removeLink)
				.onClick(() => {
					links.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.links.addLink).onClick(() => {
			links.push({
				id: `link-${Date.now().toString(36)}`,
				label: "",
				icon: "link",
				target: "",
				type: "note",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);
}

/** A free-form launchpad of link tiles. */
export const linksCard: CardDefinition<"links"> = {
	kind: "links",
	templates: [
		{ id: "links", name: "Links / launchpad", icon: "layout-grid", build: () => ({ kind: "links", title: "Links", links: [], w: 6, h: 2 }) },
	],
	render: (view, card, body) => renderLinks(view, card, body),
	renderEditor: (container, ctx) => linksEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.links) copy.links = source.links.map((l) => ({ ...l }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
};
