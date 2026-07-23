import { Component, setIcon, Setting } from "obsidian";
import { emptyState } from "../cardbodies";
import { addResetButton } from "../editors";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Web / iframe embed -------------------------------------------------

export function renderWeb(card: DashboardCard, body: HTMLElement, component: Component): void {
	const url = card.url?.trim();
	if (!url) {
		emptyState(body, "globe", t().cards.empty.webNoUrl);
		return;
	}
	// Only allow http(s) URLs into the iframe.
	if (!/^https?:\/\//i.test(url)) {
		emptyState(body, "globe", "URL must start with http:// or https://");
		return;
	}

	body.addClass("hearth-web-body");
	const frame = body.createEl("iframe", { cls: "hearth-web" });
	frame.setAttribute("src", url);
	frame.setAttribute("loading", "lazy");
	frame.setAttribute("referrerpolicy", "no-referrer");
	// Sandbox keeps embedded pages from reaching into the app while still
	// letting normal sites run their scripts. `allow-same-origin` together with
	// `allow-scripts` is the well-known combination that can let framed content
	// escape the sandbox, so it's opt-in per card ("trusted") rather than the
	// default — most sites render fine without it.
	const tokens = ["allow-scripts", "allow-popups", "allow-forms"];
	if (card.sandboxTrusted) tokens.push("allow-same-origin");
	frame.setAttribute("sandbox", tokens.join(" "));

	// A small always-available "open in browser" button, plus a fallback shown
	// if the frame never loads (e.g. the site refuses framing via
	// X-Frame-Options / CSP, which can't be detected reliably cross-origin).
	const openExternally = () => window.open(url, "_blank");
	const ext = body.createEl("button", {
		cls: "hearth-web-external",
		attr: { "aria-label": t().cards.web.openInBrowser },
	});
	setIcon(ext, "external-link");
	ext.addEventListener("click", openExternally);

	let loaded = false;
	frame.addEventListener("load", () => {
		loaded = true;
		body.removeClass("hearth-web-blocked");
		// A slow but successful load can arrive after the fallback showed — clear it.
		body.querySelector(".hearth-web-fallback")?.remove();
	});
	const timer = window.setTimeout(() => {
		if (loaded) return;
		body.addClass("hearth-web-blocked");
		const fallback = body.createDiv("hearth-web-fallback");
		setIcon(fallback.createDiv("hearth-card-empty-icon"), "globe");
		fallback.createDiv({
			cls: "hearth-card-empty-text",
			text: t().cards.web.mayRefuse,
		});
		const open = fallback.createEl("button", { cls: "hearth-daily-create", text: t().cards.web.openInBrowser });
		open.addEventListener("click", openExternally);
	}, 4000);
	component.register(() => window.clearTimeout(timer));
}


export function webEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	new Setting(containerEl).setName(t().editors.web.url).addText((txt) =>
		txt
			.setPlaceholder(t().editors.web.urlPlaceholder)
			.setValue(card.url ?? "")
			.onChange((v) => {
				card.url = v;
				ctx.opts.save();
			}),
	);
	new Setting(containerEl)
		.setName(t().editors.web.trusted)
		.setDesc(t().editors.web.trustedDesc)
		.addToggle((tg) =>
			tg.setValue(card.sandboxTrusted ?? false).onChange((v) => {
				card.sandboxTrusted = v || undefined;
				ctx.opts.save();
			}),
		);
	refreshSetting(ctx, containerEl);
}


/** Auto-refresh interval (seconds) for web cards. 0 = off. (Embed and daily
 * cards update live from vault events and don't need this.) */
export function refreshSetting(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const setting = new Setting(containerEl)
		.setName(t().editors.web.autoRefresh)
		.setDesc(t().editors.web.autoRefreshDesc);
	setting.addText((txt) => {
		txt.setValue(String(card.refreshSec ?? 0)).onChange((v) => {
			const n = parseInt(v, 10);
			card.refreshSec = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.addClass("hearth-count-input");
		txt.inputEl.setAttribute(
			"aria-label",
			t().editors.web.refreshIntervalAria,
		);
	});
	addResetButton(ctx, setting, t().settings.resetField, () => {
		card.refreshSec = undefined;
	});
}

/** A web page in a sandboxed iframe, with optional polling refresh. */
export const webCard: CardDefinition<"web"> = {
	kind: "web",
	templates: [
		{ id: "web", name: "Web page (iframe)", icon: "globe", build: () => ({ kind: "web", title: "Web", url: "", w: 6, h: 4 }) },
	],
	render: (_view, card, body, component) => renderWeb(card, body, component),
	renderEditor: (container, ctx) => webEditor(ctx, container),
	liveness: { mode: "poll" },
};
