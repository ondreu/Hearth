/**
 * Markdown the way a text editor shows it: terminal mode's note cards.
 *
 * The graphical cards render a note (headings as headings, checkboxes as
 * checkboxes). Terminal mode shows the source instead, highlighted the way a
 * code editor highlights Markdown — `#` in the heading's line, `**` around
 * the bold, `[[` and `]]` around a link — because in a text interface the text
 * *is* the note. Checkboxes still tick, links still open and tags still
 * search, and `i` (or a double-click) turns the body into the note's own
 * editor: a plain textarea over the whole body, saved as you type.
 *
 * Used by the Daily note, Periodic note, Embedded note and Jot-down cards
 * (src/tui/cards/notes.ts).
 */
import { debounce, type Component } from "obsidian";
import { t } from "../i18n";
import { openLink, openSearch } from "../opener";
import type { HomeView } from "../view";
import type { TuiContext, TuiItem, TuiMount, TuiOutput } from "./card";
import { asciify, strWidth, wrapLine, type Line, type TuiStyle } from "./text";

/** How a note card's source is read and written. */
export interface MarkdownSource {
	/** The text, or null while it is still being read. */
	text: string | null;
	/** For resolving links. */
	sourcePath: string;
	/** Whether `i` may open the editor. */
	editable: boolean;
	/** Apply an edit to the stored text (atomically, for a file). */
	edit: (fn: (text: string) => string) => Promise<unknown>;
	/** Shown when the text is empty. */
	placeholder: string;
	/** Hide a leading `---` frontmatter block (true for notes, false for the
	 * jot-down card, whose text isn't a note). */
	frontmatter: boolean;
}

/** The Tasks plugin's emoji signifiers, as the words a terminal would write. */
const TASK_SIGNS: Record<string, string> = {
	"📅": "due",
	"🗓": "due",
	"⏳": "sched",
	"🛫": "start",
	"➕": "created",
	"✅": "done",
	"❌": "cancelled",
	"🔁": "every",
	"⏫": "!!!",
	"🔼": "!!",
	"🔽": "!",
	"🔺": "!!!!",
	"⏬": "-",
	"🆔": "id",
	"⛔": "after",
};

/** Text of a note line made terminal-safe: task signifiers as words, other
 * emoji as ASCII. */
function clean(text: string): string {
	let out = text;
	for (const [emoji, word] of Object.entries(TASK_SIGNS)) {
		if (out.includes(emoji)) out = out.split(emoji).join(word);
	}
	return asciify(out.replace(/️/g, ""));
}

interface Highlighted {
	lines: Line[];
	/** For every drawn line, the source line it came from. */
	source: number[];
	/** Drawn lines holding a checkbox, and that checkbox's source line. */
	checkboxes: { line: number; source: number }[];
	/** Drawn lines holding a link, and what opening it does. */
	links: { line: number; open: (evt?: MouseEvent | KeyboardEvent) => void }[];
}

/**
 * Highlight Markdown source line by line and wrap it to `cols`. Inline marks
 * (links, emphasis, code, tags) are coloured, never hidden, so what is drawn
 * is exactly what is in the file.
 */
export function highlightMarkdown(
	view: HomeView,
	src: string,
	cols: number,
	opts: { sourcePath: string; frontmatter: boolean; toggle: (sourceLine: number) => void },
): Highlighted {
	const out: Highlighted = { lines: [], source: [], checkboxes: [], links: [] };
	const raw = src.replace(/\r\n?/g, "\n").split("\n");
	let fence: string | null = null;
	let i = 0;

	// Frontmatter: collapsed to one dim line of its keys.
	if (opts.frontmatter && raw[0] === "---") {
		const end = raw.indexOf("---", 1);
		if (end > 0) {
			const keys = raw
				.slice(1, end)
				.map((l) => /^([^:\s][^:]*):/.exec(l)?.[1])
				.filter((k): k is string => !!k);
			push(out, [{ text: `--- ${keys.join(" · ")} ---`, style: "faint" }], 0, cols, 0);
			i = end + 1;
		}
	}

	for (; i < raw.length; i++) {
		const line = raw[i];
		const fenceMatch = /^\s*(```|~~~)/.exec(line);
		if (fence) {
			push(out, [{ text: clean(line), style: "yellow" }], i, cols, 0);
			if (fenceMatch && fenceMatch[1] === fence) fence = null;
			continue;
		}
		if (fenceMatch) {
			fence = fenceMatch[1];
			push(out, [{ text: clean(line), style: ["yellow", "dim"] }], i, cols, 0);
			continue;
		}
		if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
			push(out, [{ text: "─".repeat(Math.max(3, cols)), style: "rule" }], i, cols, 0);
			continue;
		}
		const heading = /^(#{1,6})(\s+)(.*)$/.exec(line);
		if (heading) {
			const style: TuiStyle[] = heading[1].length <= 2 ? ["bold", "accent"] : ["bold"];
			push(out, [{ text: heading[1] + heading[2], style: "dim" }, ...inline(view, heading[3], opts.sourcePath, style)], i, cols, 0);
			continue;
		}
		const quote = /^(\s*>\s?)(.*)$/.exec(line);
		if (quote) {
			const callout = /^\[!(\w+)\][+-]?\s*(.*)$/.exec(quote[2]);
			const body: Line = callout
				? [{ text: `[!${callout[1]}] `, style: ["accent", "bold"] }, ...inline(view, callout[2], opts.sourcePath, ["bold"])]
				: inline(view, quote[2], opts.sourcePath, ["dim", "italic"]);
			push(out, [{ text: "│ ", style: "accent" }, ...body], i, cols, 2);
			continue;
		}
		const item = /^(\s*)([-*+]|\d+[.)])(\s+)(\[(.)\]\s)?(.*)$/.exec(line);
		if (item) {
			const [, lead, marker, gap, box, status, rest] = item;
			const segs: Line = [{ text: lead + marker + gap, style: "dim" }];
			const indent = strWidth(lead + marker + gap) + (box ? 4 : 0);
			if (box) {
				const done = status !== " ";
				const source = i;
				segs.push({
					text: `[${status}]`,
					style: done ? "green" : "accent",
					onClick: () => opts.toggle(source),
					label: done ? t().tui.cards.untick : t().tui.cards.tick,
				});
				segs.push({ text: " " });
				segs.push(...inline(view, rest, opts.sourcePath, done ? ["dim", "strike"] : []));
				const first = out.lines.length;
				push(out, segs, i, cols, indent);
				out.checkboxes.push({ line: first, source: i });
			} else {
				segs.push(...inline(view, rest, opts.sourcePath, []));
				push(out, segs, i, cols, indent);
			}
			continue;
		}
		if (/^\s*\|/.test(line)) {
			push(out, inline(view, line, opts.sourcePath, []).map((sg) => (sg.text.includes("|") && !sg.style ? { ...sg, style: "dim" } : sg)), i, cols, 0);
			continue;
		}
		push(out, inline(view, line, opts.sourcePath, []), i, cols, 0);
	}

	// Record which drawn lines hold a link, for the keyboard.
	out.lines.forEach((l, n) => {
		const link = l.find((sg) => sg.onClick && sg.style && (Array.isArray(sg.style) ? sg.style : [sg.style]).includes("underline"));
		if (link?.onClick) {
			const open = link.onClick;
			out.links.push({ line: n, open: (evt) => open(evt ?? new MouseEvent("click")) });
		}
	});
	return out;
}

function push(out: Highlighted, line: Line, source: number, cols: number, indent: number): void {
	for (const l of wrapLine(line, Math.max(1, cols), indent)) {
		out.lines.push(l);
		out.source.push(source);
	}
}

/** Inline Markdown in one line: links, emphasis, code, highlights, tags. */
function inline(view: HomeView, text: string, sourcePath: string, base: TuiStyle[]): Line {
	const segs: Line = [];
	const plain = (s: string, extra: TuiStyle[] = []) => {
		if (s) segs.push({ text: clean(s), style: [...base, ...extra] });
	};
	const re = /(!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\])|(!?\[([^\]]*)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*|__([^_]+)__)|(\*([^*\s][^*]*)\*)|(`([^`]+)`)|(==([^=]+)==)|(~~([^~]+)~~)|((?:^|\s)(#[\p{L}\p{N}_/-]+))/gu;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		if (m.index > last) plain(text.slice(last, m.index));
		if (m[1]) {
			const target = m[2];
			const embed = m[1].startsWith("!");
			segs.push({ text: embed ? "![[" : "[[", style: "dim" });
			segs.push({
				text: clean(m[3] ?? target),
				style: [...base, "cyan", "underline"],
				onClick: (evt) => void openLink(view, target, sourcePath, "card", evt instanceof MouseEvent ? evt : null),
				label: target,
			});
			segs.push({ text: "]]", style: "dim" });
		} else if (m[4]) {
			const url = m[6];
			segs.push({ text: "[", style: "dim" });
			segs.push({
				text: clean(m[5] || url),
				style: [...base, "cyan", "underline"],
				onClick: (evt) => {
					if (/^[a-z][\w+.-]*:/i.test(url)) window.open(url, "_blank");
					else void openLink(view, decodeURI(url), sourcePath, "card", evt instanceof MouseEvent ? evt : null);
				},
				label: url,
			});
			segs.push({ text: "]", style: "dim" });
		} else if (m[7]) {
			const marks = m[7].slice(0, 2);
			segs.push({ text: marks, style: "dim" });
			plain(m[8] ?? m[9] ?? "", ["bold"]);
			segs.push({ text: marks, style: "dim" });
		} else if (m[10]) {
			segs.push({ text: "*", style: "dim" });
			plain(m[11] ?? "", ["italic"]);
			segs.push({ text: "*", style: "dim" });
		} else if (m[12]) {
			segs.push({ text: `\`${clean(m[13])}\``, style: "yellow" });
		} else if (m[14]) {
			segs.push({ text: "==", style: "dim" });
			plain(m[15], ["reverse"]);
			segs.push({ text: "==", style: "dim" });
		} else if (m[16]) {
			segs.push({ text: "~~", style: "dim" });
			plain(m[17], ["strike", "dim"]);
			segs.push({ text: "~~", style: "dim" });
		} else if (m[18]) {
			const lead = m[18].startsWith(" ") || m[18].startsWith("\t") ? m[18][0] : "";
			if (lead) plain(lead);
			const tag = m[19];
			segs.push({ text: tag, style: [...base, "magenta"], onClick: () => void openSearch(view.app, `tag:${tag}`), label: tag });
		}
		last = re.lastIndex;
	}
	if (last < text.length) plain(text.slice(last));
	return segs;
}

/** Tick or untick the checkbox on source line `n`. */
function toggleLine(text: string, n: number): string {
	const lines = text.split("\n");
	const line = lines[n];
	if (line === undefined) return text;
	lines[n] = line.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[(.)\]/, (_, head: string, s: string) => `${head}[${s === " " ? "x" : " "}]`);
	return lines.join("\n");
}

/**
 * A note card's body: the highlighted source, or — while editing — a
 * textarea over the whole body. `ctx.state.editing` holds which one.
 */
export function markdownOutput(ctx: TuiContext, src: MarkdownSource): TuiOutput {
	const { view } = ctx;
	if (ctx.state.editing === true && src.editable && src.text !== null) return editorOutput(ctx, src);

	if (src.text === null) return { lines: [[{ text: t().tui.cards.loading, style: "dim" }]] };
	const toggle = (source: number) => {
		void src.edit((text) => toggleLine(text, source)).then(() => ctx.redraw());
	};
	const body = src.text;
	if (!body.trim()) {
		return {
			lines: [[{ text: src.placeholder, style: "faint" }]],
			foot: src.editable ? t().tui.cards.noteFootEdit : undefined,
		};
	}
	const hl = highlightMarkdown(view, body, ctx.cols, { sourcePath: src.sourcePath, frontmatter: src.frontmatter, toggle });
	const items: TuiItem[] = [];
	const byLine = new Map<number, TuiItem>();
	for (const cb of hl.checkboxes) {
		const item: TuiItem = { line: cb.line, toggle: () => toggle(cb.source), activate: () => toggle(cb.source) };
		byLine.set(cb.line, item);
	}
	for (const link of hl.links) {
		const existing = byLine.get(link.line);
		if (existing) existing.activate = link.open;
		else byLine.set(link.line, { line: link.line, activate: link.open });
	}
	for (const line of [...byLine.keys()].sort((a, b) => a - b)) items.push(byLine.get(line)!);
	return {
		lines: hl.lines,
		items,
		foot: src.editable ? t().tui.cards.noteFootEdit : t().tui.cards.noteFoot,
		onDoubleClick: src.editable
			? () => {
					ctx.state.editing = true;
					ctx.redraw();
				}
			: undefined,
	};
}

function editorOutput(ctx: TuiContext, src: MarkdownSource): TuiOutput {
	const mount: TuiMount = {
		line: 0,
		rows: Math.max(1, ctx.rows),
		mount: (host: HTMLElement, component: Component) => {
			const area = host.createEl("textarea", {
				cls: "hearth-tui-editor",
				attr: { spellcheck: "false", "aria-label": t().tui.cards.editing },
			});
			area.value = src.text ?? "";
			let saved = area.value;
			const flush = () => {
				const value = area.value;
				if (value === saved) return Promise.resolve();
				saved = value;
				return src.edit(() => value);
			};
			const save = debounce(() => void flush(), 500, true);
			area.addEventListener("input", () => save());
			const leave = () => {
				save.cancel();
				void flush().then(() => {
					ctx.state.editing = false;
					ctx.redraw();
				});
			};
			area.addEventListener("keydown", (e) => {
				if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
					e.preventDefault();
					e.stopPropagation();
					leave();
					return;
				}
				// Every other key belongs to the text.
				if (!/^F\d+$/.test(e.key)) e.stopPropagation();
			});
			area.addEventListener("blur", () => {
				if (ctx.state.editing === true) leave();
			});
			component.register(() => {
				save.cancel();
				void flush();
			});
			window.requestAnimationFrame(() => {
				area.focus();
				const at = typeof ctx.state.caret === "number" ? ctx.state.caret : area.value.length;
				area.setSelectionRange(at, at);
			});
			area.addEventListener("keyup", () => (ctx.state.caret = area.selectionStart));
		},
	};
	return { lines: Array.from({ length: Math.max(1, ctx.rows) }, () => [] as Line), mounts: [mount], foot: t().tui.cards.editingFoot, hint: t().tui.cards.editing };
}

/** The keys every note card shares: `i` edits. */
export function markdownKey(ctx: TuiContext, evt: KeyboardEvent, editable: boolean): boolean {
	if (evt.key === "i" && editable && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
		ctx.state.editing = true;
		ctx.redraw();
		return true;
	}
	return false;
}
