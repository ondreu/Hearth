import { Platform, requireApiVersion, type App, type Plugin } from "obsidian";
import type {
	CapabilityIdV1,
	DeveloperApiChannelStatusV1,
	OperonDeveloperApiAccessorV1,
	OperonDeveloperApiV1,
} from "@stratejya/operon-cli/contracts/v1";

/**
 * Operon's in-process Developer API V1 — the plugin's own public integration
 * surface, and the only thing Hearth talks to. Operon owns task parsing,
 * recurrence, statuses and its index; Hearth asks for typed snapshots and
 * renders them. Nothing here reads Operon's markdown or reimplements its rules.
 *
 * Three properties of that API shape every decision in this module:
 *
 * 1. It is desktop-only and needs Obsidian 1.12.2+. Hearth ships mobile and
 *    declares minAppVersion 1.8.7, so "unavailable" is a normal state, not an
 *    error path.
 * 2. Access is granted by the user, per capability, in Operon's own settings —
 *    no modal fires from here — and it is all-or-nothing: one missing capability
 *    fails the whole session. That is why Hearth requests a single fixed read
 *    scope instead of a per-card set.
 * 3. There are no change events and sessions go stale when either plugin
 *    reloads, so the session is re-derived from the live registry on demand and
 *    cards refresh off Hearth's own vault-event hub.
 */

/** The community-plugin id Operon registers itself under. */
export const OPERON_PLUGIN_ID = "operon";

/** Obsidian version Operon's accessor requires before it will hand out an API. */
export const OPERON_MIN_APP_VERSION = "1.12.2";

/**
 * Every capability Hearth asks for, across all of its Operon cards — reads
 * only. Operon refuses to open a partially authorized session, so requesting
 * the union once means the user approves Hearth once; asking per card would
 * queue a fresh pending request each time a card is added.
 *
 * `system.health` and `system.capabilities` need no grant, but they are listed
 * so the requested set is the full picture the user reviews in Operon.
 */
export const OPERON_READ_CAPABILITIES: readonly CapabilityIdV1[] = [
	"system.health",
	"system.capabilities",
	"catalog.read",
	"tasks.read",
	"tasks.query",
	"tasks.finder",
	"timers.read",
];

/**
 * Why an Operon card can't show data right now — or that it can ("ready").
 * Every state maps to its own empty-state string, because "Operon isn't
 * installed" and "you haven't approved Hearth yet" need very different
 * instructions.
 */
export type OperonAccessState =
	/** Not installed, not enabled, or too old to expose the accessor. */
	| "absent"
	/** Operon refused for a reason of its own. `OperonAccess.error` says which. */
	| "error"
	/** Mobile, or an Obsidian older than Operon's Developer API requires. */
	| "unsupported"
	/** Operon is up but its runtime is still starting; retry shortly. */
	| "booting"
	/** Waiting for the user to approve Hearth in Operon's settings. */
	| "pending"
	/** Approved once, then suspended (usually a major Hearth version bump). */
	| "suspended"
	/** The user revoked Hearth's grant. */
	| "revoked"
	/** Reads are admitted. */
	| "ready";

/** Operon's own account of a refusal, kept so Hearth can show it verbatim
 * instead of guessing. `reasonCode` is the finer-grained identifier Operon puts
 * in `error.details` (e.g. `developer-api-consumer-unverified`). */
export interface OperonAccessError {
	code: string;
	reason: string;
	reasonCode?: string;
}

export interface OperonAccess {
	state: OperonAccessState;
	/** The live API, only ever set when `state === "ready"`. */
	api: OperonDeveloperApiV1 | null;
	/** Operon's own channel report, kept even on failure — it carries the grant
	 * summary the settings tab and empty states describe. */
	status: DeveloperApiChannelStatusV1 | null;
	/** Why Operon refused, when it said. Null on success. */
	error: OperonAccessError | null;
	/** Capabilities requested but not granted, for the settings readout. */
	missing: readonly string[];
}

/** The bare structural probe: is something plugged in at `operon` that offers
 * the V1 accessor? Deliberately cheap and side-effect free — it gates the
 * add-card menu and runs on every menu open, so it must not open a session. */
export function getOperonAccessor(app: App): OperonDeveloperApiAccessorV1 | null {
	const plugin = app.plugins.getPlugin(OPERON_PLUGIN_ID) as
		| { getDeveloperApiV1?: unknown }
		| null
		| undefined;
	if (plugin && typeof plugin.getDeveloperApiV1 === "function") {
		return plugin as OperonDeveloperApiAccessorV1;
	}
	return null;
}

/** Whether Operon is enabled and exposes its Developer API accessor. Says
 * nothing about platform support or whether the user has approved Hearth. */
export function isOperonAvailable(app: App): boolean {
	return getOperonAccessor(app) !== null;
}

/** Whether this Obsidian build can host Operon's Developer API at all. Operon
 * checks the same two conditions before handing out an API, so checking them
 * first lets Hearth explain *why* instead of showing a generic failure. */
export function isOperonPlatformSupported(): boolean {
	return Platform.isDesktopApp && requireApiVersion(OPERON_MIN_APP_VERSION);
}

/**
 * Turn an access attempt into the one state the UI branches on. Pure so the
 * cards, the settings readout and the tests all agree on the rules.
 *
 * `ok` sessions can still be unusable: Operon reports `admission.reads` false
 * while its runtime settles, and a session whose grant went away mid-flight
 * reports a non-active grant. Both are treated as not-ready rather than as
 * successes that fail on the first read.
 */
export function classifyAccess(
	ok: boolean,
	status: DeveloperApiChannelStatusV1 | null,
	error?: OperonAccessError | null,
): OperonAccessState {
	if (!status) return "absent";

	// Platform and host-version refusals are terminal for this device.
	if (status.reason === "unsupported-platform" || status.reason === "unsupported-version") {
		return "unsupported";
	}

	// `grant` is present only once Operon actually evaluated one — which is
	// also the only path on which it records a pending request for the user to
	// approve. Its absence therefore means Operon refused earlier than that,
	// and telling the user to go approve something would send them to a list
	// that will be empty.
	const grant = status.grant?.state;
	if (grant) {
		if (grant === "revoked") return "revoked";
		if (grant === "suspended") {
			// Operon suspends a grant on a version change the user must review —
			// but it reports the same state while its own grant store is mid-write,
			// which is transient and needs nobody. Its reason code separates the
			// two, and only the first has anything to review: on the transient
			// path Operon does not record a request, so sending the user to its
			// settings would send them to an empty list.
			return error?.reasonCode === GRANT_STORE_BUSY ? "booting" : "suspended";
		}
		if (grant === "pending") return "pending";
		// Grant is active. Reads can still be inadmissible while the runtime
		// starts; anything else that failed is Operon's to explain.
		if (!status.admission.reads) return "booting";
		return ok ? "ready" : "error";
	}

	// Refused before any grant was evaluated. Two of these are ordinary
	// transient states; the rest need Operon's own message, not a guess.
	if (status.reason === "unloading") return "booting";
	if (error?.code === "handler-unavailable") return "booting";
	return "error";
}

/**
 * Operon's reason code for "my grant store has a write in flight".
 *
 * It surfaces as a *suspended* grant, which normally means the user has to
 * review something — but this one resolves itself. It reliably fires on the
 * very first request from a new consumer: evaluating the grant observes a
 * consumer version it has never seen, which enqueues a write, and the same
 * call then reports a persistence error because that write has not drained
 * yet. Retrying a moment later evaluates cleanly and files the real request.
 */
const GRANT_STORE_BUSY = "grant-persistence-unavailable";

/** Whether this state resolves on its own, given a moment. Nothing the user
 * does changes these, so a card showing one should retry rather than instruct. */
export function isTransientAccessState(state: OperonAccessState): boolean {
	return state === "booting";
}

/** Narrow Operon's structured error to what Hearth shows and branches on. */
export function accessErrorOf(error: unknown): OperonAccessError | null {
	if (!error || typeof error !== "object") return null;
	const e = error as { code?: unknown; reason?: unknown; details?: { reasonCode?: unknown } };
	if (typeof e.code !== "string") return null;
	return {
		code: e.code,
		reason: typeof e.reason === "string" ? e.reason : "",
		reasonCode: typeof e.details?.reasonCode === "string" ? e.details.reasonCode : undefined,
	};
}

/** Requested capabilities Operon has not granted, in requested order. */
export function missingCapabilities(status: DeveloperApiChannelStatusV1 | null): string[] {
	const grant = status?.grant;
	if (!grant) return [...OPERON_READ_CAPABILITIES];
	const granted = new Set<string>(grant.grantedCapabilities);
	return grant.requestedCapabilities.filter((id) => !granted.has(id));
}

/** How long a non-ready access result is reused before renegotiating. Long
 * enough that a dashboard full of Operon cards negotiates once, short enough
 * that approving in Operon's settings takes effect without a reload. */
const RETRY_BACKOFF_MS = 5_000;

const UNAVAILABLE: OperonAccess = {
	state: "absent",
	api: null,
	status: null,
	error: null,
	missing: OPERON_READ_CAPABILITIES,
};

/**
 * Holds Hearth's single Operon session and re-derives it when it can no longer
 * be trusted. One instance lives on the plugin (`plugin.operon`); cards and the
 * settings tab share it so the vault sees one consumer, one grant and one
 * session rather than one per card.
 */
export class OperonSession {
	private readonly plugin: Plugin;
	/** The accessor the current session was opened against. Operon invalidates
	 * sessions when either plugin reloads, and there is no event for it, so
	 * identity drift against the live registry is the signal we have. */
	private accessor: OperonDeveloperApiAccessorV1 | null = null;
	private cached: OperonAccess | null = null;
	/** When the cached non-ready result stops being reused. Without this, a
	 * vault whose grant is still pending would renegotiate on every card, on
	 * every redraw — and every dashboard redraw is a vault change away. */
	private retryAfter = 0;
	private readonly onInvalidate: (() => void)[] = [];

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	/** Run `fn` whenever the session is dropped. Used to clear caches keyed to
	 * a session (the taxonomy) without this module importing them, which would
	 * make the read path depend on its own consumers. */
	registerInvalidation(fn: () => void): void {
		this.onInvalidate.push(fn);
	}

	private get app(): App {
		return this.plugin.app;
	}

	/**
	 * The current access, opening a session on first use. Cheap to call on
	 * every card render: an established session is returned as-is, and a new
	 * one is only negotiated when the cached result is unusable or the live
	 * Operon instance has been swapped out under us.
	 */
	access(): OperonAccess {
		const accessor = getOperonAccessor(this.app);
		if (!accessor) {
			this.accessor = null;
			this.cached = null;
			return UNAVAILABLE;
		}
		// A swapped-out instance means either plugin reloaded, which is exactly
		// what makes a session stale — that is the only signal available, since
		// Operon has no change events to subscribe to.
		if (this.accessor !== accessor) {
			this.cached = null;
			this.retryAfter = 0;
		} else if (this.cached) {
			if (this.cached.state === "ready") return this.cached;
			// Not ready: back off rather than re-asking on every render. The
			// state changes when the user acts in Operon's settings, not while
			// a dashboard redraws, and the Recheck button skips the wait.
			if (Date.now() < this.retryAfter) return this.cached;
		}
		return this.open(accessor);
	}

	/**
	 * Drop the session so the next `access()` renegotiates. Called when a read
	 * comes back asking to rediscover, from the settings "Recheck" button, and
	 * on plugin unload.
	 */
	invalidate(): void {
		this.accessor = null;
		this.cached = null;
		this.retryAfter = 0;
		for (const fn of this.onInvalidate) {
			try {
				fn();
			} catch {
				// A misbehaving cache must not stop the session from resetting.
			}
		}
	}

	private open(accessor: OperonDeveloperApiAccessorV1): OperonAccess {
		this.accessor = accessor;

		// Check the two hard preconditions ourselves: Operon reports them too,
		// but only after building a status, and this way a mobile vault never
		// records a pending grant request the user can't act on.
		if (!isOperonPlatformSupported()) {
			// Terminal for this device: nothing the user does changes it, so it
			// is cached until the session is explicitly invalidated.
			this.retryAfter = Number.MAX_SAFE_INTEGER;
			this.cached = { state: "unsupported", api: null, status: null, error: null, missing: [] };
			return this.cached;
		}

		let result;
		try {
			result = accessor.getDeveloperApiV1(this.plugin, {
				contractVersion: 1,
				// Pinned: a future Runtime V2 must fail access cleanly rather
				// than be driven with V1 assumptions.
				runtimeApi: { min: 1, max: 1 },
				requestedCapabilities: OPERON_READ_CAPABILITIES,
			});
		} catch {
			// A throwing accessor is out of contract; treat it as absent so the
			// card degrades instead of taking the dashboard render down.
			this.cached = null;
			return UNAVAILABLE;
		}

		const status = result.status ?? null;
		// Operon reports a refusal both on the result and (for lifecycle
		// problems) on the status; prefer the result's, which is the specific
		// one for this attempt.
		const error = accessErrorOf(result.ok ? null : result.error) ?? accessErrorOf(status?.error);
		const state = classifyAccess(result.ok, status, error);
		// Operon says how long to wait when it knows; otherwise back off long
		// enough that a burst of card renders costs one negotiation.
		this.retryAfter = state === "ready" ? 0 : Date.now() + (status?.retryAfterMs ?? RETRY_BACKOFF_MS);
		this.cached = {
			state,
			api: result.ok && state === "ready" ? result.api : null,
			status,
			error,
			missing: missingCapabilities(status),
		};
		return this.cached;
	}
}
