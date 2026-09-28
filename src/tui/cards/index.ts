/**
 * Terminal mode's text renderers, one module per card kind, collected here.
 * See src/tui/registry.ts for how a card finds its renderer and what happens
 * to a kind that has none.
 */
import type { CardKind } from "../../types";
import type { TuiRenderer } from "../card";

export const TUI_RENDERERS: Partial<Record<CardKind, TuiRenderer>> = {};
