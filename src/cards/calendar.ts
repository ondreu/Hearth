import type { CardDefinition } from "./definition";
import { renderCalendar } from "../cardbodies";
import { calendarEditor } from "../editors";

/** A mini month calendar with an optional agenda and external ICS calendars. */
export const calendarCard: CardDefinition<"calendar"> = {
	kind: "calendar",
	templates: [
		{ id: "calendar", name: "Mini calendar", icon: "calendar-days", build: () => ({ kind: "calendar", title: "Calendar", w: 4, h: 4 }) },
	],
	render: (view, card, body, component) => renderCalendar(view, card, body, component),
	renderEditor: (container, ctx) => calendarEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.calendar)
			copy.calendar = {
				...source.calendar,
				sources: source.calendar.sources ? source.calendar.sources.map((s) => ({ ...s })) : undefined,
				eventNote: source.calendar.eventNote
					? {
							...source.calendar.eventNote,
							fields: source.calendar.eventNote.fields
								? source.calendar.eventNote.fields.map((f) => ({ ...f }))
								: undefined,
						}
					: undefined,
			};
	},
	liveness: { mode: "vault" },
};
