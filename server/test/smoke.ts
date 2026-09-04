/**
 * End to end against a running gallery.
 *
 * Not a unit test: it signs in with a real key, publishes real signed packages,
 * votes, downloads and withdraws — because the things most worth checking about
 * a gallery are the ones that only exist when the pieces are together. That a
 * downloaded package comes back **byte for byte** is the load-bearing one: it
 * is what keeps the author's signature verifiable in the vault that installs
 * it, and it is exactly what a server that got clever with the file would
 * break.
 *
 *     npm run build && npm run smoke        # against a gallery on :8787
 *     GALLERY_URL=https://… npm run smoke   # against a deployed one
 *
 * It publishes two boards and withdraws one, so point it at a gallery you don't
 * mind writing to. Set WRITES_PER_MINUTE high enough for a run, or the rate
 * limiter will (correctly) refuse it half way through.
 */
import { readFileSync } from "node:fs";
import { signMessage } from "../../src/identity";

const BASE = process.env.GALLERY_URL ?? "http://localhost:8787";
const f = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, string>;

/**
 * Anything the gallery sent back.
 *
 * Deliberately unmodelled. The point of this file is to assert on real
 * responses, and giving them a shape here would mean maintaining a second copy
 * of the wire contract that the assertions could then agree with while the
 * server disagreed. The typed readers live in `test/gallery.test.ts`, on the
 * client's side, where the shape actually matters.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, extra?: unknown): void {
	if (ok) { pass++; console.log(`  ok   ${label}`); }
	else { fail++; console.log(`  FAIL ${label}`, extra ?? ""); }
}

async function call(method: string, path: string, body?: unknown, token?: string) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let json: Json = null as unknown as Json;
	try { json = JSON.parse(text); } catch { json = text; }
	return { status: res.status, json, text };
}

async function signIn(): Promise<string> {
	const ch = await call("POST", "/v1/auth/challenge", { publicKey: f.publicKey });
	const sig = signMessage(f.key, ch.json.nonce)!;
	const tok = await call("POST", "/v1/auth/token", {
		publicKey: f.publicKey, nonce: ch.json.nonce, signature: sig,
	});
	check("sign-in returns a token and the derived handle", tok.status === 200 && !!tok.json.token && tok.json.handle === f.handle, tok.json);
	return tok.json.token;
}

const token = await signIn();

// A wrong signature must not get a token.
{
	const ch = await call("POST", "/v1/auth/challenge", { publicKey: f.publicKey });
	const bad = await call("POST", "/v1/auth/token", {
		publicKey: f.publicKey, nonce: ch.json.nonce, signature: "0".repeat(128),
	});
	check("a bad signature is refused", bad.status === 401, bad.json);
	// And the nonce is spent even so.
	const replay = await call("POST", "/v1/auth/token", {
		publicKey: f.publicKey, nonce: ch.json.nonce, signature: signMessage(f.key, ch.json.nonce)!,
	});
	check("a spent nonce cannot be reused", replay.status === 401, replay.json);
}

check("publishing without a token is refused", (await call("POST", "/v1/entries", { package: f.a })).status === 401);

const first = await call("POST", "/v1/entries", { package: f.a }, token);
check("a signed package publishes", first.status === 200 && !!first.json.id && first.json.updated === false, first.json);
const id = first.json.id as string;

const second = await call("POST", "/v1/entries", { package: f.b }, token);
check("a second board publishes", second.status === 200 && second.json.id !== id, second.json);

const again = await call("POST", "/v1/entries", { package: f.a }, token);
check("republishing the same dashboard id updates it in place", again.status === 200 && again.json.id === id && again.json.updated === true, again.json);

const unsigned = await call("POST", "/v1/entries", { package: f.unsigned }, token);
check("an unsigned package is refused", unsigned.status === 422 && /not signed/.test(unsigned.json.error), unsigned.json);

const tampered = JSON.parse(f.a);
tampered.meta.name = "Somebody else's board";
const forged = await call("POST", "/v1/entries", { package: JSON.stringify(tampered) }, token);
check("an edited package fails its signature", forged.status === 422 && /signature/.test(forged.json.error), forged.json);

const leaky = await call("POST", "/v1/entries", { package: f.leaky }, token);
check("a package still naming the author's vault is refused", leaky.status === 422 && /author's vault/.test(leaky.json.error), leaky.json);

// Somebody else's dashboard id: the ordinary end of install → change →
// publish, and the case that makes `meta.id` unique across a gallery rather
// than per author. It must be a 403 whose message says what to do about it.
{
	const ch = await call("POST", "/v1/auth/challenge", { publicKey: f.forkPublicKey });
	const other = await call("POST", "/v1/auth/token", {
		publicKey: f.forkPublicKey,
		nonce: ch.json.nonce,
		signature: signMessage(f.forkKey, ch.json.nonce)!,
	});
	const clash = await call("POST", "/v1/entries", { package: f.fork }, other.json.token);
	check(
		"a second author cannot claim a dashboard id",
		clash.status === 403 && /duplicate the board/.test(clash.json.error),
		clash.json,
	);
	// And publishing under a key you are not signed in as is refused too.
	const wrongKey = await call("POST", "/v1/entries", { package: f.a }, other.json.token);
	check("a package signed by another key is refused", wrongKey.status === 403, wrongKey.json);
}

// A malformed percent escape is a path that names nothing, not a crash.
check(
	"a malformed path is a 404, not a 500",
	(await call("GET", "/v1/entries/%E0%A4%A")).status === 404,
);

// ---- Listing --------------------------------------------------------
const mineQuery = `author=${f.publicKey}`;
const list = await call("GET", `/v1/entries?sort=new&${mineQuery}`);
check("the listing has both boards", list.status === 200 && list.json.total === 2, list.json);
const row = list.json.entries.find((e: Json) => e.id === id);
check("a row carries the author's picture of the board", row?.hasSnapshot === true, row);
check("a row names the author by derived handle", row?.author?.handle === f.handle, row?.author);
check("the score starts at zero", row?.score === 0);

check("filtering by category works", (await call("GET", `/v1/entries?category=writing&${mineQuery}`)).json.total === 1);
check("an unknown category is ignored rather than erroring", (await call("GET", `/v1/entries?category=nonsense&${mineQuery}`)).json.total === 2);
check("search matches the name", (await call("GET", `/v1/entries?q=sprint+${f.run}`)).json.total === 1);
check("search matches a tag", (await call("GET", `/v1/entries?q=minimal&${mineQuery}`)).json.total === 2);
check("filtering by author works", (await call("GET", `/v1/entries?${mineQuery}`)).json.total === 2);

const detail = await call("GET", `/v1/entries/${id}`);
check("the detail carries the recommended theme", detail.json.theme === "Minimal", detail.json.theme);
{
	// Fetched directly rather than through `call`, because the answer is an
	// image and the point of the check is that it comes back as one.
	const shot = await fetch(`${BASE}/v1/entries/${id}/snapshot`);
	check(
		"the picture of the board comes back as an image",
		shot.status === 200 && (shot.headers.get("content-type") ?? "").startsWith("image/"),
		shot.status,
	);
	const none = await fetch(`${BASE}/v1/entries/${second.json.id}/snapshot`);
	check("a board published without a picture is a 404 there", none.status === 404);
}
check("the detail lists cards by kind", detail.json.cards?.length === 3, detail.json.cards);
check("the detail reports its size", detail.json.sizeBytes > 0);
check("a missing entry is a 404", (await call("GET", "/v1/entries/nope")).status === 404);
// A sort key is chosen from a closed set, and the lookup must not reach
// `Object.prototype` — `?sort=toString` would otherwise put a function into the
// ORDER BY and answer with a 500.
check(
	"a sort key that isn't one falls back rather than erroring",
	(await call("GET", `/v1/entries?sort=toString&${mineQuery}`)).status === 200,
);
check(
	"and so does one that is nonsense",
	(await call("GET", `/v1/entries?sort=nonsense&${mineQuery}`)).json.total === 2,
);

// ---- Voting ---------------------------------------------------------
const up = await call("POST", `/v1/entries/${id}/vote`, { value: 1 }, token);
check("an upvote counts once", up.json.score === 1 && up.json.upvotes === 1, up.json);
const upAgain = await call("POST", `/v1/entries/${id}/vote`, { value: 1 }, token);
check("voting the same way twice is still one vote", upAgain.json.score === 1, upAgain.json);
const down = await call("POST", `/v1/entries/${id}/vote`, { value: -1 }, token);
check("switching to a downvote moves both tallies", down.json.score === -1 && down.json.upvotes === 0 && down.json.downvotes === 1, down.json);
const cleared = await call("POST", `/v1/entries/${id}/vote`, { value: 0 }, token);
check("clearing a vote returns to zero", cleared.json.score === 0 && cleared.json.downvotes === 0, cleared.json);
check("a vote needs a token", (await call("POST", `/v1/entries/${id}/vote`, { value: 1 })).status === 401);
check("a nonsense vote value is refused", (await call("POST", `/v1/entries/${id}/vote`, { value: 7 }, token)).status === 400);

await call("POST", `/v1/entries/${id}/vote`, { value: 1 }, token);
const mine = await call("GET", `/v1/entries/${id}`, undefined, token);
check("the reader sees their own vote", mine.json.myVote === 1, mine.json.myVote);
const anon = await call("GET", `/v1/entries/${id}`);
check("a signed-out reader sees no vote of their own", anon.json.myVote === 0);

// ---- Comments -------------------------------------------------------
{
	check("an empty gallery entry starts with no comments",
		(await call("GET", `/v1/entries/${id}/comments`)).json.total === 0);
	check("commenting needs a token",
		(await call("POST", `/v1/entries/${id}/comments`, { body: "hi" })).status === 401);

	const posted = await call("POST", `/v1/entries/${id}/comments`, {
		body: "  Does this need Dataview 0.5?  ",
	}, token);
	check("a comment posts, trimmed",
		posted.status === 200 && posted.json.body === "Does this need Dataview 0.5?", posted.json);
	check("a comment is attributed to the derived handle",
		posted.json.author?.handle === f.handle, posted.json.author);

	check("an empty comment is refused",
		(await call("POST", `/v1/entries/${id}/comments`, { body: "   " }, token)).status === 400);
	check("a comment past the cap is refused",
		(await call("POST", `/v1/entries/${id}/comments`, { body: "x".repeat(1001) }, token)).status === 400);
	// A wall of blank lines is a way to make one comment fill a page.
	const squashed = await call("POST", `/v1/entries/${id}/comments`, {
		body: "one\n\n\n\n\n\ntwo",
	}, token);
	check("runs of blank lines are collapsed", squashed.json.body === "one\n\ntwo", squashed.json);

	const listed = await call("GET", `/v1/entries/${id}/comments`);
	check("comments come back newest first",
		listed.json.total === 2 && listed.json.comments[0].id === squashed.json.id, listed.json);

	// Somebody else's comment on somebody else's board is not yours to remove.
	const ch = await call("POST", "/v1/auth/challenge", { publicKey: f.forkPublicKey });
	const other = await call("POST", "/v1/auth/token", {
		publicKey: f.forkPublicKey,
		nonce: ch.json.nonce,
		signature: signMessage(f.forkKey, ch.json.nonce)!,
	});
	check("a stranger cannot remove a comment",
		(await call("DELETE", `/v1/comments/${posted.json.id}`, undefined, other.json.token)).status === 403);

	check("its author can remove it",
		(await call("DELETE", `/v1/comments/${posted.json.id}`, undefined, token)).status === 204);
	check("a removed comment is gone from the list",
		(await call("GET", `/v1/entries/${id}/comments`)).json.total === 1);

	// The board's owner can clear a comment off their own board — the whole of
	// moderation, in the hands of the person with the most reason to use it.
	const theirs = await call("POST", `/v1/entries/${id}/comments`, {
		body: "left by somebody else",
	}, other.json.token);
	check("the board's owner can remove somebody else's comment",
		(await call("DELETE", `/v1/comments/${theirs.json.id}`, undefined, token)).status === 204);

	check("comments on a missing entry are a 404",
		(await call("GET", "/v1/entries/nope/comments")).status === 404);
}

// ---- Download -------------------------------------------------------
const dl = await call("GET", `/v1/entries/${id}/package`);
check("the package comes back byte for byte", dl.text === f.a, `${dl.text.length} vs ${f.a.length}`);
const after = await call("GET", `/v1/entries/${id}`);
check("a download is counted", after.json.downloads === 1, after.json.downloads);
await call("GET", `/v1/entries/${id}/package`);
const twice = await call("GET", `/v1/entries/${id}`);
check("a second download from the same address is not", twice.json.downloads === 1, twice.json.downloads);

// ---- Profile --------------------------------------------------------
const profile = await call("GET", `/v1/authors/${f.publicKey}`);
check("the profile lists both boards", profile.json.entries?.length === 2, profile.json.entries?.length);
check("the profile sums the votes across them", profile.json.totalScore === 1, profile.json.totalScore);
check("the profile sums the installs", profile.json.totalDownloads === 1, profile.json.totalDownloads);
check("an unknown key has no profile", (await call("GET", `/v1/authors/${"b".repeat(64)}`)).status === 404);

// ---- Withdrawing ----------------------------------------------------
check("withdrawing somebody else's entry is refused", (await call("DELETE", `/v1/entries/${id}`)).status === 401);
check("withdrawing your own works", (await call("DELETE", `/v1/entries/${id}`, undefined, token)).status === 204);
check("a withdrawn entry is gone from the listing", (await call("GET", `/v1/entries?${mineQuery}`)).json.total === 1);
check("a withdrawn entry cannot be downloaded", (await call("GET", `/v1/entries/${id}/package`)).status === 404);
// A takedown has to stick: republishing the identical package must not put a
// removed entry back under the same id, or moderation is something its author
// can simply undo.
{
	const again = await call("POST", "/v1/entries", { package: f.a }, token);
	check(
		"a removed entry cannot be republished",
		again.status === 403 && /removed/.test(again.json.error),
		again.json,
	);
	check(
		"and it stays out of the listing",
		(await call("GET", `/v1/entries?${mineQuery}`)).json.total === 1,
	);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
