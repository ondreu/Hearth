/**
 * Which card kinds terminal mode draws as text, and with what.
 *
 * A kind missing from this table still appears in terminal mode: its graphical
 * body is drawn inside a terminal frame (see src/tui/board.ts). The table is a
 * `Partial` for exactly that reason — each entry is an upgrade, not a
 * requirement — and a unit test (test/tui-registry.test.ts) lists the kinds
 * that are deliberately left graphical, so a new kind can't slip through
 * without the decision being made.
 */
import type { CardKind, DashboardCard } from "../types";
import type { HomeView } from "../view";
import type { TuiRenderer } from "./card";
import { TUI_RENDERERS } from "./cards";

/** The text renderer for a card, or null when it is drawn graphically. */
export function tuiRenderer(card: DashboardCard, view?: HomeView): TuiRenderer | null {
	const renderer = (TUI_RENDERERS as Partial<Record<string, TuiRenderer>>)[card.kind] ?? null;
	if (renderer?.graphicalFor && view && renderer.graphicalFor(view, card)) return null;
	return renderer;
}

/** Kinds that stay graphical in terminal mode, and why — a picture, a web
 * page, another plugin's own view. */
export const GRAPHICAL_KINDS: readonly CardKind[] = ["slideshow", "web", "leaf"];
