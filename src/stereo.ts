import type { App } from "obsidian";

/**
 * The bridge to the Stereo plugin (Navidrome / Subsonic / Airsonic / Gonic),
 * which is the source the music card hands playback to when the user picks it.
 *
 * Reading the truth from Stereo rather than reimplementing it is the whole point
 * of that source: Stereo already browses the library, queues albums, scrobbles,
 * fetches lyrics and keeps one `<audio>` for the plugin. The card only renders a
 * remote control over Stereo's own `PlayerStore`, so the two never disagree
 * about what is playing.
 *
 * `PlayerStore` is a plain framework-free class on the plugin instance — public
 * as `plugin.player`, with `subscribe`, `getState` and the transport methods. So
 * this is a thin, defensive facade: every call can meet a version of Stereo that
 * changed shape, a disabled plugin, or an instance still loading, and none of
 * those may take the board down. Hence the optional members and the null
 * returns instead of throws — the same stance `tasknotes.ts` takes.
 */

/** Community plugin id, and the key of its entry in the Integrations tab. */
export const STEREO_PLUGIN_ID = "stereo";

/** Mirror of Stereo's own repeat modes, which are not Hearth's: it repeats the
 * queue or the track, where the vault player repeats "all" or "one". */
export type StereoRepeatMode = "off" | "queue" | "track";

/** The parts of Stereo's `Song` this card shows. */
export interface StereoSong {
	id: string;
	title: string;
	artist?: string;
	album?: string;
	/** Opaque cover-art id, to be passed straight to `coverArtUrl`. */
	coverArt?: string;
	duration?: number;
}

/** The parts of Stereo's `PlayerState` this card reads. */
export interface StereoPlayerState {
	queue: StereoSong[];
	index: number;
	track: StereoSong | null;
	playing: boolean;
	position: number;
	duration: number;
	volume: number;
	repeat: StereoRepeatMode;
	error: string | null;
}

/** Stereo's playback store, as far as this card uses it. */
export interface StereoPlayerLike {
	subscribe(listener: (state: Readonly<StereoPlayerState>) => void): () => void;
	getState(): Readonly<StereoPlayerState>;
	togglePlayPause(): Promise<void>;
	next(): Promise<void>;
	previous(): Promise<void>;
	seek(seconds: number): void;
	setVolume(volume: number): void;
	cycleRepeat(): void;
	playAt(index: number): Promise<void>;
}

/** The parts of Stereo's plugin instance this card touches. */
export interface StereoPluginLike {
	player?: StereoPlayerLike;
	/** Stereo's Subsonic client. Used only to build a cover-art URL — the card
	 * never makes requests of its own. */
	client?: { coverArtUrl?(coverArtId: string, size?: number): string };
	settings?: { serverUrl?: string };
}

/** Stereo's plugin instance, or null when it is not loaded. Never throws:
 * `app.plugins` is an Obsidian internal and this runs during a board render. */
export function stereoPlugin(app: App): StereoPluginLike | null {
	try {
		return (app.plugins?.plugins?.[STEREO_PLUGIN_ID] as StereoPluginLike | undefined) ?? null;
	} catch {
		return null;
	}
}

/**
 * Whether the Stereo source can play anything, and if not, what is missing:
 * the plugin itself, or a server it has not been pointed at yet. The card says
 * which — "install Stereo" and "configure Stereo" are different problems.
 */
export function stereoStatus(app: App): "ready" | "unconfigured" | "missing" {
	const plugin = stereoPlugin(app);
	if (!plugin?.player) return "missing";
	const server = plugin.settings?.serverUrl?.trim() ?? "";
	if (server === "") return "unconfigured";
	return "ready";
}

/**
 * A cover-art URL for a song, or null when the song has no art or the plugin is
 * gone. Built by Stereo's own client so the URL carries whatever auth the
 * server needs — the card never assembles Subsonic URLs itself.
 */
export function stereoCoverUrl(app: App, song: StereoSong | null, size = 256): string | null {
	if (!song?.coverArt) return null;
	const client = stereoPlugin(app)?.client;
	if (!client || typeof client.coverArtUrl !== "function") return null;
	try {
		return client.coverArtUrl(song.coverArt, size) ?? null;
	} catch {
		return null;
	}
}

/** Pretty label for a repeat mode, given the locale's three strings. Kept here
 * so the mapping lives beside the mode type it maps. */
export function stereoRepeatLabel(
	mode: StereoRepeatMode,
	labels: { off: string; queue: string; track: string },
): string {
	if (mode === "queue") return labels.queue;
	if (mode === "track") return labels.track;
	return labels.off;
}
