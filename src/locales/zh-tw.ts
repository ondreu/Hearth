/**
 * Traditional Chinese (繁體中文，台灣) locale.
 *
 * Typed against {@link Translations} (`typeof en`), so TypeScript flags any
 * missing or misspelled key at build time. Keys and function signatures match
 * `en.ts` exactly — only the values are translated. See `README.md` in this
 * folder for the walkthrough.
 */
import type { Translations } from "./index";

export const zhTW: Translations = {
	// ---- Commands (command palette) & ribbon ---------------------------
	commands: {
		openHome: "開啟首頁",
		focusSearch: "聚焦儀表板搜尋框",
		newNote: "新增筆記（預設位置）",
		newDrawing: "新增 Excalidraw 繪圖",
		recordVoice: "開始／停止錄音",
		openDailyNote: "開啟今天的日記",
		runSetup: "設定 Hearth（首次執行精靈）",
		searchTips: "顯示搜尋技巧",
		switchDashboard: (n: number) => `切換到儀表板 ${n}`,
		openDashboard: (n: number) => `開啟儀表板 ${n}`,
		nextDashboard: "下一個儀表板",
		previousDashboard: "上一個儀表板",
	},
	ribbon: {
		openHome: "開啟 Hearth 首頁",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth：無法新增筆記。",
		operonTaskMissing: "Hearth：該 Operon 任務的筆記已不在儲存庫中。",
		operonRechecked: "Hearth：已重新檢查 Operon 連線。",
		operonWriteFailed: (reason: string) => `Hearth：Operon 拒絕了此變更 — ${reason}`,
		/** A refused create, with the Operon setting that decided the target —
		 * the error alone names a configured target without saying which one. */
		operonCreateFailed: (reason: string, where: string) =>
			`Hearth：Operon 拒絕建立該任務 — ${reason} ${where} ` +
			"請在 Operon 的設定中修改，或在此卡片設定的「新任務」下選擇其他目標。",
		/** The mutation may have landed. Hearth has already spent its one legal
		 * recovery attempt, so the honest report is "unknown", not "failed" —
		 * and never an offer to retry, which could apply the change twice. */
		operonWriteUnknown: (reason: string) =>
			`Hearth：Operon 無法確認變更是否已套用（${reason}）。` +
			"卡片已重新讀取——請先檢查該任務再重試。",
		enableExcalidraw: "Hearth：請啟用 Excalidraw 外掛以建立繪圖。",
		excalidrawCommandMissing: "Hearth：找不到 Excalidraw 的「新增繪圖」命令。",
		enableAudioRecorder: "Hearth：請啟用核心外掛「錄音機」。",
		couldNotRecordVoice: "Hearth：無法開始錄音。",
		enableDailyNotes: "Hearth：請啟用核心外掛「日記」。",
		couldNotOpenDaily: "Hearth：無法開啟今天的日記。",
		couldNotOpenPeriodic: "Hearth：Periodic Notes 無法建立該筆記。",
		couldNotCreateJournalNote: "Hearth：Journals 無法建立該筆記。",
		commandNotFound: (id: string) => `Hearth：找不到命令：${id}`,
		couldNotCreateNoteForDay: (day: string) => `Hearth：無法為 ${day} 建立筆記。`,
		couldNotCreateEventNote: "Hearth：無法為該活動建立筆記。",
		taskNotesCreateFailed: "Hearth：無法執行 TaskNotes：新增任務。",
		taskChangedOnDisk: "Hearth：該任務在磁碟上已變更——已重新整理。",
		couldNotOpenTaskNote: "Hearth：無法開啟該任務的筆記。",
		couldNotUpdateTaskStatus: "Hearth：無法更新任務狀態。",
		couldNotCompleteRecurring: "Hearth：無法將該重複任務標記為完成。",
		couldNotUndoRecurring: "Hearth：無法復原該重複任務的完成狀態。",
		couldNotAddKanbanCard: "Hearth：無法將卡片新增到看板。",
		couldNotConvertCard: "Hearth：無法將卡片轉換為筆記。",
		templaterNoTemplate: (path: string) => `Hearth：找不到範本：${path}`,
		templaterFailed: (name: string) => `Hearth：Templater 未能從 ${name} 建立筆記。`,
		templaterCreated: (path: string) => `Hearth：已建立 ${path}`,
		newNoteTemplaterMissing:
			"Hearth：「新增筆記」按鈕指向一個 Templater 範本，但 Templater 未啟用——" +
			"改為建立空白筆記。",
		exported: "Hearth：已匯出。",
		layoutExported: "Hearth：版面配置已匯出。",
		layoutImported: "Hearth：版面配置已匯入。",
		layoutImportError: (error: string) => `Hearth：${error}`,
		exportedToVault: (file: string) => `Hearth：已將 ${file} 儲存到 Obsidian 儲存庫根目錄。`,
		exportFailed: "Hearth：無法儲存匯出檔案。",
		cardCopied: "卡片已複製到儀表板。",
	},

	// ---- The home view -------------------------------------------------
	view: {
		displayName: "首頁",
	},

	// ---- Header / search bar -------------------------------------------
	header: {
		newNote: "新增筆記",
		newNoteAria: "新增筆記",
		searchOnline: "線上搜尋",
		searchOnlineAria: "用目前的關鍵字搜尋網路",
		searchOnlinePickAria: "選擇搜尋引擎",
		searchEngineDefault: (name: string) => `${name}（預設）`,
	},
	search: {
		placeholder: "搜尋儲存庫",
		noMatches: "沒有符合的項目",
		noMatchingCommands: "沒有符合的命令",
		tips: {
			title: "搜尋列能做什麼",
			intro: "在任何 Hearth 搜尋列中輸入以下內容。",
			introTry: "點擊範例即可試用。",
			findHeading: "尋找筆記",
			answersHeading: "即時答案",
			off: "已關閉",
			settingsHint: "可在 設定 → 搜尋 中開關答案，也可在儀表板設定或搜尋列卡片中個別設定。",
			tryAria: (example: string) => `試用「${example}」`,
			openRow: "搜尋技巧",
			openRowDesc: "搜尋列能做的一切",
			newHint: "新功能：搜尋列可以回答問題",
			newHintDesc: "計算、貨幣、股票、天氣、維基百科等——看看它能做什麼",
			dismiss: "關閉",
			find: {
				name: {
					title: "名稱和路徑",
					desc: "任何文字都會依名稱尋找筆記、檔案和資料夾，漏字也能找到。",
					examples: ["會議", "專案/筆記"],
				},
				tag: { title: "標籤", desc: "以 # 開頭依標籤尋找筆記。", examples: ["#專案"] },
				property: {
					title: "屬性",
					desc: "鍵:值 依 frontmatter 屬性尋找筆記。",
					examples: ["status:done"],
				},
				command: { title: "命令", desc: "以 > 開頭執行任何命令。", examples: [">日記"] },
			},
			features: {
				calc: {
					title: "計算機",
					desc: "算式、百分比、單位和進位制。以 = 開頭可強制計算。",
					examples: ["1+1", "20% of 150", "10 km to mi"],
				},
				currency: {
					title: "貨幣",
					desc: "依今日匯率換算，並顯示貨幣對走勢圖。",
					examples: ["20美元換成歐元", "100 歐元兌換成日幣", "usd/jpy"],
				},
				market: {
					title: "股票、基金和加密貨幣",
					desc: "即時行情和走勢圖。使用 $ 或「股價」「行情」等詞。",
					examples: ["$AAPL", "台積電股價", "0050 行情"],
				},
				weather: { title: "天氣", desc: "任何地方的目前天氣和未來幾天。", examples: ["台北天氣", "天氣 高雄"] },
				wiki: {
					title: "維基百科",
					desc: "條目摘要。加 :en、:de… 可選擇語言。",
					examples: ["維基 布拉格", "wiki:en Taipei"],
				},
				chance: {
					title: "硬幣、骰子和隨機數",
					desc: "按 Enter 重新抽取。",
					examples: ["擲硬幣", "擲 2d6", "隨機數 1-10"],
				},
				date: {
					title: "日期",
					desc: "計算天數和日期。",
					examples: ["距離2026-12-24還有幾天", "今天+45天", "3天後"],
				},
				time: { title: "其他地方的時間", desc: "某個城市的時間及時差。", examples: ["東京時間", "紐約現在幾點"] },
			},
		},
		instant: {
			copyHint: "按 Enter 複製",
			openHint: "按 Enter 查看詳細資料",
			copied: (value: string) => `已複製 ${value}`,
			copyFailed: "無法複製到剪貼簿",
			loading: "載入中…",
			invalid: "不是有效的運算式",
			noQuote: (query: string) => `沒有「${query}」的行情資料`,
			externalOff: "Hearth 設定中已停用外部請求",
			rate: (from: string, rate: string, to: string) => `1 ${from} = ${rate} ${to}`,
			days: (n: number) => `${n} 天`,
			today: "今天",
			inDays: (n: number) => (n === 1 ? "明天" : `${n} 天後`),
			daysAgo: (n: number) => (n === 1 ? "昨天" : `${n} 天前`),
			week: (n: number) => `第 ${n} 週`,
			sameTime: "與本地時間相同",
			offset: (hours: string) => `與本地相差 ${hours} 小時`,
			noPlace: (place: string) => `找不到名為「${place}」的地點`,
			noArticle: (query: string) => `沒有關於「${query}」的維基百科條目`,
			heads: "正面",
			tails: "反面",
			coin: "擲硬幣",
			between: (min: string, max: string) => `${min} 到 ${max} 之間的隨機數`,
			againHint: "按 Enter 重新抽取",
		},
	},

	// ---- Shared confirm dialog -----------------------------------------
	confirm: {
		confirm: "確認",
		cancel: "取消",
		ok: "確定",
	},

	// ---- "What's new" release-notes dialog -----------------------------
	whatsNew: {
		title: "Hearth 更新內容",
		intro: "感謝更新！以下是您上次查看以來的變化。",
		/** Shown instead of {@link intro} when there are headlines to click. */
		introHint:
			"感謝更新！以下是您上次查看以來的變化——點擊任一條目查看詳細內容。",
		close: "知道了",
		footer: "完整說明請見外掛的 README。",
		/** The Added / Changed / Fixed group labels. */
		kinds: {
			added: "新增",
			changed: "變更",
			fixed: "修正",
			removed: "移除",
			deprecated: "棄用",
			security: "安全性",
			other: "其他",
		},
		filterPlaceholder: "篩選變更…",
		expandAll: "全部展開",
		collapseAll: "全部摺疊",
		noMatches: (query: string) => `這裡沒有提到「${query}」。`,
		/** Tooltip on a version's compare/release link. */
		releaseNotes: (version: string) => `在 GitHub 上查看 ${version} 的發行說明`,
		/** Label for the header row that folds a release away. */
		releaseToggle: (version: string) => `顯示或隱藏 ${version} 的變更內容`,
		/** Tooltip on the `#123` link beside a change. */
		issue: (n: string) => `GitHub 上的 issue #${n}`,
	},

	// ---- First-run setup wizard ----------------------------------------
	setup: {
		/** Short labels on the progress rail. */
		stepNames: {
			purpose: "用途",
			look: "外觀",
			finish: "您的儀表板",
		},
		/** The heading at the top of each step. */
		stepTitles: {
			purpose: "您的 Obsidian 儲存庫用途是什麼？",
			look: "選擇外觀",
			finish: "這就是您的主畫面",
		},
		/** The line under each heading. */
		stepDescs: {
			purpose: "可複選，Hearth 會據此挑選卡片。只需三個步驟，之後一切都可以修改。",
			look: "只作用於正在建立的儀表板，其他儀表板保留各自的外觀。",
			finish: "目前尚未變更任何內容。以下就是將要建立的儀表板。",
		},
		nav: {
			back: "上一步",
			next: "下一步",
			finish: "建立我的儀表板",
			skip: "略過設定",
		},
		vault: {
			title: "標題",
			titleDesc: "以大字顯示在儀表板頂端。",
			showTitle: "顯示標題",
			showTitleDesc: "關閉後儀表板將完全沒有標題。",
			titleIcon: "標題圖示",
			titleIconDesc:
				"標題旁顯示的表情符號、一兩個字元、Lucide 圖示 ID、儲存庫圖片路徑或圖片網址。留空則使用 Hearth 水晶圖示。",
			themeColor: "跟隨主題的強調色",
			themeColorDesc: "品牌標誌的哪些部分採用主題的顏色。",
			themeColorOptions: {
				none: "都不",
				icon: "圖示",
				title: "標題",
				both: "兩者",
			},
			showSearch: "顯示搜尋列",
			showSearchDesc: "標題下方的搜尋與命令輸入框。",
		},
		look: {
			designHeading: "設計",
			designNote: "此選項適用於整個 Hearth，而不僅是此儀表板。可隨時在 設定 → Hearth → 外觀 中變更。",
			terminalNote: "終端機模式適用於整個 Hearth 和所有儀表板。它不繪製桌布和卡片底色，因此這裡沒有其他可選項。這是實驗性功能：可隨時在 設定 → Hearth → 外觀 中關閉，儀表板會恢復為其下的設計。",
			surfaceHeading: "卡片",
			backgroundHeading: "背景",
			color: "顏色",
			colorDesc: "儀表板後方的純色。",
			weatherDesc:
				"某地的即時天空，或固定維持某種天氣狀況。請在下方選擇來源。",
			layout: "背景顯示的位置",
			layoutDesc:
				"鋪滿整個儀表板，或作為頂端的橫幅，下方的卡片使用主題本身的表面。",
			layoutFull: "鋪滿整個儀表板",
			layoutBanner: "頂端橫幅",
			compact: "緊湊間距",
			compactDesc: "收緊間隙，讓畫面容納更多內容。",
		},
		surfaces: {
			glass: {
				icon: "layers",
				name: "毛玻璃",
				desc: "半透明卡片，後方的背景帶有柔和模糊。",
			},
			solid: {
				icon: "square",
				name: "實色",
				desc: "不透明面板。在繁雜的照片上最易閱讀。",
			},
			minimal: {
				icon: "minus",
				name: "極簡",
				desc: "完全沒有卡片表面——內容直接浮在背景上。",
			},
		},
		designs: {
			classic: {
				icon: "square",
				name: "經典",
				desc: "Hearth 一貫的樣子：安靜的表面，細邊框。",
			},
			expressive: {
				icon: "shapes",
				name: "Expressive",
				desc: "整個 Hearth 使用 Material 3 Expressive——卡片、按鈕、選單、對話框和設定——採用強調色的色調。",
			},
			terminal: {
				icon: "terminal",
				name: "終端機",
				desc: "所有儀表板都以文字顯示：字元網格、線框繪製的卡片，一切皆可用按鍵操作。實驗性：部分卡片仍以圖形顯示。",
			},
		},
		backgrounds: {
			default: {
				icon: "image",
				name: "Hearth 桌布",
				desc: "由 Hearth 繪製的山丘，隨主題呈現白天或夜晚。",
			},
			harbour: {
				icon: "anchor",
				name: "港口小鎮",
				desc: "燈塔、船隻和山坡上的房屋，以強調色的扁平 Expressive 形狀繪製。",
			},
			weather: {
				icon: "cloud-sun",
				name: "即時天空",
				desc: "依據您所在地的天氣繪製的天空——也可以固定為一種。",
			},
			color: {
				icon: "paintbrush",
				name: "純色",
				desc: "單一顏色，無圖片。最輕量的選項。",
			},
			none: {
				icon: "ban",
				name: "無",
				desc: "保持主題本身的背景不變。",
			},
		},
		purposes: {
			daily: {
				name: "日記與隨筆",
				desc: "今天的筆記居於正中，並配有可在日期間切換的行事曆。",
			},
			tasks: {
				name: "任務與待辦",
				desc: "任務清單，讀取自您的核取方塊或任務外掛。",
			},
			planning: {
				name: "規劃與行事曆",
				desc: "完整的月／週／日行事曆，包含所有已訂閱的行事曆來源。",
			},
			browsing: {
				name: "尋找我的筆記",
				desc: "您最近開啟過的內容，以及一排我的最愛。",
			},
			capture: {
				name: "快速記錄與啟動",
				desc: "一排快捷操作：新增筆記、搜尋、命令面板。",
			},
			insights: {
				name: "Obsidian 儲存庫統計",
				desc: "Obsidian 儲存庫有多大，以及您有多活躍。",
			},
			reading: {
				name: "閱讀與訂閱",
				desc: "一張訂閱您關注網站的 RSS 卡片。",
			},
			ambience: {
				name: "一點生氣",
				desc: "您所在地的天氣，以及一隻住在儀表板上的小寵物。",
			},
		},
		purpose: {
			count: (n: number) => `目前共 ${n} 張卡片。`,
			integrationsHeading: "在您的 Obsidian 儲存庫中找到",
			feed: "要訂閱的來源",
			feedDesc: "您常讀網站的 RSS 或 Atom 網址。之後可在卡片上新增更多。",
			feedMissing: "填入訂閱網址後，閱讀卡片就會加入儀表板。",
			weatherPlace: "天氣地點",
			weatherMissing: "選擇一個地點後，天氣卡片就會加入儀表板。",
		},
		integrations: {
			lead:
				"這裡每開啟一項，Hearth 都會為此儀表板新增一張已設定好的卡片——" +
				"不會安裝或變更其他外掛，也不會影響此儀表板之外的任何內容。",
			recommended: "推薦",
			effects: {
				tasknotes:
					"新增一張任務卡片讀取您的 TaskNotes 任務，並把 TaskNotes 目前設定的" +
					"欄位名稱和完成狀態一併存入卡片本身。",
				kanban: "新增一張任務卡片，將看板顯示為可拖曳的欄。",
				dataview: "新增一張 Dataview 卡片，並預設一條可編輯的查詢。",
				datacore: "新增一張 Datacore 卡片，等待填入查詢。",
				templater:
					"新增一張按鈕卡片——每個現有範本一個按鈕——一鍵即可據此建立筆記。",
				git: "新增一張 Git 卡片顯示 Git 儲存庫狀態，並帶有提交與同步按鈕。",
				operon:
					"新增一張 Operon 任務卡片，透過 Operon 的開發者 API 讀取資料。" +
					"卡片首次載入時，需要您在 Operon 自己的設定中核准 Hearth；" +
					"在此之前，卡片會說明它在等什麼。",
				bases: "新增一張卡片，嵌入 Obsidian 儲存庫中的某個 base。",
				dailyNotes: "新增一張卡片顯示今天的日記，可直接編輯。",
				bookmarks: "新增一張卡片列出您的書籤。",
			},
			taskNotesTitle: "從您的 TaskNotes 設定讀取到此卡片",
			taskNotesStatus: "狀態欄位",
			taskNotesDue: "到期欄位",
			taskNotesPriority: "優先順序欄位",
			taskNotesDone: "視為已完成",
			taskNotesDoneNone: "未定義 — Hearth 將使用「done」",
		},
		finish: {
			empty:
				"未選擇任何卡片。您仍然可以完成——儀表板會是空的，之後可用儀表板的" +
				"「排列」按鈕新增卡片。",
			target: "此儀表板的落點",
			targetDesc: "取代目前所在的儀表板，或作為一個可切換的新儀表板新增。",
			targetReplace: "取代我目前的儀表板",
			targetNew: "作為新儀表板新增",
			targetForcedNew:
				"這將作為新儀表板新增。您已有的每個儀表板都會原樣保留——不會被取代或刪除。",
			name: "儀表板名稱",
			nameDesc: "顯示在儀表板切換器中。",
			/** Seed for the new dashboard's name; numbered if already taken. */
			defaultName: "首頁",
			calloutTitle: "這是起點，不是預設",
			calloutHint:
				"每張卡片都可以透過「排列」（儀表板右上角）移動、縮放、重新設定或刪除；" +
				"其餘內容在 設定 → Hearth 中。您隨時可以從 設定 → 關於 再次執行此精靈。",
			clock: "時鐘",
			clockDesc: "側欄頂端的一個小時鐘和問候語。",
			more: "標題與頁首",
			why: "為什麼是這些卡片",
		},
		plan: {
			/** Fallback names for planned cards that carry no title of their own. */
			names: {
				clock: "時鐘與問候",
				daily: "今天的筆記",
				tasks: "任務",
				schedule: "行事曆",
				calendar: "迷你行事曆",
				recent: "最近檔案",
				favorites: "我的最愛",
				bookmarks: "書籤",
				links: "連結",
				stats: "Obsidian 儲存庫統計",
				heatmap: "活躍度",
				rss: "閱讀",
				weather: "天氣",
				pet: "寵物",
				dataview: "Dataview",
				datacore: "Datacore",
				git: "Git",
				base: "Base",
			},
			/** The Quick actions card's seeded buttons. */
			actions: {
				newNote: "新增筆記",
				today: "今天的筆記",
				switcher: "快速切換",
				search: "搜尋",
				palette: "命令",
			},
			/** Why each card is on the board, shown beside it in the review list. */
			reasons: {
				clock: "您選擇了時鐘",
				daily: "日記與隨筆",
				dailyNotes: "已啟用日記外掛",
				tasks: "任務與待辦",
				tasknotes: "已為 TaskNotes 設定",
				kanban: "讀取您的看板",
				planning: "規劃與行事曆",
				browsing: "尋找我的筆記",
				bookmarks: "已啟用書籤外掛",
				capture: "快速記錄與啟動",
				insights: "Obsidian 儲存庫統計",
				reading: "閱讀與訂閱",
				ambience: "一點生氣",
				dataview: "已安裝 Dataview",
				datacore: "已安裝 Datacore",
				templater: "找到了 Templater 範本",
				git: "已安裝 Git",
				operon: "Operon 的開發者 API 可用",
				bases: "在 Obsidian 儲存庫中找到了一個 base",
			},
		},
		notice: {
			done: (n: number) => `Hearth：儀表板已就緒——新增了 ${n} 張卡片。`,
		},
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "選擇要嵌入的檔案…",
		command: "選擇一個命令…",
		noteToFavorite: "選擇要加入我的最愛的筆記…",
		folder: "選擇一個資料夾…",
		image: "選擇一張圖片…",
		icon: "搜尋 Lucide 圖示…",
		iconPlaceholder: "Lucide 圖示 ID",
		iconBrowse: "瀏覽 Lucide 圖示",
		iconClear: "清除圖示",
		titleIconPlaceholder: "圖示 ID、表情符號、圖片路徑或網址",
		titleIconBrowseImage: "從 Obsidian 儲存庫中選擇圖片",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "新增卡片",
		addCardAria: "向儀表板新增卡片",
		dashboardSettings: "儀表板設定",
		dashboardSettingsAria: "開啟此儀表板的設定",
		showTitles: "顯示標題",
		hideTitles: "隱藏標題",
		showCardHeaders: "顯示卡片標題列",
		hideCardHeaders: "隱藏卡片標題列",
		doneArranging: "排列完成",
		finishArranging: "結束卡片排列",
		moveResize: "移動與縮放卡片",
		cardSettings: "卡片設定",
		removeCard: "移除卡片",
		removeCardTitle: "移除卡片？",
		removeCardMessage: (name: string) => `要從儀表板中移除「${name}」嗎？`,
		removeCardConfirm: "移除",
		thisCard: "此卡片",
		expandCard: "展開卡片",
		collapseCard: "摺疊卡片",
		phonePreview: "以手機寬度預覽",
		phonePreviewOff: "離開手機預覽",
		moveCardUp: "上移卡片",
		moveCardDown: "下移卡片",
		hideOnNarrow: "在窄螢幕版面中隱藏",
		showOnNarrow: "在窄螢幕版面中顯示",
	},

	// ---- Dashboard switcher & per-dashboard settings -------------------
	dashboards: {
		newDashboard: "新增儀表板",
		defaultName: (n: number) => `儀表板 ${n}`,
		copySuffix: (name: string) => `${name} 副本`,
		fallbackName: "儀表板",
		menu: {
			settings: "儀表板設定…",
			duplicate: "複製",
			exportBoard: "匯出儀表板…",
			importBoard: "匯入儀表板…",
			delete: "刪除",
		},
		deleteTitle: "刪除儀表板？",
		deleteMessage: (name: string, count: number) =>
			`要刪除「${name}」及其 ${count} 張卡片嗎？此操作無法復原。`,
		deleteConfirm: "刪除",
		modal: {
			title: "儀表板設定",
			deleteDashboard: "刪除儀表板",
			/** Tabs across the top of the dashboard settings modal. */
			tabs: {
				general: "一般",
				plugin: "外掛檢視",
				single: "卡片",
				header: "頂端",
				layout: "版面配置",
				style: "樣式",
				background: "背景",
			},
			name: "名稱",
			mode: "儀表板類型",
			modeDesc:
				"由 Hearth 卡片組成的儀表板、鋪滿整個儀表板的單張 Hearth 卡片，或將整個儀表板交給某個外掛的檢視。切換類型會保留此儀表板的卡片——切換回來即可恢復。",
			modeOptions: {
				cards: "卡片",
				single: "單張卡片",
				plugin: "外掛檢視",
			},
			modePickViewHint: "此儀表板尚未選擇檢視——請在「外掛檢視」分頁中選擇。",
			modePickCardHint: "此儀表板還沒有卡片——請在「卡片」分頁中新增。",
			singleCard: "卡片",
			singleCardDesc:
				"由此儀表板的哪張卡片鋪滿儀表板。其他卡片仍保留在儀表板上，切換回卡片模式時會重新出現。",
			singleCardEdit: "編輯卡片",
			singleCardAdd: "新增卡片",
			pluginViewType: "檢視",
			pluginViewTypeDesc:
				"由哪個已註冊的檢視鋪滿本儀表板。清單為目前應用程式中的全部檢視，因此取決於啟用了哪些外掛。",
			pluginViewTypeNone: "選擇一個檢視…",
			pluginViewFile: "檔案",
			pluginViewFileDesc:
				"在指定檔案上開啟該檢視——如白板、Excalidraw 繪圖。留空則單獨承載該檢視。",
			pluginViewFileRequiredDesc:
				"此檢視需要一個檔案才能顯示內容。請選擇本儀表板要開啟的筆記、PDF 或圖片。",
			pluginViewHideHeader: "隱藏檢視本身的標題列",
			pluginViewHideHeaderDesc:
				"去掉所承載檢視的導覽路徑、上一頁／下一頁箭頭和三點選單。檢視本身的工具列與分頁不受影響。",
			pluginViewKeepMounted: "在背景保持執行",
			pluginViewKeepMountedDesc:
				"顯示其他儀表板時仍保持載入，切換回來即刻可用，無需重新載入。若外掛較吃資源、不想讓它常駐，可關閉此項。同時保持載入的儀表板數量始終有限。",
			pluginViewFocusable: "允許檢視取得焦點（實驗性）",
			pluginViewFocusableDesc:
				"在其中操作時將其設為作用中的窗格，使外掛本身的命令與快速鍵能夠找到它。Obsidian 也會把開啟的筆記放入作用中的窗格，因此點擊連結可能會取代該檢視，直到你切換儀表板為止。",
			pluginViewPerfNote:
				"所承載的檢視是外掛在完整執行，而非預覽——負擔與直接開啟該外掛相同。在自己分頁裡慢的檢視，在這裡同樣慢。",
			switcherIcon: "切換器圖示",
			switcherIconDesc: "顯示在切換按鈕上的表情符號或短文字。留空則顯示編號。",
			switcherLucide: "切換器 Lucide 圖示",
			switcherLucideDesc:
				"一個 Lucide 圖示（例如「home」、「star」、「layout-dashboard」）— 可瀏覽圖示集，或直接輸入 ID。優先於上面的表情符號。",
			linkedWorkspace: "關聯的工作區",
			linkedWorkspaceDesc:
				"該工作區載入時自動切換到此儀表板。需要核心外掛「工作區」。",
			linkedWorkspaceNone: "無",
			mobileDefault: "行動裝置預設",
			mobileDefaultDesc:
				"在手機或平板上載入 Hearth 時開啟此儀表板。只能有一個儀表板作為行動裝置預設；開啟此項會清除其他儀表板的設定。",
			titleVisibility: "標題可見性",
			titleVisibilityDesc:
				"僅針對此儀表板顯示或隱藏標題／圖示區塊。覆寫全域設定。",
			titleVisibilityDefault: (state: string) => `使用全域預設（${state}）`,
			searchVisibility: "搜尋可見性",
			searchVisibilityDesc:
				"在此儀表板上顯示或隱藏搜尋與命令列及其結果和篩選按鈕。覆寫全域設定。",
			searchVisibilityShow: "顯示搜尋",
			searchVisibilityHide: "隱藏搜尋",
			searchPlaceholder: "搜尋預留位置文字",
			searchPlaceholderDesc: "本儀表板搜尋框中的灰色提示文字。留空則使用內建文案。",
			newNoteButton: "搜尋框旁的按鈕",
			newNoteButtonDesc: "顯示或隱藏本儀表板搜尋框旁邊的按鈕。",
			newNoteButtonStateOn: "顯示",
			newNoteButtonStateOff: "隱藏",
			newNoteButtonMode: "該按鈕的作用",
			newNoteButtonModeDesc: "新增筆記，或用搜尋框中的內容進行網頁搜尋。",
			newNoteButtonModeOptions: {
				newNote: "新增筆記",
				searchOnline: "線上搜尋",
			},
			newNoteButtonLabel: "按鈕文字",
			newNoteButtonLabelDesc: "本儀表板上該按鈕的文字。留空則使用內建文案。",
			hiddenFilters: "篩選標籤",
			hiddenFiltersDesc:
				"選擇本儀表板在搜尋列下顯示哪些檔案類型標籤，而不跟隨整個 Obsidian 儲存庫的設定。",
			hiddenFiltersFollowing: (count: number) =>
				count === 0 ? "跟隨整個 Obsidian 儲存庫的設定（未隱藏任何標籤）。" : `跟隨整個 Obsidian 儲存庫的設定（已隱藏 ${count} 個）。`,
			strictFilters: "僅這些類型",
			strictFiltersDesc:
				"僅搜尋此儀表板顯示篩選標籤的檔案類型。跟隨 Obsidian 儲存庫會與「設定 → 搜尋」保持一致。",
			strictFiltersOptionOn: "僅標籤中的類型",
			strictFiltersOptionOff: "所有類型",
			strictFiltersStateOn: "僅標籤中的類型",
			strictFiltersStateOff: "所有類型",
			hiddenInstant: "即時答案",
			hiddenInstantDesc: "為此儀表板的搜尋列關閉部分答案。在整個 Obsidian 儲存庫中關閉的答案保持關閉。",
			hiddenInstantOffVault: "已在 設定 → 搜尋 中對整個 Obsidian 儲存庫關閉。",
			hiddenInstantVaultOff: "即時答案已在 設定 → 搜尋 中對整個 Obsidian 儲存庫關閉。",
			stackOnNarrow: "變窄時堆疊",
			stackOnNarrowDesc:
				"當窗格窄到無法容納自由配置時（手機，或窄的分割窗格），將本儀表板重新排列為單欄全寬。",
			stackOnNarrowStateOn: "堆疊",
			stackOnNarrowStateOff: "保持配置",
			stackOnNarrowOptionOn: "堆疊為單欄",
			stackOnNarrowOptionOff: "保持縮放後的配置",
			narrowWidth: "窄螢幕門檻",
			arrangeVisibility: "排列按鈕",
			arrangeVisibilityDesc: "本儀表板上的「排列」按鈕是始終可見，還是游標停留時淡入。",
			switcherVisibility: "儀表板切換器",
			switcherVisibilityDesc:
				"顯示本儀表板時，切換器是始終可見，還是游標停留時淡入。",
			chromeOptions: {
				always: "始終可見",
				hover: "游標停留時顯示",
			},
			chromeStates: {
				always: "始終可見",
				hover: "游標停留時顯示",
			},
			skyAnimate: "天空動畫",
			skyAnimateDesc:
				"讓本儀表板繪製的天氣飄動、落下與閃爍。效能等級與讀者的「減少動態效果」設定仍可將其靜止。",
			skyAnimateStateOn: "動畫",
			skyAnimateStateOff: "靜止",
			skyAnimateOptionOn: "啟用動畫",
			skyAnimateOptionOff: "保持靜止",
			cardDesign: "設計",
			cardDesignDesc:
				"此儀表板的繪製方式——其卡片、按鈕以及從它開啟的對話框和選單——卡片未個別指定時生效：經典，或 Material 3 Expressive。",
			skyDesign: "背景設計",
			skyDesignDesc: "在此儀表板上使用經典手繪天空，或 Material 3 Expressive 風格的扁平天空。",
			wallpaperDesignDesc: "此儀表板上的 Hearth 桌布：經典山丘，或以你的強調色繪製的 Material 3 Expressive 扁平圖形。",
			visibilityDefaultPlugin: (state: string) => `外掛檢視儀表板的預設值（${state}）`,
			visibilityDefaultSingle: (state: string) =>
				`單卡片儀表板的預設值（${state}）`,
			visibilityShown: "顯示",
			visibilityHidden: "隱藏",
			visibilityShow: "顯示標題",
			visibilityHide: "隱藏標題",
			titleText: "標題文字",
			titleTextDesc: "為此儀表板覆寫全域標題文字。",
			titleIcon: "標題圖示",
			titleIconDesc:
				"此儀表板標題旁的標誌：Lucide 圖示 ID、表情符號或短文字、Obsidian 儲存庫圖片路徑，或圖片網址。清空後，僅此儀表板會顯示 Hearth 水晶圖示。",
			titleAlign: "標題對齊",
			titleAlignDesc: "僅對齊標題／圖示區塊。搜尋列保持自身配置。",
			alignDefault: "預設（置中）",
			alignLeft: "靠左對齊",
			alignCenter: "置中",
			alignRight: "靠右對齊",
			titleSize: "標題大小",
			titleIconSize: "標題圖示大小",
			titleTopMargin: "標題上邊距",
			headerSpacingBelow: "標題／頂端下方間距",
			contentWidth: "內容寬度",
			fullWidth: "全寬",
			fullWidthDesc: "為此儀表板覆寫寬度上限。",
			fullWidthDefault: (state: string) => `使用全域預設（${state}）`,
			fullWidthOptionOn: "填滿窗格",
			fullWidthOptionOff: "限制寬度",
			fullWidthStateOn: "填滿窗格",
			fullWidthStateOff: "限制寬度",
			fitToPage: "符合頁面",
			fitToPageDesc: "為此儀表板覆寫捲動行為。",
			fitDefault: (state: string) => `使用全域預設（${state}）`,
			fitStateFit: "符合",
			fitStateScroll: "捲動",
			fitOptionFit: "符合單頁",
			fitOptionScroll: "允許捲動",
			fitToPagePluginNote: "外掛檢視儀表板始終鋪滿窗格——所承載的檢視會填滿它並自行捲動。",
			fitToPageSingleNote:
				"單卡片儀表板始終鋪滿窗格——卡片會填滿它並自行捲動。",
			themeColorTarget: "標題上的強調色",
			themeColorTargetDesc:
				"此儀表板品牌標誌的哪些部分跟隨主題的圖示顏色。僅為此儀表板覆寫全域設定；Hearth 的分頁與側邊欄圖示仍跟隨全域設定。",
			themeColorTargetDefault: (state: string) => `使用全域預設（${state}）`,
			themeColorTargetOptions: {
				none: "都不",
				icon: "圖示",
				title: "標題",
				both: "兩者",
			},
			compact: "緊湊間距",
			compactDesc: "為此儀表板覆寫全域間距。",
			compactDefault: (state: string) => `使用全域預設（${state}）`,
			compactOptionOn: "緊湊",
			compactOptionOff: "寬鬆",
			compactStateOn: "緊湊",
			compactStateOff: "寬鬆",
			cardOpacity: "卡片不透明度",
			cardBlur: "卡片模糊",
			cardRadius: "卡片圓角半徑",
			cardBorderWidth: "卡片邊框",
			done: "完成",
			overriding: "正在覆寫全域預設值。",
			usingGlobal: (value: number | string) => `使用全域預設（${value}）。`,
			usingDefault: (value: number | string) => `使用預設值（${value}）。`,
			usingDefaultText: (value: string) => `使用預設值（${value}）。`,
			background: "背景",
			backgroundDesc: "為此儀表板覆寫全域背景。",
			backgroundValue: "背景值",
			opacity: "不透明度",
			blur: "模糊",
			backgroundLayout: "背景版面配置",
			bannerHeight: "橫幅高度",
			bannerFade: "淡出下緣",
			bannerFullWidth: "全寬",
			clearOverride: "跟隨全域設定",
		},
		useGlobal: "使用全域預設",
		on: "開",
		off: "關",
		backgroundLayoutOptions: {
			full: "完整背景",
			banner: "橫幅",
		},
		backgroundOptions: {
			default: "使用全域預設",
			none: "無",
			hdefault: "Hearth 預設",
			harbour: "港口小鎮",
			color: "純色",
			image: "Obsidian 儲存庫圖片",
			url: "圖片網址",
			video: "Obsidian 儲存庫影片",
			weather: "即時天氣天空",
		},
		backgroundValueDesc: {
			color: "一個 CSS 顏色值，例如 #1e1e2e。",
			image: "Obsidian 儲存庫內的圖片路徑，例如 Attachments/bg.png。",
			url: "圖片的直接連結網址。",
			video: "Obsidian 儲存庫內的影片路徑，例如 Attachments/loop.mp4。",
		},
	},

	// ---- Plugin settings tab -------------------------------------------
	settings: {
		/** Shared across every slider/section control. */
		resetSlider: "重設為預設值",
		/** Reset button next to text fields whose factory default is meaningful. */
		resetField: "重設為預設值",
		/** Strapline under the plugin name on the settings index. */
		indexSub: "為您的 Obsidian 儲存庫打造的主畫面——搜尋、儀表板與啟動器合於一處。",
		/** Accessible name of the back link on a category page; the visible label is
		 * the plugin's own name. */
		backToIndex: "返回所有設定",
		/** Headings that group the categories on the index. */
		indexGroups: {
			lookFeel: "外觀與感受",
			howItWorks: "運作方式",
			data: "資料與外掛",
			etc: "其他",
		},
		/** One line per category, shown on its index row and again at the top of
		 * its page: what a reader will find if they open it. */
		tabDescs: {
			appearance: "設計、標題、圖示、背景與低功耗模式。",
			search: "搜尋列及其提供的結果。",
			dashboard: "網格、卡片表面與儀表板周圍的控制項。",
			behaviour: "啟動、筆記開啟方式與隱私。",
			mobile: "手機上的堆疊版面配置，以及操作列。",
			integrations: "TaskNotes、檔案圖示，以及 Hearth 讀取的每個外掛。",
			backup: "匯出與匯入您的版面配置和設定。",
			about: "版本、更新內容，以及問題回報管道。",
		},
		/** Shown in place of a settings section (or tab) whose render threw, so a
		 * single failing section can no longer blank the whole settings pane. */
		sectionError: (name: string) => `無法顯示「${name}」區塊。`,
		sectionErrorHint:
			"請開啟開發者主控台（Cmd/Ctrl+Option+I）查看錯誤，然後在 GitHub 上回報。其他設定不受影響。",
		/** Category ribbon at the top of the settings tab. */
		tabs: {
			appearance: "外觀",
			search: "搜尋",
			dashboard: "儀表板",
			behaviour: "行為",
			mobile: "行動裝置",
			integrations: "整合",
			backup: "備份",
			about: "關於",
		},
		/** Sub-section headings used to group settings within a tab. */
		sections: {
			performance: "效能",
			performanceDesc:
				"願意為裝飾付出多少代價。在較慢的硬體上，用視覺效果換取續航力與流暢度。",
			home: "首頁",
			homeDesc: "標題、圖示、標題與分頁圖示、搜尋可見性以及整體內容寬度。",
			searchBar: "搜尋列",
			searchBarDesc: "搜尋框的外觀及其功能。",
			grid: "網格與間距",
			gridDesc: "卡片網格的尺寸與間距。",
			dashboardControls: "儀表板控制項",
			dashboardControlsDesc: "儀表板周圍各控制項的可見性。",
			cardSurface: "卡片表面",
			cardSurfaceDesc: "套用於每張卡片的透明度與毛玻璃模糊。",
			startup: "啟動與分頁",
			startupDesc: "首頁檢視何時、在何處開啟。",
			opening: "開啟筆記",
			openingDesc: "在 Hearth 中點擊筆記時它在哪裡開啟。",
			mobileMode: "版面配置",
			mobileModeDesc: "當螢幕寬度不足以容納儀表板本身的配置時，儀表板如何排列。",
			privacy: "隱私與網路",
			privacyDesc: "控制 Hearth 允許發出的對外請求。",
		},
		about: {
			heading: "關於 Hearth",
			headingDesc: "專案連結、支援與版本。",
			setup: "設定 Hearth",
			setupDesc:
				"回答幾個關於您工作方式和已安裝外掛的問題，Hearth 就會建立一個相符的儀表板。" +
				"它會作為新儀表板新增——您已有的內容都不會改變。",
			setupAgain: "建立一個儀表板",
			setupAgainDesc:
				"再次執行設定精靈以產生另一個儀表板。它始終作為新儀表板新增，因此您現有的" +
				"儀表板絕不會被更動——它設定的一切都落在那一個儀表板上，而不是 Obsidian 儲存庫的全域設定。",
			setupButton: "開始設定",
			whatsNew: "更新內容",
			whatsNewDesc: "查看本版本及歷史每個版本的發行說明。",
			whatsNewButton: "查看更新日誌",
			github: "GitHub 儲存庫",
			githubDesc: "瀏覽原始碼、為專案加星，或閱讀更新日誌。",
			githubButton: "開啟 GitHub",
			reportIssue: "回報問題",
			reportIssueDesc: "遇到 bug 或有功能想法？請在 GitHub 上提交 issue。",
			reportIssueButton: "回報問題",
			kofi: "支持 Hearth",
			kofiDesc:
				"Hearth 是免費的，並且永遠免費。如果它值得留在您的主畫面上，" +
				"歡迎贊助——完全自願，不會鎖定任何功能。",
			kofiButton: "在 Ko-fi 上贊助",
			version: (v: string) => `版本 ${v}`,
			versionDesc: "您正在執行的 Hearth 建置版本。",
		},
		appearance: {
			heading: "外觀",
			headingDesc: "標題、圖示、搜尋列與整體內容寬度。",
			showTitle: "顯示標題",
			showTitleDesc: "在頂端顯示大標題／圖示。",
			showSearch: "顯示搜尋區域",
			showSearchDesc:
				"顯示搜尋與命令列及其結果和篩選按鈕。各個儀表板可在自己的設定中覆寫此項。",
			title: "標題",
			titleDesc: "顯示在首頁檢視頂端的標題文字。",
			titleIcon: "標題圖示",
			titleIconDesc:
				"標題旁繪製的標誌。可以是 Lucide 圖示 ID（用 🔍 按鈕瀏覽圖示集）、" +
				"表情符號或一兩個字元、Obsidian 儲存庫中圖片的路徑（📷 按鈕），或網路圖片的網址。" +
				"留空則使用 Hearth 水晶圖示。每個儀表板都可以在自己的設定中覆寫此項。",
			tabIcon: "分頁圖示",
			tabIconDesc:
				"用於 Hearth 分頁標題列和側邊欄按鈕的 Lucide 圖示，取代 Hearth 水晶圖示。" +
				"可瀏覽圖示集或輸入 ID；留空則使用水晶圖示。",
			themeColorTarget: "跟隨主題圖示顏色",
			themeColorTargetDesc:
				"用主題的圖示顏色繪製水晶圖示和／或標題文字，取代預設的紫色水晶與一般文字。",
			themeColorNone: "關閉",
			themeColorIcon: "圖示",
			themeColorTitle: "標題",
			themeColorBoth: "圖示與標題",
			searchPlaceholder: "搜尋預留位置文字",
			searchInstantAnswers: "即時答案",
			searchInstantAnswersDesc:
				"在筆記上方直接回答查詢——計算、貨幣、股票、天氣、維基百科等。" +
				"在下方選擇要啟用的答案。線上答案僅在查詢需要時取得。",
			searchTips: "搜尋技巧",
			searchTipsDesc: "搜尋列能理解的所有內容，附範例。",
			searchTipsButton: "顯示",
			searchContents: "搜尋筆記內容",
			searchContentsDesc:
				"除名稱、標籤和屬性外，也比對筆記內文中的文字。內文比對會附帶摘要顯示在" +
				"名稱比對之後。",
			searchScrollToMatch: "捲動到搜尋比對處",
			searchScrollToMatchDesc:
				"從搜尋結果開啟筆記時，跳轉到內文中的第一個比對處並醒目提示。",
			searchEngine: "搜尋引擎",
			searchEngineDesc:
				"為搜尋列提供支援的引擎。快速切換會像 Obsidian 的快速切換一樣比對：僅檔案，包含別名。" +
				"Omnisearch 需要安裝並啟用 Omnisearch 社群外掛。",
			searchEngineBuiltin: "Hearth（內建）",
			searchEngineOmnisearch: "Omnisearch",
			searchEngineQuickSwitcher: "快速切換",
			omnisearchMissing:
				"Omnisearch 未安裝或未啟用。請先安裝並啟用，然後再次選擇。",
			omnisearchInstallLink: "在社群外掛中開啟 Omnisearch",
			showNewNoteButton: "顯示「新增筆記」按鈕",
			showNewNoteButtonDesc: "在搜尋框旁顯示操作按鈕。",
			newNoteButtonMode: "搜尋列按鈕",
			newNoteButtonModeDesc:
				"搜尋列旁的按鈕做什麼：新增筆記，或用搜尋框中的內容搜尋網路。",
			newNoteButtonModeNewNote: "新增筆記",
			newNoteButtonModeSearchOnline: "線上搜尋",
			webSearchEngine: "線上搜尋引擎",
			webSearchEngineDesc:
				"「線上搜尋」按鈕開啟哪個引擎。按鈕旁的箭頭可以用其他引擎搜尋一次，" +
				"而不會改變這裡的選擇。",
			newNoteHeading: "「新增筆記」按鈕",
			newNoteHeadingDesc:
				"它建立什麼、建立在哪裡。同一組設定同時驅動搜尋列旁的按鈕、" +
				"搜尋列卡片上的按鈕，以及 Hearth 的「新增筆記」命令。",
			newNoteButtonLabel: "按鈕文字",
			newNoteButtonLabelDesc: "按鈕上的文字。留空則顯示「新增筆記」。",
			newNoteTemplate: "範本",
			newNoteTemplateDesc:
				"用 Templater 範本建立筆記，而不是空白筆記。" +
				"範本處理由 Templater 完成——您的使用者指令碼、tp.system.prompt() 對話框" +
				"和游標定位的行為都與從它自己的命令呼叫時一致。",
			newNoteTemplateNone: "空白筆記",
			newNoteTemplatePick: "選擇一個範本…",
			newNoteTemplateClear: "使用空白筆記",
			newNoteTemplaterMissing:
				"Templater 未啟用。請安裝並啟用它才能在此使用範本；" +
				"在此之前該按鈕會建立空白筆記。",
			newNoteFolder: "位置",
			newNoteFolderDesc:
				"新筆記所在的資料夾，若不存在則自動建立。" +
				"「預設位置」表示 Obsidian 放置新筆記的位置。",
			newNoteFolderClear: "使用預設位置",
			newNoteFilename: "檔名",
			newNoteFilenameDesc:
				"新筆記的名稱，不含副檔名。{{date}}、{{date:FMT}}、{{time}}、" +
				"{{time:FMT}} 和 {{prompt}} 會被取代 — {{prompt}} 會在每次點擊時" +
				"詢問名稱。留空則使用「Untitled」。",
			newNoteFilenamePlaceholder: "Untitled",
			newNoteDestination: (destination: string) => `將建立於 ${destination}`,
			contentWidth: "內容寬度",
			contentWidthDesc:
				"首頁內容可以擴展到的最大寬度（像素）。這只是上限，而非固定寬度——" +
				"在較窄的窗格中內容仍會自動收縮。",
			fullWidth: "全寬",
			fullWidthDesc:
				"讓內容填滿整個窗格，而不停在下方設定的寬度處。窗格變寬時卡片會依比例" +
				"放大，但文字不會隨之變大，因此非常寬的儀表板看起來會比較稀疏。",
		},
		performance: {
			tier: "效能等級",
			tierDesc:
				"每降一級，就關掉儀表板上下一項最耗資源的效果。下方的設定不會被覆寫——" +
				"當您調回較高等級時，它們會原樣恢復。",
			tierFull: "完整——全部開啟",
			tierBalanced: "平衡——較輕的天空",
			tierReduced: "精簡——靜止不動",
			tierMinimal: "最簡——樸素靜止",
			/** One line per tier, shown under the dropdown for the selected one. */
			tierFullDesc:
				"所有效果全強度開啟。繪製的天氣天空是其中最耗資源的部分：" +
				"如果儀表板讓機器發熱，就從這一項開始降級。",
			tierBalancedDesc:
				"繪製的天空以一半密度呈現——較少的雨滴、星星、雲與霧絲。" +
				"沒有任何效果被關閉，也沒有任何東西停止運動；只是數量較少，" +
				"資源量約減少三分之一。",
			tierReducedDesc:
				"儀表板上不再有任何動畫，卡片後方的毛玻璃也已關閉。桌布保留，" +
				"卡片保持半透明，每張卡片仍依計時器重新整理——只是儀表板靜止了。",
			tierMinimalDesc:
				"最節省的一端：用純色取代桌布、卡片不透明、無動畫，" +
				"卡片也不再依計時器自動重新整理。",
			pauseWhenUnfocused: "Obsidian 不在前景時暫停動畫",
			pauseWhenUnfocusedDesc:
				"當您在另一個應用程式或另一個視窗工作時，暫停所有動畫。" +
				"被其他分頁擋住的 Hearth 分頁本身就不消耗資源；此項針對的是" +
				"在您並未使用的視窗中仍可見的儀表板——例如與瀏覽器並排，或在第二個螢幕上。" +
				"如果您讓儀表板常駐第二個螢幕，請關閉此項。",
			color: "最簡模式背景",
			colorDesc:
				"最簡等級下首頁檢視後方的純色。任何 CSS 顏色，例如 #4a4459。",
			/** Bullet list of what the selected tier changes, shown under the dropdown. */
			effects: "在此等級下：",
			effectSkyHalf: "繪製的天氣天空以一半密度呈現",
			effectBackground: "背景為純色——無圖片、GIF、不透明層或模糊",
			effectOpaque: "卡片不透明，而非半透明",
			effectFrost: "卡片後方沒有毛玻璃模糊",
			effectMotion: "轉場、游標停留浮起、陰影與動畫均關閉",
			effectRefresh:
				"網頁、RSS、行事曆訂閱和 Jira 卡片不再依計時器重新整理（手動重新整理仍然可用）",
			effectLiveRefresh: "儀表板不再因 Obsidian 儲存庫變化而自行重建",
			effectClock: "時鐘卡片不顯示秒數與走動的秒針",
			effectSlideshow: "投影片卡片固定顯示一張圖片，不再輪播",
			/** Shown in the sections whose settings the tier currently overrides. */
			vibrancyFrost:
				"啟用 Obsidian 的「半透明視窗」時，毛玻璃效果會關閉：模糊與 macOS 的" +
				"半透明材質會讓整個視窗互相重新混合，導致分頁列閃爍。你的模糊設定會保留，" +
				"關閉半透明視窗後即可恢復。",
			overridden:
				"目前的效能等級覆寫了這些設定。它們會原樣保留，並在您調回較高等級時重新生效。",
		},
		background: {
			heading: "背景",
			headingDesc: "首頁檢視後方的背景，以及它透出的程度。",
			type: "背景類型",
			typeDesc: "在首頁檢視後方顯示什麼。",
			value: "背景值",
			valueColorDesc: "一個 CSS 顏色值，例如 #1e1e2e 或 rgb(30,30,46)。",
			valueImageDesc: "Obsidian 儲存庫內的圖片路徑，例如 Attachments/bg.png。",
			valueUrlDesc: "圖片的直接連結網址。",
			valueVideoDesc: "Obsidian 儲存庫內的影片路徑，例如 Attachments/loop.mp4。它會靜音循環播放。",
			videoNote:
				"影片背景是 Hearth 能繪製的最耗資源的一種——儀表板開啟期間它一直在解碼畫面。它只在「完整」效能等級下播放；從「平衡」往下會停留在第一幀。",
			externalCallsDisabled:
				"「行為」中的「停用對外連線」已開啟，因此不會顯示：該背景需要從網路取得。" +
				"請改用 Obsidian 儲存庫內的圖片，或關閉該設定。",
			opacity: "不透明度",
			opacityDesc: "背景透出的程度。數值越低越含蓄。",
			blur: "模糊",
			blurDesc: "背景模糊半徑（像素）。",
			layout: "背景版面配置",
			layoutDesc:
				"讓背景鋪滿整個檢視，或作為橫幅呈現——儀表板頂端的一條區域，" +
				"就像筆記上方的封面圖那樣——下方的卡片使用主題本身的表面。" +
				"每個儀表板都可以在自己的設定中覆寫此項。",
			layoutLabels: {
				full: "完整背景",
				banner: "橫幅",
			},
			bannerHeight: "橫幅高度",
			bannerHeightDesc: "橫幅區域的高度（像素）。",
			bannerFade: "淡出下緣",
			bannerFadeDesc: "讓橫幅溶入頁面，而不是以一條硬邊結束。",
			bannerFullWidth: "全寬",
			bannerFullWidthDesc: "讓橫幅橫貫視窗兩端，而不是與下方內容對齊。",
			labels: {
				default: "Hearth 預設",
				harbour: "港口小鎮",
				none: "無",
				color: "純色",
				image: "Obsidian 儲存庫圖片",
				url: "圖片網址",
				video: "Obsidian 儲存庫影片",
				weather: "即時天氣天空",
			},
			weatherHeading: "天氣天空",
			weatherDesc:
				"儀表板的背景變成一幅繪製的天空——與天氣卡片的藝術風格相同，鋪滿整個視窗。" +
				"可以跟隨某地的真實天氣狀況（資料來自 Open-Meteo；僅傳送座標，" +
				"且在關閉對外連線時不會請求任何資料），也可以固定一種天空，" +
				"這樣無需位置資訊，也永不連網。",
			weatherNoPlace: "請在下方選擇一個位置以繪製天空。",
			skySource: "天空",
			skySourceDesc: "跟隨某地的真實天氣，或不論外面如何都保持一種天空。",
			skySourceLive: "即時天氣",
			skySourceFixed: "固定天空",
			skyCondition: "天氣狀況",
			skyConditionDesc: "此天空始終顯示的天氣。",
			skyDaylight: "時段",
			skyDaylightDesc: "天空是跟隨您的時鐘，還是固定為白天或夜晚。",
			skyDaylightAuto: "跟隨時鐘",
			skyDaylightDay: "始終白天",
			skyDaylightNight: "始終夜晚",
			skyAnimate: "讓天空動起來",
			skyAnimateDesc:
				"儀表板後方飄動的雲、落下的雨與閃爍的星。在低功耗模式下，" +
				"以及系統要求減少動態效果的使用者處，始終關閉。",
			skyDesign: "設計",
			skyDesignDesc: "經典的手繪天空，或 Material 3 Expressive 風格的扁平天空：山丘、圓潤的雲與旋轉的太陽。",
			wallpaperDesignDesc:
				"經典山丘與小屋——淺色主題下是清晨，深色主題下是月夜——或以強調色色調繪製的 Material 3 Expressive 扁平圖形。由 Hearth 繪製，無需下載任何內容。",
			skyDesignClassic: "經典（手繪）",
			skyDesignExpressive: "Expressive（扁平）",
		},
		behaviour: {
			heading: "行為",
			headingDesc: "Hearth 何時、在何處開啟，以及手機／平板的「僅搜尋」模式。",
			openOnStartup: "啟動時開啟",
			openOnStartupDesc: "Obsidian 儲存庫載入時開啟首頁檢視。",
			replaceNewTabs: "取代新分頁",
			replaceNewTabsDesc: "顯示首頁檢視，取代空白新分頁。",
			focusSearchOnOpen: "開啟時聚焦搜尋框",
			focusSearchOnOpenDesc:
				"每次開啟首頁檢視時把游標放進搜尋框，讓您可以立即開始輸入。僅桌面版。",
			liveRefresh: "隨 Obsidian 儲存庫變化即時重新整理",
			liveRefreshDesc:
				"Obsidian 儲存庫變化時保持已開啟的首頁檢視為最新——最近、書籤和已儲存查詢卡片" +
				"無需重新開啟分頁即會更新。無論此設定如何，切回 Hearth 分頁時總會重新整理。",
			liveSettingsSync: "接收同步的變更",
			liveSettingsSyncDesc:
				"同步送達其他裝置上所做的儀表板變更後立即套用，而不必等到下次重新啟動 " +
				"Obsidian。除非儀表板在使用過程中重新載入會造成困擾，否則請保持開啟。",
			deviceLocalState: "僅在本裝置儲存檢視狀態",
			deviceLocalStateDesc:
				"僅在本裝置上記住目前儀表板和捲動位置，切換儀表板不會修改 data.json，" +
				"捲動也不會重寫 workspace.json。適合用 Git 同步 Obsidian 儲存庫時使用。" +
				"開啟後，捲動位置會在 Obsidian 重新啟動時遺失。",
			legacyTag: "舊版",
			mobileSearchOnly: "行動模式（僅搜尋）",
			mobileSearchOnlyDesc:
				"在手機和平板上隱藏儀表板，僅顯示搜尋框。對桌面版無影響。",
			stackOnNarrow: "窄螢幕時堆疊卡片",
			stackOnNarrowDesc:
				"當儀表板寬度不足以容納其配置時——手機，或桌面版的窄窗格——改為將卡片顯示為" +
				"單欄通欄。你的配置不會被修改，恢復寬度後即照舊。每張卡片都可以在自身設定" +
				"中為該單欄個別設定隱藏、排序、高度或摺疊。",
			narrowWidth: "窄螢幕寬度門檻",
			narrowWidthDesc:
				"儀表板寬度低於該像素值即視為窄螢幕。調高它，半螢幕視窗也會切換到窄螢幕版面；" +
				"調低它，則在更窄的窗格中仍保持自由配置。各個儀表板可以個別覆寫此設定。",
			mobilePerformanceTier: "行動裝置效能等級",
			mobilePerformanceTierDesc:
				"在手機和平板上使用的等級——那裡動畫天空與毛玻璃繪製在最小的螢幕上，卻要由" +
				"電池來買單。桌面版的等級單獨儲存，不會被改變。",
			mobileTierMatch: "與桌面版一致",
			disableExternalCalls: "停用對外連線",
			disableExternalCallsDesc:
				"阻止 Hearth 發出的所有對外網路請求，包括 Jira、外部行事曆、RSS 來源、" +
				"計算機的匯率查詢，以及以網址給出的背景圖片和標題圖示——它們會" +
				"分別退回為不顯示圖片和 Hearth 水晶。",
			openIn: "筆記開啟位置",
			openInDesc:
				"從 Hearth 開啟筆記時它去哪裡。「目前分頁」會取代首頁檢視，" +
				"使 Hearth 表現得像任何其他分頁。無論如何，Ctrl/Cmd 點擊總會開啟新分頁。",
			openInModes: {
				tab: "新分頁",
				same: "目前分頁（取代 Hearth）",
				split: "分割窗格",
				window: "新視窗",
			},
			/** The extra choice each per-source dropdown offers on top of the four
			 * destinations: follow whatever "Open notes in" is set to. */
			openInFollow: "同上",
			openInSources: {
				link: "連結",
				linkDesc: "筆記、任務和連結卡片中的連結。",
				search: "搜尋結果",
				searchDesc: "來自搜尋列和搜尋卡片的結果。",
				card: "卡片中的筆記",
				cardDesc:
					"由最近、書籤、我的最愛、行事曆、熱度圖和任務卡片列出的筆記，以及行動裝置操作按鈕。",
				newNote: "Hearth 建立的筆記",
				newNoteDesc: "新筆記、日記和活動筆記，在建立時隨即開啟。",
			},
			openFromOutside: "從 Hearth 之外開啟的筆記",
			openFromOutsideDesc:
				"檔案總管、快速切換器、關係圖譜——以及卡片嵌入的、自行開啟連結的內容。" +
				"Obsidian 會把它們交給目前聚焦的分頁，因此 Hearth 分頁會被佔用。" +
				"選擇「新分頁」可保留 Hearth 分頁；此時檔案總管將不再跟隨您開啟的檔案。",
			openFromOutsideModes: {
				same: "目前分頁（取代 Hearth）",
				tab: "新分頁（保留 Hearth）",
			},
		},
		mobileActions: {
			heading: "行動操作列",
			headingDesc:
				"在行動模式（僅搜尋）下，這一排按鈕取代搜尋列旁的「新增筆記」按鈕，" +
				"改為出現在搜尋框和篩選按鈕下方。每個按鈕都可以執行命令、" +
				"開啟筆記或檔案，或開啟一個網址——就像啟動台圖磚一樣。",
			showActionBar: "顯示操作列",
			showActionBarDesc: "在行動模式下於搜尋框下方顯示這排操作按鈕。",
			labelPlaceholder: "標籤",
			iconPlaceholder: "圖示",
			commandTooltip: (id: string) => `命令：${id}`,
			pickCommand: "選擇一個命令",
			moveUp: "上移",
			moveDown: "下移",
			removeButton: "移除按鈕",
			addButton: "新增按鈕",
			resetDefaults: "重設為預設",
		},
		/** The full catalogue shown at the top of the Integrations tab. Every
		 * integration is listed here whether or not it has a setting and whether
		 * or not the plugin is installed — see `src/integrations.ts`. */
		integrations: {
			heading: "所有整合",
			headingDesc:
				"Hearth 可以配合使用的一切，無論是否已安裝都列在這裡。" +
				"多數整合無需設定——需要設定的會說明其設定所在的位置。",
			groups: {
				plugin: "社群外掛",
				pluginDesc: "這些外掛一旦啟用，Hearth 就會自動辨識。",
				core: "Obsidian 核心外掛",
				coreDesc:
					"內建於 Obsidian。如果某張卡片提示缺少其中之一，請在 設定 → 核心外掛 中啟用。",
				service: "外部服務",
				serviceDesc:
					"透過網路取得資料的卡片。行為 → 隱私與網路 下的「停用對外連線」可一次性全部靜默。",
			},
			status: {
				enabled: "已啟用",
				disabled: "已停用",
				missing: "未安裝",
				external: "網路",
				always: "始終可用",
			},
			/** Tooltip on the status pill, spelling out what it means for Hearth. */
			statusTooltip: {
				enabled: "已安裝並啟用 — Hearth 正在使用它。",
				disabled: "已安裝但已關閉，因此 Hearth 目前無法使用它。",
				missing: "未安裝。Hearth 的其他一切在沒有它的情況下也能正常運作。",
				external: "這是一次對外請求，而不是外掛。",
				always: "無需安裝。",
			},
			/** Where this integration's settings live, shown under the description. */
			where: {
				section: "設定就在本頁下方。",
				tab: (tab: string) => `設定位於 ${tab} 下。`,
				card: "在儀表板上的卡片本身進行設定。",
				pluginSettings: "使用該外掛自己的設定 — Hearth 中無需設定。",
				none: "無需設定。",
			},
			/** Row buttons. */
			install: "安裝",
			installTooltip: "在 Obsidian 的社群外掛瀏覽器中開啟此外掛。",
			goToSection: "顯示",
			goToTab: "開啟",
			/** One entry per id in `INTEGRATIONS`. */
			items: {
				stereo: {
					name: "Stereo",
					desc:
						"讓音樂卡片控制 Stereo 外掛的 Navidrome/Subsonic 播放器——目前曲目、" +
						"佇列和播放控制。",
				},
				omnisearch: {
					name: "Omnisearch",
					desc:
						"把搜尋列切換到 Omnisearch 的模糊全文索引，取代 Hearth 的內建引擎。" +
						"請在 搜尋 → 搜尋列 下選擇引擎；該選擇僅在 Omnisearch 啟用時保持有效。",
				},
				tasknotes: {
					name: "TaskNotes",
					desc:
						"讓任務卡片讀取 TaskNotes「一任務一筆記」的儲存庫——狀態、到期日和優先順序" +
						"直接來自 frontmatter。",
				},
				dataview: {
					name: "Dataview",
					desc:
						"Dataview 卡片執行 DQL 查詢和 DataviewJS 程式碼區塊，使用 Dataview 自己的" +
						"轉譯器呈現，並隨其索引變化重新整理。",
				},
				datacore: {
					name: "Datacore",
					desc:
						"Dataview 的後繼者。Datacore 卡片執行 Datacore 查詢——或 JS/JSX/TS/TSX " +
						"指令碼——並用 Datacore 自己的即時檢視轉譯。",
				},
				templater: {
					name: "Templater",
					desc:
						"「從範本新增筆記」卡片把您的 Templater 範本變成按鈕：每個圖磚攜帶" +
						"自己的範本、目標資料夾和檔名格式，一鍵即可建立筆記。" +
						"範本處理由 Templater 完成——您的使用者指令碼、tp.system.prompt() 對話框" +
						"和游標定位的行為都與從它自己的命令呼叫時一致。",
				},
				periodicNotes: {
					name: "Periodic Notes",
					desc:
						"「週期筆記」卡片顯示本週、本月、本季或今年的筆記——" +
						"定位由 Periodic Notes 完成，缺少的筆記也由它依您自己的範本建立。",
				},
				journals: {
					name: "Journals",
					desc:
						"同一張卡片也可以讀取 Journals：選擇您的某個日誌，它就會顯示該日誌" +
						"目前週期的筆記——定位與建立都透過 Journals 外掛自身的 API 完成，" +
						"沿用它的範本與建立提問。",
				},
				git: {
					name: "Git",
					desc:
						"Git 卡片顯示 Git 儲存庫的分支、變更和最近提交，並透過 Git 外掛本身進行" +
						"提交、同步、推送和拉取——它的遠端、憑證和提交訊息範本都原樣適用。",
				},
				operon: {
					name: "Operon",
					desc:
						"Operon 卡片——任務、看板、行程和計時器——透過 Operon 自己的開發者 API " +
						"讀取資料，因此狀態、優先順序和重複規則仍由它定義。僅桌面版，" +
						"需要 Obsidian 1.12.2 或更新版本，且 Operon 必須核准 Hearth 的讀取請求。",
				},
				iconic: {
					name: "Iconic",
					desc:
						"用 Iconic 設定的個別檔案圖示會出現在 Hearth 列出檔案的任何位置——" +
						"最近、我的最愛、已儲存搜尋和搜尋結果。",
				},
				iconize: {
					name: "Iconize",
					desc:
						"對 Iconize（原 Obsidian Icon Folder）同樣適用，包括透過 frontmatter " +
						"屬性設定的圖示。",
				},
				frontMatterTitle: {
					name: "Front Matter Title",
					desc: "資料夾卡片和資料夾瀏覽頁會用 Front Matter Title 在檔案清單中顯示的標題來列出筆記，而不是檔名。",
				},
				vaultPet: {
					name: "Vault Pet",
					desc:
						"Vault Pet 卡片把該外掛安置在您的儀表板上：既可以是它自己的寵物卡片，" +
						"活生生且可點擊，也可以是它完整的小屋，含任務、圖鑑、徽章與統計。" +
						"寵物、經驗以及解鎖的一切都屬於 Vault Pet，Hearth 只提供空間。",
				},
				excalidraw: {
					name: "Excalidraw",
					desc:
						"嵌入卡片可即時轉譯 Excalidraw 繪圖，「新增繪圖」操作則透過 Excalidraw " +
						"自己的命令建立。",
				},
				bases: {
					name: "Bases",
					desc: "嵌入卡片可以在儀表板上顯示 Bases（.base）檢視。",
				},
				canvas: {
					name: "白板",
					desc: "嵌入卡片可以顯示白板，可互動且鋪滿整張卡片。",
				},
				dailyNotes: {
					name: "日記",
					desc:
						"日記、迷你行事曆和儲存庫統計卡片會依據日記外掛自己的資料夾、日期格式" +
						"和範本來定位今天的筆記。",
				},
				bookmarks: {
					name: "書籤",
					desc: "書籤卡片列出您的 Obsidian 書籤，群組一併顯示。",
				},
				globalSearch: {
					name: "搜尋",
					desc: "當您需要完整結果時，把查詢交給 Obsidian 自己的搜尋面板。",
				},
				fileExplorer: {
					name: "檔案總管",
					desc: "為 Hearth 搜尋結果上的「在檔案總管中顯示」提供支援。",
				},
				workspaces: {
					name: "工作區",
					desc: "開啟某個儀表板時，它可以切換到一個已儲存的工作區。",
				},
				audioRecorder: {
					name: "錄音機",
					desc: "「錄音」行動操作按鈕用於啟動和停止 Obsidian 自己的錄音機。",
				},
				leafViews: {
					name: "任何帶側邊面板的外掛",
					desc:
						"外掛檢視卡片可以在卡片內承載另一個外掛註冊的檢視——行事曆、看板、" +
						"大綱、標籤面板等。凡是已安裝的都會出現在卡片的檢視選擇器中。",
				},
				jira: {
					name: "Jira",
					desc:
						"Jira 卡片透過 REST API 從您的 Jira Cloud 或 Server instance 取得工作項目，" +
						"使用您在卡片上填入的憑證。",
				},
				rss: {
					name: "RSS 與 Atom 訂閱",
					desc: "RSS 卡片可取得並解析您指定的任何 RSS 2.0 或 Atom 來源。",
				},
				ics: {
					name: "iCalendar 訂閱",
					desc:
						"迷你行事曆卡片可訂閱外部 ICS/webcal 行事曆 — Google、iCloud、Fastmail、" +
						"Nextcloud 等。",
				},
				currency: {
					name: "匯率",
					desc:
						"計算機卡片和搜尋列使用歐洲央行每日發布的參考匯率進行換算，匯率直接取自歐洲中央銀行；" +
						"只有在無法存取時才會改用 Frankfurter 鏡像。",
				},
				markets: {
					name: "行情報價",
					desc: "行情卡片從免費、無需金鑰的來源讀取報價：Yahoo Finance 涵蓋全球大多數交易所、外匯和加密貨幣；騰訊涵蓋滬深京及港股；天天基金（東方財富）提供場外基金估值；CoinGecko 提供加密貨幣；Frankfurter 提供歐洲央行匯率。這些都不是官方 API，因此某個來源失敗時卡片會自動改用另一個來源。只會傳送卡片上的代號。",
				},
				weather: {
					name: "天氣預報",
					desc:
						"天氣卡片——以及即時天氣天空背景——從 Open-Meteo 取得天氣狀況：" +
						"免費、無需金鑰、無需帳號。僅會傳送您選擇的座標，" +
						"而固定為某一天氣狀況的天空則完全不需要位置資訊。",
				},
				tension: {
					name: "全球緊張局勢",
					desc:
						"全球緊張局勢卡片從 kite.kagi.com 讀取 Kagi News 的全球緊張指數——" +
						"由語言模型根據當天的國際新聞給出的 0–100 評分。免費、無需金鑰和帳號，" +
						"不會傳送任何關於你或你的 Obsidian 儲存庫的資訊。",
				},
				webSearch: {
					name: "網路搜尋",
					desc:
						"搜尋列的按鈕可以把查詢傳送到 DuckDuckGo，而不是建立筆記。" +
						"可在 搜尋 → 搜尋列 下切換。",
				},
			},
		},
		tasks: {
			heading: "任務／TaskNotes",
			headingDesc:
				"任務卡片在 TaskNotes 模式下讀取的欄位名稱。TaskNotes 沒有面向其他外掛的" +
				"穩定 API，因此這裡直接讀取其 frontmatter — 請讓這些與 TaskNotes 自己" +
				"設定中對應的名稱一致（下面的預設值就是 TaskNotes 自己的預設值）。",
			statusField: "狀態欄位",
			statusFieldDesc: "讀取任務狀態所用的 frontmatter 欄位。",
			dueField: "到期日欄位",
			dueFieldDesc: "讀取任務到期日所用的 frontmatter 欄位。",
			priorityField: "優先順序欄位",
			priorityFieldDesc: "讀取任務優先順序標記所用的 frontmatter 欄位。",
			doneValue: "「已完成」狀態值",
			doneValueDesc: "標記 TaskNotes 任務已完成的狀態值。",
			fieldsEnable: "自訂任務欄位",
			fieldsEnableDesc:
				"用您自己定義的欄位取代任務卡片顯示的固定中繼資料——任何 frontmatter 屬性" +
				"或 Hearth 能讀取的內容，名稱、顏色和順序都由您決定。預設關閉，" +
				"在您開啟之前任務保持一般的樣式。開啟後從空白開始：任務只顯示您新增的欄位。",
			fields: "任務上顯示的欄位",
			fieldsDesc:
				"每張任務卡片顯示的欄位。單張卡片可以在自己的設定中定義另一套。",
		},
		fileIcons: {
			heading: "檔案圖示／Iconic／Iconize",
			headingDesc:
				"在 Hearth 顯示檔案的任何位置——最近、我的最愛、已儲存搜尋和搜尋列——" +
				"使用您透過 Iconic 或 Iconize 外掛設定的個別檔案圖示。支援顯示 Lucide 圖示" +
				"和表情符號；使用下載圖示包中圖示的檔案仍會顯示 Hearth 自己的檔案類型圖示。",
			enable: "使用來自 Iconic／Iconize 的圖示",
			enableDesc: "關閉後所有檔案都顯示 Hearth 的檔案類型圖示，忽略這兩個外掛。",
			enableDescNoPlugin:
				"目前 Iconic 與 Iconize 都未啟用，因此除非下方 frontmatter 選項已開啟，" +
				"所有檔案都顯示 Hearth 的檔案類型圖示。此項可以保持開啟——一旦其中之一被安裝即會生效。",
			property: "Iconize frontmatter 屬性",
			propertyDesc:
				"Iconize 存放筆記圖示的屬性，用於透過 frontmatter 而非選單設定的圖示。" +
				"可以用逗號分隔多個屬性，以便加入其他外掛寫入的屬性。" +
				"如果您重新命名過，請與 Iconize 自己的設定保持一致（其預設值為「icon」）。",
			frontmatterWithoutPlugin: "無需圖示外掛也讀取 frontmatter 圖示",
			frontmatterWithoutPluginDesc:
				"即使沒有安裝 Iconic 或 Iconize，也顯示筆記 frontmatter 中指定的圖示——" +
				"適用於其他外掛（Notebook Navigator、Pretty Properties、AutoIcon）或手動寫入的圖示。" +
				"預設關閉：「icon」是很常見的屬性名稱，用它表示其他含義的 Obsidian 儲存庫會把這些值顯示成圖示。" +
				"只顯示表情符號和 Obsidian 已知的圖示 ID，其他情況保留 Hearth 的檔案類型圖示。",
		},
		frontMatterTitle: {
			heading: "Front Matter Title",
			headingDesc:
				"當 Front Matter Title 外掛為筆記設定了標題時，依檔案清單的方式顯示筆記：" +
				"資料夾卡片和資料夾瀏覽頁會用該標題而不是檔名來列出每篇筆記。" +
				"跟隨該外掛自身的檔案清單設定——其檔案清單功能關閉時，顯示檔名。",
			enable: "使用 Front Matter Title 的標題",
			enableDesc: "關閉後，每篇筆記都依檔名列出，忽略該外掛。",
			enableDescNoPlugin: "Front Matter Title 目前未啟用，因此筆記依檔名列出。此項可以保持開啟——外掛安裝後即會生效。",
		},
		operon: {
			heading: "Operon",
			headingDesc:
				"透過 Operon 外掛自己的開發者 API 讀取任務、看板、行程和正在執行的計時器——" +
				"任務的定義仍以 Operon 為準，Hearth 只顯示它回傳的內容。",
			enable: "連線到 Operon",
			enableDesc:
				"關閉即為總開關：Operon 卡片停止讀取，Hearth 也絕不會向 Operon 請求存取。" +
				"在儀表板上出現 Operon 卡片之前不會發起任何請求。",
			status: "連線",
			statusAbsent: "Operon 未安裝或未啟用。",
			statusUnsupported:
				"Operon 的開發者 API 僅支援桌面版，且需要 Obsidian 1.12.2 或更新版本。",
			statusBooting: "Operon 正在執行，但仍在啟動中。",
			statusPending:
				"等待核准。請開啟 設定 → Operon → Core → General → Developer API " +
				"Integrations 並核准 Hearth。",
			statusSuspended:
				"存取已暫停。請在 Operon 的 Developer API Integrations 中查看 Hearth 待核准的權限範圍。",
			statusRevoked:
				"存取已被撤銷。請在 Operon 的 Developer API Integrations 中重新授予。",
			statusReady: "已連線 — Operon 卡片可以讀取任務。",
			statusIdle: "尚未連線。新增一張 Operon 卡片即可開啟工作階段。",
			statusOff: "該整合已關閉，因此 Hearth 不會從 Operon 讀取任何內容。",
			statusError: "Operon 拒絕了連線。",
			detail: "Operon 回報",
			install: "在社群外掛中開啟 Operon",
			writes: "允許變更",
			writesDesc:
				"允許看板卡片透過拖曳把任務移到另一個狀態，並新增一個用於建立任務的「+」。" +
				"新任務放在哪裡、某次移動是否合法都由 Operon 決定；Hearth 只是發起請求。" +
				"開啟此項會擴大 Hearth 請求的權限範圍，因此您需要在 Operon 的 " +
				"Developer API Integrations 中重新核准。關閉則表示 Hearth 只能讀取。",
			writesPending:
				"讀取正常，但變更權限尚未授予——請在 Operon 的 Developer API Integrations " +
				"中重新核准 Hearth。在此之前卡片保持唯讀。",
			capabilities: "請求的存取權限",
			capabilitiesDesc:
				"Hearth 一次性請求全部權限，因為 Operon 不會開啟部分核准的工作階段。" +
				"除非開啟「允許變更」（會追加任務狀態轉換與任務建立權限），否則均為唯讀。",
			missing: (names: string) => `尚未授予：${names}`,
			recheck: "重新檢查",
			recheckDesc: "在核准、撤銷或重新載入 Operon 後重新建立連線。",
			recheckAction: "立即重新檢查",
		},
		filters: {
			heading: "篩選標籤",
			headingDesc:
				"篩選項目依據 Obsidian 儲存庫中的檔案類型自動偵測。可隱藏不需要的項目，並選擇隱藏時是否同時把這些類型從結果中排除。",
			strict: "僅搜尋顯示的類型",
			strictDesc:
				"關閉：隱藏篩選標籤只會把它從列中移除，搜尋仍會尋找所有類型。開啟：結果僅限顯示篩選標籤的類型——每個標籤都視為已選取，關閉其中一個會進一步縮小搜尋範圍。",
		},
		dashboard: {
			heading: "儀表板",
			headingDesc:
				"卡片網格的尺寸與透明度。卡片本身在儀表板上新增和設定。",
			fitToPage: "符合頁面",
			fitToPageDesc: "把儀表板限制在一個畫面內，而不是允許捲動。",
			compact: "緊湊間距",
			compactDesc: "收緊卡片內距和上邊距，以擴大可用區域。",
			arrangeButtonVisibility: "排列按鈕可見性",
			arrangeButtonVisibilityDesc:
				"選擇排列／編輯按鈕是始終可見，還是在游標停留其區域時顯示。",
			dashboardSwitcherVisibility: "儀表板切換器可見性",
			dashboardSwitcherVisibilityDesc:
				"選擇左上角的儀表板按鈕是始終可見，還是在游標停留其區域時顯示。",
			visibilityOptions: {
				always: "始終可見",
				hover: "游標停留時顯示",
			},
			cardOpacity: "卡片不透明度",
			cardOpacityDesc: "讓卡片背景半透明，使儀表板背景透出。",
			cardBlur: "卡片模糊",
			cardBlurDesc:
				"半透明卡片後方的毛玻璃模糊。需要卡片不透明度低於 100% 才可見。0 = 關閉。",
			cardRadius: "卡片圓角半徑",
			cardRadiusDesc:
				"卡片圓角的半徑（像素）。預設為 14；數值越小圓角越銳利。",
			cardBorderWidth: "卡片邊框",
			cardBorderWidthDesc:
				"卡片邊框和標題列分隔線的粗細（像素）。0 表示隱藏邊框。",
			cardSurfaceExpressive:
				"Expressive 卡片使用不透明的色調表面和大圓角，因此不透明度、模糊、圓角半徑和邊框只作用於經典卡片。",
			cardDesign: "設計",
			cardDesignDesc:
				"Hearth 的繪製方式：經典，或 Material 3 Expressive——強調色的色調容器、膠囊與柔和形狀、較粗的字體。Expressive 適用於 Hearth 的整個介面：卡片、儀表板按鈕、所有對話框和選單，以及此設定頁面。儀表板或卡片仍可個別指定；內容來自你自己的卡片（筆記、嵌入、網頁）的內容保持不變，只採用 Expressive 的卡片外框。",
			designClassicDesc: "安靜的表面與細邊框——Hearth 一貫的樣子。",
			designExpressiveDesc: "處處 Material 3 Expressive：源自強調色的色調、膠囊與柔和形狀、醒目的字體。",
			designInUse: "使用中",
			cards: "卡片",
			cardsDesc:
				"卡片在儀表板上新增和設定：開啟首頁檢視，點擊「排列」，" +
				"然後使用「新增卡片」、「儀表板設定」以及每張卡片的設定按鈕。",
		},
		layout: {
			heading: "匯入／匯出",
			headingDesc: "以 JSON 檔案分享單個儀表板，或備份您的整套設定。",
			exportDashboard: "匯出目前的儀表板",
			exportDashboardDesc:
				"把您正在使用的儀表板儲存為他人可匯入的檔案。它的外觀會一併帶走，並可選擇是否包含桌布。",
			exportDashboardButton: "匯出儀表板…",
			importAny: "匯入",
			importAnyDesc:
				"開啟一個 Hearth 檔案——單個儀表板、一份版面配置或一份完整備份。在任何變更之前會先告訴您檔案內容；單個儀表板會新增到您現有儀表板旁邊，而不會取代任何內容。",
			export: "匯出版面配置",
			exportDesc: "將所有儀表板以及網格和版面配置設定下載為 JSON 檔案。",
			exportButton: "匯出檔案",
			exportMobileTooltip: "在行動裝置上，檔案會儲存到 Obsidian 儲存庫的根目錄。",
			importButton: "匯入檔案",
			exportSettings: "匯出設定",
			exportSettingsDesc:
				"將全部 Hearth 設定——完整版面配置加上頂端、背景、行為、外觀和 TaskNotes 選項——" +
				"下載為 JSON 備份檔案。",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		music: {
			source: "來源",
			sourceDesc: "卡片從哪裡取得音樂。",
			sources: {
				folder: "媒體庫資料夾",
				list: "媒體庫檔案（清單）",
				stereo: "Stereo（Navidrome/Subsonic）",
			},
			folder: "資料夾",
			folderDesc: "此資料夾裡的每個音訊檔案都會成為一首曲目。",
			folderPlaceholder: "音樂/專輯",
			pickFolder: "選擇資料夾",
			includeSubfolders: "包含子資料夾",
			includeSubfoldersDesc: "也取用其子資料夾裡的曲目。",
			found: (count: number) => `找到 ${count} 首曲目`,
			noTracks: "還沒有曲目——在下面新增一首。",
			addTrack: "新增曲目",
			pickTrack: "選擇音訊檔案",
			missingTrack: "該檔案已不在 Obsidian 儲存庫中",
			remove: "移除",
			playbackHeading: "播放",
			look: "正在播放的樣式",
			lookDesc: "卡片如何繪製目前播放的內容。",
			looks: { plain: "經典", medium: "中等", cover: "全封面", panel: "大封面" },
			showQueue: "顯示佇列",
			showQueueDesc: "在控制按鈕下方列出曲目。",
			stereoHeading: "Stereo 外掛",
			stereoMissing:
				"未安裝 Stereo。請從社群外掛瀏覽器安裝，然後重新選擇此來源。",
			stereoUnconfigured:
				"Stereo 已安裝但還沒有伺服器——在它的設定裡填寫 Navidrome/Subsonic 位址。",
			stereoReady: "已連線到 Stereo。在 Stereo 裡播放音樂，這張卡片負責控制。",
			openStereo: "開啟 Stereo",
			browsePlugins: "開啟設定",
		},
		title: "卡片設定",
		/** Shown as the tooltip on tile icon fields (launchpad, templater). */
		iconHelp:
			"輸入 Lucide 圖示 ID（例如「home」、「star」、「calendar」）— 可在 " +
			"lucide.dev/icons 瀏覽。也可以輸入 Obsidian 儲存庫中的圖片路徑（例如 " +
			"Attachments/icon.png）來用自己的圖片作為圖示。",
		/** Tabs across the top of the card settings modal. */
		tabs: {
			content: "內容",
			style: "樣式",
			layout: "版面配置",
		},
		type: "類型",
		typeDesc: "此卡片顯示什麼。",
		cardTitle: "標題",
		cardTitleDesc: "顯示在卡片標題列中。留空則卡片不帶標題列。",
		cardTitlePlaceholder: "標題",
		mobile: {
			heading: "在窄螢幕儀表板上",
			hidden: "隱藏",
			hiddenDesc:
				"當儀表板堆疊為單欄時不顯示此卡片。對於需要寬度才有意義的卡片（寬表格、看板檢視），隱藏比壓縮更好。",
			collapsed: "預設摺疊",
			collapsedDesc:
				"只顯示卡片的標題列，點擊展開時才建構卡片。未被展開的卡片只佔一列，且不會執行任何內容。",
			height: "高度",
			heightDesc:
				"堆疊時的高度（像素）。留空則沿用卡片自身的高度，並加以限制，避免過高的卡片獨佔整個畫面。",
			order: "位置",
			orderDesc:
				"此卡片在堆疊中的位置，從 0 開始。留空則依儀表板的閱讀順序排列——由上到下、由左到右。",
			autoPlaceholder: "自動",
		},
		resetSize: "重設為預設尺寸",
		removeCard: "移除卡片",
		removeCardTitle: "移除卡片？",
		removeCardMessage: (name: string) => `要從儀表板中移除「${name}」嗎？`,
		removeCardConfirm: "移除",
		thisCard: "此卡片",
		done: "完成",
		kinds: {
			music: "音樂",
			embed: "嵌入（筆記／圖片／base）",
			slideshow: "投影片",
			daily: "日記（今天）",
			periodic: "週期筆記／日誌",
			web: "網頁（iframe）",
			bookmarks: "書籤",
			favorites: "我的最愛",
			text: "文字／便箋",
			recent: "最近檔案",
			folder: "資料夾內容",
			links: "連結／啟動台",
			templater: "從範本新增筆記",
			clock: "時鐘與問候",
			tasks: "任務",
			calendar: "迷你行事曆",
			schedule: "行事曆",
			stats: "儲存庫統計",
			search: "查詢",
			searchbar: "搜尋列",
			heatmap: "活躍度熱度圖",
			calculator: "計算機",
			dataview: "Dataview 查詢",
			datacore: "Datacore 查詢",
			rss: "RSS 訂閱",
			jira: "Jira 篩選器",
			weather: "天氣",
			market: "行情",
			tension: "全球緊張局勢",
			git: "Git",
			operon: "Operon",
			leaf: "外掛檢視（測試版）",
			pet: "寵物",
			vaultpet: "Vault Pet",
		},
		linkTypes: {
			note: "筆記",
			url: "網址",
			command: "命令",
			folder: "資料夾",
		},
		embed: {
			section: "片段",
			sectionDesc: "只顯示筆記的一部分：某個標題（及其下全部內容）或單個區塊。留空則顯示整篇筆記。",
			sectionPlaceholder: "#標題 或 #^區塊 ID",
			sectionPick: "選擇標題或區塊",
			sectionPickerPlaceholder: "選擇此筆記的標題或區塊",
			sectionMissing: (section: string) => `此筆記中沒有「${section}」——請選擇其他標題或區塊。`,
			sectionHeading: "顯示片段標題",
			sectionHeadingDesc: "在卡片內顯示片段自身的標題。若卡片標題已說明所顯示的內容，可關閉。",
			sectionReadOnly: "片段以唯讀方式顯示——其中的核取方塊仍會寫回筆記。清空片段即可在卡片內編輯筆記。",
			file: "要嵌入的檔案",
			fileDesc: "Obsidian 儲存庫中的筆記、圖片、白板或 .base 檔案。",
			filePlaceholder: "要嵌入的檔案路徑",
			pickFile: "選擇檔案",
			baseView: "Base 檢視",
			baseViewDesc: "從此 .base 檔案中選擇一個檢視，或使用預設檢視。",
			baseViewDefault: "預設檢視",
			baseViewFileMissing: "找不到所選的 .base 檔案。",
			baseViewLoadError: "無法讀取該 .base 檔案的檢視。將使用預設檢視。",
			baseViewNoViews: "此 .base 檔案中未找到具名檢視。將使用預設檢視。",
			baseViewUnsupported: (count: number) =>
				`已隱藏 ${count} 個含不支援的 wikilink 字元的檢視。`,
			zoom: "縮放",
			zoomDesc: "縮放嵌入的內容。關閉此對話框後生效。",
			zoomImageDesc:
				"在圖片被適配到的框內縮放它——放大已裁切的圖片會進一步裁切。" +
				"關閉此對話框後生效。",
			imageFit: "圖片適配",
			imageFitDesc:
				"圖片如何填滿卡片。除第一種之外的每種模式都會把整張卡片交給圖片，鋪滿兩端。",
			imageFits: {
				natural: "原始尺寸",
				contain: "完整顯示圖片",
				cover: "填滿卡片（裁切）",
				stretch: "拉伸到卡片大小",
				width: "符合寬度（可捲動）",
			},
			imagePosition: "圖片位置",
			imagePositionDesc: "圖片在卡片中的位置。",
			imagePositionCropDesc: "裁切時保留圖片的哪一部分。",
			imagePositions: {
				"top-left": "左上",
				top: "上",
				"top-right": "右上",
				left: "左",
				center: "中",
				right: "右",
				"bottom-left": "左下",
				bottom: "下",
				"bottom-right": "右下",
			},
			editable: "可編輯",
			editableDesc: "直接編輯嵌入筆記的文字（僅 Markdown 筆記）。",
			livePreview: "即時預覽",
			livePreviewDesc:
				"使用 Obsidian 自己的即時預覽編輯器，而不是純原始 Markdown 輸入框，" +
				"這樣格式會隨輸入即時轉譯。關閉則顯示原始 Markdown 原始碼，按兩下編輯。",
			hideBaseHeader: "隱藏 base 標題列",
			hideBaseHeaderDesc:
				"對於嵌入的 .base 檔案，隱藏 Bases 檢視自己的工具列（檢視切換器與篩選／屬性控制項），只顯示結果。",
			openButton: "開啟按鈕",
			openButtonDesc: "顯示一個按鈕，在獨立分頁中開啟嵌入的檔案。預設關閉。",
		},
		slideshow: {
			source: "圖片來源",
			sourceDesc: "由您逐張挑選的清單，或某個資料夾中的所有圖片。",
			sourceList: "圖片清單",
			sourceFolder: "一個資料夾",
			picturesHeading: "圖片",
			picturesEmpty: "還沒有圖片——請在下方新增。",
			picturePlaceholder: "圖片路徑",
			captionPlaceholder: "說明文字（選填）",
			pickPicture: "選擇圖片",
			addPicture: "新增圖片",
			addFolderPictures: "新增某個資料夾的圖片",
			removePicture: "移除圖片",
			moveUp: "上移",
			moveDown: "下移",
			folder: "資料夾",
			folderDesc: "此資料夾中的所有圖片都會顯示。留空則使用 Obsidian 儲存庫根目錄。",
			folderPlaceholder: "Attachments/Photos",
			pickFolder: "選擇資料夾",
			includeSubfolders: "包含子資料夾",
			includeSubfoldersDesc: "同時顯示此資料夾子資料夾中的圖片。",
			folderCount: (count: number) => `此處目前找到 ${count} 張圖片。`,
			playbackHeading: "播放",
			order: "順序",
			orderDesc: "圖片的顯示順序。",
			orders: {
				manual: "清單順序",
				name: "名稱（A → Z）",
				nameDesc: "名稱（Z → A）",
				created: "建立日期（最舊優先）",
				createdDesc: "建立日期（最新優先）",
				modified: "修改日期（最舊優先）",
				modifiedDesc: "修改日期（最新優先）",
				random: "隨機",
			},
			advance: "切換圖片的方式",
			advanceDesc:
				"由什麼來推進卡片：計時器、行事曆，或僅由控制項操作。「每天一張」會根據當天日期" +
				"推算出要顯示的圖片，因此無論儀表板重繪多少次，它整天都保持不變——它與" +
				"「僅手動」都會記住上次停留的位置。",
			advances: {
				timer: "依計時器",
				daily: "每天一張",
				manual: "僅手動",
			},
			interval: "每張圖片秒數",
			intervalDesc:
				"每張圖片顯示的時長。0 表示固定顯示第一張並關閉輪播；低功耗模式也會暫停它。",
			intervalAria: "每張圖片顯示的秒數",
			days: "每張圖片天數",
			daysDesc: "每張圖片保留多少天後換成下一張。1 表示每天午夜更換；7 則是每週一張。",
			daysAria: "每張圖片顯示的天數",
			transition: "轉場",
			transitionDesc: "一張圖片如何切換到下一張。",
			transitions: {
				none: "直接切換（無動畫）",
				fade: "交叉淡入淡出",
				slide: "滑動",
				zoom: "縮放",
			},
			transitionSpeed: "轉場時長",
			transitionSpeedDesc: "轉場持續的毫秒數。",
			kenBurns: "緩慢推近",
			kenBurnsDesc: "在圖片顯示期間緩緩推近（「肯·伯恩斯」效果）。",
			displayHeading: "顯示",
			fit: "適配",
			fitDesc: "每張圖片如何填滿卡片。",
			fits: {
				cover: "填滿卡片（裁切）",
				contain: "完整顯示圖片",
			},
			controls: "控制項",
			controlsDesc: "游標停留時顯示上一張／暫停／下一張按鈕以及位置指示。預設開啟。",
			caption: "說明文字",
			captionDesc: "在圖片上顯示其說明文字，沒有則退回為檔名。",
			pauseOnHover: "游標停留時暫停",
			pauseOnHoverDesc: "游標位於卡片上方時保持目前圖片。",
			openButton: "開啟按鈕",
			openButtonDesc: "顯示一個按鈕，在獨立分頁中開啟目前圖片。預設關閉。",
		},
		daily: {
			editable: "可編輯",
			editableDesc: "直接編輯今天的筆記，而非唯讀。變更會儲存到 Obsidian 儲存庫。",
			openButton: "開啟按鈕",
			openButtonDesc: "顯示一個按鈕，在編輯器中開啟今天的筆記。",
			info: "日記",
			infoDesc:
				"今天的筆記依據核心外掛「日記」的日期格式和資料夾定位。卡片會隨您的編輯即時更新。",
		},
		periodic: {
			source: "來源",
			sourceDesc: "此卡片從哪個外掛取得筆記。",
			sources: {
				periodicNotes: "Periodic Notes",
				journals: "Journals",
			},
			journal: "日誌",
			journalDesc:
				"此卡片跟隨哪個日誌。它始終顯示該日誌目前週期的筆記，因此週期結束後卡片會自動切換。",
			chooseJournal: "選擇一個日誌",
			noJournals: "還沒有日誌",
			granularity: "週期",
			granularityDesc:
				"此卡片顯示哪一種週期筆記。始終是目前的那一篇，因此週期結束後卡片會自動切換。",
			granularities: {
				day: "每日",
				week: "每週",
				month: "每月",
				quarter: "每季",
				year: "每年",
			},
			editable: "可編輯",
			editableDesc: "直接編輯該筆記，而非唯讀。變更會儲存到 Obsidian 儲存庫。",
			openButton: "開啟按鈕",
			openButtonDesc: "顯示一個按鈕，在編輯器中開啟該筆記。",
			info: "Periodic Notes",
			infoDesc:
				"該筆記依據 Periodic Notes 外掛自身的資料夾、日期格式和範本定位，" +
				"缺少時也由 Periodic Notes 建立。卡片會隨您的編輯即時更新。",
			missingDesc:
				"此卡片需要社群外掛 Periodic Notes。請安裝並啟用它，然後在其中開啟您想要的筆記類型。",
			journalsInfo: "Journals",
			journalsInfoDesc:
				"該筆記依據日誌自身的資料夾、命名範本和筆記範本定位，缺少時也由 Journals " +
				"建立——包括它的建立提問。卡片會隨您的編輯即時更新。",
			journalsMissingDesc:
				"此卡片需要社群外掛 Journals。請安裝並啟用它，然後建立一個供其跟隨的日誌。",
		},
		web: {
			url: "網址",
			urlPlaceholder: "https://example.com",
			trusted: "信任的網站",
			trustedDesc:
				"允許頁面取得同源存取權限（cookie、儲存空間）。請只為您信任的網站開啟——" +
				"這會放寬 iframe 沙箱。",
			autoRefresh: "自動重新整理",
			autoRefreshDesc: "每 N 秒重新轉譯此卡片以取得變化。0 = 關閉。",
			refreshIntervalAria: "重新整理間隔（秒）",
		},
		recent: {
			display: "顯示方式",
			displayDesc: "緊湊的清單列，或圖示位於名稱上方的圖磚網格。",
			displayList: "清單",
			displayTiles: "圖磚",
			titleAdvanced: "進階",
			titleAdvancedDesc:
				"用 Frontmatter 屬性代替檔名來命名筆記——例如 aliases，或你的 Obsidian 儲存庫專門用作標題的 title。" +
				"沒有該屬性的筆記仍顯示檔名；關閉時顯示檔名。",
			titleProperty: "從屬性取得標題",
			titlePropertyDesc:
				"用該屬性的第一個非空值作為筆記名稱。屬性名稱不區分大小寫；沒有該屬性的筆記依檔名顯示。",
			titlePropertyPlaceholder: "aliases",
			fit: "符合卡片高度",
			fitDesc:
				"依卡片高度能容納的數量列出檔案，而不是固定數量。調整卡片大小會改變顯示數量。",
			count: "檔案數量",
			countDesc: (max: number) =>
				`列出多少個最近開啟的檔案——最多 ${max} 個，這也是 Hearth 最近檔案記錄的上限。`,
			types: "檔案類型",
			typesDesc: "只列出所選類型的檔案。可任意組合；不選則顯示所有類型。",
		},
		bookmarks: {
			heading: "資料夾書籤",
			folderTarget: "開啟資料夾書籤時",
			folderTargetDesc: "在 Hearth 的資料夾瀏覽頁中開啟，或在側邊欄的 Obsidian 檔案總管中顯示。",
		},
		folder: {
			folder: "資料夾",
			folderDesc: "此卡片列出的資料夾。留空表示 Obsidian 儲存庫的根目錄。",
			folderPlaceholder: "專案/2026",
			pickFolder: "選擇資料夾",
			sort: "排序",
			sortDesc: "內容的排列順序。使用 Hearth 自帶的排序時，資料夾排在前面並依名稱排列，與檔案總管一致。",
			sorts: {
				explorer: "與檔案總管一致",
				name: "名稱（A–Z）",
				nameDesc: "名稱（Z–A）",
				modified: "修改時間（最新優先）",
				modifiedAsc: "修改時間（最舊優先）",
				created: "建立時間（最新優先）",
				createdAsc: "建立時間（最舊優先）",
			},
			show: "顯示",
			showDesc: "卡片列出該資料夾中的哪些內容。",
			showAll: "資料夾和檔案",
			showFolders: "僅資料夾",
			showFiles: "僅檔案",
			display: "顯示方式",
			displayDesc: "清單列，或圖示圖磚網格。",
			displayList: "清單",
			displayTiles: "圖磚",
			count: "項目數量",
			countDesc: "卡片在提示還剩多少項之前列出的數量。它開啟的瀏覽頁不受此限制。",
			counts: "項目計數",
			countsDesc: "顯示每個子資料夾包含多少項目。",
			navigate: "開啟子資料夾時",
			navigateDesc: "在對話框中開啟，或在卡片內開啟——卡片會顯示一列路徑和返回上層的按鈕，並保持在您離開時的位置；也可以顯示在側邊欄的 Obsidian 檔案總管中。",
			navigateModal: "在資料夾瀏覽頁中",
			navigateCard: "在卡片內",
			navigateExplorer: "在檔案總管中",
			browse: "從卡片開啟瀏覽頁",
			browseDesc: "點擊卡片的空白處（或其資料夾按鈕）會開啟帶有導覽路徑的瀏覽頁，其中每個資料夾都可以繼續進入。",
			browseIn: "開啟瀏覽頁",
			browseInDesc: "在儀表板上方的對話框中開啟（帶有一個移到分頁的按鈕），或直接在單獨的分頁中開啟，讓資料夾佔據整個頁面。",
			browseInModal: "在對話框中",
			browseInTab: "在新分頁中",
			browserView: "瀏覽頁版面配置",
			browserViewDesc: "瀏覽頁如何顯示資料夾，與卡片分開設定：列清單，或帶有每篇筆記預覽的較大圖磚。",
			preview: "筆記預覽",
			previewDesc: "在圖磚上顯示每篇筆記內文的前幾行，不含其屬性。",
			previewSize: "預覽文字大小",
			previewSizeDesc: "單位為像素。預設較小——足以認出一篇筆記。",
			images: "圖片預覽",
			imagesDesc: "圖片會顯示在自己的圖磚上，筆記會以其第一張嵌入圖片作為封面。僅在「完整」效能等級下顯示：一張圖片就是解碼後的整個檔案，而較輕的等級正是為了避免這種負擔。",
		},
		calendar: {
			view: "版面配置",
			viewDesc: "「月」顯示網格；「行程」列出接下來的日子。",
			viewMonth: "月檢視網格",
			viewAgenda: "行程",
			agendaDays: "未來天數",
			agendaDaysDesc: "行程從今天起列出多少天。",
			weekNumbers: "週數",
			weekNumbersDesc: "在左側顯示一欄 ISO 週數。",
			heatmap: "熱度圖",
			heatmapDesc: "依當天的筆記活躍度為每一天著色。",
			heatmapCounts: "熱度圖計數",
			externalCalendars: "外部行事曆",
			externalCalendarsDesc:
				"訂閱 ICS/iCal 來源（Google、iCloud、Fastmail、Nextcloud…）。活動會以彩色圓點顯示在網格上，並列入行程檢視。",
			operonTasks: "顯示 Operon 任務",
			operonTasksDesc:
				"標記有 Operon 任務到期的日期，並在行程中列出這些任務。" +
				"透過 Operon 的開發者 API 讀取，因此需要在 設定 → Hearth → 整合 中" +
				"核准 Operon。僅有預定時間（無到期日）的任務不包含在內。",
			operonTaskColor: "Operon 任務顏色",
			operonTaskColorDesc: "任務標記的顏色。預設使用強調色。",
			sourceNamePlaceholder: "名稱",
			sourceUrlPlaceholder: "ICS/iCal 網址（https:// 或 webcal://）",
			sourceShow: "顯示此行事曆",
			sourceHide: "隱藏此行事曆",
			sourceRemove: "移除行事曆",
			addCalendar: "新增行事曆",
			refresh: "重新整理間隔",
			refreshDesc: "多久重新取得一次行事曆（分鐘）。0 表示僅在開啟時取得。",
			eventNoteHeading: "活動筆記",
			eventNoteDesc:
				"活動彈出視窗中「建立筆記」所產生的筆記。它的用法與 Obsidian Web Clipper 的範本相同：名稱、資料夾、帶類型的屬性和內文，每一項都可以使用 {{變數}} 和篩選器。",
			eventNoteEnabled: "顯示「建立筆記」",
			eventNoteEnabledDesc: "在活動詳細資料彈出視窗中提供建立筆記按鈕。",
			chipsHeading: "項目詳細資料",
			chipsDesc:
				"選擇每個行程項目在標題旁顯示什麼。不需要的請關閉——在窄卡片上這些標記會與標題本身爭奪空間。",
			chipTime: "時間",
			chipTimeDesc: "開始時間，或「全天」。",
			chipSource: "行事曆名稱",
			chipSourceDesc: "項目來自哪個行事曆。僅在有多個來源時顯示。",
			chipStatus: "狀態",
			chipStatusDesc: "任務的 TaskNotes 狀態，例如「進行中」。預設關閉。",
			chipPriority: "優先順序",
			chipPriorityDesc: "任務的 TaskNotes 優先順序，例如「高」。",
			chipDue: "到期標記",
			chipDueDesc: "到期日項目上的「到期」標記。",
			chipRecurring: "重複標記",
			chipRecurringDesc: "重複任務上的「重複」標記。",
			chipTimeblock: "時間區塊標記",
			chipTimeblockDesc: "時間區塊上的「時間區塊」標記。",
			checkboxHeading: "核取方塊任務",
			checkboxDesc:
				"依 Tasks 格式寫在任務上的日期（📅 截止、⏳ 預定）在行事曆上顯示 Markdown 核取方塊任務（- [ ] …）。沒有日期的任務不會顯示。",
			checkboxEnabled: "使用核取方塊任務",
			checkboxEnabledDesc: "從筆記中讀取帶日期的核取方塊任務。",
			checkboxScheduled: "預定日期",
			checkboxScheduledDesc: "在任務的 ⏳ 預定日期顯示它。",
			checkboxDue: "截止日期",
			checkboxDueDesc: "在任務的 📅 截止日期顯示它。",
			checkboxCompletedDesc: "已勾選的任務以刪除線保留在行事曆上。",
			checkboxCompleteDesc: "在每個任務上顯示一個核取方塊，可在其筆記中勾選完成。",
			checkboxFolders: "資料夾",
			checkboxFoldersDesc: "只讀取這些資料夾中的筆記（以逗號分隔）。留空則讀取整個 Obsidian 儲存庫。",
			checkboxColor: "顏色",
			checkboxColorDesc: "核取方塊任務項目的顏色。",
			taskNotesHeading: "TaskNotes",
			taskNotesDesc:
				"把 TaskNotes 作為活動來源。此卡片會鏡像 TaskNotes 自己的行事曆所顯示的內容——預定任務、到期日、重複發生、時間區塊以及在 TaskNotes 內訂閱的行事曆——並使用 TaskNotes 自己的欄位名稱、狀態和顏色。",
			taskNotesMissing:
				"此 Obsidian 儲存庫中未啟用 TaskNotes。請安裝並啟用它，才能將其作為行事曆來源。",
			taskNotesEnabled: "使用 TaskNotes",
			taskNotesEnabledDesc: "在此行事曆上繪製 TaskNotes 項目。",
			taskNotesScheduled: "預定任務",
			taskNotesScheduledDesc: "任務顯示在其預定日期上，長度依其時間估算決定。",
			taskNotesDue: "到期日",
			taskNotesDueDesc: "任務顯示在其到期日上。",
			taskNotesRecurring: "重複任務",
			taskNotesRecurringDesc:
				"把重複任務展開為每次發生一個項目。關閉則只顯示它的下一個日期。",
			taskNotesTimeblocks: "時間區塊",
			taskNotesTimeblocksDesc: "寫在您日記中的時間區塊。",
			taskNotesFollows: (on: boolean) =>
				`TaskNotes 目前將此項設為${on ? "開啟" : "關閉"}。`,
			taskNotesFollowReset: "跟隨 TaskNotes",
			taskNotesCompleted: "顯示已完成",
			taskNotesCompletedDesc: "把已完成的任務保留在行事曆上，加刪除線顯示。",
			taskNotesArchived: "顯示已封存",
			taskNotesArchivedDesc: "包含帶有 TaskNotes 封存標籤的任務。",
			taskNotesComplete: "從行事曆上完成任務",
			taskNotesCompleteDesc:
				"在每個任務上提供完成核取方塊，寫回的內容與 TaskNotes 完全一致（重複任務依每次發生處理）。",
			taskNotesSubscriptions: "TaskNotes 行事曆",
			taskNotesSubscriptionsDesc: (count: number) =>
				`同時顯示在 TaskNotes 內訂閱的 ${count} 個行事曆。`,
			taskNotesSubscriptionsNone: "TaskNotes 沒有可顯示的行事曆訂閱。",
			taskNotesSubLoaded: (count: number) => `已載入 ${count} 個活動。`,
			taskNotesSubPending: "尚未載入——請在下方重新整理。",
			taskNotesSubDisabled: "已在 TaskNotes 中停用。",
			taskNotesSubBlocked: "未取得：Hearth 的設定中已停用對外連線。",
			taskNotesSubFailed: (reason: string) => `無法載入：${reason}`,
			taskNotesSubNotCalendar: "回傳的內容不是 iCalendar 來源。",
			taskNotesSubMissingFile: "該檔案不在 Obsidian 儲存庫中。",
			taskNotesSubRefresh: "重新整理行事曆",
			taskNotesColorBy: "著色依據",
			taskNotesColorByDesc: "每個任務的顏色來自哪裡。",
			taskNotesColorStatus: "TaskNotes 狀態",
			taskNotesColorPriority: "TaskNotes 優先順序",
			taskNotesColorFixed: "單一固定顏色",
			taskNotesColor: "任務顏色",
			taskNotesColorDesc: "用於固定顏色，以及 TaskNotes 未定義顏色時。",
			taskNotesDueColor: "到期顏色",
			taskNotesDueColorDesc: "為到期日項目單獨指定的選用顏色。",
			taskNotesTimeblockColor: "時間區塊顏色",
			taskNotesTimeblockColorDesc: "用於本身沒有顏色的時間區塊。",
		},
		schedule: {
			view: "開啟時顯示",
			viewDesc:
				"儀表板開啟時卡片顯示的檢視。您隨時可以在卡片上切換檢視。",
			views: "提供的檢視",
			viewsDesc:
				"卡片切換器列出哪些檢視。四個全開可讓每個檢視都只需一次點擊；只留一個檢視則會完全隱藏切換器。",
			toolbar: "工具列",
			toolbarDesc:
				"顯示導覽列：後退、今天、前進、目前顯示的時間段以及檢視切換器。關閉則把卡片固定在目前時間段。",
			dailyNotes: "日記",
			dailyNotesDesc:
				"標記已有日記的日期，並在點擊某一天時開啟它（或提示建立）。關閉後這就是一個純活動行事曆。",
			weekHeading: "一週",
			firstDay: "一週開始於",
			firstDayDesc: "月檢視和週檢視網格從哪一天開始。",
			firstDayLocale: (day: string) => `跟隨 Obsidian 的語言（${day}）`,
			hideWeekends: "隱藏週末",
			hideWeekendsDesc: "在月檢視和週檢視網格中不顯示週六和週日。",
			weekNumbers: "週數",
			weekNumbersDesc: "在左側顯示一欄週數。",
			clock: "時制",
			clockDesc: "活動時間的書寫方式。",
			clockLocale: "跟隨 Obsidian 的語言",
			clock12: "12 小時制（9:00 AM）",
			clock24: "24 小時制（09:00）",
			monthHeading: "月檢視",
			monthStyle: "活動顯示為",
			monthStyleDesc:
				"帶名稱的標籤在空間充裕的卡片上一目了然；圓點適合小卡片，就像迷你行事曆的畫法。",
			monthStyleChips: "帶名稱的標籤",
			monthStyleDots: "圓點",
			maxPerDay: "每天活動數",
			maxPerDayDesc:
				"一個日期格最多列出多少活動，其餘摺疊為「+N 更多」連結。0 表示全部列出並允許該格捲動。",
			gridHeading: "週檢視與日檢視",
			gridDesc:
				"時間網格預設繪製一整天，並在開啟時捲動到第一個活動——因此不會有活動落在可見時段之外。如果您只想看一天中的一部分，可以縮小時段範圍。",
			hours: "繪製的時段",
			hoursDesc:
				"網格的起始與結束小時。範圍之外的內容會移到上方的全天區域，而不會消失。",
			hoursMidnight: "午夜",
			hourHeight: "每小時高度",
			hourHeightDesc:
				"一小時的高度（像素）。越高細節越多；越矮則能容納一天中更多時間。",
			nowLine: "目前時間線",
			nowLineDesc: "在今天的欄上依目前時間畫一條線。",
			listHeading: "清單檢視",
			listDays: "列出天數",
			listDaysDesc: "清單從所顯示的那一天起向後延伸多少天。",
		},
		heatmap: {
			metric: "指標",
			weeks: "週數",
			weeksDesc: "顯示多少週的歷史。",
			advanced: "進階",
			advancedDesc:
				"自訂指標：用屬性中的日期決定格子、把屬性裡的數字加總起來代替計數，" +
				"並挑選哪些筆記參與統計。關閉時依檔案日期統計全部筆記。",
			metricHeading: "統計什麼",
			rangeHeading: "範圍",
			source: "日期來源",
			sourceDesc: "由哪個日期決定筆記落在哪一格。",
			sourceOptions: {
				modified: "修改日期",
				created: "建立日期",
				property: "屬性中的日期",
			},
			dateProperty: "日期屬性",
			datePropertyDesc:
				"存放日期的屬性名稱，例如 date、due、published。可以是日期、日期時間或 " +
				"[[日記]] 連結；清單中的每一項各算一次。沒有該屬性的筆記會被略過。",
			datePropertyPlaceholder: "date",
			value: "每篇筆記計入",
			valueDesc: "每篇算 1，或加總某個屬性中的數字——閱讀分鐘數、寫作頁數、跑步公里數。",
			valueOptions: {
				count: "1（統計筆記數）",
				sum: "屬性中的數字",
			},
			valueProperty: "數值屬性",
			valuePropertyDesc: "存放待加總數字的屬性名稱。數值不是數字的筆記會被略過，而不是按 1 計入。",
			valuePropertyPlaceholder: "minutes",
			unit: "單位",
			unitDesc: "描述某一天時使用的單位名稱——「5 次運動」。留空則跟隨指標。",
			unitPlaceholder: "篇已編輯",
			rules: "哪些筆記參與統計",
			rulesDesc: "筆記需要滿足的條件。沒有規則時，所有筆記都參與統計。",
			match: "比對方式",
			matchOptions: {
				all: "滿足全部規則（AND）",
				any: "滿足任一規則（OR）",
			},
			fieldOptions: {
				property: "屬性",
				tag: "標籤",
				folder: "資料夾",
				path: "路徑",
			},
			opOptions: {
				is: "等於",
				isNot: "不等於",
				contains: "包含",
				notContains: "不包含",
				gt: "大於",
				lt: "小於",
				exists: "已設定",
				missing: "未設定",
			},
			keyPlaceholder: "屬性名稱",
			valuePlaceholder: "值",
			addRule: "新增規則",
			removeRule: "刪除規則",
			gridHeading: "網格",
			gridColor: "顏色",
			gridColorDesc: "用自選顏色代替主題強調色為方塊上色——當兩者過於接近難以區分，或幾張網格追蹤不同內容時很有用。",
			gridColorReset: "跟隨主題強調色",
		},
		stats: {
			advanced: "進階",
			advancedDesc:
				"選擇顯示哪些統計項目、依檔案類型拆分附件，並新增自訂計數。關閉則顯示預設組合。",
			builtins: "顯示的統計項目",
			builtinsDesc: "選擇顯示哪些內建統計項目。連續天數僅在已設定日記時顯示。",
			attachmentTypes: "附件細分",
			attachmentTypesDesc: "為每種選定的檔案類型（圖片、PDF…）新增單獨的計數圖磚。",
			customCounts: "自訂計數",
			customCountsDesc:
				"每一列統計符合某個查詢的檔案數，並以圖磚顯示總數。" +
				"查詢語法與搜尋列一致：#標籤、key:value 表示屬性，或純文字。",
			labelPlaceholder: "標籤",
			iconPlaceholder: "圖示",
			queryPlaceholder: "#project 或 status:active",
			addCount: "新增計數",
			removeCount: "移除計數",
		},
		metricOptions: {
			modified: "編輯的筆記",
			created: "建立的筆記",
		},
		savedSearch: {
			query: "查詢",
			queryDesc:
				"與搜尋列語法相同：純文字比對名稱／內文，#標籤 比對標籤，" +
				"key:value 比對 frontmatter 屬性。",
			queryPlaceholder: "#project 或 status:active 或 會議記錄",
			display: "顯示方式",
			displayDesc: "以緊湊清單或圖磚顯示符合的結果。",
			displayList: "清單",
			displayTiles: "圖磚",
			maxResults: "最大結果數",
			maxResultsDesc: "一次最多顯示多少筆符合項目。",
		},
		searchBar: {
			placeholder: "預留位置文字",
			placeholderDesc:
				"輸入框為空時顯示的文字。留空則使用 設定 → 搜尋 中的設定。",
			filters: "篩選列",
			filtersDesc:
				"在輸入框下方顯示檔案類型標籤，與頂端搜尋列提供的相同。它們需要較高的卡片來容納。",
			filterTypes: "篩選標籤",
			filterTypesDesc:
				"此卡片提供哪些標籤。只有 Obsidian 儲存庫中確實存在該類檔案時，對應標籤才會出現。",
			strictFilters: "僅這些類型",
			strictFiltersDesc:
				"僅搜尋此搜尋列顯示篩選標籤的檔案類型——每個標籤都視為已選取，關閉其中一個會進一步縮小搜尋範圍。",
			strictFiltersAbove: "此儀表板或整個 Obsidian 儲存庫已在「設定 → 搜尋」中開啟，此處無法關閉。",
			filterTypeGlobalOff: "已在 設定 → 搜尋 → 篩選標籤 中對所有搜尋列隱藏。",
			instantAnswers: "即時答案",
			instantAnswersDesc: "為此搜尋列關閉部分答案。在儀表板或整個 Obsidian 儲存庫中關閉的答案在這裡也保持關閉。",
			instantAnswerOff: "已在此儀表板或整個 Obsidian 儲存庫中關閉。",
			instantAnswersVaultOff: "即時答案已在 設定 → 搜尋 中對整個 Obsidian 儲存庫關閉。",
			button: "按鈕",
			buttonDesc:
				"輸入框旁的操作按鈕：新增筆記，或用框中輸入的內容搜尋網路。",
			buttonNone: "無",
			buttonNewNote: "新增筆記",
			buttonSearchOnline: "線上搜尋",
			seamless: "無邊框",
			seamlessDesc:
				"去掉卡片外框——無邊框、無背景、無標題列——讓它在儀表板上看起來就是一個獨立的搜尋列。",
			sizeNote:
				"輸入框的粗細與卡片高度一致——在「排列」模式下拖曳卡片邊緣即可讓搜尋列更粗或更細。",
		},
		tiles: {
			heading: "按鈕",
			sizing: "按鈕尺寸方式",
			sizingDesc:
				"按鈕是鋪滿整張卡片——隨卡片一起縮放，無論卡片多大每個按鈕都完整可見——" +
				"還是保持固定的像素尺寸，於是放不下時卡片就會捲動。鋪滿模式下按鈕在橫豎兩個方向上都不會小到不便使用，" +
				"到了這個下限就不再繼續變小；此時卡片若仍裝不下也會出現捲軸。在此設定出現之前建立的卡片會繼續使用固定方式，" +
				"直到你手動切換；兩種方式各自保留自己的尺寸，因此切換回去後原來的樣子會完好如初。",
			sizingScale: "鋪滿卡片",
			sizingFixed: "固定尺寸（舊版）",
			across: "每列按鈕數",
			acrossDesc:
				"卡片橫向能放幾個按鈕，也就決定了單個按鈕有多寬：它始終是卡片寬度的一個固定比例，直到觸及按鈕的最小尺寸。" +
				"高度同理——各列平分卡片的高度——所以卡片變矮只會讓按鈕變矮，而不會把按鈕藏起來。" +
				"在排列模式下拖曳右下角，仍可把一個按鈕做成兩三格寬（或高），也可以只佔半格——橫豎兩個方向都能依半格調整，且始終對齊網格。",
			minSize: "按鈕最小尺寸",
			minSizeDesc:
				"一個整格按鈕最小可以縮到多少像素；再小下去卡片就會改為捲動，而不再繼續壓縮按鈕（半格按鈕則停在這個值的一半）。" +
				"預設值較低，以便盡量讓按鈕都放得下、不出現捲軸；如果某張卡片你經常縮得很小，" +
				"可以把它調高以確保按鈕好按，此時放不下時卡片就會捲動。",
		},
		links: {
			heading: "連結",
			autoShift: "圖磚自動避讓（測試版）",
			autoShiftDesc:
				"開啟後，拖曳一個圖磚時其他圖磚會互相推開（類似手機小工具）。" +
				"預設關閉——圖磚完全自由擺放，可能相互重疊。",
			labelPlaceholder: "標籤",
			iconPlaceholder: "圖示",
			pickCommand: "選擇命令…",
			targetUrl: "目標（網址）",
			targetNote: "目標（筆記路徑）",
			targetFolder: "目標（資料夾路徑）",
			folderTarget: "開啟資料夾按鈕時",
			folderTargetDesc: "在 Hearth 的資料夾瀏覽頁中開啟，或在側邊欄的 Obsidian 檔案總管中顯示。",
			moveUp: "上移",
			moveDown: "下移",
			removeLink: "移除連結",
			addLink: "新增連結",
			addCommand: "新增命令",
			buttonSize: "按鈕大小",
			buttonSizeDesc:
				"圖磚的預設大小。在排列模式下拖曳某個圖磚的右下角可個別調整大小。",
		},
		templater: {
			missing: "Templater 未啟用",
			missingDesc:
				"此卡片透過呼叫 Templater 外掛來建立筆記——安裝並啟用它，這些圖磚即可運作。" +
				"在此之前，這裡的其他設定無需變更。",
			autoShift: "圖磚自動避讓（測試版）",
			autoShiftDesc:
				"開啟後，拖曳一個圖磚時其他圖磚會互相推開（類似手機小工具）。" +
				"預設關閉——圖磚完全自由擺放，可能相互重疊。",
			buttonSize: "按鈕大小",
			buttonSizeDesc:
				"圖磚的預設大小。拖曳某個圖磚的右下角可個別調整其大小。",
			heading: "範本",
			labelPlaceholder: "標籤",
			pickTemplate: "選擇一個範本…",
			pickTemplateTooltip: "選擇此圖磚要執行的 Templater 範本",
			pickFolderTooltip:
				"選擇新筆記所在的資料夾。Obsidian 儲存庫根目錄表示「Obsidian 放置新筆記的位置」。",
			filenamePlaceholder: "檔名",
			filenameTooltip:
				"新筆記的名稱，不含副檔名。{{date}}、{{date:FMT}}、{{time}}、" +
				"{{time:FMT}} 和 {{prompt}} 會被取代。留空則由 Templater 命名。",
			openOn: "會開啟新筆記——點擊改為靜默歸檔",
			openOff: "靜默歸檔新筆記——點擊改為開啟它",
			removeTile: "移除圖磚",
			addTile: "新增一個範本",
			tokensHelp:
				"檔名中可以使用 {{date}}、{{date:YYYY-MM}}、{{time}}、{{time:HH-mm}} " +
				"和 {{prompt}}，{{prompt}} 會在建立筆記前詢問名稱的其餘部分。" +
				"範本內部的一切 — <% tp.* %>、您的使用者指令碼、tp.system.prompt() — " +
				"都屬於 Templater 自己，其執行方式與從 Templater 的命令呼叫時完全一致。",
			tokensHelpScoped: (folder: string) =>
				`選擇器列出的是「${folder}」中的範本，也就是 Templater 自己的範本資料夾。` +
				"檔名中可以使用 {{date}}、{{date:YYYY-MM}}、{{time}}、{{time:HH-mm}} " +
				"和 {{prompt}}，{{prompt}} 會在建立筆記前詢問名稱的其餘部分。" +
				"範本內部的一切 — <% tp.* %>、您的使用者指令碼、tp.system.prompt() — " +
				"都屬於 Templater 自己，其執行方式與從 Templater 的命令呼叫時完全一致。",
		},
		tasks: {
			source: "來源",
			sourceDesc:
				"Markdown 核取方塊在任何地方都可用。TaskNotes 透過 frontmatter 讀取該外掛的" +
				"任務筆記（欄位名稱可在 設定 → Hearth 中設定，因為 TaskNotes 沒有供其他外掛" +
				"查詢的 API）。Kanban 讀取單個 Kanban 外掛的看板筆記，每個標題作為一欄。",
			sourceCheckbox: "Markdown 核取方塊",
			sourceTaskNotes: "TaskNotes 外掛",
			sourceKanban: "Kanban 外掛",
			kanbanBoard: "看板筆記",
			kanbanBoardDesc:
				"要讀取的 Kanban 外掛看板。留空則自動偵測範圍內第一篇帶有「kanban-plugin」" +
				"frontmatter 鍵的筆記。",
			kanbanBoardPlaceholder: "自動偵測",
			pickBoard: "選擇一個 Kanban 看板",
			kanbanExtended: "日期與優先順序",
			kanbanExtendedDesc:
				"讀取每張卡片上寫的日期、優先順序和重複標記（相容 obsidian-tasks 外掛），" +
				"使它們顯示為指示標記、參與清單排序，並可從卡片上編輯。" +
				"關閉則把卡片當作純文字讀取。",
			checkboxExtended: "日期與優先順序",
			checkboxExtendedDesc:
				"讀取每個核取方塊行內寫的日期、優先順序和重複標記（相容 obsidian-tasks 外掛），" +
				"使它們顯示為指示標記、參與清單排序，並可從項目的右鍵選單編輯。" +
				"關閉則把核取方塊當作純文字讀取。",
			checkboxStatuses: "任務狀態（看板欄）",
			checkboxStatusesDesc:
				"在看板上作為欄顯示的核取方塊狀態，每行一個，格式為「[符號] 標籤」——" +
				"符號即「- [ ]」中間的那個字元。加上「(done)」表示該狀態為已完成。" +
				"把卡片拖曳到某一欄會寫入該欄的符號。留空則使用預設組合（待辦、進行中、已完成）。",
			quickView: "點擊時快速檢視",
			quickViewDesc:
				"點擊任務會開啟一個緊湊彈出視窗——其中繼資料和描述可直接編輯，並帶有開啟完整筆記" +
				"或刪除任務的按鈕——而不是直接開啟筆記。關閉則點擊即開啟筆記。",
			convertTemplate: "筆記範本",
			convertTemplateDesc:
				"筆記以此範本開始。若已安裝 Templater，Templater 範本會交由 Templater 處理；" +
				"否則會取代 {{title}}、{{date}} 和 {{time}}。留空則建立空白筆記。",
			convertTemplatePlaceholder: "例如 Templates/Task.md",
			pickTemplate: "選擇一篇範本筆記",
			convertScrape: "把中繼資料擷取到 frontmatter",
			convertScrapeDesc:
				"把卡片轉換為筆記時，將其日期、優先順序和重複標記移入新筆記的 YAML " +
				"frontmatter，而不是把表情符號標記留在看板連結上。",
			newTaskAsNote: "新任務作為筆記",
			newTaskAsNoteDesc:
				"直接把每張新卡片建立為獨立筆記（看板上留一個連結），而不是行內核取方塊——" +
				"並套用「由任務建立筆記」中的資料夾、範本與 frontmatter 選項，就像「轉換為筆記」一樣。",
			layout: "版面配置",
			layoutDesc:
				"清單，或依狀態分組的看板。在看板上可以在欄之間拖曳卡片、拖曳欄標題重新排列、" +
				"用某欄的眼睛圖示隱藏它，用勾選圖示讓它自動完成卡片。" +
				"右鍵點擊卡片可將其轉換為獨立筆記。在艾森豪矩陣中，在象限之間拖曳任務即可變更其優先順序。",
			layoutList: "清單",
			layoutKanban: "看板",
			layoutMatrix: "艾森豪矩陣",
			matrixLayout: "十字版面配置",
			matrixUrgency: "緊急程度方向",
			matrixUrgencyDesc: "用哪條軸區分緊急與不緊急；重要程度使用另一條軸。",
			matrixUrgencyColumns: "橫向（欄）",
			matrixUrgencyRows: "縱向（列）",
			matrixUrgentSide: "緊急所在側",
			matrixImportantSide: "重要所在側",
			matrixSideLeft: "左",
			matrixSideRight: "右",
			matrixSideTop: "上",
			matrixSideBottom: "下",
			matrixNames: "軸名稱",
			matrixNamesDesc: "卡片上軸兩端和未分類欄的名稱。留空則使用內建名稱。",
			matrixAxisName: {
				urgent: "緊急",
				notUrgent: "不緊急",
				important: "重要",
				notImportant: "不重要",
				unsorted: "未分類欄",
			},
			matrixQuadrants: "象限",
			matrixQuadrantsDesc: "每個象限的名稱，以及會把任務放入其中的優先順序。也可以在卡片上按兩下名稱來修改。",
			matrixName: "名稱",
			matrixHeading: "艾森豪矩陣",
			matrixDesc:
				"任務依優先順序落入對應象限。為每個象限選擇所含的優先順序；把任務拖曳到某個象限" +
				"（或在右鍵選單中選擇「移動到…」）會為它設定該象限的第一個（最高）優先順序。",
			matrixQuadrant: {
				do: "立即做——緊急且重要",
				schedule: "排程——重要但不緊急",
				delegate: "委派——緊急但不重要",
				eliminate: "刪除——既不緊急也不重要",
			},
			matrixQuadrantWrites: (priority: string) => `拖曳到這裡的任務會設為：${priority}。`,
			matrixQuadrantEmpty: "未選擇優先順序——此象限保持為空，不接受拖放。",
			matrixChipElsewhere: (quadrant: string) => `目前在「${quadrant}」——點擊移到這裡`,
			matrixShowUnsorted: "顯示未分類任務",
			matrixShowUnsortedDesc: "矩陣下方的一欄，列出沒有象限包含的任務。把任務拖曳到這裡會清除其優先順序。",
			matrixReset: "將矩陣恢復為預設設定",
			noteFromTask: "由任務建立筆記",
			noteFromTaskDesc:
				"任務的「建立筆記」按鈕和右鍵「轉換為筆記」會產生：以任務命名、位於此資料夾、" +
				"基於此範本的筆記。任務會變成指向它的連結。",
			convertFolder: "資料夾",
			convertFolderDesc: "筆記建立的位置；不存在的資料夾會被建立。留空則使用 Obsidian 新筆記的預設位置。",
			convertFolderPlaceholder: "例如 專案/任務",
			pickFolder: "選擇資料夾",
			display: "顯示",
			kanbanColumns: "看板欄",
			kanbanHidden: (columns: string) => `已隱藏：${columns}`,
			kanbanDoneColumns: (columns: string) => `自動完成：${columns}`,
			kanbanCustomOrder: "已設定自訂欄順序。",
			showAll: "全部顯示",
			resetColumns: "重設欄順序、可見性與完成欄",
			doneStatuses: "視為已完成的狀態",
			doneStatusesDesc:
				"TaskNotes 來源：哪些狀態值被視為已完成（除非開啟「顯示已完成」，否則隱藏；" +
				"顯示時加刪除線），每行一個。留空則僅使用 設定 → Hearth 中的完成值。" +
				"例如加上「canceled」可把已取消的任務也算作已完成。",
			doneStatusesPlaceholder: "done\ncanceled",
			fields: "欄位",
			fieldsFollowGlobal:
				"目前跟隨 設定 → Hearth → 整合 中的欄位。開啟後可為此卡片個別設定。",
			fieldsCustomize: "自訂…",
			fieldsTitle: "任務欄位",
			fieldsHint:
				"任務顯示的一切，依順序排列。欄位由您定義：命名它、選擇呈現方式，" +
				"並指定它讀取的鍵。",
			fieldsEmpty: "還沒有欄位——任務只顯示其文字。",
			fieldsNone: "無——任務只顯示其文字。",
			fieldsApplyClose: "套用並關閉",
			fieldsApplyDesc: "套用但不關閉，以便繼續調整。",
			fieldsReset: "移除所有欄位",
			fieldUnnamed: "未命名欄位",
			fieldDefaultName: (n: number) => `欄位 ${n}`,
			fieldAdd: "新增欄位",
			fieldEdit: "編輯欄位",
			fieldRemove: "移除欄位",
			fieldMoveUp: "上移",
			fieldMoveDown: "下移",
			fieldExpand: "展開",
			fieldCollapse: "摺疊",
			fieldName: "名稱",
			fieldNameDesc: "此欄位的名稱。僅在您於下方要求時才顯示在任務上。",
			fieldNamePlaceholder: "例如 優先順序",
			fieldShowName: "在任務上顯示名稱",
			fieldShowNameDesc: "在每個值前加上欄位名稱（「優先順序：緊急」）。",
			fieldDisplay: "呈現方式",
			fieldDisplayDesc:
				"此欄位的值如何繪製。最後兩種不在任務上顯示任何內容，而是為整列或整張卡片" +
				"著色，且只能有一個欄位使用它們。「帶標籤的彩色圓點」是優先順序本身的形式，" +
				"提供給讀取優先順序的欄位。描述始終自成一組子項。",
			fieldAmbientTaken: (name: string) =>
				`染色與光暈已被「${name}」佔用。一個任務只有一個背景和一個外圈，` +
				`因此只能有一個欄位使用它們。`,
			fieldAmbientIgnored: (name: string) =>
				`此欄位不會著色：「${name}」已經在為任務染色或加外圈，而這只能有一個欄位使用。` +
				`請為其中之一改用其他呈現方式。`,
			fieldStyles: {
				pill: "標籤",
				dot: "彩色圓點",
				dotlabel: "帶標籤的彩色圓點",
				text: "純文字",
				hue: "為整個任務染色",
				glow: "任務周圍光暈",
			},
			fieldOpacity: "強度",
			fieldOpacityDesc:
				"顏色施加的強度。只使用值本身的顏色——未設定顏色的值不會影響任務。",
			fieldKeys: "鍵",
			fieldKeysDesc:
				"此欄位從哪裡讀取。每個有值的鍵都會顯示一項，因此一個欄位可以把若干筆" +
				"中繼資料歸到同一個名稱下。",
			fieldKeysEmpty: "還沒有鍵——此欄位不會顯示任何內容。",
			fieldNoKeys: "無鍵",
			fieldAddKey: "新增一個鍵",
			fieldAddKeyDesc:
				"Hearth 自己的值可以取得核取方塊行的優先順序、看板欄以及解析出的日期；" +
				"屬性則讀取 frontmatter 中的任何內容。",
			fieldAddBuiltin: "Hearth 讀取的內容",
			fieldAddProperty: "Frontmatter 屬性",
			fieldAddKeyTyped: "輸入屬性名稱…",
			fieldAddKeyPlaceholder: "屬性名稱",
			fieldRemoveKey: "移除鍵",
			fieldPickProperty: "在您的筆記中找到的屬性",
			fieldPickBuiltin: "Hearth 自行解析的值",
			fieldKeyAlreadyAdded: (key: string) => `「${key}」已經是此欄位的一個鍵。`,
			fieldMapValues: "值與顏色",
			fieldMappedValues: (n: number) => `已對應 ${n} 個值`,
			fieldNoMappings: "值依原樣顯示",
			fieldMapHint:
				"為每個值指定更好看的標籤和顏色。未對應的值仍會依原樣顯示。",
			fieldMapEmpty: "尚未對應任何值。",
			fieldDateKey: "作為日期顯示",
			fieldIsDate: "視為日期",
			fieldIsDateDesc:
				"將此屬性顯示為相對日期（「明天」），依其是過去、今天還是未來著色，" +
				"並用行事曆進行編輯。",
			fieldDateHint:
				"日期沒有固定的值可對應，因此依它落在何時著色。標籤是選填的——" +
				"留空則保留日期本身。",
			fieldDateLabelPlaceholder: "顯示為（選填）",
			dateRelations: {
				"<today": "今天之前",
				today: "今天",
				">today": "今天之後",
			},
			fieldNotMappable: "此鍵沒有可對應的離散值——它保留自身的格式。",
			fieldMatchPlaceholder: "例如 high",
			fieldLabelPlaceholder: "選填",
			fieldValueColumn: "您筆記中的值",
			fieldWhenColumn: "日期落在何時",
			fieldShownColumn: "在任務上顯示為",
			fieldColorColumn: "顏色",
			fieldAddMapping: "新增一個值",
			fieldValuesFound: (n: number) => `來自您的筆記（${n}）`,
			fieldRemoveMapping: "移除值",
			fieldPickValue: "此鍵在 Obsidian 儲存庫其他位置取過的值",
			fieldColor: "顏色",
			fieldColorCustom: "自訂顏色",
			fieldColorClear: "無顏色",
			colorNames: {
				"--color-red": "紅色",
				"--color-orange": "橙色",
				"--color-yellow": "黃色",
				"--color-green": "綠色",
				"--color-cyan": "青色",
				"--color-blue": "藍色",
				"--color-purple": "紫色",
				"--color-pink": "粉紅色",
			},
			sourceNames: {
				status: "狀態（TaskNotes）",
				column: "看板欄（Kanban）",
				priority: "優先順序",
				start: "開始日期",
				scheduled: "預定日期",
				due: "到期日",
				doneDate: "完成日期",
				description: "描述",
			},
			showCompleted: "顯示已完成",
			showCompletedKanbanDesc: "在看板上，已完成的任務始終出現在「已完成」欄中。",
			maxTasks: "最多顯示任務數",
			maxTasksDesc: "依到期日排序（逾期／最近的優先），然後依檔案排序。",
			folders: "資料夾",
			scope: "範圍",
			scopeAll: "整個 Obsidian 儲存庫",
			scopeWhitelist: "僅這些資料夾",
			scopeBlacklist: "除這些資料夾之外的所有位置",
			foldersDesc: "每行一個資料夾路徑。",
		},
		favorites: {
			display: "顯示方式",
			displayDesc: "緊湊的清單列，或圖示位於名稱上方的圖磚網格。",
			displayList: "清單",
			displayTiles: "圖磚",
			titleAdvanced: "進階",
			titleAdvancedDesc:
				"用 Frontmatter 屬性代替檔名來命名筆記——例如 aliases，或你的 Obsidian 儲存庫專門用作標題的 title。" +
				"沒有該屬性的筆記仍顯示檔名；關閉時顯示檔名。",
			titleProperty: "從屬性取得標題",
			titlePropertyDesc:
				"用該屬性的第一個非空值作為筆記名稱。屬性名稱不區分大小寫；沒有該屬性的筆記依檔名顯示。",
			titlePropertyPlaceholder: "aliases",
			heading: "我的最愛",
			headingDesc: "每張我的最愛卡片顯示的筆記。",
			ownList: "為這張卡片單獨設定清單",
			ownListOn: "這張卡片顯示自己的筆記，不再使用整個 Obsidian 儲存庫的清單。關閉後將重新跟隨整個儲存庫的我的最愛，下面的清單會被捨棄。",
			ownListOff: "這張卡片跟隨整個 Obsidian 儲存庫的我的最愛，和其他我的最愛卡片一樣。開啟後可為它單獨設定一份清單，初始內容就是它目前顯示的。",
			moveUp: "上移",
			moveDown: "下移",
			remove: "移除",
			addFavorite: "新增我的最愛",
		},
		clock: {
			style: "樣式",
			styleDigital: "數位",
			styleAnalog: "指針",
			styleStacked: "堆疊",
			styleFlip: "翻頁",
			styleRing: "圓環",
			styleShapes: "形狀（Expressive）",
			styleOrbit: "軌道（Expressive）",
			styleExpressiveDesc: "Expressive 設計（樣式分頁）另有「形狀」和「軌道」兩種錶面。",
			styleFallbackDesc: (face: string) =>
				`此錶面屬於 Expressive 設計（樣式分頁）；經典卡片會改為顯示「${face}」。`,
			hourFormat: "時間格式",
			hourFormatAuto: "自動（地區設定）",
			hourFormat12: "12 小時制",
			hourFormat24: "24 小時制",
			showSeconds: "顯示秒",
			showGreeting: "顯示問候語",
			playful: "俏皮問候語",
			playfulDesc: "使用隨機、俏皮的問候語，取代平實的那些。",
			greetingOverride: "自訂問候語",
			greetingOverrideDesc: "留空則使用自動問候語。",
			date: "日期",
			dateFull: "星期，日 月",
			dateLong: "星期，日 月 年",
			dateShort: "短格式（地區設定）",
			dateIso: "ISO（2026-06-29）",
			dateWeekday: "僅星期",
			dateCustom: "自訂格式…",
			dateNone: "隱藏",
			customFormat: "自訂日期格式",
			customFormatDesc: "moment.js 格式，例如 ddd D MMM 或 YYYY/MM/DD。",
			customFormatPlaceholder: "ddd D MMM",
		},
		calculator: {
			angleUnit: "角度單位",
			angleUnitDesc: "sin、cos 等三角函數假定的單位。",
			degrees: "度",
			radians: "弧度",
			keypad: "鍵盤",
			keypadDesc:
				"在卡片上顯示螢幕鍵盤：基本（數字與運算）或科學（增加函數、冪和常數）。",
			keypadNone: "隱藏",
			keypadBasic: "基本",
			keypadScientific: "科學",
		},
		dataview: {
			language: "查詢類型",
			languageDesc: "Dataview 查詢語言（TABLE／LIST／TASK）或 DataviewJS 程式碼。",
			languageDql: "Dataview 查詢（DQL）",
			languageJs: "DataviewJS",
			query: "查詢",
			queryDqlDesc:
				"一條 Dataview 查詢，寫法與 ```dataview 程式碼區塊內部完全相同（不含圍欄）。" +
				"執行時沒有「目前筆記」，因此全域查詢完全可用，但相對 this.file 的查詢" +
				"沒有可解析的檔案。",
			queryJsDesc:
				"DataviewJS 程式碼，如同寫在 ```dataviewjs 區塊內（不含圍欄）。dv API 在作用域內。" +
				"會執行任意 JavaScript — 請只使用您信任的程式碼。",
			queryDqlPlaceholder:
				'TABLE file.mtime AS "Modified" FROM #project SORT file.mtime DESC',
			queryJsPlaceholder: "dv.list(dv.pages('#project').file.link)",
		},
		datacore: {
			language: "查詢類型",
			languageDesc:
				"轉譯為即時清單的 Datacore 查詢，或自行繪製檢視的 Datacore 指令碼。",
			languageQuery: "Datacore 查詢",
			languageJsx: "指令碼（JSX）",
			languageJs: "指令碼（JS）",
			languageTsx: "指令碼（TSX）",
			languageTs: "指令碼（TS）",
			query: "查詢",
			queryDesc:
				"一條 Datacore 查詢，例如 @page and #project。Hearth 會把符合項目轉譯為" +
				"即時連結清單。執行時沒有「目前筆記」，因此全域查詢完全可用，" +
				"但相對檔案的查詢沒有可解析的檔案。",
			queryPlaceholder: "@page and #project",
			script: "指令碼",
			scriptDesc:
				"一段 Datacore 指令碼，如同寫在 ```datacorejsx 區塊內（不含圍欄）。" +
				"dc API 在作用域內，指令碼回傳要轉譯的檢視。會執行任意程式碼——" +
				"請只使用您信任的程式碼。",
			scriptPlaceholder:
				"return function View() {\n\tconst pages = dc.useQuery(\"@page and #project\");\n\treturn <dc.List rows={pages} renderer={(p) => <dc.Link link={p.$link} />} />;\n}",
			pageSize: "每頁列數",
			pageSizeDesc: "以此列數對產生的清單分頁。0 表示一次顯示所有符合項目。",
		},
		git: {
			missing: "Git 外掛未啟用",
			missingDesc:
				"此卡片是 Git 社群外掛的一個視窗——請安裝並啟用它，並讓它指向一個 Git 儲存庫，" +
				"卡片才能顯示內容。",
			sections: "區塊",
			actions: "按鈕",
			destructive: "無法復原。",
			removeAction: "移除此按鈕",
			addAction: "新增一個按鈕",
			addActionPlaceholder: "請選擇…",
			actionStyle: "按鈕樣式",
			actionStyleDesc: "僅圖示較緊湊；帶文字則讓寬卡片更易讀。",
			actionStyles: {
				icon: "僅圖示",
				labelled: "圖示與文字",
			},
			committing: "提交",
			commitScope: "提交內容",
			commitScopeDesc: "「提交」和「提交並同步」按鈕包含哪些檔案。",
			commitScopes: {
				smart: "有已暫存檔案時提交暫存內容，否則提交全部",
				all: "全部",
				staged: "僅已暫存的檔案",
			},
			askForMessage: "詢問提交訊息",
			askForMessageDesc:
				"讓 Git 外掛每次都提示輸入提交訊息，與它的「…並指定訊息」命令完全一致。",
			commitMessage: "提交訊息",
			commitMessageDesc:
				"供此卡片的提交按鈕使用。留空則使用 Git 外掛自己的提交訊息範本。",
			commitMessagePlaceholder: "vault backup: {{date}}",
			skipConfirm: "略過確認",
			skipConfirmDesc:
				"直接執行捨棄變更的操作，而不先詢問。被捨棄的變更無法恢復。",
			display: "顯示",
			changeLimit: "顯示的變更檔案數",
			changeLimitDesc: "0 表示列出所有變更檔案。",
			showPaths: "顯示資料夾",
			showPathsDesc: "在每個變更檔名下顯示其所在資料夾。",
			logLimit: "顯示的提交數",
			logLimitDesc: "記錄區塊列出多少筆最近提交。",
			refresh: "重新讀取間隔",
			refreshDesc:
				"除跟隨 Git 外掛自身的更新之外，額外讀取 Git 儲存庫的間隔（分鐘）。" +
				"預設為 0 — 表示僅跟隨那些更新，這已涵蓋在 Obsidian 內完成的所有操作。",
		},
		operon: {
			view: "檢視",
			viewDesc: "此卡片從 Operon 繪製什麼。",
			viewList: "任務清單",
			viewBoard: "狀態看板",
			viewAgenda: "行程",
			viewTimer: "計時器",
			scope: "範圍",
			scopeDesc:
				"使用 Operon 自己的某個範圍檢視，或套用下方的篩選條件。" +
				"什麼算逾期、什麼算今天發生由 Operon 決定，因此隨著其規則演進，" +
				"這些範圍仍然正確。",
			scopeQuery: "自訂篩選",
			scopeNormal: "所有任務",
			scopeToday: "今天發生",
			scopeOverdue: "已逾期",
			scopeRecent: "最近處理過",
			createAs: "新任務",
			createAsDesc:
				"卡片上的「+」請求 Operon 建立什麼。「Operon 預設」遵循它自己的設定；" +
				"另外兩項則指定使用它已設定的哪個目標——當其中之一無法解析時很有用。" +
				"無論如何，任務最終放在哪裡都由 Operon 決定。",
			createAsDefault: "Operon 預設",
			createAsInline: "行內，寫在筆記中",
			createAsFile: "獨立筆記",
			agendaDays: "未來天數",
			agendaDaysDesc: "行程涵蓋多少天，包括今天。",
			count: "顯示的任務數",
			countDesc: "清單中或每個看板欄中的最大任務數。",
			pipelines: "流程",
			pipelinesDesc: "限定為這些 Operon 流程。不選則表示全部。",
			statuses: "狀態",
			statusesDesc: "限定為這些 Operon 狀態。不選則表示全部。",
			priorities: "優先順序",
			prioritiesDesc: "限定為這些 Operon 優先順序。不選則表示全部。",
			checkbox: "完成情況",
			checkboxDesc: "包含哪些完成狀態。預設僅未完成的任務。",
			checkboxOpen: "未完成",
			checkboxDone: "已完成",
			checkboxCancelled: "已取消",
			text: "文字比對",
			textDesc: "僅顯示描述中包含此文字的任務。",
			sort: "排序",
			sortDesc:
				"清單以及每個看板欄的順序。未完成的任務始終排在已完成的之前。" +
				"開關可反轉方向。",
			sortSmart: "智慧（日期、優先順序、時長）",
			sortDue: "日期",
			sortPriority: "優先順序",
			sortCreated: "建立時間",
			sortAlpha: "依字母",
			showDue: "顯示日期",
			showPriority: "顯示優先順序",
			showStatus: "顯示狀態",
			showRecurrence: "顯示重複標記",
			showTracker: "顯示執行中的計時器標記",
			showPinned: "顯示置頂標記",
			showFile: "顯示筆記名稱",
			noOptions: "請先在儀表板上新增一張 Operon 卡片以載入這些選項",
		},
		clip: {
			name: "筆記名稱",
			nameDesc: "新筆記的名稱。這裡的每個欄位都可以使用 {{變數}}。",
			folder: "資料夾",
			folderDesc: "新筆記存放的位置。這裡也可以使用變數，例如 Clippings/{{feed}}。留空 = Obsidian 儲存庫根目錄。",
			folderPlaceholder: "Obsidian 儲存庫根目錄",
			pickFolder: "選擇資料夾",
			properties: "屬性",
			propertiesDesc: "每個值都是一個範本。結果為空的屬性不會寫入筆記。",
			propertyName: "名稱",
			propertyValue: "值，例如 {{title}}",
			addProperty: "新增屬性",
			removeProperty: "刪除屬性",
			resetProperties: "恢復預設屬性",
			types: {
				text: "文字",
				list: "清單",
				number: "數字",
				checkbox: "核取方塊",
				date: "日期",
				datetime: "日期和時間",
			},
			body: "筆記內容",
			bodyDesc: "筆記的內文。",
			resetBody: "恢復預設內容",
			template: "範本筆記",
			templateDesc: "選填。它的文字放在內文開頭，並填入相同的變數。",
			pickTemplate: "選擇範本筆記",
			clearTemplate: "清除範本",
			linkKey: "關聯屬性",
			linkKeyDesc: "記住筆記的來源，這樣再次開啟同一項目時會開啟它的筆記，而不是新增一篇。留空：總是新增筆記。",
			variables: "變數",
			variablesHint: "點擊一個變數，將其插入游標所在處。",
			filters: "篩選器",
			filtersHint: "在變數後用 | 串接篩選器，例如 {{published|date:\"YYYY年M月D日\"}} 或 {{title|lower|truncate:40}}。",
			vars: {
				title: "標題",
				date: "發生的日期",
				start: "開始時間",
				end: "結束時間",
				location: "地點",
				description: "描述",
				url: "連結",
				calendar: "行事曆名稱",
				uid: "活動 ID",
				link: "項目的網址",
				content: "全文（Markdown）",
				html: "訂閱源傳送的全文（HTML）",
				excerpt: "簡短的純文字摘要",
				published: "發布時間",
				author: "作者",
				feed: "訂閱源名稱",
				feedUrl: "訂閱源網址",
				categories: "分類（清單）",
				image: "圖片網址",
				id: "項目在訂閱源中的 ID",
				today: "今天的日期",
				now: "目前日期和時間",
			},
			filterDocs: {
				date: { syntax: "date:\"YYYY-MM-DD\"", desc: "格式化日期（moment.js 格式）" },
				lower: { syntax: "lower", desc: "轉為小寫" },
				upper: { syntax: "upper", desc: "轉為大寫" },
				title: { syntax: "title", desc: "每個單字首字母大寫" },
				capitalize: { syntax: "capitalize", desc: "首字母大寫" },
				trim: { syntax: "trim", desc: "移除前後空白" },
				truncate: { syntax: "truncate:80", desc: "截斷到指定長度並加上 …" },
				replace: { syntax: "replace:\"a\",\"b\"", desc: "把每個 a 取代為 b" },
				default: { syntax: "default:\"文字\"", desc: "值為空時使用此文字" },
				split: { syntax: "split:\",\"", desc: "把文字拆成清單" },
				join: { syntax: "join:\", \"", desc: "把清單合併成文字" },
				first: { syntax: "first", desc: "清單的第一項" },
				last: { syntax: "last", desc: "清單的最後一項" },
				list: { syntax: "list", desc: "Markdown 項目清單" },
				wikilink: { syntax: "wikilink", desc: "每項變成 [[連結]]" },
				link: { syntax: "link:\"標籤\"", desc: "指向該網址的 Markdown 連結" },
				blockquote: { syntax: "blockquote", desc: "每行加上 > 引用" },
				safe_name: { syntax: "safe_name", desc: "移除檔名中不允許的字元" },
			},
			preview: "預覽",
			previewOf: (name: string) => `用「${name}」填入。`,
			previewSample: "用一個虛構的範例填入。",
			previewTemplate: (path: string) => `（先放 ${path} 的文字）`,
			copied: (text: string) => `已複製 ${text}`,
			sampleEvent: {
				title: "專案啟動會議",
				location: "4 號會議室",
				description: "議程：目標、負責人、第一個里程碑。",
				calendar: "工作",
			},
			sampleEntry: {
				title: "每週摘要第 42 期",
				feed: "範例電子報",
				author: "王小明",
				content: "本週：三篇值得一讀的文章，和一篇可以跳過的。",
			},
		},
		rss: {
			feeds: "訂閱源",
			namePlaceholder: "名稱（選填）",
			urlPlaceholder: "https://example.com/feed.xml",
			addFeed: "新增訂閱源",
			removeFeed: "移除訂閱源",
			github: "從 GitHub 新增",
			githubDesc:
				"以 owner/repo 形式輸入 Git 儲存庫（或貼上其網址）並選擇要關注的內容 — Hearth 會為您建構 Atom 訂閱源。",
			githubPlaceholder: "owner/repo",
			githubReleases: "發行版本",
			githubCommits: "提交",
			githubBoth: "發行版本與提交",
			githubAdd: "新增 Git 儲存庫",
			githubInvalid: "請以 owner/repo 形式輸入 Git 儲存庫。",
			githubReleasesName: "{repo} 發行版本",
			githubCommitsName: "{repo} 提交",
			mergeAll: "合併的「全部」標籤",
			mergeAllDesc: "在最前面新增一個標籤，把所有訂閱源合併為一個串流，最新優先。",
			display: "顯示",
			layout: "版面配置",
			layoutDesc: "每個項目的顯示方式。",
			layoutList: "清單（標題 + 日期）",
			layoutCards: "卡片（摘要 + 圖片）",
			layoutCompact: "緊湊（僅標題）",
			itemLimit: "每個來源的項目數",
			itemLimitDesc: "顯示多少筆最近項目。",
			refresh: "自動重新整理（分鐘）",
			refreshDesc: "多久重新取得一次訂閱源。0 = 僅在開啟時取得。",
			showImages: "顯示圖片",
			showImagesDesc: "當來源提供縮圖時顯示它們。",
			showExcerpt: "顯示摘要",
			showExcerptDesc: "在每個項目下顯示一小段文字摘要。",
			showDate: "顯示日期",
			showDateDesc: "顯示每個項目的發布時間。",
			reading: "閱讀",
			openIn: "開啟項目於",
			openInDesc: "點擊項目後前往何處。沒有網頁的項目（例如電子報）總是在 Hearth 閱讀器中開啟。",
			openInBrowser: "瀏覽器",
			openInDialog: "閱讀器（對話框）",
			openInTab: "閱讀器（分頁）",
			readerImages: "閱讀器中的圖片",
			readerImagesDesc: "圖片從寄件方的伺服器載入，對方因此會知道你開啟了項目——電子報正依賴這一點。「詢問」會顯示一個載入按鈕。",
			imagesAsk: "詢問",
			imagesAlways: "總是載入",
			imagesNever: "從不載入",
			unreadOnly: "僅未讀",
			unreadOnlyDesc: "只列出尚未開啟的項目。卡片上的篩選按鈕也可以切換。",
			noteHeading: "儲存為筆記",
			noteDesc: "閱讀器中「儲存為筆記」會把項目變成什麼——一個類似 Obsidian Web Clipper 的範本：每個欄位都可以使用 {{變數}}，並用篩選器加工。",
			noteEnabled: "提供「儲存為筆記」",
			noteEnabledDesc: "在閱讀器和項目選單中顯示此操作。",
		},
		market: {
			symbols: "代號",
			symbolsDesc: "卡片關注的標的，依繪製順序排列。單一標的樣式顯示第一個。",
			noSymbols: "還沒有標的——在下方搜尋，或直接輸入代號新增。",
			moveUp: "上移",
			moveDown: "下移",
			remove: "移除",
			holding: "持倉",
			quantity: "股數",
			cost: "成本價",
			search: "新增",
			searchDesc:
				"依名稱或代號搜尋，或直接輸入代號：AAPL、0700.HK、2330.TW、EUR/USD、BTC-USD、fund:161725（場外基金）、cg:bitcoin。",
			searchDisabled: "已停用外部請求，無法搜尋，但仍可直接新增代號。",
			searchPlaceholder: "台積電、Apple、EUR/USD…",
			searchEmpty: "請先輸入名稱或代號",
			searchButton: "搜尋",
			addTyped: "依輸入新增",
			noResults: "未找到結果。試試直接輸入代號新增。",
			add: "新增",
			added: "已新增",
			appearance: "外觀",
			style: "樣式",
			styleDesc: "極簡、聚焦和走勢圖顯示單一標的，其餘樣式顯示全部。",
			styles: {
				minimal: "極簡——價格與漲跌",
				spotlight: "聚焦——價格、走勢圖與數據",
				chart: "走勢圖——鋪滿卡片",
				list: "自選清單",
				tiles: "圖磚",
				ticker: "跑馬燈行情",
				portfolio: "投資組合",
				lookup: "查詢——在卡片上搜尋",
			},
			design: "設計",
			designDesc: "經典，或 Material 3 Expressive：標籤、強調色的色調容器和柔和的形狀。",
			designClassic: "經典",
			designExpressive: "Expressive",
			upColor: "上漲顏色",
			upColorDesc: "台灣、中國、日本和韓國以紅色表示上漲，其他地區多用綠色。自動會跟隨 Obsidian 的介面語言。",
			upColorAuto: "自動",
			upColorGreen: "綠漲紅跌",
			upColorRed: "紅漲綠跌",
			range: "走勢區間",
			rangeDesc: "迷你走勢圖涵蓋的時間範圍。",
			rangeDescSingle: "走勢圖預設顯示的區間，可用卡片上的按鈕切換。",
			change: "漲跌顯示為",
			changePercent: "百分比",
			changeAbsolute: "金額",
			changeBoth: "兩者",
			baseCurrency: "組合幣別",
			baseCurrencyDesc: "總額依歐洲央行每日匯率換算為此幣別。",
			baseCurrencyAuto: "自動（多數持倉的幣別）",
			animate: "跑馬燈行情",
			animateDesc: "關閉後行情列靜止，可手動捲動。在低效能等級下始終關閉。",
			display: "顯示內容",
			showName: "名稱",
			showSparkline: "迷你走勢圖",
			showStats: "數據",
			showMarketState: "開盤或收盤狀態",
			showUpdated: "更新時間",
			refresh: "重新整理間隔（分鐘）",
			refreshDesc: "0 表示僅在開啟儀表板時重新整理。卡片之間共用報價，已收盤的市場最多每半小時檢查一次。",
		},
		tension: {
			about: "Kagi News · World Tension",
			aboutDesc:
				"Kagi News 讓語言模型閱讀當天的國際頭條，並為全球緊張局勢打分：0 為平靜，100 為戰火。這是模型對新聞的判斷，而非測量。點擊卡片會在 Kagi News 上開啟該指數。",
			appearance: "外觀",
			style: "樣式",
			styleDesc: "簡約樣式顯示分數及其在刻度上的位置；藝術樣式畫出一座村莊，隨著分數升高從和平走向戰爭。",
			styleMinimal: "簡約",
			styleArtistic: "藝術",
			animate: "動畫",
			animateDesc: "讓立體場景動起來：風車、煙霧、飛機。效能等級和減少動態效果仍可讓它靜止。",
			display: "顯示內容",
			showBand: "級別（涼爽…燃燒）",
			showSummary: "AI 解釋",
			showSummaryDesc: "Kagi 的語言模型對分數原因的說明。",
			summaryLength: "解釋長度",
			summarySentence: "第一句",
			summaryFull: "全部",
			showScale: "刻度",
			showChange: "較昨日變化",
			showChangeDesc: "分數比前一天變化了多少分。",
			showHistory: "歷史",
			historyDays: "歷史範圍",
			days: (n: number) => `${n} 天`,
			showUpdated: "上次更新",
			refresh: "檢查間隔（分鐘）",
			refreshDesc: "Kagi 每天發布一次新指數，因此在距上次發布滿一天之前卡片不會發出任何請求；之後依此間隔檢查，直到新指數發布。0 表示僅在開啟儀表板時檢查。",
		},
		weather: {
			location: "位置",
			search: "尋找地點",
			searchDesc:
				"依名稱搜尋 — Hearth 會把座標存在卡片上，因此這次查詢只發生一次。",
			searchDisabled:
				"Hearth 設定中已停用對外連線，地點搜尋不可用。您仍可在下方輸入座標。",
			searchPlaceholder: "台北、里斯本、京都…",
			searchButton: "搜尋",
			searchEmpty: "請輸入要搜尋的地名。",
			searchNoResults: "沒有符合該名稱的地點。",
			usePlace: "使用",
			reuse: "重複使用某個位置",
			reuseDesc: "您某張天氣卡片上已設定的地點。",
			reusePick: "選擇一個位置…",
			unnamedPlace: "（未命名地點）",
			clearPlace: "清除位置",
			coordinates: "座標",
			coordinatesDesc: "以十進位度數表示的緯度和經度，如果您不想搜尋的話。",
			latPlaceholder: "25.03",
			lonPlaceholder: "121.56",
			placeName: "標籤",
			placeNameDesc: "卡片如何稱呼此地點。",
			placeNamePlaceholder: "家",

			appearance: "外觀",
			style: "樣式",
			styleDesc: "卡片在螢幕上呈現多少預報內容。",
			styleMinimal: "極簡（圖形 + 溫度）",
			styleCompact: "緊湊（一列）",
			styleDetailed: "詳細（指標網格）",
			styleForecast: "預報（逐小時曲線）",
			styleArtistic: "藝術（繪製的天空）",
			styleMoon: "月亮（今晚的月相）",
			design: "設計",
			designDesc: "經典線條圖示與手繪天空，或 Material 3 Expressive：扁平天氣插畫、標籤與強調色色塊。",
			designClassic: "經典",
			designExpressive: "Expressive",
			styleDaylight: "日照（太陽的軌跡）",
			animate: "讓天空動起來",
			animateDesc: "飄動的雲、落下的雨與閃爍的星。低功耗模式下始終關閉。",
			animateMoonDesc: "月亮升起並輕輕浮動，後方的形狀緩緩旋轉，星星閃爍。低功耗模式下始終關閉。",
			animateSunDesc: "太陽沿軌跡走到目前時刻，並在那裡緩緩旋轉。低功耗模式下始終關閉。",
			moonLayout: "版面配置",
			moonLayoutDesc: "顯示今晚月亮的全部資訊，或只顯示月亮及其在月中的位置。",
			moonLayoutFull: "完整（夜空與詳細資料）",
			moonLayoutClean: "簡潔（月亮與月相進度）",

			units: "單位",
			tempUnit: "溫度",
			tempUnitC: "攝氏（°C）",
			tempUnitF: "華氏（°F）",
			windUnit: "風速",
			windUnitKmh: "公里每小時（km/h）",
			windUnitMs: "公尺每秒（m/s）",
			windUnitMph: "英里每小時（mph）",
			windUnitKn: "節（kn）",
			precipUnit: "降水量",
			precipUnitMm: "毫米（mm）",
			precipUnitInch: "英寸（in）",
			hourFormat: "時間格式",
			hourFormatAuto: "自動（地區設定）",
			hourFormat12: "12 小時制",
			hourFormat24: "24 小時制",

			display: "顯示內容",
			showLocation: "地名",
			showCondition: "天氣狀況",
			showFeelsLike: "體感溫度",
			showHighLow: "今日最高與最低",
			showHumidity: "濕度",
			showWind: "風",
			showPrecip: "降水",
			showPrecipDesc: "降雨機率與已降水量，以及逐小時機率。",
			showUv: "紫外線指數",
			showPressure: "氣壓",
			showSun: "日出與日落",
			showUpdated: "最後更新時間",
			hourlyCount: "未來小時數",
			hourlyCountDesc: "逐小時列涵蓋多少小時。0 表示隱藏。",
			dailyCount: "未來天數",
			dailyCountDesc: "逐日預報涵蓋多少天。0 表示隱藏。",
			refresh: "自動重新整理（分鐘）",
			refreshDesc: "多久重新取得一次預報。0 = 僅在開啟時取得。",
		},
		jira: {
			host: "Jira 主機",
			hostDesc: "Jira 網站的來源位址。傳送個人存取 Token 時必須使用 HTTPS。",
			hostPlaceholder: "https://jira.example.com",
			pat: "個人存取 Token",
			patDesc: "此卡片使用的 Bearer PAT。儲存在 Hearth 的外掛資料中。",
			apiBase: "API 基礎路徑",
			apiBaseDesc: "Jira REST 的相對路徑。完整網址會被拒絕。",
			apiBasePlaceholder: "/rest/api/latest",
			savedFilter: "已儲存的篩選器",
			savedFilterDesc: "載入您加入我的最愛的 Jira 篩選器，然後選擇其中一個。",
			selectedFilter: (name: string) => `已選擇：${name}`,
			loadFilters: "載入我的最愛篩選器",
			chooseFilter: "選擇一個篩選器…",
			noFavoriteFilters: "Jira 未回傳任何我的最愛篩選器。",
			loadFailed: "無法載入 Jira 篩選器。請檢查主機、API 路徑和 Token。",
			externalCallsDisabled:
				"Hearth 設定中已停用對外連線，無法載入我的最愛篩選器。",
			controls: "篩選控制項",
			maxResults: "最大結果數",
			maxResultsDesc: "最多顯示多少筆篩選後的工作項目，上限 200。",
			refresh: "自動重新整理（分鐘）",
			refreshDesc: "多久重新整理一次 Jira。0 = 僅在開啟或手動重新整理時。",
			cache: "快取間隔（分鐘）",
			cacheDesc: "成功的 Jira 回應在記憶體中保留多久。0 表示停用快取。",
		},
		leaf: {
			view: "要承載的檢視",
			viewDesc:
				"來自核心或社群外掛的已註冊側邊面板檢視（行事曆、大綱、標籤面板、看板…）。" +
				"可選清單取決於啟用了哪些外掛。",
			pickPlaceholder: "選擇一個檢視…",
			none: "未找到可承載的檢視。請啟用一個提供側邊面板檢視的外掛。",
			file: "要顯示的檔案",
			fileDesc:
				"選填。在承載的檢視中開啟 Obsidian 儲存庫中的特定檔案 — Excalidraw 繪圖、白板、筆記。" +
				"留空則承載不帶檔案的檢視（某些檢視此時會顯示空白或「新增檔案」畫面）。",
			filePlaceholder: "例如 Drawings/Sketch.excalidraw.md",
			pickFile: "選擇檔案",
			clearFile: "清除檔案",
			hideHeader: "隱藏檢視標題列",
			hideHeaderDesc:
				"隱藏所承載檢視自己的標題列——導覽路徑、上一頁／下一頁箭頭和選單。" +
				"當卡片只顯示單個檔案時很實用。",
			perfLabel: "效能",
			perfNote:
				"這是 Hearth 中負擔最大的卡片。它在儀表板內即時執行另一個外掛的完整檢視，" +
				"因此只要儀表板處於開啟狀態，該外掛自己的計時器、監聽器和轉譯就會一直執行——" +
				"每多一張這樣的卡片就再多一份負擔。最多使用一兩張，" +
				"並預期在配備一般的硬體上儀表板會變慢。",
			perfNoteTier:
				"您已降低效能等級。它無法讓此卡片變輕——承載的檢視自行管理——" +
				"因此如果儀表板仍然吃力，這就是最值得移除的一張卡片。",
			note: "測試版",
			noteDesc:
				"在卡片內承載另一個外掛的檢視。某些檢視預期自己在側邊欄中，" +
				"在這裡可能轉譯或尺寸異常。",
		},
		pet: {
			species: "動物",
			name: "名字",
			nameDesc: "怎麼稱呼它。留空則使用該動物的名稱。",
			colors: "顏色",
			colorsDesc: "身體色與點綴色。輪廓、陰影和腹部由身體色推導得出。",
			colorsReset: "恢復此動物的原本顏色",
			size: "大小",
			sizeSmall: "小",
			sizeMedium: "中",
			sizeLarge: "大",
			metric: "以什麼餵養",
			metricDesc: "寵物的心情跟隨哪一項 Obsidian 儲存庫活動。",
			metricModified: "編輯的筆記",
			metricCreated: "建立的筆記",
			moods: "心情",
			moodsDesc:
				"每種心情從哪裡開始。這裡的任何設定都不會讓寵物生病或走失——" +
				"安靜的 Obsidian 儲存庫只會讓它睡著，而任何寫作都會立刻把它喚醒。",
			moodsReset: "恢復預設心情",
			excitedAt: "歡欣雀躍於",
			excitedAtDesc: "今天觸及的筆記數達到或超過此值。",
			happyAt: "開心於",
			happyAtDesc: "今天觸及的筆記數——您狀態不錯的一天。",
			contentAt: "滿足於",
			contentAtDesc: "今天觸及的筆記數。低於此值寵物就會覺得無聊。",
			sleepyAfter: "多久後入睡",
			sleepyAfterDesc:
				"Obsidian 儲存庫中任何位置都無變動的分鐘數。無論心情如何、這一天多麼美好，" +
				"寵物都會睡去，而任何活動都會把它喚醒並回到當天的狀態。",
			pettedFor: "撫摸持續",
			pettedForDesc: "點擊寵物後保證開心的分鐘數。",
			nightSleep: "夜間",
			nightSleepDesc:
				"允許時鐘做什麼。深夜的清淡是時辰使然，而非被忽視——" +
				"美好的一天仍會顯示為美好的一天，而無論此處如何設定，撫摸都能喚醒寵物。",
			nightOff: "不做任何事——只看 Obsidian 儲存庫",
			nightQuiet: "無聊或滿足的寵物改為入睡",
			nightAlways: "夜間始終睡覺",
			nightWindow: "夜間開始於",
			nightWindowDesc: "使用您的本地時間。時段可以跨越午夜。",
			eyesFollow: "眼睛跟隨游標",
			eyesFollowDesc: "無論此處如何設定，睡著的寵物都會閉著眼。",
			eyesOff: "從不",
			eyesCard: "僅在它自己的卡片上",
			eyesBoard: "儀表板上任何位置",
			showName: "顯示名字",
			showMood: "顯示心情",
			showActivity: "顯示今天的活躍度",
		},
		vaultPet: {
			missing: "尚未安裝 Vault Pet",
			missingDesc:
				"這張卡片用來承載 Vault Pet 社群外掛。安裝並啟用後卡片會自行填入——" +
				"無論如何這些設定都會保留。",
			display: "顯示",
			displayDesc:
				"兩者都來自 Vault Pet 自身：它可以插入筆記的小卡片，或它的小屋檢視，" +
				"承載在這裡而不是側邊欄。",
			displayPet: "寵物",
			displayHouse: "寵物小屋",
			showHeader: "保留小屋的標題列",
			showHeaderDesc: "承載檢視自帶的標題列預設隱藏——卡片本身已經有一個。",
			openButton: "「開啟寵物小屋」按鈕",
			openButtonDesc: "卡片角落的一個按鈕，像它的功能區圖示一樣在側邊欄開啟 Vault Pet 的小屋。",
		},
		design: {
			name: "設計",
			desc: "經典，或 Material 3 Expressive：強調色的色調容器、膠囊與柔和形狀。",
			classic: "經典",
			expressive: "Expressive",
			followDefault: (design: string) => `預設（${design}）`,
		},
		colors: {
			heading: "顏色",
			headingDesc: "此卡片的強調色和背景色調。",
			clearAccent: "清除強調色",
			clearBackground: "清除背景",
			cardOpacity: "卡片不透明度",
			cardOpacityDesc: "半透明的卡片表面（覆寫儀表板預設值）。",
			cardBlur: "卡片模糊",
			cardBlurDesc:
				"此卡片後方的毛玻璃模糊（覆寫儀表板預設值）。需要不透明度低於 100%。",
			cardBorderWidth: "卡片邊框",
			cardBorderWidthDesc:
				"此卡片的邊框粗細（覆寫儀表板預設值）。0 表示移除邊框以及標題下方的分隔線。",
			useDashboardDefault: "使用儀表板預設值",
		},
		size: {
			heading: "尺寸",
			headingDesc:
				"寬度（佔儀表板的百分比）與高度（像素）。也可以直接拖曳卡片的任一邊或角。",
			widthAria: "寬度（佔儀表板的百分比）",
			heightAria: "高度（像素）",
		},
		pin: {
			heading: "釘選到所有儀表板",
			headingDesc: "在每個儀表板上顯示此卡片，共用同一份定義和位置。",
		},
		copy: {
			heading: "複製到儀表板",
			headingDesc: "把此卡片的副本新增到另一個儀表板的末尾。",
			copy: "複製",
			copyTooltip: "把此卡片複製到所選儀表板",
		},
	},

	// ---- Card bodies (rendered content) --------------------------------
	cards: {
		music: {
			play: "播放",
			pause: "暫停",
			next: "下一首",
			previous: "上一首",
			shuffle: "隨機播放",
			repeat: "重複",
			repeatNone: "重複：關閉",
			repeatAll: "重複：整個佇列",
			repeatOne: "重複：目前曲目",
			volume: "音量",
			seek: "播放進度",
			nothingPlaying: "未在播放",
			queueEmpty: "佇列為空",
			stereoIdle: "在 Stereo 裡新增一些音樂",
			moreTracks: (shown: number, total: number) => `顯示 ${shown} / ${total} 首`,
			errorMissing: "該檔案已不在 Obsidian 儲存庫中",
			errorPlayback: "此檔案無法在這裡播放",
		},
		empty: {
			musicEmpty: "在卡片設定裡新增曲目",
			musicFolderEmpty: "此資料夾裡沒有音訊檔案",
			musicStereoMissing: "安裝並啟用 Stereo 外掛，才能從 Navidrome 或 Subsonic 播放",
			musicStereoUnconfigured: "在 Stereo 的設定裡填寫伺服器位址",
			searchNoQuery: "請在卡片設定中設定查詢",
			searchNoMatches: "沒有符合的項目",
			embedPickFile: "請在設定中選擇要嵌入的檔案",
			embedSectionMissing: (section: string) => `找不到片段：${section}`,
			slideshowEmpty: "請在卡片設定中新增圖片",
			slideshowFolderEmpty: "此資料夾中沒有圖片",
			embedEnableBases: "請啟用核心外掛 Bases 以嵌入 .base 檔案",
			embedEnableCanvas: "請啟用核心外掛「白板」以嵌入白板",
			embedInstallExcalidraw: "請安裝 Excalidraw 外掛以嵌入繪圖",
			dailyEnable: "請啟用核心外掛「日記」",
			periodicInstall: "請安裝 Periodic Notes 外掛",
			journalsInstall: "請安裝 Journals 外掛",
			scheduleNoSources:
				"請啟用核心外掛「日記」，或在此卡片的設定中訂閱一個行事曆",
			webNoUrl: "請在設定中設定網址",
			bookmarksEnable: "請啟用核心外掛「書籤」",
			bookmarksEmpty: "還沒有書籤",
			favoritesEmpty: "請在設定中新增我的最愛",
			recentEmpty: "沒有最近檔案",
			folderEmpty: "此資料夾為空",
			folderMissing: (path: string) =>
				path ? `找不到資料夾「${path}」` : "請在卡片設定中選擇資料夾",
			linksEmpty: "請在設定中新增連結",
			templaterEnable: "請啟用 Templater 外掛以從範本建立筆記",
			templaterEmpty: "請在卡片設定中新增一個範本",
			tasksEnable: "請啟用 TaskNotes 外掛，或把來源切換為核取方塊",
			tasksEmpty: "沒有未完成的任務",
			tasksNoMatch: "沒有任務符合篩選條件",
			matrixNeedsPriorities: "矩陣依優先順序排列任務——請在此卡片設定中開啟「日期與優先順序」以便讀取。",
			kanbanNoBoard:
				"未找到 Kanban 看板——請在卡片設定中選擇一篇看板筆記，或用 Kanban 外掛建立一個",
			dataviewEnable: "請啟用 Dataview 外掛以執行查詢",
			dataviewNoQuery: "請在卡片設定中設定 Dataview 查詢",
			datacoreEnable: "請啟用 Datacore 外掛以執行查詢",
			datacoreNoQuery: "請在卡片設定中設定 Datacore 查詢",
			datacoreBadQuery: "Datacore 無法讀取此查詢",
			datacoreOneQuery:
				"一張卡片只執行一條查詢——這裡看起來有多條。請只保留想要的那一條，後面不要跟註解。",
			datacoreFailed: "Datacore 無法執行此卡片",
			gitEnable: "請啟用 Git 外掛以管理 Obsidian 儲存庫的 Git 儲存庫",
			gitNotReady: "尚未開啟任何 Git 儲存庫——請在 Git 外掛中設定一個",
			rssNoSources: "請在卡片設定中新增訂閱源",
			weatherNoLocation: "請在卡片設定中選擇一個位置",
			marketNoSymbols: "請在卡片設定中新增股票、基金、貨幣或加密貨幣",
			renderFailed: "此卡片無法繪製——詳細資料請查看主控台",
			leafPickView: "請在卡片設定中選擇一個外掛檢視",
			boardPickView: "請在儀表板設定中為本儀表板選擇一個檢視",
			boardPickCard: "此儀表板還沒有卡片——新增一張來鋪滿它",
			boardNeedsFile: "請在儀表板設定中為本儀表板選擇一個檔案",
			leafViewMissing: "此檢視不可用——請啟用提供它的外掛",
			vaultPetInstall: "安裝 Vault Pet 外掛即可在此養一隻寵物",
			vaultPetNoHouse: "Vault Pet 的小屋不可用——請啟用或更新該外掛",
			operonEnable: "請啟用 Operon 外掛以顯示其任務",
			operonDisabled: "Operon 整合已關閉——請在 設定 → Hearth → 整合 中開啟",
			operonUnsupported:
				"Operon 的開發者 API 僅支援桌面版，且需要 Obsidian 1.12.2 或更新版本",
			operonPending:
				"請在 設定 → Operon → Core → General → Developer API Integrations 中核准 Hearth",
			operonSuspended:
				"Operon 暫停了 Hearth 的存取權限——請在 Operon 的 Developer API Integrations 中查看",
			operonRevoked:
				"Operon 存取權限已被撤銷——請在 Operon 的 Developer API Integrations 中重新授予",
			operonBooting: "Operon 仍在啟動中",
			operonError: "Operon 拒絕了連線",
			operonNoTasks: "沒有符合的 Operon 任務",
			operonNoAgenda: "此時段內沒有安排",
			operonNoColumns: "沒有可顯示的 Operon 狀態——請在卡片設定中選擇一個流程",
		},
		folder: {
			browse: "瀏覽此資料夾",
			/** The card's last row: what it isn't showing. */
			more: (n: number) => `還有 ${n} 項…`,
			missing: "Obsidian 儲存庫中已不存在此資料夾。",
			/** The path row's back arrow, and the vault's own name in it. */
			up: (name: string) => `返回 ${name}`,
			vaultRoot: "Obsidian 儲存庫根目錄",
			/** The browser's own controls, beside the breadcrumb. */
			showList: "以清單顯示",
			showTiles: "以圖磚顯示",
			openInTab: "在新分頁中開啟",
			/** Folding a subfolder's section in the browser, one or all of them. */
			collapse: (name: string) => `摺疊 ${name}`,
			expand: (name: string) => `展開 ${name}`,
			collapseAll: "摺疊所有資料夾",
			expandAll: "展開所有資料夾",
		},
		operon: {
			loading: "正在讀取 Operon…",
			untitled: "未命名任務",
			settling: "Operon 仍在就緒中",
			timerIdle: "沒有正在執行的計時器",
			timerStarting: "正在啟動…",
			timerStopping: "正在停止…",
			timerUnassigned: "未歸屬的時間",
			truncated: (shown: number, total: number) => `顯示 ${shown} / ${total}`,
			readFailed: (reason: string) => `Operon 無法回應：${reason}`,
			/** Operon's own words, shown verbatim under an empty state so the
			 * problem is diagnosable instead of guessed at. */
			errorDetail: (code: string, reason: string) => (reason ? `${code} — ${reason}` : code),
			addTask: "新增任務",
			moveTo: "移動到",
			targetDaily: "Operon 設定為把新的行內任務放進今天的日記。",
			targetFile: (path: string) => `Operon 設定為把新的行內任務放進 ${path}。`,
			targetActive: "Operon 設定為把新的行內任務放進目前作用中的檔案。",
			targetAsk:
				"Operon 設定為每次詢問新行內任務的去處，而儀表板卡片無法回答——" +
				"請在此卡片上改選「獨立筆記」。",
			targetNote: (folder: string) =>
				folder
					? `Operon 設定為把新任務建立為 ${folder} 中的筆記。`
					: "Operon 設定為把新任務建立為獨立筆記。",
			addTaskPlaceholder: "需要做什麼？",
			addTaskDue: "到期日",
			confirmTitle: "Operon 需要確認",
			/** Operon assessed the change and asked for consent; its own summary
			 * of what would happen is shown rather than Hearth's guess at it. */
			confirmMessage: (risk: string, effects: string) =>
				effects
					? `Operon 將此變更評定為 ${risk}：${effects}`
					: `Operon 將此變更評定為 ${risk}。`,
			confirmApply: "套用",
		},
		templater: {
			untitledTile: "新增筆記",
			vaultRoot: "預設位置",
			untitledNote: "Untitled",
			createsIn: (destination: string) => `將建立於 ${destination}`,
			promptTitle: "為新筆記命名",
			promptPlaceholder: "它是關於什麼的？",
		},
		pet: {
			species: {
				cat: "貓",
				dog: "狗",
				bird: "鳥",
				fox: "狐狸",
				frog: "青蛙",
				blob: "軟軟",
			},
			moodExcited: "歡欣雀躍",
			moodHappy: "開心",
			moodContent: "滿足",
			moodBored: "有點無聊",
			moodSleepy: "睡得香甜",
			moodNight: "已進入夜間睡眠",
			petHint: "點擊撫摸",
			todayCount: (count: number, metric: "modified" | "created") =>
				metric === "created"
					? `今天新增了 ${count} 篇筆記`
					: `今天有 ${count} 篇筆記`,
			streak: (days: number) => `連續 ${days} 天`,
		},
		vaultPet: {
			openHouse: "開啟寵物小屋",
		},
		embed: {
			openFile: "開啟此檔案",
			editHint: "按兩下以編輯",
			emptyNotePlaceholder: "空筆記…",
			emptyNoteHint: "空筆記——按兩下以編輯",
		},
		slideshow: {
			previous: "上一張圖片",
			next: "下一張圖片",
			pause: "暫停投影片",
			play: "繼續播放投影片",
			openImage: "開啟此圖片",
			jump: "跳轉到圖片",
		},
		text: {
			placeholder: "隨手記點什麼…",
		},
		calculator: {
			placeholder: "2 + 2、10 km to miles、10 € to USD…",
		},
		rss: {
			allTab: "全部",
			untitled: "（無標題）",
			loading: "正在載入訂閱源…",
			empty: "此訂閱源沒有項目",
			error: "無法載入此訂閱源",
			disabled: "訂閱源已關閉（對外連線已停用）",
			refresh: "重新整理",
			nothingToOpen: "此項目沒有可開啟的連結或內文。",
			allFeeds: "全部訂閱源",
			allRead: "全部已讀",
			unreadOnly: "僅顯示未讀",
			showAll: "顯示全部項目",
			markAllRead: "全部標為已讀",
			markRead: "標為已讀",
			markUnread: "標為未讀",
			readHere: "在 Hearth 中閱讀",
			openTab: "在新分頁中閱讀",
			openBrowser: "在瀏覽器中開啟",
			saveNote: "儲存為筆記",
			openNote: "開啟已儲存的筆記",
			copyLink: "複製連結",
			linkCopied: "已複製連結",
			reader: {
				title: "閱讀器",
				gone: "這張訂閱源卡片已不存在。",
				noItems: "這裡沒有可讀的內容。",
				toggleList: "顯示或隱藏清單",
				prevFeed: "上一個訂閱源",
				nextFeed: "下一個訂閱源",
				popOut: "在分頁中開啟",
				prev: "上一篇",
				next: "下一篇",
				position: (at: number, of: number) => `第 ${at} / ${of} 篇`,
				keys: "← → 項目 · [ ] 訂閱源 · o 開啟 · s 儲存 · u 未讀 · i 圖片 · l 清單",
				imagesBlocked: (n: number) => (n === 1 ? "有 1 張圖片未載入。" : `有 ${n} 張圖片未載入。`),
				loadImages: "載入圖片",
				noteSaved: (path: string) => `已儲存為 ${path}`,
				noteFailed: "無法建立筆記。",
			},
		},
		market: {
			types: {
				equity: "股票",
				etf: "ETF",
				fund: "基金",
				index: "指數",
				currency: "外匯",
				crypto: "加密貨幣",
				future: "期貨",
				other: "",
			},
			states: {
				open: "交易中",
				pre: "盤前",
				post: "盤後",
				closed: "已收盤",
			},
			ranges: {
				"1d": "1日",
				"5d": "5日",
				"1mo": "1月",
				"6mo": "6月",
				"1y": "1年",
				"5y": "5年",
			},
			rangeNames: {
				"1d": "一天",
				"5d": "五天",
				"1mo": "一個月",
				"6mo": "六個月",
				"1y": "一年",
				"5y": "五年",
			},
			sources: {
				yahoo: "Yahoo Finance",
				tencent: "騰訊",
				eastmoney: "東方財富",
				coingecko: "CoinGecko",
				frankfurter: "歐洲央行（Frankfurter）",
			},
			updated: (time: string) => `更新於 ${time}`,
			loadingShort: "載入中…",
			unavailable: "暫無資料",
			disabled: "已停用外部請求，無法取得行情",
			noChart: "此區間暫無走勢圖",
			dayRange: "日內區間",
			yearRange: "52 週區間",
			open: "開盤",
			prevClose: "昨收",
			volume: "成交量",
			currency: "幣別",
			source: "來源",
			asOf: "時間",
			totalValue: "總市值",
			noHoldings: "請在卡片設定中填寫持有股數",
			today: "今日",
			totalGain: "累計",
			notConverted: (n: number) => `${n} 項持倉未計入：缺少其幣別的匯率`,
			units: (n: number) => `${n.toLocaleString()} 股`,
			position: "我的持倉",
			unitsLabel: "股數",
			value: "市值",
			avgCost: "成本價",
			costBasis: "持倉成本",
			openInBrowser: "在瀏覽器中開啟",
			refresh: "重新整理",
			searchPlaceholder: "搜尋股票、基金、外匯或加密貨幣",
			searchDisabled: "已停用外部請求，無法搜尋",
			searching: "搜尋中…",
			noResults: "未找到結果",
			lookupHint: "在上方搜尋名稱、代號、基金代碼或貨幣對，一鍵新增到卡片。",
			back: "返回",
			addToCard: "新增到卡片",
			onCard: "已在卡片上",
			added: (name: string) => `已新增 ${name}`,
		},
		tension: {
			title: "全球緊張局勢",
			bands: {
				cool: "和平",
				mild: "輕微",
				warm: "升溫",
				hot: "緊繃",
				burning: "危險",
			},
			loading: "正在閱讀新聞…",
			error: "無法載入全球緊張指數",
			disabled: "全球緊張指數已關閉（已停用外部請求）",
			none: "Kagi 目前沒有發布全球緊張指數",
			open: "在 Kagi News 上開啟全球緊張指數",
			aria: (score: number, band: string) => `全球緊張指數 ${score}/100，${band}`,
			source: "AI 評估 · Kagi News",
			updated: (when: string) => `更新於 ${when}`,
			historyTip: (days: number, lo: number, hi: number) => `最近 ${days} 天：${lo}–${hi}`,
			changeTip: "較前一天的變化",
		},
		weather: {
			loading: "正在載入預報…",
			error: "無法載入預報",
			disabled: "天氣已關閉（對外連線已停用）",
			now: "現在",
			todayLabel: "今天",
			feelsLike: (temp: string) => `體感 ${temp}`,
			highLow: (high: string, low: string) => `最高 ${high} · 最低 ${low}`,
			updated: (time: string) => `更新於 ${time}`,
			humidity: "濕度",
			wind: "風",
			precip: "降水",
			uv: "紫外線",
			pressure: "氣壓",
			sunrise: "日出",
			sunset: "日落",
			/** Compass points, clockwise from north. Indexed by the bearing's
			 * eighth — keep all eight, in this order. */
			compass: ["北", "東北", "東", "東南", "南", "西南", "西", "西北"],
			duration: (h: number, m: number) => (h ? `${h} 小時 ${m} 分鐘` : `${m} 分鐘`),
			moon: {
				label: "月亮",
				phases: {
					new: "新月",
					waxingCrescent: "眉月",
					firstQuarter: "上弦月",
					waxingGibbous: "盈凸月",
					full: "滿月",
					waningGibbous: "虧凸月",
					lastQuarter: "下弦月",
					waningCrescent: "殘月",
				},
				illuminated: (percent: string) => `照亮 ${percent}`,
				age: (days: number) => `第 ${days} 天（共 29 天）`,
				nextFull: "滿月",
				nextNew: "新月",
				moonrise: "月出",
				moonset: "月落",
				inDays: (days: number) =>
					days <= 0 ? "今天" : days === 1 ? "明天" : `${days} 天後`,
				cycle: "今晚在朔望月中的位置",
			},
			daylight: {
				until: (span: string) => `${span}後`,
				dayLength: (span: string) => `日照 ${span}`,
				polarDay: "今天太陽不落",
				polarNight: "今天太陽不升",
				arc: "太陽從日出到日落的軌跡",
			},
			/** The full-forecast dialog a weather card opens when it is clicked:
			 * every reading the response carries, whatever the card shows. */
			detail: {
				title: "天氣預報",
				open: "開啟完整預報",
				now: "此刻",
				days: "未來一週",
				hoursFor: (day: string) => `逐小時 · ${day}`,
				selectDay: (day: string) => `查看${day}的逐小時預報`,
				noHours: "這一天已沒有剩餘的小時",
				refresh: "重新整理",
				source: "Open-Meteo",
				feelsLikeLabel: "體感溫度",
				gust: "陣風",
				cloudCover: "雲量",
				precipChance: "降水機率",
				precipHour: "本小時降水",
				precipTotal: "降水總量",
				windMax: "最大風速",
				uvMax: "紫外線最高值",
				columnTime: "時間",
				columnCondition: "天氣",
				columnTemp: "氣溫",
				columnFeels: "體感",
				columnPrecip: "降水",
				columnWind: "風",
				columnHumidity: "濕度",
				columnUv: "紫外線",
			},
			/** One per WMO weather code group; see `weatherLabelKey`. */
			conditions: {
				clear: "晴",
				mainlyClear: "大致晴朗",
				partlyCloudy: "局部多雲",
				overcast: "陰",
				fog: "霧",
				rimeFog: "凍霧",
				drizzle: "毛毛雨",
				freezingDrizzle: "凍雨（毛毛雨）",
				rain: "雨",
				heavyRain: "大雨",
				freezingRain: "凍雨",
				showers: "陣雨",
				snow: "雪",
				heavySnow: "大雪",
				snowGrains: "雪粒",
				snowShowers: "陣雪",
				thunderstorm: "雷暴",
				thunderstormHail: "雷暴伴有冰雹",
				unknown: "未知",
			},
		},
		jira: {
			controls: {
				status: "狀態",
				assignee: "負責人",
				priority: "優先順序",
				issueType: "項目類型",
				sprint: "衝刺",
				fixVersion: "修正版本",
			},
			controlCount: (label: string, count: number) => `${label}（${count}）`,
			searchPlaceholder: "搜尋選項…",
			searchAria: (label: string) => `搜尋 ${label} 選項`,
			noOptions: "沒有選項",
			noMatchingOptions: "沒有符合的選項",
			refresh: "重新整理 Jira 工作項目",
			loading: "正在載入 Jira 工作項目…",
			error: "無法載入 Jira 工作項目",
			empty: "沒有項目符合這些篩選條件",
			disabled: "Jira 已關閉（對外連線已停用）",
			notConfigured: "請在卡片設定中設定 Jira 主機、Token 和已儲存的篩選器",
		},
		git: {
			sections: {
				status: "Git 儲存庫狀態",
				actions: "按鈕",
				changes: "變更檔案",
				log: "最近提交",
			},
			actions: {
				commitAndSync: "提交並同步",
				commit: "提交",
				push: "推送",
				pull: "拉取",
				fetch: "擷取",
				stageAll: "全部暫存",
				unstageAll: "全部取消暫存",
				discardAll: "捨棄所有變更",
				switchBranch: "切換分支",
				sourceControl: "開啟原始碼控制",
				history: "開啟歷史記錄",
			},
			refresh: "重新讀取 Git 儲存庫",
			noBranch: "無分支",
			noUpstream: "無上游分支",
			staged: "已暫存",
			unstaged: "已變更",
			conflicted: "有衝突",
			unpushed: "未推送的提交",
			clean: "所有內容都已提交",
			noChanges: "沒有任何變更",
			noCommits: "還沒有提交",
			noMessage: "（無提交訊息）",
			lastCommit: (when: string) => `最後提交於 ${when}`,
			more: (count: number) => `還有 ${count} 個檔案…`,
			openSourceControl: "開啟原始碼控制",
			openHistory: "開啟歷史記錄",
			openDiff: "開啟差異",
			stageFile: "暫存",
			unstageFile: "取消暫存",
			discardFile: "捨棄變更",
			confirmTitle: "捨棄變更？",
			confirmDiscard:
				"Git 儲存庫中所有未提交的變更都將被捨棄。此操作無法復原。",
			confirmDiscardFile: (name: string) =>
				`對「${name}」的未提交變更將被捨棄。此操作無法復原。`,
			confirmDiscardButton: "捨棄",
			unsupported: "目前版本的 Git 外掛不支援該操作",
		},
		daily: {
			createToday: "建立今天的筆記",
			openToday: "開啟今天的筆記",
			noNoteYet: "今天還沒有筆記",
		},
		periodic: {
			/** 目前週期，用於下面的句子。 */
			period: {
				day: "今天",
				week: "本週",
				month: "本月",
				quarter: "本季",
				year: "今年",
			},
			noNoteYet: (period: string) => `${period}還沒有筆記`,
			create: (period: string) => `建立${period}的筆記`,
			open: (period: string) => `開啟${period}的筆記`,
			notEnabled: (granularity: string) =>
				`請在 Periodic Notes 中開啟${granularity}筆記`,
			loading: "正在尋找該日誌的筆記\u2026",
			pickJournal: "請在此卡片的設定中選擇一個日誌",
			noSuchJournal: (journal: string) => `沒有名為「${journal}」的日誌`,
			noJournalNoteYet: (journal: string) => `${journal}還沒有目前週期的筆記`,
			createJournalNote: "建立",
			openJournalNote: (journal: string) => `開啟${journal}目前週期的筆記`,
		},
		heatmap: {
			less: "少",
			more: "多",
			unitModified: "篇已編輯",
			unitCreated: "篇已建立",
			unitNotes: "篇筆記",
			dayValue: (date: string, value: string, unit: string) => `${date}：${value} ${unit}`,
		},
		calendar: {
			previousMonth: "上個月",
			nextMonth: "下個月",
			backToToday: "回到今天",
			dayEdited: (date: string, count: number) => `${date}：編輯了 ${count} 篇筆記`,
			dayTasks: (date: string, count: number) => `${date}：${count} 個任務`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date}：${metric} ${count} 篇`,
			dayEvents: (date: string, count: number) => `${date}：${count} 個活動`,
			agendaNoNote: "無筆記",
			allDay: "全天",
			untitledEvent: "（無標題）",
			openDailyNote: "開啟日記",
			createDailyNote: "建立日記",
			eventsHeading: "活動",
			eventNotes: "筆記",
			createEventNote: "建立筆記",
			openEventNote: "開啟筆記",
			taskNotesSource: "TaskNotes",
			checkboxSource: "任務",
			taskDue: "到期",
			taskTimeblock: "時間區塊",
			taskComplete: "完成",
			taskReopen: "重新開啟",
			taskEstimate: (minutes: number) =>
				minutes >= 60
					? `${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ""}`
					: `${minutes} 分`,
			openTaskLine: "在筆記中開啟",
			openTaskNote: "開啟任務",
		},
		schedule: {
			previous: "上一個",
			next: "下一個",
			today: "今天",
			views: {
				month: "月",
				week: "週",
				day: "日",
				list: "清單",
			},
			more: (count: number) => `+${count} 項`,
			listEmpty: (days: number) => `未來 ${days} 天沒有任何安排`,
		},
		stats: {
			notes: "筆記",
			attachments: "附件",
			folders: "資料夾",
			tags: "標籤",
			dayStreak: "連續天數",
			daysUsing: "使用 Obsidian 的天數",
		},
		web: {
			openInBrowser: "在瀏覽器中開啟",
			mayRefuse: "此網站可能拒絕被嵌入。",
		},
		bookmarks: {
			untitled: "未命名",
			needsSearch: "請啟用核心外掛「搜尋」以開啟已儲存的搜尋",
			needsGraph: "請啟用核心外掛「關係圖譜」以開啟已儲存的圖譜",
		},
		tasks: {
			createNewTask: "新增任務",
			toDo: "待辦",
			done: "已完成",
			statusInProgress: "進行中",
			noStatus: "無狀態",
			hideColumn: (label: string) => `隱藏「${label}」欄`,
			markOccurrence: "將今天這次標記為已完成",
			recurring: "重複",
			addCard: "新增卡片",
			addCardPlaceholder: "卡片文字…",
			createAsNote: "建立為筆記",
			noteBody: "筆記內文",
			convertToNote: "轉換為筆記",
			editMetadata: "編輯日期與優先順序",
			deleteCard: "刪除卡片",
			openNote: "開啟筆記",
			deleteTask: "刪除任務",
			deleteTaskConfirm: "要刪除此任務嗎？這會將它從筆記中移除。",
			noMetadata: "未設定日期或優先順序。",
			save: "儲存",
			cancel: "取消",
			setDoneColumn: (label: string) => `把「${label}」標記為完成欄`,
			unsetDoneColumn: (label: string) => `不再讓「${label}」自動完成卡片`,
			dueDate: "到期日",
			startDate: "開始日期",
			scheduledDate: "預定日期",
			doneDate: "完成日期",
			recurrenceLabel: "重複",
			recurrenceNever: "從不",
			recurrenceEvery: "間隔",
			recurrenceInterval: "重複間隔",
			recurrenceUnits: {
				day: "每天",
				week: "每週",
				month: "每月",
				year: "每年",
			},
			taskCount: (n: number) => `${n} 個任務`,
			description: "描述",
			descriptionPlaceholder: "每行一個要點——支援 **粗體**、[[連結]] 和 #標籤",
			descHelp: {
				summary: "這裡支援哪些格式？",
				intro: "每一行都會成為任務下的一個要點；空行會被捨棄。行內格式會保留，需要獨立區塊的內容則不會。",
				works: "支援",
				fails: "不支援",
				worksItems: [
					["**粗體**", "粗體"],
					["*斜體*", "斜體"],
					["~~刪除~~", "刪除線"],
					["==醒目提示==", "醒目提示"],
					["`程式碼`", "行內程式碼"],
					["[[筆記]]", "筆記連結"],
					["[網站](https://example.com)", "網頁連結"],
					["#標籤", "標籤"],
				],
				failsItems: [
					["# 標題", "標題"],
					["- [ ] 步驟", "核取方塊——會變成子任務"],
					["> 引用", "引用"],
					["```", "程式碼區塊"],
					["| a | b |", "表格"],
					["![[圖片.png]]", "嵌入和圖片"],
					["  縮排", "縮排——所有行會被攤平"],
				],
				issues: {
					heading: "標題不會保留——會顯示為以 # 開頭的文字。",
					checkbox: "核取方塊會讓這一行變成子任務，而不是描述的一部分。",
					quote: "引用不會保留——會顯示為以 > 開頭的文字。",
					codeblock: "程式碼區塊不會保留——每一行都會變成單獨的要點。",
					table: "表格不會保留——每一行都會變成單獨的要點。",
					rule: "分隔線會顯示為普通的短橫線。",
					embed: "嵌入會顯示為連結文字，而不是圖片或筆記。",
					indent: "縮排會被移除——所有行都在同一層級。",
				},
				issueLine: (line: number, message: string) => `第 ${line} 行：${message}`,
				moreIssues: (n: number) => `…還有 ${n} 處`,
			},
			createNote: "建立筆記",
			createNoteSaveFirst: "請先儲存變更——建立筆記會依據檔案重寫任務。",
			createNoteDefaultFolder: "預設資料夾",
			createNoteTooltip: (folder: string) => `將此任務在 ${folder} 中建立為筆記並在此連結`,
			createNoteTooltipTemplate: (folder: string, template: string) =>
				`基於 ${template} 將此任務在 ${folder} 中建立為筆記並在此連結`,
			matrix: {
				do: "立即做",
				schedule: "排程",
				delegate: "委派",
				eliminate: "刪除",
				urgent: "緊急",
				notUrgent: "不緊急",
				important: "重要",
				notImportant: "不重要",
				unsorted: "未分類",
				unsortedHint: "沒有象限包含其優先順序——拖曳到矩陣中即可",
				empty: "將任務拖曳到這裡",
				moveTo: (quadrant: string) => `移動到${quadrant}`,
				renameHint: "按兩下重新命名",
			},
			tags: "標籤",
			tagsPlaceholder: "#工作 #家庭/雜事",
			renameColumnHint: "按兩下以重新命名",
			editTitle: "編輯標題",
			editTitleHint: "按兩下以編輯",
			titlePlaceholder: "卡片標題…",
			priority: "優先順序",
			priorityNone: "無優先順序",
			priorityHighest: "最高優先順序",
			priorityHigh: "高優先順序",
			priorityMedium: "中優先順序",
			priorityLow: "低優先順序",
			priorityLowest: "最低優先順序",
			sort: "排序",
			sortReverse: "反轉順序",
			sortLabels: {
				smart: "智慧",
				due: "到期日",
				priority: "優先順序",
				created: "建立日期",
				alpha: "依字母",
			},
			sortCustom: "自訂",
			sortCustomOption: "自訂排序…",
			sortTitle: "自訂排序",
			sortHint:
				"依這些規則依序排序——第一條為主要排序，之後每一條用於打破平手。",
			sortFields: {
				due: "到期日",
				scheduled: "預定日期",
				priority: "優先順序",
				created: "建立日期",
				alpha: "依字母",
				status: "狀態",
			},
			sortAscending: "遞增",
			sortDescending: "遞減",
			sortLevelFirst: "排序依據",
			sortLevelNext: "然後依據",
			sortAddRule: "新增規則",
			sortRemoveRule: "移除規則",
			sortMoveUp: "上移",
			sortMoveDown: "下移",
			sortEmpty: "還沒有規則——請新增一條，否則將使用預設的智慧排序。",
			filter: "篩選",
			filterTitle: "篩選任務",
			filterPresets: {
				overdue: "已逾期",
				today: "今天",
				week: "本週",
				highPriority: "高優先順序",
				noDate: "無日期",
			},
			filterDue: "日期",
			filterDueDesc: "比對任務的到期日或預定日期。",
			filterDueAny: "任意",
			filterDueHasDate: "有日期",
			filterPriority: "優先順序",
			filterPriorityLevels: {
				high: "高",
				medium: "中",
				low: "低",
				none: "無",
			},
			filterStatus: "狀態",
			filterContexts: "情境",
			filterProjects: "專案",
			filterTags: "標籤",
			filterText: "文字包含",
			filterTextPlaceholder: "搜尋任務文字…",
			filterApply: "套用",
			filterClear: "清除",
			valueChange: "變更值",
			dateTitle: "設定日期",
			dateOn: "日期",
			dateToday: "今天",
			dateTomorrow: "明天",
			dateNextWeek: "下週",
			dateClear: "清除日期",
			valueCustom: "其他值…",
			valueCustomTitle: "設定值",
			valueClear: "清除值",
		},
	},

	// ---- Relative dates (tasks card) -----------------------------------
	dates: {
		today: "今天",
		tomorrow: "明天",
		yesterday: "昨天",
		daysAgo: (n: number) => `${n} 天前`,
		nextWeekday: (weekday: string) => `下${weekday}`,
		lastWeekday: (weekday: string) => `上${weekday}`,
	},

	// ---- Recurrence rule labels (tasks card) ---------------------------
	recurrence: {
		repeats: "重複",
		units: {
			day: "天",
			week: "週",
			month: "個月",
			year: "年",
		},
		everyOne: (unit: string) => `每${unit}重複`,
		everyMany: (count: number, unit: string) => `每 ${count} ${unit}重複`,
	},

	// ---- Clock greetings -----------------------------------------------
	clock: {
		greetingMorning: "早安",
		greetingAfternoon: "午安",
		greetingEvening: "晚安",
		// One array per time-of-day bucket (see greetingBucket in cards.ts):
		// late night, early morning, morning, afternoon, evening, late evening.
		playfulGreetings: [
			[
				"深夜加班？",
				"還在挑燈夜戰嗎？",
				"看來這裡也是個不夜城呢？",
				"你現在應該睡著了才對吧。",
			],
			[
				"這麼早就開始工作了？",
				"跟太陽一起起床啦？",
				"先來喝杯咖啡再說吧？",
				"這個時間醒著，佩服。",
			],
			[
				"早呀，來假裝我們很有生產力吧。",
				"這些筆記想你啦。",
				"回來繼續奮鬥囉。",
				"新的一天，新的儲存庫來了。",
			],
			[
				"下午的例行苦工。",
				"還在忙嗎？",
				"剛吃飽就在追求生產力，真有野心。",
				"進度大概完成一半，應該啦。",
			],
			[
				"怎麼又見面了？",
				"晚安。要準備收尾，還是準備開始呢？",
				"那麼，再新增一篇筆記嗎？",
				"固夜已深，但你未眠。",
			],
			[
				"又熬夜了嗎？",
				"今天結束了，點子還在湧現。",
				"你不是該休息了嗎？",
				"蠟燭兩頭燒，別累壞了。",
			],
		] as string[][],
	},

	// ---- Card templates (Add card menu) --------------------------------
	templates: {
		music: "音樂",
		"music-stereo": "音樂（Stereo）",
		note: "嵌入筆記",
		image: "嵌入圖片",
		slideshow: "投影片",
		base: "嵌入 base",
		excalidraw: "Excalidraw 繪圖",
		canvas: "嵌入白板",
		daily: "日記（今天）",
		periodic: "週期筆記",
		journal: "日誌筆記",
		web: "網頁（iframe）",
		bookmarks: "書籤",
		favorites: "我的最愛",
		recent: "最近檔案",
		folder: "資料夾",
		links: "連結／啟動台",
		templater: "從範本新增筆記",
		clock: "時鐘與問候",
		tasks: "任務",
		calendar: "迷你行事曆",
		schedule: "行事曆",
		stats: "Obsidian 儲存庫統計",
		search: "查詢",
		searchbar: "搜尋列",
		heatmap: "活躍度熱度圖",
		text: "文字／便箋",
		calculator: "計算機",
		dataview: "Dataview 查詢",
		datacore: "Datacore 查詢",
		rss: "RSS 訂閱",
		jira: "Jira 篩選器",
		weather: "天氣",
		market: "行情",
		tension: "全球緊張局勢",
		git: "Git",
		"operon-tasks": "Operon 任務",
		"operon-board": "Operon 看板",
		"operon-agenda": "Operon 行程",
		"operon-timer": "Operon 計時器",
		leaf: "外掛檢視（測試版）",
		pet: "寵物",
		"vault-pet": "Vault Pet",
		"vault-pet-house": "Vault Pet 小屋",
	},

	/** One line per template, shown under its name in the add-card picker and
	 * searched alongside it. Say what the card *shows* — the name already says
	 * what it is called. */
	templateDescriptions: {
		music: "播放 Obsidian 儲存庫中某個資料夾裡的音訊，並把佇列顯示在卡片上",
		"music-stereo": "控制 Stereo 外掛 Navidrome 播放器的遙控卡片",
		note: "任意筆記，在儀表板上即時轉譯",
		image: "Obsidian 儲存庫中的一張圖片，鋪滿整張卡片",
		slideshow: "來自清單或資料夾的圖片，依計時器輪播",
		base: "一個 .base 檔案，由 Obsidian 的 Bases 轉譯",
		excalidraw: "一幅 Excalidraw 繪圖，支援原生平移與縮放",
		canvas: "一塊可以直接平移的白板",
		daily: "始終是今天的筆記，首次點擊時建立",
		periodic: "來自 Periodic Notes 的本週、本月或今年筆記",
		journal: "來自 Journals 外掛的某個日誌的目前筆記",
		web: "iframe 中的網頁，依計時器重新整理",
		bookmarks: "您的 Obsidian 書籤，一鍵可達",
		favorites: "您在 Hearth 中加上星號的筆記",
		recent: "您最近開啟的檔案",
		folder: "資料夾下一層的內容，並可繼續展開瀏覽",
		links: "連結、筆記、命令與資料夾的啟動台",
		templater: "從 Templater 範本在您指定的資料夾中建立筆記的按鈕",
		clock: "時間、日期與一句問候",
		tasks: "來自 Obsidian 儲存庫的核取方塊，以清單或看板呈現",
		calendar: "一個月一目瞭然，並顯示您的筆記",
		schedule: "月、週、日和清單檢視，並顯示您的活動",
		stats: "Obsidian 儲存庫的筆記數、字數和檔案數",
		search: "一條保持即時的已儲存查詢",
		searchbar: "儀表板上的搜尋框，帶框或無框",
		heatmap: "一整年的 Obsidian 儲存庫活躍度，逐日呈現",
		text: "常駐儀表板上的草稿本",
		calculator: "計算、單位換算與匯率",
		dataview: "一條 DQL 或 DataviewJS 查詢，由 Dataview 轉譯",
		datacore: "一條 Datacore 查詢或指令碼",
		rss: "您關注的訂閱源的頭條",
		jira: "來自 Jira 篩選器或 JQL 搜尋的工作項目",
		weather: "您所選地點的天氣預報",
		market: "股票、基金、外匯與加密貨幣即時行情",
		tension: "Kagi News 用 AI 解讀的全球緊張局勢",
		git: "Git 儲存庫狀態，並可提交、拉取和推送",
		"operon-tasks": "您的 Operon 任務，依您的喜好篩選",
		"operon-board": "把 Operon 的流程狀態作為看板欄",
		"operon-agenda": "接下來幾天的 Operon 工作，逐日呈現",
		"operon-timer": "Operon 正在執行的時間追蹤，即時跳動",
		leaf: "在卡片中承載另一個外掛的側邊面板",
		pet: "住在您儀表板上的小夥伴",
		"vault-pet": "Vault Pet 外掛的寵物，隨著您的寫作成長",
		"vault-pet-house": "Vault Pet 的小屋——任務、圖鑑、徽章與統計",
	},

	// ---- Add-card picker -----------------------------------------------
	cardPicker: {
		title: "新增卡片",
		searchPlaceholder: "搜尋卡片…",
		allCards: "所有卡片",
		noMatches: "沒有符合的卡片。",
		/** Badge on a card whose plugin (or other dependency) is missing. */
		requires: (name: string) => `需要 ${name}`,
		missingNotice: (name: string) =>
			`${name} 不可用——在它可用之前，卡片會顯示一則提示。`,
		installLink: (name: string) => `安裝 ${name}`,
		categories: {
			notes: "筆記與檔案",
			planning: "規劃",
			vault: "儲存庫資訊",
			tools: "工具",
			integrations: "整合",
			fun: "趣味",
		},
		request: {
			railLabel: "申請一種卡片",
			heading: "申請一種卡片",
			intro:
				"缺了什麼？請描述您希望 Hearth 擁有的卡片——它應該顯示什麼，" +
				"資料又從哪裡來。",
			footPrompt: "沒找到您想要的？",
			footLink: "申請一種卡片",
			githubTitle: "提交 GitHub issue",
			githubDesc:
				"公開、可搜尋，也是討論這個想法的最佳場所。需要 GitHub 帳號。",
			githubAction: "開啟 GitHub",
			emailTitle: "寄送電子郵件",
			emailDesc: "如果您不想用 GitHub，可以直接寄給維護者。會開啟您的郵件應用程式。",
			emailAction: "開啟電子郵件",
			prefilledNote:
				"兩種方式都會預先填入幾個提示問題以及您的 Hearth 和 Obsidian 版本——送出前可任意修改。",
		},
	},

	// ---- File-type filter labels ---------------------------------------
	fileTypes: {
		folders: "資料夾",
		markdown: "筆記",
		excalidraw: "Excalidraw",
		canvas: "白板",
		bases: "Bases",
		images: "圖片",
		videos: "影片",
		audio: "音訊",
		pdf: "PDF",
		documents: "文件",
		spreadsheets: "試算表",
		presentations: "簡報",
		threeD: "3D",
		other: "其他",
	},

	// ---- Export / import (portable packages) ----------------------------------------
	portable: {
		exportModal: {
			title: "分享儀表板",
			saveFile: "儲存為檔案",
			publishRemovesTitle: "離開這個 Obsidian 儲存庫之前會被移除",
			publishRemovesTune: "下方的詳細資料會依同樣的分組列出具體的值，也可以在那裡調整移除的範圍。",
			publishRemoves: [
				"筆記與資料夾路徑——儀表板在你的 Obsidian 儲存庫中指向的一切",
				"行事曆訂閱、內部網路主機、你的所在地，以及持倉",
				"你在儀表板上寫的文字——文字卡片的內容、計算機最後一次的算式",
				"憑證——Jira token，以及卡片可能儲存的其他憑證",
			],
			publishKeeps:
				"會保留的是儀表板本身：版面配置、樣式、配色、圖片、卡片設定、搜尋與查詢，以及它展示的公開頁面或訂閱源。展開下方的詳細資料可以看到具體的值，也可以調整移除的範圍。",
			intro: "將這一個儀表板儲存為檔案。它的外觀會一併帶走，因此在其他 Obsidian 儲存庫中也會呈現相同的樣子。",
			name: "名稱",
			nameDesc: "檔案中該儀表板的名稱。預設使用儀表板本身的名稱。",
			description: "描述",
			descriptionDesc: "選填。用一兩句話說明這個儀表板的用途。",
			snapshot: "這個儀表板的截圖",
			snapshotDesc:
				"擷取儀表板目前的樣子——會捲動擷取，長的儀表板也能完整拍下。卡片內部的內容會先被塗掉；標題列、工具列和每張卡片自己的標題會保留，像時鐘這樣完全不含你的資訊的卡片也會原樣保留。",
			snapshotCheck: "發布前請先看一眼。圖裡你能讀到的東西，所有人都能讀到——點擊可查看大圖。",
			snapshotTake: "截圖",
			snapshotRetake: "重新截圖",
			snapshotWorking: "正在截圖……",
			snapshotEnlarge: "查看大圖",
			snapshotTaken: (kb: number) => `${kb} KB——這就是將要發布的圖片，也是所有瀏覽圖庫的人看到的樣子。`,
			snapshotConfirm: "我看過了——圖裡沒有我的隱私內容",
			snapshotConfirmDesc:
				"點擊圖片查看大圖，逐處讀一遍。卡片標題、標題列，以及卡片中本就不屬於你的內容可以保留；筆記內文、任務、檔名、行程、和你生活有關的數字則不應出現。確認之後才能發布。",
			snapshotConfirmRequired: "請先看過圖片，再開啟「我看過了」。",
			snapshotLeak:
				"如果圖裡能讀到你的內容，請不要發布這個儀表板：別人一旦安裝，這張圖就再也收不回來了。也請告訴我們——這是塗抹功能的缺陷，最好在它落到別人身上之前修好。",
			snapshotLeakReport: "前往 GitHub 回報",
			snapshotFailed: "Hearth 無法擷取儀表板圖片。",
			snapshotRequired: "圖庫項目需要一張儀表板截圖。請先截圖——發布前你可以先檢查它。",
			snapshotUnavailable:
				"發布需要一張儀表板截圖，而目前版本無法截圖——截圖需要桌面版應用程式。你仍然可以把儀表板儲存為檔案，再從桌面版的 Obsidian 儲存庫發布。",
			snapshotNotActive:
				"發布需要一張儀表板截圖，而 Hearth 只能拍攝目前開啟的儀表板。請先切換到這個儀表板，再發布它。",
			theme: "建議搭配我的主題",
			themeDesc: (name: string) =>
				`標明這個儀表板適合在 ${name}（你正在使用的主題）下檢視。這只是給安裝者的提示——不會在對方那邊安裝或變更任何東西。`,
			themeNone:
				"你正在使用 Obsidian 的預設外觀，因此沒有可建議的主題。如果這個儀表板是為某個社群主題設計的，請先切換過去。",
			tags: "標籤",
			tagsDesc: "選填，用逗號分隔。若儀表板會被公開瀏覽，標籤會很有用。",
			tagsPlaceholder: "寫作, 極簡, 深色",

			// ---- Identity ----
			identity: "發布身分",
			identityDesc:
				"由一把始終留在本 Obsidian 儲存庫中的金鑰產生。你發布的所有內容都使用同一個代號，" +
				"它不會透露你是誰；而且每個檔案都用該金鑰簽章，因此別人無法冒用。" +
				"複製金鑰即可把這個代號帶到另一處安裝。",
			identityNew:
				"你還沒有代號。它由一把永不離開本 Obsidian 儲存庫的金鑰產生，完全匿名——不需要帳號、電子郵件，也不涉及你的任何身分資訊。",
			identityCreate: "產生我的代號",
			identityCreated: (handle: string) =>
				`你的發布身分是 ${handle}。請複製復原金鑰並妥善保存——這是找回這個代號的唯一方式。`,
			identityCopy: "複製我的復原金鑰",
			identityUnsaved:
				"請在需要之前就把復原金鑰儲存到安全的地方。它只存在於本 Obsidian 儲存庫中，一旦遺失就無法重設、也無處可問——" +
				"這個代號以及你以它發布的一切都會隨之消失。",
			identityCopied: "復原金鑰已複製。請妥善保存——這是找回該代號的唯一方式。",
			identityCopyFailed: (key: string) => `你的復原金鑰：${key}`,
			identityRestore: "使用來自其他安裝的金鑰",
			identityReplaceTitle: "要取代你的代號嗎？",
			identityReplaceWarning:
				"你還沒有複製目前的復原金鑰，而貼上另一把金鑰覆蓋它的操作無法復原——本 Obsidian 儲存庫是唯一的保存處。你已用目前代號發布的內容會繼續存在，但你將再也無法以它的身分發布。如果之後可能還需要，請先複製金鑰。",
			identityReplaceConfirm: "取代",
			identityRestoreLabel: "復原金鑰",
			identityRestored: (name: string) => `現在你的發布身分是 ${name}。`,
			identityRestoreFailed: "這不是一把 Hearth 復原金鑰。",

			// ---- What travels ----
			contents: "包含哪些內容",
			embedAssets: "包含桌布與圖片",
			embedAssetsDesc:
				"把儀表板的背景圖片、圖片圖示以及投影片中明確指定的圖片一起放進檔案，這樣在從未見過這些檔案的 Obsidian 儲存庫中也能正確顯示。檔案會變大。若只是備份自己的 Obsidian 儲存庫，可以關閉——圖片本來就在那裡。",
			referenceNote: (paths: number, feeds: number) => {
				const parts: string[] = [];
				if (paths > 0) parts.push(`${paths} 個儲存庫路徑`);
				if (feeds > 0) parts.push(`${feeds} 個行事曆訂閱網址`);
				return `依目前設定，該檔案將包含 ${parts.join(" 和 ")}。這正是它能作為你自己備份的原因——若要公開分享，開啟上面的開關即可移除它們。`;
			},
			stripPrivate: "不包含我的私人資訊",
			stripPrivateDesc:
				"移除這個儀表板中關於你、而非關於設計的部分：它指向的筆記與資料夾路徑、行事曆訂閱連結、你的位置，以及你在文字卡片上寫下的內容。儀表板的外觀完全不變——只是這些卡片抵達時不指向任何東西，而下載的人本來也要自己填。若是備份自己的儀表板，請保持關閉：它需要這些路徑才能繼續運作。",

			// ---- The details disclosure ----
			detailsSummary: "查看並調整具體帶走哪些內容",
			flatten: "把本 Obsidian 儲存庫的外觀設定寫入該儀表板",
			flattenDesc:
				"儀表板外觀的大部分——網格、間距、卡片表面、背景、標題——都是整個 Obsidian 儲存庫的設定，儀表板只儲存自己覆寫的部分。開啟後會把解析出的實際數值寫入儀表板本身，使它在別人的 Obsidian 儲存庫中保持同樣的樣子，而不是套用對方的設定。關閉後，儀表板只帶走自己的覆寫項，並適應它所落地的地方。",
			stripIntro: "下列每一組都會從檔案中移除。每組下面列出的就是將被移除的實際內容，直接讀取自這個儀表板。",
			carriedIntro:
				"目前沒有移除任何內容，以下是檔案中所有指向外部的資訊。開啟上面的「不包含我的私人資訊」即可移除前三組。",
			carriedNothing: "這個儀表板沒有指向任何外部內容。",
			groups: {
				paths: "移除筆記與資料夾路徑",
				private: "移除行事曆訂閱、內部主機、你的位置與持倉",
				content: "移除你在儀表板上寫下的文字",
				queries: "移除搜尋與 Dataview 查詢",
				plugins: "移除命令 ID 與檢視類型",
			},
			groupPinned: "發布時始終會移除。",
			groupDesc: {
				paths: "該儀表板在你的 Obsidian 儲存庫中指向的一切，以及每張內嵌圖片的來源資料夾。若上面的桌布開關是開啟的，圖片本身仍會隨檔案一起帶走——被移除的只是它們所在的資料夾。",
				private: "ICS 行事曆連結（拿到連結的人即可讀取該行事曆）、內部 Jira 主機、天氣卡片設定的地點，以及投資組合中的股數和成本價。",
				content: "文字卡片的內文與計算機最後一次輸入——你隨手寫在自己儀表板上的內容。",
				queries: "預設關閉：沒有查詢的儀表板將無事可做。若查詢中出現私密資料夾名稱，值得開啟。",
				plugins: "預設關閉：它們指向外掛而非你本人。移除後，執行它們的按鈕將不起作用。",
			},
			groupEmpty: "該儀表板中沒有這類內容。",
			stripTotal: (n: number) =>
				n === 0 ? "該儀表板不會移除任何內容。" : `將移除 ${n} 項內容。`,
			stripResidual: (n: number) =>
				`已匯出，但仍有 ${n} 項內容看起來像 Obsidian 儲存庫路徑。分享之前值得開啟檔案確認一下。`,

			signFailed: "已匯出，但未能簽章，因此匯入時不會顯示作者。你的復原金鑰可能已損毀——請嘗試重新貼上。",
			exportButton: "匯出",
			assetsSkipped: (paths: string) =>
				`已匯出，但以下圖片未包含（過大，或已不在 Obsidian 儲存庫中）：${paths}`,
		},
		importModal: {
			title: "匯入",
			kinds: {
				dashboard: "一個儀表板",
				layout: "一份儀表板版面配置",
				settings: "一份完整設定備份",
			},
			by: (author: string) => `作者：${author}`,
			signatureInvalid:
				"該檔案聲明了作者，但簽章驗證不通過——可能是簽章之後被修改過，" +
				"也可能是有人把別人的代號放在了上面。因此它以「無作者」顯示。匯入的其他部分不受影響。",
			madeWith: (version: string) => `Hearth ${version}`,
			cardCount: (n: number) => `${n} 種卡片`,
			assetCount: (n: number) => `隨附 ${n} 張圖片`,
			pathCount: (n: number) => `指向 ${n} 個 Obsidian 儲存庫內路徑`,
			needsPlugins: (plugins: string) => `需要這些外掛：${plugins}`,
			mode: "如何匯入",
			modeDesc: "選擇「新增」不會變更你自己的任何設定。",
			modeAdd: "作為新儀表板新增",
			modeAddBoards: "把它的儀表板新增到我的 Obsidian 儲存庫",
			modeReplaceBoard: (name: string) => `直接更新「${name}」`,
			modeReplaceAll: "取代我的全部設定",
			replaceAllWarning: "這會用檔案中的內容取代你的儀表板和每一項 Hearth 設定，且無法復原。",
			heads: "需要留意",
			missingPlugins: (plugins: string) =>
				`此處未安裝或未啟用：${plugins}。在啟用之前，這些卡片會是空的。`,
			missingPaths: (n: number, sample: string) =>
				`該儀表板指向的 ${n} 個筆記或資料夾不在你的 Obsidian 儲存庫中（${sample}${n > 3 ? "，…" : ""}）。`,
			remoteContent: (n: number) => `開啟時它會從網際網路載入 ${n} 項內容。`,
			missingFine: "這些都不會阻止匯入——卡片會照常匯入，你可以把它們指向自己的筆記。",
			importButton: "匯入",
			addedOne: (name: string) => `已新增「${name}」。`,
			addedMany: (n: number) => `已新增 ${n} 個儀表板。`,
			replacedOne: (name: string) => `已更新「${name}」。`,
			restored: "設定已復原。",
			assetsWritten: (n: number) => `已將 ${n} 張圖片儲存到你的 Obsidian 儲存庫中。`,
			warnMissingPaths: (n: number) => `有 ${n} 個參照路徑在此處找不到。`,
			warnMissingPlugins: (n: number) => `它需要的 ${n} 個外掛未啟用。`,
			warnTaskFields:
				"它的任務卡片使用了自訂欄位——請在「設定 → 整合」中開啟任務欄位自訂才能看到。",
			warnUnknownCards: "部分卡片需要較新版本的 Hearth，已被略過。",
			warnAssets: "檔案中缺少它的部分圖片。",
		},
	},

	// ---- Dashboard gallery ------------------------------------------------------
	gallery: {
		categories: {
			productivity: "高效執行",
			planning: "規劃與行事曆",
			study: "學習與研究",
			writing: "寫作與日誌",
			work: "工作與專案",
			personal: "個人與生活",
			minimal: "極簡",
			dense: "資訊密集",
			other: "其他",
		},
		sorts: {
			trending: "熱門",
			top: "評分最高",
			new: "最新",
			downloads: "安裝最多",
		},
		browse: {
			title: "儀表板圖庫",
			openLabel: "圖庫",
			openAria: "瀏覽儀表板圖庫",
			searchPlaceholder: "搜尋儀表板……",
			all: "全部儀表板",
			mine: "我發布的",
			scopeLabel: "分類",
			sortLabel: "排序方式",
			refresh: "重新整理",
			publish: "發布儀表板",
			loading: "載入中……",
			empty: "這裡還什麼都沒有。",
			emptySearch: (query: string) => `沒有與「${query}」相符的內容。`,
			emptyMine: "你還沒有發布過任何內容。發布一個儀表板後就會出現在這裡。",
			results: (shown: number, total: number) =>
				total > shown ? `${shown} / ${total}` : `${shown} 個儀表板`,
			more: "顯示更多",
			byAuthor: (handle: string) => `作者 ${handle}`,
			anonymous: "無法確認作者",
			downloads: (n: number) => `${n} 次安裝`,
			score: (n: number) => `${n > 0 ? "+" : ""}${n}`,
			cardCount: (n: number) => `${n} 張卡片`,
			pluginBoard: "承載外掛檢視",
			noPicture: "沒有圖片",
			needsIdentity:
				"瀏覽和安裝無需代號，但投票和發布需要。Hearth 會用一把永不離開本 Obsidian 儲存庫的金鑰為你產生一個匿名代號。",
			needsIdentityVote:
				"投票需要一個代號。Hearth 會用一把永不離開本 Obsidian 儲存庫的金鑰為你產生匿名代號——不需要帳號，也不涉及你的任何身分資訊。現在就產生嗎？",
		},
		detail: {
			install: "安裝",
			installing: "下載中……",
			installAria: (name: string) => `安裝 ${name}`,
			enlarge: "查看大圖",
			profile: (handle: string) => `查看 ${handle} 的全部作品`,
			upvoteAria: "贊成",
			downvoteAria: "反對",
			published: (when: string) => `發布於 ${when}`,
			updated: (when: string) => `更新於 ${when}`,
			version: (v: string) => `作者版本 ${v}`,
			theme: (name: string) => `建議搭配 ${name} 主題`,
			madeWith: (v: string) => `使用 Hearth ${v} 製作`,
			contents: "這個儀表板上有什麼",
			requires: "它需要什麼",
			requiresPlugins: "外掛",
			requiresViews: "承載的檢視",
			requiresSettings: "設定",
			nothingRequired: "除 Hearth 本身外無需其他。",
			size: (kb: number) => `${kb} KB`,
			remote: (n: number) => `這個儀表板上有 ${n} 處內容來自網際網路。`,
			noRemote: "這個儀表板不會從網際網路載入任何內容。",
			unverified: "這個儀表板沒有可驗證的簽章，無法確認由誰製作。",
			tags: "標籤",
		},
		profile: {
			title: (handle: string) => handle,
			subtitle:
				"一個由簽章金鑰推導出的匿名代號。它不會透露任何人的身分，只說明這些作品出自同一雙手。",
			karma: "Karma",
			karmaHint: "他們發布的所有內容收到的全部讚減去全部踩。",
			totalDownloads: "安裝數",
			published: (n: number) => `${n} 個儀表板`,
			firstSeen: (when: string) => `首次發布於 ${when}`,
			empty: "這個代號下沒有發布過內容。",
		},
		comments: {
			heading: (n: number) => `${n} 則留言`,
			headingEmpty: "留言",
			none: "還沒有留言。來說第一句吧。",
			placeholder: "提個問題，或說說你的使用心得……",
			post: "發布",
			remove: "刪除這則留言",
		},
		publish: {
			title: "發布到圖庫",
			intro: "把這個儀表板放進圖庫，任何使用這個 Hearth 圖庫的人都能找到並安裝它。",
			category: "分類",
			categoryDesc: "這個儀表板是做什麼用的。別人靠它找到你。",
			button: "發布",
			publishing: "發布中……",
			warning:
				"這個儀表板將會公開：任何使用這個圖庫的人都能找到並安裝它。你隨時可以撤下它，不過已經安裝的人仍然保留自己的副本。",
			needsName: "發布前請先給儀表板取個名字。",
			residual: (n: number) =>
				`已暫緩：移除後仍有 ${n} 處值看起來像你 Obsidian 儲存庫中的路徑。發布前請查看詳細資料部分。`,
			done: (name: string) => `已將「${name}」發布到圖庫。`,
			doneHeld: (name: string) =>
				`圖庫已收到「${name}」，但先暫緩列出——其中仍有內容看起來像你 Obsidian 儲存庫中的路徑。等對方查看之後才會出現在清單中。`,
			doneUpdate: (name: string) => `已更新圖庫中的「${name}」。`,
			update: "更新",
			updateChecking: "正在檢查……",
			updateDesc: "把這個儀表板重新發布一次，覆蓋目前這個項目。",
			updateMissing:
				"這個 Obsidian 儲存庫裡沒有當初用來發布它的儀表板——可能已被刪除，或者它在另一個 Obsidian 儲存庫裡。從這裡發布只會新增一個項目，所以沒有可更新的對象。",
			updateUnknown:
				"Hearth 還不知道這個項目對應你的哪個儀表板。點擊「更新」，它會讀取項目來確認。",
			unpublish: "從圖庫移除",
			unpublishConfirm: (name: string) =>
				`要把「${name}」從圖庫移除嗎？已經安裝的人仍然保留副本，但新的人再也找不到它。`,
			unpublished: "已從圖庫移除。",
		},
		settings: {
			heading: "儀表板圖庫",
			host: "圖庫位址",
			hostDesc:
				"Hearth 瀏覽與發布儀表板的圖庫。開啟圖庫之前不會擷取任何內容，發布之前也不會傳送任何內容。清空此項即可徹底關閉圖庫，並且會一直保持關閉。只接受 https（自行架設的圖庫也可用 localhost 上的 http）。",
			hostPlaceholder: "https://gallery.example.com",
			hostInvalid: "這不是 Hearth 會連線的位址。請使用 https，或 localhost 上的 http。",
			hostCleared: "已關閉圖庫。",
			hostSet: (host: string) => `圖庫已設為 ${host}。`,
			browse: "瀏覽圖庫",
			browseDesc: "別人發布的儀表板，以及你自己發布的。",
			browseButton: "開啟圖庫",
		},
		errors: {
			noHost: "尚未設定圖庫。請在 Hearth 設定的「儀表板圖庫」中填寫圖庫位址。",
			externalCallsOff:
				"圖庫是網際網路上的伺服器，而此 Obsidian 儲存庫啟用了「停用對外連線」。要瀏覽或發布，請先關閉該設定。",
			offline: "無法連線到圖庫。它可能已下線，或此裝置目前離線。",
			badResponse: "該位址有回應，但不像是一個 Hearth 圖庫。",
			unauthorized: "圖庫沒有接受這個 Obsidian 儲存庫的身分。",
			forbidden: "圖庫不允許這個 Obsidian 儲存庫的身分執行該操作。",
			rateLimited: "圖庫請求你放慢速度。請幾分鐘後再試。",
			tooLarge: "這個儀表板對該圖庫來說太大了。請關閉桌布，或將它縮小。",
			rejected: (why: string) => `圖庫拒絕了它：${why}`,
			notFound: "圖庫裡沒有這個內容。",
			server: "圖庫在處理該請求時發生錯誤。",
			unsigned: "Hearth 無法為檔案簽章，因此沒有發布——未簽章的儀表板無法證明作者是誰。",
		},
	},

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "這不是有效的 JSON。",
		notAnObject: "版面配置必須是一個 JSON 物件。",
		noValidDashboards: "版面配置中沒有有效的儀表板。",
		noValidCards: "版面配置中沒有有效的卡片。",
		notAHearthLayout: '這不是 Hearth 版面配置——未找到 "dashboards" 或 "cards" 陣列。',
		notHearthSettings:
			'這不是 Hearth 設定備份——未找到 "hearthSettings" 標記或版面配置。',
	},

	// ---- Cards with views（#385，src/cardviews.ts）---------------------------------
	views: {
		switcherAria: "檢視",
		switchTo: (label: string) => `切換到 ${label}`,
		chooseView: "選擇檢視",
		nextViewAria: (label: string) => `顯示下一個檢視（${label}）`,
		merged: "已合併。可在卡片設定的「檢視」中將其移出。",
		tuiHelp: "多檢視卡片的下一個或上一個檢視",
		editor: {
			tab: "檢視",
			heading: "檢視",
			headingDesc:
				"一張卡片可以包含多個檢視——每個檢視都是任意類型的卡片——並在它們之間切換。每個檢視保留自己的內容；尺寸、顏色和表面屬於卡片本身。",
			kindShown: (kind: string) => `${kind} · 正在顯示`,
			edit: "編輯此檢視的內容",
			show: "在卡片上顯示此檢視",
			moveUp: "上移",
			moveDown: "下移",
			detach: "移出為獨立卡片",
			detached: "已作為獨立卡片放到儀表板上。",
			remove: "刪除此檢視",
			removeTitle: "刪除此檢視？",
			removeMessage: (label: string) => `「${label}」及其內容將從此卡片中刪除。`,
			removeConfirm: "刪除",
			add: "新增檢視",
			addDesc: "新增一張任意類型的卡片，作為此卡片的下一個檢視。",
			addNew: "新增檢視…",
			merge: "將卡片合併到此卡片",
			mergeDesc:
				"此儀表板上已有的卡片會成為此卡片的下一個檢視，並保留其內容。整理時把一張卡片按住在另一張卡片上再放開，效果相同。",
			mergeButton: "合併",
			withViews: (name: string, count: number) => `${name}，${count} 個檢視`,
			split: "拆分為獨立卡片",
			splitDesc: "每個檢視都會作為獨立卡片回到儀表板上。",
			splitButton: "拆分",
			splitTitle: "拆分此卡片？",
			splitMessage: (count: number) => `它的 ${count} 個檢視將成為儀表板上的 ${count} 張獨立卡片。`,
			splitConfirm: "拆分",
			editing: "正在編輯的檢視",
			editingDesc: "下方設定所修改的檢視。",
			label: "切換器中的標籤",
			labelDesc: "留空時，切換器依檢視的內容或類型命名。",
			icon: "切換器中的圖示",
			iconDesc: "Lucide 圖示名稱。留空時由檢視類型決定。",
			switcher: "切換器",
			placement: "位置",
			placementDesc: "切換器所在的位置。「自動」在有標題的卡片上放在標題列，在無標題的卡片上放在右上角。",
			placements: {
				auto: "自動",
				header: "標題列中",
				"top-left": "左上角",
				"top-right": "右上角",
				"bottom-left": "左下角",
				"bottom-right": "右下角",
				hidden: "隱藏",
			},
			hiddenNote: "不繪製切換器。可透過滑動、輪播或卡片設定切換檢視。",
			style: "樣式",
			styleDesc: "選項的繪製方式。檢視較多而卡片較窄時，下拉選單更合適。",
			styles: {
				tabs: "分頁",
				dropdown: "下拉選單",
				dots: "圓點",
				icons: "圖示",
			},
			labelStyle: "分頁顯示",
			labelStyleDesc: "每個分頁顯示的內容。",
			labels: {
				label: "標籤",
				icon: "圖示",
				both: "圖示和標籤",
			},
			reveal: "顯示切換器",
			revealDesc: "角落裡的切換器可以在游標移到卡片上之前保持隱藏。",
			reveals: {
				always: "始終",
				hover: "游標停留時",
			},
			rotate: "輪播間隔（秒）",
			rotateDesc: "定時切換到下一個檢視；游標停留在卡片上或正在輸入時暫停。留空為關閉；至少 3 秒。",
			rotateOff: "關閉",
			swipe: "滑動切換",
			swipeDesc: "在觸控螢幕上，橫向滑過卡片可切換到下一個或上一個檢視。",
			remember: "記住正在顯示的檢視",
			rememberDesc: "從上次顯示的檢視開始，重新啟動後也是如此。每次切換都會被儲存，同步的 Obsidian 儲存庫會將其視為一次變更。",
			narrow: "在窄儀表板上",
			narrowDesc: "保留切換器，或將每個檢視作為獨立卡片上下排列顯示。",
			narrows: {
				switcher: "保留切換器",
				split: "每個檢視一張卡片",
			},
		},
	},

	fileMenu: {
		newNote: "新增筆記",
		newFolder: "新增資料夾",
		rename: "重新命名…",
		makeCopy: "建立副本",
		delete: "刪除",
		untitled: "未命名",
		folderName: "資料夾名稱",
		newName: "新名稱",
		exists: (name: string) => `「${name}」已存在。`,
		invalidName: "名稱不能包含 /、\\ 或 :。",
	},

	// ---- Terminal mode (src/tui/) -------------------------------------------
	tui: {
		boardLabel: "儀表板，終端機模式",
		cardMenu: "卡片選單",
		removeCard: "移除卡片",
		resize: "拖曳以調整大小",
		moveUp: "上移",
		moveDown: "下移",
		moveBoardLeft: "儀表板左移",
		moveBoardRight: "儀表板右移",
		moreBoards: (n: number) => `還有 ${n} 個儀表板——列出全部儀表板`,
		emptyBoard: "此儀表板是空的。",
		emptyBoardHint: "按 F7 或 n 新增卡片。",
		moved: (title: string) => `已移動 ${title}`,
		scroll: (first: number, total: number) => `${first}/${total}`,
		arrangeFoot: "方向鍵移動 · Shift+方向鍵調整大小 · x 移除",
		arrangeHint: "拖曳邊框可移動，拖曳角可調整大小。",
		arranging: "排列",
		arrange: "排列",
		doneArranging: "完成",
		arrangeOn: "正在排列。方向鍵移動目前卡片；F2 結束。",
		arrangeOff: "版面配置已儲存。",
		menuDetail: "開啟大檢視",
		menuZoom: "放大",
		menuRefresh: "重新整理",
		menuSettings: "卡片設定",
		menuPin: "釘選到所有儀表板",
		menuUnpin: "從所有儀表板取消釘選",
		menuDuplicate: "複製",
		menuRemove: "移除卡片",
		searchLabel: "搜尋:",
		restingHint: "Tab 切換卡片 · ↑↓ 卡內移動 · Enter 開啟 · m 選單 · F1 說明",
		cardCount: (n: number) => `${n} 張卡片`,
		refreshed: (n: number) => `已重新整理 ${n} 張卡片。`,
		noSearch: "此儀表板隱藏了搜尋列。",
		noFilter: "目前卡片沒有篩選。",
		noSort: "目前卡片沒有可排序的內容。",
		schemeSet: (name: string) => `配色：${name}`,
		schemes: {
			theme: "Obsidian 主題",
			htop: "Htop",
			hearth: "Hearth",
			amber: "琥珀",
			paper: "紙張",
		},
		quitTitle: "離開終端機模式？",
		quitMessage: "Hearth 將回到圖形設計。可在 設定 → Hearth → 外觀 中再次開啟終端機模式。",
		quitConfirm: "離開終端機模式",
		fn: {
			help: "說明",
			arrange: "排列",
			search: "搜尋",
			filter: "篩選",
			refresh: "重新整理",
			sort: "排序",
			add: "新增",
			board: "儀表板",
			scheme: "配色",
			quit: "離開",
		},
		open: "開啟",
		openNewTab: "在新分頁中開啟",
		openSplit: "在右側開啟",
		cards: {
			filesFoot: "Enter 開啟 · 右鍵開啟檔案選單",
			launchFoot: "方向鍵選擇 · Enter 執行",
			statsEmpty: "未選擇任何統計項目。請在卡片設定中選擇。",
			heatTotal: (total: string, weeks: number) => `${weeks} 週內共 ${total}`,
			heatFoot: "方向鍵移動日期 · Enter 開啟當日日記",
			heatFootNoDaily: "方向鍵移動日期",
			calcFoot: "輸入算式 · Enter 選取",
			loading: "載入中…",
			tick: "勾選",
			untick: "取消勾選",
			noteFoot: "空白鍵勾選 · Enter 開啟連結 · o 開啟筆記",
			noteFootEdit: "i 編輯 · 空白鍵勾選 · Enter 開啟連結 · o 開啟筆記",
			sectionEmpty: "此標題下暫無內容。",
			editing: "編輯中",
			editingFoot: "Esc 或 Ctrl+Enter 結束 · 輸入即儲存",
			edit: "編輯",
			notFound: (path: string) => `未找到：${path}`,
			due: "截止",
			task: "任務",
			tasksFoot: "空白鍵勾選 · Enter 開啟 · f 篩選 · s 排序 · b 看板 · m 矩陣 · + 新增",
			tasksOpen: (n: number) => `${n} 項未完成`,
			tasksNoAdd: "此卡片的來源不支援快速新增。請在筆記中新增核取方塊。",
			tasksAddTo: (column: string) => `在 ${column} 中新增卡片`,
			columnLeft: "欄左移",
			columnRight: "欄右移",
			boardNoColumns: "所有欄都已隱藏。請在卡片設定中重新顯示。",
			boardFoot: "方向鍵移動 · Shift+方向鍵移動卡片 · 空白鍵勾選 · f 篩選 · b 清單 · m 矩陣",
			boardHint: (cards: number, columns: number) => `${columns} 欄 ${cards} 張`,
			showList: "以清單顯示",
			showBoard: "以看板顯示",
			matrixFoot: "方向鍵移動 · Shift+方向鍵把任務移到象限 · 空白鍵勾選 · Enter 開啟 · m 清單",
			matrixMore: (n: number) => `+ 還有 ${n} 項`,
			showMatrix: "以矩陣顯示",
			calNothing: "暫無安排。按 Enter 開啟日記。",
			calNothingNoNotes: "暫無安排。",
			calEvents: (n: number) => `${n} 個活動`,
			calFoot: "方向鍵切換日期 · PgUp/PgDn 切換月份 · Enter 開啟 · Home 今天",
			agendaFoot: "方向鍵選擇 · Enter 開啟",
			schedFoot: "[ ] 或 PgUp/PgDn 翻頁 · v 切換檢視 · 方向鍵切換日期 · Enter 開啟 · Home 今天",
			allDayShort: "全天",
			weatherFoot: "方向鍵選擇日期 · Enter 查看逐小時預報",
			weatherCardFoot: "Enter 開啟完整預報",
			tensionFoot: "Enter 在 Kagi News 上開啟該指數",
			mkName: "名稱",
			mkSymbol: "代號",
			mkPrice: "價格",
			mkChange: "漲跌",
			mkOpen: "放大查看",
			mkListFoot: "Enter 開啟 · [ ] 切換區間 · r 重新整理",
			mkSingleFoot: "Enter 開啟 · ←/→ 切換標的 · [ ] 切換區間 · r 重新整理",
			mkDetailFoot: "[ ] 切換區間 · r 重新整理 · Backspace 返回",
			mkLookupFoot: "[ ] 切換區間 · Enter 選取",
			mkResultsFoot: "Enter 查看 · 空白鍵 新增到卡片",
			gitFoot: "Enter 開啟 · 空白鍵 暫存 · Del 捨棄 · r 重新讀取",
			rssOpen: "在瀏覽器中開啟",
			copyLink: "複製連結",
			rssFoot: "enter 開啟 · u 已讀/未讀 · A 全部已讀 · f 僅未讀 · r 重新整理",
			rssFootTabs: "enter 開啟 · ←/→ 來源 · u 已讀/未讀 · A 全部已讀 · f 僅未讀 · r 重新整理",
			jiraKey: "編號",
			jiraType: "類型",
			jiraPriority: "優先順序",
			jiraSummary: "摘要",
			jiraStatus: "狀態",
			jiraClear: "清除",
			jiraFoot: "Enter 開啟工作項目 · 方向鍵選擇篩選 · r 重新整理",
			opFlags: "^ 已置頂 · ~ 重複 · * 計時中 · # 被阻擋",
			opReload: "重新讀取",
			opListFoot: "Enter 開啟 · + 新增 · r 重新讀取",
			opReadFoot: "Enter 開啟 · r 重新讀取",
			opAgendaFoot: "Enter 開啟 · r 重新讀取",
			opBoardFoot: "方向鍵移動 · Shift+←/→ 移動任務 · + 新增 · r 重新讀取",
			folderFoot: "Enter 開啟 · 空白鍵 摺疊資料夾 · o 瀏覽",
			bookmarksFoot: "Enter 開啟 · 空白鍵 摺疊群組",
			dvNoResults: "沒有結果",
			dvError: "Dataview 無法執行此查詢",
			petFoot: "Enter 或空白鍵 撫摸它",
		},
		settings: {
			name: "終端機",
			experimental: "實驗性",
			desc: "把整個 Hearth 畫成文字：字元網格、線框卡片、一切皆有按鍵，就像終端機工具一樣。任何機器都跑得動。",
			heading: "終端機模式",
			headingDesc: "文字介面的外觀。開啟時每個儀表板都以它繪製。",
			scheme: "配色",
			schemeDesc: "Obsidian 主題從你的主題取色；其他為固定調色盤。",
			fontSize: "字型大小",
			fontSizeDesc: "終端機文字的大小（像素）。每張卡片在網格上的位置保持不變。",
			overrides: "終端機模式會覆寫什麼",
			overridesDesc:
				"不繪製桌布、毛玻璃、卡片底色和動畫；每個儀表板和卡片的經典/Expressive 選擇會暫時擱置，直到關閉終端機模式。圖片卡片或其他外掛檢視卡片保持原樣，顯示在終端機邊框中。在此期間不會產生任何效果的設定（卡片的「樣式」分頁、桌布、卡片底色、標題圖示和尺寸）會被隱藏，除非仍有外掛儀表板（終端機模式不改變它）在使用它們。",
		},
		helpTitle: "按鍵",
		help: {
			nextCard: "下一張或上一張卡片",
			moveSelection: "在目前卡片中移動",
			moveSideways: "在卡片內移動，或移到旁邊的卡片",
			open: "開啟所選項目",
			toggle: "勾選任務、摺疊資料夾、移動看板卡片",
			menu: "卡片選單（也可右鍵點擊或點擊邊框上的 ≡）",
			zoom: "將卡片放大到全尺寸",
			detail: "開啟卡片的大檢視",
			settings: "卡片設定",
			escape: "離開輸入框，或取消焦點",
			search: "搜尋儲存庫",
			boards: "切換儀表板",
			stepBoards: "上一個或下一個儀表板",
			arrange: "排列儀表板",
			add: "新增卡片",
			filter: "篩選目前卡片",
			sort: "排序目前卡片",
			refresh: "重新整理所有卡片",
			board: "儀表板設定",
			scheme: "下一個配色",
			help: "本清單",
			quit: "離開終端機模式",
			arrangeNote: "排列時，方向鍵移動目前卡片，Shift+方向鍵調整大小；也可以拖曳邊框移動，拖曳其角調整大小。",
		},
	},
};
