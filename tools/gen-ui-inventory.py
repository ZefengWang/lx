#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 docs/testing/UI-CONTROLS.inventory.json（一次性清单；评审后可手改）。"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "testing" / "UI-CONTROLS.inventory.json"

controls: list[dict] = []


def add(
    control_id: str,
    page: str,
    route: str,
    label: str,
    element_type: str,
    action: str,
    *,
    selectors: dict | None = None,
    apis: list | None = None,
    state_changes: dict | None = None,
    happy: list | None = None,
    unhappy: list | None = None,
    notes: str | None = None,
    dynamic: bool = False,
    affects_progress_text: bool | None = None,
) -> None:
    controls.append(
        {
            "controlId": control_id,
            "page": page,
            "route": route,
            "label": label,
            "elementType": element_type,
            "selectors": selectors or {},
            "action": action,
            "apis": apis or [],
            "expectedStateChanges": state_changes or {},
            "paths": {"happy": happy or [], "unhappy": unhappy or []},
            "dynamic": dynamic,
            "affectsProgressText": affects_progress_text,
            "notes": notes,
        }
    )


# —— shell ——
add(
    "topbar.back",
    "shell",
    "*",
    "返回刷题",
    "button",
    "navigate('study')",
    selectors={"aria": "返回刷题", "visibleWhen": "route∉{study,home}"},
    apis=["Router"],
    state_changes={"hash": "#/study"},
    happy=["非 study/home 点返回 → #/study"],
)
add(
    "topbar.menu",
    "shell",
    "*",
    "打开菜单",
    "button",
    "openDrawer/closeDrawer",
    selectors={"aria": "打开菜单", "visibleWhen": "route∈{study,home}"},
    state_changes={"drawer": "toggled"},
)
add(
    "topbar.libraryTitle",
    "shell",
    "*",
    "切换题库",
    "button",
    "navigate('settings')",
    selectors={"class": "lx-topbar__title", "aria": "切换题库"},
    apis=["Router"],
    unhappy=["无库时文案=未选择题库"],
)
add(
    "topbar.wrongBook",
    "shell",
    "*",
    "错题本",
    "button",
    "navigate wrong | toastInfo",
    selectors={"ariaPrefix": "错题本（"},
    apis=["StatsAPI.summary", "Router"],
    happy=["wrongCount>0 → #/wrong"],
    unhappy=["wrongCount=0 → toast 当前没有错题"],
)
add(
    "topbar.progress",
    "shell",
    "*",
    "进度文字",
    "button",
    "navigate('stats')",
    selectors={"class": "lx-progress-text", "ariaPrefix": "进度："},
    apis=["StatsAPI.summary", "Router"],
    state_changes={"hash": "#/stats", "display": "mastered/total + percent"},
    notes="仅 refreshTopbar 重绘时更新；须订阅 PROGRESS_RESET",
    affects_progress_text=True,
)
add(
    "drawer.close",
    "shell",
    "*",
    "关闭菜单",
    "button",
    "closeDrawer",
    selectors={"aria": "关闭菜单"},
)
add(
    "drawer.overlay",
    "shell",
    "*",
    "遮罩点击",
    "button",
    "closeDrawer",
    selectors={"class": "lx-overlay"},
)
add(
    "drawer.esc",
    "shell",
    "*",
    "Escape",
    "gesture",
    "closeDrawer",
    selectors={"keydown": "Escape"},
)
add(
    "drawer.libRow",
    "shell",
    "*",
    "题库行",
    "button",
    "LibraryAPI.switch + navigate study",
    selectors={"class": "lx-drawer__item", "parent": "#drawer-libraries"},
    apis=["LibraryAPI.switch", "Router"],
    dynamic=True,
    affects_progress_text=True,
)
add(
    "drawer.importLibrary",
    "shell",
    "*",
    "上传新题库",
    "button",
    "navigate settings + click primary",
    selectors={"text": "上传新题库"},
)
add(
    "drawer.createLibrary",
    "shell",
    "*",
    "新建空题库",
    "button",
    "appPrompt → LibraryAPI.create → add-question",
    selectors={"text": "新建空题库"},
    apis=["LibraryAPI.create", "LibraryAPI.switch", "appPrompt"],
    unhappy=["prompt cancel", "空名 toast", "create fail"],
    affects_progress_text=True,
)
add(
    "drawer.deleteLibrary",
    "shell",
    "*",
    "删除当前题库",
    "button",
    "navigate settings",
    selectors={"text": "删除当前题库"},
    unhappy=["libs.length=0 → disabled"],
)
add(
    "drawer.viewStats",
    "shell",
    "*",
    "查看进度统计",
    "button",
    "hash=#/stats",
    selectors={"text": "查看进度统计"},
)
add(
    "drawer.exportLibrary",
    "shell",
    "*",
    "导出当前题库",
    "button",
    "navigate settings",
    selectors={"text": "导出当前题库"},
)
add(
    "drawer.exportProgress",
    "shell",
    "*",
    "备份学习进度",
    "button",
    "navigate settings",
    selectors={"text": "备份学习进度"},
)
add(
    "drawer.importProgress",
    "shell",
    "*",
    "恢复学习进度",
    "button",
    "navigate settings",
    selectors={"text": "恢复学习进度"},
)
add(
    "drawer.resetProgress",
    "shell",
    "*",
    "重置学习进度",
    "button",
    "appConfirm → ProgressAPI.reset",
    selectors={"text": "重置学习进度"},
    apis=["ProgressAPI.reset", "appConfirm"],
    state_changes={
        "progress": "cleared",
        "toast": "进度已重置",
        "event": "PROGRESS_RESET",
        "lx-progress-text": "MUST refresh",
    },
    happy=["confirm → reset → toast → topbar 0/N"],
    unhappy=["confirm cancel → 不变", "reset !ok → 无 toast"],
    affects_progress_text=True,
    notes="已知 bug：main-ui 未订 PROGRESS_RESET → lx-progress-text stale",
)
add(
    "drawer.help",
    "shell",
    "*",
    "使用帮助",
    "button",
    "navigate help",
    selectors={"text": "使用帮助"},
)
add(
    "drawer.about",
    "shell",
    "*",
    "关于",
    "button",
    "navigate settings",
    selectors={"text": "关于"},
)
add(
    "shell.openDrawerEvent",
    "shell",
    "*",
    "lx:open-drawer",
    "gesture",
    "openDrawer",
    selectors={"event": "lx:open-drawer"},
)
add(
    "shell.closeDrawerEvent",
    "shell",
    "*",
    "lx:close-drawer",
    "gesture",
    "closeDrawer",
    selectors={"event": "lx:close-drawer"},
)
add(
    "confirm.appConfirm",
    "shell",
    "*",
    "确认框",
    "modal",
    "boolean OK/Cancel",
    selectors={"api": "appConfirm"},
    unhappy=["false 中止"],
)
add(
    "prompt.appPrompt",
    "shell",
    "*",
    "输入框",
    "modal",
    "string|null",
    selectors={"api": "appPrompt"},
    unhappy=["null cancel"],
)
add(
    "toast.surface",
    "shell",
    "*",
    "Toast",
    "feedback",
    "auto-dismiss",
    selectors={"class": "lx-toast"},
    notes="pointer-events:none，非点击控件",
)
add(
    "download.triggerBlobDownload",
    "shell",
    "*",
    "下载",
    "ephemeral",
    "a.click()",
    selectors={"module": "download.js"},
)

for cid, label, action, unhappy, apt in [
    ("bottombar.clearMark", "清除标记", "ProgressAPI.setStatus(q,'none')", ["status=none → disabled", "API fail toast"], True),
    ("bottombar.mastered", "掌握/已掌握", "toggle mastered/none", ["无当前题"], True),
    ("bottombar.wrong", "错题/错题中", "toggle review/none", ["无当前题"], True),
    ("bottombar.prev", "上一题", "NavigationAPI.prev()", [], False),
    ("bottombar.browse", "浏览", "navigate('browse')", [], False),
    ("bottombar.next", "下一题", "NavigationAPI.next()", [], False),
]:
    add(
        cid,
        "shell",
        "#/study",
        label,
        "button",
        action,
        selectors={"aria": label.split("/")[0], "visibleWhen": "route=study"},
        unhappy=unhappy,
        affects_progress_text=apt,
    )

# —— pages ——
add("home.openHelp", "home", "#/", "使用帮助", "button", "navigate help", selectors={"text": "使用帮助"})
add(
    "home.libRow",
    "home",
    "#/",
    "题库列表项",
    "button",
    "LibraryAPI.switch → study",
    selectors={"class": "lx-list__item"},
    dynamic=True,
    affects_progress_text=True,
    unhappy=["switch !ok 静默", "空库无行"],
)
add(
    "home.startStudy",
    "home",
    "#/",
    "开始学习",
    "button",
    "navigate study",
    selectors={"text": "开始学习"},
    unhappy=["无当前库时隐藏"],
)

add(
    "study.empty.uploadCta",
    "study",
    "#/study",
    "上传题库",
    "button",
    "dispatch lx:open-drawer",
    selectors={"text": "上传题库", "when": "无 currentLib"},
)
add(
    "study.finished.gotoFirst",
    "study",
    "#/study",
    "回到第 1 题",
    "button",
    "NavigationAPI.goto(0)",
    selectors={"text": "回到第 1 题"},
)
add(
    "study.gesture.swipe",
    "study",
    "#/study",
    "卡片滑动",
    "gesture",
    "L next / R prev / U mastered / D wrong",
    apis=["NavigationAPI", "ProgressAPI"],
    affects_progress_text=True,
    unhappy=["多指忽略", "输入框内忽略", "滑动后 350ms 抑 click"],
)
add(
    "study.gesture.keyboard",
    "study",
    "#/study",
    "方向键",
    "gesture",
    "← prev / → next (+commit draft)",
    unhappy=["input/textarea 焦点时忽略"],
)
add(
    "study.gesture.backGuard",
    "study",
    "#/study",
    "离开守卫",
    "gesture",
    "appConfirm if dirty drafts",
    unhappy=["confirm cancel → 留在 study"],
)
add(
    "card.statusBadge",
    "study",
    "#/study",
    "状态徽章",
    "button",
    "cycle none→mastered→review→none",
    selectors={"class": "lx-status-badge", "aria": "切换状态"},
    apis=["ProgressAPI.setStatus"],
    affects_progress_text=True,
)
add(
    "card.option",
    "study",
    "#/study",
    "选项",
    "button",
    "single: answer; multi: toggle",
    selectors={"class": "lx-option"},
    dynamic=True,
    apis=["QuestionAPI.answer"],
    unhappy=["revealed 后非错选项 disabled"],
)
add(
    "card.multiConfirm",
    "study",
    "#/study",
    "确认答案(多选)",
    "button",
    "QuestionAPI.answer(selected)",
    selectors={"class": "lx-submit-btn", "when": "multi && !revealed"},
    unhappy=["未选 → disabled"],
)
add("card.judge.true", "study", "#/study", "对", "button", "answer('对')", selectors={"class": "lx-judge__btn", "text": "对"})
add("card.judge.false", "study", "#/study", "错", "button", "answer('错')", selectors={"class": "lx-judge__btn", "text": "错"})
add("card.fill.input", "study", "#/study", "填空输入", "input", "draft + Enter commit", selectors={"class": "lx-fill__input"})
add(
    "card.fill.confirm",
    "study",
    "#/study",
    "填空确认",
    "button",
    "commit fill",
    selectors={"aria": "确认答案", "parent": ".lx-fill__row"},
    unhappy=["空 trim → disabled"],
)
add("card.essay.textarea", "study", "#/study", "简答草稿", "textarea", "pending draft", selectors={"class": "lx-essay-textarea"})
add("card.essay.skipToExplain", "study", "#/study", "直接看解析", "button", "essayExpanded=true", selectors={"text": "直接看解析"})
add(
    "card.essay.confirm",
    "study",
    "#/study",
    "简答确认",
    "button",
    "QuestionAPI.answer essay",
    selectors={"text": "确认答案"},
    unhappy=["空 trim 不提交"],
)
add("card.essay.panelToggle", "study", "#/study", "点按查看解析", "button", "toggle panel", selectors={"class": "lx-essay-panel__toggle"})
add("card.essay.tab", "study", "#/study", "答案|解析|口诀", "button", "switch essayActiveTab", selectors={"class": "lx-tab"}, dynamic=True)
add("card.essay.addAnswerText", "study", "#/study", "添加参考答案", "button", "enter editing", selectors={"text": "添加参考答案"})
add("card.essay.editAnswerText", "study", "#/study", "编辑参考答案", "button", "enter editing", selectors={"text": "编辑参考答案"})
add("card.essay.editTextarea", "study", "#/study", "参考答案编辑框", "textarea", "local edit", selectors={"parent": ".lx-essay-edit"})
add("card.essay.cancelEdit", "study", "#/study", "取消编辑", "button", "cancel editing", selectors={"text": "取消", "parent": ".lx-essay-edit"})
add(
    "card.essay.saveAnswerText",
    "study",
    "#/study",
    "保存参考答案",
    "button",
    "QuestionAPI.update",
    selectors={"text": "保存参考答案"},
    unhappy=["update fail toast"],
)

add("wrong.exit", "wrong", "#/wrong", "退出", "button", "WrongBookAPI.exit → home", selectors={"text": "退出"}, affects_progress_text=True)
add(
    "wrong.markMastered",
    "wrong",
    "#/wrong",
    "我已掌握",
    "button",
    "markMasteredInWrongBook",
    selectors={"text": "我已掌握"},
    affects_progress_text=True,
    unhappy=["fail toast"],
)
add("wrong.next", "wrong", "#/wrong", "下一题", "button", "NavigationAPI.next()", selectors={"text": "下一题"})
add(
    "wrong.celebration.home",
    "wrong",
    "#/wrong",
    "回到首页",
    "button",
    "hash=#/",
    selectors={"text": "回到首页", "parent": ".lx-celebrate"},
)
add("wrong.gesture.swipe", "wrong", "#/wrong", "滑动", "gesture", "L/R next/prev; U mastered", affects_progress_text=True)
add("wrong.gesture.keyboard", "wrong", "#/wrong", "方向键", "gesture", "prev/next")
add(
    "wrong.card.reuse",
    "wrong",
    "#/wrong",
    "卡片答题控件",
    "group",
    "复用 card.js；对 → onWrongBookGraded",
    notes="简答参考答案编辑在错题本未接线",
    affects_progress_text=True,
)

add(
    "settings.fileInput.library",
    "settings",
    "#/settings",
    "题库文件 input",
    "input",
    "IOAPI.parseFile+importLibrary",
    selectors={"type": "file", "accept": ".xlsx,.xls,.json,.csv,.txt"},
    unhappy=["parse fail", "0题", "DUPLICATE"],
    affects_progress_text=True,
)
add(
    "settings.fileInput.progress",
    "settings",
    "#/settings",
    "进度文件 input",
    "input",
    "IOAPI.importProgress",
    selectors={"type": "file", "accept": ".json"},
    affects_progress_text=True,
    unhappy=["fail toast"],
)
add(
    "settings.lib.switch",
    "settings",
    "#/settings",
    "切换",
    "button",
    "LibraryAPI.switch",
    selectors={"text": "切换"},
    dynamic=True,
    affects_progress_text=True,
)
add(
    "settings.lib.delete",
    "settings",
    "#/settings",
    "删除",
    "button",
    "appConfirm → LibraryAPI.delete",
    selectors={"text": "删除"},
    dynamic=True,
    affects_progress_text=True,
    unhappy=["confirm cancel", "delete fail"],
)
add("settings.uploadLibrary", "settings", "#/settings", "上传新题库", "button", "fileInput.click()", selectors={"text": "上传新题库"})
add(
    "settings.exportProgress",
    "settings",
    "#/settings",
    "备份进度",
    "button",
    "IOAPI.exportProgress",
    selectors={"text": "备份进度"},
    unhappy=["export fail"],
)
add("settings.importProgressBtn", "settings", "#/settings", "恢复进度", "button", "progressInput.click()", selectors={"text": "恢复进度"})
add(
    "settings.resetProgress",
    "settings",
    "#/settings",
    "重置当前题库进度",
    "button",
    "appConfirm → ProgressAPI.reset + page refresh",
    selectors={"text": "重置当前题库进度"},
    apis=["ProgressAPI.reset"],
    affects_progress_text=True,
    state_changes={"pageCards": "local refresh", "topbar.lx-progress-text": "MUST update via PROGRESS_RESET"},
    happy=["confirm → 0 mastered/review + topbar sync"],
    unhappy=["confirm cancel", "无当前库无此段"],
    notes="页内卡会 refresh；顶栏依赖事件订阅",
)
add("settings.export.json", "settings", "#/settings", "JSON", "button", "exportLibrary json", selectors={"text": "JSON"})
add("settings.export.xlsx", "settings", "#/settings", "Excel", "button", "exportLibrary xlsx", selectors={"text": "Excel"})
add(
    "settings.export.csv",
    "settings",
    "#/settings",
    "CSV",
    "button",
    "exportLibrary csv",
    selectors={"text": "CSV"},
    unhappy=["常失败 toast"],
)
add("settings.downloadTemplate", "settings", "#/settings", "下载导入模板", "button", "IOAPI.downloadTemplate", selectors={"text": "下载导入模板"})
add(
    "settings.theme",
    "settings",
    "#/settings",
    "主题色",
    "button",
    "setTheme",
    selectors={"title": "THEME.name"},
    dynamic=True,
    notes="11 个主题",
)
add(
    "settings.mode",
    "settings",
    "#/settings",
    "显示模式",
    "button",
    "setMode",
    selectors={"text": "普通模式|夜间模式|护眼模式"},
    dynamic=True,
)
add("settings.openHelp", "settings", "#/settings", "查看使用帮助", "button", "navigate help", selectors={"text": "查看使用帮助"})

add("browse.backStudy", "browse", "#/browse", "返回刷题", "button", "navigate study", selectors={"aria": "返回刷题"})
add("browse.addQuestion", "browse", "#/browse", "新增", "button", "navigate add-question", selectors={"aria": "新增题目"})
add(
    "browse.search.input",
    "browse",
    "#/browse",
    "搜索题干",
    "input",
    "draft; Enter commitSearch",
    selectors={"type": "search", "aria": "搜索题干"},
    unhappy=["IME composition 中忽略 Enter"],
)
add(
    "browse.search.submit",
    "browse",
    "#/browse",
    "搜索",
    "button",
    "commitSearch AND filter",
    selectors={"aria": "执行题干搜索"},
    unhappy=["空 draft → toast 请输入搜索关键字"],
)
add(
    "browse.search.chipDismiss",
    "browse",
    "#/browse",
    "清除过滤标签",
    "button",
    "removeFilterAt",
    selectors={"class": "lx-chip__dismiss"},
    dynamic=True,
)
add("browse.toolbar.modeToggle", "browse", "#/browse", "顺序/随机", "button", "NavigationAPI.setMode", selectors={"aria": "顺序模式|随机模式"})
add(
    "browse.toolbar.reshuffle",
    "browse",
    "#/browse",
    "换一批",
    "button",
    "NavigationAPI.shuffle",
    selectors={"aria": "换一批", "visibleWhen": "random"},
)
add(
    "browse.toolbar.clearCategory",
    "browse",
    "#/browse",
    "清除分类",
    "button",
    "setCategory('all')",
    selectors={"aria": "清除分类", "visibleWhen": "category≠all"},
)
add("browse.toolbar.collapseAll", "browse", "#/browse", "全部折叠", "button", "collapse all", selectors={"aria": "全部折叠"})
add("browse.toolbar.expandAll", "browse", "#/browse", "全部展开", "button", "expand all", selectors={"aria": "全部展开"})
add("browse.practice.open", "browse", "#/browse", "练习模式", "button", "open practice modal", selectors={"aria": "练习模式"})
add(
    "browse.practice.hint",
    "browse",
    "#/browse",
    "练习说明?",
    "button",
    "appConfirm → optional help",
    selectors={"aria": "练习模式说明"},
    unhappy=["confirm cancel 不跳转"],
)
add("browse.practice.overlayClose", "browse", "#/browse", "练习面板遮罩", "modal", "closePracticeSheet")
add("browse.practice.closeX", "browse", "#/browse", "关闭练习设置", "button", "closePracticeSheet", selectors={"aria": "关闭练习模式设置"})
add(
    "browse.practice.mode.memory",
    "browse",
    "#/browse",
    "背诵记忆",
    "button",
    "mode=memory; count disabled",
    selectors={"aria": "背诵记忆"},
)
add(
    "browse.practice.mode.quick",
    "browse",
    "#/browse",
    "快速刷题",
    "button",
    "mode=quick; count enabled",
    selectors={"aria": "快速刷题"},
)
add(
    "browse.practice.countInput",
    "browse",
    "#/browse",
    "本轮题量",
    "input",
    "countDraft",
    selectors={"aria": "本轮题量"},
    unhappy=["memory 时 disabled"],
)
add("browse.practice.cancel", "browse", "#/browse", "取消练习", "button", "closePracticeSheet", selectors={"aria": "取消练习模式"})
add(
    "browse.practice.start",
    "browse",
    "#/browse",
    "开始练习",
    "button",
    "DrillAPI.start → study",
    selectors={"aria": "开始练习"},
    unhappy=["题量无效 toast", "start fail"],
)
add("browse.categoryHeader", "browse", "#/browse", "分类头折叠", "button", "toggle collapsed", dynamic=True)
add(
    "browse.practiceCategory",
    "browse",
    "#/browse",
    "只练本类",
    "button",
    "setCategory → study",
    selectors={"text": "只练本类"},
    dynamic=True,
    notes="搜索态隐藏",
)
add(
    "browse.questionRow",
    "browse",
    "#/browse",
    "题目行跳转",
    "button",
    "goto / searchPlaylist jump → study",
    selectors={"class": "lx-catalog-item"},
    dynamic=True,
    unhappy=["jump fail toast"],
)
add(
    "browse.search.sentinel",
    "browse",
    "#/browse",
    "触底续载",
    "gesture",
    "loadMoreSearch",
    selectors={"data-search-sentinel": "1"},
    unhappy=["loading 中忽略", "load fail toast"],
)
add(
    "browse.empty.goHome",
    "browse",
    "#/browse",
    "去首页",
    "button",
    "navigate home",
    selectors={"text": "去首页", "when": "无库"},
)

add("addq.backBrowse", "add-question", "#/add-question", "返回浏览", "button", "navigate browse", selectors={"text": "返回浏览"})
add("addq.type", "add-question", "#/add-question", "题型 chip", "chip", "set form.type", selectors={"class": "lx-addq__type-btn"}, dynamic=True)
add("addq.category", "add-question", "#/add-question", "分类", "input", "form.category")
add("addq.question", "add-question", "#/add-question", "题干", "textarea", "form.question", unhappy=["空保存 toast"])
add(
    "addq.optionCheck",
    "add-question",
    "#/add-question",
    "选项正确标记",
    "button",
    "set answer letters",
    selectors={"class": "lx-addq__opt-check"},
    dynamic=True,
)
add("addq.optionText", "add-question", "#/add-question", "选项文本", "input", "form.options[i]", dynamic=True)
add(
    "addq.optionRemove",
    "add-question",
    "#/add-question",
    "删除选项",
    "button",
    "splice option",
    dynamic=True,
    unhappy=["≤2 选项 → toast"],
)
add(
    "addq.addOption",
    "add-question",
    "#/add-question",
    "添加选项",
    "button",
    "push option",
    selectors={"text": "添加选项"},
    unhappy=["≥8 隐藏"],
)
add("addq.judge.true", "add-question", "#/add-question", "对", "button", "answer=对")
add("addq.judge.false", "add-question", "#/add-question", "错", "button", "answer=错")
add("addq.fill.answer", "add-question", "#/add-question", "填空答案", "input", "form.answer", unhappy=["空保存 toast"])
add(
    "addq.essay.answerText",
    "add-question",
    "#/add-question",
    "简答参考答案",
    "textarea",
    "form.answerText",
    unhappy=["空保存 toast"],
)
add("addq.explanation", "add-question", "#/add-question", "解析", "textarea", "form.explanation")
add(
    "addq.cancel",
    "add-question",
    "#/add-question",
    "取消",
    "button",
    "appConfirm → browse",
    unhappy=["confirm cancel 留下"],
)
add(
    "addq.save",
    "add-question",
    "#/add-question",
    "保存题目",
    "button",
    "QuestionAPI.add",
    selectors={"text": "保存题目"},
    unhappy=["空题干", "<2选项", "未选答案", "判断未选", "填空/简答空", "API fail", "多选成功路径需补测"],
    notes="QUESTION_ADDED 是否刷新顶栏 total 需核对",
)
add(
    "addq.noLib.goSettings",
    "add-question",
    "#/add-question",
    "去设置",
    "button",
    "navigate settings",
    selectors={"text": "去设置", "when": "无库"},
)

add("help.goStudy.quickStart", "help", "#/help", "去刷题", "button", "navigate study", selectors={"text": "去刷题"})
add("help.goSettings", "help", "#/help", "前往设置", "button", "navigate settings", selectors={"text": "前往设置"})
add("help.goStudy.footer", "help", "#/help", "开始刷题", "button", "navigate study", selectors={"text": "开始刷题"})

pages_without_controls = {
    "stats": {
        "route": "#/stats",
        "note": "纯展示；交互仅经 shell topbar.back / topbar.progress",
        "emptyStates": ["请先选择题库", "统计失败"],
    }
}

snapshot_schema = {
    "description": "每次 action 前后采集；系统测用 expectDelta 做差分断言",
    "fields": {
        "meta": {
            "t": "number ISO ms",
            "hash": "string",
            "route": "string",
            "drawerOpen": "boolean",
            "toastLast": "string|null",
            "confirmAsked": "string[]",
            "promptAsked": "string[]",
            "downloads": "string[]",
        },
        "controls": {
            "<controlId>": {
                "present": "boolean",
                "visible": "boolean",
                "disabled": "boolean",
                "text": "string",
                "ariaLabel": "string",
                "ariaPressed": "string|null",
                "value": "string|null",
                "selected": "boolean|null",
                "count": "number|null",
            }
        },
        "chrome": {
            "progressText": "string",
            "progressAria": "string",
            "wrongBadge": "number",
            "libraryTitle": "string",
            "bottombarVisible": "boolean",
            "bottombar": {
                "clearMarkDisabled": "boolean",
                "masteredPressed": "boolean",
                "wrongPressed": "boolean",
            },
        },
        "domain": {
            "currentLibId": "string|null",
            "libCount": "number",
            "questionCount": "number",
            "nav": {
                "index": "number",
                "total": "number",
                "qId": "any",
                "mode": "string",
                "category": "string",
                "statusFilter": "string",
            },
            "progress": {
                "mastered": "number",
                "review": "number",
                "percent": "number",
                "currentStatus": "string",
            },
            "drill": {
                "active": "boolean",
                "mode": "string|null",
                "index": "number|null",
                "total": "number|null",
            },
            "wrongbook": {"active": "boolean", "count": "number"},
            "searchPlaylist": {"active": "boolean", "size": "number", "index": "number"},
            "uiSession": {"browseSearch": "object", "practiceSheet": "object|null"},
        },
    },
    "collectorApi": {
        "name": "collectUiState(root=document)",
        "plannedModule": "test/system/ui-state-collector.js",
        "domainVia": "window.LX.*API + getUiSession()",
        "controlsVia": "inventory selectors + query within #app",
    },
}

system_protocol = {
    "name": "UI 状态差分系统测",
    "rules": [
        "seed 固定场景后 collectUiState → baseline",
        "每步：perform(controlId, args) → collectUiState → assertDelta(expectDelta)",
        "expectDelta 只写应变化字段；未列出的字段默认 assertUnchanged",
        "每个 control 至少 1 条 happy + 可见的 unhappy（disabled/cancel/validation）",
        "涉及进度的操作必须断言 chrome.progressText 与 domain.progress 一致",
        "旅程结束做 productExpectation 审查清单",
    ],
    "stepShape": {
        "id": "string",
        "controlId": "string",
        "args": "object",
        "precondition": "optional state predicate",
        "expectDelta": {"chrome": {}, "domain": {}, "controls": {}, "meta": {}},
        "expectUnchanged": ["optional explicit paths"],
        "path": "happy|unhappy",
    },
}

system_cases = [
    {
        "id": "SYS-SHELL-RESET-PROGRESS-TOPBAR",
        "title": "重置进度后顶栏 lx-progress-text 同步为 0",
        "seed": {"questions": 5, "markMastered": [1, 2], "markReview": [3]},
        "steps": [
            {"id": "s1", "controlId": "topbar.menu", "path": "happy", "expectDelta": {"meta": {"drawerOpen": True}}},
            {
                "id": "s2",
                "controlId": "drawer.resetProgress",
                "args": {"confirm": True},
                "path": "happy",
                "expectDelta": {
                    "domain": {"progress": {"mastered": 0, "review": 0, "percent": 0}},
                    "chrome": {"progressText": "0/5\n0%", "wrongBadge": 0},
                    "meta": {"toastLast": "进度已重置", "drawerOpen": False},
                },
            },
        ],
        "productExpectation": "重置后顶栏与 StatsAPI.summary 一致；不得残留旧 mastered/total",
    },
    {
        "id": "SYS-SHELL-RESET-PROGRESS-CANCEL",
        "title": "重置进度取消不变",
        "seed": {"markMastered": [1]},
        "steps": [
            {
                "id": "s1",
                "controlId": "drawer.resetProgress",
                "args": {"confirm": False},
                "path": "unhappy",
                "expectDelta": {},
                "expectUnchanged": ["domain.progress", "chrome.progressText"],
            }
        ],
        "productExpectation": "取消后进度与顶栏完全不变",
    },
    {
        "id": "SYS-SETTINGS-RESET-PROGRESS-TOPBAR",
        "title": "设置页重置进度亦刷新顶栏",
        "seed": {"markMastered": [1, 2]},
        "steps": [
            {"id": "s1", "controlId": "topbar.libraryTitle", "path": "happy", "expectDelta": {"meta": {"hash": "#/settings"}}},
            {
                "id": "s2",
                "controlId": "settings.resetProgress",
                "args": {"confirm": True},
                "path": "happy",
                "expectDelta": {
                    "domain": {"progress": {"mastered": 0, "review": 0}},
                    "chrome": {"progressTextIncludes": "0/"},
                },
            },
        ],
        "productExpectation": "设置页内统计卡与顶栏同时归零",
    },
    {
        "id": "SYS-STUDY-STATUS-CYCLE-TOPBAR",
        "title": "刷题标记掌握/错题驱动顶栏",
        "seed": {"questions": 3},
        "steps": [
            {
                "id": "s1",
                "controlId": "bottombar.mastered",
                "path": "happy",
                "expectDelta": {"domain": {"progress": {"mastered": 1}}, "chrome": {"progressTextIncludes": "1/"}},
            },
            {
                "id": "s2",
                "controlId": "bottombar.wrong",
                "path": "happy",
                "expectDelta": {"domain": {"progress": {"mastered": 0, "review": 1}}, "chrome": {"wrongBadge": 1}},
            },
            {
                "id": "s3",
                "controlId": "bottombar.clearMark",
                "path": "happy",
                "expectDelta": {"domain": {"progress": {"review": 0}}, "chrome": {"wrongBadge": 0}},
            },
        ],
        "productExpectation": "底栏状态与顶栏进度/错题角标一致",
    },
    {
        "id": "SYS-BROWSE-SEARCH-PLAYLIST",
        "title": "搜索→点题→playlist→翻题不出圈",
        "seed": {"questions": 10},
        "steps": [
            {"id": "s1", "controlId": "bottombar.browse", "expectDelta": {"meta": {"hash": "#/browse"}}},
            {"id": "s2", "controlId": "browse.search.input", "args": {"value": "关键词"}},
            {
                "id": "s3",
                "controlId": "browse.search.submit",
                "path": "happy",
                "expectDelta": {"domain": {"uiSession.browseSearch.filters": ["关键词"]}},
            },
            {
                "id": "s4",
                "controlId": "browse.questionRow",
                "args": {"index": 0},
                "path": "happy",
                "expectDelta": {"meta": {"hash": "#/study"}, "domain": {"searchPlaylist": {"active": True}}},
            },
            {"id": "s5", "controlId": "bottombar.next", "path": "happy"},
        ],
        "productExpectation": "playlist 内翻题；过滤标签保留直至清除",
    },
    {
        "id": "SYS-BROWSE-SEARCH-EMPTY",
        "title": "空关键字搜索失败",
        "steps": [
            {
                "id": "s1",
                "controlId": "browse.search.submit",
                "args": {"draft": ""},
                "path": "unhappy",
                "expectDelta": {"meta": {"toastLastIncludes": "关键字"}},
                "expectUnchanged": ["domain.uiSession.browseSearch.filters"],
            }
        ],
    },
    {
        "id": "SYS-DRILL-QUICK-ADVANCE",
        "title": "快速刷题答对自动推进",
        "steps": [
            {"id": "s1", "controlId": "browse.practice.open"},
            {"id": "s2", "controlId": "browse.practice.mode.quick"},
            {"id": "s3", "controlId": "browse.practice.countInput", "args": {"value": 3}},
            {
                "id": "s4",
                "controlId": "browse.practice.start",
                "path": "happy",
                "expectDelta": {
                    "domain": {"drill": {"active": True, "mode": "quick", "total": 3}},
                    "meta": {"hash": "#/study"},
                },
            },
            {
                "id": "s5",
                "controlId": "card.option",
                "args": {"correct": True},
                "path": "happy",
                "expectDelta": {"domain": {"drill.index": 1}},
            },
        ],
    },
    {
        "id": "SYS-WRONGBOOK-CLEAR-CELEBRATE",
        "title": "错题本清空庆祝",
        "seed": {"markReview": [1]},
        "steps": [
            {"id": "s1", "controlId": "topbar.wrongBook", "path": "happy", "expectDelta": {"meta": {"hash": "#/wrong"}}},
            {
                "id": "s2",
                "controlId": "wrong.markMastered",
                "path": "happy",
                "expectDelta": {
                    "domain": {"wrongbook": {"count": 0}},
                    "chrome": {"wrongBadge": 0},
                    "controls": {"wrong.celebration.home": {"present": True}},
                },
            },
        ],
    },
]

coverage = {
    "method": "controlId × (unit-ui buttons | system journey | gap)",
    "legend": {
        "covered": "已有 DOM/壳接线测例覆盖 happy 或 unhappy",
        "partial": "仅组件 stub / 仅 API / 缺顶栏或差分断言",
        "missing": "无对应测例",
    },
    "byControl": {
        "topbar.progress": {
            "unitUi": "partial",
            "system": "missing",
            "note": "有跳转 stats；无重置后 progressText 断言",
        },
        "drawer.resetProgress": {
            "unitUi": "partial",
            "system": "missing",
            "note": "有 confirm/toast/API；无 lx-progress-text",
        },
        "settings.resetProgress": {
            "unitUi": "partial",
            "system": "missing",
            "note": "同上",
        },
        "bottombar.*": {
            "unitUi": "partial",
            "system": "missing",
            "note": "stub 回调；无 mountShell→API→顶栏",
        },
        "study.gesture.swipe": {"unitUi": "missing", "system": "missing", "note": "仅 guards 单元"},
        "card.essay.saveAnswerText": {"unitUi": "missing", "system": "missing"},
        "addq.save multi happy": {"unitUi": "missing", "system": "missing"},
        "settings.lib.delete cancel": {"unitUi": "missing", "system": "missing"},
        "browse.*": {"unitUi": "covered", "system": "partial", "note": "buttons+session 厚；缺状态差分协议"},
        "wrong.*": {"unitUi": "covered", "system": "partial"},
        "stats page": {"unitUi": "partial", "system": "missing", "note": "仅渲染文案"},
        "help.*": {"unitUi": "covered", "system": "missing"},
        "home.*": {"unitUi": "covered", "system": "missing"},
    },
    "priorityGaps": [
        "P0: 任意 ProgressAPI.reset 路径 → chrome.progressText 同步",
        "P0: bottombar 壳接线 → Progress/Nav + progressText/wrongBadge",
        "P1: study swipe 手势整页",
        "P1: addq 多选保存成功",
        "P1: settings 删除 confirm 取消",
        "P1: card 简答参考答案保存/清空",
        "P2: 全控件状态差分系统测落地 collector + runner",
    ],
}

doc = {
    "schemaVersion": "1.0.0",
    "title": "lx UI 控件全量清单 + 状态差分系统测协议",
    "updated": str(date.today()),
    "scope": {
        "include": [
            "src/render/**（不含 v3-preview）",
            "shell + pages + card + gestures + confirm/prompt/toast/download",
        ],
        "exclude": [
            "v3-preview/**",
            "test.html 控制台自身控件（非产品 UI）",
            "纯展示文案节点",
        ],
    },
    "routes": {
        "home": "#/",
        "study": "#/study",
        "wrong": "#/wrong",
        "stats": "#/stats",
        "settings": "#/settings",
        "browse": "#/browse",
        "catalog": "#/catalog  # alias → browse",
        "add-question": "#/add-question",
        "help": "#/help",
    },
    "knownBugs": [
        {
            "id": "BUG-PROGRESS-TEXT-AFTER-RESET",
            "summary": "重置学习进度后 .lx-progress-text 不更新",
            "rootCause": "ProgressAPI.reset 只 emit PROGRESS_RESET；main-ui refreshTopbar 未订阅该事件",
            "repro": ["标记掌握若干", "抽屉/设置重置进度", "观察顶栏仍为旧 mastered/total"],
            "fix": "main-ui 订阅 PROGRESS_RESET（或 reset 同时 emit PROGRESS_UPDATED）+ 系统测断言 progressText",
            "relatedControls": ["drawer.resetProgress", "settings.resetProgress", "topbar.progress"],
        }
    ],
    "stats": {
        "controlCount": len(controls),
        "byPage": dict(Counter(c["page"] for c in controls)),
        "byElementType": dict(Counter(c["elementType"] for c in controls)),
    },
    "pagesWithoutControls": pages_without_controls,
    "controls": controls,
    "uiStateSnapshotSchema": snapshot_schema,
    "systemTestProtocol": system_protocol,
    "systemCases": system_cases,
    "coverageVsExistingTests": coverage,
    "reviewChecklist": [
        "每个 src/render/pages/*.js 的 onclick/onchange/oninput/addEventListener 是否有 controlId",
        "shell topbar/bottombar/drawer 是否齐全",
        "card.js 五题型全部控件",
        "gestures swipe/keyboard/leave",
        "动态列表用 template controlId 而非漏行",
        "每个 control 至少规划 happy + 代码可见 unhappy",
        "影响进度的 control 必须挂 affectsProgressText 与系统测差分",
    ],
}


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} controls={len(controls)}")
    print("byPage", doc["stats"]["byPage"])


if __name__ == "__main__":
    main()
