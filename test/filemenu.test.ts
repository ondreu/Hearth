import { describe, expect, it } from "vitest";
import { availablePath } from "../src/filemenu";

/** A vault holding exactly `paths`. */
const vault = (...paths: string[]) => (path: string) => paths.includes(path);

describe("availablePath", () => {
	it("takes the name itself while it is free", () => {
		expect(availablePath("Notes/", "Untitled", "md", vault())).toBe("Notes/Untitled.md");
	});

	it("numbers the name the way Obsidian does once it is taken", () => {
		expect(availablePath("Notes/", "Untitled", "md", vault("Notes/Untitled.md"))).toBe("Notes/Untitled 1.md");
		expect(
			availablePath("Notes/", "Untitled", "md", vault("Notes/Untitled.md", "Notes/Untitled 1.md")),
		).toBe("Notes/Untitled 2.md");
	});

	it("fills the first gap rather than counting past it", () => {
		expect(availablePath("", "Plan", "md", vault("Plan.md", "Plan 2.md"))).toBe("Plan 1.md");
	});

	it("names a folder, which has no extension", () => {
		expect(availablePath("", "Projects", "", vault("Projects"))).toBe("Projects 1");
	});

	it("only counts the same extension as taken", () => {
		expect(availablePath("", "Board", "canvas", vault("Board.md"))).toBe("Board.canvas");
	});
});
