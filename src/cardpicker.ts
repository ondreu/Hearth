import {
	apiVersion,
	Modal,
	Notice,
	Platform,
	prepareFuzzySearch,
	setIcon,
	type App,
} from "obsidian";
import {
	CARD_CATEGORIES,
	CARD_TEMPLATES,
	templateCategory,
	templateDescription,
	templateName,
	unmetRequirement,
	type CardCategory,
	type CardTemplateDef,
} from "./cards";
import { cardRequestGithubUrl, cardRequestMailtoUrl } from "./cardrequest";
import { t } from "./i18n";
import { createKofiTipButton } from "./kofi";

/**
 * The "Add card" picker.
 *
 * It used to be a flat Obsidian `Menu`: one unlabelled line per template, in
 * one column, in registry order. That worked at a dozen cards; the catalogue is
 * now ~30 and the menu had become a wall of names taller than a laptop screen,
 * with no way to search it, nothing saying what any card actually does, and —
 * worst — a third of it invisible, because plugin-backed cards were hidden
 * until their plugin happened to be installed.
 *
 * This replaces it with a modal that shows the catalogue as it is: every card,
 * always, grouped into categories, searchable, each with a one-line
 * description, and the ones whose plugin is missing marked (and offering a jump
 * to Obsidian's plugin browser) rather than hidden. The last rail entry is
 * "Request a card", because the picker is exactly where you notice the card you
 * wanted doesn't exist yet.
 */

/** What the rail can be showing: every card, one category, or the request page.
 * (`CardCategory` values are used verbatim, so the rail is derived from the
 * registry rather than a second hand-kept list.) */
type PickerScope = "all" | "request" | CardCategory;

/** localStorage key for the scope the picker reopens on. */
const SCOPE_KEY = "hearth-card-picker-scope";

export interface CardPickerOptions {
	/** The running Hearth version, stamped into a card request. */
	hearthVersion: string;
	/** Add this template to the dashboard. */
	onChoose: (template: CardTemplateDef) => void;
	/**
	 * Open the dashboard gallery, closing the picker first.
	 *
	 * Sits in the rail directly above "Request a card", which is where the two
	 * of them belong together: both answer "the card I want isn't here", and a
	 * whole board somebody has already arranged is the more likely of the two to
	 * be what was actually wanted. Omitted when no gallery is configured, so the
	 * rail never offers a door to nowhere.
	 */
	onGallery?: () => void;
}

/** Open the add-card picker. */
export function openCardPicker(app: App, opts: CardPickerOptions): void {
	new CardPickerModal(app, opts).open();
}

class CardPickerModal extends Modal {
	private opts: CardPickerOptions;
	/** Named `pickerScope`, not `scope`: `Modal` already has a `scope` (its
	 * keymap `Scope`), and shadowing it would break the modal's key handling —
	 * the #52 naming hazard documented on `HearthTabbedModal`. */
	private pickerScope: PickerScope = "all";
	private query = "";

	/** The template tiles currently on screen, in visual order — the list arrow
	 * keys walk. Rebuilt on every results render. */
	private tiles: HTMLElement[] = [];

	private searchEl: HTMLInputElement | null = null;
	private railEl: HTMLElement | null = null;
	private resultsEl: HTMLElement | null = null;

	constructor(app: App, opts: CardPickerOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen(): void {
		const saved = this.app.loadLocalStorage(SCOPE_KEY) as string | null;
		if (typeof saved === "string" && this.isScope(saved)) this.pickerScope = saved;

		this.titleEl.setText(t().cardPicker.title);
		const { contentEl, modalEl } = this;
		// The frame is sized on modalEl (a grid of tiles needs more than the
		// default modal width); the content layout hangs off contentEl.
		modalEl.addClass("hearth-card-picker-modal");
		contentEl.empty();
		contentEl.addClass("hearth-card-picker");

		this.renderSearch(contentEl);
		const body = contentEl.createDiv("hearth-picker-body");
		this.railEl = body.createDiv("hearth-picker-rail");
		this.resultsEl = body.createDiv("hearth-picker-results");
		this.renderRail();
		this.renderResults();

		// Phones get the keyboard shoved in their face by an autofocused field,
		// covering the very grid the picker exists to show; the same reason the
		// search bar in `search.ts` only focuses on desktop.
		if (!Platform.isMobile) this.searchEl?.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private isScope(value: string): value is PickerScope {
		return value === "all" || value === "request" || (CARD_CATEGORIES as string[]).includes(value);
	}

	private setScope(scope: PickerScope): void {
		if (scope === this.pickerScope) return;
		this.pickerScope = scope;
		this.app.saveLocalStorage(SCOPE_KEY, scope);
		this.renderRail();
		this.renderResults();
		// Start a new category at its top: the results column keeps its height
		// now, so a scrolled-down position would otherwise carry over and land
		// you in the middle of the next category.
		if (this.resultsEl) this.resultsEl.scrollTop = 0;
	}

	// ---- Search ---------------------------------------------------------

	private renderSearch(containerEl: HTMLElement): void {
		const row = containerEl.createDiv("hearth-picker-search");
		setIcon(row.createSpan("hearth-picker-search-icon"), "search");
		const input = row.createEl("input", {
			cls: "hearth-picker-search-input",
			attr: {
				type: "text",
				placeholder: t().cardPicker.searchPlaceholder,
				"aria-label": t().cardPicker.searchPlaceholder,
			},
		});
		this.searchEl = input;
		input.addEventListener("input", () => {
			this.query = input.value.trim();
			// Typing searches the whole catalogue: a query that matches nothing in
			// the category you happen to be standing in reads as "Hearth has no
			// such card", which is exactly the wrong answer.
			if (this.query && this.pickerScope !== "all") this.setScope("all");
			else this.renderResults();
		});
		input.addEventListener("keydown", (evt: KeyboardEvent) => {
			if (!this.tiles.length) return;
			// Enter takes the top match without a detour through the grid — the
			// point of typing "pet" is to get the pet card.
			if (evt.key === "Enter") {
				evt.preventDefault();
				this.tiles[0].click();
			} else if (evt.key === "ArrowDown") {
				evt.preventDefault();
				this.tiles[0].focus();
			}
		});
	}

	// ---- Rail -----------------------------------------------------------

	private renderRail(): void {
		const rail = this.railEl;
		if (!rail) return;
		rail.empty();
		const strings = t().cardPicker;

		this.railButton(rail, "all", strings.allCards, "layout-grid");
		for (const category of CARD_CATEGORIES) {
			this.railButton(rail, category, strings.categories[category], CATEGORY_ICONS[category]);
		}
		rail.createDiv("hearth-picker-rail-sep");
		// Above "Request a card" and below the categories: the catalogue you can
		// add from, then whole boards other people have arranged, then the way to
		// ask for what neither has.
		if (this.opts.onGallery) {
			const gallery = rail.createEl("button", { cls: "hearth-picker-rail-btn is-gallery" });
			setIcon(gallery.createSpan("hearth-picker-rail-icon"), "layout-template");
			gallery.createSpan({
				cls: "hearth-picker-rail-label",
				text: t().gallery.browse.openLabel,
			});
			gallery.setAttribute("aria-label", t().gallery.browse.openAria);
			gallery.addEventListener("click", () => {
				this.close();
				this.opts.onGallery?.();
			});
		}
		this.railButton(rail, "request", strings.request.railLabel, "message-square-plus");

		// Straight under "Request a card", and the only entry in the rail that
		// isn't a scope: someone browsing the whole catalogue is exactly who
		// might feel like leaving a tip, and nothing here is behind one.
		createKofiTipButton(rail).addClass("hearth-picker-rail-kofi");
	}

	private railButton(rail: HTMLElement, scope: PickerScope, label: string, icon: string): void {
		const btn = rail.createEl("button", { cls: "hearth-picker-rail-btn" });
		btn.toggleClass("is-active", this.pickerScope === scope);
		btn.toggleClass("is-request", scope === "request");
		btn.setAttribute("aria-pressed", String(this.pickerScope === scope));
		setIcon(btn.createSpan("hearth-picker-rail-icon"), icon);
		btn.createSpan({ cls: "hearth-picker-rail-label", text: label });
		btn.addEventListener("click", () => this.setScope(scope));
	}

	// ---- Results --------------------------------------------------------

	private renderResults(): void {
		const results = this.resultsEl;
		if (!results) return;
		results.empty();
		this.tiles = [];

		if (this.pickerScope === "request") {
			this.renderRequest(results);
			return;
		}

		const matches = this.matchingTemplates();
		if (!matches.length) {
			this.renderNoMatches(results);
			return;
		}

		// Sections are the point of the redesign, so keep them whenever there is
		// more than one to show; a single-category scope needs no heading, and a
		// search result reads better as one ranked list.
		if (this.query || this.pickerScope !== "all") {
			this.renderGrid(results, matches);
		} else {
			for (const category of CARD_CATEGORIES) {
				const inCategory = matches.filter((tpl) => templateCategory(tpl.id) === category);
				if (!inCategory.length) continue;
				results.createDiv({
					cls: "hearth-picker-section",
					text: t().cardPicker.categories[category],
				});
				this.renderGrid(results, inCategory);
			}
		}

		// A quiet way out at the end of the list, for the case the picker can't
		// answer: you scrolled everything and none of it was the card you wanted.
		const foot = results.createDiv("hearth-picker-foot");
		foot.createSpan({ text: t().cardPicker.request.footPrompt });
		const link = foot.createEl("button", {
			cls: "hearth-picker-foot-link",
			text: t().cardPicker.request.footLink,
		});
		link.addEventListener("click", () => this.setScope("request"));
	}

	/** The templates to show, filtered by scope and ranked by the query. */
	private matchingTemplates(): CardTemplateDef[] {
		const scoped =
			this.pickerScope === "all" || this.pickerScope === "request"
				? CARD_TEMPLATES
				: CARD_TEMPLATES.filter((tpl) => templateCategory(tpl.id) === this.pickerScope);
		if (!this.query) return scoped;

		// Name and description both feed the match, so "todo" finds Tasks and
		// "iframe" finds the web card. Obsidian's own fuzzy matcher, for the same
		// feel as every other search surface in Hearth.
		const fuzzy = prepareFuzzySearch(this.query);
		const ranked: { template: CardTemplateDef; score: number }[] = [];
		for (const template of scoped) {
			const name = fuzzy(templateName(template));
			const desc = fuzzy(templateDescription(template));
			// A description hit is a weaker signal than a name hit, and scores are
			// negative (less negative is better), so push description matches down.
			const score = Math.max(name?.score ?? -Infinity, (desc?.score ?? -Infinity) - 2);
			if (score > -Infinity) ranked.push({ template, score });
		}
		ranked.sort((a, b) => b.score - a.score);
		return ranked.map((entry) => entry.template);
	}

	private renderGrid(containerEl: HTMLElement, templates: CardTemplateDef[]): void {
		const grid = containerEl.createDiv("hearth-picker-grid");
		for (const template of templates) this.renderTile(grid, template);
	}

	private renderTile(grid: HTMLElement, template: CardTemplateDef): void {
		const missing = unmetRequirement(this.app, template);
		const tile = grid.createEl("button", { cls: "hearth-card-tile" });
		tile.toggleClass("is-unmet", !!missing);
		setIcon(tile.createSpan("hearth-card-tile-icon"), template.icon);

		const text = tile.createDiv("hearth-card-tile-text");
		text.createDiv({ cls: "hearth-card-tile-name", text: templateName(template) });
		const description = templateDescription(template);
		if (description) text.createDiv({ cls: "hearth-card-tile-desc", text: description });
		if (missing) {
			const badge = text.createDiv("hearth-card-tile-badge");
			setIcon(badge.createSpan("hearth-card-tile-badge-icon"), "puzzle");
			badge.createSpan({ text: t().cardPicker.requires(missing.name) });
		}

		tile.setAttribute("aria-label", templateName(template));
		tile.addEventListener("keydown", (evt: KeyboardEvent) => this.onTileKey(evt, tile));
		tile.addEventListener("click", () => {
			this.close();
			// The card is added either way — it renders its own "install X" prompt
			// in place, which is a far better teacher than a missing menu entry —
			// but say so, with a one-click way to fix it.
			if (missing) this.noticeMissing(missing.name, missing.pluginId);
			this.opts.onChoose(template);
		});
		this.tiles.push(tile);
	}

	/** Arrow-key movement across the tiles, in visual order. Left/Right and
	 * Up/Down both walk the flat list: the grid reflows with the modal's width,
	 * so there is no fixed column count to step by. */
	private onTileKey(evt: KeyboardEvent, tile: HTMLElement): void {
		const step =
			evt.key === "ArrowDown" || evt.key === "ArrowRight"
				? 1
				: evt.key === "ArrowUp" || evt.key === "ArrowLeft"
					? -1
					: 0;
		if (!step) return;
		evt.preventDefault();
		const index = this.tiles.indexOf(tile);
		const next = index + step;
		if (next < 0) this.searchEl?.focus();
		else this.tiles[next]?.focus();
	}

	private noticeMissing(name: string, pluginId?: string): void {
		const frag = createFragment();
		frag.appendText(t().cardPicker.missingNotice(name));
		if (!pluginId) {
			new Notice(frag, 8000);
			return;
		}
		frag.appendText(" ");
		const link = frag.createEl("a", {
			text: t().cardPicker.installLink(name),
			href: `obsidian://show-plugin?id=${pluginId}`,
		});
		link.addEventListener("click", (evt) => {
			evt.preventDefault();
			window.open(link.href);
		});
		new Notice(frag, 8000);
	}

	private renderNoMatches(containerEl: HTMLElement): void {
		const empty = containerEl.createDiv("hearth-picker-empty");
		setIcon(empty.createSpan("hearth-picker-empty-icon"), "search-x");
		empty.createDiv({ cls: "hearth-picker-empty-text", text: t().cardPicker.noMatches });
		const btn = empty.createEl("button", {
			cls: "mod-cta",
			text: t().cardPicker.request.railLabel,
		});
		btn.addEventListener("click", () => this.setScope("request"));
	}

	// ---- Request a card -------------------------------------------------

	private renderRequest(containerEl: HTMLElement): void {
		const strings = t().cardPicker.request;
		const page = containerEl.createDiv("hearth-picker-request");
		page.createDiv({ cls: "hearth-picker-section", text: strings.heading });
		page.createDiv({ cls: "hearth-picker-request-intro", text: strings.intro });

		const context = {
			hearthVersion: this.opts.hearthVersion,
			obsidianVersion: apiVersion,
			platform: Platform.isMobile ? "Mobile" : "Desktop",
		};

		this.requestOption(page, {
			icon: "github",
			title: strings.githubTitle,
			description: strings.githubDesc,
			action: strings.githubAction,
			url: cardRequestGithubUrl(context),
		});
		this.requestOption(page, {
			icon: "mail",
			title: strings.emailTitle,
			// The address itself is never printed on screen — it only ever exists
			// inside the mailto: the button opens.
			description: strings.emailDesc,
			action: strings.emailAction,
			url: cardRequestMailtoUrl(context),
		});

		page.createDiv({ cls: "hearth-picker-request-note", text: strings.prefilledNote });
	}

	private requestOption(
		containerEl: HTMLElement,
		opts: { icon: string; title: string; description: string; action: string; url: string },
	): void {
		const row = containerEl.createDiv("hearth-picker-request-option");
		setIcon(row.createSpan("hearth-picker-request-icon"), opts.icon);
		const text = row.createDiv("hearth-picker-request-text");
		text.createDiv({ cls: "hearth-picker-request-title", text: opts.title });
		text.createDiv({ cls: "hearth-picker-request-desc", text: opts.description });
		const btn = row.createEl("button", { cls: "mod-cta", text: opts.action });
		btn.addEventListener("click", () => {
			// mailto: and https: both go through the OS handler — the browser (or
			// Electron) picks the mail client, which is the only portable way to
			// open a composer from a plugin.
			window.open(opts.url, "_blank");
		});
	}
}

/** Rail icons, one per category. Kept beside the picker rather than on the
 * registry: they are a property of this menu, not of the cards. */
const CATEGORY_ICONS: Record<CardCategory, string> = {
	notes: "file-text",
	planning: "calendar-check",
	vault: "bar-chart-3",
	tools: "wrench",
	integrations: "plug",
	fun: "sparkles",
};
