/**
 * A picture of the board, taken at publish, with everything readable taken out
 * of it first.
 *
 * A gallery entry's picture, and the only one there is. Drawing a board from
 * its card positions was tried and dropped: a diagram of a board is not a look,
 * and a board's look is what a listing is selling.
 *
 * Three rules, and the first is the whole reason this file is careful:
 *
 * - **Nothing readable is in the frame when the shutter opens.** Every text
 *   node under the board is replaced with block characters and every embedded
 *   picture is blurred *before* the capture and restored after, in a `finally`.
 *   This is a redaction rather than an obscuring: the characters are not in the
 *   DOM at the moment it is painted, so there is nothing in the image to
 *   recover. What survives is the layout, the card shapes, the colours, the
 *   icons and the wallpaper — which is what a look is. The one exception is an
 *   editor hosted inside a card, whose DOM *is* a note and cannot be written to
 *   without editing it: that is blanked by style instead — see
 *   {@link EDITABLE_INSIDE}.
 * - **The author sees it before it goes.** The share dialog shows the captured
 *   image and will not upload one that hasn't been looked at. A promise about
 *   what a picture contains is worth much less than the picture.
 * - **It is best-effort and desktop-only.** Capturing needs Electron, which
 *   Obsidian's mobile app doesn't have and a future desktop build might not
 *   expose. Every failure path returns null, and the publish dialog says so
 *   rather than uploading an entry with no picture in it.
 */

import { Platform } from "obsidian";

/**
 * Widest a snapshot is stored at.
 *
 * A listing tile is ~220px and the detail view ~680px, so this covers the
 * larger of the two comfortably. Every byte is downloaded by everyone who
 * installs the board *and* carried inside the package forever, so this is a
 * trade rather than a maximum — but a picture that sells a dashboard has to be
 * worth looking at, and a redacted board is flat colour and soft bars, which
 * survives compression better than a photograph would.
 */
const MAX_WIDTH = 900;

/**
 * How many screenfuls of a scrolling board are photographed.
 *
 * A board is meant to be a screen, so most take one. This bounds what a very
 * long one costs — in the time the capture takes, in the pixels the canvas
 * holds, and in the bytes every reader downloads forever.
 */
const MAX_SCREENFULS = 4;

/** JPEG rather than PNG: a screenshot of a dashboard is a photograph-shaped
 * thing (gradients, a wallpaper, soft shadows), and PNG would triple the size
 * of every package for no visible gain at this scale. */
const QUALITY = 74;

/**
 * Qualities to try, in order, until the picture fits {@link MAX_BYTES}.
 *
 * Most boards are done at the first. The rest exist so that a long, busy board
 * gets a slightly softer picture rather than no entry — see `stitch`.
 */
const QUALITY_STEPS = [QUALITY, 60, 48, 36];

/**
 * The most a picture may weigh.
 *
 * Under the 1 MiB a gallery server accepts, with room for the base64 expansion
 * and the rest of the package around it. Every byte is downloaded by everyone
 * who installs the board and carried in the file forever.
 */
const MAX_BYTES = 850 * 1024;

/** The character text is replaced with. A full block, so the styled bar over it
 * has something the width of the original words to cover. */
const BLOCK = "█";

/**
 * What gets redacted: the inside of a card, and nothing else.
 *
 * The board's chrome is the thing being published — blanking the header, the
 * toolbar, the switcher or a card's own title makes a picture of a board nobody
 * could recognise, which defeats the point of taking one.
 */
const REDACT_INSIDE = ".hearth-card-body";

/**
 * Card kinds whose bodies are left alone, because there is nothing of the
 * author in them.
 *
 * The rule is the strip's: a card is censored when publishing removes something
 * from it or when it renders something read out of the vault. A clock renders
 * the time, a pet renders a pet, a search bar renders an empty field — none of
 * those is anybody's data, and blanking them makes the picture worse for no
 * gain. Everything else is censored, which is the safe direction for a list
 * like this to be wrong in: a kind nobody added here is protected by default.
 *
 * It is deliberately tiny, and each absence has a reason: `weather` shows the
 * author's location, which the strip takes; `calculator` shows its last sum,
 * which the strip takes; `stats` and `pet` both show counts of somebody's vault
 * ("37 notes today", a streak); `searchbar` holds a query and its results. A
 * card is on this list only when there is nothing it could be showing that
 * belongs to anyone.
 */
const OPEN_KINDS = new Set(["clock"]);

/** Class the wrapper carries, so `styles.css` can draw the bars. */
const REDACTED_CLASS = "hearth-snapshot-bar";

/**
 * Regions the redaction must not touch the *text* of, because their DOM is a
 * document rather than a rendering of one.
 *
 * A live-preview note card hosts Obsidian's own Markdown editor (see
 * `leafview.ts`), and a CodeMirror editor watches its contenteditable for
 * changes: anything written into that DOM is read back as the user having
 * typed it, folded into the editor's state and saved to the vault. Replacing
 * its text nodes with blocks therefore did not redact a picture — it rewrote
 * the note, and the `restore()` afterwards put the characters back in a DOM
 * CodeMirror had already moved on from, so the file kept the blocks. The same
 * is true of any other editable surface a hosted view mounts.
 *
 * So these are blanked by *style* instead: {@link BLANKED_CLASS} hides what is
 * inside them and paints no glyphs, and the walk skips everything within.
 * Nothing readable is in the frame either way; the difference is that the vault
 * is not written to in order to take a photograph. A form field's value is
 * treated the same way and for the same reason — see the field pass in
 * `redact`.
 */
const EDITABLE_INSIDE = '[contenteditable]:not([contenteditable="false"])';

/**
 * What is blanked instead of an editable region's text.
 *
 * The whole editor rather than the contenteditable alone, when there is one:
 * CodeMirror paints gutters, the active-line highlight and its own widgets
 * around the editable element, and half a blanked editor reads worse than a
 * blank one.
 */
const EDITABLE_HOST = ".cm-editor";

/** Class a region carries while the shutter is open, instead of having its text
 * replaced: an editor, or a field holding a value. `styles.css` hides what is
 * inside it, paints its text away and blurs the rest. */
const BLANKED_CLASS = "hearth-snapshot-blank";

/**
 * The bars drawn *over* a blanked editor, so a note card photographs as a note
 * rather than as a grey rectangle.
 *
 * A blanked editor is safe but mute: hiding it takes the layout with it, and a
 * board whose centrepiece is a live-preview note then sells itself with an
 * empty slab. The line rhythm, though, is geometry rather than text —
 * `visibility: hidden` keeps every box exactly where it was, so the *shape* of
 * the writing can still be measured after the words have stopped being
 * painted, and drawn back as bars.
 *
 * This is decoration over a region that is already blank. Nothing here can
 * expose anything: if the measuring finds nothing, draws nothing, or gets the
 * geometry wrong, what is photographed is the slab it would have been anyway.
 * That is why it is allowed to be best-effort.
 *
 * Two things it deliberately does not do. It does not read CodeMirror's token
 * classes to colour headings or links: those class names differ between themes
 * and Markdown plugins, and colouring by token would publish the note's
 * structure. And it never invents a line — every bar stands where text really
 * is, so a two-line note photographs as two lines.
 */
const LINES_CLASS = "hearth-snapshot-lines";

/** Marks an editor whose bars were drawn, so `styles.css` can drop the slab
 * that stands in when they weren't. */
const LINED_CLASS = "is-lined";

/**
 * The most bars one editor is drawn with.
 *
 * CodeMirror only renders the lines near the viewport, so a normal card is far
 * under this. The cap is for the pathological case — a card holding a whole
 * book with virtualisation off — where measuring every run would cost more
 * than the picture is worth.
 */
const MAX_BARS = 600;

/** Bars thinner than this are dropped: a stray one-pixel rect from a wrap point
 * or a zero-width span reads as dirt on the picture. */
const MIN_BAR = 3;

/**
 * Parts of a card that stay readable, because they are the card's own
 * furniture rather than anything of the author's.
 *
 * A calendar's dates are the clearest case: "March 2026", "Mon", "17" say
 * nothing about whose calendar it is, and blanking them turns a recognisable
 * month grid into grey confetti. The same goes for the agenda's and the
 * schedule's day headings. What sits *beside* those — the event, the note, the
 * task — is still censored, because that is the part that is somebody's.
 */
const KEEP_INSIDE = [
	".hearth-calendar-head",
	".hearth-calendar-label",
	".hearth-calendar-dow",
	".hearth-calendar-wk",
	".hearth-calendar-daynum",
	".hearth-agenda-month",
	".hearth-agenda-date",
	".hearth-agenda-label",
	".hearth-sched-daynum",
	".hearth-sched-headnum",
	".hearth-sched-listdate",
].join(",");

/** Longest run of blocks one string becomes. A card holding an essay should not
 * paint ten thousand glyphs to be photographed. */
const MAX_RUN = 120;

/**
 * What a piece of readable text becomes.
 *
 * Exported because it is the *rule* — everything else in this file is the DOM
 * traversal that applies it — and it is worth being able to state exactly what
 * survives: nothing but the whitespace. Length is kept up to the cap so lines
 * keep their shape, and the spaces between words are kept so a redacted line
 * still reads as a line of text rather than as one solid bar.
 */
export function redactedText(value: string): string {
	return value.slice(0, MAX_RUN).replace(/\S/gu, BLOCK);
}

/** What a capture produced. */
export interface BoardSnapshot {
	/** base64 JPEG, no data-URI prefix — the shape `PackageAsset.data` wants. */
	data: string;
	mime: string;
	/** Decoded length, for the asset's own `bytes`. */
	bytes: number;
	width: number;
	height: number;
}

/** The asset id a snapshot travels under. Reserved: `embedAssets` mints ids of
 * the form `a1`, `a2`, … so this cannot collide with a real picture. */
export const SNAPSHOT_ASSET_ID = "snapshot";

/**
 * Electron's current web contents, or null.
 *
 * Two module names, because the API moved: older builds expose `remote` from
 * `electron` itself, newer ones through `@electron/remote`. Both are internals
 * of the app Hearth runs inside, so every step is guarded and a build that has
 * neither simply cannot take a picture.
 */
function webContents(): WebContentsLike | null {
	if (!Platform.isDesktopApp) return null;
	const load = (window as unknown as { require?: (id: string) => unknown }).require;
	if (typeof load !== "function") return null;
	for (const id of ["@electron/remote", "electron"]) {
		try {
			const mod = load(id) as {
				getCurrentWebContents?: () => unknown;
				remote?: { getCurrentWebContents?: () => unknown };
			};
			const get = mod?.getCurrentWebContents ?? mod?.remote?.getCurrentWebContents;
			if (typeof get !== "function") continue;
			const contents: unknown = get.call(mod.remote ?? mod);
			if (contents && typeof (contents as Record<string, unknown>).capturePage === "function") {
				return contents as WebContentsLike;
			}
		} catch {
			// A module that isn't there, or a build that refuses it. Try the next.
		}
	}
	return null;
}

/** The slice of Electron's `webContents` this file uses. */
interface WebContentsLike {
	capturePage(rect: unknown): Promise<NativeImageLike>;
}

/** The slice of Electron's NativeImage this file uses. PNG rather than JPEG on
 * the way out of Electron: the slices are re-encoded once as a whole after
 * stitching, and putting a lossy step in front of that would compress the same
 * pixels twice. */
interface NativeImageLike {
	getSize(): { width: number; height: number };
	toPNG(): Uint8Array;
	isEmpty(): boolean;
}

/** Whether this build can take a picture at all, so the dialog can offer the
 * choice rather than showing a switch that does nothing. */
export function canSnapshot(): boolean {
	return webContents() !== null;
}

/**
 * Replace every text node under `root` with blocks, and blur every embedded
 * picture. Returns the undo.
 *
 * Text nodes rather than a CSS trick, deliberately. `color: transparent` leaves
 * the characters in the document and relies on the compositor never painting
 * them; a blur leaves them recoverable in principle. Replacing the data means
 * the text is not there to be painted, which is a property of the DOM rather
 * than a property of how it happened to be rendered.
 */
interface Redaction {
	/** Redact anything that has appeared since the last call. Safe to call any
	 * number of times; already-redacted nodes are left alone. */
	reapply(): void;
	/** Whether the board has changed since {@link settle} was last called — a
	 * query that came back, a row that rendered, a card that mounted. A shot
	 * taken across one of those cannot be trusted to have been redacted, so the
	 * caller takes it again. */
	changed(): boolean;
	/** Mark the board as quiet, at the moment just before a shot. */
	settle(): void;
	/** Put everything back. */
	restore(): void;
}

/**
 * Draw one bar per run of text inside a blanked editor.
 *
 * Measured with a `Range` over each text node rather than from the line boxes:
 * a line box is the full width of the editor whatever it holds, so bars taken
 * from it would be a stack of identical stripes. A range around the text stops
 * where the text stops, which is what makes the result read as writing.
 *
 * The bars go in a container of the painter's own, appended to `document.body`
 * — **never inside the editor**. Appending into the contenteditable is the
 * exact mutation that made publishing rewrite people's notes; and `body` also
 * keeps the container clear of the card's own backdrop filter, which would
 * otherwise become the containing block for its fixed position and shift every
 * bar. Positions are in viewport coordinates, which is what `capturePage` is
 * handed too, and are re-measured for each screenful.
 *
 * Returns the container, or null when there was nothing to draw.
 */
function paintLines(region: HTMLElement): HTMLElement | null {
	const box = region.getBoundingClientRect();
	if (box.width < 8 || box.height < 8) return null;

	const overlay = document.body.createDiv(LINES_CLASS);
	// Clipped to the editor, so a bar from a line scrolled half out of the card
	// stops at the card's edge rather than being drawn across the board.
	overlay.style.left = `${box.left}px`;
	overlay.style.top = `${box.top}px`;
	overlay.style.width = `${box.width}px`;
	overlay.style.height = `${box.height}px`;

	let drawn = 0;
	const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node && drawn < MAX_BARS; node = walker.nextNode()) {
		const text = node as Text;
		if (!text.data.trim()) continue;
		const range = document.createRange();
		range.selectNodeContents(text);
		// One rect per *visual* line: a paragraph that wraps four times gives
		// four, which is how a wrapped sentence keeps its shape.
		for (const rect of Array.from(range.getClientRects())) {
			if (rect.width < MIN_BAR || rect.height < MIN_BAR) continue;
			const bar = overlay.createEl("i");
			bar.style.left = `${rect.left - box.left}px`;
			bar.style.top = `${rect.top - box.top}px`;
			bar.style.width = `${rect.width}px`;
			bar.style.height = `${rect.height}px`;
			if (++drawn >= MAX_BARS) break;
		}
		range.detach();
	}

	if (drawn === 0) {
		overlay.remove();
		return null;
	}
	region.addClass(LINED_CLASS);
	return overlay;
}


function redact(root: HTMLElement): Redaction {
	const originals: [Text, string][] = [];
	const wrapped: HTMLElement[] = [];
	const blanked: HTMLElement[] = [];
	/** Editors among `blanked`: the ones whose line rhythm can be drawn back. A
	 * field's value is not reachable as text nodes, so it keeps the slab. */
	const editors: HTMLElement[] = [];
	let overlays: HTMLElement[] = [];

	/** Take the bars down. Called before every re-measure and once at the end;
	 * they are the painter's own elements, so this touches nothing of
	 * Obsidian's. */
	const clearLines = (): void => {
		for (const overlay of overlays) overlay.remove();
		overlays = [];
		for (const editor of editors) editor.removeClass(LINED_CLASS);
	};

	/** Measure and draw. Re-run per screenful, because the coordinates are the
	 * viewport's and the board scrolls between shots. */
	const drawLines = (): void => {
		clearLines();
		for (const editor of editors) {
			if (!editor.isConnected) continue;
			const overlay = paintLines(editor);
			if (overlay) overlays.push(overlay);
		}
	};

	const pass = (): void => {
		// **Only the insides of cards.** The board's chrome — the vault name,
		// the header, the toolbar, the dashboard switcher, and each card's own
		// title — is not the author's content: it is the thing being published,
		// and blanking it makes a picture of a board nobody could recognise.
		// What a card *holds* is theirs: their notes, their tasks, their sums.
		for (const body of Array.from(root.querySelectorAll<HTMLElement>(REDACT_INSIDE))) {
			if (isOpenCard(body)) continue;

			// **An editor is blanked, never rewritten.** Its text nodes belong to
			// a document CodeMirror is watching, so touching them edits the
			// user's note — see EDITABLE_INSIDE.
			for (const editable of Array.from(body.querySelectorAll<HTMLElement>(EDITABLE_INSIDE))) {
				const region = editable.closest<HTMLElement>(EDITABLE_HOST) ?? editable;
				if (region.classList.contains(BLANKED_CLASS)) continue;
				region.classList.add(BLANKED_CLASS);
				blanked.push(region);
				editors.push(region);
			}

			const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
			const texts: Text[] = [];
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const text = node as Text;
				if (!text.data.trim()) continue;
				// Already covered by an earlier pass.
				if (text.parentElement?.classList.contains(REDACTED_CLASS)) continue;
				// A date, a weekday, a month name: the card's own furniture.
				if (text.parentElement?.closest(KEEP_INSIDE)) continue;
				// Inside an editor, which is blanked by style above.
				if (text.parentElement?.closest(EDITABLE_INSIDE)) continue;
				texts.push(text);
			}
			for (const text of texts) {
				originals.push([text, text.data]);
				text.data = redactedText(text.data);
				// Wrapped so the blocks can be *styled* rather than merely
				// drawn: a soft rounded bar in the theme's own ink reads as
				// "text lives here", where a row of hard glyphs reads as a
				// rendering fault.
				const span = text.ownerDocument.createElement("span");
				span.className = REDACTED_CLASS;
				text.parentNode?.insertBefore(span, text);
				span.appendChild(text);
				wrapped.push(span);
			}

			// **A form field's value is not a text node**, so the walk above
			// never sees it — and a calculator card renders its last sum into an
			// `<input>`, a search card its query, and the raw-edit note card the
			// whole note. Those are the author's own working state, which the
			// publish path removes from the *package*; a picture that still
			// showed them would put back exactly what the strip took out.
			//
			// Blanked by style rather than by writing over `value`, for the
			// reason the editors are: a field's value can be what the card saves
			// to the vault. `renderEditableEmbed`'s textarea *is* the note, and
			// its debounced `flush()` writes whatever `value` holds at the
			// moment it fires — so a save landing inside the second the shutter
			// is open would write the blocks to the file. Nothing readable is
			// painted either way; this way there is no window in which the
			// author's own data has been replaced.
			//
			// Placeholders stay: they are part of the board's look and travel in
			// the package anyway.
			for (const field of Array.from(
				body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
			)) {
				if (!field.value || field.classList.contains(BLANKED_CLASS)) continue;
				field.classList.add(BLANKED_CLASS);
				blanked.push(field);
			}
		}
	};

	pass();
	root.addClass("hearth-snapshot-redacted");
	// After the class, not before: the bars are measured against boxes the
	// blanking has already settled.
	drawLines();

	/**
	 * Redact what appears *while* the shutter is open.
	 *
	 * A pass before each screenful is not enough, and a Bases embed is why. It
	 * arrives through an asynchronous transclusion, runs its query, and then
	 * renders — and re-renders — its rows on its own schedule, including as the
	 * card is scrolled. So rows could be created in the gap between the last
	 * pass and `capturePage`, and be photographed with somebody's table in
	 * them. Dataview, Datacore and any other card that fills itself from a
	 * query have the same shape.
	 *
	 * Watching the board closes the gap for all of them at once: anything added
	 * or changed is redacted in the same frame it appeared in. `pass` is
	 * idempotent and only touches what is not already covered, so re-entering
	 * through the records of its own writes settles immediately instead of
	 * looping. Attributes are deliberately not watched — the blanking works by
	 * adding classes, and watching them would be nothing but that loop.
	 */
	let scheduled = false;
	let changed = false;
	const observer = new MutationObserver(() => {
		// Set before anything else and never batched: it is the record that the
		// board moved, which the caller reads after a shot to decide whether the
		// shot can be trusted.
		changed = true;
		if (scheduled) return;
		scheduled = true;
		window.requestAnimationFrame(() => {
			scheduled = false;
			if (!root.isConnected) return;
			pass();
			drawLines();
		});
	});
	observer.observe(root, { subtree: true, childList: true, characterData: true });

	return {
		reapply: () => {
			pass();
			drawLines();
		},
		changed: () => changed,
		settle: () => {
			changed = false;
		},
		restore: () => {
			observer.disconnect();
			for (const span of wrapped) {
				const text = span.firstChild;
				if (text && span.parentNode) span.parentNode.replaceChild(text, span);
			}
			for (const [node, value] of originals) node.data = value;
			clearLines();
			for (const region of blanked) region.classList.remove(BLANKED_CLASS);
			root.removeClass("hearth-snapshot-redacted");
		},
	};
}

/**
 * Whether this card's body can be photographed as it is.
 *
 * Read off the rendered card's own `data-kind`, so the answer comes from what
 * is on screen rather than from a second copy of the board's data that could
 * disagree with it. A card whose kind cannot be determined is censored, because
 * that is the direction to be wrong in.
 */
function isOpenCard(body: HTMLElement): boolean {
	const card = body.closest<HTMLElement>(".hearth-card");
	const kind = card?.dataset.kind;
	return kind !== undefined && OPEN_KINDS.has(kind);
}

/**
 * Wait long enough for a board that has just been re-rendered to be whole
 * again.
 *
 * Cards that mount lazily — a hosted view, an embedded editor, an Excalidraw
 * drawing — come back through `onLayoutReady` and an asynchronous
 * `setViewState`, which is several frames rather than one. This is a guess, and
 * an honest one: there is no event that says "every card has finished", and a
 * picture taken too early has blank cards in it forever.
 */
export function settleAfterRender(): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, RENDER_SETTLE_MS));
}

/**
 * How many times a slice is retaken when the board moves while it is being
 * photographed.
 *
 * Almost always zero: the retake exists for a query that comes back at exactly
 * the wrong moment. Bounded because a board that never stops moving — a card
 * animating, a clock ticking — would otherwise photograph forever, and the
 * shot after the last retake is still a redacted one: the watcher has had a
 * frame by then, so what a persistent mover costs is a slightly stale picture,
 * not an unredacted one.
 */
const RETAKES = 2;

/** How long {@link settleAfterRender} waits. Long enough for a lazily-mounted
 * card, short enough not to read as the dialog having hung. */
const RENDER_SETTLE_MS = 600;

/**
 * Wait for the page to have been drawn.
 *
 * Two frames, not one: the first lets a style change or a scroll be applied,
 * the second lets it be painted. Photographing between the two catches the
 * board mid-change — the redaction half-applied, or the previous scroll
 * position.
 */
function settle(): Promise<void> {
	return new Promise((resolve) =>
		window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
	);
}

/**
 * Photograph a rendered board.
 *
 * `hide` is anything that is on top of it — the share dialog itself — which is
 * made invisible for the duration rather than closed, so the dialog's state
 * survives and the flicker is one frame of an action that already takes a
 * second.
 *
 * Returns null for every failure, including "this build can't", and never
 * throws: a publish must not fail because a picture didn't work.
 */
export async function captureBoard(
	board: HTMLElement,
	hide: HTMLElement[] = [],
): Promise<BoardSnapshot | null> {
	const contents = webContents();
	if (!contents) return null;

	const rect = board.getBoundingClientRect();
	if (rect.width < 40 || rect.height < 40) return null;

	const redaction = redact(board);
	for (const el of hide) el.addClass("hearth-snapshot-hidden");
	// Themes are entitled to do what they like while a modal is open, and
	// several blur the workspace behind one — Velocity does. Capturing
	// photographs the *window*, so that blur lands in the picture. This class
	// turns filters off for the duration; it is on `body` because the rule has
	// to outrank a theme's own selector, and off again in the `finally`.
	document.body.addClass("hearth-snapshot-capturing");
	const scroller = board.querySelector<HTMLElement>(".hearth-scroll");
	const scrollFrom = scroller?.scrollTop ?? 0;

	try {
		await settle();
		const shots = await captureSlices(contents, rect, scroller, redaction);
		if (shots.length === 0) return null;
		return await stitch(shots, rect.width);
	} catch {
		return null;
	} finally {
		if (scroller) scroller.scrollTop = scrollFrom;
		redaction.restore();
		for (const el of hide) el.removeClass("hearth-snapshot-hidden");
		document.body.removeClass("hearth-snapshot-capturing");
	}
}

/**
 * Photograph the board one screenful at a time, scrolling between shots.
 *
 * A board is usually taller than the window it is in, and a picture of the part
 * that happens to be visible is a picture of a third of somebody's work. There
 * is no way to photograph what is off-screen — the capture takes a rectangle of
 * the *window* — so the board is scrolled through and the pieces put back
 * together afterwards.
 *
 * A board that does not scroll takes one shot and skips all of this.
 */
async function captureSlices(
	contents: WebContentsLike,
	rect: DOMRect,
	scroller: HTMLElement | null,
	redaction: Redaction,
): Promise<{ image: NativeImageLike; y: number }[]> {
	const viewport = Math.round(rect.height);
	const total = scroller
		? Math.min(scroller.scrollHeight, viewport * MAX_SCREENFULS)
		: viewport;
	const shots: { image: NativeImageLike; y: number }[] = [];

	let previous = -1;
	for (let offset = 0; offset < total; offset += viewport) {
		if (scroller) {
			scroller.scrollTop = offset;
			await settle();
			// Compared against the *previous* shot, not against what was asked
			// for. A scroller clamps at its bottom, so the last screenful of a
			// board that is not a whole number of screens tall always lands
			// short of the offset — checking against the offset threw that shot
			// away and published a board with its bottom missing.
			if (scroller.scrollTop === previous) break;
			previous = scroller.scrollTop;
		}
		// Re-applied before every shot: a card can mount lazily as it scrolls
		// into view (`leafview.ts` waits for an IntersectionObserver), so a card
		// that was not in the document during the first pass would otherwise
		// paint its real contents into a later slice.
		//
		// And taken again if the board moved *during* the shot. `capturePage`
		// is not instant, and a card that fills itself from a query — a Bases
		// embed above all, which renders its rows whenever its query comes back
		// — can put a row on screen inside that window, after the last pass and
		// before the pixels are read. The watcher redacts it a frame later,
		// which is too late for this shot but not for the next one, so a shot
		// the board moved under is thrown away and retaken rather than
		// published.
		let image: NativeImageLike | null = null;
		for (let attempt = 0; attempt <= RETAKES; attempt++) {
			redaction.reapply();
			// A frame between the pass and the flag: the watcher hears about
			// this pass's own writes first, so what `changed()` reports after
			// the shot is the board moving on its own rather than the redaction
			// being applied. It also gives the blanking a frame to be painted.
			await settle();
			redaction.settle();
			image = await contents.capturePage({
				x: Math.round(rect.left),
				y: Math.round(rect.top),
				width: Math.round(rect.width),
				height: viewport,
			});
			if (!redaction.changed()) break;
			// Let the watcher's pass land before trying again, so the retake is
			// of a board that has been redacted rather than of the same frame.
			await settle();
		}
		if (!image || image.isEmpty()) break;
		shots.push({ image, y: scroller ? scroller.scrollTop : 0 });
		if (!scroller) break;
	}
	return shots;
}

/**
 * Put the screenfuls back into one picture, and scale it down.
 *
 * Through a canvas, because that is the only thing in a renderer that can
 * compose images — and it is also what applies the scale, so the resize and the
 * join cost one decode each rather than one per slice.
 */
async function stitch(
	shots: { image: NativeImageLike; y: number }[],
	cssWidth: number,
): Promise<BoardSnapshot | null> {
	// The captures are in device pixels; the offsets are in CSS pixels. One
	// ratio converts between them, and taking it from the picture rather than
	// from `devicePixelRatio` means it is right even on a display Obsidian
	// disagrees with.
	const first = shots[0].image.getSize();
	const ratio = first.width / cssWidth;
	const last = shots[shots.length - 1];
	const height = Math.round(last.y * ratio) + last.image.getSize().height;

	const scale = Math.min(1, MAX_WIDTH / first.width);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(first.width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.imageSmoothingQuality = "high";

	for (const shot of shots) {
		const bitmap = await decode(shot.image);
		if (!bitmap) return null;
		ctx.drawImage(
			bitmap,
			0,
			Math.round(shot.y * ratio * scale),
			canvas.width,
			Math.round(bitmap.height * scale),
		);
		bitmap.close?.();
	}

	// Encoded down until it fits. A four-screenful board at full quality can pass
	// a megabyte, and a gallery that refuses the upload for it would leave a
	// board that *cannot be published at all* — the picture is required. Losing
	// some quality is the right way to fail here.
	for (const quality of QUALITY_STEPS) {
		const url = canvas.toDataURL("image/jpeg", quality / 100);
		const data = url.slice(url.indexOf(",") + 1);
		if (!data) return null;
		// base64 is four characters per three bytes.
		const bytes = Math.floor((data.length * 3) / 4);
		if (bytes <= MAX_BYTES || quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
			return { data, mime: "image/jpeg", bytes, width: canvas.width, height: canvas.height };
		}
	}
	return null;
}

/** An Electron image as something a canvas can draw. */
async function decode(image: NativeImageLike): Promise<ImageBitmap | null> {
	try {
		// Copied into a plain ArrayBuffer: what Electron hands back is a Node
		// Buffer, whose backing store TypeScript will not accept as a BlobPart.
		const png = image.toPNG();
		const bytes = new Uint8Array(png.byteLength);
		bytes.set(png);
		const blob = new Blob([bytes.buffer], { type: "image/png" });
		return await createImageBitmap(blob);
	} catch {
		return null;
	}
}
