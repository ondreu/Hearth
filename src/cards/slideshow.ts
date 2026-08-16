import { type App, Component, setIcon, Setting, TFile, TFolder } from "obsidian";
import { cardOverlayButton, emptyState } from "../cardbodies";
import { moveItem } from "../editors";
import { isImageFile } from "../filetypes";
import { t } from "../i18n";
import { openFile } from "../opener";
import { FilePickerModal, FolderPickerModal } from "../pickers";
import {
	SLIDESHOW_DEFAULT_INTERVAL_SEC,
	SLIDESHOW_FITS,
	SLIDESHOW_MAX_INTERVAL_SEC,
	SLIDESHOW_MAX_TRANSITION_MS,
	SLIDESHOW_ORDERS,
	SLIDESHOW_TRANSITIONS,
	SLIDESHOW_DEFAULT_TRANSITION_MS,
	normalizeFolderPath,
	orderPictures,
	pictureLabel,
	shufflePictures,
	slideshowIntervalMs,
	slideshowOrder,
	slideshowReactsTo,
	slideshowSource,
	slideshowTransitionMs,
	type SlideshowPicture,
} from "../slideshow";
import {
	motionAllowed,
	type DashboardCard,
	type SlideshowConfig,
	type SlideshowFit,
	type SlideshowOrder,
	type SlideshowSlide,
	type SlideshowTransition,
} from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";

/**
 * The slideshow card: a picture embed that rotates.
 *
 * It is the image embed's sibling — same `<img>`, same edge-to-edge framing —
 * with a list of pictures instead of one, and a timer. Pictures come either from
 * a hand-picked list (each entry can carry its own caption) or from a folder,
 * optionally including subfolders; both can be ordered by name, creation or
 * modification date, or shuffled.
 *
 * Two things are worth knowing about the implementation:
 *
 * - **Two layers, not N.** However many pictures a card has, only two `<img>`
 *   elements exist: the one on screen and the one coming in. A card pointed at a
 *   folder of 500 photos therefore decodes two of them, not 500, and every
 *   transition is a plain CSS animation between that pair (see the
 *   `.hearth-slide` rules in styles.css).
 * - **The pure parts live next door.** Ordering, the folder-scope test, the
 *   interval clamps and the redraw predicate are data-only functions in
 *   `src/slideshow.ts`, unit-tested there; this module is the vault reads, the
 *   DOM and the editor.
 */

// ---- Vault reads --------------------------------------------------------

/** Turn a vault image file into a picture, carrying over a list entry's caption. */
function pictureFor(file: TFile, caption?: string): SlideshowPicture {
	return {
		path: file.path,
		name: file.basename,
		created: file.stat?.ctime ?? 0,
		modified: file.stat?.mtime ?? 0,
		caption,
	};
}

/** The hand-picked list, resolved against the vault. Entries whose file is gone
 * (or was never an image) are dropped rather than drawn as a broken picture. */
function listPictures(app: App, cfg: SlideshowConfig): SlideshowPicture[] {
	const pictures: SlideshowPicture[] = [];
	for (const slide of cfg.slides ?? []) {
		const path = slide.path?.trim();
		if (!path) continue;
		const file = app.vault.getAbstractFileByPath(path);
		if (file && isImageFile(file)) pictures.push(pictureFor(file, slide.caption));
	}
	return pictures;
}

/** Every image in the card's folder (and, when asked, its subfolders). */
function folderPictures(app: App, cfg: SlideshowConfig): SlideshowPicture[] {
	const scope = normalizeFolderPath(cfg.folder);
	const root = scope === "" ? app.vault.getRoot() : app.vault.getAbstractFileByPath(scope);
	if (!(root instanceof TFolder)) return [];
	const pictures: SlideshowPicture[] = [];
	const walk = (folder: TFolder) => {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (cfg.includeSubfolders === true) walk(child);
			} else if (isImageFile(child)) {
				pictures.push(pictureFor(child));
			}
		}
	};
	walk(root);
	return pictures;
}

/** Every picture the card shows, in display order. */
export function collectSlideshowPictures(app: App, cfg: SlideshowConfig): SlideshowPicture[] {
	const pictures =
		slideshowSource(cfg) === "folder" ? folderPictures(app, cfg) : listPictures(app, cfg);
	return orderPictures(pictures, slideshowOrder(cfg));
}


// ---- Render -------------------------------------------------------------

/**
 * Transient per-card rotation state, keyed by the card object (the same trick
 * `activeEmbedView` uses). It survives body redraws — dropping a photo into a
 * watched folder, or leaving arrange mode — so the slideshow picks up where it
 * was instead of jumping back to the first picture, and resets when Obsidian
 * reloads.
 */
interface SlideshowState {
	/** Path of the picture that was on screen. */
	path?: string;
	/** Whether the viewer paused the rotation with the pause button. */
	paused?: boolean;
}

const slideshowState = new WeakMap<DashboardCard, SlideshowState>();

/** The animation-state classes a layer carries during a transition. Cleared
 * before each swap so the next animation starts from scratch. */
const LAYER_STATE_CLASSES = ["is-in-next", "is-in-prev", "is-out-next", "is-out-prev"];


export function renderSlideshow(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.slideshow ?? {};
	const pictures = collectSlideshowPictures(view.app, cfg);
	if (pictures.length === 0) {
		emptyState(
			body,
			"images",
			slideshowSource(cfg) === "folder"
				? t().cards.empty.slideshowFolderEmpty
				: t().cards.empty.slideshowEmpty,
		);
		return;
	}

	const state = slideshowState.get(card) ?? {};
	slideshowState.set(card, state);

	const holdMs = slideshowIntervalMs(cfg);
	const order = slideshowOrder(cfg);
	const count = pictures.length;

	body.addClass("hearth-slideshow-host");
	const stage = body.createDiv("hearth-slideshow");
	stage.addClass(`is-trans-${cfg.transition ?? "fade"}`);
	stage.addClass(cfg.fit === "contain" ? "is-fit-contain" : "is-fit-cover");
	if (cfg.kenBurns) stage.addClass("is-kenburns");
	stage.style.setProperty("--hearth-slide-ms", `${slideshowTransitionMs(cfg)}ms`);
	// The slow zoom runs for exactly as long as the picture is held, so it never
	// finishes early and sits still, nor gets cut off halfway.
	stage.style.setProperty(
		"--hearth-slide-hold",
		`${holdMs || SLIDESHOW_DEFAULT_INTERVAL_SEC * 1000}ms`,
	);

	// Two layers for any number of pictures: the one on screen and the one coming
	// in. Swapping which is "active" is the whole transition.
	const layers = [0, 1].map(() => stage.createDiv("hearth-slide"));
	const images = layers.map((layer) => {
		const img = layer.createEl("img", { cls: "hearth-slide-img" });
		// A picture is decoration here, not something to drag out of the card —
		// the native image drag would otherwise fight the card's own in arrange mode.
		img.draggable = false;
		img.decoding = "async";
		return img;
	});

	// Resume where the rotation was, when that picture is still in the set.
	const resumeAt = pictures.findIndex((picture) => picture.path === state.path);
	let index = resumeAt >= 0 ? resumeAt : 0;
	let active = 0;
	let hovering = false;

	const resourcePath = (path: string): string | null => {
		const file = view.app.vault.getAbstractFileByPath(path);
		return file && isImageFile(file) ? view.app.vault.getResourcePath(file) : null;
	};

	const paint = (layer: number, picture: SlideshowPicture) => {
		const img = images[layer];
		img.src = resourcePath(picture.path) ?? "";
		img.alt = pictureLabel(picture);
	};

	const caption = cfg.showCaption ? stage.createDiv("hearth-slide-caption") : null;
	// A single picture has nothing to step through, so it gets no chrome — such a
	// card is just an image embed, and dead buttons would suggest otherwise.
	const controls =
		cfg.controls === false || count < 2 ? null : stage.createDiv("hearth-slideshow-controls");
	let pauseButton: HTMLButtonElement | null = null;
	let counter: HTMLElement | null = null;

	const updateChrome = () => {
		const picture = pictures[index];
		if (caption) caption.setText(pictureLabel(picture));
		if (counter) counter.setText(`${index + 1}/${count}`);
		if (pauseButton) {
			const paused = state.paused === true;
			setIcon(pauseButton, paused ? "play" : "pause");
			const label = paused ? t().cards.slideshow.play : t().cards.slideshow.pause;
			pauseButton.setAttribute("aria-label", label);
			pauseButton.setAttribute("title", label);
			pauseButton.toggleClass("is-paused", paused);
		}
	};

	// ---- Rotation ----

	let timer: number | null = null;
	const stop = () => {
		if (timer === null) return;
		window.clearTimeout(timer);
		timer = null;
	};
	// Low power mode switches off every timed refresh, this one included: the card
	// keeps the picture it is on (and its controls still step through by hand).
	const rotates = count > 1 && holdMs > 0 && motionAllowed(view.plugin.settings);
	const schedule = () => {
		stop();
		if (!rotates || state.paused === true || hovering) return;
		timer = window.setTimeout(() => {
			advance(1);
			schedule();
		}, holdMs);
	};
	component.register(stop);

	const swap = (target: number, direction: "next" | "prev") => {
		if (target === index) return;
		const incoming = 1 - active;
		paint(incoming, pictures[target]);
		// Clearing the state classes on both layers and reading a layout value in
		// between makes the browser drop the finished animations, so the very same
		// transition plays again on the next swap instead of staying at its end
		// state.
		layers[incoming].removeClasses(LAYER_STATE_CLASSES);
		layers[active].removeClasses(LAYER_STATE_CLASSES);
		void stage.offsetWidth;
		layers[incoming].addClass("is-active", direction === "prev" ? "is-in-prev" : "is-in-next");
		layers[active].removeClass("is-active");
		layers[active].addClass(direction === "prev" ? "is-out-prev" : "is-out-next");
		active = incoming;
		index = target;
		state.path = pictures[index].path;
		updateChrome();
	};

	const advance = (step: 1 | -1) => {
		if (count < 2) return;
		let target = index + step;
		if (target >= count) {
			// A shuffled card reshuffles between passes, so a long slideshow doesn't
			// repeat the same running order forever — while still showing every
			// picture once per pass.
			if (order === "random") reshuffle();
			target = 0;
		} else if (target < 0) {
			target = count - 1;
		}
		swap(target, step > 0 ? "next" : "prev");
	};

	/** Reshuffle for the next pass, keeping the picture currently on screen out
	 * of first place so nothing repeats across the seam. */
	const reshuffle = () => {
		const showing = pictures[index].path;
		shufflePictures(pictures);
		if (pictures[0].path === showing) {
			const other = 1 + Math.floor(Math.random() * (count - 1));
			[pictures[0], pictures[other]] = [pictures[other], pictures[0]];
		}
	};

	/** A manual step: move, then restart the clock so the new picture gets a full
	 * turn rather than whatever was left of the previous one's. */
	const step = (by: 1 | -1) => {
		advance(by);
		schedule();
	};

	if (controls) mountControls();

	// First paint: no transition, and the caption/counter filled in for it.
	paint(active, pictures[index]);
	layers[active].addClass("is-active");
	state.path = pictures[index].path;
	updateChrome();
	schedule();

	if (cfg.pauseOnHover === true) {
		stage.addEventListener("pointerenter", () => {
			hovering = true;
			stop();
		});
		stage.addEventListener("pointerleave", () => {
			hovering = false;
			schedule();
		});
	}

	// An optional overlay button that opens the picture on screen in its own tab,
	// the same affordance (and default-off) as the embed card's (#144).
	if (card.showOpenButton === true) {
		cardOverlayButton(body, "square-arrow-out-up-right", t().cards.slideshow.openImage, (evt) => {
			const file = view.app.vault.getAbstractFileByPath(pictures[index].path);
			if (file instanceof TFile) void openFile(view, file, "card", evt);
		});
	}

	function mountControls(): void {
		if (!controls) return;
		const button = (icon: string, label: string, onClick: () => void): HTMLButtonElement => {
			const el = controls.createEl("button", {
				cls: "hearth-slideshow-btn",
				attr: { "aria-label": label, title: label },
			});
			setIcon(el, icon);
			// Don't let a click on the controls start a card drag or reach the card.
			el.addEventListener("pointerdown", (e) => e.stopPropagation());
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				onClick();
			});
			return el;
		};

		button("chevron-left", t().cards.slideshow.previous, () => step(-1));
		// Pausing a card that isn't rotating would be a button that does nothing.
		if (rotates) {
			pauseButton = button("pause", t().cards.slideshow.pause, () => {
				state.paused = state.paused === true ? undefined : true;
				schedule();
				updateChrome();
			});
		}
		button("chevron-right", t().cards.slideshow.next, () => step(1));
		counter = controls.createDiv({ cls: "hearth-slideshow-count" });
		counter.setAttribute("aria-hidden", "true");
	}
}


// ---- Editor -------------------------------------------------------------

export function slideshowEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const cfg = (card.slideshow ??= {});
	const strings = t().editors.slideshow;

	new Setting(containerEl)
		.setName(strings.source)
		.setDesc(strings.sourceDesc)
		.addDropdown((d) => {
			d.addOption("list", strings.sourceList);
			d.addOption("folder", strings.sourceFolder);
			d.setValue(slideshowSource(cfg)).onChange((v) => {
				cfg.source = v === "folder" ? "folder" : undefined;
				ctx.opts.save();
				// The two sources are configured with completely different controls.
				ctx.requestRender();
			});
		});

	if (slideshowSource(cfg) === "folder") folderSection(ctx, containerEl, cfg);
	else listSection(ctx, containerEl, cfg);

	new Setting(containerEl).setName(strings.playbackHeading).setHeading();

	new Setting(containerEl)
		.setName(strings.order)
		.setDesc(strings.orderDesc)
		.addDropdown((d) => {
			// "Manual" is the list's own order, which a folder doesn't have one of.
			const orders =
				slideshowSource(cfg) === "folder"
					? SLIDESHOW_ORDERS.filter((o) => o !== "manual")
					: SLIDESHOW_ORDERS;
			for (const o of orders) d.addOption(o, strings.orders[o]);
			d.setValue(slideshowOrder(cfg)).onChange((v) => {
				cfg.order = v as SlideshowOrder;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	const interval = new Setting(containerEl)
		.setName(strings.interval)
		.setDesc(strings.intervalDesc);
	interval.addText((txt) => {
		txt
			.setValue(String(cfg.intervalSec ?? SLIDESHOW_DEFAULT_INTERVAL_SEC))
			.onChange((v) => {
				// Saved per keystroke but not redrawn per keystroke: the new interval
				// takes effect when the dialog closes (which redraws the board).
				const n = parseInt(v, 10);
				cfg.intervalSec =
					Number.isNaN(n) || n < 0 ? undefined : Math.min(n, SLIDESHOW_MAX_INTERVAL_SEC);
				ctx.opts.save();
			});
		txt.inputEl.type = "number";
		txt.inputEl.addClass("hearth-count-input");
		txt.inputEl.setAttribute("aria-label", strings.intervalAria);
	});
	interval.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetField)
			.onClick(() => {
				cfg.intervalSec = undefined;
				ctx.opts.save();
				ctx.requestRender();
				ctx.opts.rerender();
			}),
	);

	new Setting(containerEl)
		.setName(strings.transition)
		.setDesc(strings.transitionDesc)
		.addDropdown((d) => {
			for (const tr of SLIDESHOW_TRANSITIONS) d.addOption(tr, strings.transitions[tr]);
			d.setValue(cfg.transition ?? "fade").onChange((v) => {
				cfg.transition = v as SlideshowTransition;
				ctx.opts.save();
				// The duration slider below is pointless for a cut.
				ctx.requestRender();
				ctx.opts.rerender();
			});
		});

	if ((cfg.transition ?? "fade") !== "none") {
		const speed = new Setting(containerEl)
			.setName(strings.transitionSpeed)
			.setDesc(strings.transitionSpeedDesc);
		speed.addSlider((s) =>
			s
				.setLimits(100, SLIDESHOW_MAX_TRANSITION_MS, 100)
				.setValue(slideshowTransitionMs(cfg))
				.setDynamicTooltip()
				.onChange((v) => {
					// No redraw per step — dragging a slider would rebuild the board (and
					// restart every slideshow on it) on every notch. It applies when the
					// dialog closes, as the embed card's zoom slider does.
					cfg.transitionMs = v === SLIDESHOW_DEFAULT_TRANSITION_MS ? undefined : v;
					ctx.opts.save();
				}),
		);
		speed.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					cfg.transitionMs = undefined;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}),
		);
	}

	new Setting(containerEl)
		.setName(strings.kenBurns)
		.setDesc(strings.kenBurnsDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.kenBurns === true).onChange((v) => {
				cfg.kenBurns = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	new Setting(containerEl).setName(strings.displayHeading).setHeading();

	new Setting(containerEl)
		.setName(strings.fit)
		.setDesc(strings.fitDesc)
		.addDropdown((d) => {
			for (const fit of SLIDESHOW_FITS) d.addOption(fit, strings.fits[fit]);
			d.setValue(cfg.fit ?? "cover").onChange((v) => {
				cfg.fit = v as SlideshowFit;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	toggle(ctx, containerEl, strings.controls, strings.controlsDesc, cfg.controls !== false, (v) => {
		cfg.controls = v ? undefined : false;
	});
	toggle(ctx, containerEl, strings.caption, strings.captionDesc, cfg.showCaption === true, (v) => {
		cfg.showCaption = v || undefined;
	});
	toggle(
		ctx,
		containerEl,
		strings.pauseOnHover,
		strings.pauseOnHoverDesc,
		cfg.pauseOnHover === true,
		(v) => {
			cfg.pauseOnHover = v || undefined;
		},
	);
	toggle(
		ctx,
		containerEl,
		strings.openButton,
		strings.openButtonDesc,
		card.showOpenButton === true,
		(v) => {
			card.showOpenButton = v || undefined;
		},
	);
}


/** A save-and-redraw toggle row — every display option below is one. */
function toggle(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	name: string,
	desc: string,
	value: boolean,
	onChange: (value: boolean) => void,
): void {
	new Setting(containerEl)
		.setName(name)
		.setDesc(desc)
		.addToggle((tg) =>
			tg.setValue(value).onChange((v) => {
				onChange(v);
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}


/** The hand-picked list: one row per picture, plus the two ways to add. */
function listSection(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	cfg: SlideshowConfig,
): void {
	const strings = t().editors.slideshow;
	const slides = (cfg.slides ??= []);

	new Setting(containerEl).setName(strings.picturesHeading).setHeading();
	if (slides.length === 0) {
		new Setting(containerEl).setDesc(strings.picturesEmpty);
	}

	slides.forEach((slide, index) => {
		const row = new Setting(containerEl).setClass("hearth-link-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(strings.picturePlaceholder)
				.setValue(slide.path)
				.onChange((v) => {
					slide.path = v;
					ctx.opts.save();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("image")
				.setTooltip(strings.pickPicture)
				.onClick(() => {
					openImagePicker(ctx, (file) => {
						slide.path = file.path;
						ctx.opts.save();
						ctx.requestRender();
					});
				}),
		);
		row.addText((txt) =>
			txt
				.setPlaceholder(strings.captionPlaceholder)
				.setValue(slide.caption ?? "")
				.onChange((v) => {
					slide.caption = v.trim() || undefined;
					ctx.opts.save();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(strings.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, slides, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(strings.moveDown)
				.setDisabled(index === slides.length - 1)
				.onClick(() => moveItem(ctx, slides, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.removePicture)
				.onClick(() => {
					slides.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	const add = new Setting(containerEl);
	add.addButton((b) =>
		b.setButtonText(strings.addPicture).onClick(() => {
			openImagePicker(ctx, (file) => {
				slides.push(newSlide(file.path));
				ctx.opts.save();
				ctx.requestRender();
			});
		}),
	);
	// The bulk add is the bridge between the two sources: take a folder's images
	// as a starting point, then reorder, caption or prune them by hand — which a
	// folder-source card can't do.
	add.addButton((b) =>
		b.setButtonText(strings.addFolderPictures).onClick(() => {
			new FolderPickerModal(ctx.app, (folder) => {
				const existing = new Set(slides.map((slide) => slide.path));
				for (const picture of collectSlideshowPictures(ctx.app, {
					source: "folder",
					folder: folder.path,
					order: "name",
				})) {
					if (!existing.has(picture.path)) slides.push(newSlide(picture.path));
				}
				ctx.opts.save();
				ctx.requestRender();
			}).open();
		}),
	);
}


/** A picture picker limited to the vault's images — a slideshow of PDFs isn't
 * a thing, and the full file list buries the photos. */
function openImagePicker(ctx: CardEditorContext, onChoose: (file: TFile) => void): void {
	new FilePickerModal(ctx.app, onChoose, t().pickers.image, (file) => isImageFile(file)).open();
}


function newSlide(path: string): SlideshowSlide {
	return {
		id: `slide-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
		path,
	};
}


/** The folder source: which folder, and whether subfolders count. */
function folderSection(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	cfg: SlideshowConfig,
): void {
	const strings = t().editors.slideshow;
	const setting = new Setting(containerEl).setName(strings.folder).setDesc(strings.folderDesc);
	setting.addText((txt) =>
		txt
			.setPlaceholder(strings.folderPlaceholder)
			.setValue(cfg.folder ?? "")
			.onChange((v) => {
				cfg.folder = v.trim() || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	setting.addExtraButton((b) =>
		b
			.setIcon("folder-open")
			.setTooltip(strings.pickFolder)
			.onClick(() => {
				new FolderPickerModal(ctx.app, (folder) => {
					// The vault root is stored as "" rather than "/" (see normalizeFolderPath).
					cfg.folder = folder.isRoot() ? undefined : folder.path;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}).open();
			}),
	);

	toggle(
		ctx,
		containerEl,
		strings.includeSubfolders,
		strings.includeSubfoldersDesc,
		cfg.includeSubfolders === true,
		(v) => {
			cfg.includeSubfolders = v || undefined;
		},
	);

	// How many pictures the folder currently yields — the one number that tells
	// you whether the folder (and the subfolder toggle) is the one you meant.
	const found = collectSlideshowPictures(ctx.app, cfg).length;
	new Setting(containerEl).setDesc(strings.folderCount(found));
}


/** Pictures from the vault, rotated on a timer. */
export const slideshowCard: CardDefinition<"slideshow"> = {
	kind: "slideshow",
	templates: [
		{
			id: "slideshow",
			name: "Slideshow",
			icon: "images",
			build: () => ({ kind: "slideshow", title: "Slideshow", slideshow: { slides: [] }, w: 4, h: 3 }),
		},
	],
	render: (view, card, body, component) => renderSlideshow(view, card, body, component),
	renderEditor: (container, ctx) => slideshowEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (!source.slideshow) return;
		copy.slideshow = {
			...source.slideshow,
			slides: source.slideshow.slides?.map((slide) => ({ ...slide })),
		};
	},
	// A folder card has to notice the photo just dropped into it, and a list card
	// the picture that was deleted or renamed — but neither cares about an edit to
	// an unrelated note, which is why this has its own predicate rather than
	// redrawing (and restarting the rotation) on every vault event.
	liveness: { mode: "vault", shouldRedraw: (card, ev) => slideshowReactsTo(card, ev) },
};
