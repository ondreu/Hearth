/**
 * Task priority values, in every shape Hearth reads them: the Tasks plugin's
 * emoji (🔺⏫🔼🔽⏬), TaskNotes' words ("high", "normal"), and the loose
 * synonyms people put in frontmatter ("urgent", "p1", "minor"). Everything
 * here is pure string logic, kept out of the tasks card so it can be tested
 * without dragging in Obsidian and the card registry.
 */


/** Tasks-plugin priority keys, in descending order, mapped to their emoji. */
export const PRIORITY_EMOJI: Record<string, string> = {
	highest: "🔺",
	high: "⏫",
	medium: "🔼",
	low: "🔽",
	lowest: "⏬",
};


/** Priority keys in descending order — the index into this list is the sort
 * rank, so anything unrecognised (or absent) ranks last. */
const PRIORITY_ORDER = Object.keys(PRIORITY_EMOJI);


/** Map a raw priority value to a coarse level for coloring the indicator. */
export function priorityLevel(priority: string): "high" | "medium" | "low" | "other" {
	const v = priority.trim().toLowerCase();
	if (/^(high|urgent|critical|highest|p1|1|!!!|🔺|⏫)$/.test(v)) return "high";
	if (/^(medium|normal|med|moderate|p2|2|🔼)$/.test(v)) return "medium";
	if (/^(low|lowest|minor|p3|3|🔽|⏬)$/.test(v)) return "low";
	return "other";
}


/** The priority key ("high", "lowest", …) for a raw priority value — an emoji
 * (⏫) or a word ("high") — or "" when none/unrecognized. Used to prefill the
 * editor and to round-trip the emoji through the pickers. */
export function priorityKey(priority: string | undefined): string {
	if (!priority) return "";
	for (const [key, emoji] of Object.entries(PRIORITY_EMOJI)) {
		if (priority === emoji || priority.trim().toLowerCase() === key) return key;
	}
	// Fall back to the coarse level for words like "urgent"/"minor".
	const level = priorityLevel(priority);
	return level === "other" ? "" : level;
}


/** Rank of a priority value for ordering: highest → high → medium → low →
 * lowest → none. This ranks on the fine-grained key rather than the coarse
 * colour level, so "highest" sorts above "high" (and "low" above "lowest")
 * instead of tying with it and falling through to the next sort rule. */
export function priorityRank(priority: string | undefined): number {
	const i = PRIORITY_ORDER.indexOf(priorityKey(priority));
	return i === -1 ? PRIORITY_ORDER.length : i;
}


/** A readable label for a priority value: a raw word (e.g. TaskNotes' "high")
 * is shown as-is, but an emoji priority (🔺⏫🔼🔽⏬) is mapped to its key word
 * (highest/high/medium/low/lowest) so the list doesn't show a bare emoji. */
export function priorityDisplayLabel(priority: string): string {
	if (/[a-z]/i.test(priority)) return priority;
	return priorityKey(priority) || priority; // CSS capitalizes the word
}


/** The fine-grained CSS level class for a priority: distinguishes all five
 * Tasks-plugin levels (highest/high/medium/low/lowest) so, e.g., "highest" and
 * "high" get different colours. Falls back to "other". */
export function priorityClass(priority: string): string {
	return priorityKey(priority) || "other";
}


/** The Tasks-plugin priority emoji present on a card (highest→lowest), or
 * undefined. Returned raw; priorityLevel()/renderPriority() map it to a level
 * and show it as the label. */
export function readPriorityEmoji(text: string): string | undefined {
	const m = /[🔺⏫🔼🔽⏬]/u.exec(text);
	return m ? m[0] : undefined;
}
