import { type App, type Component, Setting, TFile, TFolder } from "obsidian";
import { type PlayerState, vaultPlayer } from "../audioplayer";
import { emptyState } from "../cardbodies";
import { setIcon } from "../glyphs";
import { t } from "../i18n";
import {
	MUSIC_LOOKS,
	MUSIC_QUEUE_LIMIT,
	MUSIC_SOURCES,
	formatTrackTime,
	isAudioPath,
	musicLook,
	musicReactsTo,
	musicShowsQueue,
	musicSource,
	trackLabel,
} from "../music";
import { FilePickerModal, FolderPickerModal } from "../pickers";
import { normalizeFolderPath } from "../slideshow";
import {
	stereoCoverUrl,
	stereoPlugin,
	stereoRepeatLabel,
	stereoStatus,
	type StereoPlayerState,
} from "../stereo";
import {
	type DashboardCard,
	type MusicConfig,
	type MusicLook,
	type MusicRepeat,
	type MusicSource,
} from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Track collection ---------------------------------------------------

/** Every audio file in a folder (and, when asked, its subfolders), in name
 * order. Name order rather than the vault's child order because a folder of
 * albums should read as `01 …`, `02 …`, not as whatever order the file system
 * happens to hand back. */
function folderTracks(app: App, folder: string | undefined, includeSubfolders: boolean): TFile[] {
	const scope = normalizeFolderPath(folder);
	const root = scope === "" ? app.vault.getRoot() : app.vault.getAbstractFileByPath(scope);
	if (!(root instanceof TFolder)) return [];

	const tracks: TFile[] = [];
	const walk = (dir: TFolder) => {
		for (const child of dir.children) {
			if (child instanceof TFolder) {
				if (includeSubfolders) walk(child);
				continue;
			}
			if (child instanceof TFile && isAudioPath(child.path)) tracks.push(child);
		}
	};
	walk(root);
	return tracks.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));
}

/** The tracks a card plays right now: its folder, or the files still present
 * from its hand-picked list (a path that has since been deleted is dropped
 * rather than rendered as a row that can only fail). */
function collectTracks(app: App, cfg: MusicConfig): TFile[] {
	if (musicSource(cfg) === "list") {
		const tracks: TFile[] = [];
		for (const path of cfg.tracks ?? []) {
			const file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile && isAudioPath(file.path)) tracks.push(file);
		}
		return tracks;
	}
	return folderTracks(app, cfg.folder, cfg.includeSubfolders === true);
}


// ---- Player chrome -----------------------------------------------------

/**
 * Everything both sources draw, built once per card render and then only
 * *updated*. The distinction matters: a `timeupdate` fires about four times a
 * second, so a paint that rebuilt the DOM would restart the record's spin and
 * throw away the user's drag on the seek bar several times a second.
 *
 * The element set is the same in every layout — only where those elements sit
 * differs. That is what lets one paint function drive four layouts and both
 * sources.
 */
interface Chrome {
	art: HTMLElement;
	title: HTMLElement;
	sub: HTMLElement;
	seek: HTMLInputElement;
	elapsed: HTMLElement;
	total: HTMLElement;
	play: HTMLButtonElement;
	previous: HTMLButtonElement;
	next: HTMLButtonElement;
	shuffle: HTMLButtonElement;
	repeat: HTMLButtonElement;
	volume: HTMLInputElement;
	status: HTMLElement;
	list: HTMLElement | null;
	layout: MusicLook;
}

/** The state a chrome paint is drawn from, whichever source produced it. */
interface NowPlaying {
	title: string;
	sub: string;
	playing: boolean;
	position: number;
	duration: number;
	/** Lucide glyph for the repeat button ("repeat", "repeat-1"). */
	repeatIcon: string;
	/** Tooltip / accessible name for that button. */
	repeatTitle: string;
	shuffleOn: boolean;
	volume: number;
	error: string | null;
	/** Identity of the artwork — a track change rebuilds it, a timeupdate does
	 * not. */
	artKey: string;
	coverUrl: string | null;
}

function iconButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	cls: string,
): HTMLButtonElement {
	const button = parent.createEl("button", {
		cls: `hearth-music-btn ${cls}`,
		attr: { type: "button", "aria-label": label, title: label },
	});
	setIcon(button, icon);
	return button;
}

/** Title and subtitle. Every layout places this block differently; none of them
 * changes what is in it. */
function metaBlock(parent: HTMLElement): { title: HTMLElement; sub: HTMLElement } {
	const meta = parent.createDiv("hearth-music-meta");
	return {
		title: meta.createDiv("hearth-music-title"),
		sub: meta.createDiv("hearth-music-sub"),
	};
}

function progressBlock(parent: HTMLElement): {
	elapsed: HTMLElement;
	seek: HTMLInputElement;
	total: HTMLElement;
} {
	const strings = t().cards.music;
	const progress = parent.createDiv("hearth-music-progress");
	const elapsed = progress.createDiv("hearth-music-time is-elapsed");
	const seek = progress.createEl("input", {
		cls: "hearth-music-seek",
		attr: {
			type: "range",
			min: "0",
			max: "1000",
			step: "1",
			value: "0",
			"aria-label": strings.seek,
		},
	});
	const total = progress.createDiv("hearth-music-time is-total");
	return { elapsed, seek, total };
}

function transportBlock(parent: HTMLElement): {
	play: HTMLButtonElement;
	previous: HTMLButtonElement;
	next: HTMLButtonElement;
	shuffle: HTMLButtonElement;
	repeat: HTMLButtonElement;
	volume: HTMLInputElement;
} {
	const strings = t().cards.music;
	const transport = parent.createDiv("hearth-music-transport");
	const previous = iconButton(transport, "skip-back", strings.previous, "is-step");
	const play = iconButton(transport, "play", strings.play, "is-play");
	const next = iconButton(transport, "skip-forward", strings.next, "is-step");
	const tools = transport.createDiv("hearth-music-tools");
	const shuffle = iconButton(tools, "shuffle", strings.shuffle, "is-tool");
	const repeat = iconButton(tools, "repeat", strings.repeat, "is-tool");
	const volume = tools.createEl("input", {
		cls: "hearth-music-volume",
		attr: {
			type: "range",
			min: "0",
			max: "100",
			step: "1",
			value: "80",
			"aria-label": strings.volume,
		},
	});
	return { play, previous, next, shuffle, repeat, volume };
}

/**
 * Build the card's DOM for one layout.
 *
 * The four layouts are genuinely different arrangements, not four skins of the
 * same row:
 *
 * - **classic** — a small artwork chip, the title beside it, the transport
 *   under it, and the queue filling whatever height is left (the layout the
 *   card shipped with).
 * - **medium** — a square artwork on the left with the details and transport
 *   stacked beside it, so a short, wide card uses its width instead of its
 *   height.
 * - **cover** — the artwork *is* the card: it fills the whole body and the
 *   details and transport sit on a scrim along the bottom edge.
 * - **panel** — the artwork takes the left half at full height, the right half
 *   carries the details, the transport and the queue.
 *
 * Which one suits a given card is a question about the card's size, so the
 * editor offers the choice and CSS (container queries) tidies each layout up at
 * small sizes: the queue and then the seek row drop out as height runs out,
 * rather than the card clipping them halfway.
 */
function buildChrome(body: HTMLElement, layout: MusicLook, showQueue: boolean): Chrome {
	body.addClass("hearth-music");
	body.addClass(`is-layout-${layout}`);

	// Created once and moved into whichever container the layout wants.
	const art = body.createDiv("hearth-music-art");
	let meta: ReturnType<typeof metaBlock>;
	let progress: ReturnType<typeof progressBlock>;
	let transport: ReturnType<typeof transportBlock>;
	let list: HTMLElement | null = null;

	if (layout === "cover") {
		const stage = body.createDiv("hearth-music-stage");
		stage.appendChild(art);
		stage.createDiv("hearth-music-scrim");
		const overlay = stage.createDiv("hearth-music-overlay");
		meta = metaBlock(overlay);
		progress = progressBlock(overlay);
		transport = transportBlock(overlay);
	} else if (layout === "medium") {
		const main = body.createDiv("hearth-music-main");
		main.appendChild(art);
		const side = main.createDiv("hearth-music-side");
		meta = metaBlock(side);
		progress = progressBlock(side);
		transport = transportBlock(side);
		if (showQueue) list = body.createDiv("hearth-music-queue");
	} else if (layout === "panel") {
		const split = body.createDiv("hearth-music-split");
		const stage = split.createDiv("hearth-music-stage");
		stage.appendChild(art);
		const side = split.createDiv("hearth-music-side");
		meta = metaBlock(side);
		progress = progressBlock(side);
		transport = transportBlock(side);
		if (showQueue) list = side.createDiv("hearth-music-queue");
	} else {
		const now = body.createDiv("hearth-music-now");
		now.appendChild(art);
		meta = metaBlock(now);
		progress = progressBlock(body);
		transport = transportBlock(body);
		if (showQueue) list = body.createDiv("hearth-music-queue");
	}

	const status = body.createDiv("hearth-music-status");
	return {
		art,
		title: meta.title,
		sub: meta.sub,
		seek: progress.seek,
		elapsed: progress.elapsed,
		total: progress.total,
		play: transport.play,
		previous: transport.previous,
		next: transport.next,
		shuffle: transport.shuffle,
		repeat: transport.repeat,
		volume: transport.volume,
		status,
		list,
		layout,
	};
}

/**
 * Rebuild the artwork only when the track changed. `is-playing` is toggled
 * separately so the record's CSS animation starts and stops with playback — and,
 * being a CSS animation, is frozen by the board's motion gate as well.
 *
 * The vault source has no album art; the stand-in is a record for the layouts
 * where the artwork is the point (cover, panel, medium) and a small glyph for
 * the classic arrangement, which is a row of text with a chip beside it.
 */
function paintArt(chrome: Chrome, now: NowPlaying): void {
	const key = `${now.artKey}|${now.coverUrl ? "cover" : chrome.layout}`;
	if (chrome.art.dataset.key !== key) {
		chrome.art.dataset.key = key;
		chrome.art.empty();
		if (now.coverUrl) {
			const img = chrome.art.createEl("img", { cls: "hearth-music-cover" });
			img.src = now.coverUrl;
			img.alt = "";
			img.draggable = false;
		} else if (chrome.layout === "plain") {
			setIcon(chrome.art, "music");
		} else {
			const disc = chrome.art.createDiv("hearth-music-disc");
			disc.createDiv("hearth-music-disc-label");
			disc.createDiv("hearth-music-disc-hole");
		}
	}
	chrome.art.toggleClass("is-playing", now.playing);
}

/** Everything except the artwork and the queue. Cheap by design: it is called
 * on every state change, including four times a second while a track plays. */
function paintChrome(chrome: Chrome, now: NowPlaying, seeking: () => boolean): void {
	chrome.title.setText(now.title);
	chrome.sub.setText(now.sub);
	chrome.play.empty();
	setIcon(chrome.play, now.playing ? "pause" : "play");
	chrome.play.setAttribute("aria-label", now.playing ? t().cards.music.pause : t().cards.music.play);
	chrome.play.setAttribute("title", now.playing ? t().cards.music.pause : t().cards.music.play);

	const duration = now.duration > 0 ? now.duration : 0;
	const position = Math.min(now.position, duration || now.position);
	chrome.elapsed.setText(formatTrackTime(position));
	chrome.total.setText(duration > 0 ? formatTrackTime(duration) : "");
	// A thumb under the pointer belongs to the user until they let go.
	if (!seeking()) {
		chrome.seek.value = String(duration > 0 ? Math.round((position / duration) * 1000) : 0);
	}
	chrome.seek.disabled = duration <= 0;

	chrome.repeat.empty();
	setIcon(chrome.repeat, now.repeatIcon);
	chrome.repeat.setAttribute("aria-label", now.repeatTitle);
	chrome.repeat.setAttribute("title", now.repeatTitle);
	chrome.repeat.toggleClass("is-on", now.repeatIcon !== "repeat");
	chrome.shuffle.toggleClass("is-on", now.shuffleOn);
	chrome.volume.value = String(Math.round(now.volume * 100));

	chrome.status.setText(now.error ?? "");
	chrome.status.toggleClass("is-shown", now.error !== null);
}

/** One row of the queue. */
interface QueueEntry {
	/** Stable identity — the vault path, or the song id. */
	key: string;
	label: string;
	sub?: string;
	/** The row that is playing now. */
	current: boolean;
}

/** Paint the queue. Rows are rebuilt only when the set of tracks changes (or
 * grows past the cap), so a redraw of the highlight costs nothing and a click
 * handler never outlives the row it was attached to. */
function paintQueue(
	list: HTMLElement | null,
	entries: QueueEntry[],
	onPick: (index: number) => void,
): void {
	if (!list) return;
	const shown = entries.slice(0, MUSIC_QUEUE_LIMIT);
	const signature = `${entries.length}:${shown.map((entry) => entry.key).join("|")}`;
	if (list.dataset.signature !== signature) {
		list.dataset.signature = signature;
		list.empty();
		shown.forEach((entry, index) => {
			const row = list.createEl("button", {
				cls: "hearth-music-row",
				attr: { type: "button" },
			});
			const text = row.createDiv("hearth-music-row-text");
			text.createDiv({ cls: "hearth-music-row-label", text: entry.label });
			if (entry.sub) text.createDiv({ cls: "hearth-music-row-sub", text: entry.sub });
			row.addEventListener("click", () => onPick(index));
		});
		if (entries.length > shown.length) {
			list.createDiv({
				cls: "hearth-music-row-more",
				text: t().cards.music.moreTracks(shown.length, entries.length),
			});
		}
	}
	const rows = list.querySelectorAll<HTMLElement>(".hearth-music-row");
	rows.forEach((row, index) => row.toggleClass("is-current", shown[index]?.current === true));
}


// ---- Vault source ------------------------------------------------------

function renderVaultSource(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
	cfg: MusicConfig,
): void {
	const files = collectTracks(view.app, cfg);
	if (files.length === 0) {
		emptyState(
			body,
			"music",
			musicSource(cfg) === "folder"
				? t().cards.empty.musicFolderEmpty
				: t().cards.empty.musicEmpty,
		);
		return;
	}

	const paths = files.map((file) => file.path);
	const player = vaultPlayer();
	player.attach(view.app);
	// Only seeds the queue when nothing is loaded — two music cards share one
	// player, which is what a single pair of speakers means.
	player.adopt(view.app, paths);

	const chrome = buildChrome(body, musicLook(cfg), musicShowsQueue(cfg));
	let seeking = false;

	chrome.seek.addEventListener("input", () => {
		seeking = true;
		const duration = player.getState().duration;
		chrome.elapsed.setText(
			formatTrackTime((Number(chrome.seek.value) / 1000) * (duration > 0 ? duration : 0)),
		);
	});
	chrome.seek.addEventListener("change", () => {
		seeking = false;
		const duration = player.getState().duration;
		if (duration > 0) player.seek((Number(chrome.seek.value) / 1000) * duration);
	});
	chrome.play.addEventListener("click", () => player.togglePlayPause());
	chrome.previous.addEventListener("click", () => player.previous());
	chrome.next.addEventListener("click", () => player.next(false));
	chrome.shuffle.addEventListener("click", () => player.shuffle());
	chrome.repeat.addEventListener("click", () => player.cycleRepeat());
	chrome.volume.addEventListener("input", () =>
		player.setVolume(Number(chrome.volume.value) / 100),
	);

	/** Whether the player is currently working through this card's tracks. */
	const isPlayersQueue = (state: Readonly<PlayerState>): boolean => {
		const own = new Set(paths);
		return state.queue.length > 0 && state.queue.some((path) => own.has(path));
	};
	/** The queue this card shows: the player's own order while it is playing
	 * this card's tracks, otherwise the card's list (which a click hands to the
	 * player). */
	const shownQueue = (state: Readonly<PlayerState>): string[] =>
		isPlayersQueue(state) ? state.queue : paths;

	const paint = (state: Readonly<PlayerState>): void => {
		const current = state.queue[state.index] ?? "";
		const now: NowPlaying = {
			title: current ? trackLabel(current) : t().cards.music.nothingPlaying,
			sub:
				state.queue.length > 0 && state.index >= 0
					? `${state.index + 1} / ${state.queue.length}`
					: t().cards.music.queueEmpty,
			playing: state.playing,
			position: state.position,
			duration: state.duration,
			repeatIcon: state.repeat === "one" ? "repeat-1" : "repeat",
			repeatTitle: repeatTitle(state.repeat),
			shuffleOn: state.shuffled,
			volume: state.volume,
			error: state.error ? playbackError(state.error) : null,
			artKey: current,
			coverUrl: null,
		};
		paintArt(chrome, now);
		paintChrome(chrome, now, () => seeking);
		const queue = shownQueue(state);
		paintQueue(
			chrome.list,
			queue.map((path, index) => ({
				key: path,
				label: trackLabel(path),
				current: isPlayersQueue(state) && index === state.index,
			})),
			(index) => {
				if (isPlayersQueue(state)) void player.playAt(index);
				else void player.playFrom(view.app, queue, index);
			},
		);
	};

	// A redraw (settings change, track dropped into the folder) keeps playing:
	// the audio element belongs to the player, not to this card.
	const unsubscribe = player.subscribe(paint);
	component.register(() => unsubscribe());
}

/** The repeat button's tooltip for Hearth's own repeat modes. */
function repeatTitle(mode: MusicRepeat): string {
	const strings = t().cards.music;
	if (mode === "one") return strings.repeatOne;
	if (mode === "all") return strings.repeatAll;
	return strings.repeatNone;
}

/** A playback error as a sentence. The player reports a code rather than an
 * English string so the card can say it in the user's own language. */
function playbackError(code: string): string {
	const strings = t().cards.music;
	if (code === "missing-file") return strings.errorMissing;
	return strings.errorPlayback;
}


// ---- Stereo source -----------------------------------------------------

function renderStereoSource(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
	cfg: MusicConfig,
): void {
	const status = stereoStatus(view.app);
	if (status === "missing") {
		emptyState(body, "radio", t().cards.empty.musicStereoMissing);
		return;
	}
	if (status === "unconfigured") {
		emptyState(body, "radio", t().cards.empty.musicStereoUnconfigured);
		return;
	}
	const player = stereoPlugin(view.app)?.player;
	if (!player) {
		emptyState(body, "radio", t().cards.empty.musicStereoMissing);
		return;
	}

	const chrome = buildChrome(body, musicLook(cfg), musicShowsQueue(cfg));
	let seeking = false;

	chrome.seek.addEventListener("input", () => {
		seeking = true;
		const duration = player.getState().duration;
		chrome.elapsed.setText(
			formatTrackTime((Number(chrome.seek.value) / 1000) * (duration > 0 ? duration : 0)),
		);
	});
	chrome.seek.addEventListener("change", () => {
		seeking = false;
		const duration = player.getState().duration;
		if (duration > 0) player.seek((Number(chrome.seek.value) / 1000) * duration);
	});
	chrome.play.addEventListener("click", () => void player.togglePlayPause());
	chrome.previous.addEventListener("click", () => void player.previous());
	chrome.next.addEventListener("click", () => void player.next());
	chrome.shuffle.addEventListener("click", () => {
		// Stereo's store has no shuffle toggle (its queue is already built), so
		// the button opens the plugin's own player instead of pretending.
		view.app.commands.executeCommandById("stereo:open-player");
	});
	chrome.repeat.addEventListener("click", () => player.cycleRepeat());
	chrome.volume.addEventListener("input", () => player.setVolume(Number(chrome.volume.value) / 100));

	const paint = (state: Readonly<StereoPlayerState>): void => {
		const track = state.track;
		const cover = stereoCoverUrl(view.app, track, 512);
		const now: NowPlaying = {
			title: track?.title ?? t().cards.music.nothingPlaying,
			sub: track
				? [track.artist, track.album].filter((part): part is string => !!part).join(" · ")
				: t().cards.music.stereoIdle,
			playing: state.playing,
			position: state.position,
			duration: state.duration,
			repeatIcon: state.repeat === "track" ? "repeat-1" : "repeat",
			repeatTitle: stereoRepeatLabel(state.repeat, {
				off: t().cards.music.repeatNone,
				queue: t().cards.music.repeatAll,
				track: t().cards.music.repeatOne,
			}),
			shuffleOn: false,
			volume: state.volume,
			error: state.error ? t().cards.music.errorPlayback : null,
			artKey: track?.id ?? "",
			coverUrl: cover,
		};
		paintArt(chrome, now);
		paintChrome(chrome, now, () => seeking);
		paintQueue(
			chrome.list,
			state.queue.map((song, index) => ({
				key: song.id,
				label: song.title,
				sub: song.artist,
				current: index === state.index,
			})),
			(index) => void player.playAt(index),
		);
	};

	const unsubscribe = player.subscribe(paint);
	component.register(() => unsubscribe());
}


// ---- Render entry ------------------------------------------------------

export function renderMusic(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.music ?? {};
	body.addClass("hearth-music-host");
	// The source is a card setting, and the two have nothing in common beyond the
	// chrome: one plays vault files through Hearth's own player, the other drives
	// the Stereo plugin's.
	if (musicSource(cfg) === "stereo") renderStereoSource(view, card, body, component, cfg);
	else renderVaultSource(view, card, body, component, cfg);
}


// ---- Editor ------------------------------------------------------------

function musicEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.music;
	const card = ctx.card;
	card.music ??= {};
	const cfg = card.music;

	new Setting(containerEl)
		.setName(strings.source)
		.setDesc(strings.sourceDesc)
		.addDropdown((d) => {
			for (const source of MUSIC_SOURCES) d.addOption(source, strings.sources[source]);
			d.setValue(musicSource(cfg)).onChange((value) => {
				cfg.source = value as MusicSource;
				ctx.opts.save();
				// The three sources are configured with completely different controls.
				ctx.requestRender();
				ctx.opts.rerender();
			});
		});

	const source = musicSource(cfg);
	if (source === "folder") folderSection(ctx, containerEl, cfg);
	else if (source === "list") listSection(ctx, containerEl, cfg);
	else stereoSection(ctx, containerEl);

	new Setting(containerEl).setName(strings.playbackHeading).setHeading();

	new Setting(containerEl)
		.setName(strings.look)
		.setDesc(strings.lookDesc)
		.addDropdown((d) => {
			for (const look of MUSIC_LOOKS) d.addOption(look, strings.looks[look]);
			d.setValue(musicLook(cfg)).onChange((value) => {
				cfg.look = value as MusicLook;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	new Setting(containerEl)
		.setName(strings.showQueue)
		.setDesc(strings.showQueueDesc)
		.addToggle((tg) =>
			tg.setValue(musicShowsQueue(cfg)).onChange((value) => {
				cfg.showQueue = value ? undefined : false;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}

function folderSection(ctx: CardEditorContext, containerEl: HTMLElement, cfg: MusicConfig): void {
	const strings = t().editors.music;
	const setting = new Setting(containerEl).setName(strings.folder).setDesc(strings.folderDesc);
	setting.addText((txt) =>
		txt
			.setPlaceholder(strings.folderPlaceholder)
			.setValue(cfg.folder ?? "")
			.onChange((value) => {
				cfg.folder = value.trim() || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	setting.addExtraButton((b) =>
		b
			.setIcon("folder-open")
			.setTooltip(strings.pickFolder)
			.onClick(() => {
				new FolderPickerModal(ctx.app, (folder) => {
					// The vault root is stored as "" rather than "/" (see normalizeFolderPath).
					cfg.folder = folder.isRoot() ? undefined : folder.path;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}).open();
			}),
	);

	new Setting(containerEl)
		.setName(strings.includeSubfolders)
		.setDesc(strings.includeSubfoldersDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.includeSubfolders === true).onChange((value) => {
				cfg.includeSubfolders = value || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	// How many tracks the folder yields — the number that tells you whether the
	// folder (and the subfolder toggle) is the one you meant.
	const found = collectTracks(ctx.app, cfg).length;
	new Setting(containerEl).setDesc(strings.found(found));
}

function listSection(ctx: CardEditorContext, containerEl: HTMLElement, cfg: MusicConfig): void {
	const strings = t().editors.music;
	const tracks = cfg.tracks ?? [];

	if (tracks.length === 0) {
		new Setting(containerEl).setDesc(strings.noTracks);
	}
	for (const [index, path] of tracks.entries()) {
		const file = ctx.app.vault.getAbstractFileByPath(path);
		const present = file instanceof TFile;
		const setting = new Setting(containerEl)
			.setName(present ? trackLabel(path) : path)
			.setDesc(present ? path : strings.missingTrack);
		setting.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.remove)
				.onClick(() => {
					cfg.tracks = tracks.filter((_, at) => at !== index);
					if (cfg.tracks.length === 0) cfg.tracks = undefined;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}),
		);
	}

	new Setting(containerEl).addButton((b) =>
		b
			.setButtonText(strings.addTrack)
			.setCta()
			.onClick(() => {
				new FilePickerModal(
					ctx.app,
					(file) => {
						cfg.tracks = [...(cfg.tracks ?? []), file.path];
						ctx.opts.save();
						ctx.requestRender();
						ctx.opts.rerender();
					},
					strings.pickTrack,
					(file) => isAudioPath(file.path),
				).open();
			}),
	);
}

function stereoSection(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const strings = t().editors.music;
	const status = stereoStatus(ctx.app);
	const note = new Setting(containerEl).setName(strings.stereoHeading).setDesc(
		status === "missing"
			? strings.stereoMissing
			: status === "unconfigured"
				? strings.stereoUnconfigured
				: strings.stereoReady,
	);
	if (status === "ready") {
		note.addButton((b) =>
			b.setButtonText(strings.openStereo).onClick(() => {
				ctx.app.commands.executeCommandById("stereo:open-player");
			}),
		);
	}
	if (status === "missing") {
		note.addButton((b) =>
			b
				.setButtonText(strings.browsePlugins)
				.setCta()
				.onClick(() => {
					// Same jump the card picker offers for an unmet dependency.
					ctx.app.commands.executeCommandById("app:open-settings");
				}),
		);
	}
}


// ---- Definition --------------------------------------------------------

export const musicCard: CardDefinition<"music"> = {
	kind: "music",
	templates: [
		{
			id: "music",
			name: "Music",
			icon: "music",
			build: () => ({
				kind: "music",
				title: "Music",
				music: { source: "folder", look: "cover" },
				w: 4,
				h: 4,
			}),
		},
		{
			id: "music-stereo",
			name: "Music (Stereo)",
			icon: "radio",
			build: () => ({
				kind: "music",
				title: "Music",
				music: { source: "stereo", look: "cover" },
				w: 4,
				h: 4,
			}),
			// Offered either way (the picker badges it while unmet); only the
			// Stereo source needs the plugin, the vault sources never do.
			requires: {
				name: "Stereo",
				pluginId: "stereo",
				satisfied: (app) => stereoStatus(app) !== "missing",
			},
		},
	],
	render: (view, card, body, component) => renderMusic(view, card, body, component),
	renderEditor: (container, ctx) => musicEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (!source.music) return;
		copy.music = { ...source.music, tracks: source.music.tracks?.slice() };
	},
	// A folder card has to notice the track just dropped into it, and a list card
	// the file that was deleted or renamed — but an edit to a note is not worth
	// redrawing a player (see musicReactsTo). The stereo source listens to the
	// other plugin's store instead, so it never reacts to a vault event at all.
	liveness: { mode: "vault", shouldRedraw: (card, ev) => musicReactsTo(card, ev) },
	// The player is a thing you look at, not a list of text: it reads as a card
	// rather than as a line in terminal mode, so it keeps no TUI counterpart
	// (see GRAPHICAL_KINDS).
	expressive: true,
};
