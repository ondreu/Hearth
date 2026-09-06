/**
 * English base locale — the source of truth for every user-facing string in
 * Hearth. All other locales are typed against `typeof en` (see
 * `src/locales/index.ts`), so this file defines the complete set of keys a
 * translation must provide.
 *
 * Conventions:
 *  - Plain UI strings are string literals.
 *  - Strings that interpolate values are functions, so each locale controls
 *    word order and pluralization itself.
 *  - Only live UI "chrome" is translated here. User-editable seed data (the
 *    default dashboard title, starter card titles, default mobile-button
 *    labels) stays in `types.ts`/`templates.ts` as English defaults, since it
 *    is persisted to the vault the moment a dashboard is created.
 */
export const en = {
	// ---- Commands (command palette) & ribbon ---------------------------
	commands: {
		openHome: "Open home dashboard",
		newNote: "Create new note (default location)",
		newDrawing: "Create new Excalidraw drawing",
		recordVoice: "Start/stop voice recording",
		openDailyNote: "Open today's daily note",
		runSetup: "Set up Hearth (first-run wizard)",
		switchDashboard: (n: number) => `Switch to dashboard ${n}`,
		openDashboard: (n: number) => `Open dashboard ${n}`,
		nextDashboard: "Next dashboard",
		previousDashboard: "Previous dashboard",
	},
	ribbon: {
		openHome: "Open Hearth home",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth: could not create a new note.",
		operonTaskMissing:
			"Hearth: that Operon task's note is no longer in the vault.",
		operonRechecked: "Hearth: rechecked the Operon connection.",
		operonWriteFailed: (reason: string) => `Hearth: Operon refused the change — ${reason}`,
		/** A refused create, with the Operon setting that decided the target —
		 * the error alone names a configured target without saying which one. */
		operonCreateFailed: (reason: string, where: string) =>
			`Hearth: Operon refused to create the task — ${reason} ${where} ` +
			"Change it in Operon's settings, or pick a different target under “New tasks” " +
			"in this card's settings.",
		/** The mutation may have landed. Hearth has already spent its one legal
		 * recovery attempt, so the honest report is "unknown", not "failed" —
		 * and never an offer to retry, which could apply the change twice. */
		operonWriteUnknown: (reason: string) =>
			`Hearth: Operon couldn't confirm whether the change was applied (${reason}). ` +
			"The card has been re-read — check the task before trying again.",
		enableExcalidraw:
			"Hearth: enable the Excalidraw plugin to create drawings.",
		excalidrawCommandMissing:
			"Hearth: couldn't find Excalidraw's \"new drawing\" command.",
		enableAudioRecorder: "Hearth: enable the core Audio recorder plugin.",
		couldNotRecordVoice: "Hearth: couldn't start voice recording.",
		enableDailyNotes: "Hearth: enable the core Daily notes plugin.",
		couldNotOpenDaily: "Hearth: couldn't open today's daily note.",
		couldNotOpenPeriodic: "Hearth: Periodic Notes couldn't make that note.",
		commandNotFound: (id: string) => `Hearth: command not found: ${id}`,
		couldNotCreateNoteForDay: (day: string) =>
			`Hearth: couldn't create a note for ${day}.`,
		couldNotCreateEventNote: "Hearth: couldn't create a note for that event.",
		taskNotesCreateFailed: "Hearth: couldn't run TaskNotes: Create new task.",
		taskChangedOnDisk: "Hearth: that task changed on disk — refreshed.",
		couldNotOpenTaskNote: "Hearth: couldn't open that task's note.",
		couldNotUpdateTaskStatus: "Hearth: couldn't update the task status.",
		couldNotCompleteRecurring:
			"Hearth: couldn't mark the recurring task instance complete.",
		couldNotUndoRecurring:
			"Hearth: couldn't undo the recurring task completion.",
		couldNotAddKanbanCard: "Hearth: couldn't add the card to the Kanban board.",
		couldNotConvertCard: "Hearth: couldn't convert the card into a note.",
		templaterNoTemplate: (path: string) =>
			`Hearth: template not found: ${path}`,
		templaterFailed: (name: string) =>
			`Hearth: Templater didn't create a note from ${name}.`,
		templaterCreated: (path: string) => `Hearth: created ${path}`,
		newNoteTemplaterMissing:
			"Hearth: the “New note” button is set to a Templater template, but " +
			"Templater isn’t enabled — making a blank note instead.",
		exported: "Hearth: exported.",
		layoutExported: "Hearth: layout exported.",
		layoutImported: "Hearth: layout imported.",
		layoutImportError: (error: string) => `Hearth: ${error}`,
		exportedToVault: (file: string) =>
			`Hearth: saved ${file} to your vault's root folder.`,
		exportFailed: "Hearth: couldn't save the export file.",
		cardCopied: "Card copied to the dashboard.",
	},

	// ---- The home view -------------------------------------------------
	view: {
		displayName: "Home",
	},

	// ---- Header / search bar -------------------------------------------
	header: {
		newNote: "New note",
		newNoteAria: "Create new note",
		searchOnline: "Search online",
		searchOnlineAria: "Search the web for the current query",
		searchOnlinePickAria: "Choose a search engine",
		searchEngineDefault: (name: string) => `${name} (default)`,
	},
	search: {
		placeholder: "Search the vault",
		noMatches: "No matches",
		noMatchingCommands: "No matching commands",
	},

	// ---- Shared confirm dialog -----------------------------------------
	confirm: {
		confirm: "Confirm",
		cancel: "Cancel",
		ok: "OK",
	},

	// ---- "What's new" release-notes dialog -----------------------------
	whatsNew: {
		title: "What's new in Hearth",
		intro: "Thanks for updating! Here's what's changed since you last checked.",
		/** Shown instead of {@link intro} when there are headlines to click. */
		introHint:
			"Thanks for updating! Here's what's changed since you last checked — " +
			"click any line to read the details.",
		close: "Got it",
		footer: "Full details live in the plugin's README.",
		/** The Added / Changed / Fixed group labels. */
		kinds: {
			added: "New",
			changed: "Changed",
			fixed: "Fixed",
			removed: "Removed",
			deprecated: "Deprecated",
			security: "Security",
			other: "Also",
		},
		filterPlaceholder: "Filter changes…",
		expandAll: "Expand all",
		collapseAll: "Collapse all",
		noMatches: (query: string) => `Nothing here mentions "${query}".`,
		/** Tooltip on a version's compare/release link. */
		releaseNotes: (version: string) => `Release notes for ${version} on GitHub`,
		/** Label for the header row that folds a release away. */
		releaseToggle: (version: string) => `Show or hide what changed in ${version}`,
		/** Tooltip on the `#123` link beside a change. */
		issue: (n: string) => `Issue #${n} on GitHub`,
	},

	// ---- First-run setup wizard ----------------------------------------
	setup: {
		/** Short labels on the progress rail. */
		stepNames: {
			welcome: "Welcome",
			vault: "Your vault",
			look: "Look",
			purpose: "What for",
			integrations: "Integrations",
			finish: "Finish",
		},
		/** The heading at the top of each step. */
		stepTitles: {
			welcome: "Welcome to Hearth",
			vault: "Name your home screen",
			look: "Pick a look",
			purpose: "What do you use your vault for?",
			integrations: "Found in your vault",
			finish: "Here's your dashboard",
		},
		/** The line under each heading. */
		stepDescs: {
			welcome: "A few questions, then Hearth builds your first dashboard.",
			vault: "The title and its icon across the top of this board.",
			look:
				"This applies to the board being built — every other board keeps its " +
				"own look. You can change any of it later from the board's own settings.",
			purpose: "Pick as many as you like — each one adds cards to your board.",
			integrations:
				"Hearth found these already installed. Turn on the ones you'd like it to use.",
			finish:
				"Nothing has been changed yet. Here's what will be built — as one " +
				"dashboard, leaving your vault-wide settings alone.",
		},
		nav: {
			back: "Back",
			next: "Next",
			finish: "Build my dashboard",
			skip: "Skip setup",
		},
		welcome: {
			lead:
				"Hearth turns a tab into a home screen for your vault — search, a dashboard " +
				"of cards, and a launcher. This wizard sets up a board that fits how you " +
				"actually work, so you're not starting from a blank grid.",
			bullets: [
				{
					icon: "layout-dashboard",
					title: "A dashboard built for you",
					desc: "Tell Hearth what you use your vault for and it picks the cards.",
				},
				{
					icon: "plug",
					title: "Your plugins, already wired up",
					desc:
						"Hearth looks for TaskNotes, Dataview, Git and more, and offers to " +
						"connect them — reading their own settings so cards work right away.",
				},
				{
					icon: "palette",
					title: "A look you choose",
					desc: "Background, card style and density, set in one step.",
				},
			],
			detected: (names: string) => `Found in this vault: ${names}.`,
			detectedNone:
				"No supported plugins detected yet — that's fine, Hearth works on its own " +
				"and you can connect them later.",
		},
		vault: {
			title: "Title",
			titleDesc: "Shown large across the top of the dashboard.",
			showTitle: "Show the title",
			showTitleDesc: "Turn off for a board with no heading at all.",
			titleIcon: "Title icon",
			titleIconDesc:
				"An emoji, a couple of characters, a Lucide icon id, a vault image path or " +
				"an image URL, shown beside the title. Leave empty for the Hearth crystal.",
			themeColor: "Follow the theme's accent colour",
			themeColorDesc: "Which parts of the brand mark take your theme's colour.",
			themeColorOptions: {
				none: "Neither",
				icon: "The icon",
				title: "The title",
				both: "Both",
			},
			showSearch: "Show the search bar",
			showSearchDesc: "The search and command field under the title.",
		},
		look: {
			surfaceHeading: "Cards",
			backgroundHeading: "Background",
			color: "Colour",
			colorDesc: "The flat colour painted behind the board.",
			weatherDesc:
				"A live sky for a place, or one condition pinned and kept. Pick where it " +
				"comes from below.",
			layout: "Where the background goes",
			layoutDesc:
				"Behind the whole board, or as a banner strip across the top with your " +
				"cards on the theme's own surface below it.",
			layoutFull: "Behind everything",
			layoutBanner: "A banner at the top",
			compact: "Compact spacing",
			compactDesc: "Tighten the gaps so more fits on screen.",
		},
		surfaces: {
			glass: {
				icon: "layers",
				name: "Frosted",
				desc: "Translucent cards with a soft blur of the background behind them.",
			},
			solid: {
				icon: "square",
				name: "Solid",
				desc: "Opaque panels. Easiest to read over a busy photograph.",
			},
			minimal: {
				icon: "minus",
				name: "Minimal",
				desc: "No card surface at all — content floating on the background.",
			},
		},
		backgrounds: {
			default: {
				icon: "image",
				name: "Hearth's wallpaper",
				desc: "The image that ships with Hearth.",
			},
			weather: {
				icon: "cloud-sun",
				name: "Live sky",
				desc: "A sky drawn from the weather where you are — or one you pin.",
			},
			color: {
				icon: "paintbrush",
				name: "A flat colour",
				desc: "One colour, no image. The lightest option there is.",
			},
			none: {
				icon: "ban",
				name: "None",
				desc: "Your theme's own background, untouched.",
			},
		},
		purposes: {
			daily: {
				name: "Daily notes & journaling",
				desc: "Today's note front and centre, with a calendar to move between days.",
			},
			tasks: {
				name: "Tasks & to-dos",
				desc: "A task list, read from your checkboxes or from a task plugin.",
			},
			planning: {
				name: "Planning & calendar",
				desc: "A full month/week/day calendar, including any subscribed feeds.",
			},
			browsing: {
				name: "Finding my notes",
				desc: "What you touched recently, plus a shelf of favourites.",
			},
			capture: {
				name: "Quick capture & launching",
				desc: "Tiles for the notes and commands you reach for constantly.",
			},
			insights: {
				name: "Vault statistics",
				desc: "How big the vault is and how active you've been.",
			},
			reading: {
				name: "Reading & feeds",
				desc: "An RSS card for the sites you follow.",
			},
			ambience: {
				name: "A bit of life",
				desc: "Weather, and a small pet that lives on your board.",
			},
		},
		purpose: {
			count: (n: number) =>
				n === 1 ? "That's 1 card so far." : `That's ${n} cards so far.`,
		},
		integrations: {
			lead:
				"Each one Hearth turns on here adds a card to this board, configured for " +
				"you — nothing is installed or changed in the other plugin, and nothing " +
				"outside this dashboard is touched.",
			recommended: "Recommended",
			effects: {
				tasknotes:
					"Add a Tasks card reading your TaskNotes tasks, with the field names and " +
					"completed statuses TaskNotes is set to stored on the card itself.",
				kanban: "Add a Tasks card showing your Kanban board as columns you can drag between.",
				dataview: "Add a Dataview card, seeded with a query you can edit.",
				datacore: "Add a Datacore card ready for a query.",
				templater:
					"Add a card of buttons — one per template you already have — that make a " +
					"note from it in one click.",
				git: "Add a Git card showing your repository's status, with commit and sync buttons.",
				operon:
					"Add an Operon tasks card, reading through Operon's Developer API. " +
					"You'll be asked to approve Hearth in Operon's own settings the first " +
					"time the card loads; until then it says what it's waiting for.",
				bases: "Add a card embedding a base from your vault.",
				dailyNotes: "Add a card showing today's daily note, editable in place.",
				bookmarks: "Add a card listing your bookmarks.",
			},
			taskNotesTitle: "Read from your TaskNotes settings, onto this card",
			taskNotesStatus: "Status field",
			taskNotesDue: "Due field",
			taskNotesPriority: "Priority field",
			taskNotesDone: "Counts as done",
			taskNotesDoneNone: "none defined — Hearth will use \"done\"",
		},
		finish: {
			empty:
				"No cards were selected. You can still finish — the board will be empty and " +
				"you can add cards from the dashboard's Arrange button.",
			target: "Where this board goes",
			targetDesc:
				"Replace the dashboard you're on, or add this as a new one you can switch to.",
			targetReplace: "Replace my current dashboard",
			targetNew: "Add it as a new dashboard",
			targetForcedNew:
				"This will be added as a new dashboard. Every board you already have is " +
				"left exactly as it is — nothing is replaced or removed.",
			name: "Dashboard name",
			nameDesc: "Shown in the dashboard switcher.",
			/** Seed for the new dashboard's name; numbered if already taken. */
			defaultName: "Home",
			calloutTitle: "A starting point, not a preset",
			calloutLead:
				"This board should be a solid start — enough to show you what Hearth can " +
				"do for you.",
			calloutBody:
				"But Hearth is built above all to be heavily customizable, and this wizard " +
				"only touches a fraction of it. Every card can be moved, resized, retitled, " +
				"recoloured, reconfigured or thrown out, boards can be added and switched " +
				"between, and there is a great deal more in the settings than was asked " +
				"about here. Dig around in there and edit everything to your liking — that " +
				"is what Hearth is for.",
			calloutHint:
				"Arrange (top-right of the board) edits the cards; Settings → Hearth has the " +
				"rest. You can run this wizard again any time from Settings → About.",
		},
		plan: {
			/** Fallback names for planned cards that carry no title of their own. */
			names: {
				clock: "Clock & greeting",
				daily: "Today's note",
				tasks: "Tasks",
				schedule: "Calendar",
				calendar: "Mini calendar",
				recent: "Recent files",
				favorites: "Favorites",
				bookmarks: "Bookmarks",
				links: "Links",
				commands: "Commands",
				stats: "Vault statistics",
				heatmap: "Activity",
				rss: "Reading",
				weather: "Weather",
				pet: "Pet",
				dataview: "Dataview",
				datacore: "Datacore",
				git: "Git",
				base: "Base",
			},
			/** Why each card is on the board, shown beside it in the review list. */
			reasons: {
				always: "Every Hearth board starts with one",
				daily: "Daily notes & journaling",
				dailyNotes: "Daily notes is enabled",
				tasks: "Tasks & to-dos",
				tasknotes: "Set up for TaskNotes",
				kanban: "Reading your Kanban board",
				planning: "Planning & calendar",
				browsing: "Finding my notes",
				bookmarks: "Bookmarks is enabled",
				capture: "Quick capture & launching",
				insights: "Vault statistics",
				reading: "Reading & feeds",
				ambience: "A bit of life",
				dataview: "Dataview is installed",
				datacore: "Datacore is installed",
				templater: "Templater templates were found",
				git: "Git is installed",
				operon: "Operon's developer API is available",
				bases: "A base was found in your vault",
			},
		},
		notice: {
			done: (n: number) =>
				n === 1
					? "Hearth: your dashboard is ready — 1 card added."
					: `Hearth: your dashboard is ready — ${n} cards added.`,
		},
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "Pick a file to embed…",
		command: "Pick a command…",
		noteToFavorite: "Pick a note to favorite…",
		folder: "Pick a folder…",
		image: "Pick an image…",
		icon: "Search Lucide icons…",
		iconPlaceholder: "Lucide icon id",
		iconBrowse: "Browse Lucide icons",
		iconClear: "Clear icon",
		titleIconPlaceholder: "Icon id, emoji, image path or URL",
		titleIconBrowseImage: "Pick an image from the vault",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "Add card",
		addCardAria: "Add a card to the dashboard",
		dashboardSettings: "Dashboard settings",
		dashboardSettingsAria: "Open settings for this dashboard",
		showTitles: "Show titles",
		hideTitles: "Hide titles",
		showCardHeaders: "Show card headers",
		hideCardHeaders: "Hide card headers",
		doneArranging: "Done arranging",
		finishArranging: "Finish arranging cards",
		moveResize: "Move & resize cards",
		cardSettings: "Card settings",
		removeCard: "Remove card",
		removeCardTitle: "Remove card?",
		removeCardMessage: (name: string) => `Remove "${name}" from the dashboard?`,
		removeCardConfirm: "Remove",
		thisCard: "this card",
		expandCard: "Expand card",
		collapseCard: "Collapse card",
		phonePreview: "Preview at phone width",
		phonePreviewOff: "Leave phone preview",
		moveCardUp: "Move card up",
		moveCardDown: "Move card down",
		hideOnNarrow: "Hide on a narrow board",
		showOnNarrow: "Show on a narrow board",
	},

	// ---- Dashboard switcher & per-dashboard settings -------------------
	dashboards: {
		newDashboard: "New dashboard",
		defaultName: (n: number) => `Dashboard ${n}`,
		copySuffix: (name: string) => `${name} copy`,
		fallbackName: "Dashboard",
		menu: {
			settings: "Dashboard settings…",
			duplicate: "Duplicate",
			exportBoard: "Export dashboard…",
			importBoard: "Import dashboard…",
			delete: "Delete",
		},
		deleteTitle: "Delete dashboard?",
		deleteMessage: (name: string, count: number) =>
			`Delete "${name}" and its ${count} card(s)? This can't be undone.`,
		deleteConfirm: "Delete",
		modal: {
			title: "Dashboard settings",
			/** Tabs across the top of the dashboard settings modal. */
			tabs: {
				general: "General",
				plugin: "Plugin view",
				header: "Header",
				layout: "Layout",
				style: "Style",
				background: "Background",
			},
			name: "Name",
			mode: "Dashboard type",
			modeDesc:
				"A board of Hearth cards, or the whole board given over to one plugin's view. Switching to a plugin view keeps this board's cards — switch back and they return.",
			modeOptions: {
				cards: "Cards",
				plugin: "Plugin view",
			},
			modePickViewHint:
				"This board has no view yet — choose one on the Plugin view tab.",
			pluginViewType: "View",
			pluginViewTypeDesc:
				"Which registered view fills this board. The list is every view the app has right now, so it follows which plugins are enabled.",
			pluginViewTypeNone: "Choose a view…",
			pluginViewFile: "File",
			pluginViewFileDesc:
				"Open the view on a specific file — a Canvas, an Excalidraw drawing. Leave empty to host the view on its own.",
			pluginViewFileRequiredDesc:
				"This view needs a file to show. Pick the note, PDF or image this board opens.",
			pluginViewHideHeader: "Hide the view's own header",
			pluginViewHideHeaderDesc:
				"Drop the hosted view's breadcrumbs, back/forward arrows and kebab menu. Its own toolbars and tabs are untouched.",
			pluginViewKeepMounted: "Keep running in the background",
			pluginViewKeepMountedDesc:
				"Stay loaded while another dashboard is showing, so coming back is instant instead of a reload. Turn off for a heavy plugin you'd rather not leave running. Only a few boards are ever kept loaded at once.",
			pluginViewFocusable: "Let the view take focus (experimental)",
			pluginViewFocusableDesc:
				"Make this the active pane while you're working in it, so the plugin's own commands and hotkeys find it. Obsidian also opens notes into the active pane, so a link you click may replace the view until you switch boards.",
			pluginViewPerfNote:
				"A hosted view is the plugin doing its full job, not a preview of it — it costs what opening that plugin costs. Views that are slow in their own tab are slow here too.",
			switcherIcon: "Switcher icon",
			switcherIconDesc:
				"An emoji or short text shown on the switcher button. Empty = number.",
			switcherLucide: "Switcher Lucide icon",
			switcherLucideDesc:
				"A Lucide icon (e.g. “home”, “star”, “layout-dashboard”) — browse the set, or type an id. Takes precedence over the emoji above.",
			linkedWorkspace: "Linked workspace",
			linkedWorkspaceDesc:
				"Auto-switch to this dashboard when this workspace loads. Requires the core Workspaces plugin.",
			linkedWorkspaceNone: "None",
			mobileDefault: "Default on mobile",
			mobileDefaultDesc:
				"Open this dashboard when Hearth loads on a phone or tablet. Only one board can be the mobile default; enabling this clears it on the others.",
			titleVisibility: "Title visibility",
			titleVisibilityDesc:
				"Show or hide only the title block for this dashboard. Overrides the global setting.",
			titleVisibilityDefault: (state: string) => `Use global default (${state})`,
			searchVisibility: "Search visibility",
			searchVisibilityDesc:
				"Show or hide the search and command bar with its results and filter buttons on this dashboard. Overrides the global setting.",
			searchVisibilityShow: "Show search",
			searchVisibilityHide: "Hide search",
			searchPlaceholder: "Search placeholder",
			searchPlaceholderDesc:
				"The greyed-out text in this board's search field. Leave the field empty for the built-in wording.",
			newNoteButton: "Button beside search",
			newNoteButtonDesc:
				"Show or hide the button next to this board's search field.",
			newNoteButtonStateOn: "shown",
			newNoteButtonStateOff: "hidden",
			newNoteButtonMode: "What that button does",
			newNoteButtonModeDesc:
				"Make a new note, or web-search whatever is typed in the search field.",
			newNoteButtonModeOptions: {
				newNote: "New note",
				searchOnline: "Search online",
			},
			newNoteButtonLabel: "Button label",
			newNoteButtonLabelDesc:
				"The text on that button on this board. Leave it empty for the built-in wording.",
			hiddenFilters: "Filter chips",
			hiddenFiltersDesc:
				"Choose which file-type chips this board shows under the search bar, instead of following the vault-wide choice.",
			hiddenFiltersFollowing: (count: number) =>
				count === 0
					? "Following the vault, which hides none."
					: `Following the vault, which hides ${count}.`,
			stackOnNarrow: "Stack when narrow",
			stackOnNarrowDesc:
				"Reflow this board into one full-width column once the pane is too narrow for the free-form layout — a phone, or a narrow split.",
			stackOnNarrowStateOn: "stack",
			stackOnNarrowStateOff: "keep the layout",
			stackOnNarrowOptionOn: "Stack into one column",
			stackOnNarrowOptionOff: "Keep the scaled layout",
			arrangeVisibility: "Arrange button",
			arrangeVisibilityDesc:
				"Whether the Arrange button stays visible on this board or fades in on hover.",
			switcherVisibility: "Dashboard switcher",
			switcherVisibilityDesc:
				"Whether the dashboard switcher stays visible while this board is showing, or fades in on hover.",
			chromeOptions: {
				always: "Always visible",
				hover: "Show on hover",
			},
			chromeStates: {
				always: "always visible",
				hover: "on hover",
			},
			skyAnimate: "Animate the sky",
			skyAnimateDesc:
				"Let this board's painted weather drift, fall and twinkle. The performance tier and the reader's reduced-motion setting can still hold it still.",
			skyAnimateStateOn: "animated",
			skyAnimateStateOff: "still",
			skyAnimateOptionOn: "Animate",
			skyAnimateOptionOff: "Hold still",
			visibilityDefaultPlugin: (state: string) =>
				`Default on a plugin board (${state})`,
			visibilityShown: "shown",
			visibilityHidden: "hidden",
			visibilityShow: "Show title",
			visibilityHide: "Hide title",
			titleText: "Title text",
			titleTextDesc: "Override the global title text for this dashboard.",
			titleIcon: "Title icon",
			titleIconDesc:
				"The mark beside this dashboard's title: a Lucide icon id, an emoji or short text, a vault image path, or an image URL. Clear it to wear the Hearth crystal on this board alone.",
			titleAlign: "Title alignment",
			titleAlignDesc:
				"Align only the title block. The search bar keeps its own layout.",
			alignDefault: "Default (center)",
			alignLeft: "Left",
			alignCenter: "Center",
			alignRight: "Right",
			titleSize: "Title size",
			titleIconSize: "Title icon size",
			titleTopMargin: "Title top margin",
			headerSpacingBelow: "Spacing below title/header",
			contentWidth: "Content width",
			fullWidth: "Full width",
			fullWidthDesc: "Override the width limit for this board.",
			fullWidthDefault: (state: string) => `Use global default (${state})`,
			fullWidthOptionOn: "Fill the pane",
			fullWidthOptionOff: "Limit the width",
			fullWidthStateOn: "fill the pane",
			fullWidthStateOff: "limited",
			fitToPage: "Fit to page",
			fitToPageDesc: "Override scrolling for this board.",
			fitDefault: (state: string) => `Use global default (${state})`,
			fitStateFit: "fit",
			fitStateScroll: "scroll",
			fitOptionFit: "Fit to one page",
			fitOptionScroll: "Allow scrolling",
			fitToPagePluginNote:
				"A plugin board always fits the pane — the hosted view fills it and scrolls itself.",
			themeColorTarget: "Accent colour on the title",
			themeColorTargetDesc:
				"Which parts of this board's brand mark follow the theme's icon colour. Overrides the global setting for this board; Hearth's tab and ribbon icons keep following the global one.",
			themeColorTargetDefault: (state: string) => `Use global default (${state})`,
			themeColorTargetOptions: {
				none: "Neither",
				icon: "The icon",
				title: "The title",
				both: "Both",
			},
			compact: "Compact spacing",
			compactDesc: "Override the global spacing for this board.",
			compactDefault: (state: string) => `Use global default (${state})`,
			compactOptionOn: "Compact",
			compactOptionOff: "Roomy",
			compactStateOn: "compact",
			compactStateOff: "roomy",
			cardOpacity: "Card opacity",
			cardBlur: "Card blur",
			cardRadius: "Card corner radius",
			cardBorderWidth: "Card border",
			done: "Done",
			overriding: "Overriding the global default.",
			usingGlobal: (value: number | string) =>
				`Using global default (${value}).`,
			usingDefault: (value: number | string) =>
				`Using default (${value}).`,
			usingDefaultText: (value: string) =>
				`Using default (${value}).`,
			background: "Background",
			backgroundDesc: "Override the global background for this dashboard.",
			backgroundValue: "Background value",
			opacity: "Opacity",
			blur: "Blur",
			backgroundLayout: "Background layout",
			bannerHeight: "Banner height",
			bannerFade: "Fade the lower edge",
			bannerFullWidth: "Full width",
			clearOverride: "Follow the global setting",
		},
		useGlobal: "Use global default",
		on: "on",
		off: "off",
		backgroundLayoutOptions: {
			full: "Full background",
			banner: "Banner",
		},
		backgroundOptions: {
			default: "Use global default",
			none: "None",
			hdefault: "Hearth default",
			color: "Solid color",
			image: "Vault image",
			url: "Image URL",
			weather: "Live weather sky",
		},
		backgroundValueDesc: {
			color: "A CSS color, e.g. #1e1e2e.",
			image: "A vault image path, e.g. Attachments/bg.png.",
			url: "A direct image URL.",
		},
	},

	// ---- Plugin settings tab -------------------------------------------
	settings: {
		/** Shared across every slider/section control. */
		resetSlider: "Reset to default",
		/** Reset button next to text fields whose factory default is meaningful. */
		resetField: "Reset to default",
		/** Strapline under the plugin name on the settings index. */
		indexSub: "A home screen for your vault — search, dashboard, and launcher in one.",
		/** Accessible name of the back link on a category page; the visible label is
		 * the plugin's own name. */
		backToIndex: "Back to all settings",
		/** Headings that group the categories on the index. */
		indexGroups: {
			lookFeel: "Look & feel",
			howItWorks: "How it works",
			data: "Data & plugins",
			etc: "Etc",
		},
		/** One line per category, shown on its index row and again at the top of
		 * its page: what a reader will find if they open it. */
		tabDescs: {
			appearance: "Title, title icon, background, and low power mode.",
			search: "The search bar and which results it offers.",
			dashboard: "Grid, card surface, and the controls around the board.",
			behaviour: "Startup, how notes open, and privacy.",
			mobile: "The stacked layout on a phone, and the action bar.",
			integrations: "TaskNotes, file icons, and every plugin Hearth reads.",
			backup: "Export and import your layout and settings.",
			about: "Version, what's new, and where to report things.",
		},
		/** Shown in place of a settings section (or tab) whose render threw, so a
		 * single failing section can no longer blank the whole settings pane. */
		sectionError: (name: string) => `The "${name}" section couldn't be shown.`,
		sectionErrorHint:
			"Open the developer console (Cmd/Ctrl+Option+I) to see the error, then please report it on GitHub. The other settings are unaffected.",
		/** Category ribbon at the top of the settings tab. */
		tabs: {
			appearance: "Appearance",
			search: "Search",
			dashboard: "Dashboard",
			behaviour: "Behaviour",
			mobile: "Mobile",
			integrations: "Integrations",
			backup: "Backup",
			about: "About",
		},
		/** Sub-section headings used to group settings within a tab. */
		sections: {
			performance: "Performance",
			performanceDesc:
				"How much of the decoration to pay for. Trade visual effects for battery life and smoothness on slower hardware.",
			home: "Home",
			homeDesc:
				"Title, title and tab icons, search visibility and overall content width.",
			searchBar: "Search bar",
			searchBarDesc: "How the search field looks and what it does.",
			grid: "Grid & spacing",
			gridDesc: "How the card grid is sized and spaced.",
			dashboardControls: "Dashboard controls",
			dashboardControlsDesc: "Visibility for controls around the dashboard.",
			cardSurface: "Card surface",
			cardSurfaceDesc:
				"Transparency and frosted-glass blur applied to every card.",
			startup: "Startup & tabs",
			startupDesc: "When and where the home view opens.",
			opening: "Opening notes",
			openingDesc: "Where a note opens when you click it in Hearth.",
			mobileMode: "Layout",
			mobileModeDesc:
				"How the board is laid out when the screen is too narrow for its own layout.",
			privacy: "Privacy & network",
			privacyDesc: "Control the outbound requests Hearth is allowed to make.",
		},
		about: {
			heading: "About Hearth",
			headingDesc: "Project links, support and version.",
			setup: "Set up Hearth",
			setupDesc:
				"Answer a few questions about how you work and what's installed, and Hearth " +
				"builds a dashboard to match. It's added as a new board — nothing you " +
				"already have is changed.",
			setupAgain: "Build a dashboard",
			setupAgainDesc:
				"Run the setup wizard again to generate another dashboard. It's always " +
				"added as a new board, so your existing dashboards are never touched — " +
				"and everything it sets lands on that one board, not on your vault-wide " +
				"settings.",
			setupButton: "Start setup",
			whatsNew: "What's new",
			whatsNewDesc: "Read the release notes for this and every past version.",
			whatsNewButton: "View changelog",
			github: "GitHub repository",
			githubDesc: "Browse the source, star the project, or read the changelog.",
			githubButton: "Open GitHub",
			reportIssue: "Report an issue",
			reportIssueDesc:
				"Hit a bug or have a feature idea? Open an issue on GitHub.",
			reportIssueButton: "Report issue",
			kofi: "Support Hearth",
			kofiDesc:
				"Hearth is free and always will be. If it's earned a spot on your home " +
				"screen, you can leave a tip — completely optional, no features are locked.",
			/** Shared by every surface that shows the tip button: this row, the
			 * "What's new" dialog and the card picker's request page. */
			kofiButton: "Tip me on Ko-fi",
			version: (v: string) => `Version ${v}`,
			versionDesc: "The Hearth build you're running.",
		},
		appearance: {
			heading: "Appearance",
			headingDesc: "Title, title icon, search bar and overall content width.",
			showTitle: "Show title",
			showTitleDesc: "Display the big title and its icon at the top.",
			showSearch: "Show search section",
			showSearchDesc:
				"Display the search and command bar with its results and filter buttons. " +
				"Individual dashboards can override this in their settings.",
			title: "Title",
			titleDesc: "The heading text shown at the top of the home view.",
			titleIcon: "Title icon",
			titleIconDesc:
				"The mark drawn next to the title. It takes any of: a Lucide icon id " +
				"(browse the set with the 🔍 button), an emoji or a couple of " +
				"characters, the vault path of an image (📷 button), or the URL of an " +
				"image on the web. Leave it empty for the Hearth crystal. Each " +
				"dashboard can override it in its own settings.",
			tabIcon: "Tab icon",
			tabIconDesc:
				"A Lucide icon for Hearth's tab header and ribbon button, in place of " +
				"the Hearth crystal. Browse the set or type an id; leave empty for the crystal.",
			themeColorTarget: "Follow theme icon color",
			themeColorTargetDesc:
				"Draw the crystal icon and/or the title text in your theme's icon " +
				"color instead of the default purple crystal and normal text.",
			themeColorNone: "Off",
			themeColorIcon: "Icon",
			themeColorTitle: "Title",
			themeColorBoth: "Icon and title",
			searchPlaceholder: "Search placeholder",
			searchContents: "Search note contents",
			searchContentsDesc:
				"Also match text inside note bodies, not just names, tags and " +
				"properties. Body matches appear after name matches with a snippet.",
			searchEngine: "Search engine",
			searchEngineDesc:
				"Which engine powers the search bar. Omnisearch requires the " +
				"Omnisearch community plugin to be installed and enabled.",
			searchEngineBuiltin: "Hearth (built-in)",
			searchEngineOmnisearch: "Omnisearch",
			omnisearchMissing:
				"Omnisearch isn’t installed or enabled. Install and enable it, " +
				"then select it again.",
			omnisearchInstallLink: "Open Omnisearch in Community plugins",
			showNewNoteButton: "Show “New note” button",
			showNewNoteButtonDesc: "Show the action button beside the search field.",
			newNoteButtonMode: "Search-bar button",
			newNoteButtonModeDesc:
				"What the button beside the search bar does: create a new note, or " +
				"search the web for the current search-field contents.",
			newNoteButtonModeNewNote: "New note",
			newNoteButtonModeSearchOnline: "Search online",
			webSearchEngine: "Online search engine",
			webSearchEngineDesc:
				"Which engine the “Search online” button opens. The arrow beside " +
				"the button searches with any of the others for one query, without " +
				"changing this choice.",
			newNoteHeading: "The “New note” button",
			newNoteHeadingDesc:
				"What the button makes, and where. The same settings drive the " +
				"button beside the search bar, the one on a search-bar card, and " +
				"Hearth’s “Create new note” command.",
			newNoteButtonLabel: "Button text",
			newNoteButtonLabelDesc:
				"Text on the button. Leave empty for “New note”.",
			newNoteTemplate: "Template",
			newNoteTemplateDesc:
				"Make the note from a Templater template instead of a blank one. " +
				"Templater does the templating — your user scripts, " +
				"tp.system.prompt() dialogs and cursor placement all behave as they " +
				"do from its own command.",
			newNoteTemplateNone: "Blank note",
			newNoteTemplatePick: "Pick a template…",
			newNoteTemplateClear: "Use a blank note",
			newNoteTemplaterMissing:
				"Templater isn’t enabled. Install and enable it to use a template " +
				"here; until then the button makes a blank note.",
			newNoteFolder: "Location",
			newNoteFolderDesc:
				"Folder the new note goes in, created if it doesn’t exist yet. " +
				"“Default location” means wherever Obsidian puts new notes.",
			newNoteFolderClear: "Use the default location",
			newNoteFilename: "Filename",
			newNoteFilenameDesc:
				"Name for the new note, without the extension. {{date}}, " +
				"{{date:FMT}}, {{time}}, {{time:FMT}} and {{prompt}} are " +
				"substituted — {{prompt}} asks you for the name on each click. " +
				"Leave empty for “Untitled”.",
			newNoteFilenamePlaceholder: "Untitled",
			newNoteDestination: (destination: string) => `Creates ${destination}`,
			contentWidth: "Content width",
			contentWidthDesc:
				"The widest the home content may grow, in pixels. It is a ceiling, " +
				"not a width — the content still shrinks to fit a narrower pane.",
			fullWidth: "Full width",
			fullWidthDesc:
				"Let the content fill the pane instead of stopping at the width " +
				"below. Cards keep their proportions as the pane widens, but text " +
				"does not grow with them, so a very wide board reads sparser.",
		},
		performance: {
			tier: "Performance tier",
			tierDesc:
				"Each step down drops the next most expensive thing the board does. " +
				"Nothing below is overwritten — your settings come back exactly as " +
				"they were when you move back up.",
			tierFull: "Full — everything on",
			tierBalanced: "Balanced — a lighter sky",
			tierReduced: "Reduced — nothing moves",
			tierMinimal: "Minimal — plain and still",
			/** One line per tier, shown under the dropdown for the selected one. */
			tierFullDesc:
				"Every effect at full strength. The painted weather sky is the most " +
				"expensive thing here: if the board is warming up your machine, this " +
				"is the setting to step down.",
			tierBalancedDesc:
				"The painted sky is drawn at half density — fewer raindrops, stars, " +
				"clouds and wisps of fog. Nothing is switched off and nothing stops " +
				"moving; there is simply less of it, for about a third less work.",
			tierReducedDesc:
				"Nothing on the board moves, and the frosted glass behind cards is " +
				"off. Your wallpaper stays, cards stay translucent, and every card " +
				"still refreshes on its timer — the board just holds still.",
			tierMinimalDesc:
				"The frugal end: a flat colour instead of the wallpaper, opaque " +
				"cards, no motion, and no card refreshing itself on a timer.",
			pauseWhenUnfocused: "Pause animation when Obsidian isn't in front",
			pauseWhenUnfocusedDesc:
				"Hold every animation while you are working in another app or " +
				"another window. A Hearth tab hidden behind another tab already " +
				"costs nothing; this covers a visible board in a window you are not " +
				"using — beside a browser, or on a second screen. Turn it off if you " +
				"keep the dashboard running on a second display.",
			color: "Minimal background",
			colorDesc:
				"The flat colour shown behind the home view on the minimal tier. " +
				"Any CSS colour, e.g. #4a4459.",
			/** Bullet list of what the selected tier changes, shown under the dropdown. */
			effects: "At this tier:",
			effectSkyHalf: "the painted weather sky is drawn at half density",
			effectBackground: "the background is a flat colour — no image, GIF, opacity layer or blur",
			effectOpaque: "cards are opaque rather than translucent",
			effectFrost: "no frosted-glass blur behind cards",
			effectMotion: "transitions, hover lifts, shadows and animations are off",
			effectRefresh:
				"web, RSS, calendar-subscription and Jira cards stop refreshing on a timer (manual refresh still works)",
			effectLiveRefresh: "the dashboard stops rebuilding itself on vault changes",
			effectClock: "clock cards drop seconds and the sweeping second hand",
			effectSlideshow: "slideshow cards hold one picture instead of rotating",
			/** Shown in the sections whose settings the tier currently overrides. */
			overridden:
				"The performance tier overrides these right now. They are kept as " +
				"they are and take effect again when you move back up.",
		},
		background: {
			heading: "Background",
			headingDesc:
				"The backdrop behind the home view, and how much it shows through.",
			type: "Background type",
			typeDesc: "What to show behind the home view.",
			value: "Background value",
			valueColorDesc: "A CSS color, e.g. #1e1e2e or rgb(30,30,46).",
			valueImageDesc: "A vault image path, e.g. Attachments/bg.png.",
			valueUrlDesc: "A direct image URL.",
			externalCallsDisabled:
				"Not shown while \u201cDisable external calls\u201d is on in Behaviour: " +
				"this background is fetched from the web. Pick a vault image instead, " +
				"or turn the setting off.",
			opacity: "Opacity",
			opacityDesc:
				"How much the background shows through. Lower is more subtle.",
			blur: "Blur",
			blurDesc: "Background blur in pixels.",
			layout: "Background layout",
			layoutDesc:
				"Fill the whole view with the background, or wear it as a banner — " +
				"a strip across the top of the board, the way a cover image sits " +
				"above a note — with the cards below it on the theme's own surface. " +
				"Each board can override this in its own settings.",
			layoutLabels: {
				full: "Full background",
				banner: "Banner",
			},
			bannerHeight: "Banner height",
			bannerHeightDesc: "How tall the banner strip is, in pixels.",
			bannerFade: "Fade the lower edge",
			bannerFadeDesc:
				"Let the banner dissolve into the page instead of ending on a hard line.",
			bannerFullWidth: "Full width",
			bannerFullWidthDesc:
				"Run the banner edge to edge instead of lining it up with the content below.",
			labels: {
				default: "Hearth default",
				none: "None",
				color: "Solid color",
				image: "Vault image",
				url: "Image URL",
				weather: "Live weather sky",
			},
			weatherHeading: "Weather sky",
			weatherDesc:
				"The board's backdrop becomes a painted sky — the same one the weather " +
				"card's artistic style uses, spread across the whole window. Follow the " +
				"real conditions over a place (from Open-Meteo; only the coordinates are " +
				"sent, and nothing is fetched while external calls are off), or pin one " +
				"sky and keep it, which needs no location and never goes online.",
			weatherNoPlace: "Pick a location below to paint the sky.",
			skySource: "Sky",
			skySourceDesc:
				"Follow the real weather somewhere, or keep one sky whatever it's doing outside.",
			skySourceLive: "Live weather",
			skySourceFixed: "A fixed sky",
			skyCondition: "Condition",
			skyConditionDesc: "The weather this sky always shows.",
			skyDaylight: "Time of day",
			skyDaylightDesc: "Whether the sky follows your clock or stays day or night.",
			skyDaylightAuto: "Follow the clock",
			skyDaylightDay: "Always day",
			skyDaylightNight: "Always night",
			skyAnimate: "Animate the sky",
			skyAnimateDesc:
				"Drifting clouds, falling rain and twinkling stars behind the board. Always " +
				"off in low power mode, and for readers whose system asks for reduced motion.",
		},
		behaviour: {
			heading: "Behaviour",
			headingDesc:
				"When and where Hearth opens, and the phone/tablet search-only mode.",
			openOnStartup: "Open on startup",
			openOnStartupDesc: "Open the home view when the vault loads.",
			replaceNewTabs: "Replace new tabs",
			replaceNewTabsDesc: "Show the home view instead of an empty new tab.",
			focusSearchOnOpen: "Focus search on open",
			focusSearchOnOpenDesc:
				"Place the cursor in the search field whenever a home view opens, so " +
				"you can start typing right away. Desktop only.",
			liveRefresh: "Live refresh on vault changes",
			liveRefreshDesc:
				"Keep an open home view current as the vault changes — Recent, Bookmarks " +
				"and saved-query cards update without reopening the tab. Switching back to " +
				"the Hearth tab always refreshes it regardless of this setting.",
			liveSettingsSync: "Pick up synced changes",
			liveSettingsSyncDesc:
				"Apply dashboard changes made on another device as soon as sync brings " +
				"them in, instead of at the next Obsidian restart. Leave this on unless " +
				"a board reloading mid-session gets in your way.",
			mobileSearchOnly: "Mobile mode (search only)",
			mobileSearchOnlyDesc:
				"On phones and tablets, hide the dashboard and show only the search " +
				"field. No effect on desktop.",
			stackOnNarrow: "Stack cards on narrow screens",
			stackOnNarrowDesc:
				"When the board is too narrow for its layout — a phone, or a narrow " +
				"pane on the desktop — show the cards as one full-width column " +
				"instead. Your layout is untouched and comes back at full width. " +
				"Each card can be hidden, reordered, resized or collapsed for this " +
				"column from its own settings.",
			mobilePerformanceTier: "Performance tier on mobile",
			mobilePerformanceTierDesc:
				"The tier to use on phones and tablets, where the animated sky and " +
				"frosted glass are drawn on the smallest screen and paid for out of a " +
				"battery. Your desktop tier is kept separately and is not changed.",
			mobileTierMatch: "Match desktop",
			disableExternalCalls: "Disable external calls",
			disableExternalCallsDesc:
				"Block all outbound network requests Hearth makes, including Jira, " +
				"external calendars, RSS feeds, the calculator's currency-rate lookup, " +
				"and background images and title icons given as a web address — those " +
				"fall back to no picture and the Hearth crystal.",
			openIn: "Open notes in",
			openInDesc:
				"Where a note goes when you open one from Hearth. \"Current tab\" replaces " +
				"the home view, so Hearth behaves like any other tab. Ctrl/Cmd-click always " +
				"opens a new tab regardless.",
			openInModes: {
				tab: "A new tab",
				same: "The current tab (replace Hearth)",
				split: "A split pane",
				window: "A new window",
			},
			/** The extra choice each per-source dropdown offers on top of the four
			 * destinations: follow whatever "Open notes in" is set to. */
			openInFollow: "Same as above",
			openInSources: {
				link: "Links",
				linkDesc: "Links inside notes, tasks and the Links card.",
				search: "Search results",
				searchDesc: "Hits from the search bar and the Search card.",
				card: "Notes in cards",
				cardDesc:
					"Notes listed by Recent, Bookmarks, Favourites, Calendar, Heatmap and " +
					"Tasks cards, and by mobile action buttons.",
				newNote: "Notes Hearth creates",
				newNoteDesc: "New notes, daily notes and event notes, opened as they're made.",
			},
			openFromOutside: "Notes opened from outside Hearth",
			openFromOutsideDesc:
				"The file explorer, the quick switcher, the graph — and anything a card " +
				"embeds that opens links itself. Obsidian hands those to whichever tab " +
				"is focused, so a Hearth tab gets taken over. Choose \"a new tab\" to keep " +
				"the Hearth tab; the file explorer then stops following what you open.",
			openFromOutsideModes: {
				same: "The current tab (replace Hearth)",
				tab: "A new tab (keep Hearth open)",
			},
		},
		mobileActions: {
			heading: "Mobile action bar",
			headingDesc:
				"In Mobile mode (search only), this row of buttons replaces the " +
				"“New note” button beside the search bar, appearing under the " +
				"search field and filters instead. Each button can run a command, " +
				"open a note or file, or open a URL — just like a launchpad tile.",
			showActionBar: "Show action bar",
			showActionBarDesc:
				"Show the row of action buttons beneath the search field in Mobile mode.",
			labelPlaceholder: "Label",
			iconPlaceholder: "Icon",
			commandTooltip: (id: string) => `Command: ${id}`,
			pickCommand: "Pick a command",
			moveUp: "Move up",
			moveDown: "Move down",
			removeButton: "Remove button",
			addButton: "Add button",
			resetDefaults: "Reset to defaults",
		},
		/** The full catalogue shown at the top of the Integrations tab. Every
		 * integration is listed here whether or not it has a setting and whether
		 * or not the plugin is installed — see `src/integrations.ts`. */
		integrations: {
			heading: "All integrations",
			headingDesc:
				"Everything Hearth can work with, listed whether or not it's installed. " +
				"Most integrations need no setup — the ones that do say where their " +
				"settings live.",
			groups: {
				plugin: "Community plugins",
				pluginDesc: "Hearth picks these up automatically once they're enabled.",
				core: "Obsidian core plugins",
				coreDesc:
					"Built into Obsidian. Enable them in Settings → Core plugins if a " +
					"card says one is missing.",
				service: "External services",
				serviceDesc:
					"Cards that fetch over the network. All of them are silenced at once " +
					"by “Disable external calls” under Behaviour → Privacy & network.",
			},
			status: {
				enabled: "Enabled",
				disabled: "Disabled",
				missing: "Not installed",
				external: "Network",
				always: "Always available",
			},
			/** Tooltip on the status pill, spelling out what it means for Hearth. */
			statusTooltip: {
				enabled: "Installed and enabled — Hearth is using it.",
				disabled: "Installed but turned off, so Hearth can't use it right now.",
				missing: "Not installed. Everything else in Hearth works without it.",
				external: "An outbound request, not a plugin.",
				always: "Nothing to install.",
			},
			/** Where this integration's settings live, shown under the description. */
			where: {
				section: "Settings below on this tab.",
				tab: (tab: string) => `Settings under ${tab}.`,
				card: "Configured on the card itself, on your dashboard.",
				pluginSettings: "Uses that plugin's own settings — nothing to set in Hearth.",
				none: "Nothing to configure.",
			},
			/** Row buttons. */
			install: "Install",
			installTooltip: "Open this plugin in Obsidian's community plugin browser.",
			goToSection: "Show",
			goToTab: "Open",
			/** One entry per id in `INTEGRATIONS`. */
			items: {
				omnisearch: {
					name: "Omnisearch",
					desc:
						"Swaps the search bar over to Omnisearch's fuzzy, full-text index " +
						"instead of Hearth's built-in engine. Pick the engine under " +
						"Search → Search bar; the choice only sticks while Omnisearch is enabled.",
				},
				tasknotes: {
					name: "TaskNotes",
					desc:
						"Lets Tasks cards read TaskNotes' one-note-per-task vaults — status, " +
						"due date and priority straight from frontmatter.",
				},
				dataview: {
					name: "Dataview",
					desc:
						"The Dataview card runs DQL queries and DataviewJS blocks and renders " +
						"them with Dataview's own renderers, refreshing as its index changes.",
				},
				datacore: {
					name: "Datacore",
					desc:
						"Dataview's successor. The Datacore card runs a Datacore query — or a " +
						"JS/JSX/TS/TSX script — and renders it with Datacore's own live views.",
				},
				templater: {
					name: "Templater",
					desc:
						"The “New note from template” card turns your Templater templates into " +
						"buttons: each tile carries its own template, destination folder and " +
						"filename pattern, and one click makes the note. Templater does the " +
						"templating — your user scripts, tp.system.prompt() dialogs and cursor " +
						"placement all behave as they do from its own command.",
				},
				periodicNotes: {
					name: "Periodic Notes",
					desc:
						"The Periodic note card shows this week's, month's, quarter's or " +
						"year's note, resolved — and created, from your own template — by " +
						"Periodic Notes itself.",
				},
				git: {
					name: "Git",
					desc:
						"The Git card shows your repository's branch, changes and recent " +
						"commits, and commits, syncs, pushes and pulls through the Git " +
						"plugin itself — its remote, credentials and commit-message " +
						"template all apply unchanged.",
				},
				operon: {
					name: "Operon",
					desc:
						"The Operon cards — tasks, board, agenda and timer — read through " +
						"Operon's own Developer API, so its statuses, priorities and " +
						"recurrence stay its to define. Desktop only, needs Obsidian 1.12.2 " +
						"or newer, and Operon must approve Hearth's read request.",
				},
				iconic: {
					name: "Iconic",
					desc:
						"Per-file icons set with Iconic show up wherever Hearth lists a file — " +
						"Recent, Favorites, saved searches and search results.",
				},
				iconize: {
					name: "Iconize",
					desc:
						"The same for Iconize (formerly Obsidian Icon Folder), including icons " +
						"set through a frontmatter property.",
				},
				excalidraw: {
					name: "Excalidraw",
					desc:
						"Embed cards render Excalidraw drawings live, and the “New drawing” " +
						"action creates one through Excalidraw's own command.",
				},
				bases: {
					name: "Bases",
					desc: "Embed cards can show a Bases (.base) view on the dashboard.",
				},
				canvas: {
					name: "Canvas",
					desc: "Embed cards can show a canvas, interactive and edge to edge.",
				},
				dailyNotes: {
					name: "Daily notes",
					desc:
						"The Daily note, Mini calendar and Vault statistics cards resolve today's " +
						"note from Daily notes' own folder, date format and template.",
				},
				bookmarks: {
					name: "Bookmarks",
					desc: "The Bookmarks card lists your Obsidian bookmarks, groups and all.",
				},
				globalSearch: {
					name: "Search",
					desc:
						"Hands a query over to Obsidian's own search pane when you ask for the " +
						"full results.",
				},
				fileExplorer: {
					name: "File explorer",
					desc: "Powers “Reveal in file explorer” on Hearth's search results.",
				},
				workspaces: {
					name: "Workspaces",
					desc: "A dashboard can switch to a saved workspace when you open it.",
				},
				audioRecorder: {
					name: "Audio recorder",
					desc:
						"The “Record voice” mobile action button starts and stops Obsidian's " +
						"own recorder.",
				},
				leafViews: {
					name: "Any plugin with a side panel",
					desc:
						"The Plugin view card hosts another plugin's registered view — " +
						"calendars, kanban boards, outlines, tag panes — right inside a card. " +
						"Whatever is installed shows up in the card's view picker.",
				},
				jira: {
					name: "Jira",
					desc:
						"Jira cards fetch issues from your Jira Cloud or Server instance over " +
						"its REST API, using credentials you enter on the card.",
				},
				rss: {
					name: "RSS & Atom feeds",
					desc: "RSS cards fetch and parse any RSS 2.0 or Atom feed you point them at.",
				},
				ics: {
					name: "iCalendar feeds",
					desc:
						"Mini calendar cards can subscribe to external ICS/webcal calendars — " +
						"Google, iCloud, Fastmail, Nextcloud and friends.",
				},
				currency: {
					name: "Exchange rates",
					desc:
						"The Calculator card converts currencies using ECB rates from the free, " +
						"key-less Frankfurter API.",
				},
				weather: {
					name: "Weather forecasts",
					desc:
						"Weather cards — and the live weather sky background — fetch conditions " +
						"from Open-Meteo: free, key-less, no account. Only the coordinates you " +
						"pick are ever sent, and a sky pinned to one condition needs no " +
						"location at all.",
				},
				webSearch: {
					name: "Web search",
					desc:
						"The search bar's button can send your query to DuckDuckGo instead of " +
						"creating a note. Switch it under Search → Search bar.",
				},
			},
		},
		tasks: {
			heading: "Tasks / TaskNotes",
			headingDesc:
				"Field names read by Tasks cards in TaskNotes mode. TaskNotes has no " +
				"stable API for other plugins, so this reads its frontmatter directly " +
				"— match these to whatever TaskNotes' own settings have them mapped to " +
				"(the defaults below are TaskNotes' own defaults).",
			statusField: "Status field",
			statusFieldDesc: "Frontmatter field read for a task's status.",
			dueField: "Due date field",
			dueFieldDesc: "Frontmatter field read for a task's due date.",
			priorityField: "Priority field",
			priorityFieldDesc:
				"Frontmatter field read for a task's priority indicator.",
			doneValue: "“Done” status value",
			doneValueDesc: "The status value that marks a TaskNotes task complete.",
			fieldsEnable: "Customize task fields",
			fieldsEnableDesc:
				"Replace the fixed metadata Tasks cards show with fields you define " +
				"yourself — any frontmatter property or anything Hearth reads, named, " +
				"colored and ordered how you like. Off by default, and tasks keep " +
				"their usual look until you turn it on. Turning it on starts from a " +
				"blank slate: tasks show only the fields you add.",
			fields: "Fields shown on a task",
			fieldsDesc:
				"The fields every Tasks card shows. A single card can define its own " +
				"instead, from that card's settings.",
		},
		fileIcons: {
			heading: "File icons / Iconic / Iconize",
			headingDesc:
				"Use the per-file icons you've set with the Iconic or Iconize " +
				"plugins wherever Hearth shows a file — Recent, Favorites, saved " +
				"searches and the search bar. Lucide icons and emoji are shown; " +
				"files using an icon from a downloaded icon pack keep Hearth's own " +
				"file-type icon.",
			enable: "Use icons from Iconic / Iconize",
			enableDesc:
				"Off shows Hearth's file-type icon for every file, ignoring both plugins.",
			enableDescNoPlugin:
				"Neither Iconic nor Iconize is enabled right now, so every file " +
				"shows Hearth's file-type icon. This can stay on — it takes effect " +
				"as soon as one of them is installed.",
			property: "Iconize frontmatter property",
			propertyDesc:
				"Property Iconize stores a note's icon in, for icons set through " +
				"frontmatter rather than its menu. Match this to Iconize's own " +
				"setting if you renamed it (its default is “icon”).",
		},
		operon: {
			heading: "Operon",
			headingDesc:
				"Read tasks, boards, agendas and the running timer from the Operon " +
				"plugin through its own developer API — Operon stays the source of " +
				"truth for what a task is, and Hearth only displays what it returns.",
			enable: "Connect to Operon",
			enableDesc:
				"Off is a kill switch: Operon cards stop reading and Hearth never " +
				"asks Operon for access. Nothing is requested until an Operon card " +
				"is on a dashboard.",
			status: "Connection",
			statusAbsent: "Operon isn't installed or enabled.",
			statusUnsupported:
				"Operon's developer API is desktop-only and needs Obsidian 1.12.2 or newer.",
			statusBooting: "Operon is running but still starting up.",
			statusPending:
				"Waiting for approval. Open Settings → Operon → Core → General → " +
				"Developer API Integrations and approve Hearth.",
			statusSuspended:
				"Access is suspended. Review Hearth's pending scope in Operon's " +
				"Developer API Integrations.",
			statusRevoked:
				"Access was revoked. Grant it again in Operon's Developer API Integrations.",
			statusReady: "Connected — Operon cards can read tasks.",
			statusIdle: "Not connected yet. Add an Operon card to open a session.",
			statusOff: "The integration is switched off, so Hearth isn't reading anything from Operon.",
			statusError: "Operon refused the connection.",
			detail: "Operon reported",
			install: "Open Operon in Community plugins",
			writes: "Allow changes",
			writesDesc:
				"Lets the board card move a task to another status by dragging it, and " +
				"adds a “+” for creating one. Operon decides where a new task goes and " +
				"whether a move is legal; Hearth only asks. Turning this on widens what " +
				"Hearth requests, so you'll need to approve it again in Operon's " +
				"Developer API Integrations. Off means Hearth can only read.",
			writesPending:
				"Reading works, but the change permissions haven't been granted yet — " +
				"approve Hearth again in Operon's Developer API Integrations. Until then " +
				"the cards stay read-only.",
			capabilities: "Requested access",
			capabilitiesDesc:
				"Hearth asks for all of these at once because Operon does not open a " +
				"partly approved session. Read-only unless “Allow changes” is on, which " +
				"adds the task-transition and task-creation permissions.",
			missing: (names: string) => `Not yet granted: ${names}`,
			recheck: "Recheck",
			recheckDesc:
				"Reopen the connection after approving, revoking or reloading Operon.",
			recheckAction: "Recheck now",
		},
		filters: {
			heading: "Search filters",
			headingDesc:
				"Filters are auto-detected from the file types in your vault. Hide any you don't want.",
		},
		dashboard: {
			heading: "Dashboard",
			headingDesc:
				"Sizing and transparency of the card grid. Cards themselves are added and configured on the board.",
			fitToPage: "Fit to page",
			fitToPageDesc:
				"Keep the dashboard to one screen instead of allowing scroll.",
			compact: "Compact spacing",
			compactDesc:
				"Tighten card padding and top margin to enlarge the usable area.",
			arrangeButtonVisibility: "Arrange button visibility",
			arrangeButtonVisibilityDesc:
				"Choose whether the arrange/edit button is always visible or revealed when hovering its area.",
			dashboardSwitcherVisibility: "Dashboard switcher visibility",
			dashboardSwitcherVisibilityDesc:
				"Choose whether the top-left dashboard buttons are always visible or revealed when hovering their area.",
			visibilityOptions: {
				always: "Always visible",
				hover: "Show on hover",
			},
			cardOpacity: "Card opacity",
			cardOpacityDesc:
				"Transparent card backgrounds so the dashboard background shows through.",
			cardBlur: "Card blur",
			cardBlurDesc:
				"Frosted-glass blur behind translucent cards. Needs card opacity below 100% to show. 0 = off.",
			cardRadius: "Card corner radius",
			cardRadiusDesc:
				"How rounded card corners are, in pixels. 14 is the default; lower makes corners sharper.",
			cardBorderWidth: "Card border",
			cardBorderWidthDesc:
				"Thickness of the card border and header divider, in pixels. 0 hides the border.",
			cards: "Cards",
			cardsDesc:
				"Add and configure cards on the dashboard itself: open the home view, " +
				"hit Arrange, then use Add card, Dashboard settings and each card's " +
				"settings button.",
		},
		layout: {
			heading: "Import / export",
			headingDesc:
				"Share one dashboard, or back up your whole setup, as a JSON file.",
			exportDashboard: "Export this dashboard",
			exportDashboardDesc:
				"Save the dashboard you're on as a file others can import. Everything about how it looks travels with it, and you can choose whether to include its wallpaper.",
			exportDashboardButton: "Export dashboard…",
			importAny: "Import",
			importAnyDesc:
				"Open a Hearth file — one dashboard, a layout, or a full backup. It tells you what's in it before anything changes, and a single dashboard is added alongside your own rather than replacing anything.",
			export: "Export layout",
			exportDesc:
				"Download every dashboard plus the grid and layout settings as a JSON file.",
			exportButton: "Export file",
			exportMobileTooltip:
				"On mobile the file is saved to your vault's root folder.",
			importButton: "Import file",
			exportSettings: "Export settings",
			exportSettingsDesc:
				"Download every Hearth setting — the full layout plus header, background, " +
				"behaviour, appearance and TaskNotes options — as a JSON backup file.",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		title: "Card settings",
		/** Shown as the tooltip on tile icon fields (launchpad, commands). */
		iconHelp:
			"Enter a Lucide icon id (e.g. “home”, “star”, “calendar”) — browse them at " +
			"lucide.dev/icons. You can also enter a vault image path (e.g. " +
			"Attachments/icon.png) to use your own picture as the icon.",
		/** Tabs across the top of the card settings modal. */
		tabs: {
			content: "Content",
			style: "Style",
			layout: "Layout",
		},
		type: "Type",
		typeDesc: "What this card shows.",
		cardTitle: "Title",
		cardTitleDesc:
			"Shown in the card's header. Leave empty for a headerless card.",
		cardTitlePlaceholder: "Title",
		mobile: {
			heading: "On a narrow board",
			hidden: "Hide",
			hiddenDesc:
				"Leave this card out when the board stacks into one column. For cards that need width to make sense — a wide table, a board view — hiding beats squeezing.",
			collapsed: "Start collapsed",
			collapsedDesc:
				"Show only the card's title row, and build the card when it is tapped open. A card nobody opens costs one row and runs nothing.",
			height: "Height",
			heightDesc:
				"Height in pixels when stacked. Left empty, the card keeps its own height, capped so a tall card can't fill the screen on its own.",
			order: "Position",
			orderDesc:
				"Where this card comes in the stack, counting from 0. Left empty, it follows the order the board reads in — top to bottom, left to right.",
			autoPlaceholder: "Auto",
		},
		resetSize: "Reset to default size",
		removeCard: "Remove card",
		removeCardTitle: "Remove card?",
		removeCardMessage: (name: string) => `Remove "${name}" from the dashboard?`,
		removeCardConfirm: "Remove",
		thisCard: "this card",
		done: "Done",
		kinds: {
			embed: "Embed (note / image / base)",
			slideshow: "Slideshow",
			daily: "Daily note (today)",
			periodic: "Periodic note (week / month / year)",
			web: "Web page (iframe)",
			bookmarks: "Bookmarks",
			favorites: "Favorites",
			text: "Text / jot-down",
			recent: "Recent files",
			links: "Links / launchpad",
			commands: "Commands",
			templater: "New note from template",
			clock: "Clock & greeting",
			tasks: "Tasks",
			calendar: "Mini calendar",
			schedule: "Calendar",
			stats: "Vault statistics",
			search: "Query",
			searchbar: "Search bar",
			heatmap: "Activity heatmap",
			calculator: "Calculator",
			dataview: "Dataview query",
			datacore: "Datacore query",
			rss: "RSS feed",
			jira: "Jira filter",
			weather: "Weather",
			git: "Git",
			operon: "Operon",
			leaf: "Plugin view (beta)",
			pet: "Pet",
		},
		linkTypes: {
			note: "Note",
			url: "URL",
			command: "Command",
		},
		embed: {
			file: "File to embed",
			fileDesc: "A note, image, canvas or .base file in your vault.",
			filePlaceholder: "File path to embed",
			pickFile: "Pick a file",
			baseView: "Base view",
			baseViewDesc: "Choose a view from this .base file, or use the default view.",
			baseViewDefault: "Default view",
			baseViewFileMissing: "The selected .base file could not be found.",
			baseViewLoadError: "Could not read the .base file views. The default view will be used.",
			baseViewNoViews: "No named views were found in this .base file. The default view will be used.",
			baseViewUnsupported: (count: number) =>
				`${count} view${count === 1 ? "" : "s"} with unsupported wikilink characters were hidden.`,
			zoom: "Zoom",
			zoomDesc:
				"Scale the embedded content. Applies when you close this dialog.",
			zoomImageDesc:
				"Scale the picture inside the frame it was fitted to — zooming a " +
				"cropped picture crops in further. Applies when you close this dialog.",
			imageFit: "Picture fit",
			imageFitDesc:
				"How the picture fills the card. Every mode but the first hands it " +
				"the whole card, edge to edge.",
			imageFits: {
				natural: "Original size",
				contain: "Fit the whole picture",
				cover: "Fill the card (crop)",
				stretch: "Stretch to the card",
				width: "Fit the width (scroll)",
			},
			imagePosition: "Picture position",
			imagePositionDesc: "Where the picture sits in the card.",
			imagePositionCropDesc: "Which part of the picture the crop keeps.",
			imagePositions: {
				"top-left": "Top left",
				top: "Top",
				"top-right": "Top right",
				left: "Left",
				center: "Center",
				right: "Right",
				"bottom-left": "Bottom left",
				bottom: "Bottom",
				"bottom-right": "Bottom right",
			},
			editable: "Editable",
			editableDesc:
				"Edit the embedded note's text in place (Markdown notes only).",
			livePreview: "Live preview",
			livePreviewDesc:
				"Edit in Obsidian's own Live Preview editor instead of the plain " +
				"raw-Markdown box, so formatting renders as you type. Off shows the " +
				"raw Markdown source, edited on double-click.",
			hideBaseHeader: "Hide base header",
			hideBaseHeaderDesc:
				"For embedded .base files, hide the Bases view's own toolbar (view switcher and filter/property controls) so only the results show.",
			secondViewHeading: "Second view",
			secondViewFile: "Second file to embed",
			secondViewFileDesc:
				"Optional. When set, the card shows a switcher between the two views — in the header when the card has a title, or floating (on hover) when it doesn't.",
			secondViewClear: "Remove second view",
			openButton: "Open button",
			openButtonDesc:
				"Show a button that opens the embedded file in its own tab. Off by default.",
		},
		slideshow: {
			source: "Pictures from",
			sourceDesc:
				"A list you pick picture by picture, or every image in a folder.",
			sourceList: "A list of pictures",
			sourceFolder: "A folder",
			picturesHeading: "Pictures",
			picturesEmpty: "No pictures yet — add one below.",
			picturePlaceholder: "Image path",
			captionPlaceholder: "Caption (optional)",
			pickPicture: "Pick an image",
			addPicture: "Add picture",
			addFolderPictures: "Add a folder's pictures",
			removePicture: "Remove picture",
			moveUp: "Move up",
			moveDown: "Move down",
			folder: "Folder",
			folderDesc: "Every image in this folder is shown. Leave empty for the vault root.",
			folderPlaceholder: "Attachments/Photos",
			pickFolder: "Pick a folder",
			includeSubfolders: "Include subfolders",
			includeSubfoldersDesc: "Also show images inside this folder's subfolders.",
			folderCount: (count: number) =>
				count === 1 ? "1 image found here right now." : `${count} images found here right now.`,
			playbackHeading: "Playback",
			order: "Order",
			orderDesc: "The order the pictures are shown in.",
			orders: {
				manual: "List order",
				name: "Name (A → Z)",
				nameDesc: "Name (Z → A)",
				created: "Date created (oldest first)",
				createdDesc: "Date created (newest first)",
				modified: "Date modified (oldest first)",
				modifiedDesc: "Date modified (newest first)",
				random: "Random",
			},
			advance: "Change picture",
			advanceDesc:
				"What moves the card on: a timer, the calendar, or nothing but the " +
				"controls. A daily card works its picture out from today's date, so it " +
				"stays put all day however often the board is redrawn — and both it and " +
				"a manual card remember where they were left.",
			advances: {
				timer: "On a timer",
				daily: "Once a day",
				manual: "Only by hand",
			},
			interval: "Seconds per picture",
			intervalDesc:
				"How long each picture is shown. 0 holds the first picture and turns the " +
				"rotation off; low power mode pauses it too.",
			intervalAria: "Seconds each picture is shown",
			days: "Days per picture",
			daysDesc:
				"How many days each picture is kept before the next one takes over. " +
				"1 changes at midnight; 7 gives you a picture of the week.",
			daysAria: "Days each picture is shown",
			transition: "Transition",
			transitionDesc: "How one picture gives way to the next.",
			transitions: {
				none: "Cut (no animation)",
				fade: "Crossfade",
				slide: "Slide",
				zoom: "Zoom",
			},
			transitionSpeed: "Transition length",
			transitionSpeedDesc: "How long the transition takes, in milliseconds.",
			kenBurns: "Slow zoom",
			kenBurnsDesc:
				"Drift slowly into each picture while it is shown (the “Ken Burns” effect).",
			displayHeading: "Display",
			fit: "Fit",
			fitDesc: "How each picture fills the card.",
			fits: {
				cover: "Fill the card (crop)",
				contain: "Fit the whole picture",
			},
			controls: "Controls",
			controlsDesc:
				"Show previous / pause / next buttons and the position, on hover. On by default.",
			caption: "Caption",
			captionDesc:
				"Show each picture's caption over it, falling back to its file name.",
			pauseOnHover: "Pause on hover",
			pauseOnHoverDesc: "Hold the current picture while the pointer is over the card.",
			openButton: "Open button",
			openButtonDesc:
				"Show a button that opens the picture on screen in its own tab. Off by default.",
		},
		daily: {
			editable: "Editable",
			editableDesc:
				"Edit today's note in place instead of read-only. Saves to the vault.",
			openButton: "Open button",
			openButtonDesc: "Show a button to open today's note in the editor.",
			info: "Daily notes",
			infoDesc:
				"Today's note is resolved from the core Daily notes plugin's date format and folder. The card updates live as you edit.",
		},
		periodic: {
			granularity: "Period",
			granularityDesc:
				"Which periodic note this card shows. It is always the current one, so " +
				"the card moves on by itself when the period ends.",
			granularities: {
				day: "Daily",
				week: "Weekly",
				month: "Monthly",
				quarter: "Quarterly",
				year: "Yearly",
			},
			editable: "Editable",
			editableDesc:
				"Edit the note in place instead of read-only. Saves to the vault.",
			openButton: "Open button",
			openButtonDesc: "Show a button to open the note in the editor.",
			info: "Periodic Notes",
			infoDesc:
				"The note is resolved from the Periodic Notes plugin's own folder, date " +
				"format and template, and a missing one is created by Periodic Notes " +
				"itself. The card updates live as you edit.",
			missingDesc:
				"This card needs the Periodic Notes community plugin. Install and enable " +
				"it, then turn on the note type you want here.",
		},
		web: {
			url: "URL",
			urlPlaceholder: "https://example.com",
			trusted: "Trusted site",
			trustedDesc:
				"Allow the page same-origin access (cookies, storage). Only enable " +
				"for sites you trust — it relaxes the iframe sandbox.",
			autoRefresh: "Auto-refresh",
			autoRefreshDesc:
				"Re-render this card every N seconds to pick up changes. 0 = off.",
			refreshIntervalAria: "Refresh interval in seconds",
		},
		recent: {
			fit: "Fit to card height",
			fitDesc:
				"List as many files as the card is tall enough to show, instead of a " +
				"fixed number. Resizing the card changes how many appear.",
			count: "Number of files",
			countDesc: (max: number) =>
				`How many recently-opened files to list — at most ${max}, which is as ` +
				`far back as Hearth's recent-file history goes.`,
			types: "File types",
			typesDesc: "Only list files of the selected types. Pick any combination; none selected shows every type.",
		},
		calendar: {
			view: "Layout",
			viewDesc: "Month shows a grid; agenda lists upcoming days.",
			viewMonth: "Month grid",
			viewAgenda: "Agenda",
			agendaDays: "Days ahead",
			agendaDaysDesc: "How many days the agenda lists, starting from today.",
			weekNumbers: "Week numbers",
			weekNumbersDesc: "Show an ISO week-number column down the left edge.",
			heatmap: "Heatmap",
			heatmapDesc: "Tint each day by note activity that day.",
			heatmapCounts: "Heatmap counts",
			externalCalendars: "External calendars",
			externalCalendarsDesc:
				"Subscribe to ICS/iCal feeds (Google, iCloud, Fastmail, Nextcloud…). Events appear as coloured dots on the grid and are listed in the agenda view.",
			operonTasks: "Show Operon tasks",
			operonTasksDesc:
				"Mark days that have an Operon task due, and list those tasks in the " +
				"agenda. Reads through Operon's developer API, so it needs Operon " +
				"approved in Settings → Hearth → Integrations. Tasks that are only " +
				"scheduled (no due date) aren't included.",
			operonTaskColor: "Operon task colour",
			operonTaskColorDesc: "Colour of the task markers. Defaults to the accent colour.",
			sourceNamePlaceholder: "Name",
			sourceUrlPlaceholder: "ICS/iCal URL (https:// or webcal://)",
			sourceShow: "Show this calendar",
			sourceHide: "Hide this calendar",
			sourceRemove: "Remove calendar",
			addCalendar: "Add calendar",
			refresh: "Refresh every",
			refreshDesc: "How often to re-fetch calendars, in minutes. 0 fetches only on open.",
			eventNoteHeading: "Event notes",
			eventNoteDesc:
				"Configure the “Create note” action in the event popup: pick a template, choose a folder and filename, and decide what happens to each event value.",
			eventNoteEnabled: "Show “Create note”",
			eventNoteEnabledDesc: "Offer a create-note button in the event details popup.",
			eventNoteFolder: "Folder",
			eventNoteFolderDesc: "Where new event notes are created. Empty = vault root.",
			eventNoteFilename: "Filename",
			eventNoteFilenameDesc: "Note name. Placeholders: {{summary}}, {{date}}, {{start}}, {{location}}, …",
			eventNoteTemplate: "Template",
			eventNoteTemplateDesc:
				"Optional note whose contents seed the body. The same {{…}} placeholders are substituted.",
			eventNotePickTemplate: "Pick template file",
			eventNoteClearTemplate: "Clear template",
			eventNoteLinkKey: "Link property",
			eventNoteLinkKeyDesc:
				"Frontmatter property that stores the event’s ID, so an event always maps to one note. Empty to disable linking.",
			eventNoteCustomize: "Customise field routing",
			eventNoteCustomizeDesc:
				"Off uses sensible defaults (date & time as properties, description in the body). On lets you route each value.",
			eventNoteFieldsHeading: "Field routing",
			eventNoteAddField: "Add field",
			eventNoteRemoveField: "Remove",
			eventFieldNames: {
				summary: "Name",
				date: "Date",
				start: "Start time",
				end: "End time",
				location: "Location",
				description: "Description",
				url: "URL",
				calendar: "Calendar",
			},
			eventFieldActions: {
				ignore: "Ignore",
				frontmatter: "Property",
				body: "Append to body",
			},
			eventNotePropertyPlaceholder: "Property name",
			eventNoteHeadingPlaceholder: "Heading (optional)",
			eventNoteFormatPlaceholder: "Format (e.g. HH:mm)",
			chipsHeading: "Entry details",
			chipsDesc:
				"Choose what each agenda entry shows beside its title. Turn off what you don't need — on a narrow card the markers compete with the title itself.",
			chipTime: "Time",
			chipTimeDesc: "The start time, or “All day”.",
			chipSource: "Calendar name",
			chipSourceDesc: "Which calendar an entry came from. Only ever shown with more than one source.",
			chipStatus: "Status",
			chipStatusDesc: "A task's TaskNotes status, e.g. “In progress”. Off by default.",
			chipPriority: "Priority",
			chipPriorityDesc: "A task's TaskNotes priority, e.g. “High”.",
			chipDue: "Due marker",
			chipDueDesc: "The “Due” badge on a due-date entry.",
			chipRecurring: "Recurring marker",
			chipRecurringDesc: "The “Recurring” badge on a repeating task.",
			chipTimeblock: "Timeblock marker",
			chipTimeblockDesc: "The “Timeblock” badge on a timeblock.",
			taskNotesHeading: "TaskNotes",
			taskNotesDesc:
				"Use TaskNotes as an event source. The card mirrors what TaskNotes' own calendar shows — scheduled tasks, due dates, recurring occurrences, timeblocks and the calendars subscribed inside TaskNotes — using TaskNotes' own field names, statuses and colours.",
			taskNotesMissing:
				"TaskNotes isn't enabled in this vault. Install and enable it to use it as a calendar source.",
			taskNotesEnabled: "Use TaskNotes",
			taskNotesEnabledDesc: "Draw TaskNotes items on this calendar.",
			taskNotesScheduled: "Scheduled tasks",
			taskNotesScheduledDesc:
				"Tasks on their scheduled date, sized by their time estimate.",
			taskNotesDue: "Due dates",
			taskNotesDueDesc: "Tasks on their due date.",
			taskNotesRecurring: "Recurring tasks",
			taskNotesRecurringDesc:
				"Unroll a recurring task into one entry per occurrence. Off shows only its next date.",
			taskNotesTimeblocks: "Timeblocks",
			taskNotesTimeblocksDesc: "Timeblocks written into your daily notes.",
			taskNotesFollows: (on: boolean) =>
				`TaskNotes currently has this ${on ? "on" : "off"}.`,
			taskNotesFollowReset: "Follow TaskNotes",
			taskNotesCompleted: "Show completed",
			taskNotesCompletedDesc: "Keep finished tasks on the calendar, struck through.",
			taskNotesArchived: "Show archived",
			taskNotesArchivedDesc: "Include tasks carrying TaskNotes' archive tag.",
			taskNotesComplete: "Complete from the calendar",
			taskNotesCompleteDesc:
				"Offer a completion box on each task, writing back exactly what TaskNotes writes (per-occurrence for recurring tasks).",
			taskNotesSubscriptions: "TaskNotes calendars",
			taskNotesSubscriptionsDesc: (count: number) =>
				`Also show the ${count} calendar${count === 1 ? "" : "s"} subscribed inside TaskNotes.`,
			taskNotesSubscriptionsNone: "TaskNotes has no calendar subscriptions to show.",
			taskNotesSubLoaded: (count: number) =>
				`${count} event${count === 1 ? "" : "s"} loaded.`,
			taskNotesSubPending: "Not loaded yet — refresh below.",
			taskNotesSubDisabled: "Disabled in TaskNotes.",
			taskNotesSubBlocked: "Not fetched: external calls are disabled in Hearth's settings.",
			taskNotesSubFailed: (reason: string) => `Couldn't load: ${reason}`,
			taskNotesSubNotCalendar: "the response wasn't an iCalendar feed.",
			taskNotesSubMissingFile: "that file isn't in the vault.",
			taskNotesSubRefresh: "Refresh calendars",
			taskNotesColorBy: "Colour by",
			taskNotesColorByDesc: "Where each task's colour comes from.",
			taskNotesColorStatus: "TaskNotes status",
			taskNotesColorPriority: "TaskNotes priority",
			taskNotesColorFixed: "One fixed colour",
			taskNotesColor: "Task colour",
			taskNotesColorDesc: "Used for the fixed colour, and when TaskNotes defines none.",
			taskNotesDueColor: "Due colour",
			taskNotesDueColorDesc: "Optional separate colour for due-date entries.",
			taskNotesTimeblockColor: "Timeblock colour",
			taskNotesTimeblockColorDesc: "Used for timeblocks that carry no colour of their own.",
		},
		schedule: {
			view: "Opens in",
			viewDesc:
				"The view the card shows when the board is opened. You can switch views on the card itself at any time.",
			views: "Views offered",
			viewsDesc:
				"Which views the card's switcher lists. Leave all four on to keep every one a click away; a single view hides the switcher entirely.",
			toolbar: "Toolbar",
			toolbarDesc:
				"Show the navigation row: back, today, forward, the period being shown, and the view switcher. Off pins the card to the current period.",
			dailyNotes: "Daily notes",
			dailyNotesDesc:
				"Mark days that already have a daily note, and open (or offer to create) it when a day is clicked. Off makes this purely an event calendar.",
			weekHeading: "The week",
			firstDay: "Week starts on",
			firstDayDesc: "Which day the month and week grids start from.",
			firstDayLocale: (day: string) => `Follow Obsidian's language (${day})`,
			hideWeekends: "Hide weekends",
			hideWeekendsDesc: "Leave Saturday and Sunday out of the month and week grids.",
			weekNumbers: "Week numbers",
			weekNumbersDesc: "Show a week-number column down the left edge.",
			clock: "Clock",
			clockDesc: "How event times are written.",
			clockLocale: "Follow Obsidian's language",
			clock12: "12-hour (9:00 AM)",
			clock24: "24-hour (09:00)",
			monthHeading: "Month view",
			monthStyle: "Events shown as",
			monthStyleDesc:
				"Named chips read at a glance on a card with room; dots suit a small card, the way the mini calendar draws them.",
			monthStyleChips: "Named chips",
			monthStyleDots: "Dots",
			maxPerDay: "Events per day",
			maxPerDayDesc:
				"How many events a day cell lists before the rest collapse into a “+N more” link. 0 lists every one and lets the cell scroll.",
			gridHeading: "Week & day views",
			gridDesc:
				"The time grid draws the whole day by default, and opens scrolled to the first event — so nothing can sit outside the visible hours. Narrow the hours if you would rather see only part of the day.",
			hours: "Hours drawn",
			hoursDesc:
				"The first and last hour of the grid. Anything outside them moves to the all-day band above it rather than disappearing.",
			hoursMidnight: "Midnight",
			hourHeight: "Hour height",
			hourHeightDesc: "How tall one hour is, in pixels. Taller shows more detail; shorter fits more of the day.",
			nowLine: "Current time line",
			nowLineDesc: "Draw a line across today's column at the current time.",
			listHeading: "List view",
			listDays: "Days listed",
			listDaysDesc: "How far ahead the list reaches, starting from the day it is showing.",
		},
		heatmap: {
			metric: "Metric",
			weeks: "Weeks",
			weeksDesc: "How many weeks of history to show.",
			advanced: "Advanced",
			advancedDesc:
				"Build your own metric: take the day from a frontmatter date, add up a " +
				"number instead of counting notes, and pick which notes count at all. " +
				"Off counts every note by its file date.",
			metricHeading: "What to count",
			rangeHeading: "Range",
			source: "Day comes from",
			sourceDesc: "Which date decides the square a note lands on.",
			sourceOptions: {
				modified: "Date modified",
				created: "Date created",
				property: "A frontmatter date",
			},
			dateProperty: "Date property",
			datePropertyDesc:
				"The frontmatter key holding the date — date, due, published. Accepts a " +
				"date, a date and time, or a [[daily note]] link; a list counts once per " +
				"entry. Notes without it are skipped.",
			datePropertyPlaceholder: "date",
			value: "Each note adds",
			valueDesc: "One per note, or the number in a property — minutes read, pages written, kilometres run.",
			valueOptions: {
				count: "1 (count the notes)",
				sum: "A number from a property",
			},
			valueProperty: "Value property",
			valuePropertyDesc:
				"The frontmatter key holding the number to add. Notes whose value isn't a " +
				"number are skipped rather than counted as one.",
			valuePropertyPlaceholder: "minutes",
			unit: "Unit",
			unitDesc: 'What one unit is called when a day is described — "5 workouts". Blank follows the metric.',
			unitPlaceholder: "notes edited",
			rules: "Which notes count",
			rulesDesc: "Conditions a note has to meet to be counted. With no rules, every note counts.",
			match: "Match",
			matchOptions: {
				all: "All rules (AND)",
				any: "Any rule (OR)",
			},
			fieldOptions: {
				property: "Property",
				tag: "Tag",
				folder: "Folder",
				path: "Path",
			},
			opOptions: {
				is: "is",
				isNot: "is not",
				contains: "contains",
				notContains: "does not contain",
				gt: "is more than",
				lt: "is less than",
				exists: "is set",
				missing: "is not set",
			},
			keyPlaceholder: "property",
			valuePlaceholder: "value",
			addRule: "Add rule",
			removeRule: "Remove rule",
		},
		stats: {
			advanced: "Advanced",
			advancedDesc:
				"Choose which stats to show, break attachments out by file type, and add " +
				"custom counts. Off shows the default set.",
			builtins: "Stats to show",
			builtinsDesc: "Pick which built-in stats appear. The day streak only shows when daily notes are set up.",
			attachmentTypes: "Attachment breakdown",
			attachmentTypesDesc: "Add a separate count tile for each selected file type (images, PDFs, …).",
			customCounts: "Custom counts",
			customCountsDesc:
				"Each row counts the files matching a query and shows the total as a tile. " +
				"Query syntax matches the search bar: #tag, key:value for a property, or plain text.",
			labelPlaceholder: "Label",
			iconPlaceholder: "Icon",
			queryPlaceholder: "#project or status:active",
			addCount: "Add count",
			removeCount: "Remove count",
		},
		metricOptions: {
			modified: "Notes edited",
			created: "Notes created",
		},
		savedSearch: {
			query: "Query",
			queryDesc:
				"Same syntax as the search bar: plain text for names/bodies, #tag for " +
				"tags, or key:value for a frontmatter property.",
			queryPlaceholder: "#project or status:active or meeting notes",
			display: "Display",
			displayDesc: "Show matches as a compact list or as tiles.",
			displayList: "List",
			displayTiles: "Tiles",
			maxResults: "Max results",
			maxResultsDesc: "The most matches to show at once.",
		},
		searchBar: {
			placeholder: "Placeholder",
			placeholderDesc:
				"Text shown in the empty field. Leave blank to use the one from " +
				"Settings → Appearance.",
			filters: "Filter row",
			filtersDesc:
				"Show the file-type chips under the field, the same ones the header " +
				"search bar offers. They need a taller card to sit in.",
			filterTypes: "Filter chips",
			filterTypesDesc:
				"Which chips this card offers. A chip only appears when the vault " +
				"actually holds that kind of file.",
			filterTypeGlobalOff: "Hidden for every search bar in Settings → Filters.",
			button: "Button",
			buttonDesc:
				"An action button beside the field: create a new note, or search the " +
				"web for whatever is typed in the field.",
			buttonNone: "None",
			buttonNewNote: "New note",
			buttonSearchOnline: "Search online",
			seamless: "Seamless",
			seamlessDesc:
				"Drop the card frame — no border, background or title row — so this " +
				"reads as a standalone search bar on the board.",
			sizeNote:
				"The field is as thick as the card is tall — drag the card's edge in " +
				"Arrange to make the bar chunkier or slimmer.",
		},
		tiles: {
			heading: "Buttons",
			sizing: "Button sizing",
			sizingDesc:
				"Whether the buttons fill the card — every one of them visible however " +
				"big the card is, growing and shrinking with it — or keep a fixed pixel " +
				"size, so a card too small for them all scrolls. Filled buttons stop " +
				"shrinking once they'd be too small to use, in either direction, and a " +
				"card too small for them at that size scrolls too. Cards made before " +
				"this setting existed stay on the fixed style until you switch them; " +
				"each style keeps its own sizes, so switching back restores what you " +
				"had.",
			sizingScale: "Fill the card",
			sizingFixed: "Fixed size (legacy)",
			across: "Buttons across",
			acrossDesc:
				"How many buttons wide the card is, and so how wide one button is: a " +
				"fraction of the card, down to the minimum size a button keeps. Their " +
				"height works the same way — the rows share whatever height the card " +
				"has between them — so a shorter card means shorter buttons rather " +
				"than hidden ones. A button can still be made two or three cells wide " +
				"(or tall) by dragging its bottom-right corner in arrange mode — or " +
				"half a cell, since the grid takes half steps in both directions.",
			minSize: "Minimum button size",
			minSizeDesc:
				"How small a whole button may get, in pixels, before the card scrolls " +
				"instead of shrinking them any further — a half-cell button stops at " +
				"half of it. Low by default, so that buttons fit rather than a " +
				"scrollbar appearing; raise it to keep them comfortable on a card you " +
				"often make small, and the card scrolls when they no longer fit.",
		},
		links: {
			heading: "Links",
			autoShift: "Auto-shift tiles (beta)",
			autoShiftDesc:
				"When on, tiles shove each other aside as one is dragged (like phone " +
				"widgets). Off by default — tiles are pure free-form and may overlap.",
			labelPlaceholder: "Label",
			iconPlaceholder: "Icon",
			pickCommand: "Pick command…",
			targetUrl: "Target (URL)",
			targetNote: "Target (note path)",
			moveUp: "Move up",
			moveDown: "Move down",
			removeLink: "Remove link",
			addLink: "Add link",
		},
		commands: {
			autoShift: "Auto-shift tiles (beta)",
			autoShiftDesc:
				"When on, tiles shove each other aside as one is dragged (like phone " +
				"widgets). Off by default — tiles are pure free-form and may overlap.",
			buttonSize: "Button size",
			buttonSizeDesc:
				"Default size of the command tiles. Resize an individual tile by " +
				"dragging its bottom-right corner, or set a per-tile size below.",
			heading: "Commands",
			iconOptionalPlaceholder: "Icon (optional)",
			sizePlaceholder: "Size",
			tileSizeAria: "Tile size in pixels (optional)",
			moveUp: "Move up",
			moveDown: "Move down",
			removeCommand: "Remove command",
			addCommand: "Add command",
		},
		templater: {
			missing: "Templater isn't enabled",
			missingDesc:
				"This card creates notes by calling the Templater plugin — install and " +
				"enable it, and these tiles start working. Nothing else here needs " +
				"changing in the meantime.",
			autoShift: "Auto-shift tiles (beta)",
			autoShiftDesc:
				"When on, tiles shove each other aside as one is dragged (like phone " +
				"widgets). Off by default — tiles are pure free-form and may overlap.",
			buttonSize: "Button size",
			buttonSizeDesc:
				"Default size of the tiles. Resize an individual tile by dragging its " +
				"bottom-right corner.",
			heading: "Templates",
			labelPlaceholder: "Label",
			pickTemplate: "Pick a template…",
			pickTemplateTooltip: "Choose the Templater template this tile runs",
			pickFolderTooltip:
				"Choose the folder the new note goes in. The vault root means “wherever " +
				"Obsidian puts new notes”.",
			filenamePlaceholder: "Filename",
			filenameTooltip:
				"Name for the new note, without the extension. {{date}}, {{date:FMT}}, " +
				"{{time}}, {{time:FMT}} and {{prompt}} are substituted. Leave empty to " +
				"let Templater name it.",
			openOn: "Opens the new note — click to file it away silently instead",
			openOff: "Files the new note away silently — click to open it instead",
			removeTile: "Remove tile",
			addTile: "Add a template",
			tokensHelp:
				"Filenames may use {{date}}, {{date:YYYY-MM}}, {{time}}, {{time:HH-mm}} " +
				"and {{prompt}}, which asks you for the rest of the name before the note " +
				"is made. Everything inside the template itself — <% tp.* %>, your user " +
				"scripts, tp.system.prompt() — is Templater's own, and runs exactly as it " +
				"does from Templater's command.",
			tokensHelpScoped: (folder: string) =>
				`The picker lists the templates in “${folder}”, Templater's own template ` +
				"folder. Filenames may use {{date}}, {{date:YYYY-MM}}, {{time}}, " +
				"{{time:HH-mm}} and {{prompt}}, which asks you for the rest of the name " +
				"before the note is made. Everything inside the template itself — " +
				"<% tp.* %>, your user scripts, tp.system.prompt() — is Templater's own, " +
				"and runs exactly as it does from Templater's command.",
		},
		tasks: {
			source: "Source",
			sourceDesc:
				"Markdown checkboxes work anywhere. TaskNotes reads that plugin's " +
				"task notes via frontmatter (field names configurable in Settings → " +
				"Hearth, since TaskNotes has no API for other plugins to query it). " +
				"Kanban reads a single Kanban-plugin board note, one column per heading.",
			sourceCheckbox: "Markdown checkboxes",
			sourceTaskNotes: "TaskNotes plugin",
			sourceKanban: "Kanban plugin",
			kanbanBoard: "Board note",
			kanbanBoardDesc:
				"The Kanban-plugin board to read. Leave empty to auto-detect the first " +
				"note in scope with a “kanban-plugin” frontmatter key.",
			kanbanBoardPlaceholder: "Auto-detect",
			pickBoard: "Pick a Kanban board",
			kanbanExtended: "Dates & priorities",
			kanbanExtendedDesc:
				"Read the dates, priority and repeat marks written on each card " +
				"(compatible with the obsidian-tasks plugin) so they show as " +
				"indicators, sort the list, and can be edited from the card. Off " +
				"reads cards as plain text.",
			checkboxExtended: "Dates & priorities",
			checkboxExtendedDesc:
				"Read the dates, priority and repeat marks written inline on each " +
				"checkbox (compatible with the obsidian-tasks plugin) so they show as " +
				"indicators, sort the list, and can be edited from the item's " +
				"right-click menu. Off reads checkboxes as plain text.",
			checkboxStatuses: "Task states (board columns)",
			checkboxStatusesDesc:
				"The checkbox states shown as columns on a Kanban board, one per line " +
				"as “[symbol] Label” — the symbol is the character inside “- [ ]”. Add " +
				"“(done)” to mark a state complete. Dragging a card to a column writes " +
				"its symbol. Leave empty for the default set (To do, In progress, Done).",
			quickView: "Quick view on click",
			quickViewDesc:
				"Clicking a task opens a compact popover — its metadata and " +
				"description, editable in place, with buttons to open the full note " +
				"or delete the task — instead of opening the note straight away. Off " +
				"opens the note on click.",
			convertTemplate: "Convert-to-note template",
			convertTemplateDesc:
				"When you right-click a card and choose “Convert to note”, seed the " +
				"new note from this template. Supports {{title}}, {{date}} and " +
				"{{time}}. Leave empty to create a blank note.",
			convertTemplatePlaceholder: "e.g. Templates/Task.md",
			pickTemplate: "Pick a template note",
			convertScrape: "Scrape metadata to frontmatter",
			convertScrapeDesc:
				"When converting a card to a note, move its dates, priority and " +
				"repeat marks into the new note's YAML frontmatter instead of leaving " +
				"the emoji markers on the board link.",
			newTaskAsNote: "New tasks as notes",
			newTaskAsNoteDesc:
				"Create each new card as its own note (a link on the board) straight " +
				"away, instead of an inline checkbox — applying the template and " +
				"metadata-to-frontmatter options above, just like Convert to note.",
			layout: "Layout",
			layoutDesc:
				"List, or a Kanban board grouped by status. On the board, drag cards " +
				"between columns, drag column headers to reorder, use a column's eye " +
				"icon to hide it, and its check icon to make it auto-complete cards. " +
				"Right-click a card to convert it into its own note.",
			layoutList: "List",
			layoutKanban: "Kanban board",
			kanbanColumns: "Kanban columns",
			kanbanHidden: (columns: string) => `Hidden: ${columns}`,
			kanbanDoneColumns: (columns: string) => `Auto-complete: ${columns}`,
			kanbanCustomOrder: "Custom column order is set.",
			showAll: "Show all",
			resetColumns: "Reset column order, visibility & done columns",
			doneStatuses: "Statuses counted as complete",
			doneStatusesDesc:
				"TaskNotes source: which status values are treated as complete (hidden " +
				"unless “Show completed” is on, and struck through when shown), one per " +
				"line. Leave empty to use just the done value from Settings → Hearth. " +
				"Add, e.g., “canceled” to count cancelled tasks as complete too.",
			doneStatusesPlaceholder: "done\ncanceled",
			fields: "Fields",
			fieldsFollowGlobal:
				"Following the fields from Settings → Hearth → Integrations. Turn on " +
				"to give this card its own.",
			fieldsCustomize: "Customize…",
			fieldsTitle: "Task fields",
			fieldsHint:
				"Everything a task shows, in order. A field is yours to define: name " +
				"it, choose how it's drawn, and give it the keys it reads.",
			fieldsEmpty: "No fields yet — tasks show their text only.",
			fieldsNone: "None — tasks show their text only.",
			fieldsApplyClose: "Apply & close",
			fieldsApplyDesc: "Apply without closing, to keep adjusting.",
			fieldsReset: "Remove all fields",
			fieldUnnamed: "Untitled field",
			fieldDefaultName: (n: number) => `Field ${n}`,
			fieldAdd: "Add field",
			fieldEdit: "Edit field",
			fieldRemove: "Remove field",
			fieldMoveUp: "Move up",
			fieldMoveDown: "Move down",
			fieldExpand: "Expand",
			fieldCollapse: "Collapse",
			fieldName: "Name",
			fieldNameDesc: "What this field is called. Shown on tasks only if you ask below.",
			fieldNamePlaceholder: "e.g. Priority",
			fieldShowName: "Show the name on tasks",
			fieldShowNameDesc: "Prefix each value with the field name (“Priority: Urgent”).",
			fieldDisplay: "Display",
			fieldDisplayDesc:
				"How this field's values are drawn. The last two show nothing on the " +
				"task and color the whole row or card instead, and only one field can " +
				"use them. “Colored dot with label” is the priority's own form, offered " +
				"to fields that read one. A description is always its own block of " +
				"sub-bullets.",
			fieldAmbientTaken: (name: string) =>
				`Tint and glow are already used by “${name}”. A task has one background ` +
				`and one ring, so only one field can take them.`,
			fieldAmbientIgnored: (name: string) =>
				`This field colors nothing: “${name}” already tints or rings the task, ` +
				`and only one field can. Give one of them another display.`,
			fieldStyles: {
				pill: "Chip",
				dot: "Colored dot",
				dotlabel: "Colored dot with label",
				text: "Plain text",
				hue: "Tint the whole task",
				glow: "Glow around the task",
			},
			fieldOpacity: "Strength",
			fieldOpacityDesc:
				"How strongly the color is laid on. Only the value's color is used — " +
				"a value with no color set leaves the task alone.",
			fieldKeys: "Keys",
			fieldKeysDesc:
				"Where this field reads from. Every key that has a value shows one, " +
				"so a field can gather several pieces of metadata under one name.",
			fieldKeysEmpty: "No keys yet — this field shows nothing.",
			fieldNoKeys: "No keys",
			fieldAddKey: "Add a key",
			fieldAddKeyDesc:
				"Hearth's own values reach a checkbox line's priority, a board column " +
				"and the parsed dates; a property reads anything in your frontmatter.",
			fieldAddBuiltin: "What Hearth reads",
			fieldAddProperty: "Frontmatter property",
			fieldAddKeyTyped: "Type a property name…",
			fieldAddKeyPlaceholder: "Property name",
			fieldRemoveKey: "Remove key",
			fieldPickProperty: "Properties found in your notes",
			fieldPickBuiltin: "Values Hearth parses itself",
			fieldKeyAlreadyAdded: (key: string) => `“${key}” is already a key on this field.`,
			fieldMapValues: "Values & colors",
			fieldMappedValues: (n: number) => `${n} value(s) mapped`,
			fieldNoMappings: "Values shown as they are",
			fieldMapHint:
				"Show a nicer label and a color for each value. Values you don't map " +
				"still show, as themselves.",
			fieldMapEmpty: "No values mapped yet.",
			fieldDateKey: "Shown as a date",
			fieldIsDate: "Treat as a date",
			fieldIsDateDesc:
				"Show this property as a relative date (“Tomorrow”), color it by " +
				"whether it's past, today or upcoming, and edit it with a calendar.",
			fieldDateHint:
				"A date has no fixed values to map, so it's colored by where it " +
				"falls. A label is optional — leave it empty to keep the date itself.",
			fieldDateLabelPlaceholder: "Show as (optional)",
			dateRelations: {
				"<today": "Before today",
				today: "Today",
				">today": "After today",
			},
			fieldNotMappable:
				"This key has no discrete values to map — it keeps its own format.",
			fieldMatchPlaceholder: "e.g. high",
			fieldLabelPlaceholder: "Optional",
			fieldValueColumn: "Value in your notes",
			fieldWhenColumn: "When the date falls",
			fieldShownColumn: "Shown on the task as",
			fieldColorColumn: "Color",
			fieldAddMapping: "Add a value",
			fieldValuesFound: (n: number) => `From your notes (${n})`,
			fieldRemoveMapping: "Remove value",
			fieldPickValue: "Values this key takes elsewhere in your vault",
			fieldColor: "Color",
			fieldColorCustom: "Custom color",
			fieldColorClear: "No color",
			colorNames: {
				"--color-red": "Red",
				"--color-orange": "Orange",
				"--color-yellow": "Yellow",
				"--color-green": "Green",
				"--color-cyan": "Cyan",
				"--color-blue": "Blue",
				"--color-purple": "Purple",
				"--color-pink": "Pink",
			},
			sourceNames: {
				status: "Status (TaskNotes)",
				column: "Board column (Kanban)",
				priority: "Priority",
				start: "Start date",
				scheduled: "Scheduled date",
				due: "Due date",
				doneDate: "Done date",
				description: "Description",
			},
			showCompleted: "Show completed",
			showCompletedKanbanDesc:
				"Completed tasks always appear in the Done column on a Kanban board.",
			maxTasks: "Max tasks shown",
			maxTasksDesc: "Sorted by due date (overdue/soonest first), then by file.",
			folders: "Folders",
			scope: "Scope",
			scopeAll: "Whole vault",
			scopeWhitelist: "Only these folders",
			scopeBlacklist: "Everywhere except these folders",
			foldersDesc: "One folder path per line.",
		},
		favorites: {
			heading: "Favorites",
			headingDesc: "Notes shown by every favorites card.",
			ownList: "Give this card its own list",
			ownListOn:
				"This card shows its own notes and ignores the vault-wide list. Turn it off to follow the vault's favorites again — the list below is dropped.",
			ownListOff:
				"This card follows the vault-wide favorites, like every other favorites card. Turn it on to give it a list of its own, starting from the one it shows now.",
			moveUp: "Move up",
			moveDown: "Move down",
			remove: "Remove",
			addFavorite: "Add favorite",
		},
		clock: {
			style: "Style",
			styleDigital: "Digital",
			styleAnalog: "Analog",
			hourFormat: "Time format",
			hourFormatAuto: "Automatic (locale)",
			hourFormat12: "12-hour",
			hourFormat24: "24-hour",
			showSeconds: "Show seconds",
			showGreeting: "Show greeting",
			playful: "Playful greetings",
			playfulDesc: "Cheeky, randomised greetings instead of the plain ones.",
			greetingOverride: "Greeting override",
			greetingOverrideDesc: "Leave empty for the automatic greeting.",
			date: "Date",
			dateFull: "Weekday, day month",
			dateLong: "Weekday, day month year",
			dateShort: "Short (locale)",
			dateIso: "ISO (2026-06-29)",
			dateWeekday: "Weekday only",
			dateCustom: "Custom format…",
			dateNone: "Hidden",
			customFormat: "Custom date format",
			customFormatDesc: "A moment.js format, e.g. ddd D MMM or YYYY/MM/DD.",
			customFormatPlaceholder: "ddd D MMM",
		},
		calculator: {
			angleUnit: "Angle unit",
			angleUnitDesc: "Unit assumed by trig functions like sin and cos.",
			degrees: "Degrees",
			radians: "Radians",
			keypad: "Keypad",
			keypadDesc:
				"Show an on-screen keypad on the card: basic (digits and operations) or scientific (adds functions, powers and constants).",
			keypadNone: "Hidden",
			keypadBasic: "Basic",
			keypadScientific: "Scientific",
		},
		dataview: {
			language: "Query type",
			languageDesc:
				"Dataview Query Language (TABLE / LIST / TASK) or DataviewJS code.",
			languageDql: "Dataview query (DQL)",
			languageJs: "DataviewJS",
			query: "Query",
			queryDqlDesc:
				"A Dataview query, written exactly as inside a ```dataview code block " +
				"(without the fences). Runs with no “current note”, so global queries " +
				"work fully but this.file-relative queries have no file to resolve to.",
			queryJsDesc:
				"DataviewJS code, as inside a ```dataviewjs block (without the fences). " +
				"The dv API is in scope. Runs arbitrary JavaScript — only use code you trust.",
			queryDqlPlaceholder:
				'TABLE file.mtime AS "Modified" FROM #project SORT file.mtime DESC',
			queryJsPlaceholder: "dv.list(dv.pages('#project').file.link)",
		},
		datacore: {
			language: "Query type",
			languageDesc:
				"A Datacore query rendered as a live list, or a Datacore script that draws its own view.",
			languageQuery: "Datacore query",
			languageJsx: "Script (JSX)",
			languageJs: "Script (JS)",
			languageTsx: "Script (TSX)",
			languageTs: "Script (TS)",
			query: "Query",
			queryDesc:
				"A Datacore query, e.g. @page and #project. Hearth renders the matches as a " +
				"live list of links. Runs with no “current note”, so global queries work " +
				"fully but file-relative ones have no file to resolve to.",
			queryPlaceholder: "@page and #project",
			script: "Script",
			scriptDesc:
				"A Datacore script, as inside a ```datacorejsx block (without the fences). " +
				"The dc API is in scope and the script returns the view to render. Runs " +
				"arbitrary code — only use code you trust.",
			scriptPlaceholder:
				"return function View() {\n\tconst pages = dc.useQuery(\"@page and #project\");\n\treturn <dc.List rows={pages} renderer={(p) => <dc.Link link={p.$link} />} />;\n}",
			pageSize: "Rows per page",
			pageSizeDesc: "Page the generated list at this many rows. 0 shows every match at once.",
		},
		git: {
			missing: "The Git plugin isn't enabled",
			missingDesc:
				"This card is a window onto the Git community plugin — install and enable " +
				"it, and point it at a repository, for the card to show anything.",
			sections: "Sections",
			actions: "Buttons",
			destructive: "Cannot be undone.",
			removeAction: "Remove this button",
			addAction: "Add a button",
			addActionPlaceholder: "Choose…",
			actionStyle: "Button style",
			actionStyleDesc: "Icons alone are compact; labels make a wide card readable.",
			actionStyles: {
				icon: "Icon only",
				labelled: "Icon and label",
			},
			committing: "Committing",
			commitScope: "What to commit",
			commitScopeDesc:
				"Which files the Commit and Commit-and-sync buttons include.",
			commitScopes: {
				smart: "Staged if anything is staged, otherwise everything",
				all: "Everything",
				staged: "Only staged files",
			},
			askForMessage: "Ask for a message",
			askForMessageDesc:
				"Have the Git plugin prompt for a commit message each time, exactly as its " +
				"“…with specific message” commands do.",
			commitMessage: "Commit message",
			commitMessageDesc:
				"Used by this card's commit buttons. Leave empty to use the Git plugin's " +
				"own commit-message template.",
			commitMessagePlaceholder: "vault backup: {{date}}",
			skipConfirm: "Skip confirmations",
			skipConfirmDesc:
				"Run discarding actions immediately instead of asking first. Discarded " +
				"changes cannot be recovered.",
			display: "Display",
			changeLimit: "Changed files shown",
			changeLimitDesc: "0 lists every changed file.",
			showPaths: "Show folders",
			showPathsDesc: "Print each changed file's folder under its name.",
			logLimit: "Commits shown",
			logLimitDesc: "How many recent commits the log section lists.",
			refresh: "Re-read every",
			refreshDesc:
				"Minutes between extra reads of the repository, on top of following the " +
				"Git plugin's own updates. 0 — the default — follows those updates only, " +
				"which already covers everything done inside Obsidian.",
		},
		operon: {
			view: "View",
			viewDesc: "What this card draws from Operon.",
			viewList: "Task list",
			viewBoard: "Status board",
			viewAgenda: "Agenda",
			viewTimer: "Timer",
			scope: "Scope",
			scopeDesc:
				"Use one of Operon's own scoped views, or apply the filters below. " +
				"Operon decides what counts as overdue or happening today, so its " +
				"scopes stay correct as its rules evolve.",
			scopeQuery: "Custom filters",
			scopeNormal: "All tasks",
			scopeToday: "Happening today",
			scopeOverdue: "Overdue",
			scopeRecent: "Recently touched",
			createAs: "New tasks",
			createAsDesc:
				"What the card's “+” asks Operon to make. Operon's default follows its own " +
				"settings; the other two pick which of its configured targets to use — " +
				"useful when one of them can't be resolved. Where the task actually goes " +
				"is Operon's decision either way.",
			createAsDefault: "Operon's default",
			createAsInline: "Inline, in a note",
			createAsFile: "Its own note",
			agendaDays: "Days ahead",
			agendaDaysDesc: "How many days the agenda covers, including today.",
			count: "Tasks shown",
			countDesc: "Maximum tasks in the list, or per board column.",
			pipelines: "Pipelines",
			pipelinesDesc: "Limit to these Operon pipelines. None selected means all.",
			statuses: "Statuses",
			statusesDesc: "Limit to these Operon statuses. None selected means all.",
			priorities: "Priorities",
			prioritiesDesc: "Limit to these Operon priorities. None selected means all.",
			checkbox: "Completion",
			checkboxDesc: "Which completion states to include. Open tasks only by default.",
			checkboxOpen: "Open",
			checkboxDone: "Done",
			checkboxCancelled: "Cancelled",
			text: "Text match",
			textDesc: "Only tasks whose description contains this text.",
			sort: "Sort",
			sortDesc:
				"Order of the list and of each board column. Open tasks always come " +
				"before completed ones. The toggle reverses the direction.",
			sortSmart: "Smart (date, priority, age)",
			sortDue: "Date",
			sortPriority: "Priority",
			sortCreated: "Created",
			sortAlpha: "Alphabetical",
			showDue: "Show dates",
			showPriority: "Show priority",
			showStatus: "Show status",
			showRecurrence: "Show recurring marker",
			showTracker: "Show running timer marker",
			showPinned: "Show pinned marker",
			showFile: "Show note name",
			noOptions: "Add an Operon card to the board first to load these options",
		},
		rss: {
			feeds: "Feeds",
			namePlaceholder: "Name (optional)",
			urlPlaceholder: "https://example.com/feed.xml",
			addFeed: "Add feed",
			removeFeed: "Remove feed",
			github: "Add from GitHub",
			githubDesc:
				"Enter a repository as owner/repo (or paste its URL) and pick what to follow — Hearth builds the Atom feed for you.",
			githubPlaceholder: "owner/repo",
			githubReleases: "Releases",
			githubCommits: "Commits",
			githubBoth: "Releases & commits",
			githubAdd: "Add repo",
			githubInvalid: "Enter a repository as owner/repo.",
			githubReleasesName: "{repo} releases",
			githubCommitsName: "{repo} commits",
			mergeAll: "Combined “All” tab",
			mergeAllDesc:
				"Add a leading tab that merges every feed into one stream, newest first.",
			display: "Display",
			layout: "Layout",
			layoutDesc: "How each item is shown.",
			layoutList: "List (title + date)",
			layoutCards: "Cards (excerpt + image)",
			layoutCompact: "Compact (headlines)",
			itemLimit: "Items per feed",
			itemLimitDesc: "How many recent items to show.",
			refresh: "Auto-refresh (minutes)",
			refreshDesc: "How often to refetch feeds. 0 = only when opened.",
			showImages: "Show images",
			showImagesDesc: "Show item thumbnails when the feed provides them.",
			showExcerpt: "Show excerpt",
			showExcerptDesc: "Show a short text snippet under each item.",
			showDate: "Show date",
			showDateDesc: "Show each item's publish time.",
		},
		weather: {
			location: "Location",
			search: "Find a place",
			searchDesc:
				"Search by name — Hearth stores the coordinates on the card, so this " +
				"lookup happens once.",
			searchDisabled:
				"Place search is unavailable while external calls are disabled in Hearth " +
				"settings. You can still enter coordinates below.",
			searchPlaceholder: "Prague, Lisbon, Kyoto…",
			searchButton: "Search",
			searchEmpty: "Type a place name to search for.",
			searchNoResults: "No places matched that name.",
			usePlace: "Use",
			reuse: "Reuse a location",
			reuseDesc: "A place already set on one of your weather cards.",
			reusePick: "Choose a location…",
			unnamedPlace: "(unnamed place)",
			clearPlace: "Clear location",
			coordinates: "Coordinates",
			coordinatesDesc: "Latitude and longitude in decimal degrees, if you'd rather not search.",
			latPlaceholder: "50.08",
			lonPlaceholder: "14.44",
			placeName: "Label",
			placeNameDesc: "What the card calls this place.",
			placeNamePlaceholder: "Home",

			appearance: "Appearance",
			style: "Style",
			styleDesc: "How much of the forecast the card puts on screen.",
			styleMinimal: "Minimal (glyph + temperature)",
			styleCompact: "Compact (one row)",
			styleDetailed: "Detailed (metrics grid)",
			styleForecast: "Forecast (hourly curve)",
			styleArtistic: "Artistic (painted sky)",
			animate: "Animate the sky",
			animateDesc:
				"Drifting clouds, falling rain and twinkling stars. Always off in low power mode.",

			units: "Units",
			tempUnit: "Temperature",
			tempUnitC: "Celsius (°C)",
			tempUnitF: "Fahrenheit (°F)",
			windUnit: "Wind speed",
			windUnitKmh: "Kilometres per hour (km/h)",
			windUnitMs: "Metres per second (m/s)",
			windUnitMph: "Miles per hour (mph)",
			windUnitKn: "Knots (kn)",
			precipUnit: "Precipitation",
			precipUnitMm: "Millimetres (mm)",
			precipUnitInch: "Inches (in)",
			hourFormat: "Time format",
			hourFormatAuto: "Automatic (locale)",
			hourFormat12: "12-hour",
			hourFormat24: "24-hour",

			display: "What to display",
			showLocation: "Place name",
			showCondition: "Condition",
			showFeelsLike: "Feels like",
			showHighLow: "Today's high and low",
			showHumidity: "Humidity",
			showWind: "Wind",
			showPrecip: "Precipitation",
			showPrecipDesc: "Chance of rain and how much has fallen, plus per-hour chances.",
			showUv: "UV index",
			showPressure: "Pressure",
			showSun: "Sunrise and sunset",
			showUpdated: "Last updated",
			hourlyCount: "Hours ahead",
			hourlyCountDesc: "How many hours the hourly strip covers. 0 hides it.",
			dailyCount: "Days ahead",
			dailyCountDesc: "How many days the daily forecast covers. 0 hides it.",
			refresh: "Auto-refresh (minutes)",
			refreshDesc: "How often to refetch the forecast. 0 = only when opened.",
		},
		jira: {
			host: "Jira host",
			hostDesc: "The Jira site origin. HTTPS is required when sending a personal access token.",
			hostPlaceholder: "https://jira.example.com",
			pat: "Personal access token",
			patDesc: "Bearer PAT used for this card. Stored in Hearth's plugin data.",
			apiBase: "API base path",
			apiBaseDesc: "A relative Jira REST path. Full URLs are rejected.",
			apiBasePlaceholder: "/rest/api/latest",
			savedFilter: "Saved filter",
			savedFilterDesc: "Load your favorite Jira filters, then choose one.",
			selectedFilter: (name: string) => `Selected: ${name}`,
			loadFilters: "Load favorite filters",
			chooseFilter: "Choose a filter…",
			noFavoriteFilters: "Jira returned no favorite filters.",
			loadFailed: "Couldn't load Jira filters. Check the host, API path, and token.",
			externalCallsDisabled:
				"Favorite filters can't be loaded while external calls are disabled in Hearth settings.",
			controls: "Filter controls",
			maxResults: "Max results",
			maxResultsDesc: "The most refined issues to show, up to 200.",
			refresh: "Auto-refresh (minutes)",
			refreshDesc: "How often to refresh Jira. 0 = only when opened or refreshed manually.",
			cache: "Cache interval (minutes)",
			cacheDesc: "How long successful Jira responses stay in memory. 0 disables caching.",
		},
		leaf: {
			view: "View to host",
			viewDesc:
				"A registered side-panel view from a core or community plugin " +
				"(calendar, outline, tag pane, kanban…). The list depends on which " +
				"plugins are enabled.",
			pickPlaceholder: "Pick a view…",
			none: "No hostable views found. Enable a plugin that provides a side-panel view.",
			file: "File to show",
			fileDesc:
				"Optional. Open a specific vault file in the hosted view — an " +
				"Excalidraw drawing, a canvas, a note. Leave empty to host the view " +
				"without a file (some views then show a blank or \"new file\" screen).",
			filePlaceholder: "e.g. Drawings/Sketch.excalidraw.md",
			pickFile: "Choose file",
			clearFile: "Clear file",
			hideHeader: "Hide view header",
			hideHeaderDesc:
				"Hide the hosted view's own header — its breadcrumbs, back/forward " +
				"arrows and menu. Handy when the card shows a single file.",
			perfLabel: "Performance",
			perfNote:
				"This is by far the heaviest card Hearth has. It runs another " +
				"plugin's full view live inside the dashboard, so it keeps that " +
				"plugin's own timers, listeners and rendering going for as long as " +
				"the board is open — every one of these cards costs again. Use one " +
				"or two at most, and expect a slower dashboard on modest hardware.",
			perfNoteTier:
				"You have stepped the performance tier down. It cannot slow this " +
				"card down — a hosted view manages itself — so this is the one card " +
				"worth removing if the dashboard still feels heavy.",
			note: "Beta",
			noteDesc:
				"Hosts another plugin's view inside the card. Some views expect a " +
				"sidebar and may render or size oddly here.",
		},
		pet: {
			species: "Animal",
			name: "Name",
			nameDesc: "What to call it. Leave empty to use the animal's name.",
			colors: "Colors",
			colorsDesc:
				"Body and accent. The outline, shading and belly are derived from " +
				"the body color.",
			colorsReset: "Back to this animal's colors",
			size: "Size",
			sizeSmall: "Small",
			sizeMedium: "Medium",
			sizeLarge: "Large",
			metric: "Feed it with",
			metricDesc: "Which vault activity the pet's mood follows.",
			metricModified: "Notes edited",
			metricCreated: "Notes created",
			moods: "Moods",
			moodsDesc:
				"Where each mood starts. Nothing here can make the pet unwell or " +
				"lose it — a quiet vault only sends it to sleep, and any writing " +
				"wakes it straight back up.",
			moodsReset: "Back to the default moods",
			excitedAt: "Bouncing with joy at",
			excitedAtDesc: "Notes touched today, or more.",
			happyAt: "Happy at",
			happyAtDesc: "Notes touched today — your good day.",
			contentAt: "Content at",
			contentAtDesc: "Notes touched today. Below this the pet gets bored.",
			sleepyAfter: "Falls asleep after",
			sleepyAfterDesc:
				"Minutes with nothing touched anywhere in the vault. The pet sleeps " +
				"whatever its mood, however good the day was, and any activity wakes " +
				"it again where the day left it.",
			pettedFor: "A petting lasts",
			pettedForDesc: "Minutes of guaranteed happiness after you click the pet.",
			nightSleep: "At night",
			nightSleepDesc:
				"What the clock is allowed to do. A thin small hour is the hour, not " +
				"neglect — a good day still shows as a good day, and petting wakes " +
				"the pet whatever you set here.",
			nightOff: "Nothing — only the vault matters",
			nightQuiet: "A bored or content pet sleeps instead",
			nightAlways: "Always asleep at night",
			nightWindow: "Night runs from",
			nightWindowDesc: "Your local time. The window may cross midnight.",
			eyesFollow: "Eyes follow the pointer",
			eyesFollowDesc: "A sleeping pet keeps its eyes shut whatever you set here.",
			eyesOff: "Never",
			eyesCard: "On its own card",
			eyesBoard: "Anywhere on the dashboard",
			showName: "Show name",
			showMood: "Show mood",
			showActivity: "Show today's activity",
		},
		colors: {
			heading: "Colors",
			headingDesc: "Accent and background tint for this card.",
			clearAccent: "Clear accent",
			clearBackground: "Clear background",
			cardOpacity: "Card opacity",
			cardOpacityDesc:
				"Transparent card surface (overrides the dashboard default).",
			cardBlur: "Card blur",
			cardBlurDesc:
				"Frosted-glass blur behind this card (overrides the dashboard default). Needs opacity below 100%.",
			cardBorderWidth: "Card border",
			cardBorderWidthDesc:
				"Border thickness for this card (overrides the dashboard default). 0 removes the border and the line under the title.",
			useDashboardDefault: "Use dashboard default",
		},
		size: {
			heading: "Size",
			headingDesc:
				"Width (% of the board) and height (pixels). Or just drag any edge or corner of the card.",
			widthAria: "Width in percent of the board",
			heightAria: "Height in pixels",
		},
		pin: {
			heading: "Pin to all dashboards",
			headingDesc:
				"Show this card on every dashboard, sharing one definition and position.",
		},
		copy: {
			heading: "Copy to dashboard",
			headingDesc:
				"Add a duplicate of this card to the end of another dashboard.",
			copy: "Copy",
			copyTooltip: "Copy this card to the selected dashboard",
		},
	},

	// ---- Card bodies (rendered content) --------------------------------
	cards: {
		empty: {
			searchNoQuery: "Set a query in card settings",
			searchNoMatches: "No matches",
			embedPickFile: "Pick a file to embed in settings",
			slideshowEmpty: "Add pictures in card settings",
			slideshowFolderEmpty: "No images in this folder",
			embedEnableBases: "Enable the core Bases plugin to embed .base files",
			embedEnableCanvas: "Enable the core Canvas plugin to embed canvases",
			embedInstallExcalidraw: "Install the Excalidraw plugin to embed drawings",
			dailyEnable: "Enable the core Daily notes plugin",
			periodicInstall: "Install the Periodic Notes plugin",
			scheduleNoSources:
				"Enable the core Daily notes plugin, or subscribe to a calendar in this card's settings",
			webNoUrl: "Set a web URL in settings",
			bookmarksEnable: "Enable the core Bookmarks plugin",
			bookmarksEmpty: "No bookmarks yet",
			favoritesEmpty: "Add favorites in settings",
			recentEmpty: "No recent files",
			linksEmpty: "Add links in settings",
			commandsEmpty: "Add commands in card settings",
			templaterEnable: "Enable the Templater plugin to create notes from templates",
			templaterEmpty: "Add a template in card settings",
			tasksEnable:
				"Enable the TaskNotes plugin, or switch source to checkboxes",
			tasksEmpty: "No open tasks",
			tasksNoMatch: "No tasks match the filter",
			kanbanNoBoard:
				"No Kanban board found — pick a board note in card settings, or create one with the Kanban plugin",
			dataviewEnable: "Enable the Dataview plugin to run queries",
			dataviewNoQuery: "Set a Dataview query in card settings",
			datacoreEnable: "Enable the Datacore plugin to run queries",
			datacoreNoQuery: "Set a Datacore query in card settings",
			datacoreBadQuery: "Datacore couldn't read this query",
			datacoreOneQuery:
				"A card runs one query — this looks like several. Keep just the one you want, with no comment after it.",
			datacoreFailed: "Datacore couldn't run this card",
			gitEnable: "Enable the Git plugin to manage your vault's repository",
			gitNotReady: "No repository open yet — set one up in the Git plugin",
			rssNoSources: "Add a feed in card settings",
			weatherNoLocation: "Pick a location in card settings",
			renderFailed: "This card couldn't be drawn — see the console for details",
			leafPickView: "Pick a plugin view in card settings",
			boardPickView: "Pick a view for this board in dashboard settings",
			boardNeedsFile: "Pick a file for this board in dashboard settings",
			leafViewMissing:
				"This view isn't available — enable the plugin that provides it",
			operonEnable: "Enable the Operon plugin to show its tasks",
			operonDisabled:
				"The Operon integration is off — turn it on in Settings → Hearth → Integrations",
			operonUnsupported:
				"Operon's developer API is desktop-only and needs Obsidian 1.12.2 or newer",
			operonPending:
				"Approve Hearth in Settings → Operon → Core → General → Developer API Integrations",
			operonSuspended:
				"Operon suspended Hearth's access — review it in Operon's Developer API Integrations",
			operonRevoked:
				"Operon access was revoked — grant it again in Operon's Developer API Integrations",
			operonBooting: "Operon is still starting up",
			operonError: "Operon refused the connection",
			operonNoTasks: "No Operon tasks match",
			operonNoAgenda: "Nothing scheduled in this window",
			operonNoColumns: "No Operon statuses to show — pick a pipeline in card settings",
		},
		operon: {
			loading: "Reading Operon…",
			untitled: "Untitled task",
			settling: "Operon is still settling",
			timerIdle: "No timer running",
			timerStarting: "Starting…",
			timerStopping: "Stopping…",
			timerUnassigned: "Unassigned time",
			truncated: (shown: number, total: number) => `Showing ${shown} of ${total}`,
			readFailed: (reason: string) => `Operon couldn't answer: ${reason}`,
			/** Operon's own words, shown verbatim under an empty state so the
			 * problem is diagnosable instead of guessed at. */
			errorDetail: (code: string, reason: string) => (reason ? `${code} — ${reason}` : code),
			addTask: "Add task",
			moveTo: "Move to",
			targetDaily: "Operon is set to put new inline tasks in today's daily note.",
			targetFile: (path: string) => `Operon is set to put new inline tasks in ${path}.`,
			targetActive: "Operon is set to put new inline tasks in the active file.",
			targetAsk:
				"Operon is set to ask where each new inline task goes, which a dashboard " +
				"card can't answer — choose “Its own note” on this card instead.",
			targetNote: (folder: string) =>
				folder
					? `Operon is set to create new tasks as notes in ${folder}.`
					: "Operon is set to create new tasks as their own notes.",
			addTaskPlaceholder: "What needs doing?",
			addTaskDue: "Due date",
			confirmTitle: "Operon needs a confirmation",
			/** Operon assessed the change and asked for consent; its own summary
			 * of what would happen is shown rather than Hearth's guess at it. */
			confirmMessage: (risk: string, effects: string) =>
				effects
					? `Operon rates this change as ${risk}: ${effects}`
					: `Operon rates this change as ${risk}.`,
			confirmApply: "Apply",
		},
		templater: {
			untitledTile: "New note",
			vaultRoot: "Default location",
			untitledNote: "Untitled",
			createsIn: (destination: string) => `Creates ${destination}`,
			promptTitle: "Name the new note",
			promptPlaceholder: "What is it about?",
		},
		pet: {
			species: {
				cat: "Cat",
				dog: "Dog",
				bird: "Bird",
				fox: "Fox",
				frog: "Frog",
				blob: "Blob",
			},
			moodExcited: "Bouncing with joy",
			moodHappy: "Happy",
			moodContent: "Content",
			moodBored: "A little bored",
			moodSleepy: "Fast asleep",
			moodNight: "Asleep for the night",
			petHint: "Click to pet",
			todayCount: (count: number, metric: "modified" | "created") =>
				metric === "created"
					? `${count} new note${count === 1 ? "" : "s"} today`
					: `${count} note${count === 1 ? "" : "s"} today`,
			streak: (days: number) => `${days}-day streak`,
		},
		embed: {
			openFile: "Open this file",
			editHint: "Double-click to edit",
			emptyNotePlaceholder: "Empty note…",
			emptyNoteHint: "Empty note — double-click to edit",
			/** Switcher button label when a view has no file chosen yet. */
			viewFallback: (n: number) => `View ${n}`,
			switchTo: (label: string) => `Switch to ${label}`,
		},
		slideshow: {
			previous: "Previous picture",
			next: "Next picture",
			pause: "Pause the slideshow",
			play: "Resume the slideshow",
			openImage: "Open this picture",
		},
		text: {
			placeholder: "Jot something down…",
		},
		calculator: {
			placeholder: "2 + 2, 10 km to miles, 10 € to USD…",
		},
		rss: {
			allTab: "All",
			untitled: "(untitled)",
			loading: "Loading feed…",
			empty: "No items in this feed",
			error: "Couldn't load this feed",
			disabled: "Feeds are off (external calls disabled)",
			refresh: "Refresh",
		},
		weather: {
			loading: "Loading forecast…",
			error: "Couldn't load the forecast",
			disabled: "Weather is off (external calls disabled)",
			now: "Now",
			todayLabel: "Today",
			feelsLike: (temp: string) => `Feels like ${temp}`,
			highLow: (high: string, low: string) => `H ${high} · L ${low}`,
			updated: (time: string) => `Updated ${time}`,
			humidity: "Humidity",
			wind: "Wind",
			precip: "Precipitation",
			uv: "UV",
			pressure: "Pressure",
			sunrise: "Sunrise",
			sunset: "Sunset",
			/** Compass points, clockwise from north. Indexed by the bearing's
			 * eighth — keep all eight, in this order. */
			compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
			/** The full-forecast dialog a weather card opens when it is clicked:
			 * every reading the response carries, whatever the card shows. */
			detail: {
				title: "Forecast",
				open: "Open the full forecast",
				now: "Right now",
				days: "The week ahead",
				hoursFor: (day: string) => `Hour by hour · ${day}`,
				selectDay: (day: string) => `Show ${day} hour by hour`,
				noHours: "No hours left in this day",
				refresh: "Refresh",
				source: "Open-Meteo",
				feelsLikeLabel: "Feels like",
				gust: "Gusts",
				cloudCover: "Cloud cover",
				precipChance: "Chance of rain",
				precipHour: "Rain this hour",
				precipTotal: "Total rain",
				windMax: "Strongest wind",
				uvMax: "UV max",
				columnTime: "Time",
				columnCondition: "Condition",
				columnTemp: "Temp",
				columnFeels: "Feels",
				columnPrecip: "Rain",
				columnWind: "Wind",
				columnHumidity: "Humidity",
				columnUv: "UV",
			},
			/** One per WMO weather code group; see `weatherLabelKey`. */
			conditions: {
				clear: "Clear",
				mainlyClear: "Mainly clear",
				partlyCloudy: "Partly cloudy",
				overcast: "Overcast",
				fog: "Fog",
				rimeFog: "Freezing fog",
				drizzle: "Drizzle",
				freezingDrizzle: "Freezing drizzle",
				rain: "Rain",
				heavyRain: "Heavy rain",
				freezingRain: "Freezing rain",
				showers: "Rain showers",
				snow: "Snow",
				heavySnow: "Heavy snow",
				snowGrains: "Snow grains",
				snowShowers: "Snow showers",
				thunderstorm: "Thunderstorm",
				thunderstormHail: "Thunderstorm with hail",
				unknown: "Unknown",
			},
		},
		jira: {
			controls: {
				status: "Status",
				assignee: "Assignee",
				priority: "Priority",
				issueType: "Issue type",
				sprint: "Sprint",
				fixVersion: "Fix version",
			},
			controlCount: (label: string, count: number) => `${label} (${count})`,
			searchPlaceholder: "Search options…",
			searchAria: (label: string) => `Search ${label} options`,
			noOptions: "No options",
			noMatchingOptions: "No matching options",
			refresh: "Refresh Jira issues",
			loading: "Loading Jira issues…",
			error: "Couldn't load Jira issues",
			empty: "No issues match these filters",
			disabled: "Jira is off (external calls disabled)",
			notConfigured: "Configure a Jira host, token, and saved filter in card settings",
		},
		git: {
			sections: {
				status: "Repository status",
				actions: "Buttons",
				changes: "Changed files",
				log: "Recent commits",
			},
			actions: {
				commitAndSync: "Commit and sync",
				commit: "Commit",
				push: "Push",
				pull: "Pull",
				fetch: "Fetch",
				stageAll: "Stage all",
				unstageAll: "Unstage all",
				discardAll: "Discard all changes",
				switchBranch: "Switch branch",
				sourceControl: "Open source control",
				history: "Open history",
			},
			refresh: "Re-read the repository",
			noBranch: "No branch",
			noUpstream: "No upstream branch",
			staged: "staged",
			unstaged: "changed",
			conflicted: "conflicted",
			unpushed: "unpushed commits",
			clean: "Everything is committed",
			noChanges: "Nothing has changed",
			noCommits: "No commits yet",
			noMessage: "(no message)",
			lastCommit: (when: string) => `Last commit ${when}`,
			more: (count: number) => `${count} more…`,
			openSourceControl: "Open source control",
			openHistory: "Open history",
			openDiff: "Open diff",
			stageFile: "Stage",
			unstageFile: "Unstage",
			discardFile: "Discard changes",
			confirmTitle: "Discard changes?",
			confirmDiscard:
				"Every uncommitted change in the vault will be thrown away. This cannot be undone.",
			confirmDiscardFile: (name: string) =>
				`Uncommitted changes to "${name}" will be thrown away. This cannot be undone.`,
			confirmDiscardButton: "Discard",
			unsupported: "This version of the Git plugin doesn't support that",
		},
		daily: {
			createToday: "Create today's note",
			openToday: "Open today's note",
			noNoteYet: "No note for today yet",
		},
		periodic: {
			/** The current period, as it reads inside the sentences below. */
			period: {
				day: "today",
				week: "this week",
				month: "this month",
				quarter: "this quarter",
				year: "this year",
			},
			noNoteYet: (period: string) => `No note for ${period} yet`,
			create: (period: string) => `Create ${period}'s note`,
			open: (period: string) => `Open ${period}'s note`,
			notEnabled: (granularity: string) =>
				`Turn on ${granularity} notes in Periodic Notes`,
		},
		heatmap: {
			less: "Less",
			more: "More",
			unitModified: "notes edited",
			unitCreated: "notes created",
			unitNotes: "notes",
			dayValue: (date: string, value: string, unit: string) => `${date}: ${value} ${unit}`,
		},
		calendar: {
			previousMonth: "Previous month",
			nextMonth: "Next month",
			backToToday: "Back to today",
			dayEdited: (date: string, count: number) => `${date}: ${count} edited`,
			dayTasks: (date: string, count: number) =>
				count === 1 ? `${date}: 1 task` : `${date}: ${count} tasks`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date}: ${count} ${metric}`,
			dayEvents: (date: string, count: number) =>
				`${date}: ${count} ${count === 1 ? "event" : "events"}`,
			agendaNoNote: "No note",
			allDay: "All day",
			untitledEvent: "(No title)",
			openDailyNote: "Open daily note",
			createDailyNote: "Create daily note",
			eventsHeading: "Events",
			eventNotes: "Notes",
			createEventNote: "Create note",
			openEventNote: "Open note",
			taskNotesSource: "TaskNotes",
			taskDue: "Due",
			taskTimeblock: "Timeblock",
			taskComplete: "Complete",
			taskReopen: "Reopen",
			taskEstimate: (minutes: number) =>
				minutes >= 60
					? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
					: `${minutes}m`,
			openTaskNote: "Open task",
		},
		schedule: {
			previous: "Previous",
			next: "Next",
			today: "Today",
			views: {
				month: "Month",
				week: "Week",
				day: "Day",
				list: "List",
			},
			more: (count: number) => `+${count} more`,
			listEmpty: (days: number) => `Nothing in the next ${days} days`,
		},
		stats: {
			notes: "Notes",
			attachments: "Attachments",
			folders: "Folders",
			tags: "Tags",
			dayStreak: "Day streak",
			daysUsing: "Days using Obsidian",
		},
		web: {
			openInBrowser: "Open in browser",
			mayRefuse: "This site may refuse to be embedded.",
		},
		bookmarks: {
			untitled: "Untitled",
		},
		tasks: {
			createNewTask: "Create new task",
			toDo: "To do",
			done: "Done",
			statusInProgress: "In progress",
			noStatus: "No status",
			hideColumn: (label: string) => `Hide "${label}" column`,
			markOccurrence: "Mark today's occurrence complete",
			recurring: "Recurring",
			addCard: "Add card",
			addCardPlaceholder: "Card text…",
			createAsNote: "Create as note",
			noteBody: "Note body",
			convertToNote: "Convert to note",
			editMetadata: "Edit dates & priority",
			deleteCard: "Delete card",
			openNote: "Open note",
			deleteTask: "Delete task",
			deleteTaskConfirm: "Delete this task? This removes it from the note.",
			noMetadata: "No dates or priority set.",
			save: "Save",
			cancel: "Cancel",
			setDoneColumn: (label: string) => `Mark "${label}" as a done column`,
			unsetDoneColumn: (label: string) =>
				`Stop "${label}" auto-completing cards`,
			dueDate: "Due date",
			startDate: "Start date",
			scheduledDate: "Scheduled date",
			doneDate: "Done date",
			recurrenceLabel: "Repeat",
			recurrenceNever: "Never",
			recurrenceEvery: "every",
			recurrenceInterval: "Repeat interval",
			recurrenceUnits: {
				day: "Daily",
				week: "Weekly",
				month: "Monthly",
				year: "Yearly",
			},
			taskCount: (n: number) => (n === 1 ? "1 task" : `${n} tasks`),
			description: "Description",
			descriptionPlaceholder: "Notes… (plain text)",
			tags: "Tags",
			tagsPlaceholder: "#work #home/errands",
			renameColumnHint: "Double-click to rename",
			editTitle: "Edit title",
			editTitleHint: "Double-click to edit",
			titlePlaceholder: "Card title…",
			priority: "Priority",
			priorityNone: "No priority",
			priorityHighest: "Highest priority",
			priorityHigh: "High priority",
			priorityMedium: "Medium priority",
			priorityLow: "Low priority",
			priorityLowest: "Lowest priority",
			sort: "Sort",
			sortReverse: "Reverse order",
			sortLabels: {
				smart: "Smart",
				due: "Due date",
				priority: "Priority",
				created: "Date created",
				alpha: "Alphabetical",
			},
			sortCustom: "Custom",
			sortCustomOption: "Custom sort…",
			sortTitle: "Custom sort",
			sortHint:
				"Sort tasks by these rules in order — the first is the primary sort, each next one breaks ties.",
			sortFields: {
				due: "Due date",
				scheduled: "Scheduled date",
				priority: "Priority",
				created: "Date created",
				alpha: "Alphabetical",
				status: "Status",
			},
			sortAscending: "Ascending",
			sortDescending: "Descending",
			sortLevelFirst: "Sort by",
			sortLevelNext: "then by",
			sortAddRule: "Add rule",
			sortRemoveRule: "Remove rule",
			sortMoveUp: "Move up",
			sortMoveDown: "Move down",
			sortEmpty: "No rules yet — add one, or the default Smart sort is used.",
			filter: "Filter",
			filterTitle: "Filter tasks",
			filterPresets: {
				overdue: "Overdue",
				today: "Today",
				week: "This week",
				highPriority: "High priority",
				noDate: "No date",
			},
			filterDue: "Date",
			filterDueDesc: "Matches a task's due date or its scheduled date.",
			filterDueAny: "Any",
			filterDueHasDate: "Has a date",
			filterPriority: "Priority",
			filterPriorityLevels: {
				high: "High",
				medium: "Medium",
				low: "Low",
				none: "None",
			},
			filterStatus: "Status",
			filterContexts: "Contexts",
			filterProjects: "Projects",
			filterTags: "Tags",
			filterText: "Text contains",
			filterTextPlaceholder: "Search task text…",
			filterApply: "Apply",
			filterClear: "Clear",
			valueChange: "Change value",
			dateTitle: "Set date",
			dateOn: "Date",
			dateToday: "Today",
			dateTomorrow: "Tomorrow",
			dateNextWeek: "Next week",
			dateClear: "Clear date",
			valueCustom: "Other value…",
			valueCustomTitle: "Set value",
			valueClear: "Clear value",
		},
	},

	// ---- Relative dates (tasks card) -----------------------------------
	dates: {
		today: "Today",
		tomorrow: "Tomorrow",
		yesterday: "Yesterday",
		daysAgo: (n: number) => `${n} days ago`,
		nextWeekday: (weekday: string) => `Next ${weekday}`,
		lastWeekday: (weekday: string) => `Last ${weekday}`,
	},

	// ---- Recurrence rule labels (tasks card) ---------------------------
	recurrence: {
		repeats: "Repeats",
		units: {
			day: "day",
			week: "week",
			month: "month",
			year: "year",
		},
		everyOne: (unit: string) => `Repeats every ${unit}`,
		everyMany: (count: number, unit: string) =>
			`Repeats every ${count} ${unit}s`,
	},

	// ---- Clock greetings -----------------------------------------------
	clock: {
		greetingMorning: "Good morning",
		greetingAfternoon: "Good afternoon",
		greetingEvening: "Good evening",
		// One array per time-of-day bucket (see greetingBucket in cards.ts):
		// late night, early morning, morning, afternoon, evening, late evening.
		playfulGreetings: [
			[
				"Late night session?",
				"Burning the midnight oil?",
				"The vault never sleeps, huh?",
				"You should probably be asleep.",
			],
			[
				"Working this early already?",
				"Up with the sun, are we?",
				"Coffee first, surely?",
				"Bold of you to be up.",
			],
			[
				"Morning. Let's pretend we're productive.",
				"The notes missed you.",
				"Back at it.",
				"Another day, another vault.",
			],
			[
				"Afternoon grind.",
				"Still going?",
				"Post-lunch productivity — ambitious.",
				"Halfway there, probably.",
			],
			[
				"You again?",
				"Evening. Wrapping up, or just starting?",
				"One more note, then?",
				"The day's winding down. You aren't.",
			],
			[
				"Late again?",
				"The day's over, the ideas aren't.",
				"Shouldn't you be resting?",
				"Burning the candle at both ends.",
			],
		] as string[][],
	},

	// ---- Card templates (Add card menu) --------------------------------
	templates: {
		note: "Embedded note",
		image: "Embedded image",
		slideshow: "Slideshow",
		base: "Embedded base",
		excalidraw: "Excalidraw drawing",
		canvas: "Embedded canvas",
		daily: "Daily note (today)",
		periodic: "Periodic note",
		web: "Web page (iframe)",
		bookmarks: "Bookmarks",
		favorites: "Favorites",
		recent: "Recent files",
		links: "Links / launchpad",
		commands: "Commands",
		templater: "New note from template",
		clock: "Clock & greeting",
		tasks: "Tasks",
		calendar: "Mini calendar",
		schedule: "Calendar",
		stats: "Vault statistics",
		search: "Query",
		searchbar: "Search bar",
		heatmap: "Activity heatmap",
		text: "Text / jot-down",
		calculator: "Calculator",
		dataview: "Dataview query",
		datacore: "Datacore query",
		rss: "RSS feed",
		jira: "Jira filter",
		weather: "Weather",
		git: "Git",
		"operon-tasks": "Operon tasks",
		"operon-board": "Operon board",
		"operon-agenda": "Operon agenda",
		"operon-timer": "Operon timer",
		leaf: "Plugin view (beta)",
		pet: "Pet",
	},

	/** One line per template, shown under its name in the add-card picker and
	 * searched alongside it. Say what the card *shows* — the name already says
	 * what it is called. */
	templateDescriptions: {
		note: "Any note, rendered live on the board",
		image: "A picture from the vault, edge to edge",
		slideshow: "Pictures from a list or a folder, rotated on a timer",
		base: "A .base file, rendered by Obsidian's Bases",
		excalidraw: "An Excalidraw drawing with native pan and zoom",
		canvas: "A canvas you can pan around in place",
		daily: "Always today's note, created on first click",
		periodic: "This week's, month's or year's note, from Periodic Notes",
		web: "A web page in an iframe, refreshed on a timer",
		bookmarks: "Your Obsidian bookmarks, one click away",
		favorites: "The notes you starred in Hearth",
		recent: "The files you opened most recently",
		links: "A launchpad of links, notes and folders",
		commands: "Buttons that run Obsidian commands",
		templater: "Buttons that make a note from a Templater template, in a folder you pick",
		clock: "The time, the date and a greeting",
		tasks: "Checkboxes from your vault, as a list or a board",
		calendar: "A month at a glance, with your notes on it",
		schedule: "Month, week, day and list, with your events on them",
		stats: "Note, word and file counts for the vault",
		search: "A saved query, kept live",
		searchbar: "A search field on the board, framed or bare",
		heatmap: "A year of vault activity, day by day",
		text: "A scratchpad that lives on the dashboard",
		calculator: "Sums, unit conversion and exchange rates",
		dataview: "A DQL or DataviewJS query, rendered by Dataview",
		datacore: "A Datacore query or script",
		rss: "Headlines from the feeds you follow",
		jira: "Issues from a Jira filter or JQL search",
		weather: "The forecast for a place you pick",
		git: "Repository status, with commit, pull and push",
		"operon-tasks": "Your Operon tasks, filtered the way you like",
		"operon-board": "Operon's pipeline statuses as board columns",
		"operon-agenda": "The next few days of Operon work, day by day",
		"operon-timer": "Operon's running time tracker, ticking live",
		leaf: "Another plugin's side panel, hosted in a card",
		pet: "A small companion that lives on your board",
	},

	// ---- Add-card picker -----------------------------------------------
	cardPicker: {
		title: "Add a card",
		searchPlaceholder: "Search cards…",
		allCards: "All cards",
		noMatches: "No card matches that.",
		/** Badge on a card whose plugin (or other dependency) is missing. */
		requires: (name: string) => `Needs ${name}`,
		missingNotice: (name: string) =>
			`${name} isn't available — the card will show a prompt until it is.`,
		installLink: (name: string) => `Install ${name}`,
		categories: {
			notes: "Notes & files",
			planning: "Planning",
			vault: "Vault insight",
			tools: "Tools",
			integrations: "Integrations",
			fun: "Fun",
		},
		request: {
			railLabel: "Request a card",
			heading: "Request a card",
			intro:
				"Missing something? Describe the card you wish Hearth had — what it " +
				"should show and where its data would come from.",
			footPrompt: "Not what you were looking for?",
			footLink: "Request a card",
			githubTitle: "Open a GitHub issue",
			githubDesc:
				"Public, searchable, and the best place to discuss the idea. Needs a GitHub account.",
			githubAction: "Open GitHub",
			emailTitle: "Send an email",
			emailDesc: "Straight to the maintainer, if you'd rather not use GitHub. Opens your mail app.",
			emailAction: "Open email",
			prefilledNote:
				"Both open pre-filled with a few prompts and your Hearth and Obsidian versions — edit anything before sending.",
		},
	},

	// ---- File-type filter labels ---------------------------------------
	fileTypes: {
		folders: "Folders",
		markdown: "Notes",
		excalidraw: "Excalidraw",
		canvas: "Canvas",
		bases: "Bases",
		images: "Images",
		videos: "Videos",
		audio: "Audio",
		pdf: "PDF",
		documents: "Documents",
		spreadsheets: "Sheets",
		presentations: "Slides",
		threeD: "3D",
		other: "Other",
	},

	// ---- Export / import (portable packages) ---------------------------
	portable: {
		exportModal: {
			title: "Share dashboard",
			saveFile: "Save a file",
			publishRemovesTitle: "Taken out before it leaves this vault",
			/** Points at the disclosure below, which lists the same groups with
			 * the actual values under each — so the two read as one thing rather
			 * than as two lists that might disagree. */
			publishRemovesTune:
				"The details below list these same groups, with the exact values under each, and let you change what goes.",
			/** Named one by one rather than summarised. "Your private
			 * information is removed" is a promise; this is a list somebody can
			 * check, and the details section below lists the actual values. */
			// Worded to match `groups` below one for one, because they are the
			// same four things and somebody reading both should be able to tell.
			publishRemoves: [
				"Note and folder paths — everything the board points at in your vault",
				"Calendar feeds, private hosts and your location",
				"Text you typed on the board — a text card's body, a calculator's last sum",
				"Credentials — a Jira token, and anything else a card can hold",
			],
			publishKeeps:
				"Kept, because they're what the board is: the layout, the styling, the colours, the pictures, the card settings, searches and queries, and any public page or feed it shows. Open the details below to see the exact values, and to change what goes.",
			intro:
				"Saves this one dashboard as a file. Everything about how it looks travels with it, so it draws the same in another vault.",
			name: "Name",
			nameDesc: "What this dashboard is called in the file. Defaults to the board's own name.",
			description: "Description",
			descriptionDesc: "Optional. A line or two about what this dashboard is for.",
			snapshot: "Picture of this board",
			snapshotDesc:
				"A screenshot of the board as it looks now — scrolled through, so a long board is captured whole. What's inside your cards is blanked out first; the header, the toolbar and each card's own title stay, and so does a card with nothing of yours in it, like a clock.",
			/** Shown once there is a picture. The one thing being asked of the
			 * author, said as the thing it is: look at it. */
			snapshotCheck:
				"Look at it before you publish. Anything you can read in it, everyone can — click it to see it full size.",
			snapshotTake: "Take the picture",
			snapshotRetake: "Take it again",
			snapshotWorking: "Taking the picture…",
			snapshotEnlarge: "Open the picture full size",
			snapshotTaken: (kb: number) =>
				`${kb} KB — this is exactly what gets published, and what everyone browsing the gallery sees.`,
			/** The gate in front of publishing. Named as a question about this
			 * picture, because that is what it is: the redaction is a rule, and
			 * the author is the only one who can tell whether it read this board
			 * right. */
			snapshotConfirm: "I've looked — nothing private is readable in it",
			snapshotConfirmDesc:
				"Click the picture to see it full size and read it. Card titles, the header and anything a card shows that isn't yours are meant to be there; a note's text, a task, a file name, an event, a number from your life is not. Publishing waits until you've said.",
			snapshotConfirmRequired:
				"Have a look at the picture first, then switch on “I've looked”.",
			/** What to do when the answer is no. Said in the same shape as the
			 * "this board becomes public" warning above, a little more firmly:
			 * not "publish anyway", because a picture that got past the blanking
			 * is a bug, and the next person it happens to won't be looking. */
			snapshotLeak:
				"If something of yours is readable in it, don't publish this board: the picture can't be taken back once people have installed it. Please tell us instead — that's a bug in the blanking, and it's worth fixing before it happens to somebody else.",
			snapshotLeakReport: "Report it on GitHub",
			snapshotFailed: "Hearth couldn't take a picture of the board.",
			snapshotRequired:
				"A gallery entry needs a picture of the board. Take one first — you can look at it before it goes.",
			snapshotUnavailable:
				"Publishing needs a picture of the board, and this build can't take one — screenshots need the desktop app. You can still save the dashboard as a file and publish it from a desktop vault.",
			snapshotNotActive:
				"Publishing needs a picture of the board, and Hearth can only photograph the board that's open. Switch to this dashboard first, then publish it.",
			theme: "Recommended with my theme",
			themeDesc: (name: string) =>
				`Say the board is meant to be seen under ${name}, the theme you're using. It's a note for whoever installs it — nothing is installed or changed on their side.`,
			themeNone:
				"You're on Obsidian's default look, so there's no theme to recommend. Switch to a community theme first if the board is built for one.",
			tags: "Tags",
			tagsDesc: "Optional, comma separated. Useful if the dashboard is going somewhere it can be browsed.",
			tagsPlaceholder: "writing, minimal, dark",

			// ---- Identity ----
			identity: "Published as",
			identityDesc:
				"Made for you from a key that stays in this vault. It's the same handle on everything " +
				"you publish, it says nothing about who you are, and because each file is signed with " +
				"that key, nobody else can publish under it. Copy the key to carry the handle to " +
				"another install.",
			identityNew:
				"You don't have one yet. It's an anonymous handle made from a key that never leaves " +
				"this vault — no account, no email, nothing about who you are.",
			identityCreate: "Create my handle",
			identityCreated: (handle: string) =>
				`You publish as ${handle}. Copy your recovery key and keep it somewhere safe — it's the only way to get this handle back.`,
			identityCopy: "Copy my recovery key",
			identityUnsaved:
				"Save your recovery key somewhere safe before you need it. It's held nowhere but this " +
				"vault, so if you lose it there's no reset and nobody to ask — the handle, and everything " +
				"you published under it, would be gone.",
			identityCopied:
				"Recovery key copied. Keep it somewhere safe — it's the only way to get this handle back.",
			identityCopyFailed: (key: string) => `Your recovery key: ${key}`,
			identityRestore: "Use a key from another install",
			identityReplaceTitle: "Replace your handle?",
			identityReplaceWarning:
				"You haven't copied your current recovery key yet, and pasting another one over it can't be undone — this vault holds the only copy. Anything you've already published under the current handle would stay published, but you could never post as it again. Copy the key first if you might want it back.",
			identityReplaceConfirm: "Replace it",
			identityRestoreLabel: "Recovery key",
			identityRestored: (name: string) => `You're now publishing as ${name}.`,
			identityRestoreFailed: "That isn't a Hearth recovery key.",

			// ---- What travels ----
			contents: "What to include",
			embedAssets: "Include the wallpaper and images",
			embedAssetsDesc:
				"Carries the board's background picture, any image icons and any explicit slideshow pictures inside the file, so it looks right in a vault that has never seen them. Makes the file bigger. Turn it off for a backup of your own vault, where the pictures are already in place.",
			referenceNote: (paths: number, feeds: number) => {
				const parts: string[] = [];
				if (paths > 0) {
					parts.push(paths === 1 ? "1 path from this vault" : `${paths} paths from this vault`);
				}
				if (feeds > 0) {
					parts.push(feeds === 1 ? "1 calendar feed URL" : `${feeds} calendar feed URLs`);
				}
				return `As it stands, this file will mention ${parts.join(" and ")}. That's what makes it work as your own backup — and what the switch above takes out for a board you're publishing.`;
			},
			stripPrivate: "Leave out my private information",
			stripPrivateDesc:
				"Removes the parts of this board that are about you rather than about the design: the note and folder paths it points at, calendar feed links, your location, and anything you typed on a text card. The board still looks exactly the same — the cards just arrive pointing at nothing, which whoever downloads it has to fill in anyway. Leave it off for a copy of your own board, which needs its paths to keep working.",

			// ---- The details disclosure ----
			detailsSummary: "See and tune exactly what travels",
			flatten: "Copy this vault's appearance settings onto the dashboard",
			flattenDesc:
				"Most of what a board looks like — the grid, spacing, card surfaces, background, header — is a vault-wide setting, and the board only stores what it overrides. This writes the resolved values onto the dashboard itself, so it looks the same in someone else's vault instead of picking up theirs. Turn it off and the board carries only its own overrides and adapts to wherever it lands.",
			/** Said on each pinned row, where the switch cannot be moved. */
			groupPinned: "Always removed when publishing.",
			stripIntro:
				"Each group below comes out of the file. What it will remove is listed under it — that is the actual list, read from this board.",
			carriedIntro:
				"Nothing is being left out, so this is everything in the file that points outside it. Turn on “Leave out my private information” above to remove the first three groups.",
			carriedNothing: "This board points at nothing outside itself.",
			// The same four names the publish summary above uses, plus the two
			// it doesn't remove. A reader comparing the two lists should be able
			// to line them up without wondering whether they mean the same thing.
			// Named as the *action*, not as the subject. "Note and folder paths"
			// beside a switch that is on reads just as easily as "include note
			// and folder paths", which is the opposite of what it does — and
			// nobody should have to infer the direction of a privacy control
			// from a heading two rows above it.
			groups: {
				paths: "Remove note and folder paths",
				private: "Remove calendar feeds, private hosts and your location",
				content: "Remove text you typed on the board",
				queries: "Remove searches and Dataview queries",
				plugins: "Remove command ids and view types",
			},
			groupDesc: {
				paths: "Everything this board points at in your vault, and the folder each embedded picture came from. The pictures themselves still travel when the wallpaper switch above is on — it's the folder they lived in that goes.",
				private: "ICS calendar links (anyone holding one can read that calendar), an internal Jira host, and the place a weather card is set to.",
				content: "A text card's body and a calculator's last input — whatever you happened to jot on your own dashboard.",
				queries: "Off by default: a board without its queries stops doing anything. Worth turning on if a query names a private folder.",
				plugins: "Off by default: these name plugins, not you. Removing them leaves the buttons that ran them doing nothing.",
			},
			groupEmpty: "Nothing on this board.",
			stripTotal: (n: number) =>
				n === 0
					? "Nothing would be removed from this board."
					: n === 1
						? "1 value will be removed."
						: `${n} values will be removed.`,
			stripResidual: (n: number) =>
				`Exported, but ${n} value${n === 1 ? "" : "s"} still look like vault paths. Worth opening the file before you share it.`,

			signFailed:
				"Exported, but it couldn't be signed, so it will import without an author. Your recovery key may be damaged — try pasting it in again.",
			exportButton: "Export",
			assetsSkipped: (paths: string) =>
				`Exported, but these pictures were left out (too large, or no longer in the vault): ${paths}`,
		},
		importModal: {
			title: "Import",
			kinds: {
				dashboard: "One dashboard",
				layout: "A dashboard layout",
				settings: "A full settings backup",
			},
			by: (author: string) => `by ${author}`,
			signatureInvalid:
				"This file claims an author, but its signature doesn't check out — it was either edited " +
				"after it was signed, or somebody put another maker's handle on it. It's shown without " +
				"an author. Everything else about the import is unaffected.",
			madeWith: (version: string) => `Hearth ${version}`,
			cardCount: (n: number) => (n === 1 ? "1 kind of card" : `${n} kinds of card`),
			assetCount: (n: number) =>
				n === 1 ? "Brings 1 picture with it" : `Brings ${n} pictures with it`,
			pathCount: (n: number) =>
				n === 1 ? "Points at 1 path in a vault" : `Points at ${n} paths in a vault`,
			needsPlugins: (plugins: string) => `Wants these plugins: ${plugins}`,
			mode: "How to import it",
			modeDesc: "Adding leaves every one of your own settings alone.",
			modeAdd: "Add as a new dashboard",
			modeAddBoards: "Add its dashboards to mine",
			modeReplaceBoard: (name: string) => `Update “${name}” in place`,
			modeReplaceAll: "Replace all my settings",
			replaceAllWarning:
				"This replaces your dashboards and every Hearth setting with the ones in this file. It can't be undone.",
			heads: "Worth knowing",
			missingPlugins: (plugins: string) =>
				`Not installed or not enabled here: ${plugins}. Those cards will be empty until they are.`,
			missingPaths: (n: number, sample: string) =>
				`${n} note${n === 1 ? "" : "s"} or folder${n === 1 ? "" : "s"} this board points at aren't in your vault (${sample}${n > 3 ? ", …" : ""}).`,
			remoteContent: (n: number) =>
				n === 1
					? "It loads 1 thing from the internet when you open it."
					: `It loads ${n} things from the internet when you open it.`,
			missingFine:
				"None of this stops the import — the cards come through and you can point them at your own notes.",
			importButton: "Import",
			addedOne: (name: string) => `Added “${name}”.`,
			addedMany: (n: number) => `Added ${n} dashboards.`,
			replacedOne: (name: string) => `Updated “${name}”.`,
			restored: "Settings restored.",
			assetsWritten: (n: number) =>
				n === 1 ? "1 picture saved to your vault." : `${n} pictures saved to your vault.`,
			warnMissingPaths: (n: number) =>
				`${n} referenced path${n === 1 ? "" : "s"} not found here.`,
			warnMissingPlugins: (n: number) =>
				`${n} plugin${n === 1 ? " it wants isn't" : "s it wants aren't"} enabled.`,
			warnTaskFields:
				"Its task cards use custom fields — turn on task field customization in Settings → Integrations to see them.",
			warnUnknownCards: "Some cards need a newer Hearth and were left out.",
			warnAssets: "Some of its pictures were missing from the file.",
		},
	},

	// ---- Dashboard gallery ---------------------------------------------
	gallery: {
		/** The closed list in `src/gallery/categories.ts`. Ids are stored, so a
		 * name may be reworded freely but an id may never be. */
		categories: {
			productivity: "Getting things done",
			planning: "Planning & calendar",
			study: "Study & research",
			writing: "Writing & journaling",
			work: "Work & projects",
			personal: "Personal & home",
			minimal: "Minimal",
			dense: "Information-dense",
			other: "Everything else",
		},
		sorts: {
			trending: "Trending",
			top: "Top rated",
			new: "Newest",
			downloads: "Most installed",
		},
		browse: {
			title: "Dashboard gallery",
			openLabel: "Gallery",
			openAria: "Browse the dashboard gallery",
			searchPlaceholder: "Search dashboards…",
			all: "All dashboards",
			mine: "Published by me",
			sortLabel: "Sort by",
			refresh: "Refresh",
			publish: "Publish a dashboard",
			loading: "Loading…",
			empty: "Nothing here yet.",
			emptySearch: (query: string) => `Nothing matches “${query}”.`,
			emptyMine:
				"You haven't published anything yet. Publish a board and it shows up here.",
			results: (shown: number, total: number) =>
				total > shown ? `${shown} of ${total}` : `${shown} dashboard${shown === 1 ? "" : "s"}`,
			more: "Show more",
			byAuthor: (handle: string) => `by ${handle}`,
			anonymous: "unattributed",
			downloads: (n: number) => `${n} install${n === 1 ? "" : "s"}`,
			score: (n: number) => `${n > 0 ? "+" : ""}${n}`,
			cardCount: (n: number) => `${n} card${n === 1 ? "" : "s"}`,
			pluginBoard: "Hosts a plugin view",
			noPicture: "No picture",
			needsIdentity:
				"You can browse and install without one, but voting and publishing need a handle. Hearth makes you an anonymous one from a key that never leaves this vault.",
			needsIdentityVote:
				"Voting needs a handle. Hearth will make you an anonymous one from a key that never leaves this vault — no account, and nothing about who you are. Make one now?",
		},
		detail: {
			install: "Install",
			installing: "Downloading…",
			installAria: (name: string) => `Install ${name}`,
			enlarge: "Open the picture full size",
			profile: (handle: string) => `See everything by ${handle}`,
			upvoteAria: "Upvote",
			downvoteAria: "Downvote",
			published: (when: string) => `Published ${when}`,
			updated: (when: string) => `Updated ${when}`,
			version: (v: string) => `Author's version ${v}`,
			theme: (name: string) => `Recommended with the ${name} theme`,
			madeWith: (v: string) => `Made with Hearth ${v}`,
			contents: "What's on this board",
			requires: "What it needs",
			requiresPlugins: "Plugins",
			requiresViews: "Hosted views",
			requiresSettings: "Settings",
			nothingRequired: "Nothing beyond Hearth itself.",
			size: (kb: number) => `${kb} KB`,
			remote: (n: number) =>
				n === 1
					? "One thing on this board is loaded from the internet."
					: `${n} things on this board are loaded from the internet.`,
			noRemote: "Nothing on this board is loaded from the internet.",
			unverified:
				"This board arrived without a checkable signature, so who made it can't be established.",
			tags: "Tags",
		},
		profile: {
			title: (handle: string) => handle,
			subtitle:
				"An anonymous handle, derived from a signing key. It says nothing about who somebody is — only that the same hand made all of this.",
			karma: "Karma",
			karmaHint: "Every upvote across everything they've published, minus every downvote.",
			totalDownloads: "Installs",
			published: (n: number) => `${n} dashboard${n === 1 ? "" : "s"}`,
			firstSeen: (when: string) => `First published ${when}`,
			empty: "Nothing published under this handle.",
		},
		comments: {
			heading: (n: number) => (n === 1 ? "1 comment" : `${n} comments`),
			headingEmpty: "Comments",
			none: "Nothing yet. Say the first thing.",
			placeholder: "Ask something, or say how it worked for you…",
			post: "Post",
			remove: "Remove this comment",
		},
		publish: {
			title: "Publish to the gallery",
			intro:
				"Puts this dashboard in the gallery, where anyone using this Hearth gallery can find and install it.",
			category: "Category",
			categoryDesc: "What this board is for. It's how people find it.",
			button: "Publish",
			publishing: "Publishing…",
			/** Said before the upload, not after: a published board is copied by
			 * strangers, and neither an unpublish nor an edit reaches the copies. */
			warning:
				"This board becomes public: anyone using this gallery can find and install it. You can withdraw it at any time, though people who already installed it keep their copy.",
			needsName: "Give the dashboard a name before publishing it.",
			residual: (n: number) =>
				`Held back: ${n} value${n === 1 ? "" : "s"} still look like paths from your vault after the strip. Check the details section before publishing.`,
			done: (name: string) => `Published “${name}” to the gallery.`,
			/** The gallery took it but is holding it back — its own check saw
			 * something that still looks like a path from your vault. */
			doneHeld: (name: string) =>
				`The gallery took “${name}” but is holding it for review — something in it still looks like a path from your vault. It won't be listed until somebody there has looked.`,
			doneUpdate: (name: string) => `Updated “${name}” in the gallery.`,
			/** Beside the remove button on your own entry: publish the board
			 * again, over this listing rather than beside it. */
			update: "Update",
			/** While it is reading the entry to work out which board it is. */
			updateChecking: "Checking…",
			updateDesc: "Publish this board again, over this listing.",
			updateMissing:
				"This vault hasn't got the board this was published from — it was deleted, or it lives in another vault. Publishing from here would make a second listing, so there's nothing to update.",
			/** Nothing has said which board this is yet — an entry published
			 * before Hearth kept the note, or to a gallery too old to be asked.
			 * The button still works: pressing it reads the entry to find out. */
			updateUnknown:
				"Hearth doesn't know yet which of your boards this entry is. Press Update and it will read the entry to find out.",
			unpublish: "Remove from the gallery",
			unpublishConfirm: (name: string) =>
				`Remove “${name}” from the gallery? People who already installed it keep their copy; nobody new can find it.`,
			unpublished: "Removed from the gallery.",
		},
		settings: {
			heading: "Dashboard gallery",
			host: "Gallery address",
			hostDesc:
				"The gallery Hearth browses and publishes to. Nothing is fetched until you open it and nothing is sent until you publish. Clear this field to turn the gallery off entirely — it stays off. https only (or http on localhost, for a gallery you run yourself).",
			hostPlaceholder: "https://gallery.example.com",
			hostInvalid: "That isn't an address Hearth will talk to. Use https, or http on localhost.",
			hostCleared: "Gallery turned off.",
			hostSet: (host: string) => `Gallery set to ${host}.`,
			browse: "Browse the gallery",
			browseDesc: "Dashboards other people have published, and the ones you've published yourself.",
			browseButton: "Open gallery",
		},
		errors: {
			noHost:
				"No gallery is set up. Put a gallery address in Hearth's settings, under Dashboard gallery.",
			externalCallsOff:
				"The gallery is a server on the internet, and this vault has \u201cDisable external calls\u201d turned on. Turn that off to browse or publish.",
			offline: "Couldn't reach the gallery. It may be down, or this device may be offline.",
			badResponse: "That address answered, but not like a Hearth gallery.",
			unauthorized: "The gallery didn't accept this vault's identity.",
			forbidden: "The gallery wouldn't let this vault's identity do that.",
			rateLimited: "The gallery is asking you to slow down. Try again in a few minutes.",
			tooLarge: "That dashboard is too large for this gallery. Turn off the wallpaper, or shrink it.",
			rejected: (why: string) => `The gallery refused it: ${why}`,
			notFound: "The gallery doesn't have that.",
			server: "The gallery had a problem with that request.",
			unsigned:
				"Hearth couldn't sign the file, so it wasn't published — an unsigned board has no provable author.",
		},
	},

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "That isn't valid JSON.",
		notAnObject: "Layout must be a JSON object.",
		noValidDashboards: "Layout contained no valid dashboards.",
		noValidCards: "Layout contained no valid cards.",
		notAHearthLayout:
			'Not a Hearth layout — no "dashboards" or "cards" array found.',
		notHearthSettings:
			'Not a Hearth settings backup — no "hearthSettings" marker or layout found.',
	},
};
