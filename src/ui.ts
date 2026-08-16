import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";

/**
 * Write `text` into `el` with the character ranges in `matches` wrapped in
 * `<mark>`. Ranges must be sorted and non-overlapping (see `highlightRanges`).
 * Shared by every search surface so a result name and a body excerpt pick out
 * the match the same way.
 */
export function renderHighlighted(
	el: HTMLElement,
	text: string,
	matches?: readonly [number, number][],
): void {
	if (!matches || matches.length === 0) {
		el.setText(text);
		return;
	}
	let cursor = 0;
	for (const [start, end] of matches) {
		if (start >= text.length) break;
		if (start > cursor) el.appendText(text.slice(cursor, start));
		el.createEl("mark", { cls: "hearth-result-mark", text: text.slice(start, end) });
		cursor = Math.min(end, text.length);
	}
	if (cursor < text.length) el.appendText(text.slice(cursor));
}

/**
 * Make a non-button element behave like a button for keyboard and screen-reader
 * users: it gets a role, becomes focusable, and activates on Enter/Space in
 * addition to the click handler the caller wires up separately.
 */
export function makeClickable(el: HTMLElement, onActivate: () => void, label?: string): void {
	el.setAttribute("role", "button");
	el.setAttribute("tabindex", "0");
	if (label) el.setAttribute("aria-label", label);
	el.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onActivate();
		}
	});
}

/** A minimal yes/no confirmation dialog used before destructive actions. */
export class ConfirmModal extends Modal {
	private message: string;
	private confirmText: string;
	private onConfirm: () => void;

	constructor(
		app: App,
		opts: { title: string; message: string; confirmText?: string; onConfirm: () => void },
	) {
		super(app);
		this.titleEl.setText(opts.title);
		this.message = opts.message;
		this.confirmText = opts.confirmText ?? t().confirm.confirm;
		this.onConfirm = opts.onConfirm;
	}

	onOpen(): void {
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((b) => {
			// setWarning() is deprecated in favour of setDestructive(), but that
			// API is @since 1.13.0 and our declared minAppVersion is 1.8.7, so we
			// keep setWarning() to stay within the supported API surface.
			b.setButtonText(this.confirmText)
				.setWarning()
				.onClick(() => {
					this.close();
					this.onConfirm();
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Convenience: open a confirm dialog. */
export function confirmAction(
	app: App,
	opts: { title: string; message: string; confirmText?: string; onConfirm: () => void },
): void {
	new ConfirmModal(app, opts).open();
}

/**
 * A one-field text dialog: a label, an input, Cancel and OK.
 *
 * Used where a click needs one more piece of information before it can do
 * anything — the Templater card's `{{prompt}}` filename token. Resolves with
 * the typed text, or `null` when the user cancelled, so "" (an empty answer the
 * user did confirm) stays distinguishable from "never mind".
 */
export class PromptModal extends Modal {
	private label: string;
	private initial: string;
	private placeholder: string;
	private onDone: (value: string | null) => void;
	/** Set once the user commits, so onClose knows not to report a cancel. */
	private settled = false;

	constructor(
		app: App,
		opts: {
			title: string;
			label: string;
			initial?: string;
			placeholder?: string;
			onDone: (value: string | null) => void;
		},
	) {
		super(app);
		this.titleEl.setText(opts.title);
		this.label = opts.label;
		this.initial = opts.initial ?? "";
		this.placeholder = opts.placeholder ?? "";
		this.onDone = opts.onDone;
	}

	onOpen(): void {
		let value = this.initial;
		const submit = (): void => {
			this.settled = true;
			this.close();
			this.onDone(value);
		};
		const field = new Setting(this.contentEl).setName(this.label).addText((txt) => {
			txt
				.setPlaceholder(this.placeholder)
				.setValue(value)
				.onChange((v) => {
					value = v;
				});
			// Enter is how anyone types a name into a one-field dialog; without
			// this it would submit nothing and close.
			txt.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key !== "Enter") return;
				e.preventDefault();
				submit();
			});
			window.setTimeout(() => {
				txt.inputEl.focus();
				txt.inputEl.select();
			}, 0);
		});
		field.settingEl.addClass("hearth-prompt-field");

		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t().confirm.ok).setCta().onClick(submit));
	}

	onClose(): void {
		this.contentEl.empty();
		// Dismissing the modal any other way (Escape, the backdrop, Cancel) is a
		// cancel, and the caller must hear about it exactly once.
		if (!this.settled) {
			this.settled = true;
			this.onDone(null);
		}
	}
}

/** Convenience: open a one-field prompt and await the answer (null = cancelled). */
export function promptForText(
	app: App,
	opts: { title: string; label: string; initial?: string; placeholder?: string },
): Promise<string | null> {
	return new Promise((resolve) => {
		new PromptModal(app, { ...opts, onDone: resolve }).open();
	});
}

/** Trigger a download of `content` as a file named `filename`. Uses a transient
 * object URL and a synthesized anchor click — the standard, dependency-free way
 * to save a generated file from a plugin. */
export function downloadTextFile(filename: string, content: string, mime = "application/json"): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = activeDocument.body.createEl("a", { attr: { href: url, download: filename } });
	a.hide();
	a.click();
	a.remove();
	// Revoke on the next tick so the download has had a chance to start.
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Open the OS file picker for a single file and resolve with its text content,
 * or null if the user cancelled or the file couldn't be read. */
export function pickTextFile(accept = "application/json,.json"): Promise<string | null> {
	return new Promise((resolve) => {
		const input = activeDocument.body.createEl("input");
		input.type = "file";
		input.accept = accept;
		input.hide();
		let settled = false;
		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			input.remove();
			resolve(value);
		};
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) return finish(null);
			file.text().then((text) => finish(text)).catch(() => finish(null));
		});
		// Fires when the dialog is dismissed without choosing a file.
		input.addEventListener("cancel", () => finish(null));
		input.click();
	});
}
