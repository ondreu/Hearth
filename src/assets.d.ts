// esbuild's "dataurl" loader turns image imports into a data: URI string.
declare module "*.png" {
	const src: string;
	export default src;
}

// esbuild's "text" loader turns Markdown imports into the file's raw string.
declare module "*.md" {
	const content: string;
	export default content;
}
