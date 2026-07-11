import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";

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

/** Trigger a download of `content` as a file named `filename`. Uses a transient
 * object URL and a synthesized anchor click — the standard, dependency-free way
 * to save a generated file from a plugin. */
export function downloadTextFile(filename: string, content: string, mime = "application/json"): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = activeDocument.createElement("a");
	a.href = url;
	a.download = filename;
	a.style.display = "none";
	activeDocument.body.appendChild(a);
	a.click();
	a.remove();
	// Revoke on the next tick so the download has had a chance to start.
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Open the OS file picker for a single file and resolve with its text content,
 * or null if the user cancelled or the file couldn't be read. */
export function pickTextFile(accept = "application/json,.json"): Promise<string | null> {
	return new Promise((resolve) => {
		const input = activeDocument.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.style.display = "none";
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
		activeDocument.body.appendChild(input);
		input.click();
	});
}
