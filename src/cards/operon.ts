import { type App, Setting, setIcon, type Component } from "obsidian";
import { emptyState } from "../cardbodies";
import { formatRelativeDate, localDayKey } from "../dates";
import { addResetButton } from "../editors";
import { t } from "../i18n";
import {
	boardColumns,
	cachedTaxonomy,
	dueRange,
	dueState,
	findPriority,
	findStatus,
	findTasks,
	formatElapsed,
	groupByDay,
	isClosed,
	isOperonAvailable,
	isOperonPlatformSupported,
	OPERON_PLUGIN_ID,
	isTransientAccessState,
	loadTaxonomy,
	openOperonTask,
	queryTasks,
	readTimer,
	sortTasks,
	taskDay,
	warmTaxonomy,
	type OperonAccessError,
	type OperonAccessState,
	type OperonResult,
	type OperonSortKey,
	type OperonStatus,
	type OperonTask,
	type OperonTaskPage,
	type OperonTaxonomy,
} from "../operon";
import { type DashboardCard, type OperonConfig } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Operon --------------------------------------------------------------

/**
 * Cards backed by the Operon plugin's in-process Developer API.
 *
 * Everything shown here is a typed snapshot Operon handed over: its tasks, its
 * pipelines and statuses, its priority scale, its timer. Hearth never reads
 * Operon's notes or reimplements its rules — it asks, orders, and draws. That
 * keeps the integration honest against a plugin that ships often, and it is why
 * a missing grant or an older Obsidian shows an explanation rather than a
 * half-correct list assembled from frontmatter.
 *
 * One card kind covers four views (list, board, agenda, timer) because they
 * share the session, the taxonomy and the row markup; the "Add card" menu still
 * offers them as four separate entries.
 */

const DEFAULT_COUNT = 10;
const DEFAULT_AGENDA_DAYS = 7;
/** Ceiling on one board read. A board splits a single result set across its
 * columns, so the request has to cover all of them — but an unbounded limit on
 * a large vault would pull far more than a card can show. */
const BOARD_MAX_LIMIT = 500;

type OperonView = NonNullable<OperonConfig["view"]>;

function operonView(cfg: OperonConfig): OperonView {
	return cfg.view ?? "list";
}

function countOf(cfg: OperonConfig): number {
	return Math.max(1, cfg.count ?? DEFAULT_COUNT);
}

function sortKeyOf(cfg: OperonConfig): OperonSortKey {
	return cfg.sortKey ?? "smart";
}


// ---- Access gating -------------------------------------------------------

/** The empty state for every reason an Operon card can't show data. Each state
 * names its own next step: "install Operon" and "approve Hearth in Operon's
 * settings" are very different problems and a shared message helps neither. */
function renderAccessNotice(
	body: HTMLElement,
	state: OperonAccessState,
	error: OperonAccessError | null,
): void {
	const strings = t().cards.empty;
	const notice: Record<OperonAccessState, { icon: string; text: string }> = {
		error: { icon: "alert-triangle", text: strings.operonError },
		unsupported: { icon: "monitor-off", text: strings.operonUnsupported },
		booting: { icon: "loader", text: strings.operonBooting },
		pending: { icon: "key-round", text: strings.operonPending },
		suspended: { icon: "pause", text: strings.operonSuspended },
		revoked: { icon: "shield-off", text: strings.operonRevoked },
		absent: { icon: "list-checks", text: strings.operonEnable },
		// Never drawn — a ready card renders its content instead — but the map
		// is exhaustive so a new state cannot be added without a message.
		ready: { icon: "list-checks", text: strings.operonEnable },
	};
	const { icon, text } = notice[state];
	emptyState(body, icon, text);

	// Operon's own code and sentence, verbatim, under *every* state it explained
	// — not just the ones Hearth failed to categorise. Hearth's summary is an
	// interpretation of that error, and when the interpretation is wrong this
	// line is the only thing that says so.
	if (error) {
		body.createDiv({
			cls: "hearth-operon-errordetail",
			text: t().cards.operon.errorDetail(error.reasonCode ?? error.code, error.reason),
		});
	}
}


/** Turn a failed read into a line the user can act on. Operon's error codes are
 * additive, so an unrecognised one is reported as-is rather than guessed at. */
function renderReadFailure(body: HTMLElement, reason: string): void {
	emptyState(body, "alert-triangle", t().cards.operon.readFailed(reason));
}


// ---- Async plumbing ------------------------------------------------------

/**
 * Draw a placeholder, load, then draw for real — the shape every Operon view
 * needs, since the API is async and card renders are not. The `component` is
 * the per-draw child created by `mountCardBody`, so a card that is redrawn or
 * removed while a read is in flight discards the stale result instead of
 * writing into a detached element.
 */
function mountAsync<T>(
	body: HTMLElement,
	component: Component,
	load: () => Promise<T>,
	draw: (value: T, host: HTMLElement) => void,
): void {
	const host = body.createDiv("hearth-operon");
	host.createDiv({ cls: "hearth-operon-loading", text: t().cards.operon.loading });
	let alive = true;
	component.register(() => {
		alive = false;
	});
	void load()
		.then((value) => {
			if (!alive) return;
			host.empty();
			draw(value, host);
		})
		.catch((err: unknown) => {
			if (!alive) return;
			host.empty();
			renderReadFailure(host, err instanceof Error ? err.message : String(err));
		});
}


/** The filter set a card sends to Operon. Empty arrays are dropped so a card
 * with nothing selected asks for everything rather than for nothing. */
function filtersFor(cfg: OperonConfig, today: string): {
	pipelineIds?: string[];
	statusIds?: string[];
	priorityIds?: string[];
	checkbox?: ("open" | "done" | "cancelled")[];
	filePath?: string;
	text?: string;
	due?: { from?: string; to?: string };
} {
	const filters: ReturnType<typeof filtersFor> = {};
	if (cfg.pipelineIds?.length) filters.pipelineIds = [...cfg.pipelineIds];
	if (cfg.statusIds?.length) filters.statusIds = [...cfg.statusIds];
	if (cfg.priorityIds?.length) filters.priorityIds = [...cfg.priorityIds];
	// Unset defaults to open work only, which is what a list or an agenda is
	// for. A board is the exception: its whole point is showing work across
	// statuses, and filtering to open would leave its Done column empty.
	filters.checkbox = cfg.checkbox?.length
		? [...cfg.checkbox]
		: operonView(cfg) === "board"
			? ["open", "done", "cancelled"]
			: ["open"];
	if (cfg.filePath) filters.filePath = cfg.filePath;
	if (cfg.text) filters.text = cfg.text;
	if (operonView(cfg) === "agenda") {
		filters.due = dueRange(today, cfg.agendaDays ?? DEFAULT_AGENDA_DAYS);
	}
	return filters;
}


/** Read the tasks one card wants: an Operon-defined scope when the card picked
 * one, otherwise its own filter set. */
function loadTasks(
	view: HomeView,
	cfg: OperonConfig,
	today: string,
	limit: number,
): Promise<OperonResult<OperonTaskPage>> {
	const session = view.plugin.operon;
	const scope = cfg.scope ?? "query";
	// Only the list view offers the scope control, so only the list view obeys
	// it. Otherwise a scope chosen in list mode would quietly keep narrowing a
	// board or an agenda after the card was switched, with no control on screen
	// explaining why.
	if (scope !== "query" && operonView(cfg) === "list") {
		const { pipelineIds, statusIds, priorityIds, checkbox } = filtersFor(cfg, today);
		return findTasks(session, scope, limit, { pipelineIds, statusIds, priorityIds, checkbox });
	}
	return queryTasks(session, filtersFor(cfg, today), limit);
}


// ---- Rows ----------------------------------------------------------------

/** The config fields that toggle a row's metadata chips. */
type OperonChipKey =
	| "showDue"
	| "showPriority"
	| "showStatus"
	| "showRecurrence"
	| "showTracker"
	| "showPinned"
	| "showFile";

/** Metadata chips are opt-out: a card that has never been configured shows the
 * lot, which is what a fresh task card looks like elsewhere in Hearth. */
function chipEnabled(value: boolean | undefined): boolean {
	return value !== false;
}

function renderStatusChip(row: HTMLElement, status: OperonStatus | null, fallback: string): void {
	// The marker class is what the shared task-row CSS uses to left-align the
	// chip against the title instead of letting it drift into the right-hand
	// cluster; renderTaskStatus in the tasks card sets it the same way.
	row.addClass("has-statuschip");
	const chip = row.createDiv({
		cls: "hearth-task-status hearth-task-statuschip",
		text: status?.label ?? fallback,
	});
	// Operon owns the palette; a status the user recoloured there recolours here.
	if (status?.color) chip.style.setProperty("--hearth-operon-color", status.color);
}

function renderPriorityChip(
	row: HTMLElement,
	taxonomy: OperonTaxonomy | null,
	task: OperonTask,
): void {
	const priority = findPriority(taxonomy, task.priority?.id);
	const label = priority?.label ?? task.priority?.label;
	if (!label) return;
	const chip = row.createDiv("hearth-task-priority hearth-operon-priority");
	const dot = chip.createDiv("hearth-task-priority-dot");
	if (priority?.color) dot.style.setProperty("--hearth-operon-color", priority.color);
	chip.createSpan({ cls: "hearth-task-priority-label", text: label });
}

function renderDueChip(row: HTMLElement, task: OperonTask, today: string): void {
	const day = taskDay(task);
	if (!day) return;
	const chip = row.createDiv({ cls: "hearth-task-due", text: formatRelativeDate(day) });
	// Only the two states the stylesheet distinguishes, matching the tasks
	// card's vocabulary — a class per bucket would put four inert names in the
	// DOM for one that does anything.
	const state = dueState(task, today);
	chip.toggleClass("is-overdue", state === "overdue");
	chip.toggleClass("is-today", state === "today");
	// Scheduled-only tasks are marked so a date shown here isn't read as a
	// deadline Operon never set.
	if (!task.dates.due) chip.addClass("is-scheduled");
}

/** One task row, shared by the list, board and agenda views. */
function renderTaskRow(
	view: HomeView,
	cfg: OperonConfig,
	parent: HTMLElement,
	task: OperonTask,
	taxonomy: OperonTaxonomy | null,
	today: string,
): void {
	const row = parent.createDiv("hearth-list-item hearth-task hearth-operon-task");
	row.toggleClass("is-done", isClosed(task));

	const title = task.description || t().cards.operon.untitled;
	row.createDiv({ cls: "hearth-list-label hearth-task-text", text: title });

	if (chipEnabled(cfg.showStatus) && task.workflow) {
		renderStatusChip(row, findStatus(taxonomy, task.workflow.status.id), task.workflow.status.label);
	}
	if (chipEnabled(cfg.showPriority)) renderPriorityChip(row, taxonomy, task);
	if (chipEnabled(cfg.showDue)) renderDueChip(row, task, today);

	const meta = row.createDiv("hearth-operon-meta");
	if (chipEnabled(cfg.showPinned) && task.pinned) {
		setIcon(meta.createSpan("hearth-operon-flag"), "pin");
	}
	if (chipEnabled(cfg.showRecurrence) && task.recurrence.repeating) {
		setIcon(meta.createSpan("hearth-operon-flag"), "repeat");
	}
	if (chipEnabled(cfg.showTracker) && task.tracker.active) {
		setIcon(meta.createSpan("hearth-operon-flag is-active"), "timer");
	}
	if (task.relationships.blockedByOperonIds.length > 0) {
		setIcon(meta.createSpan("hearth-operon-flag is-blocked"), "octagon-alert");
	}
	if (!meta.hasChildNodes()) meta.remove();

	if (chipEnabled(cfg.showFile)) {
		const name = task.locator.filePath.split("/").pop() ?? task.locator.filePath;
		row.createDiv({ cls: "hearth-operon-file", text: name.replace(/\.md$/i, "") });
	}

	const open = () => void openOperonTask(view.app, task);
	row.addEventListener("click", open);
	makeClickable(row, open, title);
}

/** "Showing 10 of 42" — Operon reports what it had to leave out, and dropping
 * that quietly is how a dashboard starts lying about the size of a backlog. */
function renderTruncation(host: HTMLElement, page: OperonTaskPage["page"]): void {
	if (!page.truncated) return;
	host.createDiv({
		cls: "hearth-operon-truncated",
		text: t().cards.operon.truncated(page.returnedCount, page.actualCount),
	});
}

/** A quiet marker when Operon served an unsettled view, so a card that looks
 * out of date says so instead of appearing simply wrong. */
function renderStaleness(host: HTMLElement, verified: boolean): void {
	if (verified) return;
	const el = host.createDiv({ cls: "hearth-operon-stale" });
	setIcon(el.createSpan("hearth-operon-stale-icon"), "refresh-cw");
	el.createSpan({ text: t().cards.operon.settling });
}


// ---- Views ---------------------------------------------------------------

function renderList(
	view: HomeView,
	cfg: OperonConfig,
	body: HTMLElement,
	component: Component,
	today: string,
): void {
	const limit = countOf(cfg);
	mountAsync(
		body,
		component,
		async () => {
			const taxonomy = await loadTaxonomy(view.plugin.operon);
			return { taxonomy, result: await loadTasks(view, cfg, today, limit) };
		},
		({ taxonomy, result }, host) => {
			if (!result.ok) {
				renderReadFailure(host, result.error.reason);
				return;
			}
			const tasks = sortTasks(result.value.tasks, sortKeyOf(cfg), !!cfg.sortReverse, taxonomy);
			if (tasks.length === 0) {
				emptyState(host, "check", t().cards.empty.operonNoTasks);
				return;
			}
			renderStaleness(host, result.freshness.verified);
			const listEl = host.createDiv("hearth-list hearth-tasks");
			for (const task of tasks) renderTaskRow(view, cfg, listEl, task, taxonomy, today);
			renderTruncation(host, result.value.page);
		},
	);
}


function renderAgenda(
	view: HomeView,
	cfg: OperonConfig,
	body: HTMLElement,
	component: Component,
	today: string,
): void {
	const days = Math.max(1, cfg.agendaDays ?? DEFAULT_AGENDA_DAYS);
	const limit = countOf(cfg) * days;
	mountAsync(
		body,
		component,
		async () => {
			const taxonomy = await loadTaxonomy(view.plugin.operon);
			return { taxonomy, result: await loadTasks(view, cfg, today, limit) };
		},
		({ taxonomy, result }, host) => {
			if (!result.ok) {
				renderReadFailure(host, result.error.reason);
				return;
			}
			const groups = groupByDay(result.value.tasks, today, days);
			if (groups.length === 0) {
				emptyState(host, "calendar-check", t().cards.empty.operonNoAgenda);
				return;
			}
			renderStaleness(host, result.freshness.verified);
			for (const group of groups) {
				const section = host.createDiv("hearth-operon-day");
				const head = section.createDiv("hearth-operon-day-head");
				head.createSpan({ cls: "hearth-operon-day-label", text: formatRelativeDate(group.day) });
				head.createSpan({ cls: "hearth-operon-day-count", text: String(group.tasks.length) });
				const listEl = section.createDiv("hearth-list hearth-tasks");
				const tasks = sortTasks(group.tasks, sortKeyOf(cfg), !!cfg.sortReverse, taxonomy);
				for (const task of tasks) renderTaskRow(view, cfg, listEl, task, taxonomy, today);
			}
			renderTruncation(host, result.value.page);
		},
	);
}


function renderBoard(
	view: HomeView,
	cfg: OperonConfig,
	body: HTMLElement,
	component: Component,
	today: string,
): void {
	mountAsync(
		body,
		component,
		async () => {
			// The taxonomy is read first so the request can be sized to the
			// columns this board will actually draw. Asking for a fixed
			// multiple instead would let a busy status swallow the whole
			// result and leave its neighbours looking empty.
			const taxonomy = await loadTaxonomy(view.plugin.operon);
			const columns = boardColumns(taxonomy, {
				pipelineIds: cfg.pipelineIds,
				order: cfg.boardOrder,
				hidden: cfg.boardHidden,
			});
			const limit = Math.min(countOf(cfg) * Math.max(1, columns.length), BOARD_MAX_LIMIT);
			return { taxonomy, columns, result: await loadTasks(view, cfg, today, limit) };
		},
		({ taxonomy, columns, result }, host) => {
			if (!result.ok) {
				renderReadFailure(host, result.error.reason);
				return;
			}
			if (columns.length === 0) {
				emptyState(host, "columns-3", t().cards.empty.operonNoColumns);
				return;
			}
			renderStaleness(host, result.freshness.verified);

			// A task with no workflow has no column to sit in — Operon allows
			// one, a status board cannot show it. The list and agenda views do.
			const byStatus = new Map<string, OperonTask[]>();
			for (const task of result.value.tasks) {
				const id = task.workflow?.status.id;
				if (!id) continue;
				const bucket = byStatus.get(id);
				if (bucket) bucket.push(task);
				else byStatus.set(id, [task]);
			}

			const board = host.createDiv("hearth-kanban hearth-operon-board");
			for (const status of columns) {
				const colEl = board.createDiv("hearth-kanban-col");
				const head = colEl.createDiv("hearth-kanban-col-head");
				const title = head.createSpan({ cls: "hearth-kanban-col-title", text: status.label });
				if (status.color) title.style.setProperty("--hearth-operon-color", status.color);
				const tasks = sortTasks(
					byStatus.get(status.id) ?? [],
					sortKeyOf(cfg),
					!!cfg.sortReverse,
					taxonomy,
				);
				head.createSpan({ cls: "hearth-kanban-col-count", text: String(tasks.length) });
				const colBody = colEl.createDiv("hearth-kanban-col-body");
				for (const task of tasks.slice(0, countOf(cfg))) {
					renderTaskRow(view, cfg, colBody, task, taxonomy, today);
				}
			}
			renderTruncation(host, result.value.page);
		},
	);
}


/**
 * The running timer. Operon reports the elapsed seconds as of the read, so the
 * card counts forward from that reading locally rather than re-reading once a
 * second — one API call per redraw, a clock that still ticks.
 */
function renderTimer(
	view: HomeView,
	body: HTMLElement,
	component: Component,
): void {
	mountAsync(
		body,
		component,
		() => readTimer(view.plugin.operon),
		(result, host) => {
			if (!result.ok) {
				renderReadFailure(host, result.error.reason);
				return;
			}
			const state = result.value;
			const wrap = host.createDiv("hearth-operon-timer");
			if (!state.active) {
				const idle = wrap.createDiv("hearth-operon-timer-idle");
				setIcon(idle.createDiv("hearth-operon-timer-icon"), "timer-off");
				idle.createDiv({ cls: "hearth-operon-timer-label", text: t().cards.operon.timerIdle });
				if (state.transition) {
					idle.createDiv({
						cls: "hearth-operon-timer-note",
						text:
							state.transition.kind === "starting"
								? t().cards.operon.timerStarting
								: t().cards.operon.timerStopping,
					});
				}
				return;
			}

			setIcon(wrap.createDiv("hearth-operon-timer-icon is-running"), "timer");
			const clock = wrap.createDiv({
				cls: "hearth-operon-timer-clock",
				text: formatElapsed(state.active.elapsedSeconds),
			});
			wrap.createDiv({
				cls: "hearth-operon-timer-label",
				text: state.active.isUnassigned ? t().cards.operon.timerUnassigned : state.active.source,
			});

			// Count on from Operon's reading rather than trusting the wall clock
			// against its start time — the two agree, and this needs no timezone
			// or clock-skew reasoning.
			const base = state.active.elapsedSeconds;
			const since = Date.now();
			component.registerInterval(
				window.setInterval(() => {
					clock.setText(formatElapsed(base + (Date.now() - since) / 1000));
				}, 1000),
			);
		},
	);
}


/** How long to wait before re-checking a transient access state, and how many
 * times. Operon's grant store settles in well under a second; five tries at
 * 1.5s covers a cold runtime start without polling a genuinely stuck one. */
const ACCESS_RETRY_MS = 1_500;
const ACCESS_RETRIES = 5;

/**
 * Draw the card for whatever access we currently have, retrying by itself while
 * that state is transient.
 *
 * The retry is not a nicety. Operon reports its grant store as busy on the very
 * first request from a new consumer, and no user action resolves that — while
 * cards otherwise redraw only on a vault change, which may never come on a
 * quiet vault. Without this the card would sit on a transient message forever.
 * The timer is registered on the per-draw component, so it dies with the card,
 * and each level fires once against a bounded budget.
 */
function drawForAccess(
	view: HomeView,
	cfg: OperonConfig,
	body: HTMLElement,
	component: Component,
	retriesLeft: number,
): void {
	const access = view.plugin.operon.access();
	if (access.state === "ready") {
		drawReadyView(view, cfg, body, component);
		return;
	}

	renderAccessNotice(body, access.state, access.error);
	if (!isTransientAccessState(access.state) || retriesLeft <= 0) return;

	const timer = window.setInterval(() => {
		window.clearInterval(timer);
		// Drop the cached result, or the session's own backoff would just hand
		// back the same transient state we are retrying past.
		view.plugin.operon.invalidate();
		body.empty();
		drawForAccess(view, cfg, body, component, retriesLeft - 1);
	}, ACCESS_RETRY_MS);
	component.registerInterval(timer);
}

function drawReadyView(
	view: HomeView,
	cfg: OperonConfig,
	body: HTMLElement,
	component: Component,
): void {
	const today = localDayKey(Date.now());
	switch (operonView(cfg)) {
		case "timer":
			renderTimer(view, body, component);
			return;
		case "board":
			renderBoard(view, cfg, body, component, today);
			return;
		case "agenda":
			renderAgenda(view, cfg, body, component, today);
			return;
		case "list":
		default:
			renderList(view, cfg, body, component, today);
			return;
	}
}

export function renderOperon(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = (card.operon ??= {});
	if (!view.plugin.settings.operonIntegration) {
		emptyState(body, "plug-zap", t().cards.empty.operonDisabled);
		return;
	}
	drawForAccess(view, cfg, body, component, ACCESS_RETRIES);
}


// ---- Editor --------------------------------------------------------------

/** A multi-select of Operon ids rendered as toggle chips. The options come from
 * the taxonomy, so the user picks real pipelines, statuses and priorities
 * instead of typing ids that may not exist. */
function chipPicker(
	container: HTMLElement,
	name: string,
	desc: string,
	options: { id: string; label: string }[],
	selected: string[],
	onChange: (next: string[]) => void,
): void {
	const setting = new Setting(container).setName(name).setDesc(desc);
	const host = setting.controlEl.createDiv("hearth-taskfilter-chips");
	if (options.length === 0) {
		host.createSpan({ cls: "hearth-operon-hint", text: t().editors.operon.noOptions });
		return;
	}
	for (const option of options) {
		const chip = host.createEl("button", { cls: "hearth-taskfilter-chip", text: option.label });
		chip.toggleClass("is-on", selected.includes(option.id));
		chip.addEventListener("click", () => {
			const next = selected.includes(option.id)
				? selected.filter((id) => id !== option.id)
				: [...selected, option.id];
			onChange(next);
			chip.toggleClass("is-on", next.includes(option.id));
			selected = next;
		});
	}
}


/** Every status across the taxonomy, each id offered once. Two pipelines can
 * name the same status, and a picker that listed it twice would let the user
 * toggle one copy on and the other off. */
function statusOptions(taxonomy: OperonTaxonomy | null): { id: string; label: string }[] {
	const seen = new Set<string>();
	const options: { id: string; label: string }[] = [];
	for (const pipeline of taxonomy?.pipelines ?? []) {
		for (const status of pipeline.statuses) {
			if (seen.has(status.id)) continue;
			seen.add(status.id);
			options.push({ id: status.id, label: status.label });
		}
	}
	return options;
}


export function operonEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.operon ??= {});
	const strings = t().editors.operon;

	new Setting(containerEl)
		.setName(strings.view)
		.setDesc(strings.viewDesc)
		.addDropdown((d) => {
			d.addOption("list", strings.viewList);
			d.addOption("board", strings.viewBoard);
			d.addOption("agenda", strings.viewAgenda);
			d.addOption("timer", strings.viewTimer);
			d.setValue(operonView(cfg)).onChange((v) => {
				cfg.view = v as OperonView;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});

	// The timer view reads one value and has nothing to filter or sort.
	if (operonView(cfg) === "timer") return;

	if (operonView(cfg) === "list") {
		new Setting(containerEl)
			.setName(strings.scope)
			.setDesc(strings.scopeDesc)
			.addDropdown((d) => {
				d.addOption("query", strings.scopeQuery);
				d.addOption("normal", strings.scopeNormal);
				d.addOption("happens-today", strings.scopeToday);
				d.addOption("overdue", strings.scopeOverdue);
				d.addOption("recent", strings.scopeRecent);
				d.setValue(cfg.scope ?? "query").onChange((v) => {
					cfg.scope = v as OperonConfig["scope"];
					ctx.opts.save();
					ctx.opts.rerender();
				});
			});
	}

	if (operonView(cfg) === "agenda") {
		const days = new Setting(containerEl).setName(strings.agendaDays).setDesc(strings.agendaDaysDesc);
		days.addSlider((s) => {
			s.setLimits(1, 31, 1)
				.setValue(cfg.agendaDays ?? DEFAULT_AGENDA_DAYS)
				.setDynamicTooltip()
				.onChange((v) => {
					cfg.agendaDays = v;
					ctx.opts.save();
					ctx.opts.rerender();
				});
			addResetButton(ctx, days, strings.agendaDaysDesc, () => {
				cfg.agendaDays = undefined;
				s.setValue(DEFAULT_AGENDA_DAYS);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	}

	const count = new Setting(containerEl).setName(strings.count).setDesc(strings.countDesc);
	count.addSlider((s) => {
		s.setLimits(1, 50, 1)
			.setValue(countOf(cfg))
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.count = v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		addResetButton(ctx, count, strings.countDesc, () => {
			cfg.count = undefined;
			s.setValue(DEFAULT_COUNT);
			ctx.opts.save();
			ctx.opts.rerender();
		});
	});

	// Filters come from Operon's own taxonomy, via the cache the render path
	// fills. Usually it is already warm — the card drew before its settings
	// were opened. It is cold when a card was switched to this type from
	// another, so fetch in the background and rebuild once it lands rather than
	// blocking the modal on a read or dead-ending the pickers. Only the cold
	// case fetches, so the rebuild cannot loop.
	const taxonomy = cachedTaxonomy();
	if (!taxonomy) {
		void warmTaxonomy().then((loaded) => {
			if (loaded) ctx.requestRender();
		});
	}
	chipPicker(
		containerEl,
		strings.pipelines,
		strings.pipelinesDesc,
		(taxonomy?.pipelines ?? []).map((p) => ({ id: p.id, label: p.name })),
		cfg.pipelineIds ?? [],
		(next) => {
			cfg.pipelineIds = next.length ? next : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		},
	);
	chipPicker(
		containerEl,
		strings.statuses,
		strings.statusesDesc,
		statusOptions(taxonomy),
		cfg.statusIds ?? [],
		(next) => {
			cfg.statusIds = next.length ? next : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		},
	);
	chipPicker(
		containerEl,
		strings.priorities,
		strings.prioritiesDesc,
		(taxonomy?.priorities ?? []).map((p) => ({ id: p.id, label: p.label })),
		cfg.priorityIds ?? [],
		(next) => {
			cfg.priorityIds = next.length ? next : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		},
	);
	chipPicker(
		containerEl,
		strings.checkbox,
		strings.checkboxDesc,
		[
			{ id: "open", label: strings.checkboxOpen },
			{ id: "done", label: strings.checkboxDone },
			{ id: "cancelled", label: strings.checkboxCancelled },
		],
		cfg.checkbox ?? ["open"],
		(next) => {
			cfg.checkbox = next.length ? (next as OperonConfig["checkbox"]) : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		},
	);

	new Setting(containerEl)
		.setName(strings.text)
		.setDesc(strings.textDesc)
		.addText((txt) =>
			txt.setValue(cfg.text ?? "").onChange((v) => {
				cfg.text = v.trim() || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	new Setting(containerEl)
		.setName(strings.sort)
		.setDesc(strings.sortDesc)
		.addDropdown((d) => {
			d.addOption("smart", strings.sortSmart);
			d.addOption("due", strings.sortDue);
			d.addOption("priority", strings.sortPriority);
			d.addOption("created", strings.sortCreated);
			d.addOption("alpha", strings.sortAlpha);
			d.setValue(sortKeyOf(cfg)).onChange((v) => {
				cfg.sortKey = v as OperonSortKey;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		})
		.addToggle((tog) =>
			tog.setValue(!!cfg.sortReverse).onChange((v) => {
				cfg.sortReverse = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	// Chips are stored opt-out (undefined = shown, false = hidden), so a card
	// saved before a chip existed keeps showing it.
	const chips: { key: OperonChipKey; label: string }[] = [
		{ key: "showDue", label: strings.showDue },
		{ key: "showPriority", label: strings.showPriority },
		{ key: "showStatus", label: strings.showStatus },
		{ key: "showRecurrence", label: strings.showRecurrence },
		{ key: "showTracker", label: strings.showTracker },
		{ key: "showPinned", label: strings.showPinned },
		{ key: "showFile", label: strings.showFile },
	];
	for (const chip of chips) {
		new Setting(containerEl).setName(chip.label).addToggle((tog) =>
			tog.setValue(chipEnabled(cfg[chip.key])).onChange((v) => {
				cfg[chip.key] = v ? undefined : false;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
	}
}


// ---- Definition ----------------------------------------------------------

function template(id: string, name: string, icon: string, cfg: OperonConfig, w: number, h: number) {
	return {
		id,
		name,
		icon,
		build: () => ({ kind: "operon" as const, title: name, operon: cfg, w, h }),
		// Operon itself runs on mobile, but its developer API does not, so the
		// accessor being present is not enough: on a phone the requirement can
		// never be met, and the picker says so rather than pretending the card
		// would work. A card synced from a desktop still shows that explanation.
		requires: {
			name: "Operon",
			pluginId: OPERON_PLUGIN_ID,
			satisfied: (app: App) => isOperonAvailable(app) && isOperonPlatformSupported(),
		},
	};
}

/** Tasks, boards, agendas and the timer from the Operon plugin, read through
 * its Developer API. Every template declares that plugin as its requirement,
 * so the picker badges it while Operon isn't there. */
export const operonCard: CardDefinition<"operon"> = {
	kind: "operon",
	templates: [
		template("operon-tasks", "Operon tasks", "list-checks", { view: "list" }, 4, 4),
		template("operon-board", "Operon board", "columns-3", { view: "board" }, 8, 5),
		template("operon-agenda", "Operon agenda", "calendar-clock", { view: "agenda" }, 4, 5),
		template("operon-timer", "Operon timer", "timer", { view: "timer" }, 3, 2),
	],
	render: (view, card, body, component) => renderOperon(view, card, body, component),
	renderEditor: (container, ctx) => operonEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (!source.operon) return;
		copy.operon = {
			...source.operon,
			pipelineIds: source.operon.pipelineIds ? [...source.operon.pipelineIds] : undefined,
			statusIds: source.operon.statusIds ? [...source.operon.statusIds] : undefined,
			priorityIds: source.operon.priorityIds ? [...source.operon.priorityIds] : undefined,
			checkbox: source.operon.checkbox ? [...source.operon.checkbox] : undefined,
			boardOrder: source.operon.boardOrder ? [...source.operon.boardOrder] : undefined,
			boardHidden: source.operon.boardHidden ? [...source.operon.boardHidden] : undefined,
		};
	},
	// Operon persists to Markdown, so any vault or metadata change may have
	// moved a task. The board's own hub debounce keeps that to one redraw per
	// burst, and each redraw is a single bounded read.
	liveness: { mode: "vault" },
};
