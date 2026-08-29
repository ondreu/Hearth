import { Notice, setTooltip, Setting, TFile } from "obsidian";
import {
	applyTileSize,
	createTileGrid,
	emptyState,
	makeTileDraggable,
	makeTileResizable,
	markOverlappingTiles,
} from "../cardbodies";
import { moveItem } from "../editors";
import { t } from "../i18n";
import { openFile } from "../opener";
import { FilePickerModal, FolderPickerModal } from "../pickers";
import {
	TEMPLATER_PLUGIN_ID,
	createNoteFromTemplate,
	destinationSummary,
	expandTemplaterFilename,
	filenameNeedsPrompt,
	isTemplaterAvailable,
	isTemplaterTemplate,
	jumpToTemplaterCursor,
	normalizeFolderPath,
	resolveTemplateFile,
	templateDisplayName,
	templaterTemplatesFolder,
} from "../templater";
import { tileSizing } from "../tiles";
import { type DashboardCard, type TemplaterItem } from "../types";
import { makeClickable, promptForText } from "../ui";
import { type HomeView } from "../view";
import { addIconHelp, applyTileVisual } from "../widgeticon";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Templater / new note from template ---------------------------------

/**
 * A launchpad whose tiles create notes: each one names a Templater template, a
 * destination folder and a filename pattern, and one click makes the note.
 *
 * It is the Links and Commands cards' third sibling — same tiles, same
 * arrange-mode drag and resize — and deliberately so. "New meeting note", "New
 * book note", "Capture an idea" are launcher actions in every sense except that
 * Obsidian has no command to bind them to: Templater registers commands only for
 * templates the user hand-picks in its own hotkey list, and those commands drop
 * the note wherever the vault's default-location setting says. A tile carries
 * its own destination, so the same template can feed three different folders
 * from three different buttons.
 *
 * Everything past "which template, where" is Templater's: `src/templater.ts`
 * calls its `create_new_note_from_template`, so user scripts,
 * `tp.system.prompt()` dialogs, cursor placement and folder templates all
 * behave exactly as they do from Templater's own command.
 */
export function renderTemplater(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	if (!isTemplaterAvailable(view.app)) {
		emptyState(body, "file-plus-2", t().cards.empty.templaterEnable);
		return;
	}

	const items = card.templater?.items ?? [];
	if (items.length === 0) {
		emptyState(body, "file-plus-2", t().cards.empty.templaterEmpty);
		return;
	}

	const { grid, spec } = createTileGrid(view, card, body);

	for (const item of items) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, item, spec);
		applyTileVisual(view, tile, item.icon, "file-plus-2");
		const label = tileLabel(item);
		tile.createDiv({ cls: "hearth-link-label", text: label });
		setTooltip(tile, tileTooltip(item));

		// One note per click. Creating one is asynchronous (Templater may open a
		// prompt of its own), and an impatient second click would otherwise make
		// a second note — so the tile marks itself busy for the duration.
		let busy = false;
		const run = (): void => {
			if (busy) return;
			busy = true;
			tile.addClass("is-busy");
			void runTemplaterItem(view, item).finally(() => {
				busy = false;
				tile.removeClass("is-busy");
			});
		};

		// In arrange mode, clicking a tile must NOT trigger its action — the
		// click is almost always the tail end of a resize/drag gesture.
		if (!view.arrangeMode) {
			tile.addEventListener("click", run);
			makeClickable(tile, run, label);
		}

		if (view.arrangeMode) {
			makeTileResizable(view, tile, item, spec);
			makeTileDraggable(view, grid, tile, item, card.tileAutoFlow === true, spec);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}


/** The text on a tile: the user's label, or the template's own name so a tile
 * added and never renamed still reads correctly. */
function tileLabel(item: TemplaterItem): string {
	return item.label.trim() || templateDisplayName(item.template) || t().cards.templater.untitledTile;
}


/** The tile's hover text: where the note will go, so a board of six tiles is
 * self-documenting without opening settings. */
function tileTooltip(item: TemplaterItem): string {
	const strings = t().cards.templater;
	return strings.createsIn(
		destinationSummary(
			item.folder ?? "",
			item.filename ?? "",
			strings.vaultRoot,
			strings.untitledNote,
		),
	);
}


/**
 * One tile's click: resolve the template, ask for the `{{prompt}}` value if the
 * pattern wants one, hand the job to Templater, then open the result the way
 * Hearth opens notes.
 *
 * Every failure is reported as a Notice rather than swallowed — a launcher
 * button that silently does nothing is worse than one that says why.
 */
async function runTemplaterItem(view: HomeView, item: TemplaterItem): Promise<void> {
	const strings = t().notices;
	const app = view.app;

	const template = resolveTemplateFile(app, item.template);
	if (!template) {
		new Notice(strings.templaterNoTemplate(item.template || tileLabel(item)));
		return;
	}

	const pattern = item.filename ?? "";
	let promptValue = "";
	if (filenameNeedsPrompt(pattern)) {
		const answer = await promptForText(app, {
			title: t().cards.templater.promptTitle,
			label: tileLabel(item),
			placeholder: t().cards.templater.promptPlaceholder,
		});
		// Cancelled — not an error, and nothing to report.
		if (answer === null) return;
		promptValue = answer.trim();
	}

	const file = await createNoteFromTemplate(app, {
		template,
		folder: normalizeFolderPath(item.folder ?? ""),
		filename: expandTemplaterFilename(pattern, new Date(), promptValue),
	});
	if (!file) {
		// Templater shows its own error notice for a parse failure or a prompt
		// the user dismissed, so this is the catch-all for everything else.
		new Notice(strings.templaterFailed(templateDisplayName(item.template)));
		return;
	}

	if (item.open === false) {
		new Notice(strings.templaterCreated(file.path));
		return;
	}
	await openFile(view, file, "newNote");
	// Templater does this itself when it opens the note; Hearth opened it
	// instead (see src/templater.ts), so the cursor jump has to be asked for.
	await jumpToTemplaterCursor(app, file);
}


export function templaterEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.templater;
	const card = ctx.card;
	const cfg = (card.templater ??= {});
	const items = (cfg.items ??= []);

	// Same courtesy the Git editor extends: say the card needs the plugin here,
	// rather than leaving the user to wonder why their tiles do nothing.
	if (!isTemplaterAvailable(ctx.app)) {
		new Setting(containerEl).setName(strings.missing).setDesc(strings.missingDesc);
	}

	new Setting(containerEl)
		.setName(strings.autoShift)
		.setDesc(strings.autoShiftDesc)
		.addToggle((tg) =>
			tg.setValue(card.tileAutoFlow ?? false).onChange((v) => {
				card.tileAutoFlow = v;
				ctx.opts.save();
			}),
		);

	// Only the fixed style has a pixel size to set; the scaled one sizes its
	// buttons from the card's column count (see tileSizingSettings).
	if (tileSizing(card) === "fixed") {
		const buttonSize = new Setting(containerEl)
			.setName(strings.buttonSize)
			.setDesc(strings.buttonSizeDesc);
		buttonSize.addSlider((s) => {
			s.setLimits(60, 180, 10)
				.setValue(card.tileSize ?? 90)
				.onChange((v) => {
					card.tileSize = v === 90 ? undefined : v;
					ctx.opts.save();
					ctx.opts.rerender();
				});
		});
		buttonSize.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.tileSize = undefined;
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	}

	new Setting(containerEl).setName(strings.heading).setHeading();

	items.forEach((item, index) => {
		const row = new Setting(containerEl)
			.setClass("hearth-link-setting")
			.setName(tileLabel(item))
			// The destination is the whole point of a tile and the one thing a
			// row of narrow controls can't show, so it is spelled out in full.
			.setDesc(
				destinationSummary(
					item.folder ?? "",
					item.filename ?? "",
					t().cards.templater.vaultRoot,
					t().cards.templater.untitledNote,
				),
			);

		row.addText((txt) =>
			txt
				.setPlaceholder(strings.labelPlaceholder)
				.setValue(item.label)
				.onChange((v) => {
					item.label = v;
					ctx.opts.save();
				}),
		);

		row.addText((txt) => {
			txt
				.setPlaceholder(t().pickers.iconPlaceholder)
				.setValue(item.icon)
				.onChange((v) => {
					item.icon = v;
					ctx.opts.save();
				});
			setTooltip(txt.inputEl, t().editors.iconHelp);
		});
		addIconHelp(row.controlEl);

		// A template is addressed by vault path, which is exactly the kind of
		// thing a fuzzy picker is for. Scoped to Templater's own template folder
		// when it has one, so the list is the same one Templater itself offers.
		row.addButton((b) => {
			b.setButtonText(templateDisplayName(item.template) || strings.pickTemplate);
			setTooltip(b.buttonEl, strings.pickTemplateTooltip);
			b.onClick(() => {
				new FilePickerModal(
					ctx.app,
					(file) => {
						item.template = file.path;
						// Seed an empty label from the template so the tile isn't
						// blank; a user-set label is left alone.
						if (!item.label.trim()) item.label = templateDisplayName(file.path);
						ctx.opts.save();
						ctx.opts.rerender();
						ctx.requestRender();
					},
					strings.pickTemplate,
					(file: TFile) => isTemplaterTemplate(ctx.app, file),
				).open();
			});
		});

		row.addButton((b) => {
			b.setButtonText(
				normalizeFolderPath(item.folder ?? "") || t().cards.templater.vaultRoot,
			);
			setTooltip(b.buttonEl, strings.pickFolderTooltip);
			b.onClick(() => {
				new FolderPickerModal(ctx.app, (folder) => {
					// The picker offers the root as "/", which normalizes to "" —
					// the same value as "let Templater decide".
					item.folder = normalizeFolderPath(folder.path) || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}).open();
			});
		});

		row.addText((txt) => {
			txt
				.setPlaceholder(strings.filenamePlaceholder)
				.setValue(item.filename ?? "")
				.onChange((v) => {
					item.filename = v || undefined;
					ctx.opts.save();
				});
			setTooltip(txt.inputEl, strings.filenameTooltip);
		});

		row.addExtraButton((b) =>
			b
				.setIcon(item.open === false ? "eye-off" : "eye")
				.setTooltip(item.open === false ? strings.openOff : strings.openOn)
				.onClick(() => {
					item.open = item.open === false ? undefined : false;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, items, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === items.length - 1)
				.onClick(() => moveItem(ctx, items, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.removeTile)
				.onClick(() => {
					items.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	// Adding starts at the picker rather than at a blank row: a tile with no
	// template is the one configuration that can never do anything, and the
	// template is also what names the tile.
	new Setting(containerEl).addButton((b) =>
		b.setButtonText(strings.addTile).onClick(() => {
			new FilePickerModal(
				ctx.app,
				(file) => {
					items.push({
						id: `templater-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
						label: templateDisplayName(file.path),
						icon: "file-plus-2",
						template: file.path,
					});
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				},
				strings.pickTemplate,
				(file: TFile) => isTemplaterTemplate(ctx.app, file),
			).open();
		}),
	);

	const folder = templaterTemplatesFolder(ctx.app);
	new Setting(containerEl).setDesc(
		folder ? strings.tokensHelpScoped(folder) : strings.tokensHelp,
	);
}


/** A launchpad of "new note from this template, here" buttons, driven by the
 * Templater plugin. Offered whether or not Templater is installed — the card
 * prompts for it when it isn't. */
export const templaterCard: CardDefinition<"templater"> = {
	kind: "templater",
	templates: [
		{
			id: "templater",
			name: "Templater",
			icon: "file-plus-2",
			// New cards scale their buttons with the card; see the Links template.
			build: () => ({
				kind: "templater",
				title: "New note",
				templater: { items: [] },
				tileSizing: "scale",
				w: 6,
				h: 2,
			}),
			requires: {
				name: "Templater",
				pluginId: TEMPLATER_PLUGIN_ID,
				satisfied: (app) => isTemplaterAvailable(app),
			},
		},
	],
	render: (view, card, body) => renderTemplater(view, card, body),
	renderEditor: (container, ctx) => templaterEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.templater)
			copy.templater = {
				...source.templater,
				items: source.templater.items?.map((i) => ({ ...i })),
			};
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
	tileButtons: true,
};
