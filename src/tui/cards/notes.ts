/**
 * The note cards as text: Daily note, Periodic note, Embedded note (when it
 * embeds a note) and Jot-down.
 *
 * Each shows its Markdown as highlighted source (src/tui/markdown.ts). A card
 * set to editable opens the note's own editor on `i` or a double-click; any
 * card ticks its checkboxes and follows its links. An Embedded note card that
 * embeds a picture, a canvas, a base or a drawing is drawn graphically instead
 * — those have no text form.
 */
import { Menu, TFile } from "obsidian";
import { dailyNoteFinder, dailyNotesOptions, moment, processFile, activeEmbedViewParams, activeEmbedView, embedViews } from "../../cardbodies";
import { resolvePeriodicNote } from "../../cards/periodic";
import { isExcalidraw } from "../../filetypes";
import { t } from "../../i18n";
import { openFile } from "../../opener";
import type { DashboardCard } from "../../types";
import type { HomeView } from "../../view";
import type { TuiContext, TuiOutput, TuiRenderer } from "../card";
import { markdownKey, markdownOutput } from "../markdown";
import { asciify } from "../text";
import { button, listOutput, message } from "./common";

/**
 * The text of `file`, read into the card's state. The first draw starts the
 * read and shows what was read last time (or "loading"); the read's own redraw
 * picks it up. Every other draw — a vault change, a board rebuild — reads again,
 * so the card never shows a stale copy for longer than one read.
 */
function fileText(ctx: TuiContext, file: TFile): string | null {
	const key = `text:${file.path}`;
	const fresh = ctx.state.freshFor === file.path;
	ctx.state.freshFor = null;
	if (!fresh) {
		void ctx.view.app.vault.cachedRead(file).then((text) => {
			ctx.state[key] = text;
			ctx.state.freshFor = file.path;
			ctx.redraw();
		});
	}
	const cached = ctx.state[key];
	return typeof cached === "string" ? cached : null;
}

/** A note file drawn as source. */
function noteOutput(ctx: TuiContext, file: TFile, editable: boolean): TuiOutput {
	const { view } = ctx;
	const key = `text:${file.path}`;
	const edit = (fn: (text: string) => string) =>
		processFile(view, file)((text) => {
			const next = fn(text);
			ctx.state[key] = next;
			return next;
		});
	// An editable card doesn't redraw on its own writes (it would drop the
	// cursor), so it follows edits made elsewhere itself while not editing.
	if (editable) {
		ctx.component.registerEvent(
			view.app.vault.on("modify", (changed) => {
				if (changed.path === file.path && ctx.state.editing !== true) ctx.redraw();
			}),
		);
	}
	const out = markdownOutput(ctx, {
		text: fileText(ctx, file),
		sourcePath: file.path,
		editable,
		edit,
		placeholder: t().cards.embed.emptyNoteHint,
		frontmatter: true,
	});
	return { ...out, hint: out.hint ?? asciify(file.basename) };
}

function openNote(view: HomeView, file: TFile | null): void {
	if (file) void openFile(view, file, "card");
}

// ---- Daily note -----------------------------------------------------------------

function todaysDaily(view: HomeView): TFile | null {
	const options = dailyNotesOptions(view);
	return options ? dailyNoteFinder(view, options)(moment()) : null;
}

export const dailyTui: TuiRenderer = {
	render(ctx) {
		const { view } = ctx;
		if (!dailyNotesOptions(view)) return { lines: message(t().cards.empty.dailyEnable, ctx.cols) };
		const file = todaysDaily(view);
		if (!file) {
			const create = () => {
				if (!view.app.commands.executeCommandById("daily-notes")) ctx.view.tuiSay?.(t().notices.couldNotOpenDaily);
			};
			return listOutput([{ lines: [button(t().cards.daily.createToday, create)], activate: create }], {
				lines: [...message(t().cards.daily.noNoteYet, ctx.cols), []],
			});
		}
		return noteOutput(ctx, file, ctx.card.editable === true);
	},
	key: (ctx, evt) => markdownKey(ctx, evt, ctx.card.editable === true),
	detail: (ctx) => openNote(ctx.view, todaysDaily(ctx.view)),
	menu: (ctx, menu: Menu) => {
		const file = todaysDaily(ctx.view);
		if (file) menu.addItem((i) => i.setTitle(t().cards.daily.openToday).setIcon("square-pen").onClick(() => openNote(ctx.view, file)));
		if (file && ctx.card.editable) menu.addItem((i) => i.setTitle(t().tui.cards.edit).setIcon("pencil").onClick(() => {
			ctx.state.editing = true;
			ctx.redraw();
		}));
	},
};

// ---- Periodic note --------------------------------------------------------------

export const periodicTui: TuiRenderer = {
	render(ctx) {
		const r = resolvePeriodicNote(ctx.view, ctx.card, () => ctx.redraw());
		if (r.kind === "message") return { lines: message(r.text, ctx.cols) };
		if (r.kind === "create") {
			return listOutput([{ lines: [button(r.label, () => r.create())], activate: () => r.create() }], {
				lines: [...message(r.text, ctx.cols), []],
			});
		}
		ctx.state.file = r.file.path;
		return noteOutput(ctx, r.file, ctx.card.editable === true);
	},
	key: (ctx, evt) => markdownKey(ctx, evt, ctx.card.editable === true),
	detail: (ctx) => {
		const r = resolvePeriodicNote(ctx.view, ctx.card, () => ctx.redraw());
		if (r.kind === "note") openNote(ctx.view, r.file);
	},
};

// ---- Embedded note -------------------------------------------------------------

/** The file an embed card shows now, when it is a note terminal mode can draw
 * as text. */
function embeddedNote(view: HomeView, card: DashboardCard): TFile | null {
	const target = activeEmbedViewParams(card).target?.trim();
	if (!target) return null;
	const file = view.app.vault.getAbstractFileByPath(target);
	if (!(file instanceof TFile)) return null;
	const ext = file.extension.toLowerCase();
	return (ext === "md" || ext === "markdown") && !isExcalidraw(file) ? file : null;
}

export const embedTui: TuiRenderer = {
	// Only a note has a text form. A picture, a canvas, a base or a drawing is
	// drawn the way it always is, inside the terminal frame.
	graphicalFor: (view, card) => {
		const target = activeEmbedViewParams(card).target?.trim();
		if (!target) return false;
		const file = view.app.vault.getAbstractFileByPath(target);
		return file instanceof TFile && !embeddedNote(view, card);
	},
	render(ctx) {
		const target = activeEmbedViewParams(ctx.card).target?.trim();
		if (!target) return { lines: message(t().cards.empty.embedPickFile, ctx.cols) };
		const file = embeddedNote(ctx.view, ctx.card);
		if (!file) return { lines: message(t().tui.cards.notFound(target), ctx.cols) };
		const out = noteOutput(ctx, file, activeEmbedViewParams(ctx.card).editable === true);
		const views = embedViews(ctx.card);
		if (views.length > 1) out.hint = `${out.hint ?? ""} ${activeEmbedIndexOf(ctx)}/${views.length}`.trim();
		return out;
	},
	key(ctx, evt) {
		if (evt.key === "v" && embedViews(ctx.card).length > 1) {
			switchEmbedView(ctx);
			return true;
		}
		return markdownKey(ctx, evt, activeEmbedViewParams(ctx.card).editable === true);
	},
	detail: (ctx) => openNote(ctx.view, embeddedNote(ctx.view, ctx.card)),
	menu(ctx, menu) {
		if (embedViews(ctx.card).length > 1) {
			menu.addItem((i) => i.setTitle(t().tui.cards.switchView).setIcon("arrow-left-right").onClick(() => switchEmbedView(ctx)));
		}
	},
};

function activeEmbedIndexOf(ctx: TuiContext): number {
	return (activeEmbedView.get(ctx.card) ?? 0) + 1;
}

/** Show the embed card's other view. The other view may be a picture, which
 * is drawn graphically, so the whole board is rebuilt rather than the card. */
function switchEmbedView(ctx: TuiContext): void {
	const count = embedViews(ctx.card).length;
	const next = ((activeEmbedView.get(ctx.card) ?? 0) + 1) % count;
	activeEmbedView.set(ctx.card, next);
	ctx.view.render();
}

// ---- Jot-down --------------------------------------------------------------------

export const textTui: TuiRenderer = {
	render(ctx) {
		const { view, card } = ctx;
		const out = markdownOutput(ctx, {
			text: card.text ?? "",
			sourcePath: "",
			// The jot is the card's own text: always editable, like the
			// graphical card's double-click.
			editable: true,
			edit: (fn) => {
				card.text = fn(card.text ?? "");
				return view.plugin.saveData(view.plugin.settings);
			},
			placeholder: t().cards.text.placeholder,
			frontmatter: false,
		});
		return out;
	},
	key: (ctx, evt) => markdownKey(ctx, evt, true),
};
