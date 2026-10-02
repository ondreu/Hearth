/**
 * A row of feed tabs that fits whatever card it is on — the RSS card's and
 * the reader's.
 *
 * A chip is as wide as its name (up to the row itself, past which the name
 * ends in …). A row with more chips than room scrolls sideways: by touch or
 * trackpad, and by the mouse wheel too, which a plain overflowing row would
 * ignore. The edge with more chips beyond it fades, and the active chip is
 * scrolled into view. A button at the end — "+3" — counts the chips that
 * aren't fully in view and lists every feed, so one is never more than two
 * clicks away however small the card.
 */
import { setIcon } from "./glyphs";
import { hearthMenu } from "./uidesign";

/** One tab as the strip draws it. */
export interface StripTab {
	id: string;
	label: string;
	/** Unread entries; 0 draws no count. */
	count: number;
}

/** Which of `items` lie outside `[start, end]` — not fully in view — with a
 * pixel's slack for subpixel layout. Pure, for the overflow button. */
export function hiddenTabs(
	view: { start: number; end: number },
	items: readonly { start: number; end: number }[],
): number[] {
	const out: number[] = [];
	items.forEach((item, i) => {
		if (item.start < view.start - 1 || item.end > view.end + 1) out.push(i);
	});
	return out;
}

/** A count as a chip shows it. */
function countText(n: number): string {
	return n > 99 ? "99+" : String(n);
}

/**
 * Draw the strip into `parent`: the scrolling list of chips, then the
 * overflow button. Returns a disposer that stops watching the strip's size
 * — call it before the strip is redrawn or thrown away.
 */
export function drawTabStrip(
	parent: HTMLElement,
	tabs: readonly StripTab[],
	activeId: string,
	onPick: (id: string) => void,
	moreLabel: string,
): () => void {
	const list = parent.createDiv("hearth-rss-tablist");
	const chips: HTMLButtonElement[] = [];
	for (const tab of tabs) {
		const btn = list.createEl("button", { cls: "hearth-rss-tab", attr: { type: "button", title: tab.label } });
		btn.createSpan({ cls: "hearth-rss-tab-label", text: tab.label });
		if (tab.count > 0) btn.createSpan({ cls: "hearth-rss-tab-count", text: countText(tab.count) });
		if (tab.id === activeId) btn.addClass("is-active");
		btn.addEventListener("click", () => onPick(tab.id));
		chips.push(btn);
	}

	const more = parent.createEl("button", {
		cls: "hearth-rss-tabmore",
		attr: { type: "button", "aria-label": moreLabel, title: moreLabel },
	});
	setIcon(more.createSpan("hearth-rss-tabmore-icon"), "chevron-down");
	const moreCount = more.createSpan("hearth-rss-tabmore-count");
	more.addEventListener("click", (evt) => {
		const menu = hearthMenu();
		for (const tab of tabs) {
			menu.addItem((i) =>
				i
					.setTitle(tab.count > 0 ? `${tab.label} (${countText(tab.count)})` : tab.label)
					.setChecked(tab.id === activeId)
					.onClick(() => onPick(tab.id)),
			);
		}
		menu.showAtMouseEvent(evt);
	});

	/** Show the button, its count and the edge fades for what is out of view. */
	const update = (): void => {
		if (!list.isConnected) return;
		const box = list.getBoundingClientRect();
		const hidden = hiddenTabs(
			{ start: box.left, end: box.right },
			chips.map((c) => {
				const r = c.getBoundingClientRect();
				return { start: r.left, end: r.right };
			}),
		);
		more.toggleClass("is-shown", hidden.length > 0);
		moreCount.setText(hidden.length > 0 ? `+${hidden.length}` : "");
		list.toggleClass("is-fade-start", list.scrollLeft > 1);
		list.toggleClass("is-fade-end", list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
	};

	// A vertical wheel scrolls the row sideways — but only while there is
	// somewhere to go, so the card's own list still scrolls past it.
	list.addEventListener(
		"wheel",
		(evt) => {
			if (Math.abs(evt.deltaY) <= Math.abs(evt.deltaX)) return;
			const max = list.scrollWidth - list.clientWidth;
			if (max <= 0) return;
			const next = Math.max(0, Math.min(max, list.scrollLeft + evt.deltaY));
			if (next === list.scrollLeft) return;
			list.scrollLeft = next;
			evt.preventDefault();
		},
		{ passive: false },
	);
	list.addEventListener("scroll", update, { passive: true });

	// Once laid out: bring the active chip into view, then take stock.
	const reveal = (): void => {
		const active = chips.find((c) => c.hasClass("is-active"));
		if (active) {
			// The list is the chips' offset parent (it is positioned).
			const left = active.offsetLeft;
			const right = left + active.offsetWidth;
			if (left < list.scrollLeft) list.scrollLeft = left;
			else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth;
		}
		update();
	};
	const frame = window.requestAnimationFrame(reveal);
	const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
	observer?.observe(list);

	return () => {
		window.cancelAnimationFrame(frame);
		observer?.disconnect();
	};
}
