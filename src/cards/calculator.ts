import { debounce, Setting } from "obsidian";
import { evaluate as evaluateCalc } from "../calculator";
import { cachedRates, loadRates } from "../currency";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Calculator ---------------------------------------------------------

/** One key on the on-screen keypad. `insert` is spliced in at the caret; keys
 * with no `insert` carry a named `action` (equals / clear / backspace). */
interface CalcKey {
	label: string;
	insert?: string;
	action?: "equals" | "clear" | "back";
	/** Extra CSS class for accent keys (operators, equals). */
	cls?: string;
}


/** The basic pad: digits and the four operations plus edit keys. */
const CALC_BASIC_KEYS: CalcKey[] = [
	{ label: "C", action: "clear", cls: "is-fn" },
	{ label: "(", insert: "(" },
	{ label: ")", insert: ")" },
	{ label: "⌫", action: "back", cls: "is-fn" },
	{ label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" },
	{ label: "÷", insert: "/", cls: "is-op" },
	{ label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" },
	{ label: "×", insert: "*", cls: "is-op" },
	{ label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" },
	{ label: "−", insert: "-", cls: "is-op" },
	{ label: "0", insert: "0" }, { label: ".", insert: "." },
	{ label: "=", action: "equals", cls: "is-eq" },
	{ label: "+", insert: "+", cls: "is-op" },
];


/** Extra keys prepended for the scientific tier: functions, powers, constants. */
const CALC_SCI_KEYS: CalcKey[] = [
	{ label: "sin", insert: "sin(", cls: "is-fn" },
	{ label: "cos", insert: "cos(", cls: "is-fn" },
	{ label: "tan", insert: "tan(", cls: "is-fn" },
	{ label: "√", insert: "sqrt(", cls: "is-fn" },
	{ label: "ln", insert: "ln(", cls: "is-fn" },
	{ label: "log", insert: "log(", cls: "is-fn" },
	{ label: "xʸ", insert: "^", cls: "is-fn" },
	{ label: "π", insert: "pi", cls: "is-fn" },
	{ label: "e", insert: "e", cls: "is-fn" },
	{ label: "!", insert: "!", cls: "is-fn" },
	{ label: "%", insert: "%", cls: "is-fn" },
	{ label: "mod", insert: " mod ", cls: "is-fn" },
];


/** A free-text calculator: arithmetic, unit/currency conversions and
 * plain-language queries (à la Wolfram Alpha's input box), evaluated live as
 * you type. The on-screen keypad tier is chosen in card settings. */
export function renderCalculator(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = (card.calculator ??= {});
	const angleUnit = cfg.angleUnit ?? "deg";

	const wrap = body.createDiv("hearth-calc");

	const input = wrap.createEl("input", {
		cls: "hearth-calc-input",
		attr: {
			type: "text",
			placeholder: t().cards.calculator.placeholder,
			spellcheck: "false",
			"aria-label": t().cards.calculator.placeholder,
		},
	});
	input.value = cfg.lastInput ?? "";

	const resultEl = wrap.createDiv("hearth-calc-result");
	const noteEl = wrap.createDiv("hearth-calc-note");
	const keysEl = wrap.createDiv("hearth-calc-keys");

	// Currency conversions need exchange rates. To stay local-first, rates are
	// only fetched lazily — the first time a query actually needs them (see the
	// error branch in update) — never just because a calculator card exists.
	const currentRates = () => cachedRates()?.rates;
	let triedRates = false;

	const persist = debounce(
		() => void view.plugin.saveData(view.plugin.settings),
		600,
		true,
	);

	// Show the live result of the current input.
	const update = () => {
		const raw = input.value;
		cfg.lastInput = raw;
		if (!raw.trim()) {
			resultEl.setText("");
			resultEl.removeClass("is-error");
			noteEl.setText("");
			persist();
			return;
		}
		const res = evaluateCalc(raw, { angleUnit, rates: currentRates() });
		if (res.ok) {
			resultEl.removeClass("is-error");
			resultEl.setText(res.formatted);
			noteEl.setText(res.note ?? "");
		} else {
			resultEl.addClass("is-error");
			resultEl.setText(res.error ? "…" : "");
			// Surface a currency/rates hint (but not routine "still typing" errors).
			noteEl.setText(/rate|currency/i.test(res.error) ? res.error : "");
			// A currency query needs rates we don't have yet — fetch them once,
			// then re-evaluate so the answer fills in without a manual retry.
			// Skipped entirely when external calls are disabled.
			if (
				!triedRates &&
				!view.plugin.settings.disableExternalCalls &&
				/rate/i.test(res.error) &&
				!currentRates()
			) {
				triedRates = true;
				void loadRates().then((rates) => {
					if (rates) update();
				});
			}
		}
		persist();
	};

	// Enter / "=" just re-evaluates and selects the input so the next query
	// overwrites it (results are already shown live as you type).
	const commit = () => {
		update();
		input.select();
	};

	// The caret, treating a not-yet-focused input as "at the end" — an unfocused
	// text input reports selectionStart 0, not null, so keys would otherwise
	// insert at the start on the first tap after a render with restored text.
	const caret = (): [number, number] => {
		if (activeDocument.activeElement !== input) return [input.value.length, input.value.length];
		return [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
	};

	// Splice text in at the caret (or over the selection) and re-evaluate.
	const insertAtCaret = (text: string) => {
		const [start, end] = caret();
		input.value = input.value.slice(0, start) + text + input.value.slice(end);
		const pos = start + text.length;
		input.setSelectionRange(pos, pos);
		input.focus();
		update();
	};

	const backspace = () => {
		const [start, end] = caret();
		if (start !== end) {
			input.value = input.value.slice(0, start) + input.value.slice(end);
			input.setSelectionRange(start, start);
		} else if (start > 0) {
			input.value = input.value.slice(0, start - 1) + input.value.slice(start);
			input.setSelectionRange(start - 1, start - 1);
		}
		input.focus();
		update();
	};

	const renderKeys = () => {
		keysEl.empty();
		const tier = cfg.keypad ?? "none";
		keysEl.toggleClass("is-hidden", tier === "none");
		if (tier === "none") return;
		const keys = tier === "scientific" ? [...CALC_SCI_KEYS, ...CALC_BASIC_KEYS] : CALC_BASIC_KEYS;
		for (const key of keys) {
			const btn = keysEl.createEl("button", {
				cls: `hearth-calc-key${key.cls ? " " + key.cls : ""}`,
				text: key.label,
				attr: { type: "button" },
			});
			btn.addEventListener("click", () => {
				if (key.action === "equals") commit();
				else if (key.action === "clear") {
					input.value = "";
					input.focus();
					update();
				} else if (key.action === "back") backspace();
				else if (key.insert !== undefined) insertAtCaret(key.insert);
			});
		}
	};

	input.addEventListener("input", update);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			commit();
		}
	});
	// Keep the board's drag/keyboard handlers from stealing typing.
	input.addEventListener("keydown", (e) => e.stopPropagation());

	renderKeys();
	update();
}


export function calculatorEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.calculator ??= {});
	new Setting(containerEl)
		.setName(t().editors.calculator.angleUnit)
		.setDesc(t().editors.calculator.angleUnitDesc)
		.addDropdown((d) => {
			d.addOption("deg", t().editors.calculator.degrees);
			d.addOption("rad", t().editors.calculator.radians);
			d.setValue(cfg.angleUnit ?? "deg").onChange((v) => {
				cfg.angleUnit = v === "rad" ? "rad" : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(t().editors.calculator.keypad)
		.setDesc(t().editors.calculator.keypadDesc)
		.addDropdown((d) => {
			d.addOption("none", t().editors.calculator.keypadNone);
			d.addOption("basic", t().editors.calculator.keypadBasic);
			d.addOption("scientific", t().editors.calculator.keypadScientific);
			d.setValue(cfg.keypad ?? "none").onChange((v) => {
				cfg.keypad = v === "none" ? undefined : (v as "basic" | "scientific");
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
}

/** A calculator with history and unit/currency conversion. */
export const calculatorCard: CardDefinition<"calculator"> = {
	kind: "calculator",
	templates: [
		{ id: "calculator", name: "Calculator", icon: "calculator", build: () => ({ kind: "calculator", title: "Calculator", calculator: {}, w: 4, h: 3 }) },
	],
	render: (view, card, body) => renderCalculator(view, card, body),
	renderEditor: (container, ctx) => calculatorEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.calculator) copy.calculator = { ...source.calculator };
	},
	liveness: { mode: "static" },
};
