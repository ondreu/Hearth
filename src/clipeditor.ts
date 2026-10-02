/**
 * The note template editor — one for every card that saves things as notes
 * (the calendars' event notes, the RSS card's saved entries).
 *
 * It reads the way the note will: name and folder, then the properties as
 * rows of name, value and type, then the body. Nothing has to be known by
 * heart. Under the fields sit the variables this kind offers — click one and
 * it goes in where the cursor was — and the filters, each with what it does,
 * and at the bottom a preview of the note the template makes right now,
 * filled from a real item when the card has one to hand.
 */
import { debounce, Notice, Setting } from "obsidian";
import {
	buildClipNote,
	CLIP_FILTERS,
	CLIP_PROPERTY_TYPES,
	previewClipNote,
	type ClipDefaults,
	type ClipProperty,
	type ClipPropertyType,
	type ClipTemplate,
	type ClipVars,
} from "./clip";
import { type CardEditorContext } from "./cards/definition";
import { moveItem } from "./editors";
import { t } from "./i18n";
import { FilePickerModal, FolderPickerModal } from "./pickers";

/** What differs between the kinds that save notes. */
export interface ClipEditorSpec {
	/** The section's heading and the line under it. */
	heading: string;
	desc: string;
	/** The on/off toggle's name and description. */
	enabledName: string;
	enabledDesc: string;
	defaults: ClipDefaults;
	/** The variables this kind fills, in the order they are listed. */
	variables: readonly string[];
	/** Something to fill the preview from: a real item when there is one. */
	sample(): { label: string | null; vars: ClipVars; linkValue?: string };
}

/** Draw the editor for `cfg` into `containerEl`. */
export function clipTemplateEditor(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	cfg: ClipTemplate,
	spec: ClipEditorSpec,
): void {
	const s = t().editors.clip;

	new Setting(containerEl).setName(spec.heading).setHeading();
	new Setting(containerEl).setDesc(spec.desc);

	new Setting(containerEl)
		.setName(spec.enabledName)
		.setDesc(spec.enabledDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.enabled !== false).onChange((v) => {
				cfg.enabled = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (cfg.enabled === false) return;

	const wrap = containerEl.createDiv("hearth-clip-editor");

	// The field a clicked variable goes into: the last one that had focus.
	let target: HTMLInputElement | HTMLTextAreaElement | null = null;
	const track = (el: HTMLInputElement | HTMLTextAreaElement): void => {
		el.addEventListener("focus", () => (target = el));
	};

	let refreshPreview = (): void => {};
	const changed = (): void => {
		ctx.opts.save();
		refreshPreview();
	};

	new Setting(wrap)
		.setName(s.name)
		.setDesc(s.nameDesc)
		.addText((txt) => {
			txt.setPlaceholder(spec.defaults.name)
				.setValue(cfg.name ?? spec.defaults.name)
				.onChange((v) => {
					cfg.name = v === spec.defaults.name ? undefined : v;
					changed();
				});
			txt.inputEl.addClass("hearth-clip-input");
			track(txt.inputEl);
		});

	const folder = new Setting(wrap).setName(s.folder).setDesc(s.folderDesc);
	folder.addText((txt) => {
		txt.setPlaceholder(s.folderPlaceholder)
			.setValue(cfg.folder ?? spec.defaults.folder)
			.onChange((v) => {
				const value = v.trim();
				cfg.folder = value === spec.defaults.folder ? undefined : value;
				changed();
			});
		txt.inputEl.addClass("hearth-clip-input");
		track(txt.inputEl);
	});
	folder.addExtraButton((b) =>
		b
			.setIcon("folder-search")
			.setTooltip(s.pickFolder)
			.onClick(() => {
				new FolderPickerModal(ctx.app, (picked) => {
					cfg.folder = picked.path === "/" ? "" : picked.path;
					ctx.opts.save();
					ctx.requestRender();
				}).open();
			}),
	);

	// ---- Properties ----
	const props = new Setting(wrap).setName(s.properties).setDesc(s.propertiesDesc).setHeading();
	if (cfg.properties !== undefined) {
		props.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(s.resetProperties)
				.onClick(() => {
					cfg.properties = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}
	const shown = cfg.properties ?? spec.defaults.properties;
	/** The card's own list, made from the defaults the first time one of
	 * them is edited. */
	const own = (): ClipProperty[] => (cfg.properties ??= spec.defaults.properties.map((p) => ({ ...p })));

	shown.forEach((prop, index) => {
		const row = new Setting(wrap).setClass("hearth-clip-prop");
		row.addText((txt) => {
			txt.setPlaceholder(s.propertyName)
				.setValue(prop.name)
				.onChange((v) => {
					own()[index].name = v;
					changed();
				});
			txt.inputEl.addClass("hearth-clip-prop-name");
		});
		row.addText((txt) => {
			txt.setPlaceholder(s.propertyValue)
				.setValue(prop.value)
				.onChange((v) => {
					own()[index].value = v;
					changed();
				});
			txt.inputEl.addClass("hearth-clip-prop-value");
			track(txt.inputEl);
		});
		row.addDropdown((d) => {
			for (const type of CLIP_PROPERTY_TYPES) d.addOption(type, s.types[type]);
			d.setValue(prop.type ?? "text").onChange((v) => {
				own()[index].type = v === "text" ? undefined : (v as ClipPropertyType);
				changed();
			});
		});
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, own(), index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === shown.length - 1)
				.onClick(() => moveItem(ctx, own(), index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(s.removeProperty)
				.onClick(() => {
					own().splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});
	new Setting(wrap).addButton((b) =>
		b.setButtonText(s.addProperty).onClick(() => {
			own().push({ name: "", value: "" });
			ctx.opts.save();
			ctx.requestRender();
		}),
	);

	// ---- Body ----
	const body = new Setting(wrap).setName(s.body).setDesc(s.bodyDesc).setClass("hearth-clip-body");
	if (cfg.body !== undefined) {
		body.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(s.resetBody)
				.onClick(() => {
					cfg.body = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}
	body.addTextArea((ta) => {
		ta.setValue(cfg.body ?? spec.defaults.body).onChange((v) => {
			cfg.body = v === spec.defaults.body ? undefined : v;
			changed();
		});
		ta.inputEl.rows = 6;
		ta.inputEl.addClass("hearth-clip-textarea");
		track(ta.inputEl);
	});

	const template = new Setting(wrap).setName(s.template).setDesc(s.templateDesc);
	template.addText((txt) => {
		txt.setValue(cfg.template ?? "").onChange((v) => {
			cfg.template = v.trim() || undefined;
			ctx.opts.save();
		});
		txt.inputEl.addClass("hearth-clip-input");
	});
	template.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(s.pickTemplate)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					cfg.template = file.path;
					ctx.opts.save();
					ctx.requestRender();
				}, undefined, (file) => file.extension === "md").open();
			}),
	);
	if (cfg.template) {
		template.addExtraButton((b) =>
			b
				.setIcon("x")
				.setTooltip(s.clearTemplate)
				.onClick(() => {
					cfg.template = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}

	new Setting(wrap)
		.setName(s.linkKey)
		.setDesc(s.linkKeyDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(spec.defaults.linkKey)
				.setValue(cfg.linkKey ?? spec.defaults.linkKey)
				.onChange((v) => {
					const value = v.trim();
					cfg.linkKey = value === spec.defaults.linkKey ? undefined : value;
					ctx.opts.save();
				}),
		);

	// ---- Reference ----
	const insert = (text: string): void => {
		const el = target;
		if (el && el.isConnected) {
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? start;
			el.setRangeText(text, start, end, "end");
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.focus();
			return;
		}
		void navigator.clipboard.writeText(text).then(() => new Notice(s.copied(text)));
	};

	const ref = wrap.createDiv("hearth-clip-ref");
	ref.createDiv({ cls: "hearth-clip-ref-head", text: s.variables });
	ref.createDiv({ cls: "hearth-clip-ref-hint", text: s.variablesHint });
	const vars = ref.createDiv("hearth-clip-vars");
	for (const name of spec.variables) {
		const chip = vars.createEl("button", { cls: "hearth-clip-chip", attr: { type: "button" } });
		chip.createSpan({ cls: "hearth-clip-chip-code", text: `{{${name}}}` });
		chip.createSpan({ cls: "hearth-clip-chip-desc", text: s.vars[name as keyof typeof s.vars] ?? "" });
		// Keep the field's focus and selection: insert where the cursor is.
		chip.addEventListener("mousedown", (e) => e.preventDefault());
		chip.addEventListener("click", () => insert(`{{${name}}}`));
	}

	const filters = ref.createEl("details", { cls: "hearth-clip-filters" });
	filters.createEl("summary", { text: s.filters });
	filters.createDiv({ cls: "hearth-clip-ref-hint", text: s.filtersHint });
	const list = filters.createDiv("hearth-clip-filterlist");
	for (const name of CLIP_FILTERS) {
		const doc = s.filterDocs[name];
		const row = list.createDiv("hearth-clip-filter");
		row.createEl("code", { text: doc.syntax });
		row.createSpan({ text: doc.desc });
	}

	// ---- Preview ----
	const preview = wrap.createDiv("hearth-clip-preview");
	const head = preview.createDiv("hearth-clip-ref-head");
	const where = preview.createDiv("hearth-clip-ref-hint");
	const pathEl = preview.createDiv("hearth-clip-preview-path");
	const out = preview.createEl("pre", { cls: "hearth-clip-preview-text" });
	head.setText(s.preview);
	const draw = (): void => {
		const sample = spec.sample();
		where.setText(sample.label ? s.previewOf(sample.label) : s.previewSample);
		const built = buildClipNote(cfg, spec.defaults, sample.vars, { linkValue: sample.linkValue });
		pathEl.setText(`${built.folder ? `${built.folder}/` : ""}${built.filename}.md`);
		const text = previewClipNote(built);
		out.setText(cfg.template ? `${s.previewTemplate(cfg.template)}\n${text}` : text);
	};
	refreshPreview = debounce(draw, 150, true);
	draw();
}
