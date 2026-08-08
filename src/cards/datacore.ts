import { Component, Setting } from "obsidian";
import { emptyState, wireMarkdownLinks } from "../cardbodies";
import {
	datacoreQueryError,
	datacoreQueryScript,
	getDatacoreApi,
	isDatacoreAvailable,
	runDatacoreScript,
	type DatacoreLanguage,
} from "../datacore";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Datacore query -----------------------------------------------------

/** A card that renders a Datacore query or script through Datacore's own
 * Preact renderer, so tables, lists and cards look exactly as they do in a
 * note. Datacore is the successor to Dataview, and this card is the successor
 * to Hearth's Dataview card: same shape (a query, a language, a live result),
 * different engine.
 *
 * Depends on the Datacore community plugin — the "Add card" picker only offers
 * this card when Datacore is installed, and the card shows a friendly prompt if
 * Datacore is later disabled. Datacore attaches its own render child to
 * `component` and its hooks subscribe to the index, so results update live as
 * the vault changes without Hearth re-running anything. */
export function renderDatacore(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const api = getDatacoreApi(view.app);
	if (!api) {
		emptyState(body, "database", t().cards.empty.datacoreEnable);
		return;
	}
	const cfg = card.datacore ?? {};
	const query = (cfg.query ?? "").trim();
	if (!query) {
		emptyState(body, "code", t().cards.empty.datacoreNoQuery);
		return;
	}

	const language: DatacoreLanguage = cfg.language ?? "query";
	// The dashboard has no "current note", so scripts run with an empty origin
	// path: global queries work fully, but `dc.useCurrentFile()` and friends have
	// no meaningful current file to resolve to.
	const origin = "";
	let source = query;
	if (language === "query") {
		const parseError = datacoreQueryError(api, query);
		if (parseError) {
			emptyState(body, "alert-triangle", parseError);
			return;
		}
		source = datacoreQueryScript(query, cfg.pageSize);
	}

	const host = body.createDiv("hearth-datacore");
	try {
		runDatacoreScript(
			api,
			language === "query" ? "jsx" : language,
			source,
			host,
			component,
			origin,
		);
	} catch (err) {
		// Datacore catches script errors itself and renders them inline; this
		// guards the call into it, so a Datacore version mismatch shows as a
		// readable message instead of taking down the dashboard render.
		host.empty();
		const message = err instanceof Error ? err.message : String(err);
		emptyState(host, "alert-triangle", message);
		return;
	}
	// Datacore renders internal links as anchors; wire them up so they open like
	// links elsewhere on the dashboard. Captured, because Datacore's own `dc.Link`
	// carries a click handler that opens the note in the active tab — the Hearth
	// tab — so it has to be intercepted before it runs rather than after (#106).
	wireMarkdownLinks(view, host, origin, { capture: true });
}


export function datacoreEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.datacore ??= {});
	const language: DatacoreLanguage = cfg.language ?? "query";
	new Setting(containerEl)
		.setName(t().editors.datacore.language)
		.setDesc(t().editors.datacore.languageDesc)
		.addDropdown((d) => {
			d.addOption("query", t().editors.datacore.languageQuery);
			d.addOption("jsx", t().editors.datacore.languageJsx);
			d.addOption("js", t().editors.datacore.languageJs);
			d.addOption("tsx", t().editors.datacore.languageTsx);
			d.addOption("ts", t().editors.datacore.languageTs);
			d.setValue(language).onChange((v) => {
				// "query" is the default, so it's stored as absent — the same way
				// every other card writes its default back as undefined.
				cfg.language = v === "query" ? undefined : (v as DatacoreLanguage);
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});

	const isQuery = language === "query";
	const query = new Setting(containerEl)
		.setName(isQuery ? t().editors.datacore.query : t().editors.datacore.script)
		.setDesc(
			isQuery ? t().editors.datacore.queryDesc : t().editors.datacore.scriptDesc,
		);
	query.addTextArea((txt) => {
		txt
			.setPlaceholder(
				isQuery
					? t().editors.datacore.queryPlaceholder
					: t().editors.datacore.scriptPlaceholder,
			)
			.setValue(cfg.query ?? "")
			.onChange((v) => {
				cfg.query = v;
				ctx.opts.save();
			});
		txt.inputEl.rows = 6;
		txt.inputEl.addClass("hearth-datacore-input");
	});
	query.settingEl.addClass("hearth-setting-stacked");

	// Paging only applies to the list Hearth generates for a query; a script
	// draws its own view and decides its own paging.
	if (!isQuery) return;
	const paging = new Setting(containerEl)
		.setName(t().editors.datacore.pageSize)
		.setDesc(t().editors.datacore.pageSizeDesc);
	paging.addSlider((s) => {
		s.setLimits(0, 100, 5)
			.setValue(cfg.pageSize ?? 0)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.pageSize = v > 0 ? v : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
}

/** A Datacore query or script, rendered through the Datacore plugin. Gated on
 * that plugin. */
export const datacoreCard: CardDefinition<"datacore"> = {
	kind: "datacore",
	templates: [
		{
			id: "datacore",
			name: "Datacore query",
			icon: "database-zap",
			build: () => ({ kind: "datacore", title: "Datacore", datacore: {}, w: 6, h: 4 }),
			available: (app) => isDatacoreAvailable(app),
		},
	],
	render: (view, card, body, component) => renderDatacore(view, card, body, component),
	renderEditor: (container, ctx) => datacoreEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.datacore) copy.datacore = { ...source.datacore };
	},
	liveness: { mode: "static" },
};
