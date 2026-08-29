import { Component, debounce, MarkdownRenderer, moment as createMoment, setIcon, Setting, TFile } from "obsidian";
import { type CardEditorContext } from "./cards/definition";
import { type CheckboxScanOptions, countCheckboxes, toggleCheckboxAt } from "./checkboxes";
import { dailyNameMatcher } from "./dailyformat";
import { localDayKey } from "./dates";
import { t } from "./i18n";
import { mountMarkdownEditor } from "./leafview";
import { internalLinkText, openLink } from "./opener";
import {
	TILE_COLS_DEFAULT,
	TILE_COLS_MAX,
	TILE_COLS_MIN,
	TILE_GAP,
	isTilePinned,
	pinTile,
	resizeTile,
	tileCols,
	tileMetrics,
	tilePlacement,
	tileSizing,
	tileSpans,
	tileSpec,
	tileStartSize,
	unpinTile,
	type TileMetrics,
	type TileSpans,
	type TileSpec,
} from "./tiles";
import { type DashboardCard, type EmbedView, type TileGeometry } from "./types";
import { type HomeView } from "./view";

/**
 * Shared rendering helpers used by more than one card module (issue #103,
 * Phase B). Each kind's own render logic now lives in its `src/cards/<kind>.ts`
 * module; what remains here is only the cross-cutting machinery those modules
 * build on: the `emptyState` placeholder, the floating `cardOverlayButton`
 * (daily, embed, slideshow), the Markdown-embed core (used by the
 * embed, daily, dataview and text cards), the daily-note path resolvers (daily,
 * embed, calendar, stats, heatmap), the vault-activity helpers (calendar,
 * heatmap), the free-form tile drag/resize grid (links, commands), the embed
 * view-state cluster (embed, plus `watchedCardPath`) and `feedHost` (calendar,
 * rss). A helper stays here when two or more kinds need it; anything used by a
 * single kind lives in that kind's module.
 */


/**
 * moment is bundled with Obsidian, not a direct dependency, so it's imported
 * from "obsidian" rather than the "moment" package. Some toolchains resolve
 * that export's type as `any` (no @types/moment in scope), which would make
 * every call/member-access on it "unsafe" — asserting it to this minimal,
 * explicitly-typed surface (the only bits of the Moment API this file uses)
 * keeps every use provably non-`any` regardless of the toolchain.
 */
export interface Moment {
	format(fmt?: string): string;
	clone(): Moment;
	startOf(unit: string): Moment;
	endOf(unit: string): Moment;
	subtract(amount: number, unit: string): Moment;
	add(amount: number, unit: string): Moment;
	day(): number;
	day(value: number): Moment;
	date(): number;
	hours(): number;
	minutes(): number;
	month(): number;
	year(): number;
	diff(other: Moment, unit?: string): number;
	valueOf(): number;
	/** False when the input didn't parse (used for strict format parsing). */
	isValid(): boolean;
}

interface MomentFn {
	(input?: Date | string | number): Moment;
	/** Strict parse against an explicit format — how a daily note's date is
	 * recovered from its filename. */
	(input: string, format: string, strict?: boolean): Moment;
	localeData(): {
		firstDayOfWeek(): number;
		/** A locale's own format string for a named format, e.g. "LT" → "h:mm A"
		 * on a 12-hour locale and "HH:mm" on a 24-hour one. */
		longDateFormat(key: string): string;
	};
}

export const moment: MomentFn = createMoment as unknown as MomentFn;


export function emptyState(body: HTMLElement, icon: string, text: string): void {
	const empty = body.createDiv("hearth-card-empty");
	setIcon(empty.createDiv("hearth-card-empty-icon"), icon);
	empty.createDiv({ cls: "hearth-card-empty-text", text });
}


/** The floating overlay a card's action buttons live in. Named here because
 * two things need to agree on it: what {@link cardOverlayButton} creates, and
 * what {@link resetCardBody} clears away before the next draw. */
const CARD_OVERLAY_CLASS = "hearth-card-actions-overlay";

/**
 * A small action button floated over the card — the "open this file" affordance
 * the daily, embed and slideshow cards each offer. It is attached to the card
 * *element* rather than the body, so it takes no part in the body's scroll or
 * flow, and falls back to the body when the card element can't be found (the
 * card settings preview has no `.hearth-card` ancestor).
 *
 * Because it sits outside the body, emptying the body doesn't remove it — the
 * redraw does, through {@link resetCardBody}.
 */
export function cardOverlayButton(
	body: HTMLElement,
	icon: string,
	label: string,
	onClick: (evt: MouseEvent) => void,
): HTMLButtonElement {
	const cardEl = body.closest(".hearth-card");
	const overlay = (cardEl ?? body).createDiv(CARD_OVERLAY_CLASS);
	const button = overlay.createEl("button", {
		cls: "hearth-open-btn",
		attr: { "aria-label": label },
	});
	setIcon(button, icon);
	button.addEventListener("click", onClick);
	return button;
}


/**
 * Put a card's body back to the state its first draw started from, so every
 * redraw begins from the same place that one did.
 *
 * `body.empty()` alone isn't enough, and neither gap shows up until a card is
 * redrawn — which cards do constantly: on a watched file changing, on any vault
 * event, or on the embed card's view switcher.
 *
 * - **Classes.** A render marks the body with what it drew (`is-embed-host`,
 *   `is-jot-host`, `hearth-card-body-image`, `hearth-card-body-live`,
 *   `hearth-slideshow-host` …) and several of those zero the body's padding.
 *   `empty()` takes away children, not classes, so the marks accumulated: an
 *   embed card switched from its picture view to a note kept
 *   `hearth-card-body-image` and drew the note flush against the card's edges.
 *   Restoring the mount-time list (the body's own class, plus `has-bg`) rather
 *   than naming the render-added ones means a kind can mark the body however it
 *   likes without this having to know.
 * - **Overlays.** {@link cardOverlayButton} deliberately floats its button on
 *   the card *element*, outside the body's scroll and flow — so emptying the
 *   body left it behind and every redraw stacked another copy on top. Pixel
 *   aligned and 0.7 opaque, they never looked like duplicates; they looked like
 *   one button quietly darkening as the vault changed, over a growing pile of
 *   dead click handlers.
 */
export function resetCardBody(body: HTMLElement, baseClasses: string): void {
	body.empty();
	if (body.className !== baseClasses) body.className = baseClasses;
	const cardEl = body.closest(".hearth-card");
	if (!cardEl) return;
	// Direct children only, and read into an array first: a "leaf" card hosts
	// another plugin's view, whose contents are none of Hearth's business, and
	// removing while iterating a live HTMLCollection skips elements.
	for (const child of Array.from(cardEl.children)) {
		if (child.classList.contains(CARD_OVERLAY_CLASS)) child.remove();
	}
}


// ---- Embed (note / image / base / ...) ---------------------------------

/** Which embed view (0 = primary, 1 = second) each card is currently showing.
 * Transient (not persisted): a WeakMap keyed by the card object so the choice
 * survives body redraws and full view rebuilds — the card objects live in
 * settings and are reused — but resets to the primary when Obsidian reloads. */
export const activeEmbedView = new WeakMap<DashboardCard, number>();


/** The resolved views an embed card can switch between: always the primary
 * (`target`/`scale`/`editable`), plus the second view when it carries a target.
 * Cards without a valid second view return a single-element list. */
export function embedViews(card: DashboardCard): EmbedView[] {
	const views: EmbedView[] = [
		{
			target: card.target,
			baseView: card.baseView,
			scale: card.scale,
			imageFit: card.imageFit,
			imagePosition: card.imagePosition,
			editable: card.editable,
			livePreview: card.livePreview,
		},
	];
	if (card.secondView?.target?.trim()) views.push(card.secondView);
	return views;
}


/** The index of the view a card is currently showing, clamped to the views that
 * still exist (so removing the second view falls back to the primary). */
export function activeEmbedIndex(card: DashboardCard): number {
	const count = embedViews(card).length;
	const stored = activeEmbedView.get(card) ?? 0;
	return Math.min(Math.max(0, stored), count - 1);
}


/** The embed view a card is currently showing (the primary unless the user has
 * switched to the second view and it still exists). */
export function activeEmbedViewParams(card: DashboardCard): EmbedView {
	return embedViews(card)[activeEmbedIndex(card)];
}


/** The "Live preview" toggle shared by every card that can edit a note in
 * place (embed — primary and second view — and daily). `target` is whichever
 * object owns the flag: the card itself, or one of its embed views. */
export function livePreviewSetting(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	target: { livePreview?: boolean },
): void {
	new Setting(containerEl)
		.setName(t().editors.embed.livePreview)
		.setDesc(t().editors.embed.livePreviewDesc)
		.addToggle((tg) =>
			tg.setValue(target.livePreview ?? false).onChange((v) => {
				target.livePreview = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}


/** Strip a leading YAML frontmatter block so it isn't rendered as body content. */
function stripFrontmatter(text: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
	return match ? text.slice(match[0].length) : text;
}


/**
 * Make links inside rendered Markdown clickable. Obsidian only resolves link
 * clicks inside a real Markdown view; anchors rendered into a custom container
 * (like a dashboard embed) do nothing on their own. A delegated click listener
 * on the stable host handles internal (wiki) links, external URLs and tags —
 * and keeps working as the content node is re-rendered underneath it.
 *
 * `capture` moves the listener to the capture phase and stops the event once a
 * link is handled. Needed when the content's own renderer puts a click handler
 * on the anchor itself: Datacore's `dc.Link` opens the note in the active tab,
 * which would otherwise run *before* this one and open the note twice, once
 * ignoring the user's "open notes in" setting. Left off by default so
 * Obsidian-rendered content (which has no such handler) behaves exactly as it
 * always has.
 */
export function wireMarkdownLinks(
	view: HomeView,
	host: HTMLElement,
	sourcePath: string,
	opts: { capture?: boolean } = {},
): void {
	host.addEventListener(
		"click",
		(evt) => {
			const anchor = (evt.target as HTMLElement | null)?.closest("a");
			if (!(anchor instanceof HTMLAnchorElement) || !host.contains(anchor)) return;

			/** Take the click for Hearth: never the browser's default, and — in
			 * capture mode — never the anchor's own handler either. */
			const claim = () => {
				evt.preventDefault();
				if (opts.capture) evt.stopPropagation();
			};

			if (anchor.classList.contains("external-link")) {
				const href = anchor.getAttribute("href");
				if (href) {
					claim();
					window.open(href, "_blank");
				}
				return;
			}

			if (anchor.classList.contains("tag")) {
				const tag = anchor.getAttribute("href");
				if (tag) {
					claim();
					const search = view.app.internalPlugins.getPluginById("global-search");
					const instance = search?.instance as
						| { openGlobalSearch?: (query: string) => void }
						| undefined;
					instance?.openGlobalSearch?.(`tag:${tag}`);
				}
				return;
			}

			// Not gated on the `internal-link` class: an embedded Bases view (and
			// other plugin-rendered content) draws note links without it, and those
			// clicks would otherwise fall through to Obsidian's own handler, which
			// always takes over the tab the click came from — the Hearth tab (#106).
			const linktext = internalLinkText(
				anchor.getAttribute("data-href"),
				anchor.getAttribute("href"),
			);
			if (linktext) {
				claim();
				void openLink(view, linktext, sourcePath, "link", evt);
			}
		},
		{ capture: opts.capture === true },
	);
}


/** The task checkboxes a rendered host owns, in document order. Checkboxes
 * inside a transclusion belong to another file, so they're left out: they would
 * shift the ordinals the source mapping counts on (and clicking one should edit
 * that other note, which this wiring can't do). */
function checkboxInputs(host: HTMLElement): HTMLInputElement[] {
	const all = host.querySelectorAll<HTMLInputElement>(
		"input.task-list-item-checkbox, li.task-list-item > input[type='checkbox']",
	);
	return Array.from(all).filter((el) => !el.closest(".internal-embed, .markdown-embed"));
}


/**
 * Make task checkboxes inside rendered Markdown write back to their source
 * (issue #143). Obsidian only persists a checkbox click inside a real preview
 * view; the inputs `MarkdownRenderer.render` emits into a custom container are
 * live but inert, so a tick looked like it stuck and was lost on the next
 * render. Like `wireMarkdownLinks`, this delegates from the stable host so it
 * keeps working as the content node is re-rendered underneath it.
 *
 * `process` applies an edit to the source text (a vault read-modify-write for
 * note-backed cards). The click is reverted in the DOM when the edit doesn't
 * land, so the checkbox never shows a state the source doesn't have.
 */
export function wireMarkdownCheckboxes(
	host: HTMLElement,
	process: (fn: (data: string) => string) => Promise<unknown>,
	opts: CheckboxScanOptions = {},
): void {
	const isCheckbox = (evt: Event): HTMLInputElement | null => {
		const target = evt.target;
		if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return null;
		return target;
	};

	// A card whose preview opens a raw editor on double-click shouldn't do that
	// when the user ticks two boxes quickly. Registered before that handler, so
	// stopping the event here keeps it from running.
	host.addEventListener("dblclick", (evt) => {
		if (isCheckbox(evt)) evt.stopImmediatePropagation();
	});

	host.addEventListener("click", (evt) => {
		const input = isCheckbox(evt);
		if (!input) return;
		const inputs = checkboxInputs(host);
		const ordinal = inputs.indexOf(input);
		if (ordinal < 0) return;
		// The browser has already flipped the input; that's the state to write.
		const checked = input.checked;
		const count = inputs.length;
		evt.stopPropagation();
		const revert = () => {
			if (input.isConnected) input.checked = !checked;
		};
		let applied = false;
		void process((data) => {
			// The render we counted no longer matches the source (an edit landed
			// in between, or the note renders checkboxes we can't account for) —
			// writing by ordinal could tick the wrong line, so write nothing.
			if (countCheckboxes(data, opts) !== count) return data;
			const next = toggleCheckboxAt(data, ordinal, checked, opts);
			if (next === null) return data;
			applied = true;
			return next;
		})
			.then(() => {
				if (!applied) revert();
			})
			.catch(() => {
				revert();
			});
	});
}


/** Apply an edit to a note, atomically re-reading it first so a checkbox click
 * can't clobber a concurrent edit. */
function processFile(
	view: HomeView,
	file: TFile,
): (fn: (data: string) => string) => Promise<unknown> {
	return (fn) => {
		const current = view.app.vault.getAbstractFileByPath(file.path);
		if (!(current instanceof TFile)) return Promise.reject(new Error(`Missing: ${file.path}`));
		return view.app.vault.process(current, fn);
	};
}


/** Render a Markdown file's real content (not a transclusion placeholder). */
export async function renderMarkdownFile(
	view: HomeView,
	file: TFile,
	host: HTMLElement,
	component: Component,
): Promise<void> {
	const raw = await view.app.vault.cachedRead(file);
	await MarkdownRenderer.render(view.app, stripFrontmatter(raw), host, file.path, component);
	wireMarkdownLinks(view, host, file.path);
	wireMarkdownCheckboxes(host, processFile(view, file));
}


/**
 * Editable embed backed by Obsidian's own editor, opened in Live Preview: the
 * note is always editable (no double-click dance), formatting renders as you
 * type, and saving, undo, external-edit sync and every editor plugin are
 * Obsidian's job rather than ours.
 *
 * Hosted as a detached workspace leaf, exactly like the plugin-view card, so it
 * is only alive while the card is on screen. Returns false when hosting can't be
 * set up, leaving `body` untouched so the caller can fall back to
 * `renderEditableEmbed`.
 */
export function renderLivePreviewEmbed(
	view: HomeView,
	file: TFile,
	body: HTMLElement,
	component: Component,
): boolean {
	// `hearth-leaf-host` carries the transparency rules that let a hosted view
	// show the card's own translucent surface; `hearth-leaf-hide-header` drops the
	// breadcrumb/kebab bar, which is pure noise on a single-file card.
	const host = body.createDiv("hearth-leaf-host hearth-leaf-hide-header hearth-jot-live");
	body.addClass("hearth-card-body-live");
	if (mountMarkdownEditor(view.app, file, host, component)) return true;
	host.remove();
	body.removeClass("hearth-card-body-live");
	return false;
}


/**
 * "Live mode" editable embed: shows the note rendered as Markdown and swaps to a
 * raw Markdown editor on double-click. Saves back to the vault and stays in sync
 * with external edits without ever interrupting typing.
 *
 * The plain-editor half of the pair — see `renderLivePreviewEmbed` for the card
 * setting that hosts Obsidian's real editor instead.
 */
export function renderEditableEmbed(
	view: HomeView,
	file: TFile,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	body.addClass("is-jot-host");
	const preview = wrap.createDiv("hearth-embed markdown-rendered hearth-jot-preview");
	preview.setAttribute("title", t().cards.embed.editHint);
	wireMarkdownLinks(view, preview, file.path);
	// Registered before the dblclick-to-edit handler below, so ticking two boxes
	// in quick succession doesn't drop the card into the raw editor.
	wireMarkdownCheckboxes(preview, processFile(view, file));
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-embed-edit hearth-jot-edit",
		attr: { placeholder: t().cards.embed.emptyNotePlaceholder },
	});
	area.hide();

	// `saving` guards against reacting to our own writes; `editing` tracks whether
	// the raw editor is open; `lastSaved` is the content we last wrote so a
	// no-op leave doesn't trigger a redundant write (and modify event).
	let saving = false;
	let editing = false;
	let lastSaved: string | null = null;
	let previewChild: Component | null = null;
	// Monotonic token so overlapping renders (e.g. leaveEdit + a modify event
	// firing together) can't clobber each other. Only the latest render creates
	// a component and touches the DOM; stale in-flight renders bail out. Without
	// this, an earlier render could finish against a component that a later
	// render already unloaded, which drops async content like fenced code blocks.
	let renderToken = 0;

	const renderPreview = () => {
		const token = ++renderToken;
		if (previewChild) {
			component.removeChild(previewChild);
			previewChild = null;
		}
		void view.app.vault.cachedRead(file).then((raw) => {
			// A newer render superseded this one — leave the DOM to the winner.
			if (token !== renderToken) return;
			// The card was torn down while we were reading — don't render into a
			// detached node.
			if (!preview.isConnected) return;
			preview.empty();
			const md = stripFrontmatter(raw);
			if (!md.trim()) {
				preview.addClass("is-empty");
				preview.setText(t().cards.embed.emptyNoteHint);
				return;
			}
			preview.removeClass("is-empty");
			// Render into a FRESH child node each time rather than into `preview`
			// itself. Some third-party code-block processors dedupe re-renders by
			// the block's parent element — e.g. Numerals keeps a
			// WeakMap<parentEl, source> and, on seeing the same source under the
			// same parent, removes the block instead of rendering it. Reusing
			// `preview` (we only empty() it) kept the parent identical across
			// renders, so leaving raw edit made the math block dedupe itself away
			// until an unrelated full re-render built a new preview node. A new
			// content node per render gives each block a fresh parent.
			const content = preview.createDiv("markdown-rendered");
			previewChild = new Component();
			component.addChild(previewChild);
			void MarkdownRenderer.render(view.app, md, content, file.path, previewChild);
		});
	};

	const flush = () => {
		// Nothing changed since our last write — skip it, so a bare
		// double-click-then-leave doesn't fire a self-modify event that races
		// the leaveEdit re-render.
		if (lastSaved !== null && area.value === lastSaved) return;
		const current = view.app.vault.getAbstractFileByPath(file.path);
		if (current instanceof TFile) {
			saving = true;
			lastSaved = area.value;
			void view.app.vault.modify(current, area.value).finally(() => {
				saving = false;
			});
		}
	};

	const enterEdit = () => {
		void view.app.vault.read(file).then((content) => {
			area.value = content;
			lastSaved = content;
			editing = true;
			preview.hide();
			area.show();
			area.focus();
		});
	};
	const leaveEdit = () => {
		flush();
		editing = false;
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);
	area.addEventListener("input", debounce(flush, 500, true));
	area.addEventListener("blur", leaveEdit);

	// Reflect external edits when we aren't the one writing: re-render the preview,
	// or (if editing but not focused) refresh the buffer without yanking the cursor.
	component.registerEvent(
		view.app.vault.on("modify", (changed) => {
			if (changed.path !== file.path || saving) return;
			if (editing) {
				if (area.ownerDocument.activeElement !== area) {
					void view.app.vault.read(file).then((content) => {
						area.value = content;
						lastSaved = content;
					});
				}
			} else {
				renderPreview();
			}
		}),
	);

	renderPreview();
}


// ---- Daily note (today) -------------------------------------------------

export interface DailyNotesOptions {
	/** moment.js date format, e.g. "YYYY-MM-DD". */
	format?: string;
	/** Folder daily notes live in. */
	folder?: string;
	/** Vault path of the template applied to new daily notes. */
	template?: string;
}


/** The core Daily notes plugin's options, or null if it's disabled. Shared by
 * every card that resolves a daily-note path (daily, calendar, stats). */
export function dailyNotesOptions(view: HomeView): DailyNotesOptions | null {
	const plugin = view.app.internalPlugins.getPluginById("daily-notes");
	if (!plugin?.enabled) return null;
	return (plugin.instance as { options?: DailyNotesOptions } | undefined)?.options ?? {};
}


/** Resolve the daily-note path for an arbitrary date from the core Daily
 * notes plugin settings. */
export function dailyNotePath(date: Moment, options: DailyNotesOptions): string {
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	const folder = (options.folder || "").trim().replace(/^\/+|\/+$/g, "");
	return `${folder ? `${folder}/` : ""}${date.format(format)}.md`;
}


export function todaysDailyNotePath(options: DailyNotesOptions): string {
	return dailyNotePath(moment(), options);
}


/**
 * A lookup for *existing* daily notes that survives a locale mismatch.
 *
 * The formatted path is tried first — that's the answer in every ordinary vault
 * and costs one map lookup. It misses when the note's name contains a
 * locale-dependent token (`dd`, `dddd`, `Do`) and the file was written under a
 * different locale than the one moment is running in now — Periodic Notes with
 * its own locale override, or a note carried over from another machine
 * (issue #229). For those formats only, the daily-note folder is scanned once
 * per finder and indexed by day, so the note is found by the date it encodes
 * rather than by the weekday name moment would spell today.
 *
 * Create one finder per render and reuse it across days: the scan is lazy and
 * happens at most once, however many days are probed.
 */
export function dailyNoteFinder(
	view: HomeView,
	options: DailyNotesOptions,
): (day: Moment) => TFile | null {
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	const folder = (options.folder || "").trim().replace(/^\/+|\/+$/g, "");
	const matcher = dailyNameMatcher(format);
	const prefix = folder ? `${folder}/` : "";
	// Only a format that nests (YYYY/MM/DD) may match a name containing a
	// separator; otherwise notes deeper in the tree aren't daily notes.
	const nested = format.includes("/");
	let index: Map<string, TFile> | null = null;

	const scan = (): Map<string, TFile> => {
		const found = new Map<string, TFile>();
		for (const file of view.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(prefix)) continue;
			const name = file.path.slice(prefix.length, -".md".length);
			if (!nested && name.includes("/")) continue;
			const key = matcher?.dayKey(name);
			// First match wins, so a duplicate never displaces the earlier note.
			if (key && !found.has(key)) found.set(key, file);
		}
		return found;
	};

	return (day: Moment): TFile | null => {
		const direct = view.app.vault.getAbstractFileByPath(dailyNotePath(day, options));
		if (direct instanceof TFile) return direct;
		if (!matcher?.localeDependent) return null;
		index ??= scan();
		return index.get(day.format("YYYY-MM-DD")) ?? null;
	};
}


/** The vault path an embed/daily card currently tracks, used to refresh the card
 * live when that file changes. Returns null when there's nothing to watch. */
export function watchedCardPath(view: HomeView, card: DashboardCard): string | null {
	// Track the view the card is currently showing, so switching to the second
	// view live-refreshes on that file's changes (and back again).
	if (card.kind === "embed") return activeEmbedViewParams(card).target?.trim() || null;
	if (card.kind === "daily") {
		const options = dailyNotesOptions(view);
		if (!options) return null;
		// Watch the note the card actually shows: with a locale-dependent format
		// that can be a different name than today's path formats to (issue #229).
		return dailyNoteFinder(view, options)(moment())?.path ?? todaysDailyNotePath(options);
	}
	return null;
}


/** Bucket an edit count into a 1–4 heat level relative to the range peak. */
export function heatLevel(count: number, peak: number): number {
	if (count <= 0) return 0;
	return Math.min(4, Math.ceil((count / peak) * 4));
}


/** Create a daily note for `day` at the plugin's configured path (making any
 * missing parent folders), returning the file or null on failure. Applies the
 * core Daily notes template (with the usual {{date}}/{{time}}/{{title}}
 * substitutions) so a note made here matches Obsidian's own defaults. */
export async function createDailyNoteAt(
	view: HomeView,
	day: Moment,
	options: DailyNotesOptions,
): Promise<TFile | null> {
	const path = dailyNotePath(day, options);
	const existing = view.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	const folder = path.split("/").slice(0, -1).join("/");
	if (folder && !view.app.vault.getAbstractFileByPath(folder)) {
		try {
			await view.app.vault.createFolder(folder);
		} catch {
			// Folder may have been created concurrently — ignore and try the file.
		}
	}
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	let content = "";
	const templatePath = (options.template || "").trim();
	if (templatePath) {
		const tpl =
			view.app.vault.getAbstractFileByPath(templatePath) ??
			view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				content = applyDailyTemplate(await view.app.vault.read(tpl), day, format);
			} catch {
				content = "";
			}
		}
	}
	try {
		return await view.app.vault.create(path, content);
	} catch {
		return null;
	}
}


/** Substitute the daily-note template variables Obsidian's core plugin supports
 * for an arbitrary date: {{date}}, {{time}}, {{title}} and their {{date:FMT}}/
 * {{time:FMT}} formatted variants. */
function applyDailyTemplate(raw: string, day: Moment, format: string): string {
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, day.format(format))
		.replace(/\{\{\s*time\s*\}\}/gi, day.format("HH:mm"))
		.replace(/\{\{\s*title\s*\}\}/gi, day.format(format));
}


/** Count files edited (or created) per calendar day, keyed by YYYY-MM-DD. Read
 * entirely from the in-memory file stats — no file reads. Shared by the
 * calendar heatmap tint and the activity-heatmap card. */
export function activityByDay(app: HomeView["app"], metric: "modified" | "created"): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const ts = metric === "created" ? file.stat.ctime : file.stat.mtime;
		const key = localDayKey(ts);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}


/**
 * Create the tile grid a launchpad-like card draws its buttons into — the
 * Links, Commands and Templater cards, which run the same grid, the same drag
 * and the same resize.
 *
 * The card's sizing style decides what the grid is: the fixed style hands CSS a
 * base tile size and lets the columns auto-fill the card, while the scaled style
 * hands it a column count and lets each cell — and so each button — be a
 * fraction of the card. See `src/tiles.ts` for the arithmetic both share.
 */
export function createTileGrid(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
): { grid: HTMLElement; spec: TileSpec } {
	const spec = tileSpec(card);
	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	if (spec.sizing === "scale") {
		grid.addClass("is-tile-scaled");
		grid.style.setProperty("--hearth-tile-cols", String(spec.cols));
		// The cell size is a fraction of the body's width, which CSS can only
		// read from a container — so the body becomes one. (Set here rather than
		// in the stylesheet so no other card pays for the containment.)
		body.addClass("hearth-tiles-scaled");
	} else {
		grid.style.setProperty("--hearth-tile", `${spec.baseTile}px`);
	}
	// Flag the card body so CSS can disable the card drag overlay over tiles in
	// arrange mode (tiles are self-contained widgets with their own resize).
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	return { grid, spec };
}


/**
 * The settings every launchpad-like card's editor offers for its buttons: which
 * of the two sizing styles the card is on and, for the scaled one, how many
 * buttons wide its grid is (which is what decides how big a button is, since a
 * button is a fraction of the card).
 *
 * Shared by the Links, Commands and Templater editors — the three cards draw
 * the same grid, so they answer the same two questions.
 */
export function tileSizingSettings(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.tiles;
	const card = ctx.card;
	new Setting(containerEl)
		.setName(strings.sizing)
		.setDesc(strings.sizingDesc)
		.addDropdown((d) => {
			d.addOption("scale", strings.sizingScale);
			d.addOption("fixed", strings.sizingFixed);
			d.setValue(tileSizing(card)).onChange((v) => {
				card.tileSizing = v === "scale" ? "scale" : "fixed";
				ctx.opts.save();
				ctx.opts.rerender();
				// What sits under this differs by style — a column count for one,
				// a pixel size for the other — so rebuild the editor around it.
				ctx.requestRender();
			});
		});
	if (tileSizing(card) !== "scale") return;
	const across = new Setting(containerEl)
		.setName(strings.across)
		.setDesc(strings.acrossDesc);
	across.addSlider((s) => {
		s.setLimits(TILE_COLS_MIN, TILE_COLS_MAX, 1)
			.setValue(tileCols(card.tileCols))
			.onChange((v) => {
				card.tileCols = v === TILE_COLS_DEFAULT ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	across.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				card.tileCols = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
}


/** Apply a tile's size and position: both are converted into grid column/row
 * spans (and, when the tile is pinned, grid lines) by `src/tiles.ts`, so a tile
 * spans N columns × M rows and can grow vertically without its row's height
 * being governed by the tallest tile. */
export function applyTileSize(tile: HTMLElement, item: TileGeometry, spec: TileSpec): void {
	const spans = tileSpans(item, spec);
	tile.style.setProperty("--hearth-tile-cs", String(spans.cs));
	tile.style.setProperty("--hearth-tile-rs", String(spans.rs));
	applyTileIconOnly(tile, spans, spec);
	// Free-form position: pin to a grid line (1-based). When either is missing
	// the tile auto-flows into the next available cell.
	const { col, row } = tilePlacement(item, spans, spec);
	if (col != null) tile.style.setProperty("--hearth-tile-col", String(col));
	else tile.style.removeProperty("--hearth-tile-col");
	if (row != null) tile.style.setProperty("--hearth-tile-row", String(row));
	else tile.style.removeProperty("--hearth-tile-row");
}


/** Toggle icon-only mode when a fixed-size tile is too small to show its label.
 * Below two fine rows there's no vertical room for text, and at a single column
 * there's no horizontal room; in both cases the label ellipsises away to nothing
 * while still reserving its line + gap, which pushes the icon off-centre.
 * Dropping the label (and its gap) then lets the icon sit dead-centre.
 *
 * A scaled tile's span says nothing about how many pixels it got — that's the
 * point of it — so there the same call is made in CSS, by a container query on
 * the tile's own measured size. */
function applyTileIconOnly(tile: HTMLElement, spans: TileSpans, spec: TileSpec): void {
	if (spec.sizing === "scale") return;
	tile.toggleClass("is-icon-only", spans.rs <= 1 || spans.cs <= 1);
}


/** Attach a widget-style resize handle to a tile. The handle is a clear,
 * grabbable corner grip (bottom-right) that resizes width and height together:
 * on a fine pixel grid in the fixed style, and in whole cells of the card's own
 * grid in the scaled one, where a button is a fraction of the card rather than a
 * pixel size. Fully self-contained: stops propagation so the card's drag engine
 * never interferes. */
export function makeTileResizable(
	view: HomeView,
	tile: HTMLElement,
	item: TileGeometry,
	spec: TileSpec,
): void {
	const handle = tile.createDiv("hearth-tile-resize");
	handle.setAttribute("aria-hidden", "true");

	const stop = (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	let resizing = false;
	let startW = 0;
	let startH = 0;
	let startX = 0;
	let startY = 0;
	let metrics = tileMetrics(0, spec);

	handle.addEventListener("pointerdown", (e) => {
		stop(e);
		resizing = true;
		// Measure the grid the gesture is happening on, so a scaled tile can be
		// mapped between pixels and cells at the card's current size.
		metrics = gridMetrics(tile, spec);
		const start = tileStartSize(item, spec, metrics);
		startW = start.width;
		startH = start.height;
		startX = e.clientX;
		startY = e.clientY;
		handle.setPointerCapture(e.pointerId);
		tile.addClass("is-tile-resizing");
		tile.closest(".hearth-card")?.addClass("has-tile-gesture");
	});

	handle.addEventListener("pointermove", (e) => {
		if (!resizing) return;
		e.preventDefault();
		e.stopPropagation();
		const spans = resizeTile(
			item,
			spec,
			startW + (e.clientX - startX),
			startH + (e.clientY - startY),
			metrics,
		);
		// Convert the live size to grid spans so the tile grows in the steps its
		// style allows — small and precise, or whole cells.
		tile.style.setProperty("--hearth-tile-cs", String(spans.cs));
		tile.style.setProperty("--hearth-tile-rs", String(spans.rs));
		applyTileIconOnly(tile, spans, spec);
	});

	const end = (e: PointerEvent) => {
		if (!resizing) return;
		resizing = false;
		try {
			handle.releasePointerCapture(e.pointerId);
		} catch {
			// pointer already released
		}
		tile.removeClass("is-tile-resizing");
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		void view.plugin.saveData(view.plugin.settings);
	};
	handle.addEventListener("pointerup", end);
	handle.addEventListener("pointercancel", end);
}


/** The metrics of the grid a tile sits in, measured from the DOM. */
function gridMetrics(tile: HTMLElement, spec: TileSpec): TileMetrics {
	const grid = tile.closest<HTMLElement>(".hearth-links");
	const width = grid?.getBoundingClientRect().width ?? 0;
	return tileMetrics(width, spec);
}


/** Make a tile draggable (to reposition it within its card) in arrange mode.
 *  Uses pointer events (not HTML5 DnD) so it coexists with the resize handle
 *  and doesn't trigger the card's drag engine.
 *
 *  Two modes:
 *  - Free-form (default, `autoFlow = false`): the tile floats under the
 *    pointer and lands on the cell under it on drop. Tiles may overlap and
 *    be placed anywhere; siblings never move. Overlapping tiles are flagged
 *    with a glow (see `markOverlappingTiles`) so a hidden tile is visible.
 *  - Auto-shift (beta, `autoFlow = true`): a dashed placeholder occupies the
 *    target slot and siblings swap aside live (phone-widget style). See
 *    `makeTileAutoFlowDrag`. */
export function makeTileDraggable<T extends TileGeometry & { id: string }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
	autoFlow: boolean,
	spec: TileSpec,
): void {
	if (autoFlow) {
		makeTileAutoFlowDrag(view, container, tile, item, spec);
	} else {
		makeTileFreeFormDrag(view, container, tile, item, spec);
	}
	tile.setAttribute("data-tile-id", item.id);
	// Double-click a pinned tile to clear its position and let it auto-flow.
	if (isTilePinned(item, spec)) {
		tile.addEventListener("dblclick", (e) => {
			e.stopPropagation();
			unpinTile(item, spec);
			void view.plugin.saveData(view.plugin.settings);
			view.render();
		});
	}
}


/** Free-form drag: the tile floats under the pointer via a transform (delta
 *  from the grab point) and lands on whatever cell the pointer is over on
 *  drop. Siblings don't move; tiles may overlap. A dashed ghost outline
 *  follows the pointer so the drop target is visible. Overlapping tiles glow
 *  so a hidden tile stays visible (an undesirable state worth flagging).
 *  Using a transform (not absolute positioning) avoids any offset/jump —
 *  the tile simply translates by the pointer delta from its grid slot. */
function makeTileFreeFormDrag<T extends TileGeometry & { id: string }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
	spec: TileSpec,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;
	// Dashed ghost showing the drop target cell under the pointer.
	let ghost: HTMLElement | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Insert a dashed ghost outline that will follow the pointer.
			ghost = container.createDiv("hearth-tile-ghost");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || "1";
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || "1";
			ghost.style.setProperty("--hearth-tile-cs", cs);
			ghost.style.setProperty("--hearth-tile-rs", rs);
		}
		// Float the tile by the pointer delta — no position/size changes, so
		// there's no offset or jump. The grid slot stays reserved.
		tile.setCssStyles({ transform: `translate(${dx}px, ${dy}px)` });
		// Move the ghost outline to the cell under the pointer.
		if (ghost) {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile, spec);
			if (cell) {
				ghost.style.setProperty("--hearth-tile-col", String(cell.col));
				ghost.style.setProperty("--hearth-tile-row", String(cell.row));
			}
		}
		// Live-flag tiles the dragged tile is covering so overlaps are visible
		// as it moves (the dragged tile is on top and ignored by the marker).
		markOverlappingTiles(container);
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		if (ghost) {
			ghost.remove();
			ghost = null;
		}
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		// Drop on the cell under the pointer (free-form; may overlap others).
		const cell = pickGridCell(container, e.clientX, e.clientY, tile, spec);
		if (cell) pinTile(item, spec, cell.col, cell.row);
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}


/** Auto-shift drag (beta): a dashed placeholder occupies the dragged tile's
 *  target slot and siblings swap aside live, like phone widgets. On drop,
 *  only the dragged tile's `col`/`row` is persisted; siblings revert to
 *  their stored positions (a full re-render follows), so a tile that was
 *  shoved aside comes back if its slot wasn't taken. */
function makeTileAutoFlowDrag<T extends TileGeometry & { id: string }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
	spec: TileSpec,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;

	// The tile's offset within the container at drag start, so we can position
	// it absolutely without a jump (delta-based movement).
	let baseLeft = 0;
	let baseTop = 0;
	let baseWidth = 0;
	let baseHeight = 0;

	let placeholder: HTMLElement | null = null;
	let placeholderPos: { col: number; row: number } | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Measure the tile's position relative to the container BEFORE
			// removing it from flow, so we can place it absolutely at the
			// same spot (then move by the pointer delta — no jump).
			const rect = tile.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			baseLeft = rect.left - containerRect.left;
			baseTop = rect.top - containerRect.top;
			baseWidth = rect.width;
			baseHeight = rect.height;
			const pinned = tilePlacement(item, tileSpans(item, spec), spec);
			placeholderPos = getTileCell(tile, container, spec) ?? {
				col: pinned.col ?? 1,
				row: pinned.row ?? 1,
			};
			placeholder = container.createDiv("hearth-tile-placeholder");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || "1";
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || "1";
			placeholder.style.setProperty("--hearth-tile-cs", cs);
			placeholder.style.setProperty("--hearth-tile-rs", rs);
			placeholder.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
			placeholder.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
			// Freeze every sibling tile to its current cell so a swap with the
			// placeholder moves exactly one tile.
			const siblings = Array.from(
				container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
			);
			for (const sib of siblings) {
				if (sib === tile) continue;
				const cell = getTileCell(sib, container, spec);
				if (cell) {
					sib.style.setProperty("--hearth-tile-col", String(cell.col));
					sib.style.setProperty("--hearth-tile-row", String(cell.row));
				}
			}
			// Take the tile out of flow and immediately pin it to its current
			// spot so it doesn't jump before the first delta is applied.
			tile.setCssStyles({
				position: "absolute",
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				left: `${baseLeft}px`,
				top: `${baseTop}px`,
			});
		}
		// Move by the pointer delta from the grab point — no offset issues.
		tile.setCssStyles({
			position: "absolute",
			width: `${baseWidth}px`,
			height: `${baseHeight}px`,
			left: `${baseLeft + dx}px`,
			top: `${baseTop + dy}px`,
		});
		if (!placeholder || !placeholderPos) return;
		const other = findTileUnderPointer(container, e.clientX, e.clientY, tile);
		if (other) {
			const otherPos = getTileCell(other, container, spec);
			if (otherPos) {
				other.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
				other.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
				placeholder.style.setProperty("--hearth-tile-col", String(otherPos.col));
				placeholder.style.setProperty("--hearth-tile-row", String(otherPos.row));
				placeholderPos = otherPos;
			}
		} else {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile, spec);
			if (cell) {
				placeholder.style.setProperty("--hearth-tile-col", String(cell.col));
				placeholder.style.setProperty("--hearth-tile-row", String(cell.row));
				placeholderPos = cell;
			}
		}
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		const dropPos = placeholderPos;
		if (placeholder) {
			placeholder.remove();
			placeholder = null;
		}
		const siblings = Array.from(
			container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
		);
		for (const sib of siblings) {
			if (sib === tile) continue;
			sib.style.removeProperty("--hearth-tile-col");
			sib.style.removeProperty("--hearth-tile-row");
		}
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		if (dropPos) pinTile(item, spec, dropPos.col, dropPos.row);
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}


/** Mark tiles that are obscured behind another tile in the same card, so the
 *  user can see (and fix) the undesirable overlap. A tile counts as obscured
 *  when another sibling tile's rect covers a meaningful part of it. The
 *  actively-dragged tile is skipped (it's on top, so it can't be "obscured"),
 *  but a tile it covers IS flagged. Only runs in arrange mode. */
export function markOverlappingTiles(container: HTMLElement): void {
	const tiles = Array.from(container.querySelectorAll<HTMLElement>(".hearth-link-tile"));
	for (const t of tiles) t.removeClass("is-obscured");
	const rects = tiles.map((t) => ({
		t,
		r: t.getBoundingClientRect(),
		dragging: t.classList.contains("is-tile-dragging"),
	}));
	for (let i = 0; i < rects.length; i++) {
		const a = rects[i];
		if (a.dragging) continue; // the dragged tile floats on top — never obscured
		// A tile is obscured if any other tile (drawn later, i.e. on top in
		// DOM order, or the floating dragged tile) overlaps more than a sliver
		// of its area.
		for (let j = i + 1; j < rects.length; j++) {
			const b = rects[j];
			const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
			const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
			const overlap = ix * iy;
			const aArea = a.r.width * a.r.height;
			// Flag `a` (the lower-DOM, i.e. underneath) tile when `b` covers
			// more than 15% of it.
			if (aArea > 0 && overlap / aArea > 0.15) {
				a.t.addClass("is-obscured");
			}
		}
	}
}


/** Read a tile's current grid cell from the DOM. Prefers the inline
 *  `--hearth-tile-col/row` (set for pinned tiles), falling back to the tile's
 *  rendered position mapped onto the grid's metrics. Returns null when the
 *  metrics can't be measured reliably. */
function getTileCell(
	tile: HTMLElement,
	container: HTMLElement,
	spec: TileSpec,
): { col: number; row: number } | null {
	const colAttr = tile.style.getPropertyValue("--hearth-tile-col");
	const rowAttr = tile.style.getPropertyValue("--hearth-tile-row");
	if (colAttr && rowAttr) {
		const col = parseInt(colAttr, 10);
		const row = parseInt(rowAttr, 10);
		if (Number.isFinite(col) && Number.isFinite(row)) return { col, row };
	}
	const rect = tile.getBoundingClientRect();
	const cRect = container.getBoundingClientRect();
	if (cRect.width <= 0) return null;
	const { colW, rowH } = tileMetrics(cRect.width, spec);
	const relX = rect.left - cRect.left;
	const relY = rect.top - cRect.top;
	const col = Math.max(1, Math.round(relX / (colW + TILE_GAP)) + 1);
	const row = Math.max(1, Math.round(relY / (rowH + TILE_GAP)) + 1);
	return { col, row };
}


/** Find the `.hearth-link-tile` under a pointer, excluding the dragged tile
 *  (and anything inside it, like its resize handle). The dragged tile has
 *  pointer-events: none while dragging, so elementFromPoint already skips it,
 *  but we also guard against its descendants in case a child overrides. */
function findTileUnderPointer(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	except: HTMLElement,
): HTMLElement | null {
	const el = activeDocument.elementFromPoint(clientX, clientY) as HTMLElement | null;
	if (!el) return null;
	if (except.contains(el)) return null;
	const tile = el.closest<HTMLElement>(".hearth-link-tile");
	if (!tile || tile === except || !container.contains(tile)) return null;
	return tile;
}


/** Work out the (col, row) grid cell under a pointer, relative to the card's
 *  tile grid. `container` is the `.hearth-links` grid element. Returns null
 *  when the metrics can't be measured reliably. Clamps to the grid's bounds
 *  so a tile dropped near the edge lands on the last valid cell, not off-board.
 *  `tile` is the dragged element (its span is used so the drop keeps the tile
 *  fully inside the grid — the column count limits the start column). */
function pickGridCell(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	tile: HTMLElement,
	spec: TileSpec,
): { col: number; row: number } | null {
	const rect = container.getBoundingClientRect();
	if (rect.width <= 0) return null;
	// The column count and the real column width at the card's current size:
	// the fixed style's columns auto-fill and then stretch past their minimum,
	// the scaled style's are the card's own.
	const { columns, colW, rowH } = tileMetrics(rect.width, spec);
	// The dragged tile's column span, so we keep its start within bounds.
	const cs = parseInt(tile.style.getPropertyValue("--hearth-tile-cs"), 10) || 1;
	// Pointer relative to the grid's content box, in cells (1-based lines).
	const relX = clientX - rect.left;
	const relY = clientY - rect.top;
	let col = Math.round(relX / (colW + TILE_GAP)) + 1;
	let row = Math.round(relY / (rowH + TILE_GAP)) + 1;
	col = Math.max(1, Math.min(col, Math.max(1, columns - cs + 1)));
	row = Math.max(1, row);
	return { col, row };
}


/** A source's short host label, e.g. "https://blog.foo.com/feed" → "blog.foo.com". */
export function feedHost(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
