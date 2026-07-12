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
		switchDashboard: (n: number) => `Switch to dashboard ${n}`,
		nextDashboard: "Next dashboard",
		previousDashboard: "Previous dashboard",
	},
	ribbon: {
		openHome: "Open Hearth home",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth: could not create a new note.",
		enableExcalidraw:
			"Hearth: enable the Excalidraw plugin to create drawings.",
		excalidrawCommandMissing:
			"Hearth: couldn't find Excalidraw's \"new drawing\" command.",
		enableAudioRecorder: "Hearth: enable the core Audio recorder plugin.",
		couldNotRecordVoice: "Hearth: couldn't start voice recording.",
		enableDailyNotes: "Hearth: enable the core Daily notes plugin.",
		couldNotOpenDaily: "Hearth: couldn't open today's daily note.",
		commandNotFound: (id: string) => `Hearth: command not found: ${id}`,
		couldNotCreateNoteForDay: (day: string) =>
			`Hearth: couldn't create a note for ${day}.`,
		taskNotesCreateFailed: "Hearth: couldn't run TaskNotes: Create new task.",
		taskChangedOnDisk: "Hearth: that task changed on disk — refreshed.",
		couldNotUpdateTaskStatus: "Hearth: couldn't update the task status.",
		couldNotCompleteRecurring:
			"Hearth: couldn't mark the recurring task instance complete.",
		couldNotUndoRecurring:
			"Hearth: couldn't undo the recurring task completion.",
		couldNotAddKanbanCard: "Hearth: couldn't add the card to the Kanban board.",
		couldNotConvertCard: "Hearth: couldn't convert the card into a note.",
		layoutExported: "Hearth: layout exported.",
		layoutImported: "Hearth: layout imported.",
		layoutImportError: (error: string) => `Hearth: ${error}`,
		settingsExported: "Hearth: settings exported.",
		settingsImported: "Hearth: settings imported.",
		exportedToVault: (file: string) => `Hearth: saved ${file} to your vault's root folder.`,
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
	},

	// ---- "What's new" release-notes dialog -----------------------------
	whatsNew: {
		title: "What's new in Hearth",
		intro: "Thanks for updating! Here's what's changed since you last checked.",
		close: "Got it",
		footer: "Full details live in the plugin's README.",
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "Pick a file to embed…",
		command: "Pick a command…",
		noteToFavorite: "Pick a note to favorite…",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "Add card",
		addCardAria: "Add a card to the dashboard",
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
			delete: "Delete",
		},
		deleteTitle: "Delete dashboard?",
		deleteMessage: (name: string, count: number) =>
			`Delete "${name}" and its ${count} card(s)? This can't be undone.`,
		deleteConfirm: "Delete",
		modal: {
			title: "Dashboard settings",
			name: "Name",
			switcherIcon: "Switcher icon",
			switcherIconDesc:
				"An emoji or short text shown on the switcher button. Empty = number.",
			switcherLucide: "Switcher Lucide icon",
			switcherLucideDesc:
				"A Lucide icon id (e.g. “home”, “star”, “layout-dashboard”). Takes precedence over the emoji above.",
			lucidePlaceholder: "home",
			showSearch: "Show search section",
			showSearchDesc: "Show the search and command bar with its results and filter buttons on this dashboard.",
			contentWidth: "Content width",
			fitToPage: "Fit to page",
			fitToPageDesc: "Override scrolling for this board.",
			fitDefault: (state: string) => `Use global default (${state})`,
			fitStateFit: "fit",
			fitStateScroll: "scroll",
			fitOptionFit: "Fit to one page",
			fitOptionScroll: "Allow scrolling",
			cardOpacity: "Card opacity",
			cardBlur: "Card blur",
			done: "Done",
			overriding: "Overriding the global default.",
			usingGlobal: (value: number | string) =>
				`Using global default (${value}).`,
			background: "Background",
			backgroundDesc: "Override the global background for this dashboard.",
			backgroundValue: "Background value",
			opacity: "Opacity",
			blur: "Blur",
		},
		backgroundOptions: {
			default: "Use global default",
			none: "None",
			hdefault: "Hearth default",
			color: "Solid color",
			image: "Vault image",
			url: "Image URL",
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
		collapseSection: "Collapse section",
		expandSection: "Expand section",
		/** Category ribbon at the top of the settings tab. */
		tabs: {
			appearance: "Appearance",
			search: "Search",
			dashboard: "Dashboard",
			behaviour: "Behaviour",
			integrations: "Integrations",
			backup: "Backup",
			about: "About",
		},
		/** Sub-section headings used to group settings within a tab. */
		sections: {
			home: "Home",
			homeDesc: "Title, logo and overall content width.",
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
			mobileMode: "Mobile mode",
			mobileModeDesc: "How Hearth behaves on phones and tablets.",
			privacy: "Privacy & network",
			privacyDesc: "Control the outbound requests Hearth is allowed to make.",
		},
		about: {
			heading: "About Hearth",
			headingDesc: "Project links, support and version.",
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
			kofiButton: "Tip me on Ko-fi",
			version: (v: string) => `Version ${v}`,
			versionDesc: "The Hearth build you're running.",
		},
		appearance: {
			heading: "Appearance",
			headingDesc: "Title, logo, search bar and overall content width.",
			showTitle: "Show title",
			showTitleDesc: "Display the big title/logo at the top.",
			title: "Title",
			titleDesc: "The heading text shown at the top of the home view.",
			logo: "Logo",
			logoDesc:
				"An emoji or short text shown next to the title. Leave empty for the Hearth crystal icon.",
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
			contentWidth: "Content width",
			contentWidthDesc: "Maximum width of the home content, in pixels.",
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
			opacity: "Opacity",
			opacityDesc:
				"How much the background shows through. Lower is more subtle.",
			blur: "Blur",
			blurDesc: "Background blur in pixels.",
			labels: {
				default: "Hearth default",
				none: "None",
				color: "Solid color",
				image: "Vault image",
				url: "Image URL",
			},
		},
		behaviour: {
			heading: "Behaviour",
			headingDesc:
				"When and where Hearth opens, and the phone/tablet search-only mode.",
			openOnStartup: "Open on startup",
			openOnStartupDesc: "Open the home view when the vault loads.",
			replaceNewTabs: "Replace new tabs",
			replaceNewTabsDesc: "Show the home view instead of an empty new tab.",
			mobileSearchOnly: "Mobile mode (search only)",
			mobileSearchOnlyDesc:
				"On phones and tablets, hide the dashboard and show only the search " +
				"field. No effect on desktop.",
			disableExternalCalls: "Disable external calls",
			disableExternalCallsDesc:
				"Block all outbound network requests Hearth makes. The only such " +
				"request is the calculator's currency-rate lookup (the free, key-less " +
				"Frankfurter API). With this on, currency conversions report that rates " +
				"are unavailable instead of reaching out to the internet.",
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
			cards: "Cards",
			cardsDesc:
				"Add and configure cards on the dashboard itself: open the home view, " +
				"hit Arrange, then use Add card and each card's settings button.",
		},
		layout: {
			heading: "Import / export",
			headingDesc:
				"Back up or share your dashboard layout (cards, grid, favorites) — or every " +
				"Hearth setting — as a JSON file.",
			export: "Export layout",
			exportDesc: "Download the current dashboard layout as a JSON file.",
			exportButton: "Export file",
			exportMobileTooltip: "On mobile the file is saved to your vault's root folder.",
			import: "Import layout",
			importDesc:
				"Choose a previously exported layout file. This replaces your current dashboards.",
			importButton: "Import file",
			importTitle: "Import layout?",
			importMessage:
				"This replaces your current dashboards, pinned cards and layout settings. This can't be undone.",
			exportSettings: "Export settings",
			exportSettingsDesc:
				"Download every Hearth setting — the full layout plus header, background, " +
				"behaviour, appearance and TaskNotes options — as a JSON backup file.",
			importSettings: "Import settings",
			importSettingsDesc:
				"Choose a previously exported settings file. This replaces all your Hearth settings.",
			importSettingsTitle: "Import settings?",
			importSettingsMessage:
				"This replaces all your Hearth settings — dashboards, layout, header, " +
				"background, behaviour and appearance. This can't be undone.",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		title: "Card settings",
		type: "Type",
		typeDesc: "What this card shows.",
		cardTitle: "Title",
		cardTitleDesc:
			"Shown in the card's header. Leave empty for a headerless card.",
		cardTitlePlaceholder: "Title",
		resetSize: "Reset to default size",
		removeCard: "Remove card",
		removeCardTitle: "Remove card?",
		removeCardMessage: (name: string) => `Remove "${name}" from the dashboard?`,
		removeCardConfirm: "Remove",
		thisCard: "this card",
		done: "Done",
		kinds: {
			embed: "Embed (note / image / base)",
			daily: "Daily note (today)",
			web: "Web page (iframe)",
			bookmarks: "Bookmarks",
			favorites: "Favorites",
			text: "Text / jot-down",
			recent: "Recent files",
			links: "Links / launchpad",
			commands: "Commands",
			clock: "Clock & greeting",
			tasks: "Tasks",
			calendar: "Mini calendar",
			stats: "Vault statistics",
			search: "Query",
			heatmap: "Activity heatmap",
			calculator: "Calculator",
			dataview: "Dataview query",
			leaf: "Plugin view (beta)",
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
			editable: "Editable",
			editableDesc:
				"Edit the embedded note's text in place (Markdown notes only).",
			hideBaseHeader: "Hide base header",
			hideBaseHeaderDesc:
				"For embedded .base files, hide the Bases view's own toolbar (view switcher and filter/property controls) so only the results show.",
			secondViewHeading: "Second view",
			secondViewFile: "Second file to embed",
			secondViewFileDesc:
				"Optional. When set, the card shows a switcher between the two views — in the header when the card has a title, or floating (on hover) when it doesn't.",
			secondViewClear: "Remove second view",
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
			count: "Number of files",
			countDesc: "How many recently-opened files to list.",
		},
		calendar: {
			weekNumbers: "Week numbers",
			weekNumbersDesc: "Show an ISO week-number column down the left edge.",
			heatmap: "Heatmap",
			heatmapDesc: "Tint each day by note activity that day.",
			heatmapCounts: "Heatmap counts",
		},
		heatmap: {
			metric: "Metric",
			weeks: "Weeks",
			weeksDesc: "How many weeks of history to show.",
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
			moveUp: "Move up",
			moveDown: "Move down",
			remove: "Remove",
			addFavorite: "Add favorite",
		},
		clock: {
			style: "Style",
			styleDigital: "Digital",
			styleAnalog: "Analog",
			hour24: "24-hour time",
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
		leaf: {
			view: "View to host",
			viewDesc:
				"A registered side-panel view from a core or community plugin " +
				"(calendar, outline, tag pane, kanban…). The list depends on which " +
				"plugins are enabled.",
			pickPlaceholder: "Pick a view…",
			none: "No hostable views found. Enable a plugin that provides a side-panel view.",
			note: "Beta",
			noteDesc:
				"Hosts another plugin's view inside the card. Some views expect a " +
				"sidebar and may render or size oddly here.",
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
			embedEnableBases: "Enable the core Bases plugin to embed .base files",
			embedEnableCanvas: "Enable the core Canvas plugin to embed canvases",
			embedInstallExcalidraw: "Install the Excalidraw plugin to embed drawings",
			dailyEnable: "Enable the core Daily notes plugin",
			webNoUrl: "Set a web URL in settings",
			bookmarksEnable: "Enable the core Bookmarks plugin",
			bookmarksEmpty: "No bookmarks yet",
			favoritesEmpty: "Add favorites in settings",
			recentEmpty: "No recent files",
			linksEmpty: "Add links in settings",
			commandsEmpty: "Add commands in card settings",
			tasksEnable:
				"Enable the TaskNotes plugin, or switch source to checkboxes",
			tasksEmpty: "No open tasks",
			tasksNoMatch: "No tasks match the filter",
			kanbanNoBoard:
				"No Kanban board found — pick a board note in card settings, or create one with the Kanban plugin",
			dataviewEnable: "Enable the Dataview plugin to run queries",
			dataviewNoQuery: "Set a Dataview query in card settings",
			leafPickView: "Pick a plugin view in card settings",
			leafViewMissing:
				"This view isn't available — enable the plugin that provides it",
		},
		embed: {
			editHint: "Double-click to edit",
			emptyNotePlaceholder: "Empty note…",
			emptyNoteHint: "Empty note — double-click to edit",
			/** Switcher button label when a view has no file chosen yet. */
			viewFallback: (n: number) => `View ${n}`,
			switchTo: (label: string) => `Switch to ${label}`,
		},
		text: {
			placeholder: "Jot something down…",
		},
		calculator: {
			placeholder: "2 + 2, 10 km to miles, 10 € to USD…",
		},
		daily: {
			createToday: "Create today's note",
			openToday: "Open today's note",
			noNoteYet: "No note for today yet",
		},
		heatmap: {
			less: "Less",
			more: "More",
		},
		calendar: {
			previousMonth: "Previous month",
			nextMonth: "Next month",
			backToToday: "Back to today",
			dayEdited: (date: string, count: number) => `${date}: ${count} edited`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date}: ${count} ${metric}`,
		},
		stats: {
			notes: "Notes",
			attachments: "Attachments",
			folders: "Folders",
			tags: "Tags",
			dayStreak: "Day streak",
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
			renameColumnHint: "Double-click to rename",
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
				today: "Due today",
				week: "Due this week",
				highPriority: "High priority",
				noDate: "No date",
			},
			filterDue: "Due date",
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
			filterText: "Text contains",
			filterTextPlaceholder: "Search task text…",
			filterApply: "Apply",
			filterClear: "Clear",
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
		base: "Embedded base",
		excalidraw: "Excalidraw drawing",
		canvas: "Embedded canvas",
		daily: "Daily note (today)",
		web: "Web page (iframe)",
		bookmarks: "Bookmarks",
		favorites: "Favorites",
		recent: "Recent files",
		links: "Links / launchpad",
		commands: "Commands",
		clock: "Clock & greeting",
		tasks: "Tasks",
		calendar: "Mini calendar",
		stats: "Vault statistics",
		search: "Query",
		heatmap: "Activity heatmap",
		text: "Text / jot-down",
		calculator: "Calculator",
		dataview: "Dataview query",
		leaf: "Plugin view (beta)",
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

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "That isn't valid JSON.",
		notAnObject: "Layout must be a JSON object.",
		noValidDashboards: "Layout contained no valid dashboards.",
		noValidCards: "Layout contained no valid cards.",
		notAHearthLayout: 'Not a Hearth layout — no "dashboards" or "cards" array found.',
		notHearthSettings: 'Not a Hearth settings backup — no "hearthSettings" marker or layout found.',
	},
};
