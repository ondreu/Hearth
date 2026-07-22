import { Notice, Setting } from "obsidian";
import { t } from "../i18n";
import { clearJiraCache, JIRA_CONTROLS, listJiraFilters, renderJiraCard } from "../jira";
import { type JiraControl } from "../types";
import { type CardDefinition, type CardEditorContext } from "./definition";


export function jiraEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.jira ??= {});
	const strings = t().editors.jira;

	new Setting(containerEl)
		.setName(strings.host)
		.setDesc(strings.hostDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.hostPlaceholder)
				.setValue(cfg.host ?? "")
				.onChange((value) => {
					const next = value.trim() || undefined;
					if (next !== cfg.host) clearJiraCache(cfg);
					cfg.host = next;
					ctx.opts.save();
				}),
		);

	new Setting(containerEl)
		.setName(strings.pat)
		.setDesc(strings.patDesc)
		.addText((txt) => {
			txt.setValue(cfg.pat ?? "").onChange((value) => {
				// SECURITY-REVIEW: PAT remains in the password control and per-card
				// plugin data; it is never displayed elsewhere or logged.
				const next = value || undefined;
				if (next !== cfg.pat) clearJiraCache(cfg);
				cfg.pat = next;
				ctx.opts.save();
			});
			txt.inputEl.type = "password";
			txt.inputEl.autocomplete = "off";
		});

	new Setting(containerEl)
		.setName(strings.apiBase)
		.setDesc(strings.apiBaseDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.apiBasePlaceholder)
				.setValue(cfg.apiBasePath ?? "/rest/api/latest")
				.onChange((value) => {
					const next = value.trim() || undefined;
					if (next !== cfg.apiBasePath) clearJiraCache(cfg);
					cfg.apiBasePath = next;
					ctx.opts.save();
				}),
		);

	const filterSetting = new Setting(containerEl)
		.setName(strings.savedFilter)
		.setDesc(
			ctx.opts.externalCallsDisabled
				? strings.externalCallsDisabled
				: cfg.filterName
				? strings.selectedFilter(cfg.filterName)
				: strings.savedFilterDesc,
		);
	let filterSelect: HTMLSelectElement | null = null;
	filterSetting.addButton((button) =>
		button
			.setButtonText(strings.loadFilters)
			.setDisabled(ctx.opts.externalCallsDisabled)
			.onClick(async () => {
				if (ctx.opts.externalCallsDisabled) return;
				const version = ((ctx.session.jiraLoadVersion as number) ?? 0) + 1;
					ctx.session.jiraLoadVersion = version;
				button.setDisabled(true);
				filterSelect?.remove();
				filterSelect = null;
				try {
					const filters = await listJiraFilters(cfg);
					if (
						version !== ctx.session.jiraLoadVersion ||
						!filterSetting.settingEl.isConnected
					) {
						return;
					}
					if (!filters.length) {
						new Notice(strings.noFavoriteFilters);
						return;
					}
					filterSetting.addDropdown((dropdown) => {
						filterSelect = dropdown.selectEl;
						dropdown.addOption("", strings.chooseFilter);
						for (const filter of filters) {
							dropdown.addOption(filter.id, filter.name);
						}
						dropdown.setValue(cfg.filterId ?? "").onChange((id) => {
							const selected = filters.find((filter) => filter.id === id);
							cfg.filterId = selected?.id;
							cfg.filterName = selected?.name;
							cfg.selections = {};
							ctx.opts.save();
							ctx.opts.rerender();
							ctx.requestRender();
						});
					});
				} catch {
					if (
						version === ctx.session.jiraLoadVersion &&
						filterSetting.settingEl.isConnected
					) {
						new Notice(strings.loadFailed);
					}
				} finally {
					if (
						version === ctx.session.jiraLoadVersion &&
						filterSetting.settingEl.isConnected
					) {
						button.setDisabled(false);
					}
				}
			}),
	);

	new Setting(containerEl).setName(strings.controls).setHeading();
	const enabled = new Set<JiraControl>(cfg.controls ?? JIRA_CONTROLS);
	for (const control of JIRA_CONTROLS) {
		new Setting(containerEl)
			.setName(t().cards.jira.controls[control])
			.addToggle((toggle) =>
				toggle.setValue(enabled.has(control)).onChange((value) => {
					if (value) enabled.add(control);
					else enabled.delete(control);
					cfg.controls = JIRA_CONTROLS.filter((item) => enabled.has(item));
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	const maxResults = new Setting(containerEl)
		.setName(strings.maxResults)
		.setDesc(strings.maxResultsDesc);
	maxResults.addText((txt) => {
		txt.setValue(String(cfg.maxResults ?? 50)).onChange((value) => {
			const parsed = parseInt(value, 10);
			cfg.maxResults =
				Number.isNaN(parsed) || parsed <= 0
					? undefined
					: Math.min(200, parsed);
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.min = "1";
		txt.inputEl.max = "200";
		txt.inputEl.addClass("hearth-count-input");
	});

	const numberSetting = (
		name: string,
		description: string,
		value: number,
		update: (next: number | undefined) => void,
	): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((txt) => {
				txt.setValue(String(value)).onChange((raw) => {
					const parsed = parseInt(raw, 10);
					update(Number.isNaN(parsed) || parsed < 0 ? undefined : parsed);
					ctx.opts.save();
				});
				txt.inputEl.type = "number";
				txt.inputEl.min = "0";
				txt.inputEl.addClass("hearth-count-input");
			});
	};
	numberSetting(
		strings.refresh,
		strings.refreshDesc,
		cfg.refreshMin ?? 0,
		(value) => {
			cfg.refreshMin = value;
		},
	);
	numberSetting(strings.cache, strings.cacheDesc, cfg.cacheMin ?? 5, (value) => {
		cfg.cacheMin = value;
	});
}

/** A Jira saved-filter card showing matching issues, with refinement controls. */
export const jiraCard: CardDefinition<"jira"> = {
	kind: "jira",
	templates: [
		{
			id: "jira",
			name: "Jira filter",
			icon: "ticket",
			build: () => ({
				kind: "jira",
				title: "Jira",
				jira: {
					apiBasePath: "/rest/api/latest",
					controls: ["status", "assignee", "priority", "issueType", "sprint", "fixVersion"],
					maxResults: 50,
					refreshMin: 0,
					cacheMin: 5,
				},
				w: 6,
				h: 5,
			}),
		},
	],
	render: (view, card, body, component) => renderJiraCard(view, card, body, component),
	renderEditor: (container, ctx) => jiraEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.jira)
			copy.jira = {
				...source.jira,
				controls: source.jira.controls ? [...source.jira.controls] : undefined,
				selections: source.jira.selections
					? Object.fromEntries(
							Object.entries(source.jira.selections).map(([key, values]) => [
								key,
								values ? [...values] : values,
							]),
						)
					: undefined,
			};
	},
	liveness: { mode: "static" },
};
