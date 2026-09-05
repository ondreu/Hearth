/**
 * Obsidian's DOM helpers, for tests that run against jsdom.
 *
 * Obsidian adds these to the DOM prototypes at runtime, so code that uses them
 * cannot be exercised under a plain DOM without them. They are implemented here
 * **from the contract in `obsidian.d.ts`**, not from what would be convenient:
 *
 *     interface Node {
 *         // Create an element and append it to this node.
 *         createEl(tag, o?, callback?)
 *         createDiv(o?, callback?)
 *         createSpan(o?, callback?)
 *     }
 *
 * "and append it to this node" is the whole point of the file. A polyfill that
 * returned a detached element would make a test pass against code that cannot
 * work in Obsidian — which is exactly the mistake this exists to catch, since
 * `Document` is a `Node` and a Document may hold only one element child.
 *
 * Call `installObsidianDom()` once per test file, before importing anything
 * that uses the helpers at module scope.
 */

interface DomInfo {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string | number | boolean | null>;
	title?: string;
	href?: string;
	type?: string;
	value?: string;
	placeholder?: string;
	parent?: Node;
	prepend?: boolean;
}

function apply(el: HTMLElement, o?: DomInfo | string): void {
	if (o === undefined) return;
	if (typeof o === "string") {
		if (o) el.className = o;
		return;
	}
	if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
	if (o.text !== undefined) el.textContent = o.text;
	if (o.title !== undefined) el.title = o.title;
	if (o.href !== undefined) el.setAttribute("href", o.href);
	if (o.type !== undefined) el.setAttribute("type", o.type);
	if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
	if (o.placeholder !== undefined) el.setAttribute("placeholder", o.placeholder);
	for (const [k, v] of Object.entries(o.attr ?? {})) {
		if (v !== null && v !== false) el.setAttribute(k, String(v));
	}
}

/** The one implementation the three helpers share. */
function make(node: Node, tag: string, o?: DomInfo | string, cb?: (el: HTMLElement) => void): HTMLElement {
	const doc = node.ownerDocument ?? (node as Document);
	const el = doc.createElement(tag);
	apply(el, o);
	// The contract: created *and appended to this node*.
	const parent = typeof o === "object" && o.parent ? o.parent : node;
	if (typeof o === "object" && o.prepend) parent.insertBefore(el, parent.firstChild);
	else parent.appendChild(el);
	cb?.(el);
	return el;
}

export function installObsidianDom(): void {
	const nodeProto = Node.prototype as unknown as Record<string, unknown>;
	const elProto = Element.prototype as unknown as Record<string, unknown>;

	nodeProto.createEl = function (this: Node, tag: string, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
		return make(this, tag, o, cb);
	};
	nodeProto.createDiv = function (this: Node, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
		return make(this, "div", o, cb);
	};
	nodeProto.createSpan = function (this: Node, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
		return make(this, "span", o, cb);
	};

	elProto.addClass = function (this: Element, ...cls: string[]) { this.classList.add(...cls); };
	elProto.removeClass = function (this: Element, ...cls: string[]) { this.classList.remove(...cls); };
	elProto.toggleClass = function (this: Element, cls: string, on: boolean) { this.classList.toggle(cls, on); };
	elProto.hasClass = function (this: Element, cls: string) { return this.classList.contains(cls); };
	elProto.empty = function (this: Element) { while (this.firstChild) this.removeChild(this.firstChild); };
	elProto.detach = function (this: Element) { this.remove(); };
	elProto.setText = function (this: Element, text: string) { this.textContent = text; };
}
