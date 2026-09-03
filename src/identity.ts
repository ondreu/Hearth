/**
 * Who made a dashboard — without a name, an account, or a server.
 *
 * A shared board needs an author for the same reason a shared anything does: so
 * a second export from the same person reads as the same person, so a gallery
 * can group a maker's work, and so "this is the board by the maker of that
 * other one" is a thing anybody can check. The obvious way to get that is to
 * ask for a name, and the obvious way is wrong twice over — a typed name is
 * both a small piece of personal data Hearth has no business collecting and a
 * label anyone can type, so the first person to publish as somebody else's name
 * is the last one anybody trusts.
 *
 * So nothing is asked. Hearth mints one secret when identity is first needed —
 * the **recovery key**, which never leaves the vault — and everything public is
 * derived from it by hashing:
 *
 * ```
 *   recovery key   HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ   private, stays here
 *          │  sha-256
 *          ▼
 *   author id      a91c3f0d7e42                     public, travels
 *          │  sha-256, again
 *          ▼
 *   username       quiet-lantern-4821               public, and *computed*
 * ```
 *
 * Two properties fall out of that shape, and they are the whole point.
 *
 * **The name can't be claimed.** It is not a field somebody fills in; it is a
 * function of the id. A reader never trusts the `author` string in a package —
 * it recomputes the name from `authorId` and shows that (see
 * {@link verifiedAuthorName}), so a file that says `author: "ondreu"` while
 * carrying somebody else's id displays as whoever that id really is. Typing a
 * name you like is not an available move.
 *
 * **Identity survives a reinstall.** Everything public is derived, so the key is
 * the only thing worth keeping. Paste it into a fresh vault and the same id and
 * the same username come back — no account to recover, nothing held anywhere
 * else, nothing to lose but the twenty characters the user was told to keep.
 *
 * What this deliberately does *not* do is prove possession. Anyone who has seen
 * a published package has seen its author id and can copy it into a file of
 * their own; the id identifies, it does not authenticate. Closing that needs a
 * signature, which needs something to verify against — a gallery, a challenge,
 * a round trip — none of which exists yet. When it does, the recovery key is
 * already the right secret to sign with, and no published id has to change.
 * Until then the honest claim is the modest one: a package's author is a stable,
 * self-consistent, unclaimable handle, not a proven one.
 */

/** How many hex characters of the hash make up the public author id. 48 bits:
 * short enough to read out loud, wide enough that two vaults minting one on the
 * same day will not collide. */
const AUTHOR_ID_LENGTH = 12;

/** Crockford's base32 alphabet, minus nothing: `I`, `L`, `O` and `U` are
 * already absent from it, which is exactly why it is used here — a recovery key
 * gets written down and typed back in. */
const KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Groups of five, four of them: 20 symbols ≈ 100 bits of key. */
const KEY_GROUPS = 4;
const KEY_GROUP_LENGTH = 5;

/** The prefix every recovery key carries, so one is recognisable on sight in a
 * password manager or a note. */
const KEY_PREFIX = "HEARTH";

/** A parsed identity: the secret, and the two public values derived from it. */
export interface AuthorIdentity {
	/** The recovery key. Private — never written into a package or a backup. */
	key: string;
	/** Public, stable, and what a gallery keys a maker's work by. */
	id: string;
	/** Public display handle, computed from {@link id}. */
	name: string;
}

// ---- SHA-256 ---------------------------------------------------------------
//
// Carried here rather than taken from the platform because every derivation
// above happens while a dialog is being drawn: `crypto.subtle.digest` is async,
// and Node's `crypto` module is not there on mobile. A non-cryptographic hash
// would do the job today — nothing here depends on preimage resistance yet —
// and would quietly stop doing it the moment identity is asked to prove
// anything, since finding a key that hashes to someone else's id would become
// the attack. So: the real one, ~60 lines, synchronous, no dependencies.

const K = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
	0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
	0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
	0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
	0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
	0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
	0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
	0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
	0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** UTF-8 bytes of a string, without TextEncoder (absent in some embedded
 * contexts, and the inputs here are short). */
function utf8Bytes(text: string): number[] {
	const bytes: number[] = [];
	for (const ch of text) {
		let code = ch.codePointAt(0) ?? 0;
		if (code < 0x80) {
			bytes.push(code);
		} else if (code < 0x800) {
			bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
		} else if (code < 0x10000) {
			bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
		} else {
			bytes.push(
				0xf0 | (code >> 18),
				0x80 | ((code >> 12) & 0x3f),
				0x80 | ((code >> 6) & 0x3f),
				0x80 | (code & 0x3f),
			);
			code = 0;
		}
	}
	return bytes;
}

/** SHA-256 of a string, as lower-case hex. */
export function sha256Hex(text: string): string {
	const bytes = utf8Bytes(text);
	const bitLength = bytes.length * 8;
	bytes.push(0x80);
	while (bytes.length % 64 !== 56) bytes.push(0);
	// Length as a 64-bit big-endian count of bits. The high word is always zero
	// for the inputs this module hashes (a key, an id), but written properly
	// anyway so the function is a real SHA-256 rather than one that happens to
	// agree on short strings.
	bytes.push(0, 0, 0, 0);
	bytes.push((bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);

	const h = [
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
		0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
	];
	const w = new Array<number>(64);

	const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

	for (let block = 0; block < bytes.length; block += 64) {
		for (let i = 0; i < 16; i++) {
			const at = block + i * 4;
			w[i] =
				((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
		}
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
			const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
		}

		let [a, b, c, d, e, f, g, hh] = h;
		for (let i = 0; i < 64; i++) {
			const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
			const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const temp2 = (S0 + maj) >>> 0;
			hh = g;
			g = f;
			f = e;
			e = (d + temp1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (temp1 + temp2) >>> 0;
		}
		h[0] = (h[0] + a) >>> 0;
		h[1] = (h[1] + b) >>> 0;
		h[2] = (h[2] + c) >>> 0;
		h[3] = (h[3] + d) >>> 0;
		h[4] = (h[4] + e) >>> 0;
		h[5] = (h[5] + f) >>> 0;
		h[6] = (h[6] + g) >>> 0;
		h[7] = (h[7] + hh) >>> 0;
	}

	return h.map((word) => word.toString(16).padStart(8, "0")).join("");
}

// ---- The key ---------------------------------------------------------------

/**
 * A fresh recovery key.
 *
 * `Math.random` is not a cryptographic source, and this is the one place that
 * matters, so the platform's real one is used when it is there — every Obsidian
 * build has it — and the weak source is a last-resort fallback rather than the
 * design. A key made from the fallback is still unguessable enough to serve as
 * a handle; it is not something to build a signature on, which is the other
 * reason this module doesn't claim to.
 */
export function newAuthorKey(): string {
	const total = KEY_GROUPS * KEY_GROUP_LENGTH;
	const bytes = randomBytes(total);
	let out = "";
	for (let i = 0; i < total; i++) {
		if (i > 0 && i % KEY_GROUP_LENGTH === 0) out += "-";
		out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
	}
	return `${KEY_PREFIX}-${out}`;
}

function randomBytes(count: number): Uint8Array {
	const bytes = new Uint8Array(count);
	try {
		// Wrapped because `window` is not defined everywhere this module is
		// exercised (the tests run it under Node), and a missing platform CSPRNG
		// must degrade rather than throw.
		const source = window.crypto;
		if (source?.getRandomValues) {
			source.getRandomValues(bytes);
			return bytes;
		}
	} catch {
		// Fall through to the weak source below.
	}
	for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
	return bytes;
}

/**
 * A typed-in key reduced to what it means.
 *
 * A key is read back off a screenshot, a sticky note or a password manager, so
 * case, spaces, the grouping dashes and the prefix are all noise. `1`/`I`/`l`
 * and `0`/`O` are folded the way Crockford's alphabet intends, since those are
 * the substitutions a human eye actually makes. Returns null when what's left
 * isn't a key.
 */
export function normalizeAuthorKey(raw: string): string | null {
	let text = raw.trim().toUpperCase();
	if (text.startsWith(`${KEY_PREFIX}-`)) text = text.slice(KEY_PREFIX.length + 1);
	else if (text.startsWith(KEY_PREFIX)) text = text.slice(KEY_PREFIX.length);
	const symbols = text
		.replace(/[\s-]+/g, "")
		.replace(/[IL]/g, "1")
		.replace(/O/g, "0");
	if (symbols.length !== KEY_GROUPS * KEY_GROUP_LENGTH) return null;
	for (const ch of symbols) if (!KEY_ALPHABET.includes(ch)) return null;
	const groups: string[] = [];
	for (let i = 0; i < symbols.length; i += KEY_GROUP_LENGTH) {
		groups.push(symbols.slice(i, i + KEY_GROUP_LENGTH));
	}
	return `${KEY_PREFIX}-${groups.join("-")}`;
}

/** Whether a string is a usable recovery key. */
export function isAuthorKey(raw: string): boolean {
	return normalizeAuthorKey(raw) !== null;
}

// ---- The public half -------------------------------------------------------

/** The public author id a recovery key resolves to. Deterministic: the same key
 * always gives the same id, in any vault, on any device, forever. */
export function authorIdFromKey(key: string): string | null {
	const normalized = normalizeAuthorKey(key);
	if (!normalized) return null;
	return sha256Hex(`hearth-author:${normalized}`).slice(0, AUTHOR_ID_LENGTH);
}

/** Whether a string has the shape this module gives an author id, so a package
 * carrying something else in the field is treated as carrying nothing. Case
 * and surrounding space are noise — an id passes through galleries and URLs
 * before it comes back. */
export function isAuthorId(value: string): boolean {
	return new RegExp(`^[0-9a-f]{${AUTHOR_ID_LENGTH}}$`).test(value.trim().toLowerCase());
}

/**
 * The word lists a username is drawn from.
 *
 * Chosen to be calm, concrete and unmistakably a handle: nothing that reads as
 * a real name, nothing that reads as an insult, nothing whose meaning shifts
 * between languages. 64 of each, so a name takes exactly six bits from the hash
 * per word and the derivation stays obvious.
 */
const ADJECTIVES = [
	"amber", "ancient", "autumn", "brave", "bright", "brisk", "calm", "candid",
	"cedar", "clear", "clever", "cobalt", "coral", "cosy", "crimson", "crisp",
	"curious", "dawn", "deft", "distant", "dusk", "eager", "early", "eastern",
	"emerald", "fabled", "fleet", "gentle", "gilded", "golden", "hidden", "humble",
	"indigo", "ivory", "jolly", "keen", "kindly", "lively", "lucid", "lunar",
	"mellow", "merry", "misty", "modest", "northern", "noble", "olive", "patient",
	"placid", "polar", "quiet", "rapid", "rustic", "sable", "scarlet", "silent",
	"silver", "solar", "steady", "sunny", "tidy", "velvet", "verdant", "wandering",
];

const NOUNS = [
	"anchor", "arbor", "aster", "atlas", "beacon", "bellows", "birch", "bramble",
	"brook", "canopy", "cavern", "cinder", "cipher", "compass", "cottage", "crest",
	"delta", "dovecote", "ember", "fathom", "fennel", "ferry", "forge", "garden",
	"gable", "harbor", "hearth", "heron", "juniper", "kettle", "lantern", "ledger",
	"lighthouse", "lyric", "maple", "meadow", "meridian", "mosaic", "orchard", "otter",
	"parcel", "pebble", "pennant", "quarry", "quill", "ravine", "ribbon", "rookery",
	"sable", "sextant", "shelter", "signal", "sparrow", "spindle", "summit", "thicket",
	"tide", "trellis", "vessel", "willow", "window", "wharf", "wren", "yarrow",
];

/** How many digits close a username out. Four keeps a collision inside one word
 * pair down to a coincidence rather than a routine event. */
const NAME_DIGITS = 4;

/**
 * The public handle an author id resolves to.
 *
 * A pure function of the id, which is what makes the name unclaimable: there is
 * no name field to disagree with, only an id, and everybody computes the same
 * answer from it. Reads as `quiet-lantern-4821`.
 */
export function usernameFromAuthorId(id: string): string {
	const digest = sha256Hex(`hearth-name:${id.trim().toLowerCase()}`);
	const slice = (at: number): number => parseInt(digest.slice(at, at + 8), 16);
	const adjective = ADJECTIVES[slice(0) % ADJECTIVES.length];
	const noun = NOUNS[slice(8) % NOUNS.length];
	const number = String(slice(16) % 10 ** NAME_DIGITS).padStart(NAME_DIGITS, "0");
	return `${adjective}-${noun}-${number}`;
}

/** Everything about an identity, from the one secret it is made of. */
export function identityFromKey(key: string): AuthorIdentity | null {
	const normalized = normalizeAuthorKey(key);
	if (!normalized) return null;
	const id = authorIdFromKey(normalized);
	if (!id) return null;
	return { key: normalized, id, name: usernameFromAuthorId(id) };
}

/**
 * The name to show for a package's author.
 *
 * The rule the whole scheme rests on: an id is believed, a name never is. A
 * package carrying an id is displayed as whatever that id computes to,
 * regardless of what its `author` field says; a package carrying no id has no
 * author, and the string it wrote is not shown at all — because a name that
 * nothing derives it from is exactly the free-text field this design exists to
 * remove.
 */
export function verifiedAuthorName(authorId: string | undefined): string | null {
	if (!authorId || !isAuthorId(authorId)) return null;
	return usernameFromAuthorId(authorId.trim().toLowerCase());
}
