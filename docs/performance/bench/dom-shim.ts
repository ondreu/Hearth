/* Obsidian's DOM sugar (createDiv / createSvg / toggleClass / addClass ...).
 * Reimplemented to match Obsidian's documented semantics so the bundled
 * sky.ts and grid.ts run unmodified in a plain browser.
 *
 * Note the createDiv vs createSvg class handling difference that sky.ts's
 * comments call out: createDiv sets the class attribute (spaces allowed),
 * createSvg hands tokens to classList.add(). */

interface DomElInfo {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function applyCls(el: Element, cls: string | string[] | undefined, viaAttr: boolean): void {
	if (!cls) return;
	if (Array.isArray(cls)) {
		el.classList.add(...cls);
	} else if (viaAttr) {
		el.setAttribute("class", cls);
	} else {
		el.classList.add(cls);
	}
}

function applyInfo(el: Element, info: DomElInfo | undefined, viaAttr: boolean): void {
	if (!info) return;
	applyCls(el, info.cls, viaAttr);
	if (info.text != null) el.textContent = info.text;
	if (info.attr) for (const [k, v] of Object.entries(info.attr)) el.setAttribute(k, v);
}

export function installDomShim(): void {
	const proto = Element.prototype as unknown as Record<string, unknown>;

	proto.createDiv = function (this: Element, cls?: string | DomElInfo, o?: (el: HTMLElement) => void) {
		const el = document.createElement("div");
		if (typeof cls === "string") el.setAttribute("class", cls);
		else applyInfo(el, cls, true);
		this.appendChild(el);
		o?.(el);
		return el;
	};

	proto.createEl = function (this: Element, tag: string, info?: DomElInfo) {
		const el = document.createElement(tag);
		applyInfo(el, info, true);
		this.appendChild(el);
		return el;
	};

	proto.createSvg = function (this: Element, tag: string, info?: DomElInfo) {
		const el = document.createElementNS(SVG_NS, tag);
		applyInfo(el, info, false);
		this.appendChild(el);
		return el;
	};

	proto.addClass = function (this: Element, ...cls: string[]) {
		this.classList.add(...cls);
	};
	proto.removeClass = function (this: Element, ...cls: string[]) {
		this.classList.remove(...cls);
	};
	proto.toggleClass = function (this: Element, cls: string | string[], on: boolean) {
		const list = Array.isArray(cls) ? cls : [cls];
		for (const c of list) this.classList.toggle(c, on);
	};
	proto.empty = function (this: Element) {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	proto.setText = function (this: Element, text: string) {
		this.textContent = text;
	};
}
