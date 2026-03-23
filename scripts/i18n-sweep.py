#!/usr/bin/env python3
"""
i18n sweep: Scan TSX files for hardcoded English strings, add translations,
and replace with t() calls.

Conservative approach - only replaces strings it's confident about.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(os.path.expanduser("~/Dev/theagent-company"))
UI_SRC = PROJECT_ROOT / "ui" / "src"
EN_JSON = UI_SRC / "i18n" / "en.json"
ZH_JSON = UI_SRC / "i18n" / "zh.json"

SKIP_FILES = {"DesignGuide.tsx"}

# ──── Chinese translations (merged) ────

ZH_TRANSLATIONS = {
    # Common UI
    "Save": "保存", "Cancel": "取消", "Delete": "删除", "Edit": "编辑",
    "Create": "创建", "Search": "搜索", "Loading...": "加载中...",
    "Error": "错误", "Success": "成功", "Confirm": "确认", "Close": "关闭",
    "Back": "返回", "Next": "下一步", "Submit": "提交", "Reset": "重置",
    "Refresh": "刷新", "Copy": "复制", "Enable": "启用", "Disable": "禁用",
    "Enabled": "已启用", "Disabled": "已禁用", "Active": "活跃",
    "Paused": "已暂停", "Running": "运行中", "Failed": "失败",
    "Completed": "已完成", "Pending": "待处理", "Yes": "是", "No": "否",
    "Name": "名称", "Title": "标题", "Description": "描述", "Status": "状态",
    "Type": "类型", "Actions": "操作", "Settings": "设置",
    "Dashboard": "仪表盘", "Overview": "概览", "Details": "详情", "Add": "添加",
    "Remove": "移除", "Update": "更新", "Dismiss": "关闭", "Revoke": "撤销",
    "Restore": "恢复", "Terminate": "终止", "Resume": "恢复", "Pause": "暂停",
    "Run": "运行", "Retry": "重试", "Approve": "批准", "Reject": "拒绝",
    "View": "查看", "Preview": "预览", "Apply": "应用", "Install": "安装",
    "General": "通用", "Advanced": "高级", "Default": "默认", "None": "无",
    "All": "全部", "Total": "总计", "Date": "日期", "Duration": "持续时间",
    "Priority": "优先级", "Low": "低", "Medium": "中", "High": "高",
    "Critical": "严重", "Unknown": "未知", "Notifications": "通知",
    "Help": "帮助", "Version": "版本", "Language": "语言", "Security": "安全",
    "Documentation": "文档", "New": "新建", "Copied!": "已复制！",
    "Saved": "已保存", "Saving...": "保存中...", "Saving…": "保存中…",
    "Loading": "加载中",
    # Longer phrases
    "Unsaved changes": "未保存的更改",
    "Assign Task": "分配任务",
    "Run Heartbeat": "运行心跳",
    "Copy Agent ID": "复制智能体 ID",
    "Reset Sessions": "重置会话",
    "Team Member": "团队成员",
    "Configuration": "配置",
    "Configuration Revisions": "配置修订记录",
    "No configuration revisions yet.": "暂无配置修订记录。",
    "Can create new agents": "可以创建新智能体",
    "API Keys": "API 密钥",
    "Create API Key": "创建 API 密钥",
    "API keys allow this agent to authenticate calls to the Paperclip server.": "API 密钥允许此智能体向 Paperclip 服务器进行身份验证。",
    "API key created — copy it now, it will not be shown again.": "API 密钥已创建 - 请立即复制，此密钥不会再次显示。",
    "Active Keys": "活跃密钥",
    "Revoked Keys": "已撤销密钥",
    "No active API keys.": "暂无活跃的 API 密钥。",
    "Loading keys...": "加载密钥中...",
    "Live Run": "实时运行",
    "Latest Run": "最近运行",
    "Run Activity": "运行活动",
    "Issues by Priority": "按优先级分类任务",
    "Issues by Status": "按状态分类任务",
    "Success Rate": "成功率",
    "Recent Issues": "最近的任务",
    "See All": "查看全部",
    "No assigned issues.": "暂无分配的任务。",
    "Input tokens": "输入令牌", "Output tokens": "输出令牌",
    "Cached tokens": "缓存令牌", "Total cost": "总费用",
    "No runs yet.": "暂无运行记录。",
    "Back to runs": "返回运行列表",
    "Failure details": "失败详情",
    "Loading run logs...": "加载运行日志中...",
    "No log events.": "暂无日志事件。",
    "Jump to live": "跳转到实时",
    "Issues Touched": "涉及的任务",
    "Waiting for transcript...": "等待记录...",
    "No persisted transcript for this run.": "此次运行无持久化记录。",
    "This agent is pending board approval and cannot be invoked yet.": "此智能体正在等待审批，暂时无法调用。",
    "Welcome to The Agent Company": "欢迎来到 The Agent Company",
    "Company Name": "公司名称",
    "Issue Prefix": "任务前缀",
    "Create Company": "创建公司",
    "Add Your First Agent": "添加你的第一个智能体",
    "Agent Name": "智能体名称",
    "Add Agent": "添加智能体",
    "Skip for now": "暂时跳过",
    "Get Started": "开始使用",
    "New Issue": "新建任务",
    "Create Issue": "创建任务",
    "Issue Title": "任务标题",
    "Unassigned": "未分配",
    "No agents available": "暂无可用智能体",
    "No label": "无标签",
    "No issues found": "未找到任务",
    "No issues match the current filters.": "没有匹配当前筛选条件的任务。",
    "Create your first issue to get started.": "创建你的第一个任务来开始。",
    "All assignees": "所有负责人",
    "All statuses": "所有状态",
    "All priorities": "所有优先级",
    "All labels": "所有标签",
    "Your inbox is empty": "你的收件箱为空",
    "Approval Request": "审批请求",
    "Mark as read": "标记为已读",
    "Monthly Budget": "月度预算",
    "Monthly Spend": "月度支出",
    "Daily Spend": "日支出",
    "Budget Utilization": "预算使用率",
    "Cost Breakdown": "费用明细",
    "No cost data available.": "暂无费用数据。",
    "This Month": "本月",
    "All Time": "所有时间",
    "Set Budget": "设置预算",
    "Project Name": "项目名称",
    "Project Description": "项目描述",
    "Start Date": "开始日期",
    "End Date": "结束日期",
    "Company Settings": "公司设置",
    "Danger Zone": "危险区域",
    "Delete Company": "删除公司",
    "This action cannot be undone.": "此操作无法撤销。",
    "Page Not Found": "页面未找到",
    "Go Home": "返回首页",
    "New Agent": "新建智能体",
    "Create Agent": "创建智能体",
    "New Project": "新建项目",
    "Create Project": "创建项目",
    "No data available": "暂无数据",
    "Something went wrong": "出了点问题",
    "Refresh Page": "刷新页面",
    "Are you sure?": "确定吗？",
    "Confirm deletion": "确认删除",
    "Coming soon": "即将推出",
    "Coming Soon": "即将推出",
    "Test environment": "测试环境",
    "Environment test failed": "环境测试失败",
    "Permissions & Configuration": "权限与配置",
    "Run Policy": "运行策略",
    "Advanced Run Policy": "高级运行策略",
    "Search models...": "搜索模型...",
    "No models found.": "未找到模型。",
    "Select model": "选择模型",
    "Select model (required)": "选择模型（必填）",
    "PAPERCLIP_* variables are injected automatically at runtime.": "PAPERCLIP_* 变量在运行时自动注入。",
    "Adapter": "适配器",
    "Identity": "身份",
    "Permissions": "权限",
    "Plugin Manager": "插件管理器",
    "Installed Plugins": "已安装插件",
    "Available Plugins": "可用插件",
    "No plugins installed": "未安装插件",
    "Plugin Settings": "插件设置",
    "Plugin Configuration": "插件配置",
    "Budget Policy": "预算策略",
    "Monthly Limit": "月度限额",
    "Hard Stop": "硬性停止",
    "Warning Threshold": "警告阈值",
    "New Goal": "新建目标",
    "Create Goal": "创建目标",
    "Org Chart": "组织架构",
    "Experimental Features": "实验性功能",
    "Instance Settings": "实例设置",
    "Experimental": "实验性",
    "My Issues": "我的任务",
    "By Agent": "按智能体",
    "By Model": "按模型",
    "By Day": "按天",
    "Assigned to me": "分配给我的",
    "Created by me": "我创建的",
    "Workspace": "工作区",
    "Workspace Details": "工作区详情",
    "Branch": "分支",
    "Repository": "代码仓库",
    "Assignee": "负责人",
    "Reporter": "报告人",
    "Due Date": "截止日期",
    "Label": "标签",
    "Comment": "评论", "Comments": "评论",
    "Reply": "回复",
    "Attachments": "附件",
    "Related Issues": "关联任务",
    "Sub-issues": "子任务",
    "Parent Issue": "父任务",
    "Goal Name": "目标名称",
    "Target Date": "目标日期",
    "Progress": "进度",
    "Key Results": "关键结果",
    "Agent Properties": "智能体属性",
    "Adapter Type": "适配器类型",
    "Workflow Editor": "工作流编辑器",
    "Add Step": "添加步骤",
    "Save Workflow": "保存工作流",
    "Approval Details": "审批详情",
    "Requested by": "请求者",
    "Session": "会话",
    "Invocation": "调用",
    "Transcript": "记录",
    "Environment": "环境",
    "Prompt": "提示词",
    "Context": "上下文",
    "Board": "看板",
    "Worktree": "工作树",
    "Token Usage": "令牌用量",
    "Cost Summary": "费用摘要",
    "Breakdown": "明细",
    "Model": "模型", "Provider": "提供商", "Tokens": "令牌",
    "Input": "输入", "Output": "输出", "Cached": "缓存",
    "Cost": "费用", "Costs": "费用",
    "Runs": "运行记录", "Live": "实时", "Budget": "预算",
    "Members": "成员", "Documents": "文档", "Skills": "技能",
    "Channels": "渠道", "Memory": "记忆", "Activity": "活动",
    "Events": "事件", "Projects": "项目", "Issues": "任务",
    "Goals": "目标", "Agents": "智能体", "Workflows": "工作流",
    "Team": "团队", "Company": "公司", "Reports": "报告",
    "Performance": "性能", "Collaboration": "协作", "Inbox": "收件箱",
    "Cancelling…": "取消中…", "Resuming…": "恢复中…", "Retrying…": "重试中…",
    "Testing...": "测试中...", "Creating...": "创建中...", "Adding...": "添加中...",
    "Accept Invite": "接受邀请", "Decline": "拒绝",
    "Claim Board": "认领看板",
    "Working dir": "工作目录", "Command": "命令",
    "Base ref": "基础引用", "Repo root": "代码仓库根目录",
    "Cleanup": "清理",
    "Worktree setup": "工作树设置", "Provision": "配置",
    "Teardown": "清理", "Worktree cleanup": "工作树清理",
    "Hide full log": "隐藏完整日志", "Show full log": "显示完整日志",
    "Loading log...": "加载日志中...",
    "No persisted log lines.": "无持久化日志行。",
    "Created by this run": "由此次运行创建",
    "Reused existing workspace": "复用已有工作区",
    "stderr excerpt": "标准错误摘要", "stdout excerpt": "标准输出摘要",
    "clearing session...": "清除会话中...",
    "clear session for these issues": "清除这些任务的会话",
    "Select secret...": "选择密钥...",
    "Seal": "加密", "Plain": "明文", "Secret": "密钥",
    "Key name (e.g. production)": "密钥名称（例如 production）",
    "Passed": "通过", "Warnings": "警告",
    "Login to Claude Code": "登录 Claude Code",
    "Running claude login...": "运行 Claude 登录...",
    "Before": "之前", "After": "之后",
    "Sign In": "登录", "Sign in to continue": "登录以继续",
    "Created": "创建时间", "Updated": "更新时间",
    "Manage Company": "管理公司",
    "Select company": "选择公司",
    "No companies yet": "暂无公司",
    "Create your first company": "创建你的第一家公司",
    "Select a company to continue": "选择一家公司以继续",
    "Plugin": "插件", "Plugins": "插件",
    "Configure": "配置", "Configured": "已配置",
    "Not configured": "未配置",
    "Required fields": "必填字段", "Optional fields": "可选字段",
    "Save Configuration": "保存配置", "Reset Configuration": "重置配置",
    "View Documentation": "查看文档",
    "No description available.": "暂无描述。",
    "No plugins available": "暂无可用插件",
    "Enter value...": "输入值...", "Choose...": "选择...",
    "Custom JSON": "自定义 JSON", "Invalid JSON": "无效的 JSON",
    "No items.": "暂无项目。", "Add item": "添加项目",
    "Total Spend": "总支出", "Budget Remaining": "预算剩余",
    "No budget set": "未设置预算", "Edit Budget": "编辑预算",
    "Budget Amount": "预算金额", "Utilization": "使用率",
    "Warn at": "警告阈值", "Hard stop": "硬性停止",
    "Notify on threshold": "达到阈值时通知",
    "Claim": "认领", "Start a conversation": "开始对话",
    "Go to board": "前往看板",
    "Sign in with Google": "使用 Google 登录",
    "Sign in with GitHub": "使用 GitHub 登录",
    "Or continue with email": "或使用邮箱继续",
    "Email": "邮箱", "Password": "密码",
    "Back to agents": "返回智能体列表",
    "No agents found.": "未找到智能体。",
    "Search agents...": "搜索智能体...",
    "New agent": "新建智能体", "All agents": "所有智能体",
    "Idle": "空闲", "Terminated": "已终止",
    "Search projects...": "搜索项目...", "Search goals...": "搜索目标...",
    "New project": "新建项目", "New goal": "新建目标",
    "No projects found.": "未找到项目。", "No goals found.": "未找到目标。",
    "Mark all read": "全部标记为已读",
    "All caught up!": "全部处理完毕！",
    "No notifications": "暂无通知",
    "Show Details": "显示详情", "Hide Details": "隐藏详情",
    "Approved": "已批准", "Rejected": "已拒绝",
    "Failed to load adapter models.": "加载适配器模型失败。",
    "Command notes": "命令注释",
    "adapter result JSON": "适配器结果 JSON",
    "no tracked changes": "无跟踪变更",
    "No description available.": "暂无描述。",
    "Objective": "目标",
    "Manage": "管理",
    "Search documents...": "搜索文档...",
    "Accept": "接受", "Key Results": "关键结果",
    "Linked Issues": "关联任务", "Edit Goal": "编辑目标",
    "Step": "步骤",
    "Manage Company": "管理公司",
    "Delete comment": "删除评论",
    "Edit comment": "编辑评论",
    "Delete Comment": "删除评论",
    "Cancel editing": "取消编辑",
    "Save edit": "保存编辑",
    "Add a comment...": "添加评论...",
    "Post Comment": "发表评论",
    "No comments yet.": "暂无评论。",
    "Write a comment...": "写评论...",
    "Attach": "附件",
    "Attach file": "附加文件",
    "Send": "发送",
    "Reopen": "重新打开",
    "Close Issue": "关闭任务",
    "Reopen Issue": "重新打开任务",
    "Upload image": "上传图片",
    "Drop image to upload": "拖放图片上传",
    "Login URL:": "登录链接：",
    "Failed to load workspace operation log": "加载工作区操作日志失败",
    "Hint:": "提示：",
    "Select...": "选择...",
    "Search...": "搜索...",
    "No options": "无选项",
    "Show more": "显示更多",
    "Show less": "收起",
    "Load more": "加载更多",
    "View all": "查看全部",
    "Clear": "清除",
    "Clear all": "清除全部",
    "Not available": "不可用",
    "Select all": "全选",
    "Go back": "返回",
    "Back to home": "返回首页",
    "Scroll to bottom": "滚动到底部",
    "No changes detected.": "未检测到变更。",
    "Toggle sidebar": "切换侧边栏",
    "Open menu": "打开菜单",
    "Close menu": "关闭菜单",
}


def translate_to_chinese(text: str) -> str:
    if text in ZH_TRANSLATIONS:
        return ZH_TRANSLATIONS[text]
    return text


def camel_case(s: str) -> str:
    words = re.split(r'[^a-zA-Z0-9]+', s)
    words = [w for w in words if w]
    if not words:
        return "unknown"
    result = words[0].lower()
    for w in words[1:]:
        result += w.capitalize()
    return result[:50]


def namespace_from_file(filepath: str) -> str:
    name = Path(filepath).stem
    if '-' in name:
        parts = name.split('-')
        name = parts[0] + ''.join(p.capitalize() for p in parts[1:])
    else:
        name = name[0].lower() + name[1:]
    return name


def load_json(path: Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def set_nested(obj: dict, key: str, value: str):
    parts = key.split('.')
    current = obj
    for part in parts[:-1]:
        if part not in current:
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def get_nested(obj: dict, key: str):
    parts = key.split('.')
    current = obj
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current if isinstance(current, str) else None


def find_end_of_imports(content: str) -> int:
    """Find position right after last import statement."""
    lines = content.split('\n')
    last_import_end = 0
    in_import = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        if stripped.startswith('import '):
            in_import = True
        
        if in_import:
            if stripped.endswith(';') or (stripped.endswith("'") and 'from' in stripped) or (stripped.endswith('"') and 'from' in stripped):
                in_import = False
                last_import_end = sum(len(l) + 1 for l in lines[:i+1])
            elif 'from ' in stripped and (stripped.endswith('";') or stripped.endswith("';")):
                in_import = False
                last_import_end = sum(len(l) + 1 for l in lines[:i+1])
        elif stripped.startswith('export type') and 'from ' in stripped and stripped.endswith(';'):
            last_import_end = sum(len(l) + 1 for l in lines[:i+1])
        elif stripped.startswith('export {') and 'from ' in stripped:
            last_import_end = sum(len(l) + 1 for l in lines[:i+1])
    
    return last_import_end


def is_inside_type_annotation(content: str, pos: int) -> bool:
    """Check if position is inside a TypeScript type annotation (not JSX)."""
    # Look backwards from pos to see if we're in a type context
    # Type contexts: after ':', after 'extends', after '<' in generics, in interface/type blocks
    before = content[max(0, pos-200):pos]
    
    # Check for common type patterns
    # ): Type => or : Type => or : Type;
    # interface { ... }
    # type X = { ... }
    
    # Simple heuristic: if the nearest non-whitespace before > is ) or a letter followed by generic <
    # then we're likely in a type context
    
    # Check if we're inside a TypeScript interface or type block
    # Count { and } to see if we're inside a non-JSX block
    
    # Simpler: check if the > is part of a => arrow
    stripped_before = before.rstrip()
    if stripped_before.endswith('='):
        return True  # This is => arrow, not JSX
    
    # Check if we're after a type annotation colon
    # Look for patterns like `: SomeType<` or `): SomeType<`
    if re.search(r'[):]\s*\w+\s*$', stripped_before):
        return True
    
    # Check for generic type patterns: Promise<, Array<, Record<, Map<, etc.
    if re.search(r'\b(?:Promise|Array|Record|Map|Set|Partial|Required|Readonly|Pick|Omit|Extract|Exclude|ReturnType|Parameters)\s*$', stripped_before):
        return True
    
    return False


class I18nSweeper:
    def __init__(self):
        self.en_data = load_json(EN_JSON)
        self.zh_data = load_json(ZH_JSON)
        self.stats = {"files_processed": 0, "strings_replaced": 0, "keys_added": 0}
        self.text_to_key = {}
        self._build_reverse_lookup(self.en_data, "")
    
    def _build_reverse_lookup(self, obj, prefix):
        if isinstance(obj, dict):
            for k, v in obj.items():
                full_key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, str):
                    self.text_to_key[v] = full_key
                elif isinstance(v, dict):
                    self._build_reverse_lookup(v, full_key)
    
    def get_or_create_key(self, namespace: str, text: str, hint: str = "") -> str:
        if text in self.text_to_key:
            return self.text_to_key[text]
        
        key_suffix = camel_case(hint or text)
        full_key = f"{namespace}.{key_suffix}"
        
        existing = get_nested(self.en_data, full_key)
        if existing is not None:
            if existing == text:
                self.text_to_key[text] = full_key
                return full_key
            for i in range(2, 100):
                candidate = f"{full_key}{i}"
                if get_nested(self.en_data, candidate) is None:
                    full_key = candidate
                    break
        
        set_nested(self.en_data, full_key, text)
        zh = translate_to_chinese(text)
        set_nested(self.zh_data, full_key, zh)
        self.text_to_key[text] = full_key
        self.stats["keys_added"] += 1
        return full_key
    
    def process_file(self, filepath: str):
        filename = Path(filepath).name
        if filename in SKIP_FILES:
            return
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if not self._has_hardcoded_strings(content):
            return
        
        namespace = namespace_from_file(filepath)
        replacements = []
        
        # 1. Replace string props
        content = self._replace_string_props(content, namespace, replacements)
        
        # 2. Replace JSX text content
        content = self._replace_jsx_text(content, namespace, replacements)
        
        if not replacements:
            return
        
        content = self._ensure_translation_import(content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.stats["files_processed"] += 1
        self.stats["strings_replaced"] += len(replacements)
        print(f"  ✓ {filename}: {len(replacements)} strings replaced")
    
    def _has_hardcoded_strings(self, content: str) -> bool:
        patterns = [
            r'>\s*[A-Z][a-zA-Z ]+\s*</',
            r'(?:title|placeholder|label|aria-label|emptyMessage|alt)="[A-Z][^"]*"',
        ]
        for pat in patterns:
            if re.search(pat, content):
                return True
        return False
    
    def _replace_string_props(self, content: str, namespace: str, replacements: list) -> str:
        """Replace string props like title="...", placeholder="...", etc."""
        prop_names = ['title', 'placeholder', 'label', 'aria-label', 'alt', 'emptyMessage']
        
        for prop in prop_names:
            pattern = re.compile(re.escape(prop) + r'="([^"]{2,})"')
            
            def make_replacer(pn):
                def replacer(match):
                    full = match.group(0)
                    text = match.group(1)
                    if not re.search(r'[A-Za-z]{2,}', text):
                        return full
                    if self._should_skip_text(text):
                        return full
                    
                    # Don't replace inside interface/type definitions
                    pos = match.start()
                    line_start = content.rfind('\n', 0, pos) + 1
                    line = content[line_start:content.find('\n', pos)]
                    if 'interface ' in line or 'type ' in line:
                        return full
                    
                    key = self.get_or_create_key(namespace, text)
                    replacements.append((text, key))
                    return f'{pn}={{t("{key}")}}'
                return replacer
            
            content = pattern.sub(make_replacer(prop), content)
        
        return content
    
    def _replace_jsx_text(self, content: str, namespace: str, replacements: list) -> str:
        """Replace English text content between JSX tags.
        
        CRITICAL: Must not match TypeScript generics like Promise<void>.
        The pattern >[A-Z]text</ must check that > is from a JSX closing tag,
        not from => or a generic.
        """
        
        # Use a more specific pattern that requires the > to be from a JSX tag
        # A JSX closing tag looks like: </tagName> or /> or just >  
        # After >, JSX text follows. But after =>, TypeScript code follows.
        # After SomeType<, a type parameter follows.
        
        # Strategy: find all > positions, check if they're JSX, then check text after
        result = []
        i = 0
        
        while i < len(content):
            # Find next >
            gt_pos = content.find('>', i)
            if gt_pos == -1:
                result.append(content[i:])
                break
            
            # Add everything up to and including >
            result.append(content[i:gt_pos + 1])
            i = gt_pos + 1
            
            # Check if this > is from JSX (not from => or generic type)
            if gt_pos > 0 and content[gt_pos - 1] == '=':
                # This is => arrow
                continue
            
            # Check if inside a type annotation
            if is_inside_type_annotation(content, gt_pos):
                continue
            
            # Look ahead for text followed by </ or <
            ahead = content[i:]
            # Match: whitespace, then English text starting with capital, then </ or end-tag
            m = re.match(r'(\s*)([A-Z][A-Za-z][^<{}\n]*?)(\s*)(</)', ahead)
            if not m:
                continue
            
            ws_before = m.group(1)
            text = m.group(2).strip()
            ws_after = m.group(3)
            close_tag = m.group(4)
            
            if not text or len(text) < 2:
                continue
            
            if '{' in text or '}' in text:
                continue
            
            if self._should_skip_text(text):
                continue
            
            if not re.search(r'[A-Za-z]{2,}', text):
                continue
            
            key = self.get_or_create_key(namespace, text)
            replacements.append((text, key))
            
            # Replace: remove old text, add {t("key")}
            # Pop the last result item (the > we added) - actually we keep it
            # We need to output: ws_before + {t("key")} + ws_after + </
            replacement = f'{ws_before}{{t("{key}")}}{ws_after}{close_tag}'
            result.append(replacement)
            i += m.end()
        
        return ''.join(result)
    
    def _should_skip_text(self, text: str) -> bool:
        text = text.strip()
        if len(text) < 2:
            return True
        if 't(' in text or 't("' in text:
            return True
        if re.match(r'^[a-z][a-z0-9-]*(\s+[a-z][a-z0-9-]*)*$', text):
            return True
        if re.match(r'^[a-z_][a-z0-9_]*$', text):
            return True
        if text.startswith('http') or text.startswith('//') or text.startswith('/'):
            return True
        if '{{' in text or '${' in text:
            return True
        if any(c in text for c in ['`', '=>', '===', '!==', '()', '{}']):
            return True
        if re.match(r'^[A-Z][a-z]+[A-Z][a-zA-Z]*$', text) and ' ' not in text:
            return True
        if text.startswith('&') and text.endswith(';'):
            return True
        # Skip if starts with lowercase (not user-facing) unless known pattern
        if re.match(r'^[a-z]', text) and not any(text.startswith(w) for w in ['no ', 'per ', 'spent', 'remaining', 'more ', 'of ', 'older', 'newer', 'clearing', 'clear ', 'needs ', 'adapter ']):
            return True
        return False
    
    def _ensure_translation_import(self, content: str) -> str:
        has_import = 'useTranslation' in content and 'from "react-i18next"' in content
        has_destructure = bool(re.search(r'const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useTranslation', content))
        
        if not has_import:
            import_end = find_end_of_imports(content)
            import_line = 'import { useTranslation } from "react-i18next";\n'
            if import_end > 0:
                content = content[:import_end] + import_line + content[import_end:]
            else:
                content = import_line + content
        
        if not has_destructure:
            # Find first function component
            patterns = [
                r'(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{)',
                r'(function\s+[A-Z]\w+\s*\([^)]*\)\s*\{)',
            ]
            for pattern in patterns:
                match = re.search(pattern, content)
                if match:
                    pos = match.end()
                    next_chunk = content[pos:pos+200]
                    if 'useTranslation' in next_chunk:
                        break
                    content = content[:pos] + '\n  const { t } = useTranslation();' + content[pos:]
                    break
        
        return content
    
    def save_translations(self):
        save_json(EN_JSON, self.en_data)
        save_json(ZH_JSON, self.zh_data)
    
    def run(self):
        dirs = [UI_SRC / "pages", UI_SRC / "components"]
        files = []
        for d in dirs:
            if d.exists():
                for f in d.rglob("*.tsx"):
                    if f.name not in SKIP_FILES and not f.name.endswith('.test.tsx'):
                        files.append(str(f))
        
        def count_strings(fp):
            with open(fp, 'r') as f:
                c = f.read()
            count = len(re.findall(r'>\s*[A-Z][A-Za-z][^<{}\n]*?\s*</', c))
            count += len(re.findall(r'(?:title|placeholder|label)="[A-Z][^"]*"', c))
            return count
        
        files.sort(key=count_strings, reverse=True)
        print(f"Found {len(files)} TSX files to process\n")
        
        for filepath in files:
            try:
                self.process_file(filepath)
            except Exception as e:
                print(f"  ✗ {Path(filepath).name}: {e}")
                import traceback
                traceback.print_exc()
        
        self.save_translations()
        print(f"\n--- Summary ---")
        print(f"Files processed: {self.stats['files_processed']}")
        print(f"Strings replaced: {self.stats['strings_replaced']}")
        print(f"New keys added: {self.stats['keys_added']}")


if __name__ == "__main__":
    sweeper = I18nSweeper()
    sweeper.run()
