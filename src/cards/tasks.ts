import type { CardDefinition } from "./definition";
import { renderTasks } from "../cardbodies";
import { tasksEditor } from "../editors";
import { tasksEventRelevant } from "../taskscope";

/** Tasks pulled from the vault, as a list or kanban board. Redraws live, but a
 * folder-scoped card ignores changes it can provably never read. */
export const tasksCard: CardDefinition<"tasks"> = {
	kind: "tasks",
	templates: [
		{ id: "tasks", name: "Tasks", icon: "list-todo", build: () => ({ kind: "tasks", title: "Tasks", tasks: {}, w: 4, h: 4 }) },
	],
	render: (view, card, body) => renderTasks(view, card, body),
	renderEditor: (container, ctx) => tasksEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.tasks)
			copy.tasks = {
				...source.tasks,
				folders: source.tasks.folders ? [...source.tasks.folders] : undefined,
				kanbanOrder: source.tasks.kanbanOrder ? [...source.tasks.kanbanOrder] : undefined,
				kanbanHidden: source.tasks.kanbanHidden ? [...source.tasks.kanbanHidden] : undefined,
				kanbanDoneColumns: source.tasks.kanbanDoneColumns
					? [...source.tasks.kanbanDoneColumns]
					: undefined,
				kanbanColumnSort: source.tasks.kanbanColumnSort
					? Object.fromEntries(
							Object.entries(source.tasks.kanbanColumnSort).map(([k, v]) => [k, { ...v }]),
						)
					: undefined,
				sortRules: source.tasks.sortRules ? source.tasks.sortRules.map((r) => ({ ...r })) : undefined,
			};
	},
	liveness: {
		mode: "vault",
		shouldRedraw: (card, ev) => tasksEventRelevant(card.tasks, ev.file, ev.oldPath),
	},
};
