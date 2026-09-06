/**
 * German (Deutsch) locale.
 *
 * Typed against {@link Translations} (`typeof en`), so TypeScript flags any
 * missing or misspelled key at build time. Keys and function signatures match
 * `en.ts` exactly - only the values are translated. See `README.md` in this
 * folder for the walkthrough.
 */
import type { Translations } from "./index";

/**
 * Pluralform einer Wiederholungseinheit. `recurrence.everyMany` bekommt nur die
 * Einzahl, Deutsch braucht aber „alle 3 Tage“ neben „alle 3 Wochen“. Endet die
 * Einheit auf „e“, wird ein „n“ angehängt, sonst ein „e“.
 */
const pluralUnit = (unit: string) => (unit.endsWith("e") ? `${unit}n` : `${unit}e`);

/**
 * Adverbform für `recurrence.everyOne`. „Wiederholt sich pro Tag“ wäre eine
 * Häufigkeit, gemeint ist ein Abstand: „Wiederholt sich täglich“. Für
 * Frequenzen außerhalb der vier bekannten bleibt es beim bisherigen „pro“.
 */
const ADVERB_UNIT: Record<string, string> = {
	Tag: "täglich",
	Woche: "wöchentlich",
	Monat: "monatlich",
	Jahr: "jährlich",
};

export const de: Translations = {
	// ---- Befehle (Befehlspalette) und Menüband ---------------------------
	commands: {
		openHome: "Home-Dashboard öffnen",
		newNote: "Neue Notiz erstellen (Standardspeicherort)",
		newDrawing: "Neue Excalidraw-Zeichnung erstellen",
		recordVoice: "Sprachaufnahme starten/stoppen",
		openDailyNote: "Heutige Tagesnotiz öffnen",
		runSetup: "Hearth einrichten (Ersteinrichtungs-Assistent)",
		switchDashboard: (n: number) => `Zu Dashboard ${n} wechseln`,
		openDashboard: (n: number) => `Dashboard ${n} öffnen`,
		nextDashboard: "Nächstes Dashboard",
		previousDashboard: "Vorheriges Dashboard",
	},
	ribbon: {
		openHome: "Hearth-Home öffnen",
	},

	// ---- Hinweise (kurze Mitteilungen) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth: Neue Notiz konnte nicht erstellt werden.",
		operonTaskMissing:
			"Hearth: Die Notiz zu dieser Operon-Aufgabe ist nicht mehr im Vault.",
		operonRechecked: "Hearth: Operon-Verbindung erneut geprüft.",
		operonWriteFailed: (reason: string) => `Hearth: Operon hat die Änderung abgelehnt - ${reason}`,
		/** Ein abgelehntes Erstellen, mit der Operon-Einstellung, die das Ziel bestimmt hat -
		 * der Fehler allein nennt ein konfiguriertes Ziel, ohne zu sagen, welches. */
		operonCreateFailed: (reason: string, where: string) =>
			`Hearth: Operon hat das Erstellen der Aufgabe abgelehnt - ${reason} ${where} ` +
			"Ändere es in Operons Einstellungen oder wähle ein anderes Ziel unter „Neue Aufgaben“ " +
			"in den Einstellungen dieser Karte.",
		/** Die Änderung könnte angekommen sein. Hearth hat seinen einen zulässigen
		 * Wiederherstellungsversuch bereits verbraucht, daher lautet die ehrliche Meldung „unbekannt“, nicht „fehlgeschlagen“ -
		 * und niemals ein Angebot zum Wiederholen, das die Änderung doppelt anwenden könnte. */
		operonWriteUnknown: (reason: string) =>
			`Hearth: Operon konnte nicht bestätigen, ob die Änderung übernommen wurde (${reason}). ` +
			"Die Karte wurde neu eingelesen - prüfe die Aufgabe, bevor du es erneut versuchst.",
		enableExcalidraw:
			"Hearth: Aktiviere das Excalidraw-Plugin, um Zeichnungen zu erstellen.",
		excalidrawCommandMissing:
			"Hearth: Excalidraws Befehl „neue Zeichnung“ wurde nicht gefunden.",
		enableAudioRecorder: "Hearth: Aktiviere das Kern-Plugin Diktiergerät.",
		couldNotRecordVoice: "Hearth: Sprachaufnahme konnte nicht gestartet werden.",
		enableDailyNotes: "Hearth: Aktiviere das Kern-Plugin Tägliche Notizen.",
		couldNotOpenDaily: "Hearth: Heutige Tagesnotiz konnte nicht geöffnet werden.",
		couldNotOpenPeriodic: "Hearth: Periodic Notes konnte diese Notiz nicht erstellen.",
		commandNotFound: (id: string) => `Hearth: Befehl nicht gefunden: ${id}`,
		couldNotCreateNoteForDay: (day: string) =>
			`Hearth: Notiz für ${day} konnte nicht erstellt werden.`,
		couldNotCreateEventNote: "Hearth: Notiz für dieses Ereignis konnte nicht erstellt werden.",
		taskNotesCreateFailed: "Hearth: TaskNotes: „Neue Aufgabe erstellen“ konnte nicht ausgeführt werden.",
		taskChangedOnDisk: "Hearth: Diese Aufgabe hat sich auf dem Datenträger geändert - aktualisiert.",
		couldNotOpenTaskNote: "Hearth: Notiz dieser Aufgabe konnte nicht geöffnet werden.",
		couldNotUpdateTaskStatus: "Hearth: Aufgabenstatus konnte nicht aktualisiert werden.",
		couldNotCompleteRecurring:
			"Hearth: Wiederkehrende Aufgabeninstanz konnte nicht als erledigt markiert werden.",
		couldNotUndoRecurring:
			"Hearth: Erledigung der wiederkehrenden Aufgabe konnte nicht rückgängig gemacht werden.",
		couldNotAddKanbanCard: "Hearth: Karte konnte nicht zum Kanban-Board hinzugefügt werden.",
		couldNotConvertCard: "Hearth: Karte konnte nicht in eine Notiz umgewandelt werden.",
		templaterNoTemplate: (path: string) =>
			`Hearth: Vorlage nicht gefunden: ${path}`,
		templaterFailed: (name: string) =>
			`Hearth: Templater hat aus ${name} keine Notiz erstellt.`,
		templaterCreated: (path: string) => `Hearth: ${path} erstellt`,
		newNoteTemplaterMissing:
			"Hearth: Die Schaltfläche „Neue Notiz“ nutzt eine Templater-Vorlage, aber " +
			"Templater ist nicht aktiviert - es wird stattdessen eine leere Notiz erstellt.",
		exported: "Hearth: Exportiert.",
		layoutExported: "Hearth: Layout exportiert.",
		layoutImported: "Hearth: Layout importiert.",
		layoutImportError: (error: string) => `Hearth: ${error}`,
		exportedToVault: (file: string) =>
			`Hearth: ${file} im Stammordner deines Vaults gespeichert.`,
		exportFailed: "Hearth: Exportdatei konnte nicht gespeichert werden.",
		cardCopied: "Karte ins Dashboard kopiert.",
	},

	// ---- Die Startansicht -------------------------------------------------
	view: {
		displayName: "Start",
	},

	// ---- Kopfzeile / Suchleiste -------------------------------------------
	header: {
		newNote: "Neue Notiz",
		newNoteAria: "Neue Notiz erstellen",
		searchOnline: "Online suchen",
		searchOnlineAria: "Das Web nach der aktuellen Suchanfrage durchsuchen",
		searchOnlinePickAria: "Suchmaschine wählen",
		searchEngineDefault: (name: string) => `${name} (Standard)`,
	},
	search: {
		placeholder: "Vault durchsuchen",
		noMatches: "Keine Treffer",
		noMatchingCommands: "Keine passenden Befehle",
	},

	// ---- Gemeinsamer Bestätigungsdialog -----------------------------------------
	confirm: {
		confirm: "Bestätigen",
		cancel: "Abbrechen",
		ok: "OK",
	},

	// ---- Dialog „Was gibt's Neues“ (Versionshinweise) -----------------------------
	whatsNew: {
		title: "Was gibt's Neues in Hearth",
		intro: "Danke fürs Aktualisieren! Hier steht, was sich seit dem letzten Mal geändert hat.",
		/** Wird statt {@link intro} angezeigt, wenn es anklickbare Überschriften gibt. */
		introHint:
			"Danke fürs Aktualisieren! Hier steht, was sich seit dem letzten Mal geändert hat - " +
			"klicke eine Zeile an, um die Details zu lesen.",
		close: "Verstanden",
		footer: "Alle Details stehen in der README des Plugins.",
		/** Die Gruppenbezeichnungen für Hinzugefügt / Geändert / Behoben. */
		kinds: {
			added: "Neu",
			changed: "Geändert",
			fixed: "Behoben",
			removed: "Entfernt",
			deprecated: "Veraltet",
			security: "Sicherheit",
			other: "Sonstiges",
		},
		filterPlaceholder: "Änderungen filtern…",
		expandAll: "Alle ausklappen",
		collapseAll: "Alle einklappen",
		noMatches: (query: string) => `Hier erwähnt nichts „${query}“.`,
		/** Tooltip für den Vergleichs-/Release-Link einer Version. */
		releaseNotes: (version: string) => `Versionshinweise zu ${version} auf GitHub`,
		/** Beschriftung für die Kopfzeile, die eine Version einklappt. */
		releaseToggle: (version: string) => `Anzeigen oder ausblenden, was sich in ${version} geändert hat`,
		/** Tooltip für den Link `#123` neben einer Änderung. */
		issue: (n: string) => `Issue #${n} auf GitHub`,
	},
	// ---- Einrichtungsassistent beim ersten Start ----------------------------------------
	setup: {
		/** Kurze Bezeichnungen auf der Fortschrittsleiste. */
		stepNames: {
			welcome: "Willkommen",
			vault: "Dein Vault",
			look: "Aussehen",
			purpose: "Wofür",
			integrations: "Integrationen",
			finish: "Fertig",
		},
		/** Die Überschrift oben auf jedem Schritt. */
		stepTitles: {
			welcome: "Willkommen bei Hearth",
			vault: "Benenne deinen Startbildschirm",
			look: "Wähle ein Aussehen",
			purpose: "Wofür nutzt du deinen Vault?",
			integrations: "In deinem Vault gefunden",
			finish: "Hier ist dein Dashboard",
		},
		/** Die Zeile unter jeder Überschrift. */
		stepDescs: {
			welcome: "Ein paar Fragen, dann erstellt Hearth dein erstes Dashboard.",
			vault: "Der Titel und sein Symbol oben auf diesem Board.",
			look:
				"Das gilt für das Board, das gerade erstellt wird - jedes andere Board behält sein " +
				"eigenes Aussehen. Du kannst alles später in den Einstellungen des Boards ändern.",
			purpose: "Wähle so viele du willst - jede Auswahl fügt deinem Board Karten hinzu.",
			integrations:
				"Hearth hat diese bereits installiert gefunden. Schalte die ein, die es nutzen soll.",
			finish:
				"Es wurde noch nichts geändert. Das wird erstellt - als ein " +
				"Dashboard, deine Vault-weiten Einstellungen bleiben unverändert.",
		},
		nav: {
			back: "Zurück",
			next: "Weiter",
			finish: "Mein Dashboard erstellen",
			skip: "Einrichtung überspringen",
		},
		welcome: {
			lead:
				"Hearth verwandelt einen Tab in einen Startbildschirm für deinen Vault - Suche, ein Dashboard " +
				"aus Karten und eine Startzentrale. Dieser Assistent richtet ein Board ein, das zu deiner " +
				"Arbeitsweise passt, damit du nicht mit einem leeren Raster beginnst.",
			bullets: [
				{
					icon: "layout-dashboard",
					title: "Ein Dashboard für dich",
					desc: "Sag Hearth, wofür du deinen Vault nutzt, und es wählt die Karten.",
				},
				{
					icon: "plug",
					title: "Deine Plugins, schon verbunden",
					desc:
						"Hearth sucht nach TaskNotes, Dataview, Git und mehr und bietet an, " +
						"sie zu verbinden - liest deren eigene Einstellungen, damit Karten sofort funktionieren.",
				},
				{
					icon: "palette",
					title: "Ein Aussehen nach deiner Wahl",
					desc: "Hintergrund, Kartenstil und Dichte, in einem Schritt eingestellt.",
				},
			],
			detected: (names: string) => `In diesem Vault gefunden: ${names}.`,
			detectedNone:
				"Noch keine unterstützten Plugins erkannt - kein Problem, Hearth funktioniert auch allein " +
				"und du kannst sie später verbinden.",
		},
		vault: {
			title: "Titel",
			titleDesc: "Wird groß oben auf dem Dashboard angezeigt.",
			showTitle: "Titel anzeigen",
			showTitleDesc: "Ausschalten für ein Board ganz ohne Überschrift.",
			titleIcon: "Titel-Symbol",
			titleIconDesc:
				"Ein Emoji, ein paar Zeichen, eine Lucide-Symbol-ID, ein Vault-Bildpfad oder " +
				"eine Bild-URL, neben dem Titel angezeigt. Leer lassen für den Hearth-Kristall.",
			themeColor: "Akzentfarbe des Themes übernehmen",
			themeColorDesc: "Welche Teile des Board-Brandings die Farbe deines Themes übernehmen.",
			themeColorOptions: {
				none: "Weder noch",
				icon: "Das Symbol",
				title: "Der Titel",
				both: "Beides",
			},
			showSearch: "Suchleiste anzeigen",
			showSearchDesc: "Das Such- und Befehlsfeld unter dem Titel.",
		},
		look: {
			surfaceHeading: "Karten",
			backgroundHeading: "Hintergrund",
			color: "Farbe",
			colorDesc: "Die flache Farbe hinter dem Board.",
			weatherDesc:
				"Ein Live-Himmel für einen Ort oder eine fest angepinnte Bedingung. Wähle unten, " +
				"woher er kommt.",
			layout: "Wohin der Hintergrund kommt",
			layoutDesc:
				"Hinter das ganze Board oder als Bannerstreifen oben, mit deinen " +
				"Karten auf der eigenen Oberfläche des Themes darunter.",
			layoutFull: "Hinter allem",
			layoutBanner: "Ein Banner oben",
			compact: "Kompakte Abstände",
			compactDesc: "Verkleinert die Abstände, damit mehr auf den Bildschirm passt.",
		},
		surfaces: {
			glass: {
				icon: "layers",
				name: "Mattiert",
				desc: "Durchscheinende Karten mit weicher Unschärfe des Hintergrunds dahinter.",
			},
			solid: {
				icon: "square",
				name: "Deckend",
				desc: "Undurchsichtige Flächen. Am besten lesbar über einem unruhigen Foto.",
			},
			minimal: {
				icon: "minus",
				name: "Minimal",
				desc: "Gar keine Kartenoberfläche - Inhalt schwebt auf dem Hintergrund.",
			},
		},
		backgrounds: {
			default: {
				icon: "image",
				name: "Hearth-Hintergrundbild",
				desc: "Das Bild, das mit Hearth geliefert wird.",
			},
			weather: {
				icon: "cloud-sun",
				name: "Live-Himmel",
				desc: "Ein Himmel aus dem Wetter an deinem Standort - oder einer, den du anpinnst.",
			},
			color: {
				icon: "paintbrush",
				name: "Eine flache Farbe",
				desc: "Eine Farbe, kein Bild. Die leichteste Option überhaupt.",
			},
			none: {
				icon: "ban",
				name: "Keiner",
				desc: "Der eigene Hintergrund deines Themes, unverändert.",
			},
		},
		purposes: {
			daily: {
				name: "Tägliche Notizen & Tagebuch",
				desc: "Die heutige Notiz im Mittelpunkt, mit einem Kalender zum Wechseln zwischen Tagen.",
			},
			tasks: {
				name: "Aufgaben & To-dos",
				desc: "Eine Aufgabenliste, aus deinen Checkboxen oder aus einem Aufgaben-Plugin gelesen.",
			},
			planning: {
				name: "Planung & Kalender",
				desc: "Ein vollständiger Monats-/Wochen-/Tages-Kalender, einschließlich abonnierter Feeds.",
			},
			browsing: {
				name: "Meine Notizen finden",
				desc: "Was du zuletzt bearbeitet hast, plus ein Regal mit Favoriten.",
			},
			capture: {
				name: "Schnelles Erfassen & Starten",
				desc: "Kacheln für die Notizen und Befehle, die du ständig brauchst.",
			},
			insights: {
				name: "Vault-Statistiken",
				desc: "Wie groß der Vault ist und wie aktiv du warst.",
			},
			reading: {
				name: "Lesen & Feeds",
				desc: "Eine RSS-Karte für die Seiten, denen du folgst.",
			},
			ambience: {
				name: "Ein bisschen Leben",
				desc: "Wetter und ein kleines Haustier, das auf deinem Board lebt.",
			},
		},
		purpose: {
			count: (n: number) =>
				n === 1 ? "Das ist bisher 1 Karte." : `Das sind bisher ${n} Karten.`,
		},
		integrations: {
			lead:
				"Jedes, das Hearth hier einschaltet, fügt diesem Board eine Karte hinzu, für dich eingerichtet - " +
				"im anderen Plugin wird nichts installiert oder geändert, und nichts " +
				"außerhalb dieses Dashboards wird berührt.",
			recommended: "Empfohlen",
			effects: {
				tasknotes:
					"Fügt eine Aufgaben-Karte hinzu, die deine TaskNotes-Aufgaben liest, mit den Feldnamen und " +
					"Erledigt-Status aus TaskNotes, auf der Karte selbst gespeichert.",
				kanban: "Fügt eine Aufgaben-Karte hinzu, die dein Kanban-Board als Spalten zeigt, zwischen denen du ziehen kannst.",
				dataview: "Fügt eine Dataview-Karte hinzu, mit einer Beispielabfrage, die du bearbeiten kannst.",
				datacore: "Fügt eine Datacore-Karte für eine Abfrage hinzu.",
				templater:
					"Fügt eine Karte mit Schaltflächen hinzu - eine pro vorhandener Vorlage - die per Klick eine " +
					"Notiz daraus erstellt.",
				git: "Fügt eine Git-Karte hinzu, die den Status deines Repositorys zeigt, mit Commit- und Sync-Schaltflächen.",
				operon:
					"Fügt eine Operon-Aufgaben-Karte hinzu, gelesen über Operons Developer API. " +
					"Beim ersten Laden der Karte wirst du gebeten, Hearth in Operons eigenen Einstellungen zu bestätigen; " +
					"bis dahin zeigt sie, worauf sie wartet.",
				bases: "Fügt eine Karte hinzu, die eine Base aus deinem Vault einbettet.",
				dailyNotes: "Fügt eine Karte hinzu, die die heutige Tagesnotiz zeigt, direkt bearbeitbar.",
				bookmarks: "Fügt eine Karte hinzu, die deine Lesezeichen auflistet.",
			},
			taskNotesTitle: "Aus deinen TaskNotes-Einstellungen gelesen, auf diese Karte",
			taskNotesStatus: "Statusfeld",
			taskNotesDue: "Fälligkeitsfeld",
			taskNotesPriority: "Prioritätsfeld",
			taskNotesDone: "Zählt als erledigt",
			taskNotesDoneNone: "keins definiert - Hearth nutzt „done“",
		},
		finish: {
			empty:
				"Es wurden keine Karten ausgewählt. Du kannst trotzdem fertigstellen - das Board bleibt leer und " +
				"du kannst Karten über die Schaltfläche Anordnen des Dashboards hinzufügen.",
			target: "Wohin dieses Board kommt",
			targetDesc:
				"Ersetze das Dashboard, auf dem du bist, oder füge dieses als neues hinzu, zu dem du wechseln kannst.",
			targetReplace: "Mein aktuelles Dashboard ersetzen",
			targetNew: "Als neues Dashboard hinzufügen",
			targetForcedNew:
				"Dies wird als neues Dashboard hinzugefügt. Jedes Board, das du schon hast, bleibt " +
				"genau wie es ist - nichts wird ersetzt oder entfernt.",
			name: "Dashboard-Name",
			nameDesc: "Wird im Dashboard-Wechsler angezeigt.",
			/** Ausgangsname für das neue Dashboard; nummeriert, falls schon vergeben. */
			defaultName: "Start",
			calloutTitle: "Ein Startpunkt, keine Vorgabe",
			calloutLead:
				"Dieses Board soll ein solider Anfang sein - genug, um zu zeigen, was Hearth " +
				"für dich tun kann.",
			calloutBody:
				"Aber Hearth ist vor allem gebaut, um stark anpassbar zu sein, und dieser Assistent " +
				"berührt nur einen Bruchteil davon. Jede Karte kann verschoben, in der Größe geändert, umbenannt, " +
				"umgefärbt, neu eingerichtet oder entfernt werden, Boards können hinzugefügt und gewechselt " +
				"werden, und in den Einstellungen steckt viel mehr, als hier gefragt wurde. " +
				"Schau dich dort um und bearbeite alles nach deinen Wünschen - dafür " +
				"ist Hearth da.",
			calloutHint:
				"Anordnen (oben rechts auf dem Board) bearbeitet die Karten; Einstellungen → Hearth enthält den " +
				"Rest. Du kannst diesen Assistenten jederzeit erneut über Einstellungen → Über ausführen.",
		},
		plan: {
			/** Ersatznamen für geplante Karten ohne eigenen Titel. */
			names: {
				clock: "Uhr & Begrüßung",
				daily: "Heutige Notiz",
				tasks: "Aufgaben",
				schedule: "Kalender",
				calendar: "Mini-Kalender",
				recent: "Zuletzt verwendete Dateien",
				favorites: "Favoriten",
				bookmarks: "Lesezeichen",
				links: "Links",
				commands: "Befehle",
				stats: "Vault-Statistiken",
				heatmap: "Aktivität",
				rss: "Lesen",
				weather: "Wetter",
				pet: "Haustier",
				dataview: "Dataview",
				datacore: "Datacore",
				git: "Git",
				base: "Base",
			},
			/** Warum jede Karte auf dem Board ist, daneben in der Überprüfungsliste angezeigt. */
			reasons: {
				always: "Jedes Hearth-Board beginnt mit einer",
				daily: "Tägliche Notizen & Tagebuch",
				dailyNotes: "Tägliche Notizen sind aktiviert",
				tasks: "Aufgaben & To-dos",
				tasknotes: "Für TaskNotes eingerichtet",
				kanban: "Liest dein Kanban-Board",
				planning: "Planung & Kalender",
				browsing: "Meine Notizen finden",
				bookmarks: "Lesezeichen sind aktiviert",
				capture: "Schnelles Erfassen & Starten",
				insights: "Vault-Statistiken",
				reading: "Lesen & Feeds",
				ambience: "Ein bisschen Leben",
				dataview: "Dataview ist installiert",
				datacore: "Datacore ist installiert",
				templater: "Templater-Vorlagen wurden gefunden",
				git: "Git ist installiert",
				operon: "Operons Developer API ist verfügbar",
				bases: "Eine Base wurde in deinem Vault gefunden",
			},
		},
		notice: {
			done: (n: number) =>
				n === 1
					? "Hearth: dein Dashboard ist bereit - 1 Karte hinzugefügt."
					: `Hearth: dein Dashboard ist bereit - ${n} Karten hinzugefügt.`,
		},
	},
	// ---- Dateiauswahl --------------------------------------------------
	pickers: {
		fileToEmbed: "Datei zum Einbetten wählen…",
		command: "Befehl wählen…",
		noteToFavorite: "Notiz zum Favorisieren wählen…",
		folder: "Ordner wählen…",
		image: "Bild wählen…",
		icon: "Lucide-Icons suchen…",
		iconPlaceholder: "Lucide-Icon-ID",
		iconBrowse: "Lucide-Icons durchsuchen",
		iconClear: "Icon entfernen",
		titleIconPlaceholder: "Icon-ID, Emoji, Bildpfad oder URL",
		titleIconBrowseImage: "Bild aus dem Vault wählen",
	},

	// ---- Dashboard-Werkzeugleiste & Kartensteuerung -----------------------------
	dashboard: {
		addCard: "Karte hinzufügen",
		addCardAria: "Eine Karte zum Dashboard hinzufügen",
		dashboardSettings: "Dashboard-Einstellungen",
		dashboardSettingsAria: "Einstellungen für dieses Dashboard öffnen",
		showTitles: "Titel anzeigen",
		hideTitles: "Titel ausblenden",
		showCardHeaders: "Kartenkopfzeilen anzeigen",
		hideCardHeaders: "Kartenkopfzeilen ausblenden",
		doneArranging: "Anordnen beenden",
		finishArranging: "Anordnen der Karten beenden",
		moveResize: "Karten verschieben & Größe ändern",
		cardSettings: "Karten-Einstellungen",
		removeCard: "Karte entfernen",
		removeCardTitle: "Karte entfernen?",
		removeCardMessage: (name: string) => `„${name}“ aus dem Dashboard entfernen?`,
		removeCardConfirm: "Entfernen",
		thisCard: "diese Karte",
		expandCard: "Karte erweitern",
		collapseCard: "Karte einklappen",
		phonePreview: "Vorschau in Telefonbreite",
		phonePreviewOff: "Telefonvorschau verlassen",
		moveCardUp: "Karte nach oben verschieben",
		moveCardDown: "Karte nach unten verschieben",
		hideOnNarrow: "Auf schmalem Board ausblenden",
		showOnNarrow: "Auf schmalem Board anzeigen",
	},

	// ---- Dashboard-Wechsler & Einstellungen pro Dashboard -------------------
	dashboards: {
		newDashboard: "Neues Dashboard",
		defaultName: (n: number) => `Dashboard ${n}`,
		copySuffix: (name: string) => `${name} Kopie`,
		fallbackName: "Dashboard",
		menu: {
			settings: "Dashboard-Einstellungen…",
			duplicate: "Duplizieren",
			exportBoard: "Dashboard exportieren…",
			importBoard: "Dashboard importieren…",
			delete: "Löschen",
		},
		deleteTitle: "Dashboard löschen?",
		deleteMessage: (name: string, count: number) =>
			`„${name}“ und seine ${count} Karte(n) löschen? Dies kann nicht rückgängig gemacht werden.`,
		deleteConfirm: "Löschen",
		modal: {
			title: "Dashboard-Einstellungen",
			/** Reiter oben im Fenster der Dashboard-Einstellungen. */
			tabs: {
				general: "Allgemein",
				plugin: "Plugin-Ansicht",
				header: "Kopfzeile",
				layout: "Layout",
				style: "Stil",
				background: "Hintergrund",
			},
			name: "Name",
			mode: "Dashboard-Typ",
			modeDesc:
				"Ein Board aus Hearth-Karten oder das ganze Board für die Ansicht eines Plugins. Beim Wechsel zur Plugin-Ansicht bleiben die Karten dieses Boards erhalten - wechsle zurück und sie sind wieder da.",
			modeOptions: {
				cards: "Karten",
				plugin: "Plugin-Ansicht",
			},
			modePickViewHint:
				"Dieses Board hat noch keine Ansicht - wähle eine auf dem Reiter „Plugin-Ansicht“.",
			pluginViewType: "Ansicht",
			pluginViewTypeDesc:
				"Welche registrierte Ansicht dieses Board füllt. Die Liste enthält jede Ansicht, die die App gerade hat, und folgt daher den aktivierten Plugins.",
			pluginViewTypeNone: "Ansicht wählen…",
			pluginViewFile: "Datei",
			pluginViewFileDesc:
				"Öffne die Ansicht mit einer bestimmten Datei - einem Canvas, einer Excalidraw-Zeichnung. Leer lassen, um die Ansicht eigenständig zu hosten.",
			pluginViewFileRequiredDesc:
				"Diese Ansicht braucht eine Datei zur Anzeige. Wähle die Notiz, das PDF oder Bild, das dieses Board öffnet.",
			pluginViewHideHeader: "Eigenen Header der Ansicht ausblenden",
			pluginViewHideHeaderDesc:
				"Entfernt Breadcrumbs, Zurück-/Vorwärts-Pfeile und Kebab-Menü der gehosteten Ansicht. Ihre eigenen Werkzeugleisten und Reiter bleiben unverändert.",
			pluginViewKeepMounted: "Im Hintergrund weiterlaufen",
			pluginViewKeepMountedDesc:
				"Bleibt geladen, während ein anderes Dashboard angezeigt wird, sodass die Rückkehr sofort geht statt neu zu laden. Schalte es für ein schweres Plugin aus, das du lieber nicht laufen lassen willst. Es werden immer nur wenige Boards gleichzeitig geladen gehalten.",
			pluginViewFocusable: "Ansicht darf Fokus übernehmen (experimentell)",
			pluginViewFocusableDesc:
				"Macht dies zum aktiven Bereich, während du darin arbeitest, damit die eigenen Befehle und Hotkeys des Plugins ihn finden. Obsidian öffnet Notizen ebenfalls im aktiven Bereich, daher kann ein angeklickter Link die Ansicht ersetzen, bis du das Board wechselst.",
			pluginViewPerfNote:
				"Eine gehostete Ansicht ist das Plugin bei seiner vollen Arbeit, keine Vorschau - sie kostet, was das Öffnen dieses Plugins kostet. Ansichten, die in ihrem eigenen Tab langsam sind, sind auch hier langsam.",
			switcherIcon: "Wechsler-Icon",
			switcherIconDesc:
				"Ein Emoji oder kurzer Text auf der Wechsler-Schaltfläche. Leer = Nummer.",
			switcherLucide: "Lucide-Icon für Wechsler",
			switcherLucideDesc:
				"Ein Lucide-Icon (z. B. „home“, „star“, „layout-dashboard“) - durchsuche das Set oder tippe eine ID. Hat Vorrang vor dem Emoji oben.",
			linkedWorkspace: "Verknüpfter Arbeitsbereich",
			linkedWorkspaceDesc:
				"Wechselt automatisch zu diesem Dashboard, wenn dieser Arbeitsbereich lädt. Erfordert das Kern-Plugin Arbeitsbereiche.",
			linkedWorkspaceNone: "Kein",
			mobileDefault: "Standard auf Mobilgeräten",
			mobileDefaultDesc:
				"Öffne dieses Dashboard, wenn Hearth auf Telefon oder Tablet lädt. Nur ein Board kann der mobile Standard sein; das Aktivieren entfernt ihn auf den anderen.",
			titleVisibility: "Titel-Sichtbarkeit",
			titleVisibilityDesc:
				"Blendet nur den Titelblock dieses Dashboards ein oder aus. Überschreibt die globale Einstellung.",
			titleVisibilityDefault: (state: string) => `Globalen Standard verwenden (${state})`,
			searchVisibility: "Sichtbarkeit der Suche",
			searchVisibilityDesc:
				"Blendet die Suche und Befehlsleiste mit ihren Ergebnissen und Filterschaltflächen auf diesem Dashboard ein oder aus. Überschreibt die globale Einstellung.",
			searchVisibilityShow: "Suche anzeigen",
			searchVisibilityHide: "Suche ausblenden",
			searchPlaceholder: "Such-Platzhalter",
			searchPlaceholderDesc:
				"Der ausgegraute Text im Suchfeld dieses Boards. Feld leer lassen für den eingebauten Wortlaut.",
			newNoteButton: "Schaltfläche neben der Suche",
			newNoteButtonDesc:
				"Blendet die Schaltfläche neben dem Suchfeld dieses Boards ein oder aus.",
			newNoteButtonStateOn: "angezeigt",
			newNoteButtonStateOff: "ausgeblendet",
			newNoteButtonMode: "Was diese Schaltfläche tut",
			newNoteButtonModeDesc:
				"Erstellt eine neue Notiz oder sucht im Web nach dem, was im Suchfeld steht.",
			newNoteButtonModeOptions: {
				newNote: "Neue Notiz",
				searchOnline: "Online suchen",
			},
			newNoteButtonLabel: "Beschriftung der Schaltfläche",
			newNoteButtonLabelDesc:
				"Der Text auf dieser Schaltfläche auf diesem Board. Leer lassen für den eingebauten Wortlaut.",
			hiddenFilters: "Filter-Chips",
			hiddenFiltersDesc:
				"Wähle, welche Dateityp-Chips dieses Board unter der Suchleiste zeigt, statt der Vault-weiten Auswahl zu folgen.",
			hiddenFiltersFollowing: (count: number) =>
				count === 0
					? "Folgt dem Vault, der keine ausblendet."
					: `Folgt dem Vault, der ${count} ausblendet.`,
			stackOnNarrow: "Stapeln wenn schmal",
			stackOnNarrowDesc:
				"Bricht dieses Board in eine volle Spalte um, sobald der Bereich zu schmal für das freie Layout ist - ein Telefon oder ein schmaler Split.",
			stackOnNarrowStateOn: "stapeln",
			stackOnNarrowStateOff: "Layout behalten",
			stackOnNarrowOptionOn: "In eine Spalte stapeln",
			stackOnNarrowOptionOff: "Skaliertes Layout behalten",
			arrangeVisibility: "Anordnen-Schaltfläche",
			arrangeVisibilityDesc:
				"Ob die Anordnen-Schaltfläche auf diesem Board sichtbar bleibt oder bei Hover eingeblendet wird.",
			switcherVisibility: "Dashboard-Wechsler",
			switcherVisibilityDesc:
				"Ob der Dashboard-Wechsler sichtbar bleibt, während dieses Board angezeigt wird, oder bei Hover eingeblendet wird.",
			chromeOptions: {
				always: "Immer sichtbar",
				hover: "Bei Hover anzeigen",
			},
			chromeStates: {
				always: "immer sichtbar",
				hover: "bei Hover",
			},
			skyAnimate: "Himmel animieren",
			skyAnimateDesc:
				"Lässt das gemalte Wetter dieses Boards treiben, fallen und funkeln. Die Leistungsstufe und die Einstellung für reduzierte Bewegung können es trotzdem stillhalten.",
			skyAnimateStateOn: "animiert",
			skyAnimateStateOff: "still",
			skyAnimateOptionOn: "Animieren",
			skyAnimateOptionOff: "Stillhalten",
			visibilityDefaultPlugin: (state: string) =>
				`Standard auf einem Plugin-Board (${state})`,
			visibilityShown: "angezeigt",
			visibilityHidden: "ausgeblendet",
			visibilityShow: "Titel anzeigen",
			visibilityHide: "Titel ausblenden",
			titleText: "Titeltext",
			titleTextDesc: "Überschreibt den globalen Titeltext für dieses Dashboard.",
			titleIcon: "Titel-Icon",
			titleIconDesc:
				"Das Zeichen neben dem Titel dieses Dashboards: eine Lucide-Icon-ID, ein Emoji oder kurzer Text, ein Vault-Bildpfad oder eine Bild-URL. Leeren, um auf diesem Board allein den Hearth-Kristall zu tragen.",
			titleAlign: "Titel-Ausrichtung",
			titleAlignDesc:
				"Richtet nur den Titelblock aus. Die Suchleiste behält ihr eigenes Layout.",
			alignDefault: "Standard (mittig)",
			alignLeft: "Links",
			alignCenter: "Mittig",
			alignRight: "Rechts",
			titleSize: "Titelgröße",
			titleIconSize: "Titel-Icon-Größe",
			titleTopMargin: "Oberer Titelabstand",
			headerSpacingBelow: "Abstand unter Titel/Kopfzeile",
			contentWidth: "Inhaltsbreite",
			fullWidth: "Volle Breite",
			fullWidthDesc: "Überschreibt die Breitenbegrenzung für dieses Board.",
			fullWidthDefault: (state: string) => `Globalen Standard verwenden (${state})`,
			fullWidthOptionOn: "Bereich füllen",
			fullWidthOptionOff: "Breite begrenzen",
			fullWidthStateOn: "füllt den Bereich",
			fullWidthStateOff: "begrenzt",
			fitToPage: "An Seite anpassen",
			fitToPageDesc: "Überschreibt das Scrollen für dieses Board.",
			fitDefault: (state: string) => `Globalen Standard verwenden (${state})`,
			fitStateFit: "angepasst",
			fitStateScroll: "mit Bildlauf",
			fitOptionFit: "An eine Seite anpassen",
			fitOptionScroll: "Scrollen erlauben",
			fitToPagePluginNote:
				"Ein Plugin-Board passt immer in den Bereich - die gehostete Ansicht füllt ihn und scrollt selbst.",
			themeColorTarget: "Akzentfarbe am Titel",
			themeColorTargetDesc:
				"Welche Teile des Brandings dieses Boards der Icon-Farbe des Themes folgen. Überschreibt die globale Einstellung für dieses Board; Hearth-Tab- und Ribbon-Icons folgen weiter der globalen.",
			themeColorTargetDefault: (state: string) => `Globalen Standard verwenden (${state})`,
			themeColorTargetOptions: {
				none: "Weder noch",
				icon: "Das Icon",
				title: "Der Titel",
				both: "Beide",
			},
			compact: "Kompakte Abstände",
			compactDesc: "Überschreibt die globalen Abstände für dieses Board.",
			compactDefault: (state: string) => `Globalen Standard verwenden (${state})`,
			compactOptionOn: "Kompakt",
			compactOptionOff: "Geräumig",
			compactStateOn: "kompakt",
			compactStateOff: "geräumig",
			cardOpacity: "Karten-Deckkraft",
			cardBlur: "Karten-Unschärfe",
			cardRadius: "Karten-Eckenradius",
			cardBorderWidth: "Kartenrahmen",
			done: "Fertig",
			overriding: "Überschreibt den globalen Standard.",
			usingGlobal: (value: number | string) =>
				`Verwendet globalen Standard (${value}).`,
			usingDefault: (value: number | string) =>
				`Verwendet Standard (${value}).`,
			usingDefaultText: (value: string) =>
				`Verwendet Standard (${value}).`,
			background: "Hintergrund",
			backgroundDesc: "Überschreibt den globalen Hintergrund für dieses Dashboard.",
			backgroundValue: "Hintergrundwert",
			opacity: "Deckkraft",
			blur: "Unschärfe",
			backgroundLayout: "Hintergrund-Layout",
			bannerHeight: "Bannerhöhe",
			bannerFade: "Untere Kante weich ausblenden",
			bannerFullWidth: "Volle Breite",
			clearOverride: "Globaler Einstellung folgen",
		},
		useGlobal: "Globalen Standard verwenden",
		on: "an",
		off: "aus",
		backgroundLayoutOptions: {
			full: "Voller Hintergrund",
			banner: "Banner",
		},
		backgroundOptions: {
			default: "Globalen Standard verwenden",
			none: "Kein",
			hdefault: "Hearth-Standard",
			color: "Volltonfarbe",
			image: "Vault-Bild",
			url: "Bild-URL",
			weather: "Live-Wetterhimmel",
		},
		backgroundValueDesc: {
			color: "Eine CSS-Farbe, z. B. #1e1e2e.",
			image: "Ein Vault-Bildpfad, z. B. Attachments/bg.png.",
			url: "Eine direkte Bild-URL.",
		},
	},
	// ---- Plugin-Einstellungen-Tab -------------------------------------------
	settings: {
		/** Wird von jedem Slider-/Abschnittssteuerelement gemeinsam verwendet. */
		resetSlider: "Auf Standard zurücksetzen",
		/** Zurücksetzen-Schaltfläche neben Textfeldern, deren Standardwert relevant ist. */
		resetField: "Auf Standard zurücksetzen",
		/** Unterzeile unter dem Plugin-Namen auf der Einstellungsübersicht. */
		indexSub: "Ein Startbildschirm für deinen Vault - Suche, Dashboard und Startzentrale in einem.",
		/** Barrierefreier Name des Zurück-Links auf einer Kategorieseite; die sichtbare Beschriftung ist
		 * der eigene Name des Plugins. */
		backToIndex: "Zurück zu allen Einstellungen",
		/** Überschriften, die die Kategorien auf der Übersicht gruppieren. */
		indexGroups: {
			lookFeel: "Aussehen & Stil",
			howItWorks: "Funktionsweise",
			data: "Daten & Plugins",
			etc: "Sonstiges",
		},
		/** Eine Zeile pro Kategorie, gezeigt auf ihrer Übersichtszeile und erneut oben auf
		 * ihrer Seite: was ein Leser findet, wenn er sie öffnet. */
		tabDescs: {
			appearance: "Titel, Titelsymbol, Hintergrund und Energiesparmodus.",
			search: "Die Suchleiste und welche Ergebnisse sie anbietet.",
			dashboard: "Raster, Kartenoberfläche und die Steuerelemente rund um das Board.",
			behaviour: "Start, wie Notizen geöffnet werden, und Datenschutz.",
			mobile: "Das gestapelte Layout auf dem Smartphone und die Aktionsleiste.",
			integrations: "TaskNotes, Dateisymbole und jedes Plugin, das Hearth liest.",
			backup: "Exportiere und importiere dein Layout und deine Einstellungen.",
			about: "Version, Neuigkeiten und wo du Dinge melden kannst.",
		},
		/** Wird anstelle eines Einstellungsabschnitts (oder -tabs) gezeigt, dessen Darstellung fehlgeschlagen ist, sodass
		 * ein einzelner fehlerhafter Abschnitt nicht mehr die gesamte Einstellungsansicht leeren kann. */
		sectionError: (name: string) => `Der Abschnitt „${name}“ konnte nicht angezeigt werden.`,
		sectionErrorHint:
			"Öffne die Entwicklerkonsole (Cmd/Ctrl+Option+I), um den Fehler zu sehen, und melde ihn bitte auf GitHub. Die übrigen Einstellungen sind nicht betroffen.",
		/** Kategorieleiste oben im Einstellungs-Tab. */
		tabs: {
			appearance: "Erscheinungsbild",
			search: "Suche",
			dashboard: "Dashboard",
			behaviour: "Verhalten",
			mobile: "Mobil",
			integrations: "Integrationen",
			backup: "Sicherung",
			about: "Über",
		},
		/** Unterüberschriften zum Gruppieren von Einstellungen innerhalb eines Tabs. */
		sections: {
			performance: "Leistung",
			performanceDesc:
				"Wie viel Dekoration du dir leistest. Tausche visuelle Effekte gegen Akkulaufzeit und flüssigere Darstellung auf langsamerer Hardware.",
			home: "Start",
			homeDesc:
				"Titel, Titel- und Tab-Symbole, Sichtbarkeit der Suche und gesamte Inhaltsbreite.",
			searchBar: "Suchleiste",
			searchBarDesc: "Wie das Suchfeld aussieht und was es tut.",
			grid: "Raster & Abstände",
			gridDesc: "Wie das Kartenraster bemessen und angeordnet ist.",
			dashboardControls: "Dashboard-Steuerelemente",
			dashboardControlsDesc: "Sichtbarkeit der Steuerelemente rund um das Dashboard.",
			cardSurface: "Kartenoberfläche",
			cardSurfaceDesc:
				"Transparenz und Milchglas-Weichzeichner für jede Karte.",
			startup: "Start & Tabs",
			startupDesc: "Wann und wo die Startansicht geöffnet wird.",
			opening: "Notizen öffnen",
			openingDesc: "Wo eine Notiz geöffnet wird, wenn du sie in Hearth anklickst.",
			mobileMode: "Layout",
			mobileModeDesc:
				"Wie das Board angeordnet wird, wenn der Bildschirm für sein eigenes Layout zu schmal ist.",
			privacy: "Datenschutz & Netzwerk",
			privacyDesc: "Steuere, welche ausgehenden Anfragen Hearth stellen darf.",
		},
		about: {
			heading: "Über Hearth",
			headingDesc: "Projektlinks, Unterstützung und Version.",
			setup: "Hearth einrichten",
			setupDesc:
				"Beantworte ein paar Fragen dazu, wie du arbeitest und was installiert ist, und Hearth " +
				"baut ein passendes Dashboard. Es wird als neues Board hinzugefügt - nichts, " +
				"was du bereits hast, wird geändert.",
			setupAgain: "Ein Dashboard erstellen",
			setupAgainDesc:
				"Führe den Einrichtungsassistenten erneut aus, um ein weiteres Dashboard zu erzeugen. Es wird immer " +
				"als neues Board hinzugefügt, sodass deine bestehenden Dashboards nie verändert werden - " +
				"und alles, was er einstellt, landet nur auf diesem einen Board, nicht in deinen vaultweiten " +
				"Einstellungen.",
			setupButton: "Einrichtung starten",
			whatsNew: "Neuigkeiten",
			whatsNewDesc: "Lies die Versionshinweise für diese und alle früheren Versionen.",
			whatsNewButton: "Änderungsprotokoll ansehen",
			github: "GitHub-Repository",
			githubDesc: "Durchsuche den Quellcode, gib dem Projekt einen Stern oder lies das Änderungsprotokoll.",
			githubButton: "GitHub öffnen",
			reportIssue: "Ein Problem melden",
			reportIssueDesc:
				"Einen Fehler gefunden oder eine Idee für eine Funktion? Öffne ein Issue auf GitHub.",
			reportIssueButton: "Issue melden",
			kofi: "Hearth unterstützen",
			kofiDesc:
				"Hearth ist kostenlos und bleibt es auch. Wenn es sich einen Platz auf deinem " +
				"Startbildschirm verdient hat, kannst du ein Trinkgeld da lassen - völlig freiwillig, keine Funktionen sind gesperrt.",
			/** Wird von jeder Oberfläche verwendet, die die Trinkgeld-Schaltfläche zeigt: diese Zeile, der
			 * „Neuigkeiten“-Dialog und die Anfrageseite in der Kartenauswahl. */
			kofiButton: "Trinkgeld auf Ko-fi",
			version: (v: string) => `Version ${v}`,
			versionDesc: "Der Hearth-Build, den du verwendest.",
		},
		appearance: {
			heading: "Erscheinungsbild",
			headingDesc: "Titel, Titelsymbol, Suchleiste und gesamte Inhaltsbreite.",
			showTitle: "Titel anzeigen",
			showTitleDesc: "Zeige den großen Titel und sein Symbol oben an.",
			showSearch: "Suchbereich anzeigen",
			showSearchDesc:
				"Zeige die Such- und Befehlsleiste mit ihren Ergebnissen und Filterschaltflächen an. " +
				"Einzelne Dashboards können dies in ihren Einstellungen überschreiben.",
			title: "Titel",
			titleDesc: "Der Überschriftstext oben in der Startansicht.",
			titleIcon: "Titelsymbol",
			titleIconDesc:
				"Das Zeichen neben dem Titel. Möglich sind: eine Lucide-Symbol-ID " +
				"(durchsuche den Satz mit der 🔍-Schaltfläche), ein Emoji oder ein paar " +
				"Zeichen, der Vault-Pfad eines Bildes (📷-Schaltfläche) oder die URL eines " +
				"Bildes aus dem Web. Leer lassen für den Hearth-Kristall. Jedes " +
				"Dashboard kann es in seinen eigenen Einstellungen überschreiben.",
			tabIcon: "Tab-Symbol",
			tabIconDesc:
				"Ein Lucide-Symbol für Hearths Tab-Kopf und Menüband-Schaltfläche anstelle " +
				"des Hearth-Kristalls. Durchsuche den Satz oder gib eine ID ein; leer lassen für den Kristall.",
			themeColorTarget: "Symbolfarbe des Themes übernehmen",
			themeColorTargetDesc:
				"Zeichne das Kristallsymbol und/oder den Titeltext in der " +
				"Symbolfarbe deines Themes statt im standardmäßigen lila Kristall und normalem Text.",
			themeColorNone: "Aus",
			themeColorIcon: "Symbol",
			themeColorTitle: "Titel",
			themeColorBoth: "Symbol und Titel",
			searchPlaceholder: "Suchplatzhalter",
			searchContents: "Notizinhalte durchsuchen",
			searchContentsDesc:
				"Finde auch Text in Notizinhalten, nicht nur Namen, Tags und " +
				"Eigenschaften. Inhaltstreffer erscheinen nach Namentreffern mit einem Ausschnitt.",
			searchEngine: "Suchfunktion",
			searchEngineDesc:
				"Welche Engine die Suchleiste antreibt. Omnisearch erfordert, dass das " +
				"Omnisearch-Community-Plugin installiert und aktiviert ist.",
			searchEngineBuiltin: "Hearth (integriert)",
			searchEngineOmnisearch: "Omnisearch",
			omnisearchMissing:
				"Omnisearch ist nicht installiert oder aktiviert. Installiere und aktiviere es, " +
				"und wähle es dann erneut aus.",
			omnisearchInstallLink: "Omnisearch in den Community-Plugins öffnen",
			showNewNoteButton: "Schaltfläche „Neue Notiz“ anzeigen",
			showNewNoteButtonDesc: "Zeige die Aktionsschaltfläche neben dem Suchfeld an.",
			newNoteButtonMode: "Schaltfläche der Suchleiste",
			newNoteButtonModeDesc:
				"Was die Schaltfläche neben der Suchleiste tut: eine neue Notiz erstellen oder " +
				"im Web nach dem aktuellen Inhalt des Suchfelds suchen.",
			newNoteButtonModeNewNote: "Neue Notiz",
			newNoteButtonModeSearchOnline: "Online suchen",
			webSearchEngine: "Online-Suchmaschine",
			webSearchEngineDesc:
				"Welche Engine die Schaltfläche „Online suchen“ öffnet. Der Pfeil neben " +
				"der Schaltfläche sucht für eine Anfrage mit einer der anderen, ohne " +
				"diese Auswahl zu ändern.",
			newNoteHeading: "Die Schaltfläche „Neue Notiz“",
			newNoteHeadingDesc:
				"Was die Schaltfläche erstellt und wo. Dieselben Einstellungen steuern die " +
				"Schaltfläche neben der Suchleiste, die auf einer Suchleisten-Karte und " +
				"Hearths Befehl „Neue Notiz erstellen“.",
			newNoteButtonLabel: "Schaltflächentext",
			newNoteButtonLabelDesc:
				"Text auf der Schaltfläche. Leer lassen für „Neue Notiz“.",
			newNoteTemplate: "Vorlage",
			newNoteTemplateDesc:
				"Erstelle die Notiz aus einer Templater-Vorlage statt aus einer leeren. " +
				"Templater übernimmt das Templating - deine Benutzerskripte, " +
				"tp.system.prompt()-Dialoge und die Cursorposition verhalten sich alle so wie " +
				"bei seinem eigenen Befehl.",
			newNoteTemplateNone: "Leere Notiz",
			newNoteTemplatePick: "Vorlage wählen…",
			newNoteTemplateClear: "Leere Notiz verwenden",
			newNoteTemplaterMissing:
				"Templater ist nicht aktiviert. Installiere und aktiviere es, um hier eine Vorlage " +
				"zu verwenden; bis dahin erstellt die Schaltfläche eine leere Notiz.",
			newNoteFolder: "Speicherort",
			newNoteFolderDesc:
				"Ordner, in den die neue Notiz kommt; wird erstellt, falls er noch nicht existiert. " +
				"„Standardspeicherort“ bedeutet, wohin Obsidian neue Notizen legt.",
			newNoteFolderClear: "Standardspeicherort verwenden",
			newNoteFilename: "Dateiname",
			newNoteFilenameDesc:
				"Name für die neue Notiz, ohne Endung. {{date}}, " +
				"{{date:FMT}}, {{time}}, {{time:FMT}} und {{prompt}} werden " +
				"ersetzt - {{prompt}} fragt dich bei jedem Klick nach dem Namen. " +
				"Leer lassen für „Unbenannt“.",
			newNoteFilenamePlaceholder: "Unbenannt",
			newNoteDestination: (destination: string) => `Erstellt ${destination}`,
			contentWidth: "Inhaltsbreite",
			contentWidthDesc:
				"Die maximale Breite des Startinhalts in Pixeln. Es ist eine Obergrenze, " +
				"keine Breite - der Inhalt schrumpft weiterhin, um in einen schmaleren Bereich zu passen.",
			fullWidth: "Volle Breite",
			fullWidthDesc:
				"Lasse den Inhalt den Bereich füllen, statt bei der Breite " +
				"unten zu stoppen. Karten behalten ihre Proportionen, wenn der Bereich breiter wird, aber der Text " +
				"wächst nicht mit, sodass ein sehr breites Board lückenhafter wirkt.",
		},
		performance: {
			tier: "Leistungsstufe",
			tierDesc:
				"Jede Stufe nach unten streicht das jeweils Aufwendigste, was das Board tut. " +
				"Nichts darunter wird überschrieben - deine Einstellungen kommen genau so zurück, " +
				"wie sie waren, wenn du wieder nach oben wechselst.",
			tierFull: "Voll - alles an",
			tierBalanced: "Ausgewogen - ein leichterer Himmel",
			tierReduced: "Reduziert - nichts bewegt sich",
			tierMinimal: "Minimal - schlicht und still",
			/** Eine Zeile pro Stufe, angezeigt unter dem Dropdown für die ausgewählte. */
			tierFullDesc:
				"Jeder Effekt in voller Stärke. Der gemalte Wetterhimmel ist hier das " +
				"Aufwendigste: Wenn das Board deine Maschine aufheizt, ist dies " +
				"die Einstellung, die du herunterstufen solltest.",
			tierBalancedDesc:
				"Der gemalte Himmel wird mit halber Dichte gezeichnet - weniger Regentropfen, Sterne, " +
				"Wolken und Nebelschwaden. Nichts wird ausgeschaltet und nichts hört auf, " +
				"sich zu bewegen; es gibt einfach weniger davon, für etwa ein Drittel weniger Aufwand.",
			tierReducedDesc:
				"Nichts auf dem Board bewegt sich, und das Milchglas hinter Karten ist " +
				"aus. Dein Hintergrundbild bleibt, Karten bleiben durchscheinend, und jede Karte " +
				"aktualisiert sich weiterhin nach ihrem Zeitplan - das Board hält nur still.",
			tierMinimalDesc:
				"Die sparsame Stufe: eine flache Farbe statt des Hintergrundbilds, undurchsichtige " +
				"Karten, keine Bewegung und keine Karte, die sich per Zeitplan selbst aktualisiert.",
			pauseWhenUnfocused: "Animation pausieren, wenn Obsidian nicht im Vordergrund ist",
			pauseWhenUnfocusedDesc:
				"Halte jede Animation an, während du in einer anderen App oder " +
				"einem anderen Fenster arbeitest. Ein Hearth-Tab hinter einem anderen Tab " +
				"kostet bereits nichts; dies betrifft ein sichtbares Board in einem Fenster, das du nicht " +
				"verwendest - neben einem Browser oder auf einem zweiten Bildschirm. Schalte es aus, wenn du " +
				"das Dashboard auf einem zweiten Bildschirm laufen lässt.",
			color: "Minimaler Hintergrund",
			colorDesc:
				"Die flache Farbe hinter der Startansicht auf der minimalen Stufe. " +
				"Jede CSS-Farbe, z. B. #4a4459.",
			/** Aufzählung, was die ausgewählte Stufe ändert, angezeigt unter dem Dropdown. */
			effects: "Auf dieser Stufe:",
			effectSkyHalf: "der gemalte Wetterhimmel wird mit halber Dichte gezeichnet",
			effectBackground: "der Hintergrund ist eine flache Farbe - kein Bild, GIF, keine Deckkraftebene oder Weichzeichnung",
			effectOpaque: "Karten sind undurchsichtig statt durchscheinend",
			effectFrost: "kein Milchglas-Weichzeichner hinter Karten",
			effectMotion: "Übergänge, Schwebeeffekte, Schatten und Animationen sind aus",
			effectRefresh:
				"Web-, RSS-, Kalenderabo- und Jira-Karten aktualisieren sich nicht mehr per Zeitplan (manuelles Aktualisieren funktioniert weiterhin)",
			effectLiveRefresh: "das Dashboard baut sich bei Vault-Änderungen nicht mehr selbst neu auf",
			effectClock: "Uhr-Karten lassen Sekunden und den schleichenden Sekundenzeiger weg",
			effectSlideshow: "Diashow-Karten halten ein Bild statt zu wechseln",
			/** Wird in den Abschnitten angezeigt, deren Einstellungen die Stufe gerade überschreibt. */
			overridden:
				"Die Leistungsstufe überschreibt diese gerade. Sie bleiben wie " +
				"sie sind und greifen wieder, wenn du nach oben wechselst.",
		},
		background: {
			heading: "Hintergrund",
			headingDesc:
				"Die Kulisse hinter der Startansicht und wie stark sie durchscheint.",
			type: "Hintergrundtyp",
			typeDesc: "Was hinter der Startansicht angezeigt wird.",
			value: "Hintergrundwert",
			valueColorDesc: "Eine CSS-Farbe, z. B. #1e1e2e oder rgb(30,30,46).",
			valueImageDesc: "Ein Vault-Bildpfad, z. B. Attachments/bg.png.",
			valueUrlDesc: "Eine direkte Bild-URL.",
			externalCallsDisabled:
				"Wird nicht angezeigt, solange \u201eExterne Aufrufe deaktivieren\u201c unter Verhalten aktiv ist: " +
				"dieser Hintergrund wird aus dem Web geladen. Wähle stattdessen ein Vault-Bild " +
				"oder schalte die Einstellung aus.",
			opacity: "Deckkraft",
			opacityDesc:
				"Wie stark der Hintergrund durchscheint. Niedriger ist unauffälliger.",
			blur: "Weichzeichnung",
			blurDesc: "Hintergrundweichzeichnung in Pixeln.",
			layout: "Hintergrundlayout",
			layoutDesc:
				"Fülle die ganze Ansicht mit dem Hintergrund oder verwende ihn als Banner - " +
				"einen Streifen oben auf dem Board, so wie ein Titelbild über " +
				"einer Notiz sitzt - mit den Karten darunter auf der eigenen Fläche des Themes. " +
				"Jedes Board kann dies in seinen eigenen Einstellungen überschreiben.",
			layoutLabels: {
				full: "Voller Hintergrund",
				banner: "Banner",
			},
			bannerHeight: "Bannerhöhe",
			bannerHeightDesc: "Wie hoch der Bannerstreifen ist, in Pixeln.",
			bannerFade: "Untere Kante ausblenden",
			bannerFadeDesc:
				"Lasse das Banner in die Seite übergehen, statt mit einer harten Kante zu enden.",
			bannerFullWidth: "Volle Breite",
			bannerFullWidthDesc:
				"Ziehe das Banner von Kante zu Kante, statt es am Inhalt darunter auszurichten.",
			labels: {
				default: "Hearth-Standard",
				none: "Keine",
				color: "Volltonfarbe",
				image: "Vault-Bild",
				url: "Bild-URL",
				weather: "Live-Wetterhimmel",
			},
			weatherHeading: "Wetterhimmel",
			weatherDesc:
				"Die Kulisse des Boards wird zu einem gemalten Himmel - demselben, den der künstlerische Stil der " +
				"Wetter-Karte verwendet, über das ganze Fenster verteilt. Folge den echten Bedingungen über einem Ort (von Open-Meteo; nur die Koordinaten werden " +
				"gesendet, und nichts wird abgerufen, solange externe Aufrufe aus sind), oder fixiere einen " +
				"Himmel und behalte ihn, was keinen Standort braucht und nie online geht.",
			weatherNoPlace: "Wähle unten einen Ort, um den Himmel zu malen.",
			skySource: "Himmel",
			skySourceDesc:
				"Folge dem echten Wetter irgendwo oder behalte einen Himmel, egal was draußen los ist.",
			skySourceLive: "Live-Wetter",
			skySourceFixed: "Ein fester Himmel",
			skyCondition: "Wetterlage",
			skyConditionDesc: "Das Wetter, das dieser Himmel immer zeigt.",
			skyDaylight: "Tageszeit",
			skyDaylightDesc: "Ob der Himmel deiner Uhr folgt oder Tag oder Nacht bleibt.",
			skyDaylightAuto: "Der Uhr folgen",
			skyDaylightDay: "Immer Tag",
			skyDaylightNight: "Immer Nacht",
			skyAnimate: "Himmel animieren",
			skyAnimateDesc:
				"Ziehende Wolken, fallender Regen und funkelnde Sterne hinter dem Board. Immer " +
				"aus im Energiesparmodus und für Leser, deren System reduzierte Bewegung wünscht.",
		},
		behaviour: {
			heading: "Verhalten",
			headingDesc:
				"Wann und wo Hearth geöffnet wird, und der Nur-Suche-Modus für Smartphone/Tablet.",
			openOnStartup: "Beim Start öffnen",
			openOnStartupDesc: "Die Startansicht öffnen, wenn der Vault geladen wird.",
			replaceNewTabs: "Neue Tabs ersetzen",
			replaceNewTabsDesc: "Die Startansicht statt eines leeren neuen Tabs anzeigen.",
			focusSearchOnOpen: "Suche beim Öffnen fokussieren",
			focusSearchOnOpenDesc:
				"Setze den Cursor bei jeder geöffneten Startansicht in das Suchfeld, sodass " +
				"du sofort lostippen kannst. Nur Desktop.",
			liveRefresh: "Live-Aktualisierung bei Vault-Änderungen",
			liveRefreshDesc:
				"Halte eine geöffnete Startansicht aktuell, wenn sich der Vault ändert - Aktuell-, Lesezeichen- " +
				"und Karten mit gespeicherten Abfragen aktualisieren sich ohne erneutes Öffnen des Tabs. Zurückwechseln auf " +
				"den Hearth-Tab aktualisiert ihn immer, unabhängig von dieser Einstellung.",
			liveSettingsSync: "Synchronisierte Änderungen übernehmen",
			liveSettingsSyncDesc:
				"Wende Dashboard-Änderungen von einem anderen Gerät an, sobald der Sync sie " +
				"hereinbringt, statt erst beim nächsten Obsidian-Neustart. Lasse dies an, außer " +
				"wenn ein Board, das sich mitten in der Sitzung neu lädt, dich stört.",
			mobileSearchOnly: "Mobilmodus (nur Suche)",
			mobileSearchOnlyDesc:
				"Blende auf Smartphones und Tablets das Dashboard aus und zeige nur das " +
				"Suchfeld. Keine Wirkung auf dem Desktop.",
			stackOnNarrow: "Karten auf schmalen Bildschirmen stapeln",
			stackOnNarrowDesc:
				"Wenn das Board zu schmal für sein Layout ist - ein Smartphone oder ein schmaler " +
				"Bereich auf dem Desktop - zeige die Karten stattdessen als eine Spalte in voller Breite " +
				"an. Dein Layout bleibt unberührt und kehrt bei voller Breite zurück. " +
				"Jede Karte kann für diese Spalte in ihren eigenen Einstellungen ausgeblendet, umsortiert, in der Größe geändert oder eingeklappt werden.",
			mobilePerformanceTier: "Leistungsstufe auf Mobilgeräten",
			mobilePerformanceTierDesc:
				"Die Stufe für Smartphones und Tablets, wo der animierte Himmel und " +
				"das Milchglas auf dem kleinsten Bildschirm gezeichnet und aus dem " +
				"Akku bezahlt werden. Deine Desktop-Stufe bleibt getrennt erhalten und wird nicht geändert.",
			mobileTierMatch: "Wie Desktop",
			disableExternalCalls: "Externe Aufrufe deaktivieren",
			disableExternalCallsDesc:
				"Blockiere alle ausgehenden Netzwerkanfragen von Hearth, einschließlich Jira, " +
				"externer Kalender, RSS-Feeds, der Währungsumrechnung des Rechners " +
				"und Hintergrundbildern sowie Titelsymbolen als Webadresse - diese " +
				"fallen auf kein Bild und den Hearth-Kristall zurück.",
			openIn: "Notizen öffnen in",
			openInDesc:
				"Wohin eine Notiz geht, wenn du sie aus Hearth öffnest. „Aktueller Tab“ ersetzt " +
				"die Startansicht, sodass sich Hearth wie jeder andere Tab verhält. Strg/Cmd-Klick öffnet immer " +
				"trotzdem einen neuen Tab.",
			openInModes: {
				tab: "Ein neuer Tab",
				same: "Der aktuelle Tab (Hearth ersetzen)",
				split: "Ein geteilter Bereich",
				window: "Ein neues Fenster",
			},
			/** Die zusätzliche Auswahl, die jedes Dropdown pro Quelle neben den vier
			 * Zielen bietet: folge dem, worauf „Notizen öffnen in“ eingestellt ist. */
			openInFollow: "Wie oben",
			openInSources: {
				link: "Links",
				linkDesc: "Links in Notizen, Aufgaben und der Links-Karte.",
				search: "Suchergebnisse",
				searchDesc: "Treffer aus der Suchleiste und der Suche-Karte.",
				card: "Notizen in Karten",
				cardDesc:
					"Notizen, die von Aktuell-, Lesezeichen-, Favoriten-, Kalender-, Aktivitäts- und " +
					"Aufgaben-Karten sowie von mobilen Aktionsschaltflächen aufgelistet werden.",
				newNote: "Notizen, die Hearth erstellt",
				newNoteDesc: "Neue Notizen, Tagesnotizen und Ereignisnotizen, geöffnet sobald sie erstellt werden.",
			},
			openFromOutside: "Notizen, die von außerhalb von Hearth geöffnet werden",
			openFromOutsideDesc:
				"Der Datei-Explorer, der Schnellwechsler, der Graph - und alles, was eine Karte " +
				"einbettet und Links selbst öffnet. Obsidian übergibt diese an den jeweils " +
				"fokussierten Tab, sodass ein Hearth-Tab übernommen wird. Wähle „einen neuen Tab“, um " +
				"den Hearth-Tab zu behalten; der Datei-Explorer folgt dann nicht mehr dem, was du öffnest.",
			openFromOutsideModes: {
				same: "Der aktuelle Tab (Hearth ersetzen)",
				tab: "Ein neuer Tab (Hearth offen halten)",
			},
		},
		mobileActions: {
			heading: "Mobile Aktionsleiste",
			headingDesc:
				"Im Mobilmodus (nur Suche) ersetzt diese Schaltflächenzeile die " +
				"Schaltfläche „Neue Notiz“ neben der Suchleiste und erscheint stattdessen unter dem " +
				"Suchfeld und den Filtern. Jede Schaltfläche kann einen Befehl ausführen, " +
				"eine Notiz oder Datei öffnen oder eine URL öffnen - genau wie eine Kachel der Zentrale.",
			showActionBar: "Aktionsleiste anzeigen",
			showActionBarDesc:
				"Zeige die Zeile mit Aktionsschaltflächen unter dem Suchfeld im Mobilmodus an.",
			labelPlaceholder: "Beschriftung",
			iconPlaceholder: "Symbol",
			commandTooltip: (id: string) => `Befehl: ${id}`,
			pickCommand: "Befehl wählen",
			moveUp: "Nach oben verschieben",
			moveDown: "Nach unten verschieben",
			removeButton: "Schaltfläche entfernen",
			addButton: "Schaltfläche hinzufügen",
			resetDefaults: "Auf Standards zurücksetzen",
		},
		/** Der vollständige Katalog oben im Integrationen-Tab. Jede
		 * Integration ist hier aufgeführt, ob sie eine Einstellung hat oder nicht und ob
		 * das Plugin installiert ist oder nicht - siehe `src/integrations.ts`. */
		integrations: {
			heading: "Alle Integrationen",
			headingDesc:
				"Alles, womit Hearth arbeiten kann, aufgeführt ob installiert oder nicht. " +
				"Die meisten Integrationen brauchen keine Einrichtung - die, die es tun, sagen, wo ihre " +
				"Einstellungen liegen.",
			groups: {
				plugin: "Community-Plugins",
				pluginDesc: "Hearth erkennt diese automatisch, sobald sie aktiviert sind.",
				core: "Obsidian-Core-Plugins",
				coreDesc:
					"In Obsidian eingebaut. Aktiviere sie unter Einstellungen → Core-Plugins, wenn eine " +
					"Karte meldet, dass eines fehlt.",
				service: "Externe Dienste",
				serviceDesc:
					"Karten, die über das Netzwerk abrufen. Alle werden auf einmal stummgeschaltet " +
					"durch „Externe Aufrufe deaktivieren“ unter Verhalten → Datenschutz & Netzwerk.",
			},
			status: {
				enabled: "Aktiviert",
				disabled: "Deaktiviert",
				missing: "Nicht installiert",
				external: "Netzwerk",
				always: "Immer verfügbar",
			},
			/** Tooltip auf der Statusplakette, der erklärt, was er für Hearth bedeutet. */
			statusTooltip: {
				enabled: "Installiert und aktiviert - Hearth verwendet es.",
				disabled: "Installiert, aber ausgeschaltet, sodass Hearth es gerade nicht nutzen kann.",
				missing: "Nicht installiert. Alles andere in Hearth funktioniert ohne es.",
				external: "Eine ausgehende Anfrage, kein Plugin.",
				always: "Nichts zu installieren.",
			},
			/** Wo die Einstellungen dieser Integration liegen, angezeigt unter der Beschreibung. */
			where: {
				section: "Einstellungen unten auf diesem Tab.",
				tab: (tab: string) => `Einstellungen unter ${tab}.`,
				card: "Wird auf der Karte selbst konfiguriert, auf deinem Dashboard.",
				pluginSettings: "Verwendet die eigenen Einstellungen dieses Plugins - nichts in Hearth einzustellen.",
				none: "Nichts zu konfigurieren.",
			},
			/** Zeilenschaltflächen. */
			install: "Installieren",
			installTooltip: "Öffne dieses Plugin in Obsidians Community-Plugin-Browser.",
			goToSection: "Anzeigen",
			goToTab: "Öffnen",
			/** Ein Eintrag pro ID in `INTEGRATIONS`. */
			items: {
				omnisearch: {
					name: "Omnisearch",
					desc:
						"Schaltet die Suchleiste auf Omnisearchs unscharfen Volltextindex " +
						"statt Hearths integrierter Engine um. Wähle die Engine unter " +
						"Suche → Suchleiste; die Auswahl bleibt nur, solange Omnisearch aktiviert ist.",
				},
				tasknotes: {
					name: "TaskNotes",
					desc:
						"Lässt Aufgaben-Karten TaskNotes-Vaults mit einer Notiz pro Aufgabe lesen - Status, " +
						"Fälligkeitsdatum und Priorität direkt aus dem Frontmatter.",
				},
				dataview: {
					name: "Dataview",
					desc:
						"Die Dataview-Karte führt DQL-Abfragen und DataviewJS-Blöcke aus und stellt sie " +
						"mit Dataviews eigenen Darstellungen dar, aktualisiert bei Indexänderungen.",
				},
				datacore: {
					name: "Datacore",
					desc:
						"Dataviews Nachfolger. Die Datacore-Karte führt eine Datacore-Abfrage - oder ein " +
						"JS/JSX/TS/TSX-Skript - aus und stellt sie mit Datacores eigenen Live-Ansichten dar.",
				},
				templater: {
					name: "Templater",
					desc:
						"Die Karte „Neue Notiz aus Vorlage“ verwandelt deine Templater-Vorlagen in " +
						"Schaltflächen: Jede Kachel trägt ihre eigene Vorlage, Zielordner und " +
						"Dateinamensmuster, und ein Klick erstellt die Notiz. Templater übernimmt das " +
						"Templating - deine Benutzerskripte, tp.system.prompt()-Dialoge und die " +
						"Cursorposition verhalten sich alle so wie bei seinem eigenen Befehl.",
				},
				periodicNotes: {
					name: "Periodic Notes",
					desc:
						"Die Periodische-Notiz-Karte zeigt die Notiz dieser Woche, dieses Monats, Quartals oder " +
						"Jahres, aufgelöst - und aus deiner eigenen Vorlage erstellt - durch " +
						"Periodic Notes selbst.",
				},
				git: {
					name: "Git",
					desc:
						"Die Git-Karte zeigt Branch, Änderungen und letzte " +
						"Commits deines Repositorys und committet, synchronisiert, pusht und pullt über das " +
						"Git-Plugin selbst - dessen Remote, Zugangsdaten und Commit-Nachrichten-" +
						"Vorlage gelten unverändert.",
				},
				operon: {
					name: "Operon",
					desc:
						"Die Operon-Karten - Aufgaben, Board, Agenda und Timer - lesen über " +
						"Operons eigene Developer API, sodass dessen Status, Prioritäten und " +
						"Wiederholungen von ihm definiert bleiben. Nur Desktop, braucht Obsidian 1.12.2 " +
						"oder neuer, und Operon muss Hearths Leseanfrage genehmigen.",
				},
				iconic: {
					name: "Iconic",
					desc:
						"Mit Iconic gesetzte Dateisymbole erscheinen überall, wo Hearth eine Datei auflistet - " +
						"Aktuell, Favoriten, gespeicherte Suchen und Suchergebnisse.",
				},
				iconize: {
					name: "Iconize",
					desc:
						"Dasselbe für Iconize (ehemals Obsidian Icon Folder), einschließlich Symbolen, " +
						"die über eine Frontmatter-Eigenschaft gesetzt wurden.",
				},
				excalidraw: {
					name: "Excalidraw",
					desc:
						"Einbettungs-Karten stellen Excalidraw-Zeichnungen live dar, und die Aktion „Neue Zeichnung“ " +
						"erstellt eine über Excalidraws eigenen Befehl.",
				},
				bases: {
					name: "Bases",
					desc: "Einbettungs-Karten können eine Bases-Ansicht (.base) auf dem Dashboard zeigen.",
				},
				canvas: {
					name: "Canvas",
					desc: "Einbettungs-Karten können ein Canvas zeigen, interaktiv und von Kante zu Kante.",
				},
				dailyNotes: {
					name: "Tägliche Notizen",
					desc:
						"Die Tagesnotiz-, Minikalender- und Vault-Statistik-Karten lösen die heutige " +
						"Notiz aus Ordner, Datumsformat und Vorlage von Tägliche Notizen auf.",
				},
				bookmarks: {
					name: "Lesezeichen",
					desc: "Die Lesezeichen-Karte listet deine Obsidian-Lesezeichen, samt Gruppen.",
				},
				globalSearch: {
					name: "Suche",
					desc:
						"Übergibt eine Abfrage an Obsidians eigene Suchansicht, wenn du die " +
						"vollständigen Ergebnisse anforderst.",
				},
				fileExplorer: {
					name: "Datei-Explorer",
					desc: "Ermöglicht „Im Datei-Explorer anzeigen“ in Hearths Suchergebnissen.",
				},
				workspaces: {
					name: "Arbeitsbereiche",
					desc: "Ein Dashboard kann beim Öffnen zu einem gespeicherten Arbeitsbereich wechseln.",
				},
				audioRecorder: {
					name: "Diktiergerät",
					desc:
						"Die mobile Aktionsschaltfläche „Sprache aufnehmen“ startet und stoppt Obsidians " +
						"eigenes Diktiergerät.",
				},
				leafViews: {
					name: "Jedes Plugin mit einer Seitenleiste",
					desc:
						"Die Plugin-Ansicht-Karte beherbergt die registrierte Ansicht eines anderen Plugins - " +
						"Kalender, Kanban-Boards, Gliederungen, Tag-Bereiche - direkt in einer Karte. " +
						"Was auch immer installiert ist, erscheint in der Ansichtsauswahl der Karte.",
				},
				jira: {
					name: "Jira",
					desc:
						"Jira-Karten rufen Vorgänge aus deiner Jira-Cloud- oder Server-Instanz über " +
						"dessen REST-API ab, mit Zugangsdaten, die du auf der Karte eingibst.",
				},
				rss: {
					name: "RSS- und Atom-Feeds",
					desc: "RSS-Karten rufen jeden RSS-2.0- oder Atom-Feed ab und parsen ihn, auf den du sie zeigst.",
				},
				ics: {
					name: "iCalendar-Feeds",
					desc:
						"Minikalender-Karten können externe ICS-/Webcal-Kalender abonnieren - " +
						"Google, iCloud, Fastmail, Nextcloud und Freunde.",
				},
				currency: {
					name: "Wechselkurse",
					desc:
						"Die Rechner-Karte rechnet Währungen mit EZB-Kursen über die kostenlose, " +
						"schlüssellose Frankfurter API um.",
				},
				weather: {
					name: "Wettervorhersagen",
					desc:
						"Wetter-Karten - und der Live-Wetterhimmel als Hintergrund - rufen Bedingungen " +
						"von Open-Meteo ab: kostenlos, ohne Schlüssel, ohne Konto. Nur die Koordinaten, die du " +
						"wählst, werden jemals gesendet, und ein auf eine Lage fixierter Himmel braucht gar " +
						"keinen Standort.",
				},
				webSearch: {
					name: "Websuche",
					desc:
						"Die Schaltfläche der Suchleiste kann deine Anfrage an DuckDuckGo senden, statt " +
						"eine Notiz zu erstellen. Wechsle dies unter Suche → Suchleiste.",
				},
			},
		},
		tasks: {
			heading: "Aufgaben / TaskNotes",
			headingDesc:
				"Feldnamen, die Aufgaben-Karten im TaskNotes-Modus lesen. TaskNotes hat keine " +
				"stabile API für andere Plugins, daher liest dies dessen Frontmatter direkt " +
				"- gleiche diese mit dem ab, worauf TaskNotes' eigene Einstellungen sie gemappt haben " +
				"(die Standards unten sind TaskNotes' eigene Standards).",
			statusField: "Statusfeld",
			statusFieldDesc: "Frontmatter-Feld, das für den Status einer Aufgabe gelesen wird.",
			dueField: "Fälligkeitsfeld",
			dueFieldDesc: "Frontmatter-Feld, das für das Fälligkeitsdatum einer Aufgabe gelesen wird.",
			priorityField: "Prioritätsfeld",
			priorityFieldDesc:
				"Frontmatter-Feld, das für die Prioritätsanzeige einer Aufgabe gelesen wird.",
			doneValue: "Statuswert „Erledigt“",
			doneValueDesc: "Der Statuswert, der eine TaskNotes-Aufgabe als erledigt markiert.",
			fieldsEnable: "Aufgabenfelder anpassen",
			fieldsEnableDesc:
				"Ersetze die festen Metadaten, die Aufgaben-Karten zeigen, durch Felder, die du " +
				"selbst definierst - jede Frontmatter-Eigenschaft oder alles, was Hearth liest, benannt, " +
				"eingefärbt und sortiert, wie du magst. Standardmäßig aus, und Aufgaben behalten " +
				"ihr übliches Aussehen, bis du es einschaltest. Einschalten startet mit einer " +
				"leeren Liste: Aufgaben zeigen nur die Felder, die du hinzufügst.",
			fields: "Felder auf einer Aufgabe",
			fieldsDesc:
				"Die Felder, die jede Aufgaben-Karte zeigt. Eine einzelne Karte kann stattdessen eigene " +
				"definieren, in den Einstellungen dieser Karte.",
		},
		fileIcons: {
			heading: "Dateisymbole / Iconic / Iconize",
			headingDesc:
				"Verwende die Dateisymbole, die du mit den Iconic- oder " +
				"Iconize-Plugins gesetzt hast, überall wo Hearth eine Datei zeigt - Aktuell, Favoriten, gespeicherte " +
				"Suchen und die Suchleiste. Lucide-Symbole und Emoji werden gezeigt; " +
				"Dateien mit einem Symbol aus einem heruntergeladenen Symbolpaket behalten Hearths eigenes " +
				"Dateitypsymbol.",
			enable: "Symbole aus Iconic / Iconize verwenden",
			enableDesc:
				"Aus zeigt Hearths Dateitypsymbol für jede Datei und ignoriert beide Plugins.",
			enableDescNoPlugin:
				"Weder Iconic noch Iconize ist gerade aktiviert, daher zeigt jede Datei " +
				"Hearths Dateitypsymbol. Dies kann an bleiben - es greift, " +
				"sobald eines davon installiert ist.",
			property: "Iconize-Frontmatter-Eigenschaft",
			propertyDesc:
				"Eigenschaft, in der Iconize das Symbol einer Notiz speichert, für Symbole, die über " +
				"Frontmatter statt über sein Menü gesetzt wurden. Gleiche dies mit Iconizes eigener " +
				"Einstellung ab, falls du sie umbenannt hast (Standard ist „icon“).",
		},
		operon: {
			heading: "Operon",
			headingDesc:
				"Lies Aufgaben, Boards, Agenden und den laufenden Timer aus dem " +
				"Operon-Plugin über dessen eigene Developer API - Operon bleibt die Quelle der " +
				"Wahrheit dafür, was eine Aufgabe ist, und Hearth zeigt nur an, was es zurückgibt.",
			enable: "Mit Operon verbinden",
			enableDesc:
				"Aus ist ein Notausschalter: Operon-Karten lesen nichts mehr und Hearth " +
				"bittet Operon nie um Zugriff. Nichts wird angefragt, bis eine Operon-Karte " +
				"auf einem Dashboard liegt.",
			status: "Verbindung",
			statusAbsent: "Operon ist nicht installiert oder aktiviert.",
			statusUnsupported:
				"Operons Developer API ist nur für Desktop und braucht Obsidian 1.12.2 oder neuer.",
			statusBooting: "Operon läuft, startet aber noch.",
			statusPending:
				"Wartet auf Genehmigung. Öffne Einstellungen → Operon → Core → General → " +
				"Developer API Integrations und genehmige Hearth.",
			statusSuspended:
				"Zugriff ist ausgesetzt. Prüfe Hearths ausstehenden Umfang in Operons " +
				"Developer API Integrations.",
			statusRevoked:
				"Zugriff wurde entzogen. Gewähre ihn erneut in Operons Developer API Integrations.",
			statusReady: "Verbunden - Operon-Karten können Aufgaben lesen.",
			statusIdle: "Noch nicht verbunden. Füge eine Operon-Karte hinzu, um eine Sitzung zu öffnen.",
			statusOff: "Die Integration ist ausgeschaltet, daher liest Hearth nichts aus Operon.",
			statusError: "Operon hat die Verbindung abgelehnt.",
			detail: "Operon meldete",
			install: "Operon in den Community-Plugins öffnen",
			writes: "Änderungen erlauben",
			writesDesc:
				"Lässt die Board-Karte eine Aufgabe per Ziehen in einen anderen Status verschieben und " +
				"fügt ein „+“ zum Erstellen hinzu. Operon entscheidet, wohin eine neue Aufgabe geht und " +
				"ob ein Verschieben zulässig ist; Hearth fragt nur an. Einschalten erweitert, was " +
				"Hearth anfragt, daher musst du es erneut in Operons " +
				"Developer API Integrations genehmigen. Aus bedeutet, Hearth kann nur lesen.",
			writesPending:
				"Lesen funktioniert, aber die Änderungsrechte wurden noch nicht gewährt - " +
				"genehmige Hearth erneut in Operons Developer API Integrations. Bis dahin " +
				"bleiben die Karten schreibgeschützt.",
			capabilities: "Angefragter Zugriff",
			capabilitiesDesc:
				"Hearth fragt all dies auf einmal an, weil Operon keine teilweise genehmigte Sitzung öffnet. Schreibgeschützt, außer „Änderungen erlauben“ ist an, was " +
				"die Rechte für Aufgabenübergänge und Aufgabenerstellung hinzufügt.",
			missing: (names: string) => `Noch nicht gewährt: ${names}`,
			recheck: "Erneut prüfen",
			recheckDesc:
				"Öffne die Verbindung erneut, nachdem du Operon genehmigt, entzogen oder neu geladen hast.",
			recheckAction: "Jetzt erneut prüfen",
		},
		filters: {
			heading: "Suchfilter",
			headingDesc:
				"Filter werden aus den Dateitypen in deinem Vault automatisch erkannt. Blende aus, was du nicht willst.",
		},
		dashboard: {
			heading: "Dashboard",
			headingDesc:
				"Größe und Transparenz des Kartenrasters. Karten selbst werden auf dem Board hinzugefügt und eingerichtet.",
			fitToPage: "An Seite anpassen",
			fitToPageDesc:
				"Halte das Dashboard auf einem Bildschirm, statt Scrollen zu erlauben.",
			compact: "Kompakte Abstände",
			compactDesc:
				"Verkleinere Kartenabstand und oberen Rand, um die nutzbare Fläche zu vergrößern.",
			arrangeButtonVisibility: "Sichtbarkeit der Anordnen-Schaltfläche",
			arrangeButtonVisibilityDesc:
				"Wähle, ob die Anordnen-/Bearbeiten-Schaltfläche immer sichtbar ist oder beim Darüberfahren mit der Maus erscheint.",
			dashboardSwitcherVisibility: "Sichtbarkeit der Dashboard-Umschaltung",
			dashboardSwitcherVisibilityDesc:
				"Wähle, ob die Dashboard-Schaltflächen oben links immer sichtbar sind oder beim Darüberfahren mit der Maus erscheinen.",
			visibilityOptions: {
				always: "Immer sichtbar",
				hover: "Beim Darüberfahren zeigen",
			},
			cardOpacity: "Kartendeckkraft",
			cardOpacityDesc:
				"Transparente Kartenhintergründe, sodass der Dashboard-Hintergrund durchscheint.",
			cardBlur: "Kartenweichzeichnung",
			cardBlurDesc:
				"Milchglas-Weichzeichner hinter durchscheinenden Karten. Braucht eine Kartendeckkraft unter 100 %, um zu wirken. 0 = aus.",
			cardRadius: "Eckenradius der Karten",
			cardRadiusDesc:
				"Wie rund Kartenecken sind, in Pixeln. 14 ist der Standard; niedriger macht Ecken kantiger.",
			cardBorderWidth: "Kartenrahmen",
			cardBorderWidthDesc:
				"Stärke des Kartenrahmens und der Kopfzeilentrennlinie, in Pixeln. 0 blendet den Rahmen aus.",
			cards: "Karten",
			cardsDesc:
				"Füge Karten auf dem Dashboard selbst hinzu und richte sie ein: Öffne die Startansicht, " +
				"tippe auf Anordnen und verwende dann Karte hinzufügen, Dashboard-Einstellungen und die " +
				"Einstellungsschaltfläche jeder Karte.",
		},
		layout: {
			heading: "Import / Export",
			headingDesc:
				"Teile ein Dashboard oder sichere dein gesamtes Setup als JSON-Datei.",
			exportDashboard: "Dieses Dashboard exportieren",
			exportDashboardDesc:
				"Speichere das Dashboard, auf dem du bist, als Datei, die andere importieren können. Alles zu seinem Aussehen kommt mit, und du kannst wählen, ob sein Hintergrundbild eingeschlossen wird.",
			exportDashboardButton: "Dashboard exportieren…",
			importAny: "Importieren",
			importAnyDesc:
				"Öffne eine Hearth-Datei - ein Dashboard, ein Layout oder eine vollständige Sicherung. Sie sagt dir, was drin ist, bevor sich etwas ändert, und ein einzelnes Dashboard wird neben deinen eigenen hinzugefügt, statt etwas zu ersetzen.",
			export: "Layout exportieren",
			exportDesc:
				"Lade jedes Dashboard samt Raster- und Layout-Einstellungen als JSON-Datei herunter.",
			exportButton: "Datei exportieren",
			exportMobileTooltip:
				"Auf Mobilgeräten wird die Datei im Stammordner deines Vaults gespeichert.",
			importButton: "Datei importieren",
			exportSettings: "Einstellungen exportieren",
			exportSettingsDesc:
				"Lade jede Hearth-Einstellung herunter - das vollständige Layout plus Kopfzeile, Hintergrund, " +
				"Verhalten, Erscheinungsbild und TaskNotes-Optionen - als JSON-Sicherungsdatei.",
		},
	},
	// ---- Karteneinstellungen ------------------------------------------
	editors: {
		title: "Karteneinstellungen",
		/** Wird als Tooltip für Kachelsymbol-Felder angezeigt (Zentrale, Befehle). */
		iconHelp:
			"Gib eine Lucide-Symbol-ID ein (z. B. „home“, „star“, „calendar“) - stöbere unter " +
			"lucide.dev/icons. Du kannst auch einen Vault-Bildpfad eingeben (z. B. " +
			"Attachments/icon.png), um dein eigenes Bild als Symbol zu verwenden.",
		/** Tabs oben im Dialog der Karteneinstellungen. */
		tabs: {
			content: "Inhalt",
			style: "Stil",
			layout: "Layout",
		},
		type: "Typ",
		typeDesc: "Was diese Karte zeigt.",
		cardTitle: "Titel",
		cardTitleDesc:
			"Wird in der Kopfzeile der Karte angezeigt. Leer lassen für eine Karte ohne Kopfzeile.",
		cardTitlePlaceholder: "Titel",
		mobile: {
			heading: "Auf einem schmalen Board",
			hidden: "Ausblenden",
			hiddenDesc:
				"Diese Karte weglassen, wenn das Board zu einer Spalte gestapelt wird. Für Karten, die Breite brauchen, um sinnvoll zu sein - eine breite Tabelle, eine Board-Ansicht - ist Ausblenden besser als Quetschen.",
			collapsed: "Zugeklappt starten",
			collapsedDesc:
				"Nur die Titelzeile der Karte zeigen und die Karte erst aufbauen, wenn sie angetippt wird. Eine Karte, die niemand öffnet, kostet eine Zeile und führt nichts aus.",
			height: "Höhe",
			heightDesc:
				"Höhe in Pixeln im gestapelten Zustand. Leer gelassen behält die Karte ihre eigene Höhe, begrenzt, sodass eine hohe Karte den Bildschirm nicht allein füllen kann.",
			order: "Position",
			orderDesc:
				"Wo diese Karte im Stapel steht, gezählt ab 0. Leer gelassen folgt sie der Lesereihenfolge des Boards - von oben nach unten, von links nach rechts.",
			autoPlaceholder: "Auto",
		},
		resetSize: "Auf Standardgröße zurücksetzen",
		removeCard: "Karte entfernen",
		removeCardTitle: "Karte entfernen?",
		removeCardMessage: (name: string) => `„${name}“ aus dem Dashboard entfernen?`,
		removeCardConfirm: "Entfernen",
		thisCard: "diese Karte",
		done: "Fertig",
		kinds: {
			embed: "Einbetten (Notiz / Bild / base)",
			slideshow: "Diashow",
			daily: "Tagesnotiz (heute)",
			periodic: "Periodische Notiz (Woche / Monat / Jahr)",
			web: "Webseite (iframe)",
			bookmarks: "Lesezeichen",
			favorites: "Favoriten",
			text: "Text / Kurznotiz",
			recent: "Letzte Dateien",
			links: "Links / Zentrale",
			commands: "Befehle",
			templater: "Neue Notiz aus Vorlage",
			clock: "Uhr & Begrüßung",
			tasks: "Aufgaben",
			calendar: "Mini-Kalender",
			schedule: "Kalender",
			stats: "Vault-Statistiken",
			search: "Abfrage",
			searchbar: "Suchleiste",
		heatmap: "Aktivitätskarte",
			calculator: "Rechner",
			dataview: "Dataview-Abfrage",
			datacore: "Datacore-Abfrage",
			rss: "RSS-Feed",
			jira: "Jira-Filter",
			weather: "Wetter",
			git: "Git",
			operon: "Operon",
			leaf: "Plugin-Ansicht (Beta)",
			pet: "Haustier",
		},
		linkTypes: {
			note: "Notiz",
			url: "URL",
			command: "Befehl",
		},
		embed: {
			file: "Einzubettende Datei",
			fileDesc: "Eine Notiz, ein Bild, ein Canvas oder eine .base-Datei in deinem Vault.",
			filePlaceholder: "Einzubettender Dateipfad",
			pickFile: "Datei wählen",
			baseView: "Base-Ansicht",
			baseViewDesc: "Wähle eine Ansicht aus dieser .base-Datei oder verwende die Standardansicht.",
			baseViewDefault: "Standardansicht",
			baseViewFileMissing: "Die gewählte .base-Datei wurde nicht gefunden.",
			baseViewLoadError: "Die Ansichten der .base-Datei konnten nicht gelesen werden. Die Standardansicht wird verwendet.",
			baseViewNoViews: "In dieser .base-Datei wurden keine benannten Ansichten gefunden. Die Standardansicht wird verwendet.",
			baseViewUnsupported: (count: number) =>
				`${count} ${count === 1 ? "Ansicht" : "Ansichten"} mit nicht unterstützten Wikilink-Zeichen ausgeblendet.`,
			zoom: "Zoom",
			zoomDesc:
				"Skaliert den eingebetteten Inhalt. Gilt, wenn du diesen Dialog schließt.",
			zoomImageDesc:
				"Skaliert das Bild innerhalb des Rahmens, in den es eingepasst wurde - ein " +
				"beschnittenes Bild wird beim Zoomen weiter beschnitten. Gilt, wenn du diesen Dialog schließt.",
			imageFit: "Bildanpassung",
			imageFitDesc:
				"Wie das Bild die Karte füllt. Jeder Modus außer dem ersten gibt ihm " +
				"die ganze Karte, von Kante zu Kante.",
			imageFits: {
				natural: "Originalgröße",
				contain: "Ganzes Bild einpassen",
				cover: "Karte füllen (zuschneiden)",
				stretch: "Auf Karte strecken",
				width: "An Breite anpassen (scrollen)",
			},
			imagePosition: "Bildposition",
			imagePositionDesc: "Wo das Bild in der Karte sitzt.",
			imagePositionCropDesc: "Welcher Teil des Bildes beim Zuschneiden behalten wird.",
			imagePositions: {
				"top-left": "Oben links",
				top: "Oben",
				"top-right": "Oben rechts",
				left: "Links",
				center: "Mitte",
				right: "Rechts",
				"bottom-left": "Unten links",
				bottom: "Unten",
				"bottom-right": "Unten rechts",
			},
			editable: "Bearbeitbar",
			editableDesc:
				"Den Text der eingebetteten Notiz direkt bearbeiten (nur Markdown-Notizen).",
			livePreview: "Live-Vorschau",
			livePreviewDesc:
				"In Obsidians eigenem Live-Preview-Editor bearbeiten statt im einfachen " +
				"Roh-Markdown-Feld, sodass die Formatierung beim Tippen dargestellt wird. Ausgeschaltet wird die " +
				"rohe Markdown-Quelle gezeigt, bearbeitet per Doppelklick.",
			hideBaseHeader: "Base-Kopfzeile ausblenden",
			hideBaseHeaderDesc:
				"Bei eingebetteten .base-Dateien die eigene Werkzeugleiste der Bases-Ansicht ausblenden (Ansichtswechsler und Filter-/Eigenschaftssteuerung), sodass nur die Ergebnisse zu sehen sind.",
			secondViewHeading: "Zweite Ansicht",
			secondViewFile: "Zweite einzubettende Datei",
			secondViewFileDesc:
				"Optional. Wenn gesetzt, zeigt die Karte einen Wechsler zwischen beiden Ansichten - in der Kopfzeile, wenn die Karte einen Titel hat, oder schwebend (bei Hover), wenn nicht.",
			secondViewClear: "Zweite Ansicht entfernen",
			openButton: "Öffnen-Button",
			openButtonDesc:
				"Eine Schaltfläche anzeigen, die die eingebettete Datei in einem eigenen Tab öffnet. Standardmäßig aus.",
		},
		slideshow: {
			source: "Bilder aus",
			sourceDesc:
				"Eine Liste, die du Bild für Bild wählst, oder alle Bilder in einem Ordner.",
			sourceList: "Eine Bilderliste",
			sourceFolder: "Ein Ordner",
			picturesHeading: "Bilder",
			picturesEmpty: "Noch keine Bilder - füge unten eines hinzu.",
			picturePlaceholder: "Bildpfad",
			captionPlaceholder: "Beschriftung (optional)",
			pickPicture: "Bild wählen",
			addPicture: "Bild hinzufügen",
			addFolderPictures: "Bilder eines Ordners hinzufügen",
			removePicture: "Bild entfernen",
			moveUp: "Nach oben",
			moveDown: "Nach unten",
			folder: "Ordner",
			folderDesc: "Jedes Bild in diesem Ordner wird gezeigt. Leer lassen für die Vault-Wurzel.",
			folderPlaceholder: "Attachments/Photos",
			pickFolder: "Ordner wählen",
			includeSubfolders: "Unterordner einschließen",
			includeSubfoldersDesc: "Auch Bilder in den Unterordnern dieses Ordners zeigen.",
			folderCount: (count: number) =>
				count === 1
					? "Hier wurde gerade 1 Bild gefunden."
					: `Hier wurden gerade ${count} Bilder gefunden.`,
			playbackHeading: "Wiedergabe",
			order: "Reihenfolge",
			orderDesc: "Die Reihenfolge, in der die Bilder gezeigt werden.",
			orders: {
				manual: "Listenreihenfolge",
				name: "Name (A → Z)",
				nameDesc: "Name (Z → A)",
				created: "Erstellungsdatum (älteste zuerst)",
				createdDesc: "Erstellungsdatum (neueste zuerst)",
				modified: "Änderungsdatum (älteste zuerst)",
				modifiedDesc: "Änderungsdatum (neueste zuerst)",
				random: "Zufällig",
			},
			advance: "Bildwechsel",
			advanceDesc:
				"Was die Karte weiterschaltet: ein Timer, der Kalender oder nur die " +
				"Steuerung. Eine Tageskarte bestimmt ihr Bild aus dem heutigen Datum, sodass es " +
				"den ganzen Tag bleibt, egal wie oft das Board neu gezeichnet wird - und sowohl sie als auch " +
				"eine manuelle Karte merken sich, wo sie standen.",
			advances: {
				timer: "Per Timer",
				daily: "Einmal am Tag",
				manual: "Nur manuell",
			},
			interval: "Sekunden pro Bild",
			intervalDesc:
				"Wie lange jedes Bild gezeigt wird. 0 hält das erste Bild und schaltet den " +
				"Wechsel aus; der Stromsparmodus pausiert ihn ebenfalls.",
			intervalAria: "Sekunden, die jedes Bild gezeigt wird",
			days: "Tage pro Bild",
			daysDesc:
				"Wie viele Tage jedes Bild bleibt, bevor das nächste übernimmt. " +
				"1 wechselt um Mitternacht; 7 gibt dir ein Bild der Woche.",
			daysAria: "Tage, die jedes Bild gezeigt wird",
			transition: "Übergang",
			transitionDesc: "Wie ein Bild dem nächsten weicht.",
			transitions: {
				none: "Schnitt (keine Animation)",
				fade: "Überblenden",
				slide: "Schieben",
				zoom: "Zoom",
			},
			transitionSpeed: "Übergangsdauer",
			transitionSpeedDesc: "Wie lange der Übergang dauert, in Millisekunden.",
			kenBurns: "Langsamer Zoom",
			kenBurnsDesc:
				"Langsam in jedes Bild hineinzoomen, während es gezeigt wird (der „Ken-Burns“-Effekt).",
			displayHeading: "Anzeige",
			fit: "Anpassung",
			fitDesc: "Wie jedes Bild die Karte füllt.",
			fits: {
				cover: "Karte füllen (zuschneiden)",
				contain: "Ganzes Bild einpassen",
			},
			controls: "Steuerung",
			controlsDesc:
				"Vorherige-/Pause-/Weiter-Schaltflächen und die Position bei Hover zeigen. Standardmäßig an.",
			caption: "Beschriftung",
			captionDesc:
				"Die Beschriftung jedes Bildes darüber anzeigen, ersatzweise seinen Dateinamen.",
			pauseOnHover: "Bei Hover pausieren",
			pauseOnHoverDesc: "Das aktuelle Bild halten, solange der Zeiger über der Karte ist.",
			openButton: "Öffnen-Button",
			openButtonDesc:
				"Eine Schaltfläche anzeigen, die das Bild in einem eigenen Tab öffnet. Standardmäßig aus.",
		},
		daily: {
			editable: "Bearbeitbar",
			editableDesc:
				"Die heutige Notiz direkt bearbeiten statt nur lesen. Speichert in den Vault.",
			openButton: "Öffnen-Button",
			openButtonDesc: "Eine Schaltfläche anzeigen, um die heutige Notiz im Editor zu öffnen.",
			info: "Tagesnotizen",
			infoDesc:
				"Die heutige Notiz wird aus Datumsformat und Ordner des Kern-Plugins für Tagesnotizen aufgelöst. Die Karte aktualisiert sich live, während du bearbeitest.",
		},
		periodic: {
			granularity: "Zeitraum",
			granularityDesc:
				"Welche periodische Notiz diese Karte zeigt. Es ist immer die aktuelle, sodass " +
				"die Karte von selbst weitergeht, wenn der Zeitraum endet.",
			granularities: {
				day: "Täglich",
				week: "Wöchentlich",
				month: "Monatlich",
				quarter: "Vierteljährlich",
				year: "Jährlich",
			},
			editable: "Bearbeitbar",
			editableDesc:
				"Die Notiz direkt bearbeiten statt nur lesen. Speichert in den Vault.",
			openButton: "Öffnen-Button",
			openButtonDesc: "Eine Schaltfläche anzeigen, um die Notiz im Editor zu öffnen.",
			info: "Periodic Notes",
			infoDesc:
				"Die Notiz wird aus eigenem Ordner, Datumsformat " +
				"und Vorlage des Periodic-Notes-Plugins aufgelöst, und eine fehlende wird von Periodic Notes " +
				"selbst erstellt. Die Karte aktualisiert sich live, während du bearbeitest.",
			missingDesc:
				"Diese Karte braucht das Community-Plugin Periodic Notes. Installiere und aktiviere " +
				"es und schalte dann hier den gewünschten Notiztyp ein.",
		},
		web: {
			url: "URL",
			urlPlaceholder: "https://example.com",
			trusted: "Vertrauenswürdige Seite",
			trustedDesc:
				"Gib der Seite Same-Origin-Zugriff (Cookies, Speicher). Aktiviere das nur " +
				"für Seiten, denen du vertraust - es lockert die Iframe-Sandbox.",
			autoRefresh: "Automatische Aktualisierung",
			autoRefreshDesc:
				"Rendere diese Karte alle N Sekunden neu, um Änderungen zu übernehmen. 0 = aus.",
			refreshIntervalAria: "Aktualisierungsintervall in Sekunden",
		},
		recent: {
			fit: "An Kartenhöhe anpassen",
			fitDesc:
				"Liste so viele Dateien, wie die Karte hoch genug anzeigt, statt einer " +
				"festen Anzahl. Wenn du die Größe der Karte änderst, ändert sich, wie viele erscheinen.",
			count: "Anzahl der Dateien",
			countDesc: (max: number) =>
				`Wie viele zuletzt geöffnete Dateien aufgelistet werden - höchstens ${max}, so ` +
				`weit reicht Hearths Verlauf zuletzt geöffneter Dateien zurück.`,
			types: "Dateitypen",
			typesDesc: "Liste nur Dateien der ausgewählten Typen. Wähle eine beliebige Kombination; ohne Auswahl werden alle Typen angezeigt.",
		},
		calendar: {
			view: "Layout",
			viewDesc: "Monat zeigt ein Raster; Agenda listet die kommenden Tage.",
			viewMonth: "Monatsraster",
			viewAgenda: "Agenda",
			agendaDays: "Tage im Voraus",
			agendaDaysDesc: "Wie viele Tage die Agenda ab heute auflistet.",
			weekNumbers: "Kalenderwochen",
			weekNumbersDesc: "Zeige eine Spalte mit ISO-Kalenderwochen am linken Rand.",
			heatmap: "Aktivitätskarte",
			heatmapDesc: "Färbe jeden Tag nach der Notizaktivität an diesem Tag.",
			heatmapCounts: "Anzahlen der Aktivitätskarte",
			externalCalendars: "Externe Kalender",
			externalCalendarsDesc:
				"Abonniere ICS/iCal-Feeds (Google, iCloud, Fastmail, Nextcloud…). Termine erscheinen als farbige Punkte im Raster und werden in der Agenda-Ansicht aufgelistet.",
			operonTasks: "Operon-Aufgaben anzeigen",
			operonTasksDesc:
				"Markiere Tage mit fälliger Operon-Aufgabe und liste diese Aufgaben in der " +
				"Agenda. Liest über Operons Entwickler-API, daher muss Operon " +
				"unter Einstellungen → Hearth → Integrationen freigegeben sein. Aufgaben, die nur " +
				"geplant sind (ohne Fälligkeitsdatum), sind nicht enthalten.",
			operonTaskColor: "Farbe der Operon-Aufgaben",
			operonTaskColorDesc: "Farbe der Aufgabenmarkierungen. Standard ist die Akzentfarbe.",
			sourceNamePlaceholder: "Name",
			sourceUrlPlaceholder: "ICS/iCal-URL (https:// oder webcal://)",
			sourceShow: "Diesen Kalender anzeigen",
			sourceHide: "Diesen Kalender ausblenden",
			sourceRemove: "Kalender entfernen",
			addCalendar: "Kalender hinzufügen",
			refresh: "Aktualisieren alle",
			refreshDesc: "Wie oft Kalender neu geladen werden, in Minuten. 0 lädt nur beim Öffnen.",
			eventNoteHeading: "Terminnotizen",
			eventNoteDesc:
				"Richte die „Notiz erstellen“-Aktion im Termin-Popup ein: Wähle eine Vorlage, einen Ordner und Dateinamen, und lege fest, was mit jedem Terminwert passiert.",
			eventNoteEnabled: "„Notiz erstellen“ anzeigen",
			eventNoteEnabledDesc: "Biete einen Button zum Erstellen einer Notiz im Termin-Details-Popup.",
			eventNoteFolder: "Ordner",
			eventNoteFolderDesc: "Wo neue Terminnotizen erstellt werden. Leer = Vault-Stamm.",
			eventNoteFilename: "Dateiname",
			eventNoteFilenameDesc: "Notizname. Platzhalter: {{summary}}, {{date}}, {{start}}, {{location}}, …",
			eventNoteTemplate: "Vorlage",
			eventNoteTemplateDesc:
				"Optionale Notiz, deren Inhalt den Text vorgibt. Dieselben {{…}}-Platzhalter werden ersetzt.",
			eventNotePickTemplate: "Vorlagendatei wählen",
			eventNoteClearTemplate: "Vorlage entfernen",
			eventNoteLinkKey: "Link-Eigenschaft",
			eventNoteLinkKeyDesc:
				"Frontmatter-Eigenschaft, die die ID des Termins speichert, sodass ein Termin immer genau einer Notiz zugeordnet ist. Leer, um die Verknüpfung zu deaktivieren.",
			eventNoteCustomize: "Feldzuordnung anpassen",
			eventNoteCustomizeDesc:
				"Aus nutzt sinnvolle Vorgaben (Datum & Uhrzeit als Eigenschaften, Beschreibung im Text). An lässt dich jeden Wert selbst zuordnen.",
			eventNoteFieldsHeading: "Feldzuordnung",
			eventNoteAddField: "Feld hinzufügen",
			eventNoteRemoveField: "Entfernen",
			eventFieldNames: {
				summary: "Name",
				date: "Datum",
				start: "Startzeit",
				end: "Endzeit",
				location: "Ort",
				description: "Beschreibung",
				url: "URL",
				calendar: "Kalender",
			},
			eventFieldActions: {
				ignore: "Ignorieren",
				frontmatter: "Eigenschaft",
				body: "An Text anhängen",
			},
			eventNotePropertyPlaceholder: "Eigenschaftsname",
			eventNoteHeadingPlaceholder: "Überschrift (optional)",
			eventNoteFormatPlaceholder: "Format (z. B. HH:mm)",
			chipsHeading: "Eintragsdetails",
			chipsDesc:
				"Wähle, was jeder Agenda-Eintrag neben seinem Titel zeigt. Schalte aus, was du nicht brauchst - auf einer schmalen Karte konkurrieren die Markierungen mit dem Titel selbst.",
			chipTime: "Uhrzeit",
			chipTimeDesc: "Die Startzeit oder „Ganztägig“.",
			chipSource: "Kalendername",
			chipSourceDesc: "Aus welchem Kalender ein Eintrag stammt. Wird nur bei mehr als einer Quelle angezeigt.",
			chipStatus: "Status",
			chipStatusDesc: "Der TaskNotes-Status einer Aufgabe, z. B. „In Bearbeitung“. Standardmäßig aus.",
			chipPriority: "Priorität",
			chipPriorityDesc: "Die TaskNotes-Priorität einer Aufgabe, z. B. „Hoch“.",
			chipDue: "Fälligkeitsmarkierung",
			chipDueDesc: "Das „Fällig“-Abzeichen an einem Eintrag mit Fälligkeitsdatum.",
			chipRecurring: "Wiederholungsmarkierung",
			chipRecurringDesc: "Das „Wiederkehrend“-Abzeichen an einer sich wiederholenden Aufgabe.",
			chipTimeblock: "Zeitblock-Markierung",
			chipTimeblockDesc: "Das „Zeitblock“-Abzeichen an einer Aufgabe mit Zeitblock.",
			taskNotesHeading: "TaskNotes",
			taskNotesDesc:
				"Nutze TaskNotes als Terminquelle. Die Karte spiegelt, was der eigene Kalender von TaskNotes zeigt - geplante Aufgaben, Fälligkeitsdaten, wiederkehrende Vorkommen, Zeitblöcke und die in TaskNotes abonnierten Kalender - mit den eigenen Feldnamen, Status und Farben von TaskNotes.",
			taskNotesMissing:
				"TaskNotes ist in diesem Vault nicht aktiviert. Installiere und aktiviere es, um es als Kalenderquelle zu nutzen.",
			taskNotesEnabled: "TaskNotes nutzen",
			taskNotesEnabledDesc: "Zeichne TaskNotes-Einträge in diesem Kalender.",
			taskNotesScheduled: "Geplante Aufgaben",
			taskNotesScheduledDesc:
				"Aufgaben an ihrem geplanten Datum, skaliert nach ihrer Zeitschätzung.",
			taskNotesDue: "Fälligkeitsdaten",
			taskNotesDueDesc: "Aufgaben an ihrem Fälligkeitsdatum.",
			taskNotesRecurring: "Wiederkehrende Aufgaben",
			taskNotesRecurringDesc:
				"Rolle eine wiederkehrende Aufgabe in einen Eintrag pro Vorkommen aus. Aus zeigt nur ihr nächstes Datum.",
			taskNotesTimeblocks: "Zeitblöcke",
			taskNotesTimeblocksDesc: "Zeitblöcke, die in deine Tagesnotizen geschrieben sind.",
			taskNotesFollows: (on: boolean) =>
				`TaskNotes hat dies derzeit ${on ? "an" : "aus"}.`,
			taskNotesFollowReset: "TaskNotes folgen",
			taskNotesCompleted: "Erledigte anzeigen",
			taskNotesCompletedDesc: "Behalte erledigte Aufgaben durchgestrichen im Kalender.",
			taskNotesArchived: "Archivierte anzeigen",
			taskNotesArchivedDesc: "Schließe Aufgaben mit dem Archiv-Tag von TaskNotes ein.",
			taskNotesComplete: "Aus dem Kalender erledigen",
			taskNotesCompleteDesc:
				"Biete an jeder Aufgabe ein Kästchen zum Erledigen, das genau das zurückschreibt, was TaskNotes schreibt (pro Vorkommen bei wiederkehrenden Aufgaben).",
			taskNotesSubscriptions: "TaskNotes-Kalender",
			taskNotesSubscriptionsDesc: (count: number) =>
				`Zeige zusätzlich ${count} Kalender-Abonnement${count === 1 ? "" : "s"}.`,
			taskNotesSubscriptionsNone: "TaskNotes hat keine Kalenderabonnements anzuzeigen.",
			taskNotesSubLoaded: (count: number) =>
				`${count} Event${count === 1 ? "" : "s"} geladen.`,
			taskNotesSubPending: "Noch nicht geladen - unten aktualisieren.",
			taskNotesSubDisabled: "In TaskNotes deaktiviert.",
			taskNotesSubBlocked: "Nicht abgerufen: Externe Aufrufe sind in Hearths Einstellungen deaktiviert.",
			taskNotesSubFailed: (reason: string) => `Konnte nicht laden: ${reason}`,
			taskNotesSubNotCalendar: "die Antwort war kein iCalendar-Feed.",
			taskNotesSubMissingFile: "diese Datei ist nicht im Vault.",
			taskNotesSubRefresh: "Kalender aktualisieren",
			taskNotesColorBy: "Färben nach",
			taskNotesColorByDesc: "Woher die Farbe jeder Aufgabe stammt.",
			taskNotesColorStatus: "TaskNotes-Status",
			taskNotesColorPriority: "TaskNotes-Priorität",
			taskNotesColorFixed: "Eine feste Farbe",
			taskNotesColor: "Aufgabenfarbe",
			taskNotesColorDesc: "Wird für die feste Farbe genutzt und wenn TaskNotes keine definiert.",
			taskNotesDueColor: "Fälligkeitsfarbe",
			taskNotesDueColorDesc: "Optionale separate Farbe für Einträge mit Fälligkeitsdatum.",
			taskNotesTimeblockColor: "Zeitblock-Farbe",
			taskNotesTimeblockColorDesc: "Wird für Zeitblöcke ohne eigene Farbe genutzt.",
		},
		schedule: {
			view: "Öffnet in",
			viewDesc:
				"Die Ansicht, die die Karte beim Öffnen des Boards zeigt. Du kannst die Ansicht jederzeit direkt auf der Karte wechseln.",
			views: "Angebotene Ansichten",
			viewsDesc:
				"Welche Ansichten der Umschalter der Karte listet. Lass alle vier an, um jede mit einem Klick zu erreichen; eine einzelne Ansicht blendet den Umschalter ganz aus.",
			toolbar: "Werkzeugleiste",
			toolbarDesc:
				"Zeige die Navigationszeile: zurück, heute, vor, den angezeigten Zeitraum und den Ansichts-Umschalter. Aus heftet die Karte an den aktuellen Zeitraum.",
			dailyNotes: "Tagesnotizen",
			dailyNotesDesc:
				"Markiere Tage, die bereits eine Tagesnotiz haben, und öffne sie (oder biete das Erstellen an), wenn ein Tag angeklickt wird. Aus macht daraus einen reinen Terminkalender.",
			weekHeading: "Die Woche",
			firstDay: "Woche beginnt am",
			firstDayDesc: "An welchem Tag die Monats- und Wochenraster beginnen.",
			firstDayLocale: (day: string) => `Obsidian-Sprache folgen (${day})`,
			hideWeekends: "Wochenenden ausblenden",
			hideWeekendsDesc: "Lass Samstag und Sonntag aus den Monats- und Wochenrastern.",
			weekNumbers: "Kalenderwochen",
			weekNumbersDesc: "Zeige eine Kalenderwochen-Spalte am linken Rand.",
			clock: "Uhrzeit",
			clockDesc: "Wie Terminzeiten geschrieben werden.",
			clockLocale: "Obsidian-Sprache folgen",
			clock12: "12-Stunden (9:00 AM)",
			clock24: "24-Stunden (09:00)",
			monthHeading: "Monatsansicht",
			monthStyle: "Termine dargestellt als",
			monthStyleDesc:
				"Benannte Chips sind auf einer Karte mit Platz auf einen Blick lesbar; Punkte eignen sich für eine kleine Karte, so wie der Minikalender sie zeichnet.",
			monthStyleChips: "Benannte Chips",
			monthStyleDots: "Punkte",
			maxPerDay: "Termine pro Tag",
			maxPerDayDesc:
				"Wie viele Termine eine Tageszelle listet, bevor der Rest zu einem „+N weitere“-Link zusammengefasst wird. 0 listet alle und lässt die Zelle scrollen.",
			gridHeading: "Wochen- & Tagesansichten",
			gridDesc:
				"Das Zeitraster zeichnet standardmäßig den ganzen Tag und öffnet gescrollt zum ersten Termin - sodass nichts außerhalb der sichtbaren Stunden liegen kann. Enge die Stunden ein, wenn du lieber nur einen Teil des Tages sehen möchtest.",
			hours: "Dargestellte Stunden",
			hoursDesc:
				"Die erste und letzte Stunde des Rasters. Alles außerhalb wandert in die Ganztagsleiste darüber, statt zu verschwinden.",
			hoursMidnight: "Mitternacht",
			hourHeight: "Stundenhöhe",
			hourHeightDesc: "Wie hoch eine Stunde ist, in Pixeln. Höher zeigt mehr Details; niedriger passt mehr vom Tag hinein.",
			nowLine: "Aktuelle-Zeit-Linie",
			nowLineDesc: "Zeichne eine Linie über die heutige Spalte zur aktuellen Uhrzeit.",
			listHeading: "Listenansicht",
			listDays: "Aufgelistete Tage",
			listDaysDesc: "Wie weit die Liste ab dem angezeigten Tag in die Zukunft reicht.",
		},
		heatmap: {
			metric: "Metrik",
			weeks: "Wochen",
			weeksDesc: "Wie viele Wochen Verlauf angezeigt werden.",
			advanced: "Erweitert",
			advancedDesc:
				"Baue deine eigene Metrik: Nimm den Tag aus einem Frontmatter-Datum, summiere eine " +
				"Zahl statt Notizen zu zählen, und wähle, welche Notizen überhaupt zählen. " +
				"Aus zählt jede Notiz nach ihrem Dateidatum.",
			metricHeading: "Was gezählt wird",
			rangeHeading: "Zeitraum",
			source: "Tag stammt aus",
			sourceDesc: "Welches Datum entscheidet, auf welchem Quadrat eine Notiz landet.",
			sourceOptions: {
				modified: "Änderungsdatum",
				created: "Erstellungsdatum",
				property: "Ein Frontmatter-Datum",
			},
			dateProperty: "Datumseigenschaft",
			datePropertyDesc:
				"Der Frontmatter-Schlüssel mit dem Datum - date, due, published. Akzeptiert ein " +
				"Datum, ein Datum mit Uhrzeit oder einen [[Tagesnotiz]]-Link; eine Liste zählt einmal pro " +
				"Eintrag. Notizen ohne ihn werden übersprungen.",
			datePropertyPlaceholder: "date",
			value: "Jede Notiz addiert",
			valueDesc: "Eins pro Notiz oder die Zahl in einer Eigenschaft - gelesene Minuten, geschriebene Seiten, gelaufene Kilometer.",
			valueOptions: {
				count: "1 (Notizen zählen)",
				sum: "Eine Zahl aus einer Eigenschaft",
			},
			valueProperty: "Werteigenschaft",
			valuePropertyDesc:
				"Der Frontmatter-Schlüssel mit der zu addierenden Zahl. Notizen, deren Wert keine " +
				"Zahl ist, werden übersprungen statt als eins gezählt.",
			valuePropertyPlaceholder: "minuten",
			unit: "Einheit",
			unitDesc: 'Wie eine Einheit heißt, wenn ein Tag beschrieben wird - „5 Workouts“. Leer folgt der Metrik.',
			unitPlaceholder: "bearbeitete Notizen",
			rules: "Welche Notizen zählen",
			rulesDesc: "Bedingungen, die eine Notiz erfüllen muss, um gezählt zu werden. Ohne Regeln zählt jede Notiz.",
			match: "Verknüpfung",
			matchOptions: {
				all: "Alle Regeln (UND)",
				any: "Eine Regel (ODER)",
			},
			fieldOptions: {
				property: "Eigenschaft",
				tag: "Tag",
				folder: "Ordner",
				path: "Pfad",
			},
			opOptions: {
				is: "ist",
				isNot: "ist nicht",
				contains: "enthält",
				notContains: "enthält nicht",
				gt: "ist mehr als",
				lt: "ist weniger als",
				exists: "ist gesetzt",
				missing: "ist nicht gesetzt",
			},
			keyPlaceholder: "property",
			valuePlaceholder: "Wert",
			addRule: "Regel hinzufügen",
			removeRule: "Regel entfernen",
		},
		stats: {
			advanced: "Erweitert",
			advancedDesc:
				"Wähle, welche Statistiken angezeigt werden, schlüssele Anhänge nach Dateityp auf und füge " +
				"eigene Zähler hinzu. Aus zeigt den Standardsatz.",
			builtins: "Anzuzeigende Statistiken",
			builtinsDesc: "Wähle, welche eingebauten Statistiken erscheinen. Die Tagesserie erscheint nur, wenn Tagesnotizen eingerichtet sind.",
			attachmentTypes: "Anhangsaufschlüsselung",
			attachmentTypesDesc: "Füge für jeden ausgewählten Dateityp eine eigene Zählkachel hinzu (Bilder, PDFs, …).",
			customCounts: "Eigene Zähler",
			customCountsDesc:
				"Jede Zeile zählt die Dateien, die auf eine Abfrage passen, und zeigt die Gesamtzahl als Kachel. " +
				"Die Abfragesyntax entspricht der Suchleiste: #tag, key:value für eine Eigenschaft oder einfacher Text.",
			labelPlaceholder: "Beschriftung",
			iconPlaceholder: "Symbol",
			queryPlaceholder: "#project or status:active",
			addCount: "Zähler hinzufügen",
			removeCount: "Zähler entfernen",
		},
		metricOptions: {
			modified: "Notizen bearbeitet",
			created: "Notizen erstellt",
		},
		savedSearch: {
			query: "Abfrage",
			queryDesc:
				"Gleiche Syntax wie die Suchleiste: einfacher Text für Namen/Inhalte, #tag für " +
				"Tags oder key:value für eine Frontmatter-Eigenschaft.",
			queryPlaceholder: "#project or status:active or meeting notes",
			display: "Darstellung",
			displayDesc: "Zeige Treffer als kompakte Liste oder als Kacheln.",
			displayList: "Liste",
			displayTiles: "Kacheln",
			maxResults: "Max. Treffer",
			maxResultsDesc: "Die meisten Treffer, die auf einmal angezeigt werden.",
		},
		searchBar: {
			placeholder: "Platzhalter",
			placeholderDesc:
				"Text, der im leeren Feld steht. Leer lassen, um den aus " +
				"Einstellungen → Erscheinungsbild zu nutzen.",
			filters: "Filterzeile",
			filtersDesc:
				"Zeige die Dateityp-Chips unter dem Feld, dieselben wie in der " +
				"Suchleiste der Kopfzeile. Sie brauchen eine höhere Karte, um Platz zu haben.",
			filterTypes: "Filter-Chips",
			filterTypesDesc:
				"Welche Chips diese Karte anbietet. Ein Chip erscheint nur, wenn der Vault " +
				"tatsächlich diese Dateiart enthält.",
			filterTypeGlobalOff: "Für jede Suchleiste unter Einstellungen → Filter ausgeblendet.",
			button: "Button",
			buttonDesc:
				"Ein Aktionsbutton neben dem Feld: Erstelle eine neue Notiz oder durchsuche das " +
				"Web nach dem, was im Feld steht.",
			buttonNone: "Keiner",
			buttonNewNote: "Neue Notiz",
			buttonSearchOnline: "Online suchen",
			seamless: "Nahtlos",
			seamlessDesc:
				"Entferne den Kartenrahmen - kein Rand, Hintergrund oder Titelzeile - sodass dies " +
				"als eigenständige Suchleiste auf dem Board erscheint.",
			sizeNote:
				"Das Feld ist so hoch wie die Karte - ziehe die Kartenkante in " +
				"Anordnen, um die Leiste dicker oder schmaler zu machen.",
		},
		tiles: {
			heading: "Buttons",
			sizing: "Buttongröße",
			sizingDesc:
				"Ob die Buttons die Karte füllen - alle sichtbar, egal wie " +
				"groß die Karte ist, mit ihr wachsend und schrumpfend - oder eine feste " +
				"Pixelgröße behalten, sodass eine Karte, die für alle zu klein ist, scrollt. Gefüllte Buttons hören " +
				"auf zu schrumpfen, sobald sie zu klein zur Bedienung würden, in beide Richtungen, und eine " +
				"Karte, die dafür zu klein ist, scrollt ebenfalls. Karten von vor " +
				"dieser Einstellung bleiben beim festen Stil, bis du sie umstellst; " +
				"jeder Stil behält seine eigenen Größen, sodass Zurückwechseln wiederherstellt, was du " +
				"hattest.",
			sizingScale: "Karte füllen",
			sizingFixed: "Feste Größe (alt)",
			across: "Buttons nebeneinander",
			acrossDesc:
				"Wie viele Buttons breit die Karte ist und damit wie breit ein Button ist: ein " +
				"Bruchteil der Karte, bis zur Mindestgröße, die ein Button behält. Ihre " +
				"Höhe funktioniert genauso - die Zeilen teilen sich die verfügbare Höhe der Karte " +
				"untereinander - sodass eine kürzere Karte kürzere Buttons bedeutet statt " +
				"versteckter. Ein Button kann weiterhin zwei oder drei Zellen breit " +
				"(oder hoch) gemacht werden, indem du seine rechte untere Ecke im Anordnungsmodus ziehst - oder " +
				"eine halbe Zelle, da das Raster in beide Richtungen halbe Schritte erlaubt.",
			minSize: "Minimale Buttongröße",
			minSizeDesc:
				"Wie klein ein ganzer Button werden darf, in Pixeln, bevor die Karte scrollt " +
				"statt sie weiter zu schrumpfen - ein Halbzellen-Button stoppt bei " +
				"der Hälfte. Standardmäßig niedrig, damit Buttons passen statt dass eine " +
				"Bildlaufleiste erscheint; erhöhe ihn, um sie auf einer oft klein gemachten Karte komfortabel zu halten, " +
				"und die Karte scrollt, wenn sie nicht mehr passen.",
		},
		links: {
			heading: "Links",
			autoShift: "Auto-Verschieben (Beta)",
			autoShiftDesc:
				"Wenn an, schieben Kacheln einander beim Ziehen beiseite (wie " +
				"Handy-Widgets). Standardmäßig aus - Kacheln sind frei formbar und dürfen sich überlappen.",
			labelPlaceholder: "Beschriftung",
			iconPlaceholder: "Symbol",
			pickCommand: "Befehl wählen…",
			targetUrl: "Ziel (URL)",
			targetNote: "Ziel (Notizpfad)",
			moveUp: "Nach oben",
			moveDown: "Nach unten",
			removeLink: "Link entfernen",
			addLink: "Link hinzufügen",
		},
		commands: {
			autoShift: "Auto-Verschieben (Beta)",
			autoShiftDesc:
				"Wenn an, schieben Kacheln einander beim Ziehen beiseite (wie " +
				"Handy-Widgets). Standardmäßig aus - Kacheln sind frei formbar und dürfen sich überlappen.",
			buttonSize: "Buttongröße",
			buttonSizeDesc:
				"Standardgröße der Befehls-Kacheln. Ändere die Größe einer einzelnen Kachel, indem du " +
				"ihre rechte untere Ecke ziehst, oder lege unten eine Größe pro Kachel fest.",
			heading: "Befehle",
			iconOptionalPlaceholder: "Symbol (optional)",
			sizePlaceholder: "Größe",
			tileSizeAria: "Kachelgröße in Pixeln (optional)",
			moveUp: "Nach oben",
			moveDown: "Nach unten",
			removeCommand: "Befehl entfernen",
			addCommand: "Befehl hinzufügen",
		},
		templater: {
			missing: "Templater ist nicht aktiviert",
			missingDesc:
				"Diese Karte erstellt Notizen über das Templater-Plugin - installiere und " +
				"aktiviere es, und diese Kacheln funktionieren. Sonst muss hier vorerst " +
				"nichts geändert werden.",
			autoShift: "Auto-Verschieben (Beta)",
			autoShiftDesc:
				"Wenn an, schieben Kacheln einander beim Ziehen beiseite (wie " +
				"Handy-Widgets). Standardmäßig aus - Kacheln sind frei formbar und dürfen sich überlappen.",
			buttonSize: "Buttongröße",
			buttonSizeDesc:
				"Standardgröße der Kacheln. Ändere die Größe einer einzelnen Kachel, indem du ihre " +
				"rechte untere Ecke ziehst.",
			heading: "Vorlagen",
			labelPlaceholder: "Beschriftung",
			pickTemplate: "Vorlage wählen…",
			pickTemplateTooltip: "Wähle die Templater-Vorlage, die diese Kachel ausführt",
			pickFolderTooltip:
				"Wähle den Ordner für die neue Notiz. Der Vault-Stamm bedeutet „dort, " +
				"wo Obsidian neue Notizen ablegt“.",
			filenamePlaceholder: "Dateiname",
			filenameTooltip:
				"Name für die neue Notiz, ohne Endung. {{date}}, {{date:FMT}}, " +
				"{{time}}, {{time:FMT}} und {{prompt}} werden ersetzt. Leer lassen, damit " +
				"Templater sie benennt.",
			openOn: "Öffnet die neue Notiz - klicken, um sie stattdessen still abzulegen",
			openOff: "Legt die neue Notiz still ab - klicken, um sie stattdessen zu öffnen",
			removeTile: "Kachel entfernen",
			addTile: "Vorlage hinzufügen",
			tokensHelp:
				"Dateinamen dürfen {{date}}, {{date:YYYY-MM}}, {{time}}, {{time:HH-mm}} " +
				"und {{prompt}} nutzen, das dich vor dem Erstellen der Notiz nach dem Rest des Namens fragt. " +
				"Alles innerhalb der Vorlage selbst - <% tp.* %>, deine Userskripte, tp.system.prompt() - gehört Templater " +
				"und läuft genau wie über Templaters Befehl.",
			tokensHelpScoped: (folder: string) =>
				`Die Auswahl listet die Vorlagen in „${folder}“, Templaters eigenem ` +
				"Vorlagenordner. Dateinamen dürfen {{date}}, {{date:YYYY-MM}}, {{time}}, " +
				"{{time:HH-mm}} und {{prompt}} nutzen, das dich vor dem Erstellen der Notiz nach dem Rest des Namens fragt. " +
				"Alles innerhalb der Vorlage selbst - " +
				"<% tp.* %>, deine Userskripte, tp.system.prompt() - gehört Templater " +
				"und läuft genau wie über Templaters Befehl.",
		},
		tasks: {
			source: "Quelle",
			sourceDesc:
				"Markdown-Checkboxen funktionieren überall. TaskNotes liest die " +
				"Aufgaben-Notizen dieses Plugins über Frontmatter (Feldnamen konfigurierbar unter " +
				"Einstellungen → Hearth, da TaskNotes keine API für Abfragen durch andere Plugins bietet). " +
				"Kanban liest eine einzelne Board-Notiz des Kanban-Plugins, eine Spalte pro Überschrift.",
			sourceCheckbox: "Markdown-Checkboxen",
			sourceTaskNotes: "TaskNotes-Plugin",
			sourceKanban: "Kanban-Plugin",
			kanbanBoard: "Board-Notiz",
			kanbanBoardDesc:
				"Das zu lesende Board des Kanban-Plugins. Leer lassen, um die erste " +
				"Notiz im Bereich mit einem „kanban-plugin“-Frontmatter-Schlüssel automatisch zu erkennen.",
			kanbanBoardPlaceholder: "Automatisch erkennen",
			pickBoard: "Kanban-Board wählen",
			kanbanExtended: "Termine & Prioritäten",
			kanbanExtendedDesc:
				"Liest die Termine, Priorität und Wiederholungsmarkierungen auf jeder Karte " +
				"(kompatibel mit dem obsidian-tasks-Plugin), damit sie als " +
				"Indikatoren erscheinen, die Liste sortieren und von der Karte aus " +
				"bearbeitet werden können. Aus liest Karten als reinen Text.",
			checkboxExtended: "Termine & Prioritäten",
			checkboxExtendedDesc:
				"Liest die Termine, Priorität und Wiederholungsmarkierungen direkt an jeder " +
				"Checkbox (kompatibel mit dem obsidian-tasks-Plugin), damit sie als " +
				"Indikatoren erscheinen, die Liste sortieren und über das " +
				"Rechtsklick-Menü des Eintrags bearbeitet werden können. Aus liest Checkboxen als reinen Text.",
			checkboxStatuses: "Aufgabenstatus (Board-Spalten)",
			checkboxStatusesDesc:
				"Die Checkbox-Status, die als Spalten auf einem Kanban-Board gezeigt werden, einer pro Zeile " +
				"als „[symbol] Label“ - das Symbol ist das Zeichen in „- [ ]“. " +
				"„(done)“ hinzufügen, um einen Status als abgeschlossen zu markieren. Das Ziehen " +
				"einer Karte in eine Spalte schreibt dessen Symbol. Leer lassen für die Standardauswahl (Offen, In Bearbeitung, Erledigt).",
			quickView: "Schnellansicht bei Klick",
			quickViewDesc:
				"Ein Klick auf eine Aufgabe öffnet ein kompaktes Popover - dessen Metadaten und " +
				"Beschreibung, direkt bearbeitbar, mit Schaltflächen zum Öffnen der vollständigen Notiz " +
				"oder Löschen der Aufgabe - statt die Notiz sofort zu öffnen. Aus " +
				"öffnet die Notiz bei Klick.",
			convertTemplate: "Vorlage zum Umwandeln in Notiz",
			convertTemplateDesc:
				"Wenn du eine Karte rechtsklickst und „In Notiz umwandeln“ wählst, wird die " +
				"neue Notiz aus dieser Vorlage erstellt. Unterstützt {{title}}, {{date}} und " +
				"{{time}}. Leer lassen, um eine leere Notiz zu erstellen.",
			convertTemplatePlaceholder: "z. B. Templates/Task.md",
			pickTemplate: "Vorlagen-Notiz wählen",
			convertScrape: "Metadaten in Frontmatter übernehmen",
			convertScrapeDesc:
				"Beim Umwandeln einer Karte in eine Notiz deren Termine, Priorität und " +
				"Wiederholungsmarkierungen in das YAML-Frontmatter der neuen Notiz verschieben, statt " +
				"die Emoji-Markierungen auf dem Board-Link zu lassen.",
			newTaskAsNote: "Neue Aufgaben als Notizen",
			newTaskAsNoteDesc:
				"Jede neue Karte sofort als eigene Notiz erstellen (ein Link auf dem Board), " +
				"statt als Inline-Checkbox - mit der Vorlage und " +
				"den Frontmatter-Optionen oben, genau wie „In Notiz umwandeln“.",
			layout: "Layout",
			layoutDesc:
				"Liste oder ein nach Status gruppiertes Kanban-Board. Auf dem Board Karten " +
				"zwischen Spalten ziehen, Spaltenköpfe zum Sortieren ziehen, mit dem " +
				"Augen-Symbol einer Spalte sie ausblenden und mit dem Häkchen-Symbol Aufgaben automatisch " +
				"abschließen lassen. Eine Karte rechtsklicken, um sie in eine eigene Notiz umzuwandeln.",
			layoutList: "Liste",
			layoutKanban: "Kanban-Board",
			kanbanColumns: "Kanban-Spalten",
			kanbanHidden: (columns: string) => `Ausgeblendet: ${columns}`,
			kanbanDoneColumns: (columns: string) => `Auto-Abschluss: ${columns}`,
			kanbanCustomOrder: "Benutzerdefinierte Spaltenreihenfolge ist festgelegt.",
			showAll: "Alle anzeigen",
			resetColumns: "Spaltenreihenfolge, Sichtbarkeit & Abschluss-Spalten zurücksetzen",
			doneStatuses: "Als abgeschlossen gewertete Status",
			doneStatusesDesc:
				"TaskNotes-Quelle: welche Statuswerte als abgeschlossen gelten (ausgeblendet, " +
				"außer „Erledigte anzeigen“ ist an, und durchgestrichen, wenn angezeigt), einer pro " +
				"Zeile. Leer lassen, um nur den Erledigt-Wert aus Einstellungen → Hearth zu verwenden. " +
				"Z. B. „canceled“ hinzufügen, um abgebrochene Aufgaben ebenfalls als abgeschlossen zu werten.",
			doneStatusesPlaceholder: "done\ncanceled",
			fields: "Felder",
			fieldsFollowGlobal:
				"Folgt den Feldern aus Einstellungen → Hearth → Integrationen. Einschalten, " +
				"um dieser Karte eigene zu geben.",
			fieldsCustomize: "Anpassen…",
			fieldsTitle: "Aufgabenfelder",
			fieldsHint:
				"Alles, was eine Aufgabe zeigt, der Reihe nach. Ein Feld definierst du selbst: " +
				"benenne es, wähle die Darstellung und gib die Schlüssel an, die es liest.",
			fieldsEmpty: "Noch keine Felder - Aufgaben zeigen nur ihren Text.",
			fieldsNone: "Keine - Aufgaben zeigen nur ihren Text.",
			fieldsApplyClose: "Übernehmen & schließen",
			fieldsApplyDesc: "Übernehmen ohne zu schließen, um weiter anzupassen.",
			fieldsReset: "Alle Felder entfernen",
			fieldUnnamed: "Unbenanntes Feld",
			fieldDefaultName: (n: number) => `Feld ${n}`,
			fieldAdd: "Feld hinzufügen",
			fieldEdit: "Feld bearbeiten",
			fieldRemove: "Feld entfernen",
			fieldMoveUp: "Nach oben",
			fieldMoveDown: "Nach unten",
			fieldExpand: "Erweitern",
			fieldCollapse: "Einklappen",
			fieldName: "Name",
			fieldNameDesc: "Wie dieses Feld heißt. Nur auf Aufgaben gezeigt, wenn du es unten verlangst.",
			fieldNamePlaceholder: "z. B. Priorität",
			fieldShowName: "Namen auf Aufgaben zeigen",
			fieldShowNameDesc: "Jeden Wert mit dem Feldnamen einleiten („Priorität: Dringend“).",
			fieldDisplay: "Darstellung",
			fieldDisplayDesc:
				"Wie die Werte dieses Felds gezeichnet werden. Die letzten beiden zeigen nichts auf der " +
				"Aufgabe und färben stattdessen die ganze Zeile oder Karte, und nur ein Feld kann " +
				"sie verwenden. „Farbiger Punkt mit Label“ ist die eigene Form der Priorität und wird " +
				"Feldern angeboten, die eine lesen. Eine Beschreibung ist immer ein eigener Block " +
				"aus Unterpunkten.",
			fieldAmbientTaken: (name: string) =>
				`Einfärben und Leuchten werden bereits von „${name}“ verwendet. Eine Aufgabe hat einen Hintergrund ` +
				`und einen Ring, daher kann nur ein Feld sie übernehmen.`,
			fieldAmbientIgnored: (name: string) =>
				`Dieses Feld färbt nichts: „${name}“ färbt oder umringt die Aufgabe bereits, ` +
				`und nur ein Feld kann das. Gib einem davon eine andere Darstellung.`,
			fieldStyles: {
				pill: "Chip",
				dot: "Farbiger Punkt",
				dotlabel: "Farbiger Punkt mit Label",
				text: "Reiner Text",
				hue: "Ganze Aufgabe einfärben",
				glow: "Leuchten um die Aufgabe",
			},
			fieldOpacity: "Stärke",
			fieldOpacityDesc:
				"Wie stark die Farbe aufgetragen wird. Nur die Farbe des Werts wird verwendet - " +
				"ein Wert ohne gesetzte Farbe lässt die Aufgabe unverändert.",
			fieldKeys: "Schlüssel",
			fieldKeysDesc:
				"Woher dieses Feld liest. Jeder Schlüssel mit Wert zeigt einen an, " +
				"sodass ein Feld mehrere Metadaten unter einem Namen sammeln kann.",
			fieldKeysEmpty: "Noch keine Schlüssel - dieses Feld zeigt nichts.",
			fieldNoKeys: "Keine Schlüssel",
			fieldAddKey: "Schlüssel hinzufügen",
			fieldAddKeyDesc:
				"Hearths eigene Werte erreichen die Priorität einer Checkbox-Zeile, eine Board-Spalte " +
				"und die erkannten Termine; eine Eigenschaft liest alles in deinem Frontmatter.",
			fieldAddBuiltin: "Was Hearth liest",
			fieldAddProperty: "Frontmatter-Eigenschaft",
			fieldAddKeyTyped: "Eigenschaftsnamen tippen…",
			fieldAddKeyPlaceholder: "Eigenschaftsname",
			fieldRemoveKey: "Schlüssel entfernen",
			fieldPickProperty: "In deinen Notizen gefundene Eigenschaften",
			fieldPickBuiltin: "Werte, die Hearth selbst erkennt",
			fieldKeyAlreadyAdded: (key: string) => `„${key}“ ist bereits ein Schlüssel auf diesem Feld.`,
			fieldMapValues: "Werte & Farben",
			fieldMappedValues: (n: number) => `${n} Wert(e) zugeordnet`,
			fieldNoMappings: "Werte werden wie geschrieben gezeigt",
			fieldMapHint:
				"Zeige für jeden Wert ein schöneres Label und eine Farbe. Werte, die du nicht zuordnest, " +
				"erscheinen trotzdem, als sie selbst.",
			fieldMapEmpty: "Noch keine Werte zugeordnet.",
			fieldDateKey: "Als Datum gezeigt",
			fieldIsDate: "Als Datum behandeln",
			fieldIsDateDesc:
				"Diese Eigenschaft als relatives Datum zeigen („Morgen“), je nachdem einfärben, ob " +
				"der Termin vergangen ist, heute oder bevorsteht, und mit einem Kalender bearbeiten.",
			fieldDateHint:
				"Ein Datum hat keine festen Werte zum Zuordnen, daher wird es nach seiner Lage " +
				"gefärbt. Ein Label ist optional - leer lassen, um das Datum selbst zu behalten.",
			fieldDateLabelPlaceholder: "Anzeigen als (optional)",
			dateRelations: {
				"<today": "Vor heute",
				today: "Heute",
				">today": "Nach heute",
			},
			fieldNotMappable:
				"Dieser Schlüssel hat keine festen Werte zum Zuordnen - er behält sein eigenes Format.",
			fieldMatchPlaceholder: "z. B. hoch",
			fieldLabelPlaceholder: "Optional",
			fieldValueColumn: "Wert in deinen Notizen",
			fieldWhenColumn: "Lage des Datums",
			fieldShownColumn: "Auf der Aufgabe gezeigt als",
			fieldColorColumn: "Farbe",
			fieldAddMapping: "Wert hinzufügen",
			fieldValuesFound: (n: number) => `Aus deinen Notizen (${n})`,
			fieldRemoveMapping: "Wert entfernen",
			fieldPickValue: "Werte, die dieser Schlüssel anderswo in deinem Vault annimmt",
			fieldColor: "Farbe",
			fieldColorCustom: "Eigene Farbe",
			fieldColorClear: "Keine Farbe",
			colorNames: {
				"--color-red": "Rot",
				"--color-orange": "Orange",
				"--color-yellow": "Gelb",
				"--color-green": "Grün",
				"--color-cyan": "Cyan",
				"--color-blue": "Blau",
				"--color-purple": "Violett",
				"--color-pink": "Pink",
			},
			sourceNames: {
				status: "Status (TaskNotes)",
				column: "Board-Spalte (Kanban)",
				priority: "Priorität",
				start: "Startdatum",
				scheduled: "Geplantes Datum",
				due: "Fälligkeitsdatum",
				doneDate: "Erledigt-Datum",
				description: "Beschreibung",
			},
			showCompleted: "Abgeschlossene anzeigen",
			showCompletedKanbanDesc:
				"Abgeschlossene Aufgaben erscheinen auf einem Kanban-Board immer in der Erledigt-Spalte.",
			maxTasks: "Max. gezeigte Aufgaben",
			maxTasksDesc: "Sortiert nach Fälligkeitsdatum (überfällige/zuerst fällige zuerst), dann nach Datei.",
			folders: "Ordner",
			scope: "Bereich",
			scopeAll: "Gesamter Vault",
			scopeWhitelist: "Nur diese Ordner",
			scopeBlacklist: "Überall außer diesen Ordnern",
			foldersDesc: "Ein Ordnerpfad pro Zeile.",
		},
		favorites: {
			heading: "Favoriten",
			headingDesc: "Notizen, die jede Favoriten-Karte zeigt.",
			ownList: "Dieser Karte eine eigene Liste geben",
			ownListOn:
				"Diese Karte zeigt ihre eigenen Notizen und ignoriert die vaultweite Liste. Ausschalten, um wieder den Favoriten des Vaults zu folgen - die Liste unten wird verworfen.",
			ownListOff:
				"Diese Karte folgt den vaultweiten Favoriten, wie jede andere Favoriten-Karte. Einschalten, um ihr eine eigene Liste zu geben, ausgehend von der aktuell gezeigten.",
			moveUp: "Nach oben",
			moveDown: "Nach unten",
			remove: "Entfernen",
			addFavorite: "Favorit hinzufügen",
		},
		clock: {
			style: "Stil",
			styleDigital: "Digital",
			styleAnalog: "Analog",
			hourFormat: "Zeitformat",
			hourFormatAuto: "Automatisch (Gebietsschema)",
			hourFormat12: "12 Stunden",
			hourFormat24: "24 Stunden",
			showSeconds: "Sekunden anzeigen",
			showGreeting: "Begrüßung anzeigen",
			playful: "Verspielte Begrüßungen",
			playfulDesc: "Freche, zufällige Begrüßungen statt der schlichten.",
			greetingOverride: "Begrüßung überschreiben",
			greetingOverrideDesc: "Leer lassen für die automatische Begrüßung.",
			date: "Datum",
			dateFull: "Wochentag, Tag Monat",
			dateLong: "Wochentag, Tag Monat Jahr",
			dateShort: "Kurz (Gebietsschema)",
			dateIso: "ISO (2026-06-29)",
			dateWeekday: "Nur Wochentag",
			dateCustom: "Eigenes Format…",
			dateNone: "Ausgeblendet",
			customFormat: "Eigenes Datumsformat",
			customFormatDesc: "Ein moment.js-Format, z. B. ddd D MMM oder YYYY/MM/DD.",
			customFormatPlaceholder: "ddd D MMM",
		},
		calculator: {
			angleUnit: "Winkeleinheit",
			angleUnitDesc: "Einheit, die Winkelfunktionen wie sin und cos annehmen.",
			degrees: "Grad",
			radians: "Radiant",
			keypad: "Tastenfeld",
			keypadDesc:
				"Bildschirm-Tastenfeld auf der Karte zeigen: einfach (Ziffern und Operationen) oder wissenschaftlich (zusätzlich Funktionen, Potenzen und Konstanten).",
			keypadNone: "Ausgeblendet",
			keypadBasic: "Einfach",
			keypadScientific: "Wissenschaftlich",
		},
		dataview: {
			language: "Abfragetyp",
			languageDesc:
				"Dataview Query Language (TABLE / LIST / TASK) oder DataviewJS-Code.",
			languageDql: "Dataview-Abfrage (DQL)",
			languageJs: "DataviewJS",
			query: "Abfrage",
			queryDqlDesc:
				"Eine Dataview-Abfrage, geschrieben genau wie in einem ```dataview-Codeblock " +
				"(ohne die Zäune). Läuft ohne „current note“, daher funktionieren globale Abfragen " +
				"vollständig, aber this.file-relative Abfragen haben keine Datei zum Auflösen.",
			queryJsDesc:
				"DataviewJS-Code, wie in einem ```dataviewjs-Block (ohne die Zäune). " +
				"Die dv-API ist verfügbar. Führt beliebigen JavaScript-Code aus - nur Code verwenden, dem du vertraust.",
			queryDqlPlaceholder:
				'TABLE file.mtime AS "Modified" FROM #project SORT file.mtime DESC',
			queryJsPlaceholder: "dv.list(dv.pages('#project').file.link)",
		},
		datacore: {
			language: "Abfragetyp",
			languageDesc:
				"Eine Datacore-Abfrage, als Live-Liste dargestellt, oder ein Datacore-Skript, das seine eigene Ansicht zeichnet.",
			languageQuery: "Datacore-Abfrage",
			languageJsx: "Skript (JSX)",
			languageJs: "Skript (JS)",
			languageTsx: "Skript (TSX)",
			languageTs: "Skript (TS)",
			query: "Abfrage",
			queryDesc:
				"Eine Datacore-Abfrage, z. B. @page and #project. Hearth stellt die Treffer als " +
				"Live-Liste aus Links dar. Läuft ohne „current note“, daher funktionieren globale Abfragen " +
				"vollständig, aber dateirelative haben keine Datei zum Auflösen.",
			queryPlaceholder: "@page and #project",
			script: "Skript",
			scriptDesc:
				"Ein Datacore-Skript, wie in einem ```datacorejsx-Block (ohne die Zäune). " +
				"Die dc-API ist verfügbar und das Skript gibt die zu rendernde Ansicht zurück. Führt " +
				"beliebigen Code aus - nur Code verwenden, dem du vertraust.",
			scriptPlaceholder:
				"return function View() {\n\tconst pages = dc.useQuery(\"@page and #project\");\n\treturn <dc.List rows={pages} renderer={(p) => <dc.Link link={p.$link} />} />;\n}",
			pageSize: "Zeilen pro Seite",
			pageSizeDesc: "Die erzeugte Liste mit so vielen Zeilen seitenweise anzeigen. 0 zeigt alle Treffer auf einmal.",
		},
		git: {
			missing: "Das Git-Plugin ist nicht aktiviert",
			missingDesc:
				"Diese Karte ist ein Fenster zum Git-Community-Plugin - installiere und aktiviere " +
				"es und verweise es auf ein Repository, damit die Karte etwas anzeigt.",
			sections: "Bereiche",
			actions: "Schaltflächen",
			destructive: "Kann nicht rückgängig gemacht werden.",
			removeAction: "Diese Schaltfläche entfernen",
			addAction: "Schaltfläche hinzufügen",
			addActionPlaceholder: "Wählen…",
			actionStyle: "Schaltflächenstil",
			actionStyleDesc: "Nur Symbole sind kompakt; Labels machen eine breite Karte lesbar.",
			actionStyles: {
				icon: "Nur Symbol",
				labelled: "Symbol und Label",
			},
			committing: "Commit",
			commitScope: "Was committet wird",
			commitScopeDesc:
				"Welche Dateien die Schaltflächen „Commit“ und „Commit-and-sync“ einschließen.",
			commitScopes: {
				smart: "Bereitgestellte Dateien, wenn welche bereitgestellt sind, sonst alles",
				all: "Alles",
				staged: "Nur bereitgestellte Dateien",
			},
			askForMessage: "Nach Nachricht fragen",
			askForMessageDesc:
				"Das Git-Plugin jedes Mal nach einer Commit-Nachricht fragen lassen, genau wie seine " +
				"Befehle „…with specific message“.",
			commitMessage: "Commit-Nachricht",
			commitMessageDesc:
				"Wird von den Commit-Schaltflächen dieser Karte verwendet. Leer lassen, um die " +
				"eigene Commit-Nachrichten-Vorlage des Git-Plugins zu verwenden.",
			commitMessagePlaceholder: "Vault-Sicherung: {{date}}",
			skipConfirm: "Bestätigungen überspringen",
			skipConfirmDesc:
				"Verwerfende Aktionen sofort ausführen statt zuerst zu fragen. Verworfene " +
				"Änderungen können nicht wiederhergestellt werden.",
			display: "Anzeige",
			changeLimit: "Gezeigte geänderte Dateien",
			changeLimitDesc: "0 listet jede geänderte Datei.",
			showPaths: "Ordner anzeigen",
			showPathsDesc: "Den Ordner jeder geänderten Datei unter ihrem Namen anzeigen.",
			logLimit: "Gezeigte Commits",
			logLimitDesc: "Wie viele neuere Commits der Log-Bereich auflistet.",
			refresh: "Neu einlesen alle",
			refreshDesc:
				"Minuten zwischen zusätzlichen Lesevorgängen des Repositorys, zusätzlich zum Folgen der " +
				"eigenen Aktualisierungen des Git-Plugins. 0 - die Voreinstellung - folgt nur diesen Aktualisierungen, " +
				"was bereits alles in Obsidian Erledigte abdeckt.",
		},
		operon: {
			view: "Ansicht",
			viewDesc: "Was diese Karte aus Operon zeichnet.",
			viewList: "Aufgabenliste",
			viewBoard: "Status-Board",
			viewAgenda: "Agenda",
			viewTimer: "Timer",
			scope: "Bereich",
			scopeDesc:
				"Eine der eigenen Bereichsansichten von Operon verwenden oder die Filter unten anwenden. " +
				"Operon entscheidet, was als überfällig oder heute anstehend gilt, damit seine " +
				"Bereiche korrekt bleiben, wenn sich seine Regeln weiterentwickeln.",
			scopeQuery: "Eigene Filter",
			scopeNormal: "Alle Aufgaben",
			scopeToday: "Heute anstehend",
			scopeOverdue: "Überfällig",
			scopeRecent: "Zuletzt bearbeitet",
			createAs: "Neue Aufgaben",
			createAsDesc:
				"Was das „+“ der Karte Operon erstellen lässt. Operons Standard folgt seinen eigenen " +
				"Einstellungen; die anderen beiden wählen, welches seiner konfigurierten Ziele verwendet wird - " +
				"nützlich, wenn eines davon nicht aufgelöst werden kann. Wohin die Aufgabe tatsächlich geht, " +
				"entscheidet so oder so Operon.",
			createAsDefault: "Operons Standard",
			createAsInline: "Inline, in einer Notiz",
			createAsFile: "Eigene Notiz",
			agendaDays: "Tage im Voraus",
			agendaDaysDesc: "Wie viele Tage die Agenda abdeckt, einschließlich heute.",
			count: "Gezeigte Aufgaben",
			countDesc: "Maximale Aufgaben in der Liste oder pro Board-Spalte.",
			pipelines: "Pipelines",
			pipelinesDesc: "Auf diese Operon-Pipelines beschränken. Keine Auswahl bedeutet alle.",
			statuses: "Status",
			statusesDesc: "Auf diese Operon-Status beschränken. Keine Auswahl bedeutet alle.",
			priorities: "Prioritäten",
			prioritiesDesc: "Auf diese Operon-Prioritäten beschränken. Keine Auswahl bedeutet alle.",
			checkbox: "Abschluss",
			checkboxDesc: "Welche Abschlusszustände eingeschlossen werden. Standardmäßig nur offene Aufgaben.",
			checkboxOpen: "Offen",
			checkboxDone: "Erledigt",
			checkboxCancelled: "Abgebrochen",
			text: "Texttreffer",
			textDesc: "Nur Aufgaben, deren Beschreibung diesen Text enthält.",
			sort: "Sortierung",
			sortDesc:
				"Reihenfolge der Liste und jeder Board-Spalte. Offene Aufgaben stehen immer " +
				"vor abgeschlossenen. Der Schalter kehrt die Richtung um.",
			sortSmart: "Smart (Datum, Priorität, Alter)",
			sortDue: "Datum",
			sortPriority: "Priorität",
			sortCreated: "Erstellt",
			sortAlpha: "Alphabetisch",
			showDue: "Termine anzeigen",
			showPriority: "Priorität anzeigen",
			showStatus: "Status anzeigen",
			showRecurrence: "Wiederholungsmarkierung anzeigen",
			showTracker: "Markierung für laufenden Timer anzeigen",
			showPinned: "Markierung für angeheftete Aufgaben anzeigen",
			showFile: "Notiznamen anzeigen",
			noOptions: "Füge zuerst eine Operon-Karte zum Board hinzu, um diese Optionen zu laden",
		},
		rss: {
			feeds: "Feeds",
			namePlaceholder: "Name (optional)",
			urlPlaceholder: "https://example.com/feed.xml",
			addFeed: "Feed hinzufügen",
			removeFeed: "Feed entfernen",
			github: "Von GitHub hinzufügen",
			githubDesc:
				"Gib ein Repository als owner/repo ein (oder füge dessen URL ein) und wähle, was du verfolgen willst - Hearth erstellt den Atom-Feed für dich.",
			githubPlaceholder: "owner/repo",
			githubReleases: "Releases",
			githubCommits: "Commits",
			githubBoth: "Releases & Commits",
			githubAdd: "Repo hinzufügen",
			githubInvalid: "Gib ein Repository als owner/repo ein.",
			githubReleasesName: "{repo} releases",
			githubCommitsName: "{repo} commits",
			mergeAll: "Kombinierter „Alle“-Tab",
			mergeAllDesc:
				"Einen führenden Tab hinzufügen, der jeden Feed zu einem Strom vereint, neueste zuerst.",
			display: "Anzeige",
			layout: "Layout",
			layoutDesc: "Wie jeder Eintrag gezeigt wird.",
			layoutList: "Liste (Titel + Datum)",
			layoutCards: "Karten (Auszug + Bild)",
			layoutCompact: "Kompakt (Schlagzeilen)",
			itemLimit: "Einträge pro Feed",
			itemLimitDesc: "Wie viele neuere Einträge gezeigt werden.",
			refresh: "Automatisch aktualisieren (Minuten)",
			refreshDesc: "Wie oft Feeds erneut abgerufen werden. 0 = nur beim Öffnen.",
			showImages: "Bilder anzeigen",
			showImagesDesc: "Vorschaubilder der Einträge zeigen, wenn der Feed sie liefert.",
			showExcerpt: "Auszug anzeigen",
			showExcerptDesc: "Einen kurzen Textausschnitt unter jedem Eintrag zeigen.",
			showDate: "Datum anzeigen",
			showDateDesc: "Die Veröffentlichungszeit jedes Eintrags zeigen.",
		},
		weather: {
			location: "Ort",
			search: "Ort suchen",
			searchDesc:
				"Nach Namen suchen - Hearth speichert die Koordinaten auf der Karte, daher " +
				"findet diese Suche nur einmal statt.",
			searchDisabled:
				"Die Ortssuche ist nicht verfügbar, solange externe Aufrufe in den " +
				"Hearth-Einstellungen deaktiviert sind. Du kannst unten trotzdem Koordinaten eingeben.",
			searchPlaceholder: "Prag, Lissabon, Kyoto…",
			searchButton: "Suchen",
			searchEmpty: "Gib einen Ortsnamen zum Suchen ein.",
			searchNoResults: "Keine Orte passen zu diesem Namen.",
			usePlace: "Verwenden",
			reuse: "Ort wiederverwenden",
			reuseDesc: "Ein Ort, der bereits auf einer deiner Wetter-Karten gesetzt ist.",
			reusePick: "Ort wählen…",
			unnamedPlace: "(unbenannter Ort)",
			clearPlace: "Ort entfernen",
			coordinates: "Koordinaten",
			coordinatesDesc: "Breiten- und Längengrad in Dezimalgrad, wenn du lieber nicht suchen willst.",
			latPlaceholder: "50.08",
			lonPlaceholder: "14.44",
			placeName: "Bezeichnung",
			placeNameDesc: "Wie die Karte diesen Ort nennt.",
			placeNamePlaceholder: "Zuhause",

			appearance: "Erscheinungsbild",
			style: "Stil",
			styleDesc: "Wie viel der Vorhersage die Karte anzeigt.",
			styleMinimal: "Minimal (Symbol + Temperatur)",
			styleCompact: "Kompakt (eine Zeile)",
			styleDetailed: "Detailliert (Kennzahlenraster)",
			styleForecast: "Vorhersage (Stundenkurve)",
			styleArtistic: "Künstlerisch (gemalter Himmel)",
			animate: "Himmel animieren",
			animateDesc:
				"Ziehende Wolken, fallender Regen und funkelnde Sterne. Im Stromsparmodus immer aus.",

			units: "Einheiten",
			tempUnit: "Temperatur",
			tempUnitC: "Celsius (°C)",
			tempUnitF: "Fahrenheit (°F)",
			windUnit: "Windgeschwindigkeit",
			windUnitKmh: "Kilometer pro Stunde (km/h)",
			windUnitMs: "Meter pro Sekunde (m/s)",
			windUnitMph: "Meilen pro Stunde (mph)",
			windUnitKn: "Knoten (kn)",
			precipUnit: "Niederschlag",
			precipUnitMm: "Millimeter (mm)",
			precipUnitInch: "Zoll (in)",
			hourFormat: "Zeitformat",
			hourFormatAuto: "Automatisch (Gebietsschema)",
			hourFormat12: "12 Stunden",
			hourFormat24: "24 Stunden",

			display: "Was gezeigt wird",
			showLocation: "Ortsname",
			showCondition: "Wetterlage",
			showFeelsLike: "Gefühlt",
			showHighLow: "Heutige Höchst- und Tiefstwerte",
			showHumidity: "Luftfeuchtigkeit",
			showWind: "Wind",
			showPrecip: "Niederschlag",
			showPrecipDesc: "Regenwahrscheinlichkeit und gefallene Menge, plus stündliche Wahrscheinlichkeiten.",
			showUv: "UV-Index",
			showPressure: "Luftdruck",
			showSun: "Sonnenauf- und -untergang",
			showUpdated: "Zuletzt aktualisiert",
			hourlyCount: "Stunden im Voraus",
			hourlyCountDesc: "Wie viele Stunden der Stundenstreifen abdeckt. 0 blendet ihn aus.",
			dailyCount: "Tage im Voraus",
			dailyCountDesc: "Wie viele Tage die Tagesvorhersage abdeckt. 0 blendet sie aus.",
			refresh: "Automatisch aktualisieren (Minuten)",
			refreshDesc: "Wie oft die Vorhersage erneut abgerufen wird. 0 = nur beim Öffnen.",
		},
		jira: {
			host: "Jira-Host",
			hostDesc: "Die Adresse der Jira-Site. HTTPS ist erforderlich, wenn ein persönlicher Zugangstoken gesendet wird.",
			hostPlaceholder: "https://jira.example.com",
			pat: "Persönlicher Zugangstoken",
			patDesc: "Bearer-PAT für diese Karte. In den Plugin-Daten von Hearth gespeichert.",
			apiBase: "API-Basispfad",
			apiBaseDesc: "Ein relativer Jira-REST-Pfad. Vollständige URLs werden abgelehnt.",
			apiBasePlaceholder: "/rest/api/latest",
			savedFilter: "Gespeicherter Filter",
			savedFilterDesc: "Lade deine favorisierten Jira-Filter und wähle einen.",
			selectedFilter: (name: string) => `Ausgewählt: ${name}`,
			loadFilters: "Favorisierte Filter laden",
			chooseFilter: "Filter wählen…",
			noFavoriteFilters: "Jira hat keine favorisierten Filter zurückgegeben.",
			loadFailed: "Jira-Filter konnten nicht geladen werden. Prüfe Host, API-Pfad und Token.",
			externalCallsDisabled:
				"Favorisierte Filter können nicht geladen werden, solange externe Aufrufe in den Hearth-Einstellungen deaktiviert sind.",
			controls: "Filtersteuerung",
			maxResults: "Max. Ergebnisse",
			maxResultsDesc: "Die meisten anzuzeigenden Vorgänge, bis zu 200.",
			refresh: "Automatisch aktualisieren (Minuten)",
			refreshDesc: "Wie oft Jira aktualisiert wird. 0 = nur beim Öffnen oder manuellem Aktualisieren.",
			cache: "Cache-Intervall (Minuten)",
			cacheDesc: "Wie lange erfolgreiche Jira-Antworten im Speicher bleiben. 0 deaktiviert das Caching.",
		},
		leaf: {
			view: "Zu hostende Ansicht",
			viewDesc:
				"Eine registrierte Seitenleisten-Ansicht aus einem Kern- oder Community-Plugin " +
				"(Kalender, Outline, Tag-Bereich, Kanban…). Die Liste hängt davon ab, welche " +
				"Plugins aktiviert sind.",
			pickPlaceholder: "Ansicht wählen…",
			none: "Keine hostbaren Ansichten gefunden. Aktiviere ein Plugin, das eine Seitenleisten-Ansicht bereitstellt.",
			file: "Anzuzeigende Datei",
			fileDesc:
				"Optional. Eine bestimmte Vault-Datei in der gehosteten Ansicht öffnen - eine " +
				"Excalidraw-Zeichnung, ein Canvas, eine Notiz. Leer lassen, um die Ansicht " +
				"ohne Datei zu hosten (manche Ansichten zeigen dann einen leeren oder „new file“-Bildschirm).",
			filePlaceholder: "z. B. Drawings/Sketch.excalidraw.md",
			pickFile: "Datei wählen",
			clearFile: "Datei entfernen",
			hideHeader: "Ansichtskopf ausblenden",
			hideHeaderDesc:
				"Den eigenen Kopf der gehosteten Ansicht ausblenden - deren Breadcrumbs, " +
				"Zurück-/Vorwärts-Pfeile und Menü. Praktisch, wenn die Karte eine einzelne Datei zeigt.",
			perfLabel: "Leistung",
			perfNote:
				"Dies ist bei Weitem die schwerste Karte, die Hearth hat. Sie führt die vollständige " +
				"Ansicht eines anderen Plugins live im Dashboard aus und hält dessen eigene " +
				"Timer, Listener und Rendering am Laufen, solange das Board geöffnet ist " +
				"- jede dieser Karten kostet erneut. Höchstens eine oder zwei verwenden und auf schwächerer " +
				"Hardware ein langsameres Dashboard erwarten.",
			perfNoteTier:
				"Du hast die Leistungsstufe heruntergesetzt. Sie kann diese " +
				"Karte nicht verlangsamen - eine gehostete Ansicht verwaltet sich selbst - daher ist dies die eine Karte, " +
				"die du entfernen solltest, wenn sich das Dashboard noch schwer anfühlt.",
			note: "Beta",
			noteDesc:
				"Hostet die Ansicht eines anderen Plugins in der Karte. Manche Ansichten erwarten eine " +
				"Seitenleiste und werden hier möglicherweise seltsam dargestellt oder skaliert.",
		},
		pet: {
			species: "Tier",
			name: "Name",
			nameDesc: "Wie es heißen soll. Leer lassen, um den Namen des Tiers zu verwenden.",
			colors: "Farben",
			colorsDesc:
				"Körper und Akzent. Kontur, Schattierung und Bauch werden aus " +
				"der Körperfarbe abgeleitet.",
			colorsReset: "Zurück zu den Farben dieses Tiers",
			size: "Größe",
			sizeSmall: "Klein",
			sizeMedium: "Mittel",
			sizeLarge: "Groß",
			metric: "Füttern mit",
			metricDesc: "Welcher Vault-Aktivität die Stimmung des Tiers folgt.",
			metricModified: "Notizen bearbeitet",
			metricCreated: "Notizen erstellt",
			moods: "Stimmungen",
			moodsDesc:
				"Wo jede Stimmung beginnt. Nichts hier kann das Tier krank machen oder " +
				"verlieren - ein stiller Vault schickt es nur schlafen, und jedes Schreiben " +
				"weckt es sofort wieder auf.",
			moodsReset: "Zurück zu den Standardstimmungen",
			excitedAt: "Vor Freude hüpfend ab",
			excitedAtDesc: "Heute berührte Notizen, oder mehr.",
			happyAt: "Glücklich ab",
			happyAtDesc: "Heute berührte Notizen - dein guter Tag.",
			contentAt: "Zufrieden ab",
			contentAtDesc: "Heute berührte Notizen. Darunter langweilt sich das Tier.",
			sleepyAfter: "Schläft ein nach",
			sleepyAfterDesc:
				"Minuten, in denen nirgends im Vault etwas berührt wurde. Das Tier schläft, " +
				"egal wie seine Stimmung ist und wie gut der Tag war, und jede Aktivität weckt " +
				"es wieder dort, wo der Tag stehen geblieben ist.",
			pettedFor: "Ein Streicheln dauert",
			pettedForDesc: "Minuten garantierten Glücks, nachdem du das Tier angeklickt hast.",
			nightSleep: "Nachts",
			nightSleepDesc:
				"Was die Uhr darf. Auch eine sehr kurze Stunde zählt als volle Stunde und nicht als Vernachlässigung - ein guter Tag bleibt weiterhin ein guter Tag, und Streicheln weckt das Tier immer, egal was du hier einstellst.",
			nightOff: "Nichts - nur der Vault zählt",
			nightQuiet: "Ein gelangweiltes oder zufriedenes Tier schläft stattdessen",
			nightAlways: "Nachts immer schlafend",
			nightWindow: "Nacht läuft von",
			nightWindowDesc: "Deine lokale Zeit. Das Fenster darf Mitternacht überschreiten.",
			eyesFollow: "Augen folgen dem Zeiger",
			eyesFollowDesc: "Ein schlafendes Tier hält die Augen geschlossen, egal was du hier einstellst.",
			eyesOff: "Nie",
			eyesCard: "Auf der eigenen Karte",
			eyesBoard: "Überall auf dem Dashboard",
			showName: "Namen anzeigen",
			showMood: "Stimmung anzeigen",
			showActivity: "Heutige Aktivität anzeigen",
		},
		colors: {
			heading: "Farben",
			headingDesc: "Akzent und Hintergrundtönung für diese Karte.",
			clearAccent: "Akzent entfernen",
			clearBackground: "Hintergrund entfernen",
			cardOpacity: "Kartendeckkraft",
			cardOpacityDesc:
				"Transparente Kartenoberfläche (überschreibt die Dashboard-Voreinstellung).",
			cardBlur: "Karten-Weichzeichner",
			cardBlurDesc:
				"Milchglas-Weichzeichner hinter dieser Karte (überschreibt die Dashboard-Voreinstellung). Braucht eine Deckkraft unter 100 %.",
			cardBorderWidth: "Kartenrahmen",
			cardBorderWidthDesc:
				"Rahmendicke für diese Karte (überschreibt die Dashboard-Voreinstellung). 0 entfernt den Rahmen und die Linie unter dem Titel.",
			useDashboardDefault: "Dashboard-Voreinstellung verwenden",
		},
		size: {
			heading: "Größe",
			headingDesc:
				"Breite (% des Boards) und Höhe (Pixel). Oder einfach eine Kante oder Ecke der Karte ziehen.",
			widthAria: "Breite in Prozent des Boards",
			heightAria: "Höhe in Pixeln",
		},
		pin: {
			heading: "Auf allen Dashboards anheften",
			headingDesc:
				"Diese Karte auf jedem Dashboard zeigen, mit einer gemeinsamen Definition und Position.",
		},
		copy: {
			heading: "Auf Dashboard kopieren",
			headingDesc:
				"Ein Duplikat dieser Karte am Ende eines anderen Dashboards hinzufügen.",
			copy: "Kopieren",
			copyTooltip: "Diese Karte auf das gewählte Dashboard kopieren",
		},
	},
	// ---- Karteninhalte (dargestellter Inhalt) --------------------------------
	cards: {
		empty: {
			searchNoQuery: "Lege eine Abfrage in den Karteneinstellungen fest",
			searchNoMatches: "Keine Treffer",
			embedPickFile: "Wähle eine Datei zum Einbetten in den Einstellungen",
			slideshowEmpty: "Füge Bilder in den Karteneinstellungen hinzu",
			slideshowFolderEmpty: "Keine Bilder in diesem Ordner",
			embedEnableBases: "Aktiviere das Kern-Plugin Bases, um .base-Dateien einzubetten",
			embedEnableCanvas: "Aktiviere das Kern-Plugin Canvas, um Canvases einzubetten",
			embedInstallExcalidraw: "Installiere das Excalidraw-Plugin, um Zeichnungen einzubetten",
			dailyEnable: "Aktiviere das Kern-Plugin für Tagesnotizen",
			periodicInstall: "Installiere das Periodic Notes-Plugin",
			scheduleNoSources:
				"Aktiviere das Kern-Plugin für Tagesnotizen oder abonniere einen Kalender in den Einstellungen dieser Karte",
			webNoUrl: "Lege eine Web-URL in den Einstellungen fest",
			bookmarksEnable: "Aktiviere das Kern-Plugin Lesezeichen",
			bookmarksEmpty: "Noch keine Lesezeichen",
			favoritesEmpty: "Füge Favoriten in den Einstellungen hinzu",
			recentEmpty: "Keine kürzlich verwendeten Dateien",
			linksEmpty: "Füge Links in den Einstellungen hinzu",
			commandsEmpty: "Füge Befehle in den Karteneinstellungen hinzu",
			templaterEnable: "Aktiviere das Templater-Plugin, um Notizen aus Vorlagen zu erstellen",
			templaterEmpty: "Füge eine Vorlage in den Karteneinstellungen hinzu",
			tasksEnable:
				"Aktiviere das TaskNotes-Plugin oder wechsle die Quelle zu Checkboxen",
			tasksEmpty: "Keine offenen Aufgaben",
			tasksNoMatch: "Keine Aufgaben passen zum Filter",
			kanbanNoBoard:
				"Kein Kanban-Board gefunden - wähle eine Board-Notiz in den Karteneinstellungen oder erstelle eine mit dem Kanban-Plugin",
			dataviewEnable: "Aktiviere das Dataview-Plugin, um Abfragen auszuführen",
			dataviewNoQuery: "Lege eine Dataview-Abfrage in den Karteneinstellungen fest",
			datacoreEnable: "Aktiviere das Datacore-Plugin, um Abfragen auszuführen",
			datacoreNoQuery: "Lege eine Datacore-Abfrage in den Karteneinstellungen fest",
			datacoreBadQuery: "Datacore konnte diese Abfrage nicht lesen",
			datacoreOneQuery:
				"Eine Karte führt eine Abfrage aus - das sieht nach mehreren aus. Behalte nur die gewünschte, ohne Kommentar danach.",
			datacoreFailed: "Datacore konnte diese Karte nicht ausführen",
			gitEnable: "Aktiviere das Git-Plugin, um das Repository deines Vaults zu verwalten",
			gitNotReady: "Noch kein Repository geöffnet - richte eines im Git-Plugin ein",
			rssNoSources: "Füge einen Feed in den Karteneinstellungen hinzu",
			weatherNoLocation: "Wähle einen Ort in den Karteneinstellungen",
			renderFailed: "Diese Karte konnte nicht gezeichnet werden - Details findest du in der Konsole",
			leafPickView: "Wähle eine Plugin-Ansicht in den Karteneinstellungen",
			boardPickView: "Wähle eine Ansicht für dieses Board in den Dashboard-Einstellungen",
			boardNeedsFile: "Wähle eine Datei für dieses Board in den Dashboard-Einstellungen",
			leafViewMissing:
				"Diese Ansicht ist nicht verfügbar - aktiviere das Plugin, das sie bereitstellt",
			operonEnable: "Aktiviere das Operon-Plugin, um seine Aufgaben anzuzeigen",
			operonDisabled:
				"Die Operon-Integration ist aus - schalte sie unter Einstellungen → Hearth → Integrations ein",
			operonUnsupported:
				"Operons Developer-API läuft nur auf dem Desktop und braucht Obsidian 1.12.2 oder neuer",
			operonPending:
				"Bestätige Hearth unter Einstellungen → Operon → Core → General → Developer API Integrations",
			operonSuspended:
				"Operon hat den Zugriff von Hearth pausiert - prüfe ihn in Operons Developer API Integrations",
			operonRevoked:
				"Der Operon-Zugriff wurde entzogen - erteile ihn erneut in Operons Developer API Integrations",
			operonBooting: "Operon startet noch",
			operonError: "Operon hat die Verbindung abgelehnt",
			operonNoTasks: "Keine passenden Operon-Aufgaben",
			operonNoAgenda: "Nichts in diesem Zeitraum geplant",
			operonNoColumns: "Keine Operon-Status anzuzeigen - wähle eine Pipeline in den Karteneinstellungen",
		},
		operon: {
			loading: "Lese Operon…",
			untitled: "Unbenannte Aufgabe",
			settling: "Wird abgeglichen…",
			timerIdle: "Kein Timer läuft",
			timerStarting: "Startet…",
			timerStopping: "Stoppt…",
			timerUnassigned: "Nicht zugeordnete Zeit",
			truncated: (shown: number, total: number) => `Zeige ${shown} von ${total}`,
			readFailed: (reason: string) => `Operon konnte nicht antworten: ${reason}`,
			/** Operons eigene Worte, wörtlich unter einem Leerzustand gezeigt, damit
			 * das Problem diagnostizierbar bleibt statt geraten. */
			errorDetail: (code: string, reason: string) => (reason ? `${code} - ${reason}` : code),
			addTask: "Aufgabe hinzufügen",
			moveTo: "Verschieben nach",
			targetDaily: "Operon ist so eingestellt, dass neue Inline-Aufgaben in der heutigen Tagesnotiz landen.",
			targetFile: (path: string) => `Operon ist so eingestellt, dass neue Inline-Aufgaben in ${path} landen.`,
			targetActive: "Operon ist so eingestellt, dass neue Inline-Aufgaben in der aktiven Datei landen.",
			targetAsk:
				"Operon ist so eingestellt, dass es bei jeder neuen Inline-Aufgabe nach dem Ziel fragt, was eine Dashboard-Karte nicht beantworten kann - wähle stattdessen „Eigene Notiz“ auf dieser Karte.",
			targetNote: (folder: string) =>
				folder
					? `Operon ist so eingestellt, dass neue Aufgaben als Notizen in ${folder} erstellt werden.`
					: "Operon ist so eingestellt, dass neue Aufgaben als eigene Notizen erstellt werden.",
			addTaskPlaceholder: "Was ist zu tun?",
			addTaskDue: "Fälligkeitsdatum",
			confirmTitle: "Operon braucht eine Bestätigung",
			/** Operon hat die Änderung bewertet und um Zustimmung gebeten; seine eigene
			 * Zusammenfassung dessen, was passieren würde, wird gezeigt statt Hearths Vermutung. */
			confirmMessage: (risk: string, effects: string) =>
				effects
					? `Operon bewertet diese Änderung als ${risk}: ${effects}`
					: `Operon bewertet diese Änderung als ${risk}.`,
			confirmApply: "Anwenden",
		},
		templater: {
			untitledTile: "Neue Notiz",
			vaultRoot: "Standardspeicherort",
			untitledNote: "Unbenannt",
			createsIn: (destination: string) => `Erstellt ${destination}`,
			promptTitle: "Benenne die neue Notiz",
			promptPlaceholder: "Worum geht es?",
		},
		pet: {
			species: {
				cat: "Katze",
				dog: "Hund",
				bird: "Vogel",
				fox: "Fuchs",
				frog: "Frosch",
				blob: "Blob",
			},
			moodExcited: "Vor Freude hüpfend",
			moodHappy: "Glücklich",
			moodContent: "Zufrieden",
			moodBored: "Etwas gelangweilt",
			moodSleepy: "Fest eingeschlafen",
			moodNight: "Schläft für die Nacht",
			petHint: "Klicken zum Streicheln",
			todayCount: (count: number, metric: "modified" | "created") =>
				metric === "created"
					? `${count} neue Notiz${count === 1 ? "" : "en"} heute`
					: `${count} Notiz${count === 1 ? "" : "en"} heute`,
			streak: (days: number) => `${days}-Tage-Serie`,
		},
		embed: {
			openFile: "Diese Datei öffnen",
			editHint: "Doppelklicken zum Bearbeiten",
			emptyNotePlaceholder: "Leere Notiz…",
			emptyNoteHint: "Leere Notiz - doppelklicken zum Bearbeiten",
			/** Beschriftung der Wechselschaltfläche, wenn für eine Ansicht noch keine Datei gewählt ist. */
			viewFallback: (n: number) => `Ansicht ${n}`,
			switchTo: (label: string) => `Wechseln zu ${label}`,
		},
		slideshow: {
			previous: "Vorheriges Bild",
			next: "Nächstes Bild",
			pause: "Diashow pausieren",
			play: "Diashow fortsetzen",
			openImage: "Dieses Bild öffnen",
		},
		text: {
			placeholder: "Etwas notieren…",
		},
		calculator: {
			placeholder: "2 + 2, 10 km in Meilen, 10 € in USD…",
		},
		rss: {
			allTab: "Alle",
			untitled: "(unbenannt)",
			loading: "Lade Feed…",
			empty: "Keine Einträge in diesem Feed",
			error: "Dieser Feed konnte nicht geladen werden",
			disabled: "Feeds sind aus (externe Aufrufe deaktiviert)",
			refresh: "Aktualisieren",
		},
		weather: {
			loading: "Lade Vorhersage…",
			error: "Die Vorhersage konnte nicht geladen werden",
			disabled: "Wetter ist aus (externe Aufrufe deaktiviert)",
			now: "Jetzt",
			todayLabel: "Heute",
			feelsLike: (temp: string) => `Gefühlt ${temp}`,
			highLow: (high: string, low: string) => `Max ${high} · Min ${low}`,
			updated: (time: string) => `Aktualisiert ${time}`,
			humidity: "Luftfeuchtigkeit",
			wind: "Wind",
			precip: "Niederschlag",
			uv: "UV",
			pressure: "Luftdruck",
			sunrise: "Sonnenaufgang",
			sunset: "Sonnenuntergang",
			/** Himmelsrichtungen, im Uhrzeigersinn ab Norden. Über das Achtel
			 * der Peilung indextiert - alle acht behalten, in dieser Reihenfolge. */
			compass: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
			/** Der Vollvorhersage-Dialog, den eine Wetterkarte per Klick öffnet:
			 * alle Messwerte aus der Antwort, egal was die Karte zeigt. */
			detail: {
				title: "Vorhersage",
				open: "Vollständige Vorhersage öffnen",
				now: "Gerade jetzt",
				days: "Die kommende Woche",
				hoursFor: (day: string) => `Stunde für Stunde · ${day}`,
				selectDay: (day: string) => `Zeige ${day} Stunde für Stunde`,
				noHours: "Keine Stunden mehr an diesem Tag",
				refresh: "Aktualisieren",
				source: "Open-Meteo",
				feelsLikeLabel: "Gefühlt",
				gust: "Böen",
				cloudCover: "Wolkenbedeckung",
				precipChance: "Regenwahrscheinlichkeit",
				precipHour: "Regen in dieser Stunde",
				precipTotal: "Regen gesamt",
				windMax: "Stärkster Wind",
				uvMax: "UV-Maximum",
				columnTime: "Zeit",
				columnCondition: "Wetterlage",
				columnTemp: "Temp.",
				columnFeels: "Gefühlt",
				columnPrecip: "Regen",
				columnWind: "Wind",
				columnHumidity: "Luftfeuchtigkeit",
				columnUv: "UV",
			},
			/** Einer pro WMO-Wettercode-Gruppe; siehe `weatherLabelKey`. */
			conditions: {
				clear: "Klar",
				mainlyClear: "Überwiegend klar",
				partlyCloudy: "Teils bewölkt",
				overcast: "Bedeckt",
				fog: "Nebel",
				rimeFog: "Gefrierender Nebel",
				drizzle: "Nieselregen",
				freezingDrizzle: "Gefrierender Nieselregen",
				rain: "Regen",
				heavyRain: "Starker Regen",
				freezingRain: "Gefrierender Regen",
				showers: "Regenschauer",
				snow: "Schnee",
				heavySnow: "Starker Schneefall",
				snowGrains: "Schneegriesel",
				snowShowers: "Schneeschauer",
				thunderstorm: "Gewitter",
				thunderstormHail: "Gewitter mit Hagel",
				unknown: "Unbekannt",
			},
		},
		jira: {
			controls: {
				status: "Status",
				assignee: "Zuständig",
				priority: "Priorität",
				issueType: "Vorgangstyp",
				sprint: "Sprint",
				fixVersion: "Fix-Version",
			},
			controlCount: (label: string, count: number) => `${label} (${count})`,
			searchPlaceholder: "Optionen suchen…",
			searchAria: (label: string) => `Suche ${label}-Optionen`,
			noOptions: "Keine Optionen",
			noMatchingOptions: "Keine passenden Optionen",
			refresh: "Jira-Vorgänge aktualisieren",
			loading: "Lade Jira-Vorgänge…",
			error: "Jira-Vorgänge konnten nicht geladen werden",
			empty: "Keine Vorgänge passen zu diesen Filtern",
			disabled: "Jira ist aus (externe Aufrufe deaktiviert)",
			notConfigured: "Lege Jira-Host, Token und gespeicherten Filter in den Karteneinstellungen fest",
		},
		git: {
			sections: {
				status: "Repository-Status",
				actions: "Schaltflächen",
				changes: "Geänderte Dateien",
				log: "Letzte Commits",
			},
			actions: {
				commitAndSync: "Commit und Sync",
				commit: "Commit",
				push: "Push",
				pull: "Pull",
				fetch: "Fetch",
				stageAll: "Alle bereitstellen",
				unstageAll: "Alle Bereitstellungen aufheben",
				discardAll: "Alle Änderungen verwerfen",
				switchBranch: "Branch wechseln",
				sourceControl: "Quellcodeverwaltung öffnen",
				history: "Verlauf öffnen",
			},
			refresh: "Repository erneut einlesen",
			noBranch: "Kein Branch",
			noUpstream: "Kein Upstream-Branch",
			staged: "bereitgestellt",
			unstaged: "geändert",
			conflicted: "in Konflikt",
			unpushed: "ungepushte Commits",
			clean: "Alles ist committet",
			noChanges: "Nichts geändert",
			noCommits: "Noch keine Commits",
			noMessage: "(keine Nachricht)",
			lastCommit: (when: string) => `Letzter Commit ${when}`,
			more: (count: number) => `${count} weitere…`,
			openSourceControl: "Quellcodeverwaltung öffnen",
			openHistory: "Verlauf öffnen",
			openDiff: "Diff öffnen",
			stageFile: "Bereitstellen",
			unstageFile: "Bereitstellung aufheben",
			discardFile: "Änderungen verwerfen",
			confirmTitle: "Änderungen verwerfen?",
			confirmDiscard:
				"Alle uncommitteten Änderungen im Vault werden verworfen. Das kann nicht rückgängig gemacht werden.",
			confirmDiscardFile: (name: string) =>
				`Uncommittete Änderungen an „${name}“ werden verworfen. Das kann nicht rückgängig gemacht werden.`,
			confirmDiscardButton: "Verwerfen",
			unsupported: "Diese Version des Git-Plugins unterstützt das nicht",
		},
		daily: {
			createToday: "Heutige Notiz erstellen",
			openToday: "Heutige Notiz öffnen",
			noNoteYet: "Noch keine Notiz für heute",
		},
		periodic: {
			/** Die aktuelle Periode, so wie sie in den Sätzen unten steht. */
			period: {
				day: "heute",
				week: "diese Woche",
				month: "diesen Monat",
				quarter: "dieses Quartal",
				year: "dieses Jahr",
			},
			noNoteYet: (period: string) => `Noch keine Notiz für ${period}`,
			create: (period: string) => `Notiz für ${period} erstellen`,
			open: (period: string) => `Notiz für ${period} öffnen`,
			notEnabled: (granularity: string) =>
				`Schalte ${granularity}-Notizen in Periodic Notes ein`,
		},
		heatmap: {
			less: "Weniger",
			more: "Mehr",
			unitModified: "Notizen bearbeitet",
			unitCreated: "Notizen erstellt",
			unitNotes: "Notizen",
			dayValue: (date: string, value: string, unit: string) => `${date}: ${value} ${unit}`,
		},
		calendar: {
			previousMonth: "Vorheriger Monat",
			nextMonth: "Nächster Monat",
			backToToday: "Zurück zu heute",
			dayEdited: (date: string, count: number) => `${date}: ${count} bearbeitet`,
			dayTasks: (date: string, count: number) =>
				count === 1 ? `${date}: 1 Aufgabe` : `${date}: ${count} Aufgaben`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date}: ${count} ${metric}`,
			dayEvents: (date: string, count: number) =>
				`${date}: ${count} ${count === 1 ? "Ereignis" : "Ereignisse"}`,
			agendaNoNote: "Keine Notiz",
			allDay: "Ganztägig",
			untitledEvent: "(Ohne Titel)",
			openDailyNote: "Tagesnotiz öffnen",
			createDailyNote: "Tagesnotiz erstellen",
			eventsHeading: "Ereignisse",
			eventNotes: "Notizen",
			createEventNote: "Notiz erstellen",
			openEventNote: "Notiz öffnen",
			taskNotesSource: "TaskNotes",
			taskDue: "Fällig",
			taskTimeblock: "Zeitblock",
			taskComplete: "Abschließen",
			taskReopen: "Erneut öffnen",
			taskEstimate: (minutes: number) =>
				minutes >= 60
					? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
					: `${minutes}m`,
			openTaskNote: "Aufgabe öffnen",
		},
		schedule: {
			previous: "Zurück",
			next: "Weiter",
			today: "Heute",
			views: {
				month: "Monat",
				week: "Woche",
				day: "Tag",
				list: "Liste",
			},
			more: (count: number) => `+${count} weitere`,
			listEmpty: (days: number) => `Nichts in den nächsten ${days} Tagen`,
		},
		stats: {
			notes: "Notizen",
			attachments: "Anhänge",
			folders: "Ordner",
			tags: "Tags",
			dayStreak: "Tage-Serie",
			daysUsing: "Tage mit Obsidian",
		},
		web: {
			openInBrowser: "Im Browser öffnen",
			mayRefuse: "Diese Seite lässt sich vielleicht nicht einbetten.",
		},
		bookmarks: {
			untitled: "Unbenannt",
		},
		tasks: {
			createNewTask: "Neue Aufgabe erstellen",
			toDo: "Offen",
			done: "Erledigt",
			statusInProgress: "In Bearbeitung",
			noStatus: "Kein Status",
			hideColumn: (label: string) => `Spalte „${label}“ ausblenden`,
			markOccurrence: "Heutiges Vorkommen als erledigt markieren",
			recurring: "Wiederkehrend",
			addCard: "Karte hinzufügen",
			addCardPlaceholder: "Kartentext…",
			createAsNote: "Als Notiz erstellen",
			noteBody: "Notizinhalt",
			convertToNote: "In Notiz umwandeln",
			editMetadata: "Termine und Priorität bearbeiten",
			deleteCard: "Karte löschen",
			openNote: "Notiz öffnen",
			deleteTask: "Aufgabe löschen",
			deleteTaskConfirm: "Diese Aufgabe löschen? Sie wird aus der Notiz entfernt.",
			noMetadata: "Keine Termine oder Priorität festgelegt.",
			save: "Speichern",
			cancel: "Abbrechen",
			setDoneColumn: (label: string) => `„${label}“ als Erledigt-Spalte markieren`,
			unsetDoneColumn: (label: string) =>
				`Automatisches Abschließen für „${label}“ beenden`,
			dueDate: "Fälligkeitsdatum",
			startDate: "Startdatum",
			scheduledDate: "Geplantes Datum",
			doneDate: "Erledigt-Datum",
			recurrenceLabel: "Wiederholen",
			recurrenceNever: "Nie",
			recurrenceEvery: "alle",
			recurrenceInterval: "Wiederholungsintervall",
			recurrenceUnits: {
				day: "Täglich",
				week: "Wöchentlich",
				month: "Monatlich",
				year: "Jährlich",
			},
			taskCount: (n: number) => (n === 1 ? "1 Aufgabe" : `${n} Aufgaben`),
			description: "Beschreibung",
			descriptionPlaceholder: "Notizen… (reiner Text)",
			renameColumnHint: "Doppelklicken zum Umbenennen",
			editTitle: "Titel bearbeiten",
			editTitleHint: "Doppelklicken zum Bearbeiten",
			titlePlaceholder: "Kartentitel…",
			priority: "Priorität",
			priorityNone: "Keine Priorität",
			priorityHighest: "Höchste Priorität",
			priorityHigh: "Hohe Priorität",
			priorityMedium: "Mittlere Priorität",
			priorityLow: "Niedrige Priorität",
			priorityLowest: "Niedrigste Priorität",
			sort: "Sortieren",
			sortReverse: "Reihenfolge umkehren",
			sortLabels: {
				smart: "Smart",
				due: "Fälligkeitsdatum",
				priority: "Priorität",
				created: "Erstelldatum",
				alpha: "Alphabetisch",
			},
			sortCustom: "Benutzerdefiniert",
			sortCustomOption: "Benutzerdefiniert sortieren…",
			sortTitle: "Benutzerdefinierte Sortierung",
			sortHint:
				"Sortiere Aufgaben nach diesen Regeln der Reihe nach - die erste ist die Hauptsortierung, jede weitere entscheidet bei Gleichstand.",
			sortFields: {
				due: "Fälligkeitsdatum",
				scheduled: "Geplantes Datum",
				priority: "Priorität",
				created: "Erstelldatum",
				alpha: "Alphabetisch",
				status: "Status",
			},
			sortAscending: "Aufsteigend",
			sortDescending: "Absteigend",
			sortLevelFirst: "Sortieren nach",
			sortLevelNext: "dann nach",
			sortAddRule: "Regel hinzufügen",
			sortRemoveRule: "Regel entfernen",
			sortMoveUp: "Nach oben",
			sortMoveDown: "Nach unten",
			sortEmpty: "Noch keine Regeln - füge eine hinzu, sonst gilt die Standard-Sortierung Smart.",
			filter: "Filter",
			filterTitle: "Aufgaben filtern",
			filterPresets: {
				overdue: "Überfällig",
				today: "Heute",
				week: "Diese Woche",
				highPriority: "Hohe Priorität",
				noDate: "Kein Datum",
			},
			filterDue: "Datum",
			filterDueDesc: "Trifft auf Fälligkeits- oder geplantes Datum einer Aufgabe zu.",
			filterDueAny: "Beliebig",
			filterDueHasDate: "Hat ein Datum",
			filterPriority: "Priorität",
			filterPriorityLevels: {
				high: "Hoch",
				medium: "Mittel",
				low: "Niedrig",
				none: "Keine",
			},
			filterStatus: "Status",
			filterContexts: "Kontexte",
			filterProjects: "Projekte",
			filterText: "Text enthält",
			filterTextPlaceholder: "Aufgabentext suchen…",
			filterApply: "Anwenden",
			filterClear: "Zurücksetzen",
			valueChange: "Wert ändern",
			dateTitle: "Datum festlegen",
			dateOn: "Datum",
			dateToday: "Heute",
			dateTomorrow: "Morgen",
			dateNextWeek: "Nächste Woche",
			dateClear: "Datum löschen",
			valueCustom: "Anderer Wert…",
			valueCustomTitle: "Wert festlegen",
			valueClear: "Wert löschen",
		},
	},
	// ---- Relative Daten (Aufgabenkarte) -----------------------------------
	dates: {
		today: "Heute",
		tomorrow: "Morgen",
		yesterday: "Gestern",
		daysAgo: (n: number) => `vor ${n} Tagen`,
		nextWeekday: (weekday: string) => `Nächsten ${weekday}`,
		lastWeekday: (weekday: string) => `Letzten ${weekday}`,
	},

	// ---- Wiederholungsregel-Labels (Aufgabenkarte) ---------------------------
	recurrence: {
		repeats: "Wiederholt sich",
		units: {
			day: "Tag",
			week: "Woche",
			month: "Monat",
			year: "Jahr",
		},
		everyOne: (unit: string) => `Wiederholt sich ${ADVERB_UNIT[unit] ?? `pro ${unit}`}`,
		everyMany: (count: number, unit: string) =>
			`Wiederholt sich alle ${count} ${pluralUnit(unit)}`,
	},

	// ---- Uhr-Begrüßungen -----------------------------------------------
	clock: {
		greetingMorning: "Guten Morgen",
		greetingAfternoon: "Guten Nachmittag",
		greetingEvening: "Guten Abend",
		// Ein Array pro Tageszeit (siehe greetingBucket in cards.ts):
		// späte Nacht, früher Morgen, Morgen, Nachmittag, Abend, später Abend.
		playfulGreetings: [
			[
				"Noch wach?",
				"Brennst du noch Mitternachtsöl?",
				"Der Vault schläft nie, was?",
				"Du solltest wahrscheinlich schlafen.",
			],
			[
				"Schon so früh am Arbeiten?",
				"Mit der Sonne aufgestanden, was?",
				"Erst mal Kaffee, oder?",
				"Mutig, schon wach zu sein.",
			],
			[
				"Morgen. Tun wir mal so, als wären wir produktiv.",
				"Die Notizen haben dich vermisst.",
				"Weiter geht's.",
				"Neuer Tag, neuer Vault.",
			],
			[
				"Der Nachmittagstrott.",
				"Immer noch dabei?",
				"Produktiv nach dem Mittagessen - ehrgeizig.",
				"Halb geschafft, wahrscheinlich.",
			],
			[
				"Du schon wieder?",
				"Abend. Hörst du auf oder fängst du erst an?",
				"Noch eine Notiz, dann?",
				"Der Tag klingt aus. Du nicht.",
			],
			[
				"Schon wieder spät?",
				"Der Tag ist vorbei, die Ideen nicht.",
				"Solltest du dich nicht ausruhen?",
				"Du brennst die Kerze an beiden Enden ab.",
			],
		] as string[][],
	},

	// ---- Kartenvorlagen (Menü Karte hinzufügen) --------------------------------
	templates: {
		note: "Eingebettete Notiz",
		image: "Eingebettetes Bild",
		slideshow: "Diashow",
		base: "Eingebettete Base",
		excalidraw: "Excalidraw-Zeichnung",
		canvas: "Eingebettetes Canvas",
		daily: "Tagesnotiz (heute)",
		periodic: "Periodische Notiz",
		web: "Webseite (iframe)",
		bookmarks: "Lesezeichen",
		favorites: "Favoriten",
		recent: "Zuletzt verwendete Dateien",
		links: "Links / Zentrale",
		commands: "Befehle",
		templater: "Neue Notiz aus Vorlage",
		clock: "Uhr & Begrüßung",
		tasks: "Aufgaben",
		calendar: "Minikalender",
		schedule: "Kalender",
		stats: "Vault-Statistiken",
		search: "Abfrage",
		searchbar: "Suchleiste",
			heatmap: "Aktivitätskarte",
		text: "Text / Kurznotiz",
		calculator: "Rechner",
		dataview: "Dataview-Abfrage",
		datacore: "Datacore-Abfrage",
		rss: "RSS-Feed",
		jira: "Jira-Filter",
		weather: "Wetter",
		git: "Git",
		"operon-tasks": "Operon-Aufgaben",
		"operon-board": "Operon-Board",
		"operon-agenda": "Operon-Agenda",
		"operon-timer": "Operon-Timer",
		leaf: "Plugin-Ansicht (Beta)",
		pet: "Haustier",
	},

	/** Eine Zeile pro Vorlage, gezeigt unter ihrem Namen in der Kartenauswahl und
	 * mit durchsucht. Sage, was die Karte *zeigt* - der Name sagt schon,
	 * wie sie heißt. */
	templateDescriptions: {
		note: "Jede Notiz, live auf dem Board dargestellt",
		image: "Ein Bild aus dem Vault, randlos",
		slideshow: "Bilder aus einer Liste oder einem Ordner, im Wechsel per Timer",
		base: "Eine .base-Datei, dargestellt durch Obsidians Bases",
		excalidraw: "Eine Excalidraw-Zeichnung mit nativem Verschieben und Zoomen",
		canvas: "Ein Canvas, in dem du direkt schwenken kannst",
		daily: "Immer die heutige Notiz, beim ersten Klick erstellt",
		periodic: "Die Notiz dieser Woche, dieses Monats oder Jahres, aus Periodic Notes",
		web: "Eine Webseite in einem iframe, per Timer aktualisiert",
		bookmarks: "Deine Obsidian-Lesezeichen, einen Klick entfernt",
		favorites: "Die Notizen, die du in Hearth markiert hast",
		recent: "Die Dateien, die du zuletzt geöffnet hast",
		links: "Eine Zentrale für Links, Notizen und Ordner",
		commands: "Schaltflächen, die Obsidian-Befehle ausführen",
		templater: "Schaltflächen, die aus einer Templater-Vorlage eine Notiz in einem Ordner deiner Wahl erstellen",
		clock: "Uhrzeit, Datum und Begrüßung",
		tasks: "Kontrollkästchen aus deinem Vault, als Liste oder Board",
		calendar: "Ein Monat im Überblick, mit deinen Notizen darauf",
		schedule: "Monat, Woche, Tag und Liste, mit deinen Terminen darin",
		stats: "Notiz-, Wort- und Dateianzahl für den Vault",
		search: "Eine gespeicherte Abfrage, live gehalten",
		searchbar: "Ein Suchfeld auf dem Board, mit oder ohne Rahmen",
		heatmap: "Ein Jahr Vault-Aktivität, Tag für Tag",
		text: "Ein Notizzettel, der auf dem Dashboard lebt",
		calculator: "Summen, Einheitenumrechnung und Wechselkurse",
		dataview: "Eine DQL- oder DataviewJS-Abfrage, dargestellt von Dataview",
		datacore: "Eine Datacore-Abfrage oder ein Skript",
		rss: "Schlagzeilen aus den Feeds, denen du folgst",
		jira: "Vorgänge aus einem Jira-Filter oder einer JQL-Suche",
		weather: "Die Vorhersage für einen Ort deiner Wahl",
		git: "Repository-Status, mit Commit, Pull und Push",
		"operon-tasks": "Deine Operon-Aufgaben, gefiltert nach deinen Wünschen",
		"operon-board": "Operons Pipeline-Status als Board-Spalten",
		"operon-agenda": "Die nächsten Tage Operon-Arbeit, Tag für Tag",
		"operon-timer": "Operons laufende Zeiterfassung, live tickend",
		leaf: "Die Seitenleiste eines anderen Plugins, eingebettet in einer Karte",
		pet: "Ein kleiner Begleiter, der auf deinem Board lebt",
	},

	// ---- Kartenauswahl -----------------------------------------------
	cardPicker: {
		title: "Karte hinzufügen",
		searchPlaceholder: "Karten suchen…",
		allCards: "Alle Karten",
		noMatches: "Keine Karte passt dazu.",
		/** Abzeichen auf einer Karte, deren Plugin (oder andere Abhängigkeit) fehlt. */
		requires: (name: string) => `Braucht ${name}`,
		missingNotice: (name: string) =>
			`${name} ist nicht verfügbar - die Karte zeigt bis dahin einen Hinweis.`,
		installLink: (name: string) => `${name} installieren`,
		categories: {
			notes: "Notizen & Dateien",
			planning: "Planung",
			vault: "Vault-Einblicke",
			tools: "Werkzeuge",
			integrations: "Integrationen",
			fun: "Spaß",
		},
		request: {
			railLabel: "Karte vorschlagen",
			heading: "Karte vorschlagen",
			intro:
				"Fehlt dir etwas? Beschreibe die Karte, die du dir in Hearth wünschst - was sie " +
				"zeigen soll und woher ihre Daten kommen.",
			footPrompt: "Nicht das, was du gesucht hast?",
			footLink: "Karte vorschlagen",
			githubTitle: "GitHub-Issue eröffnen",
			githubDesc:
				"Öffentlich, durchsuchbar und der beste Ort, um die Idee zu diskutieren. Braucht ein GitHub-Konto.",
			githubAction: "GitHub öffnen",
			emailTitle: "E-Mail senden",
			emailDesc: "Direkt an den Maintainer, wenn du GitHub lieber nicht nutzt. Öffnet dein Mailprogramm.",
			emailAction: "E-Mail öffnen",
			prefilledNote:
				"Beide öffnen vorausgefüllt mit ein paar Fragen und deinen Hearth- und Obsidian-Versionen - bearbeite alles vor dem Senden.",
		},
	},

	// ---- Dateityp-Filterlabels ---------------------------------------
	fileTypes: {
		folders: "Ordner",
		markdown: "Notizen",
		excalidraw: "Excalidraw",
		canvas: "Canvas",
		bases: "Bases",
		images: "Bilder",
		videos: "Videos",
		audio: "Audio",
		pdf: "PDF",
		documents: "Dokumente",
		spreadsheets: "Tabellen",
		presentations: "Folien",
		threeD: "3D",
		other: "Sonstiges",
	},

	// ---- Export / Import (portable Pakete) ---------------------------
	portable: {
		exportModal: {
			title: "Dashboard teilen",
			saveFile: "Datei speichern",
			publishRemovesTitle: "Entfernt, bevor es diesen Vault verlässt",
			/** Verweist auf die Details darunter, die dieselben Gruppen mit
			 * den tatsächlichen Werten darunter auflisten - damit beide als eines lesbar sind und nicht
			 * als zwei Listen, die sich widersprechen könnten. */
			publishRemovesTune:
				"Die Details unten listen dieselben Gruppen, mit den genauen Werten darunter, und lassen dich ändern, was mitgeht.",
			/** Einzeln benannt statt zusammengefasst. „Deine privaten
			 * Informationen werden entfernt“ ist ein Versprechen; dies ist eine Liste, die jemand
			 * prüfen kann, und der Details-Bereich unten listet die tatsächlichen Werte. */
			// Formuliert passend zu `groups` unten, eins zu eins, weil es
			// dieselben vier Dinge sind und wer beides liest das erkennen soll.
			publishRemoves: [
				"Notiz- und Ordnerpfade - alles, worauf das Board in deinem Vault zeigt",
				"Kalender-Feeds, private Hosts und dein Standort",
				"Text, den du auf dem Board getippt hast - der Inhalt einer Textkarte, die letzte Summe eines Rechners",
				"Zugangsdaten - ein Jira-Token und alles andere, was eine Karte enthalten kann",
			],
			publishKeeps:
				"Bleibt erhalten, weil es das Board ausmacht: das Layout, das Styling, die Farben, die Bilder, die Karteneinstellungen, Suchen und Abfragen sowie jede öffentliche Seite oder jeder Feed, die es zeigt. Öffne die Details unten, um die genauen Werte zu sehen und zu ändern, was mitgeht.",
			intro:
				"Speichert dieses eine Dashboard als Datei. Alles, was sein Aussehen betrifft, reist mit, damit es in einem anderen Vault gleich aussieht.",
			name: "Name",
			nameDesc: "Wie dieses Dashboard in der Datei heißt. Standard ist der eigene Name des Boards.",
			description: "Beschreibung",
			descriptionDesc: "Optional. Ein oder zwei Zeilen dazu, wofür dieses Dashboard gedacht ist.",
			snapshot: "Bild dieses Boards",
			snapshotDesc:
				"Ein Screenshot des Boards, wie es gerade aussieht - durchgescrollt, sodass ein langes Board vollständig erfasst wird. Was in deinen Karten steht, wird zuerst unkenntlich gemacht; Kopfzeile, Werkzeugleiste und der eigene Titel jeder Karte bleiben, ebenso eine Karte ohne Inhalte von dir, wie eine Uhr.",
			/** Wird gezeigt, sobald es ein Bild gibt. Das Einzige, worum der
			 * Autor gebeten wird, gesagt wie es ist: schau es dir an. */
			snapshotCheck:
				"Schau es dir an, bevor du veröffentlichst. Alles, was du darin lesen kannst, kann jeder - klicke darauf, um es in voller Größe zu sehen.",
			snapshotTake: "Bild aufnehmen",
			snapshotRetake: "Nochmals aufnehmen",
			snapshotWorking: "Nehme Bild auf…",
			snapshotEnlarge: "Bild in voller Größe öffnen",
			snapshotTaken: (kb: number) =>
				`${kb} KB - genau das wird veröffentlicht, und genau das sehen alle, die die Galerie durchstöbern.`,
			/** Die Hürde vor dem Veröffentlichen. Benannt als Frage zu diesem
			 * Bild, weil es genau das ist: das Schwärzen ist eine Regel, und
			 * nur der Autor kann sagen, ob es dieses Board richtig gelesen hat. */
			snapshotConfirm: "Ich habe geschaut - nichts Privates ist darin lesbar",
			snapshotConfirmDesc:
				"Klicke auf das Bild, um es in voller Größe zu sehen und zu lesen. Kartentitel, Kopfzeile und alles, was eine Karte zeigt und nicht von dir ist, soll da sein; der Text einer Notiz, eine Aufgabe, ein Dateiname, ein Termin, eine Zahl aus deinem Leben nicht. Das Veröffentlichen wartet, bis du es gesagt hast.",
			snapshotConfirmRequired:
				"Schau dir zuerst das Bild an, dann schalte „Ich habe geschaut“ ein.",
			/** Was zu tun ist, wenn die Antwort nein lautet. Gesagt in derselben Form wie die
			 * „Dieses Board wird öffentlich“-Warnung oben, etwas fester:
			 * nicht „trotzdem veröffentlichen“, denn ein Bild, das durch das Schwärzen kam,
			 * ist ein Fehler, und die nächste Person, der es passiert, schaut nicht hin. */
			snapshotLeak:
				"Wenn etwas von dir darin lesbar ist, veröffentliche dieses Board nicht: Das Bild lässt sich nicht zurückholen, sobald es jemand installiert hat. Sag uns stattdessen Bescheid - das ist ein Fehler im Schwärzen, und es lohnt sich, ihn zu beheben, bevor es jemand anderem passiert.",
			snapshotLeakReport: "Auf GitHub melden",
			snapshotFailed: "Hearth konnte kein Bild des Boards aufnehmen.",
			snapshotRequired:
				"Ein Galerieeintrag braucht ein Bild des Boards. Nimm zuerst eines auf - du kannst es dir ansehen, bevor es rausgeht.",
			snapshotUnavailable:
				"Zum Veröffentlichen braucht es ein Bild des Boards, und dieser Build kann keines aufnehmen - Screenshots brauchen die Desktop-App. Du kannst das Dashboard trotzdem als Datei speichern und aus einem Desktop-Vault veröffentlichen.",
			snapshotNotActive:
				"Zum Veröffentlichen braucht es ein Bild des Boards, und Hearth kann nur das geöffnete Board fotografieren. Wechsle zuerst zu diesem Dashboard, dann veröffentliche es.",
			theme: "Empfohlen mit meinem Theme",
			themeDesc: (name: string) =>
				`Sagt, dass das Board für ${name} gedacht ist, das Theme, das du nutzt. Es ist ein Hinweis für alle, die es installieren - auf ihrer Seite wird nichts installiert oder geändert.`,
			themeNone:
				"Du nutzt Obsidians Standardaussehen, also gibt es kein Theme zu empfehlen. Wechsle zuerst zu einem Community-Theme, wenn das Board für eines gebaut ist.",
			tags: "Tags",
			tagsDesc: "Optional, per Komma getrennt. Nützlich, wenn das Dashboard dorthin geht, wo man es durchstöbern kann.",
			tagsPlaceholder: "schreiben, minimal, dunkel",

			// ---- Identität ----
			identity: "Veröffentlicht als",
			identityDesc:
				"Für dich erstellt aus einem Schlüssel, der in diesem Vault bleibt. Es ist dieselbe Kennung bei allem, " +
				"was du veröffentlichst, und sie sagt nichts darüber, wer du bist, und weil jede Datei mit " +
				"diesem Schlüssel signiert ist, kann niemand sonst darunter veröffentlichen. Kopiere den Schlüssel, um die Kennung auf " +
				"eine andere Installation mitzunehmen.",
			identityNew:
				"Du hast noch keinen. Es ist eine anonyme Kennung aus einem Schlüssel, der diesen " +
				"Vault nie verlässt - kein Konto, keine E-Mail, nichts darüber, wer du bist.",
			identityCreate: "Meine Kennung erstellen",
			identityCreated: (handle: string) =>
				`Du veröffentlichst als ${handle}. Kopiere deinen Wiederherstellungsschlüssel und bewahre ihn sicher auf - es ist der einzige Weg, diese Kennung zurückzubekommen.`,
			identityCopy: "Meinen Wiederherstellungsschlüssel kopieren",
			identityUnsaved:
				"Speichere deinen Wiederherstellungsschlüssel sicher, bevor du ihn brauchst. Er liegt nirgendwo außer in diesem " +
				"Vault, also gibt es bei Verlust kein Zurücksetzen und niemanden zu fragen - die Kennung und alles, " +
				"was du darunter veröffentlicht hast, wäre weg.",
			identityCopied:
				"Wiederherstellungsschlüssel kopiert. Bewahre ihn sicher auf - es ist der einzige Weg, diese Kennung zurückzubekommen.",
			identityCopyFailed: (key: string) => `Dein Wiederherstellungsschlüssel: ${key}`,
			identityRestore: "Schlüssel aus einer anderen Installation verwenden",
			identityReplaceTitle: "Deine Kennung ersetzen?",
			identityReplaceWarning:
				"Du hast deinen aktuellen Wiederherstellungsschlüssel noch nicht kopiert, und einen anderen darüber einzufügen lässt sich nicht rückgängig machen - dieser Vault hält die einzige Kopie. Alles, was du bereits unter der aktuellen Kennung veröffentlicht hast, bliebe veröffentlicht, aber du könntest nie wieder darunter posten. Kopiere den Schlüssel zuerst, falls du ihn zurückhaben willst.",
			identityReplaceConfirm: "Ersetzen",
			identityRestoreLabel: "Wiederherstellungsschlüssel",
			identityRestored: (name: string) => `Du veröffentlichst jetzt als ${name}.`,
			identityRestoreFailed: "Das ist kein Hearth-Wiederherstellungsschlüssel.",

			// ---- Was mitgeht ----
			contents: "Was enthalten sein soll",
			embedAssets: "Hintergrund und Bilder einbetten",
			embedAssetsDesc:
				"Trägt das Hintergrundbild des Boards, alle Bildsymbole und alle festen Diashow-Bilder in der Datei mit, damit es in einem Vault richtig aussieht, der sie nie gesehen hat. Macht die Datei größer. Schalte es aus für eine Sicherung deines eigenen Vaults, wo die Bilder schon vorhanden sind.",
			referenceNote: (paths: number, feeds: number) => {
				const parts: string[] = [];
				if (paths > 0) {
					parts.push(paths === 1 ? "1 Pfad aus diesem Vault" : `${paths} Pfade aus diesem Vault`);
				}
				if (feeds > 0) {
					parts.push(feeds === 1 ? "1 Kalender-Feed-URL" : `${feeds} Kalender-Feed-URLs`);
				}
				return `So wie es ist, wird diese Datei ${parts.join(" und ")} erwähnen. Das macht sie als eigene Sicherung funktionsfähig - und was der Schalter oben für ein Board herausnimmt, das du veröffentlichst.`;
			},
			stripPrivate: "Meine privaten Informationen weglassen",
			stripPrivateDesc:
				"Entfernt die Teile dieses Boards, die dich betreffen statt das Design: die Notiz- und Ordnerpfade, auf die es zeigt, Kalender-Feed-Links, deinen Standort und alles, was du auf eine Textkarte getippt hast. Das Board sieht weiter genau gleich aus - die Karten kommen nur an und zeigen auf nichts, was ohnehin jeder ausfüllen muss, der es lädt. Lass es aus für eine Kopie deines eigenen Boards, die ihre Pfade braucht, um weiter zu funktionieren.",

			// ---- Die Details-Offenlegung ----
			detailsSummary: "Genau sehen und anpassen, was mitgeht",
			flatten: "Erscheinungsbild-Einstellungen dieses Vaults auf das Dashboard kopieren",
			flattenDesc:
				"Das meiste, was ein Board ausmacht - Raster, Abstände, Kartenflächen, Hintergrund, Kopfzeile - ist eine vaultweite Einstellung, und das Board speichert nur, was es überschreibt. Dies schreibt die aufgelösten Werte auf das Dashboard selbst, damit es im Vault einer anderen Person gleich aussieht, statt dessen Einstellungen zu übernehmen. Schalte es aus, und das Board trägt nur seine eigenen Überschreibungen und passt sich an, wo es landet.",
			/** Steht an jeder angehefteten Zeile, wo sich der Schalter nicht bewegen lässt. */
			groupPinned: "Wird beim Veröffentlichen immer entfernt.",
			stripIntro:
				"Jede Gruppe unten kommt aus der Datei heraus. Was sie entfernt, steht darunter - das ist die tatsächliche Liste, gelesen aus diesem Board.",
			carriedIntro:
				"Es wird nichts weggelassen, dies ist also alles, was in der Datei nach außen zeigt. Schalte oben „Meine privaten Informationen weglassen“ ein, um die ersten drei Gruppen zu entfernen.",
			carriedNothing: "Dieses Board zeigt auf nichts außerhalb seiner selbst.",
			// Dieselben vier Namen, die die Veröffentlichungs-Zusammenfassung oben nutzt, plus die zwei,
			// die sie nicht entfernt. Wer beide Listen vergleicht, soll sie
			// ohne Rätseln zuordnen können, ob sie dasselbe meinen.
			// Benannt als *Aktion*, nicht als Gegenstand. „Notiz- und Ordnerpfade“
			// neben einem eingeschalteten Schalter liest sich genauso leicht wie „Notiz-
			// und Ordnerpfade einschließen“, was das Gegenteil dessen ist, was er tut - und
			// niemand soll die Richtung eines Datenschutz-Schalters
			// aus einer Überschrift zwei Zeilen darüber ableiten müssen.
			groups: {
				paths: "Notiz- und Ordnerpfade entfernen",
				private: "Kalender-Feeds, private Hosts und deinen Standort entfernen",
				content: "Text entfernen, den du auf dem Board getippt hast",
				queries: "Suchen und Dataview-Abfragen entfernen",
				plugins: "Befehls-IDs und Ansichtstypen entfernen",
			},
			groupDesc: {
				paths: "Alles, worauf dieses Board in deinem Vault zeigt, und der Ordner, aus dem jedes eingebettete Bild kam. Die Bilder selbst reisen weiter mit, wenn der Hintergrund-Schalter oben an ist - es ist der Ordner, in dem sie lagen, der geht.",
				private: "ICS-Kalender-Links (wer einen hat, kann diesen Kalender lesen), ein interner Jira-Host und der Ort, auf den eine Wetterkarte eingestellt ist.",
				content: "Der Inhalt einer Textkarte und die letzte Eingabe eines Rechners - was auch immer du auf dein eigenes Dashboard gekritzelt hast.",
				queries: "Standardmäßig aus: Ein Board ohne seine Abfragen tut nichts mehr. Lohnt sich einzuschalten, wenn eine Abfrage einen privaten Ordner nennt.",
				plugins: "Standardmäßig aus: Diese nennen Plugins, nicht dich. Sie zu entfernen lässt die Schaltflächen, die sie ausführten, ohne Funktion.",
			},
			groupEmpty: "Nichts auf diesem Board.",
			stripTotal: (n: number) =>
				n === 0
					? "Es würde nichts von diesem Board entfernt."
					: n === 1
						? "1 Wert wird entfernt."
						: `${n} Werte werden entfernt.`,
			stripResidual: (n: number) =>
				`Exportiert, aber ${n} Wert${n === 1 ? "" : "e"} sehen weiter wie Vault-Pfade aus. Lohnt sich, die Datei zu öffnen, bevor du sie teilst.`,

			signFailed:
				"Exportiert, aber es konnte nicht signiert werden, also wird es ohne Autor importiert. Dein Wiederherstellungsschlüssel ist vielleicht beschädigt - versuche, ihn erneut einzufügen.",
			exportButton: "Exportieren",
			assetsSkipped: (paths: string) =>
				`Exportiert, aber diese Bilder wurden weggelassen (zu groß oder nicht mehr im Vault): ${paths}`,
		},
		importModal: {
			title: "Importieren",
			kinds: {
				dashboard: "Ein Dashboard",
				layout: "Ein Dashboard-Layout",
				settings: "Eine vollständige Einstellungs-Sicherung",
			},
			by: (author: string) => `von ${author}`,
			signatureInvalid:
				"Diese Datei nennt einen Autor, aber ihre Signatur stimmt nicht - sie wurde entweder nach " +
				"dem Signieren bearbeitet, oder jemand hat die Kennung eines anderen Erstellers darauf gesetzt. Sie wird ohne " +
				"Autor gezeigt. Alles andere am Import ist unberührt.",
			madeWith: (version: string) => `Hearth ${version}`,
			cardCount: (n: number) => (n === 1 ? "1 Kartenart" : `${n} Kartenarten`),
			assetCount: (n: number) =>
				n === 1 ? "Bringt 1 Bild mit" : `Bringt ${n} Bilder mit`,
			pathCount: (n: number) =>
				n === 1 ? "Zeigt auf 1 Pfad in einem Vault" : `Zeigt auf ${n} Pfade in einem Vault`,
			needsPlugins: (plugins: string) => `Braucht diese Plugins: ${plugins}`,
			mode: "Wie es importiert werden soll",
			modeDesc: "Hinzufügen lässt alle deine eigenen Einstellungen unberührt.",
			modeAdd: "Als neues Dashboard hinzufügen",
			modeAddBoards: "Seine Dashboards zu meinen hinzufügen",
			modeReplaceBoard: (name: string) => `„${name}“ an Ort und Stelle aktualisieren`,
			modeReplaceAll: "Alle meine Einstellungen ersetzen",
			replaceAllWarning:
				"Dies ersetzt deine Dashboards und jede Hearth-Einstellung durch die aus dieser Datei. Es lässt sich nicht rückgängig machen.",
			heads: "Wissenswert",
			missingPlugins: (plugins: string) =>
				`Hier nicht installiert oder nicht aktiviert: ${plugins}. Diese Karten bleiben leer, bis sie es sind.`,
			missingPaths: (n: number, sample: string) =>
				`${n} Notiz${n === 1 ? "" : "en"} oder Ordner, worauf dieses Board zeigt, ${n === 1 ? "ist" : "sind"} nicht in deinem Vault (${sample}${n > 3 ? ", …" : ""}).`,
			remoteContent: (n: number) =>
				n === 1
					? "Es lädt 1 Sache aus dem Internet, wenn du es öffnest."
					: `Es lädt ${n} Sachen aus dem Internet, wenn du es öffnest.`,
			missingFine:
				"Nichts davon stoppt den Import - die Karten kommen durch und du kannst sie auf deine eigenen Notizen zeigen lassen.",
			importButton: "Importieren",
			addedOne: (name: string) => `„${name}“ hinzugefügt.`,
			addedMany: (n: number) => `${n} Dashboards hinzugefügt.`,
			replacedOne: (name: string) => `„${name}“ aktualisiert.`,
			restored: "Einstellungen wiederhergestellt.",
			assetsWritten: (n: number) =>
				n === 1 ? "1 Bild in deinem Vault gespeichert." : `${n} Bilder in deinem Vault gespeichert.`,
			warnMissingPaths: (n: number) =>
				`${n} referenzierte${n === 1 ? "r" : ""} Pfad${n === 1 ? "" : "e"} hier nicht gefunden.`,
			warnMissingPlugins: (n: number) =>
				`${n} Plugin${n === 1 ? ", das es will, ist" : "e, die es will, sind"} nicht aktiviert.`,
			warnTaskFields:
				"Seine Aufgabenkarten nutzen eigene Felder - schalte die Aufgabenfeld-Anpassung in Einstellungen → Integrationen ein, um sie zu sehen.",
			warnUnknownCards: "Manche Karten brauchen ein neueres Hearth und wurden weggelassen.",
			warnAssets: "Manche seiner Bilder fehlten in der Datei.",
		},
	},

	// ---- Dashboard-Galerie ---------------------------------------------
	gallery: {
		/** Die geschlossene Liste in `src/gallery/categories.ts`. Ids werden gespeichert, also darf ein
		 * Name frei umformuliert werden, eine Id aber nie. */
		categories: {
			productivity: "Dinge erledigen",
			planning: "Planung & Kalender",
			study: "Lernen & Recherche",
			writing: "Schreiben & Tagebuch",
			work: "Arbeit & Projekte",
			personal: "Privat & Zuhause",
			minimal: "Minimal",
			dense: "Informationsdicht",
			other: "Alles andere",
		},
		sorts: {
			trending: "Im Trend",
			top: "Bestbewertet",
			new: "Neueste",
			downloads: "Meistinstalliert",
		},
		browse: {
			title: "Dashboard-Galerie",
			openLabel: "Galerie",
			openAria: "Dashboard-Galerie durchstöbern",
			searchPlaceholder: "Dashboards suchen…",
			all: "Alle Dashboards",
			mine: "Von mir veröffentlicht",
			sortLabel: "Sortieren nach",
			refresh: "Aktualisieren",
			publish: "Dashboard veröffentlichen",
			loading: "Lädt…",
			empty: "Hier ist noch nichts.",
			emptySearch: (query: string) => `Nichts passt zu „${query}“.`,
			emptyMine:
				"Du hast noch nichts veröffentlicht. Veröffentliche ein Board und es erscheint hier.",
			results: (shown: number, total: number) =>
				total > shown ? `${shown} von ${total}` : `${shown} Dashboard${shown === 1 ? "" : "s"}`,
			more: "Mehr anzeigen",
			byAuthor: (handle: string) => `von ${handle}`,
			anonymous: "ohne Angabe",
			downloads: (n: number) => `${n} Installation${n === 1 ? "" : "en"}`,
			score: (n: number) => `${n > 0 ? "+" : ""}${n}`,
			cardCount: (n: number) => `${n} Karte${n === 1 ? "" : "n"}`,
			pluginBoard: "Beherbergt eine Plugin-Ansicht",
			noPicture: "Kein Bild",
			needsIdentity:
				"Du kannst ohne einen stöbern und installieren, aber Abstimmen und Veröffentlichen brauchen eine Kennung. Hearth erstellt dir eine anonyme aus einem Schlüssel, der diesen Vault nie verlässt.",
			needsIdentityVote:
				"Abstimmen braucht eine Kennung. Hearth erstellt dir eine anonyme aus einem Schlüssel, der diesen Vault nie verlässt - kein Konto und nichts darüber, wer du bist. Jetzt einen erstellen?",
		},
		detail: {
			install: "Installieren",
			installing: "Lädt herunter…",
			installAria: (name: string) => `${name} installieren`,
			enlarge: "Bild in voller Größe öffnen",
			profile: (handle: string) => `Alles von ${handle} ansehen`,
			upvoteAria: "Hochwählen",
			downvoteAria: "Runterwählen",
			published: (when: string) => `Veröffentlicht ${when}`,
			updated: (when: string) => `Aktualisiert ${when}`,
			version: (v: string) => `Version des Autors ${v}`,
			theme: (name: string) => `Empfohlen mit dem Theme ${name}`,
			madeWith: (v: string) => `Erstellt mit Hearth ${v}`,
			contents: "Was auf diesem Board ist",
			requires: "Was es braucht",
			requiresPlugins: "Plugins",
			requiresViews: "Gehostete Ansichten",
			requiresSettings: "Einstellungen",
			nothingRequired: "Nichts außer Hearth selbst.",
			size: (kb: number) => `${kb} KB`,
			remote: (n: number) =>
				n === 1
					? "Eine Sache auf diesem Board wird aus dem Internet geladen."
					: `${n} Sachen auf diesem Board werden aus dem Internet geladen.`,
			noRemote: "Nichts auf diesem Board wird aus dem Internet geladen.",
			unverified:
				"Dieses Board kam ohne prüfbare Signatur an, also lässt sich nicht feststellen, wer es erstellt hat.",
			tags: "Tags",
		},
		profile: {
			title: (handle: string) => handle,
			subtitle:
				"Eine anonyme Kennung, abgeleitet aus einem Signierschlüssel. Sie sagt nichts darüber, wer jemand ist - nur, dass dieselbe Hand all dies erstellt hat.",
			karma: "Karma",
			karmaHint: "Jede positive Bewertung über alles, was sie veröffentlicht haben, minus jede negative Bewertung.",
			totalDownloads: "Installationen",
			published: (n: number) => `${n} Dashboard${n === 1 ? "" : "s"}`,
			firstSeen: (when: string) => `Zuerst veröffentlicht ${when}`,
			empty: "Nichts unter dieser Kennung veröffentlicht.",
		},
		comments: {
			heading: (n: number) => (n === 1 ? "1 Kommentar" : `${n} Kommentare`),
			headingEmpty: "Kommentare",
			none: "Noch nichts. Sag das Erste.",
			placeholder: "Frag etwas oder sag, wie es bei dir funktioniert hat…",
			post: "Posten",
			remove: "Diesen Kommentar entfernen",
		},
		publish: {
			title: "In der Galerie veröffentlichen",
			intro:
				"Stellt dieses Dashboard in die Galerie, wo jeder, der diese Hearth-Galerie nutzt, es finden und installieren kann.",
			category: "Kategorie",
			categoryDesc: "Wofür dieses Board gedacht ist. So finden es die Leute.",
			button: "Veröffentlichen",
			publishing: "Wird veröffentlicht…",
			/** Gesagt vor dem Hochladen, nicht danach: Ein veröffentlichtes Board wird von
			 * Fremden kopiert, und weder ein Zurückziehen noch eine Bearbeitung erreicht die Kopien. */
			warning:
				"Dieses Board wird öffentlich: Jeder, der diese Galerie nutzt, kann es finden und installieren. Du kannst es jederzeit zurückziehen, doch wer es bereits installiert hat, behält seine Kopie.",
			needsName: "Gib dem Dashboard einen Namen, bevor du es veröffentlichst.",
			residual: (n: number) =>
				`Zurückgehalten: ${n} Wert${n === 1 ? "" : "e"} sehen nach dem Entfernen weiter wie Pfade aus deinem Vault aus. Prüfe den Details-Bereich vor dem Veröffentlichen.`,
			done: (name: string) => `„${name}“ in der Galerie veröffentlicht.`,
			/** Die Galerie hat es angenommen, hält es aber zurück - ihre eigene Prüfung sah
			 * etwas, das weiter wie ein Pfad aus deinem Vault aussieht. */
			doneHeld: (name: string) =>
				`Die Galerie hat „${name}“ angenommen, hält es aber zur Prüfung zurück - etwas darin sieht weiter wie ein Pfad aus deinem Vault aus. Es wird erst gelistet, wenn dort jemand draufgeschaut hat.`,
			doneUpdate: (name: string) => `„${name}“ in der Galerie aktualisiert.`,
			/** Neben dem Entfernen-Knopf bei deinem eigenen Eintrag: Veröffentliche das Board
			 * erneut, über diesen Eintrag statt daneben. */
			update: "Aktualisieren",
			/** Während der Eintrag gelesen wird, um festzustellen, welches Board es ist. */
			updateChecking: "Prüfe…",
			updateDesc: "Veröffentliche dieses Board erneut, über diesen Eintrag.",
			updateMissing:
				"Dieser Vault hat das Board nicht, von dem aus dies veröffentlicht wurde - es wurde gelöscht oder es lebt in einem anderen Vault. Von hier zu veröffentlichen würde einen zweiten Eintrag erzeugen, also gibt es nichts zu aktualisieren.",
			/** Noch hat nichts gesagt, welches Board dies ist - ein Eintrag, veröffentlicht
			 * bevor Hearth die Notiz behielt, oder an eine Galerie, die zu alt zum Fragen ist.
			 * Der Knopf funktioniert trotzdem: Drücken liest den Eintrag, um es herauszufinden. */
			updateUnknown:
				"Hearth weiß noch nicht, welches deiner Boards dieser Eintrag ist. Drücke Aktualisieren und es liest den Eintrag, um es herauszufinden.",
			unpublish: "Aus der Galerie entfernen",
			unpublishConfirm: (name: string) =>
				`„${name}“ aus der Galerie entfernen? Wer es bereits installiert hat, behält seine Kopie; niemand Neues kann es finden.`,
			unpublished: "Aus der Galerie entfernt.",
		},
		settings: {
			heading: "Dashboard-Galerie",
			host: "Galerieadresse",
			hostDesc:
				"Die Galerie, in der Hearth stöbert und wohin es veröffentlicht. Nichts wird abgerufen, bis du sie öffnest, und nichts gesendet, bis du veröffentlichst. Leere dieses Feld, um die Galerie ganz auszuschalten - sie bleibt aus. Nur https (oder http auf localhost, für eine Galerie, die du selbst betreibst).",
			hostPlaceholder: "https://gallery.example.com",
			hostInvalid: "Das ist keine Adresse, mit der Hearth spricht. Nutze https oder http auf localhost.",
			hostCleared: "Galerie ausgeschaltet.",
			hostSet: (host: string) => `Galerie gesetzt auf ${host}.`,
			browse: "Galerie durchstöbern",
			browseDesc: "Dashboards, die andere veröffentlicht haben, und die, die du selbst veröffentlicht hast.",
			browseButton: "Galerie öffnen",
		},
		errors: {
			noHost:
				"Keine Galerie eingerichtet. Trage eine Galerieadresse in Hearths Einstellungen ein, unter Dashboard-Galerie.",
			externalCallsOff:
				"Die Galerie ist ein Server im Internet, und dieser Vault hat \u201eExterne Aufrufe deaktivieren\u201c eingeschaltet. Schalte das aus, um zu stöbern oder zu veröffentlichen.",
			offline: "Die Galerie war nicht erreichbar. Sie ist vielleicht ausgefallen, oder dieses Gerät ist offline.",
			badResponse: "Diese Adresse hat geantwortet, aber nicht wie eine Hearth-Galerie.",
			unauthorized: "Die Galerie hat die Identität dieses Vaults nicht akzeptiert.",
			forbidden: "Die Galerie hat dieser Vault-Identität das nicht erlaubt.",
			rateLimited: "Die Galerie bittet dich, es langsamer anzugehen. Versuche es in ein paar Minuten erneut.",
			tooLarge: "Dieses Dashboard ist zu groß für diese Galerie. Schalte den Hintergrund aus oder verkleinere ihn.",
			rejected: (why: string) => `Die Galerie hat es abgelehnt: ${why}`,
			notFound: "Die Galerie hat das nicht.",
			server: "Die Galerie hatte ein Problem mit dieser Anfrage.",
			unsigned:
				"Hearth konnte die Datei nicht signieren, also wurde sie nicht veröffentlicht - ein unsigniertes Board hat keinen nachweisbaren Autor.",
		},
	},

	// ---- Layout-Importfehler ------------------------------------------
	layout: {
		invalidJson: "Das ist kein gültiges JSON.",
		notAnObject: "Das Layout muss ein JSON-Objekt sein.",
		noValidDashboards: "Das Layout enthielt keine gültigen Dashboards.",
		noValidCards: "Das Layout enthielt keine gültigen Karten.",
		notAHearthLayout:
			'Kein Hearth-Layout - kein „dashboards“- oder „cards“-Array gefunden.',
		notHearthSettings:
			'Keine Hearth-Einstellungs-Sicherung - kein „hearthSettings“-Marker oder Layout gefunden.',
	},
};
