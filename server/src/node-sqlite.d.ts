/**
 * Minimal declarations for `node:sqlite`.
 *
 * The module is built into Node (22.5+ behind a flag, stable from 24) but the
 * repository's `@types/node` predates it. Only what the server uses is declared
 * — a fuller set would be a copy of somebody else's types drifting out of date
 * in a file nobody reads.
 */
declare module "node:sqlite" {
	export interface StatementResultingChanges {
		changes: number | bigint;
		lastInsertRowid: number | bigint;
	}

	export class StatementSync {
		get(...params: unknown[]): unknown;
		all(...params: unknown[]): unknown[];
		run(...params: unknown[]): StatementResultingChanges;
	}

	export class DatabaseSync {
		constructor(path: string, options?: { open?: boolean; readOnly?: boolean });
		exec(sql: string): void;
		prepare(sql: string): StatementSync;
		close(): void;
	}
}
