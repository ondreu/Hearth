/**
 * Every place a package can point at something outside itself.
 *
 * A dashboard is not self-contained. It names notes and folders in the author's
 * vault, images it wants painted, calendar feeds only the author can read, a
 * town whose weather it shows, commands and view types that only exist when the
 * right plugins are installed. Three jobs need to know exactly where those
 * values live, and all three read the one table below:
 *
 * 1. **Reporting.** What does this package need, and what of the author's vault
 *    does it mention? An import dialog and a gallery listing both ask this.
 * 2. **Stripping.** A gallery is handed a package and must be able to remove
 *    the author's vault paths and private feeds before publishing it, keeping
 *    the layout, the styling and the embedded pictures. That is
 *    {@link stripReferences}, and it is the reason this table is a table rather
 *    than thirty `if` branches spread across the exporter.
 * 3. **Checking.** On import, which of the paths actually exist here? Each miss
 *    becomes a warning naming the path, rather than a card that silently shows
 *    nothing.
 *
 * The table is a denylist, so a gap in it means a value travels that perhaps
 * shouldn't. {@link residualPaths} is the backstop: after stripping, it sweeps
 * whatever is left for strings that still look like vault paths or feed URLs
 * and reports them, so a card kind added without a rule here shows up as a
 * finding instead of a leak.
 *
 * **Adding a card kind:** if its config names a note, folder, attachment,
 * private URL, command or view type, add a rule for it below.
 */


import type { CardKind, Dashboard, DashboardCard } from "../types";
import {
	type HearthPackage,
	type DashboardPayload,
	isAssetRef,
} from "./schema";

/**
 * What kind of outside thing a field points at. The groups
 * {@link stripReferences} works in are built out of these.
 */
export type ReferenceScope =
	/** A note, folder or attachment path in the author's vault. */
	| "vaultPath"
	/** A vault path to an image, so it can be embedded in the package. A subset
	 * of `vaultPath` in every other respect — it is stripped with the paths. */
	| "asset"
	/** A URL that is effectively a credential: anyone holding it can read the
	 * author's data. A private ICS calendar link is the case that matters. */
	| "privateUrl"
	/** A public feed or page the board embeds. Travels — it is part of what the
	 * board *is* — but is worth listing so a reader knows what will be fetched. */
	| "publicUrl"
	/** A host only reachable inside the author's network (a company Jira). */
	| "privateHost"
	/** A place on Earth the author chose. Their town is personal data even
	 * though it looks like configuration. */
	| "place"
	/** A command id, which resolves only if the right plugin is installed. */
	| "commandId"
	/** A registered view type, likewise. */
	| "viewType"
	/** A search/Dataview/Datacore query. Kept by default — a board without its
	 * queries does nothing — but reported, because a query routinely contains
	 * folder names. */
	| "userQuery"
	/** The author's own prose or working state: a text card's body, the
	 * calculator's last input. */
	| "userContent";

/** One field, or one array of fields, that holds a reference. */
export interface ReferenceRule {
	/**
	 * Dotted path from the card (or board) root. `[]` steps into every element
	 * of an array: `slideshow.slides[].path`, `tasks.folders[]`.
	 */
	at: string;
	scope: ReferenceScope;
	/** Restrict to one card kind. Omitted = any kind that has the field.
	 *
	 * Most rules leave this off deliberately: a card keeps the config of every
	 * kind it has ever been (see the editor's type dropdown), so a card that is
	 * a clock today may still carry the embed target it had yesterday — and that
	 * target is just as much a vault path as a live one. */
	kind?: CardKind;
	/** The value names a folder rather than a file. Import-time existence
	 * checks need to know which to look for. */
	folder?: boolean;
	/** Extra condition, given the object that directly owns the field. Used
	 * where a sibling field decides what the value means — a launchpad tile's
	 * `target` is a note, a URL or a command id depending on its `type`. */
	when?: (owner: Record<string, unknown>) => boolean;
}

/** Whether an icon field holds a vault image path rather than a Lucide id or an
 * emoji. Mirrors what `titleicon.ts` decides at render time: a path has a
 * separator or a file extension. */
function iconIsImage(value: string): boolean {
	return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(value.trim());
}

const tileTargetIsNote = (o: Record<string, unknown>): boolean =>
	o.type !== "url" && o.type !== "command";
const tileTargetIsCommand = (o: Record<string, unknown>): boolean =>
	o.type === "command";
const tileTargetIsUrl = (o: Record<string, unknown>): boolean => o.type === "url";
const iconOwnerIsImage = (o: Record<string, unknown>): boolean =>
	typeof o.icon === "string" && iconIsImage(o.icon);

/**
 * Every referencing field on a card, relative to the card object.
 *
 * Ordered by card kind for reading, not for behaviour — the walker applies all
 * of them to every card.
 */
export const CARD_REFERENCE_RULES: readonly ReferenceRule[] = [
	// embed / daily / periodic
	{ at: "target", scope: "vaultPath" },
	{ at: "secondView.target", scope: "vaultPath" },

	// web
	{ at: "url", scope: "publicUrl" },

	// slideshow
	{ at: "slideshow.folder", scope: "vaultPath", folder: true },
	{ at: "slideshow.slides[].path", scope: "asset" },

	// links (launchpad tiles)
	{ at: "links[].target", scope: "vaultPath", when: tileTargetIsNote },
	{ at: "links[].target", scope: "commandId", when: tileTargetIsCommand },
	{ at: "links[].target", scope: "publicUrl", when: tileTargetIsUrl },
	{ at: "links[].icon", scope: "asset", when: iconOwnerIsImage },

	// commands
	{ at: "commands[].id", scope: "commandId" },
	{ at: "commands[].icon", scope: "asset", when: iconOwnerIsImage },

	// templater
	{ at: "templater.items[].template", scope: "vaultPath" },
	{ at: "templater.items[].folder", scope: "vaultPath", folder: true },
	{ at: "templater.items[].icon", scope: "asset", when: iconOwnerIsImage },

	// tasks
	{ at: "tasks.kanbanFile", scope: "vaultPath" },
	{ at: "tasks.convertNoteTemplate", scope: "vaultPath" },
	{ at: "tasks.folders[]", scope: "vaultPath", folder: true },

	// calendar / schedule — ICS feeds and the note an event becomes
	{ at: "calendar.sources[].url", scope: "privateUrl" },
	{ at: "calendar.eventNote.folder", scope: "vaultPath", folder: true },
	{ at: "calendar.eventNote.template", scope: "vaultPath" },
	{ at: "schedule.sources[].url", scope: "privateUrl" },
	{ at: "schedule.eventNote.folder", scope: "vaultPath", folder: true },
	{ at: "schedule.eventNote.template", scope: "vaultPath" },

	// rss
	{ at: "rss.sources[].url", scope: "publicUrl" },

	// jira
	{ at: "jira.host", scope: "privateHost" },

	// weather
	{ at: "weather.place.name", scope: "place" },
	{ at: "weather.place.region", scope: "place" },
	{ at: "weather.place.lat", scope: "place" },
	{ at: "weather.place.lon", scope: "place" },
	{ at: "weather.place.timezone", scope: "place" },

	// heatmap — an advanced rule can test a note's folder or its full path, and
	// then `value` holds a literal one. Everything else a rule names is a
	// frontmatter property, which the card needs in order to work at all: kept,
	// but reported, on the same footing as a query.
	{
		at: "heatmap.rules[].value",
		scope: "vaultPath",
		when: (o) => o.field === "folder" || o.field === "path",
	},
	{ at: "heatmap.rules[].key", scope: "userQuery" },
	{ at: "heatmap.dateProperty", scope: "userQuery" },
	{ at: "heatmap.valueProperty", scope: "userQuery" },

	// operon
	{ at: "operon.filePath", scope: "vaultPath" },

	// leaf (hosted view)
	{ at: "leafView.viewType", scope: "viewType" },
	{ at: "leafView.file", scope: "vaultPath" },

	// favourites — the note paths a favourites card shows, folded onto the card
	// at capture so the board can state its own list (see `capture.ts`).
	{ at: "favorites[]", scope: "vaultPath" },

	// queries
	{ at: "tasks.taskFilter.text", scope: "userQuery" },
	{ at: "savedSearch.query", scope: "userQuery" },
	{ at: "dataview.query", scope: "userQuery" },
	{ at: "datacore.query", scope: "userQuery" },
	{ at: "stats.queries[].query", scope: "userQuery" },

	// the author's own text and working state
	{ at: "text", scope: "userContent" },
	{ at: "calculator.lastInput", scope: "userContent" },
];

/** Referencing fields on the board itself, relative to the `Dashboard`. */
export const BOARD_REFERENCE_RULES: readonly ReferenceRule[] = [
	{ at: "background.value", scope: "asset", when: (o) => o.kind === "image" },
	{ at: "background.value", scope: "publicUrl", when: (o) => o.kind === "url" },
	{ at: "background.value", scope: "place", when: (o) => o.kind === "weather" },
	{ at: "header.titleIcon", scope: "asset", when: (o) => typeof o.titleIcon === "string" && iconIsImage(o.titleIcon) },
	{ at: "pluginView.viewType", scope: "viewType" },
	{ at: "pluginView.file", scope: "vaultPath" },
	// A workspace name is not a path, but it names something in the author's
	// vault and means nothing in anyone else's — so it travels with the paths.
	{ at: "linkedWorkspace", scope: "vaultPath" },
];

/** Referencing fields in the vault-wide part of a layout or settings payload. */
export const GLOBAL_REFERENCE_RULES: readonly ReferenceRule[] = [
	{ at: "favorites[]", scope: "vaultPath" },
	{ at: "backgroundValue", scope: "asset", when: (o) => o.backgroundKind === "image" },
	{ at: "backgroundValue", scope: "publicUrl", when: (o) => o.backgroundKind === "url" },
	{ at: "backgroundValue", scope: "place", when: (o) => o.backgroundKind === "weather" },
	{ at: "titleIcon", scope: "asset", when: (o) => typeof o.titleIcon === "string" && iconIsImage(o.titleIcon) },
	{ at: "newNoteTemplate", scope: "vaultPath" },
	{ at: "newNoteFolder", scope: "vaultPath", folder: true },
	{ at: "mobileActionButtons[].target", scope: "vaultPath", when: tileTargetIsNote },
	{ at: "mobileActionButtons[].target", scope: "commandId", when: tileTargetIsCommand },
	{ at: "mobileActionButtons[].target", scope: "publicUrl", when: tileTargetIsUrl },
];

/** How thoroughly the walker looks. */
export interface WalkOptions {
	/** Also yield references that already point inside the package
	 * (`hearth:asset/…`). Only the asset-materializing pass wants these — every
	 * other caller is asking about the outside world. */
	includeAssetRefs?: boolean;
}

/** One found reference, with the means to change it in place. */
export interface FoundReference {
	scope: ReferenceScope;
	/** The value as stored. Strings for every scope except `place`'s
	 * coordinates, which are numbers. */
	value: string | number;
	/** Where it was found, for reporting: `cards[2].tasks.folders[0]`. */
	pointer: string;
	folder: boolean;
	/** Replace the value, or drop the field entirely with `undefined`. */
	set: (value: string | number | undefined) => void;
	/** The array this value sits in, when it sits in one.
	 *
	 * Dropping an array element has to happen in two steps — blank it during the
	 * pass, close the gap afterwards, because every reference is collected
	 * before any is applied — and this is how the second step knows *which*
	 * arrays to close without sweeping the whole payload for holes that were
	 * never ours. See {@link compactTouched}. */
	container?: unknown[];
}

type Bag = Record<string, unknown>;

function isBag(v: unknown): v is Bag {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Walk one rule against one root object, calling `visit` for each value found.
 *
 * Segments are resolved left to right; `[]` fans out over an array. A missing
 * or wrongly-typed link in the chain simply yields nothing, so a rule can name
 * a field that only some cards have.
 */
function walkRule(
	root: unknown,
	rule: ReferenceRule,
	prefix: string,
	visit: (ref: FoundReference) => void,
	options: WalkOptions = {},
): void {
	const segments = rule.at.split(".");

	const step = (node: unknown, index: number, pointer: string): void => {
		if (node === undefined || node === null) return;
		const segment = segments[index];
		const last = index === segments.length - 1;

		if (segment.endsWith("[]")) {
			const key = segment.slice(0, -2);
			const list = key === "" ? node : isBag(node) ? node[key] : undefined;
			if (!Array.isArray(list)) return;
			list.forEach((item, i) => {
				const at = `${pointer}${key ? `.${key}` : ""}[${i}]`;
				if (last) {
					// `folders[]` — the array holds the values themselves.
					emit(list as unknown[], i, item, at);
				} else {
					step(item, index + 1, at);
				}
			});
			return;
		}

		if (!isBag(node)) return;
		if (last) {
			emit(node, segment, node[segment], `${pointer}.${segment}`);
			return;
		}
		step(node[segment], index + 1, `${pointer}.${segment}`);
	};

	const emit = (
		owner: Bag | unknown[],
		key: string | number,
		value: unknown,
		pointer: string,
	): void => {
		if (typeof value !== "string" && typeof value !== "number") return;
		if (typeof value === "string" && value === "") return;
		// An asset reference points inside the package, so it names nothing in
		// anyone's vault and is not a reference to the outside world — except to
		// the pass whose whole job is to rewrite it back into one.
		if (typeof value === "string" && isAssetRef(value) && !options.includeAssetRefs) {
			return;
		}
		const ownerBag = Array.isArray(owner) ? undefined : owner;
		if (rule.when && !rule.when(ownerBag ?? {})) return;
		visit({
			scope: rule.scope,
			value,
			pointer: pointer.replace(/^\./, ""),
			folder: rule.folder === true,
			container: Array.isArray(owner) ? owner : undefined,
			set: (next) => {
				if (Array.isArray(owner)) {
					// Blanked, not spliced. References are collected before any of
					// them is applied, so removing an element here would shift every
					// later index in the same array and leave a value behind (the
					// bug this replaced). `compactArrays` clears the holes once the
					// whole pass is done.
					owner[key as number] = next;
					return;
				}
				if (next === undefined) delete owner[key as string];
				else owner[key as string] = next;
			},
		});
	};

	step(root, 0, prefix);
}

/** Every reference on one card. */
export function cardReferences(
	card: DashboardCard,
	prefix = "",
	options: WalkOptions = {},
): FoundReference[] {
	const found: FoundReference[] = [];
	for (const rule of CARD_REFERENCE_RULES) {
		if (rule.kind !== undefined && rule.kind !== card.kind) continue;
		walkRule(card, rule, prefix, (ref) => found.push(ref), options);
	}
	return found;
}

/** Every reference on one board, its cards included. */
export function boardReferences(
	dash: Dashboard,
	prefix = "",
	options: WalkOptions = {},
): FoundReference[] {
	const found: FoundReference[] = [];
	for (const rule of BOARD_REFERENCE_RULES) {
		walkRule(dash, rule, prefix, (ref) => found.push(ref), options);
	}
	dash.cards.forEach((card, i) => {
		found.push(...cardReferences(card, `${prefix}cards[${i}]`, options));
	});
	return found;
}

/**
 * Every reference in a package, whatever kind it is.
 *
 * Mutating a returned reference's `set` edits the package in place, which is
 * how {@link stripReferences} works — so hand this a copy if you need the
 * original intact.
 */
export function packageReferences(
	pkg: HearthPackage,
	options: WalkOptions = {},
): FoundReference[] {
	const found: FoundReference[] = [];
	const payload = pkg.payload as Bag;

	if (pkg.hearth.kind === "dashboard") {
		const dashboardPayload = pkg.payload as DashboardPayload;
		if (dashboardPayload.dashboard) {
			found.push(
				...boardReferences(dashboardPayload.dashboard, "dashboard", options),
			);
		}
		dashboardPayload.pinnedCards?.forEach((card, i) => {
			found.push(...cardReferences(card, `pinnedCards[${i}]`, options));
		});
		for (const rule of GLOBAL_REFERENCE_RULES) {
			walkRule(payload, rule, "", (ref) => found.push(ref), options);
		}
		return found;
	}

	const dashboards = payload.dashboards;
	if (Array.isArray(dashboards)) {
		dashboards.forEach((dash, i) => {
			if (isBag(dash) && Array.isArray((dash as unknown as Dashboard).cards)) {
				found.push(
					...boardReferences(dash as unknown as Dashboard, `dashboards[${i}]`, options),
				);
			}
		});
	}
	// A v1 layout has a bare `cards` array instead of dashboards.
	if (Array.isArray(payload.cards)) {
		(payload.cards as DashboardCard[]).forEach((card, i) => {
			found.push(...cardReferences(card, `cards[${i}]`, options));
		});
	}
	(payload.pinnedCards as DashboardCard[] | undefined)?.forEach((card, i) => {
		found.push(...cardReferences(card, `pinnedCards[${i}]`, options));
	});
	for (const rule of GLOBAL_REFERENCE_RULES) {
		walkRule(payload, rule, "", (ref) => found.push(ref), options);
	}
	return found;
}

/** A grouped count of what a package points at — what an import dialog shows
 * before anything is applied, and what a gallery listing can index. */
export interface ReferenceReport {
	/** Distinct values per scope, in the order first seen. */
	byScope: Record<ReferenceScope, string[]>;
	/** Card kinds present, so an older Hearth can say what it can't draw. */
	cardKinds: string[];
	/** Whether the package embeds any files. */
	assetCount: number;
}

const EMPTY_SCOPES = (): Record<ReferenceScope, string[]> => ({
	vaultPath: [],
	asset: [],
	privateUrl: [],
	publicUrl: [],
	privateHost: [],
	place: [],
	commandId: [],
	viewType: [],
	userQuery: [],
	userContent: [],
});

/** Summarize a package without changing it. */
export function describeReferences(pkg: HearthPackage): ReferenceReport {
	const byScope = EMPTY_SCOPES();
	for (const ref of packageReferences(pkg)) {
		const list = byScope[ref.scope];
		const value = String(ref.value);
		if (!list.includes(value)) list.push(value);
	}
	const kinds = new Set<string>();
	const collect = (cards: DashboardCard[] | undefined): void => {
		for (const card of cards ?? []) if (card?.kind) kinds.add(card.kind);
	};
	const payload = pkg.payload as Bag;
	if (pkg.hearth.kind === "dashboard") {
		collect((pkg.payload as DashboardPayload).dashboard?.cards);
		collect((pkg.payload as DashboardPayload).pinnedCards);
	} else {
		for (const dash of (payload.dashboards as Dashboard[] | undefined) ?? []) {
			collect(dash?.cards);
		}
		collect(payload.cards as DashboardCard[] | undefined);
		collect(payload.pinnedCards as DashboardCard[] | undefined);
	}
	return {
		byScope,
		cardKinds: Array.from(kinds),
		assetCount: pkg.assets?.length ?? 0,
	};
}

/** Which groups of reference {@link stripReferences} removes. */
export interface StripOptions {
	/**
	 * Vault paths: notes, folders, attachments, the workspace link, and the
	 * `from` note on each embedded asset.
	 *
	 * This is the one a gallery wants. Nothing about a board's *appearance*
	 * lives in a path — the wallpaper travels as an embedded asset, not as the
	 * path it came from — so stripping paths leaves the layout, the styling and
	 * the pictures intact while removing the author's folder structure. The
	 * cards that pointed at notes come through as cards with nothing selected,
	 * which is what the person downloading the board has to fill in anyway.
	 */
	paths?: boolean;
	/** Private feed URLs, internal hosts, and the author's location. */
	private?: boolean;
	/**
	 * The author's own prose and working state: a text card's body, the
	 * calculator's last input.
	 *
	 * On by default alongside the paths, and for the same reason. There is no
	 * functional argument for keeping it — a board whose text card is empty
	 * works exactly as well as one whose embed card points at nothing, which is
	 * what stripping the paths already leaves behind — while the downside is
	 * publishing whatever the author happened to jot on their own dashboard.
	 * Turn it off deliberately for a board whose text really is part of the
	 * design.
	 */
	content?: boolean;
	/** Search/Dataview/Datacore queries. Off by default: a board stripped of
	 * its queries stops doing anything. Worth turning on only when a query is
	 * known to name private folders. */
	queries?: boolean;
	/** Command ids and hosted view types. Off by default — they name plugins,
	 * not the author. */
	plugins?: boolean;
}

/** Every scope a given set of options removes. */
function scopesToStrip(opts: StripOptions): Set<ReferenceScope> {
	const scopes = new Set<ReferenceScope>();
	if (opts.paths) {
		scopes.add("vaultPath");
		// An `asset`-scoped value that is still a vault path (nothing embedded
		// it) is a path like any other; one that was embedded has already been
		// rewritten to `hearth:asset/…` and the walker skips it.
		scopes.add("asset");
	}
	if (opts.private) {
		scopes.add("privateUrl");
		scopes.add("privateHost");
		scopes.add("place");
	}
	if (opts.content) scopes.add("userContent");
	if (opts.queries) scopes.add("userQuery");
	if (opts.plugins) {
		scopes.add("commandId");
		scopes.add("viewType");
	}
	return scopes;
}

/** What a strip removed, for the caller to report or log. */
export interface StripReport {
	/** How many values were removed, per scope. */
	removed: Partial<Record<ReferenceScope, number>>;
	/** Values that still look like vault paths or private feeds afterwards. See
	 * {@link residualPaths}. */
	residual: string[];
}

/**
 * Remove whole groups of reference from a package, in place.
 *
 * Built for the gallery hand-off: a package is exported from a vault with its
 * paths (which is right — the author's own copy has to keep working), and the
 * paths come off when it is published. Returns what it removed, plus anything
 * path-shaped it could still see afterwards, so a gallery can reject a package
 * the table failed to cover rather than publish it.
 *
 * `pkg` is modified. Copy it first if the original matters.
 */
export function stripReferences(
	pkg: HearthPackage,
	opts: StripOptions = { paths: true, private: true, content: true },
): StripReport {
	const scopes = scopesToStrip(opts);
	const removed: Partial<Record<ReferenceScope, number>> = {};
	const blanked: FoundReference[] = [];

	for (const ref of packageReferences(pkg)) {
		if (!scopes.has(ref.scope)) continue;
		ref.set(undefined);
		blanked.push(ref);
		removed[ref.scope] = (removed[ref.scope] ?? 0) + 1;
	}

	// Blanked array slots are holes until this closes them.
	compactTouched(blanked);

	if (opts.paths) {
		// The asset's own provenance: the picture stays, the folder it lived in
		// does not.
		for (const asset of pkg.assets ?? []) {
			if (asset.from !== undefined) {
				delete asset.from;
				removed.vaultPath = (removed.vaultPath ?? 0) + 1;
			}
		}
	}

	return { removed, residual: residualPaths(pkg) };
}

/** One value a strip would remove, named and located. */
export interface StrippedValue {
	scope: ReferenceScope;
	/** Where it sits, e.g. `dashboard.cards[2].tasks.folders[0]`. */
	pointer: string;
	value: string;
}

/**
 * Exactly what {@link stripReferences} would remove, without removing it.
 *
 * The export dialog's answer to "what does leaving out my private things
 * actually leave out". A count is not an answer — the difference between
 * "3 paths" and seeing `Journal/2019/Therapy.md` in the list is the difference
 * between a toggle somebody flips blind and one they can check — so this
 * returns the values themselves, in the order the walker finds them, from a
 * copy that is then thrown away.
 */
export function previewStrip(pkg: HearthPackage, opts: StripOptions): StrippedValue[] {
	const scopes = scopesToStrip(opts);
	const found: StrippedValue[] = [];
	for (const ref of packageReferences(pkg)) {
		if (!scopes.has(ref.scope)) continue;
		found.push({ scope: ref.scope, pointer: ref.pointer, value: String(ref.value) });
	}
	if (opts.paths) {
		for (const asset of pkg.assets ?? []) {
			if (asset.from === undefined) continue;
			found.push({
				scope: "vaultPath",
				pointer: `assets.${asset.id}.from`,
				value: asset.from,
			});
		}
	}
	return found;
}

/**
 * Close the holes a blanking `set(undefined)` left, in exactly the arrays it
 * touched.
 *
 * Every reference is collected before any is applied, so removing an array
 * element takes two steps: blank it during the pass, close the gap after. Only
 * the arrays a reference actually reported are visited — sweeping the whole
 * payload for empty slots would also strip holes that were already there and
 * are none of this pass's business.
 */
export function compactTouched(refs: Iterable<FoundReference>): void {
	const arrays = new Set<unknown[]>();
	for (const ref of refs) if (ref.container) arrays.add(ref.container);
	for (const list of arrays) {
		for (let i = list.length - 1; i >= 0; i--) {
			const item: unknown = list[i];
			if (item === undefined || item === null) list.splice(i, 1);
		}
	}
}

/** File extensions Obsidian stores in a vault, for the residual sweep. */
const VAULT_EXTENSIONS =
	/\.(md|canvas|base|pdf|png|jpe?g|gif|webp|svg|bmp|avif|mp[34]|m4a|ogg|wav|webm|mov|excalidraw)$/i;

/**
 * Strings anywhere in the package that still look like a vault path or a
 * private feed, after the rules have had their turn.
 *
 * The backstop for the table above being a denylist. It is a heuristic and says
 * so: it looks for a value with a path separator ending in an extension
 * Obsidian knows, or a `webcal:`/`.ics` URL, and reports where it found it. A
 * gallery can treat a non-empty result as "hold this for review"; a false
 * positive costs a look, a false negative would publish someone's folder tree.
 */
export function residualPaths(pkg: HearthPackage): string[] {
	const found: string[] = [];
	const seen = new Set<unknown>();

	const looksPrivate = (value: string): boolean => {
		const v = value.trim();
		if (v === "" || isAssetRef(v)) return false;
		// A calendar feed is private whatever it looks like.
		if (/^webcal:/i.test(v) || /\.ics(\?|$)/i.test(v)) return true;
		// An absolute web URL is a place on the internet, not a place in a
		// vault — even when it ends in something a vault would store.
		// `https://obsidian.md` is the case that taught this rule.
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return false;
		// A path, not a sentence: has a separator, no spaces around it, and ends
		// in something Obsidian would store.
		return /\//.test(v) && !/\s\/\s/.test(v) && VAULT_EXTENSIONS.test(v);
	};

	const sweep = (node: unknown, pointer: string): void => {
		if (typeof node === "string") {
			if (looksPrivate(node)) found.push(`${pointer}: ${node}`);
			return;
		}
		if (typeof node !== "object" || node === null) return;
		if (seen.has(node)) return;
		seen.add(node);
		if (Array.isArray(node)) {
			node.forEach((item, i) => sweep(item, `${pointer}[${i}]`));
			return;
		}
		for (const [key, value] of Object.entries(node)) {
			// An asset's base64 is not a path however long it is, and scanning it
			// costs more than everything else in the package put together.
			if (key === "data") continue;
			sweep(value, pointer === "" ? key : `${pointer}.${key}`);
		}
	};

	sweep(pkg.payload, "payload");
	for (const asset of pkg.assets ?? []) {
		if (asset.from && looksPrivate(asset.from)) {
			found.push(`assets.${asset.id}.from: ${asset.from}`);
		}
	}
	return found;
}
