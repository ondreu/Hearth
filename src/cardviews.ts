import type {
	DashboardCard,
	ViewSwitcherConfig,
	ViewSwitcherLabel,
	ViewSwitcherNarrow,
	ViewSwitcherPlacement,
	ViewSwitcherReveal,
	ViewSwitcherStyle,
} from "./types";

/**
 * Cards with several views (#385).
 *
 * Any card can hold further views: whole cards of any kind, drawn one at a time
 * in the first card's frame, with a switcher between them. The model is the
 * smallest one that keeps every existing card working unchanged:
 *
 *  - The card on the board *is* the first view. Its `views` holds the rest, so
 *    a card without them is exactly the card it always was, and nothing has to
 *    be migrated to adopt the feature.
 *  - A view is an ordinary `DashboardCard`. Every kind's renderer, editor and
 *    liveness read their content off the card object they are handed, so
 *    handing them a view instead of the card is all it takes for any kind to
 *    become a view — no kind knows the feature exists.
 *  - The frame is the card's alone (`VIEW_FRAME_KEYS`): where it sits, its size,
 *    its colours and surface. A view's own copies of those are ignored, and are
 *    stripped when a card becomes a view.
 *
 * Everything here is pure (no Obsidian, no DOM), so it is unit tested; the
 * switcher itself is drawn by src/viewswitcher.ts.
 */

/** Fields that describe a card's frame rather than its content. They are read
 * off the card on the board, never off a view. The title is the frame's too: it
 * heads the card whichever view is on show, and a view is named by its
 * `viewLabel` instead. `design` is the exception that is also *copied* onto
 * every view (see {@link syncViewDesign}), because several kinds read it while
 * drawing their content. */
export const VIEW_FRAME_KEYS = [
	"title",
	"x",
	"y",
	"w",
	"h",
	"fx",
	"fy",
	"fw",
	"fh",
	"mobile",
	"pinned",
	"accent",
	"background",
	"cardOpacity",
	"cardBlur",
	"cardBorderWidth",
	"design",
	"views",
	"viewSwitcher",
	"activeView",
] as const satisfies readonly (keyof DashboardCard)[];

/** The frame fields a view takes from its card when it is moved out to be a
 * card of its own: the look and the size, not the position (a detached card is
 * placed into a free slot by the caller). */
const DETACH_FRAME_KEYS = [
	"w",
	"h",
	"fw",
	"fh",
	"accent",
	"background",
	"cardOpacity",
	"cardBlur",
	"cardBorderWidth",
	"design",
] as const satisfies readonly (keyof DashboardCard)[];

const FRAME = new Set<string>(VIEW_FRAME_KEYS);

/** Whether `card` has views to switch between. */
export function hasViews(card: DashboardCard): boolean {
	return Array.isArray(card.views) && card.views.length > 0;
}

/** The card and its views, in switcher order. A card without views is a list
 * of one. */
export function cardViews(card: DashboardCard): DashboardCard[] {
	return hasViews(card) ? [card, ...(card.views as DashboardCard[])] : [card];
}

/** Every card in `cards` and every view inside them. For the walks that look at
 * what cards hold (exports, the vault-wide lists folded into a package, finding
 * a card by id) rather than at what sits on the board. */
export function withViews(cards: readonly DashboardCard[]): DashboardCard[] {
	return cards.flatMap((card) => cardViews(card));
}

/** The card (on the board) a card or view belongs to, among `cards`. */
export function hostOf(cards: readonly DashboardCard[], card: DashboardCard): DashboardCard | undefined {
	return cards.find((c) => c === card || (c.views?.includes(card) ?? false));
}

// ---- The view on show --------------------------------------------------------

/** Which view each card shows while `rememberView` is off. Keyed by the card
 * object, like the other transient per-card state (the folder card's browsed
 * path, the RSS card's tab): the objects live in settings and are reused across
 * redraws and rebuilds, so the choice survives both, and a reload resets it. */
const shownView = new WeakMap<DashboardCard, number>();

/** Clamp an index into the card's views; an index past the end (a view was
 * removed) falls back to the first view. */
function clampView(card: DashboardCard, index: number | undefined): number {
	const count = cardViews(card).length;
	if (index === undefined || !Number.isInteger(index) || index < 0 || index >= count) return 0;
	return index;
}

/** The index of the view `card` shows now (0 = the card itself). */
export function activeViewIndex(card: DashboardCard): number {
	if (!hasViews(card)) return 0;
	return clampView(card, card.viewSwitcher?.rememberView ? card.activeView : shownView.get(card));
}

/**
 * Show view `index` of `card`. Returns true when the choice was written to the
 * card (`rememberView` is on) and so needs saving; false when it was only
 * remembered in memory, or nothing changed.
 */
export function setActiveViewIndex(card: DashboardCard, index: number): boolean {
	const next = clampView(card, index);
	if (card.viewSwitcher?.rememberView) {
		if ((card.activeView ?? 0) === next) return false;
		card.activeView = next === 0 ? undefined : next;
		return true;
	}
	shownView.set(card, next);
	return false;
}

/** The index `delta` steps away from the one on show, wrapping round. */
export function stepViewIndex(card: DashboardCard, delta: number): number {
	const count = cardViews(card).length;
	return (((activeViewIndex(card) + delta) % count) + count) % count;
}

/** Give every view the card's design. Several kinds read `card.design` while
 * drawing their content (the clock, tasks, calendar…), and a view's design is
 * its card's — so it is kept in step rather than taught to every kind. */
export function syncViewDesign(card: DashboardCard): void {
	for (const view of card.views ?? []) {
		if (card.design === undefined) delete view.design;
		else view.design = card.design;
	}
}

/** The card object to draw: the card itself, or the view on show. */
export function activeViewCard(card: DashboardCard): DashboardCard {
	if (!hasViews(card)) return card;
	syncViewDesign(card);
	return cardViews(card)[activeViewIndex(card)];
}

// ---- Switcher settings -------------------------------------------------------

/** A switcher configuration with every default filled in. */
export interface ResolvedViewSwitcher {
	placement: Exclude<ViewSwitcherPlacement, "auto">;
	style: ViewSwitcherStyle;
	label: ViewSwitcherLabel;
	reveal: ViewSwitcherReveal;
	rememberView: boolean;
	rotateSec: number;
	swipe: boolean;
	narrow: ViewSwitcherNarrow;
}

export const VIEW_SWITCHER_PLACEMENTS: readonly ViewSwitcherPlacement[] = [
	"auto",
	"header",
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
	"hidden",
];
export const VIEW_SWITCHER_STYLES: readonly ViewSwitcherStyle[] = ["tabs", "dropdown", "dots", "icons"];
export const VIEW_SWITCHER_LABELS: readonly ViewSwitcherLabel[] = ["label", "icon", "both"];
export const VIEW_SWITCHER_REVEALS: readonly ViewSwitcherReveal[] = ["always", "hover"];
export const VIEW_SWITCHER_NARROW: readonly ViewSwitcherNarrow[] = ["switcher", "split"];
/** The longest rotation interval offered, in seconds (an hour). */
export const VIEW_ROTATE_MAX = 3600;

/**
 * The switcher `card` gets. `titled` says whether the card shows a header: the
 * "auto" placement is the header when it does and the top-right corner when it
 * doesn't, which is how the embed card's second-view switcher always behaved.
 * A floating switcher shows on hover unless told otherwise; one in the header
 * always shows, since the header is there anyway.
 */
export function resolveViewSwitcher(card: DashboardCard, titled: boolean): ResolvedViewSwitcher {
	const cfg: ViewSwitcherConfig = card.viewSwitcher ?? {};
	let placement = cfg.placement ?? "auto";
	if (placement === "auto") placement = titled ? "header" : "top-right";
	// A header switcher on a card with no header would have nowhere to go.
	if (placement === "header" && !titled) placement = "top-right";
	return {
		placement,
		style: cfg.style ?? "tabs",
		label: cfg.label ?? "label",
		reveal: placement === "header" ? "always" : (cfg.reveal ?? "hover"),
		rememberView: cfg.rememberView === true,
		rotateSec: rotateSeconds(cfg.rotateSec),
		swipe: cfg.swipe !== false,
		narrow: cfg.narrow ?? "switcher",
	};
}

/** A rotation interval made safe: whole seconds between 3 and an hour, or 0
 * (off) for anything else. Below 3s a view could not finish loading before the
 * next one replaced it. */
export function rotateSeconds(raw: unknown): number {
	if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
	return Math.min(VIEW_ROTATE_MAX, Math.max(3, Math.round(raw)));
}

/** Validate a persisted switcher configuration, keeping only known values.
 * Returns undefined when nothing is left, so a card does not carry an empty
 * object. */
export function sanitizeViewSwitcher(raw: unknown): ViewSwitcherConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const out: ViewSwitcherConfig = {};
	const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
		allowed.includes(value as T) ? (value as T) : undefined;
	const placement = pick(r.placement, VIEW_SWITCHER_PLACEMENTS);
	if (placement) out.placement = placement;
	const style = pick(r.style, VIEW_SWITCHER_STYLES);
	if (style) out.style = style;
	const label = pick(r.label, VIEW_SWITCHER_LABELS);
	if (label) out.label = label;
	const reveal = pick(r.reveal, VIEW_SWITCHER_REVEALS);
	if (reveal) out.reveal = reveal;
	const narrow = pick(r.narrow, VIEW_SWITCHER_NARROW);
	if (narrow) out.narrow = narrow;
	if (typeof r.rememberView === "boolean") out.rememberView = r.rememberView;
	if (typeof r.swipe === "boolean") out.swipe = r.swipe;
	const rotate = rotateSeconds(r.rotateSec);
	if (rotate > 0) out.rotateSec = rotate;
	return Object.keys(out).length > 0 ? out : undefined;
}

// ---- Shaping the views -------------------------------------------------------

/** Take the frame off a card so it can sit inside another card as a view.
 * Mutates and returns `card`. The kept `x/y/w/h` are zeroed rather than
 * deleted only because the type requires them; a view's are never read. */
export function stripFrame(card: DashboardCard): DashboardCard {
	for (const key of VIEW_FRAME_KEYS) {
		if (key === "x" || key === "y" || key === "w" || key === "h") continue;
		delete card[key];
	}
	card.x = 0;
	card.y = 0;
	card.w = 1;
	card.h = 1;
	return card;
}

/** An id that is not yet used by `taken`, built from `base`. */
function uniqueId(base: string, taken: Set<string>): string {
	let id = base;
	for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
	taken.add(id);
	return id;
}

/**
 * Make `other` — and every view it already holds — views of `host`, appended
 * after the host's own. `other` is mutated (its frame is stripped) and must be
 * taken off the board by the caller. A view whose id clashes with another in
 * the card gets a fresh one, since ids key per-card memory (the slideshow's
 * position, terminal mode's focus).
 */
export function mergeCards(host: DashboardCard, other: DashboardCard): void {
	if (host === other) return;
	const incoming = cardViews(other);
	const taken = new Set(cardViews(host).map((c) => c.id));
	const views = host.views ? [...host.views] : [];
	// A card's title is how it was known on the board; as a view, that is what
	// its label in the switcher should say.
	if (other.title?.trim() && !other.viewLabel?.trim()) other.viewLabel = other.title.trim();
	for (const card of incoming) {
		if (card !== other) stripFrame(card);
		if (taken.has(card.id)) card.id = uniqueId(card.id, taken);
		else taken.add(card.id);
		views.push(card);
	}
	stripFrame(other);
	host.views = views;
}

/**
 * Exchange the content of two cards, leaving each object's frame and id where
 * they are. This is how the first view — which is the card on the board, and so
 * owns the frame — trades places with another: its content moves, the card
 * stays put.
 */
function swapContent(a: DashboardCard, b: DashboardCard): void {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	const ra = a as unknown as Record<string, unknown>;
	const rb = b as unknown as Record<string, unknown>;
	for (const key of keys) {
		if (key === "id" || FRAME.has(key)) continue;
		const va = ra[key];
		const vb = rb[key];
		if (vb === undefined) delete ra[key];
		else ra[key] = vb;
		if (va === undefined) delete rb[key];
		else rb[key] = va;
	}
}

/**
 * Move view `from` to position `to` (both indexes into {@link cardViews}). The
 * view on show stays on show wherever it lands. Returns false when nothing
 * moved.
 */
export function moveView(host: DashboardCard, from: number, to: number): boolean {
	const order = cardViews(host);
	if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return false;
	const shown = order[activeViewIndex(host)];
	const moved = [...order];
	const [item] = moved.splice(from, 1);
	moved.splice(to, 0, item);
	let shownAt = moved.indexOf(shown);
	if (moved[0] !== host) {
		// Something else is first now. The card on the board has to stay the
		// first view (it owns the frame), so it takes that view's content and
		// the view's object takes the card's.
		const first = moved[0];
		swapContent(host, first);
		const hostAt = moved.indexOf(host);
		moved[hostAt] = first;
		moved[0] = host;
		if (shown === host) shownAt = hostAt;
		else if (shown === first) shownAt = 0;
	}
	host.views = moved.slice(1);
	setActiveViewIndex(host, shownAt);
	return true;
}

/** A frame-carrying card made from a view: the view itself, given the host's
 * look and size, and titled with its label from the switcher — the name it was
 * known by. Placement is left to the caller. */
function asDetached(view: DashboardCard, host: DashboardCard): DashboardCard {
	stripFrame(view);
	const label = view.viewLabel?.trim();
	if (label) view.title = label;
	delete view.viewLabel;
	for (const key of DETACH_FRAME_KEYS) {
		const value = host[key];
		if (value !== undefined) (view as unknown as Record<string, unknown>)[key] = value;
	}
	view.x = -1;
	view.y = -1;
	view.w = host.w;
	view.h = host.h;
	return view;
}

/** Drop the views list once it is empty, along with the settings that only
 * mean something while there are views. */
function tidyViews(host: DashboardCard): void {
	if (host.views && host.views.length === 0) {
		delete host.views;
		delete host.viewSwitcher;
		delete host.activeView;
	}
}

/**
 * Take view `index` out of `host` and return it as a card of its own (with the
 * host's look and size, unplaced). Index 0 moves the card's own content out and
 * leaves the next view in its place. Returns null when there is no such view or
 * the card has no other view to keep.
 */
export function detachView(host: DashboardCard, index: number): DashboardCard | null {
	const order = cardViews(host);
	if (order.length < 2 || index < 0 || index >= order.length) return null;
	if (index === 0) moveView(host, 0, 1);
	const at = index === 0 ? 1 : index;
	const view = (host.views as DashboardCard[])[at - 1];
	host.views = (host.views as DashboardCard[]).filter((v) => v !== view);
	tidyViews(host);
	if (hasViews(host)) setActiveViewIndex(host, Math.min(activeViewIndex(host), cardViews(host).length - 1));
	return asDetached(view, host);
}

/** Delete view `index` from `host`. Index 0 deletes the card's own content and
 * promotes the next view. Returns false when there is nothing to delete or no
 * other view to keep. */
export function removeView(host: DashboardCard, index: number): boolean {
	return detachView(host, index) !== null;
}

/** Split `host` into one card per view: `host` keeps the first, and the rest
 * come back as cards of their own (unplaced), in order. */
export function splitViews(host: DashboardCard): DashboardCard[] {
	const out: DashboardCard[] = [];
	while (hasViews(host)) {
		const card = detachView(host, 1);
		if (!card) break;
		out.push(card);
	}
	return out;
}

/**
 * For the narrow layout's "split" choice: each view as a card of its own, to be
 * drawn one under another. Render-only — the returned objects for views beyond
 * the first are the views themselves (so their per-card memory and live edits
 * stay theirs), and nothing is written back.
 */
export function splitForNarrow(host: DashboardCard): DashboardCard[] {
	if (!hasViews(host)) return [host];
	syncViewDesign(host);
	return cardViews(host);
}

// ---- Migration ---------------------------------------------------------------

/**
 * The embed card's retired `secondView` (before #385 an embed card could hold
 * one extra file) as an ordinary view. A new object; the input is untouched.
 *
 * The second view becomes an embed view of its own, carrying the fields it had
 * (`target`, `baseView`, `scale`, `imageFit`, `imagePosition`, `editable`,
 * `livePreview`) plus the two card-level embed options that used to apply to
 * both views (`hideBaseHeader`, `showOpenButton`), so it draws exactly as it
 * did. It goes first among the views, ahead of any the card already has. A
 * `secondView` without a target never drew a switcher and is simply dropped.
 *
 * The view's id is derived from the card's rather than random, so two devices
 * migrating the same synced card arrive at the same result instead of each
 * rewriting the other's copy. Applied by `migrateSettings` on load and by
 * `sanitizeCard` on every import.
 */
export function secondViewAsView(raw: Record<string, unknown>): Record<string, unknown> {
	if (!("secondView" in raw)) return raw;
	const { secondView, ...card } = raw;
	const second = secondView && typeof secondView === "object" ? (secondView as Record<string, unknown>) : null;
	const target = typeof second?.target === "string" ? second.target.trim() : "";
	if (!second || !target) return card;
	const existing = Array.isArray(card.views) ? (card.views as unknown[]) : [];
	const taken = new Set<string>([
		typeof card.id === "string" ? card.id : "",
		...existing.flatMap((v) =>
			v && typeof v === "object" && typeof (v as Record<string, unknown>).id === "string"
				? [(v as Record<string, unknown>).id as string]
				: [],
		),
	]);
	const view: Record<string, unknown> = {
		id: uniqueId(`${typeof card.id === "string" ? card.id : "card"}-view-2`, taken),
		kind: "embed",
		x: 0,
		y: 0,
		w: 1,
		h: 1,
	};
	for (const key of ["target", "baseView", "scale", "imageFit", "imagePosition", "editable", "livePreview"]) {
		if (second[key] !== undefined) view[key] = second[key];
	}
	for (const key of ["hideBaseHeader", "showOpenButton"]) {
		if (card[key] !== undefined) view[key] = card[key];
	}
	return { ...card, views: [view, ...existing] };
}

/** Fold every `secondView` in a list of persisted cards in place. Returns true
 * when any was folded, so the caller knows the result needs saving. */
export function foldSecondViews(cards: unknown): boolean {
	if (!Array.isArray(cards)) return false;
	let folded = false;
	cards.forEach((card, i) => {
		if (!card || typeof card !== "object" || !("secondView" in card)) return;
		cards[i] = secondViewAsView(card as Record<string, unknown>);
		folded = true;
	});
	return folded;
}
