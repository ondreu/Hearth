import { describe, expect, it } from "vitest";
import { backGestureTarget, isEditableTarget, type BackGesture } from "../src/settingsnav";

/**
 * Which back gesture leaves a settings category (#413).
 *
 * The pane is two levels deep and the only way back used to be the link in the
 * page header; Escape and the mouse's back button reached Obsidian instead, so
 * Escape closed the settings window. The rule for when the pane takes a gesture
 * is pure, which is what these assertions cover. Where the listener sits is
 * `settings.ts`'s business and needs a real Obsidian.
 */

const escape: BackGesture = { kind: "key", key: "Escape" };
const mouseBack: BackGesture = { kind: "mouse", button: 3 };

describe("backGestureTarget", () => {
	it("sends Escape on a category page back to the index", () => {
		expect(backGestureTarget("appearance", escape)).toBe("index");
	});

	it("sends the keyboard's Back key back to the index", () => {
		expect(backGestureTarget("appearance", { kind: "key", key: "BrowserBack" })).toBe("index");
		expect(backGestureTarget("appearance", { kind: "key", key: "GoBack" })).toBe("index");
	});

	it("sends the mouse's back button back to the index", () => {
		expect(backGestureTarget("dashboard", mouseBack)).toBe("index");
	});

	it("leaves the index alone, so Escape still closes the settings window", () => {
		expect(backGestureTarget("index", escape)).toBeNull();
		expect(backGestureTarget("index", mouseBack)).toBeNull();
	});

	it("ignores every other key", () => {
		for (const key of ["Enter", "Tab", "Backspace", "a", "ArrowLeft"]) {
			expect(backGestureTarget("appearance", { kind: "key", key })).toBeNull();
		}
	});

	it("ignores the mouse's other buttons", () => {
		for (const button of [0, 1, 2, 4]) {
			expect(backGestureTarget("appearance", { kind: "mouse", button })).toBeNull();
		}
	});

	it("leaves Escape to a text field, which cancels or leaves the edit", () => {
		expect(backGestureTarget("appearance", escape, true)).toBeNull();
	});

	it("still takes the mouse button over a text field", () => {
		// `editable` is the keyboard's question; a button press is not an edit.
		expect(backGestureTarget("appearance", mouseBack, true)).toBe("index");
	});
});

describe("isEditableTarget", () => {
	it("treats text entry as editable", () => {
		expect(isEditableTarget({ tagName: "INPUT", type: "text" })).toBe(true);
		expect(isEditableTarget({ tagName: "INPUT", type: "search" })).toBe(true);
		expect(isEditableTarget({ tagName: "INPUT", type: "number" })).toBe(true);
		expect(isEditableTarget({ tagName: "input" })).toBe(true);
		expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
		expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
		expect(isEditableTarget({ isContentEditable: true })).toBe(true);
	});

	it("does not treat switches and sliders as editable", () => {
		expect(isEditableTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
		expect(isEditableTarget({ tagName: "INPUT", type: "range" })).toBe(false);
		expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
		expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
	});

	it("survives a target that is not an element", () => {
		expect(isEditableTarget(null)).toBe(false);
		expect(isEditableTarget(undefined)).toBe(false);
		expect(isEditableTarget("appearance")).toBe(false);
	});
});
