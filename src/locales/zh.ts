/**
 * Simplified Chinese (简体中文) locale.
 *
 * Typed against {@link Translations} (`typeof en`), so TypeScript flags any
 * missing or misspelled key at build time. Keys and function signatures match
 * `en.ts` exactly — only the values are translated. See `README.md` in this
 * folder for the walkthrough.
 */
import type { Translations } from "./index";

export const zh: Translations = {
	// ---- Commands (command palette) & ribbon ---------------------------
	commands: {
		openHome: "打开主控面板",
		newNote: "新建笔记（默认位置）",
		newDrawing: "新建 Excalidraw 绘图",
		recordVoice: "开始/停止录音",
		openDailyNote: "打开今天的日记",
		runSetup: "设置 Hearth（首次运行向导）",
		switchDashboard: (n: number) => `切换到面板 ${n}`,
		nextDashboard: "下一个面板",
		previousDashboard: "上一个面板",
	},
	ribbon: {
		openHome: "打开 Hearth 主页",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth：无法新建笔记。",
		operonTaskMissing: "Hearth：该 Operon 任务的笔记已不在仓库中。",
		operonRechecked: "Hearth：已重新检查 Operon 连接。",
		operonWriteFailed: (reason: string) => `Hearth：Operon 拒绝了此更改 — ${reason}`,
		/** A refused create, with the Operon setting that decided the target —
		 * the error alone names a configured target without saying which one. */
		operonCreateFailed: (reason: string, where: string) =>
			`Hearth：Operon 拒绝创建该任务 — ${reason} ${where} ` +
			"请在 Operon 的设置中修改，或在此卡片设置的“新任务”下选择其他目标。",
		/** The mutation may have landed. Hearth has already spent its one legal
		 * recovery attempt, so the honest report is "unknown", not "failed" —
		 * and never an offer to retry, which could apply the change twice. */
		operonWriteUnknown: (reason: string) =>
			`Hearth：Operon 无法确认更改是否已应用（${reason}）。` +
			"卡片已重新读取 — 请先检查该任务再重试。",
		enableExcalidraw: "Hearth：请启用 Excalidraw 插件以创建绘图。",
		excalidrawCommandMissing: "Hearth：找不到 Excalidraw 的“新建绘图”命令。",
		enableAudioRecorder: "Hearth：请启用核心插件“录音机”。",
		couldNotRecordVoice: "Hearth：无法开始录音。",
		enableDailyNotes: "Hearth：请启用核心插件“日记”。",
		couldNotOpenDaily: "Hearth：无法打开今天的日记。",
		commandNotFound: (id: string) => `Hearth：找不到命令：${id}`,
		couldNotCreateNoteForDay: (day: string) => `Hearth：无法为 ${day} 创建笔记。`,
		couldNotCreateEventNote: "Hearth：无法为该事件创建笔记。",
		taskNotesCreateFailed: "Hearth：无法运行 TaskNotes：新建任务。",
		taskChangedOnDisk: "Hearth：该任务在磁盘上已更改 — 已刷新。",
		couldNotOpenTaskNote: "Hearth：无法打开该任务的笔记。",
		couldNotUpdateTaskStatus: "Hearth：无法更新任务状态。",
		couldNotCompleteRecurring: "Hearth：无法将该重复任务标记为完成。",
		couldNotUndoRecurring: "Hearth：无法撤销该重复任务的完成状态。",
		couldNotAddKanbanCard: "Hearth：无法将卡片添加到看板。",
		couldNotConvertCard: "Hearth：无法将卡片转换为笔记。",
		templaterNoTemplate: (path: string) => `Hearth：找不到模板：${path}`,
		templaterFailed: (name: string) => `Hearth：Templater 未能从 ${name} 创建笔记。`,
		templaterCreated: (path: string) => `Hearth：已创建 ${path}`,
		newNoteTemplaterMissing:
			"Hearth：“新建笔记”按钮指向一个 Templater 模板，但 Templater 未启用 — " +
			"改为创建空白笔记。",
		layoutExported: "Hearth：布局已导出。",
		layoutImported: "Hearth：布局已导入。",
		layoutImportError: (error: string) => `Hearth：${error}`,
		settingsExported: "Hearth：设置已导出。",
		settingsImported: "Hearth：设置已导入。",
		exportedToVault: (file: string) => `Hearth：已将 ${file} 保存到仓库根目录。`,
		exportFailed: "Hearth：无法保存导出文件。",
		cardCopied: "卡片已复制到面板。",
	},

	// ---- The home view -------------------------------------------------
	view: {
		displayName: "主页",
	},

	// ---- Header / search bar -------------------------------------------
	header: {
		newNote: "新建笔记",
		newNoteAria: "新建笔记",
		searchOnline: "在线搜索",
		searchOnlineAria: "用当前关键词搜索网络",
	},
	search: {
		placeholder: "搜索仓库",
		noMatches: "无匹配项",
		noMatchingCommands: "无匹配命令",
	},

	// ---- Shared confirm dialog -----------------------------------------
	confirm: {
		confirm: "确认",
		cancel: "取消",
		ok: "确定",
	},

	// ---- "What's new" release-notes dialog -----------------------------
	whatsNew: {
		title: "Hearth 更新内容",
		intro: "感谢更新！以下是您上次查看以来的变化。",
		/** Shown instead of {@link intro} when there are headlines to click. */
		introHint:
			"感谢更新！以下是您上次查看以来的变化 — 点击任意条目查看详情。",
		close: "知道了",
		footer: "完整说明请见插件的 README。",
		/** The Added / Changed / Fixed group labels. */
		kinds: {
			added: "新增",
			changed: "变更",
			fixed: "修复",
			removed: "移除",
			deprecated: "弃用",
			security: "安全",
			other: "其他",
		},
		filterPlaceholder: "筛选变更…",
		expandAll: "全部展开",
		collapseAll: "全部折叠",
		noMatches: (query: string) => `这里没有提到“${query}”。`,
		/** Tooltip on a version's compare/release link. */
		releaseNotes: (version: string) => `在 GitHub 上查看 ${version} 的发布说明`,
		/** Label for the header row that folds a release away. */
		releaseToggle: (version: string) => `显示或隐藏 ${version} 的变更内容`,
		/** Tooltip on the `#123` link beside a change. */
		issue: (n: string) => `GitHub 上的 issue #${n}`,
	},

	// ---- First-run setup wizard ----------------------------------------
	setup: {
		/** Short labels on the progress rail. */
		stepNames: {
			welcome: "欢迎",
			vault: "您的仓库",
			look: "外观",
			purpose: "用途",
			integrations: "集成",
			finish: "完成",
		},
		/** The heading at the top of each step. */
		stepTitles: {
			welcome: "欢迎使用 Hearth",
			vault: "为主屏幕命名",
			look: "选择外观",
			purpose: "您用仓库做什么？",
			integrations: "在您的仓库中找到",
			finish: "这就是您的面板",
		},
		/** The line under each heading. */
		stepDescs: {
			welcome: "回答几个问题，Hearth 就会为您搭建第一个面板。",
			vault: "面板顶部的标题与图标。",
			look:
				"这只影响正在搭建的面板 — 其他每个面板都保留自己的外观。" +
				"之后都可以在该面板自己的设置中修改。",
			purpose: "可以任选多项 — 每一项都会为面板添加卡片。",
			integrations: "Hearth 发现这些插件已安装。请开启希望它使用的项目。",
			finish:
				"目前尚未更改任何内容。以下是将要搭建的面板 — 作为一个面板创建，" +
				"不会影响仓库的全局设置。",
		},
		nav: {
			back: "上一步",
			next: "下一步",
			finish: "搭建我的面板",
			skip: "跳过设置",
		},
		welcome: {
			lead:
				"Hearth 把一个标签页变成仓库的主屏幕 — 搜索、卡片面板和启动器。" +
				"这个向导会搭建一个契合您实际工作方式的面板，让您不必从空白网格开始。",
			bullets: [
				{
					icon: "layout-dashboard",
					title: "为您量身搭建的面板",
					desc: "告诉 Hearth 您用仓库做什么，它会挑好卡片。",
				},
				{
					icon: "plug",
					title: "您的插件，已经接好线",
					desc:
						"Hearth 会查找 TaskNotes、Dataview、Git 等插件并主动连接 — " +
						"读取它们各自的设置，让卡片立刻正常工作。",
				},
				{
					icon: "palette",
					title: "由您选择的外观",
					desc: "背景、卡片样式与密度，一步设定。",
				},
			],
			detected: (names: string) => `在此仓库中找到：${names}。`,
			detectedNone:
				"暂未检测到受支持的插件 — 没关系，Hearth 独立也能用，之后再连接即可。",
		},
		vault: {
			title: "标题",
			titleDesc: "以大字显示在面板顶部。",
			showTitle: "显示标题",
			showTitleDesc: "关闭后面板将完全没有标题。",
			logo: "图标",
			logoDesc: "标题旁显示的表情或一两个字符。留空则使用 Hearth 水晶图标。",
			themeColor: "跟随主题的强调色",
			themeColorDesc: "品牌标识的哪些部分采用主题的颜色。",
			themeColorOptions: {
				none: "都不",
				icon: "图标",
				title: "标题",
				both: "两者",
			},
			showSearch: "显示搜索栏",
			showSearchDesc: "标题下方的搜索与命令输入框。",
		},
		look: {
			surfaceHeading: "卡片",
			backgroundHeading: "背景",
			color: "颜色",
			colorDesc: "面板背后的纯色。",
			weatherDesc:
				"某地的实时天空，或固定保持某种天况。请在下方选择来源。",
			layout: "背景显示的位置",
			layoutDesc:
				"铺满整个面板，或作为顶部的横幅条，下方的卡片使用主题自身的表面。",
			layoutFull: "铺满整个面板",
			layoutBanner: "顶部横幅",
			compact: "紧凑间距",
			compactDesc: "收紧间隙，让屏幕容纳更多内容。",
		},
		surfaces: {
			glass: {
				icon: "layers",
				name: "毛玻璃",
				desc: "半透明卡片，背后的背景带有柔和模糊。",
			},
			solid: {
				icon: "square",
				name: "实色",
				desc: "不透明面板。在繁杂的照片上最易阅读。",
			},
			minimal: {
				icon: "minus",
				name: "极简",
				desc: "完全没有卡片表面 — 内容直接浮在背景上。",
			},
		},
		backgrounds: {
			default: {
				icon: "image",
				name: "Hearth 壁纸",
				desc: "Hearth 自带的图片。",
			},
			weather: {
				icon: "cloud-sun",
				name: "实时天空",
				desc: "根据您所在地的天气绘制的天空 — 也可以固定一种。",
			},
			color: {
				icon: "paintbrush",
				name: "纯色",
				desc: "单一颜色，无图片。最轻量的选项。",
			},
			none: {
				icon: "ban",
				name: "无",
				desc: "保持主题自身的背景不变。",
			},
		},
		purposes: {
			daily: {
				name: "日记与随笔",
				desc: "今天的笔记居于正中，并配有可在日期间切换的日历。",
			},
			tasks: {
				name: "任务与待办",
				desc: "任务列表，读取自您的复选框或任务插件。",
			},
			planning: {
				name: "计划与日历",
				desc: "完整的月/周/日日历，包含所有已订阅的日历源。",
			},
			browsing: {
				name: "查找我的笔记",
				desc: "您最近打开过的内容，以及一排收藏。",
			},
			capture: {
				name: "快速记录与启动",
				desc: "为您经常使用的笔记和命令准备的磁贴。",
			},
			insights: {
				name: "仓库统计",
				desc: "仓库有多大，以及您有多活跃。",
			},
			reading: {
				name: "阅读与订阅",
				desc: "为您关注的网站准备的 RSS 卡片。",
			},
			ambience: {
				name: "一点生机",
				desc: "天气，以及一只住在面板上的小宠物。",
			},
		},
		purpose: {
			count: (n: number) =>
				n === 1 ? "目前共 1 张卡片。" : `目前共 ${n} 张卡片。`,
		},
		integrations: {
			lead:
				"这里每开启一项，Hearth 都会为此面板添加一张已配置好的卡片 — " +
				"不会安装或改动其他插件，也不会影响此面板之外的任何内容。",
			recommended: "推荐",
			effects: {
				tasknotes:
					"添加一张任务卡片读取您的 TaskNotes 任务，并把 TaskNotes 当前设置的" +
					"字段名和完成状态一并存入卡片本身。",
				kanban: "添加一张任务卡片，将看板显示为可拖动的列。",
				dataview: "添加一张 Dataview 卡片，并预置一条可编辑的查询。",
				datacore: "添加一张 Datacore 卡片，等待填入查询。",
				templater:
					"添加一张按钮卡片 — 每个现有模板一个按钮 — 一键即可据此创建笔记。",
				git: "添加一张 Git 卡片显示仓库状态，并带有提交与同步按钮。",
				operon:
					"添加一张 Operon 任务卡片，通过 Operon 的开发者 API 读取数据。" +
					"卡片首次加载时，需要您在 Operon 自己的设置中批准 Hearth；" +
					"在此之前，卡片会说明它在等什么。",
				bases: "添加一张卡片，嵌入仓库中的某个 base。",
				dailyNotes: "添加一张卡片显示今天的日记，可就地编辑。",
				bookmarks: "添加一张卡片列出您的书签。",
			},
			taskNotesTitle: "从您的 TaskNotes 设置读取到此卡片",
			taskNotesStatus: "状态字段",
			taskNotesDue: "到期字段",
			taskNotesPriority: "优先级字段",
			taskNotesDone: "视为已完成",
			taskNotesDoneNone: "未定义 — Hearth 将使用 “done”",
		},
		finish: {
			empty:
				"未选择任何卡片。您仍然可以完成 — 面板会是空的，之后可用面板的" +
				"“排列”按钮添加卡片。",
			target: "此面板的落点",
			targetDesc: "替换当前所在的面板，或作为一个可切换的新面板添加。",
			targetReplace: "替换我当前的面板",
			targetNew: "作为新面板添加",
			targetForcedNew:
				"这将作为新面板添加。您已有的每个面板都会原样保留 — 不会被替换或删除。",
			name: "面板名称",
			nameDesc: "显示在面板切换器中。",
			/** Seed for the new dashboard's name; numbered if already taken. */
			defaultName: "主页",
			calloutTitle: "这是起点，不是预设",
			calloutLead:
				"这个面板应当是一个扎实的起点 — 足以让您看到 Hearth 能为您做什么。",
			calloutBody:
				"但 Hearth 首先是为高度自定义而生的，而这个向导只触及了其中一小部分。" +
				"每张卡片都可以移动、缩放、改标题、换颜色、重新配置或删除，面板可以添加" +
				"和切换，设置里还有远比这里问到的更多内容。请到设置中翻一翻，随心修改 — " +
				"这正是 Hearth 的意义所在。",
			calloutHint:
				"“排列”（面板右上角）用于编辑卡片；其余内容在 设置 → Hearth 中。" +
				"您随时可以从 设置 → 关于 再次运行此向导。",
		},
		plan: {
			/** Fallback names for planned cards that carry no title of their own. */
			names: {
				clock: "时钟与问候",
				daily: "今天的笔记",
				tasks: "任务",
				schedule: "日历",
				calendar: "迷你日历",
				recent: "最近文件",
				favorites: "收藏",
				bookmarks: "书签",
				links: "链接",
				commands: "命令",
				stats: "仓库统计",
				heatmap: "活跃度",
				rss: "阅读",
				weather: "天气",
				pet: "宠物",
				dataview: "Dataview",
				datacore: "Datacore",
				git: "Git",
				base: "Base",
			},
			/** Why each card is on the board, shown beside it in the review list. */
			reasons: {
				always: "每个 Hearth 面板都以它开始",
				daily: "日记与随笔",
				dailyNotes: "已启用日记插件",
				tasks: "任务与待办",
				tasknotes: "已为 TaskNotes 配置",
				kanban: "读取您的看板",
				planning: "计划与日历",
				browsing: "查找我的笔记",
				bookmarks: "已启用书签插件",
				capture: "快速记录与启动",
				insights: "仓库统计",
				reading: "阅读与订阅",
				ambience: "一点生机",
				dataview: "已安装 Dataview",
				datacore: "已安装 Datacore",
				templater: "找到了 Templater 模板",
				git: "已安装 Git",
				operon: "Operon 的开发者 API 可用",
				bases: "在仓库中找到了一个 base",
			},
		},
		notice: {
			done: (n: number) =>
				n === 1
					? "Hearth：面板已就绪 — 添加了 1 张卡片。"
					: `Hearth：面板已就绪 — 添加了 ${n} 张卡片。`,
		},
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "选择要嵌入的文件…",
		command: "选择一个命令…",
		noteToFavorite: "选择要收藏的笔记…",
		folder: "选择一个文件夹…",
		image: "选择一张图片…",
		icon: "搜索 Lucide 图标…",
		iconPlaceholder: "Lucide 图标 id",
		iconBrowse: "浏览 Lucide 图标",
		iconClear: "清除图标",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "添加卡片",
		addCardAria: "向面板添加卡片",
		dashboardSettings: "面板设置",
		dashboardSettingsAria: "打开此面板的设置",
		showTitles: "显示标题",
		hideTitles: "隐藏标题",
		showCardHeaders: "显示卡片标题栏",
		hideCardHeaders: "隐藏卡片标题栏",
		doneArranging: "排列完成",
		finishArranging: "结束卡片排列",
		moveResize: "移动与缩放卡片",
		cardSettings: "卡片设置",
		removeCard: "移除卡片",
		removeCardTitle: "移除卡片？",
		removeCardMessage: (name: string) => `要从面板中移除“${name}”吗？`,
		removeCardConfirm: "移除",
		thisCard: "此卡片",
	},

	// ---- Dashboard switcher & per-dashboard settings -------------------
	dashboards: {
		newDashboard: "新建面板",
		defaultName: (n: number) => `面板 ${n}`,
		copySuffix: (name: string) => `${name} 副本`,
		fallbackName: "面板",
		menu: {
			settings: "面板设置…",
			duplicate: "复制",
			delete: "删除",
		},
		deleteTitle: "删除面板？",
		deleteMessage: (name: string, count: number) =>
			`要删除“${name}”及其 ${count} 张卡片吗？此操作无法撤销。`,
		deleteConfirm: "删除",
		modal: {
			title: "面板设置",
			/** Tabs across the top of the dashboard settings modal. */
			tabs: {
				general: "通用",
				header: "顶部",
				layout: "布局",
				style: "样式",
				background: "背景",
			},
			name: "名称",
			switcherIcon: "切换器图标",
			switcherIconDesc: "显示在切换按钮上的表情或短文本。留空则显示编号。",
			switcherLucide: "切换器 Lucide 图标",
			switcherLucideDesc:
				"一个 Lucide 图标（例如 “home”、“star”、“layout-dashboard”）— 可浏览图标集，或直接输入 id。优先于上面的表情。",
			linkedWorkspace: "关联的工作区",
			linkedWorkspaceDesc:
				"该工作区加载时自动切换到此面板。需要核心插件“工作区”。",
			linkedWorkspaceNone: "无",
			mobileDefault: "移动端默认",
			mobileDefaultDesc:
				"在手机或平板上加载 Hearth 时打开此面板。只能有一个面板作为移动端默认；开启此项会清除其他面板的设置。",
			titleVisibility: "标题可见性",
			titleVisibilityDesc:
				"仅针对此面板显示或隐藏标题/图标区块。覆盖全局设置。",
			titleVisibilityDefault: (state: string) => `使用全局默认（${state}）`,
			searchVisibility: "搜索可见性",
			searchVisibilityDesc:
				"在此面板上显示或隐藏搜索与命令栏及其结果和筛选按钮。覆盖全局设置。",
			searchVisibilityDefault: (state: string) => `使用全局默认（${state}）`,
			searchVisibilityShow: "显示搜索",
			searchVisibilityHide: "隐藏搜索",
			visibilityShown: "显示",
			visibilityHidden: "隐藏",
			visibilityShow: "显示标题",
			visibilityHide: "隐藏标题",
			titleText: "标题文本",
			titleTextDesc: "为此面板覆盖全局标题文本。",
			logoText: "图标文本",
			logoTextDesc: "为此面板覆盖全局图标。留空则使用 Hearth 水晶图标。",
			logoIcon: "标题图标",
			logoIconDesc:
				"在此面板标题旁绘制一个 Lucide 图标，取代图标文本。清空后，仅此面板会显示图标文本（或 Hearth 水晶图标）。",
			titleAlign: "标题对齐",
			titleAlignDesc: "仅对齐标题/图标区块。搜索栏保持自身布局。",
			alignDefault: "默认（居中）",
			alignLeft: "左对齐",
			alignCenter: "居中",
			alignRight: "右对齐",
			titleSize: "标题大小",
			logoSize: "图标大小",
			titleTopMargin: "标题上边距",
			headerSpacingBelow: "标题/顶部下方间距",
			contentWidth: "内容宽度",
			fitToPage: "适应页面",
			fitToPageDesc: "为此面板覆盖滚动行为。",
			fitDefault: (state: string) => `使用全局默认（${state}）`,
			fitStateFit: "适应",
			fitStateScroll: "滚动",
			fitOptionFit: "适应单页",
			fitOptionScroll: "允许滚动",
			themeColorTarget: "标题上的强调色",
			themeColorTargetDesc:
				"此面板品牌标识的哪些部分跟随主题的图标颜色。仅为此面板覆盖全局设置；Hearth 的标签页与侧边栏图标仍跟随全局设置。",
			themeColorTargetDefault: (state: string) => `使用全局默认（${state}）`,
			themeColorTargetOptions: {
				none: "都不",
				icon: "图标",
				title: "标题",
				both: "两者",
			},
			compact: "紧凑间距",
			compactDesc: "为此面板覆盖全局间距。",
			compactDefault: (state: string) => `使用全局默认（${state}）`,
			compactOptionOn: "紧凑",
			compactOptionOff: "宽松",
			compactStateOn: "紧凑",
			compactStateOff: "宽松",
			cardOpacity: "卡片不透明度",
			cardBlur: "卡片模糊",
			cardRadius: "卡片圆角半径",
			cardBorderWidth: "卡片边框",
			done: "完成",
			overriding: "正在覆盖全局默认值。",
			usingGlobal: (value: number | string) => `使用全局默认（${value}）。`,
			usingDefault: (value: number | string) => `使用默认值（${value}）。`,
			usingDefaultText: (value: string) => `使用默认值（${value}）。`,
			background: "背景",
			backgroundDesc: "为此面板覆盖全局背景。",
			backgroundValue: "背景值",
			opacity: "不透明度",
			blur: "模糊",
			backgroundLayout: "背景布局",
			bannerHeight: "横幅高度",
			bannerFade: "淡出下边缘",
			bannerFullWidth: "全宽",
			clearOverride: "跟随全局设置",
		},
		useGlobal: "使用全局默认",
		on: "开",
		off: "关",
		backgroundLayoutOptions: {
			full: "完整背景",
			banner: "横幅",
		},
		backgroundOptions: {
			default: "使用全局默认",
			none: "无",
			hdefault: "Hearth 默认",
			color: "纯色",
			image: "仓库图片",
			url: "图片 URL",
			weather: "实时天气天空",
		},
		backgroundValueDesc: {
			color: "一个 CSS 颜色值，例如 #1e1e2e。",
			image: "仓库内的图片路径，例如 Attachments/bg.png。",
			url: "图片的直链 URL。",
		},
	},

	// ---- Plugin settings tab -------------------------------------------
	settings: {
		/** Shared across every slider/section control. */
		resetSlider: "重置为默认值",
		/** Reset button next to text fields whose factory default is meaningful. */
		resetField: "重置为默认值",
		/** Strapline under the plugin name on the settings index. */
		indexSub: "为您的仓库打造的主屏幕 — 搜索、面板与启动器合于一处。",
		/** Accessible name of the back link on a category page; the visible label is
		 * the plugin's own name. */
		backToIndex: "返回所有设置",
		/** Headings that group the categories on the index. */
		indexGroups: {
			lookFeel: "外观与感受",
			howItWorks: "工作方式",
			data: "数据与插件",
			etc: "其他",
		},
		/** One line per category, shown on its index row and again at the top of
		 * its page: what a reader will find if they open it. */
		tabDescs: {
			appearance: "标题、图标、背景与低功耗模式。",
			search: "搜索栏及其提供的结果。",
			dashboard: "网格、卡片表面与面板周围的控件。",
			behaviour: "启动、笔记打开方式、移动端与隐私。",
			integrations: "TaskNotes、文件图标，以及 Hearth 读取的每个插件。",
			backup: "导出与导入您的布局和设置。",
			about: "版本、更新内容，以及问题反馈渠道。",
		},
		/** Shown in place of a settings section (or tab) whose render threw, so a
		 * single failing section can no longer blank the whole settings pane. */
		sectionError: (name: string) => `无法显示“${name}”部分。`,
		sectionErrorHint:
			"请打开开发者控制台（Cmd/Ctrl+Option+I）查看错误，然后在 GitHub 上反馈。其他设置不受影响。",
		/** Category ribbon at the top of the settings tab. */
		tabs: {
			appearance: "外观",
			search: "搜索",
			dashboard: "面板",
			behaviour: "行为",
			integrations: "集成",
			backup: "备份",
			about: "关于",
		},
		/** Sub-section headings used to group settings within a tab. */
		sections: {
			performance: "性能",
			performanceDesc:
				"愿意为装饰付出多少代价。在较慢的硬件上，用视觉效果换取续航与流畅度。",
			home: "主页",
			homeDesc: "标题、图标、标题与标签页图标、搜索可见性以及整体内容宽度。",
			searchBar: "搜索栏",
			searchBarDesc: "搜索框的外观及其功能。",
			grid: "网格与间距",
			gridDesc: "卡片网格的尺寸与间距。",
			dashboardControls: "面板控件",
			dashboardControlsDesc: "面板周围各控件的可见性。",
			cardSurface: "卡片表面",
			cardSurfaceDesc: "应用于每张卡片的透明度与毛玻璃模糊。",
			startup: "启动与标签页",
			startupDesc: "主页视图何时、在何处打开。",
			opening: "打开笔记",
			openingDesc: "在 Hearth 中点击笔记时它在哪里打开。",
			mobileMode: "移动模式",
			mobileModeDesc: "Hearth 在手机和平板上的行为。",
			privacy: "隐私与网络",
			privacyDesc: "控制 Hearth 允许发出的对外请求。",
		},
		about: {
			heading: "关于 Hearth",
			headingDesc: "项目链接、支持与版本。",
			setup: "设置 Hearth",
			setupDesc:
				"回答几个关于您工作方式和已装插件的问题，Hearth 就会搭建一个匹配的面板。" +
				"它会作为新面板添加 — 您已有的内容都不会改变。",
			setupAgain: "搭建一个面板",
			setupAgainDesc:
				"再次运行设置向导以生成另一个面板。它始终作为新面板添加，因此您现有的" +
				"面板绝不会被改动 — 它设定的一切都落在那一个面板上，而不是仓库的全局设置。",
			setupButton: "开始设置",
			whatsNew: "更新内容",
			whatsNewDesc: "查看本版本及历史每个版本的发布说明。",
			whatsNewButton: "查看更新日志",
			github: "GitHub 仓库",
			githubDesc: "浏览源码、为项目点星，或阅读更新日志。",
			githubButton: "打开 GitHub",
			reportIssue: "反馈问题",
			reportIssueDesc: "遇到 bug 或有功能想法？请在 GitHub 上提交 issue。",
			reportIssueButton: "反馈问题",
			kofi: "支持 Hearth",
			kofiDesc:
				"Hearth 是免费的，并且永远免费。如果它值得留在您的主屏幕上，" +
				"欢迎打赏 — 完全自愿，不会锁定任何功能。",
			kofiButton: "在 Ko-fi 上打赏",
			version: (v: string) => `版本 ${v}`,
			versionDesc: "您正在运行的 Hearth 构建版本。",
		},
		appearance: {
			heading: "外观",
			headingDesc: "标题、图标、搜索栏与整体内容宽度。",
			showTitle: "显示标题",
			showTitleDesc: "在顶部显示大标题/图标。",
			showSearch: "显示搜索区域",
			showSearchDesc:
				"显示搜索与命令栏及其结果和筛选按钮。各个面板可在自己的设置中覆盖此项。",
			title: "标题",
			titleDesc: "显示在主页视图顶部的标题文本。",
			logo: "图标",
			logoDesc: "标题旁显示的表情或短文本。留空则使用 Hearth 水晶图标。",
			logoIcon: "标题图标",
			logoIconDesc:
				"在标题旁绘制一个 Lucide 图标，取代图标文本。" +
				"可浏览图标集或输入 id；留空则保留图标文本。" +
				"每个面板都可以在自己的设置中覆盖此项。",
			tabIcon: "标签页图标",
			tabIconDesc:
				"用于 Hearth 标签页标题栏和侧边栏按钮的 Lucide 图标，取代 Hearth 水晶图标。" +
				"可浏览图标集或输入 id；留空则使用水晶图标。",
			themeColorTarget: "跟随主题图标颜色",
			themeColorTargetDesc:
				"用主题的图标颜色绘制水晶图标和/或标题文本，取代默认的紫色水晶与普通文本。",
			themeColorNone: "关闭",
			themeColorIcon: "图标",
			themeColorTitle: "标题",
			themeColorBoth: "图标与标题",
			searchPlaceholder: "搜索占位文本",
			searchContents: "搜索笔记内容",
			searchContentsDesc:
				"除名称、标签和属性外，也匹配笔记正文中的文本。正文匹配会带摘要显示在" +
				"名称匹配之后。",
			searchEngine: "搜索引擎",
			searchEngineDesc:
				"为搜索栏提供支持的引擎。Omnisearch 需要安装并启用 Omnisearch 社区插件。",
			searchEngineBuiltin: "Hearth（内置）",
			searchEngineOmnisearch: "Omnisearch",
			omnisearchMissing:
				"Omnisearch 未安装或未启用。请先安装并启用，然后再次选择。",
			omnisearchInstallLink: "在社区插件中打开 Omnisearch",
			showNewNoteButton: "显示“新建笔记”按钮",
			showNewNoteButtonDesc: "在搜索框旁显示操作按钮。",
			newNoteButtonMode: "搜索栏按钮",
			newNoteButtonModeDesc:
				"搜索栏旁的按钮做什么：新建笔记，或用搜索框中的内容搜索网络。",
			newNoteButtonModeNewNote: "新建笔记",
			newNoteButtonModeSearchOnline: "在线搜索",
			newNoteHeading: "“新建笔记”按钮",
			newNoteHeadingDesc:
				"它创建什么、创建在哪里。同一组设置同时驱动搜索栏旁的按钮、" +
				"搜索栏卡片上的按钮，以及 Hearth 的“新建笔记”命令。",
			newNoteButtonLabel: "按钮文本",
			newNoteButtonLabelDesc: "按钮上的文本。留空则显示“新建笔记”。",
			newNoteTemplate: "模板",
			newNoteTemplateDesc:
				"用 Templater 模板创建笔记，而不是空白笔记。" +
				"模板处理由 Templater 完成 — 您的用户脚本、tp.system.prompt() 对话框" +
				"和光标定位的行为都与从它自己的命令调用时一致。",
			newNoteTemplateNone: "空白笔记",
			newNoteTemplatePick: "选择一个模板…",
			newNoteTemplateClear: "使用空白笔记",
			newNoteTemplaterMissing:
				"Templater 未启用。请安装并启用它才能在此使用模板；" +
				"在此之前该按钮会创建空白笔记。",
			newNoteFolder: "位置",
			newNoteFolderDesc:
				"新笔记所在的文件夹，若不存在则自动创建。" +
				"“默认位置”表示 Obsidian 放置新笔记的位置。",
			newNoteFolderClear: "使用默认位置",
			newNoteFilename: "文件名",
			newNoteFilenameDesc:
				"新笔记的名称，不含扩展名。{{date}}、{{date:FMT}}、{{time}}、" +
				"{{time:FMT}} 和 {{prompt}} 会被替换 — {{prompt}} 会在每次点击时" +
				"询问名称。留空则使用“Untitled”。",
			newNoteFilenamePlaceholder: "Untitled",
			newNoteDestination: (destination: string) => `将创建于 ${destination}`,
			contentWidth: "内容宽度",
			contentWidthDesc: "主页内容的最大宽度（像素）。",
		},
		performance: {
			tier: "性能档位",
			tierDesc:
				"每降一档，就关掉面板上下一项最耗资源的效果。下方的设置不会被覆盖 — " +
				"当您调回更高档位时，它们会原样恢复。",
			tierFull: "完整 — 全部开启",
			tierBalanced: "均衡 — 更轻的天空",
			tierReduced: "精简 — 静止不动",
			tierMinimal: "最简 — 朴素静止",
			/** One line per tier, shown under the dropdown for the selected one. */
			tierFullDesc:
				"所有效果全强度开启。绘制的天气天空是其中最耗资源的部分：" +
				"如果面板让机器发热，就从这一项开始降档。",
			tierBalancedDesc:
				"绘制的天空以一半密度呈现 — 更少的雨滴、星星、云与雾丝。" +
				"没有任何效果被关闭，也没有任何东西停止运动；只是数量更少，" +
				"工作量约减少三分之一。",
			tierReducedDesc:
				"面板上不再有任何动画，卡片背后的毛玻璃也已关闭。壁纸保留，" +
				"卡片保持半透明，每张卡片仍按计时器刷新 — 只是面板静止了。",
			tierMinimalDesc:
				"最节省的一端：用纯色取代壁纸、卡片不透明、无动画，" +
				"卡片也不再按计时器自动刷新。",
			pauseWhenUnfocused: "Obsidian 不在前台时暂停动画",
			pauseWhenUnfocusedDesc:
				"当您在另一个应用或另一个窗口工作时，暂停所有动画。" +
				"被其他标签页挡住的 Hearth 标签页本身就不消耗资源；此项针对的是" +
				"在您并未使用的窗口中仍可见的面板 — 例如与浏览器并排，或在第二块屏幕上。" +
				"如果您让面板常驻第二块显示器，请关闭此项。",
			color: "最简模式背景",
			colorDesc:
				"最简档位下主页视图背后的纯色。任何 CSS 颜色，例如 #4a4459。",
			/** Bullet list of what the selected tier changes, shown under the dropdown. */
			effects: "在此档位下：",
			effectSkyHalf: "绘制的天气天空以一半密度呈现",
			effectBackground: "背景为纯色 — 无图片、GIF、不透明层或模糊",
			effectOpaque: "卡片不透明，而非半透明",
			effectFrost: "卡片背后没有毛玻璃模糊",
			effectMotion: "过渡、悬停浮起、阴影与动画均关闭",
			effectRefresh:
				"网页、RSS、日历订阅和 Jira 卡片不再按计时器刷新（手动刷新仍然可用）",
			effectLiveRefresh: "面板不再因仓库变化而自行重建",
			effectClock: "时钟卡片不显示秒数与走动的秒针",
			effectSlideshow: "幻灯片卡片固定显示一张图片，不再轮播",
			/** Shown in the sections whose settings the tier currently overrides. */
			overridden:
				"当前性能档位覆盖了这些设置。它们会原样保留，并在您调回更高档位时重新生效。",
		},
		background: {
			heading: "背景",
			headingDesc: "主页视图背后的背景，以及它透出的程度。",
			type: "背景类型",
			typeDesc: "在主页视图背后显示什么。",
			value: "背景值",
			valueColorDesc: "一个 CSS 颜色值，例如 #1e1e2e 或 rgb(30,30,46)。",
			valueImageDesc: "仓库内的图片路径，例如 Attachments/bg.png。",
			valueUrlDesc: "图片的直链 URL。",
			opacity: "不透明度",
			opacityDesc: "背景透出的程度。数值越低越含蓄。",
			blur: "模糊",
			blurDesc: "背景模糊半径（像素）。",
			layout: "背景布局",
			layoutDesc:
				"让背景铺满整个视图，或作为横幅呈现 — 面板顶部的一条区域，" +
				"就像笔记上方的封面图那样 — 下方的卡片使用主题自身的表面。" +
				"每个面板都可以在自己的设置中覆盖此项。",
			layoutLabels: {
				full: "完整背景",
				banner: "横幅",
			},
			bannerHeight: "横幅高度",
			bannerHeightDesc: "横幅区域的高度（像素）。",
			bannerFade: "淡出下边缘",
			bannerFadeDesc: "让横幅溶入页面，而不是以一条硬边结束。",
			bannerFullWidth: "全宽",
			bannerFullWidthDesc: "让横幅横贯窗口两端，而不是与下方内容对齐。",
			labels: {
				default: "Hearth 默认",
				none: "无",
				color: "纯色",
				image: "仓库图片",
				url: "图片 URL",
				weather: "实时天气天空",
			},
			weatherHeading: "天气天空",
			weatherDesc:
				"面板的背景变成一幅绘制的天空 — 与天气卡片的艺术风格相同，铺满整个窗口。" +
				"可以跟随某地的真实天况（数据来自 Open-Meteo；仅发送坐标，" +
				"且在关闭对外调用时不会请求任何数据），也可以固定一种天空，" +
				"这样无需位置信息，也永不联网。",
			weatherNoPlace: "请在下方选择一个位置以绘制天空。",
			skySource: "天空",
			skySourceDesc: "跟随某地的真实天气，或不论外面如何都保持一种天空。",
			skySourceLive: "实时天气",
			skySourceFixed: "固定天空",
			skyCondition: "天况",
			skyConditionDesc: "此天空始终显示的天气。",
			skyDaylight: "时段",
			skyDaylightDesc: "天空是跟随您的时钟，还是固定为白天或夜晚。",
			skyDaylightAuto: "跟随时钟",
			skyDaylightDay: "始终白天",
			skyDaylightNight: "始终夜晚",
			skyAnimate: "让天空动起来",
			skyAnimateDesc:
				"面板背后飘动的云、落下的雨与闪烁的星。在低功耗模式下，" +
				"以及系统要求减少动态效果的用户处，始终关闭。",
		},
		behaviour: {
			heading: "行为",
			headingDesc: "Hearth 何时、在何处打开，以及手机/平板的“仅搜索”模式。",
			openOnStartup: "启动时打开",
			openOnStartupDesc: "仓库加载时打开主页视图。",
			replaceNewTabs: "替换新标签页",
			replaceNewTabsDesc: "显示主页视图，取代空白新标签页。",
			focusSearchOnOpen: "打开时聚焦搜索框",
			focusSearchOnOpenDesc:
				"每次打开主页视图时把光标放进搜索框，让您可以立即开始输入。仅桌面端。",
			liveRefresh: "随仓库变化实时刷新",
			liveRefreshDesc:
				"仓库变化时保持已打开的主页视图为最新 — 最近、书签和已保存查询卡片" +
				"无需重新打开标签页即会更新。无论此设置如何，切回 Hearth 标签页时总会刷新。",
			mobileSearchOnly: "移动模式（仅搜索）",
			mobileSearchOnlyDesc:
				"在手机和平板上隐藏面板，仅显示搜索框。对桌面端无影响。",
			disableExternalCalls: "禁用对外调用",
			disableExternalCallsDesc:
				"阻止 Hearth 发出的所有对外网络请求，包括 Jira、外部日历、RSS 源" +
				"以及计算器的汇率查询。",
			openIn: "笔记打开位置",
			openInDesc:
				"从 Hearth 打开笔记时它去哪里。“当前标签页”会替换主页视图，" +
				"使 Hearth 表现得像任何其他标签页。无论如何，Ctrl/Cmd 点击总会打开新标签页。",
			openInModes: {
				tab: "新标签页",
				same: "当前标签页（替换 Hearth）",
				split: "分割窗格",
				window: "新窗口",
			},
			/** The extra choice each per-source dropdown offers on top of the four
			 * destinations: follow whatever "Open notes in" is set to. */
			openInFollow: "同上",
			openInSources: {
				link: "链接",
				linkDesc: "笔记、任务和链接卡片中的链接。",
				search: "搜索结果",
				searchDesc: "来自搜索栏和搜索卡片的结果。",
				card: "卡片中的笔记",
				cardDesc:
					"由最近、书签、收藏、日历、热力图和任务卡片列出的笔记，以及移动端操作按钮。",
				newNote: "Hearth 创建的笔记",
				newNoteDesc: "新笔记、日记和事件笔记，在创建时随即打开。",
			},
			openFromOutside: "从 Hearth 之外打开的笔记",
			openFromOutsideDesc:
				"文件浏览器、快速切换器、关系图 — 以及卡片嵌入的、自行打开链接的内容。" +
				"Obsidian 会把它们交给当前聚焦的标签页，因此 Hearth 标签页会被占用。" +
				"选择“新标签页”可保留 Hearth 标签页；此时文件浏览器将不再跟随您打开的文件。",
			openFromOutsideModes: {
				same: "当前标签页（替换 Hearth）",
				tab: "新标签页（保留 Hearth）",
			},
		},
		mobileActions: {
			heading: "移动操作栏",
			headingDesc:
				"在移动模式（仅搜索）下，这一排按钮取代搜索栏旁的“新建笔记”按钮，" +
				"改为出现在搜索框和筛选按钮下方。每个按钮都可以运行命令、" +
				"打开笔记或文件，或打开一个网址 — 就像启动台磁贴一样。",
			showActionBar: "显示操作栏",
			showActionBarDesc: "在移动模式下于搜索框下方显示这排操作按钮。",
			labelPlaceholder: "标签",
			iconPlaceholder: "图标",
			commandTooltip: (id: string) => `命令：${id}`,
			pickCommand: "选择一个命令",
			moveUp: "上移",
			moveDown: "下移",
			removeButton: "移除按钮",
			addButton: "添加按钮",
			resetDefaults: "重置为默认",
		},
		/** The full catalogue shown at the top of the Integrations tab. Every
		 * integration is listed here whether or not it has a setting and whether
		 * or not the plugin is installed — see `src/integrations.ts`. */
		integrations: {
			heading: "所有集成",
			headingDesc:
				"Hearth 可以配合使用的一切，无论是否已安装都列在这里。" +
				"多数集成无需设置 — 需要设置的会说明其设置所在的位置。",
			groups: {
				plugin: "社区插件",
				pluginDesc: "这些插件一旦启用，Hearth 就会自动识别。",
				core: "Obsidian 核心插件",
				coreDesc:
					"内置于 Obsidian。如果某张卡片提示缺少其中之一，请在 设置 → 核心插件 中启用。",
				service: "外部服务",
				serviceDesc:
					"通过网络获取数据的卡片。行为 → 隐私与网络 下的“禁用对外调用”可一次性全部静默。",
			},
			status: {
				enabled: "已启用",
				disabled: "已禁用",
				missing: "未安装",
				external: "网络",
				always: "始终可用",
			},
			/** Tooltip on the status pill, spelling out what it means for Hearth. */
			statusTooltip: {
				enabled: "已安装并启用 — Hearth 正在使用它。",
				disabled: "已安装但已关闭，因此 Hearth 目前无法使用它。",
				missing: "未安装。Hearth 的其他一切在没有它的情况下也能正常工作。",
				external: "这是一次对外请求，而不是插件。",
				always: "无需安装。",
			},
			/** Where this integration's settings live, shown under the description. */
			where: {
				section: "设置就在本页下方。",
				tab: (tab: string) => `设置位于 ${tab} 下。`,
				card: "在面板上的卡片本身进行配置。",
				pluginSettings: "使用该插件自己的设置 — Hearth 中无需设置。",
				none: "无需配置。",
			},
			/** Row buttons. */
			install: "安装",
			installTooltip: "在 Obsidian 的社区插件浏览器中打开此插件。",
			goToSection: "显示",
			goToTab: "打开",
			/** One entry per id in `INTEGRATIONS`. */
			items: {
				omnisearch: {
					name: "Omnisearch",
					desc:
						"把搜索栏切换到 Omnisearch 的模糊全文索引，取代 Hearth 的内置引擎。" +
						"请在 搜索 → 搜索栏 下选择引擎；该选择仅在 Omnisearch 启用时保持有效。",
				},
				tasknotes: {
					name: "TaskNotes",
					desc:
						"让任务卡片读取 TaskNotes 的“一任务一笔记”仓库 — 状态、到期日和优先级" +
						"直接来自 frontmatter。",
				},
				dataview: {
					name: "Dataview",
					desc:
						"Dataview 卡片运行 DQL 查询和 DataviewJS 代码块，使用 Dataview 自己的" +
						"渲染器呈现，并随其索引变化刷新。",
				},
				datacore: {
					name: "Datacore",
					desc:
						"Dataview 的后继者。Datacore 卡片运行 Datacore 查询 — 或 JS/JSX/TS/TSX " +
						"脚本 — 并用 Datacore 自己的实时视图渲染。",
				},
				templater: {
					name: "Templater",
					desc:
						"“从模板新建笔记”卡片把您的 Templater 模板变成按钮：每个磁贴携带" +
						"自己的模板、目标文件夹和文件名格式，一键即可创建笔记。" +
						"模板处理由 Templater 完成 — 您的用户脚本、tp.system.prompt() 对话框" +
						"和光标定位的行为都与从它自己的命令调用时一致。",
				},
				git: {
					name: "Git",
					desc:
						"Git 卡片显示仓库的分支、变更和最近提交，并通过 Git 插件本身进行" +
						"提交、同步、推送和拉取 — 它的远端、凭据和提交信息模板都原样适用。",
				},
				operon: {
					name: "Operon",
					desc:
						"Operon 卡片 — 任务、看板、日程和计时器 — 通过 Operon 自己的开发者 API " +
						"读取数据，因此状态、优先级和重复规则仍由它定义。仅桌面端，" +
						"需要 Obsidian 1.12.2 或更新版本，且 Operon 必须批准 Hearth 的读取请求。",
				},
				iconic: {
					name: "Iconic",
					desc:
						"用 Iconic 设置的按文件图标会出现在 Hearth 列出文件的任何位置 — " +
						"最近、收藏、已保存搜索和搜索结果。",
				},
				iconize: {
					name: "Iconize",
					desc:
						"对 Iconize（原 Obsidian Icon Folder）同样适用，包括通过 frontmatter " +
						"属性设置的图标。",
				},
				excalidraw: {
					name: "Excalidraw",
					desc:
						"嵌入卡片可实时渲染 Excalidraw 绘图，“新建绘图”操作则通过 Excalidraw " +
						"自己的命令创建。",
				},
				bases: {
					name: "Bases",
					desc: "嵌入卡片可以在面板上显示 Bases（.base）视图。",
				},
				canvas: {
					name: "白板",
					desc: "嵌入卡片可以显示白板，可交互且铺满整张卡片。",
				},
				dailyNotes: {
					name: "日记",
					desc:
						"日记、迷你日历和仓库统计卡片会依据日记插件自己的文件夹、日期格式" +
						"和模板来定位今天的笔记。",
				},
				bookmarks: {
					name: "书签",
					desc: "书签卡片列出您的 Obsidian 书签，分组一并显示。",
				},
				globalSearch: {
					name: "搜索",
					desc: "当您需要完整结果时，把查询交给 Obsidian 自己的搜索面板。",
				},
				fileExplorer: {
					name: "文件浏览器",
					desc: "为 Hearth 搜索结果上的“在文件浏览器中显示”提供支持。",
				},
				workspaces: {
					name: "工作区",
					desc: "打开某个面板时，它可以切换到一个已保存的工作区。",
				},
				audioRecorder: {
					name: "录音机",
					desc: "“录音”移动操作按钮用于启动和停止 Obsidian 自己的录音机。",
				},
				leafViews: {
					name: "任何带侧边面板的插件",
					desc:
						"插件视图卡片可以在卡片内承载另一个插件注册的视图 — 日历、看板、" +
						"大纲、标签面板等。凡是已安装的都会出现在卡片的视图选择器中。",
				},
				jira: {
					name: "Jira",
					desc:
						"Jira 卡片通过 REST API 从您的 Jira Cloud 或 Server 实例获取事项，" +
						"使用您在卡片上填入的凭据。",
				},
				rss: {
					name: "RSS 与 Atom 订阅",
					desc: "RSS 卡片可获取并解析您指定的任何 RSS 2.0 或 Atom 源。",
				},
				ics: {
					name: "iCalendar 订阅",
					desc:
						"迷你日历卡片可订阅外部 ICS/webcal 日历 — Google、iCloud、Fastmail、" +
						"Nextcloud 等。",
				},
				currency: {
					name: "汇率",
					desc:
						"计算器卡片使用来自免费、无需密钥的 Frankfurter API 的欧洲央行汇率进行货币换算。",
				},
				weather: {
					name: "天气预报",
					desc:
						"天气卡片 — 以及实时天气天空背景 — 从 Open-Meteo 获取天况：" +
						"免费、无需密钥、无需账号。仅会发送您选择的坐标，" +
						"而固定为某一天况的天空则完全不需要位置信息。",
				},
				webSearch: {
					name: "网络搜索",
					desc:
						"搜索栏的按钮可以把查询发送到 DuckDuckGo，而不是创建笔记。" +
						"可在 搜索 → 搜索栏 下切换。",
				},
			},
		},
		tasks: {
			heading: "任务 / TaskNotes",
			headingDesc:
				"任务卡片在 TaskNotes 模式下读取的字段名。TaskNotes 没有面向其他插件的" +
				"稳定 API，因此这里直接读取其 frontmatter — 请让这些与 TaskNotes 自己" +
				"设置中映射的名称一致（下面的默认值就是 TaskNotes 自己的默认值）。",
			statusField: "状态字段",
			statusFieldDesc: "读取任务状态所用的 frontmatter 字段。",
			dueField: "到期日字段",
			dueFieldDesc: "读取任务到期日所用的 frontmatter 字段。",
			priorityField: "优先级字段",
			priorityFieldDesc: "读取任务优先级标识所用的 frontmatter 字段。",
			doneValue: "“已完成”状态值",
			doneValueDesc: "标记 TaskNotes 任务已完成的状态值。",
			fieldsEnable: "自定义任务字段",
			fieldsEnableDesc:
				"用您自己定义的字段取代任务卡片显示的固定元数据 — 任何 frontmatter 属性" +
				"或 Hearth 能读取的内容，名称、颜色和顺序都由您决定。默认关闭，" +
				"在您开启之前任务保持通常的样式。开启后从空白开始：任务只显示您添加的字段。",
			fields: "任务上显示的字段",
			fieldsDesc:
				"每张任务卡片显示的字段。单张卡片可以在自己的设置中定义另一套。",
		},
		fileIcons: {
			heading: "文件图标 / Iconic / Iconize",
			headingDesc:
				"在 Hearth 显示文件的任何位置 — 最近、收藏、已保存搜索和搜索栏 — " +
				"使用您通过 Iconic 或 Iconize 插件设置的按文件图标。支持显示 Lucide 图标" +
				"和表情；使用下载图标包中图标的文件仍会显示 Hearth 自己的文件类型图标。",
			enable: "使用来自 Iconic / Iconize 的图标",
			enableDesc: "关闭后所有文件都显示 Hearth 的文件类型图标，忽略这两个插件。",
			enableDescNoPlugin:
				"目前 Iconic 与 Iconize 都未启用，因此所有文件都显示 Hearth 的文件类型图标。" +
				"此项可以保持开启 — 一旦其中之一被安装即会生效。",
			property: "Iconize frontmatter 属性",
			propertyDesc:
				"Iconize 存放笔记图标的属性，用于通过 frontmatter 而非菜单设置的图标。" +
				"如果您重命名过，请与 Iconize 自己的设置保持一致（其默认值为 “icon”）。",
		},
		operon: {
			heading: "Operon",
			headingDesc:
				"通过 Operon 插件自己的开发者 API 读取任务、看板、日程和正在运行的计时器 — " +
				"任务的定义仍以 Operon 为准，Hearth 只显示它返回的内容。",
			enable: "连接到 Operon",
			enableDesc:
				"关闭即为总开关：Operon 卡片停止读取，Hearth 也绝不会向 Operon 请求访问。" +
				"在面板上出现 Operon 卡片之前不会发起任何请求。",
			status: "连接",
			statusAbsent: "Operon 未安装或未启用。",
			statusUnsupported:
				"Operon 的开发者 API 仅支持桌面端，且需要 Obsidian 1.12.2 或更新版本。",
			statusBooting: "Operon 正在运行，但仍在启动中。",
			statusPending:
				"等待批准。请打开 设置 → Operon → Core → General → Developer API " +
				"Integrations 并批准 Hearth。",
			statusSuspended:
				"访问已暂停。请在 Operon 的 Developer API Integrations 中查看 Hearth 待批的权限范围。",
			statusRevoked:
				"访问已被撤销。请在 Operon 的 Developer API Integrations 中重新授予。",
			statusReady: "已连接 — Operon 卡片可以读取任务。",
			statusIdle: "尚未连接。添加一张 Operon 卡片即可开启会话。",
			statusOff: "该集成已关闭，因此 Hearth 不会从 Operon 读取任何内容。",
			statusError: "Operon 拒绝了连接。",
			detail: "Operon 报告",
			install: "在社区插件中打开 Operon",
			writes: "允许更改",
			writesDesc:
				"允许看板卡片通过拖动把任务移到另一个状态，并添加一个用于创建任务的“+”。" +
				"新任务放在哪里、某次移动是否合法都由 Operon 决定；Hearth 只是发起请求。" +
				"开启此项会扩大 Hearth 请求的权限范围，因此您需要在 Operon 的 " +
				"Developer API Integrations 中重新批准。关闭则表示 Hearth 只能读取。",
			writesPending:
				"读取正常，但更改权限尚未授予 — 请在 Operon 的 Developer API Integrations " +
				"中重新批准 Hearth。在此之前卡片保持只读。",
			capabilities: "请求的访问权限",
			capabilitiesDesc:
				"Hearth 一次性请求全部权限，因为 Operon 不会开启部分批准的会话。" +
				"除非开启“允许更改”（会追加任务状态流转与任务创建权限），否则均为只读。",
			missing: (names: string) => `尚未授予：${names}`,
			recheck: "重新检查",
			recheckDesc: "在批准、撤销或重新加载 Operon 后重新建立连接。",
			recheckAction: "立即重新检查",
		},
		filters: {
			heading: "搜索筛选",
			headingDesc:
				"筛选项根据仓库中的文件类型自动检测。可隐藏不需要的项。",
		},
		dashboard: {
			heading: "面板",
			headingDesc:
				"卡片网格的尺寸与透明度。卡片本身在面板上添加和配置。",
			fitToPage: "适应页面",
			fitToPageDesc: "把面板限制在一屏内，而不是允许滚动。",
			compact: "紧凑间距",
			compactDesc: "收紧卡片内边距和上边距，以扩大可用区域。",
			arrangeButtonVisibility: "排列按钮可见性",
			arrangeButtonVisibilityDesc:
				"选择排列/编辑按钮是始终可见，还是在鼠标悬停其区域时显示。",
			dashboardSwitcherVisibility: "面板切换器可见性",
			dashboardSwitcherVisibilityDesc:
				"选择左上角的面板按钮是始终可见，还是在鼠标悬停其区域时显示。",
			visibilityOptions: {
				always: "始终可见",
				hover: "悬停时显示",
			},
			cardOpacity: "卡片不透明度",
			cardOpacityDesc: "让卡片背景半透明，使面板背景透出。",
			cardBlur: "卡片模糊",
			cardBlurDesc:
				"半透明卡片背后的毛玻璃模糊。需要卡片不透明度低于 100% 才可见。0 = 关闭。",
			cardRadius: "卡片圆角半径",
			cardRadiusDesc:
				"卡片圆角的半径（像素）。默认为 14；数值越小圆角越锐利。",
			cardBorderWidth: "卡片边框",
			cardBorderWidthDesc:
				"卡片边框和标题栏分隔线的粗细（像素）。0 表示隐藏边框。",
			cards: "卡片",
			cardsDesc:
				"卡片在面板上添加和配置：打开主页视图，点击“排列”，" +
				"然后使用“添加卡片”、“面板设置”以及每张卡片的设置按钮。",
		},
		layout: {
			heading: "导入 / 导出",
			headingDesc:
				"以 JSON 文件备份或分享您的面板布局（卡片、网格、收藏）— 或全部 Hearth 设置。",
			export: "导出布局",
			exportDesc: "将当前面板布局下载为 JSON 文件。",
			exportButton: "导出文件",
			exportMobileTooltip: "在移动端，文件会保存到仓库的根目录。",
			import: "导入布局",
			importDesc: "选择一个之前导出的布局文件。这会替换您当前的所有面板。",
			importButton: "导入文件",
			importTitle: "导入布局？",
			importMessage:
				"这会替换您当前的面板、固定卡片和布局设置。此操作无法撤销。",
			exportSettings: "导出设置",
			exportSettingsDesc:
				"将全部 Hearth 设置 — 完整布局加上顶部、背景、行为、外观和 TaskNotes 选项 — " +
				"下载为 JSON 备份文件。",
			importSettings: "导入设置",
			importSettingsDesc:
				"选择一个之前导出的设置文件。这会替换您所有的 Hearth 设置。",
			importSettingsTitle: "导入设置？",
			importSettingsMessage:
				"这会替换您所有的 Hearth 设置 — 面板、布局、顶部、背景、行为和外观。" +
				"此操作无法撤销。",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		title: "卡片设置",
		/** Shown as the tooltip on tile icon fields (launchpad, commands). */
		iconHelp:
			"输入 Lucide 图标 id（例如 “home”、“star”、“calendar”）— 可在 " +
			"lucide.dev/icons 浏览。也可以输入仓库中的图片路径（例如 " +
			"Attachments/icon.png）来用自己的图片作为图标。",
		/** Tabs across the top of the card settings modal. */
		tabs: {
			content: "内容",
			style: "样式",
			layout: "布局",
		},
		type: "类型",
		typeDesc: "此卡片显示什么。",
		cardTitle: "标题",
		cardTitleDesc: "显示在卡片标题栏中。留空则卡片不带标题栏。",
		cardTitlePlaceholder: "标题",
		resetSize: "重置为默认尺寸",
		removeCard: "移除卡片",
		removeCardTitle: "移除卡片？",
		removeCardMessage: (name: string) => `要从面板中移除“${name}”吗？`,
		removeCardConfirm: "移除",
		thisCard: "此卡片",
		done: "完成",
		kinds: {
			embed: "嵌入（笔记 / 图片 / base）",
			slideshow: "幻灯片",
			daily: "日记（今天）",
			web: "网页（iframe）",
			bookmarks: "书签",
			favorites: "收藏",
			text: "文本 / 速记",
			recent: "最近文件",
			links: "链接 / 启动台",
			commands: "命令",
			templater: "从模板新建笔记",
			clock: "时钟与问候",
			tasks: "任务",
			calendar: "迷你日历",
			schedule: "日历",
			stats: "仓库统计",
			search: "查询",
			searchbar: "搜索栏",
			heatmap: "活跃度热力图",
			calculator: "计算器",
			dataview: "Dataview 查询",
			datacore: "Datacore 查询",
			rss: "RSS 订阅",
			jira: "Jira 筛选器",
			weather: "天气",
			git: "Git",
			operon: "Operon",
			leaf: "插件视图（测试版）",
			pet: "宠物",
		},
		linkTypes: {
			note: "笔记",
			url: "网址",
			command: "命令",
		},
		embed: {
			file: "要嵌入的文件",
			fileDesc: "仓库中的笔记、图片、白板或 .base 文件。",
			filePlaceholder: "要嵌入的文件路径",
			pickFile: "选择文件",
			baseView: "Base 视图",
			baseViewDesc: "从此 .base 文件中选择一个视图，或使用默认视图。",
			baseViewDefault: "默认视图",
			baseViewFileMissing: "找不到所选的 .base 文件。",
			baseViewLoadError: "无法读取该 .base 文件的视图。将使用默认视图。",
			baseViewNoViews: "此 .base 文件中未找到命名视图。将使用默认视图。",
			baseViewUnsupported: (count: number) =>
				`已隐藏 ${count} 个含不受支持的 wikilink 字符的视图。`,
			zoom: "缩放",
			zoomDesc: "缩放嵌入的内容。关闭此对话框后生效。",
			zoomImageDesc:
				"在图片被适配到的框内缩放它 — 放大已裁剪的图片会进一步裁剪。" +
				"关闭此对话框后生效。",
			imageFit: "图片适配",
			imageFitDesc:
				"图片如何填充卡片。除第一种之外的每种模式都会把整张卡片交给图片，铺满两端。",
			imageFits: {
				natural: "原始尺寸",
				contain: "完整显示图片",
				cover: "填满卡片（裁剪）",
				stretch: "拉伸到卡片大小",
				width: "适应宽度（可滚动）",
			},
			imagePosition: "图片位置",
			imagePositionDesc: "图片在卡片中的位置。",
			imagePositionCropDesc: "裁剪时保留图片的哪一部分。",
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
			editable: "可编辑",
			editableDesc: "就地编辑嵌入笔记的文本（仅 Markdown 笔记）。",
			livePreview: "实时预览",
			livePreviewDesc:
				"使用 Obsidian 自己的实时预览编辑器，而不是纯原始 Markdown 输入框，" +
				"这样格式会随输入即时渲染。关闭则显示原始 Markdown 源码，双击编辑。",
			hideBaseHeader: "隐藏 base 标题栏",
			hideBaseHeaderDesc:
				"对于嵌入的 .base 文件，隐藏 Bases 视图自己的工具栏（视图切换器与筛选/属性控件），只显示结果。",
			secondViewHeading: "第二视图",
			secondViewFile: "要嵌入的第二个文件",
			secondViewFileDesc:
				"可选。设置后卡片会显示两个视图之间的切换器 — 卡片有标题时位于标题栏中，没有标题时悬浮显示（悬停时出现）。",
			secondViewClear: "移除第二视图",
			openButton: "打开按钮",
			openButtonDesc: "显示一个按钮，在独立标签页中打开嵌入的文件。默认关闭。",
		},
		slideshow: {
			source: "图片来源",
			sourceDesc: "由您逐张挑选的列表，或某个文件夹中的所有图片。",
			sourceList: "图片列表",
			sourceFolder: "一个文件夹",
			picturesHeading: "图片",
			picturesEmpty: "还没有图片 — 请在下方添加。",
			picturePlaceholder: "图片路径",
			captionPlaceholder: "说明文字（可选）",
			pickPicture: "选择图片",
			addPicture: "添加图片",
			addFolderPictures: "添加某个文件夹的图片",
			removePicture: "移除图片",
			moveUp: "上移",
			moveDown: "下移",
			folder: "文件夹",
			folderDesc: "此文件夹中的所有图片都会显示。留空则使用仓库根目录。",
			folderPlaceholder: "Attachments/Photos",
			pickFolder: "选择文件夹",
			includeSubfolders: "包含子文件夹",
			includeSubfoldersDesc: "同时显示此文件夹子文件夹中的图片。",
			folderCount: (count: number) => `此处当前找到 ${count} 张图片。`,
			playbackHeading: "播放",
			order: "顺序",
			orderDesc: "图片的显示顺序。",
			orders: {
				manual: "列表顺序",
				name: "名称（A → Z）",
				nameDesc: "名称（Z → A）",
				created: "创建日期（最早在前）",
				createdDesc: "创建日期（最新在前）",
				modified: "修改日期（最早在前）",
				modifiedDesc: "修改日期（最新在前）",
				random: "随机",
			},
			interval: "每张图片秒数",
			intervalDesc:
				"每张图片显示的时长。0 表示固定显示第一张并关闭轮播；低功耗模式也会暂停它。",
			intervalAria: "每张图片显示的秒数",
			transition: "过渡",
			transitionDesc: "一张图片如何切换到下一张。",
			transitions: {
				none: "直切（无动画）",
				fade: "交叉淡入淡出",
				slide: "滑动",
				zoom: "缩放",
			},
			transitionSpeed: "过渡时长",
			transitionSpeedDesc: "过渡持续的毫秒数。",
			kenBurns: "缓慢推近",
			kenBurnsDesc: "在图片显示期间缓缓推近（“肯·伯恩斯”效果）。",
			displayHeading: "显示",
			fit: "适配",
			fitDesc: "每张图片如何填充卡片。",
			fits: {
				cover: "填满卡片（裁剪）",
				contain: "完整显示图片",
			},
			controls: "控件",
			controlsDesc: "悬停时显示上一张 / 暂停 / 下一张按钮以及位置指示。默认开启。",
			caption: "说明文字",
			captionDesc: "在图片上显示其说明文字，没有则回退为文件名。",
			pauseOnHover: "悬停时暂停",
			pauseOnHoverDesc: "指针位于卡片上方时保持当前图片。",
			openButton: "打开按钮",
			openButtonDesc: "显示一个按钮，在独立标签页中打开当前图片。默认关闭。",
		},
		daily: {
			editable: "可编辑",
			editableDesc: "就地编辑今天的笔记，而非只读。更改会保存到仓库。",
			openButton: "打开按钮",
			openButtonDesc: "显示一个按钮，在编辑器中打开今天的笔记。",
			info: "日记",
			infoDesc:
				"今天的笔记依据核心插件“日记”的日期格式和文件夹定位。卡片会随您的编辑实时更新。",
		},
		web: {
			url: "网址",
			urlPlaceholder: "https://example.com",
			trusted: "受信任的站点",
			trustedDesc:
				"允许页面获得同源访问权限（cookie、存储）。请只为您信任的站点开启 — " +
				"这会放宽 iframe 沙箱。",
			autoRefresh: "自动刷新",
			autoRefreshDesc: "每 N 秒重新渲染此卡片以获取变化。0 = 关闭。",
			refreshIntervalAria: "刷新间隔（秒）",
		},
		recent: {
			fit: "适应卡片高度",
			fitDesc:
				"按卡片高度能容纳的数量列出文件，而不是固定数量。调整卡片大小会改变显示数量。",
			count: "文件数量",
			countDesc: (max: number) =>
				`列出多少个最近打开的文件 — 最多 ${max} 个，这也是 Hearth 最近文件历史的上限。`,
			types: "文件类型",
			typesDesc: "只列出所选类型的文件。可任意组合；不选则显示所有类型。",
		},
		calendar: {
			view: "布局",
			viewDesc: "“月”显示网格；“日程”列出接下来的日子。",
			viewMonth: "月视图网格",
			viewAgenda: "日程",
			agendaDays: "未来天数",
			agendaDaysDesc: "日程从今天起列出多少天。",
			weekNumbers: "周数",
			weekNumbersDesc: "在左侧显示一列 ISO 周数。",
			heatmap: "热力图",
			heatmapDesc: "按当天的笔记活跃度为每一天着色。",
			heatmapCounts: "热力图计数",
			externalCalendars: "外部日历",
			externalCalendarsDesc:
				"订阅 ICS/iCal 源（Google、iCloud、Fastmail、Nextcloud…）。事件会以彩色圆点显示在网格上，并列入日程视图。",
			operonTasks: "显示 Operon 任务",
			operonTasksDesc:
				"标记有 Operon 任务到期的日期，并在日程中列出这些任务。" +
				"通过 Operon 的开发者 API 读取，因此需要在 设置 → Hearth → 集成 中" +
				"批准 Operon。仅有计划时间（无到期日）的任务不包含在内。",
			operonTaskColor: "Operon 任务颜色",
			operonTaskColorDesc: "任务标记的颜色。默认使用强调色。",
			sourceNamePlaceholder: "名称",
			sourceUrlPlaceholder: "ICS/iCal 网址（https:// 或 webcal://）",
			sourceShow: "显示此日历",
			sourceHide: "隐藏此日历",
			sourceRemove: "移除日历",
			addCalendar: "添加日历",
			refresh: "刷新间隔",
			refreshDesc: "多久重新获取一次日历（分钟）。0 表示仅在打开时获取。",
			eventNoteHeading: "事件笔记",
			eventNoteDesc:
				"配置事件弹窗中的“创建笔记”操作：选择模板、指定文件夹和文件名，并决定每个事件值的处理方式。",
			eventNoteEnabled: "显示“创建笔记”",
			eventNoteEnabledDesc: "在事件详情弹窗中提供创建笔记按钮。",
			eventNoteFolder: "文件夹",
			eventNoteFolderDesc: "新事件笔记的创建位置。留空 = 仓库根目录。",
			eventNoteFilename: "文件名",
			eventNoteFilenameDesc: "笔记名称。占位符：{{summary}}、{{date}}、{{start}}、{{location}} 等。",
			eventNoteTemplate: "模板",
			eventNoteTemplateDesc:
				"可选的笔记，其内容用作正文的初始内容。同样会替换其中的 {{…}} 占位符。",
			eventNotePickTemplate: "选择模板文件",
			eventNoteClearTemplate: "清除模板",
			eventNoteLinkKey: "链接属性",
			eventNoteLinkKeyDesc:
				"用于存放事件 ID 的 frontmatter 属性，使一个事件始终对应同一篇笔记。留空则禁用关联。",
			eventNoteCustomize: "自定义字段映射",
			eventNoteCustomizeDesc:
				"关闭时使用合理的默认设置（日期与时间作为属性，描述写入正文）。开启后可逐项指定每个值的去处。",
			eventNoteFieldsHeading: "字段映射",
			eventNoteAddField: "添加字段",
			eventNoteRemoveField: "移除",
			eventFieldNames: {
				summary: "名称",
				date: "日期",
				start: "开始时间",
				end: "结束时间",
				location: "地点",
				description: "描述",
				url: "网址",
				calendar: "日历",
			},
			eventFieldActions: {
				ignore: "忽略",
				frontmatter: "属性",
				body: "追加到正文",
			},
			eventNotePropertyPlaceholder: "属性名",
			eventNoteHeadingPlaceholder: "标题（可选）",
			eventNoteFormatPlaceholder: "格式（例如 HH:mm）",
			chipsHeading: "条目详情",
			chipsDesc:
				"选择每条日程条目在标题旁显示什么。不需要的请关闭 — 在窄卡片上这些标记会与标题本身争夺空间。",
			chipTime: "时间",
			chipTimeDesc: "开始时间，或“全天”。",
			chipSource: "日历名称",
			chipSourceDesc: "条目来自哪个日历。仅在有多个来源时显示。",
			chipStatus: "状态",
			chipStatusDesc: "任务的 TaskNotes 状态，例如“进行中”。默认关闭。",
			chipPriority: "优先级",
			chipPriorityDesc: "任务的 TaskNotes 优先级，例如“高”。",
			chipDue: "到期标记",
			chipDueDesc: "到期日条目上的“到期”标记。",
			chipRecurring: "重复标记",
			chipRecurringDesc: "重复任务上的“重复”标记。",
			chipTimeblock: "时间块标记",
			chipTimeblockDesc: "时间块上的“时间块”标记。",
			taskNotesHeading: "TaskNotes",
			taskNotesDesc:
				"把 TaskNotes 作为事件来源。此卡片会镜像 TaskNotes 自己的日历所显示的内容 — 计划任务、到期日、重复发生、时间块以及在 TaskNotes 内订阅的日历 — 并使用 TaskNotes 自己的字段名、状态和颜色。",
			taskNotesMissing:
				"此仓库中未启用 TaskNotes。请安装并启用它，才能将其作为日历来源。",
			taskNotesEnabled: "使用 TaskNotes",
			taskNotesEnabledDesc: "在此日历上绘制 TaskNotes 条目。",
			taskNotesScheduled: "计划任务",
			taskNotesScheduledDesc: "任务显示在其计划日期上，长度按其时间估算确定。",
			taskNotesDue: "到期日",
			taskNotesDueDesc: "任务显示在其到期日上。",
			taskNotesRecurring: "重复任务",
			taskNotesRecurringDesc:
				"把重复任务展开为每次发生一个条目。关闭则只显示它的下一个日期。",
			taskNotesTimeblocks: "时间块",
			taskNotesTimeblocksDesc: "写在您日记中的时间块。",
			taskNotesFollows: (on: boolean) =>
				`TaskNotes 目前将此项设为${on ? "开启" : "关闭"}。`,
			taskNotesFollowReset: "跟随 TaskNotes",
			taskNotesCompleted: "显示已完成",
			taskNotesCompletedDesc: "把已完成的任务保留在日历上，加删除线显示。",
			taskNotesArchived: "显示已归档",
			taskNotesArchivedDesc: "包含带有 TaskNotes 归档标签的任务。",
			taskNotesComplete: "从日历上完成任务",
			taskNotesCompleteDesc:
				"在每个任务上提供完成复选框，写回的内容与 TaskNotes 完全一致（重复任务按每次发生处理）。",
			taskNotesSubscriptions: "TaskNotes 日历",
			taskNotesSubscriptionsDesc: (count: number) =>
				`同时显示在 TaskNotes 内订阅的 ${count} 个日历。`,
			taskNotesSubscriptionsNone: "TaskNotes 没有可显示的日历订阅。",
			taskNotesSubLoaded: (count: number) => `已加载 ${count} 个事件。`,
			taskNotesSubPending: "尚未加载 — 请在下方刷新。",
			taskNotesSubDisabled: "已在 TaskNotes 中禁用。",
			taskNotesSubBlocked: "未获取：Hearth 的设置中已禁用对外调用。",
			taskNotesSubFailed: (reason: string) => `无法加载：${reason}`,
			taskNotesSubNotCalendar: "返回的内容不是 iCalendar 源。",
			taskNotesSubMissingFile: "该文件不在仓库中。",
			taskNotesSubRefresh: "刷新日历",
			taskNotesColorBy: "着色依据",
			taskNotesColorByDesc: "每个任务的颜色来自哪里。",
			taskNotesColorStatus: "TaskNotes 状态",
			taskNotesColorPriority: "TaskNotes 优先级",
			taskNotesColorFixed: "单一固定颜色",
			taskNotesColor: "任务颜色",
			taskNotesColorDesc: "用于固定颜色，以及 TaskNotes 未定义颜色时。",
			taskNotesDueColor: "到期颜色",
			taskNotesDueColorDesc: "为到期日条目单独指定的可选颜色。",
			taskNotesTimeblockColor: "时间块颜色",
			taskNotesTimeblockColorDesc: "用于本身没有颜色的时间块。",
		},
		schedule: {
			view: "打开时显示",
			viewDesc:
				"面板打开时卡片显示的视图。您随时可以在卡片上切换视图。",
			views: "提供的视图",
			viewsDesc:
				"卡片切换器列出哪些视图。四个全开可让每个视图都只需一次点击；只留一个视图则会完全隐藏切换器。",
			toolbar: "工具栏",
			toolbarDesc:
				"显示导航行：后退、今天、前进、当前显示的时间段以及视图切换器。关闭则把卡片固定在当前时间段。",
			dailyNotes: "日记",
			dailyNotesDesc:
				"标记已有日记的日期，并在点击某一天时打开它（或提示创建）。关闭后这就是一个纯事件日历。",
			weekHeading: "一周",
			firstDay: "一周开始于",
			firstDayDesc: "月视图和周视图网格从哪一天开始。",
			firstDayLocale: (day: string) => `跟随 Obsidian 的语言（${day}）`,
			hideWeekends: "隐藏周末",
			hideWeekendsDesc: "在月视图和周视图网格中不显示周六和周日。",
			weekNumbers: "周数",
			weekNumbersDesc: "在左侧显示一列周数。",
			clock: "时制",
			clockDesc: "事件时间的书写方式。",
			clockLocale: "跟随 Obsidian 的语言",
			clock12: "12 小时制（9:00 AM）",
			clock24: "24 小时制（09:00）",
			monthHeading: "月视图",
			monthStyle: "事件显示为",
			monthStyleDesc:
				"带名称的标签在空间充裕的卡片上一目了然；圆点适合小卡片，就像迷你日历的画法。",
			monthStyleChips: "带名称的标签",
			monthStyleDots: "圆点",
			maxPerDay: "每天事件数",
			maxPerDayDesc:
				"一个日期格最多列出多少事件，其余折叠为“+N 更多”链接。0 表示全部列出并允许该格滚动。",
			gridHeading: "周视图与日视图",
			gridDesc:
				"时间网格默认绘制一整天，并在打开时滚动到第一个事件 — 因此不会有事件落在可见时段之外。如果您只想看一天中的一部分，可以缩小时段范围。",
			hours: "绘制的时段",
			hoursDesc:
				"网格的起始与结束小时。范围之外的内容会移到上方的全天区域，而不会消失。",
			hoursMidnight: "午夜",
			hourHeight: "每小时高度",
			hourHeightDesc:
				"一小时的高度（像素）。越高细节越多；越矮则能容纳一天中更多时间。",
			nowLine: "当前时间线",
			nowLineDesc: "在今天的列上按当前时间画一条线。",
			listHeading: "列表视图",
			listDays: "列出天数",
			listDaysDesc: "列表从所显示的那一天起向后延伸多少天。",
		},
		heatmap: {
			metric: "指标",
			weeks: "周数",
			weeksDesc: "显示多少周的历史。",
		},
		stats: {
			advanced: "高级",
			advancedDesc:
				"选择显示哪些统计项、按文件类型拆分附件，并添加自定义计数。关闭则显示默认组合。",
			builtins: "显示的统计项",
			builtinsDesc: "选择显示哪些内置统计项。连续天数仅在已配置日记时显示。",
			attachmentTypes: "附件细分",
			attachmentTypesDesc: "为每种选定的文件类型（图片、PDF…）添加单独的计数磁贴。",
			customCounts: "自定义计数",
			customCountsDesc:
				"每一行统计匹配某个查询的文件数，并以磁贴显示总数。" +
				"查询语法与搜索栏一致：#标签、key:value 表示属性，或纯文本。",
			labelPlaceholder: "标签",
			iconPlaceholder: "图标",
			queryPlaceholder: "#project 或 status:active",
			addCount: "添加计数",
			removeCount: "移除计数",
		},
		metricOptions: {
			modified: "编辑的笔记",
			created: "创建的笔记",
		},
		savedSearch: {
			query: "查询",
			queryDesc:
				"与搜索栏语法相同：纯文本匹配名称/正文，#标签 匹配标签，" +
				"key:value 匹配 frontmatter 属性。",
			queryPlaceholder: "#project 或 status:active 或 会议记录",
			display: "显示方式",
			displayDesc: "以紧凑列表或磁贴显示匹配结果。",
			displayList: "列表",
			displayTiles: "磁贴",
			maxResults: "最大结果数",
			maxResultsDesc: "一次最多显示多少条匹配。",
		},
		searchBar: {
			placeholder: "占位文本",
			placeholderDesc:
				"输入框为空时显示的文本。留空则使用 设置 → 外观 中的设定。",
			filters: "筛选行",
			filtersDesc:
				"在输入框下方显示文件类型标签，与顶部搜索栏提供的相同。它们需要更高的卡片来容纳。",
			filterTypes: "筛选标签",
			filterTypesDesc:
				"此卡片提供哪些标签。只有仓库中确实存在该类文件时，对应标签才会出现。",
			filterTypeGlobalOff: "已在 设置 → 筛选 中对所有搜索栏隐藏。",
			button: "按钮",
			buttonDesc:
				"输入框旁的操作按钮：新建笔记，或用框中输入的内容搜索网络。",
			buttonNone: "无",
			buttonNewNote: "新建笔记",
			buttonSearchOnline: "在线搜索",
			seamless: "无边框",
			seamlessDesc:
				"去掉卡片外框 — 无边框、无背景、无标题行 — 让它在面板上看起来就是一个独立的搜索栏。",
			sizeNote:
				"输入框的粗细与卡片高度一致 — 在“排列”模式下拖动卡片边缘即可让搜索栏更粗或更细。",
		},
		links: {
			heading: "链接",
			autoShift: "磁贴自动避让（测试版）",
			autoShiftDesc:
				"开启后，拖动一个磁贴时其他磁贴会互相推开（类似手机小组件）。" +
				"默认关闭 — 磁贴完全自由摆放，可能相互重叠。",
			labelPlaceholder: "标签",
			iconPlaceholder: "图标",
			pickCommand: "选择命令…",
			targetUrl: "目标（网址）",
			targetNote: "目标（笔记路径）",
			moveUp: "上移",
			moveDown: "下移",
			removeLink: "移除链接",
			addLink: "添加链接",
		},
		commands: {
			autoShift: "磁贴自动避让（测试版）",
			autoShiftDesc:
				"开启后，拖动一个磁贴时其他磁贴会互相推开（类似手机小组件）。" +
				"默认关闭 — 磁贴完全自由摆放，可能相互重叠。",
			buttonSize: "按钮大小",
			buttonSizeDesc:
				"命令磁贴的默认大小。拖动某个磁贴的右下角可单独调整大小，" +
				"也可以在下方为每个磁贴设定尺寸。",
			heading: "命令",
			iconOptionalPlaceholder: "图标（可选）",
			sizePlaceholder: "尺寸",
			tileSizeAria: "磁贴尺寸（像素，可选）",
			moveUp: "上移",
			moveDown: "下移",
			removeCommand: "移除命令",
			addCommand: "添加命令",
		},
		templater: {
			missing: "Templater 未启用",
			missingDesc:
				"此卡片通过调用 Templater 插件来创建笔记 — 安装并启用它，这些磁贴即可工作。" +
				"在此之前，这里的其他设置无需改动。",
			autoShift: "磁贴自动避让（测试版）",
			autoShiftDesc:
				"开启后，拖动一个磁贴时其他磁贴会互相推开（类似手机小组件）。" +
				"默认关闭 — 磁贴完全自由摆放，可能相互重叠。",
			buttonSize: "按钮大小",
			buttonSizeDesc:
				"磁贴的默认大小。拖动某个磁贴的右下角可单独调整其大小。",
			heading: "模板",
			labelPlaceholder: "标签",
			pickTemplate: "选择一个模板…",
			pickTemplateTooltip: "选择此磁贴要运行的 Templater 模板",
			pickFolderTooltip:
				"选择新笔记所在的文件夹。仓库根目录表示“Obsidian 放置新笔记的位置”。",
			filenamePlaceholder: "文件名",
			filenameTooltip:
				"新笔记的名称，不含扩展名。{{date}}、{{date:FMT}}、{{time}}、" +
				"{{time:FMT}} 和 {{prompt}} 会被替换。留空则由 Templater 命名。",
			openOn: "会打开新笔记 — 点击改为静默归档",
			openOff: "静默归档新笔记 — 点击改为打开它",
			removeTile: "移除磁贴",
			addTile: "添加一个模板",
			tokensHelp:
				"文件名中可以使用 {{date}}、{{date:YYYY-MM}}、{{time}}、{{time:HH-mm}} " +
				"和 {{prompt}}，{{prompt}} 会在创建笔记前询问名称的其余部分。" +
				"模板内部的一切 — <% tp.* %>、您的用户脚本、tp.system.prompt() — " +
				"都属于 Templater 自己，其运行方式与从 Templater 的命令调用时完全一致。",
			tokensHelpScoped: (folder: string) =>
				`选择器列出的是“${folder}”中的模板，也就是 Templater 自己的模板文件夹。` +
				"文件名中可以使用 {{date}}、{{date:YYYY-MM}}、{{time}}、{{time:HH-mm}} " +
				"和 {{prompt}}，{{prompt}} 会在创建笔记前询问名称的其余部分。" +
				"模板内部的一切 — <% tp.* %>、您的用户脚本、tp.system.prompt() — " +
				"都属于 Templater 自己，其运行方式与从 Templater 的命令调用时完全一致。",
		},
		tasks: {
			source: "来源",
			sourceDesc:
				"Markdown 复选框在任何地方都可用。TaskNotes 通过 frontmatter 读取该插件的" +
				"任务笔记（字段名可在 设置 → Hearth 中配置，因为 TaskNotes 没有供其他插件" +
				"查询的 API）。Kanban 读取单个 Kanban 插件的看板笔记，每个标题作为一列。",
			sourceCheckbox: "Markdown 复选框",
			sourceTaskNotes: "TaskNotes 插件",
			sourceKanban: "Kanban 插件",
			kanbanBoard: "看板笔记",
			kanbanBoardDesc:
				"要读取的 Kanban 插件看板。留空则自动检测范围内第一篇带有 “kanban-plugin” " +
				"frontmatter 键的笔记。",
			kanbanBoardPlaceholder: "自动检测",
			pickBoard: "选择一个 Kanban 看板",
			kanbanExtended: "日期与优先级",
			kanbanExtendedDesc:
				"读取每张卡片上写的日期、优先级和重复标记（兼容 obsidian-tasks 插件），" +
				"使它们显示为指示标记、参与列表排序，并可从卡片上编辑。" +
				"关闭则把卡片当作纯文本读取。",
			checkboxExtended: "日期与优先级",
			checkboxExtendedDesc:
				"读取每个复选框行内写的日期、优先级和重复标记（兼容 obsidian-tasks 插件），" +
				"使它们显示为指示标记、参与列表排序，并可从条目的右键菜单编辑。" +
				"关闭则把复选框当作纯文本读取。",
			checkboxStatuses: "任务状态（看板列）",
			checkboxStatusesDesc:
				"在看板上作为列显示的复选框状态，每行一个，格式为“[符号] 标签” — " +
				"符号即 “- [ ]” 中间的那个字符。加上“(done)”表示该状态为已完成。" +
				"把卡片拖到某一列会写入该列的符号。留空则使用默认组合（待办、进行中、已完成）。",
			quickView: "点击时快速查看",
			quickViewDesc:
				"点击任务会打开一个紧凑弹窗 — 其元数据和描述可就地编辑，并带有打开完整笔记" +
				"或删除任务的按钮 — 而不是直接打开笔记。关闭则点击即打开笔记。",
			convertTemplate: "转换为笔记的模板",
			convertTemplateDesc:
				"当您右键卡片并选择“转换为笔记”时，用此模板作为新笔记的初始内容。" +
				"支持 {{title}}、{{date}} 和 {{time}}。留空则创建空白笔记。",
			convertTemplatePlaceholder: "例如 Templates/Task.md",
			pickTemplate: "选择一篇模板笔记",
			convertScrape: "把元数据提取到 frontmatter",
			convertScrapeDesc:
				"把卡片转换为笔记时，将其日期、优先级和重复标记移入新笔记的 YAML " +
				"frontmatter，而不是把表情标记留在看板链接上。",
			newTaskAsNote: "新任务作为笔记",
			newTaskAsNoteDesc:
				"直接把每张新卡片创建为独立笔记（看板上留一个链接），而不是行内复选框 — " +
				"并应用上面的模板与元数据入 frontmatter 选项，就像“转换为笔记”一样。",
			layout: "布局",
			layoutDesc:
				"列表，或按状态分组的看板。在看板上可以在列之间拖动卡片、拖动列标题重排、" +
				"用某列的眼睛图标隐藏它，用勾选图标让它自动完成卡片。" +
				"右键卡片可将其转换为独立笔记。",
			layoutList: "列表",
			layoutKanban: "看板",
			kanbanColumns: "看板列",
			kanbanHidden: (columns: string) => `已隐藏：${columns}`,
			kanbanDoneColumns: (columns: string) => `自动完成：${columns}`,
			kanbanCustomOrder: "已设置自定义列顺序。",
			showAll: "全部显示",
			resetColumns: "重置列顺序、可见性与完成列",
			doneStatuses: "视为已完成的状态",
			doneStatusesDesc:
				"TaskNotes 来源：哪些状态值被视为已完成（除非开启“显示已完成”，否则隐藏；" +
				"显示时加删除线），每行一个。留空则仅使用 设置 → Hearth 中的完成值。" +
				"例如加上 “canceled” 可把已取消的任务也算作已完成。",
			doneStatusesPlaceholder: "done\ncanceled",
			fields: "字段",
			fieldsFollowGlobal:
				"当前跟随 设置 → Hearth → 集成 中的字段。开启后可为此卡片单独设定。",
			fieldsCustomize: "自定义…",
			fieldsTitle: "任务字段",
			fieldsHint:
				"任务显示的一切，按顺序排列。字段由您定义：命名它、选择呈现方式，" +
				"并指定它读取的键。",
			fieldsEmpty: "还没有字段 — 任务只显示其文本。",
			fieldsNone: "无 — 任务只显示其文本。",
			fieldsApplyClose: "应用并关闭",
			fieldsApplyDesc: "应用但不关闭，以便继续调整。",
			fieldsReset: "移除所有字段",
			fieldUnnamed: "未命名字段",
			fieldDefaultName: (n: number) => `字段 ${n}`,
			fieldAdd: "添加字段",
			fieldEdit: "编辑字段",
			fieldRemove: "移除字段",
			fieldMoveUp: "上移",
			fieldMoveDown: "下移",
			fieldExpand: "展开",
			fieldCollapse: "折叠",
			fieldName: "名称",
			fieldNameDesc: "此字段的名称。仅在您于下方要求时才显示在任务上。",
			fieldNamePlaceholder: "例如 优先级",
			fieldShowName: "在任务上显示名称",
			fieldShowNameDesc: "在每个值前加上字段名（“优先级：紧急”）。",
			fieldDisplay: "呈现方式",
			fieldDisplayDesc:
				"此字段的值如何绘制。最后两种不在任务上显示任何内容，而是为整行或整张卡片" +
				"着色，且只能有一个字段使用它们。“带标签的彩色圆点”是优先级本身的形式，" +
				"提供给读取优先级的字段。描述始终自成一组子项。",
			fieldAmbientTaken: (name: string) =>
				`染色与光晕已被“${name}”占用。一个任务只有一个背景和一个外圈，` +
				`因此只能有一个字段使用它们。`,
			fieldAmbientIgnored: (name: string) =>
				`此字段不会着色："${name}"已经在为任务染色或加外圈，而这只能有一个字段使用。` +
				`请为其中之一改用其他呈现方式。`,
			fieldStyles: {
				pill: "标签",
				dot: "彩色圆点",
				dotlabel: "带标签的彩色圆点",
				text: "纯文本",
				hue: "为整个任务染色",
				glow: "任务周围光晕",
			},
			fieldOpacity: "强度",
			fieldOpacityDesc:
				"颜色施加的强度。只使用值本身的颜色 — 未设置颜色的值不会影响任务。",
			fieldKeys: "键",
			fieldKeysDesc:
				"此字段从哪里读取。每个有值的键都会显示一项，因此一个字段可以把若干条" +
				"元数据归到同一个名称下。",
			fieldKeysEmpty: "还没有键 — 此字段不会显示任何内容。",
			fieldNoKeys: "无键",
			fieldAddKey: "添加一个键",
			fieldAddKeyDesc:
				"Hearth 自己的值可以取到复选框行的优先级、看板列以及解析出的日期；" +
				"属性则读取 frontmatter 中的任何内容。",
			fieldAddBuiltin: "Hearth 读取的内容",
			fieldAddProperty: "Frontmatter 属性",
			fieldAddKeyTyped: "输入属性名…",
			fieldAddKeyPlaceholder: "属性名",
			fieldRemoveKey: "移除键",
			fieldPickProperty: "在您的笔记中找到的属性",
			fieldPickBuiltin: "Hearth 自行解析的值",
			fieldKeyAlreadyAdded: (key: string) => `“${key}”已经是此字段的一个键。`,
			fieldMapValues: "值与颜色",
			fieldMappedValues: (n: number) => `已映射 ${n} 个值`,
			fieldNoMappings: "值按原样显示",
			fieldMapHint:
				"为每个值指定更好看的标签和颜色。未映射的值仍会按原样显示。",
			fieldMapEmpty: "尚未映射任何值。",
			fieldDateKey: "作为日期显示",
			fieldIsDate: "视为日期",
			fieldIsDateDesc:
				"将此属性显示为相对日期（“明天”），按其是过去、今天还是将来着色，" +
				"并用日历进行编辑。",
			fieldDateHint:
				"日期没有固定的值可映射，因此按它落在何时着色。标签是可选的 — " +
				"留空则保留日期本身。",
			fieldDateLabelPlaceholder: "显示为（可选）",
			dateRelations: {
				"<today": "今天之前",
				today: "今天",
				">today": "今天之后",
			},
			fieldNotMappable: "此键没有可映射的离散值 — 它保留自身的格式。",
			fieldMatchPlaceholder: "例如 high",
			fieldLabelPlaceholder: "可选",
			fieldValueColumn: "您笔记中的值",
			fieldWhenColumn: "日期落在何时",
			fieldShownColumn: "在任务上显示为",
			fieldColorColumn: "颜色",
			fieldAddMapping: "添加一个值",
			fieldValuesFound: (n: number) => `来自您的笔记（${n}）`,
			fieldRemoveMapping: "移除值",
			fieldPickValue: "此键在仓库其他位置取过的值",
			fieldColor: "颜色",
			fieldColorCustom: "自定义颜色",
			fieldColorClear: "无颜色",
			colorNames: {
				"--color-red": "红色",
				"--color-orange": "橙色",
				"--color-yellow": "黄色",
				"--color-green": "绿色",
				"--color-cyan": "青色",
				"--color-blue": "蓝色",
				"--color-purple": "紫色",
				"--color-pink": "粉色",
			},
			sourceNames: {
				status: "状态（TaskNotes）",
				column: "看板列（Kanban）",
				priority: "优先级",
				start: "开始日期",
				scheduled: "计划日期",
				due: "到期日",
				doneDate: "完成日期",
				description: "描述",
			},
			showCompleted: "显示已完成",
			showCompletedKanbanDesc: "在看板上，已完成的任务始终出现在“已完成”列中。",
			maxTasks: "最多显示任务数",
			maxTasksDesc: "按到期日排序（逾期/最近的在前），然后按文件排序。",
			folders: "文件夹",
			scope: "范围",
			scopeAll: "整个仓库",
			scopeWhitelist: "仅这些文件夹",
			scopeBlacklist: "除这些文件夹之外的所有位置",
			foldersDesc: "每行一个文件夹路径。",
		},
		favorites: {
			heading: "收藏",
			headingDesc: "每张收藏卡片显示的笔记。",
			moveUp: "上移",
			moveDown: "下移",
			remove: "移除",
			addFavorite: "添加收藏",
		},
		clock: {
			style: "样式",
			styleDigital: "数字",
			styleAnalog: "指针",
			hourFormat: "时间格式",
			hourFormatAuto: "自动（区域设置）",
			hourFormat12: "12 小时制",
			hourFormat24: "24 小时制",
			showSeconds: "显示秒",
			showGreeting: "显示问候语",
			playful: "俏皮问候语",
			playfulDesc: "使用随机、俏皮的问候语，取代平实的那些。",
			greetingOverride: "自定义问候语",
			greetingOverrideDesc: "留空则使用自动问候语。",
			date: "日期",
			dateFull: "星期，日 月",
			dateLong: "星期，日 月 年",
			dateShort: "短格式（区域设置）",
			dateIso: "ISO（2026-06-29）",
			dateWeekday: "仅星期",
			dateCustom: "自定义格式…",
			dateNone: "隐藏",
			customFormat: "自定义日期格式",
			customFormatDesc: "moment.js 格式，例如 ddd D MMM 或 YYYY/MM/DD。",
			customFormatPlaceholder: "ddd D MMM",
		},
		calculator: {
			angleUnit: "角度单位",
			angleUnitDesc: "sin、cos 等三角函数假定的单位。",
			degrees: "度",
			radians: "弧度",
			keypad: "键盘",
			keypadDesc:
				"在卡片上显示屏幕键盘：基础（数字与运算）或科学（增加函数、幂和常数）。",
			keypadNone: "隐藏",
			keypadBasic: "基础",
			keypadScientific: "科学",
		},
		dataview: {
			language: "查询类型",
			languageDesc: "Dataview 查询语言（TABLE / LIST / TASK）或 DataviewJS 代码。",
			languageDql: "Dataview 查询（DQL）",
			languageJs: "DataviewJS",
			query: "查询",
			queryDqlDesc:
				"一条 Dataview 查询，写法与 ```dataview 代码块内部完全相同（不含围栏）。" +
				"运行时没有“当前笔记”，因此全局查询完全可用，但相对 this.file 的查询" +
				"没有可解析的文件。",
			queryJsDesc:
				"DataviewJS 代码，如同写在 ```dataviewjs 块内（不含围栏）。dv API 在作用域内。" +
				"会运行任意 JavaScript — 请只使用您信任的代码。",
			queryDqlPlaceholder:
				'TABLE file.mtime AS "Modified" FROM #project SORT file.mtime DESC',
			queryJsPlaceholder: "dv.list(dv.pages('#project').file.link)",
		},
		datacore: {
			language: "查询类型",
			languageDesc:
				"渲染为实时列表的 Datacore 查询，或自行绘制视图的 Datacore 脚本。",
			languageQuery: "Datacore 查询",
			languageJsx: "脚本（JSX）",
			languageJs: "脚本（JS）",
			languageTsx: "脚本（TSX）",
			languageTs: "脚本（TS）",
			query: "查询",
			queryDesc:
				"一条 Datacore 查询，例如 @page and #project。Hearth 会把匹配项渲染为" +
				"实时链接列表。运行时没有“当前笔记”，因此全局查询完全可用，" +
				"但相对文件的查询没有可解析的文件。",
			queryPlaceholder: "@page and #project",
			script: "脚本",
			scriptDesc:
				"一段 Datacore 脚本，如同写在 ```datacorejsx 块内（不含围栏）。" +
				"dc API 在作用域内，脚本返回要渲染的视图。会运行任意代码 — " +
				"请只使用您信任的代码。",
			scriptPlaceholder:
				"return function View() {\n\tconst pages = dc.useQuery(\"@page and #project\");\n\treturn <dc.List rows={pages} renderer={(p) => <dc.Link link={p.$link} />} />;\n}",
			pageSize: "每页行数",
			pageSizeDesc: "以此行数对生成的列表分页。0 表示一次显示所有匹配项。",
		},
		git: {
			missing: "Git 插件未启用",
			missingDesc:
				"此卡片是 Git 社区插件的一个窗口 — 请安装并启用它，并让它指向一个仓库，" +
				"卡片才能显示内容。",
			sections: "区块",
			actions: "按钮",
			destructive: "无法撤销。",
			removeAction: "移除此按钮",
			addAction: "添加一个按钮",
			addActionPlaceholder: "请选择…",
			actionStyle: "按钮样式",
			actionStyleDesc: "仅图标更紧凑；带文字则让宽卡片更易读。",
			actionStyles: {
				icon: "仅图标",
				labelled: "图标与文字",
			},
			committing: "提交",
			commitScope: "提交内容",
			commitScopeDesc: "“提交”和“提交并同步”按钮包含哪些文件。",
			commitScopes: {
				smart: "有已暂存文件时提交暂存内容，否则提交全部",
				all: "全部",
				staged: "仅已暂存的文件",
			},
			askForMessage: "询问提交信息",
			askForMessageDesc:
				"让 Git 插件每次都提示输入提交信息，与它的“…并指定信息”命令完全一致。",
			commitMessage: "提交信息",
			commitMessageDesc:
				"供此卡片的提交按钮使用。留空则使用 Git 插件自己的提交信息模板。",
			commitMessagePlaceholder: "vault backup: {{date}}",
			skipConfirm: "跳过确认",
			skipConfirmDesc:
				"直接执行放弃更改的操作，而不先询问。被放弃的更改无法恢复。",
			display: "显示",
			changeLimit: "显示的变更文件数",
			changeLimitDesc: "0 表示列出所有变更文件。",
			showPaths: "显示文件夹",
			showPathsDesc: "在每个变更文件名下显示其所在文件夹。",
			logLimit: "显示的提交数",
			logLimitDesc: "日志区块列出多少条最近提交。",
			refresh: "重新读取间隔",
			refreshDesc:
				"除跟随 Git 插件自身的更新之外，额外读取仓库的间隔（分钟）。" +
				"0 — 默认值 — 表示仅跟随那些更新，这已覆盖在 Obsidian 内完成的所有操作。",
		},
		operon: {
			view: "视图",
			viewDesc: "此卡片从 Operon 绘制什么。",
			viewList: "任务列表",
			viewBoard: "状态看板",
			viewAgenda: "日程",
			viewTimer: "计时器",
			scope: "范围",
			scopeDesc:
				"使用 Operon 自己的某个范围视图，或应用下方的筛选条件。" +
				"什么算逾期、什么算今天发生由 Operon 决定，因此随着其规则演进，" +
				"这些范围仍然正确。",
			scopeQuery: "自定义筛选",
			scopeNormal: "所有任务",
			scopeToday: "今天发生",
			scopeOverdue: "已逾期",
			scopeRecent: "最近处理过",
			createAs: "新任务",
			createAsDesc:
				"卡片上的“+”请求 Operon 创建什么。“Operon 默认”遵循它自己的设置；" +
				"另外两项则指定使用它已配置的哪个目标 — 当其中之一无法解析时很有用。" +
				"无论如何，任务最终放在哪里都由 Operon 决定。",
			createAsDefault: "Operon 默认",
			createAsInline: "行内，写在笔记中",
			createAsFile: "独立笔记",
			agendaDays: "未来天数",
			agendaDaysDesc: "日程覆盖多少天，包括今天。",
			count: "显示的任务数",
			countDesc: "列表中或每个看板列中的最大任务数。",
			pipelines: "流程",
			pipelinesDesc: "限定为这些 Operon 流程。不选则表示全部。",
			statuses: "状态",
			statusesDesc: "限定为这些 Operon 状态。不选则表示全部。",
			priorities: "优先级",
			prioritiesDesc: "限定为这些 Operon 优先级。不选则表示全部。",
			checkbox: "完成情况",
			checkboxDesc: "包含哪些完成状态。默认仅未完成的任务。",
			checkboxOpen: "未完成",
			checkboxDone: "已完成",
			checkboxCancelled: "已取消",
			text: "文本匹配",
			textDesc: "仅显示描述中包含此文本的任务。",
			sort: "排序",
			sortDesc:
				"列表以及每个看板列的顺序。未完成的任务始终排在已完成的之前。" +
				"开关可反转方向。",
			sortSmart: "智能（日期、优先级、时长）",
			sortDue: "日期",
			sortPriority: "优先级",
			sortCreated: "创建时间",
			sortAlpha: "按字母",
			showDue: "显示日期",
			showPriority: "显示优先级",
			showStatus: "显示状态",
			showRecurrence: "显示重复标记",
			showTracker: "显示运行中的计时器标记",
			showPinned: "显示置顶标记",
			showFile: "显示笔记名称",
			noOptions: "请先在面板上添加一张 Operon 卡片以加载这些选项",
		},
		rss: {
			feeds: "订阅源",
			namePlaceholder: "名称（可选）",
			urlPlaceholder: "https://example.com/feed.xml",
			addFeed: "添加订阅源",
			removeFeed: "移除订阅源",
			github: "从 GitHub 添加",
			githubDesc:
				"以 owner/repo 形式输入仓库（或粘贴其网址）并选择要关注的内容 — Hearth 会为您构建 Atom 源。",
			githubPlaceholder: "owner/repo",
			githubReleases: "发布",
			githubCommits: "提交",
			githubBoth: "发布与提交",
			githubAdd: "添加仓库",
			githubInvalid: "请以 owner/repo 形式输入仓库。",
			githubReleasesName: "{repo} 发布",
			githubCommitsName: "{repo} 提交",
			mergeAll: "合并的“全部”标签",
			mergeAllDesc: "在最前面添加一个标签，把所有订阅源合并为一个流，最新在前。",
			display: "显示",
			layout: "布局",
			layoutDesc: "每个条目的显示方式。",
			layoutList: "列表（标题 + 日期）",
			layoutCards: "卡片（摘要 + 图片）",
			layoutCompact: "紧凑（仅标题）",
			itemLimit: "每个源的条目数",
			itemLimitDesc: "显示多少条最近条目。",
			refresh: "自动刷新（分钟）",
			refreshDesc: "多久重新获取一次订阅源。0 = 仅在打开时获取。",
			showImages: "显示图片",
			showImagesDesc: "当源提供缩略图时显示它们。",
			showExcerpt: "显示摘要",
			showExcerptDesc: "在每个条目下显示一小段文本摘要。",
			showDate: "显示日期",
			showDateDesc: "显示每个条目的发布时间。",
		},
		weather: {
			location: "位置",
			search: "查找地点",
			searchDesc:
				"按名称搜索 — Hearth 会把坐标存在卡片上，因此这次查询只发生一次。",
			searchDisabled:
				"Hearth 设置中已禁用对外调用，地点搜索不可用。您仍可在下方输入坐标。",
			searchPlaceholder: "布拉格、里斯本、京都…",
			searchButton: "搜索",
			searchEmpty: "请输入要搜索的地名。",
			searchNoResults: "没有匹配该名称的地点。",
			usePlace: "使用",
			reuse: "复用某个位置",
			reuseDesc: "您某张天气卡片上已设置的地点。",
			reusePick: "选择一个位置…",
			unnamedPlace: "（未命名地点）",
			clearPlace: "清除位置",
			coordinates: "坐标",
			coordinatesDesc: "以十进制度表示的纬度和经度，如果您不想搜索的话。",
			latPlaceholder: "50.08",
			lonPlaceholder: "14.44",
			placeName: "标签",
			placeNameDesc: "卡片如何称呼此地点。",
			placeNamePlaceholder: "家",

			appearance: "外观",
			style: "样式",
			styleDesc: "卡片在屏幕上呈现多少预报内容。",
			styleMinimal: "极简（图形 + 温度）",
			styleCompact: "紧凑（一行）",
			styleDetailed: "详细（指标网格）",
			styleForecast: "预报（逐小时曲线）",
			styleArtistic: "艺术（绘制的天空）",
			animate: "让天空动起来",
			animateDesc: "飘动的云、落下的雨与闪烁的星。低功耗模式下始终关闭。",

			units: "单位",
			tempUnit: "温度",
			tempUnitC: "摄氏度（°C）",
			tempUnitF: "华氏度（°F）",
			windUnit: "风速",
			windUnitKmh: "千米每小时（km/h）",
			windUnitMs: "米每秒（m/s）",
			windUnitMph: "英里每小时（mph）",
			windUnitKn: "节（kn）",
			precipUnit: "降水量",
			precipUnitMm: "毫米（mm）",
			precipUnitInch: "英寸（in）",
			hourFormat: "时间格式",
			hourFormatAuto: "自动（区域设置）",
			hourFormat12: "12 小时制",
			hourFormat24: "24 小时制",

			display: "显示内容",
			showLocation: "地名",
			showCondition: "天况",
			showFeelsLike: "体感温度",
			showHighLow: "今日最高与最低",
			showHumidity: "湿度",
			showWind: "风",
			showPrecip: "降水",
			showPrecipDesc: "降雨概率与已降水量，以及逐小时概率。",
			showUv: "紫外线指数",
			showPressure: "气压",
			showSun: "日出与日落",
			showUpdated: "最后更新时间",
			hourlyCount: "未来小时数",
			hourlyCountDesc: "逐小时条覆盖多少小时。0 表示隐藏。",
			dailyCount: "未来天数",
			dailyCountDesc: "逐日预报覆盖多少天。0 表示隐藏。",
			refresh: "自动刷新（分钟）",
			refreshDesc: "多久重新获取一次预报。0 = 仅在打开时获取。",
		},
		jira: {
			host: "Jira 主机",
			hostDesc: "Jira 站点的源地址。发送个人访问令牌时必须使用 HTTPS。",
			hostPlaceholder: "https://jira.example.com",
			pat: "个人访问令牌",
			patDesc: "此卡片使用的 Bearer PAT。存储在 Hearth 的插件数据中。",
			apiBase: "API 基础路径",
			apiBaseDesc: "Jira REST 的相对路径。完整 URL 会被拒绝。",
			apiBasePlaceholder: "/rest/api/latest",
			savedFilter: "已保存的筛选器",
			savedFilterDesc: "加载您收藏的 Jira 筛选器，然后选择其中一个。",
			selectedFilter: (name: string) => `已选择：${name}`,
			loadFilters: "加载收藏的筛选器",
			chooseFilter: "选择一个筛选器…",
			noFavoriteFilters: "Jira 未返回任何收藏的筛选器。",
			loadFailed: "无法加载 Jira 筛选器。请检查主机、API 路径和令牌。",
			externalCallsDisabled:
				"Hearth 设置中已禁用对外调用，无法加载收藏的筛选器。",
			controls: "筛选控件",
			maxResults: "最大结果数",
			maxResultsDesc: "最多显示多少条筛选后的事项，上限 200。",
			refresh: "自动刷新（分钟）",
			refreshDesc: "多久刷新一次 Jira。0 = 仅在打开或手动刷新时。",
			cache: "缓存间隔（分钟）",
			cacheDesc: "成功的 Jira 响应在内存中保留多久。0 表示禁用缓存。",
		},
		leaf: {
			view: "要承载的视图",
			viewDesc:
				"来自核心或社区插件的已注册侧边面板视图（日历、大纲、标签面板、看板…）。" +
				"可选列表取决于启用了哪些插件。",
			pickPlaceholder: "选择一个视图…",
			none: "未找到可承载的视图。请启用一个提供侧边面板视图的插件。",
			file: "要显示的文件",
			fileDesc:
				"可选。在承载的视图中打开仓库中的特定文件 — Excalidraw 绘图、白板、笔记。" +
				"留空则承载不带文件的视图（某些视图此时会显示空白或“新建文件”界面）。",
			filePlaceholder: "例如 Drawings/Sketch.excalidraw.md",
			pickFile: "选择文件",
			clearFile: "清除文件",
			hideHeader: "隐藏视图标题栏",
			hideHeaderDesc:
				"隐藏所承载视图自己的标题栏 — 面包屑、前进/后退箭头和菜单。" +
				"当卡片只显示单个文件时很实用。",
			perfLabel: "性能",
			perfNote:
				"这是 Hearth 中开销最大的卡片。它在面板内实时运行另一个插件的完整视图，" +
				"因此只要面板处于打开状态，该插件自己的计时器、监听器和渲染就会一直运行 — " +
				"每多一张这样的卡片就再多一份开销。最多使用一两张，" +
				"并预期在配置一般的硬件上面板会变慢。",
			perfNoteTier:
				"您已降低性能档位。它无法让此卡片变慢 — 承载的视图自行管理 — " +
				"因此如果面板仍然吃力，这就是最值得移除的一张卡片。",
			note: "测试版",
			noteDesc:
				"在卡片内承载另一个插件的视图。某些视图预期自己在侧边栏中，" +
				"在这里可能渲染或尺寸异常。",
		},
		pet: {
			species: "动物",
			name: "名字",
			nameDesc: "怎么称呼它。留空则使用该动物的名称。",
			colors: "颜色",
			colorsDesc: "身体色与点缀色。轮廓、阴影和腹部由身体色推导得出。",
			colorsReset: "恢复此动物的原本颜色",
			size: "大小",
			sizeSmall: "小",
			sizeMedium: "中",
			sizeLarge: "大",
			metric: "以什么喂养",
			metricDesc: "宠物的心情跟随哪一项仓库活动。",
			metricModified: "编辑的笔记",
			metricCreated: "创建的笔记",
			moods: "心情",
			moodsDesc:
				"每种心情从哪里开始。这里的任何设置都不会让宠物生病或丢失 — " +
				"安静的仓库只会让它睡着，而任何写作都会立刻把它唤醒。",
			moodsReset: "恢复默认心情",
			excitedAt: "欢欣雀跃于",
			excitedAtDesc: "今天触及的笔记数达到或超过此值。",
			happyAt: "开心于",
			happyAtDesc: "今天触及的笔记数 — 您状态不错的一天。",
			contentAt: "满足于",
			contentAtDesc: "今天触及的笔记数。低于此值宠物就会觉得无聊。",
			sleepyAfter: "多久后入睡",
			sleepyAfterDesc:
				"仓库中任何位置都无改动的分钟数。无论心情如何、这一天多么美好，" +
				"宠物都会睡去，而任何活动都会把它唤醒并回到当天的状态。",
			pettedFor: "抚摸持续",
			pettedForDesc: "点击宠物后保证开心的分钟数。",
			nightSleep: "夜间",
			nightSleepDesc:
				"允许时钟做什么。深夜的清淡是时辰使然，而非被忽视 — " +
				"美好的一天仍会显示为美好的一天，而无论此处如何设置，抚摸都能唤醒宠物。",
			nightOff: "不做任何事 — 只看仓库",
			nightQuiet: "无聊或满足的宠物改为入睡",
			nightAlways: "夜间始终睡觉",
			nightWindow: "夜间开始于",
			nightWindowDesc: "使用您的本地时间。时段可以跨越午夜。",
			eyesFollow: "眼睛跟随指针",
			eyesFollowDesc: "无论此处如何设置，睡着的宠物都会闭着眼。",
			eyesOff: "从不",
			eyesCard: "仅在它自己的卡片上",
			eyesBoard: "面板上任何位置",
			showName: "显示名字",
			showMood: "显示心情",
			showActivity: "显示今天的活跃度",
		},
		colors: {
			heading: "颜色",
			headingDesc: "此卡片的强调色和背景色调。",
			clearAccent: "清除强调色",
			clearBackground: "清除背景",
			cardOpacity: "卡片不透明度",
			cardOpacityDesc: "半透明的卡片表面（覆盖面板默认值）。",
			cardBlur: "卡片模糊",
			cardBlurDesc:
				"此卡片背后的毛玻璃模糊（覆盖面板默认值）。需要不透明度低于 100%。",
			cardBorderWidth: "卡片边框",
			cardBorderWidthDesc:
				"此卡片的边框粗细（覆盖面板默认值）。0 表示移除边框以及标题下方的分隔线。",
			useDashboardDefault: "使用面板默认值",
		},
		size: {
			heading: "尺寸",
			headingDesc:
				"宽度（占面板的百分比）与高度（像素）。也可以直接拖动卡片的任意边或角。",
			widthAria: "宽度（占面板的百分比）",
			heightAria: "高度（像素）",
		},
		pin: {
			heading: "固定到所有面板",
			headingDesc: "在每个面板上显示此卡片，共享同一份定义和位置。",
		},
		copy: {
			heading: "复制到面板",
			headingDesc: "把此卡片的副本添加到另一个面板的末尾。",
			copy: "复制",
			copyTooltip: "把此卡片复制到所选面板",
		},
	},

	// ---- Card bodies (rendered content) --------------------------------
	cards: {
		empty: {
			searchNoQuery: "请在卡片设置中设定查询",
			searchNoMatches: "无匹配项",
			embedPickFile: "请在设置中选择要嵌入的文件",
			slideshowEmpty: "请在卡片设置中添加图片",
			slideshowFolderEmpty: "此文件夹中没有图片",
			embedEnableBases: "请启用核心插件 Bases 以嵌入 .base 文件",
			embedEnableCanvas: "请启用核心插件“白板”以嵌入白板",
			embedInstallExcalidraw: "请安装 Excalidraw 插件以嵌入绘图",
			dailyEnable: "请启用核心插件“日记”",
			scheduleNoSources:
				"请启用核心插件“日记”，或在此卡片的设置中订阅一个日历",
			webNoUrl: "请在设置中设定网址",
			bookmarksEnable: "请启用核心插件“书签”",
			bookmarksEmpty: "还没有书签",
			favoritesEmpty: "请在设置中添加收藏",
			recentEmpty: "没有最近文件",
			linksEmpty: "请在设置中添加链接",
			commandsEmpty: "请在卡片设置中添加命令",
			templaterEnable: "请启用 Templater 插件以从模板创建笔记",
			templaterEmpty: "请在卡片设置中添加一个模板",
			tasksEnable: "请启用 TaskNotes 插件，或把来源切换为复选框",
			tasksEmpty: "没有未完成的任务",
			tasksNoMatch: "没有任务符合筛选条件",
			kanbanNoBoard:
				"未找到 Kanban 看板 — 请在卡片设置中选择一篇看板笔记，或用 Kanban 插件创建一个",
			dataviewEnable: "请启用 Dataview 插件以运行查询",
			dataviewNoQuery: "请在卡片设置中设定 Dataview 查询",
			datacoreEnable: "请启用 Datacore 插件以运行查询",
			datacoreNoQuery: "请在卡片设置中设定 Datacore 查询",
			datacoreBadQuery: "Datacore 无法读取此查询",
			datacoreOneQuery:
				"一张卡片只运行一条查询 — 这里看起来有多条。请只保留想要的那一条，后面不要跟注释。",
			datacoreFailed: "Datacore 无法运行此卡片",
			gitEnable: "请启用 Git 插件以管理仓库的 Git 存储库",
			gitNotReady: "尚未打开任何存储库 — 请在 Git 插件中配置一个",
			rssNoSources: "请在卡片设置中添加订阅源",
			weatherNoLocation: "请在卡片设置中选择一个位置",
			renderFailed: "此卡片无法绘制 — 详情请查看控制台",
			leafPickView: "请在卡片设置中选择一个插件视图",
			leafViewMissing: "此视图不可用 — 请启用提供它的插件",
			operonEnable: "请启用 Operon 插件以显示其任务",
			operonDisabled: "Operon 集成已关闭 — 请在 设置 → Hearth → 集成 中开启",
			operonUnsupported:
				"Operon 的开发者 API 仅支持桌面端，且需要 Obsidian 1.12.2 或更新版本",
			operonPending:
				"请在 设置 → Operon → Core → General → Developer API Integrations 中批准 Hearth",
			operonSuspended:
				"Operon 暂停了 Hearth 的访问权限 — 请在 Operon 的 Developer API Integrations 中查看",
			operonRevoked:
				"Operon 访问权限已被撤销 — 请在 Operon 的 Developer API Integrations 中重新授予",
			operonBooting: "Operon 仍在启动中",
			operonError: "Operon 拒绝了连接",
			operonNoTasks: "没有匹配的 Operon 任务",
			operonNoAgenda: "此时段内没有安排",
			operonNoColumns: "没有可显示的 Operon 状态 — 请在卡片设置中选择一个流程",
		},
		operon: {
			loading: "正在读取 Operon…",
			untitled: "未命名任务",
			settling: "Operon 仍在就绪中",
			timerIdle: "没有正在运行的计时器",
			timerStarting: "正在启动…",
			timerStopping: "正在停止…",
			timerUnassigned: "未归属的时间",
			truncated: (shown: number, total: number) => `显示 ${shown} / ${total}`,
			readFailed: (reason: string) => `Operon 无法响应：${reason}`,
			/** Operon's own words, shown verbatim under an empty state so the
			 * problem is diagnosable instead of guessed at. */
			errorDetail: (code: string, reason: string) => (reason ? `${code} — ${reason}` : code),
			addTask: "添加任务",
			moveTo: "移动到",
			targetDaily: "Operon 设定为把新的行内任务放进今天的日记。",
			targetFile: (path: string) => `Operon 设定为把新的行内任务放进 ${path}。`,
			targetActive: "Operon 设定为把新的行内任务放进当前活动的文件。",
			targetAsk:
				"Operon 设定为每次询问新行内任务的去处，而面板卡片无法回答 — " +
				"请在此卡片上改选“独立笔记”。",
			targetNote: (folder: string) =>
				folder
					? `Operon 设定为把新任务创建为 ${folder} 中的笔记。`
					: "Operon 设定为把新任务创建为独立笔记。",
			addTaskPlaceholder: "需要做什么？",
			addTaskDue: "到期日",
			confirmTitle: "Operon 需要确认",
			/** Operon assessed the change and asked for consent; its own summary
			 * of what would happen is shown rather than Hearth's guess at it. */
			confirmMessage: (risk: string, effects: string) =>
				effects
					? `Operon 将此更改评定为 ${risk}：${effects}`
					: `Operon 将此更改评定为 ${risk}。`,
			confirmApply: "应用",
		},
		templater: {
			untitledTile: "新建笔记",
			vaultRoot: "默认位置",
			untitledNote: "Untitled",
			createsIn: (destination: string) => `将创建于 ${destination}`,
			promptTitle: "为新笔记命名",
			promptPlaceholder: "它是关于什么的？",
		},
		pet: {
			species: {
				cat: "猫",
				dog: "狗",
				bird: "鸟",
				fox: "狐狸",
				frog: "青蛙",
				blob: "软软",
			},
			moodExcited: "欢欣雀跃",
			moodHappy: "开心",
			moodContent: "满足",
			moodBored: "有点无聊",
			moodSleepy: "睡得香甜",
			moodNight: "已进入夜间睡眠",
			petHint: "点击抚摸",
			todayCount: (count: number, metric: "modified" | "created") =>
				metric === "created"
					? `今天新建了 ${count} 篇笔记`
					: `今天有 ${count} 篇笔记`,
			streak: (days: number) => `连续 ${days} 天`,
		},
		embed: {
			openFile: "打开此文件",
			editHint: "双击以编辑",
			emptyNotePlaceholder: "空笔记…",
			emptyNoteHint: "空笔记 — 双击以编辑",
			/** Switcher button label when a view has no file chosen yet. */
			viewFallback: (n: number) => `视图 ${n}`,
			switchTo: (label: string) => `切换到 ${label}`,
		},
		slideshow: {
			previous: "上一张图片",
			next: "下一张图片",
			pause: "暂停幻灯片",
			play: "继续播放幻灯片",
			openImage: "打开此图片",
		},
		text: {
			placeholder: "随手记点什么…",
		},
		calculator: {
			placeholder: "2 + 2、10 km to miles、10 € to USD…",
		},
		rss: {
			allTab: "全部",
			untitled: "（无标题）",
			loading: "正在加载订阅源…",
			empty: "此订阅源没有条目",
			error: "无法加载此订阅源",
			disabled: "订阅源已关闭（对外调用被禁用）",
			refresh: "刷新",
		},
		weather: {
			loading: "正在加载预报…",
			error: "无法加载预报",
			disabled: "天气已关闭（对外调用被禁用）",
			now: "现在",
			todayLabel: "今天",
			feelsLike: (temp: string) => `体感 ${temp}`,
			highLow: (high: string, low: string) => `最高 ${high} · 最低 ${low}`,
			updated: (time: string) => `更新于 ${time}`,
			humidity: "湿度",
			wind: "风",
			precip: "降水",
			uv: "紫外线",
			pressure: "气压",
			sunrise: "日出",
			sunset: "日落",
			/** Compass points, clockwise from north. Indexed by the bearing's
			 * eighth — keep all eight, in this order. */
			compass: ["北", "东北", "东", "东南", "南", "西南", "西", "西北"],
			/** One per WMO weather code group; see `weatherLabelKey`. */
			conditions: {
				clear: "晴",
				mainlyClear: "大致晴朗",
				partlyCloudy: "局部多云",
				overcast: "阴",
				fog: "雾",
				rimeFog: "冻雾",
				drizzle: "小雨",
				freezingDrizzle: "冻雨（毛毛雨）",
				rain: "雨",
				heavyRain: "大雨",
				freezingRain: "冻雨",
				showers: "阵雨",
				snow: "雪",
				heavySnow: "大雪",
				snowGrains: "米雪",
				snowShowers: "阵雪",
				thunderstorm: "雷暴",
				thunderstormHail: "雷暴伴有冰雹",
				unknown: "未知",
			},
		},
		jira: {
			controls: {
				status: "状态",
				assignee: "负责人",
				priority: "优先级",
				issueType: "事项类型",
				sprint: "迭代",
				fixVersion: "修复版本",
			},
			controlCount: (label: string, count: number) => `${label}（${count}）`,
			searchPlaceholder: "搜索选项…",
			searchAria: (label: string) => `搜索 ${label} 选项`,
			noOptions: "没有选项",
			noMatchingOptions: "没有匹配的选项",
			refresh: "刷新 Jira 事项",
			loading: "正在加载 Jira 事项…",
			error: "无法加载 Jira 事项",
			empty: "没有事项符合这些筛选条件",
			disabled: "Jira 已关闭（对外调用被禁用）",
			notConfigured: "请在卡片设置中配置 Jira 主机、令牌和已保存的筛选器",
		},
		git: {
			sections: {
				status: "存储库状态",
				actions: "按钮",
				changes: "变更文件",
				log: "最近提交",
			},
			actions: {
				commitAndSync: "提交并同步",
				commit: "提交",
				push: "推送",
				pull: "拉取",
				fetch: "获取",
				stageAll: "全部暂存",
				unstageAll: "全部取消暂存",
				discardAll: "放弃所有更改",
				switchBranch: "切换分支",
				sourceControl: "打开源代码管理",
				history: "打开历史",
			},
			refresh: "重新读取存储库",
			noBranch: "无分支",
			noUpstream: "无上游分支",
			staged: "已暂存",
			unstaged: "已更改",
			conflicted: "有冲突",
			unpushed: "未推送的提交",
			clean: "所有内容都已提交",
			noChanges: "没有任何更改",
			noCommits: "还没有提交",
			noMessage: "（无提交信息）",
			lastCommit: (when: string) => `最后提交于 ${when}`,
			more: (count: number) => `还有 ${count} 个…`,
			openSourceControl: "打开源代码管理",
			openHistory: "打开历史",
			openDiff: "打开差异",
			stageFile: "暂存",
			unstageFile: "取消暂存",
			discardFile: "放弃更改",
			confirmTitle: "放弃更改？",
			confirmDiscard:
				"仓库中所有未提交的更改都将被丢弃。此操作无法撤销。",
			confirmDiscardFile: (name: string) =>
				`对“${name}”的未提交更改将被丢弃。此操作无法撤销。`,
			confirmDiscardButton: "放弃",
			unsupported: "当前版本的 Git 插件不支持该操作",
		},
		daily: {
			createToday: "创建今天的笔记",
			openToday: "打开今天的笔记",
			noNoteYet: "今天还没有笔记",
		},
		heatmap: {
			less: "少",
			more: "多",
		},
		calendar: {
			previousMonth: "上个月",
			nextMonth: "下个月",
			backToToday: "回到今天",
			dayEdited: (date: string, count: number) => `${date}：编辑了 ${count} 篇`,
			dayTasks: (date: string, count: number) => `${date}：${count} 个任务`,
			dayMetric: (date: string, count: number, metric: string) =>
				`${date}：${count} ${metric}`,
			dayEvents: (date: string, count: number) => `${date}：${count} 个事件`,
			agendaNoNote: "无笔记",
			allDay: "全天",
			untitledEvent: "（无标题）",
			openDailyNote: "打开日记",
			createDailyNote: "创建日记",
			eventsHeading: "事件",
			eventNotes: "笔记",
			createEventNote: "创建笔记",
			openEventNote: "打开笔记",
			taskNotesSource: "TaskNotes",
			taskDue: "到期",
			taskTimeblock: "时间块",
			taskComplete: "完成",
			taskReopen: "重新打开",
			taskEstimate: (minutes: number) =>
				minutes >= 60
					? `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分` : ""}`
					: `${minutes} 分`,
			openTaskNote: "打开任务",
		},
		schedule: {
			previous: "上一个",
			next: "下一个",
			today: "今天",
			views: {
				month: "月",
				week: "周",
				day: "日",
				list: "列表",
			},
			more: (count: number) => `还有 ${count} 个`,
			listEmpty: (days: number) => `未来 ${days} 天没有任何安排`,
		},
		stats: {
			notes: "笔记",
			attachments: "附件",
			folders: "文件夹",
			tags: "标签",
			dayStreak: "连续天数",
			daysUsing: "使用 Obsidian 的天数",
		},
		web: {
			openInBrowser: "在浏览器中打开",
			mayRefuse: "此站点可能拒绝被嵌入。",
		},
		bookmarks: {
			untitled: "未命名",
		},
		tasks: {
			createNewTask: "新建任务",
			toDo: "待办",
			done: "已完成",
			statusInProgress: "进行中",
			noStatus: "无状态",
			hideColumn: (label: string) => `隐藏“${label}”列`,
			markOccurrence: "将今天这次标记为已完成",
			recurring: "重复",
			addCard: "添加卡片",
			addCardPlaceholder: "卡片文本…",
			createAsNote: "创建为笔记",
			noteBody: "笔记正文",
			convertToNote: "转换为笔记",
			editMetadata: "编辑日期与优先级",
			deleteCard: "删除卡片",
			openNote: "打开笔记",
			deleteTask: "删除任务",
			deleteTaskConfirm: "要删除此任务吗？这会将它从笔记中移除。",
			noMetadata: "未设置日期或优先级。",
			save: "保存",
			cancel: "取消",
			setDoneColumn: (label: string) => `把“${label}”标记为完成列`,
			unsetDoneColumn: (label: string) => `不再让“${label}”自动完成卡片`,
			dueDate: "到期日",
			startDate: "开始日期",
			scheduledDate: "计划日期",
			doneDate: "完成日期",
			recurrenceLabel: "重复",
			recurrenceNever: "从不",
			recurrenceEvery: "每",
			recurrenceInterval: "重复间隔",
			recurrenceUnits: {
				day: "每天",
				week: "每周",
				month: "每月",
				year: "每年",
			},
			taskCount: (n: number) => `${n} 个任务`,
			description: "描述",
			descriptionPlaceholder: "备注…（纯文本）",
			renameColumnHint: "双击以重命名",
			editTitle: "编辑标题",
			editTitleHint: "双击以编辑",
			titlePlaceholder: "卡片标题…",
			priority: "优先级",
			priorityNone: "无优先级",
			priorityHighest: "最高优先级",
			priorityHigh: "高优先级",
			priorityMedium: "中优先级",
			priorityLow: "低优先级",
			priorityLowest: "最低优先级",
			sort: "排序",
			sortReverse: "反转顺序",
			sortLabels: {
				smart: "智能",
				due: "到期日",
				priority: "优先级",
				created: "创建日期",
				alpha: "按字母",
			},
			sortCustom: "自定义",
			sortCustomOption: "自定义排序…",
			sortTitle: "自定义排序",
			sortHint:
				"按这些规则依次排序 — 第一条为主排序，之后每一条用于打破平局。",
			sortFields: {
				due: "到期日",
				scheduled: "计划日期",
				priority: "优先级",
				created: "创建日期",
				alpha: "按字母",
				status: "状态",
			},
			sortAscending: "升序",
			sortDescending: "降序",
			sortLevelFirst: "排序依据",
			sortLevelNext: "然后依据",
			sortAddRule: "添加规则",
			sortRemoveRule: "移除规则",
			sortMoveUp: "上移",
			sortMoveDown: "下移",
			sortEmpty: "还没有规则 — 请添加一条，否则将使用默认的智能排序。",
			filter: "筛选",
			filterTitle: "筛选任务",
			filterPresets: {
				overdue: "已逾期",
				today: "今天",
				week: "本周",
				highPriority: "高优先级",
				noDate: "无日期",
			},
			filterDue: "日期",
			filterDueDesc: "匹配任务的到期日或计划日期。",
			filterDueAny: "任意",
			filterDueHasDate: "有日期",
			filterPriority: "优先级",
			filterPriorityLevels: {
				high: "高",
				medium: "中",
				low: "低",
				none: "无",
			},
			filterStatus: "状态",
			filterContexts: "上下文",
			filterProjects: "项目",
			filterText: "文本包含",
			filterTextPlaceholder: "搜索任务文本…",
			filterApply: "应用",
			filterClear: "清除",
			valueChange: "更改值",
			dateTitle: "设置日期",
			dateOn: "日期",
			dateToday: "今天",
			dateTomorrow: "明天",
			dateNextWeek: "下周",
			dateClear: "清除日期",
			valueCustom: "其他值…",
			valueCustomTitle: "设置值",
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
		repeats: "重复",
		units: {
			day: "天",
			week: "周",
			month: "个月",
			year: "年",
		},
		everyOne: (unit: string) => `每 1 ${unit}重复`,
		everyMany: (count: number, unit: string) => `每 ${count} ${unit}重复`,
	},

	// ---- Clock greetings -----------------------------------------------
	clock: {
		greetingMorning: "早上好",
		greetingAfternoon: "下午好",
		greetingEvening: "晚上好",
		// One array per time-of-day bucket (see greetingBucket in cards.ts):
		// late night, early morning, morning, afternoon, evening, late evening.
		playfulGreetings: [
			[
				"深夜加班？",
				"熬到这个点了？",
				"仓库从不睡觉，是吧？",
				"你其实该去睡了。",
			],
			[
				"这么早就开工了？",
				"跟太阳一起起床？",
				"总得先来杯咖啡吧？",
				"这个点还起得来，佩服。",
			],
			[
				"早。我们就假装很有效率吧。",
				"笔记想你了。",
				"又回来干活了。",
				"新的一天，还是这个仓库。",
			],
			[
				"下午的苦干时间。",
				"还在忙？",
				"午饭后还想高产 — 挺有志气。",
				"大概过了一半了吧。",
			],
			[
				"又是你？",
				"晚上好。收尾了，还是才刚开始？",
				"再写一条就好，对吧？",
				"这一天要结束了。你还没有。",
			],
			[
				"又熬夜了？",
				"一天结束了，想法还没有。",
				"你不是该休息了吗？",
				"两头点蜡烛，可真够拼的。",
			],
		] as string[][],
	},

	// ---- Card templates (Add card menu) --------------------------------
	templates: {
		note: "嵌入笔记",
		image: "嵌入图片",
		slideshow: "幻灯片",
		base: "嵌入 base",
		excalidraw: "Excalidraw 绘图",
		canvas: "嵌入白板",
		daily: "日记（今天）",
		web: "网页（iframe）",
		bookmarks: "书签",
		favorites: "收藏",
		recent: "最近文件",
		links: "链接 / 启动台",
		commands: "命令",
		templater: "从模板新建笔记",
		clock: "时钟与问候",
		tasks: "任务",
		calendar: "迷你日历",
		schedule: "日历",
		stats: "仓库统计",
		search: "查询",
		searchbar: "搜索栏",
		heatmap: "活跃度热力图",
		text: "文本 / 速记",
		calculator: "计算器",
		dataview: "Dataview 查询",
		datacore: "Datacore 查询",
		rss: "RSS 订阅",
		jira: "Jira 筛选器",
		weather: "天气",
		git: "Git",
		"operon-tasks": "Operon 任务",
		"operon-board": "Operon 看板",
		"operon-agenda": "Operon 日程",
		"operon-timer": "Operon 计时器",
		leaf: "插件视图（测试版）",
		pet: "宠物",
	},

	/** One line per template, shown under its name in the add-card picker and
	 * searched alongside it. Say what the card *shows* — the name already says
	 * what it is called. */
	templateDescriptions: {
		note: "任意笔记，在面板上实时渲染",
		image: "仓库中的一张图片，铺满整张卡片",
		slideshow: "来自列表或文件夹的图片，按计时器轮播",
		base: "一个 .base 文件，由 Obsidian 的 Bases 渲染",
		excalidraw: "一幅 Excalidraw 绘图，支持原生平移与缩放",
		canvas: "一块可以就地平移的白板",
		daily: "始终是今天的笔记，首次点击时创建",
		web: "iframe 中的网页，按计时器刷新",
		bookmarks: "您的 Obsidian 书签，一键可达",
		favorites: "您在 Hearth 中标星的笔记",
		recent: "您最近打开的文件",
		links: "链接、笔记与文件夹的启动台",
		commands: "运行 Obsidian 命令的按钮",
		templater: "从 Templater 模板在您指定的文件夹中创建笔记的按钮",
		clock: "时间、日期与一句问候",
		tasks: "来自仓库的复选框，以列表或看板呈现",
		calendar: "一个月一目了然，并显示您的笔记",
		schedule: "月、周、日和列表视图，并显示您的事件",
		stats: "仓库的笔记数、字数和文件数",
		search: "一条保持实时的已保存查询",
		searchbar: "面板上的搜索框，带框或无框",
		heatmap: "一整年的仓库活跃度，逐日呈现",
		text: "常驻面板上的草稿本",
		calculator: "计算、单位换算与汇率",
		dataview: "一条 DQL 或 DataviewJS 查询，由 Dataview 渲染",
		datacore: "一条 Datacore 查询或脚本",
		rss: "您关注的订阅源的头条",
		jira: "来自 Jira 筛选器或 JQL 搜索的事项",
		weather: "您所选地点的天气预报",
		git: "存储库状态，并可提交、拉取和推送",
		"operon-tasks": "您的 Operon 任务，按您的喜好筛选",
		"operon-board": "把 Operon 的流程状态作为看板列",
		"operon-agenda": "接下来几天的 Operon 工作，逐日呈现",
		"operon-timer": "Operon 正在运行的时间追踪，实时跳动",
		leaf: "在卡片中承载另一个插件的侧边面板",
		pet: "住在您面板上的小伙伴",
	},

	// ---- Add-card picker -----------------------------------------------
	cardPicker: {
		title: "添加卡片",
		searchPlaceholder: "搜索卡片…",
		allCards: "所有卡片",
		noMatches: "没有匹配的卡片。",
		/** Badge on a card whose plugin (or other dependency) is missing. */
		requires: (name: string) => `需要 ${name}`,
		missingNotice: (name: string) =>
			`${name} 不可用 — 在它可用之前，卡片会显示一条提示。`,
		installLink: (name: string) => `安装 ${name}`,
		categories: {
			notes: "笔记与文件",
			planning: "计划",
			vault: "仓库洞察",
			tools: "工具",
			integrations: "集成",
			fun: "趣味",
		},
		request: {
			railLabel: "申请一种卡片",
			heading: "申请一种卡片",
			intro:
				"缺了什么？请描述您希望 Hearth 拥有的卡片 — 它应该显示什么，" +
				"数据又从哪里来。",
			footPrompt: "没找到您想要的？",
			footLink: "申请一种卡片",
			githubTitle: "提交 GitHub issue",
			githubDesc:
				"公开、可检索，也是讨论这个想法的最佳场所。需要 GitHub 账号。",
			githubAction: "打开 GitHub",
			emailTitle: "发送邮件",
			emailDesc: "如果您不想用 GitHub，可以直接发给维护者。会打开您的邮件应用。",
			emailAction: "打开邮件",
			prefilledNote:
				"两种方式都会预填几个提示问题以及您的 Hearth 和 Obsidian 版本 — 发送前可任意修改。",
		},
	},

	// ---- File-type filter labels ---------------------------------------
	fileTypes: {
		folders: "文件夹",
		markdown: "笔记",
		excalidraw: "Excalidraw",
		canvas: "白板",
		bases: "Bases",
		images: "图片",
		videos: "视频",
		audio: "音频",
		pdf: "PDF",
		documents: "文档",
		spreadsheets: "表格",
		presentations: "幻灯片",
		threeD: "3D",
		other: "其他",
	},

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "这不是有效的 JSON。",
		notAnObject: "布局必须是一个 JSON 对象。",
		noValidDashboards: "布局中没有有效的面板。",
		noValidCards: "布局中没有有效的卡片。",
		notAHearthLayout: '这不是 Hearth 布局 — 未找到 "dashboards" 或 "cards" 数组。',
		notHearthSettings:
			'这不是 Hearth 设置备份 — 未找到 "hearthSettings" 标记或布局。',
	},
};
