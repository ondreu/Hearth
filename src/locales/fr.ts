/**
 * Traduction française de Hearth.
 * Typée contre `Translations` (voir `src/locales/index.ts`) : toute clé
 * manquante ou mal orthographiée fait échouer `npm run typecheck`.
 *
 * Les exemples de réponses instantanées restent en anglais : le moteur de
 * réponses ne reconnaît pas encore de mots-clés français.
 */
import type { Translations } from "./index";

export const fr: Translations = {
	// ---- Commands (command palette) & ribbon ---------------------------
	commands: {
		openHome: "Ouvrir le tableau de bord d'accueil",
		newNote: "Créer une note (emplacement par défaut)",
		newDrawing: "Créer un dessin Excalidraw",
		recordVoice: "Démarrer/arrêter l'enregistrement vocal",
		openDailyNote: "Ouvrir la note quotidienne du jour",
		runSetup: "Configurer Hearth (assistant de démarrage)",
		searchTips: "Afficher les astuces de recherche",
		switchDashboard: (n: number) => `Passer au tableau de bord ${n}`,
		openDashboard: (n: number) => `Ouvrir le tableau de bord ${n}`,
		nextDashboard: "Tableau de bord suivant",
		previousDashboard: "Tableau de bord précédent",
	},
	ribbon: {
		openHome: "Ouvrir l'accueil Hearth",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth : impossible de créer une nouvelle note.",
		operonTaskMissing:
			"Hearth : la note de cette tâche Operon n'est plus dans le coffre.",
		operonRechecked: "Hearth : connexion Operon revérifiée.",
		operonWriteFailed: (reason: string) => `Hearth : Operon a refusé la modification — ${reason}`,
		operonCreateFailed: (reason: string, where: string) =>
			`Hearth : Operon a refusé de créer la tâche — ${reason} ${where} ` +
			"Modifiez-le dans les paramètres d'Operon, ou choisissez une autre cible sous « Nouvelles tâches » " +
			"dans les paramètres de cette carte.",
		operonWriteUnknown: (reason: string) =>
			`Hearth : Operon n'a pas pu confirmer si la modification a été appliquée (${reason}). ` +
			"La carte a été relue — vérifiez la tâche avant de réessayer.",
		enableExcalidraw:
			"Hearth : activez le plugin Excalidraw pour créer des dessins.",
		excalidrawCommandMissing:
			"Hearth : commande « nouveau dessin » d'Excalidraw introuvable.",
		enableAudioRecorder: "Hearth : activez le module principal Enregistreur audio.",
		couldNotRecordVoice: "Hearth : impossible de démarrer l'enregistrement vocal.",
		enableDailyNotes: "Hearth : activez le module principal Notes quotidiennes.",
		couldNotOpenDaily: "Hearth : impossible d'ouvrir la note quotidienne du jour.",
		couldNotOpenPeriodic: "Hearth : Periodic Notes n'a pas pu créer cette note.",
		couldNotCreateJournalNote: "Hearth : Journals n'a pas pu créer cette note.",
		commandNotFound: (id: string) => `Hearth : commande introuvable : ${id}`,
		couldNotCreateNoteForDay: (day: string) =>
			`Hearth : impossible de créer une note pour le ${day}.`,
		couldNotCreateEventNote: "Hearth : impossible de créer une note pour cet événement.",
		taskNotesCreateFailed: "Hearth : impossible d'exécuter TaskNotes : Créer une tâche.",
		taskChangedOnDisk: "Hearth : cette tâche a changé sur le disque — actualisée.",
		couldNotOpenTaskNote: "Hearth : impossible d'ouvrir la note de cette tâche.",
		couldNotUpdateTaskStatus: "Hearth : impossible de mettre à jour le statut de la tâche.",
		couldNotCompleteRecurring:
			"Hearth : impossible de marquer l'occurrence de la tâche récurrente comme terminée.",
		couldNotUndoRecurring:
			"Hearth : impossible d'annuler l'achèvement de la tâche récurrente.",
		couldNotAddKanbanCard: "Hearth : impossible d'ajouter la carte au Kanban.",
		couldNotConvertCard: "Hearth : impossible de convertir la carte en note.",
		templaterNoTemplate: (path: string) =>
			`Hearth : modèle introuvable : ${path}`,
		templaterFailed: (name: string) =>
			`Hearth : Templater n'a pas créé de note à partir de ${name}.`,
		templaterCreated: (path: string) => `Hearth : ${path} créé`,
		newNoteTemplaterMissing:
			"Hearth : le bouton « Nouvelle note » utilise un modèle Templater, mais " +
			"Templater n'est pas activé — une note vide est créée à la place.",
		exported: "Hearth : exporté.",
		layoutExported: "Hearth : disposition exportée.",
		layoutImported: "Hearth : disposition importée.",
		layoutImportError: (error: string) => `Hearth : ${error}`,
		exportedToVault: (file: string) =>
			`Hearth : ${file} enregistré à la racine de votre coffre.`,
		exportFailed: "Hearth : impossible d'enregistrer le fichier d'export.",
		cardCopied: "Carte copiée dans le tableau de bord.",
	},

	// ---- The home view -------------------------------------------------
	view: {
		displayName: "Accueil",
	},

	// ---- Header / search bar -------------------------------------------
	header: {
		newNote: "Nouvelle note",
		newNoteAria: "Créer une note",
		searchOnline: "Chercher en ligne",
		searchOnlineAria: "Chercher la requête actuelle sur le web",
		searchOnlinePickAria: "Choisir un moteur de recherche",
		searchEngineDefault: (name: string) => `${name} (par défaut)`,
	},
	search: {
		placeholder: "Rechercher dans le coffre",
		noMatches: "Aucun résultat",
		noMatchingCommands: "Aucune commande correspondante",
		tips: {
			title: "Ce que la barre de recherche sait faire",
			intro: "Tapez l'un de ces exemples dans une barre de recherche Hearth.",
			introTry: "Cliquez sur un exemple pour l'essayer.",
			findHeading: "Trouver des notes",
			answersHeading: "Réponses instantanées",
			off: "Désactivé",
			settingsHint:
				"Activez ou désactivez les réponses dans Paramètres → Recherche, par tableau dans ses paramètres, ou par carte de barre de recherche.",
			tryAria: (example: string) => `Essayer « ${example} »`,
			openRow: "Astuces de recherche",
			openRowDesc: "Tout ce que la barre de recherche sait faire",
			newHint: "Nouveau : la barre de recherche répond aux questions",
			newHintDesc: "Calculs, devises, bourse, météo, Wikipédia et plus — découvrez ce qu'elle sait faire",
			dismiss: "Ignorer",
			find: {
				name: {
					title: "Noms et chemins",
					desc: "N'importe quel texte trouve notes, fichiers et dossiers par leur nom, même avec des lettres omises.",
					examples: ["réunion", "proj/notes"],
				},
				tag: { title: "Tags", desc: "Commencez par # pour trouver des notes par tag.", examples: ["#projet"] },
				property: {
					title: "Propriétés",
					desc: "clé:valeur trouve les notes par propriété de frontmatter.",
					examples: ["status:done", "auteur:ada"],
				},
				command: {
					title: "Commandes",
					desc: "Commencez par > pour exécuter n'importe quelle commande.",
					examples: [">note quotidienne", ">basculer"],
				},
			},
			features: {
				calc: {
					title: "Calculatrice",
					desc: "Sommes, pourcentages, unités et bases numériques. Commencez par = pour la forcer.",
					examples: ["1+1", "20 % de 150", "10 km en miles", "FF hex en décimal"],
				},
				currency: {
					title: "Devises",
					desc: "Convertissez au cours du jour et voyez le graphique de la paire.",
					examples: ["20 CZK en EUR", "100 euros en dollars", "eur/usd"],
				},
				market: {
					title: "Actions, fonds et cryptos",
					desc: "Un cours en direct et son graphique. Utilisez un $, « en bourse » ou « cours de l'action ».",
					examples: ["$AAPL", "LVMH en bourse", "cours de l'action Airbus"],
				},
				weather: {
					title: "Météo",
					desc: "La météo actuelle et des prochains jours, partout.",
					examples: ["météo Paris", "météo à Lyon"],
				},
				wiki: {
					title: "Wikipédia",
					desc: "Le résumé d'un article. Ajoutez :en, :de… pour choisir la langue du wiki.",
					examples: ["wiki Victor Hugo", "wiki:en Paris"],
				},
				chance: {
					title: "Pile ou face, dés et nombres aléatoires",
					desc: "Entrée pour relancer.",
					examples: ["pile ou face", "lancer 2d6", "nombre aléatoire 1-10"],
				},
				date: {
					title: "Dates",
					desc: "Nombre de jours et calculs de dates.",
					examples: ["jours jusqu'au 2026-12-24", "aujourd'hui + 45 jours", "vendredi prochain"],
				},
				time: {
					title: "L'heure ailleurs",
					desc: "L'heure dans une ville et son décalage avec la vôtre.",
					examples: ["heure à Tokyo", "quelle heure est-il à New York"],
				},
			},
		},
		instant: {
			copyHint: "Entrée pour copier",
			openHint: "Entrée pour les détails",
			copied: (value: string) => `${value} copié`,
			copyFailed: "Impossible de copier dans le presse-papiers",
			loading: "Chargement…",
			invalid: "Expression non valide",
			noQuote: (query: string) => `Aucune donnée de marché pour « ${query} »`,
			externalOff: "Les appels externes sont désactivés dans les paramètres de Hearth",
			rate: (from: string, rate: string, to: string) => `1 ${from} = ${rate} ${to}`,
			days: (n: number) => (Math.abs(n) <= 1 ? `${n} jour` : `${n} jours`),
			today: "Aujourd'hui",
			inDays: (n: number) => (n === 1 ? "Demain" : `Dans ${n} jours`),
			daysAgo: (n: number) => (n === 1 ? "Hier" : `Il y a ${n} jours`),
			week: (n: number) => `Semaine ${n}`,
			sameTime: "Même heure qu'ici",
			offset: (hours: string) => `${hours} h par rapport à ici`,
			noPlace: (place: string) => `Aucun lieu nommé « ${place} » trouvé`,
			noArticle: (query: string) => `Aucun article Wikipédia pour « ${query} »`,
			heads: "Face",
			tails: "Pile",
			coin: "Pile ou face",
			between: (min: string, max: string) => `Nombre aléatoire entre ${min} et ${max}`,
			againHint: "Entrée pour relancer",
		},
	},

	// ---- Shared confirm dialog -----------------------------------------
	confirm: {
		confirm: "Confirmer",
		cancel: "Annuler",
		ok: "OK",
	},

	// ---- "What's new" release-notes dialog -----------------------------
	whatsNew: {
		title: "Quoi de neuf dans Hearth",
		intro: "Merci pour la mise à jour ! Voici ce qui a changé depuis votre dernière visite.",
		introHint:
			"Merci pour la mise à jour ! Voici ce qui a changé depuis votre dernière visite — " +
			"cliquez sur une ligne pour lire les détails.",
		close: "Compris",
		footer: "Tous les détails se trouvent dans le README du plugin.",
		kinds: {
			added: "Nouveau",
			changed: "Modifié",
			fixed: "Corrigé",
			removed: "Supprimé",
			deprecated: "Obsolète",
			security: "Sécurité",
			other: "Divers",
		},
		filterPlaceholder: "Filtrer les changements…",
		expandAll: "Tout déplier",
		collapseAll: "Tout replier",
		noMatches: (query: string) => `Rien ici ne mentionne « ${query} ».`,
		releaseNotes: (version: string) => `Notes de version ${version} sur GitHub`,
		releaseToggle: (version: string) => `Afficher ou masquer les changements de ${version}`,
		issue: (n: string) => `Ticket #${n} sur GitHub`,
	},

	// ---- First-run setup wizard ----------------------------------------
	setup: {
		stepNames: {
			purpose: "Usage",
			look: "Apparence",
			finish: "Votre tableau",
		},
		stepTitles: {
			purpose: "À quoi sert votre coffre ?",
			look: "Choisissez une apparence",
			finish: "Voici votre écran d'accueil",
		},
		stepDescs: {
			purpose:
				"Choisissez-en autant que vous voulez et Hearth choisit les cartes. Trois étapes rapides, " +
				"et tout reste modifiable ensuite.",
			look: "Pour le tableau en cours de création. Les autres tableaux gardent leur propre apparence.",
			finish: "Rien n'a encore été modifié. Voici ce qui sera créé.",
		},
		nav: {
			back: "Retour",
			next: "Suivant",
			finish: "Créer mon tableau de bord",
			skip: "Passer la configuration",
		},
		vault: {
			title: "Titre",
			titleDesc: "Affiché en grand en haut du tableau de bord.",
			showTitle: "Afficher le titre",
			showTitleDesc: "Désactivez pour un tableau sans titre.",
			titleIcon: "Icône du titre",
			titleIconDesc:
				"Un emoji, un ou deux caractères, un identifiant d'icône Lucide, le chemin d'une image du coffre ou " +
				"l'URL d'une image, affiché à côté du titre. Laissez vide pour le cristal Hearth.",
			themeColor: "Suivre la couleur d'accent du thème",
			themeColorDesc: "Quelles parties du logo prennent la couleur de votre thème.",
			themeColorOptions: {
				none: "Aucune",
				icon: "L'icône",
				title: "Le titre",
				both: "Les deux",
			},
			showSearch: "Afficher la barre de recherche",
			showSearchDesc: "Le champ de recherche et de commandes sous le titre.",
		},
		look: {
			designHeading: "Design",
			designNote: "Ce choix s'applique à tout Hearth, pas seulement à ce tableau. Modifiable à tout moment dans Paramètres → Hearth → Apparence.",
			terminalNote: "Le mode Terminal s'applique à tout Hearth et à tous les tableaux. Il ne dessine ni fond d'écran ni surfaces de cartes, il n'y a donc rien d'autre à choisir ici. Il est expérimental : désactivez-le à tout moment dans Paramètres → Hearth → Apparence, et les tableaux reviennent dans le design d'origine.",
			surfaceHeading: "Cartes",
			backgroundHeading: "Arrière-plan",
			color: "Couleur",
			colorDesc: "La couleur unie peinte derrière le tableau.",
			weatherDesc:
				"Un ciel en direct pour un lieu, ou une condition figée. Choisissez sa " +
				"source ci-dessous.",
			layout: "Emplacement de l'arrière-plan",
			layoutDesc:
				"Derrière tout le tableau, ou en bannière en haut avec vos " +
				"cartes sur la surface du thème en dessous.",
			layoutFull: "Derrière tout",
			layoutBanner: "Une bannière en haut",
			compact: "Espacement compact",
			compactDesc: "Resserrer les espaces pour en afficher plus à l'écran.",
		},
		surfaces: {
			glass: {
				icon: "layers",
				name: "Givré",
				desc: "Cartes translucides avec un léger flou de l'arrière-plan.",
			},
			solid: {
				icon: "square",
				name: "Opaque",
				desc: "Panneaux opaques. Les plus lisibles sur une photo chargée.",
			},
			minimal: {
				icon: "minus",
				name: "Minimal",
				desc: "Aucune surface de carte — le contenu flotte sur l'arrière-plan.",
			},
		},
		designs: {
			classic: {
				icon: "square",
				name: "Classique",
				desc: "Hearth tel qu'il a toujours été : surfaces discrètes, bordures fines.",
			},
			expressive: {
				icon: "shapes",
				name: "Expressif",
				desc: "Material 3 Expressive dans tout Hearth — cartes, boutons, menus, dialogues et paramètres — dans les tons de votre couleur d'accent.",
			},
			terminal: {
				icon: "terminal",
				name: "Terminal",
				desc: "Chaque tableau en texte, dans une grille de caractères avec des cartes en cadres et des raccourcis clavier pour tout. Expérimental : certaines cartes sont encore dessinées en images.",
			},
		},
		backgrounds: {
			default: {
				icon: "image",
				name: "Le fond d'écran Hearth",
				desc: "Des collines dessinées par Hearth, de jour ou de nuit selon votre thème.",
			},
			harbour: {
				icon: "anchor",
				name: "Un village portuaire",
				desc: "Un phare, des bateaux et des maisons sur la colline, en formes Expressive dans votre couleur d'accent.",
			},
			weather: {
				icon: "cloud-sun",
				name: "Ciel en direct",
				desc: "Un ciel dessiné d'après la météo de chez vous — ou un ciel que vous figez.",
			},
			color: {
				icon: "paintbrush",
				name: "Une couleur unie",
				desc: "Une couleur, sans image. L'option la plus légère.",
			},
			none: {
				icon: "ban",
				name: "Aucun",
				desc: "L'arrière-plan de votre thème, tel quel.",
			},
		},
		purposes: {
			daily: {
				name: "Notes quotidiennes et journal",
				desc: "La note du jour au premier plan, avec un calendrier pour naviguer entre les jours.",
			},
			tasks: {
				name: "Tâches et to-do",
				desc: "Une liste de tâches, lue depuis vos cases à cocher ou un plugin de tâches.",
			},
			planning: {
				name: "Planning et calendrier",
				desc: "Un calendrier complet mois/semaine/jour, y compris les flux abonnés.",
			},
			browsing: {
				name: "Retrouver mes notes",
				desc: "Ce que vous avez ouvert récemment, plus une étagère de favoris.",
			},
			capture: {
				name: "Saisie rapide et lancement",
				desc: "Une rangée d'actions rapides : nouvelle note, recherche, palette de commandes.",
			},
			insights: {
				name: "Statistiques du coffre",
				desc: "La taille du coffre et votre niveau d'activité.",
			},
			reading: {
				name: "Lecture et flux",
				desc: "Une carte RSS pour un site que vous suivez.",
			},
			ambience: {
				name: "Un peu de vie",
				desc: "La météo de chez vous, et un petit animal qui vit sur votre tableau.",
			},
		},
		purpose: {
			count: (n: number) =>
				n <= 1 ? `Cela fait ${n} carte pour l'instant.` : `Cela fait ${n} cartes pour l'instant.`,
			integrationsHeading: "Trouvé dans votre coffre",
			feed: "Flux à suivre",
			feedDesc: "L'adresse RSS ou Atom d'un site que vous lisez. D'autres peuvent être ajoutées sur la carte.",
			feedMissing: "Ajoutez une adresse de flux et la carte Lecture rejoint le tableau.",
			weatherPlace: "Météo pour",
			weatherMissing: "Choisissez un lieu et la carte Météo rejoint le tableau.",
		},
		integrations: {
			lead:
				"Chaque intégration activée ici ajoute à ce tableau une carte configurée pour " +
				"vous — rien n'est installé ni modifié dans l'autre plugin, et rien " +
				"en dehors de ce tableau de bord n'est touché.",
			recommended: "Recommandé",
			effects: {
				tasknotes:
					"Ajouter une carte Tâches lisant vos tâches TaskNotes, avec les noms de champs et " +
					"statuts terminés de TaskNotes enregistrés sur la carte elle-même.",
				kanban: "Ajouter une carte Tâches affichant votre Kanban en colonnes, avec glisser-déposer.",
				dataview: "Ajouter une carte Dataview, préremplie d'une requête modifiable.",
				datacore: "Ajouter une carte Datacore prête pour une requête.",
				templater:
					"Ajouter une carte de boutons — un par modèle existant — qui créent une " +
					"note à partir de celui-ci en un clic.",
				git: "Ajouter une carte Git affichant l'état de votre dépôt, avec boutons commit et synchro.",
				operon:
					"Ajouter une carte de tâches Operon, lue via l'API développeur d'Operon. " +
					"Il vous sera demandé d'approuver Hearth dans les paramètres d'Operon au premier " +
					"chargement de la carte ; d'ici là, elle indique ce qu'elle attend.",
				bases: "Ajouter une carte intégrant une base de votre coffre.",
				dailyNotes: "Ajouter une carte affichant la note du jour, modifiable sur place.",
				bookmarks: "Ajouter une carte listant vos signets.",
			},
			taskNotesTitle: "Lu depuis vos paramètres TaskNotes, appliqué à cette carte",
			taskNotesStatus: "Champ de statut",
			taskNotesDue: "Champ d'échéance",
			taskNotesPriority: "Champ de priorité",
			taskNotesDone: "Considéré comme terminé",
			taskNotesDoneNone: "aucun défini — Hearth utilisera \"done\"",
		},
		finish: {
			empty:
				"Aucune carte sélectionnée. Vous pouvez quand même terminer — le tableau sera vide et " +
				"vous pourrez ajouter des cartes avec le bouton Organiser du tableau.",
			target: "Où placer ce tableau",
			targetDesc:
				"Remplacer le tableau de bord actuel, ou l'ajouter comme nouveau tableau.",
			targetReplace: "Remplacer mon tableau de bord actuel",
			targetNew: "L'ajouter comme nouveau tableau de bord",
			targetForcedNew:
				"Il sera ajouté comme nouveau tableau de bord. Tous vos tableaux existants " +
				"restent exactement tels quels — rien n'est remplacé ni supprimé.",
			name: "Nom du tableau de bord",
			nameDesc: "Affiché dans le sélecteur de tableaux.",
			defaultName: "Accueil",
			calloutTitle: "Un point de départ, pas un modèle figé",
			calloutHint:
				"Chaque carte peut être déplacée, redimensionnée, reconfigurée ou supprimée avec Organiser " +
				"(en haut à droite du tableau) ; Paramètres → Hearth s'occupe du reste. Vous pouvez relancer cet " +
				"assistant à tout moment depuis Paramètres → À propos.",
			clock: "Horloge",
			clockDesc: "Une petite horloge et un message d'accueil en haut de la colonne latérale.",
			more: "Titre et en-tête",
			why: "Pourquoi ces cartes",
		},
		plan: {
			names: {
				clock: "Horloge et accueil",
				daily: "Note du jour",
				tasks: "Tâches",
				schedule: "Calendrier",
				calendar: "Mini-calendrier",
				recent: "Fichiers récents",
				favorites: "Favoris",
				bookmarks: "Signets",
				links: "Liens",
				stats: "Statistiques du coffre",
				heatmap: "Activité",
				rss: "Lecture",
				weather: "Météo",
				pet: "Compagnon",
				dataview: "Dataview",
				datacore: "Datacore",
				git: "Git",
				base: "Base",
			},
			actions: {
				newNote: "Nouvelle note",
				today: "Note du jour",
				switcher: "Changement rapide",
				search: "Rechercher",
				palette: "Commandes",
			},
			reasons: {
				clock: "Vous avez demandé une horloge",
				daily: "Notes quotidiennes et journal",
				dailyNotes: "Notes quotidiennes est activé",
				tasks: "Tâches et to-do",
				tasknotes: "Configuré pour TaskNotes",
				kanban: "Lecture de votre Kanban",
				planning: "Planning et calendrier",
				browsing: "Retrouver mes notes",
				bookmarks: "Signets est activé",
				capture: "Saisie rapide et lancement",
				insights: "Statistiques du coffre",
				reading: "Lecture et flux",
				ambience: "Un peu de vie",
				dataview: "Dataview est installé",
				datacore: "Datacore est installé",
				templater: "Des modèles Templater ont été trouvés",
				git: "Git est installé",
				operon: "L'API développeur d'Operon est disponible",
				bases: "Une base a été trouvée dans votre coffre",
			},
		},
		notice: {
			done: (n: number) =>
				n <= 1
					? `Hearth : votre tableau de bord est prêt — ${n} carte ajoutée.`
					: `Hearth : votre tableau de bord est prêt — ${n} cartes ajoutées.`,
		},
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "Choisir un fichier à intégrer…",
		command: "Choisir une commande…",
		noteToFavorite: "Choisir une note à mettre en favori…",
		folder: "Choisir un dossier…",
		image: "Choisir une image…",
		icon: "Rechercher des icônes Lucide…",
		iconPlaceholder: "Identifiant d'icône Lucide",
		iconBrowse: "Parcourir les icônes Lucide",
		iconClear: "Effacer l'icône",
		titleIconPlaceholder: "Id d'icône, emoji, chemin ou URL d'image",
		titleIconBrowseImage: "Choisir une image du coffre",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "Ajouter une carte",
		addCardAria: "Ajouter une carte au tableau de bord",
		dashboardSettings: "Paramètres du tableau",
		dashboardSettingsAria: "Ouvrir les paramètres de ce tableau de bord",
		showTitles: "Afficher les titres",
		hideTitles: "Masquer les titres",
		showCardHeaders: "Afficher les en-têtes de cartes",
		hideCardHeaders: "Masquer les en-têtes de cartes",
		doneArranging: "Terminer",
		finishArranging: "Terminer l'organisation des cartes",
		moveResize: "Déplacer et redimensionner les cartes",
		cardSettings: "Paramètres de la carte",
		removeCard: "Retirer la carte",
		removeCardTitle: "Retirer la carte ?",
		removeCardMessage: (name: string) => `Retirer « ${name} » du tableau de bord ?`,
		removeCardConfirm: "Retirer",
		thisCard: "cette carte",
		expandCard: "Déplier la carte",
		collapseCard: "Replier la carte",
		phonePreview: "Aperçu en largeur téléphone",
		phonePreviewOff: "Quitter l'aperçu téléphone",
		moveCardUp: "Monter la carte",
		moveCardDown: "Descendre la carte",
		hideOnNarrow: "Masquer sur un tableau étroit",
		showOnNarrow: "Afficher sur un tableau étroit",
	},

	// ---- Dashboard switcher & per-dashboard settings -------------------
	dashboards: {
		newDashboard: "Nouveau tableau de bord",
		defaultName: (n: number) => `Tableau ${n}`,
		copySuffix: (name: string) => `${name} (copie)`,
		fallbackName: "Tableau de bord",
		menu: {
			settings: "Paramètres du tableau…",
			duplicate: "Dupliquer",
			exportBoard: "Exporter le tableau…",
			importBoard: "Importer un tableau…",
			delete: "Supprimer",
		},
		deleteTitle: "Supprimer le tableau de bord ?",
		deleteMessage: (name: string, count: number) =>
			`Supprimer « ${name} » et ses ${count} carte(s) ? Action irréversible.`,
		deleteConfirm: "Supprimer",
		modal: {
			title: "Paramètres du tableau",
			deleteDashboard: "Supprimer le tableau",
			tabs: {
				general: "Général",
				plugin: "Vue de plugin",
				single: "Carte",
				header: "En-tête",
				layout: "Disposition",
				style: "Style",
				background: "Arrière-plan",
			},
			name: "Nom",
			mode: "Type de tableau",
			modeDesc:
				"Un tableau de cartes Hearth, une seule carte Hearth occupant tout le tableau, ou tout le tableau confié à la vue d'un plugin. Changer de type conserve les cartes de ce tableau — revenez en arrière et elles réapparaissent.",
			modeOptions: {
				cards: "Cartes",
				single: "Carte unique",
				plugin: "Vue de plugin",
			},
			modePickViewHint:
				"Ce tableau n'a pas encore de vue — choisissez-en une dans l'onglet Vue de plugin.",
			modePickCardHint: "Ce tableau n'a pas encore de carte — ajoutez-en une dans l'onglet Carte.",
			singleCard: "Carte",
			singleCardDesc:
				"Quelle carte de ce tableau l'occupe. Les autres restent sur le tableau et reviennent s'il repasse en mode cartes.",
			singleCardEdit: "Modifier la carte",
			singleCardAdd: "Ajouter une nouvelle carte",
			pluginViewType: "Vue",
			pluginViewTypeDesc:
				"Quelle vue enregistrée remplit ce tableau. La liste contient toutes les vues actuellement disponibles, elle dépend donc des plugins activés.",
			pluginViewTypeNone: "Choisir une vue…",
			pluginViewFile: "Fichier",
			pluginViewFileDesc:
				"Ouvrir la vue sur un fichier précis — un Canvas, un dessin Excalidraw. Laissez vide pour afficher la vue seule.",
			pluginViewFileRequiredDesc:
				"Cette vue a besoin d'un fichier. Choisissez la note, le PDF ou l'image que ce tableau ouvre.",
			pluginViewHideHeader: "Masquer l'en-tête de la vue",
			pluginViewHideHeaderDesc:
				"Retirer le fil d'Ariane, les flèches précédent/suivant et le menu de la vue hébergée. Ses propres barres d'outils et onglets restent intacts.",
			pluginViewKeepMounted: "Continuer en arrière-plan",
			pluginViewKeepMountedDesc:
				"Rester chargé pendant qu'un autre tableau est affiché, pour un retour instantané au lieu d'un rechargement. Désactivez pour un plugin lourd. Seuls quelques tableaux restent chargés en même temps.",
			pluginViewFocusable: "Laisser la vue prendre le focus (expérimental)",
			pluginViewFocusableDesc:
				"En faire le panneau actif quand vous y travaillez, pour que les commandes et raccourcis du plugin la trouvent. Obsidian ouvre aussi les notes dans le panneau actif : un lien cliqué peut donc remplacer la vue jusqu'à ce que vous changiez de tableau.",
			pluginViewPerfNote:
				"Une vue hébergée, c'est le plugin qui fait tout son travail, pas un aperçu — elle coûte autant que d'ouvrir ce plugin. Les vues lentes dans leur propre onglet le sont aussi ici.",
			switcherIcon: "Icône du sélecteur",
			switcherIconDesc:
				"Un emoji ou un texte court affiché sur le bouton du sélecteur. Vide = numéro.",
			switcherLucide: "Icône Lucide du sélecteur",
			switcherLucideDesc:
				"Une icône Lucide (ex. « home », « star », « layout-dashboard ») — parcourez la collection ou tapez un id. Prioritaire sur l'emoji ci-dessus.",
			linkedWorkspace: "Espace de travail lié",
			linkedWorkspaceDesc:
				"Basculer automatiquement sur ce tableau quand cet espace de travail se charge. Nécessite le module principal Espaces de travail.",
			linkedWorkspaceNone: "Aucun",
			mobileDefault: "Par défaut sur mobile",
			mobileDefaultDesc:
				"Ouvrir ce tableau quand Hearth se charge sur téléphone ou tablette. Un seul tableau peut être le tableau mobile par défaut ; l'activer le retire des autres.",
			titleVisibility: "Visibilité du titre",
			titleVisibilityDesc:
				"Afficher ou masquer uniquement le bloc de titre de ce tableau. Remplace le paramètre global.",
			titleVisibilityDefault: (state: string) => `Paramètre global (${state})`,
			searchVisibility: "Visibilité de la recherche",
			searchVisibilityDesc:
				"Afficher ou masquer la barre de recherche et de commandes, ses résultats et ses filtres sur ce tableau. Remplace le paramètre global.",
			searchVisibilityShow: "Afficher la recherche",
			searchVisibilityHide: "Masquer la recherche",
			searchPlaceholder: "Texte indicatif de recherche",
			searchPlaceholderDesc:
				"Le texte grisé du champ de recherche de ce tableau. Laissez vide pour le texte par défaut.",
			newNoteButton: "Bouton à côté de la recherche",
			newNoteButtonDesc:
				"Afficher ou masquer le bouton à côté du champ de recherche de ce tableau.",
			newNoteButtonStateOn: "affiché",
			newNoteButtonStateOff: "masqué",
			newNoteButtonMode: "Action du bouton",
			newNoteButtonModeDesc:
				"Créer une note, ou chercher sur le web le texte saisi dans le champ de recherche.",
			newNoteButtonModeOptions: {
				newNote: "Nouvelle note",
				searchOnline: "Chercher en ligne",
			},
			newNoteButtonLabel: "Libellé du bouton",
			newNoteButtonLabelDesc:
				"Le texte de ce bouton sur ce tableau. Laissez vide pour le texte par défaut.",
			hiddenFilters: "Filtres",
			hiddenFiltersDesc:
				"Choisir quels filtres de type de fichier ce tableau affiche sous la barre de recherche, au lieu du choix global du coffre.",
			hiddenFiltersFollowing: (count: number) =>
				count === 0
					? "Suit le coffre, qui n'en masque aucun."
					: `Suit le coffre, qui en masque ${count}.`,
			hiddenInstant: "Réponses instantanées",
			hiddenInstantDesc: "Désactiver les réponses pour les barres de recherche de ce tableau. Les réponses désactivées pour tout le coffre le restent.",
			hiddenInstantOffVault: "Désactivé pour tout le coffre dans Paramètres → Recherche.",
			hiddenInstantVaultOff: "Les réponses instantanées sont désactivées pour tout le coffre dans Paramètres → Recherche.",
			stackOnNarrow: "Empiler en format étroit",
			stackOnNarrowDesc:
				"Réorganiser ce tableau en une seule colonne pleine largeur quand le panneau est trop étroit pour la disposition libre — un téléphone, ou un panneau divisé étroit.",
			stackOnNarrowStateOn: "empiler",
			stackOnNarrowStateOff: "garder la disposition",
			stackOnNarrowOptionOn: "Empiler en une colonne",
			stackOnNarrowOptionOff: "Garder la disposition mise à l'échelle",
			narrowWidth: "Étroit en dessous de",
			arrangeVisibility: "Bouton Organiser",
			arrangeVisibilityDesc:
				"Le bouton Organiser reste-t-il visible sur ce tableau ou apparaît-il au survol.",
			switcherVisibility: "Sélecteur de tableaux",
			switcherVisibilityDesc:
				"Le sélecteur de tableaux reste-t-il visible sur ce tableau ou apparaît-il au survol.",
			chromeOptions: {
				always: "Toujours visible",
				hover: "Au survol",
			},
			chromeStates: {
				always: "toujours visible",
				hover: "au survol",
			},
			skyAnimate: "Animer le ciel",
			skyAnimateDesc:
				"Laisser la météo peinte de ce tableau dériver, tomber et scintiller. Le niveau de performance et le paramètre « réduire les animations » peuvent toujours la figer.",
			skyAnimateStateOn: "animé",
			skyAnimateStateOff: "figé",
			skyAnimateOptionOn: "Animer",
			skyAnimateOptionOff: "Figer",
			cardDesign: "Design",
			cardDesignDesc:
				"Comment ce tableau est dessiné — ses cartes, ses boutons, les dialogues et menus qui en partent — sauf si une carte choisit elle-même : Classique ou Material 3 Expressive.",
			skyDesign: "Design de l'arrière-plan",
			skyDesignDesc:
				"Le ciel peint classique, ou le ciel plat Material 3 Expressive, sur ce tableau.",
			wallpaperDesignDesc:
				"Le fond d'écran Hearth sur ce tableau : collines classiques, ou formes plates Material 3 Expressive dans votre couleur d'accent.",
			visibilityDefaultPlugin: (state: string) =>
				`Par défaut sur un tableau de plugin (${state})`,
			visibilityDefaultSingle: (state: string) =>
				`Par défaut sur un tableau à carte unique (${state})`,
			visibilityShown: "affiché",
			visibilityHidden: "masqué",
			visibilityShow: "Afficher le titre",
			visibilityHide: "Masquer le titre",
			titleText: "Texte du titre",
			titleTextDesc: "Remplacer le titre global pour ce tableau.",
			titleIcon: "Icône du titre",
			titleIconDesc:
				"Le symbole à côté du titre de ce tableau : un id d'icône Lucide, un emoji ou un texte court, le chemin d'une image du coffre ou l'URL d'une image. Videz-le pour afficher le cristal Hearth sur ce seul tableau.",
			titleAlign: "Alignement du titre",
			titleAlignDesc:
				"Aligner uniquement le bloc de titre. La barre de recherche garde sa propre disposition.",
			alignDefault: "Par défaut (centré)",
			alignLeft: "Gauche",
			alignCenter: "Centre",
			alignRight: "Droite",
			titleSize: "Taille du titre",
			titleIconSize: "Taille de l'icône du titre",
			titleTopMargin: "Marge au-dessus du titre",
			headerSpacingBelow: "Espace sous le titre/l'en-tête",
			contentWidth: "Largeur du contenu",
			fullWidth: "Pleine largeur",
			fullWidthDesc: "Remplacer la limite de largeur pour ce tableau.",
			fullWidthDefault: (state: string) => `Paramètre global (${state})`,
			fullWidthOptionOn: "Remplir le panneau",
			fullWidthOptionOff: "Limiter la largeur",
			fullWidthStateOn: "remplir le panneau",
			fullWidthStateOff: "limitée",
			fitToPage: "Ajuster à la page",
			fitToPageDesc: "Remplacer le défilement pour ce tableau.",
			fitDefault: (state: string) => `Paramètre global (${state})`,
			fitStateFit: "ajusté",
			fitStateScroll: "défilement",
			fitOptionFit: "Tenir sur une page",
			fitOptionScroll: "Autoriser le défilement",
			fitToPagePluginNote:
				"Un tableau de plugin remplit toujours le panneau — la vue hébergée l'occupe et gère son propre défilement.",
			fitToPageSingleNote:
				"Un tableau à carte unique occupe toujours tout le volet — la carte le remplit et défile elle-même.",
			themeColorTarget: "Couleur d'accent sur le titre",
			themeColorTargetDesc:
				"Quelles parties du logo de ce tableau suivent la couleur d'icône du thème. Remplace le paramètre global pour ce tableau ; les icônes d'onglet et du ruban de Hearth suivent toujours le paramètre global.",
			themeColorTargetDefault: (state: string) => `Paramètre global (${state})`,
			themeColorTargetOptions: {
				none: "Aucune",
				icon: "L'icône",
				title: "Le titre",
				both: "Les deux",
			},
			compact: "Espacement compact",
			compactDesc: "Remplacer l'espacement global pour ce tableau.",
			compactDefault: (state: string) => `Paramètre global (${state})`,
			compactOptionOn: "Compact",
			compactOptionOff: "Aéré",
			compactStateOn: "compact",
			compactStateOff: "aéré",
			cardOpacity: "Opacité des cartes",
			cardBlur: "Flou des cartes",
			cardRadius: "Arrondi des coins des cartes",
			cardBorderWidth: "Bordure des cartes",
			done: "Terminé",
			overriding: "Remplace le paramètre global.",
			usingGlobal: (value: number | string) =>
				`Paramètre global utilisé (${value}).`,
			usingDefault: (value: number | string) =>
				`Valeur par défaut utilisée (${value}).`,
			usingDefaultText: (value: string) =>
				`Valeur par défaut utilisée (${value}).`,
			background: "Arrière-plan",
			backgroundDesc: "Remplacer l'arrière-plan global pour ce tableau.",
			backgroundValue: "Valeur de l'arrière-plan",
			opacity: "Opacité",
			blur: "Flou",
			backgroundLayout: "Disposition de l'arrière-plan",
			bannerHeight: "Hauteur de la bannière",
			bannerFade: "Fondu du bord inférieur",
			bannerFullWidth: "Pleine largeur",
			clearOverride: "Suivre le paramètre global",
		},
		useGlobal: "Paramètre global",
		on: "activé",
		off: "désactivé",
		backgroundLayoutOptions: {
			full: "Arrière-plan complet",
			banner: "Bannière",
		},
		backgroundOptions: {
			default: "Paramètre global",
			none: "Aucun",
			hdefault: "Hearth par défaut",
			harbour: "Village portuaire",
			color: "Couleur unie",
			image: "Image du coffre",
			url: "URL d'image",
			weather: "Ciel météo en direct",
		},
		backgroundValueDesc: {
			color: "Une couleur CSS, ex. #1e1e2e.",
			image: "Le chemin d'une image du coffre, ex. Pièces jointes/fond.png.",
			url: "Une URL d'image directe.",
		},
	},

	// ---- Plugin settings tab -------------------------------------------
	settings: {
		resetSlider: "Rétablir la valeur par défaut",
		resetField: "Rétablir la valeur par défaut",
		indexSub: "Un écran d'accueil pour votre coffre — recherche, tableau de bord et lanceur en un.",
		backToIndex: "Retour à tous les paramètres",
		indexGroups: {
			lookFeel: "Apparence",
			howItWorks: "Fonctionnement",
			data: "Données et plugins",
			etc: "Divers",
		},
		tabDescs: {
			appearance: "Design, titre, icône du titre, arrière-plan et mode économie d'énergie.",
			search: "La barre de recherche et les résultats qu'elle propose.",
			dashboard: "Grille, surface des cartes et contrôles autour du tableau.",
			behaviour: "Démarrage, ouverture des notes et confidentialité.",
			mobile: "La disposition empilée sur téléphone et la barre d'actions.",
			integrations: "TaskNotes, icônes de fichiers et tous les plugins que Hearth lit.",
			backup: "Exporter et importer votre disposition et vos paramètres.",
			about: "Version, nouveautés et où signaler un problème.",
		},
		sectionError: (name: string) => `La section « ${name} » n'a pas pu être affichée.`,
		sectionErrorHint:
			"Ouvrez la console développeur (Cmd/Ctrl+Option+I) pour voir l'erreur, puis signalez-la sur GitHub. Les autres paramètres ne sont pas affectés.",
		tabs: {
			appearance: "Apparence",
			search: "Recherche",
			dashboard: "Tableau de bord",
			behaviour: "Comportement",
			mobile: "Mobile",
			integrations: "Intégrations",
			backup: "Sauvegarde",
			about: "À propos",
		},
		sections: {
			performance: "Performance",
			performanceDesc:
				"Combien de décoration vous êtes prêt à payer. Échangez des effets visuels contre de l'autonomie et de la fluidité sur du matériel plus lent.",
			home: "Accueil",
			homeDesc:
				"Titre, icônes du titre et de l'onglet, visibilité de la recherche et largeur du contenu.",
			searchBar: "Barre de recherche",
			searchBarDesc: "L'apparence du champ de recherche et ce qu'il fait.",
			grid: "Grille et espacement",
			gridDesc: "Taille et espacement de la grille de cartes.",
			dashboardControls: "Contrôles du tableau",
			dashboardControlsDesc: "Visibilité des contrôles autour du tableau de bord.",
			cardSurface: "Surface des cartes",
			cardSurfaceDesc:
				"Transparence et flou verre givré appliqués à toutes les cartes.",
			startup: "Démarrage et onglets",
			startupDesc: "Quand et où la vue d'accueil s'ouvre.",
			opening: "Ouverture des notes",
			openingDesc: "Où une note s'ouvre quand vous cliquez dessus dans Hearth.",
			mobileMode: "Disposition",
			mobileModeDesc:
				"La disposition du tableau quand l'écran est trop étroit pour sa propre disposition.",
			privacy: "Confidentialité et réseau",
			privacyDesc: "Contrôler les requêtes sortantes que Hearth peut effectuer.",
		},
		about: {
			heading: "À propos de Hearth",
			headingDesc: "Liens du projet, soutien et version.",
			setup: "Configurer Hearth",
			setupDesc:
				"Répondez à quelques questions sur votre façon de travailler et ce qui est installé, et Hearth " +
				"crée un tableau de bord adapté. Il est ajouté comme nouveau tableau — rien de ce que " +
				"vous avez déjà n'est modifié.",
			setupAgain: "Créer un tableau de bord",
			setupAgainDesc:
				"Relancez l'assistant de configuration pour générer un autre tableau de bord. Il est toujours " +
				"ajouté comme nouveau tableau, vos tableaux existants ne sont donc jamais touchés — " +
				"et tout ce qu'il règle s'applique à ce seul tableau, pas aux paramètres " +
				"globaux du coffre.",
			setupButton: "Lancer la configuration",
			whatsNew: "Nouveautés",
			whatsNewDesc: "Lire les notes de version de cette version et des précédentes.",
			whatsNewButton: "Voir le journal des modifications",
			github: "Dépôt GitHub",
			githubDesc: "Parcourir le code source, mettre une étoile au projet ou lire le journal des modifications.",
			githubButton: "Ouvrir GitHub",
			reportIssue: "Signaler un problème",
			reportIssueDesc:
				"Un bug ou une idée de fonctionnalité ? Ouvrez un ticket sur GitHub.",
			reportIssueButton: "Signaler",
			kofi: "Soutenir Hearth",
			kofiDesc:
				"Hearth est gratuit et le restera. S'il a gagné sa place sur votre écran " +
				"d'accueil, vous pouvez laisser un pourboire — totalement facultatif, aucune fonction n'est bloquée.",
			kofiButton: "Un pourboire sur Ko-fi",
			version: (v: string) => `Version ${v}`,
			versionDesc: "La version de Hearth que vous utilisez.",
		},
		appearance: {
			heading: "Apparence",
			headingDesc: "Titre, icône du titre, barre de recherche et largeur du contenu.",
			showTitle: "Afficher le titre",
			showTitleDesc: "Afficher le grand titre et son icône en haut.",
			showSearch: "Afficher la section de recherche",
			showSearchDesc:
				"Afficher la barre de recherche et de commandes avec ses résultats et ses filtres. " +
				"Chaque tableau peut remplacer ce choix dans ses paramètres.",
			title: "Titre",
			titleDesc: "Le texte affiché en haut de la vue d'accueil.",
			titleIcon: "Icône du titre",
			titleIconDesc:
				"Le symbole dessiné à côté du titre. Accepte : un id d'icône Lucide " +
				"(parcourez la collection avec le bouton 🔍), un emoji ou un ou deux " +
				"caractères, le chemin d'une image du coffre (bouton 📷), ou l'URL d'une " +
				"image sur le web. Laissez vide pour le cristal Hearth. Chaque " +
				"tableau peut le remplacer dans ses propres paramètres.",
			tabIcon: "Icône de l'onglet",
			tabIconDesc:
				"Une icône Lucide pour l'en-tête d'onglet et le bouton du ruban de Hearth, à la place " +
				"du cristal Hearth. Parcourez la collection ou tapez un id ; laissez vide pour le cristal.",
			themeColorTarget: "Suivre la couleur d'icône du thème",
			themeColorTargetDesc:
				"Dessiner le cristal et/ou le titre dans la couleur d'icône de votre " +
				"thème au lieu du cristal violet par défaut et du texte normal.",
			themeColorNone: "Désactivé",
			themeColorIcon: "Icône",
			themeColorTitle: "Titre",
			themeColorBoth: "Icône et titre",
			searchPlaceholder: "Texte indicatif de recherche",
			searchInstantAnswers: "Réponses instantanées",
			searchInstantAnswersDesc:
				"Répondre directement à la requête au-dessus des notes — un calcul, une devise, une action, " +
				"la météo, un résumé Wikipédia et plus. Choisissez les réponses ci-dessous. " +
				"Les réponses en ligne ne sont récupérées que pour les requêtes qui les demandent.",
			searchTips: "Astuces de recherche",
			searchTipsDesc: "Tout ce que la barre de recherche comprend, avec des exemples.",
			searchTipsButton: "Afficher",
			searchContents: "Chercher dans le contenu des notes",
			searchContentsDesc:
				"Chercher aussi dans le texte des notes, pas seulement les noms, tags et " +
				"propriétés. Ces résultats apparaissent après les correspondances de nom, avec un extrait.",
			searchEngine: "Moteur de recherche",
			searchEngineDesc:
				"Le moteur qui alimente la barre de recherche. Omnisearch nécessite que le " +
				"module complémentaire Omnisearch soit installé et activé.",
			searchEngineBuiltin: "Hearth (intégré)",
			searchEngineOmnisearch: "Omnisearch",
			omnisearchMissing:
				"Omnisearch n'est pas installé ou activé. Installez-le et activez-le, " +
				"puis sélectionnez-le à nouveau.",
			omnisearchInstallLink: "Ouvrir Omnisearch dans les modules complémentaires",
			showNewNoteButton: "Afficher le bouton « Nouvelle note »",
			showNewNoteButtonDesc: "Afficher le bouton d'action à côté du champ de recherche.",
			newNoteButtonMode: "Bouton de la barre de recherche",
			newNoteButtonModeDesc:
				"Ce que fait le bouton à côté de la barre de recherche : créer une note, ou " +
				"chercher sur le web le contenu du champ de recherche.",
			newNoteButtonModeNewNote: "Nouvelle note",
			newNoteButtonModeSearchOnline: "Chercher en ligne",
			webSearchEngine: "Moteur de recherche en ligne",
			webSearchEngineDesc:
				"Le moteur qu'ouvre le bouton « Chercher en ligne ». La flèche à côté " +
				"du bouton permet d'en utiliser un autre pour une seule requête, sans " +
				"modifier ce choix.",
			newNoteHeading: "Le bouton « Nouvelle note »",
			newNoteHeadingDesc:
				"Ce que crée le bouton, et où. Les mêmes paramètres pilotent le " +
				"bouton à côté de la barre de recherche, celui d'une carte barre de recherche, et " +
				"la commande « Créer une note » de Hearth.",
			newNoteButtonLabel: "Texte du bouton",
			newNoteButtonLabelDesc:
				"Texte du bouton. Laissez vide pour « Nouvelle note ».",
			newNoteTemplate: "Modèle",
			newNoteTemplateDesc:
				"Créer la note à partir d'un modèle Templater au lieu d'une note vide. " +
				"Templater gère le modèle — vos scripts utilisateur, " +
				"dialogues tp.system.prompt() et placement du curseur fonctionnent comme " +
				"depuis sa propre commande.",
			newNoteTemplateNone: "Note vide",
			newNoteTemplatePick: "Choisir un modèle…",
			newNoteTemplateClear: "Utiliser une note vide",
			newNoteTemplaterMissing:
				"Templater n'est pas activé. Installez-le et activez-le pour utiliser un modèle " +
				"ici ; en attendant, le bouton crée une note vide.",
			newNoteFolder: "Emplacement",
			newNoteFolderDesc:
				"Dossier de la nouvelle note, créé s'il n'existe pas encore. " +
				"« Emplacement par défaut » signifie là où Obsidian place les nouvelles notes.",
			newNoteFolderClear: "Utiliser l'emplacement par défaut",
			newNoteFilename: "Nom du fichier",
			newNoteFilenameDesc:
				"Nom de la nouvelle note, sans l'extension. {{date}}, " +
				"{{date:FMT}}, {{time}}, {{time:FMT}} et {{prompt}} sont " +
				"remplacés — {{prompt}} vous demande le nom à chaque clic. " +
				"Laissez vide pour « Sans titre ».",
			newNoteFilenamePlaceholder: "Sans titre",
			newNoteDestination: (destination: string) => `Crée ${destination}`,
			contentWidth: "Largeur du contenu",
			contentWidthDesc:
				"La largeur maximale du contenu d'accueil, en pixels. C'est un plafond, " +
				"pas une largeur fixe — le contenu se réduit toujours dans un panneau plus étroit.",
			fullWidth: "Pleine largeur",
			fullWidthDesc:
				"Laisser le contenu remplir le panneau au lieu de s'arrêter à la largeur " +
				"ci-dessous. Les cartes gardent leurs proportions quand le panneau s'élargit, mais le texte " +
				"ne grandit pas avec elles : un tableau très large paraît donc plus clairsemé.",
		},
		performance: {
			tier: "Niveau de performance",
			tierDesc:
				"Chaque niveau inférieur supprime l'élément le plus coûteux suivant. " +
				"Rien n'est écrasé — vos paramètres reviennent exactement tels " +
				"qu'ils étaient quand vous remontez.",
			tierFull: "Complet — tout activé",
			tierBalanced: "Équilibré — un ciel plus léger",
			tierReduced: "Réduit — rien ne bouge",
			tierMinimal: "Minimal — sobre et immobile",
			tierFullDesc:
				"Tous les effets à pleine puissance. Le ciel météo peint est l'élément le plus " +
				"coûteux : si le tableau fait chauffer votre machine, c'est ce " +
				"paramètre qu'il faut baisser.",
			tierBalancedDesc:
				"Le ciel peint est dessiné à demi-densité — moins de gouttes, d'étoiles, " +
				"de nuages et de brume. Rien n'est désactivé et rien ne s'arrête " +
				"de bouger ; il y en a simplement moins, pour environ un tiers de travail en moins.",
			tierReducedDesc:
				"Rien ne bouge sur le tableau, et le verre givré derrière les cartes est " +
				"désactivé. Votre fond d'écran reste, les cartes restent translucides, et chaque carte " +
				"se rafraîchit toujours selon son minuteur — le tableau est simplement immobile.",
			tierMinimalDesc:
				"L'option la plus sobre : une couleur unie au lieu du fond d'écran, des cartes " +
				"opaques, aucune animation, et aucune carte qui se rafraîchit toute seule.",
			pauseWhenUnfocused: "Mettre en pause quand Obsidian n'est pas au premier plan",
			pauseWhenUnfocusedDesc:
				"Suspendre toutes les animations quand vous travaillez dans une autre application ou " +
				"une autre fenêtre. Un onglet Hearth caché derrière un autre onglet ne coûte " +
				"déjà rien ; ceci couvre un tableau visible dans une fenêtre que vous n'utilisez " +
				"pas — à côté d'un navigateur, ou sur un second écran. Désactivez si vous " +
				"laissez le tableau tourner sur un second écran.",
			color: "Arrière-plan minimal",
			colorDesc:
				"La couleur unie affichée derrière la vue d'accueil au niveau minimal. " +
				"N'importe quelle couleur CSS, ex. #4a4459.",
			effects: "À ce niveau :",
			effectSkyHalf: "le ciel météo peint est dessiné à demi-densité",
			effectBackground: "l'arrière-plan est une couleur unie — pas d'image, de GIF, de calque d'opacité ni de flou",
			effectOpaque: "les cartes sont opaques plutôt que translucides",
			effectFrost: "pas de flou verre givré derrière les cartes",
			effectMotion: "transitions, soulèvements au survol, ombres et animations sont désactivés",
			effectRefresh:
				"les cartes web, RSS, abonnements calendrier et Jira ne se rafraîchissent plus automatiquement (le rafraîchissement manuel fonctionne toujours)",
			effectLiveRefresh: "le tableau ne se reconstruit plus à chaque changement du coffre",
			effectClock: "les horloges n'affichent plus les secondes ni la trotteuse",
			effectSlideshow: "les diaporamas gardent une seule image au lieu de défiler",
			vibrancyFrost:
				"Le verre givré est désactivé tant que la fenêtre translucide d'Obsidian est active : un " +
				"flou et la translucidité macOS se mélangent l'un à l'autre sur toute la fenêtre, " +
				"ce qui fait scintiller la barre d'onglets. Votre paramètre de flou est conservé et " +
				"revient dès que vous désactivez la fenêtre translucide.",
			overridden:
				"Le niveau de performance remplace actuellement ces paramètres. Ils sont conservés tels " +
				"quels et reprennent effet quand vous remontez de niveau.",
		},
		background: {
			heading: "Arrière-plan",
			headingDesc:
				"Le décor derrière la vue d'accueil, et sa visibilité.",
			type: "Type d'arrière-plan",
			typeDesc: "Ce qui s'affiche derrière la vue d'accueil.",
			value: "Valeur de l'arrière-plan",
			valueColorDesc: "Une couleur CSS, ex. #1e1e2e ou rgb(30,30,46).",
			valueImageDesc: "Le chemin d'une image du coffre, ex. Pièces jointes/fond.png.",
			valueUrlDesc: "Une URL d'image directe.",
			externalCallsDisabled:
				"Non affiché tant que « Désactiver les appels externes » est actif dans Comportement : " +
				"cet arrière-plan vient du web. Choisissez plutôt une image du coffre, " +
				"ou désactivez ce paramètre.",
			opacity: "Opacité",
			opacityDesc:
				"À quel point l'arrière-plan transparaît. Plus bas = plus discret.",
			blur: "Flou",
			blurDesc: "Flou de l'arrière-plan en pixels.",
			layout: "Disposition de l'arrière-plan",
			layoutDesc:
				"Remplir toute la vue avec l'arrière-plan, ou l'utiliser en bannière — " +
				"une bande en haut du tableau, comme une image de couverture " +
				"au-dessus d'une note — avec les cartes en dessous sur la surface du thème. " +
				"Chaque tableau peut remplacer ce choix dans ses propres paramètres.",
			layoutLabels: {
				full: "Arrière-plan complet",
				banner: "Bannière",
			},
			bannerHeight: "Hauteur de la bannière",
			bannerHeightDesc: "La hauteur de la bande de bannière, en pixels.",
			bannerFade: "Fondu du bord inférieur",
			bannerFadeDesc:
				"Laisser la bannière se fondre dans la page au lieu de finir sur une ligne nette.",
			bannerFullWidth: "Pleine largeur",
			bannerFullWidthDesc:
				"Étendre la bannière d'un bord à l'autre au lieu de l'aligner sur le contenu.",
			labels: {
				default: "Hearth par défaut",
				harbour: "Village portuaire",
				none: "Aucun",
				color: "Couleur unie",
				image: "Image du coffre",
				url: "URL d'image",
				weather: "Ciel météo en direct",
			},
			weatherHeading: "Ciel météo",
			weatherDesc:
				"Le décor du tableau devient un ciel peint — le même que le style artistique " +
				"de la carte météo, étendu sur toute la fenêtre. Suivez les " +
				"conditions réelles d'un lieu (via Open-Meteo ; seules les coordonnées sont " +
				"envoyées, et rien n'est récupéré quand les appels externes sont désactivés), ou figez un " +
				"ciel, ce qui ne nécessite aucun lieu ni connexion.",
			weatherNoPlace: "Choisissez un lieu ci-dessous pour peindre le ciel.",
			skySource: "Ciel",
			skySourceDesc:
				"Suivre la météo réelle d'un lieu, ou garder un ciel fixe quel que soit le temps dehors.",
			skySourceLive: "Météo en direct",
			skySourceFixed: "Un ciel fixe",
			skyCondition: "Condition",
			skyConditionDesc: "La météo que ce ciel affiche toujours.",
			skyDaylight: "Moment de la journée",
			skyDaylightDesc: "Le ciel suit-il votre horloge ou reste-t-il de jour ou de nuit.",
			skyDaylightAuto: "Suivre l'horloge",
			skyDaylightDay: "Toujours de jour",
			skyDaylightNight: "Toujours de nuit",
			skyAnimate: "Animer le ciel",
			skyAnimateDesc:
				"Nuages qui dérivent, pluie qui tombe et étoiles qui scintillent derrière le tableau. Toujours " +
				"désactivé en mode économie d'énergie et si votre système demande de réduire les animations.",
			skyDesign: "Design",
			skyDesignDesc:
				"Le ciel peint classique, ou un ciel plat Material 3 Expressive avec des collines, des nuages ronds et un soleil qui tourne.",
			wallpaperDesignDesc:
				"Collines classiques avec une cabane — un matin en thème clair, une nuit au clair de lune en thème sombre — " +
				"ou des formes plates Material 3 Expressive dans les tons de votre couleur d'accent. Dessiné par Hearth, " +
				"donc rien n'est téléchargé.",
			skyDesignClassic: "Classique (peint)",
			skyDesignExpressive: "Expressif (plat)",
		},
		behaviour: {
			heading: "Comportement",
			headingDesc:
				"Quand et où Hearth s'ouvre, et le mode recherche seule sur téléphone/tablette.",
			openOnStartup: "Ouvrir au démarrage",
			openOnStartupDesc: "Ouvrir la vue d'accueil au chargement du coffre.",
			replaceNewTabs: "Remplacer les nouveaux onglets",
			replaceNewTabsDesc: "Afficher la vue d'accueil au lieu d'un nouvel onglet vide.",
			focusSearchOnOpen: "Placer le curseur dans la recherche à l'ouverture",
			focusSearchOnOpenDesc:
				"Placer le curseur dans le champ de recherche à chaque ouverture de l'accueil, pour " +
				"pouvoir taper tout de suite. Ordinateur uniquement.",
			liveRefresh: "Actualisation en direct",
			liveRefreshDesc:
				"Garder la vue d'accueil à jour quand le coffre change — les cartes Récents, Signets " +
				"et requêtes enregistrées se mettent à jour sans rouvrir l'onglet. Revenir sur " +
				"l'onglet Hearth l'actualise toujours, quel que soit ce paramètre.",
			liveSettingsSync: "Prendre en compte les changements synchronisés",
			liveSettingsSyncDesc:
				"Appliquer les modifications de tableaux faites sur un autre appareil dès que la synchro " +
				"les apporte, au lieu d'attendre le prochain redémarrage d'Obsidian. Laissez activé sauf " +
				"si un tableau qui se recharge en cours de session vous gêne.",
			legacyTag: "Ancien",
			mobileSearchOnly: "Mode mobile (recherche seule)",
			mobileSearchOnlyDesc:
				"Sur téléphone et tablette, masquer le tableau et n'afficher que le champ " +
				"de recherche. Sans effet sur ordinateur.",
			stackOnNarrow: "Empiler les cartes sur écran étroit",
			stackOnNarrowDesc:
				"Quand le tableau est trop étroit pour sa disposition — un téléphone, ou un panneau " +
				"étroit sur ordinateur — afficher les cartes en une seule colonne pleine largeur. " +
				"Votre disposition n'est pas modifiée et revient en pleine largeur. " +
				"Chaque carte peut être masquée, réordonnée, redimensionnée ou repliée pour cette " +
				"colonne depuis ses propres paramètres.",
			narrowWidth: "Étroit en dessous de",
			narrowWidthDesc:
				"La largeur, en pixels, en dessous de laquelle le tableau est considéré comme étroit. Augmentez-la " +
				"pour qu'une fenêtre en demi-écran passe à la disposition étroite ; diminuez-la " +
				"pour garder la disposition libre dans des panneaux plus serrés. Chaque " +
				"tableau peut remplacer ce paramètre.",
			mobilePerformanceTier: "Niveau de performance sur mobile",
			mobilePerformanceTierDesc:
				"Le niveau utilisé sur téléphone et tablette, où le ciel animé et " +
				"le verre givré sont dessinés sur le plus petit écran et payés par la " +
				"batterie. Votre niveau ordinateur est conservé séparément et n'est pas modifié.",
			mobileTierMatch: "Comme sur ordinateur",
			disableExternalCalls: "Désactiver les appels externes",
			disableExternalCallsDesc:
				"Bloquer toutes les requêtes réseau sortantes de Hearth, y compris Jira, " +
				"calendriers externes, flux RSS, taux de change de la calculatrice, " +
				"et arrière-plans et icônes de titre donnés par une adresse web — ceux-ci " +
				"sont remplacés par aucune image et le cristal Hearth.",
			openIn: "Ouvrir les notes dans",
			openInDesc:
				"Où va une note ouverte depuis Hearth. « Onglet actuel » remplace " +
				"la vue d'accueil, Hearth se comporte alors comme un onglet normal. Ctrl/Cmd-clic " +
				"ouvre toujours un nouvel onglet.",
			openInModes: {
				tab: "Un nouvel onglet",
				same: "L'onglet actuel (remplace Hearth)",
				split: "Un panneau divisé",
				window: "Une nouvelle fenêtre",
			},
			openInFollow: "Comme ci-dessus",
			openInSources: {
				link: "Liens",
				linkDesc: "Liens dans les notes, les tâches et la carte Liens.",
				search: "Résultats de recherche",
				searchDesc: "Résultats de la barre de recherche et de la carte Recherche.",
				card: "Notes dans les cartes",
				cardDesc:
					"Notes listées par les cartes Récents, Signets, Favoris, Calendrier, Carte d'activité et " +
					"Tâches, et par les boutons d'action mobiles.",
				newNote: "Notes créées par Hearth",
				newNoteDesc: "Nouvelles notes, notes quotidiennes et notes d'événement, ouvertes à leur création.",
			},
			openFromOutside: "Notes ouvertes hors de Hearth",
			openFromOutsideDesc:
				"L'explorateur de fichiers, le changement rapide, le graphe — et tout ce qu'une carte " +
				"intègre et qui ouvre des liens lui-même. Obsidian les envoie à l'onglet " +
				"actif, donc un onglet Hearth est remplacé. Choisissez « un nouvel onglet » pour garder " +
				"l'onglet Hearth ; l'explorateur de fichiers ne suit alors plus ce que vous ouvrez.",
			openFromOutsideModes: {
				same: "L'onglet actuel (remplace Hearth)",
				tab: "Un nouvel onglet (garde Hearth ouvert)",
			},
		},
		mobileActions: {
			heading: "Barre d'actions mobile",
			headingDesc:
				"En mode mobile (recherche seule), cette rangée de boutons remplace le " +
				"bouton « Nouvelle note » à côté de la barre de recherche, et apparaît sous le " +
				"champ de recherche et les filtres. Chaque bouton peut exécuter une commande, " +
				"ouvrir une note ou un fichier, ou ouvrir une URL — comme une tuile de lanceur.",
			showActionBar: "Afficher la barre d'actions",
			showActionBarDesc:
				"Afficher la rangée de boutons d'action sous le champ de recherche en mode mobile.",
			labelPlaceholder: "Libellé",
			iconPlaceholder: "Icône",
			commandTooltip: (id: string) => `Commande : ${id}`,
			pickCommand: "Choisir une commande",
			moveUp: "Monter",
			moveDown: "Descendre",
			removeButton: "Supprimer le bouton",
			addButton: "Ajouter un bouton",
			resetDefaults: "Rétablir les valeurs par défaut",
		},
		integrations: {
			heading: "Toutes les intégrations",
			headingDesc:
				"Tout ce avec quoi Hearth peut fonctionner, installé ou non. " +
				"La plupart des intégrations ne demandent aucune configuration — les autres indiquent où se " +
				"trouvent leurs paramètres.",
			groups: {
				plugin: "Modules complémentaires",
				pluginDesc: "Hearth les détecte automatiquement dès qu'ils sont activés.",
				core: "Modules principaux d'Obsidian",
				coreDesc:
					"Intégrés à Obsidian. Activez-les dans Paramètres → Modules principaux si une " +
					"carte indique qu'il en manque un.",
				service: "Services externes",
				serviceDesc:
					"Cartes qui récupèrent des données par le réseau. Toutes sont coupées d'un coup " +
					"par « Désactiver les appels externes » dans Comportement → Confidentialité et réseau.",
			},
			status: {
				enabled: "Activé",
				disabled: "Désactivé",
				missing: "Non installé",
				external: "Réseau",
				always: "Toujours disponible",
			},
			statusTooltip: {
				enabled: "Installé et activé — Hearth l'utilise.",
				disabled: "Installé mais désactivé, Hearth ne peut donc pas l'utiliser pour l'instant.",
				missing: "Non installé. Tout le reste de Hearth fonctionne sans.",
				external: "Une requête sortante, pas un plugin.",
				always: "Rien à installer.",
			},
			where: {
				section: "Paramètres plus bas dans cet onglet.",
				tab: (tab: string) => `Paramètres dans ${tab}.`,
				card: "Se configure sur la carte elle-même, dans votre tableau de bord.",
				pluginSettings: "Utilise les paramètres de ce plugin — rien à régler dans Hearth.",
				none: "Rien à configurer.",
			},
			install: "Installer",
			installTooltip: "Ouvrir ce plugin dans le catalogue des modules complémentaires d'Obsidian.",
			goToSection: "Afficher",
			goToTab: "Ouvrir",
			items: {
				omnisearch: {
					name: "Omnisearch",
					desc:
						"Fait passer la barre de recherche sur l'index plein texte approximatif d'Omnisearch " +
						"au lieu du moteur intégré de Hearth. Choisissez le moteur dans " +
						"Recherche → Barre de recherche ; ce choix ne tient que tant qu'Omnisearch est activé.",
				},
				tasknotes: {
					name: "TaskNotes",
					desc:
						"Permet aux cartes Tâches de lire les coffres TaskNotes (une note par tâche) — statut, " +
						"échéance et priorité directement depuis le frontmatter.",
				},
				dataview: {
					name: "Dataview",
					desc:
						"La carte Dataview exécute des requêtes DQL et des blocs DataviewJS et les affiche " +
						"avec les moteurs de rendu de Dataview, actualisés quand son index change.",
				},
				datacore: {
					name: "Datacore",
					desc:
						"Le successeur de Dataview. La carte Datacore exécute une requête Datacore — ou un " +
						"script JS/JSX/TS/TSX — et l'affiche avec les vues en direct de Datacore.",
				},
				templater: {
					name: "Templater",
					desc:
						"La carte « Nouvelle note depuis un modèle » transforme vos modèles Templater en " +
						"boutons : chaque tuile a son propre modèle, dossier de destination et " +
						"format de nom, et un clic crée la note. Templater gère le " +
						"modèle — vos scripts utilisateur, dialogues tp.system.prompt() et placement du " +
						"curseur fonctionnent comme depuis sa propre commande.",
				},
				periodicNotes: {
					name: "Periodic Notes",
					desc:
						"La carte Note périodique affiche la note de la semaine, du mois, du trimestre ou " +
						"de l'année, trouvée — et créée depuis votre propre modèle — par " +
						"Periodic Notes lui-même.",
				},
				journals: {
					name: "Journals",
					desc:
						"La même carte lit aussi Journals : choisissez l'un de vos journaux " +
						"et elle affiche sa note actuelle, trouvée — et créée " +
						"avec son propre modèle et ses questions — via l'API du plugin " +
						"Journals.",
				},
				git: {
					name: "Git",
					desc:
						"La carte Git affiche la branche, les modifications et les commits récents " +
						"de votre dépôt, et fait commit, synchro, push et pull via le plugin " +
						"Git lui-même — son dépôt distant, ses identifiants et son modèle de message " +
						"de commit s'appliquent tels quels.",
				},
				operon: {
					name: "Operon",
					desc:
						"Les cartes Operon — tâches, tableau, agenda et minuteur — lisent via " +
						"l'API développeur d'Operon, donc ses statuts, priorités et " +
						"récurrences restent définis par Operon. Ordinateur uniquement, nécessite Obsidian 1.12.2 " +
						"ou plus récent, et Operon doit approuver la demande de lecture de Hearth.",
				},
				iconic: {
					name: "Iconic",
					desc:
						"Les icônes par fichier définies avec Iconic apparaissent partout où Hearth liste un fichier — " +
						"Récents, Favoris, recherches enregistrées et résultats de recherche.",
				},
				iconize: {
					name: "Iconize",
					desc:
						"Pareil pour Iconize (anciennement Obsidian Icon Folder), y compris les icônes " +
						"définies via une propriété de frontmatter.",
				},
				frontMatterTitle: {
					name: "Front Matter Title",
					desc:
						"Les cartes Dossier et le navigateur de dossiers affichent les notes " +
						"sous les titres que Front Matter Title leur donne dans l'explorateur " +
						"de fichiers, au lieu de leurs noms de fichier.",
				},
				vaultPet: {
					name: "Vault Pet",
					desc:
						"La carte Vault Pet accueille le plugin sur votre tableau — soit sa " +
						"carte de compagnon, vivante et cliquable, soit toute sa maison avec " +
						"quêtes, index, badges et statistiques. Le compagnon, son XP et tout " +
						"ce qu'il débloque restent à Vault Pet ; Hearth ne fait que lui donner la place.",
				},
				excalidraw: {
					name: "Excalidraw",
					desc:
						"Les cartes Intégration affichent les dessins Excalidraw en direct, et l'action « Nouveau dessin » " +
						"en crée un via la commande d'Excalidraw.",
				},
				bases: {
					name: "Bases",
					desc: "Les cartes Intégration peuvent afficher une vue Bases (.base) sur le tableau.",
				},
				canvas: {
					name: "Canvas",
					desc: "Les cartes Intégration peuvent afficher un canvas, interactif et bord à bord.",
				},
				dailyNotes: {
					name: "Notes quotidiennes",
					desc:
						"Les cartes Note quotidienne, Mini-calendrier et Statistiques du coffre trouvent la note " +
						"du jour d'après le dossier, le format de date et le modèle de Notes quotidiennes.",
				},
				bookmarks: {
					name: "Signets",
					desc: "La carte Signets liste vos signets Obsidian, groupes compris.",
				},
				globalSearch: {
					name: "Recherche",
					desc:
						"Transmet une requête au panneau de recherche d'Obsidian quand vous demandez " +
						"tous les résultats.",
				},
				fileExplorer: {
					name: "Explorateur de fichiers",
					desc: "Permet « Afficher dans l'explorateur de fichiers » sur les résultats de recherche de Hearth.",
				},
				workspaces: {
					name: "Espaces de travail",
					desc: "Un tableau de bord peut basculer vers un espace de travail enregistré à son ouverture.",
				},
				audioRecorder: {
					name: "Enregistreur audio",
					desc:
						"Le bouton d'action mobile « Enregistrer la voix » démarre et arrête " +
						"l'enregistreur d'Obsidian.",
				},
				leafViews: {
					name: "Tout plugin avec un panneau latéral",
					desc:
						"La carte Vue de plugin héberge la vue enregistrée d'un autre plugin — " +
						"calendriers, tableaux kanban, plans, panneaux de tags — directement dans une carte. " +
						"Tout ce qui est installé apparaît dans le sélecteur de vue de la carte.",
				},
				jira: {
					name: "Jira",
					desc:
						"Les cartes Jira récupèrent les tickets de votre instance Jira Cloud ou Server via " +
						"son API REST, avec les identifiants saisis sur la carte.",
				},
				rss: {
					name: "Flux RSS et Atom",
					desc: "Les cartes RSS récupèrent et analysent n'importe quel flux RSS 2.0 ou Atom indiqué.",
				},
				ics: {
					name: "Flux iCalendar",
					desc:
						"Les cartes Mini-calendrier peuvent s'abonner à des calendriers ICS/webcal externes — " +
						"Google, iCloud, Fastmail, Nextcloud et autres.",
				},
				currency: {
					name: "Taux de change",
					desc:
						"La carte Calculatrice convertit les devises avec les taux de la BCE via l'API gratuite " +
						"et sans clé Frankfurter.",
				},
				markets: {
					name: "Cotations boursières",
					desc: "Les cartes Marchés lisent les cours depuis des sources gratuites et sans clé : Yahoo Finance pour la plupart des places mondiales, le forex et les cryptos ; Tencent pour les cotations de Shanghai, Shenzhen, Pékin et Hong Kong ; Eastmoney pour les fonds chinois hors bourse ; CoinGecko pour les cryptomonnaies ; et la BCE via Frankfurter pour les paires de devises. Aucune n'est une API officielle, donc une carte bascule vers une autre source en cas d'échec. Seuls les symboles de vos cartes sont envoyés.",
				},
				weather: {
					name: "Prévisions météo",
					desc:
						"Les cartes Météo — et l'arrière-plan ciel météo en direct — récupèrent les conditions " +
						"depuis Open-Meteo : gratuit, sans clé, sans compte. Seules les coordonnées que vous " +
						"choisissez sont envoyées, et un ciel figé sur une condition ne nécessite aucun " +
						"lieu.",
				},
				tension: {
					name: "Tension mondiale",
					desc:
						"Les cartes Tension mondiale lisent l'indice World Tension de Kagi News — une évaluation " +
						"de 0 à 100 de l'actualité mondiale du jour par un modèle de langage — depuis kite.kagi.com : " +
						"gratuit, sans clé, sans compte. Rien sur vous ou votre coffre n'est envoyé.",
				},
				webSearch: {
					name: "Recherche web",
					desc:
						"Le bouton de la barre de recherche peut envoyer votre requête à DuckDuckGo au lieu de " +
						"créer une note. Changez-le dans Recherche → Barre de recherche.",
				},
			},
		},
		tasks: {
			heading: "Tâches / TaskNotes",
			headingDesc:
				"Noms des champs lus par les cartes Tâches en mode TaskNotes. TaskNotes n'a pas " +
				"d'API stable pour les autres plugins, donc Hearth lit directement son frontmatter " +
				"— faites-les correspondre aux champs définis dans les paramètres de TaskNotes " +
				"(les valeurs par défaut ci-dessous sont celles de TaskNotes).",
			statusField: "Champ de statut",
			statusFieldDesc: "Champ de frontmatter lu pour le statut d'une tâche.",
			dueField: "Champ d'échéance",
			dueFieldDesc: "Champ de frontmatter lu pour l'échéance d'une tâche.",
			priorityField: "Champ de priorité",
			priorityFieldDesc:
				"Champ de frontmatter lu pour l'indicateur de priorité d'une tâche.",
			doneValue: "Valeur de statut « terminé »",
			doneValueDesc: "La valeur de statut qui marque une tâche TaskNotes comme terminée.",
			fieldsEnable: "Personnaliser les champs de tâche",
			fieldsEnableDesc:
				"Remplacer les métadonnées fixes des cartes Tâches par des champs que vous définissez " +
				"vous-même — n'importe quelle propriété de frontmatter ou donnée lue par Hearth, nommée, " +
				"colorée et ordonnée à votre guise. Désactivé par défaut, les tâches gardent " +
				"leur apparence habituelle tant que vous ne l'activez pas. L'activer part d'une " +
				"page blanche : les tâches n'affichent que les champs que vous ajoutez.",
			fields: "Champs affichés sur une tâche",
			fieldsDesc:
				"Les champs affichés par toutes les cartes Tâches. Une carte peut définir les siens " +
				"depuis ses propres paramètres.",
		},
		fileIcons: {
			heading: "Icônes de fichiers / Iconic / Iconize",
			headingDesc:
				"Utiliser les icônes par fichier définies avec les plugins Iconic ou Iconize " +
				"partout où Hearth affiche un fichier — Récents, Favoris, recherches " +
				"enregistrées et barre de recherche. Les icônes Lucide et les emojis sont affichés ; " +
				"les fichiers utilisant une icône d'un pack téléchargé gardent l'icône " +
				"de type de fichier de Hearth.",
			enable: "Utiliser les icônes d'Iconic / Iconize",
			enableDesc:
				"Désactivé : l'icône de type de fichier de Hearth pour tous les fichiers, en ignorant les deux plugins.",
			enableDescNoPlugin:
				"Ni Iconic ni Iconize n'est activé pour l'instant, donc tous les fichiers " +
				"affichent l'icône de type de Hearth. Vous pouvez laisser activé — cela prendra effet " +
				"dès que l'un d'eux sera installé.",
			property: "Propriété de frontmatter d'Iconize",
			propertyDesc:
				"La propriété où Iconize stocke l'icône d'une note, pour les icônes définies via " +
				"le frontmatter plutôt que son menu. Faites-la correspondre au paramètre d'Iconize " +
				"si vous l'avez renommée (par défaut « icon »).",
		},
		frontMatterTitle: {
			heading: "Front Matter Title",
			headingDesc:
				"Affiche les notes comme l'explorateur de fichiers lorsque le plugin " +
				"Front Matter Title leur donne un titre : les cartes Dossier et le " +
				"navigateur de dossiers listent chaque note sous ce titre plutôt que " +
				"sous son nom de fichier. Suit le réglage d'explorateur du plugin — " +
				"tant que sa fonction explorateur est désactivée, les noms de fichier " +
				"sont affichés.",
			enable: "Utiliser les titres de Front Matter Title",
			enableDesc: "Désactivé, chaque note est listée par son nom de fichier, sans tenir compte du plugin.",
			enableDescNoPlugin:
				"Front Matter Title n'est pas activé pour le moment, les notes sont " +
				"donc listées par leur nom de fichier. Vous pouvez laisser ce réglage " +
				"activé : il prendra effet dès que le plugin sera installé.",
		},
		operon: {
			heading: "Operon",
			headingDesc:
				"Lire les tâches, tableaux, agendas et le minuteur en cours depuis le plugin " +
				"Operon via sa propre API développeur — Operon reste la source de " +
				"vérité sur ce qu'est une tâche, Hearth n'affiche que ce qu'il renvoie.",
			enable: "Se connecter à Operon",
			enableDesc:
				"Désactivé = coupure totale : les cartes Operon ne lisent plus et Hearth ne " +
				"demande jamais l'accès à Operon. Rien n'est demandé tant qu'aucune carte Operon " +
				"n'est sur un tableau.",
			status: "Connexion",
			statusAbsent: "Operon n'est pas installé ou activé.",
			statusUnsupported:
				"L'API développeur d'Operon est réservée à l'ordinateur et nécessite Obsidian 1.12.2 ou plus récent.",
			statusBooting: "Operon fonctionne mais démarre encore.",
			statusPending:
				"En attente d'approbation. Ouvrez Paramètres → Operon → Core → General → " +
				"Developer API Integrations et approuvez Hearth.",
			statusSuspended:
				"Accès suspendu. Vérifiez la demande d'accès en attente de Hearth dans les " +
				"Developer API Integrations d'Operon.",
			statusRevoked:
				"Accès révoqué. Accordez-le à nouveau dans les Developer API Integrations d'Operon.",
			statusReady: "Connecté — les cartes Operon peuvent lire les tâches.",
			statusIdle: "Pas encore connecté. Ajoutez une carte Operon pour ouvrir une session.",
			statusOff: "L'intégration est désactivée, Hearth ne lit donc rien depuis Operon.",
			statusError: "Operon a refusé la connexion.",
			detail: "Operon a indiqué",
			install: "Ouvrir Operon dans les modules complémentaires",
			writes: "Autoriser les modifications",
			writesDesc:
				"Permet à la carte Kanban de changer le statut d'une tâche par glisser-déposer, et " +
				"ajoute un « + » pour en créer une. Operon décide où va une nouvelle tâche et " +
				"si un déplacement est autorisé ; Hearth ne fait que demander. L'activer élargit ce que " +
				"Hearth demande, vous devrez donc l'approuver à nouveau dans les " +
				"Developer API Integrations d'Operon. Désactivé = Hearth ne peut que lire.",
			writesPending:
				"La lecture fonctionne, mais les droits de modification ne sont pas encore accordés — " +
				"approuvez à nouveau Hearth dans les Developer API Integrations d'Operon. D'ici là, " +
				"les cartes restent en lecture seule.",
			capabilities: "Accès demandés",
			capabilitiesDesc:
				"Hearth demande tout en même temps car Operon n'ouvre pas une " +
				"session partiellement approuvée. Lecture seule sauf si « Autoriser les modifications » est actif, ce qui " +
				"ajoute les droits de changement de statut et de création de tâches.",
			missing: (names: string) => `Pas encore accordé : ${names}`,
			recheck: "Revérifier",
			recheckDesc:
				"Rouvrir la connexion après avoir approuvé, révoqué ou rechargé Operon.",
			recheckAction: "Revérifier maintenant",
		},
		filters: {
			heading: "Filtres de recherche",
			headingDesc:
				"Les filtres sont détectés automatiquement d'après les types de fichiers de votre coffre. Masquez ceux dont vous ne voulez pas.",
		},
		dashboard: {
			heading: "Tableau de bord",
			headingDesc:
				"Taille et transparence de la grille de cartes. Les cartes elles-mêmes s'ajoutent et se configurent sur le tableau.",
			fitToPage: "Ajuster à la page",
			fitToPageDesc:
				"Faire tenir le tableau sur un seul écran au lieu d'autoriser le défilement.",
			compact: "Espacement compact",
			compactDesc:
				"Réduire les marges internes des cartes et la marge du haut pour agrandir la zone utile.",
			arrangeButtonVisibility: "Visibilité du bouton Organiser",
			arrangeButtonVisibilityDesc:
				"Le bouton organiser/modifier est-il toujours visible ou révélé au survol de sa zone.",
			dashboardSwitcherVisibility: "Visibilité du sélecteur de tableaux",
			dashboardSwitcherVisibilityDesc:
				"Les boutons de tableaux en haut à gauche sont-ils toujours visibles ou révélés au survol de leur zone.",
			visibilityOptions: {
				always: "Toujours visible",
				hover: "Au survol",
			},
			cardOpacity: "Opacité des cartes",
			cardOpacityDesc:
				"Fonds de cartes transparents pour laisser voir l'arrière-plan du tableau.",
			cardBlur: "Flou des cartes",
			cardBlurDesc:
				"Flou verre givré derrière les cartes translucides. Nécessite une opacité inférieure à 100 %. 0 = désactivé.",
			cardRadius: "Arrondi des coins des cartes",
			cardRadiusDesc:
				"L'arrondi des coins des cartes, en pixels. 14 par défaut ; plus bas = coins plus nets.",
			cardBorderWidth: "Bordure des cartes",
			cardBorderWidthDesc:
				"Épaisseur de la bordure des cartes et du séparateur d'en-tête, en pixels. 0 masque la bordure.",
			cardSurfaceExpressive:
				"Les cartes Expressives reposent sur une surface tonale opaque aux grands coins arrondis : opacité, flou, arrondi et bordure ne s'appliquent donc qu'aux cartes Classiques.",
			cardDesign: "Design",
			cardDesignDesc:
				"Comment Hearth est dessiné : Classique, ou Material 3 Expressive — conteneurs tonals dans votre couleur d'accent, pastilles et formes douces, typographie plus marquée. Expressive s'applique à toute l'interface de Hearth : les cartes, les boutons du tableau, chaque dialogue et menu, et ce panneau de paramètres. Un tableau ou une carte peut toujours choisir pour lui-même ; les cartes dont le contenu vous appartient (notes, intégrations, pages web) gardent ce contenu tel quel et ne prennent que le cadre Expressive.",
			designClassicDesc: "Surfaces discrètes et bordures fines — Hearth tel qu'il a toujours été.",
			designExpressiveDesc: "Material 3 Expressive partout : couleurs tonales issues de votre accent, pastilles et formes douces, typographie grasse.",
			designInUse: "Utilisé",
			cards: "Cartes",
			cardsDesc:
				"Ajoutez et configurez les cartes sur le tableau lui-même : ouvrez la vue d'accueil, " +
				"cliquez sur Organiser, puis utilisez Ajouter une carte, Paramètres du tableau et le bouton " +
				"de paramètres de chaque carte.",
		},
		layout: {
			heading: "Import / export",
			headingDesc:
				"Partager un tableau de bord, ou sauvegarder toute votre configuration, en fichier JSON.",
			exportDashboard: "Exporter ce tableau de bord",
			exportDashboardDesc:
				"Enregistrer le tableau actuel dans un fichier que d'autres peuvent importer. Toute son apparence l'accompagne, et vous pouvez choisir d'inclure ou non son fond d'écran.",
			exportDashboardButton: "Exporter le tableau…",
			importAny: "Importer",
			importAnyDesc:
				"Ouvrir un fichier Hearth — un tableau de bord, une disposition ou une sauvegarde complète. Son contenu vous est présenté avant tout changement, et un tableau seul est ajouté à côté des vôtres sans rien remplacer.",
			export: "Exporter la disposition",
			exportDesc:
				"Télécharger tous les tableaux de bord ainsi que les paramètres de grille et de disposition en fichier JSON.",
			exportButton: "Exporter le fichier",
			exportMobileTooltip:
				"Sur mobile, le fichier est enregistré à la racine de votre coffre.",
			importButton: "Importer un fichier",
			exportSettings: "Exporter les paramètres",
			exportSettingsDesc:
				"Télécharger tous les paramètres de Hearth — la disposition complète plus l'en-tête, l'arrière-plan, " +
				"le comportement, l'apparence et les options TaskNotes — en fichier de sauvegarde JSON.",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		title: "Paramètres de la carte",
		iconHelp:
			"Saisissez un id d'icône Lucide (ex. « home », « star », « calendar ») — parcourez-les sur " +
			"lucide.dev/icons. Vous pouvez aussi saisir le chemin d'une image du coffre (ex. " +
			"Pièces jointes/icone.png) pour utiliser votre propre image comme icône.",
		tabs: {
			content: "Contenu",
			style: "Style",
			layout: "Disposition",
		},
		type: "Type",
		typeDesc: "Ce que cette carte affiche.",
		cardTitle: "Titre",
		cardTitleDesc:
			"Affiché dans l'en-tête de la carte. Laissez vide pour une carte sans en-tête.",
		cardTitlePlaceholder: "Titre",
		mobile: {
			heading: "Sur un tableau étroit",
			hidden: "Masquer",
			hiddenDesc:
				"Exclure cette carte quand le tableau s'empile en une colonne. Pour les cartes qui ont besoin de largeur — un grand tableau, une vue en colonnes — mieux vaut masquer que compresser.",
			collapsed: "Replié au départ",
			collapsedDesc:
				"N'afficher que la ligne de titre de la carte, et la construire quand on la touche. Une carte que personne n'ouvre ne coûte qu'une ligne et n'exécute rien.",
			height: "Hauteur",
			heightDesc:
				"Hauteur en pixels une fois empilée. Si vide, la carte garde sa propre hauteur, plafonnée pour qu'une carte haute ne remplisse pas l'écran à elle seule.",
			order: "Position",
			orderDesc:
				"La place de cette carte dans la pile, en comptant depuis 0. Si vide, elle suit l'ordre de lecture du tableau — de haut en bas, de gauche à droite.",
			autoPlaceholder: "Auto",
		},
		resetSize: "Rétablir la taille par défaut",
		removeCard: "Retirer la carte",
		removeCardTitle: "Retirer la carte ?",
		removeCardMessage: (name: string) => `Retirer « ${name} » du tableau de bord ?`,
		removeCardConfirm: "Retirer",
		thisCard: "cette carte",
		done: "Terminé",
		kinds: {
			embed: "Intégration (note / image / base)",
			slideshow: "Diaporama",
			daily: "Note quotidienne (aujourd'hui)",
			periodic: "Note périodique / journal",
			web: "Page web (iframe)",
			bookmarks: "Signets",
			favorites: "Favoris",
			text: "Texte / pense-bête",
			recent: "Fichiers récents",
			folder: "Contenu d'un dossier",
			links: "Liens / lanceur",
			templater: "Nouvelle note depuis un modèle",
			clock: "Horloge et accueil",
			tasks: "Tâches",
			calendar: "Mini-calendrier",
			schedule: "Calendrier",
			stats: "Statistiques du coffre",
			search: "Requête",
			searchbar: "Barre de recherche",
			heatmap: "Carte d'activité",
			calculator: "Calculatrice",
			dataview: "Requête Dataview",
			datacore: "Requête Datacore",
			rss: "Flux RSS",
			jira: "Filtre Jira",
			weather: "Météo",
			market: "Marchés",
			tension: "Tension mondiale",
			git: "Git",
			operon: "Operon",
			leaf: "Vue de plugin (bêta)",
			pet: "Compagnon",
			vaultpet: "Vault Pet",
		},
		linkTypes: {
			note: "Note",
			url: "URL",
			command: "Commande",
		},
		embed: {
			file: "Fichier à intégrer",
			fileDesc: "Une note, une image, un canvas ou un fichier .base de votre coffre.",
			filePlaceholder: "Chemin du fichier à intégrer",
			pickFile: "Choisir un fichier",
			baseView: "Vue de la base",
			baseViewDesc: "Choisir une vue de ce fichier .base, ou utiliser la vue par défaut.",
			baseViewDefault: "Vue par défaut",
			baseViewFileMissing: "Le fichier .base sélectionné est introuvable.",
			baseViewLoadError: "Impossible de lire les vues du fichier .base. La vue par défaut sera utilisée.",
			baseViewNoViews: "Aucune vue nommée trouvée dans ce fichier .base. La vue par défaut sera utilisée.",
			baseViewUnsupported: (count: number) =>
				`${count} vue${count <= 1 ? "" : "s"} contenant des caractères de lien wiki non pris en charge ${count <= 1 ? "a été masquée" : "ont été masquées"}.`,
			zoom: "Zoom",
			zoomDesc:
				"Mettre à l'échelle le contenu intégré. S'applique à la fermeture de ce dialogue.",
			zoomImageDesc:
				"Agrandir l'image dans le cadre où elle a été ajustée — zoomer une " +
				"image recadrée la recadre davantage. S'applique à la fermeture de ce dialogue.",
			imageFit: "Ajustement de l'image",
			imageFitDesc:
				"Comment l'image remplit la carte. Tous les modes sauf le premier lui donnent " +
				"toute la carte, bord à bord.",
			imageFits: {
				natural: "Taille d'origine",
				contain: "Image entière",
				cover: "Remplir la carte (recadrer)",
				stretch: "Étirer à la carte",
				width: "Ajuster la largeur (défilement)",
			},
			imagePosition: "Position de l'image",
			imagePositionDesc: "Où se place l'image dans la carte.",
			imagePositionCropDesc: "Quelle partie de l'image le recadrage conserve.",
			imagePositions: {
				"top-left": "En haut à gauche",
				top: "En haut",
				"top-right": "En haut à droite",
				left: "À gauche",
				center: "Au centre",
				right: "À droite",
				"bottom-left": "En bas à gauche",
				bottom: "En bas",
				"bottom-right": "En bas à droite",
			},
			editable: "Modifiable",
			editableDesc:
				"Modifier le texte de la note intégrée sur place (notes Markdown uniquement).",
			livePreview: "Aperçu en direct",
			livePreviewDesc:
				"Modifier dans l'éditeur Aperçu en direct d'Obsidian au lieu de la simple " +
				"zone Markdown brute, pour voir la mise en forme pendant la saisie. Désactivé : " +
				"source Markdown brute, modifiable par double-clic.",
			hideBaseHeader: "Masquer l'en-tête de la base",
			hideBaseHeaderDesc:
				"Pour les fichiers .base intégrés, masquer la barre d'outils de la vue Bases (sélecteur de vue et contrôles de filtres/propriétés) pour n'afficher que les résultats.",
			secondViewHeading: "Seconde vue",
			secondViewFile: "Second fichier à intégrer",
			secondViewFileDesc:
				"Facultatif. S'il est défini, la carte affiche un sélecteur entre les deux vues — dans l'en-tête si la carte a un titre, ou flottant (au survol) sinon.",
			secondViewClear: "Retirer la seconde vue",
			openButton: "Bouton Ouvrir",
			openButtonDesc:
				"Afficher un bouton qui ouvre le fichier intégré dans son propre onglet. Désactivé par défaut.",
		},
		slideshow: {
			source: "Images depuis",
			sourceDesc:
				"Une liste choisie image par image, ou toutes les images d'un dossier.",
			sourceList: "Une liste d'images",
			sourceFolder: "Un dossier",
			picturesHeading: "Images",
			picturesEmpty: "Pas encore d'image — ajoutez-en une ci-dessous.",
			picturePlaceholder: "Chemin de l'image",
			captionPlaceholder: "Légende (facultatif)",
			pickPicture: "Choisir une image",
			addPicture: "Ajouter une image",
			addFolderPictures: "Ajouter les images d'un dossier",
			removePicture: "Retirer l'image",
			moveUp: "Monter",
			moveDown: "Descendre",
			folder: "Dossier",
			folderDesc: "Toutes les images de ce dossier sont affichées. Laissez vide pour la racine du coffre.",
			folderPlaceholder: "Pièces jointes/Photos",
			pickFolder: "Choisir un dossier",
			includeSubfolders: "Inclure les sous-dossiers",
			includeSubfoldersDesc: "Afficher aussi les images des sous-dossiers.",
			folderCount: (count: number) =>
				count <= 1 ? `${count} image trouvée ici pour l'instant.` : `${count} images trouvées ici pour l'instant.`,
			playbackHeading: "Lecture",
			order: "Ordre",
			orderDesc: "L'ordre d'affichage des images.",
			orders: {
				manual: "Ordre de la liste",
				name: "Nom (A → Z)",
				nameDesc: "Nom (Z → A)",
				created: "Date de création (plus ancienne d'abord)",
				createdDesc: "Date de création (plus récente d'abord)",
				modified: "Date de modification (plus ancienne d'abord)",
				modifiedDesc: "Date de modification (plus récente d'abord)",
				random: "Aléatoire",
			},
			advance: "Changer d'image",
			advanceDesc:
				"Ce qui fait avancer la carte : un minuteur, le calendrier, ou uniquement les " +
				"contrôles. Une carte quotidienne déduit son image de la date du jour, elle " +
				"reste donc la même toute la journée, quel que soit le nombre de rafraîchissements — et elle comme " +
				"une carte manuelle se souviennent de là où elles en étaient.",
			advances: {
				timer: "Avec un minuteur",
				daily: "Une fois par jour",
				manual: "Uniquement à la main",
			},
			interval: "Secondes par image",
			intervalDesc:
				"Durée d'affichage de chaque image. 0 garde la première image et désactive la " +
				"rotation ; le mode économie d'énergie la met aussi en pause.",
			intervalAria: "Secondes d'affichage de chaque image",
			days: "Jours par image",
			daysDesc:
				"Combien de jours chaque image est gardée avant la suivante. " +
				"1 change à minuit ; 7 donne une image de la semaine.",
			daysAria: "Jours d'affichage de chaque image",
			transition: "Transition",
			transitionDesc: "Comment une image cède la place à la suivante.",
			transitions: {
				none: "Coupe (sans animation)",
				fade: "Fondu enchaîné",
				slide: "Glissement",
				zoom: "Zoom",
			},
			transitionSpeed: "Durée de la transition",
			transitionSpeedDesc: "Durée de la transition, en millisecondes.",
			kenBurns: "Zoom lent",
			kenBurnsDesc:
				"Avancer lentement dans chaque image pendant son affichage (effet « Ken Burns »).",
			displayHeading: "Affichage",
			fit: "Ajustement",
			fitDesc: "Comment chaque image remplit la carte.",
			fits: {
				cover: "Remplir la carte (recadrer)",
				contain: "Image entière",
			},
			controls: "Contrôles",
			controlsDesc:
				"Afficher les boutons précédent / pause / suivant et la position, au survol. Activé par défaut.",
			caption: "Légende",
			captionDesc:
				"Afficher la légende de chaque image par-dessus, ou à défaut son nom de fichier.",
			pauseOnHover: "Pause au survol",
			pauseOnHoverDesc: "Garder l'image actuelle tant que le pointeur est sur la carte.",
			openButton: "Bouton Ouvrir",
			openButtonDesc:
				"Afficher un bouton qui ouvre l'image affichée dans son propre onglet. Désactivé par défaut.",
		},
		daily: {
			editable: "Modifiable",
			editableDesc:
				"Modifier la note du jour sur place au lieu de la lecture seule. Enregistre dans le coffre.",
			openButton: "Bouton Ouvrir",
			openButtonDesc: "Afficher un bouton pour ouvrir la note du jour dans l'éditeur.",
			info: "Notes quotidiennes",
			infoDesc:
				"La note du jour est trouvée d'après le format de date et le dossier du module principal Notes quotidiennes. La carte se met à jour en direct pendant l'édition.",
		},
		periodic: {
			source: "Source",
			sourceDesc: "Le plugin d'où cette carte tire sa note.",
			sources: {
				periodicNotes: "Periodic Notes",
				journals: "Journals",
			},
			journal: "Journal",
			journalDesc:
				"Le journal suivi par cette carte. Elle affiche toujours sa note " +
				"actuelle, donc la carte avance d'elle-même à la fin de la période.",
			chooseJournal: "Choisir un journal",
			noJournals: "Pas encore de journal",
			granularity: "Période",
			granularityDesc:
				"La note périodique affichée par cette carte. C'est toujours l'actuelle, donc " +
				"la carte avance d'elle-même à la fin de la période.",
			granularities: {
				day: "Quotidienne",
				week: "Hebdomadaire",
				month: "Mensuelle",
				quarter: "Trimestrielle",
				year: "Annuelle",
			},
			editable: "Modifiable",
			editableDesc:
				"Modifier la note sur place au lieu de la lecture seule. Enregistre dans le coffre.",
			openButton: "Bouton Ouvrir",
			openButtonDesc: "Afficher un bouton pour ouvrir la note dans l'éditeur.",
			info: "Periodic Notes",
			infoDesc:
				"La note est trouvée d'après le dossier, le format de date et le modèle " +
				"du plugin Periodic Notes, et si elle manque, elle est créée par Periodic Notes " +
				"lui-même. La carte se met à jour en direct pendant l'édition.",
			missingDesc:
				"Cette carte nécessite le module complémentaire Periodic Notes. Installez-le et activez-" +
				"le, puis activez le type de note souhaité ici.",
			journalsInfo: "Journals",
			journalsInfoDesc:
				"La note est trouvée d'après le dossier, le modèle de nom et le modèle de note " +
				"du journal, et si elle manque, elle est créée par Journals lui-même — " +
				"questions comprises. La carte se met à jour en direct pendant l'édition.",
			journalsMissingDesc:
				"Cette carte nécessite le module complémentaire Journals. Installez-le et activez-le, " +
				"puis créez un journal à suivre ici.",
		},
		web: {
			url: "URL",
			urlPlaceholder: "https://example.com",
			trusted: "Site de confiance",
			trustedDesc:
				"Autoriser la page à accéder à sa propre origine (cookies, stockage). N'activez " +
				"que pour des sites de confiance — cela assouplit le bac à sable de l'iframe.",
			autoRefresh: "Actualisation automatique",
			autoRefreshDesc:
				"Réafficher cette carte toutes les N secondes pour récupérer les changements. 0 = désactivé.",
			refreshIntervalAria: "Intervalle d'actualisation en secondes",
		},
		recent: {
			display: "Affichage",
			displayDesc: "Une liste compacte de lignes, ou une grille de tuiles avec l'icône au-dessus du nom.",
			displayList: "Liste",
			displayTiles: "Tuiles",
			fit: "Ajuster à la hauteur de la carte",
			fitDesc:
				"Lister autant de fichiers que la hauteur de la carte le permet, au lieu d'un " +
				"nombre fixe. Redimensionner la carte change le nombre affiché.",
			count: "Nombre de fichiers",
			countDesc: (max: number) =>
				`Combien de fichiers récemment ouverts lister — au maximum ${max}, soit ` +
				`toute l'étendue de l'historique récent de Hearth.`,
			types: "Types de fichiers",
			typesDesc: "Ne lister que les fichiers des types sélectionnés. Toute combinaison est possible ; aucune sélection = tous les types.",
		},
		folder: {
			folder: "Dossier",
			folderDesc: "Le dossier listé par cette carte. Laissez vide pour la racine du coffre.",
			folderPlaceholder: "Projets/2026",
			pickFolder: "Choisir un dossier",
			sort: "Ordre",
			sortDesc:
				"L'ordre du contenu. Avec les ordres propres à Hearth, les dossiers viennent en premier " +
				"et sont triés par nom, comme dans l'explorateur de fichiers.",
			sorts: {
				explorer: "Comme l'explorateur de fichiers",
				name: "Nom (A–Z)",
				nameDesc: "Nom (Z–A)",
				modified: "Modifié (plus récent d'abord)",
				modifiedAsc: "Modifié (plus ancien d'abord)",
				created: "Créé (plus récent d'abord)",
				createdAsc: "Créé (plus ancien d'abord)",
			},
			show: "Afficher",
			showDesc: "Quel contenu du dossier la carte liste.",
			showAll: "Dossiers et fichiers",
			showFolders: "Dossiers uniquement",
			showFiles: "Fichiers uniquement",
			display: "Affichage",
			displayDesc: "Une liste de lignes, ou une grille de tuiles avec icônes.",
			displayList: "Liste",
			displayTiles: "Tuiles",
			count: "Nombre d'éléments",
			countDesc:
				"Combien d'éléments la carte liste avant d'indiquer combien il en reste. Le navigateur " +
				"qu'elle ouvre n'est jamais limité.",
			counts: "Nombre d'éléments",
			countsDesc: "Afficher combien d'éléments contient chaque sous-dossier.",
			navigate: "Ouverture d'un sous-dossier",
			navigateDesc:
				"Dans un dialogue, ou dans la carte elle-même — qui affiche alors une ligne de chemin " +
				"avec un retour vers le haut, et reste là où vous l'avez laissée.",
			navigateModal: "Dans le navigateur de dossiers",
			navigateCard: "Dans la carte",
			browse: "Ouvrir le navigateur depuis la carte",
			browseDesc:
				"Cliquer sur l'espace vide de la carte — ou sur son bouton dossier — ouvre le " +
				"dossier dans un navigateur avec fil d'Ariane, où l'on peut entrer dans " +
				"chaque dossier.",
			browseIn: "Ouvrir le navigateur",
			browseInDesc:
				"Dans une fenêtre au-dessus du tableau — avec un bouton qui la déplace " +
				"dans un onglet — ou directement dans un onglet à part, où le dossier " +
				"dispose de toute la page.",
			browseInModal: "Dans une fenêtre",
			browseInTab: "Dans un nouvel onglet",
			browserView: "Disposition du navigateur",
			browserViewDesc:
				"Comment le navigateur affiche le dossier, indépendamment de la carte : " +
				"une liste de lignes, ou de plus grandes tuiles avec un aperçu de chaque note.",
			preview: "Aperçu des notes",
			previewDesc: "Affiche les premières lignes du texte de chaque note sur sa tuile, sans ses propriétés.",
			previewSize: "Taille du texte de l'aperçu",
			previewSizeDesc: "En pixels. Petite par défaut — assez pour reconnaître une note.",
			images: "Aperçu des images",
			imagesDesc:
				"Les images s'affichent sur leur tuile, et une note montre sa première " +
				"image intégrée en couverture. Uniquement au niveau de performance " +
				"« Complet » : une image, c'est le fichier entier décodé, ce que les " +
				"niveaux plus légers sont là pour éviter.",
		},
		calendar: {
			view: "Disposition",
			viewDesc: "Mois affiche une grille ; agenda liste les jours à venir.",
			viewMonth: "Grille mensuelle",
			viewAgenda: "Agenda",
			agendaDays: "Jours à venir",
			agendaDaysDesc: "Combien de jours l'agenda liste, à partir d'aujourd'hui.",
			weekNumbers: "Numéros de semaine",
			weekNumbersDesc: "Afficher une colonne de numéros de semaine ISO à gauche.",
			heatmap: "Carte d'activité",
			heatmapDesc: "Teinter chaque jour selon l'activité des notes ce jour-là.",
			heatmapCounts: "Décompte de l'activité",
			externalCalendars: "Calendriers externes",
			externalCalendarsDesc:
				"S'abonner à des flux ICS/iCal (Google, iCloud, Fastmail, Nextcloud…). Les événements apparaissent en points colorés sur la grille et sont listés dans la vue agenda.",
			operonTasks: "Afficher les tâches Operon",
			operonTasksDesc:
				"Marquer les jours ayant une tâche Operon à échéance, et lister ces tâches dans " +
				"l'agenda. Lit via l'API développeur d'Operon, il faut donc qu'Operon " +
				"soit approuvé dans Paramètres → Hearth → Intégrations. Les tâches seulement " +
				"planifiées (sans échéance) ne sont pas incluses.",
			operonTaskColor: "Couleur des tâches Operon",
			operonTaskColorDesc: "Couleur des marqueurs de tâches. Par défaut, la couleur d'accent.",
			sourceNamePlaceholder: "Nom",
			sourceUrlPlaceholder: "URL ICS/iCal (https:// ou webcal://)",
			sourceShow: "Afficher ce calendrier",
			sourceHide: "Masquer ce calendrier",
			sourceRemove: "Retirer le calendrier",
			addCalendar: "Ajouter un calendrier",
			refresh: "Actualiser toutes les",
			refreshDesc: "Fréquence de récupération des calendriers, en minutes. 0 = uniquement à l'ouverture.",
			eventNoteHeading: "Notes d'événement",
			eventNoteDesc:
				"La note que crée « Créer une note » dans la fenêtre d'événement. Elle fonctionne comme un modèle de l'Obsidian Web Clipper : un nom, un dossier, des propriétés typées et un contenu, chacun acceptant des {{variables}} et des filtres.",
			eventNoteEnabled: "Afficher « Créer une note »",
			eventNoteEnabledDesc: "Proposer un bouton de création de note dans les détails de l'événement.",
			chipsHeading: "Détails des entrées",
			chipsDesc:
				"Choisissez ce que chaque entrée de l'agenda affiche à côté de son titre. Désactivez ce dont vous n'avez pas besoin — sur une carte étroite, les marqueurs font concurrence au titre.",
			chipTime: "Heure",
			chipTimeDesc: "L'heure de début, ou « Toute la journée ».",
			chipSource: "Nom du calendrier",
			chipSourceDesc: "Le calendrier d'où vient une entrée. Affiché uniquement s'il y a plusieurs sources.",
			chipStatus: "Statut",
			chipStatusDesc: "Le statut TaskNotes d'une tâche, ex. « En cours ». Désactivé par défaut.",
			chipPriority: "Priorité",
			chipPriorityDesc: "La priorité TaskNotes d'une tâche, ex. « Haute ».",
			chipDue: "Marqueur d'échéance",
			chipDueDesc: "Le badge « Échéance » sur une entrée d'échéance.",
			chipRecurring: "Marqueur de récurrence",
			chipRecurringDesc: "Le badge « Récurrent » sur une tâche répétitive.",
			chipTimeblock: "Marqueur de bloc horaire",
			chipTimeblockDesc: "Le badge « Bloc horaire » sur un bloc horaire.",
			checkboxHeading: "Tâches à cocher",
			checkboxDesc:
				"Afficher les tâches Markdown à cocher (- [ ] …) sur le calendrier aux dates qui y sont écrites au format Tasks : 📅 échéance et ⏳ planifiée. Les tâches sans date ne sont pas affichées.",
			checkboxEnabled: "Utiliser les tâches à cocher",
			checkboxEnabledDesc: "Lire les tâches à cocher datées de vos notes.",
			checkboxScheduled: "Date planifiée",
			checkboxScheduledDesc: "Afficher une tâche à sa date planifiée ⏳.",
			checkboxDue: "Date d'échéance",
			checkboxDueDesc: "Afficher une tâche à sa date d'échéance 📅.",
			checkboxCompletedDesc: "Garder les tâches cochées sur le calendrier, barrées.",
			checkboxCompleteDesc: "Afficher une case sur chaque tâche pour la cocher dans sa note.",
			checkboxFolders: "Dossiers",
			checkboxFoldersDesc: "Ne lire que les notes de ces dossiers (séparés par des virgules). Vide = tout le coffre.",
			checkboxColor: "Couleur",
			checkboxColorDesc: "Couleur des entrées de tâches à cocher.",
			taskNotesHeading: "TaskNotes",
			taskNotesDesc:
				"Utiliser TaskNotes comme source d'événements. La carte reflète ce qu'affiche le calendrier de TaskNotes — tâches planifiées, échéances, occurrences récurrentes, blocs horaires et calendriers abonnés dans TaskNotes — avec les noms de champs, statuts et couleurs de TaskNotes.",
			taskNotesMissing:
				"TaskNotes n'est pas activé dans ce coffre. Installez-le et activez-le pour l'utiliser comme source de calendrier.",
			taskNotesEnabled: "Utiliser TaskNotes",
			taskNotesEnabledDesc: "Afficher les éléments TaskNotes sur ce calendrier.",
			taskNotesScheduled: "Tâches planifiées",
			taskNotesScheduledDesc:
				"Les tâches à leur date planifiée, dimensionnées selon leur durée estimée.",
			taskNotesDue: "Échéances",
			taskNotesDueDesc: "Les tâches à leur date d'échéance.",
			taskNotesRecurring: "Tâches récurrentes",
			taskNotesRecurringDesc:
				"Déployer une tâche récurrente en une entrée par occurrence. Désactivé : seule la prochaine date est affichée.",
			taskNotesTimeblocks: "Blocs horaires",
			taskNotesTimeblocksDesc: "Les blocs horaires écrits dans vos notes quotidiennes.",
			taskNotesFollows: (on: boolean) =>
				`TaskNotes a actuellement ce paramètre ${on ? "activé" : "désactivé"}.`,
			taskNotesFollowReset: "Suivre TaskNotes",
			taskNotesCompleted: "Afficher les terminées",
			taskNotesCompletedDesc: "Garder les tâches terminées sur le calendrier, barrées.",
			taskNotesArchived: "Afficher les archivées",
			taskNotesArchivedDesc: "Inclure les tâches portant le tag d'archive de TaskNotes.",
			taskNotesComplete: "Terminer depuis le calendrier",
			taskNotesCompleteDesc:
				"Proposer une case à cocher sur chaque tâche, qui écrit exactement ce qu'écrit TaskNotes (par occurrence pour les tâches récurrentes).",
			taskNotesSubscriptions: "Calendriers TaskNotes",
			taskNotesSubscriptionsDesc: (count: number) =>
				`Afficher aussi ${count <= 1 ? `le calendrier abonné` : `les ${count} calendriers abonnés`} dans TaskNotes.`,
			taskNotesSubscriptionsNone: "TaskNotes n'a aucun abonnement de calendrier à afficher.",
			taskNotesSubLoaded: (count: number) =>
				`${count} événement${count <= 1 ? "" : "s"} chargé${count <= 1 ? "" : "s"}.`,
			taskNotesSubPending: "Pas encore chargé — actualisez ci-dessous.",
			taskNotesSubDisabled: "Désactivé dans TaskNotes.",
			taskNotesSubBlocked: "Non récupéré : les appels externes sont désactivés dans les paramètres de Hearth.",
			taskNotesSubFailed: (reason: string) => `Chargement impossible : ${reason}`,
			taskNotesSubNotCalendar: "la réponse n'était pas un flux iCalendar.",
			taskNotesSubMissingFile: "ce fichier n'est pas dans le coffre.",
			taskNotesSubRefresh: "Actualiser les calendriers",
			taskNotesColorBy: "Couleur selon",
			taskNotesColorByDesc: "D'où vient la couleur de chaque tâche.",
			taskNotesColorStatus: "Statut TaskNotes",
			taskNotesColorPriority: "Priorité TaskNotes",
			taskNotesColorFixed: "Une couleur fixe",
			taskNotesColor: "Couleur des tâches",
			taskNotesColorDesc: "Utilisée pour la couleur fixe, et quand TaskNotes n'en définit aucune.",
			taskNotesDueColor: "Couleur des échéances",
			taskNotesDueColorDesc: "Couleur distincte facultative pour les entrées d'échéance.",
			taskNotesTimeblockColor: "Couleur des blocs horaires",
			taskNotesTimeblockColorDesc: "Utilisée pour les blocs horaires sans couleur propre.",
		},
		schedule: {
			view: "S'ouvre en",
			viewDesc:
				"La vue affichée par la carte à l'ouverture du tableau. Vous pouvez changer de vue sur la carte à tout moment.",
			views: "Vues proposées",
			viewsDesc:
				"Les vues listées par le sélecteur de la carte. Laissez les quatre actives pour les avoir toutes à portée de clic ; une seule vue masque complètement le sélecteur.",
			toolbar: "Barre d'outils",
			toolbarDesc:
				"Afficher la ligne de navigation : précédent, aujourd'hui, suivant, la période affichée et le sélecteur de vue. Désactivé : la carte reste sur la période actuelle.",
			dailyNotes: "Notes quotidiennes",
			dailyNotesDesc:
				"Marquer les jours qui ont déjà une note quotidienne, et l'ouvrir (ou proposer de la créer) au clic sur un jour. Désactivé : simple calendrier d'événements.",
			weekHeading: "La semaine",
			firstDay: "La semaine commence le",
			firstDayDesc: "Le premier jour des grilles mois et semaine.",
			firstDayLocale: (day: string) => `Suivre la langue d'Obsidian (${day})`,
			hideWeekends: "Masquer les week-ends",
			hideWeekendsDesc: "Exclure samedi et dimanche des grilles mois et semaine.",
			weekNumbers: "Numéros de semaine",
			weekNumbersDesc: "Afficher une colonne de numéros de semaine à gauche.",
			clock: "Horloge",
			clockDesc: "Format d'écriture des heures des événements.",
			clockLocale: "Suivre la langue d'Obsidian",
			clock12: "12 heures (9:00 AM)",
			clock24: "24 heures (09:00)",
			monthHeading: "Vue mois",
			monthStyle: "Événements affichés en",
			monthStyleDesc:
				"Des pastilles nommées se lisent d'un coup d'œil sur une carte spacieuse ; des points conviennent à une petite carte, comme dans le mini-calendrier.",
			monthStyleChips: "Pastilles nommées",
			monthStyleDots: "Points",
			maxPerDay: "Événements par jour",
			maxPerDayDesc:
				"Combien d'événements une case de jour liste avant de replier le reste dans un lien « +N de plus ». 0 les liste tous et laisse la case défiler.",
			gridHeading: "Vues semaine et jour",
			gridDesc:
				"La grille horaire affiche toute la journée par défaut, et s'ouvre sur le premier événement — rien ne peut donc être hors des heures visibles. Réduisez la plage horaire si vous préférez ne voir qu'une partie de la journée.",
			hours: "Heures affichées",
			hoursDesc:
				"La première et la dernière heure de la grille. Ce qui est en dehors passe dans la bande « toute la journée » au-dessus au lieu de disparaître.",
			hoursMidnight: "Minuit",
			hourHeight: "Hauteur d'une heure",
			hourHeightDesc: "La hauteur d'une heure, en pixels. Plus haut = plus de détails ; plus bas = plus de la journée visible.",
			nowLine: "Ligne de l'heure actuelle",
			nowLineDesc: "Tracer une ligne sur la colonne du jour à l'heure actuelle.",
			listHeading: "Vue liste",
			listDays: "Jours listés",
			listDaysDesc: "Jusqu'où s'étend la liste, à partir du jour affiché.",
		},
		heatmap: {
			metric: "Mesure",
			weeks: "Semaines",
			weeksDesc: "Combien de semaines d'historique afficher.",
			advanced: "Avancé",
			advancedDesc:
				"Créez votre propre mesure : prenez le jour dans une date de frontmatter, additionnez un " +
				"nombre au lieu de compter les notes, et choisissez quelles notes comptent. " +
				"Désactivé : chaque note compte selon la date du fichier.",
			metricHeading: "Quoi compter",
			rangeHeading: "Période",
			source: "Le jour vient de",
			sourceDesc: "Quelle date détermine la case où tombe une note.",
			sourceOptions: {
				modified: "Date de modification",
				created: "Date de création",
				property: "Une date de frontmatter",
			},
			dateProperty: "Propriété de date",
			datePropertyDesc:
				"La clé de frontmatter contenant la date — date, due, published. Accepte une " +
				"date, une date et heure, ou un lien [[note quotidienne]] ; une liste compte une fois par " +
				"entrée. Les notes sans cette clé sont ignorées.",
			datePropertyPlaceholder: "date",
			value: "Chaque note ajoute",
			valueDesc: "Un par note, ou le nombre d'une propriété — minutes de lecture, pages écrites, kilomètres courus.",
			valueOptions: {
				count: "1 (compter les notes)",
				sum: "Un nombre issu d'une propriété",
			},
			valueProperty: "Propriété de valeur",
			valuePropertyDesc:
				"La clé de frontmatter contenant le nombre à ajouter. Les notes dont la valeur n'est pas un " +
				"nombre sont ignorées plutôt que comptées pour un.",
			valuePropertyPlaceholder: "minutes",
			unit: "Unité",
			unitDesc: "Le nom d'une unité quand un jour est décrit — « 5 séances ». Vide = suit la mesure.",
			unitPlaceholder: "notes modifiées",
			rules: "Quelles notes comptent",
			rulesDesc: "Conditions qu'une note doit remplir pour être comptée. Sans règle, toutes les notes comptent.",
			match: "Correspondance",
			matchOptions: {
				all: "Toutes les règles (ET)",
				any: "Au moins une règle (OU)",
			},
			fieldOptions: {
				property: "Propriété",
				tag: "Tag",
				folder: "Dossier",
				path: "Chemin",
			},
			opOptions: {
				is: "est",
				isNot: "n'est pas",
				contains: "contient",
				notContains: "ne contient pas",
				gt: "est supérieur à",
				lt: "est inférieur à",
				exists: "est défini",
				missing: "n'est pas défini",
			},
			keyPlaceholder: "propriété",
			valuePlaceholder: "valeur",
			addRule: "Ajouter une règle",
			removeRule: "Retirer la règle",
		},
		stats: {
			advanced: "Avancé",
			advancedDesc:
				"Choisir les statistiques à afficher, détailler les pièces jointes par type de fichier, et ajouter " +
				"des décomptes personnalisés. Désactivé : l'ensemble par défaut.",
			builtins: "Statistiques à afficher",
			builtinsDesc: "Choisissez les statistiques intégrées affichées. La série de jours n'apparaît que si les notes quotidiennes sont configurées.",
			attachmentTypes: "Détail des pièces jointes",
			attachmentTypesDesc: "Ajouter une tuile de décompte séparée pour chaque type de fichier sélectionné (images, PDF, …).",
			customCounts: "Décomptes personnalisés",
			customCountsDesc:
				"Chaque ligne compte les fichiers correspondant à une requête et affiche le total dans une tuile. " +
				"Même syntaxe que la barre de recherche : #tag, clé:valeur pour une propriété, ou texte simple.",
			labelPlaceholder: "Libellé",
			iconPlaceholder: "Icône",
			queryPlaceholder: "#projet ou status:active",
			addCount: "Ajouter un décompte",
			removeCount: "Retirer le décompte",
		},
		metricOptions: {
			modified: "Notes modifiées",
			created: "Notes créées",
		},
		savedSearch: {
			query: "Requête",
			queryDesc:
				"Même syntaxe que la barre de recherche : texte simple pour noms/contenus, #tag pour " +
				"les tags, ou clé:valeur pour une propriété de frontmatter.",
			queryPlaceholder: "#projet ou status:active ou notes de réunion",
			display: "Affichage",
			displayDesc: "Afficher les résultats en liste compacte ou en tuiles.",
			displayList: "Liste",
			displayTiles: "Tuiles",
			maxResults: "Résultats max",
			maxResultsDesc: "Le nombre maximal de résultats affichés à la fois.",
		},
		searchBar: {
			placeholder: "Texte indicatif",
			placeholderDesc:
				"Texte affiché dans le champ vide. Laissez vide pour utiliser celui de " +
				"Paramètres → Recherche.",
			filters: "Ligne de filtres",
			filtersDesc:
				"Afficher les filtres de type de fichier sous le champ, les mêmes que la barre de " +
				"recherche de l'en-tête. Ils nécessitent une carte plus haute.",
			filterTypes: "Filtres",
			filterTypesDesc:
				"Les filtres proposés par cette carte. Un filtre n'apparaît que si le coffre " +
				"contient réellement ce type de fichier.",
			filterTypeGlobalOff: "Masqué pour toutes les barres de recherche dans Paramètres → Filtres.",
			instantAnswers: "Réponses instantanées",
			instantAnswersDesc:
				"Désactiver les réponses pour cette barre de recherche. Les réponses désactivées sur le tableau ou pour tout le coffre le restent ici.",
			instantAnswerOff: "Désactivé sur ce tableau ou pour tout le coffre.",
			instantAnswersVaultOff: "Les réponses instantanées sont désactivées pour tout le coffre dans Paramètres → Recherche.",
			button: "Bouton",
			buttonDesc:
				"Un bouton d'action à côté du champ : créer une note, ou chercher sur le " +
				"web le texte saisi dans le champ.",
			buttonNone: "Aucun",
			buttonNewNote: "Nouvelle note",
			buttonSearchOnline: "Chercher en ligne",
			seamless: "Sans cadre",
			seamlessDesc:
				"Retirer le cadre de la carte — ni bordure, ni fond, ni ligne de titre — pour que " +
				"ce soit une barre de recherche autonome sur le tableau.",
			sizeNote:
				"Le champ est aussi épais que la carte est haute — tirez le bord de la carte en " +
				"mode Organiser pour rendre la barre plus épaisse ou plus fine.",
		},
		tiles: {
			heading: "Boutons",
			sizing: "Taille des boutons",
			sizingDesc:
				"Les boutons remplissent-ils la carte — tous visibles quelle que soit " +
				"la taille de la carte, grandissant et rétrécissant avec elle — ou gardent-ils une taille " +
				"fixe en pixels, une carte trop petite défilant alors. Les boutons qui remplissent cessent " +
				"de rétrécir quand ils deviendraient trop petits pour être utilisés, dans les deux sens, et une " +
				"carte trop petite pour eux à cette taille défile aussi. Les cartes créées avant " +
				"ce paramètre restent en taille fixe jusqu'à ce que vous les changiez ; " +
				"chaque style garde ses propres tailles, revenir en arrière restaure donc ce que vous " +
				"aviez.",
			sizingScale: "Remplir la carte",
			sizingFixed: "Taille fixe (ancien)",
			across: "Boutons en largeur",
			acrossDesc:
				"Combien de boutons de large fait la carte, et donc la largeur d'un bouton : une " +
				"fraction de la carte, jusqu'à la taille minimale d'un bouton. Leur " +
				"hauteur fonctionne pareil — les lignes se partagent la hauteur de la " +
				"carte — une carte plus basse donne donc des boutons plus bas plutôt " +
				"que des boutons masqués. Un bouton peut toujours faire deux ou trois cases de large " +
				"(ou de haut) en tirant son coin inférieur droit en mode Organiser — ou " +
				"une demi-case, car la grille avance par demi-pas dans les deux sens.",
			minSize: "Taille minimale des boutons",
			minSizeDesc:
				"La taille minimale d'un bouton entier, en pixels, avant que la carte ne défile " +
				"au lieu de les rétrécir encore — un bouton d'une demi-case s'arrête à " +
				"la moitié. Basse par défaut, pour que les boutons tiennent plutôt qu'une " +
				"barre de défilement n'apparaisse ; augmentez-la pour garder des boutons confortables sur une carte " +
				"souvent réduite, la carte défilera alors quand ils ne tiendront plus.",
		},
		links: {
			heading: "Liens",
			autoShift: "Décalage automatique des tuiles (bêta)",
			autoShiftDesc:
				"Activé : les tuiles s'écartent quand on en déplace une (comme les widgets " +
				"d'un téléphone). Désactivé par défaut — les tuiles sont libres et peuvent se chevaucher.",
			labelPlaceholder: "Libellé",
			iconPlaceholder: "Icône",
			pickCommand: "Choisir une commande…",
			targetUrl: "Cible (URL)",
			targetNote: "Cible (chemin de note)",
			moveUp: "Monter",
			moveDown: "Descendre",
			removeLink: "Retirer le lien",
			addLink: "Ajouter un lien",
			addCommand: "Ajouter une commande",
			buttonSize: "Taille des boutons",
			buttonSizeDesc:
				"Taille par défaut des tuiles. Redimensionnez une tuile en tirant son coin " +
				"inférieur droit en mode organisation.",
		},
		templater: {
			missing: "Templater n'est pas activé",
			missingDesc:
				"Cette carte crée des notes en appelant le plugin Templater — installez-le et " +
				"activez-le, et ces tuiles fonctionneront. Rien d'autre n'est à " +
				"changer ici en attendant.",
			autoShift: "Décalage automatique des tuiles (bêta)",
			autoShiftDesc:
				"Activé : les tuiles s'écartent quand on en déplace une (comme les widgets " +
				"d'un téléphone). Désactivé par défaut — les tuiles sont libres et peuvent se chevaucher.",
			buttonSize: "Taille des boutons",
			buttonSizeDesc:
				"Taille par défaut des tuiles. Redimensionnez une tuile en tirant son " +
				"coin inférieur droit.",
			heading: "Modèles",
			labelPlaceholder: "Libellé",
			pickTemplate: "Choisir un modèle…",
			pickTemplateTooltip: "Choisir le modèle Templater exécuté par cette tuile",
			pickFolderTooltip:
				"Choisir le dossier de la nouvelle note. La racine du coffre signifie « là où " +
				"Obsidian place les nouvelles notes ».",
			filenamePlaceholder: "Nom du fichier",
			filenameTooltip:
				"Nom de la nouvelle note, sans l'extension. {{date}}, {{date:FMT}}, " +
				"{{time}}, {{time:FMT}} et {{prompt}} sont remplacés. Laissez vide pour " +
				"laisser Templater la nommer.",
			openOn: "Ouvre la nouvelle note — cliquez pour plutôt la ranger sans l'ouvrir",
			openOff: "Range la nouvelle note sans l'ouvrir — cliquez pour plutôt l'ouvrir",
			removeTile: "Retirer la tuile",
			addTile: "Ajouter un modèle",
			tokensHelp:
				"Les noms de fichiers peuvent utiliser {{date}}, {{date:YYYY-MM}}, {{time}}, {{time:HH-mm}} " +
				"et {{prompt}}, qui vous demande le reste du nom avant la création de la " +
				"note. Tout ce qui est dans le modèle lui-même — <% tp.* %>, vos scripts " +
				"utilisateur, tp.system.prompt() — appartient à Templater et s'exécute exactement comme " +
				"depuis la commande de Templater.",
			tokensHelpScoped: (folder: string) =>
				`Le sélecteur liste les modèles de « ${folder} », le dossier de modèles de ` +
				"Templater. Les noms de fichiers peuvent utiliser {{date}}, {{date:YYYY-MM}}, {{time}}, " +
				"{{time:HH-mm}} et {{prompt}}, qui vous demande le reste du nom " +
				"avant la création de la note. Tout ce qui est dans le modèle lui-même — " +
				"<% tp.* %>, vos scripts utilisateur, tp.system.prompt() — appartient à Templater, " +
				"et s'exécute exactement comme depuis la commande de Templater.",
		},
		tasks: {
			source: "Source",
			sourceDesc:
				"Les cases à cocher Markdown fonctionnent partout. TaskNotes lit les notes de tâches " +
				"de ce plugin via le frontmatter (noms de champs configurables dans Paramètres → " +
				"Hearth, car TaskNotes n'a pas d'API interrogeable par d'autres plugins). " +
				"Kanban lit une seule note du plugin Kanban, une colonne par titre.",
			sourceCheckbox: "Cases à cocher Markdown",
			sourceTaskNotes: "Plugin TaskNotes",
			sourceKanban: "Plugin Kanban",
			kanbanBoard: "Note du Kanban",
			kanbanBoardDesc:
				"Le tableau du plugin Kanban à lire. Laissez vide pour détecter automatiquement la première " +
				"note concernée ayant une clé de frontmatter « kanban-plugin ».",
			kanbanBoardPlaceholder: "Détection automatique",
			pickBoard: "Choisir un Kanban",
			kanbanExtended: "Dates et priorités",
			kanbanExtendedDesc:
				"Lire les dates, la priorité et les marques de répétition écrites sur chaque carte " +
				"(compatible avec le plugin obsidian-tasks) pour les afficher en " +
				"indicateurs, trier la liste, et les modifier depuis la carte. Désactivé : " +
				"les cartes sont lues comme du texte simple.",
			checkboxExtended: "Dates et priorités",
			checkboxExtendedDesc:
				"Lire les dates, la priorité et les marques de répétition écrites sur chaque " +
				"case à cocher (compatible avec le plugin obsidian-tasks) pour les afficher en " +
				"indicateurs, trier la liste, et les modifier depuis le menu contextuel " +
				"de l'élément. Désactivé : les cases sont lues comme du texte simple.",
			checkboxStatuses: "États des tâches (colonnes du Kanban)",
			checkboxStatusesDesc:
				"Les états de case à cocher affichés en colonnes sur un Kanban, un par ligne " +
				"sous la forme « [symbole] Libellé » — le symbole est le caractère dans « - [ ] ». Ajoutez " +
				"« (done) » pour marquer un état comme terminé. Glisser une carte dans une colonne écrit " +
				"son symbole. Laissez vide pour l'ensemble par défaut (À faire, En cours, Terminé).",
			quickView: "Aperçu rapide au clic",
			quickViewDesc:
				"Cliquer sur une tâche ouvre une petite fenêtre — ses métadonnées et sa " +
				"description, modifiables sur place, avec des boutons pour ouvrir la note complète " +
				"ou supprimer la tâche — au lieu d'ouvrir directement la note. Désactivé : " +
				"le clic ouvre la note.",
			convertTemplate: "Modèle de conversion en note",
			convertTemplateDesc:
				"Quand vous faites clic droit sur une carte et choisissez « Convertir en note », la " +
				"nouvelle note part de ce modèle. Prend en charge {{title}}, {{date}} et " +
				"{{time}}. Laissez vide pour créer une note vide.",
			convertTemplatePlaceholder: "ex. Modèles/Tâche.md",
			pickTemplate: "Choisir une note modèle",
			convertScrape: "Déplacer les métadonnées dans le frontmatter",
			convertScrapeDesc:
				"En convertissant une carte en note, déplacer ses dates, sa priorité et ses " +
				"marques de répétition dans le frontmatter YAML de la nouvelle note au lieu de laisser " +
				"les emojis sur le lien du tableau.",
			newTaskAsNote: "Nouvelles tâches en notes",
			newTaskAsNoteDesc:
				"Créer chaque nouvelle carte directement comme une note à part (un lien sur le Kanban) " +
				"au lieu d'une case à cocher — en appliquant le modèle et les options " +
				"métadonnées-vers-frontmatter ci-dessus, comme Convertir en note.",
			layout: "Disposition",
			layoutDesc:
				"Liste, ou Kanban groupé par statut. Sur le Kanban, glissez les cartes " +
				"entre colonnes, glissez les en-têtes de colonne pour les réordonner, utilisez l'œil " +
				"d'une colonne pour la masquer, et sa coche pour qu'elle termine automatiquement les cartes. " +
				"Clic droit sur une carte pour la convertir en note à part.",
			layoutList: "Liste",
			layoutKanban: "Kanban",
			kanbanColumns: "Colonnes Kanban",
			kanbanHidden: (columns: string) => `Masquées : ${columns}`,
			kanbanDoneColumns: (columns: string) => `Achèvement auto : ${columns}`,
			kanbanCustomOrder: "Un ordre de colonnes personnalisé est défini.",
			showAll: "Tout afficher",
			resetColumns: "Réinitialiser l'ordre, la visibilité et les colonnes terminées",
			doneStatuses: "Statuts considérés comme terminés",
			doneStatusesDesc:
				"Source TaskNotes : quelles valeurs de statut sont considérées comme terminées (masquées " +
				"sauf si « Afficher les terminées » est actif, et barrées si affichées), une par " +
				"ligne. Laissez vide pour n'utiliser que la valeur « terminé » de Paramètres → Hearth. " +
				"Ajoutez par ex. « canceled » pour compter aussi les tâches annulées comme terminées.",
			doneStatusesPlaceholder: "done\ncanceled",
			fields: "Champs",
			fieldsFollowGlobal:
				"Suit les champs de Paramètres → Hearth → Intégrations. Activez " +
				"pour donner à cette carte ses propres champs.",
			fieldsCustomize: "Personnaliser…",
			fieldsTitle: "Champs de tâche",
			fieldsHint:
				"Tout ce qu'une tâche affiche, dans l'ordre. Chaque champ est à vous : nommez-" +
				"le, choisissez son apparence, et indiquez les clés qu'il lit.",
			fieldsEmpty: "Aucun champ pour l'instant — les tâches n'affichent que leur texte.",
			fieldsNone: "Aucun — les tâches n'affichent que leur texte.",
			fieldsApplyClose: "Appliquer et fermer",
			fieldsApplyDesc: "Appliquer sans fermer, pour continuer à ajuster.",
			fieldsReset: "Retirer tous les champs",
			fieldUnnamed: "Champ sans titre",
			fieldDefaultName: (n: number) => `Champ ${n}`,
			fieldAdd: "Ajouter un champ",
			fieldEdit: "Modifier le champ",
			fieldRemove: "Retirer le champ",
			fieldMoveUp: "Monter",
			fieldMoveDown: "Descendre",
			fieldExpand: "Déplier",
			fieldCollapse: "Replier",
			fieldName: "Nom",
			fieldNameDesc: "Le nom de ce champ. Affiché sur les tâches seulement si vous le demandez ci-dessous.",
			fieldNamePlaceholder: "ex. Priorité",
			fieldShowName: "Afficher le nom sur les tâches",
			fieldShowNameDesc: "Préfixer chaque valeur du nom du champ (« Priorité : Urgent »).",
			fieldDisplay: "Affichage",
			fieldDisplayDesc:
				"Comment les valeurs de ce champ sont dessinées. Les deux dernières options n'affichent rien sur la " +
				"tâche mais colorent toute la ligne ou la carte, et un seul champ peut " +
				"les utiliser. « Point coloré avec libellé » est la forme propre à la priorité, proposée " +
				"aux champs qui en lisent une. Une description est toujours un bloc de " +
				"sous-puces.",
			fieldAmbientTaken: (name: string) =>
				`La teinte et le halo sont déjà utilisés par « ${name} ». Une tâche n'a qu'un fond ` +
				`et qu'un contour, donc un seul champ peut les prendre.`,
			fieldAmbientIgnored: (name: string) =>
				`Ce champ ne colore rien : « ${name} » teinte ou entoure déjà la tâche, ` +
				`et un seul champ le peut. Donnez à l'un d'eux un autre affichage.`,
			fieldStyles: {
				pill: "Pastille",
				dot: "Point coloré",
				dotlabel: "Point coloré avec libellé",
				text: "Texte simple",
				hue: "Teinter toute la tâche",
				glow: "Halo autour de la tâche",
			},
			fieldOpacity: "Intensité",
			fieldOpacityDesc:
				"L'intensité de la couleur appliquée. Seule la couleur de la valeur est utilisée — " +
				"une valeur sans couleur ne change rien à la tâche.",
			fieldKeys: "Clés",
			fieldKeysDesc:
				"D'où ce champ lit ses données. Chaque clé qui a une valeur en affiche une, " +
				"un champ peut donc regrouper plusieurs métadonnées sous un même nom.",
			fieldKeysEmpty: "Pas encore de clé — ce champ n'affiche rien.",
			fieldNoKeys: "Aucune clé",
			fieldAddKey: "Ajouter une clé",
			fieldAddKeyDesc:
				"Les valeurs propres à Hearth couvrent la priorité d'une case à cocher, une colonne Kanban " +
				"et les dates analysées ; une propriété lit n'importe quoi dans votre frontmatter.",
			fieldAddBuiltin: "Ce que Hearth lit",
			fieldAddProperty: "Propriété de frontmatter",
			fieldAddKeyTyped: "Taper un nom de propriété…",
			fieldAddKeyPlaceholder: "Nom de la propriété",
			fieldRemoveKey: "Retirer la clé",
			fieldPickProperty: "Propriétés trouvées dans vos notes",
			fieldPickBuiltin: "Valeurs analysées par Hearth",
			fieldKeyAlreadyAdded: (key: string) => `« ${key} » est déjà une clé de ce champ.`,
			fieldMapValues: "Valeurs et couleurs",
			fieldMappedValues: (n: number) => `${n} valeur(s) associée(s)`,
			fieldNoMappings: "Valeurs affichées telles quelles",
			fieldMapHint:
				"Afficher un libellé plus joli et une couleur pour chaque valeur. Les valeurs non associées " +
				"s'affichent quand même, telles quelles.",
			fieldMapEmpty: "Aucune valeur associée pour l'instant.",
			fieldDateKey: "Affiché comme date",
			fieldIsDate: "Traiter comme une date",
			fieldIsDateDesc:
				"Afficher cette propriété comme date relative (« Demain »), la colorer selon " +
				"qu'elle est passée, aujourd'hui ou à venir, et la modifier avec un calendrier.",
			fieldDateHint:
				"Une date n'a pas de valeurs fixes à associer, elle est donc colorée selon sa " +
				"position. Un libellé est facultatif — laissez vide pour garder la date elle-même.",
			fieldDateLabelPlaceholder: "Afficher comme (facultatif)",
			dateRelations: {
				"<today": "Avant aujourd'hui",
				today: "Aujourd'hui",
				">today": "Après aujourd'hui",
			},
			fieldNotMappable:
				"Cette clé n'a pas de valeurs distinctes à associer — elle garde son propre format.",
			fieldMatchPlaceholder: "ex. high",
			fieldLabelPlaceholder: "Facultatif",
			fieldValueColumn: "Valeur dans vos notes",
			fieldWhenColumn: "Quand tombe la date",
			fieldShownColumn: "Affiché sur la tâche comme",
			fieldColorColumn: "Couleur",
			fieldAddMapping: "Ajouter une valeur",
			fieldValuesFound: (n: number) => `Depuis vos notes (${n})`,
			fieldRemoveMapping: "Retirer la valeur",
			fieldPickValue: "Valeurs prises par cette clé ailleurs dans votre coffre",
			fieldColor: "Couleur",
			fieldColorCustom: "Couleur personnalisée",
			fieldColorClear: "Aucune couleur",
			colorNames: {
				"--color-red": "Rouge",
				"--color-orange": "Orange",
				"--color-yellow": "Jaune",
				"--color-green": "Vert",
				"--color-cyan": "Cyan",
				"--color-blue": "Bleu",
				"--color-purple": "Violet",
				"--color-pink": "Rose",
			},
			sourceNames: {
				status: "Statut (TaskNotes)",
				column: "Colonne Kanban",
				priority: "Priorité",
				start: "Date de début",
				scheduled: "Date planifiée",
				due: "Date d'échéance",
				doneDate: "Date d'achèvement",
				description: "Description",
			},
			showCompleted: "Afficher les terminées",
			showCompletedKanbanDesc:
				"Les tâches terminées apparaissent toujours dans la colonne Terminé d'un Kanban.",
			maxTasks: "Tâches affichées max",
			maxTasksDesc: "Triées par échéance (en retard/plus proches d'abord), puis par fichier.",
			folders: "Dossiers",
			scope: "Portée",
			scopeAll: "Tout le coffre",
			scopeWhitelist: "Uniquement ces dossiers",
			scopeBlacklist: "Partout sauf ces dossiers",
			foldersDesc: "Un chemin de dossier par ligne.",
		},
		favorites: {
			display: "Affichage",
			displayDesc: "Une liste compacte de lignes, ou une grille de tuiles avec l'icône au-dessus du nom.",
			displayList: "Liste",
			displayTiles: "Tuiles",
			heading: "Favoris",
			headingDesc: "Notes affichées par toutes les cartes Favoris.",
			ownList: "Donner à cette carte sa propre liste",
			ownListOn:
				"Cette carte affiche ses propres notes et ignore la liste globale du coffre. Désactivez pour suivre à nouveau les favoris du coffre — la liste ci-dessous sera abandonnée.",
			ownListOff:
				"Cette carte suit les favoris du coffre, comme toutes les autres cartes Favoris. Activez pour lui donner sa propre liste, à partir de celle affichée actuellement.",
			moveUp: "Monter",
			moveDown: "Descendre",
			remove: "Retirer",
			addFavorite: "Ajouter un favori",
		},
		clock: {
			style: "Style",
			styleDigital: "Numérique",
			styleAnalog: "Analogique",
			styleStacked: "Empilée",
			styleFlip: "À volets",
			styleRing: "Anneaux",
			styleShapes: "Formes (Expressif)",
			styleOrbit: "Orbite (Expressif)",
			styleExpressiveDesc: "Le design Expressif (onglet Style) ajoute les cadrans Formes et Orbite.",
			styleFallbackDesc: (face: string) =>
				`Ce cadran vient avec le design Expressif (onglet Style) ; une carte Classique affiche ${face} à la place.`,
			hourFormat: "Format de l'heure",
			hourFormatAuto: "Automatique (langue)",
			hourFormat12: "12 heures",
			hourFormat24: "24 heures",
			showSeconds: "Afficher les secondes",
			showGreeting: "Afficher un message d'accueil",
			playful: "Messages d'accueil ludiques",
			playfulDesc: "Des messages d'accueil espiègles et aléatoires au lieu des classiques.",
			greetingOverride: "Message d'accueil personnalisé",
			greetingOverrideDesc: "Laissez vide pour le message automatique.",
			date: "Date",
			dateFull: "Jour, date mois",
			dateLong: "Jour, date mois année",
			dateShort: "Courte (langue)",
			dateIso: "ISO (2026-06-29)",
			dateWeekday: "Jour de la semaine seul",
			dateCustom: "Format personnalisé…",
			dateNone: "Masquée",
			customFormat: "Format de date personnalisé",
			customFormatDesc: "Un format moment.js, ex. ddd D MMM ou DD/MM/YYYY.",
			customFormatPlaceholder: "ddd D MMM",
		},
		calculator: {
			angleUnit: "Unité d'angle",
			angleUnitDesc: "Unité utilisée par les fonctions trigonométriques comme sin et cos.",
			degrees: "Degrés",
			radians: "Radians",
			keypad: "Pavé numérique",
			keypadDesc:
				"Afficher un pavé à l'écran sur la carte : basique (chiffres et opérations) ou scientifique (ajoute fonctions, puissances et constantes).",
			keypadNone: "Masqué",
			keypadBasic: "Basique",
			keypadScientific: "Scientifique",
		},
		dataview: {
			language: "Type de requête",
			languageDesc:
				"Langage de requête Dataview (TABLE / LIST / TASK) ou code DataviewJS.",
			languageDql: "Requête Dataview (DQL)",
			languageJs: "DataviewJS",
			query: "Requête",
			queryDqlDesc:
				"Une requête Dataview, écrite exactement comme dans un bloc de code ```dataview " +
				"(sans les délimiteurs). S'exécute sans « note courante » : les requêtes globales " +
				"fonctionnent pleinement mais celles relatives à this.file n'ont pas de fichier de référence.",
			queryJsDesc:
				"Code DataviewJS, comme dans un bloc ```dataviewjs (sans les délimiteurs). " +
				"L'API dv est disponible. Exécute du JavaScript arbitraire — n'utilisez que du code de confiance.",
			queryDqlPlaceholder:
				'TABLE file.mtime AS "Modifié" FROM #projet SORT file.mtime DESC',
			queryJsPlaceholder: "dv.list(dv.pages('#projet').file.link)",
		},
		datacore: {
			language: "Type de requête",
			languageDesc:
				"Une requête Datacore affichée en liste dynamique, ou un script Datacore qui dessine sa propre vue.",
			languageQuery: "Requête Datacore",
			languageJsx: "Script (JSX)",
			languageJs: "Script (JS)",
			languageTsx: "Script (TSX)",
			languageTs: "Script (TS)",
			query: "Requête",
			queryDesc:
				"Une requête Datacore, ex. @page and #projet. Hearth affiche les résultats en " +
				"liste dynamique de liens. S'exécute sans « note courante » : les requêtes globales fonctionnent " +
				"pleinement mais celles relatives à un fichier n'ont pas de fichier de référence.",
			queryPlaceholder: "@page and #projet",
			script: "Script",
			scriptDesc:
				"Un script Datacore, comme dans un bloc ```datacorejsx (sans les délimiteurs). " +
				"L'API dc est disponible et le script renvoie la vue à afficher. Exécute du " +
				"code arbitraire — n'utilisez que du code de confiance.",
			scriptPlaceholder:
				"return function View() {\n\tconst pages = dc.useQuery(\"@page and #projet\");\n\treturn <dc.List rows={pages} renderer={(p) => <dc.Link link={p.$link} />} />;\n}",
			pageSize: "Lignes par page",
			pageSizeDesc: "Paginer la liste générée à ce nombre de lignes. 0 affiche tous les résultats d'un coup.",
		},
		git: {
			missing: "Le plugin Git n'est pas activé",
			missingDesc:
				"Cette carte est une fenêtre sur le module complémentaire Git — installez-le et activez-" +
				"le, et pointez-le vers un dépôt, pour que la carte affiche quelque chose.",
			sections: "Sections",
			actions: "Boutons",
			destructive: "Irréversible.",
			removeAction: "Retirer ce bouton",
			addAction: "Ajouter un bouton",
			addActionPlaceholder: "Choisir…",
			actionStyle: "Style des boutons",
			actionStyleDesc: "Les icônes seules sont compactes ; les libellés rendent une carte large plus lisible.",
			actionStyles: {
				icon: "Icône seule",
				labelled: "Icône et libellé",
			},
			committing: "Commit",
			commitScope: "Quoi committer",
			commitScopeDesc:
				"Les fichiers inclus par les boutons Commit et Commit-et-synchro.",
			commitScopes: {
				smart: "Les fichiers indexés s'il y en a, sinon tout",
				all: "Tout",
				staged: "Uniquement les fichiers indexés",
			},
			askForMessage: "Demander un message",
			askForMessageDesc:
				"Le plugin Git demande un message de commit à chaque fois, exactement comme ses " +
				"commandes « …with specific message ».",
			commitMessage: "Message de commit",
			commitMessageDesc:
				"Utilisé par les boutons de commit de cette carte. Laissez vide pour utiliser le modèle " +
				"de message de commit du plugin Git.",
			commitMessagePlaceholder: "sauvegarde du coffre : {{date}}",
			skipConfirm: "Ignorer les confirmations",
			skipConfirmDesc:
				"Exécuter immédiatement les actions d'abandon au lieu de demander d'abord. Les " +
				"modifications abandonnées ne peuvent pas être récupérées.",
			display: "Affichage",
			changeLimit: "Fichiers modifiés affichés",
			changeLimitDesc: "0 liste tous les fichiers modifiés.",
			showPaths: "Afficher les dossiers",
			showPathsDesc: "Afficher le dossier de chaque fichier modifié sous son nom.",
			logLimit: "Commits affichés",
			logLimitDesc: "Combien de commits récents la section historique liste.",
			refresh: "Relire toutes les",
			refreshDesc:
				"Minutes entre des lectures supplémentaires du dépôt, en plus du suivi des " +
				"mises à jour du plugin Git. 0 — par défaut — ne suit que ces mises à jour, " +
				"ce qui couvre déjà tout ce qui est fait dans Obsidian.",
		},
		operon: {
			view: "Vue",
			viewDesc: "Ce que cette carte affiche depuis Operon.",
			viewList: "Liste de tâches",
			viewBoard: "Kanban des statuts",
			viewAgenda: "Agenda",
			viewTimer: "Minuteur",
			scope: "Portée",
			scopeDesc:
				"Utiliser l'une des vues filtrées d'Operon, ou appliquer les filtres ci-dessous. " +
				"Operon décide de ce qui est en retard ou prévu aujourd'hui, ses " +
				"portées restent donc justes quand ses règles évoluent.",
			scopeQuery: "Filtres personnalisés",
			scopeNormal: "Toutes les tâches",
			scopeToday: "Aujourd'hui",
			scopeOverdue: "En retard",
			scopeRecent: "Modifiées récemment",
			createAs: "Nouvelles tâches",
			createAsDesc:
				"Ce que le « + » de la carte demande à Operon de créer. Le défaut d'Operon suit ses propres " +
				"paramètres ; les deux autres choisissent laquelle de ses cibles configurées utiliser — " +
				"utile quand l'une d'elles est introuvable. L'emplacement final de la tâche " +
				"reste décidé par Operon dans tous les cas.",
			createAsDefault: "Défaut d'Operon",
			createAsInline: "En ligne, dans une note",
			createAsFile: "Sa propre note",
			agendaDays: "Jours à venir",
			agendaDaysDesc: "Combien de jours l'agenda couvre, aujourd'hui compris.",
			count: "Tâches affichées",
			countDesc: "Nombre maximal de tâches dans la liste, ou par colonne du Kanban.",
			pipelines: "Pipelines",
			pipelinesDesc: "Limiter à ces pipelines Operon. Aucune sélection = tous.",
			statuses: "Statuts",
			statusesDesc: "Limiter à ces statuts Operon. Aucune sélection = tous.",
			priorities: "Priorités",
			prioritiesDesc: "Limiter à ces priorités Operon. Aucune sélection = toutes.",
			checkbox: "Achèvement",
			checkboxDesc: "Quels états d'achèvement inclure. Tâches ouvertes uniquement par défaut.",
			checkboxOpen: "Ouvertes",
			checkboxDone: "Terminées",
			checkboxCancelled: "Annulées",
			text: "Texte contenu",
			textDesc: "Uniquement les tâches dont la description contient ce texte.",
			sort: "Tri",
			sortDesc:
				"Ordre de la liste et de chaque colonne du Kanban. Les tâches ouvertes viennent toujours " +
				"avant les terminées. Le bouton inverse le sens.",
			sortSmart: "Intelligent (date, priorité, ancienneté)",
			sortDue: "Date",
			sortPriority: "Priorité",
			sortCreated: "Création",
			sortAlpha: "Alphabétique",
			showDue: "Afficher les dates",
			showPriority: "Afficher la priorité",
			showStatus: "Afficher le statut",
			showRecurrence: "Afficher le marqueur de récurrence",
			showTracker: "Afficher le marqueur de minuteur en cours",
			showPinned: "Afficher le marqueur d'épingle",
			showFile: "Afficher le nom de la note",
			noOptions: "Ajoutez d'abord une carte Operon au tableau pour charger ces options",
		},
		clip: {
			name: "Nom de la note",
			nameDesc: "Le nom de la nouvelle note. Chaque champ ici accepte des {{variables}}.",
			folder: "Dossier",
			folderDesc: "Où vont les nouvelles notes. Les variables marchent ici aussi, p. ex. Clippings/{{feed}}. Vide = racine du coffre.",
			folderPlaceholder: "Racine du coffre",
			pickFolder: "Choisir un dossier",
			properties: "Propriétés",
			propertiesDesc: "Chaque valeur est un modèle. Une propriété qui sort vide est omise de la note.",
			propertyName: "Nom",
			propertyValue: "Valeur, p. ex. {{title}}",
			addProperty: "Ajouter une propriété",
			removeProperty: "Supprimer la propriété",
			resetProperties: "Revenir aux propriétés par défaut",
			types: {
				text: "Texte",
				list: "Liste",
				number: "Nombre",
				checkbox: "Case à cocher",
				date: "Date",
				datetime: "Date et heure",
			},
			body: "Contenu de la note",
			bodyDesc: "Le corps de la note.",
			resetBody: "Revenir au contenu par défaut",
			template: "Note modèle",
			templateDesc: "Facultatif. Son texte ouvre le contenu, avec les mêmes variables remplies.",
			pickTemplate: "Choisir une note modèle",
			clearTemplate: "Retirer le modèle",
			linkKey: "Propriété de lien",
			linkKeyDesc: "Retient d'où vient la note, pour que le même élément rouvre sa note au lieu d'en créer une autre. Vide : toujours une nouvelle note.",
			variables: "Variables",
			variablesHint: "Cliquez sur l'une d'elles pour l'insérer à l'emplacement du curseur.",
			filters: "Filtres",
			filtersHint: "Enchaînez les filtres après une variable avec |, p. ex. {{published|date:\"D MMMM YYYY\"}} ou {{title|lower|truncate:40}}.",
			vars: {
				title: "Le titre",
				date: "Le jour où il a lieu",
				start: "Quand il commence",
				end: "Quand il finit",
				location: "Où il a lieu",
				description: "Sa description",
				url: "Son lien",
				calendar: "Le nom du calendrier",
				uid: "L'identifiant de l'événement",
				link: "L'adresse web de l'article",
				content: "Le texte complet, en Markdown",
				html: "Le texte complet tel que le flux l'envoie (HTML)",
				excerpt: "Un court résumé en texte brut",
				published: "Quand il a été publié",
				author: "Qui l'a écrit",
				feed: "Le nom du flux",
				feedUrl: "L'adresse du flux",
				categories: "Ses catégories, en liste",
				image: "L'adresse de son image",
				id: "L'identifiant de l'article dans le flux",
				today: "La date du jour",
				now: "La date et l'heure actuelles",
			},
			filterDocs: {
				date: { syntax: "date:\"YYYY-MM-DD\"", desc: "Formater une date (jetons moment.js)" },
				lower: { syntax: "lower", desc: "minuscules" },
				upper: { syntax: "upper", desc: "MAJUSCULES" },
				title: { syntax: "title", desc: "Majuscule À Chaque Mot" },
				capitalize: { syntax: "capitalize", desc: "Première lettre en majuscule" },
				trim: { syntax: "trim", desc: "Retirer les espaces aux extrémités" },
				truncate: { syntax: "truncate:80", desc: "Couper à une longueur, avec …" },
				replace: { syntax: "replace:\"a\",\"b\"", desc: "Remplacer chaque a par b" },
				default: { syntax: "default:\"texte\"", desc: "Utiliser ceci si la valeur est vide" },
				split: { syntax: "split:\",\"", desc: "Transformer un texte en liste" },
				join: { syntax: "join:\", \"", desc: "Transformer une liste en texte" },
				first: { syntax: "first", desc: "Le premier élément d'une liste" },
				last: { syntax: "last", desc: "Le dernier élément d'une liste" },
				list: { syntax: "list", desc: "Une liste à puces Markdown" },
				wikilink: { syntax: "wikilink", desc: "Chaque élément en [[lien]]" },
				link: { syntax: "link:\"libellé\"", desc: "Un lien Markdown vers l'adresse" },
				blockquote: { syntax: "blockquote", desc: "Citer chaque ligne avec >" },
				safe_name: { syntax: "safe_name", desc: "Retirer les caractères interdits dans un nom de fichier" },
			},
			preview: "Aperçu",
			previewOf: (name: string) => `Rempli à partir de « ${name} ».`,
			previewSample: "Rempli à partir d'un exemple inventé.",
			previewTemplate: (path: string) => `(d'abord le texte de ${path})`,
			copied: (text: string) => `${text} copié`,
			sampleEvent: {
				title: "Lancement du projet",
				location: "Salle 4",
				description: "Ordre du jour : objectifs, responsables, premier jalon.",
				calendar: "Travail",
			},
			sampleEntry: {
				title: "Récap de la semaine n° 42",
				feed: "Lettre d'exemple",
				author: "Jeanne Dupont",
				content: "Cette semaine : trois choses à lire, et une à laisser de côté.",
			},
		},
		rss: {
			feeds: "Flux",
			namePlaceholder: "Nom (facultatif)",
			urlPlaceholder: "https://example.com/feed.xml",
			addFeed: "Ajouter un flux",
			removeFeed: "Retirer le flux",
			github: "Ajouter depuis GitHub",
			githubDesc:
				"Saisissez un dépôt sous la forme propriétaire/dépôt (ou collez son URL) et choisissez quoi suivre — Hearth crée le flux Atom pour vous.",
			githubPlaceholder: "propriétaire/dépôt",
			githubReleases: "Versions",
			githubCommits: "Commits",
			githubBoth: "Versions et commits",
			githubAdd: "Ajouter le dépôt",
			githubInvalid: "Saisissez un dépôt sous la forme propriétaire/dépôt.",
			githubReleasesName: "Versions de {repo}",
			githubCommitsName: "Commits de {repo}",
			mergeAll: "Onglet combiné « Tout »",
			mergeAllDesc:
				"Ajouter un premier onglet qui fusionne tous les flux en un seul, du plus récent au plus ancien.",
			display: "Affichage",
			layout: "Disposition",
			layoutDesc: "Comment chaque élément est affiché.",
			layoutList: "Liste (titre + date)",
			layoutCards: "Cartes (extrait + image)",
			layoutCompact: "Compact (titres)",
			itemLimit: "Éléments par flux",
			itemLimitDesc: "Combien d'éléments récents afficher.",
			refresh: "Actualisation auto (minutes)",
			refreshDesc: "Fréquence de récupération des flux. 0 = uniquement à l'ouverture.",
			showImages: "Afficher les images",
			showImagesDesc: "Afficher les vignettes quand le flux en fournit.",
			showExcerpt: "Afficher l'extrait",
			showExcerptDesc: "Afficher un court extrait sous chaque élément.",
			showDate: "Afficher la date",
			showDateDesc: "Afficher l'heure de publication de chaque élément.",
			reading: "Lecture",
			openIn: "Ouvrir les articles dans",
			openInDesc: "Où mène un clic sur un article. Un article sans page web — une lettre d'information, par exemple — s'ouvre toujours dans le lecteur de Hearth.",
			openInBrowser: "Navigateur",
			openInDialog: "Lecteur (fenêtre)",
			openInTab: "Lecteur (onglet)",
			readerImages: "Images dans le lecteur",
			readerImagesDesc: "Une image est chargée depuis le serveur de l'expéditeur, qui apprend ainsi que vous avez ouvert l'article — les lettres d'information comptent là-dessus. « Demander » affiche un bouton pour les charger.",
			imagesAsk: "Demander",
			imagesAlways: "Toujours charger",
			imagesNever: "Ne jamais charger",
			unreadOnly: "Non lus seulement",
			unreadOnlyDesc: "N'afficher que les articles pas encore ouverts. Le bouton filtre de la carte le bascule aussi.",
			noteHeading: "Enregistrer en note",
			noteDesc: "Ce que « Enregistrer en note » fait d'un article dans le lecteur — un modèle comme celui de l'Obsidian Web Clipper : chaque champ accepte des {{variables}}, et les filtres les façonnent.",
			noteEnabled: "Proposer « Enregistrer en note »",
			noteEnabledDesc: "Afficher l'action dans le lecteur et dans le menu d'un article.",
		},
		market: {
			symbols: "Symboles",
			symbolsDesc: "Ce que suit la carte, dans l'ordre d'affichage. Les styles à un seul instrument affichent le premier.",
			noSymbols: "Rien pour l'instant — cherchez ci-dessous, ou tapez un symbole et ajoutez-le tel quel.",
			moveUp: "Monter",
			moveDown: "Descendre",
			remove: "Retirer",
			holding: "Position",
			quantity: "Quantité",
			cost: "Coût moyen",
			search: "Ajouter",
			searchDesc:
				"Cherchez par nom ou symbole, ou tapez-en un et ajoutez-le tel quel : AAPL, 0700.HK, 510300, EUR/USD, BTC-USD, fund:161725, cg:bitcoin.",
			searchDisabled: "La recherche est désactivée tant que les appels externes le sont. Un symbole tapé peut quand même être ajouté.",
			searchPlaceholder: "Apple, CAC 40, EUR/USD…",
			searchEmpty: "Tapez d'abord un nom ou un symbole",
			searchButton: "Chercher",
			addTyped: "Ajouter tel quel",
			noResults: "Rien trouvé. Essayez le symbole lui-même, ou ajoutez-le tel quel.",
			add: "Ajouter",
			added: "Ajouté",
			appearance: "Apparence",
			style: "Style",
			styleDesc: "Minimal, vedette et graphique affichent un instrument ; les autres les affichent tous.",
			styles: {
				minimal: "Minimal — le cours et sa variation",
				spotlight: "Vedette — cours, graphique et statistiques",
				chart: "Graphique — bord à bord",
				list: "Liste de suivi",
				tiles: "Tuiles",
				ticker: "Bandeau défilant",
				portfolio: "Portefeuille",
				lookup: "Recherche — sur la carte",
			},
			design: "Design",
			designDesc: "Classique, ou Material 3 Expressive : pastilles, conteneurs tonals dans votre couleur d'accent et formes douces.",
			designClassic: "Classique",
			designExpressive: "Expressif",
			upColor: "Couleur de hausse",
			upColorDesc: "Vert pour une hausse dans la plupart du monde ; rouge en Chine, au Japon et en Corée. Automatique suit la langue d'Obsidian.",
			upColorAuto: "Automatique",
			upColorGreen: "Vert en hausse, rouge en baisse",
			upColorRed: "Rouge en hausse, vert en baisse",
			range: "Période du graphique",
			rangeDesc: "La période couverte par les mini-graphiques.",
			rangeDescSingle: "La période à l'ouverture du graphique. Les pastilles sur la carte la changent.",
			change: "Afficher la variation en",
			changePercent: "Pourcentage",
			changeAbsolute: "Montant",
			changeBoth: "Les deux",
			baseCurrency: "Devise du portefeuille",
			baseCurrencyDesc: "Les totaux sont convertis au taux quotidien de la BCE.",
			baseCurrencyAuto: "Automatique (majorité des positions)",
			animate: "Faire défiler le bandeau",
			animateDesc: "Désactivé : le bandeau reste immobile et défile à la main. Toujours désactivé en niveau de performance réduit.",
			display: "Quoi afficher",
			showName: "Noms",
			showSparkline: "Mini-graphiques",
			showStats: "Statistiques",
			showMarketState: "Marché ouvert ou fermé",
			showUpdated: "Dernière mise à jour",
			refresh: "Actualiser toutes les (minutes)",
			refreshDesc: "0 actualise seulement à l'ouverture du tableau. Les cours sont partagés entre cartes, et un marché fermé est vérifié au plus toutes les demi-heures.",
		},
		tension: {
			about: "Kagi News · Tension mondiale",
			aboutDesc:
				"Kagi News fait lire les gros titres mondiaux du jour à un modèle de langage qui note la tension mondiale de 0 (calme) à 100 (en feu). C'est l'évaluation d'un modèle, pas une mesure. Cliquer sur la carte ouvre l'indice sur Kagi News.",
			appearance: "Apparence",
			style: "Style",
			styleDesc: "Minimal affiche le score et sa position sur l'échelle ; Artistique peint un village qui passe de la paix à la guerre quand le score monte.",
			styleMinimal: "Minimal",
			styleArtistic: "Artistique",
			animate: "Animer",
			animateDesc: "Laisser le diorama bouger : le moulin, la fumée, les avions. Le niveau de performance et la réduction des animations peuvent toujours le figer.",
			display: "Quoi afficher",
			showBand: "Niveau (Calme … Brûlant)",
			showSummary: "Explication de l'IA",
			showSummaryDesc: "Ce que le modèle de langage de Kagi a écrit pour justifier le score.",
			summaryLength: "Longueur de l'explication",
			summarySentence: "Première phrase",
			summaryFull: "En entier",
			showScale: "Échelle",
			showChange: "Variation depuis hier",
			showChangeDesc: "De combien de points le score a bougé depuis la veille.",
			showHistory: "Historique",
			historyDays: "L'historique couvre",
			days: (n: number) => `${n} jours`,
			showUpdated: "Dernière mise à jour",
			refresh: "Vérifier toutes les (minutes)",
			refreshDesc: "Kagi publie un nouvel indice par jour : une carte ne demande donc rien avant qu'une journée soit passée depuis le dernier, puis vérifie à cette fréquence jusqu'à l'arrivée du nouveau. 0 vérifie seulement à l'ouverture du tableau.",
		},
		weather: {
			location: "Lieu",
			search: "Trouver un lieu",
			searchDesc:
				"Recherche par nom — Hearth enregistre les coordonnées sur la carte, cette " +
				"recherche n'a donc lieu qu'une fois.",
			searchDisabled:
				"La recherche de lieu est indisponible tant que les appels externes sont désactivés dans les paramètres " +
				"de Hearth. Vous pouvez toujours saisir des coordonnées ci-dessous.",
			searchPlaceholder: "Paris, Lyon, Marseille…",
			searchButton: "Chercher",
			searchEmpty: "Tapez un nom de lieu à rechercher.",
			searchNoResults: "Aucun lieu ne correspond à ce nom.",
			usePlace: "Utiliser",
			reuse: "Réutiliser un lieu",
			reuseDesc: "Un lieu déjà défini sur l'une de vos cartes météo.",
			reusePick: "Choisir un lieu…",
			unnamedPlace: "(lieu sans nom)",
			clearPlace: "Effacer le lieu",
			coordinates: "Coordonnées",
			coordinatesDesc: "Latitude et longitude en degrés décimaux, si vous préférez ne pas chercher.",
			latPlaceholder: "48.86",
			lonPlaceholder: "2.35",
			placeName: "Libellé",
			placeNameDesc: "Le nom que la carte donne à ce lieu.",
			placeNamePlaceholder: "Maison",

			appearance: "Apparence",
			style: "Style",
			styleDesc: "Quelle part des prévisions la carte affiche.",
			styleMinimal: "Minimal (icône + température)",
			styleCompact: "Compact (une ligne)",
			styleDetailed: "Détaillé (grille de mesures)",
			styleForecast: "Prévisions (courbe horaire)",
			styleArtistic: "Artistique (ciel peint)",
			styleMoon: "Lune (phase de ce soir)",
			design: "Design",
			designDesc:
				"Icônes au trait classiques et ciel peint, ou Material 3 Expressive : dessins météo plats, pastilles et conteneurs tonals dans votre couleur d'accent.",
			designClassic: "Classique",
			designExpressive: "Expressif",
			styleDaylight: "Jour (course du soleil)",
			animate: "Animer le ciel",
			animateDesc:
				"Nuages qui dérivent, pluie qui tombe et étoiles qui scintillent. Toujours désactivé en mode économie d'énergie.",
			animateMoonDesc:
				"La lune se lève à sa place et flotte, sa forme tourne et les étoiles scintillent. Toujours désactivé en mode économie d'énergie.",
			animateSunDesc:
				"Le soleil parcourt sa course jusqu'à l'heure actuelle et y tourne. Toujours désactivé en mode économie d'énergie.",
			moonLayout: "Disposition",
			moonLayoutDesc: "Tout sur la lune de ce soir, ou seulement la lune et sa position dans le mois.",
			moonLayoutFull: "Complet (ciel nocturne et détails)",
			moonLayoutClean: "Épuré (lune et mois)",

			units: "Unités",
			tempUnit: "Température",
			tempUnitC: "Celsius (°C)",
			tempUnitF: "Fahrenheit (°F)",
			windUnit: "Vitesse du vent",
			windUnitKmh: "Kilomètres par heure (km/h)",
			windUnitMs: "Mètres par seconde (m/s)",
			windUnitMph: "Miles par heure (mph)",
			windUnitKn: "Nœuds (kn)",
			precipUnit: "Précipitations",
			precipUnitMm: "Millimètres (mm)",
			precipUnitInch: "Pouces (in)",
			hourFormat: "Format de l'heure",
			hourFormatAuto: "Automatique (langue)",
			hourFormat12: "12 heures",
			hourFormat24: "24 heures",

			display: "Quoi afficher",
			showLocation: "Nom du lieu",
			showCondition: "Conditions",
			showFeelsLike: "Ressenti",
			showHighLow: "Max et min du jour",
			showHumidity: "Humidité",
			showWind: "Vent",
			showPrecip: "Précipitations",
			showPrecipDesc: "Probabilité de pluie et quantité tombée, plus les probabilités heure par heure.",
			showUv: "Indice UV",
			showPressure: "Pression",
			showSun: "Lever et coucher du soleil",
			showUpdated: "Dernière mise à jour",
			hourlyCount: "Heures à venir",
			hourlyCountDesc: "Combien d'heures couvre la bande horaire. 0 la masque.",
			dailyCount: "Jours à venir",
			dailyCountDesc: "Combien de jours couvrent les prévisions quotidiennes. 0 les masque.",
			refresh: "Actualisation auto (minutes)",
			refreshDesc: "Fréquence de récupération des prévisions. 0 = uniquement à l'ouverture.",
		},
		jira: {
			host: "Hôte Jira",
			hostDesc: "L'origine du site Jira. HTTPS est obligatoire pour envoyer un jeton d'accès personnel.",
			hostPlaceholder: "https://jira.example.com",
			pat: "Jeton d'accès personnel",
			patDesc: "Jeton PAT (Bearer) utilisé pour cette carte. Stocké dans les données du plugin Hearth.",
			apiBase: "Chemin de base de l'API",
			apiBaseDesc: "Un chemin REST Jira relatif. Les URL complètes sont refusées.",
			apiBasePlaceholder: "/rest/api/latest",
			savedFilter: "Filtre enregistré",
			savedFilterDesc: "Charger vos filtres Jira favoris, puis en choisir un.",
			selectedFilter: (name: string) => `Sélectionné : ${name}`,
			loadFilters: "Charger les filtres favoris",
			chooseFilter: "Choisir un filtre…",
			noFavoriteFilters: "Jira n'a renvoyé aucun filtre favori.",
			loadFailed: "Impossible de charger les filtres Jira. Vérifiez l'hôte, le chemin de l'API et le jeton.",
			externalCallsDisabled:
				"Les filtres favoris ne peuvent pas être chargés tant que les appels externes sont désactivés dans les paramètres de Hearth.",
			controls: "Contrôles de filtre",
			maxResults: "Résultats max",
			maxResultsDesc: "Le nombre maximal de tickets filtrés à afficher, jusqu'à 200.",
			refresh: "Actualisation auto (minutes)",
			refreshDesc: "Fréquence d'actualisation de Jira. 0 = uniquement à l'ouverture ou manuellement.",
			cache: "Durée du cache (minutes)",
			cacheDesc: "Combien de temps les réponses Jira réussies restent en mémoire. 0 désactive le cache.",
		},
		leaf: {
			view: "Vue à héberger",
			viewDesc:
				"Une vue de panneau latéral enregistrée par un module principal ou un module complémentaire " +
				"(calendrier, plan, panneau de tags, kanban…). La liste dépend des " +
				"plugins activés.",
			pickPlaceholder: "Choisir une vue…",
			none: "Aucune vue hébergeable trouvée. Activez un plugin qui fournit une vue de panneau latéral.",
			file: "Fichier à afficher",
			fileDesc:
				"Facultatif. Ouvrir un fichier précis du coffre dans la vue hébergée — un " +
				"dessin Excalidraw, un canvas, une note. Laissez vide pour héberger la vue " +
				"sans fichier (certaines vues affichent alors un écran vide ou « nouveau fichier »).",
			filePlaceholder: "ex. Dessins/Croquis.excalidraw.md",
			pickFile: "Choisir un fichier",
			clearFile: "Retirer le fichier",
			hideHeader: "Masquer l'en-tête de la vue",
			hideHeaderDesc:
				"Masquer l'en-tête de la vue hébergée — son fil d'Ariane, ses flèches " +
				"précédent/suivant et son menu. Pratique quand la carte affiche un seul fichier.",
			perfLabel: "Performance",
			perfNote:
				"C'est de loin la carte la plus lourde de Hearth. Elle exécute la vue complète " +
				"d'un autre plugin en direct dans le tableau, et maintient donc les minuteurs, " +
				"écouteurs et le rendu de ce plugin tant que " +
				"le tableau est ouvert — chacune de ces cartes coûte à nouveau. Utilisez-en une " +
				"ou deux au maximum, et attendez-vous à un tableau plus lent sur du matériel modeste.",
			perfNoteTier:
				"Vous avez baissé le niveau de performance. Il ne peut pas alléger cette " +
				"carte — une vue hébergée se gère elle-même — c'est donc la carte " +
				"à retirer si le tableau semble encore lourd.",
			note: "Bêta",
			noteDesc:
				"Héberge la vue d'un autre plugin dans la carte. Certaines vues s'attendent à une " +
				"barre latérale et peuvent s'afficher ou se dimensionner bizarrement ici.",
		},
		pet: {
			species: "Animal",
			name: "Nom",
			nameDesc: "Comment l'appeler. Laissez vide pour utiliser le nom de l'animal.",
			colors: "Couleurs",
			colorsDesc:
				"Corps et accent. Le contour, les ombres et le ventre sont dérivés de " +
				"la couleur du corps.",
			colorsReset: "Revenir aux couleurs de cet animal",
			size: "Taille",
			sizeSmall: "Petit",
			sizeMedium: "Moyen",
			sizeLarge: "Grand",
			metric: "Le nourrir avec",
			metricDesc: "L'activité du coffre que suit l'humeur du compagnon.",
			metricModified: "Notes modifiées",
			metricCreated: "Notes créées",
			moods: "Humeurs",
			moodsDesc:
				"Le seuil de chaque humeur. Rien ici ne peut rendre le compagnon malade ni " +
				"le faire disparaître — un coffre calme l'endort simplement, et la moindre écriture " +
				"le réveille aussitôt.",
			moodsReset: "Revenir aux humeurs par défaut",
			excitedAt: "Bondit de joie à partir de",
			excitedAtDesc: "Notes touchées aujourd'hui, ou plus.",
			happyAt: "Heureux à partir de",
			happyAtDesc: "Notes touchées aujourd'hui — votre bonne journée.",
			contentAt: "Content à partir de",
			contentAtDesc: "Notes touchées aujourd'hui. En dessous, le compagnon s'ennuie.",
			sleepyAfter: "S'endort après",
			sleepyAfterDesc:
				"Minutes sans aucune modification dans le coffre. Le compagnon dort " +
				"quelle que soit son humeur, aussi bonne qu'ait été la journée, et toute activité le " +
				"réveille là où la journée l'avait laissé.",
			pettedFor: "Une caresse dure",
			pettedForDesc: "Minutes de bonheur garanti après un clic sur le compagnon.",
			nightSleep: "La nuit",
			nightSleepDesc:
				"Ce que l'horloge a le droit de faire. Une heure creuse la nuit, c'est l'heure, pas " +
				"de la négligence — une bonne journée reste une bonne journée, et une caresse réveille " +
				"le compagnon quel que soit ce paramètre.",
			nightOff: "Rien — seul le coffre compte",
			nightQuiet: "Un compagnon qui s'ennuie ou content dort à la place",
			nightAlways: "Toujours endormi la nuit",
			nightWindow: "La nuit va de",
			nightWindowDesc: "Votre heure locale. La plage peut passer minuit.",
			eyesFollow: "Les yeux suivent le pointeur",
			eyesFollowDesc: "Un compagnon endormi garde les yeux fermés quel que soit ce paramètre.",
			eyesOff: "Jamais",
			eyesCard: "Sur sa propre carte",
			eyesBoard: "N'importe où sur le tableau",
			showName: "Afficher le nom",
			showMood: "Afficher l'humeur",
			showActivity: "Afficher l'activité du jour",
		},
		vaultPet: {
			missing: "Vault Pet n'est pas installé",
			missingDesc:
				"Cette carte accueille le module complémentaire Vault Pet. Installez-le et activez-" +
				"le, et la carte se remplit d'elle-même — ces paramètres sont conservés dans tous les cas.",
			display: "Afficher",
			displayDesc:
				"Les deux viennent de Vault Pet : la petite carte qu'il peut insérer dans une note, " +
				"ou sa vue maison, hébergée ici au lieu de la barre latérale.",
			displayPet: "Le compagnon",
			displayHouse: "La maison du compagnon",
			showHeader: "Garder la barre de titre de la maison",
			showHeaderDesc:
				"L'en-tête de la vue hébergée est masqué par défaut — la carte en a " +
				"déjà un.",
			openButton: "Bouton « Ouvrir la maison du compagnon »",
			openButtonDesc:
				"Un bouton dans le coin de la carte qui ouvre la maison de Vault Pet dans la " +
				"barre latérale, comme son icône du ruban.",
		},
		design: {
			name: "Design",
			desc: "Classique, ou Material 3 Expressive : conteneurs tonals dans votre couleur d'accent, pastilles et formes douces.",
			classic: "Classique",
			expressive: "Expressif",
			followDefault: (design: string) => `Par défaut (${design})`,
		},
		colors: {
			heading: "Couleurs",
			headingDesc: "Couleur d'accent et teinte de fond de cette carte.",
			clearAccent: "Retirer l'accent",
			clearBackground: "Retirer le fond",
			cardOpacity: "Opacité de la carte",
			cardOpacityDesc:
				"Surface de carte transparente (remplace la valeur du tableau).",
			cardBlur: "Flou de la carte",
			cardBlurDesc:
				"Flou verre givré derrière cette carte (remplace la valeur du tableau). Nécessite une opacité inférieure à 100 %.",
			cardBorderWidth: "Bordure de la carte",
			cardBorderWidthDesc:
				"Épaisseur de la bordure de cette carte (remplace la valeur du tableau). 0 retire la bordure et la ligne sous le titre.",
			useDashboardDefault: "Utiliser la valeur du tableau",
		},
		size: {
			heading: "Taille",
			headingDesc:
				"Largeur (% du tableau) et hauteur (pixels). Ou tirez simplement un bord ou un coin de la carte.",
			widthAria: "Largeur en pourcentage du tableau",
			heightAria: "Hauteur en pixels",
		},
		pin: {
			heading: "Épingler sur tous les tableaux",
			headingDesc:
				"Afficher cette carte sur tous les tableaux de bord, avec une même définition et position.",
		},
		copy: {
			heading: "Copier vers un tableau",
			headingDesc:
				"Ajouter un double de cette carte à la fin d'un autre tableau de bord.",
			copy: "Copier",
			copyTooltip: "Copier cette carte vers le tableau sélectionné",
		},
	},

	// ---- Card bodies (rendered content) --------------------------------
	cards: {
		empty: {
			searchNoQuery: "Définissez une requête dans les paramètres de la carte",
			searchNoMatches: "Aucun résultat",
			embedPickFile: "Choisissez un fichier à intégrer dans les paramètres",
			slideshowEmpty: "Ajoutez des images dans les paramètres de la carte",
			slideshowFolderEmpty: "Aucune image dans ce dossier",
			embedEnableBases: "Activez le module principal Bases pour intégrer des fichiers .base",
			embedEnableCanvas: "Activez le module principal Canvas pour intégrer des canvas",
			embedInstallExcalidraw: "Installez le plugin Excalidraw pour intégrer des dessins",
			dailyEnable: "Activez le module principal Notes quotidiennes",
			periodicInstall: "Installez le plugin Periodic Notes",
			journalsInstall: "Installez le plugin Journals",
			scheduleNoSources:
				"Activez le module principal Notes quotidiennes, ou abonnez-vous à un calendrier dans les paramètres de cette carte",
			webNoUrl: "Définissez une URL dans les paramètres",
			bookmarksEnable: "Activez le module principal Signets",
			bookmarksEmpty: "Pas encore de signets",
			favoritesEmpty: "Ajoutez des favoris dans les paramètres",
			recentEmpty: "Aucun fichier récent",
			folderEmpty: "Ce dossier est vide",
			folderMissing: (path: string) =>
				path ? `Aucun dossier à « ${path} »` : "Choisissez un dossier dans les paramètres de la carte",
			linksEmpty: "Ajoutez des liens dans les paramètres",
			templaterEnable: "Activez le plugin Templater pour créer des notes depuis des modèles",
			templaterEmpty: "Ajoutez un modèle dans les paramètres de la carte",
			tasksEnable:
				"Activez le plugin TaskNotes, ou passez la source sur les cases à cocher",
			tasksEmpty: "Aucune tâche ouverte",
			tasksNoMatch: "Aucune tâche ne correspond au filtre",
			kanbanNoBoard:
				"Aucun Kanban trouvé — choisissez une note Kanban dans les paramètres de la carte, ou créez-en une avec le plugin Kanban",
			dataviewEnable: "Activez le plugin Dataview pour exécuter des requêtes",
			dataviewNoQuery: "Définissez une requête Dataview dans les paramètres de la carte",
			datacoreEnable: "Activez le plugin Datacore pour exécuter des requêtes",
			datacoreNoQuery: "Définissez une requête Datacore dans les paramètres de la carte",
			datacoreBadQuery: "Datacore n'a pas pu lire cette requête",
			datacoreOneQuery:
				"Une carte exécute une seule requête — celle-ci semble en contenir plusieurs. Gardez seulement celle que vous voulez, sans commentaire après.",
			datacoreFailed: "Datacore n'a pas pu exécuter cette carte",
			gitEnable: "Activez le plugin Git pour gérer le dépôt de votre coffre",
			gitNotReady: "Aucun dépôt ouvert — configurez-en un dans le plugin Git",
			rssNoSources: "Ajoutez un flux dans les paramètres de la carte",
			weatherNoLocation: "Choisissez un lieu dans les paramètres de la carte",
			marketNoSymbols: "Ajoutez une action, un fonds, une devise ou une crypto dans les paramètres de la carte",
			renderFailed: "Cette carte n'a pas pu être affichée — voir la console pour les détails",
			leafPickView: "Choisissez une vue de plugin dans les paramètres de la carte",
			boardPickView: "Choisissez une vue pour ce tableau dans ses paramètres",
			boardPickCard: "Ce tableau n'a pas encore de carte — ajoutez-en une",
			boardNeedsFile: "Choisissez un fichier pour ce tableau dans ses paramètres",
			leafViewMissing:
				"Cette vue n'est pas disponible — activez le plugin qui la fournit",
			vaultPetInstall: "Installez le plugin Vault Pet pour avoir un compagnon ici",
			vaultPetNoHouse:
				"La maison de Vault Pet n'est pas disponible — activez le plugin, ou mettez-le à jour",
			operonEnable: "Activez le plugin Operon pour afficher ses tâches",
			operonDisabled:
				"L'intégration Operon est désactivée — activez-la dans Paramètres → Hearth → Intégrations",
			operonUnsupported:
				"L'API développeur d'Operon est réservée à l'ordinateur et nécessite Obsidian 1.12.2 ou plus récent",
			operonPending:
				"Approuvez Hearth dans Paramètres → Operon → Core → General → Developer API Integrations",
			operonSuspended:
				"Operon a suspendu l'accès de Hearth — vérifiez-le dans les Developer API Integrations d'Operon",
			operonRevoked:
				"L'accès à Operon a été révoqué — accordez-le à nouveau dans les Developer API Integrations d'Operon",
			operonBooting: "Operon démarre encore",
			operonError: "Operon a refusé la connexion",
			operonNoTasks: "Aucune tâche Operon ne correspond",
			operonNoAgenda: "Rien de prévu sur cette période",
			operonNoColumns: "Aucun statut Operon à afficher — choisissez un pipeline dans les paramètres de la carte",
		},
		folder: {
			browse: "Parcourir ce dossier",
			more: (n: number) => `${n} de plus…`,
			missing: "Ce dossier n'est plus dans le coffre.",
			up: (name: string) => `Remonter à ${name}`,
			vaultRoot: "la racine du coffre",
			/** The browser's own controls, beside the breadcrumb. */
			showList: "Afficher en liste",
			showTiles: "Afficher en tuiles",
			openInTab: "Ouvrir dans un nouvel onglet",
			/** Folding a subfolder's section in the browser, one or all of them. */
			collapse: (name: string) => `Replier ${name}`,
			expand: (name: string) => `Déplier ${name}`,
			collapseAll: "Replier tous les dossiers",
			expandAll: "Déplier tous les dossiers",
		},
		operon: {
			loading: "Lecture d'Operon…",
			untitled: "Tâche sans titre",
			settling: "Operon se stabilise encore",
			timerIdle: "Aucun minuteur en cours",
			timerStarting: "Démarrage…",
			timerStopping: "Arrêt…",
			timerUnassigned: "Temps non attribué",
			truncated: (shown: number, total: number) => `${shown} sur ${total} affichées`,
			readFailed: (reason: string) => `Operon n'a pas pu répondre : ${reason}`,
			errorDetail: (code: string, reason: string) => (reason ? `${code} — ${reason}` : code),
			addTask: "Ajouter une tâche",
			moveTo: "Déplacer vers",
			targetDaily: "Operon est réglé pour mettre les nouvelles tâches en ligne dans la note du jour.",
			targetFile: (path: string) => `Operon est réglé pour mettre les nouvelles tâches en ligne dans ${path}.`,
			targetActive: "Operon est réglé pour mettre les nouvelles tâches en ligne dans le fichier actif.",
			targetAsk:
				"Operon est réglé pour demander où va chaque nouvelle tâche en ligne, ce à quoi une carte " +
				"de tableau ne peut pas répondre — choisissez plutôt « Sa propre note » sur cette carte.",
			targetNote: (folder: string) =>
				folder
					? `Operon est réglé pour créer les nouvelles tâches en notes dans ${folder}.`
					: "Operon est réglé pour créer les nouvelles tâches comme notes à part.",
			addTaskPlaceholder: "Que faut-il faire ?",
			addTaskDue: "Échéance",
			confirmTitle: "Operon demande une confirmation",
			confirmMessage: (risk: string, effects: string) =>
				effects
					? `Operon évalue ce changement comme ${risk} : ${effects}`
					: `Operon évalue ce changement comme ${risk}.`,
			confirmApply: "Appliquer",
		},
		templater: {
			untitledTile: "Nouvelle note",
			vaultRoot: "Emplacement par défaut",
			untitledNote: "Sans titre",
			createsIn: (destination: string) => `Crée ${destination}`,
			promptTitle: "Nommer la nouvelle note",
			promptPlaceholder: "De quoi s'agit-il ?",
		},
		pet: {
			species: {
				cat: "Chat",
				dog: "Chien",
				bird: "Oiseau",
				fox: "Renard",
				frog: "Grenouille",
				blob: "Blob",
			},
			moodExcited: "Bondit de joie",
			moodHappy: "Heureux",
			moodContent: "Content",
			moodBored: "S'ennuie un peu",
			moodSleepy: "Dort profondément",
			moodNight: "Endormi pour la nuit",
			petHint: "Cliquer pour caresser",
			todayCount: (count: number, metric: "modified" | "created") =>
				metric === "created"
					? `${count} nouvelle${count <= 1 ? "" : "s"} note${count <= 1 ? "" : "s"} aujourd'hui`
					: `${count} note${count <= 1 ? "" : "s"} aujourd'hui`,
			streak: (days: number) => `Série de ${days} jour${days <= 1 ? "" : "s"}`,
		},
		vaultPet: {
			openHouse: "Ouvrir la maison du compagnon",
		},
		embed: {
			openFile: "Ouvrir ce fichier",
			editHint: "Double-cliquer pour modifier",
			emptyNotePlaceholder: "Note vide…",
			emptyNoteHint: "Note vide — double-cliquer pour modifier",
			viewFallback: (n: number) => `Vue ${n}`,
			switchTo: (label: string) => `Passer à ${label}`,
		},
		slideshow: {
			previous: "Image précédente",
			next: "Image suivante",
			pause: "Mettre le diaporama en pause",
			play: "Reprendre le diaporama",
			openImage: "Ouvrir cette image",
		},
		text: {
			placeholder: "Notez quelque chose…",
		},
		calculator: {
			placeholder: "2 + 2, 10 km to miles, 10 € to USD…",
		},
		rss: {
			allTab: "Tout",
			untitled: "(sans titre)",
			loading: "Chargement du flux…",
			empty: "Aucun élément dans ce flux",
			error: "Impossible de charger ce flux",
			disabled: "Les flux sont désactivés (appels externes désactivés)",
			refresh: "Actualiser",
			nothingToOpen: "Cet article n’a ni lien ni texte à ouvrir.",
			allFeeds: "Tous les flux",
			allRead: "Tout est lu",
			unreadOnly: "Afficher les non lus seulement",
			showAll: "Afficher tous les articles",
			markAllRead: "Tout marquer comme lu",
			markRead: "Marquer comme lu",
			markUnread: "Marquer comme non lu",
			readHere: "Lire dans Hearth",
			openTab: "Lire dans un nouvel onglet",
			openBrowser: "Ouvrir dans le navigateur",
			saveNote: "Enregistrer en note",
			openNote: "Ouvrir la note enregistrée",
			copyLink: "Copier le lien",
			linkCopied: "Lien copié",
			reader: {
				title: "Lecteur",
				gone: "Cette carte de flux n'existe plus.",
				noItems: "Rien à lire ici.",
				toggleList: "Afficher ou masquer la liste",
				prevFeed: "Flux précédent",
				nextFeed: "Flux suivant",
				popOut: "Ouvrir dans un onglet",
				prev: "Précédent",
				next: "Suivant",
				position: (at: number, of: number) => `${at} sur ${of}`,
				keys: "← → articles · [ ] flux · o ouvrir · s enregistrer · u non lu · i images · l liste",
				imagesBlocked: (n: number) => (n === 1 ? "1 image non chargée." : `${n} images non chargées.`),
				loadImages: "Charger les images",
				noteSaved: (path: string) => `Enregistré sous ${path}`,
				noteFailed: "Impossible de créer la note.",
			},
		},
		market: {
			types: {
				equity: "Action",
				etf: "ETF",
				fund: "Fonds",
				index: "Indice",
				currency: "Devise",
				crypto: "Crypto",
				future: "Contrat à terme",
				other: "",
			},
			states: {
				open: "Ouvert",
				pre: "Pré-ouverture",
				post: "Après clôture",
				closed: "Fermé",
			},
			ranges: {
				"1d": "1J",
				"5d": "5J",
				"1mo": "1M",
				"6mo": "6M",
				"1y": "1A",
				"5y": "5A",
			},
			rangeNames: {
				"1d": "Un jour",
				"5d": "Cinq jours",
				"1mo": "Un mois",
				"6mo": "Six mois",
				"1y": "Un an",
				"5y": "Cinq ans",
			},
			sources: {
				yahoo: "Yahoo Finance",
				tencent: "Tencent",
				eastmoney: "Eastmoney",
				coingecko: "CoinGecko",
				frankfurter: "BCE (Frankfurter)",
			},
			updated: (time: string) => `Mis à jour ${time}`,
			loadingShort: "Chargement…",
			unavailable: "Indisponible",
			disabled: "Les appels externes sont désactivés — impossible de récupérer les cours",
			noChart: "Pas de graphique pour cette période",
			dayRange: "Fourchette du jour",
			yearRange: "Fourchette sur 52 semaines",
			open: "Ouverture",
			prevClose: "Clôture précédente",
			volume: "Volume",
			currency: "Devise",
			source: "Source",
			asOf: "Au",
			totalValue: "Valeur totale",
			noHoldings: "Indiquez combien d'unités vous détenez dans les paramètres de la carte",
			today: "Aujourd'hui",
			totalGain: "Total",
			notConverted: (n: number) =>
				n <= 1 ? `${n} position exclue : pas de taux de change pour sa devise` : `${n} positions exclues : pas de taux de change pour leur devise`,
			units: (n: number) => `${n.toLocaleString()} unités`,
			position: "Votre position",
			unitsLabel: "Unités",
			value: "Valeur",
			avgCost: "Coût moyen",
			costBasis: "Prix de revient",
			openInBrowser: "Ouvrir dans le navigateur",
			refresh: "Actualiser",
			searchPlaceholder: "Chercher une action, un fonds, une devise ou une crypto",
			searchDisabled: "La recherche est désactivée tant que les appels externes le sont",
			searching: "Recherche…",
			noResults: "Rien trouvé",
			lookupHint: "Cherchez n'importe quoi ci-dessus — un nom, un symbole, un code de fonds, une paire de devises — et ajoutez-le en un clic.",
			back: "Retour",
			addToCard: "Ajouter à la carte",
			onCard: "Sur la carte",
			added: (name: string) => `${name} ajouté`,
		},
		tension: {
			title: "Tension mondiale",
			bands: {
				cool: "Calme",
				mild: "Modérée",
				warm: "Tendue",
				hot: "Brûlante",
				burning: "En feu",
			},
			loading: "Lecture de l'actualité…",
			error: "Impossible de charger l'indice World Tension",
			disabled: "Tension mondiale désactivée (appels externes désactivés)",
			none: "Kagi n'a pas publié d'indice World Tension pour l'instant",
			open: "Ouvrir l'indice World Tension sur Kagi News",
			aria: (score: number, band: string) => `Tension mondiale ${score} sur 100, ${band}`,
			source: "Évaluation IA · Kagi News",
			updated: (when: string) => `Mis à jour ${when}`,
			historyTip: (days: number, lo: number, hi: number) => `${days} derniers jours : ${lo}–${hi}`,
			changeTip: "Variation depuis la veille",
		},
		weather: {
			loading: "Chargement des prévisions…",
			error: "Impossible de charger les prévisions",
			disabled: "Météo désactivée (appels externes désactivés)",
			now: "Maintenant",
			todayLabel: "Aujourd'hui",
			feelsLike: (temp: string) => `Ressenti ${temp}`,
			highLow: (high: string, low: string) => `Max ${high} · Min ${low}`,
			updated: (time: string) => `Mis à jour ${time}`,
			humidity: "Humidité",
			wind: "Vent",
			precip: "Précipitations",
			uv: "UV",
			pressure: "Pression",
			sunrise: "Lever du soleil",
			sunset: "Coucher du soleil",
			compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
			duration: (h: number, m: number) => (h ? `${h} h ${m} min` : `${m} min`),
			moon: {
				label: "Lune",
				phases: {
					new: "Nouvelle lune",
					waxingCrescent: "Premier croissant",
					firstQuarter: "Premier quartier",
					waxingGibbous: "Gibbeuse croissante",
					full: "Pleine lune",
					waningGibbous: "Gibbeuse décroissante",
					lastQuarter: "Dernier quartier",
					waningCrescent: "Dernier croissant",
				},
				illuminated: (percent: string) => `${percent} éclairée`,
				age: (days: number) => `Jour ${days} sur 29`,
				nextFull: "Pleine lune",
				nextNew: "Nouvelle lune",
				moonrise: "Lever de lune",
				moonset: "Coucher de lune",
				inDays: (days: number) =>
					days <= 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`,
				cycle: "La position de ce soir dans le mois lunaire",
			},
			daylight: {
				until: (span: string) => `dans ${span}`,
				dayLength: (span: string) => `${span} de jour`,
				polarDay: "Le soleil ne se couche pas aujourd'hui",
				polarNight: "Le soleil ne se lève pas aujourd'hui",
				arc: "La course du soleil du lever au coucher",
			},
			detail: {
				title: "Prévisions",
				open: "Ouvrir les prévisions complètes",
				now: "En ce moment",
				days: "La semaine à venir",
				hoursFor: (day: string) => `Heure par heure · ${day}`,
				selectDay: (day: string) => `Afficher ${day} heure par heure`,
				noHours: "Plus aucune heure dans cette journée",
				refresh: "Actualiser",
				source: "Open-Meteo",
				feelsLikeLabel: "Ressenti",
				gust: "Rafales",
				cloudCover: "Couverture nuageuse",
				precipChance: "Probabilité de pluie",
				precipHour: "Pluie cette heure",
				precipTotal: "Pluie totale",
				windMax: "Vent le plus fort",
				uvMax: "UV max",
				columnTime: "Heure",
				columnCondition: "Conditions",
				columnTemp: "Temp.",
				columnFeels: "Ressenti",
				columnPrecip: "Pluie",
				columnWind: "Vent",
				columnHumidity: "Humidité",
				columnUv: "UV",
			},
			conditions: {
				clear: "Dégagé",
				mainlyClear: "Plutôt dégagé",
				partlyCloudy: "Partiellement nuageux",
				overcast: "Couvert",
				fog: "Brouillard",
				rimeFog: "Brouillard givrant",
				drizzle: "Bruine",
				freezingDrizzle: "Bruine verglaçante",
				rain: "Pluie",
				heavyRain: "Forte pluie",
				freezingRain: "Pluie verglaçante",
				showers: "Averses",
				snow: "Neige",
				heavySnow: "Fortes chutes de neige",
				snowGrains: "Neige en grains",
				snowShowers: "Averses de neige",
				thunderstorm: "Orage",
				thunderstormHail: "Orage avec grêle",
				unknown: "Inconnu",
			},
		},
		jira: {
			controls: {
				status: "Statut",
				assignee: "Responsable",
				priority: "Priorité",
				issueType: "Type de ticket",
				sprint: "Sprint",
				fixVersion: "Version corrective",
			},
			controlCount: (label: string, count: number) => `${label} (${count})`,
			searchPlaceholder: "Chercher des options…",
			searchAria: (label: string) => `Chercher dans les options ${label}`,
			noOptions: "Aucune option",
			noMatchingOptions: "Aucune option correspondante",
			refresh: "Actualiser les tickets Jira",
			loading: "Chargement des tickets Jira…",
			error: "Impossible de charger les tickets Jira",
			empty: "Aucun ticket ne correspond à ces filtres",
			disabled: "Jira est désactivé (appels externes désactivés)",
			notConfigured: "Configurez un hôte Jira, un jeton et un filtre enregistré dans les paramètres de la carte",
		},
		git: {
			sections: {
				status: "État du dépôt",
				actions: "Boutons",
				changes: "Fichiers modifiés",
				log: "Commits récents",
			},
			actions: {
				commitAndSync: "Commit et synchro",
				commit: "Commit",
				push: "Push",
				pull: "Pull",
				fetch: "Fetch",
				stageAll: "Tout indexer",
				unstageAll: "Tout désindexer",
				discardAll: "Abandonner toutes les modifications",
				switchBranch: "Changer de branche",
				sourceControl: "Ouvrir le contrôle de source",
				history: "Ouvrir l'historique",
			},
			refresh: "Relire le dépôt",
			noBranch: "Aucune branche",
			noUpstream: "Aucune branche distante",
			staged: "indexés",
			unstaged: "modifiés",
			conflicted: "en conflit",
			unpushed: "commits non poussés",
			clean: "Tout est commité",
			noChanges: "Rien n'a changé",
			noCommits: "Pas encore de commit",
			noMessage: "(pas de message)",
			lastCommit: (when: string) => `Dernier commit ${when}`,
			more: (count: number) => `${count} de plus…`,
			openSourceControl: "Ouvrir le contrôle de source",
			openHistory: "Ouvrir l'historique",
			openDiff: "Voir les différences",
			stageFile: "Indexer",
			unstageFile: "Désindexer",
			discardFile: "Abandonner les modifications",
			confirmTitle: "Abandonner les modifications ?",
			confirmDiscard:
				"Toutes les modifications non commitées du coffre seront perdues. Action irréversible.",
			confirmDiscardFile: (name: string) =>
				`Les modifications non commitées de « ${name} » seront perdues. Action irréversible.`,
			confirmDiscardButton: "Abandonner les modifications",
			unsupported: "Cette version du plugin Git ne le permet pas",
		},
		daily: {
			createToday: "Créer la note du jour",
			openToday: "Ouvrir la note du jour",
			noNoteYet: "Pas encore de note pour aujourd'hui",
		},
		periodic: {
			period: {
				day: "du jour",
				week: "de cette semaine",
				month: "de ce mois-ci",
				quarter: "de ce trimestre",
				year: "de cette année",
			},
			noNoteYet: (period: string) => `Pas encore de note ${period}`,
			create: (period: string) => `Créer la note ${period}`,
			open: (period: string) => `Ouvrir la note ${period}`,
			notEnabled: (granularity: string) =>
				`Activez les notes « ${granularity} » dans Periodic Notes`,
			loading: "Recherche de la note du journal…",
			pickJournal: "Choisissez un journal dans les paramètres de cette carte",
			noSuchJournal: (journal: string) => `Aucun journal nommé « ${journal} »`,
			noJournalNoteYet: (journal: string) => `Pas encore de note actuelle dans ${journal}`,
			createJournalNote: "La créer",
			openJournalNote: (journal: string) => `Ouvrir la note actuelle de ${journal}`,
		},
		heatmap: {
			less: "Moins",
			more: "Plus",
			unitModified: "notes modifiées",
			unitCreated: "notes créées",
			unitNotes: "notes",
			dayValue: (date: string, value: string, unit: string) => `${date} : ${value} ${unit}`,
		},
		calendar: {
			previousMonth: "Mois précédent",
			nextMonth: "Mois suivant",
			backToToday: "Revenir à aujourd'hui",
			dayEdited: (date: string, count: number) =>
				`${date} : ${count} modifiée${count <= 1 ? "" : "s"}`,
			dayTasks: (date: string, count: number) =>
				count <= 1 ? `${date} : ${count} tâche` : `${date} : ${count} tâches`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date} : ${count} ${metric}`,
			dayEvents: (date: string, count: number) =>
				`${date} : ${count} ${count <= 1 ? "événement" : "événements"}`,
			agendaNoNote: "Pas de note",
			allDay: "Toute la journée",
			untitledEvent: "(Sans titre)",
			openDailyNote: "Ouvrir la note quotidienne",
			createDailyNote: "Créer la note quotidienne",
			eventsHeading: "Événements",
			eventNotes: "Notes",
			createEventNote: "Créer une note",
			openEventNote: "Ouvrir la note",
			taskNotesSource: "TaskNotes",
			checkboxSource: "Tâches",
			taskDue: "Échéance",
			taskTimeblock: "Bloc horaire",
			taskComplete: "Terminer",
			taskReopen: "Rouvrir",
			taskEstimate: (minutes: number) =>
				minutes >= 60
					? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`
					: `${minutes}min`,
			openTaskLine: "Ouvrir dans la note",
			openTaskNote: "Ouvrir la tâche",
		},
		schedule: {
			previous: "Précédent",
			next: "Suivant",
			today: "Aujourd'hui",
			views: {
				month: "Mois",
				week: "Semaine",
				day: "Jour",
				list: "Liste",
			},
			more: (count: number) => `+${count} de plus`,
			listEmpty: (days: number) => `Rien dans les ${days} prochains jours`,
		},
		stats: {
			notes: "Notes",
			attachments: "Pièces jointes",
			folders: "Dossiers",
			tags: "Tags",
			dayStreak: "Jours d'affilée",
			daysUsing: "Jours d'utilisation d'Obsidian",
		},
		web: {
			openInBrowser: "Ouvrir dans le navigateur",
			mayRefuse: "Ce site peut refuser d'être intégré.",
		},
		bookmarks: {
			untitled: "Sans titre",
			needsSearch: "Activez le module principal Recherche pour ouvrir une recherche enregistrée",
			needsGraph: "Activez le module principal Vue graphique pour ouvrir un graphe enregistré",
		},
		tasks: {
			createNewTask: "Créer une tâche",
			toDo: "À faire",
			done: "Terminé",
			statusInProgress: "En cours",
			noStatus: "Sans statut",
			hideColumn: (label: string) => `Masquer la colonne « ${label} »`,
			markOccurrence: "Marquer l'occurrence du jour comme terminée",
			recurring: "Récurrente",
			addCard: "Ajouter une carte",
			addCardPlaceholder: "Texte de la carte…",
			createAsNote: "Créer comme note",
			noteBody: "Corps de la note",
			convertToNote: "Convertir en note",
			editMetadata: "Modifier dates et priorité",
			deleteCard: "Supprimer la carte",
			openNote: "Ouvrir la note",
			deleteTask: "Supprimer la tâche",
			deleteTaskConfirm: "Supprimer cette tâche ? Elle sera retirée de la note.",
			noMetadata: "Aucune date ni priorité définie.",
			save: "Enregistrer",
			cancel: "Annuler",
			setDoneColumn: (label: string) => `Faire de « ${label} » une colonne « terminé »`,
			unsetDoneColumn: (label: string) =>
				`« ${label} » ne termine plus automatiquement les cartes`,
			dueDate: "Échéance",
			startDate: "Date de début",
			scheduledDate: "Date planifiée",
			doneDate: "Date d'achèvement",
			recurrenceLabel: "Répéter",
			recurrenceNever: "Jamais",
			recurrenceEvery: "tous les",
			recurrenceInterval: "Intervalle de répétition",
			recurrenceUnits: {
				day: "Quotidienne",
				week: "Hebdomadaire",
				month: "Mensuelle",
				year: "Annuelle",
			},
			taskCount: (n: number) => (n <= 1 ? `${n} tâche` : `${n} tâches`),
			description: "Description",
			descriptionPlaceholder: "Notes… (texte simple)",
			tags: "Tags",
			tagsPlaceholder: "#travail #maison/courses",
			renameColumnHint: "Double-cliquer pour renommer",
			editTitle: "Modifier le titre",
			editTitleHint: "Double-cliquer pour modifier",
			titlePlaceholder: "Titre de la carte…",
			priority: "Priorité",
			priorityNone: "Sans priorité",
			priorityHighest: "Priorité maximale",
			priorityHigh: "Priorité haute",
			priorityMedium: "Priorité moyenne",
			priorityLow: "Priorité basse",
			priorityLowest: "Priorité minimale",
			sort: "Trier",
			sortReverse: "Inverser l'ordre",
			sortLabels: {
				smart: "Intelligent",
				due: "Échéance",
				priority: "Priorité",
				created: "Date de création",
				alpha: "Alphabétique",
			},
			sortCustom: "Personnalisé",
			sortCustomOption: "Tri personnalisé…",
			sortTitle: "Tri personnalisé",
			sortHint:
				"Trier les tâches selon ces règles dans l'ordre — la première est le tri principal, chaque suivante départage les égalités.",
			sortFields: {
				due: "Échéance",
				scheduled: "Date planifiée",
				priority: "Priorité",
				created: "Date de création",
				alpha: "Alphabétique",
				status: "Statut",
			},
			sortAscending: "Croissant",
			sortDescending: "Décroissant",
			sortLevelFirst: "Trier par",
			sortLevelNext: "puis par",
			sortAddRule: "Ajouter une règle",
			sortRemoveRule: "Retirer la règle",
			sortMoveUp: "Monter",
			sortMoveDown: "Descendre",
			sortEmpty: "Pas encore de règle — ajoutez-en une, sinon le tri Intelligent par défaut est utilisé.",
			filter: "Filtrer",
			filterTitle: "Filtrer les tâches",
			filterPresets: {
				overdue: "En retard",
				today: "Aujourd'hui",
				week: "Cette semaine",
				highPriority: "Priorité haute",
				noDate: "Sans date",
			},
			filterDue: "Date",
			filterDueDesc: "Correspond à l'échéance ou à la date planifiée d'une tâche.",
			filterDueAny: "Toutes",
			filterDueHasDate: "A une date",
			filterPriority: "Priorité",
			filterPriorityLevels: {
				high: "Haute",
				medium: "Moyenne",
				low: "Basse",
				none: "Aucune",
			},
			filterStatus: "Statut",
			filterContexts: "Contextes",
			filterProjects: "Projets",
			filterTags: "Tags",
			filterText: "Le texte contient",
			filterTextPlaceholder: "Chercher dans le texte des tâches…",
			filterApply: "Appliquer",
			filterClear: "Effacer",
			valueChange: "Changer la valeur",
			dateTitle: "Définir la date",
			dateOn: "Date",
			dateToday: "Aujourd'hui",
			dateTomorrow: "Demain",
			dateNextWeek: "Semaine prochaine",
			dateClear: "Effacer la date",
			valueCustom: "Autre valeur…",
			valueCustomTitle: "Définir la valeur",
			valueClear: "Effacer la valeur",
		},
	},

	// ---- Relative dates (tasks card) -----------------------------------
	dates: {
		today: "Aujourd'hui",
		tomorrow: "Demain",
		yesterday: "Hier",
		daysAgo: (n: number) => `Il y a ${n} jours`,
		nextWeekday: (weekday: string) => `${weekday} prochain`,
		lastWeekday: (weekday: string) => `${weekday} dernier`,
	},

	// ---- Recurrence rule labels (tasks card) ---------------------------
	recurrence: {
		repeats: "Se répète",
		units: {
			day: "jour",
			week: "semaine",
			month: "mois",
			year: "année",
		},
		everyOne: (unit: string) => `Se répète chaque ${unit}`,
		everyMany: (count: number, unit: string) => {
			const feminine = unit === "semaine" || unit === "année";
			const plural = unit.endsWith("s") ? unit : `${unit}s`;
			return `Se répète ${feminine ? "toutes" : "tous"} les ${count} ${plural}`;
		},
	},

	// ---- Clock greetings -----------------------------------------------
	clock: {
		greetingMorning: "Bonjour",
		greetingAfternoon: "Bon après-midi",
		greetingEvening: "Bonsoir",
		playfulGreetings: [
			[
				"Session nocturne ?",
				"On veille tard ce soir ?",
				"Le coffre ne dort jamais, hein ?",
				"Vous devriez sans doute dormir.",
			],
			[
				"Déjà au travail à cette heure-ci ?",
				"Levé avec le soleil, à ce que je vois ?",
				"Un café d'abord, j'espère ?",
				"Audacieux d'être déjà debout.",
			],
			[
				"Bonjour. Faisons semblant d'être productifs.",
				"Vos notes vous attendaient.",
				"C'est reparti.",
				"Un jour de plus, un coffre de plus.",
			],
			[
				"L'après-midi, on s'accroche.",
				"Toujours là ?",
				"Productivité après le déjeuner — ambitieux.",
				"À mi-chemin, sans doute.",
			],
			[
				"Encore vous ?",
				"Bonsoir. On termine ou on commence ?",
				"Une dernière note, alors ?",
				"La journée ralentit. Pas vous.",
			],
			[
				"Encore tard ?",
				"La journée est finie, pas les idées.",
				"Vous ne devriez pas vous reposer ?",
				"Vous brûlez la chandelle par les deux bouts.",
			],
		] as string[][],
	},

	// ---- Card templates (Add card menu) --------------------------------
	templates: {
		note: "Note intégrée",
		image: "Image intégrée",
		slideshow: "Diaporama",
		base: "Base intégrée",
		excalidraw: "Dessin Excalidraw",
		canvas: "Canvas intégré",
		daily: "Note quotidienne (aujourd'hui)",
		periodic: "Note périodique",
		journal: "Note de journal",
		web: "Page web (iframe)",
		bookmarks: "Signets",
		favorites: "Favoris",
		recent: "Fichiers récents",
		folder: "Dossier",
		links: "Liens / lanceur",
		templater: "Nouvelle note depuis un modèle",
		clock: "Horloge et accueil",
		tasks: "Tâches",
		calendar: "Mini-calendrier",
		schedule: "Calendrier",
		stats: "Statistiques du coffre",
		search: "Requête",
		searchbar: "Barre de recherche",
		heatmap: "Carte d'activité",
		text: "Texte / pense-bête",
		calculator: "Calculatrice",
		dataview: "Requête Dataview",
		datacore: "Requête Datacore",
		rss: "Flux RSS",
		jira: "Filtre Jira",
		weather: "Météo",
		market: "Marchés",
		tension: "Tension mondiale",
		git: "Git",
		"operon-tasks": "Tâches Operon",
		"operon-board": "Kanban Operon",
		"operon-agenda": "Agenda Operon",
		"operon-timer": "Minuteur Operon",
		leaf: "Vue de plugin (bêta)",
		pet: "Compagnon",
		"vault-pet": "Vault Pet",
		"vault-pet-house": "Maison Vault Pet",
	},

	templateDescriptions: {
		note: "N'importe quelle note, affichée en direct sur le tableau",
		image: "Une image du coffre, bord à bord",
		slideshow: "Des images d'une liste ou d'un dossier, qui défilent avec un minuteur",
		base: "Un fichier .base, affiché par Bases d'Obsidian",
		excalidraw: "Un dessin Excalidraw avec zoom et déplacement natifs",
		canvas: "Un canvas que l'on peut parcourir sur place",
		daily: "Toujours la note du jour, créée au premier clic",
		periodic: "La note de la semaine, du mois ou de l'année, via Periodic Notes",
		journal: "La note actuelle d'un journal, via le plugin Journals",
		web: "Une page web dans une iframe, actualisée avec un minuteur",
		bookmarks: "Vos signets Obsidian, à un clic",
		favorites: "Les notes mises en favori dans Hearth",
		recent: "Les fichiers ouverts le plus récemment",
		folder: "Le contenu d'un dossier, sur un niveau, avec un navigateur derrière",
		links: "Un lanceur de liens, notes, commandes et dossiers",
		templater: "Des boutons qui créent une note depuis un modèle Templater, dans le dossier choisi",
		clock: "L'heure, la date et un message d'accueil",
		tasks: "Les cases à cocher de votre coffre, en liste ou en tableau",
		calendar: "Un mois d'un coup d'œil, avec vos notes",
		schedule: "Mois, semaine, jour et liste, avec vos événements",
		stats: "Nombre de notes, de mots et de fichiers du coffre",
		search: "Une requête enregistrée, tenue à jour",
		searchbar: "Un champ de recherche sur le tableau, avec ou sans cadre",
		heatmap: "Une année d'activité du coffre, jour par jour",
		text: "Un bloc-notes qui vit sur le tableau",
		calculator: "Calculs, conversions d'unités et taux de change",
		dataview: "Une requête DQL ou DataviewJS, affichée par Dataview",
		datacore: "Une requête ou un script Datacore",
		rss: "Les titres des flux que vous suivez",
		jira: "Les tickets d'un filtre Jira ou d'une recherche JQL",
		weather: "Les prévisions pour le lieu choisi",
		market: "Actions, fonds, devises et cryptos, en direct",
		tension: "L'évaluation IA de Kagi News sur la tension dans le monde",
		git: "L'état du dépôt, avec commit, pull et push",
		"operon-tasks": "Vos tâches Operon, filtrées à votre guise",
		"operon-board": "Les statuts de pipeline d'Operon en colonnes",
		"operon-agenda": "Les prochains jours de travail Operon, jour par jour",
		"operon-timer": "Le minuteur d'Operon en cours, en direct",
		leaf: "Le panneau latéral d'un autre plugin, hébergé dans une carte",
		pet: "Un petit compagnon qui vit sur votre tableau",
		"vault-pet": "Le compagnon du plugin Vault Pet, qui grandit quand vous écrivez",
		"vault-pet-house": "La maison de Vault Pet — quêtes, index, badges et statistiques",
	},

	// ---- Add-card picker -----------------------------------------------
	cardPicker: {
		title: "Ajouter une carte",
		searchPlaceholder: "Chercher des cartes…",
		allCards: "Toutes les cartes",
		noMatches: "Aucune carte ne correspond.",
		requires: (name: string) => `Nécessite ${name}`,
		missingNotice: (name: string) =>
			`${name} n'est pas disponible — la carte affichera un message tant que ce ne sera pas le cas.`,
		installLink: (name: string) => `Installer ${name}`,
		categories: {
			notes: "Notes et fichiers",
			planning: "Planification",
			vault: "Aperçu du coffre",
			tools: "Outils",
			integrations: "Intégrations",
			fun: "Détente",
		},
		request: {
			railLabel: "Demander une carte",
			heading: "Demander une carte",
			intro:
				"Il vous manque quelque chose ? Décrivez la carte que vous aimeriez dans Hearth — ce " +
				"qu'elle afficherait et d'où viendraient ses données.",
			footPrompt: "Pas ce que vous cherchiez ?",
			footLink: "Demander une carte",
			githubTitle: "Ouvrir un ticket GitHub",
			githubDesc:
				"Public, consultable, et le meilleur endroit pour discuter de l'idée. Nécessite un compte GitHub.",
			githubAction: "Ouvrir GitHub",
			emailTitle: "Envoyer un e-mail",
			emailDesc: "Directement au mainteneur, si vous préférez ne pas utiliser GitHub. Ouvre votre application de messagerie.",
			emailAction: "Ouvrir l'e-mail",
			prefilledNote:
				"Les deux s'ouvrent pré-remplis avec quelques questions et vos versions de Hearth et d'Obsidian — modifiez ce que vous voulez avant l'envoi.",
		},
	},

	// ---- File-type filter labels ---------------------------------------
	fileTypes: {
		folders: "Dossiers",
		markdown: "Notes",
		excalidraw: "Excalidraw",
		canvas: "Canvas",
		bases: "Bases",
		images: "Images",
		videos: "Vidéos",
		audio: "Audio",
		pdf: "PDF",
		documents: "Documents",
		spreadsheets: "Tableurs",
		presentations: "Présentations",
		threeD: "3D",
		other: "Autres",
	},

	// ---- Export / import (portable packages) ---------------------------
	portable: {
		exportModal: {
			title: "Partager le tableau de bord",
			saveFile: "Enregistrer un fichier",
			publishRemovesTitle: "Retiré avant de quitter ce coffre",
			publishRemovesTune:
				"Les détails ci-dessous listent ces mêmes groupes, avec les valeurs exactes sous chacun, et vous permettent de choisir ce qui part.",
			publishRemoves: [
				"Chemins de notes et de dossiers — tout ce que le tableau désigne dans votre coffre",
				"Flux de calendrier, hôtes privés, votre lieu et vos positions",
				"Le texte saisi sur le tableau — le contenu d'une carte texte, le dernier calcul d'une calculatrice",
				"Identifiants — un jeton Jira, et tout ce qu'une carte peut contenir d'autre",
			],
			publishKeeps:
				"Conservé, car c'est ce qui fait le tableau : la disposition, le style, les couleurs, les images, les paramètres des cartes, les recherches et requêtes, et toute page ou flux public qu'il affiche. Ouvrez les détails ci-dessous pour voir les valeurs exactes et choisir ce qui part.",
			intro:
				"Enregistre ce tableau de bord dans un fichier. Toute son apparence l'accompagne, il s'affiche donc de la même façon dans un autre coffre.",
			name: "Nom",
			nameDesc: "Le nom de ce tableau dans le fichier. Par défaut, le nom du tableau.",
			description: "Description",
			descriptionDesc: "Facultatif. Une ou deux lignes sur l'usage de ce tableau.",
			snapshot: "Image de ce tableau",
			snapshotDesc:
				"Une capture du tableau tel qu'il est — défilée, pour qu'un long tableau soit capturé en entier. Le contenu de vos cartes est d'abord masqué ; l'en-tête, la barre d'outils et le titre de chaque carte restent, ainsi qu'une carte ne contenant rien de personnel, comme une horloge.",
			snapshotCheck:
				"Regardez-la avant de publier. Tout ce que vous pouvez y lire, tout le monde le pourra — cliquez pour la voir en taille réelle.",
			snapshotTake: "Prendre l'image",
			snapshotRetake: "La reprendre",
			snapshotWorking: "Capture en cours…",
			snapshotEnlarge: "Ouvrir l'image en taille réelle",
			snapshotTaken: (kb: number) =>
				`${kb} Ko — c'est exactement ce qui sera publié, et ce que verront tous ceux qui parcourent la galerie.`,
			snapshotConfirm: "J'ai vérifié — rien de privé n'y est lisible",
			snapshotConfirmDesc:
				"Cliquez sur l'image pour la voir en taille réelle et la lire. Les titres des cartes, l'en-tête et ce qu'une carte affiche qui ne vous appartient pas sont censés y être ; le texte d'une note, une tâche, un nom de fichier, un événement, un chiffre de votre vie ne le sont pas. La publication attend votre confirmation.",
			snapshotConfirmRequired:
				"Regardez d'abord l'image, puis activez « J'ai vérifié ».",
			snapshotLeak:
				"Si quelque chose de personnel y est lisible, ne publiez pas ce tableau : l'image ne peut pas être retirée une fois installée par d'autres. Signalez-le plutôt — c'est un bug du masquage, et il vaut la peine d'être corrigé avant que cela n'arrive à quelqu'un d'autre.",
			snapshotLeakReport: "Le signaler sur GitHub",
			snapshotFailed: "Hearth n'a pas pu capturer le tableau.",
			snapshotRequired:
				"Une entrée de galerie nécessite une image du tableau. Prenez-en une d'abord — vous pourrez la regarder avant l'envoi.",
			snapshotUnavailable:
				"La publication nécessite une image du tableau, et cette version ne peut pas en prendre — les captures nécessitent l'application de bureau. Vous pouvez quand même enregistrer le tableau dans un fichier et le publier depuis un coffre sur ordinateur.",
			snapshotNotActive:
				"La publication nécessite une image du tableau, et Hearth ne peut photographier que le tableau ouvert. Passez d'abord sur ce tableau, puis publiez-le.",
			theme: "Recommandé avec mon thème",
			themeDesc: (name: string) =>
				`Indiquer que le tableau est conçu pour ${name}, le thème que vous utilisez. C'est une indication pour qui l'installe — rien n'est installé ni modifié de son côté.`,
			themeNone:
				"Vous utilisez l'apparence par défaut d'Obsidian, il n'y a donc pas de thème à recommander. Passez d'abord à un thème communautaire si le tableau est conçu pour l'un d'eux.",
			tags: "Tags",
			tagsDesc: "Facultatif, séparés par des virgules. Utile si le tableau va quelque part où il peut être parcouru.",
			tagsPlaceholder: "écriture, minimal, sombre",

			// ---- Identity ----
			identity: "Publié sous",
			identityDesc:
				"Créé pour vous à partir d'une clé qui reste dans ce coffre. C'est le même pseudonyme sur tout " +
				"ce que vous publiez, il ne dit rien de qui vous êtes, et comme chaque fichier est signé avec " +
				"cette clé, personne d'autre ne peut publier sous ce nom. Copiez la clé pour utiliser le pseudonyme " +
				"sur une autre installation.",
			identityNew:
				"Vous n'en avez pas encore. C'est un pseudonyme anonyme créé à partir d'une clé qui ne quitte jamais " +
				"ce coffre — pas de compte, pas d'e-mail, rien sur qui vous êtes.",
			identityCreate: "Créer mon pseudonyme",
			identityCreated: (handle: string) =>
				`Vous publiez sous ${handle}. Copiez votre clé de récupération et gardez-la en lieu sûr — c'est le seul moyen de récupérer ce pseudonyme.`,
			identityCopy: "Copier ma clé de récupération",
			identityUnsaved:
				"Enregistrez votre clé de récupération en lieu sûr avant d'en avoir besoin. Elle n'existe que dans ce " +
				"coffre : si vous la perdez, pas de réinitialisation ni personne à qui demander — le pseudonyme, et tout " +
				"ce que vous avez publié sous ce nom, serait perdu.",
			identityCopied:
				"Clé de récupération copiée. Gardez-la en lieu sûr — c'est le seul moyen de récupérer ce pseudonyme.",
			identityCopyFailed: (key: string) => `Votre clé de récupération : ${key}`,
			identityRestore: "Utiliser une clé d'une autre installation",
			identityReplaceTitle: "Remplacer votre pseudonyme ?",
			identityReplaceWarning:
				"Vous n'avez pas encore copié votre clé de récupération actuelle, et en coller une autre par-dessus est irréversible — ce coffre en détient la seule copie. Ce que vous avez déjà publié sous le pseudonyme actuel resterait publié, mais vous ne pourriez plus jamais publier sous ce nom. Copiez d'abord la clé si vous pourriez en avoir besoin.",
			identityReplaceConfirm: "La remplacer",
			identityRestoreLabel: "Clé de récupération",
			identityRestored: (name: string) => `Vous publiez désormais sous ${name}.`,
			identityRestoreFailed: "Ce n'est pas une clé de récupération Hearth.",

			// ---- What travels ----
			contents: "Quoi inclure",
			embedAssets: "Inclure le fond d'écran et les images",
			embedAssetsDesc:
				"Place dans le fichier l'image d'arrière-plan du tableau, les icônes en image et les images de diaporama explicites, pour qu'il s'affiche correctement dans un coffre qui ne les a jamais vues. Grossit le fichier. Désactivez pour une sauvegarde de votre propre coffre, où les images sont déjà en place.",
			referenceNote: (paths: number, feeds: number) => {
				const parts: string[] = [];
				if (paths > 0) {
					parts.push(paths === 1 ? "1 chemin de ce coffre" : `${paths} chemins de ce coffre`);
				}
				if (feeds > 0) {
					parts.push(feeds === 1 ? "1 URL de flux de calendrier" : `${feeds} URL de flux de calendrier`);
				}
				return `En l'état, ce fichier mentionnera ${parts.join(" et ")}. C'est ce qui le rend utilisable comme sauvegarde personnelle — et ce que l'option ci-dessus retire pour un tableau que vous publiez.`;
			},
			stripPrivate: "Exclure mes informations privées",
			stripPrivateDesc:
				"Retire les parties du tableau qui vous concernent plutôt que le design : les chemins de notes et de dossiers qu'il désigne, les liens de flux de calendrier, votre lieu, et tout ce que vous avez saisi dans une carte texte. Le tableau garde exactement la même apparence — les cartes arrivent simplement sans cible, ce que la personne qui le télécharge doit de toute façon renseigner. Laissez désactivé pour une copie de votre propre tableau, qui a besoin de ses chemins pour fonctionner.",

			// ---- The details disclosure ----
			detailsSummary: "Voir et régler exactement ce qui part",
			flatten: "Copier les paramètres d'apparence de ce coffre dans le tableau",
			flattenDesc:
				"L'essentiel de l'apparence d'un tableau — la grille, l'espacement, les surfaces des cartes, l'arrière-plan, l'en-tête — est un paramètre global du coffre, et le tableau ne stocke que ce qu'il remplace. Ceci écrit les valeurs effectives dans le tableau lui-même, pour qu'il ait la même apparence dans le coffre de quelqu'un d'autre au lieu de prendre ses paramètres. Désactivé, le tableau n'emporte que ses propres remplacements et s'adapte à son lieu d'arrivée.",
			groupPinned: "Toujours retiré lors d'une publication.",
			stripIntro:
				"Chaque groupe ci-dessous est retiré du fichier. Ce qui sera retiré est listé en dessous — c'est la liste réelle, lue depuis ce tableau.",
			carriedIntro:
				"Rien n'est exclu, voici donc tout ce qui, dans le fichier, pointe vers l'extérieur. Activez « Exclure mes informations privées » ci-dessus pour retirer les trois premiers groupes.",
			carriedNothing: "Ce tableau ne pointe vers rien d'extérieur.",
			groups: {
				paths: "Retirer les chemins de notes et de dossiers",
				private: "Retirer les flux de calendrier, hôtes privés, votre lieu et vos positions",
				content: "Retirer le texte saisi sur le tableau",
				queries: "Retirer les recherches et requêtes Dataview",
				plugins: "Retirer les id de commandes et types de vues",
			},
			groupDesc: {
				paths: "Tout ce que ce tableau désigne dans votre coffre, et le dossier d'origine de chaque image intégrée. Les images elles-mêmes partent quand même si l'option fond d'écran ci-dessus est active — c'est leur dossier qui est retiré.",
				private: "Liens de calendrier ICS (qui en détient un peut lire ce calendrier), un hôte Jira interne, le lieu d'une carte météo, et les quantités et coûts d'un portefeuille.",
				content: "Le contenu d'une carte texte et la dernière saisie d'une calculatrice — ce que vous avez noté sur votre propre tableau.",
				queries: "Désactivé par défaut : un tableau sans ses requêtes ne fait plus rien. Utile à activer si une requête nomme un dossier privé.",
				plugins: "Désactivé par défaut : ils nomment des plugins, pas vous. Les retirer rend inopérants les boutons qui les exécutaient.",
			},
			groupEmpty: "Rien sur ce tableau.",
			stripTotal: (n: number) =>
				n === 0
					? "Rien ne serait retiré de ce tableau."
					: n === 1
						? "1 valeur sera retirée."
						: `${n} valeurs seront retirées.`,
			stripResidual: (n: number) =>
				`Exporté, mais ${n} valeur${n <= 1 ? " ressemble" : "s ressemblent"} encore à des chemins du coffre. Ouvrez le fichier avant de le partager.`,

			signFailed:
				"Exporté, mais la signature a échoué : il sera importé sans auteur. Votre clé de récupération est peut-être endommagée — essayez de la coller à nouveau.",
			exportButton: "Exporter",
			assetsSkipped: (paths: string) =>
				`Exporté, mais ces images ont été exclues (trop grandes, ou plus dans le coffre) : ${paths}`,
		},
		importModal: {
			title: "Importer",
			kinds: {
				dashboard: "Un tableau de bord",
				layout: "Une disposition de tableaux",
				settings: "Une sauvegarde complète des paramètres",
			},
			by: (author: string) => `par ${author}`,
			signatureInvalid:
				"Ce fichier indique un auteur, mais sa signature n'est pas valide — il a été modifié " +
				"après signature, ou quelqu'un y a mis le pseudonyme d'un autre créateur. Il est affiché sans " +
				"auteur. Le reste de l'import n'est pas affecté.",
			madeWith: (version: string) => `Hearth ${version}`,
			cardCount: (n: number) => (n <= 1 ? `${n} type de carte` : `${n} types de cartes`),
			assetCount: (n: number) =>
				n <= 1 ? `Apporte ${n} image` : `Apporte ${n} images`,
			pathCount: (n: number) =>
				n <= 1 ? `Pointe vers ${n} chemin d'un coffre` : `Pointe vers ${n} chemins d'un coffre`,
			needsPlugins: (plugins: string) => `Nécessite ces plugins : ${plugins}`,
			mode: "Comment l'importer",
			modeDesc: "Ajouter ne touche à aucun de vos paramètres.",
			modeAdd: "Ajouter comme nouveau tableau",
			modeAddBoards: "Ajouter ses tableaux aux miens",
			modeReplaceBoard: (name: string) => `Mettre à jour « ${name} » sur place`,
			modeReplaceAll: "Remplacer tous mes paramètres",
			replaceAllWarning:
				"Cela remplace vos tableaux et tous les paramètres de Hearth par ceux de ce fichier. Action irréversible.",
			heads: "Bon à savoir",
			missingPlugins: (plugins: string) =>
				`Non installés ou non activés ici : ${plugins}. Ces cartes seront vides tant qu'ils ne le seront pas.`,
			missingPaths: (n: number, sample: string) =>
				`${n} note${n <= 1 ? "" : "s"} ou dossier${n <= 1 ? "" : "s"} désigné${n <= 1 ? "" : "s"} par ce tableau ${n <= 1 ? "n'est" : "ne sont"} pas dans votre coffre (${sample}${n > 3 ? ", …" : ""}).`,
			remoteContent: (n: number) =>
				n <= 1
					? `Il charge ${n} élément depuis internet à l'ouverture.`
					: `Il charge ${n} éléments depuis internet à l'ouverture.`,
			missingFine:
				"Rien de tout cela n'empêche l'import — les cartes arrivent et vous pouvez les faire pointer vers vos propres notes.",
			importButton: "Importer",
			addedOne: (name: string) => `« ${name} » ajouté.`,
			addedMany: (n: number) => `${n} tableaux ajoutés.`,
			replacedOne: (name: string) => `« ${name} » mis à jour.`,
			restored: "Paramètres restaurés.",
			assetsWritten: (n: number) =>
				n <= 1 ? `${n} image enregistrée dans votre coffre.` : `${n} images enregistrées dans votre coffre.`,
			warnMissingPaths: (n: number) =>
				`${n} chemin${n <= 1 ? "" : "s"} référencé${n <= 1 ? "" : "s"} introuvable${n <= 1 ? "" : "s"} ici.`,
			warnMissingPlugins: (n: number) =>
				`${n} plugin${n <= 1 ? " requis n'est" : "s requis ne sont"} pas activé${n <= 1 ? "" : "s"}.`,
			warnTaskFields:
				"Ses cartes de tâches utilisent des champs personnalisés — activez la personnalisation des champs de tâche dans Paramètres → Intégrations pour les voir.",
			warnUnknownCards: "Certaines cartes nécessitent une version plus récente de Hearth et ont été exclues.",
			warnAssets: "Certaines de ses images manquaient dans le fichier.",
		},
	},

	// ---- Dashboard gallery ---------------------------------------------
	gallery: {
		categories: {
			productivity: "Productivité",
			planning: "Planning et calendrier",
			study: "Études et recherche",
			writing: "Écriture et journal",
			work: "Travail et projets",
			personal: "Personnel et maison",
			minimal: "Minimal",
			dense: "Riche en informations",
			other: "Tout le reste",
		},
		sorts: {
			trending: "Tendances",
			top: "Mieux notés",
			new: "Plus récents",
			downloads: "Plus installés",
		},
		browse: {
			title: "Galerie de tableaux",
			openLabel: "Galerie",
			openAria: "Parcourir la galerie de tableaux",
			searchPlaceholder: "Chercher des tableaux…",
			all: "Tous les tableaux",
			mine: "Publiés par moi",
			scopeLabel: "Catégorie",
			sortLabel: "Trier par",
			refresh: "Actualiser",
			publish: "Publier un tableau",
			loading: "Chargement…",
			empty: "Rien ici pour l'instant.",
			emptySearch: (query: string) => `Rien ne correspond à « ${query} ».`,
			emptyMine:
				"Vous n'avez encore rien publié. Publiez un tableau et il apparaîtra ici.",
			results: (shown: number, total: number) =>
				total > shown ? `${shown} sur ${total}` : `${shown} tableau${shown <= 1 ? "" : "x"}`,
			more: "Afficher plus",
			byAuthor: (handle: string) => `par ${handle}`,
			anonymous: "sans auteur",
			downloads: (n: number) => `${n} installation${n <= 1 ? "" : "s"}`,
			score: (n: number) => `${n > 0 ? "+" : ""}${n}`,
			cardCount: (n: number) => `${n} carte${n <= 1 ? "" : "s"}`,
			pluginBoard: "Héberge une vue de plugin",
			noPicture: "Pas d'image",
			needsIdentity:
				"Vous pouvez parcourir et installer sans pseudonyme, mais voter et publier en nécessitent un. Hearth vous en crée un anonyme à partir d'une clé qui ne quitte jamais ce coffre.",
			needsIdentityVote:
				"Voter nécessite un pseudonyme. Hearth vous en créera un anonyme à partir d'une clé qui ne quitte jamais ce coffre — pas de compte, et rien sur qui vous êtes. En créer un maintenant ?",
		},
		detail: {
			install: "Installer",
			installing: "Téléchargement…",
			installAria: (name: string) => `Installer ${name}`,
			enlarge: "Ouvrir l'image en taille réelle",
			profile: (handle: string) => `Voir tout ce qu'a publié ${handle}`,
			upvoteAria: "Vote positif",
			downvoteAria: "Vote négatif",
			published: (when: string) => `Publié ${when}`,
			updated: (when: string) => `Mis à jour ${when}`,
			version: (v: string) => `Version de l'auteur ${v}`,
			theme: (name: string) => `Recommandé avec le thème ${name}`,
			madeWith: (v: string) => `Créé avec Hearth ${v}`,
			contents: "Contenu de ce tableau",
			requires: "Ce qu'il nécessite",
			requiresPlugins: "Plugins",
			requiresViews: "Vues hébergées",
			requiresSettings: "Paramètres",
			nothingRequired: "Rien d'autre que Hearth.",
			size: (kb: number) => `${kb} Ko`,
			remote: (n: number) =>
				n <= 1
					? `${n} élément de ce tableau est chargé depuis internet.`
					: `${n} éléments de ce tableau sont chargés depuis internet.`,
			noRemote: "Rien sur ce tableau n'est chargé depuis internet.",
			unverified:
				"Ce tableau est arrivé sans signature vérifiable, son auteur ne peut donc pas être établi.",
			tags: "Tags",
		},
		profile: {
			title: (handle: string) => handle,
			subtitle:
				"Un pseudonyme anonyme, dérivé d'une clé de signature. Il ne dit rien de qui est la personne — seulement que tout ceci vient de la même main.",
			karma: "Karma",
			karmaHint: "Tous les votes positifs sur l'ensemble de ses publications, moins les votes négatifs.",
			totalDownloads: "Installations",
			published: (n: number) => `${n} tableau${n <= 1 ? "" : "x"}`,
			firstSeen: (when: string) => `Première publication ${when}`,
			empty: "Rien de publié sous ce pseudonyme.",
		},
		comments: {
			heading: (n: number) => (n <= 1 ? `${n} commentaire` : `${n} commentaires`),
			headingEmpty: "Commentaires",
			none: "Rien pour l'instant. Soyez le premier à écrire.",
			placeholder: "Posez une question, ou racontez comment ça a marché pour vous…",
			post: "Publier",
			remove: "Supprimer ce commentaire",
		},
		publish: {
			title: "Publier dans la galerie",
			intro:
				"Place ce tableau dans la galerie, où toute personne utilisant cette galerie Hearth peut le trouver et l'installer.",
			category: "Catégorie",
			categoryDesc: "À quoi sert ce tableau. C'est ainsi qu'on le trouve.",
			button: "Publier",
			publishing: "Publication…",
			warning:
				"Ce tableau devient public : toute personne utilisant cette galerie peut le trouver et l'installer. Vous pouvez le retirer à tout moment, mais ceux qui l'ont déjà installé gardent leur copie.",
			needsName: "Donnez un nom au tableau avant de le publier.",
			residual: (n: number) =>
				`Bloqué : ${n} valeur${n <= 1 ? " ressemble" : "s ressemblent"} encore à des chemins de votre coffre après le nettoyage. Vérifiez la section détails avant de publier.`,
			done: (name: string) => `« ${name} » publié dans la galerie.`,
			doneHeld: (name: string) =>
				`La galerie a reçu « ${name} » mais le met en attente de vérification — quelque chose ressemble encore à un chemin de votre coffre. Il ne sera pas listé avant d'avoir été examiné.`,
			doneUpdate: (name: string) => `« ${name} » mis à jour dans la galerie.`,
			update: "Mettre à jour",
			updateChecking: "Vérification…",
			updateDesc: "Republier ce tableau, par-dessus cette entrée.",
			updateMissing:
				"Ce coffre n'a pas le tableau d'où cette entrée a été publiée — il a été supprimé, ou il se trouve dans un autre coffre. Publier d'ici créerait une seconde entrée, il n'y a donc rien à mettre à jour.",
			updateUnknown:
				"Hearth ne sait pas encore à quel tableau correspond cette entrée. Cliquez sur Mettre à jour et il lira l'entrée pour le découvrir.",
			unpublish: "Retirer de la galerie",
			unpublishConfirm: (name: string) =>
				`Retirer « ${name} » de la galerie ? Ceux qui l'ont déjà installé gardent leur copie ; personne d'autre ne pourra le trouver.`,
			unpublished: "Retiré de la galerie.",
		},
		settings: {
			heading: "Galerie de tableaux",
			host: "Adresse de la galerie",
			hostDesc:
				"La galerie que Hearth parcourt et où il publie. Rien n'est récupéré avant que vous l'ouvriez et rien n'est envoyé avant que vous publiiez. Videz ce champ pour désactiver complètement la galerie — elle reste désactivée. https uniquement (ou http sur localhost, pour une galerie hébergée par vous-même).",
			hostPlaceholder: "https://galerie.example.com",
			hostInvalid: "Hearth ne communiquera pas avec cette adresse. Utilisez https, ou http sur localhost.",
			hostCleared: "Galerie désactivée.",
			hostSet: (host: string) => `Galerie définie sur ${host}.`,
			browse: "Parcourir la galerie",
			browseDesc: "Les tableaux publiés par d'autres, et ceux que vous avez publiés.",
			browseButton: "Ouvrir la galerie",
		},
		errors: {
			noHost:
				"Aucune galerie n'est configurée. Indiquez une adresse de galerie dans les paramètres de Hearth, section Galerie de tableaux.",
			externalCallsOff:
				"La galerie est un serveur sur internet, et ce coffre a « Désactiver les appels externes » activé. Désactivez-le pour parcourir ou publier.",
			offline: "Impossible de joindre la galerie. Elle est peut-être hors service, ou cet appareil hors ligne.",
			badResponse: "Cette adresse a répondu, mais pas comme une galerie Hearth.",
			unauthorized: "La galerie n'a pas accepté l'identité de ce coffre.",
			forbidden: "La galerie n'autorise pas l'identité de ce coffre à faire cela.",
			rateLimited: "La galerie vous demande de ralentir. Réessayez dans quelques minutes.",
			tooLarge: "Ce tableau est trop volumineux pour cette galerie. Désactivez le fond d'écran, ou réduisez-le.",
			rejected: (why: string) => `La galerie l'a refusé : ${why}`,
			notFound: "La galerie n'a pas cet élément.",
			server: "La galerie a rencontré un problème avec cette requête.",
			unsigned:
				"Hearth n'a pas pu signer le fichier, il n'a donc pas été publié — un tableau non signé n'a pas d'auteur vérifiable.",
		},
	},

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "Ce n'est pas du JSON valide.",
		notAnObject: "La disposition doit être un objet JSON.",
		noValidDashboards: "La disposition ne contient aucun tableau valide.",
		noValidCards: "La disposition ne contient aucune carte valide.",
		notAHearthLayout:
			"Pas une disposition Hearth — aucun tableau \"dashboards\" ou \"cards\" trouvé.",
		notHearthSettings:
			"Pas une sauvegarde de paramètres Hearth — aucun marqueur \"hearthSettings\" ni disposition trouvé.",
	},

	// ---- Terminal mode (src/tui/) -----------------------------------------
	tui: {
		boardLabel: "Tableau de bord, mode Terminal",
		cardMenu: "Menu de la carte",
		removeCard: "Retirer la carte",
		resize: "Tirer pour redimensionner",
		moveUp: "Monter",
		moveDown: "Descendre",
		moveBoardLeft: "Déplacer le tableau à gauche",
		moveBoardRight: "Déplacer le tableau à droite",
		moreBoards: (n: number) => (n <= 1 ? `${n} autre tableau — lister tous les tableaux` : `${n} autres tableaux — lister tous les tableaux`),
		emptyBoard: "Ce tableau est vide.",
		emptyBoardHint: "Appuyez sur F7 ou n pour ajouter une carte.",
		moved: (title: string) => `${title} déplacé`,
		scroll: (first: number, total: number) => `${first}/${total}`,
		arrangeFoot: "flèches déplacent · maj+flèches redimensionnent · x supprime",
		arrangeHint: "Tirez un cadre pour le déplacer, son coin pour le redimensionner.",
		arranging: "Organisation",
		arrange: "Organiser",
		doneArranging: "Terminé",
		arrangeOn: "Organisation. Les flèches déplacent la carte active ; F2 termine.",
		arrangeOff: "Disposition enregistrée.",
		menuDetail: "Ouvrir la vue agrandie",
		menuZoom: "Zoom",
		menuRefresh: "Actualiser",
		menuSettings: "Paramètres de la carte",
		menuPin: "Épingler sur tous les tableaux",
		menuUnpin: "Désépingler de tous les tableaux",
		menuDuplicate: "Dupliquer",
		menuRemove: "Retirer la carte",
		searchLabel: "Recherche :",
		restingHint: "Tab passe d'une carte à l'autre · ↑↓ à l'intérieur · Entrée ouvre · m menu · F1 aide",
		cardCount: (n: number) => (n <= 1 ? `${n} carte` : `${n} cartes`),
		refreshed: (n: number) => (n <= 1 ? `${n} carte actualisée.` : `${n} cartes actualisées.`),
		noSearch: "La section de recherche est masquée sur ce tableau.",
		noFilter: "La carte active n'a pas de filtre.",
		noSort: "La carte active n'a rien à trier.",
		schemeSet: (name: string) => `Palette : ${name}`,
		schemes: {
			theme: "Thème Obsidian",
			htop: "Htop",
			hearth: "Hearth",
			amber: "Ambre",
			paper: "Papier",
		},
		quitTitle: "Quitter le mode Terminal ?",
		quitMessage:
			"Hearth revient à son design graphique. Le mode Terminal peut être réactivé dans Paramètres → Hearth → Apparence.",
		quitConfirm: "Quitter le mode Terminal",
		fn: {
			help: "Aide",
			arrange: "Organiser",
			search: "Recherche",
			filter: "Filtre",
			refresh: "Actualiser",
			sort: "Tri",
			add: "Ajouter",
			board: "Tableau",
			scheme: "Couleurs",
			quit: "Quitter",
		},
		open: "Ouvrir",
		openNewTab: "Ouvrir dans un nouvel onglet",
		openSplit: "Ouvrir à droite",
		cards: {
			filesFoot: "entrée ouvre · clic droit pour le menu du fichier",
			launchFoot: "flèches choisissent · entrée exécute",
			statsEmpty: "Aucune statistique sélectionnée. Choisissez-en dans les paramètres de la carte.",
			heatTotal: (total: string, weeks: number) => `${total} en ${weeks} semaines`,
			heatFoot: "flèches changent de jour · entrée ouvre sa note quotidienne",
			heatFootNoDaily: "flèches changent de jour",
			calcFoot: "tapez un calcul · entrée le sélectionne",
			loading: "Chargement…",
			tick: "Cocher",
			untick: "Décocher",
			noteFoot: "espace coche · entrée suit un lien · o ouvre la note",
			noteFootEdit: "i modifie · espace coche · entrée suit un lien · o ouvre la note",
			editing: "Édition",
			editingFoot: "échap ou ctrl+entrée pour finir · enregistré pendant la saisie",
			edit: "Modifier",
			notFound: (path: string) => `Introuvable : ${path}`,
			switchView: "Passer à l'autre vue",
			due: "ÉCH.",
			task: "TÂCHE",
			tasksFoot: "espace coche · entrée ouvre · f filtre · s tri · b kanban · + ajoute",
			tasksOpen: (n: number) => (n <= 1 ? `${n} ouverte` : `${n} ouvertes`),
			tasksNoAdd: "La source de cette carte n'a pas d'ajout rapide. Ajoutez plutôt une case à cocher dans une note.",
			tasksAddTo: (column: string) => `Nouvelle carte dans ${column}`,
			columnLeft: "Déplacer la colonne à gauche",
			columnRight: "Déplacer la colonne à droite",
			boardNoColumns: "Toutes les colonnes sont masquées. Réaffichez-les dans les paramètres de la carte.",
			boardFoot: "flèches déplacent · maj+flèches déplacent la carte · espace coche · f filtre · b liste",
			boardHint: (cards: number, columns: number) => `${cards} dans ${columns}`,
			showList: "Afficher en liste",
			showBoard: "Afficher en Kanban",
			calNothing: "Rien de prévu. Entrée ouvre la note quotidienne.",
			calNothingNoNotes: "Rien de prévu.",
			calEvents: (n: number) => (n <= 1 ? `${n} événement` : `${n} événements`),
			calFoot: "flèches changent de jour · pgup/pgdn mois · entrée ouvre · home aujourd'hui",
			agendaFoot: "flèches choisissent · entrée ouvre",
			schedFoot: "[ ] ou pgup/pgdn avancent · v vue · flèches changent de jour · entrée ouvre · home aujourd'hui",
			allDayShort: "tte j.",
			weatherFoot: "flèches choisissent un jour · entrée l'affiche heure par heure",
			weatherCardFoot: "entrée ouvre les prévisions complètes",
			tensionFoot: "entrée ouvre l'indice sur Kagi News",
			mkName: "NOM",
			mkSymbol: "SYMBOLE",
			mkPrice: "COURS",
			mkChange: "VAR.",
			mkOpen: "Ouvrir en grand",
			mkListFoot: "entrée ouvre · [ ] période · r actualise",
			mkSingleFoot: "entrée ouvre · ←/→ instrument · [ ] période · r actualise",
			mkDetailFoot: "[ ] période · r actualise · retour arrière pour revenir",
			mkLookupFoot: "[ ] période · entrée choisit",
			mkResultsFoot: "entrée l'affiche · espace l'ajoute à la carte",
			gitFoot: "entrée ouvre · espace indexe · suppr annule · r relit",
			rssOpen: "Ouvrir dans le navigateur",
			copyLink: "Copier le lien",
			rssFoot: "entrée ouvre · u lu/non lu · A tout lu · f non lus · r actualiser",
			rssFootTabs: "entrée ouvre · ←/→ source · u lu/non lu · A tout lu · f non lus · r actualiser",
			jiraKey: "CLÉ",
			jiraType: "TYPE",
			jiraPriority: "PRIORITÉ",
			jiraSummary: "RÉSUMÉ",
			jiraStatus: "STATUT",
			jiraClear: "Effacer",
			jiraFoot: "entrée ouvre le ticket · flèches atteignent les filtres · r actualise",
			opFlags: "^ épinglée · ~ récurrente · * minuteur en cours · # bloquée",
			opReload: "Relire",
			opListFoot: "entrée ouvre · + ajoute · r relit",
			opReadFoot: "entrée ouvre · r relit",
			opAgendaFoot: "entrée ouvre · r relit",
			opBoardFoot: "flèches déplacent · maj+←/→ déplace la tâche · + ajoute · r relit",
			folderFoot: "entrée ouvre · espace replie un dossier · o parcourt",
			bookmarksFoot: "entrée ouvre · espace replie un groupe",
			dvNoResults: "Aucun résultat",
			dvError: "Dataview n'a pas pu exécuter cette requête",
			petFoot: "entrée ou espace pour le caresser",
		},
		settings: {
			name: "Terminal",
			experimental: "Expérimental",
			desc: "Tout Hearth en texte : une grille de caractères, des cartes en cadres et des raccourcis pour tout, à la manière d'un outil de terminal. Assez léger pour n'importe quelle machine.",
			heading: "Mode Terminal",
			headingDesc: "L'apparence de l'interface texte. Tous les tableaux y sont dessinés tant qu'il est actif.",
			scheme: "Palette",
			schemeDesc: "Thème Obsidian prend toutes les couleurs de votre thème ; les autres sont des palettes fixes.",
			fontSize: "Taille de police",
			fontSizeDesc: "La taille du texte du terminal, en pixels. Chaque carte garde sa place dans la grille.",
			overrides: "Ce que le mode Terminal remplace",
			overridesDesc:
				"Le fond d'écran, le verre givré, les surfaces des cartes et les animations ne sont pas dessinés, et le choix Classique ou Expressif de chaque tableau et carte est mis de côté jusqu'à la désactivation du mode Terminal. Les cartes qui sont des images ou la vue d'un autre plugin sont affichées telles quelles, dans un cadre terminal. Les paramètres sans effet pendant ce temps — l'onglet Style d'une carte, le fond d'écran, les surfaces des cartes, l'icône et les tailles de l'en-tête — sont masqués, sauf si un tableau de plugin, que le mode Terminal laisse tel quel, les utilise encore.",
		},
		helpTitle: "Touches",
		help: {
			nextCard: "Carte suivante ou précédente",
			moveSelection: "Se déplacer dans la carte active",
			moveSideways: "Se déplacer dans la carte, ou vers la carte voisine",
			open: "Ouvrir l'élément sélectionné",
			toggle: "Cocher une tâche, replier un dossier, déplacer une carte Kanban",
			menu: "Menu de la carte (aussi clic droit, ou le ≡ du cadre)",
			zoom: "Agrandir la carte en plein écran",
			detail: "Ouvrir la vue agrandie de la carte",
			settings: "Paramètres de la carte",
			escape: "Quitter un champ, ou retirer le focus",
			search: "Rechercher dans le coffre",
			boards: "Changer de tableau",
			stepBoards: "Tableau précédent ou suivant",
			arrange: "Organiser le tableau",
			add: "Ajouter une carte",
			filter: "Filtrer la carte active",
			sort: "Trier la carte active",
			refresh: "Actualiser toutes les cartes",
			board: "Paramètres du tableau",
			scheme: "Palette suivante",
			help: "Cette liste",
			quit: "Quitter le mode Terminal",
			arrangeNote:
				"En mode Organiser, les flèches déplacent la carte active et Maj+flèches la redimensionnent ; un cadre peut aussi être tiré, et redimensionné par son coin.",
		},
	},
};
