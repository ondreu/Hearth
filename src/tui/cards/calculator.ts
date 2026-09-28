/**
 * The Calculator card as text: a `>` prompt, the answer under it as you type,
 * and — when the card has a keypad — the keys as a grid of buttons.
 *
 * The prompt is a real input, mounted on the grid, because typing is typing.
 * Its answer and note are redrawn in place on every keystroke rather than
 * through a card redraw, which would rebuild the input and drop the caret.
 */
import { debounce } from "obsidian";
import { evaluate } from "../../calculator";
import { CALC_BASIC_KEYS, CALC_SCI_KEYS, type CalcKey } from "../../cards/calculator";
import { cachedRates, loadRates } from "../../currency";
import { t } from "../../i18n";
import type { TuiRenderer } from "../card";
import { drawLine } from "../draw";
import { fit, type Line } from "../text";
import { buttonGrid } from "./common";

export const calculatorTui: TuiRenderer = {
	render(ctx) {
		const { view } = ctx;
		const cfg = (ctx.card.calculator ??= {});
		const angleUnit = cfg.angleUnit ?? "deg";
		const persist = debounce(() => void view.plugin.saveData(view.plugin.settings), 600, true);
		let triedRates = false;

		const lines: Line[] = [[], [], []];
		const mounts = [
			{
				line: 0,
				rows: 3,
				mount: (host: HTMLElement) => {
					host.addClass("hearth-tui-calc");
					const prompt = host.createDiv("hearth-tui-line hearth-tui-calc-prompt");
					prompt.createSpan({ cls: "hearth-tui-accent hearth-tui-bold", text: "> " });
					const input = prompt.createEl("input", {
						cls: "hearth-tui-calc-input",
						attr: { type: "text", spellcheck: "false", placeholder: t().cards.calculator.placeholder, "aria-label": t().cards.calculator.placeholder },
					});
					input.value = cfg.lastInput ?? "";
					ctx.state.input = input;
					const answer = host.createDiv();
					const note = host.createDiv();
					const show = (a: Line, n: Line) => {
						answer.empty();
						note.empty();
						drawLine(answer, fit(a, ctx.cols));
						drawLine(note, fit(n, ctx.cols));
					};
					const update = () => {
						const raw = input.value;
						cfg.lastInput = raw;
						persist();
						if (!raw.trim()) {
							show([], []);
							return;
						}
						const res = evaluate(raw, { angleUnit, rates: cachedRates()?.rates });
						if (res.ok) {
							show([{ text: "= ", style: "dim" }, { text: res.formatted, style: ["bold", "accent"] }], [{ text: res.note ?? "", style: "dim" }]);
							return;
						}
						show([{ text: res.error ? "= …" : "", style: "dim" }], [{ text: /rate|currency/i.test(res.error) ? res.error : "", style: "yellow" }]);
						if (!triedRates && !view.plugin.settings.disableExternalCalls && /rate/i.test(res.error) && !cachedRates()) {
							triedRates = true;
							void loadRates().then((rates) => {
								if (rates) update();
							});
						}
					};
					input.addEventListener("input", update);
					input.addEventListener("keydown", (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							update();
							input.select();
						}
						// Typing belongs to the field, not the board's keys.
						if (e.key !== "Escape" && e.key !== "Tab" && !/^F\d+$/.test(e.key)) e.stopPropagation();
					});
					ctx.state.update = update;
					update();
				},
			},
		];

		const tier = cfg.keypad ?? "none";
		if (tier === "none") return { lines, mounts, foot: t().tui.cards.calcFoot };

		const keys: CalcKey[] = tier === "scientific" ? [...CALC_SCI_KEYS, ...CALC_BASIC_KEYS] : CALC_BASIC_KEYS;
		const press = (key: CalcKey) => {
			const input = ctx.state.input as HTMLInputElement | undefined;
			const update = ctx.state.update as (() => void) | undefined;
			if (!input) return;
			const start = input.selectionStart ?? input.value.length;
			const end = input.selectionEnd ?? input.value.length;
			if (key.action === "clear") input.value = "";
			else if (key.action === "back") {
				if (start !== end) input.value = input.value.slice(0, start) + input.value.slice(end);
				else if (start > 0) input.value = input.value.slice(0, start - 1) + input.value.slice(start);
			} else if (key.insert !== undefined) {
				input.value = input.value.slice(0, start) + key.insert + input.value.slice(end);
				const pos = start + key.insert.length;
				input.setSelectionRange(pos, pos);
			}
			update?.();
		};
		// Four keys to a row, like the pad they stand for.
		const width = Math.max(5, Math.floor((ctx.cols - 3) / 4));
		const grid = buttonGrid(
			ctx,
			keys.map((k) => ({
				label: k.label,
				style: k.action === "equals" ? ["reverse", "bold"] : k.cls === "is-op" ? "yellow" : k.cls === "is-fn" ? "cyan" : undefined,
				activate: () => press(k),
			})),
			{ width, startLine: 4 },
		);
		lines.push([], ...grid.lines);
		return { lines, mounts, items: grid.items, foot: t().tui.cards.calcFoot };
	},
};
