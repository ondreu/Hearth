// Release-safety guards for the manifest/version files, run in CI.
//
// These protect two Obsidian-store invariants that are easy to break by hand
// and only surface as a failed *release*:
//
//   1. versions.json must contain an entry for manifest.json's version.
//      Obsidian resolves a plugin release by looking up the manifest version
//      in versions.json; a missing entry yields "No release matches your
//      manifest version" and the release is rejected.
//
//   2. manifest-beta.json (read by BRAT) must stay a pre-release that is
//      strictly ahead of the stable manifest, and must not drift from it in
//      any field other than `version`. This keeps the beta channel from ever
//      falling behind — or diverging from — the store-facing manifest.
//
// The plain-x.y.z guard on manifest.json already lives in ci.yml/release.yml;
// this file complements it. Run locally with: node scripts/verify-manifests.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));

const errors = [];
const fail = (msg) => errors.push(msg);

const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const beta = readJson("manifest-beta.json");

// --- 1. versions.json has an entry for the stable manifest version ----------
if (!Object.prototype.hasOwnProperty.call(versions, manifest.version)) {
	fail(
		`versions.json is missing an entry for manifest.json version ` +
			`"${manifest.version}". Add "${manifest.version}": "${manifest.minAppVersion}" ` +
			`or the Obsidian store rejects the release with ` +
			`"No release matches your manifest version".`,
	);
}

// --- semver precedence (enough of the spec for our x.y.z[-pre] tags) --------
function parseSemver(v) {
	const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(v));
	if (!m) return null;
	return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [] };
}

function cmpSemver(a, b) {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	// A version WITHOUT a prerelease outranks one that has it (1.0.0 > 1.0.0-beta).
	if (a.pre.length === 0 && b.pre.length === 0) return 0;
	if (a.pre.length === 0) return 1;
	if (b.pre.length === 0) return -1;
	const n = Math.min(a.pre.length, b.pre.length);
	for (let i = 0; i < n; i++) {
		const x = a.pre[i];
		const y = b.pre[i];
		const xn = /^\d+$/.test(x);
		const yn = /^\d+$/.test(y);
		if (xn && yn) {
			const d = +x - +y;
			if (d) return d;
		} else if (xn) {
			return -1; // numeric identifiers rank below alphanumeric
		} else if (yn) {
			return 1;
		} else if (x !== y) {
			return x < y ? -1 : 1;
		}
	}
	return a.pre.length - b.pre.length;
}

// --- 4. manifest-beta invariants --------------------------------------------
const stableSv = parseSemver(manifest.version);
const betaSv = parseSemver(beta.version);

if (!stableSv) fail(`manifest.json version "${manifest.version}" is not valid semver.`);
if (!betaSv) {
	fail(`manifest-beta.json version "${beta.version}" is not valid semver.`);
} else {
	if (betaSv.pre.length === 0) {
		fail(
			`manifest-beta.json version "${beta.version}" is not a pre-release ` +
				`(no "-suffix"). BRAT's beta channel must hold a pre-release; ` +
				`stable versions belong in manifest.json.`,
		);
	}
	if (stableSv && cmpSemver(betaSv, stableSv) <= 0) {
		fail(
			`manifest-beta.json version "${beta.version}" must be strictly ahead ` +
				`of manifest.json version "${manifest.version}". Open the next beta ` +
				`(e.g. bump manifest-beta.json) so BRAT users are not stuck behind stable.`,
		);
	}
}

// No field other than `version` may differ between the two manifests.
const keys = new Set([...Object.keys(manifest), ...Object.keys(beta)]);
keys.delete("version");
for (const k of keys) {
	const a = JSON.stringify(manifest[k]);
	const b = JSON.stringify(beta[k]);
	if (a !== b) {
		fail(
			`Field "${k}" differs between manifest.json (${a}) and ` +
				`manifest-beta.json (${b}). The two manifests must match on every ` +
				`field except "version".`,
		);
	}
}

if (errors.length) {
	for (const e of errors) console.error(`::error::${e}`);
	console.error(`\n${errors.length} manifest/version problem(s) — see RELEASING.md.`);
	process.exit(1);
}

console.log(
	`Manifest guards OK: stable ${manifest.version} in versions.json; ` +
		`beta ${beta.version} is a pre-release ahead of stable and matches on all other fields.`,
);
