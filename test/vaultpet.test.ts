import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import {
	VAULT_PET_BLOCK,
	VAULT_PET_HOUSE_VIEW,
	VAULT_PET_HOUSE_VIEW_LEGACY,
	VAULT_PET_PLUGIN_ID,
	isVaultPetAvailable,
	openVaultPetHouse,
	vaultPetDisplay,
	vaultPetDisplays,
	vaultPetHasPetBlock,
	vaultPetHouseView,
	vaultPetPlugin,
} from "../src/vaultpet";
import type { DashboardCard } from "../src/types";

/**
 * The Vault Pet integration. Rendering is Obsidian API and stays untested (per
 * the no-mocks rule); what is covered here is everything that decides *whether*
 * Hearth touches the plugin at all — the availability probe, the two routes
 * into its house, and the display a card resolves to — because each one is a
 * guard against a plugin that is missing, disabled or a version ahead.
 */

/** A stand-in `App` carrying only the registries these functions read. */
function fakeApp(opts: {
	plugin?: Record<string, unknown>;
	commands?: Record<string, boolean>;
	commandCalls?: string[];
	views?: string[];
} = {}): App {
	const viewByType = Object.fromEntries((opts.views ?? []).map((type) => [type, {}]));
	return {
		plugins: {
			plugins: opts.plugin ? { [VAULT_PET_PLUGIN_ID]: opts.plugin } : {},
		},
		commands: {
			executeCommandById: (id: string) => {
				opts.commandCalls?.push(id);
				return opts.commands?.[id] ?? false;
			},
		},
		viewRegistry: { viewByType },
	} as unknown as App;
}

/** A card of the kind under test, with whatever config the case needs. */
function card(vaultPet?: DashboardCard["vaultPet"]): DashboardCard {
	return { id: "c1", kind: "vaultpet", x: 0, y: 0, w: 3, h: 4, vaultPet };
}

describe("the plugin probe", () => {
	it("finds the running instance, and reports nothing when it isn't loaded", () => {
		const instance = { openHouse: () => undefined };
		expect(vaultPetPlugin(fakeApp({ plugin: instance }))).toBe(instance);
		expect(isVaultPetAvailable(fakeApp({ plugin: instance }))).toBe(true);

		expect(vaultPetPlugin(fakeApp())).toBeNull();
		expect(isVaultPetAvailable(fakeApp())).toBe(false);
	});

	it("survives an app object missing the registries entirely", () => {
		// Not hypothetical: the card's settings preview and the unit tests both
		// hand around partial app objects, and a throw here would take down a
		// dashboard render.
		expect(isVaultPetAvailable({} as App)).toBe(false);
	});
});

describe("opening the pet house", () => {
	it("calls the plugin's own method when it has one", () => {
		let opened = 0;
		const app = fakeApp({ plugin: { openHouse: () => void opened++ } });
		expect(openVaultPetHouse(app)).toBe(true);
		expect(opened).toBe(1);
	});

	it("falls back to the plugin's command when the method is gone", () => {
		// A renamed internal must cost the button, not the feature.
		const calls: string[] = [];
		const app = fakeApp({
			plugin: {},
			commands: { "vault-pet:open-house": true },
			commandCalls: calls,
		});
		expect(openVaultPetHouse(app)).toBe(true);
		expect(calls).toEqual(["vault-pet:open-house"]);
	});

	it("falls back to the command when the method throws", () => {
		const calls: string[] = [];
		const app = fakeApp({
			plugin: {
				openHouse: () => {
					throw new Error("boom");
				},
			},
			commands: { "vault-pet:open-house": true },
			commandCalls: calls,
		});
		expect(openVaultPetHouse(app)).toBe(true);
		expect(calls).toEqual(["vault-pet:open-house"]);
	});

	it("reports failure when neither route is there", () => {
		expect(openVaultPetHouse(fakeApp())).toBe(false);
		expect(openVaultPetHouse({} as App)).toBe(false);
	});
});

describe("vaultPetDisplay", () => {
	it("defaults to the pet, and keeps a house that was chosen", () => {
		expect(vaultPetDisplay(card())).toBe("pet");
		expect(vaultPetDisplay(card({}))).toBe("pet");
		expect(vaultPetDisplay(card({ display: "pet" }))).toBe("pet");
		expect(vaultPetDisplay(card({ display: "house" }))).toBe("house");
	});

	it("falls back to the pet for a value from a newer (or edited) Hearth", () => {
		const fromTheFuture = card({ display: "aviary" as never });
		expect(vaultPetDisplay(fromTheFuture)).toBe("pet");
	});

	it("keeps a legacy card's stored pet choice for a downgrade", () => {
		// Boards saved against Vault Pet 0.4-0.6 carry display:"pet". Resolving
		// the display must not rewrite them: the same card has to render the
		// compact block again when the old plugin comes back.
		const legacy = card({ display: "pet" });
		expect(vaultPetDisplay(legacy)).toBe("pet");
		expect(legacy.vaultPet).toEqual({ display: "pet" });

		// A card from before the setting existed has no config at all; the
		// default keeps it working without adding keys to the stored board.
		const old = card();
		expect(vaultPetDisplay(old)).toBe("pet");
		expect(old.vaultPet).toBeUndefined();
	});
});

describe("the plugin's surfaces", () => {
	it("resolves the house view type the instance registers", () => {
		// 1.x renamed the view; 0.4-0.6 keep the old name, and either must host.
		expect(vaultPetHouseView(fakeApp({ views: [VAULT_PET_HOUSE_VIEW] }))).toBe(VAULT_PET_HOUSE_VIEW);
		expect(vaultPetHouseView(fakeApp({ views: [VAULT_PET_HOUSE_VIEW_LEGACY] }))).toBe(
			VAULT_PET_HOUSE_VIEW_LEGACY,
		);
		expect(vaultPetHouseView(fakeApp({ views: [VAULT_PET_HOUSE_VIEW_LEGACY, VAULT_PET_HOUSE_VIEW] }))).toBe(
			VAULT_PET_HOUSE_VIEW,
		);
		expect(vaultPetHouseView(fakeApp())).toBeNull();
	});

	it("treats the legacy house view as the witness for the compact block", () => {
		// 0.4-0.6 registered `vault-pet` together with `vault-pet-house`; 1.0
		// dropped both names, so the view registry is what tells them apart.
		expect(vaultPetHasPetBlock(fakeApp({ views: [VAULT_PET_HOUSE_VIEW_LEGACY] }))).toBe(true);
		expect(vaultPetHasPetBlock(fakeApp({ views: [VAULT_PET_HOUSE_VIEW] }))).toBe(false);
		expect(vaultPetHasPetBlock(fakeApp())).toBe(false);
	});

	it("offers only the house when the compact block is gone", () => {
		// Both displays render the house on 1.x+, so the editor must not promise
		// a compact view the running plugin no longer has.
		expect(vaultPetDisplays(fakeApp({ views: [VAULT_PET_HOUSE_VIEW_LEGACY] }))).toEqual([
			"pet",
			"house",
		]);
		expect(vaultPetDisplays(fakeApp({ views: [VAULT_PET_HOUSE_VIEW] }))).toEqual(["house"]);
		expect(vaultPetDisplays(fakeApp())).toEqual(["house"]);
	});

	it("names the current and legacy view types", () => {
		expect(VAULT_PET_HOUSE_VIEW).toBe("kitcommit-house");
		expect(VAULT_PET_HOUSE_VIEW_LEGACY).toBe("vault-pet-house");
	});
});

describe("what Hearth hands the plugin", () => {
	it("renders the plugin's own empty fenced block", () => {
		// The processor is registered on the language and ignores the contents,
		// so the block is exactly what its "Insert pet card" command writes.
		expect(VAULT_PET_BLOCK).toBe("```vault-pet\n```");
	});
});
