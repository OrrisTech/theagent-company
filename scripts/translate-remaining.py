#!/usr/bin/env python3
"""Translate all remaining untranslated strings in zh.json."""

import json

en = json.load(open('ui/src/i18n/en.json'))
zh = json.load(open('ui/src/i18n/zh.json'))

# Complete translation map for all untranslated keys
# Format: dotted.key.path = "Chinese translation"
TRANSLATIONS = {
    # models
    "models.baseUrl": "基础 URL",
    # cron
    "cron.agent": "智能体",
    # pages.performance
    "pages.performance.agent": "智能体",
    # agentDetail
    "agentDetail.last14Days": "最近 14 天",
    "agentDetail.iconName": "图标名称...",
    "agentDetail.command": "命令：",
    "agentDetail.workingDir": "工作目录：",
    "agentDetail.branch": "分支：",
    "agentDetail.baseRef": "基础引用：",
    "agentDetail.worktree": "工作树：",
    "agentDetail.repoRoot": "仓库根目录：",
    "agentDetail.cleanup": "清理：",
    "agentDetail.viewDetailsRarr": "查看详情 &rarr;",
    "agentDetail.seeAllRarr": "查看全部 &rarr;",
    "agentDetail.instructionsFile": "指令文件",
    "agentDetail.availableSkills": "可用技能",
    "agentDetail.loadingAvailableSkills": "加载可用技能…",
    "agentDetail.noLocalSkillsWereFound": "未找到本地技能。",
    "agentDetail.adapter": "适配器：",
    "agentDetail.error": "错误：",
    # agentConfigForm
    "agentConfigForm.createSecretFromCurrentPlainValue": "从当前明文值创建密钥",
    "agentConfigForm.storeValueAsSecretAndReplaceWithReference": "将值存储为密钥并替换为引用",
    "agentConfigForm.agentName": "智能体名称",
    "agentConfigForm.describeWhatThisAgentCanDo": "描述此智能体能做什么...",
    "agentConfigForm.optionalInitialSetupPromptForTheFirstRun": "可选的首次运行初始化提示词",
    "agentConfigForm.key": "密钥",
    "agentConfigForm.adapterType": "适配器类型",
    "agentConfigForm.workingDirectory": "工作目录",
    "agentConfigForm.bootstrapPromptLegacy": "引导提示词（旧版）",
    "agentConfigForm.extraArgsCommaSeparated": "额外参数（逗号分隔）",
    "agentConfigForm.environmentVariables": "环境变量",
    "agentConfigForm.timeoutSec": "超时时间（秒）",
    "agentConfigForm.interruptGracePeriodSec": "中断宽限期（秒）",
    "agentConfigForm.heartbeatOnInterval": "定时心跳",
    "agentConfigForm.wakeOnDemand": "按需唤醒",
    "agentConfigForm.cooldownSec": "冷却时间（秒）",
    "agentConfigForm.maxConcurrentRuns": "最大并发运行数",
    "agentConfigForm.thinkingEffort": "思考力度",
    "agentConfigForm.promptTemplateIsReplayedOnEveryHeartbeatKeepItComp": "提示词模板在每次心跳时重播。保持简洁动态，避免重复的令牌消耗和缓存流失。",
    "agentConfigForm.permissionsAmpConfiguration": "权限与配置",
    "agentConfigForm.bootstrapPromptIsLegacyAndWillBeRemovedInAFutureRe": "引导提示词已弃用，将在未来版本中移除。建议将内容迁移到智能体的提示词模板或指令文件中。",
    # costs
    "costs.refundsOffsetsAndCreditReturns": "退款、抵扣和信用返还",
    "costs.debitMinusCreditForTheSelectedPeriod": "所选期间的借方减去贷方",
    "costs.estimatedDebitsThatAreNotYetInvoiceAuthoritative": "尚未开票的预估借方",
    "costs.openSoftOrHardThresholdCrossings": "未处理的软/硬阈值触发",
    "costs.budgetOverrideApprovalsAwaitingBoardAction": "等待董事会审批的预算超支",
    "costs.agentHeartbeatsBlockedByBudget": "因预算限制被阻塞的智能体心跳",
    "costs.projectExecutionBlockedByBudget": "因预算限制被阻塞的项目执行",
    "costs.debits": "借方",
    "costs.credits": "贷方",
    "costs.net": "净额",
    "costs.estimated": "预估",
    "costs.inferenceSpend": "推理支出",
    "costs.financeNet": "财务净额",
    "costs.financeEvents": "财务事件",
    "costs.activeIncidents": "活跃事件",
    "costs.pendingApprovals": "待审批",
    "costs.pausedAgents": "已暂停的智能体",
    "costs.pausedProjects": "已暂停的项目",
    "costs.noFinanceEventsYetAddAccountLevelChargesOnceBiller": "暂无财务事件。当账单系统的发票或信用到账后，账户级别费用将会显示。",
    "costs.financeLedger": "财务账本",
    "costs.accountLevelChargesThatDoNotMapToASingleInferenceR": "无法关联到单个推理请求的账户级别费用。",
    "costs.allProviders": "所有提供商",
    "costs.allBillers": "所有账单方",
    "costs.inferenceSpendPlatformFeesCreditsAndLiveQuotaWindo": "推理支出、平台费用、信用额度和实时配额窗口。",
    "costs.budgets": "预算",
    "costs.providers": "提供商",
    "costs.billers": "账单方",
    "costs.finance": "财务",
    "costs.selectAStartAndEndDateToLoadData": "选择起止日期以加载数据。",
    "costs.inferenceLedger": "推理账本",
    "costs.requestScopedInferenceSpendForTheSelectedPeriod": "所选期间的请求级别推理支出。",
    "costs.byAgent": "按智能体",
    "costs.whatEachAgentConsumedInTheSelectedPeriod": "所选期间各智能体的消耗情况。",
    "costs.noCostEventsYet": "暂无费用事件。",
    "costs.byProject": "按项目",
    "costs.runCostsAttributedThroughProjectLinkedIssues": "通过项目关联任务归因的运行费用。",
    "costs.noProjectAttributedRunCostsYet": "暂无项目归因的运行费用。",
    "costs.budgetControlPlane": "预算控制面板",
    "costs.hardStopSpendLimitsForAgentsAndProjectsProviderSub": "智能体和项目的硬性支出限制。提供商订阅配额独立管理，显示在提供商下方。",
    "costs.resolveHardStopsHereByRaisingTheBudgetOrExplicitly": "在此处通过提高预算或明确保持暂停状态来解决硬性停止。",
    "costs.noBudgetPoliciesYetSetAgentAndProjectBudgetsFromTh": "暂无预算策略。从详情页设置智能体和项目预算，或使用现有的公司月度预算控制。",
    "costs.noCostEventsInThisPeriod": "此期间无费用事件。",
    "costs.noBillableEventsInThisPeriod": "此期间无计费事件。",
    "costs.byBiller": "按账单方",
    "costs.accountLevelFinancialEventsGroupedByWhoChargedOrCr": "按收费方分组的账户级别财务事件。",
    "costs.noFinanceEventsYet": "暂无财务事件。",
    # projectProperties
    "projectProperties.projectName": "项目名称",
    "projectProperties.addADescription": "添加描述...",
    "projectProperties.paperclipWorktrees": ".paperclip/worktrees",
    "projectProperties.lead": "负责人",
    "projectProperties.codebaseHelp": "代码库帮助",
    "projectProperties.clearRepo": "清除仓库",
    "projectProperties.clearLocalFolder": "清除本地文件夹",
    "projectProperties.executionWorkspacesHelp": "执行工作区帮助",
    "projectProperties.saving": "保存中",
    "projectProperties.goal": "目标",
    "projectProperties.allGoalsLinked": "所有目标已关联。",
    "projectProperties.codebase": "代码库",
    "projectProperties.repoIdentifiesTheSourceOfTruthLocalFolderIsTheDefa": "仓库为真实来源。本地文件夹是智能体编写代码的默认位置。",
    "projectProperties.repo": "仓库",
    "projectProperties.changeRepo": "更换仓库",
    "projectProperties.notSet": "未设置。",
    "projectProperties.setRepo": "设置仓库",
    "projectProperties.localFolder": "本地文件夹",
    "projectProperties.paperclipManagedFolder": "Paperclip 托管的文件夹。",
    "projectProperties.additionalLegacyWorkspaceRecordsExistOnThisProject": "此项目存在额外的旧版工作区记录。Paperclip 正在使用主工作区作为代码库视图。",
    "projectProperties.failedToSaveWorkspace": "保存工作区失败。",
    "projectProperties.failedToDeleteWorkspace": "删除工作区失败。",
    "projectProperties.failedToUpdateWorkspace": "更新工作区失败。",
    "projectProperties.executionWorkspaces": "执行工作区",
    "projectProperties.projectOwnedDefaultsForIsolatedIssueCheckoutsAndEx": "项目级别的隔离任务检出和执行工作区行为默认配置。",
    "projectProperties.enableIsolatedIssueCheckouts": "启用隔离任务检出",
    "projectProperties.letIssuesChooseBetweenTheProjectSPrimaryCheckoutAn": "允许任务在项目主检出和隔离执行工作区之间选择。",
    "projectProperties.newIssuesDefaultToIsolatedCheckout": "新任务默认使用隔离检出",
    "projectProperties.ifDisabledNewIssuesStayOnTheProjectSPrimaryCheckou": "如果禁用，新任务将留在项目主检出处，除非有人选择使用隔离模式。",
    "projectProperties.gitWorktree": "Git 工作树",
    "projectProperties.branchTemplate": "分支模板",
    "projectProperties.worktreeParentDir": "工作树父目录",
    "projectProperties.provisionCommand": "配置命令",
    "projectProperties.teardownCommand": "清理命令",
    # pluginSettings
    "pluginSettings.loadingPluginDetails": "加载插件详情中...",
    "pluginSettings.about": "关于",
    "pluginSettings.categories": "分类",
    "pluginSettings.thisPluginDoesNotRequireAnySettings": "此插件不需要任何设置。",
    "pluginSettings.runtimeDashboard": "运行时仪表盘",
    "pluginSettings.workerProcessScheduledJobsAndWebhookDeliveries": "工作进程、定时任务和 Webhook 投递",
    "pluginSettings.workerProcess": "工作进程",
    "pluginSettings.pid": "PID",
    "pluginSettings.uptime": "运行时间",
    "pluginSettings.pendingRpcs": "待处理 RPC",
    "pluginSettings.crashes": "崩溃次数",
    "pluginSettings.lastCrash": "最近崩溃",
    "pluginSettings.noWorkerProcessRegistered": "未注册工作进程。",
    "pluginSettings.recentJobRuns": "最近任务运行",
    "pluginSettings.noJobRunsRecordedYet": "暂无任务运行记录。",
    "pluginSettings.recentWebhookDeliveries": "最近 Webhook 投递",
    "pluginSettings.noWebhookDeliveriesRecordedYet": "暂无 Webhook 投递记录。",
    "pluginSettings.runtimeDiagnosticsAreUnavailableRightNow": "运行时诊断暂时不可用。",
    "pluginSettings.recentLogs": "最近日志",
    "pluginSettings.healthStatus": "健康状态",
    "pluginSettings.checkingHealth": "检查健康状态中...",
    "pluginSettings.overall": "整体",
    "pluginSettings.lifecycle": "生命周期",
    "pluginSettings.healthChecksRunOnceThePluginIsReady": "健康检查在插件就绪后运行一次。",
    "pluginSettings.pluginId": "插件 ID",
    "pluginSettings.pluginKey": "插件密钥",
    "pluginSettings.npmPackage": "NPM 包",
    "pluginSettings.noSpecialPermissionsRequested": "未请求特殊权限。",
    "pluginSettings.loadingConfiguration": "加载配置中...",
    # onboardingWizard
    "onboardingWizard.acmeCorp": "示例公司",
    "onboardingWizard.ceo": "CEO",
    "onboardingWizard.anthropicApiKey": "ANTHROPIC_API_KEY",
    "onboardingWizard.respondWithHello": "回复 hello。",
    "onboardingWizard.claudeCode": "Claude Code",
    "onboardingWizard.codex": "Codex",
    "onboardingWizard.geminiCli": "Gemini CLI",
    "onboardingWizard.openCode": "OpenCode",
    "onboardingWizard.cursor": "Cursor",
    "onboardingWizard.openClawGateway": "OpenClaw Gateway",
    "onboardingWizard.webhookUrl": "Webhook URL",
    # pluginManager
    "pluginManager.uninstall": "卸载",
    "pluginManager.paperclipaiPluginExample": "@paperclipai/plugin-example",
    "pluginManager.loadingPlugins": "加载插件中...",
    "pluginManager.failedToLoadPlugins": "加载插件失败。",
    "pluginManager.installPlugin": "安装插件",
    "pluginManager.enterTheNpmPackageNameOfThePluginYouWishToInstall": "输入要安装的插件的 npm 包名。",
    "pluginManager.pluginsAreAlpha": "插件处于 Alpha 阶段。",
    "pluginManager.thePluginRuntimeAndApiSurfaceAreStillChangingExpec": "插件运行时和 API 接口仍在变化中。在此功能稳定之前，可能会有破坏性变更。",
    "pluginManager.examples": "示例",
    "pluginManager.loadingBundledExamples": "加载内置示例中...",
    "pluginManager.failedToLoadBundledExamples": "加载内置示例失败。",
    "pluginManager.noBundledExamplePluginsWereFoundInThisCheckout": "在当前检出中未找到内置示例插件。",
    "pluginManager.example": "示例",
    "pluginManager.notInstalled": "未安装",
    "pluginManager.installAPluginToExtendFunctionality": "安装插件以扩展功能。",
    "pluginManager.pluginError": "插件错误",
    "pluginManager.viewFullError": "查看完整错误",
    "pluginManager.uninstallPlugin": "卸载插件",
    "pluginManager.errorDetails": "错误详情",
    "pluginManager.whatErrored": "出错内容",
    "pluginManager.fullErrorOutput": "完整错误输出",
    # newIssueDialog
    "newIssueDialog.removeDocument": "移除文档",
    "newIssueDialog.removeAttachment": "移除附件",
    "newIssueDialog.issueTitle": "任务标题",
    "newIssueDialog.defaultModel": "默认模型",
    "newIssueDialog.addDescription": "添加描述...",
    "newIssueDialog.noAssigneesFound": "未找到负责人。",
    "newIssueDialog.newIssue": "新建任务",
    "newIssueDialog.for": "为",
    "newIssueDialog.executionWorkspace": "执行工作区",
    "newIssueDialog.controlWhetherThisIssueRunsInTheSharedWorkspaceANe": "控制此任务在共享工作区、新的隔离工作区还是已有工作区中运行。",
    "newIssueDialog.chooseAnExistingWorkspace": "选择已有工作区",
    "newIssueDialog.enableChromeChrome": "启用 Chrome (--chrome)",
    "newIssueDialog.labels": "标签",
    "newIssueDialog.upload": "上传",
    "newIssueDialog.startDate": "开始日期",
    "newIssueDialog.dueDate": "截止日期",
    "newIssueDialog.discardDraft": "丢弃草稿",
    "newIssueDialog.creatingIssue": "创建任务中...",
    # issueProperties
    "issueProperties.searchLabels": "搜索标签...",
    "issueProperties.newLabel": "新建标签",
    "issueProperties.searchAssignees": "搜索负责人...",
    "issueProperties.repo": "仓库：",
    "issueProperties.parent": "父任务",
    "issueProperties.depth": "深度",
    "issueProperties.createdBy": "创建者",
    "issueProperties.noLabels": "无标签",
    "issueProperties.noAssignee": "无负责人",
    "issueProperties.assignToMe": "分配给我",
    "issueProperties.noProject": "无项目",
    # inbox
    "inbox.approvalStatus": "审批状态",
    "inbox.allCategories": "所有分类",
    "inbox.myRecentIssues": "我最近的任务",
    "inbox.joinRequests": "加入请求",
    "inbox.failedRuns": "失败的运行",
    "inbox.alerts": "警报",
    "inbox.allApprovalStatuses": "所有审批状态",
    "inbox.needsAction": "需要处理",
    "inbox.resolved": "已解决",
    "inbox.joinRequests2": "加入请求",
    "inbox.failedRuns2": "失败的运行",
    # issuesList
    "issuesList.listView": "列表视图",
    "issuesList.boardView": "看板视图",
    "issuesList.searchIssues": "搜索任务...",
    "issuesList.searchIssues2": "搜索任务",
    "issuesList.filters": "筛选",
    "issuesList.quickFilters": "快速筛选",
    "issuesList.sort": "排序",
    "issuesList.group": "分组",
    # issueDetail
    "issueDetail.copyIssueAsMarkdown": "以 Markdown 格式复制任务",
    "issueDetail.properties": "属性",
    "issueDetail.showProperties": "显示属性",
    "issueDetail.deleteAttachment": "删除附件",
    "issueDetail.thisIssueIsHidden": "此任务已隐藏",
    "issueDetail.hideThisIssue": "隐藏此任务",
    "issueDetail.noSubIssues": "暂无子任务。",
    "issueDetail.noActivityYet": "暂无活动。",
    "issueDetail.noCostDataYet": "暂无费用数据。",
    # companySettings
    "companySettings.optionalCompanyDescription": "可选的公司描述",
    "companySettings.auto": "自动",
    "companySettings.logo": "Logo",
    "companySettings.brandColor": "品牌颜色",
    "companySettings.requireBoardApprovalForNewHires": "新成员需要董事会审批",
    "companySettings.noCompanySelectedSelectACompanyFromTheSwitcherAbov": "未选择公司。请从上方切换器选择一家公司。",
    "companySettings.uploadingLogo": "上传 Logo 中...",
    "companySettings.hiring": "招聘",
    "companySettings.invites": "邀请",
    "companySettings.generateAnOpenclawAgentInviteSnippet": "生成 OpenClaw 智能体邀请码。",
    "companySettings.openclawInvitePrompt": "OpenClaw 邀请提示",
    "companySettings.copied": "已复制",
    # issueDocumentsSection
    "issueDocumentsSection.documentActions": "文档操作",
    "issueDocumentsSection.documentKey": "文档键",
    "issueDocumentsSection.optionalTitle": "可选标题",
    "issueDocumentsSection.markdownBody": "Markdown 内容",
    "issueDocumentsSection.newDocument": "新建文档",
    "issueDocumentsSection.plan": "计划",
    "issueDocumentsSection.downloadDocument": "下载文档",
    "issueDocumentsSection.deleteDocument": "删除文档",
    "issueDocumentsSection.outOfDate": "已过期",
    "issueDocumentsSection.thisDocumentChangedWhileYouWereEditingYourLocalDra": "编辑期间此文档已变更。你的本地草稿已保留，自动保存已暂停。",
    "issueDocumentsSection.keepMyDraft": "保留我的草稿",
    "issueDocumentsSection.reloadRemote": "重新加载远程版本",
    "issueDocumentsSection.deleteThisDocumentThisCannotBeUndone": "确定删除此文档？此操作无法撤销。",
    # dashboard
    "dashboard.agentsEnabled": "已启用智能体",
    "dashboard.tasksInProgress": "进行中的任务",
    "dashboard.monthSpend": "本月支出",
    "dashboard.youHaveNoAgents": "你还没有智能体。",
    "dashboard.createOneHere": "在此创建",
    "dashboard.openBudgets": "未关闭的预算",
    "dashboard.recentActivity": "最近活动",
    "dashboard.recentTasks": "最近任务",
    "dashboard.noTasksYet": "暂无任务。",
    # inviteLanding
    "inviteLanding.invalidInviteToken": "无效的邀请令牌。",
    "inviteLanding.loadingInvite": "加载邀请中...",
    "inviteLanding.inviteNotAvailable": "邀请不可用",
    "inviteLanding.thisInviteMayBeExpiredRevokedOrAlreadyUsed": "此邀请可能已过期、已撤销或已使用。",
    "inviteLanding.bootstrapComplete": "引导完成",
    "inviteLanding.theFirstInstanceAdminIsNowConfiguredYouCanContinue": "首个实例管理员已配置完成。你可以继续前往董事会。",
    "inviteLanding.openBoard": "打开董事会",
    "inviteLanding.joinRequestSubmitted": "加入请求已提交",
    "inviteLanding.yourRequestIsPendingAdminApprovalYouWillNotHaveAcc": "你的请求正在等待管理员审批。审批通过前你将无法访问。",
    "inviteLanding.oneTimeClaimSecretSaveNow": "一次性认领密钥（请立即保存）",
    "inviteLanding.paperclipSkillBootstrap": "Paperclip 技能引导",
    "inviteLanding.agentReadableOnboardingText": "智能体可读的引导文本",
    "inviteLanding.connectivityDiagnostics": "连接诊断",
    "inviteLanding.capabilitiesOptional": "能力声明（可选）",
    "inviteLanding.signInCreateAccount": "登录 / 创建账户",
    # newProjectDialog
    "newProjectDialog.targetDate": "目标日期",
    "newProjectDialog.whereWillWorkBeDoneOnThisProject": "此项目的工作将在哪里进行？",
    "newProjectDialog.addARepoAndOrLocalFolderForThisProject": "为此项目添加仓库和/或本地文件夹。",
    "newProjectDialog.useAFullPathOnThisMachine": "使用本机的完整路径。",
    "newProjectDialog.pasteAGithubUrl": "粘贴 GitHub URL。",
    "newProjectDialog.both": "两者",
    "newProjectDialog.configureBothRepoAndLocalFolder": "同时配置仓库和本地文件夹。",
    "newProjectDialog.localFolderFullPath": "本地文件夹（完整路径）",
    "newProjectDialog.repoUrl": "仓库 URL",
    "newProjectDialog.noGoal": "无目标",
    "newProjectDialog.allGoalsAlreadySelected": "所有目标已选择。",
    "newProjectDialog.failedToCreateProject": "创建项目失败。",
    # agentConfigPrimitives
    "agentConfigPrimitives.choose": "选择",
    "agentConfigPrimitives.specifyPathManually": "手动指定路径",
    "agentConfigPrimitives.findTheFolderInFinder": "在 Finder 中找到该文件夹。",
    "agentConfigPrimitives.option": "选项",
    "agentConfigPrimitives.clickCopyLtFolderNameGtAsPathname": '点击"复制 <文件夹名称> 为路径名"。',
    "agentConfigPrimitives.pasteTheResultIntoThePathInput": "将结果粘贴到路径输入框中。",
    "agentConfigPrimitives.windowsFileExplorer": "Windows（文件资源管理器）",
    "agentConfigPrimitives.findTheFolderInFileExplorer": "在文件资源管理器中找到该文件夹。",
    "agentConfigPrimitives.shift": "Shift",
    "agentConfigPrimitives.clickCopyAsPath": '点击"复制为路径"。',
    "agentConfigPrimitives.terminalFallbackMacosLinux": "终端备用方式（macOS/Linux）",
    "agentConfigPrimitives.copyTheOutputAndPasteItIntoThePathInput": "复制输出并粘贴到路径输入框中。",
    # approvalDetail
    "approvalDetail.approvalNotFound": "未找到审批。",
    "approvalDetail.approvalConfirmed": "审批已确认",
    "approvalDetail.requestingAgentWasNotifiedToReviewThisApprovalAndL": "请求的智能体已被通知审核此审批及关联任务。",
    "approvalDetail.seeFullRequest": "查看完整请求",
    "approvalDetail.linkedIssuesRemainOpenUntilTheRequestingAgentFollo": "关联任务将保持开放状态，直到请求的智能体跟进并关闭它们。",
    "approvalDetail.requestRevision": "请求修订",
    "approvalDetail.markResubmitted": "标记为已重新提交",
    "approvalDetail.deleteDisapprovedAgent": "删除未通过审批的智能体",
    # executionWorkspaceDetail
    "executionWorkspaceDetail.sourceIssue": "来源任务",
    "executionWorkspaceDetail.providerRef": "提供商引用",
    "executionWorkspaceDetail.opened": "打开时间",
    "executionWorkspaceDetail.lastUsed": "最近使用",
    # boardClaim
    "boardClaim.invalidBoardClaimUrl": "无效的董事会认领 URL。",
    "boardClaim.loadingClaimChallenge": "加载认领验证中...",
    "boardClaim.claimChallengeUnavailable": "认领验证不可用",
    "boardClaim.claimChallengeUnavailable2": "认领验证不可用。",
    "boardClaim.boardOwnershipClaimed": "董事会所有权已认领",
    "boardClaim.thisInstanceIsNowLinkedToYourAuthenticatedUser": "此实例现已关联到你的已验证用户。",
    "boardClaim.signInRequired": "需要登录",
    "boardClaim.signInOrCreateAnAccountThenReturnToThisPageToClaim": "登录或创建账户，然后返回此页面认领董事会所有权。",
    "boardClaim.claimBoardOwnership": "认领董事会所有权",
    "boardClaim.thisWillPromoteYourUserToInstanceAdminAndMigrateCo": "这将把你的用户提升为实例管理员，并将公司所有权从本地信任模式迁移过来。",
    # commandPalette
    "commandPalette.searchIssuesAgentsProjects": "搜索任务、智能体、项目...",
    "commandPalette.noResultsFound": "未找到结果。",
    "commandPalette.createNewAgent": "创建新智能体",
    "commandPalette.createNewProject": "创建新项目",
    # approvalPayload
    "approvalPayload.icon": "图标",
    "approvalPayload.scope": "范围",
    "approvalPayload.window": "窗口",
    "approvalPayload.metric": "指标",
    # agentProperties
    "agentProperties.lastError": "最近错误",
    "agentProperties.lastHeartbeat": "最近心跳",
    # commentThread
    "commentThread.copyAsMarkdown": "以 Markdown 格式复制",
    "commentThread.attachImage": "附加图片",
    "commentThread.leaveAComment": "留下评论...",
    "commentThread.noCommentsOrRunsYet": "暂无评论或运行记录。",
    "commentThread.reOpen": "重新打开",
    # budgetPolicyCard
    "budgetPolicyCard.observed": "已观察",
    "budgetPolicyCard.remaining": "剩余",
    "budgetPolicyCard.budgetUsd": "预算（美元）",
    "budgetPolicyCard.enterAValidNonNegativeDollarAmount": "请输入有效的非负美元金额。",
    # newAgent
    "newAgent.titleEGVpOfEngineering": "职位（例如工程副总裁）",
    "newAgent.advancedAgentConfiguration": "高级智能体配置",
    "newAgent.noManager": "无上级",
    "newAgent.thisWillBeTheCeo": "这将是 CEO",
    # companies
    "companies.newCompany": "新建公司",
    "companies.loadingCompanies": "加载公司中...",
    "companies.rename": "重命名",
    "companies.unlimitedBudget": "无限预算",
    "companies.deleteThisCompanyAndAllItsDataThisCannotBeUndone": "删除此公司及其所有数据？此操作无法撤销。",
    # runTranscriptUxLab
    "runTranscriptUxLab.liveRuns": "实时运行",
    "runTranscriptUxLab.compactLiveTranscriptStreamForTheIssueDetailPage": "用于任务详情页的紧凑实时记录流。",
    "runTranscriptUxLab.uxLab": "UX 实验室",
    "runTranscriptUxLab.runTranscriptFixtures": "运行记录测试数据",
    "runTranscriptUxLab.builtFromARealPaperclipDevelopmentRunThenSanitized": "基于真实的 Paperclip 开发运行构建，已清理所有密钥、本地路径和环境详情。",
    "runTranscriptUxLab.controls": "控制",
    # goalProperties
    "goalProperties.level": "层级",
    "goalProperties.owner": "负责人",
    "goalProperties.parentGoal": "父目标",
    # layout
    "layout.instanceSettings": "实例设置",
    "layout.closeSidebar": "关闭侧边栏",
    "layout.skipToMainContent": "跳转到主要内容",
    # auth
    "auth.paperclip": "The Agent Company",
    # agents
    "agents.showTerminated": "显示已终止",
    "agents.noAgentsMatchTheSelectedFilter": "没有匹配所选筛选条件的智能体。",
    "agents.noOrganizationalHierarchyDefined": "未定义组织架构。",
    # projectDetail
    "projectDetail.changeProjectColor": "更改项目颜色",
    "projectDetail.pausedByBudgetHardStop": "因预算硬性停止而暂停",
    # instanceExperimentalSettings
    "instanceExperimentalSettings.toggleIsolatedWorkspacesExperimentalSetting": "切换隔离工作区实验性设置",
    "instanceExperimentalSettings.loadingExperimentalSettings": "加载实验性设置中...",
    "instanceExperimentalSettings.optIntoFeaturesThatAreStillBeingEvaluatedBeforeThe": "在功能成为默认行为之前，选择启用仍在评估中的功能。",
    "instanceExperimentalSettings.enabledIsolatedWorkspaces": "已启用隔离工作区",
    # orgChart
    "orgChart.fitToScreen": "适应屏幕",
    "orgChart.zoomIn": "放大",
    "orgChart.zoomOut": "缩小",
    "orgChart.fitChartToScreen": "使图表适应屏幕",
    "orgChart.fit": "适应",
    # providerQuotaCard
    "providerQuotaCard.periodSpend": "期间支出",
    "providerQuotaCard.thisWeek": "本周",
    "providerQuotaCard.rollingWindows": "滚动窗口",
    "providerQuotaCard.subscription": "订阅",
    "providerQuotaCard.subscriptionQuota": "订阅配额",
    # newAgentDialog
    "newAgentDialog.addANewAgent": "添加新智能体",
    "newAgentDialog.askTheCeoToCreateANewAgent": "请求 CEO 创建新智能体",
    "newAgentDialog.chooseYourAdapterTypeForAdvancedSetup": "选择适配器类型进行高级设置。",
    # runTranscriptView
    "runTranscriptView.user": "用户",
    "runTranscriptView.streaming": "传输中",
    "runTranscriptView.result": "结果",
    "runTranscriptView.commandFailed": "命令失败",
    # instanceSettings
    "instanceSettings.fullAgentConfig": "完整智能体配置",
    "instanceSettings.loadingSchedulerHeartbeats": "加载调度器心跳中...",
    "instanceSettings.schedulerHeartbeats": "调度器心跳",
    "instanceSettings.agentsWithATimerHeartbeatEnabledAcrossAllOfYourCom": "所有公司中启用了定时心跳的智能体。",
    # goalDetail
    "goalDetail.subGoal": "子目标",
    "goalDetail.noSubGoals": "暂无子目标。",
    "goalDetail.noLinkedProjects": "暂无关联项目。",
    # approvalCard
    "approvalCard.viewDetails": "查看详情",
    # codexSubscriptionPanel
    "codexSubscriptionPanel.codexSubscription": "Codex 订阅",
    "codexSubscriptionPanel.liveCodexQuotaWindows": "实时 Codex 配额窗口。",
    "codexSubscriptionPanel.accountWindows": "账户窗口",
    "codexSubscriptionPanel.modelWindows": "模型窗口",
    # jsonSchemaForm
    "jsonSchemaForm.selectAnOption": "选择一个选项",
    "jsonSchemaForm.removeItem": "移除项目",
    "jsonSchemaForm.noItemsAddedYet": "暂无已添加的项目。",
    "jsonSchemaForm.noConfigurationOptionsAvailable": "无可用的配置选项。",
    # instanceSidebar
    "instanceSidebar.heartbeats": "心跳",
    # activityCharts
    "activityCharts.noRunsYet": "暂无运行记录。",
    "activityCharts.noIssues": "暂无任务。",
    # companySwitcher
    "companySwitcher.companies": "公司",
    "companySwitcher.noCompanies": "暂无公司",
    "companySwitcher.manageCompanies": "管理公司",
    # pluginPage
    "pluginPage.selectACompanyToViewThisPage": "选择一家公司以查看此页面。",
    # newGoalDialog
    "newGoalDialog.goalTitle": "目标标题",
    "newGoalDialog.noParent": "无父目标",
    # billerSpendCard
    "billerSpendCard.billingTypes": "计费类型",
    "billerSpendCard.upstreamProviders": "上游提供商",
    # sidebarAgents
    "sidebarAgents.agentPausedByBudget": "智能体因预算暂停",
    # sidebarProjects
    "sidebarProjects.projectPausedByBudget": "项目因预算暂停",
    # budgetIncidentCard
    "budgetIncidentCard.newBudgetUsd": "新预算（美元）",
    "budgetIncidentCard.theNewBudgetMustExceedCurrentObservedSpend": "新预算必须超过当前已观察到的支出。",
    "budgetIncidentCard.keepPaused": "保持暂停",
    # financeKindCard
    "financeKindCard.financialEventMix": "财务事件类型分布",
    "financeKindCard.accountLevelChargesGroupedByEventKind": "按事件类型分组的账户级别费用。",
    "financeKindCard.noFinanceEventsInThisPeriod": "此期间无财务事件。",
    # workflowEditor
    "workflowEditor.toolId": "工具 ID",
    "workflowEditor.workflowId": "工作流 ID",
    # activity
    "activity.filterByType": "按类型筛选",
    "activity.allTypes": "所有类型",
    # notFound
    "notFound.openDashboard": "打开仪表盘",
    "notFound.goHome": "返回首页",
    # activeAgentsPanel
    "activeAgentsPanel.noRecentAgentRuns": "暂无最近的智能体运行。",
    # claudeSubscriptionPanel
    "claudeSubscriptionPanel.anthropicSubscription": "Anthropic 订阅",
    "claudeSubscriptionPanel.liveClaudeQuotaWindows": "实时 Claude 配额窗口。",
    # financeTimelineCard
    "financeTimelineCard.recentFinancialEvents": "最近财务事件",
    "financeTimelineCard.topUpsFeesCreditsCommitmentsAndOtherNonRequestChar": "充值、费用、信用额度、承诺和其他非请求类费用。",
    # pathInstructionsModal
    "pathInstructionsModal.howToGetAFullPath": "如何获取完整路径",
    # liveRunWidget
    "liveRunWidget.streamedWithTheSameTranscriptUiUsedOnTheFullRunDet": "使用与完整运行详情页相同的记录 UI 进行传输。",
    # agentIconPicker
    "agentIconPicker.searchIcons": "搜索图标...",
    "agentIconPicker.noIconsMatch": "无匹配图标",
    # companyRail
    "companyRail.addCompany": "添加公司",
    # projects
    "projects.addProject": "添加项目",
    # channelsSettings
    "channelsSettings.myChannel": "我的渠道",
    # brandingSettings
    "brandingSettings.theAgentCompany": "The Agent Company",
    "brandingSettings.logoPreview": "Logo 预览",
    # cronSettings
    "cronSettings.dailyContentCreation": "每日内容创作",
    # breadcrumbBar
    "breadcrumbBar.openSidebar": "打开侧边栏",
    # mobileBottomNav
    "mobileBottomNav.mobileNavigation": "移动端导航",
    # toastViewport
    "toastViewport.dismissNotification": "关闭通知",
    # accountingModelCard
    "accountingModelCard.accountingModel": "计费模型",
    # breadcrumb
    "breadcrumb.more": "更多",
    # language
    "language.english": "English",
    # channels.types (brand names stay English)
    "channels.types.telegram": "Telegram",
    "channels.types.slack": "Slack",
    "channels.types.discord": "Discord",
    # teamMember.engineTypes (brand names stay English)
    "teamMember.engineTypes.openclaw": "OpenClaw",
    "teamMember.engineTypes.http": "HTTP API",
    # pages.workflows (brand names / technical terms)
    "pages.workflows.approve": "批准",
    "pages.workflows.reject": "拒绝",
    "pages.workflows.apiConfig.url": "URL",
}


def set_nested(obj, key, value):
    parts = key.split('.')
    current = obj
    for part in parts[:-1]:
        if part not in current:
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


count = 0
for key, zh_val in TRANSLATIONS.items():
    en_val = None
    # Get en value to verify it matches
    en_obj = en
    for part in key.split('.'):
        if isinstance(en_obj, dict) and part in en_obj:
            en_obj = en_obj[part]
        else:
            en_obj = None
            break
    if isinstance(en_obj, str):
        en_val = en_obj
    
    set_nested(zh, key, zh_val)
    count += 1

with open('ui/src/i18n/zh.json', 'w', encoding='utf-8') as f:
    json.dump(zh, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"Translated {count} strings")

# Verify remaining untranslated
def find_remaining(en_d, zh_d, prefix=''):
    results = []
    for k, v in en_d.items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            zh_v = zh_d.get(k, {})
            results.extend(find_remaining(v, zh_v, full))
        elif isinstance(v, str):
            zh_v = zh_d.get(k)
            skip = {'English', 'Slack', 'Discord', 'Telegram', 'OpenClaw', 'Claude', 'Google', 'GitHub', 'Paperclip', 'HTTP API', 'URL', 'API', 'JSON', 'Claude Code', 'Codex', 'Cursor', 'OpenCode', 'Gemini CLI', 'NPM', 'PID'}
            if zh_v is None or (zh_v == v and v not in skip and len(v) > 2):
                results.append((full, v))
    return results

remaining = find_remaining(en, zh)
print(f"Remaining untranslated: {len(remaining)}")
for k, v in remaining[:10]:
    print(f"  {k}: {v}")
if len(remaining) > 10:
    print(f"  ... and {len(remaining) - 10} more")
