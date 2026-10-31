import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import type { VaultEvent } from "../src/cardevents";
import {
	MUSIC_DEFAULT_VOLUME,
	MUSIC_QUEUE_LIMIT,
	MUSIC_RESTART_AFTER_SEC,
	formatTrackTime,
	isAudioPath,
	musicLook,
	musicReactsTo,
	musicRepeat,
	musicShowsQueue,
	musicSource,
	musicVolume,
	nextTrackIndex,
	previousTrackIndex,
	sanitizeMusicState,
	shuffledQueue,
	trackLabel,
} from "../src/music";
import type { DashboardCard, MusicConfig } from "../src/types";

/**
 * The music card's pure half: what counts as a track, what "next" and
 * "previous" mean under each repeat mode, how a position reads as time, and
 * which vault events are worth a redraw. Data in, data out — the `<audio>`
 * element, the DOM and the Stereo plugin are deliberately untested here, per
 * the "no Obsidian API mocks" rule.
 */

function event(kind: VaultEvent["kind"], path: string, oldPath?: string): VaultEvent {
	return { kind, file: Object.assign(new TFile(), { path }), oldPath };
}

function card(music: MusicConfig): DashboardCard {
	return { id: "c", kind: "music", x: 0, y: 0, w: 4, h: 4, music };
}

describe("which files are tracks", () => {
	it("accepts the extensions an <audio> element can be pointed at", () => {
		for (const path of ["a.mp3", "b.M4A", "c.flac", "d.ogg", "e.opus", "f.wav", "g.aac"]) {
			expect(isAudioPath(path)).toBe(true);
		}
	});

	it("rejects notes, pictures and extension-less paths", () => {
		for (const path of ["note.md", "cover.png", "clip.mp4", "Mix", "folder/a.pdf"]) {
			expect(isAudioPath(path)).toBe(false);
		}
	});

	it("names a track by its file name, without the extension", () => {
		expect(trackLabel("Music/Album/03 Sonata.mp3")).toBe("03 Sonata");
		// A dot in the name is part of the name, not a second extension.
		expect(trackLabel("Music/Pt. II.flac")).toBe("Pt. II");
		expect(trackLabel("Music/untitled")).toBe("untitled");
	});
});

describe("music config resolution", () => {
	it("defaults to a folder, because a list with no entries opens empty", () => {
		expect(musicSource(undefined)).toBe("folder");
		expect(musicSource({})).toBe("folder");
		expect(musicSource({ source: "list" })).toBe("list");
		expect(musicSource({ source: "stereo" })).toBe("stereo");
	});

	it("reads an unknown repeat as off", () => {
		expect(musicRepeat("one")).toBe("one");
		expect(musicRepeat("all")).toBe("all");
		expect(musicRepeat(undefined)).toBe("off");
		expect(musicRepeat("nonsense" as never)).toBe("off");
	});

	it("reads an unknown motif as plain, so an old card looks unchanged", () => {
		expect(musicLook({ look: "record" })).toBe("record");
		expect(musicLook({ look: "bars" })).toBe("bars");
		expect(musicLook({})).toBe("plain");
		expect(musicLook(undefined)).toBe("plain");
	});

	it("clamps the volume into 0..1 and falls back to the default", () => {
		expect(musicVolume(undefined)).toBe(MUSIC_DEFAULT_VOLUME);
		expect(musicVolume(Number.NaN)).toBe(MUSIC_DEFAULT_VOLUME);
		expect(musicVolume(-2)).toBe(0);
		expect(musicVolume(7)).toBe(1);
		expect(musicVolume(0.35)).toBe(0.35);
	});

	it("shows the queue unless it was explicitly turned off", () => {
		expect(musicShowsQueue(undefined)).toBe(true);
		expect(musicShowsQueue({})).toBe(true);
		expect(musicShowsQueue({ showQueue: false })).toBe(false);
	});

	it("keeps the queue cap low enough to draw", () => {
		expect(MUSIC_QUEUE_LIMIT).toBeGreaterThan(0);
		expect(MUSIC_QUEUE_LIMIT).toBeLessThan(1000);
	});
});

describe("time formatting", () => {
	it("writes m:ss and h:mm:ss", () => {
		expect(formatTrackTime(0)).toBe("0:00");
		expect(formatTrackTime(7)).toBe("0:07");
		expect(formatTrackTime(63.9)).toBe("1:03");
		expect(formatTrackTime(600)).toBe("10:00");
		expect(formatTrackTime(3725)).toBe("1:02:05");
	});

	it("says nothing rather than 0:00 for a duration it does not know", () => {
		expect(formatTrackTime(undefined)).toBe("");
		expect(formatTrackTime(Number.NaN)).toBe("");
		expect(formatTrackTime(-5)).toBe("");
	});
});

describe("next track", () => {
	it("stops at the end with repeat off — an ended track does not loop", () => {
		expect(nextTrackIndex({ count: 3, index: 2, repeat: "off", automatic: true })).toBe(-1);
	});

	it("stays on the last track when 'next' is pressed there, instead of jumping back", () => {
		expect(nextTrackIndex({ count: 3, index: 2, repeat: "off", automatic: false })).toBe(2);
	});

	it("steps forward inside the queue", () => {
		expect(nextTrackIndex({ count: 3, index: 0, repeat: "off", automatic: false })).toBe(1);
		expect(nextTrackIndex({ count: 3, index: 0, repeat: "off", automatic: true })).toBe(1);
	});

	it("wraps to the top under repeat all", () => {
		expect(nextTrackIndex({ count: 3, index: 2, repeat: "all", automatic: true })).toBe(0);
		expect(nextTrackIndex({ count: 3, index: 2, repeat: "all", automatic: false })).toBe(0);
	});

	it("repeats the track that ended under repeat one, but a button still moves on", () => {
		expect(nextTrackIndex({ count: 3, index: 1, repeat: "one", automatic: true })).toBe(1);
		expect(nextTrackIndex({ count: 3, index: 1, repeat: "one", automatic: false })).toBe(2);
		expect(nextTrackIndex({ count: 3, index: 2, repeat: "one", automatic: false })).toBe(2);
	});

	it("starts the first track when nothing is queued up yet", () => {
		expect(nextTrackIndex({ count: 2, index: -1, repeat: "off", automatic: false })).toBe(0);
	});

	it("reports nothing to play for an empty queue", () => {
		expect(nextTrackIndex({ count: 0, index: -1, repeat: "all", automatic: true })).toBe(-1);
	});
});

describe("previous track", () => {
	it("restarts the current track once the playhead is past the restart point", () => {
		expect(
			previousTrackIndex({
				count: 3,
				index: 1,
				repeat: "off",
				automatic: false,
				position: MUSIC_RESTART_AFTER_SEC + 0.5,
			}),
		).toBe(1);
	});

	it("steps back early in a track", () => {
		expect(
			previousTrackIndex({
				count: 3,
				index: 1,
				repeat: "off",
				automatic: false,
				position: 0.4,
			}),
		).toBe(0);
	});

	it("stops at the first track with repeat off and wraps under repeat all", () => {
		const at = { count: 3, index: 0, automatic: false, position: 0, repeat: "off" as const };
		expect(previousTrackIndex(at)).toBe(0);
		expect(previousTrackIndex({ ...at, repeat: "all" })).toBe(2);
		expect(previousTrackIndex({ ...at, repeat: "one" })).toBe(0);
	});

	it("treats a missing playhead as the start of the track", () => {
		expect(previousTrackIndex({ count: 3, index: 2, repeat: "off", automatic: false })).toBe(1);
	});

	it("reports nothing to play for an empty queue", () => {
		expect(previousTrackIndex({ count: 0, index: -1, repeat: "off", automatic: false })).toBe(-1);
	});
});

describe("shuffle", () => {
	it("returns a new array and leaves the queue it was given alone", () => {
		const queue = ["a", "b", "c", "d"];
		const shuffled = shuffledQueue(queue, () => 0);
		expect(queue).toEqual(["a", "b", "c", "d"]);
		expect(shuffled).not.toBe(queue);
		expect(shuffled.slice().sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("is a permutation — no track is dropped or duplicated", () => {
		const queue = Array.from({ length: 25 }, (_, i) => `t${i}`);
		const shuffled = shuffledQueue(queue);
		expect(shuffled).toHaveLength(queue.length);
		expect(new Set(shuffled).size).toBe(queue.length);
	});
});

describe("which vault events redraw the card", () => {
	it("ignores edits, so a playhead is never disturbed by a note being saved", () => {
		expect(musicReactsTo(card({ source: "folder", folder: "Music" }), event("modify", "Music/a.mp3"))).toBe(
			false,
		);
		expect(musicReactsTo(card({ source: "folder", folder: "Music" }), event("meta", "Music/a.mp3"))).toBe(
			false,
		);
	});

	it("reacts to an audio file appearing in the folder, and not to a note", () => {
		const c = card({ source: "folder", folder: "Music" });
		expect(musicReactsTo(c, event("create", "Music/new.mp3"))).toBe(true);
		expect(musicReactsTo(c, event("create", "Music/notes.md"))).toBe(false);
	});

	it("leaves subfolders alone unless they were included", () => {
		expect(musicReactsTo(card({ source: "folder", folder: "Music" }), event("create", "Music/2020/a.mp3"))).toBe(
			false,
		);
		expect(
			musicReactsTo(
				card({ source: "folder", folder: "Music", includeSubfolders: true }),
				event("create", "Music/2020/a.mp3"),
			),
		).toBe(true);
	});

	it("reacts when the folder itself is renamed away", () => {
		const c = card({ source: "folder", folder: "Music/Albums" });
		expect(musicReactsTo(c, event("rename", "Music/Albums-old", "Music/Albums"))).toBe(true);
	});

	it("tracks the listed files, not the whole vault", () => {
		const c = card({ source: "list", tracks: ["Music/a.mp3", "Music/b.mp3"] });
		expect(musicReactsTo(c, event("delete", "Music/a.mp3"))).toBe(true);
		expect(musicReactsTo(c, event("delete", "Music/other.mp3"))).toBe(false);
	});

	it("never redraws for a vault event when the source is another plugin's player", () => {
		expect(musicReactsTo(card({ source: "stereo" }), event("create", "Music/a.mp3"))).toBe(false);
		expect(musicReactsTo(card({ source: "stereo" }), event("delete", "Music/a.mp3"))).toBe(false);
	});
});

describe("stored playback state", () => {
	it("round-trips a session", () => {
		const state = sanitizeMusicState({
			queue: ["Music/a.mp3", "Music/b.mp3"],
			index: 1,
			position: 42.5,
			volume: 0.5,
			repeat: "all",
		});
		expect(state).toEqual({
			queue: ["Music/a.mp3", "Music/b.mp3"],
			index: 1,
			position: 42.5,
			volume: 0.5,
			repeat: "all",
		});
	});

	it("refuses anything it cannot restore", () => {
		expect(sanitizeMusicState(undefined)).toBeNull();
		expect(sanitizeMusicState({ queue: [] })).toBeNull();
		expect(sanitizeMusicState({ queue: "Music/a.mp3" })).toBeNull();
		expect(sanitizeMusicState({ queue: [1, 2, 3] })).toBeNull();
	});

	it("clamps an index that points past the queue, and a nonsense position", () => {
		const state = sanitizeMusicState({
			queue: ["a.mp3", "b.mp3"],
			index: 99,
			position: -10,
			volume: 4,
		});
		expect(state?.index).toBe(1);
		expect(state?.position).toBe(0);
		expect(state?.volume).toBe(1);
	});
});
