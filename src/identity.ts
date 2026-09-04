/**
 * Who made a dashboard — without a name, an account, or a server.
 *
 * A shared board needs an author for the same reason a shared anything does: so
 * a second export from the same person reads as the same person, and so a
 * gallery can group a maker's work. The obvious way to get that is to ask for a
 * name, and the obvious way is wrong twice over — a typed name is both a small
 * piece of personal data Hearth has no business collecting and a label anyone
 * can type, so the first person to publish as somebody else's name is the last
 * one anybody trusts.
 *
 * So nothing is asked. Hearth mints one secret when identity is first needed —
 * the **recovery key**, which never leaves the vault — and everything else
 * follows from it:
 *
 * ```
 *   recovery key   HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ   private, stays here
 *          │  sha-256 → a 32-byte seed
 *          ▼
 *   signing key    (ed25519 private)                private, stays here
 *          │
 *          ▼
 *   public key     ae4429fc…3ae7                    travels, as machinery
 *          │  sha-256 → two words and a suffix
 *          ▼
 *   handle         quiet-lantern-4kj2m8             the one public identity
 * ```
 *
 * Three properties fall out of that shape, and each answers a different
 * question people conflate.
 *
 * **The handle is stable.** It is a function of the key, so it is the same on
 * every export, in every vault, forever. Paste the twenty characters into a
 * fresh install and the same handle comes back — no account to recover, nothing
 * held anywhere else, nothing to lose but the key the user was told to keep.
 *
 * **The handle is unique in practice.** Determinism alone does not give that:
 * two different keys can land on the same handle whenever the handle is smaller
 * than the key, and squeezing 100 bits of key into two words out of 64 would
 * have meant a coin-flip chance of a collision at a few thousand users. So the
 * handle carries its own entropy — 256 adjectives, 256 nouns and a six-symbol
 * suffix, 46 bits together, which puts a collision out of reach at any scale a
 * plugin gallery reaches. It is the whole public identity; there is no second
 * id beside it.
 *
 * **The handle cannot be published under by anybody else.** This is the part
 * hashing alone cannot do, and the reason there is a keypair here at all. A
 * package is a static file, so any proof it carries, its reader now has —
 * "prove you know the secret" cannot be answered by writing the secret down.
 * A signature can: the file carries the public key and a signature over its own
 * contents, the private half never leaves, and a reader who recomputes the
 * handle from the public key and checks the signature learns that whoever holds
 * that key made *this file*. Copying somebody's handle out of a package they
 * published gets you a package that fails to verify.
 *
 * What that still does not give you is the *person*. A verifier learns "the
 * same hand made this and that", not "this is Ondřej" — trust on first use,
 * which is how an SSH key works the first time you connect. Binding a handle to
 * a human needs someone to vouch, which means a gallery, and the gallery is
 * where that belongs.
 */

import * as ed25519 from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

// ed25519 is defined in terms of SHA-512 and the library deliberately ships
// without a hash, so that the caller picks one rather than the bundle carrying
// two. Wired once, here, because every function below depends on it and a
// missing hash fails at the first signature rather than at import.
ed25519.hashes.sha512 = sha512;

/** Crockford's base32 alphabet, minus nothing: `I`, `L`, `O` and `U` are
 * already absent from it, which is exactly why it is used here — a recovery key
 * gets written down and typed back in, and a handle gets read off a screen. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Groups of five, four of them: 20 symbols = 100 bits of key. */
const KEY_GROUPS = 4;
const KEY_GROUP_LENGTH = 5;

/** The prefix every recovery key carries, so one is recognisable on sight in a
 * password manager or a note. */
const KEY_PREFIX = "HEARTH";

/**
 * Symbols of entropy on the end of a handle.
 *
 * The words carry 16 bits between them, which is nowhere near enough on its own
 * — this is the part that makes a handle an identity rather than a label. Six
 * base32 symbols add 30, for 46 bits total: about 70 trillion handles, and a
 * better-than-even chance of *any* two users colliding only past nine million
 * of them.
 */
const HANDLE_SUFFIX_LENGTH = 6;

/** A parsed identity: the secret, and everything public that follows from it. */
export interface AuthorIdentity {
	/** The recovery key. Private — never written into a package or a backup. */
	key: string;
	/** The ed25519 public key as lower-case hex. Travels inside a package so a
	 * reader can check its signature; nobody is ever asked to read it. */
	publicKey: string;
	/** The public identity, and the only one: `quiet-lantern-4kj2m8`. */
	handle: string;
}

// ---- The recovery key ------------------------------------------------------

/**
 * A fresh recovery key.
 *
 * `Math.random` is not a cryptographic source, and this is now the one place
 * that really matters — the key is a signing key — so the platform's real one
 * is used when it is there, which is every Obsidian build. The weak fallback
 * exists so that a locked-down context degrades rather than throws.
 */
export function newAuthorKey(): string {
	const total = KEY_GROUPS * KEY_GROUP_LENGTH;
	const bytes = randomBytes(total);
	let out = "";
	for (let i = 0; i < total; i++) {
		if (i > 0 && i % KEY_GROUP_LENGTH === 0) out += "-";
		out += ALPHABET[bytes[i] % ALPHABET.length];
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
 * case, spaces, the grouping dashes and the prefix are all noise. `1`/`I`/`L`
 * and `0`/`O` are folded the way Crockford's alphabet intends, since those are
 * the substitutions a human eye actually makes. Returns null when what is left
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
	for (const ch of symbols) if (!ALPHABET.includes(ch)) return null;
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

// ---- The keypair -----------------------------------------------------------

/**
 * The ed25519 seed a recovery key stands for.
 *
 * Hashed rather than used raw so the key's 100 bits are spread over the 32
 * bytes ed25519 wants, and domain-separated so the same key can never produce
 * the same bytes as any other derivation in this module.
 */
function seedFromKey(normalizedKey: string): Uint8Array {
	return sha256(utf8(`hearth-identity:${normalizedKey}`));
}

/** The signing key for a recovery key, or null when that isn't a key. Private:
 * nothing outside this module ever sees it. */
function secretKeyFor(raw: string): Uint8Array | null {
	const normalized = normalizeAuthorKey(raw);
	return normalized ? seedFromKey(normalized) : null;
}

/** The public key a recovery key resolves to, as lower-case hex. */
export function publicKeyFromAuthorKey(raw: string): string | null {
	const secret = secretKeyFor(raw);
	return secret ? hex(ed25519.getPublicKey(secret)) : null;
}

/** Whether a string has the shape of a public key this module would produce,
 * so a package carrying something else in the field is treated as carrying
 * nothing. Case and surrounding space are noise. */
export function isPublicKey(value: string): boolean {
	return /^[0-9a-f]{64}$/.test(value.trim().toLowerCase());
}

// ---- The handle ------------------------------------------------------------

/**
 * The word lists a handle is drawn from — 256 of each, so a word is exactly one
 * byte of the hash and the derivation stays obvious.
 *
 * Chosen to be calm, concrete and unmistakably a handle: nothing that reads as
 * a real name, nothing that reads as an insult, nothing whose meaning turns
 * unfortunate in another language. **Never reorder or remove an entry** — a
 * word's position *is* part of somebody's identity, and moving one silently
 * renames every handle that used it.
 */
const ADJECTIVES = [
	"amber", "ancient", "arctic", "ashen", "autumn", "azure", "balmy", "bold",
	"boreal", "brave", "brief", "bright", "brisk", "bronze", "buoyant", "burnished",
	"calm", "candid", "cedar", "chalky", "cheerful", "chestnut", "chilly", "cinnamon",
	"clean", "clear", "clever", "cloudy", "coastal", "cobalt", "coral", "cosy",
	"crimson", "crisp", "crystal", "curious", "cushioned", "dappled", "daring", "dawn",
	"deep", "deft", "delicate", "distant", "downy", "drifting", "dry", "dusk",
	"dusty", "eager", "early", "earthen", "eastern", "easy", "elegant", "ember",
	"emerald", "even", "evening", "faded", "fair", "fallow", "feathered", "fearless",
	"fern", "fervent", "fine", "firm", "fleet", "flint", "floating", "flowing",
	"forest", "fragrant", "free", "fresh", "frosted", "gentle", "gilded", "glacial",
	"gleaming", "glowing", "golden", "graceful", "granite", "grassy", "grounded", "hardy",
	"harvest", "hazel", "hazy", "hearty", "heather", "hidden", "hollow", "humble",
	"hushed", "ivory", "jade", "jolly", "keen", "kindly", "laced", "lasting",
	"lavender", "lean", "leafy", "level", "lilac", "limber", "linen", "lively",
	"lofty", "lone", "lucid", "lunar", "lush", "marble", "marbled", "meadow",
	"mellow", "merry", "mild", "minty", "mirrored", "misty", "mossy", "muted",
	"narrow", "neat", "nimble", "noble", "northern", "oaken", "ochre", "olive",
	"opal", "open", "orderly", "painted", "paper", "patient", "pearly", "pebbled",
	"peaceful", "placid", "plain", "pleasant", "plum", "polar", "polished", "prairie",
	"pressed", "prompt", "proud", "quaint", "quick", "quiet", "radiant", "rapid",
	"ready", "rested", "restful", "rich", "ripe", "rising", "roaming", "rosy",
	"round", "ruddy", "rugged", "rustic", "sable", "saffron", "sandy", "scarlet",
	"seaside", "secret", "sepia", "serene", "settled", "shaded", "sheer", "shining",
	"silent", "silken", "silver", "simple", "sincere", "slate", "sleek", "slender",
	"smooth", "snowy", "soft", "solar", "solemn", "sound", "southern", "spare",
	"sparkling", "spring", "spruce", "steady", "stellar", "still", "stony", "stormy",
	"straight", "striped", "sturdy", "sunlit", "sunny", "supple", "sweeping", "sweet",
	"swift", "tall", "tawny", "teal", "temperate", "tender", "thoughtful", "thriving",
	"tidal", "tidy", "timber", "tranquil", "true", "tufted", "twilight", "umber",
	"upland", "upright", "valiant", "velvet", "verdant", "vernal", "violet", "vivid",
	"wandering", "warm", "watchful", "weathered", "western", "whispering", "wide", "wild",
	"willing", "windswept", "winter", "wise", "woven", "yielding", "young", "zealous",
];

const NOUNS = [
	"alcove", "almond", "anchor", "anvil", "arbor", "arch", "archive", "ash",
	"aspen", "aster", "atlas", "attic", "aurora", "avenue", "awning", "balcony",
	"banner", "barley", "basin", "basket", "bay", "beacon", "beam", "bellows",
	"bench", "birch", "bloom", "bluff", "boathouse", "bobbin", "border", "bough",
	"boulder", "bower", "bramble", "branch", "brook", "buoy", "burrow", "cabin",
	"cairn", "canopy", "canyon", "cape", "cardinal", "carpet", "cascade", "cavern",
	"cedar", "cellar", "chamber", "channel", "chapel", "chestnut", "chimney", "cinder",
	"cipher", "cistern", "clearing", "cliff", "cloister", "clover", "coast", "cobble",
	"compass", "conifer", "copper", "coral", "corner", "cottage", "cove", "crag",
	"crane", "creek", "crest", "crocus", "crossing", "crown", "cypress", "dahlia",
	"dale", "delta", "dial", "dock", "dovecote", "drift", "dune", "ember",
	"estuary", "fathom", "feather", "fennel", "fern", "ferry", "field", "finch",
	"firth", "flagon", "flint", "forge", "fountain", "foyer", "fjord", "gable",
	"gallery", "garden", "gate", "glacier", "glade", "glen", "granary", "grotto",
	"grove", "gully", "hamlet", "harbor", "harvest", "hazel", "headland", "hearth",
	"heath", "hedge", "heron", "hillside", "hollow", "hostel", "ivy", "jetty",
	"juniper", "kestrel", "kettle", "keystone", "kiln", "lantern", "larch", "lattice",
	"laurel", "ledge", "ledger", "library", "lighthouse", "lily", "linden", "lintel",
	"lodge", "loft", "lookout", "magnolia", "mallow", "mantle", "maple", "marina",
	"marker", "marsh", "meadow", "meridian", "mesa", "mill", "mooring", "mosaic",
	"moss", "nest", "nettle", "oakwood", "oasis", "orchard", "otter", "outpost",
	"paddock", "pantry", "parapet", "parcel", "parlour", "pasture", "pathway", "pebble",
	"pennant", "pergola", "pier", "pillar", "pine", "plateau", "plaza", "pocket",
	"pond", "poplar", "porch", "portal", "prairie", "primrose", "quarry", "quill",
	"quilt", "rampart", "ravine", "reef", "ribbon", "ridge", "rill", "rookery",
	"rowan", "rudder", "sable", "saddle", "sanctuary", "sapling", "satchel", "sextant",
	"shale", "shelter", "shore", "shutter", "signal", "silo", "slope", "sparrow",
	"spindle", "spire", "spring", "spruce", "stable", "station", "steeple", "stile",
	"stream", "summit", "sundial", "swallow", "sycamore", "tavern", "teal", "terrace",
	"thicket", "thistle", "threshold", "tide", "timber", "tower", "trail", "trellis",
	"tundra", "turret", "valley", "vane", "vessel", "vestibule", "viaduct", "vineyard",
	"warren", "waterfall", "wharf", "wicket", "willow", "window", "wren", "yarrow",
];

/**
 * The public handle a public key resolves to.
 *
 * A pure function of the key, which is what makes it unclaimable in the weak
 * sense (there is no name field to disagree with, only a key, and everybody
 * computes the same answer from it) — and the signature is what makes it
 * unclaimable in the strong sense. Reads as `quiet-lantern-4kj2m8`.
 */
export function handleFromPublicKey(publicKey: string): string {
	const digest = sha256(utf8(`hearth-handle:${publicKey.trim().toLowerCase()}`));
	const adjective = ADJECTIVES[digest[0]];
	const noun = NOUNS[digest[1]];
	let suffix = "";
	for (let i = 0; i < HANDLE_SUFFIX_LENGTH; i++) {
		suffix += ALPHABET[digest[2 + i] % ALPHABET.length];
	}
	return `${adjective}-${noun}-${suffix.toLowerCase()}`;
}

/** Everything about an identity, from the one secret it is made of. */
export function identityFromKey(raw: string): AuthorIdentity | null {
	const key = normalizeAuthorKey(raw);
	if (!key) return null;
	const publicKey = publicKeyFromAuthorKey(key);
	if (!publicKey) return null;
	return { key, publicKey, handle: handleFromPublicKey(publicKey) };
}

/**
 * The handle to show for a package's author, or null when it has none.
 *
 * The rule the whole scheme rests on: a key is believed, a name never is. What
 * a package writes in `meta.author` is ignored entirely — the handle is
 * recomputed from the public key it carries — so a file claiming somebody
 * else's name displays as whoever its key really is, and a file with no key has
 * no author at all.
 *
 * This is only half the check. It says the name matches the key; whether the
 * file was actually made by the holder of that key is what the signature
 * answers, so a caller showing an author should verify first.
 */
export function verifiedAuthorName(publicKey: string | undefined): string | null {
	if (!publicKey || !isPublicKey(publicKey)) return null;
	return handleFromPublicKey(publicKey.trim().toLowerCase());
}

// ---- Signing ---------------------------------------------------------------

/** Sign a message with a recovery key's signing half. Hex, like the key it
 * verifies against. Null when the key isn't one. */
export function signMessage(rawKey: string, message: string): string | null {
	const secret = secretKeyFor(rawKey);
	if (!secret) return null;
	return hex(ed25519.sign(utf8(message), secret));
}

/**
 * Whether `signature` is this public key's signature over `message`.
 *
 * Never throws: a malformed signature, a malformed key and a wrong signature
 * are the same answer to the only question being asked, and every one of them
 * arrives from a file somebody else wrote.
 */
export function verifyMessage(
	publicKey: string,
	message: string,
	signature: string,
): boolean {
	try {
		if (!isPublicKey(publicKey) || !/^[0-9a-f]{128}$/.test(signature.trim().toLowerCase())) {
			return false;
		}
		return ed25519.verify(
			unhex(signature.trim().toLowerCase()),
			utf8(message),
			unhex(publicKey.trim().toLowerCase()),
		);
	} catch {
		return false;
	}
}

// ---- Small helpers ---------------------------------------------------------

/** UTF-8 bytes of a string, without TextEncoder (absent in some embedded
 * contexts, and the inputs here are short). */
function utf8(text: string): Uint8Array {
	const bytes: number[] = [];
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
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
		}
	}
	return new Uint8Array(bytes);
}

function hex(bytes: Uint8Array): string {
	let out = "";
	for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
	return out;
}

function unhex(text: string): Uint8Array {
	const bytes = new Uint8Array(text.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}
