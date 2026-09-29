/**
 * The World Tension card as text.
 *
 * Both graphical styles draw the same reading here: the score in big digits,
 * its band in the band's colour, the scale as a row of cells with the score
 * marked on it, and — when the card shows them — the change since yesterday, a
 * block sparkline of the last days and the model's explanation. Enter opens
 * the index on Kagi News.
 */
import type { Menu } from "obsidian";
import { bandLabel, changeText, resolveTension, summaryText, tensionRequest, tensionTtlMs, updatedText } from "../../cards/tension";
import { t } from "../../i18n";
import { cachedTension, loadTension, TENSION_SITE, tensionBand, tensionDelta, type TensionBand, type TensionRequest } from "../../tension";
import { effectiveAutoRefreshMinutes } from "../../types";
import { bigLines, bigWidth, BIG_ROWS, hasBigGlyphs } from "../bigtext";
import type { TuiContext, TuiRenderer } from "../card";
import { BLOCKS, centerLine, wrap, type Line, type TuiStyle } from "../text";
import { message } from "./common";

const BAND_STYLE: Record<TensionBand, TuiStyle[]> = {
	cool: ["blue", "bold"],
	mild: ["green", "bold"],
	warm: ["yellow", "bold"],
	hot: ["red", "bold"],
	burning: ["red", "bold", "reverse"],
};

/** The scale, `w` cells: five bands in their colours, the score's cell lit. */
export function scaleLine(score: number, w: number): Line {
	const cells = Math.max(5, w);
	const at = Math.min(cells - 1, Math.floor((Math.max(0, Math.min(100, score)) / 100) * cells));
	const line: Line = [];
	for (let i = 0; i < cells; i++) {
		const band = tensionBand(((i + 0.5) / cells) * 100);
		const style = BAND_STYLE[band].filter((s) => s !== "reverse" && s !== "bold");
		line.push(i === at ? { text: "█", style: [...style, "bold"] } : { text: "━", style: [...style, "faint"] });
	}
	return line;
}

/** A sparkline on the whole 0–100 scale, one cell per day, the last `w` days. */
export function historyLine(scores: readonly number[], w: number): string {
	return scores
		.slice(-Math.max(0, w))
		.map((s) => BLOCKS[Math.round((Math.max(0, Math.min(100, s)) / 100) * (BLOCKS.length - 1))])
		.join("");
}

async function refresh(ctx: TuiContext, req: TensionRequest, ttlMs: number): Promise<void> {
	if (ctx.state.tnRefreshing === true) return;
	ctx.state.tnRefreshing = true;
	ctx.redraw();
	try {
		await loadTension(req, { ttlMs, disabled: false, force: true });
	} finally {
		ctx.state.tnRefreshing = false;
		ctx.redraw();
	}
}

function openSite(): void {
	window.open(TENSION_SITE, "_blank");
}

export const tensionTui: TuiRenderer = {
	render(ctx) {
		const r = resolveTension(ctx.card.tension ?? {});
		const req = tensionRequest(r);
		const ttlMs = tensionTtlMs(r);
		const disabled = ctx.view.plugin.settings.disableExternalCalls;
		const strings = t().cards.tension;
		const snapshot = cachedTension(req);
		const shown = snapshot?.fetched ?? 0;
		if (snapshot) ctx.state.tnFailed = false;
		// Redraw only when the load brought something new, or failed for the
		// first time — an unchanged answer redrawing would ask again forever.
		void loadTension(req, { ttlMs, disabled }).then((next) => {
			if ((next?.fetched ?? 0) !== shown) ctx.redraw();
			else if (!snapshot && ctx.state.tnFailed !== true) {
				ctx.state.tnFailed = true;
				ctx.redraw();
			}
		});
		const autoMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, r.refreshMin);
		if (autoMin > 0 && !disabled) {
			ctx.component.registerInterval(window.setInterval(() => void refresh(ctx, req, ttlMs), autoMin * 60_000));
		}

		if (!snapshot) {
			const text = disabled ? strings.disabled : ctx.state.tnFailed === true ? strings.error : strings.loading;
			return { lines: message(text, ctx.cols) };
		}
		const now = snapshot.now;
		if (!now) return { lines: message(strings.none, ctx.cols) };

		const w = ctx.cols;
		const band = tensionBand(now.score);
		const score = String(Math.round(now.score));
		const lines: Line[] = [];
		const big = hasBigGlyphs(score) && bigWidth(score) <= w && ctx.rows >= BIG_ROWS + 2;
		if (big) {
			// The digits' solid cells take the band's colour instead of the accent.
			const colour = BAND_STYLE[band][0];
			lines.push(...bigLines(score).map((l) => centerLine(l.map((s) => (s.style === "block" ? { ...s, style: [colour, "solid"] } : s)), w)));
		} else {
			lines.push(centerLine([{ text: score, style: BAND_STYLE[band] }, { text: "/100", style: "faint" }], w));
		}

		const meta: Line = [];
		if (r.showBand) meta.push({ text: ` ${bandLabel(band)} `, style: BAND_STYLE[band] });
		const delta = r.showChange ? tensionDelta(snapshot) : null;
		if (delta !== null) {
			if (meta.length) meta.push({ text: "  " });
			meta.push({ text: changeText(delta), style: delta > 0 ? "red" : delta < 0 ? "green" : "dim" });
		}
		if (big && !r.showBand) meta.push({ text: `  ${score}/100`, style: "faint" });
		if (meta.length) lines.push(centerLine(meta, w));
		if (r.showScale) lines.push(centerLine(scaleLine(now.score, Math.min(w, 40)), w));
		if (r.showHistory && snapshot.history.length >= 2) {
			lines.push(centerLine([{ text: historyLine(snapshot.history.map((p) => p.score), Math.min(w, 60)), style: "accent" }], w));
		}
		if (r.showSummary && now.summary) {
			lines.push([]);
			for (const l of wrap(summaryText(now.summary, r), Math.max(8, w))) lines.push([{ text: l }]);
			lines.push([{ text: strings.source, style: "faint" }]);
		}
		if (r.showUpdated) lines.push([], [{ text: updatedText(snapshot), style: "faint" }]);

		return {
			lines,
			items: [{ line: 0, span: lines.length, activate: openSite }],
			hint: ctx.state.tnRefreshing === true ? t().tui.cards.loading : bandLabel(band),
			foot: t().tui.cards.tensionFoot,
		};
	},
	menu(ctx, menu: Menu) {
		menu.addItem((i) => i.setTitle(t().cards.tension.open).setIcon("external-link").onClick(openSite));
		if (ctx.view.plugin.settings.disableExternalCalls) return;
		const r = resolveTension(ctx.card.tension ?? {});
		menu.addItem((i) =>
			i
				.setTitle(t().tui.fn.refresh)
				.setIcon("refresh-cw")
				.onClick(() => void refresh(ctx, tensionRequest(r), tensionTtlMs(r))),
		);
	},
	detail() {
		openSite();
	},
};
