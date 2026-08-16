/* Minimal stand-in for the `obsidian` module, enough to bundle sky.ts + grid.ts
 * for the browser harness. Only the surface those two files touch is real. */
export class Component {
	register(): void {}
	registerInterval(): void {}
	registerDomEvent(): void {}
	addChild(): void {}
	removeChild(): void {}
}
export function debounce<T extends (...a: never[]) => unknown>(fn: T): T {
	return fn;
}
export function requestUrl(): Promise<unknown> {
	return Promise.resolve({});
}
export const Platform = { isMobile: false };
