import { type App, TFile } from "obsidian";
import {
	MUSIC_DEFAULT_VOLUME,
	musicVolume,
	nextTrackIndex,
	previousTrackIndex,
	sanitizeMusicState,
	shuffledQueue,
	type MusicPlaybackState,
} from "./music";
import type { MusicRepeat } from "./types";

/**
 * Hearth's own playback store for tracks in the vault — the half of the music
 * card that must outlive the card.
 *
 * Why a store and not an `<audio>` element inside the card: `HomeView.render()`
 * rebuilds the whole board on any settings change, a polled refresh, or a resize
 * crossing, and every one of those would take the element with it — the music
 * would stop every time the user changed anything. So this mirrors what the
 * Stereo plugin does for its own player: one `<audio>` for the whole plugin,
 * owned here, and cards subscribe to its state. The element is kept in the
 * document (hidden) rather than detached so mobile webviews keep playing when
 * the app loses the foreground; it is still outside any card's DOM, which is the
 * part that matters.
 *
 * Framework-free on purpose: no Obsidian view, no HTMLElement from a card, only
 * `App` for resource paths and local storage. Playback state is written to local
 * storage (not `data.json`) for the same reason slideshow positions are — it is
 * not a setting, and syncing it would put merge conflicts through the layout.
 */

/** Local-storage key holding the last session's queue and playhead. */
const STATE_KEY = "hearth:music-state";

/** While playing, write the playhead at most this often. A `timeupdate` fires
 * around four times a second; without this every one of them would be a
 * local-storage write. */
const PERSIST_INTERVAL_SEC = 5;

/** What a card draws the player from. */
export interface PlayerState extends MusicPlaybackState {
	playing: boolean;
	/** Duration of the current track in seconds, 0 until it is known. */
	duration: number;
	/** Human-readable playback error, cleared by the next successful action. */
	error: string | null;
	/** Whether the queue is currently shuffled, so the button can say so. */
	shuffled: boolean;
}

type Listener = (state: Readonly<PlayerState>) => void;

class VaultAudioPlayer {
	private app: App | null = null;
	private audio: HTMLAudioElement | null = null;
	private listeners = new Set<Listener>();
	private state: PlayerState = {
		queue: [],
		index: -1,
		position: 0,
		duration: 0,
		volume: MUSIC_DEFAULT_VOLUME,
		repeat: "off",
		playing: false,
		error: null,
		shuffled: false,
	};
	/** The queue in its unshuffled order, so turning shuffle off can restore it. */
	private straight: string[] = [];
	private restored = false;
	private lastPersist = 0;

	/** Point the player at a vault and restore the previous session once. Called
	 * on every card render; only the first one does any work. */
	attach(app: App): void {
		this.app = app;
		if (this.restored) return;
		this.restored = true;
		const stored = sanitizeMusicState(app.loadLocalStorage(STATE_KEY));
		if (!stored) return;
		this.state = {
			...this.state,
			queue: stored.queue,
			index: stored.index,
			position: stored.position,
			volume: stored.volume,
			repeat: stored.repeat,
		};
		this.straight = stored.queue.slice();
	}

	getState(): Readonly<PlayerState> {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Seed the queue from a card's own list, but only when the player has nothing
	 * loaded. Two cards on one board share one player on purpose — a dashboard
	 * with two playlists is still one pair of speakers — so a card that renders
	 * while something is already queued must not take it over.
	 */
	adopt(app: App, paths: string[]): void {
		this.attach(app);
		if (this.state.queue.length > 0) return;
		if (paths.length === 0) return;
		this.straight = paths.slice();
		this.update({ queue: paths.slice(), index: 0, position: 0, duration: 0 });
		this.load(0);
	}

	async playAt(index: number): Promise<void> {
		if (index < 0 || index >= this.state.queue.length) return;
		this.update({ index, position: 0, error: null });
		this.load(index, true);
	}

	/** Play `index` out of a queue the calling card just resolved — used when its
	 * folder or list no longer matches what the player has queued (a track was
	 * dropped in, a file was renamed) and the click must still do the obvious
	 * thing. Shuffle is dropped: the new queue is the card's own order. */
	async playFrom(app: App, paths: string[], index: number): Promise<void> {
		if (paths.length === 0 || index < 0 || index >= paths.length) return;
		this.attach(app);
		this.straight = paths.slice();
		this.update({
			queue: paths.slice(),
			index,
			position: 0,
			duration: 0,
			shuffled: false,
			error: null,
		});
		this.load(index, true);
	}

	togglePlayPause(): void {
		const audio = this.element();
		if (this.state.index < 0) {
			if (this.state.queue.length === 0) return;
			void this.playAt(0);
			return;
		}
		if (audio.paused) void this.play();
		else this.pause();
	}

	async play(): Promise<void> {
		const audio = this.element();
		if (!this.state.queue[this.state.index]) return;
		try {
			await audio.play();
			this.update({ playing: true, error: null });
		} catch {
			// A refused play() is the platform's autoplay policy, not a broken
			// card: leave the transport on "play" and say nothing.
			this.update({ playing: false });
		}
	}

	pause(): void {
		this.element().pause();
		this.update({ playing: false });
		this.persist(true);
	}

	next(automatic = false): void {
		const index = nextTrackIndex({
			count: this.state.queue.length,
			index: this.state.index,
			repeat: this.state.repeat,
			automatic,
		});
		if (index < 0) {
			// The queue ran out with repeat off. Stop at the end of the last track
			// rather than silently looping back to the top.
			this.element().pause();
			this.update({ playing: false, position: 0 });
			this.persist(true);
			return;
		}
		if (index === this.state.index) {
			// Repeat-one, or a "next" pressed on the last track: restart it.
			this.seek(0);
			void this.play();
			return;
		}
		this.update({ index, position: 0, duration: 0, error: null });
		this.load(index, true);
	}

	previous(): void {
		const index = previousTrackIndex({
			count: this.state.queue.length,
			index: this.state.index,
			repeat: this.state.repeat,
			automatic: false,
			position: this.state.position,
		});
		if (index < 0) return;
		if (index === this.state.index) {
			this.seek(0);
			void this.play();
			return;
		}
		this.update({ index, position: 0, duration: 0, error: null });
		this.load(index, true);
	}

	seek(seconds: number): void {
		const audio = this.element();
		const duration = this.state.duration;
		if (!Number.isFinite(seconds) || duration <= 0) return;
		const position = Math.min(Math.max(seconds, 0), duration);
		try {
			audio.currentTime = position;
		} catch {
			// Some platforms refuse a seek before metadata is ready; the playhead
			// simply stays where it was and the next timeupdate corrects the UI.
			return;
		}
		this.update({ position });
	}

	setVolume(volume: number): void {
		const next = musicVolume(volume);
		this.element().volume = next;
		this.update({ volume: next });
		this.persist(true);
	}

	cycleRepeat(): void {
		const order: MusicRepeat[] = ["off", "all", "one"];
		const at = order.indexOf(this.state.repeat);
		this.update({ repeat: order[(at + 1) % order.length] });
		this.persist(true);
	}

	/** Shuffle the queue, keeping whatever is playing in front of it. */
	shuffle(): void {
		const { queue, index } = this.state;
		if (queue.length < 2) return;
		if (this.state.shuffled) {
			// Leaving shuffle restores the order the card gave us, with the current
			// track still where the user is looking.
			const current = queue[index];
			const restored = this.straight.slice();
			const at = restored.indexOf(current);
			this.update({ queue: restored, index: at >= 0 ? at : 0, shuffled: false });
			return;
		}
		const current = queue[index];
		const rest = shuffledQueue(queue.filter((_, i) => i !== index));
		const shuffled = index >= 0 && current ? [current, ...rest] : rest;
		this.update({ queue: shuffled, index: index >= 0 ? 0 : -1, shuffled: true });
	}

	destroy(): void {
		this.audio?.pause();
		this.audio?.remove();
		this.audio = null;
		this.listeners.clear();
		this.app = null;
		this.restored = false;
		this.state = {
			queue: [],
			index: -1,
			position: 0,
			duration: 0,
			volume: MUSIC_DEFAULT_VOLUME,
			repeat: "off",
			playing: false,
			error: null,
			shuffled: false,
		};
		this.straight = [];
	}

	/** The one `<audio>` element. Created on first use and parked in the document
	 * (hidden) so a mobile webview keeps it alive while the app is backgrounded. */
	private element(): HTMLAudioElement {
		if (this.audio) return this.audio;
		const audio = new Audio();
		audio.preload = "metadata";
		audio.addClass("hearth-music-audio");
		audio.volume = this.state.volume;
		audio.addEventListener("play", () => this.update({ playing: true }));
		audio.addEventListener("pause", () => this.update({ playing: false }));
		audio.addEventListener("ended", () => this.next(true));
		audio.addEventListener("loadedmetadata", () => {
			const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
			this.update({ duration });
		});
		audio.addEventListener("timeupdate", () => {
			this.update({ position: audio.currentTime });
			this.persist(false);
		});
		audio.addEventListener("error", () => {
			const code = audio.error?.code;
			this.update({ playing: false, error: `playback-error-${code ?? 0}` });
		});
		document.body.appendChild(audio);
		this.audio = audio;
		return audio;
	}

	/** Point the element at the track at `index`. */
	private load(index: number, autoplay = false): void {
		const app = this.app;
		const path = this.state.queue[index];
		if (!app || !path) return;
		const file = app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			this.update({ error: "missing-file", playing: false });
			return;
		}
		const audio = this.element();
		audio.src = app.vault.getResourcePath(file);
		// A restore should not reach for the network until the user asks for it;
		// metadata is enough to know how long the track is.
		if (this.state.position > 0 && !autoplay) {
			const seekTo = this.state.position;
			this.audio?.addEventListener(
				"loadedmetadata",
				() => {
					if (this.audio) this.audio.currentTime = seekTo;
				},
				{ once: true },
			);
		}
		if (autoplay) void this.play();
	}

	private update(patch: Partial<PlayerState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
	}

	/** Write the session. Throttled while playing; forced on a deliberate action
	 * (pause, seek, volume, repeat) so a closed app doesn't lose the last few
	 * seconds of a decision. */
	private persist(force: boolean): void {
		const app = this.app;
		if (!app) return;
		if (this.state.queue.length === 0) return;
		const now = Date.now();
		if (!force && now - this.lastPersist < PERSIST_INTERVAL_SEC * 1000) return;
		this.lastPersist = now;
		const snapshot: MusicPlaybackState = {
			queue: this.state.queue,
			index: this.state.index,
			position: this.state.position,
			volume: this.state.volume,
			repeat: this.state.repeat,
		};
		app.saveLocalStorage(STATE_KEY, snapshot);
	}
}

let player: VaultAudioPlayer | null = null;

/** The plugin-wide player. Created on first use; never more than one. */
export function vaultPlayer(): VaultAudioPlayer {
	player ??= new VaultAudioPlayer();
	return player;
}

/** Tear the player down (plugin unload). Safe to call when it never started. */
export function disposeVaultPlayer(): void {
	player?.destroy();
	player = null;
}
