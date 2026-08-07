// esbuild's "text" loader turns Markdown imports into the file's raw string.
declare module "*.md" {
	const content: string;
	export default content;
}
