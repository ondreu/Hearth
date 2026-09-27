// Vite's `?raw` suffix imports a file's text as a string. Tests use it to read
// repository files (issue-form templates) without Node's fs, which the plugin
// guidelines keep out of code that has to run on mobile.
declare module "*?raw" {
	const content: string;
	export default content;
}
