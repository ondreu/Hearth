import { type App, type Component, Setting } from "obsidian";
import { cardOverlayButton, emptyState } from "../cardbodies";
import { t } from "../i18n";
import { setIcon } from "../glyphs";
import {
	TASKCHUTE_PLUGIN_ID,
	type TaskChuteActivityDay,
	type TaskChuteInstance,
	formatTaskChuteDuration,
	formatTaskChuteDay,
	formatTaskChuteMinutes,
	isTaskChuteAvailable,
	openTaskChute,
	taskChuteActivity,
	taskChuteElapsed,
	taskChuteProgress,
	taskChuteRange,
	taskChuteReorder,
	taskChuteRows,
	taskChuteSectionLabel,
	taskChuteSections,
	taskChuteDay,
	taskChuteSession,
	setTaskChuteDay,
	shiftTaskChuteDay,
	taskChuteTitle,
	type TaskChuteView as TaskChuteLiveView,
} from "../taskchute";
import { type DashboardCard, type TaskChuteConfig } from "../types";
import { confirmAction } from "../ui";
import { hearthMenu, HearthModal } from "../uidesign";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- TaskChute -----------------------------------------------------------
//
// A native card, not a hosted view: the list, the overview and the heatmap are
// drawn by Hearth in its own markup, sized for a dashboard tile. The data comes
// from TaskChute itself — the live view model for the task list (so starting and
// stopping a task goes through the plugin's timer, log, heatmap and reminders)
// and its monthly snapshot for the two read-only views. See `../taskchute.ts`.
//
// The task list is the interactive one: it can add a task, start and stop one,
// reorder it, move it to another day, duplicate it and delete it — all through
// the plugin's own services, so its day state, notes and log stay in charge.

export type TaskChuteViewKind = NonNullable<TaskChuteConfig["view"]>;

type Strings = ReturnType<typeof t>["cards"]["taskchute"];

/** Which of the three views a card shows. Unknown values fall back to the task
 * list, which is what a card saved by a newer Hearth would have meant. */
export function taskChuteCardView(cfg: TaskChuteConfig): TaskChuteViewKind {
	const view = cfg.view;
	return view === "overview" || view === "heatmap" ? view : "tasks";
}

/** Days of history the heatmap draws. */
export const TASKCHUTE_HEATMAP_DAYS = 119;
/** Days the overview's bar list covers (today included). */
export const TASKCHUTE_OVERVIEW_DAYS = 7;

/** Draw the card. */
export function renderTaskChute(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const strings = t().cards.taskchute;
	if (!isTaskChuteAvailable(view.app)) {
		emptyState(body, "timer", t().cards.empty.taskChuteInstall);
		return;
	}

	const cfg = (card.taskchute ??= {});
	const kind = taskChuteCardView(cfg);
	cardOverlayButton(body, "maximize-2", strings.open, (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void openTaskChute(view.app);
	});
	if (kind === "overview" || kind === "heatmap") {
		const root = body.createDiv("hearth-taskchute");
		root.addClass(`is-${kind}`);
		void paintRecords(view.app, root, kind);
		return;
	}

	const root = body.createDiv("hearth-taskchute");
	void paintTasks(view.app, root, component, strings);
}


// ---- Task list -----------------------------------------------------------

function paintTasks(app: App, root: HTMLElement, component: Component, strings: Strings): void {
	root.createDiv({ cls: "hearth-tc-loading", text: strings.loading });
	void (async () => {
		const session = await taskChuteSession(app);
		if (!root.isConnected) return;
		// `onOpen` loads the day asynchronously; on a cold start the model can be
		// empty for a moment. One short retry keeps a real day from looking empty
		// until the 15 s tick, without polling a healthy session.
		if (session && session.taskInstances.length === 0) {
			await new Promise((resolve) => window.setTimeout(resolve, 600));
			if (!root.isConnected) return;
		}
		root.empty();
		if (!session) {
			emptyState(root, "alert-triangle", t().cards.empty.taskChuteUnsupported);
			return;
		}
		const repaint = () => {
			if (root.isConnected) paintList(app, session, root, strings);
		};
		repaint();
		// The list is a live view of the plugin's model: a task started from the
		// full TaskChute tab, or stopped by its own timer, has to re-read it.
		component.registerInterval(window.setInterval(repaint, 15_000));
		// The running task's clock ticks every second by rewriting that one text
		// node — no redraw, no board refresh. The dashboard may be idle for
		// hours and the timer still has to count.
		component.registerInterval(
			window.setInterval(() => {
				if (!root.isConnected) return;
				for (const el of Array.from(root.querySelectorAll<HTMLElement>(".hearth-tc-elapsed"))) {
					const id = el.dataset.instanceId;
					const inst = session.taskInstances.find((candidate) => candidate.instanceId === id);
					if (inst) el.setText(formatTaskChuteDuration(taskChuteElapsed(inst)));
				}
			}, 1_000),
		);
	})();
}

function paintList(app: App, session: TaskChuteLiveView, root: HTMLElement, strings: Strings): void {
	const rows = taskChuteRows(session.taskInstances);
	const progress = taskChuteProgress(session.taskInstances);
	root.empty();

	const repaint = () => {
		if (root.isConnected) paintList(app, session, root, strings);
	};

	const header = root.createDiv("hearth-tc-header");
	dayNav(header, app, strings, repaint);
	header.createSpan({ cls: "hearth-tc-progress", text: strings.progress(progress.done, progress.total) });
	addTaskButton(header, session, strings);

	if (rows.length === 0) {
		emptyState(root, "list-todo", strings.noTasks);
		return;
	}
	const list = root.createDiv("hearth-tc-list");
	for (const section of taskChuteSections(session.taskInstances, session.sectionConfig?.getSlotKeys?.() ?? [])) {
		const group = list.createDiv("hearth-tc-section");
		group.dataset.slot = section.key;
		group.createDiv({
			cls: "hearth-tc-section-label",
			text: taskChuteSectionLabel(section.key, strings.noTime),
		});
		if (section.rows.length === 0) {
			group.createDiv({ cls: "hearth-tc-dropzone", text: strings.dropHere });
		}
		for (const inst of section.rows) {
			row(group, inst, session, section.rows, app, repaint, strings);
		}
		dropTarget(group, session, section.key, repaint);
	}
	// A fade at the bottom only when the rows actually overflow, so a two-task
	// card doesn't look like it is hiding something.
	if (list.scrollHeight > list.clientHeight + 1) list.addClass("is-scrollable");
}

const DRAG_PREFIX = "hearth-taskchute:";

/** Turn a section into a drop target: dropping a row on it hands the task to
 * TaskChute's own `moveInstanceToSlot`, which persists the new section (its
 * schedule included) and re-sorts the day. */
function dropTarget(group: HTMLElement, session: TaskChuteLiveView, slot: string, repaint: () => void): void {
	group.addEventListener("dragover", (evt) => {
		if (!evt.dataTransfer?.types.includes("text/plain")) return;
		evt.preventDefault();
		evt.dataTransfer.dropEffect = "move";
		group.addClass("is-drop-target");
	});
	group.addEventListener("dragleave", (evt) => {
		if (!group.contains(evt.relatedTarget as Node | null)) group.removeClass("is-drop-target");
	});
	group.addEventListener("drop", (evt) => {
		evt.preventDefault();
		group.removeClass("is-drop-target");
		const raw = evt.dataTransfer?.getData("text/plain") ?? "";
		if (!raw.startsWith(DRAG_PREFIX)) return;
		const id = raw.slice(DRAG_PREFIX.length);
		const inst = session.taskInstances.find((candidate) => candidate.instanceId === id);
		const mutations = session.taskMutationService;
		if (!inst || !mutations || inst.slotKey === slot) return;
		void mutations.moveInstanceToSlot(inst, slot).then(repaint);
	});
}

/** `‹ Today ›`: the board shows one TaskChute day, and this moves it. The label
 * itself goes back to today, so a card left on next week is one click from
 * home. */
function dayNav(header: HTMLElement, app: App, strings: Strings, repaint: () => void): void {
	const nav = header.createDiv("hearth-tc-daynav");
	const step = async (days: number) => {
		if (await shiftTaskChuteDay(app, days)) repaint();
	};
	const prev = nav.createEl("button", { cls: "hearth-tc-navbtn" });
	prev.setAttribute("type", "button");
	prev.setAttribute("aria-label", strings.previousDay);
	setIcon(prev, "chevron-left");
	prev.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void step(-1);
	});

	const label = nav.createEl("button", {
		cls: "hearth-tc-day",
		text: formatTaskChuteDay(taskChuteDay(), strings.today),
	});
	label.setAttribute("type", "button");
	label.setAttribute("aria-label", strings.today);
	label.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void setTaskChuteDay(app, new Date()).then((moved) => {
			if (moved) repaint();
		});
	});

	const next = nav.createEl("button", { cls: "hearth-tc-navbtn" });
	next.setAttribute("type", "button");
	next.setAttribute("aria-label", strings.nextDay);
	setIcon(next, "chevron-right");
	next.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void step(1);
	});
}

/** The `+` in the card's header: TaskChute's own add-task dialog, so the new
 * task lands where its settings say and the plugin reloads itself afterwards. */
function addTaskButton(header: HTMLElement, session: TaskChuteLiveView, strings: Strings): void {
	const show = session.taskCreationController?.showAddTaskModal;
	if (typeof show !== "function") return;
	const button = header.createEl("button", { cls: "hearth-tc-add" });
	button.setAttribute("type", "button");
	button.setAttribute("aria-label", strings.addTask);
	setIcon(button, "plus");
	button.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		show.call(session.taskCreationController);
	});
}

function row(
	list: HTMLElement,
	inst: TaskChuteInstance,
	session: TaskChuteLiveView,
	rows: readonly TaskChuteInstance[],
	app: App,
	repaint: () => void,
	strings: Strings,
): void {
	const state = inst.state === "running" ? "running" : inst.state === "done" ? "done" : "idle";
	const button = list.createEl("button", { cls: "hearth-tc-row" });
	button.addClass(`is-${state}`);
	button.setAttribute("type", "button");
	button.draggable = true;
	button.addEventListener("dragstart", (evt) => {
		if (!evt.dataTransfer) return;
		evt.dataTransfer.setData("text/plain", `${DRAG_PREFIX}${inst.instanceId}`);
		evt.dataTransfer.effectAllowed = "move";
		button.addClass("is-dragging");
	});
	button.addEventListener("dragend", () => button.removeClass("is-dragging"));
	button.setAttribute("aria-label", state === "running" ? strings.stop : state === "idle" ? strings.start : strings.done);
	button.dataset.instanceId = inst.instanceId;

	const control = button.createSpan({ cls: "hearth-tc-control" });
	setIcon(control, state === "running" ? "square" : state === "done" ? "check" : "play");

	button.createSpan({ cls: "hearth-tc-title", text: taskChuteTitle(inst) });

	const meta = button.createSpan({ cls: "hearth-tc-meta" });
	if (state === "running") {
		const elapsed = meta.createSpan({ cls: "hearth-tc-elapsed" });
		elapsed.dataset.instanceId = inst.instanceId;
		elapsed.setText(formatTaskChuteDuration(taskChuteElapsed(inst)));
	} else {
		// TaskChute's own row shows when the task actually ran; a task that has
		// not says its scheduled time, and an unscheduled one says nothing —
		// the section header above already names its part of the day.
		meta.setText(taskChuteRange(inst) || inst.task?.scheduledTime?.trim() || "");
	}

	const more = button.createSpan({ cls: "hearth-tc-more" });
	setIcon(more, "more-horizontal");
	more.setAttribute("role", "button");
	more.setAttribute("tabindex", "0");
	more.setAttribute("aria-label", strings.more);

	const menu = (evt: MouseEvent | KeyboardEvent) => {
		evt.preventDefault();
		evt.stopPropagation();
		openRowMenu(button, evt, inst, session, rows, app, repaint, strings);
	};
	more.addEventListener("click", menu);
	more.addEventListener("keydown", (evt) => {
		if (evt.key === "Enter" || evt.key === " ") menu(evt);
	});
	button.addEventListener("contextmenu", menu);

	button.addEventListener("click", (evt) => {
		if ((evt.target as HTMLElement | null)?.closest(".hearth-tc-more")) return;
		evt.preventDefault();
		evt.stopPropagation();
		if (state === "idle") void session.startInstance(inst).then(repaint);
		else if (state === "running") void session.stopInstance(inst).then(repaint);
	});
}

/** Right-click / kebab menu for one task: the same operations the plugin's own
 * row menu offers, minus the ones that need its full editor (comments, AI runs,
 * recipes). Actions are shown only when the plugin exposes the service they
 * need, so an older TaskChute degrades to start/stop rather than a dead menu. */
function openRowMenu(
	anchor: HTMLElement,
	evt: MouseEvent | KeyboardEvent,
	inst: TaskChuteInstance,
	session: TaskChuteLiveView,
	rows: readonly TaskChuteInstance[],
	app: App,
	repaint: () => void,
	strings: Strings,
): void {
	const menu = hearthMenu();
	const running = inst.state === "running";
	menu.addItem((item) =>
		item
			.setTitle(running ? strings.stop : strings.start)
			.setIcon(running ? "square" : "play")
			.onClick(() => {
				void (running ? session.stopInstance(inst) : session.startInstance(inst)).then(repaint);
			}),
	);

	const index = rows.indexOf(inst);
	const canMove = typeof session.saveTaskOrders === "function";
	if (canMove) {
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(strings.moveUp)
				.setIcon("arrow-up")
				.setDisabled(index <= 0 || rows[index - 1]?.state !== inst.state)
				.onClick(() => {
					void moveRow(session, inst, -1, repaint);
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(strings.moveDown)
				.setIcon("arrow-down")
				.setDisabled(index < 0 || index >= rows.length - 1 || rows[index + 1]?.state !== inst.state)
				.onClick(() => {
					void moveRow(session, inst, 1, repaint);
				}),
		);
	}

	const time = session.taskTimeController;
	if (time && typeof time.showScheduledTimeEditModal === "function") {
		const controller = time;
		const showTime = (target: TaskChuteInstance) => controller.showScheduledTimeEditModal(target);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(strings.changeTime)
				.setIcon("clock")
				.onClick(() => {
					showTime(inst);
					// The plugin saves from its own dialog; a delayed repaint
					// catches the common case, the vault event the rest.
					window.setTimeout(repaint, 1_500);
				}),
		);
	}

	const schedule = session.taskScheduleController;
	if (schedule && typeof schedule.moveTaskToDate === "function") {
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(strings.moveToDate)
				.setIcon("calendar-days")
				.onClick(() => {
					new TaskChuteDateModal(app, inst, session, repaint).open();
				}),
		);
	}

	const mutations = session.taskMutationService;
	if (mutations && typeof mutations.duplicateInstance === "function") {
		menu.addItem((item) =>
			item
				.setTitle(strings.duplicate)
				.setIcon("copy")
				.onClick(() => {
					void mutations.duplicateInstance(inst).then(repaint);
				}),
		);
	}

	if (mutations && typeof mutations.deleteTask === "function") {
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(strings.delete)
				.setIcon("trash-2")
				.onClick(() => {
					confirmAction(app, {
						title: strings.deleteTitle,
						message: strings.deleteMessage(taskChuteTitle(inst)),
						confirmText: strings.delete,
						onConfirm: () => {
							void mutations.deleteTask(inst).then(repaint);
						},
					});
				}),
		);
	}

	if (evt instanceof MouseEvent) {
		menu.showAtMouseEvent(evt);
	} else {
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.right, y: rect.bottom });
	}
}

async function moveRow(
	session: TaskChuteLiveView,
	inst: TaskChuteInstance,
	direction: -1 | 1,
	repaint: () => void,
): Promise<void> {
	if (!taskChuteReorder(session.taskInstances, inst.instanceId, direction)) return;
	await session.saveTaskOrders?.();
	session.renderTaskList?.();
	repaint();
}

/** A small date dialog for "Move to date…". The plugin's own schedule dialog is
 * bigger than a card needs; this one only asks for the day and hands it to
 * `moveTaskToDate`, which does the actual work (running records, routines,
 * day state). */
class TaskChuteDateModal extends HearthModal {
	private value: string;

	constructor(
		app: App,
		private readonly inst: TaskChuteInstance,
		private readonly session: TaskChuteLiveView,
		private readonly done: () => void,
	) {
		super(app);
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		this.value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
	}

	onOpen(): void {
		const strings = t().cards.taskchute;
		this.titleEl.setText(strings.moveDateTitle);
		this.contentEl.createEl("p", {
			cls: "hearth-modal-intro",
			text: taskChuteTitle(this.inst),
		});
		new Setting(this.contentEl).setName(strings.moveDateLabel).addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.value).onChange((value) => {
				this.value = value;
			});
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(t().confirm.cancel).onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(strings.moveDateSave)
					.setCta()
					.onClick(() => {
						const controller = this.session.taskScheduleController;
						if (typeof controller?.moveTaskToDate === "function" && this.value) {
							void controller.moveTaskToDate(this.inst, this.value).then(this.done);
						}
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}


// ---- Overview and heatmap (pure reads of the plugin's snapshot) ----------

async function paintRecords(app: App, root: HTMLElement, kind: "overview" | "heatmap"): Promise<void> {
	const strings = t().cards.taskchute;
	root.empty();
	root.createDiv({ cls: "hearth-tc-loading", text: strings.loading });
	const days = kind === "heatmap" ? TASKCHUTE_HEATMAP_DAYS : TASKCHUTE_OVERVIEW_DAYS;
	const activity = await taskChuteActivity(app, days);
	if (!root.isConnected) return;
	root.empty();
	if (activity.every((day) => day.total === 0 && day.minutes === 0)) {
		emptyState(root, "flame", t().cards.empty.taskChuteNoData);
		return;
	}
	if (kind === "heatmap") paintHeatmap(root, activity, strings);
	else paintOverview(root, activity, strings);
}

function paintOverview(root: HTMLElement, activity: TaskChuteActivityDay[], strings: Strings): void {
	const today = activity[activity.length - 1];
	const week = activity.slice(-TASKCHUTE_OVERVIEW_DAYS);
	const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
	const weekDone = week.reduce((sum, day) => sum + day.done, 0);

	const stats = root.createDiv("hearth-tc-stats");
	stat(stats, strings.today, `${today.done}/${today.total}`);
	stat(stats, strings.minutesToday, formatTaskChuteMinutes(today.minutes));
	stat(stats, strings.weekDone, String(weekDone));
	stat(stats, strings.weekMinutes, formatTaskChuteMinutes(weekMinutes));

	const max = Math.max(1, ...week.map((day) => day.minutes));
	const bars = root.createDiv("hearth-tc-bars");
	for (const day of week) {
		const bar = bars.createDiv("hearth-tc-bar-row");
		bar.setAttribute("title", `${day.dayKey}: ${formatTaskChuteMinutes(day.minutes)} (${day.done}/${day.total})`);
		bar.createSpan({ cls: "hearth-tc-bar-label", text: dayLabel(day.dayKey, strings.today) });
		const track = bar.createDiv("hearth-tc-bar-track");
		const fill = track.createDiv("hearth-tc-bar-fill");
		fill.style.width = `${Math.round((day.minutes / max) * 100)}%`;
		bar.createSpan({ cls: "hearth-tc-bar-value", text: String(day.minutes) });
	}
}

function paintHeatmap(root: HTMLElement, activity: TaskChuteActivityDay[], strings: Strings): void {
	const header = root.createDiv("hearth-tc-header");
	header.createSpan({ cls: "hearth-tc-heading", text: strings.heatmapHeading });
	const total = activity.reduce((sum, day) => sum + day.minutes, 0);
	header.createSpan({ cls: "hearth-tc-progress", text: formatTaskChuteMinutes(total) });

	const max = Math.max(1, ...activity.map((day) => day.minutes));
	const grid = root.createDiv("hearth-tc-heatmap");
	// Pad the first column so the grid starts on Monday like a calendar.
	const lead = (new Date(`${activity[0].dayKey}T00:00:00`).getDay() + 6) % 7;
	for (let i = 0; i < lead; i += 1) grid.createDiv("hearth-tc-cell is-empty");
	for (const day of activity) {
		const cell = grid.createDiv("hearth-tc-cell");
		const level = day.minutes === 0 ? 0 : Math.max(1, Math.ceil((day.minutes / max) * 4));
		cell.addClass(`is-level-${level}`);
		cell.setAttribute("aria-label", `${day.dayKey}: ${formatTaskChuteMinutes(day.minutes)}`);
		cell.setAttribute("title", `${day.dayKey}: ${formatTaskChuteMinutes(day.minutes)}`);
	}

	// A key, so the shades mean something without hovering every cell.
	const legend = root.createDiv("hearth-tc-legend");
	legend.createSpan({ cls: "hearth-tc-legend-label", text: strings.legendLess });
	for (let level = 0; level <= 4; level += 1) {
		const swatch = legend.createDiv("hearth-tc-cell");
		if (level > 0) swatch.addClass(`is-level-${level}`);
	}
	legend.createSpan({ cls: "hearth-tc-legend-label", text: strings.legendMore });
}

/** `Mon 3` for a bar's day, and the localized word for today — `11-03` was a
 * ISO fragment nobody reads as a date. */
function dayLabel(dayKey: string, todayLabel: string): string {
	const date = new Date(`${dayKey}T00:00:00`);
	if (Number.isNaN(date.getTime())) return dayKey;
	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	if (isToday) return todayLabel;
	return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function stat(parent: HTMLElement, label: string, value: string): void {
	const item = parent.createDiv("hearth-tc-stat");
	item.createSpan({ cls: "hearth-tc-stat-value", text: value });
	item.createSpan({ cls: "hearth-tc-stat-label", text: label });
}


// ---- Definition ----------------------------------------------------------

/** The card's Content-tab settings. One dropdown, because the three views are
 * the same plugin's data drawn three ways — exactly the shape Operon's cards
 * use. */
export function taskChuteEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.taskchute;
	const cfg = (ctx.card.taskchute ??= {});
	if (!isTaskChuteAvailable(ctx.app)) {
		const note = new Setting(containerEl).setName(strings.missing).setDesc(strings.missingDesc);
		note.settingEl.addClass("hearth-setting-note");
	}
	new Setting(containerEl)
		.setName(strings.view)
		.setDesc(strings.viewDesc)
		.addDropdown((dropdown) => {
			dropdown.addOption("tasks", strings.viewTasks);
			dropdown.addOption("overview", strings.viewOverview);
			dropdown.addOption("heatmap", strings.viewHeatmap);
			dropdown.setValue(taskChuteCardView(ctx.card.taskchute ?? {})).onChange((value) => {
				cfg.view = value === "overview" || value === "heatmap" ? value : undefined;
				ctx.opts.save();
				ctx.requestRender();
				ctx.opts.rerender();
			});
		});
}

export const taskChuteCard: CardDefinition<"taskchute"> = {
	kind: "taskchute",
	templates: [
		{
			id: "taskchute",
			name: "TaskChute",
			icon: "timer",
			build: () => ({ kind: "taskchute", title: "TaskChute", taskchute: {}, w: 5, h: 7 }),
			requires: {
				name: "TaskChute Plus",
				pluginId: TASKCHUTE_PLUGIN_ID,
				satisfied: (app) => isTaskChuteAvailable(app),
			},
		},
		{
			id: "taskchute-overview",
			name: "TaskChute overview",
			icon: "bar-chart-3",
			build: () => ({
				kind: "taskchute",
				title: "TaskChute overview",
				taskchute: { view: "overview" },
				w: 4,
				h: 4,
			}),
			requires: {
				name: "TaskChute Plus",
				pluginId: TASKCHUTE_PLUGIN_ID,
				satisfied: (app) => isTaskChuteAvailable(app),
			},
		},
		{
			id: "taskchute-heatmap",
			name: "TaskChute heatmap",
			icon: "flame",
			build: () => ({
				kind: "taskchute",
				title: "TaskChute heatmap",
				taskchute: { view: "heatmap" },
				w: 6,
				h: 3,
			}),
			requires: {
				name: "TaskChute Plus",
				pluginId: TASKCHUTE_PLUGIN_ID,
				satisfied: (app) => isTaskChuteAvailable(app),
			},
		},
	],
	render: (view, card, body, component) => renderTaskChute(view, card, body, component),
	renderEditor: (container, ctx) => taskChuteEditor(ctx, container),
	liveness: {
		mode: "vault",
		// TaskChute keeps its tasks and records under its own `TaskChute/` root
		// (the default, or `<specifiedFolder>/TaskChute/`), so anything else in
		// the vault can't change what these cards show. A completely custom
		// folder is missed here; the task list re-reads itself every 15 s and
		// every action repaints, so it self-heals.
		shouldRedraw: (card, ev) => ev.file.path.includes("TaskChute/"),
	},
};
