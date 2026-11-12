/**
 * The single board refresh a cold metadata cache owes the boards drawn under it.
 *
 * A card that reads a note's frontmatter — a title taken from a property, an
 * alias, whatever the card asked for — can only fall back to the file name
 * until Obsidian has parsed that note (#399), and most cards declare `static`
 * liveness, so they would keep showing the fallback until something else
 * redrew them. The plugin therefore redraws the boards once the cache settles.
 *
 * Exactly once is the point. `MetadataCache`'s `resolved` event is not a
 * startup-only signal: Obsidian's own typings say it "will be fired each time
 * files get modified after the initial load". A listener that stayed
 * subscribed rebuilt every board — embedded editors included — on the autosave
 * that follows a pause in typing, which threw the caret and the scroll
 * position away under the user's hands (#475). Only the first resolution has
 * anything to catch up on; later metadata changes reach a board through the
 * vault-event live refresh, which is debounced and held while the user is
 * typing.
 *
 * Deliberately runtime-free, like `boardrefresh.ts`: the caller supplies the
 * refresh, so the policy — one refresh, then silence — is what a test can pin
 * without an Obsidian runtime.
 */
export function refreshOnceMetadataReady(refresh: () => void): () => void {
	let spent = false;
	return () => {
		if (spent) return;
		spent = true;
		refresh();
	};
}
