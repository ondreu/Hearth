import type { VaultEvent } from "./cardevents";
import { inSlideshowFolder, normalizeFolderPath } from "./slideshow";
import type { DashboardCard, MusicConfig, MusicLook, MusicRepeat, MusicSource } from "./types";

/**
 * The music card's pure half: which files count as tracks, where a card takes
 * them from, what "next" and "previous" mean under each repeat mode, how a
 * position is written as time, and which vault events are worth a redraw.
 * Data in, data out — no vault, no DOM, no Obsidian imports at all — so all of
 * it is unit-tested in test/music.test.ts.
 *
 * Same reason `slideshow.ts` sits outside `cards/`: the card module imports the
 * settings-modal helpers, which import the card registry, which imports the
 * card module — a cycle a test importing the card module walks straight into.
 */

/** Extensions a `<audio>` element can be pointed at. Kept in step with the
 * "Audio" group in filetypes.ts, minus `3gp` — an audio container that no music
 * folder actually holds and that some platforms refuse to play. Ogg/opus are
 * deliberately included: they play on desktop and Android, and a track that a
 * phone refuses is a playback error the card reports, not a file it hides. */
export const MUSIC_AUDIO_EXTENSIONS = [
	"mp3",
	"m4a",
	"aac",
	"wav",
	"flac",
	"ogg",
	"opus",
] as const;

/** The sources offered in the editor, in dropdown order: two that read the
 * vault and one that hands playback to the Stereo plugin. */
export const MUSIC_SOURCES: MusicSource[] = ["folder", "list", "stereo"];

/** The repeat modes, in the order the button cycles through them. */
export const MUSIC_REPEATS: MusicRepeat[] = ["off", "all", "one"];

/** The layouts offered in the editor, in dropdown order: the classic row, the
 * half-and-half arrangement, then the two artwork-led ones. */
export const MUSIC_LOOKS: MusicLook[] = ["plain", "medium", "cover", "panel"];

/** Volume a card starts at (and restores to) unless it was left elsewhere. */
export const MUSIC_DEFAULT_VOLUME = 0.8;

/** Most queue rows a card draws. A folder of 500 tracks would otherwise build
 * 500 buttons on every board render; the card says how many it left out rather
 * than pretending the list ended. */
export const MUSIC_QUEUE_LIMIT = 300;

/** Pressing "previous" later than this into a track restarts it instead of
 * stepping back — the behaviour every player has, and the reason the button
 * needs the playhead at all. */
export const MUSIC_RESTART_AFTER_SEC = 3;

/** Whether a vault path is a file the player can be pointed at. */
export function isAudioPath(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return (MUSIC_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/** Where the card takes its tracks from. Defaults to a folder: the common case
 * is "play the album directory I dropped in the vault", and a list card with no
 * entries yet would open empty. */
export function musicSource(cfg: MusicConfig | undefined): MusicSource {
	const source = cfg?.source;
	return source === "list" || source === "stereo" ? source : "folder";
}

/** The repeat mode a card is in. Anything unrecognised (a hand-edited
 * data.json, a value from a later version) reads as "off". */
export function musicRepeat(value: MusicRepeat | undefined): MusicRepeat {
	return value === "all" || value === "one" ? value : "off";
}

/**
 * The layout a card is drawn in. Defaults to "plain" — the arrangement the card
 * shipped with, so a card saved before the setting existed looks unchanged.
 *
 * "record" and "bars" are the pre-release names of the two artwork-led layouts.
 * They only ever existed in an unreleased build, but a card saved against it
 * would otherwise snap back to Classic, so they read as the layouts they became.
 */
export function musicLook(cfg: MusicConfig | undefined): MusicLook {
	const look = cfg?.look as string | undefined;
	if (look === "medium" || look === "cover" || look === "panel") return look;
	if (look === "record") return "cover";
	if (look === "bars") return "panel";
	return "plain";
}

/** A volume between 0 and 1. A missing or nonsense value reads as the default:
 * a card that started silent would look broken rather than quiet. */
export function musicVolume(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return MUSIC_DEFAULT_VOLUME;
	return Math.min(Math.max(value, 0), 1);
}

/** Whether the card lists the queue under the transport. Default true: a player
 * that hides what it is going to play next is a mystery. */
export function musicShowsQueue(cfg: MusicConfig | undefined): boolean {
	return cfg?.showQueue !== false;
}

/** Whether the card lists subfolders as albums instead of one queue of every
 * track. Only meaningful with `includeSubfolders` on, which is what puts the
 * subfolders in reach at all. */
export function musicAlbums(cfg: MusicConfig | undefined): boolean {
	return cfg?.albums === true && cfg.includeSubfolders === true;
}

/** A path relative to the card's folder, or the path itself when it lies
 * outside it. */
function relativeToFolder(path: string, folder: string | undefined): string {
	const scope = normalizeFolderPath(folder);
	if (scope === "") return path;
	return path.startsWith(`${scope}/`) ? path.slice(scope.length + 1) : path;
}

/** The album a track belongs to: its first folder under the card's own folder.
 * A track sitting directly in the card's folder has no album (`""`). */
export function albumOf(path: string, folder: string | undefined): string {
	const relative = relativeToFolder(path, folder);
	const slash = relative.indexOf("/");
	return slash > 0 ? relative.slice(0, slash) : "";
}

/** One run of neighbouring tracks that share an album, in queue order. */
export interface AlbumSection {
	/** Album name, or `""` for tracks loose in the card's folder. */
	album: string;
	/** Index of the section's first track in the queue. */
	start: number;
	/** How many tracks the section holds. */
	count: number;
}

/** Group tracks into album sections in the order they are in. Two neighbouring
 * tracks with the same album share one section — what turns an album-ordered
 * list into album rows (see {@link albumEntries}). */
export function albumSections(paths: readonly string[], folder: string | undefined): AlbumSection[] {
	const sections: AlbumSection[] = [];
	for (const [index, path] of paths.entries()) {
		const album = albumOf(path, folder);
		const last = sections[sections.length - 1];
		if (last && last.album === album) last.count += 1;
		else sections.push({ album, start: index, count: 1 });
	}
	return sections;
}

/** Compare two paths the way a track list should read: `02` before `10`, and
 * `CD1/…` before `CD2/…`. */
function byPath(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Order tracks album by album: albums by name, the tracks inside one album by
 * path (so a `CD1`/`CD2` album keeps its disc order), and files loose in the
 * card's folder last. This is what keeps a folder of albums from interleaving —
 * a plain name sort puts track `01` of every album next to each other.
 */
export function albumOrder(paths: readonly string[], folder: string | undefined): string[] {
	const groups = new Map<string, string[]>();
	for (const path of paths) {
		const album = albumOf(path, folder);
		const group = groups.get(album);
		if (group) group.push(path);
		else groups.set(album, [path]);
	}
	const names = [...groups.keys()].sort((a, b) => {
		if (a === b) return 0;
		// Loose tracks are not an album, so they come after the named ones.
		if (a === "") return 1;
		if (b === "") return -1;
		return a.localeCompare(b, undefined, { numeric: true });
	});
	const ordered: string[] = [];
	for (const name of names) ordered.push(...(groups.get(name) ?? []).slice().sort(byPath));
	return ordered;
}

/** One album in the card's browser: the subfolder, and the tracks in it. */
export interface AlbumEntry {
	/** Album name, or `""` for tracks loose in the card's folder. */
	album: string;
	/** The album's tracks, in play order (path order, so CDs stay in order). */
	paths: string[];
}

/** Group a folder's tracks into the albums its subfolders make, in name order,
 * with the tracks loose in the folder last. This is the list the albums view
 * opens: no album holds another album's tracks, and each album's own tracks are
 * already in the order they should play. */
export function albumEntries(paths: readonly string[], folder: string | undefined): AlbumEntry[] {
	const ordered = albumOrder(paths, folder);
	return albumSections(ordered, folder).map((section) => ({
		album: section.album,
		paths: ordered.slice(section.start, section.start + section.count),
	}));
}

/** Whether two track lists hold the same tracks, in any order — a shuffled
 * queue is the card's own tracks, just not in the card's order. */
export function sameTrackSet(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return set.size === a.length && b.every((path) => set.has(path));
}

/**
 * Where the playhead lands after a card's tracks changed: on the same track
 * when it survived, otherwise on the first one — and in that case the caller
 * must not carry the old playhead over, because it belongs to a file that is no
 * longer queued.
 */
export function carryOverIndex(
	paths: readonly string[],
	current: string | undefined,
): { index: number; keepsPlaying: boolean } {
	const at = current === undefined ? -1 : paths.indexOf(current);
	return at >= 0 ? { index: at, keepsPlaying: true } : { index: 0, keepsPlaying: false };
}

/** A track's display name: the file name without its extension. Deliberately
 * not ID3 metadata — reading tags would mean a decoder (or a dependency) for a
 * card that gets the artist out of the file name well enough, and a tag reader
 * is the one thing that would make this feature big. */
export function trackLabel(path: string): string {
	const base = path.split("/").pop() ?? path;
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(0, dot) : base;
}

/** Seconds as `m:ss`, or `h:mm:ss` past an hour. Unknown durations render as an
 * empty string rather than "0:00", so a track that has not loaded yet doesn't
 * claim to be zero seconds long. */
export function formatTrackTime(seconds: number | undefined): string {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** What a step through the queue needs to know. */
export interface TrackStep {
	/** How many tracks the queue holds. */
	count: number;
	/** Index of the track playing now, or -1 when nothing is queued. */
	index: number;
	repeat: MusicRepeat;
	/** True when the track ended on its own; false for a button press. */
	automatic: boolean;
}

/**
 * The next track to play, or -1 when playback should stop.
 *
 * The two cases differ on purpose. A track that *ended* under `repeat: all`
 * wraps to the top and under `repeat: one` repeats itself (that is what the mode
 * means); under `off` it stops, which is what tells the player to clear
 * "playing" instead of starting the first track again. A *button press* at the
 * last track instead stays where it is under `off` — jumping back to the top on
 * a deliberate "next" is the behaviour nobody wants.
 */
export function nextTrackIndex(step: TrackStep): number {
	const { count, index, repeat, automatic } = step;
	if (count <= 0) return -1;
	if (index < 0) return 0;
	if (automatic && repeat === "one") return index;
	const next = index + 1;
	if (next < count) return next;
	if (repeat === "all") return 0;
	return automatic ? -1 : index;
}

/**
 * The track "previous" goes to: the current one again when the playhead is past
 * {@link MUSIC_RESTART_AFTER_SEC} (or the caller doesn't say), otherwise the one
 * before it, wrapping under `repeat: all` and stopping at the first track
 * otherwise.
 */
export function previousTrackIndex(step: TrackStep & { position?: number }): number {
	const { count, index, repeat } = step;
	if (count <= 0) return -1;
	if (index < 0) return 0;
	const position = step.position ?? 0;
	if (position > MUSIC_RESTART_AFTER_SEC) return index;
	const previous = index - 1;
	if (previous >= 0) return previous;
	return repeat === "all" ? count - 1 : 0;
}

/** Fisher-Yates over a copy. The queue's own order is never mutated in place:
 * turning shuffle off has to be able to restore it, and a queue read from
 * localStorage is shared with the card that wrote it. */
export function shuffledQueue<T>(items: readonly T[], random: () => number = Math.random): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Whether `path` is the folder scope itself or one of its ancestors — the
 * shapes a rename can take that move the whole scope somewhere else. */
function touchesFolderScope(folder: string | undefined, path: string): boolean {
	const scope = normalizeFolderPath(folder);
	if (scope === "") return false;
	return scope === path || scope.startsWith(`${path}/`);
}

/** Whether a vault event can change what this card plays. A track was added to
 * or removed from the folder (or the list), or the folder itself was renamed or
 * deleted — but an edit to an unrelated note is not worth redrawing the card,
 * and a playhead must not be disturbed by one. */
export function musicReactsTo(card: DashboardCard, ev: VaultEvent): boolean {
	// The stereo source reads another plugin's queue, which changes through that
	// plugin's own store, never through a vault event.
	const cfg = card.music ?? {};
	const source = musicSource(cfg);
	if (source === "stereo") return false;
	if (ev.kind === "modify" || ev.kind === "meta") return false;
	const paths = ev.oldPath ? [ev.file.path, ev.oldPath] : [ev.file.path];
	if (source === "folder") {
		return paths.some(
			(path) =>
				(inSlideshowFolder(cfg.folder, path, cfg.includeSubfolders === true) && isAudioPath(path)) ||
				touchesFolderScope(cfg.folder, path),
		);
	}
	const listed = cfg.tracks ?? [];
	return paths.some(
		(path) => listed.some((entry) => entry === path || entry.startsWith(`${path}/`)),
	);
}

/**
 * What the player remembers between sessions. Deliberately not a card setting:
 * where the playhead is is not configuration, and writing it into `data.json`
 * would put sync traffic (and merge conflicts) through the layout every few
 * seconds — the same reasoning that keeps slideshow positions in local storage.
 */
export interface MusicPlaybackState {
	/** Vault paths of the queue, in play order. */
	queue: string[];
	/** Index of the current track, or -1 when the queue is empty. */
	index: number;
	/** Playhead of the current track, in seconds. */
	position: number;
	/** 0..1 */
	volume: number;
	repeat: MusicRepeat;
}

/** Allowlist and clamp a stored playback state. Returns null when there is
 * nothing usable in it, so the player starts from the card's own queue instead
 * of restoring a half-written entry. */
export function sanitizeMusicState(raw: unknown): MusicPlaybackState | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!Array.isArray(r.queue)) return null;
	const queue = r.queue.filter((entry): entry is string => typeof entry === "string" && entry !== "");
	if (queue.length === 0) return null;
	const index =
		typeof r.index === "number" && Number.isFinite(r.index)
			? Math.min(Math.max(Math.floor(r.index), 0), queue.length - 1)
			: 0;
	const position =
		typeof r.position === "number" && Number.isFinite(r.position) && r.position > 0 ? r.position : 0;
	return {
		queue,
		index,
		position,
		volume: musicVolume(typeof r.volume === "number" ? r.volume : undefined),
		repeat: musicRepeat(r.repeat as MusicRepeat | undefined),
	};
}
